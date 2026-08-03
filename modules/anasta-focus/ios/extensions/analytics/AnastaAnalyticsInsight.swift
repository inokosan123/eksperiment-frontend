import Foundation

enum AnastaAnalyticsInsightEngine {
  static func make(
    period: AnastaAnalyticsPeriod,
    buckets: [AnastaAnalyticsBucket],
    groups: [AnastaAnalyticsGroup],
    comparison: AnastaAnalyticsComparison?,
    coverage: AnastaAnalyticsCoverage
  ) -> AnastaAnalyticsInsight {
    let qualifiedComparison = comparison.flatMap { value in
      guard
        abs(value.absoluteDelta) >= 15 * 60,
        let percent = value.percentDelta,
        abs(percent) >= 10
      else { return nil }
      return value
    }
    let peak = period == .day ? peakWindow(buckets) : nil
    let yearDirection = period == .year
      ? sustainedThreeMonthDirection(buckets)
      : nil
    let available = buckets.filter {
      $0.availability == .available || $0.availability == .partialToday
    }
    let availableTotal = available.compactMap(\.managedDuration).reduce(0, +)
    let heaviest = (period == .week || period == .month)
      && available.count >= 4
      && availableTotal > 0
      ? available
        .compactMap { bucket in
          bucket.managedDuration.map { (bucket.start, $0) }
        }
        .max(by: { $0.1 < $1.1 })
      : nil
    let concentrated = heaviest.flatMap { value in
      value.1 / availableTotal >= 0.25 ? value : nil
    }
    let changed = period == .year
      ? nil
      : groups
        .compactMap { group -> (AnastaAnalyticsGroup, TimeInterval, Double)? in
          guard
            let current = group.currentDailyAverage,
            let previous = group.previousDailyAverage,
            previous > 0
          else { return nil }
          let delta = current - previous
          let percent = delta / previous * 100
          guard abs(delta) >= 20 * 60, abs(percent) >= 15 else { return nil }
          return (group, delta, percent)
        }
        .max(by: { abs($0.1) < abs($1.1) })
    let top = period == .year
      ? nil
      : groups
        .filter { $0.duration > 0 }
        .max(by: { $0.duration < $1.duration })
    let priority = AnastaAnalyticsPure.insightPriority(
      hasQualifiedComparison: qualifiedComparison != nil,
      hasDayPeak: peak != nil,
      hasYearDirection: yearDirection != nil,
      hasHeaviestDay: concentrated != nil,
      hasChangedGroup: changed != nil,
      hasTopGroup: top != nil
    )

    switch priority {
    case .comparison:
      if let comparison = qualifiedComparison {
        let lower = comparison.absoluteDelta < 0
        let metricName = period == .year
          ? "Total iPhone activity"
          : "Managed activity"
        return AnastaAnalyticsInsight(
          title: lower ? "A lighter rhythm" : "A heavier rhythm",
          body: "\(metricName) was \(duration(abs(comparison.absoluteDelta))) \(lower ? "lower" : "higher") per complete day than the previous \(period.rawValue).",
          symbol: lower ? "arrow.down.right" : "arrow.up.right",
          tone: lower ? .lower : .higher
        )
      }
    case .dayPeak:
      if let peak {
        return AnastaAnalyticsInsight(
          title: "Your most vulnerable window",
          body: "Most managed use clustered from \(hour(peak.start))–\(hour(peak.end)).",
          symbol: "clock.badge.exclamationmark",
          tone: .protective
        )
      }
    case .yearDirection:
      if let yearDirection {
        return yearDirection
      }
    case .heaviestDay:
      if let concentrated {
        let weekday = concentrated.0.formatted(.dateTime.weekday(.wide))
        return AnastaAnalyticsInsight(
          title: "\(weekday) carried the most",
          body: "\(duration(concentrated.1)) of managed activity landed there.",
          symbol: "calendar.badge.clock",
          tone: .neutral
        )
      }
    case .changedGroup:
      if let changed {
        let lower = changed.1 < 0
        return AnastaAnalyticsInsight(
          title: "\(changed.0.name) shifted",
          body: "\(changed.0.name) was \(duration(abs(changed.1))) \(lower ? "lower" : "higher") per complete day than the previous \(period.rawValue).",
          symbol: lower ? "arrow.down.right" : "arrow.up.right",
          tone: lower ? .lower : .higher
        )
      }
    case .topGroup:
      if let top {
        return AnastaAnalyticsInsight(
          title: "\(top.name) carried the most",
          body: "\(duration(top.duration)) of managed activity was connected to this group in the selected \(period.rawValue).",
          symbol: top.isAlwaysBlocked ? "lock.shield.fill" : "square.stack.3d.up.fill",
          tone: top.isAlwaysBlocked ? .protective : .neutral
        )
      }
    case .fallback:
      break
    }

    if period == .year {
      return AnastaAnalyticsInsight(
        title: "Coverage is still forming",
        body: "\(coverage.availableUnitCount) of \(coverage.expectedUnitCount) expected months are currently available for this reflection.",
        symbol: "calendar.badge.clock",
        tone: .neutral
      )
    }
    return AnastaAnalyticsInsight(
      title: period == .week || period == .month
        ? "A fairly even rhythm"
        : "A pattern is still forming",
      body: period == .week || period == .month
        ? "Managed activity was spread without one qualified change dominating this period."
        : "There is not enough managed activity yet to identify a clear rhythm.",
      symbol: "sparkles",
      tone: .neutral
    )
  }

  private static func peakWindow(
    _ buckets: [AnastaAnalyticsBucket]
  ) -> (start: Date, end: Date)? {
    guard
      let bestIndex = AnastaAnalyticsPure.peakTwoBucketWindow(
        buckets.map(\.managedDuration)
      )
    else { return nil }
    return (
      buckets[bestIndex].start,
      buckets[bestIndex + 1].start.addingTimeInterval(60 * 60)
    )
  }

  private static func sustainedThreeMonthDirection(
    _ buckets: [AnastaAnalyticsBucket]
  ) -> AnastaAnalyticsInsight? {
    guard buckets.count >= 3 else { return nil }
    for endIndex in stride(from: buckets.count - 1, through: 2, by: -1) {
      let window = Array(buckets[(endIndex - 2)...endIndex])
      guard
        window.allSatisfy({
          $0.availability == .available && $0.totalDuration != nil
        }),
        let first = window.first?.totalDuration,
        let second = window[1].totalDuration,
        let last = window.last?.totalDuration,
        first > 0
      else { continue }
      let lower = first >= second && second >= last
      let higher = first <= second && second <= last
      let delta = last - first
      let percent = delta / first * 100
      guard
        (lower || higher),
        abs(delta) >= 15 * 60,
        abs(percent) >= 10
      else { continue }
      return AnastaAnalyticsInsight(
        title: lower ? "A lighter three-month direction" : "A heavier three-month direction",
        body: "The latest three complete monthly averages moved in one \(lower ? "lower" : "higher") direction.",
        symbol: lower ? "arrow.down.right" : "arrow.up.right",
        tone: lower ? .lower : .higher
      )
    }
    return nil
  }

  private static func duration(_ value: TimeInterval) -> String {
    let totalMinutes = max(0, Int((value / 60).rounded()))
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    if hours == 0 { return "\(minutes)m" }
    if minutes == 0 { return "\(hours)h" }
    return "\(hours)h \(minutes)m"
  }

  private static func hour(_ date: Date) -> String {
    date.formatted(.dateTime.hour(.defaultDigits(amPM: .abbreviated)))
  }
}

import DeviceActivity
import FamilyControls
import Foundation

private struct AnastaAnalyticsBucketAccumulator {
  var total: TimeInterval = 0
  var managed: TimeInterval = 0
  var managedAvailable = true
  var hasSegment = false
}

private struct AnastaAnalyticsMonthAccumulator {
  var total: TimeInterval = 0
  var managed: TimeInterval = 0
  var managedAvailable = true
  var observedDays = Set<Date>()
  // At most 31 numeric daily summaries live inside each of the 24 monthly
  // Year buckets. No token/app/site dictionary survives a segment.
  var dailyTotals: [Int: TimeInterval] = [:]
  var completeTotal: TimeInterval = 0
  var completeManaged: TimeInterval = 0
  var completeDays = Set<Date>()
  var completeManagedDays = Set<Date>()
}

private struct AnastaAnalyticsGroupAccumulator {
  let id: String
  var name: String
  var duration: TimeInterval
  var applications: [ApplicationToken: TimeInterval]
  var isAlwaysBlocked: Bool
}

private struct AnastaAnalyticsDetailCandidate {
  let owner: AnastaAnalyticsGroupDefinition
  let duration: TimeInterval
  let application: ApplicationToken?
}

func makeAnastaAnalyticsConfiguration(
  representing data: DeviceActivityResults<DeviceActivityData>,
  period: AnastaAnalyticsPeriod
) async -> AnastaAnalyticsConfiguration {
  guard
    let context = AnastaAnalyticsMetadata.context(expectedPeriod: period),
    let selectedStart = AnastaAnalyticsMetadata.date(
      context.selectedStartDate,
      context: context
    ),
    let selectedEndBoundary = AnastaAnalyticsMetadata.date(
      context.selectedEndDateExclusive,
      context: context
    )
  else {
    return .unavailable(
      period: period,
      reason: "Anasta is matching this private report to the selected period."
    )
  }

  let calendar = AnastaAnalyticsMetadata.calendar(for: context)
  let now = Date()
  let selectedEnd = min(selectedEndBoundary, now)
  let selectedInterval = DateInterval(start: selectedStart, end: selectedEnd)
  let comparisonStart = context.comparisonStartDate.flatMap {
    AnastaAnalyticsMetadata.date($0, context: context)
  }
  let comparisonEnd = context.comparisonEndDateExclusive.flatMap {
    AnastaAnalyticsMetadata.date($0, context: context)
  }
  let comparisonInterval = comparisonStart.flatMap { start in
    comparisonEnd.map { DateInterval(start: start, end: $0) }
  }
  let today = calendar.startOfDay(for: now)
  let isCurrentPeriod = today >= selectedStart && today < selectedEndBoundary
  let collectGroupBreakdown = period != .year
  let collectSignals = period != .year
  let outcomesByDay = Dictionary(
    context.dayOutcomes.map { ($0.date, $0) },
    uniquingKeysWith: { _, latest in latest }
  )

  var selectedBuckets: [Date: AnastaAnalyticsBucketAccumulator] = [:]
  var comparisonBuckets: [Date: AnastaAnalyticsBucketAccumulator] = [:]
  var selectedDaily: [Date: AnastaAnalyticsBucketAccumulator] = [:]
  var comparisonDaily: [Date: AnastaAnalyticsBucketAccumulator] = [:]
  var selectedMonths: [Date: AnastaAnalyticsMonthAccumulator] = [:]
  var comparisonMonths: [Date: AnastaAnalyticsMonthAccumulator] = [:]
  var selectedGroups: [String: AnastaAnalyticsGroupAccumulator] = [:]
  var selectedDailyGroups: [Date: [String: AnastaAnalyticsGroupAccumulator]] = [:]
  var comparisonDailyGroups: [Date: [String: AnastaAnalyticsGroupAccumulator]] = [:]
  var selectedTotal: TimeInterval = 0
  var selectedManaged: TimeInterval = 0
  var selectedManagedAvailable = true
  var pickups = 0
  var pickupsByDay: [Date: Int] = [:]
  var notifications = 0
  var hasSignalSegment = false
  var firstPickup: Date?
  var lastUpdatedDate: Date?
  var invalidSelectedKeys = Set<Date>()
  var invalidComparisonKeys = Set<Date>()
  var missingManagedSelectedKeys = Set<Date>()
  var missingManagedComparisonKeys = Set<Date>()
  var scopeCache: [String: AnastaAnalyticsSelectionScope] = [:]
  var missingScopeDays = Set<String>()

  for await activityData in data {
    if Task.isCancelled {
      return .unavailable(
        period: period,
        reason: "The selected period changed before iPhone finished the report."
      )
    }
    if lastUpdatedDate.map({ activityData.lastUpdatedDate > $0 }) ?? true {
      lastUpdatedDate = activityData.lastUpdatedDate
    }

    for await segment in activityData.activitySegments {
      if Task.isCancelled {
        return .unavailable(
          period: period,
          reason: "The selected period changed before iPhone finished the report."
        )
      }
      let segmentDate = segment.dateInterval.start
      let membership = AnastaAnalyticsPure.membership(
        of: segmentDate,
        selected: selectedInterval,
        comparison: comparisonInterval
      )
      let belongsToSelected = membership == .selected
      let belongsToComparison = membership == .comparison
      guard membership != .outside else { continue }

      let displayBucketStart = normalizedBucketStart(
        segmentDate,
        period: period,
        calendar: calendar
      )
      let dayStart = calendar.startOfDay(for: segmentDate)
      let total = segment.totalActivityDuration
      guard plausible(total, in: segment.dateInterval) else {
        if belongsToSelected {
          invalidSelectedKeys.insert(displayBucketStart)
        } else {
          invalidComparisonKeys.insert(displayBucketStart)
        }
        continue
      }

      let segmentDayKey = AnastaAnalyticsMetadata.dayKey(
        segmentDate,
        context: context
      )
      let scopeCacheKey = period == .day
        ? "\(segmentDayKey)#\(segment.dateInterval.start.timeIntervalSince1970)"
        : segmentDayKey
      let scope: AnastaAnalyticsSelectionScope?
      if period != .year, let cached = scopeCache[scopeCacheKey] {
        scope = cached
      } else if period != .year && missingScopeDays.contains(scopeCacheKey) {
        scope = nil
      } else {
        let scopeDate = period == .day
          ? segment.dateInterval.start.addingTimeInterval(
              segment.dateInterval.duration / 2
            )
          : segmentDate
        let loaded = AnastaAnalyticsMetadata.selectionScope(
          for: scopeDate,
          context: context,
          period: period
        )
        if let loaded, period != .year {
          scopeCache[scopeCacheKey] = loaded
        } else if loaded == nil, period != .year {
          missingScopeDays.insert(scopeCacheKey)
        }
        scope = loaded
      }
      let outcome = outcomesByDay[segmentDayKey]
      let managedScopeAvailable = outcome?.hasExactPlanContext == true
        && scope != nil
      var managed: TimeInterval = 0
      var groupValues: [String: AnastaAnalyticsGroupAccumulator] = [:]
      var segmentPickups = segment.totalPickupsWithoutApplicationActivity
      var segmentNotifications = 0
      var segmentPrivateDetailInvalid = false

      for await category in segment.categories {
        let categoryDuration = category.totalActivityDuration
        guard plausible(categoryDuration, in: segment.dateInterval) else {
          segmentPrivateDetailInvalid = true
          continue
        }
        let categoryOwner = category.category.token.flatMap { scope?.owner(of: $0) }
        var candidates: [AnastaAnalyticsDetailCandidate] = []

        for await application in category.applications {
          if collectSignals {
            segmentPickups = AnastaAnalyticsPure.addingPickup(
              segmentPickups,
              applicationPickups: application.numberOfPickups
            )
            segmentNotifications += application.numberOfNotifications
          }
          let duration = application.totalActivityDuration
          guard plausible(duration, in: segment.dateInterval) else {
            segmentPrivateDetailInvalid = true
            continue
          }
          guard
            let token = application.application.token,
            let owner = scope?.owner(of: token)
          else { continue }
          candidates.append(
            AnastaAnalyticsDetailCandidate(
              owner: owner,
              duration: duration,
              application: token
            )
          )
        }

        for await website in category.webDomains {
          let duration = website.totalActivityDuration
          guard plausible(duration, in: segment.dateInterval) else {
            segmentPrivateDetailInvalid = true
            continue
          }
          guard
            let token = website.webDomain.token,
            let owner = scope?.owner(of: token)
          else { continue }
          candidates.append(
            AnastaAnalyticsDetailCandidate(
              owner: owner,
              duration: duration,
              application: nil
            )
          )
        }

        let orderedCandidates = candidates.sorted { first, second in
          let firstPriority = scope?.priority(of: first.owner) ?? Int.max
          let secondPriority = scope?.priority(of: second.owner) ?? Int.max
          if firstPriority != secondPriority {
            return firstPriority < secondPriority
          }
          if (first.application != nil) != (second.application != nil) {
            return first.application != nil
          }
          return first.duration > second.duration
        }
        let applicationCandidates = orderedCandidates.filter {
          $0.application != nil
        }
        let websiteCandidates = orderedCandidates.filter {
          $0.application == nil
        }

        if let categoryOwner {
          managed += categoryDuration
          var remainingBaseDuration = categoryDuration
          if collectGroupBreakdown {
            addDuration(
              categoryDuration,
              owner: categoryOwner,
              application: nil,
              to: &groupValues
            )
            for candidate in orderedCandidates where
              candidate.owner.id != categoryOwner.id
              && scope?.higherPriority(candidate.owner, than: categoryOwner) == true
            {
              let reassigned = min(candidate.duration, remainingBaseDuration)
              guard reassigned > 0 else { continue }
              remainingBaseDuration -= reassigned
              addDuration(
                -reassigned,
                owner: categoryOwner,
                application: nil,
                to: &groupValues
              )
              addDuration(
                reassigned,
                owner: candidate.owner,
                application: candidate.application.map { ($0, reassigned) },
                to: &groupValues
              )
            }
            var remainingApplicationDetail = remainingBaseDuration
            for candidate in orderedCandidates where
              candidate.owner.id == categoryOwner.id && candidate.application != nil
            {
              let represented = min(candidate.duration, remainingApplicationDetail)
              guard represented > 0 else { continue }
              remainingApplicationDetail -= represented
              addDuration(
                0,
                owner: categoryOwner,
                application: candidate.application.map { ($0, represented) },
                to: &groupValues
              )
            }
          }
        } else {
          // Apple's application and web-domain trees are alternative private
          // breakdowns of the category, not independent totals. Pick one
          // family for attribution so a browser interval cannot be added once
          // as an app and again as a website.
          let preferredFamily = AnastaAnalyticsPure.preferredDetailFamily(
            applicationDurations: applicationCandidates.map(\.duration),
            websiteDurations: websiteCandidates.map(\.duration),
            categoryDuration: categoryDuration
          )
          let preferredCandidates = preferredFamily == .applications
            ? applicationCandidates
            : websiteCandidates
          var remainingCategoryDuration = categoryDuration
          for candidate in preferredCandidates {
            let attributed = min(candidate.duration, remainingCategoryDuration)
            guard attributed > 0 else { continue }
            remainingCategoryDuration -= attributed
            managed += attributed
            if collectGroupBreakdown {
              addDuration(
                attributed,
                owner: candidate.owner,
                application: candidate.application.map { ($0, attributed) },
                to: &groupValues
              )
            }
          }
        }
      }

      if managed > total + 60 {
        // Nested detail is internally inconsistent with Apple's segment total.
        // Withhold managed detail instead of normalizing an implausible value
        // into a trustworthy-looking comparison.
        segmentPrivateDetailInvalid = true
        managed = 0
        groupValues.removeAll()
      } else if managed > total, managed > 0 {
        let scale = total / managed
        managed = total
        scaleGroups(&groupValues, by: scale)
      }

      var bucket = belongsToSelected
        ? selectedBuckets[displayBucketStart] ?? AnastaAnalyticsBucketAccumulator()
        : comparisonBuckets[displayBucketStart] ?? AnastaAnalyticsBucketAccumulator()
      bucket.total += total
      bucket.managed += managed
      bucket.managedAvailable = bucket.managedAvailable
        && managedScopeAvailable
        && !segmentPrivateDetailInvalid
      bucket.hasSegment = true
      if segmentPrivateDetailInvalid {
        if belongsToSelected {
          invalidSelectedKeys.insert(displayBucketStart)
        } else {
          invalidComparisonKeys.insert(displayBucketStart)
        }
      }
      if !managedScopeAvailable {
        if belongsToSelected {
          missingManagedSelectedKeys.insert(displayBucketStart)
        } else {
          missingManagedComparisonKeys.insert(displayBucketStart)
        }
      }
      if belongsToSelected {
        selectedBuckets[displayBucketStart] = bucket
      } else {
        comparisonBuckets[displayBucketStart] = bucket
      }

      if period == .year {
        var month = belongsToSelected
          ? selectedMonths[displayBucketStart]
            ?? AnastaAnalyticsMonthAccumulator()
          : comparisonMonths[displayBucketStart]
            ?? AnastaAnalyticsMonthAccumulator()
        month.total += total
        month.managed += managed
        month.managedAvailable = month.managedAvailable
          && managedScopeAvailable
          && !segmentPrivateDetailInvalid
        month.observedDays.insert(dayStart)
        let dayOfMonth = calendar.component(.day, from: dayStart)
        month.dailyTotals[dayOfMonth, default: 0] += total
        if dayStart < today {
          month.completeTotal += total
          month.completeDays.insert(dayStart)
          if managedScopeAvailable && !segmentPrivateDetailInvalid {
            month.completeManaged += managed
            month.completeManagedDays.insert(dayStart)
          }
        }
        if belongsToSelected {
          selectedMonths[displayBucketStart] = month
        } else {
          comparisonMonths[displayBucketStart] = month
        }
      } else {
        var daily = belongsToSelected
          ? selectedDaily[dayStart] ?? AnastaAnalyticsBucketAccumulator()
          : comparisonDaily[dayStart] ?? AnastaAnalyticsBucketAccumulator()
        daily.total += total
        daily.managed += managed
        daily.managedAvailable = daily.managedAvailable
          && managedScopeAvailable
          && !segmentPrivateDetailInvalid
        daily.hasSegment = true
        if belongsToSelected {
          selectedDaily[dayStart] = daily
        } else {
          comparisonDaily[dayStart] = daily
        }
      }

      if belongsToSelected {
        selectedTotal += total
        selectedManaged += managed
        selectedManagedAvailable = selectedManagedAvailable
          && managedScopeAvailable
          && !segmentPrivateDetailInvalid
        if collectSignals {
          pickups += segmentPickups
          pickupsByDay[dayStart, default: 0] += segmentPickups
          notifications += segmentNotifications
          hasSignalSegment = true
          if let value = segment.firstPickup,
            firstPickup.map({ value < $0 }) ?? true
          {
            firstPickup = value
          }
        }
        if collectGroupBreakdown
          && managedScopeAvailable
          && !segmentPrivateDetailInvalid
        {
          mergeGroups(groupValues, into: &selectedGroups)
          var dailyGroups = selectedDailyGroups[dayStart] ?? [:]
          mergeGroups(groupValues, into: &dailyGroups)
          selectedDailyGroups[dayStart] = dailyGroups
        }
      } else {
        if collectGroupBreakdown
          && managedScopeAvailable
          && !segmentPrivateDetailInvalid
        {
          var dailyGroups = comparisonDailyGroups[dayStart] ?? [:]
          mergeGroups(groupValues, into: &dailyGroups)
          comparisonDailyGroups[dayStart] = dailyGroups
        }
      }
    }
  }

  var displaySelectedBuckets = expectedBuckets(
    period: period,
    start: selectedStart,
    end: selectedEndBoundary,
    values: selectedBuckets,
    invalid: invalidSelectedKeys,
    unavailableManaged: missingManagedSelectedKeys,
    context: context,
    now: now,
    calendar: calendar
  )
  var displayComparisonBuckets = comparisonStart.flatMap { start in
    comparisonEnd.map {
      expectedBuckets(
        period: period,
        start: start,
        end: $0,
        values: comparisonBuckets,
        invalid: invalidComparisonKeys,
        unavailableManaged: missingManagedComparisonKeys,
        context: context,
        now: now,
        calendar: calendar,
        comparison: true
      )
    }
  } ?? []
  if period == .year {
    displaySelectedBuckets = monthlyDailyAverageBuckets(
      displaySelectedBuckets,
      monthlyValues: selectedMonths,
      calendar: calendar,
      now: now
    )
    displayComparisonBuckets = monthlyDailyAverageBuckets(
      displayComparisonBuckets,
      monthlyValues: comparisonMonths,
      calendar: calendar,
      now: now
    )
  }

  let comparison = period == .year
    ? buildYearComparison(
        selectedStart: selectedStart,
        selectedEnd: selectedEndBoundary,
        comparisonStart: comparisonStart,
        comparisonEnd: comparisonEnd,
        selectedMonths: selectedMonths,
        comparisonMonths: comparisonMonths,
        isCurrentPeriod: isCurrentPeriod,
        now: now,
        calendar: calendar
      )
    : buildComparison(
        period: period,
        selectedStart: selectedStart,
        selectedEnd: selectedEndBoundary,
        comparisonStart: comparisonStart,
        comparisonEnd: comparisonEnd,
        selectedDaily: selectedDaily,
        comparisonDaily: comparisonDaily,
        isCurrentPeriod: isCurrentPeriod,
        now: now,
        calendar: calendar
      )
  let availableUnits = displaySelectedBuckets.filter {
    $0.availability == .available || $0.availability == .partialToday
  }.count
  let expectedUnits = displaySelectedBuckets.filter {
    $0.availability != .future
  }.count
  let pureCoverage = AnastaAnalyticsPure.coverageState(
    available: availableUnits,
    expected: expectedUnits,
    invalid: invalidSelectedKeys.count,
    isCurrentPeriod: isCurrentPeriod
  )
  let coverageKind = AnastaAnalyticsCoverageKind(
    rawValue: pureCoverage.rawValue
  ) ?? .missing
  let coverage = AnastaAnalyticsCoverage(
    kind: coverageKind,
    availableUnitCount: availableUnits,
    expectedUnitCount: expectedUnits,
    invalidUnitCount: invalidSelectedKeys.count,
    comparisonQualified: comparison != nil
  )
  let completeDays = selectedDaily
    .filter { entry in entry.value.hasSegment && entry.key < today }
    .map(\.value)
  let yearCompleteDayCount = selectedMonths.values.reduce(0) {
    $0 + $1.completeDays.count
  }
  let yearCompleteTotal = selectedMonths.values.reduce(0) {
    $0 + $1.completeTotal
  }
  let yearCompleteManagedDayCount = selectedMonths.values.reduce(0) {
    $0 + $1.completeManagedDays.count
  }
  let yearCompleteManaged = selectedMonths.values.reduce(0) {
    $0 + $1.completeManaged
  }
  let completeDayAverage = period == .year
    ? (yearCompleteDayCount > 0
      ? yearCompleteTotal / Double(yearCompleteDayCount)
      : nil)
    : AnastaAnalyticsPure.average(completeDays.map(\.total))
  let completeManagedDays = completeDays.filter(\.managedAvailable)
  let completeManagedDayAverage = period == .year
    ? (yearCompleteManagedDayCount > 0
      ? yearCompleteManaged / Double(yearCompleteManagedDayCount)
      : nil)
    : AnastaAnalyticsPure.average(completeManagedDays.map(\.managed))
  let completeDayPickups = pickupsByDay
    .filter { entry in entry.key < today }
    .reduce(0) { $0 + $1.value }
  let groupAverages: [
    String: (current: TimeInterval, previous: TimeInterval)
  ] = comparison == nil || period == .year
    ? [:]
    : buildGroupComparisonAverages(
        period: period,
        selectedStart: selectedStart,
        selectedEnd: selectedEndBoundary,
        comparisonStart: comparisonStart,
        comparisonEnd: comparisonEnd,
        selectedDaily: selectedDaily,
        comparisonDaily: comparisonDaily,
        selectedGroups: selectedDailyGroups,
        comparisonGroups: comparisonDailyGroups,
        isCurrentPeriod: isCurrentPeriod,
        now: now,
        calendar: calendar
      )
  let visibleSelectedGroups: [AnastaAnalyticsGroupAccumulator] =
    selectedManagedAvailable ? Array(selectedGroups.values) : []
  let groups = visibleSelectedGroups
    .map { value in
      AnastaAnalyticsGroup(
        id: value.id,
        name: value.name,
        duration: value.duration,
        currentDailyAverage: groupAverages[value.id]?.current,
        previousDailyAverage: groupAverages[value.id]?.previous,
        applications: value.applications
          .map { AnastaAnalyticsAppActivity(token: $0.key, duration: $0.value) }
          .sorted { $0.duration > $1.duration },
        isAlwaysBlocked: value.isAlwaysBlocked
      )
    }
    .sorted {
      if $0.isAlwaysBlocked != $1.isAlwaysBlocked {
        return $0.isAlwaysBlocked
      }
      if $0.duration != $1.duration { return $0.duration > $1.duration }
      return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }
  let insight = AnastaAnalyticsInsightEngine.make(
    period: period,
    buckets: displaySelectedBuckets,
    groups: groups,
    comparison: comparison,
    coverage: coverage
  )
  let selectedOutcomes = context.dayOutcomes.filter {
    $0.date >= context.selectedStartDate
      && $0.date < context.selectedEndDateExclusive
  }
  let hasSelectedSegment = selectedBuckets.values.contains {
    $0.hasSegment
  }

  guard AnastaAnalyticsPure.shouldPublish(isCancelled: Task.isCancelled) else {
    return .unavailable(
      period: period,
      reason: "The selected period changed before iPhone finished the report."
    )
  }

  return AnastaAnalyticsConfiguration(
    period: period,
    requestId: context.requestId,
    calendar: calendar,
    locale: Locale(identifier: context.locale),
    selectedInterval: selectedInterval,
    comparisonInterval: comparisonInterval,
    selectedTotal: hasSelectedSegment ? selectedTotal : nil,
    selectedManaged: hasSelectedSegment && selectedManagedAvailable
      ? selectedManaged
      : nil,
    selectedCompleteDayAverage: completeDayAverage,
    selectedCompleteManagedDayAverage: completeManagedDayAverage,
    selectedCompleteDayCount: period == .year
      ? yearCompleteDayCount
      : completeDays.count,
    selectedBuckets: displaySelectedBuckets,
    comparisonBuckets: displayComparisonBuckets,
    comparison: comparison,
    signals: AnastaAnalyticsSignals(
      pickups: hasSignalSegment ? pickups : nil,
      completeDayPickups: hasSignalSegment ? completeDayPickups : nil,
      notifications: hasSignalSegment ? notifications : nil,
      firstPickup: firstPickup,
      lastUpdatedDate: lastUpdatedDate
    ),
    groups: Array(groups.prefix(5)),
    localSummary: context.selected,
    dayOutcomes: selectedOutcomes,
    insight: insight,
    coverage: coverage,
    isCurrentPeriod: isCurrentPeriod,
    unavailableReason: nil
  )
}

private func monthlyDailyAverageBuckets(
  _ buckets: [AnastaAnalyticsBucket],
  monthlyValues: [Date: AnastaAnalyticsMonthAccumulator],
  calendar: Calendar,
  now: Date
) -> [AnastaAnalyticsBucket] {
  buckets.map { bucket in
    if bucket.availability == .future {
      return bucket
    }
    let nextMonth = calendar.date(
      byAdding: .month,
      value: 1,
      to: bucket.start
    ) ?? bucket.start
    let today = calendar.startOfDay(for: now)
    let isCurrentMonth = calendar.isDate(
      bucket.start,
      equalTo: now,
      toGranularity: .month
    )
    let expectedEnd = isCurrentMonth ? today : nextMonth
    let expectedCompleteDays = dayStarts(
      from: bucket.start,
      to: expectedEnd,
      calendar: calendar
    ).count
    let month = monthlyValues[bucket.start]
    let totalAggregation = AnastaAnalyticsPure.monthlyAverage(
      totalDuration: month?.total ?? 0,
      observedDayCount: month?.observedDays.count ?? 0,
      availableCompleteDayCount: month?.completeDays.count ?? 0,
      expectedCompleteDayCount: expectedCompleteDays,
      isCurrentMonth: isCurrentMonth
    )
    guard let total = totalAggregation.average else {
      return AnastaAnalyticsBucket(
        id: bucket.id,
        start: bucket.start,
        totalDuration: nil,
        managedDuration: nil,
        targetMinutes: nil,
        availability: .missing
      )
    }
    let managed = month?.managedAvailable == true
      && (month?.observedDays.isEmpty == false)
      ? (month?.managed ?? 0) / Double(month?.observedDays.count ?? 1)
      : nil
    let availability: AnastaAnalyticsAvailability
    if bucket.availability == .inconsistent {
      availability = .inconsistent
    } else if isCurrentMonth {
      availability = .partialToday
    } else {
      availability = .available
    }
    return AnastaAnalyticsBucket(
      id: bucket.id,
      start: bucket.start,
      totalDuration: total,
      managedDuration: managed,
      targetMinutes: bucket.targetMinutes,
      availability: availability
    )
  }
}

private func plausible(
  _ duration: TimeInterval,
  in interval: DateInterval
) -> Bool {
  AnastaAnalyticsPure.isPlausible(
    duration: duration,
    intervalDuration: interval.duration
  )
}

private func normalizedBucketStart(
  _ date: Date,
  period: AnastaAnalyticsPeriod,
  calendar: Calendar
) -> Date {
  AnastaAnalyticsPure.bucketStart(
    for: date,
    period: AnastaAnalyticsPure.Period(rawValue: period.rawValue)!,
    calendar: calendar
  )
}

private func addDuration(
  _ duration: TimeInterval,
  owner: AnastaAnalyticsGroupDefinition,
  application: (ApplicationToken, TimeInterval)?,
  to values: inout [String: AnastaAnalyticsGroupAccumulator]
) {
  var value = values[owner.id] ?? AnastaAnalyticsGroupAccumulator(
    id: owner.id,
    name: owner.name,
    duration: 0,
    applications: [:],
    isAlwaysBlocked: owner.isAlwaysBlocked
  )
  value.duration += duration
  if let application {
    value.applications[application.0, default: 0] += application.1
  }
  values[owner.id] = value
}

private func mergeGroups(
  _ source: [String: AnastaAnalyticsGroupAccumulator],
  into destination: inout [String: AnastaAnalyticsGroupAccumulator]
) {
  for value in source.values {
    var current = destination[value.id] ?? AnastaAnalyticsGroupAccumulator(
      id: value.id,
      name: value.name,
      duration: 0,
      applications: [:],
      isAlwaysBlocked: value.isAlwaysBlocked
    )
    current.duration += value.duration
    for (token, duration) in value.applications {
      current.applications[token, default: 0] += duration
    }
    destination[value.id] = current
  }
}

private func scaleGroups(
  _ values: inout [String: AnastaAnalyticsGroupAccumulator],
  by scale: Double
) {
  guard scale.isFinite, scale >= 0 else {
    values.removeAll()
    return
  }
  for id in Array(values.keys) {
    guard var value = values[id] else { continue }
    value.duration *= scale
    value.applications = value.applications.mapValues { $0 * scale }
    values[id] = value
  }
}

private func expectedBuckets(
  period: AnastaAnalyticsPeriod,
  start: Date,
  end: Date,
  values: [Date: AnastaAnalyticsBucketAccumulator],
  invalid: Set<Date>,
  unavailableManaged: Set<Date>,
  context: AnastaAnalyticsContextPayload,
  now: Date,
  calendar: Calendar,
  comparison: Bool = false
) -> [AnastaAnalyticsBucket] {
  let component: Calendar.Component = period == .day
    ? .hour
    : period == .year ? .month : .day
  var result: [AnastaAnalyticsBucket] = []
  var cursor = start
  while cursor < end {
    let normalized = normalizedBucketStart(cursor, period: period, calendar: calendar)
    let value = values[normalized]
    let availability: AnastaAnalyticsAvailability
    if invalid.contains(normalized) {
      availability = .inconsistent
    } else if unavailableManaged.contains(normalized) {
      availability = .missing
    } else if !comparison && normalized > now {
      availability = .future
    } else if let value, value.hasSegment {
      availability = !comparison
        && isCurrentBucket(
          normalized,
          now: now,
          period: period,
          calendar: calendar
        )
        ? .partialToday
        : .available
    } else {
      availability = .missing
    }
    let outcome = AnastaAnalyticsMetadata.outcome(for: normalized, context: context)
    result.append(
      AnastaAnalyticsBucket(
        id: normalized,
        start: normalized,
        totalDuration: value?.hasSegment == true ? value?.total : nil,
        managedDuration: value?.hasSegment == true && value?.managedAvailable == true
          ? value?.managed
          : nil,
        targetMinutes: period == .year ? nil : outcome?.targetMinutes,
        availability: availability
      )
    )
    guard let next = calendar.date(byAdding: component, value: 1, to: cursor) else {
      break
    }
    cursor = next
  }
  return result
}

private func isCurrentBucket(
  _ bucket: Date,
  now: Date,
  period: AnastaAnalyticsPeriod,
  calendar: Calendar
) -> Bool {
  switch period {
  case .day:
    return calendar.isDate(bucket, equalTo: now, toGranularity: .hour)
  case .week, .month:
    return calendar.isDate(bucket, inSameDayAs: now)
  case .year:
    return calendar.isDate(bucket, equalTo: now, toGranularity: .month)
  }
}

private func buildYearComparison(
  selectedStart: Date,
  selectedEnd: Date,
  comparisonStart: Date?,
  comparisonEnd: Date?,
  selectedMonths: [Date: AnastaAnalyticsMonthAccumulator],
  comparisonMonths: [Date: AnastaAnalyticsMonthAccumulator],
  isCurrentPeriod: Bool,
  now: Date,
  calendar: Calendar
) -> AnastaAnalyticsComparison? {
  guard
    let comparisonStart,
    let comparisonEnd
  else { return nil }
  let selectedCompleteEnd = isCurrentPeriod
    ? calendar.date(
        from: calendar.dateComponents([.year, .month], from: now)
      ) ?? now
    : selectedEnd

  func monthStarts(from start: Date, to end: Date) -> [Date] {
    var result: [Date] = []
    var cursor = start
    while cursor < end {
      result.append(cursor)
      guard
        let next = calendar.date(byAdding: .month, value: 1, to: cursor),
        next > cursor
      else { break }
      cursor = next
    }
    return result
  }

  let selectedStarts = monthStarts(
    from: selectedStart,
    to: selectedCompleteEnd
  )
  let comparisonStarts = Array(
    monthStarts(from: comparisonStart, to: comparisonEnd)
      .prefix(selectedStarts.count)
  )
  let count = min(selectedStarts.count, comparisonStarts.count)
  guard count >= 3 else { return nil }

  var currentMetrics: [TimeInterval?] = []
  var previousMetrics: [TimeInterval?] = []
  for index in 0..<count {
    let selectedMonth = selectedStarts[index]
    let previousMonth = comparisonStarts[index]
    guard
      let selectedMonthEnd = calendar.date(
        byAdding: .month,
        value: 1,
        to: selectedMonth
      ),
      let previousMonthEnd = calendar.date(
        byAdding: .month,
        value: 1,
        to: previousMonth
      )
    else { continue }
    let matchedCalendarDays = min(
      AnastaAnalyticsPure.dayStarts(
        from: selectedMonth,
        to: selectedMonthEnd,
        calendar: calendar
      ).count,
      AnastaAnalyticsPure.dayStarts(
        from: previousMonth,
        to: previousMonthEnd,
        calendar: calendar
      ).count
    )
    let selectedValues = selectedMonths[selectedMonth]?.dailyTotals ?? [:]
    let comparisonValues =
      comparisonMonths[previousMonth]?.dailyTotals ?? [:]
    for day in 1...matchedCalendarDays {
      currentMetrics.append(selectedValues[day])
      previousMetrics.append(comparisonValues[day])
    }
  }
  guard
    let result = AnastaAnalyticsPure.qualifiedComparison(
      current: currentMetrics,
      previous: previousMetrics,
      minimumMatched: 1,
      observedUnitCount: count,
      minimumObservedUnitCount: 3
    )
  else { return nil }
  return AnastaAnalyticsComparison(
    currentAverage: result.currentAverage,
    previousAverage: result.previousAverage,
    matchedUnitCount: result.matchedCount,
    coverage: result.coverage
  )
}

private func buildComparison(
  period: AnastaAnalyticsPeriod,
  selectedStart: Date,
  selectedEnd: Date,
  comparisonStart: Date?,
  comparisonEnd: Date?,
  selectedDaily: [Date: AnastaAnalyticsBucketAccumulator],
  comparisonDaily: [Date: AnastaAnalyticsBucketAccumulator],
  isCurrentPeriod: Bool,
  now: Date,
  calendar: Calendar
) -> AnastaAnalyticsComparison? {
  guard
    period != .day,
    let comparisonStart,
    let comparisonEnd
  else { return nil }

  let selectedCompleteEnd: Date
  if period == .year && isCurrentPeriod {
    selectedCompleteEnd = calendar.date(
      from: calendar.dateComponents([.year, .month], from: now)
    ) ?? now
  } else if isCurrentPeriod {
    selectedCompleteEnd = calendar.startOfDay(for: now)
  } else {
    selectedCompleteEnd = selectedEnd
  }
  let selectedExpected = dayStarts(
    from: selectedStart,
    to: selectedCompleteEnd,
    calendar: calendar
  )
  guard !selectedExpected.isEmpty else { return nil }
  let comparisonExpectedAll = dayStarts(
    from: comparisonStart,
    to: comparisonEnd,
    calendar: calendar
  )
  let comparisonExpected = Array(comparisonExpectedAll.prefix(selectedExpected.count))
  let expectedCount = min(selectedExpected.count, comparisonExpected.count)
  guard expectedCount > 0 else { return nil }

  var currentMetrics: [TimeInterval?] = []
  var previousMetrics: [TimeInterval?] = []
  for index in 0..<expectedCount {
    let current = selectedDaily[selectedExpected[index]]
    let previous = comparisonDaily[comparisonExpected[index]]
    currentMetrics.append(metric(current, period: period))
    previousMetrics.append(metric(previous, period: period))
  }
  let minimum = period == .week ? 4 : period == .month ? 14 : 1
  let completeMonths = period == .year
    ? calendar.dateComponents(
        [.month],
        from: selectedStart,
        to: selectedCompleteEnd
      ).month ?? 0
    : 0
  guard
    let result = AnastaAnalyticsPure.qualifiedComparison(
      current: currentMetrics,
      previous: previousMetrics,
      minimumMatched: minimum,
      observedUnitCount: period == .year ? completeMonths : nil,
      minimumObservedUnitCount: period == .year ? 3 : nil
    )
  else { return nil }
  return AnastaAnalyticsComparison(
    currentAverage: result.currentAverage,
    previousAverage: result.previousAverage,
    matchedUnitCount: result.matchedCount,
    coverage: result.coverage
  )
}

private func buildGroupComparisonAverages(
  period: AnastaAnalyticsPeriod,
  selectedStart: Date,
  selectedEnd: Date,
  comparisonStart: Date?,
  comparisonEnd: Date?,
  selectedDaily: [Date: AnastaAnalyticsBucketAccumulator],
  comparisonDaily: [Date: AnastaAnalyticsBucketAccumulator],
  selectedGroups: [Date: [String: AnastaAnalyticsGroupAccumulator]],
  comparisonGroups: [Date: [String: AnastaAnalyticsGroupAccumulator]],
  isCurrentPeriod: Bool,
  now: Date,
  calendar: Calendar
) -> [String: (current: TimeInterval, previous: TimeInterval)] {
  guard
    period != .day,
    let comparisonStart,
    let comparisonEnd
  else { return [:] }

  let selectedCompleteEnd: Date
  if period == .year && isCurrentPeriod {
    selectedCompleteEnd = calendar.date(
      from: calendar.dateComponents([.year, .month], from: now)
    ) ?? now
  } else if isCurrentPeriod {
    selectedCompleteEnd = calendar.startOfDay(for: now)
  } else {
    selectedCompleteEnd = selectedEnd
  }
  let selectedExpected = dayStarts(
    from: selectedStart,
    to: selectedCompleteEnd,
    calendar: calendar
  )
  let comparisonExpected = Array(
    dayStarts(
      from: comparisonStart,
      to: comparisonEnd,
      calendar: calendar
    ).prefix(selectedExpected.count)
  )
  let expectedCount = min(selectedExpected.count, comparisonExpected.count)
  guard expectedCount > 0 else { return [:] }

  var currentTotals: [String: TimeInterval] = [:]
  var previousTotals: [String: TimeInterval] = [:]
  var matched = 0
  for index in 0..<expectedCount {
    let selectedDate = selectedExpected[index]
    let comparisonDate = comparisonExpected[index]
    guard
      metric(selectedDaily[selectedDate], period: period) != nil,
      metric(comparisonDaily[comparisonDate], period: period) != nil
    else { continue }
    matched += 1
    let selectedValues = selectedGroups[selectedDate] ?? [:]
    let comparisonValues = comparisonGroups[comparisonDate] ?? [:]
    let ids = Set(selectedValues.keys).union(comparisonValues.keys)
    for id in ids {
      currentTotals[id, default: 0] += selectedValues[id]?.duration ?? 0
      previousTotals[id, default: 0] += comparisonValues[id]?.duration ?? 0
    }
  }
  guard matched > 0 else { return [:] }
  let ids = Set(currentTotals.keys).union(previousTotals.keys)
  return Dictionary(uniqueKeysWithValues: ids.map { id in
    (
      id,
      (
        current: (currentTotals[id] ?? 0) / Double(matched),
        previous: (previousTotals[id] ?? 0) / Double(matched)
      )
    )
  })
}

private func metric(
  _ value: AnastaAnalyticsBucketAccumulator?,
  period: AnastaAnalyticsPeriod
) -> TimeInterval? {
  guard let value, value.hasSegment else { return nil }
  if period == .year { return value.total }
  return value.managedAvailable ? value.managed : nil
}

private func dayStarts(
  from start: Date,
  to end: Date,
  calendar: Calendar
) -> [Date] {
  AnastaAnalyticsPure.dayStarts(
    from: start,
    to: end,
    calendar: calendar
  )
}

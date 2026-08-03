import Foundation

/// Foundation-only analytics rules shared by the report extension and its
/// hostless XCTest target. Keep Apple-private token types out of this file so
/// every formula can be exercised without constructing Screen Time objects.
enum AnastaAnalyticsPure {
  enum Period: String, Codable {
    case day
    case week
    case month
    case year
  }

  enum IntervalMembership: Equatable {
    case selected
    case comparison
    case outside
  }

  enum DetailFamily: Equatable {
    case applications
    case websites
  }

  enum CoverageState: String, Equatable {
    case complete
    case partial
    case missing
    case inconsistent
  }

  enum ContextSchemaStatus: Equatable {
    case accepted
    case malformed
    case staleRequest
    case wrongPeriod
    case unsupportedVersion
  }

  enum InsightPriority: Equatable {
    case comparison
    case dayPeak
    case yearDirection
    case heaviestDay
    case changedGroup
    case topGroup
    case fallback
  }

  struct OwnershipCandidate: Equatable {
    let tokenId: String
    let groupId: String
    let isAlwaysBlocked: Bool
    let planOrder: Int
  }

  struct ComparisonResult: Equatable {
    let currentAverage: TimeInterval
    let previousAverage: TimeInterval
    let matchedCount: Int
    let coverage: Double
  }

  struct MonthlyAverage: Equatable {
    let average: TimeInterval?
    let availableDayCount: Int
    let expectedDayCount: Int
    let isPartial: Bool
  }

  struct OnePassSegmentFixture: Equatable {
    let totalDuration: TimeInterval
    let applicationDurations: [TimeInterval]
    let websiteDurations: [TimeInterval]
    let applicationPickups: [Int]
    let unassociatedPickups: Int
  }

  struct OnePassResult: Equatable {
    let totalDuration: TimeInterval
    let applicationDuration: TimeInterval
    let websiteDuration: TimeInterval
    let pickups: Int
    let segmentVisits: Int
    let applicationVisits: Int
    let websiteVisits: Int
  }

  private struct ContextHeader: Decodable {
    let schemaVersion: Int
    let requestId: String
    let period: Period
  }

  static func membership(
    of date: Date,
    selected: DateInterval,
    comparison: DateInterval?
  ) -> IntervalMembership {
    if selected.contains(date) {
      return .selected
    }
    if comparison?.contains(date) == true {
      return .comparison
    }
    return .outside
  }

  /// Resolves duplicate ownership without relying on input order.
  /// Always Blocked wins, then the immutable plan order, then group ID.
  static func stableOwnership(
    _ candidates: [OwnershipCandidate]
  ) -> [String: String] {
    Dictionary(grouping: candidates, by: \.tokenId).mapValues { values in
      values.sorted(by: ownershipPrecedes).first?.groupId ?? ""
    }
  }

  static func ownershipPrecedes(
    _ lhs: OwnershipCandidate,
    _ rhs: OwnershipCandidate
  ) -> Bool {
    if lhs.isAlwaysBlocked != rhs.isAlwaysBlocked {
      return lhs.isAlwaysBlocked
    }
    if lhs.planOrder != rhs.planOrder {
      return lhs.planOrder < rhs.planOrder
    }
    return lhs.groupId.localizedCaseInsensitiveCompare(rhs.groupId)
      == .orderedAscending
  }

  static func boundedTotal(
    _ durations: [TimeInterval],
    limit: TimeInterval
  ) -> TimeInterval {
    var remaining = max(0, limit)
    var result: TimeInterval = 0
    for duration in durations where duration.isFinite && duration > 0 {
      let represented = min(duration, remaining)
      result += represented
      remaining -= represented
      if remaining <= 0 {
        break
      }
    }
    return result
  }

  /// App and website trees are alternative descriptions of a category.
  /// Selecting one family prevents a browser interval being counted twice.
  static func preferredDetailFamily(
    applicationDurations: [TimeInterval],
    websiteDurations: [TimeInterval],
    categoryDuration: TimeInterval
  ) -> DetailFamily {
    boundedTotal(applicationDurations, limit: categoryDuration)
      >= boundedTotal(websiteDurations, limit: categoryDuration)
      ? .applications
      : .websites
  }

  /// The category total owns the hierarchy when its category token is managed.
  /// Otherwise only the stronger non-additive child family is represented.
  static func nonAdditiveManagedDuration(
    categoryDuration: TimeInterval,
    categoryIsManaged: Bool,
    applicationDurations: [TimeInterval],
    websiteDurations: [TimeInterval]
  ) -> TimeInterval {
    guard categoryDuration.isFinite, categoryDuration >= 0 else { return 0 }
    if categoryIsManaged {
      return categoryDuration
    }
    let family = preferredDetailFamily(
      applicationDurations: applicationDurations,
      websiteDurations: websiteDurations,
      categoryDuration: categoryDuration
    )
    return boundedTotal(
      family == .applications ? applicationDurations : websiteDurations,
      limit: categoryDuration
    )
  }

  static func addingPickup(
    _ accumulated: Int,
    applicationPickups: Int
  ) -> Int {
    max(0, accumulated) + max(0, applicationPickups)
  }

  static func pickups(
    applicationPickups: [Int],
    unassociatedPickups: Int
  ) -> Int {
    applicationPickups.reduce(max(0, unassociatedPickups)) {
      addingPickup($0, applicationPickups: $1)
    }
  }

  static func average(
    _ values: [TimeInterval]
  ) -> TimeInterval? {
    let valid = values.filter { $0.isFinite && $0 >= 0 }
    guard !valid.isEmpty else { return nil }
    return valid.reduce(0, +) / Double(valid.count)
  }

  static func qualifiedComparison(
    current: [TimeInterval?],
    previous: [TimeInterval?],
    minimumMatched: Int,
    minimumCoverage: Double = 0.8,
    observedUnitCount: Int? = nil,
    minimumObservedUnitCount: Int? = nil
  ) -> ComparisonResult? {
    let expected = min(current.count, previous.count)
    guard expected > 0 else { return nil }
    if
      let observedUnitCount,
      let minimumObservedUnitCount,
      observedUnitCount < minimumObservedUnitCount
    {
      return nil
    }

    var currentTotal: TimeInterval = 0
    var previousTotal: TimeInterval = 0
    var matched = 0
    for index in 0..<expected {
      guard
        let currentValue = current[index],
        let previousValue = previous[index],
        currentValue.isFinite,
        previousValue.isFinite,
        currentValue >= 0,
        previousValue >= 0
      else { continue }
      currentTotal += currentValue
      previousTotal += previousValue
      matched += 1
    }
    let coverage = Double(matched) / Double(expected)
    guard
      matched >= minimumMatched,
      coverage >= minimumCoverage
    else { return nil }
    return ComparisonResult(
      currentAverage: currentTotal / Double(matched),
      previousAverage: previousTotal / Double(matched),
      matchedCount: matched,
      coverage: coverage
    )
  }

  static func observedFullDays(
    totalSeconds: TimeInterval
  ) -> Double? {
    guard totalSeconds.isFinite, totalSeconds >= 0 else { return nil }
    return totalSeconds / 86_400
  }

  static func annualPaceFullDays(
    completeDayAverageSeconds: TimeInterval,
    completeDayCount: Int
  ) -> Double? {
    guard
      completeDayCount >= 7,
      completeDayAverageSeconds.isFinite,
      completeDayAverageSeconds >= 0
    else { return nil }
    return completeDayAverageSeconds * 365 / 86_400
  }

  static func targetPaceFullDays(
    dailyTargetMinutes: Int
  ) -> Double? {
    guard dailyTargetMinutes >= 0 else { return nil }
    return Double(dailyTargetMinutes) * 365 / 1_440
  }

  /// Returns the earliest winning two-bucket index.
  static func peakTwoBucketWindow(
    _ managedDurations: [TimeInterval?],
    minimumDuration: TimeInterval = 20 * 60,
    minimumShare: Double = 0.2
  ) -> Int? {
    let total = managedDurations.compactMap { value -> TimeInterval? in
      guard let value, value.isFinite, value >= 0 else { return nil }
      return value
    }.reduce(0, +)
    guard managedDurations.count >= 2, total > 0 else { return nil }

    var bestIndex: Int?
    var bestDuration: TimeInterval = -1
    for index in 0..<(managedDurations.count - 1) {
      guard
        let first = managedDurations[index],
        let second = managedDurations[index + 1],
        first.isFinite,
        second.isFinite,
        first >= 0,
        second >= 0
      else { continue }
      let duration = first + second
      if duration > bestDuration {
        bestIndex = index
        bestDuration = duration
      }
    }
    guard
      let bestIndex,
      bestDuration >= minimumDuration,
      bestDuration / total >= minimumShare
    else { return nil }
    return bestIndex
  }

  static func isPlausible(
    duration: TimeInterval,
    intervalDuration: TimeInterval
  ) -> Bool {
    duration.isFinite
      && intervalDuration.isFinite
      && intervalDuration >= 0
      && duration >= 0
      && duration <= intervalDuration * 1.05 + 60
  }

  static func coverageState(
    available: Int,
    expected: Int,
    invalid: Int,
    isCurrentPeriod: Bool
  ) -> CoverageState {
    if invalid > 0 {
      return .inconsistent
    }
    if available <= 0 {
      return .missing
    }
    if available < expected || isCurrentPeriod {
      return .partial
    }
    return .complete
  }

  static func shouldPublish(isCancelled: Bool) -> Bool {
    !isCancelled
  }

  /// A deterministic fixture collector that makes the single traversal
  /// contract executable. Production async streams follow this same shape.
  static func collectOnePass(
    _ segments: [OnePassSegmentFixture]
  ) -> OnePassResult {
    var total: TimeInterval = 0
    var applications: TimeInterval = 0
    var websites: TimeInterval = 0
    var pickupCount = 0
    var applicationVisits = 0
    var websiteVisits = 0

    for segment in segments {
      total += segment.totalDuration
      pickupCount += max(0, segment.unassociatedPickups)
      for (index, duration) in segment.applicationDurations.enumerated() {
        applications += duration
        applicationVisits += 1
        if index < segment.applicationPickups.count {
          pickupCount = addingPickup(
            pickupCount,
            applicationPickups: segment.applicationPickups[index]
          )
        }
      }
      for duration in segment.websiteDurations {
        websites += duration
        websiteVisits += 1
      }
    }
    return OnePassResult(
      totalDuration: total,
      applicationDuration: applications,
      websiteDuration: websites,
      pickups: pickupCount,
      segmentVisits: segments.count,
      applicationVisits: applicationVisits,
      websiteVisits: websiteVisits
    )
  }

  static func contextSchemaStatus(
    data: Data,
    expectedRequestId: String,
    expectedPeriod: Period
  ) -> ContextSchemaStatus {
    guard
      let header = try? JSONDecoder().decode(ContextHeader.self, from: data)
    else { return .malformed }
    guard header.schemaVersion == 1 else {
      return .unsupportedVersion
    }
    guard header.requestId == expectedRequestId else {
      return .staleRequest
    }
    guard header.period == expectedPeriod else {
      return .wrongPeriod
    }
    return .accepted
  }

  static func bucketStart(
    for date: Date,
    period: Period,
    calendar: Calendar
  ) -> Date {
    if period == .day {
      return calendar.dateInterval(of: .hour, for: date)?.start ?? date
    }
    if period == .year {
      return calendar.date(
        from: calendar.dateComponents([.year, .month], from: date)
      ) ?? date
    }
    return calendar.startOfDay(for: date)
  }

  static func dayStarts(
    from start: Date,
    to end: Date,
    calendar: Calendar
  ) -> [Date] {
    var result: [Date] = []
    var cursor = calendar.startOfDay(for: start)
    while cursor < end {
      result.append(cursor)
      guard
        let next = calendar.date(byAdding: .day, value: 1, to: cursor),
        next > cursor
      else { break }
      cursor = next
    }
    return result
  }

  static func monthlyAverage(
    values: [TimeInterval],
    availableCompleteDayCount: Int,
    expectedCompleteDayCount: Int,
    isCurrentMonth: Bool
  ) -> MonthlyAverage {
    monthlyAverage(
      totalDuration: values
        .filter { $0.isFinite && $0 >= 0 }
        .reduce(0, +),
      observedDayCount: values
        .filter { $0.isFinite && $0 >= 0 }
        .count,
      availableCompleteDayCount: availableCompleteDayCount,
      expectedCompleteDayCount: expectedCompleteDayCount,
      isCurrentMonth: isCurrentMonth
    )
  }

  static func monthlyAverage(
    totalDuration: TimeInterval,
    observedDayCount: Int,
    availableCompleteDayCount: Int,
    expectedCompleteDayCount: Int,
    isCurrentMonth: Bool
  ) -> MonthlyAverage {
    let ratio = expectedCompleteDayCount > 0
      ? Double(availableCompleteDayCount) / Double(expectedCompleteDayCount)
      : 0
    let qualified = observedDayCount > 0 && (isCurrentMonth || ratio >= 0.8)
    let value = qualified
      && totalDuration.isFinite
      && totalDuration >= 0
      ? totalDuration / Double(observedDayCount)
      : nil
    return MonthlyAverage(
      average: value,
      availableDayCount: availableCompleteDayCount,
      expectedDayCount: expectedCompleteDayCount,
      isPartial: isCurrentMonth || ratio < 1
    )
  }

  static func insightPriority(
    hasQualifiedComparison: Bool,
    hasDayPeak: Bool,
    hasYearDirection: Bool,
    hasHeaviestDay: Bool,
    hasChangedGroup: Bool,
    hasTopGroup: Bool
  ) -> InsightPriority {
    if hasQualifiedComparison { return .comparison }
    if hasDayPeak { return .dayPeak }
    if hasYearDirection { return .yearDirection }
    if hasHeaviestDay { return .heaviestDay }
    if hasChangedGroup { return .changedGroup }
    if hasTopGroup { return .topGroup }
    return .fallback
  }
  // MARK: - Boundary appearance
  //
  // The same six states, the same precedence and the same words the React
  // Native breakdown resolves in `todayUsageModel.ts`. The two paths cannot
  // share code, so they are kept honest by sharing a table instead: change one
  // and the other's tests are what should fail.
  //
  // Colour carries STATE here too, never category.

  enum BoundaryMode: String, Equatable {
    case blocked
    case limit
    case noLimit
  }

  enum BoundaryAppearance: String, Equatable {
    case pending
    case noLimit
    case limitActive
    case blocked
    case atLimit
    case overLimit
  }

  enum BoundaryMarker: Equatable {
    case none
    case lock
    case warning
    case check
  }

  enum SecondarySignal: Equatable {
    case childOver(count: Int)
    case childAtLimit(count: Int)
    case recordedWhileBlocked(minutes: Int)
  }

  /// Precedence, in order:
  ///
  ///   1. usage unknown      → pending
  ///   2. configured block   → blocked
  ///   3. no effective limit → noLimit
  ///   4. used < limit       → limitActive
  ///   5. used == limit      → atLimit
  ///   6. used > limit       → overLimit
  ///
  /// Pending outranks a block: with no report there is nothing truthful to say
  /// about how the boundary held. A limit of exactly zero minutes is a block
  /// wearing a limit's clothes and is presented as one — a presentation-level
  /// normalisation only, no rule is rewritten.
  static func boundaryAppearance(
    mode: BoundaryMode,
    limitMinutes: Int?,
    usedMinutes: Int?
  ) -> BoundaryAppearance {
    guard let used = usedMinutes else { return .pending }
    if mode == .blocked { return .blocked }
    if mode == .limit, limitMinutes == 0 { return .blocked }
    guard mode == .limit, let limit = limitMinutes else { return .noLimit }
    if used < limit { return .limitActive }
    if used == limit { return .atLimit }
    return .overLimit
  }

  static func boundaryMarker(_ appearance: BoundaryAppearance) -> BoundaryMarker {
    switch appearance {
    case .blocked: return .lock
    case .overLimit: return .warning
    case .limitActive: return .check
    default: return .none
    }
  }

  static func overByMinutes(limitMinutes: Int?, usedMinutes: Int?) -> Int {
    guard let limit = limitMinutes, let used = usedMinutes else { return 0 }
    return max(0, used - limit)
  }

  static func remainingMinutes(limitMinutes: Int?, usedMinutes: Int?) -> Int {
    guard let limit = limitMinutes, let used = usedMinutes else { return 0 }
    return max(0, limit - used)
  }

  /// A child going over must never repaint its parent, so what the children did
  /// is reported as a quiet count instead. `over` outranks `at limit`, and
  /// neither is claimed while any child is still waiting for its report.
  static func secondarySignal(
    appearance: BoundaryAppearance,
    usedMinutes: Int?,
    childAppearances: [BoundaryAppearance] = []
  ) -> SecondarySignal? {
    if appearance == .blocked, let used = usedMinutes, used > 0 {
      return .recordedWhileBlocked(minutes: used)
    }
    if appearance == .pending { return nil }
    if childAppearances.contains(.pending) { return nil }

    let over = childAppearances.filter { $0 == .overLimit }.count
    if over > 0 { return .childOver(count: over) }
    let atLimit = childAppearances.filter { $0 == .atLimit }.count
    if atLimit > 0 { return .childAtLimit(count: atLimit) }
    return nil
  }

  /// The status chip's text. Never the only signal — a marker rides with it.
  static func statusLabel(
    _ appearance: BoundaryAppearance,
    limitMinutes: Int? = nil,
    usedMinutes: Int? = nil,
    formatMinutes: (Int) -> String = { "\($0)m" }
  ) -> String {
    switch appearance {
    case .pending: return "PENDING"
    case .noLimit: return "NO LIMIT"
    case .limitActive: return usedMinutes == 0 ? "LIMIT SET" : "ON TRACK"
    case .blocked:
      return (usedMinutes ?? 0) > 0 ? "RECORDED" : "BLOCKED"
    case .atLimit: return "AT LIMIT"
    case .overLimit:
      let over = overByMinutes(limitMinutes: limitMinutes, usedMinutes: usedMinutes)
      return "OVER BY \(formatMinutes(over))"
    }
  }

  static func secondarySignalLabel(
    _ signal: SecondarySignal?,
    formatMinutes: (Int) -> String = { "\($0)m" }
  ) -> String? {
    guard let signal else { return nil }
    switch signal {
    case let .recordedWhileBlocked(minutes):
      return "\(formatMinutes(minutes)) RECORDED TODAY"
    case let .childOver(count):
      return "\(count) \(count == 1 ? "APP" : "APPS") OVER"
    case let .childAtLimit(count):
      return "\(count) \(count == 1 ? "APP" : "APPS") AT LIMIT"
    }
  }

  /// What an application says when it carries no limit of its own. It must
  /// never read as though the app escaped the group's boundary.
  static func inheritedBoundaryLabel(
    groupAppearance: BoundaryAppearance,
    groupMode: BoundaryMode
  ) -> String {
    if groupMode == .blocked || groupAppearance == .blocked { return "GROUP BLOCKED" }
    if groupMode == .limit { return "USES GROUP BOUNDARY" }
    return "NO INDIVIDUAL LIMIT"
  }

  /// Only a live, finite limit draws a progress rail.
  static func showsProgressRail(
    _ appearance: BoundaryAppearance,
    limitMinutes: Int?
  ) -> Bool {
    guard let limit = limitMinutes, limit > 0 else { return false }
    return appearance == .limitActive || appearance == .atLimit || appearance == .overLimit
  }

  /// 0…1, capped: going over fills the rail rather than overflowing it.
  static func railFraction(limitMinutes: Int?, usedMinutes: Int?) -> Double {
    guard let limit = limitMinutes, limit > 0, let used = usedMinutes else { return 0 }
    return min(1, max(0, Double(used) / Double(limit)))
  }
}

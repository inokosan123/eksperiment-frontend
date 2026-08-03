import DeviceActivity
import FamilyControls
import Foundation

enum AnastaAnalyticsPeriod: String, Codable {
  case day
  case week
  case month
  case year
}

enum AnastaAnalyticsAvailability: String {
  case available
  case partialToday
  case missing
  case notAuthorized
  case future
  case inconsistent
}

enum AnastaAnalyticsCoverageKind: String {
  case complete
  case partial
  case missing
  case inconsistent
}

struct AnastaAnalyticsBucket: Identifiable {
  let id: Date
  let start: Date
  let totalDuration: TimeInterval?
  let managedDuration: TimeInterval?
  let targetMinutes: Int?
  let availability: AnastaAnalyticsAvailability

  var otherDuration: TimeInterval? {
    guard let totalDuration, let managedDuration else { return nil }
    return max(0, totalDuration - managedDuration)
  }
}

struct AnastaAnalyticsComparison {
  let currentAverage: TimeInterval
  let previousAverage: TimeInterval
  let matchedUnitCount: Int
  let coverage: Double

  var absoluteDelta: TimeInterval {
    currentAverage - previousAverage
  }

  var percentDelta: Double? {
    guard previousAverage > 0 else { return nil }
    return absoluteDelta / previousAverage * 100
  }
}

struct AnastaAnalyticsSignals {
  let pickups: Int?
  let completeDayPickups: Int?
  let notifications: Int?
  let firstPickup: Date?
  let lastUpdatedDate: Date?
}

struct AnastaAnalyticsAppActivity: Identifiable {
  let token: ApplicationToken
  let duration: TimeInterval
  var id: ApplicationToken { token }
}

struct AnastaAnalyticsGroup: Identifiable {
  let id: String
  let name: String
  let duration: TimeInterval
  let currentDailyAverage: TimeInterval?
  let previousDailyAverage: TimeInterval?
  let applications: [AnastaAnalyticsAppActivity]
  let isAlwaysBlocked: Bool
}

struct AnastaAnalyticsLocalSummary: Codable {
  let resolvedTargetDays: Int
  let keptTargetDays: Int
  let brokenTargetDays: Int
  let returnedMoments: Int
  let doorOpened: Int
  let checkinsContinued: Int
  let limitExceeded: Int
  let zoneBreaches: Int
  let quietHoursStarted: Int

  static let empty = AnastaAnalyticsLocalSummary(
    resolvedTargetDays: 0,
    keptTargetDays: 0,
    brokenTargetDays: 0,
    returnedMoments: 0,
    doorOpened: 0,
    checkinsContinued: 0,
    limitExceeded: 0,
    zoneBreaches: 0,
    quietHoursStarted: 0
  )
}

struct AnastaAnalyticsDayOutcome: Codable {
  let date: String
  let planId: String?
  let planName: String?
  let targetMinutes: Int?
  let hasExactPlanContext: Bool?
  let state: String
}

struct AnastaAnalyticsQuality: Codable {
  let legacyCalendarApproximation: Bool
  let malformedEventRows: Int
  let ignoredEventRows: Int
}

struct AnastaAnalyticsContextPayload: Codable {
  let schemaVersion: Int
  let requestId: String
  let generatedAt: Double
  let timezone: String
  let locale: String
  let period: AnastaAnalyticsPeriod
  let selectedStartDate: String
  let selectedEndDateExclusive: String
  let comparisonStartDate: String?
  let comparisonEndDateExclusive: String?
  let selected: AnastaAnalyticsLocalSummary
  let comparison: AnastaAnalyticsLocalSummary?
  let dayOutcomes: [AnastaAnalyticsDayOutcome]
  let quality: AnastaAnalyticsQuality?
}

struct AnastaAnalyticsCoverage {
  let kind: AnastaAnalyticsCoverageKind
  let availableUnitCount: Int
  let expectedUnitCount: Int
  let invalidUnitCount: Int
  let comparisonQualified: Bool

  var ratio: Double {
    guard expectedUnitCount > 0 else { return 0 }
    return Double(availableUnitCount) / Double(expectedUnitCount)
  }
}

enum AnastaAnalyticsInsightTone {
  case neutral
  case lower
  case higher
  case protective
}

struct AnastaAnalyticsInsight {
  let title: String
  let body: String
  let symbol: String
  let tone: AnastaAnalyticsInsightTone
}

struct AnastaAnalyticsConfiguration {
  let period: AnastaAnalyticsPeriod
  let requestId: String?
  let calendar: Calendar
  let locale: Locale
  let selectedInterval: DateInterval?
  let comparisonInterval: DateInterval?
  let selectedTotal: TimeInterval?
  let selectedManaged: TimeInterval?
  let selectedCompleteDayAverage: TimeInterval?
  let selectedCompleteManagedDayAverage: TimeInterval?
  let selectedCompleteDayCount: Int
  let selectedBuckets: [AnastaAnalyticsBucket]
  let comparisonBuckets: [AnastaAnalyticsBucket]
  let comparison: AnastaAnalyticsComparison?
  let signals: AnastaAnalyticsSignals
  let groups: [AnastaAnalyticsGroup]
  let localSummary: AnastaAnalyticsLocalSummary?
  let dayOutcomes: [AnastaAnalyticsDayOutcome]
  let insight: AnastaAnalyticsInsight
  let coverage: AnastaAnalyticsCoverage
  let isCurrentPeriod: Bool
  let unavailableReason: String?

  static func unavailable(
    period: AnastaAnalyticsPeriod,
    reason: String
  ) -> AnastaAnalyticsConfiguration {
    AnastaAnalyticsConfiguration(
      period: period,
      requestId: nil,
      calendar: .autoupdatingCurrent,
      locale: .autoupdatingCurrent,
      selectedInterval: nil,
      comparisonInterval: nil,
      selectedTotal: nil,
      selectedManaged: nil,
      selectedCompleteDayAverage: nil,
      selectedCompleteManagedDayAverage: nil,
      selectedCompleteDayCount: 0,
      selectedBuckets: [],
      comparisonBuckets: [],
      comparison: nil,
      signals: AnastaAnalyticsSignals(
        pickups: nil,
        completeDayPickups: nil,
        notifications: nil,
        firstPickup: nil,
        lastUpdatedDate: nil
      ),
      groups: [],
      localSummary: nil,
      dayOutcomes: [],
      insight: AnastaAnalyticsInsight(
        title: "iPhone is preparing this report",
        body: reason,
        symbol: "hourglass",
        tone: .neutral
      ),
      coverage: AnastaAnalyticsCoverage(
        kind: .missing,
        availableUnitCount: 0,
        expectedUnitCount: 0,
        invalidUnitCount: 0,
        comparisonQualified: false
      ),
      isCurrentPeriod: false,
      unavailableReason: reason
    )
  }
}

struct AnastaAnalyticsGroupDefinition {
  let id: String
  let name: String
  let selection: FamilyActivitySelection
  let isAlwaysBlocked: Bool
}

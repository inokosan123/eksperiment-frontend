import Foundation
import XCTest

final class AnastaAnalyticsPureTests: XCTestCase {
  private func utcDate(
    _ year: Int,
    _ month: Int,
    _ day: Int,
    _ hour: Int = 0
  ) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    return calendar.date(
      from: DateComponents(
        year: year,
        month: month,
        day: day,
        hour: hour
      )
    )!
  }

  func testBucketAssignmentUsesExclusiveBounds() {
    let selected = DateInterval(
      start: utcDate(2026, 7, 20),
      end: utcDate(2026, 7, 27)
    )
    let comparison = DateInterval(
      start: utcDate(2026, 7, 13),
      end: utcDate(2026, 7, 20)
    )

    XCTAssertEqual(
      AnastaAnalyticsPure.membership(
        of: utcDate(2026, 7, 20),
        selected: selected,
        comparison: comparison
      ),
      .selected
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.membership(
        of: utcDate(2026, 7, 19, 23),
        selected: selected,
        comparison: comparison
      ),
      .comparison
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.membership(
        of: utcDate(2026, 7, 27),
        selected: selected,
        comparison: comparison
      ),
      .outside
    )
  }

  func testManagedTokenDedupAndStableGroupPriority() {
    let ownership = AnastaAnalyticsPure.stableOwnership([
      .init(
        tokenId: "app-a",
        groupId: "later",
        isAlwaysBlocked: false,
        planOrder: 2
      ),
      .init(
        tokenId: "app-a",
        groupId: "first",
        isAlwaysBlocked: false,
        planOrder: 0
      ),
      .init(
        tokenId: "app-a",
        groupId: "always-blocked",
        isAlwaysBlocked: true,
        planOrder: 99
      ),
      .init(
        tokenId: "app-b",
        groupId: "Zulu",
        isAlwaysBlocked: false,
        planOrder: 1
      ),
      .init(
        tokenId: "app-b",
        groupId: "alpha",
        isAlwaysBlocked: false,
        planOrder: 1
      ),
    ])

    XCTAssertEqual(ownership.count, 2)
    XCTAssertEqual(ownership["app-a"], "always-blocked")
    XCTAssertEqual(ownership["app-b"], "alpha")
  }

  func testCategoryAppAndWebsiteHierarchyIsNonAdditive() {
    XCTAssertEqual(
      AnastaAnalyticsPure.nonAdditiveManagedDuration(
        categoryDuration: 600,
        categoryIsManaged: true,
        applicationDurations: [500],
        websiteDurations: [450]
      ),
      600
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.nonAdditiveManagedDuration(
        categoryDuration: 600,
        categoryIsManaged: false,
        applicationDurations: [400, 350],
        websiteDurations: [500]
      ),
      600
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.preferredDetailFamily(
        applicationDurations: [200],
        websiteDurations: [300],
        categoryDuration: 600
      ),
      .websites
    )
  }

  func testPickupsCountApplicationsOnceAndIncludeUnassociated() {
    XCTAssertEqual(
      AnastaAnalyticsPure.pickups(
        applicationPickups: [2, 3, -8],
        unassociatedPickups: 4
      ),
      9
    )
  }

  func testCompleteDayAverageRejectsBadValues() {
    XCTAssertEqual(
      AnastaAnalyticsPure.average([600, 1_200, 1_800])!,
      1_200,
      accuracy: 0.001
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.average([600, -Double.infinity, -1])!,
      600,
      accuracy: 0.001
    )
    XCTAssertNil(AnastaAnalyticsPure.average([.nan, -1]))
  }

  func testComparisonRequiresMatchedCoverageAndMinimumUnits() {
    let qualified = AnastaAnalyticsPure.qualifiedComparison(
      current: [600, 900, nil, 1_500, 1_500],
      previous: [1_200, 1_200, 1_200, 1_200, 1_200],
      minimumMatched: 4
    )
    XCTAssertEqual(qualified?.matchedCount, 4)
    XCTAssertEqual(qualified?.coverage ?? 0, 0.8, accuracy: 0.001)
    XCTAssertEqual(qualified?.currentAverage ?? 0, 1_125, accuracy: 0.001)

    XCTAssertNil(
      AnastaAnalyticsPure.qualifiedComparison(
        current: [600, nil, nil, 1_500, 1_500],
        previous: [1_200, 1_200, 1_200, 1_200, 1_200],
        minimumMatched: 4
      )
    )
    XCTAssertNil(
      AnastaAnalyticsPure.qualifiedComparison(
        current: [600, 900],
        previous: [1_200, 1_200],
        minimumMatched: 3
      )
    )
  }

  func testZeroPreviousValueRemainsAValidAbsoluteComparison() {
    let result = AnastaAnalyticsPure.qualifiedComparison(
      current: [600, 600, 600, 600],
      previous: [0, 0, 0, 0],
      minimumMatched: 4
    )
    XCTAssertEqual(result?.previousAverage, 0)
    XCTAssertEqual(result?.currentAverage, 600)
  }

  func testAnnualFullDayFormulasAreExplicitProjections() {
    XCTAssertEqual(
      AnastaAnalyticsPure.observedFullDays(totalSeconds: 172_800)!,
      2,
      accuracy: 0.001
    )
    XCTAssertNil(
      AnastaAnalyticsPure.annualPaceFullDays(
        completeDayAverageSeconds: 7_200,
        completeDayCount: 6
      )
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.annualPaceFullDays(
        completeDayAverageSeconds: 7_200,
        completeDayCount: 7
      )!,
      30.416_666,
      accuracy: 0.001
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.targetPaceFullDays(dailyTargetMinutes: 120)!,
      30.416_666,
      accuracy: 0.001
    )
  }

  func testPeakWindowChoosesQualifiedWinnerAndEarliestTie() {
    let index = AnastaAnalyticsPure.peakTwoBucketWindow([
      100,
      600,
      600,
      100,
    ])
    XCTAssertEqual(index, 1)
    XCTAssertEqual(
      AnastaAnalyticsPure.peakTwoBucketWindow([600, 600, 600]),
      0
    )
    XCTAssertNil(
      AnastaAnalyticsPure.peakTwoBucketWindow([100, 200, 100])
    )
  }

  func testInsightPriorityIsDeterministic() {
    XCTAssertEqual(
      AnastaAnalyticsPure.insightPriority(
        hasQualifiedComparison: true,
        hasDayPeak: true,
        hasYearDirection: true,
        hasHeaviestDay: true,
        hasChangedGroup: true,
        hasTopGroup: true
      ),
      .comparison
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.insightPriority(
        hasQualifiedComparison: false,
        hasDayPeak: true,
        hasYearDirection: false,
        hasHeaviestDay: false,
        hasChangedGroup: true,
        hasTopGroup: true
      ),
      .dayPeak
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.insightPriority(
        hasQualifiedComparison: false,
        hasDayPeak: false,
        hasYearDirection: false,
        hasHeaviestDay: false,
        hasChangedGroup: false,
        hasTopGroup: false
      ),
      .fallback
    )
  }

  func testPlausibilityRejectsNonFiniteNegativeAndImpossibleDurations() {
    XCTAssertTrue(
      AnastaAnalyticsPure.isPlausible(
        duration: 3_700,
        intervalDuration: 3_600
      )
    )
    XCTAssertFalse(
      AnastaAnalyticsPure.isPlausible(
        duration: .infinity,
        intervalDuration: 3_600
      )
    )
    XCTAssertFalse(
      AnastaAnalyticsPure.isPlausible(
        duration: -1,
        intervalDuration: 3_600
      )
    )
    XCTAssertFalse(
      AnastaAnalyticsPure.isPlausible(
        duration: 8_000,
        intervalDuration: 3_600
      )
    )
  }

  func testInvalidDetailProducesInconsistentPartialCoverage() {
    XCTAssertEqual(
      AnastaAnalyticsPure.coverageState(
        available: 6,
        expected: 7,
        invalid: 1,
        isCurrentPeriod: false
      ),
      .inconsistent
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.coverageState(
        available: 6,
        expected: 7,
        invalid: 0,
        isCurrentPeriod: false
      ),
      .partial
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.coverageState(
        available: 7,
        expected: 7,
        invalid: 0,
        isCurrentPeriod: false
      ),
      .complete
    )
  }

  func testCancellationNeverPublishes() {
    XCTAssertFalse(
      AnastaAnalyticsPure.shouldPublish(isCancelled: true)
    )
    XCTAssertTrue(
      AnastaAnalyticsPure.shouldPublish(isCancelled: false)
    )
  }

  func testOnePassFixtureVisitsEveryPrivateNodeExactlyOnce() {
    let result = AnastaAnalyticsPure.collectOnePass([
      .init(
        totalDuration: 1_000,
        applicationDurations: [400, 300],
        websiteDurations: [350],
        applicationPickups: [2, 3],
        unassociatedPickups: 1
      ),
      .init(
        totalDuration: 500,
        applicationDurations: [200],
        websiteDurations: [180, 20],
        applicationPickups: [4],
        unassociatedPickups: 2
      ),
    ])
    XCTAssertEqual(result.totalDuration, 1_500)
    XCTAssertEqual(result.applicationDuration, 900)
    XCTAssertEqual(result.websiteDuration, 550)
    XCTAssertEqual(result.pickups, 12)
    XCTAssertEqual(result.segmentVisits, 2)
    XCTAssertEqual(result.applicationVisits, 3)
    XCTAssertEqual(result.websiteVisits, 3)
  }

  func testContextSchemaAcceptsAdditiveOldAndCurrentPayloads() {
    let oldPayload = Data(
      #"{"schemaVersion":1,"requestId":"r1","period":"week"}"#.utf8
    )
    let currentPayload = Data(
      #"{"schemaVersion":1,"requestId":"r1","period":"week","quality":{"malformedEventRows":0}}"#.utf8
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: oldPayload,
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .accepted
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: currentPayload,
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .accepted
    )
  }

  func testContextSchemaRejectsMalformedStaleWrongAndFuturePayloads() {
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: Data(#"{"schemaVersion":"bad"}"#.utf8),
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .malformed
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: Data(
          #"{"schemaVersion":1,"requestId":"old","period":"week"}"#.utf8
        ),
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .staleRequest
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: Data(
          #"{"schemaVersion":1,"requestId":"r1","period":"month"}"#.utf8
        ),
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .wrongPeriod
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.contextSchemaStatus(
        data: Data(
          #"{"schemaVersion":2,"requestId":"r1","period":"week"}"#.utf8
        ),
        expectedRequestId: "r1",
        expectedPeriod: .week
      ),
      .unsupportedVersion
    )
  }

  func testDSTCalendarBoundariesUseCalendarDaysNotTwentyFourHours() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/New_York")!
    let springStart = calendar.date(
      from: DateComponents(year: 2026, month: 3, day: 8)
    )!
    let springEnd = calendar.date(
      byAdding: .day,
      value: 1,
      to: springStart
    )!
    let fallStart = calendar.date(
      from: DateComponents(year: 2026, month: 11, day: 1)
    )!
    let fallEnd = calendar.date(
      byAdding: .day,
      value: 1,
      to: fallStart
    )!

    XCTAssertEqual(
      springEnd.timeIntervalSince(springStart),
      23 * 3_600,
      accuracy: 0.001
    )
    XCTAssertEqual(
      fallEnd.timeIntervalSince(fallStart),
      25 * 3_600,
      accuracy: 0.001
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.dayStarts(
        from: springStart,
        to: calendar.date(
          byAdding: .day,
          value: 2,
          to: springStart
        )!,
        calendar: calendar
      ).count,
      2
    )
  }

  func testYearMonthlyAggregationRequiresCoverageOutsideCurrentMonth() {
    let missing = AnastaAnalyticsPure.monthlyAverage(
      values: [3_600, 3_600],
      availableCompleteDayCount: 2,
      expectedCompleteDayCount: 30,
      isCurrentMonth: false
    )
    XCTAssertNil(missing.average)

    let complete = AnastaAnalyticsPure.monthlyAverage(
      values: Array(repeating: 3_600, count: 24),
      availableCompleteDayCount: 24,
      expectedCompleteDayCount: 30,
      isCurrentMonth: false
    )
    XCTAssertEqual(complete.average, 3_600)
    XCTAssertTrue(complete.isPartial)

    let current = AnastaAnalyticsPure.monthlyAverage(
      values: [1_800, 3_600],
      availableCompleteDayCount: 1,
      expectedCompleteDayCount: 10,
      isCurrentMonth: true
    )
    XCTAssertEqual(current.average, 2_700)
    XCTAssertTrue(current.isPartial)
  }

  func testFallBackBucketsKeepDistinctAbsoluteDateIdentities() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/New_York")!
    let firstOneAM = Date(timeIntervalSince1970: 1_793_509_200)
    let secondOneAM = firstOneAM.addingTimeInterval(3_600)
    let firstBucket = AnastaAnalyticsPure.bucketStart(
      for: firstOneAM,
      period: .day,
      calendar: calendar
    )
    let secondBucket = AnastaAnalyticsPure.bucketStart(
      for: secondOneAM,
      period: .day,
      calendar: calendar
    )
    XCTAssertNotEqual(firstBucket, secondBucket)
  }
  // MARK: - Boundary appearance
  //
  // The same table the React Native resolver is held to. If the two paths ever
  // drift, this is where it should show.

  func testBoundaryAppearanceStateTable() {
    typealias Pure = AnastaAnalyticsPure
    let cases: [(String, Pure.BoundaryMode, Int?, Int?, Pure.BoundaryAppearance)] = [
      // Pending outranks every other rule, including a configured block.
      ("unknown usage on a limit", .limit, 45, nil, .pending),
      ("unknown usage on a block", .blocked, nil, nil, .pending),
      ("unknown usage with no limit", .noLimit, nil, nil, .pending),

      // A configured block stays a block whether or not minutes were recorded.
      ("block held", .blocked, nil, 0, .blocked),
      ("block with recorded usage", .blocked, nil, 42, .blocked),
      // Zero minutes allowed is a block wearing a limit's clothes.
      ("zero-minute limit, unused", .limit, 0, 0, .blocked),
      ("zero-minute limit, used", .limit, 0, 9, .blocked),

      ("no limit, unused", .noLimit, nil, 0, .noLimit),
      ("no limit, used", .noLimit, nil, 240, .noLimit),
      ("limit mode without minutes", .limit, nil, 30, .noLimit),

      // The exact boundary values.
      ("limit untouched", .limit, 45, 0, .limitActive),
      ("one minute under", .limit, 45, 44, .limitActive),
      ("exactly at limit", .limit, 45, 45, .atLimit),
      ("one minute over", .limit, 45, 46, .overLimit),
      ("far over", .limit, 45, 300, .overLimit),
    ]

    for (name, mode, limit, used, expected) in cases {
      XCTAssertEqual(
        Pure.boundaryAppearance(mode: mode, limitMinutes: limit, usedMinutes: used),
        expected,
        name
      )
    }
  }

  func testConfiguredBlockIsNeverAnOverLimitViolation() {
    // The Screen Time report counts the whole day, including minutes spent
    // before the plan became active, so recorded time under a block is a fact
    // to state, not a boundary that was broken.
    let appearance = AnastaAnalyticsPure.boundaryAppearance(
      mode: .blocked,
      limitMinutes: nil,
      usedMinutes: 42
    )
    XCTAssertEqual(appearance, .blocked)
    XCTAssertNotEqual(appearance, .overLimit)
    XCTAssertEqual(
      AnastaAnalyticsPure.statusLabel(appearance, usedMinutes: 42),
      "RECORDED"
    )
    XCTAssertEqual(
      AnastaAnalyticsPure.secondarySignalLabel(
        AnastaAnalyticsPure.secondarySignal(appearance: appearance, usedMinutes: 42)
      ),
      "42m RECORDED TODAY"
    )
  }

  func testBoundaryStatusCopy() {
    typealias Pure = AnastaAnalyticsPure
    XCTAssertEqual(Pure.statusLabel(.pending), "PENDING")
    XCTAssertEqual(Pure.statusLabel(.noLimit), "NO LIMIT")
    XCTAssertEqual(Pure.statusLabel(.blocked), "BLOCKED")
    XCTAssertEqual(Pure.statusLabel(.atLimit), "AT LIMIT")
    // A limit that has not been touched yet is set, not "on track".
    XCTAssertEqual(Pure.statusLabel(.limitActive, limitMinutes: 45, usedMinutes: 0), "LIMIT SET")
    XCTAssertEqual(Pure.statusLabel(.limitActive, limitMinutes: 45, usedMinutes: 20), "ON TRACK")
    XCTAssertEqual(Pure.statusLabel(.overLimit, limitMinutes: 45, usedMinutes: 57), "OVER BY 12m")
    XCTAssertEqual(Pure.statusLabel(.blocked, usedMinutes: 12), "RECORDED")

    XCTAssertEqual(Pure.boundaryMarker(.blocked), .lock)
    XCTAssertEqual(Pure.boundaryMarker(.overLimit), .warning)
    XCTAssertEqual(Pure.boundaryMarker(.limitActive), .check)
    XCTAssertEqual(Pure.boundaryMarker(.atLimit), .none)

    XCTAssertEqual(Pure.overByMinutes(limitMinutes: 45, usedMinutes: 57), 12)
    XCTAssertEqual(Pure.overByMinutes(limitMinutes: 45, usedMinutes: 45), 0)
    XCTAssertEqual(Pure.remainingMinutes(limitMinutes: 45, usedMinutes: 10), 35)
    XCTAssertEqual(Pure.remainingMinutes(limitMinutes: 45, usedMinutes: 90), 0)
  }

  func testInheritedBoundaryNeverReadsAsEscapingTheGroup() {
    typealias Pure = AnastaAnalyticsPure
    XCTAssertEqual(
      Pure.inheritedBoundaryLabel(groupAppearance: .blocked, groupMode: .blocked),
      "GROUP BLOCKED"
    )
    XCTAssertEqual(
      Pure.inheritedBoundaryLabel(groupAppearance: .limitActive, groupMode: .limit),
      "USES GROUP BOUNDARY"
    )
    XCTAssertEqual(
      Pure.inheritedBoundaryLabel(groupAppearance: .noLimit, groupMode: .noLimit),
      "NO INDIVIDUAL LIMIT"
    )
  }

  func testProgressRailOnlyForLiveFiniteLimits() {
    typealias Pure = AnastaAnalyticsPure
    XCTAssertTrue(Pure.showsProgressRail(.limitActive, limitMinutes: 45))
    XCTAssertTrue(Pure.showsProgressRail(.atLimit, limitMinutes: 45))
    XCTAssertTrue(Pure.showsProgressRail(.overLimit, limitMinutes: 45))
    XCTAssertFalse(Pure.showsProgressRail(.blocked, limitMinutes: nil))
    XCTAssertFalse(Pure.showsProgressRail(.blocked, limitMinutes: 0))
    XCTAssertFalse(Pure.showsProgressRail(.pending, limitMinutes: 45))
    XCTAssertFalse(Pure.showsProgressRail(.noLimit, limitMinutes: nil))
    // Going over fills the rail rather than overflowing it.
    XCTAssertEqual(Pure.railFraction(limitMinutes: 45, usedMinutes: 90), 1)
    XCTAssertEqual(Pure.railFraction(limitMinutes: 45, usedMinutes: 0), 0)
  }

  func testChildRollupNeverRepaintsTheParent() {
    typealias Pure = AnastaAnalyticsPure
    XCTAssertEqual(
      Pure.secondarySignal(
        appearance: .limitActive,
        usedMinutes: 20,
        childAppearances: [.limitActive, .overLimit, .atLimit, .overLimit]
      ),
      .childOver(count: 2)
    )
    XCTAssertEqual(
      Pure.secondarySignal(
        appearance: .limitActive,
        usedMinutes: 20,
        childAppearances: [.limitActive, .atLimit]
      ),
      .childAtLimit(count: 1)
    )
    // Over outranks at limit.
    XCTAssertEqual(
      Pure.secondarySignal(
        appearance: .noLimit,
        usedMinutes: 60,
        childAppearances: [.atLimit, .atLimit, .overLimit]
      ),
      .childOver(count: 1)
    )
    // Nothing is claimed while any child is still pending.
    XCTAssertNil(
      Pure.secondarySignal(
        appearance: .limitActive,
        usedMinutes: 20,
        childAppearances: [.overLimit, .pending]
      )
    )
    XCTAssertNil(
      Pure.secondarySignal(
        appearance: .limitActive,
        usedMinutes: 20,
        childAppearances: [.limitActive, .noLimit]
      )
    )
  }

  func testSecondarySignalCounts() {
    typealias Pure = AnastaAnalyticsPure
    XCTAssertEqual(Pure.secondarySignalLabel(.childOver(count: 1)), "1 APP OVER")
    XCTAssertEqual(Pure.secondarySignalLabel(.childOver(count: 3)), "3 APPS OVER")
    XCTAssertEqual(Pure.secondarySignalLabel(.childAtLimit(count: 1)), "1 APP AT LIMIT")
    XCTAssertEqual(Pure.secondarySignalLabel(.childAtLimit(count: 2)), "2 APPS AT LIMIT")
    XCTAssertNil(Pure.secondarySignalLabel(nil))
  }
}

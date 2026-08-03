import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import SwiftUI

extension DeviceActivityReport.Context {
  static let anastaDaily = Self("anasta.daily")
  static let anastaTrend = Self("anasta.trend")
  static let anastaAnalyticsDay = Self("anasta.analytics.day")
  static let anastaAnalyticsWeek = Self("anasta.analytics.week")
  static let anastaAnalyticsMonth = Self("anasta.analytics.month")
  static let anastaAnalyticsYear = Self("anasta.analytics.year")
}

enum AnastaReportMode {
  case daily
  case trend
}

struct AnastaAppActivity {
  let token: ApplicationToken
  let duration: TimeInterval
}

struct AnastaWebActivity {
  let token: WebDomainToken
  let duration: TimeInterval
}

struct AnastaNamedActivity: Identifiable {
  let id: String
  let name: String
  let duration: TimeInterval
}

enum AnastaBoundaryMode: Equatable {
  case blocked
  case limit
  case noLimit
}

struct AnastaActivityBoundary {
  let mode: AnastaBoundaryMode
  let minutes: Int?
}

struct AnastaGroupAppActivity {
  let token: ApplicationToken
  let duration: TimeInterval
  let boundary: AnastaActivityBoundary?
}

struct AnastaGroupActivity: Identifiable {
  let id: String
  let name: String
  let duration: TimeInterval
  let boundary: AnastaActivityBoundary
  let applications: [AnastaGroupAppActivity]
}

struct AnastaActivityBucket: Identifiable {
  let date: Date
  let duration: TimeInterval
  var id: Date { date }
}

struct AnastaActivityConfiguration {
  let mode: AnastaReportMode
  let essentialsOnly: Bool
  let totalDuration: TimeInterval
  let applications: [AnastaAppActivity]
  let websites: [AnastaWebActivity]
  let categories: [AnastaNamedActivity]
  let groups: [AnastaGroupActivity]
  let buckets: [AnastaActivityBucket]
}

@main
struct AnastaActivityReport: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    AnastaDailyReport { configuration in
      AnastaActivityReportContent(configuration: configuration)
    }
    AnastaTrendReport { configuration in
      AnastaActivityReportContent(configuration: configuration)
    }
    AnastaAnalyticsDayReport { configuration in
      AnastaAnalyticsReportContent(configuration: configuration)
    }
    AnastaAnalyticsWeekReport { configuration in
      AnastaAnalyticsReportContent(configuration: configuration)
    }
    AnastaAnalyticsMonthReport { configuration in
      AnastaAnalyticsReportContent(configuration: configuration)
    }
    AnastaAnalyticsYearReport { configuration in
      AnastaAnalyticsReportContent(configuration: configuration)
    }
  }
}

struct AnastaAnalyticsDayReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaAnalyticsDay
  let content: (AnastaAnalyticsConfiguration) -> AnastaAnalyticsReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaAnalyticsConfiguration {
    await makeAnastaAnalyticsConfiguration(representing: data, period: .day)
  }
}

struct AnastaAnalyticsWeekReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaAnalyticsWeek
  let content: (AnastaAnalyticsConfiguration) -> AnastaAnalyticsReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaAnalyticsConfiguration {
    await makeAnastaAnalyticsConfiguration(representing: data, period: .week)
  }
}

struct AnastaAnalyticsMonthReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaAnalyticsMonth
  let content: (AnastaAnalyticsConfiguration) -> AnastaAnalyticsReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaAnalyticsConfiguration {
    await makeAnastaAnalyticsConfiguration(representing: data, period: .month)
  }
}

struct AnastaAnalyticsYearReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaAnalyticsYear
  let content: (AnastaAnalyticsConfiguration) -> AnastaAnalyticsReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaAnalyticsConfiguration {
    await makeAnastaAnalyticsConfiguration(representing: data, period: .year)
  }
}

struct AnastaDailyReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaDaily
  let content: (AnastaActivityConfiguration) -> AnastaActivityReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaActivityConfiguration {
    await makeAnastaConfiguration(representing: data, mode: .daily)
  }
}

struct AnastaTrendReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .anastaTrend
  let content: (AnastaActivityConfiguration) -> AnastaActivityReportContent

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> AnastaActivityConfiguration {
    await makeAnastaConfiguration(representing: data, mode: .trend)
  }
}

private func makeAnastaConfiguration(
  representing data: DeviceActivityResults<DeviceActivityData>,
  mode: AnastaReportMode
) async -> AnastaActivityConfiguration {
  var totalDuration: TimeInterval = 0
  var appDurations: [ApplicationToken: TimeInterval] = [:]
  var webDurations: [WebDomainToken: TimeInterval] = [:]
  var categoryDurations: [String: TimeInterval] = [:]
  var bucketDurations: [Date: TimeInterval] = [:]
  var firstDate: Date?

  for await activityData in data {
    for await segment in activityData.activitySegments {
      totalDuration += segment.totalActivityDuration
      bucketDurations[segment.dateInterval.start, default: 0] += segment.totalActivityDuration
      if firstDate == nil || segment.dateInterval.start < firstDate! {
        firstDate = segment.dateInterval.start
      }

      for await category in segment.categories {
        let categoryName = category.category.localizedDisplayName ?? "Other"
        categoryDurations[categoryName, default: 0] += category.totalActivityDuration

        for await application in category.applications {
          guard let token = application.application.token else { continue }
          appDurations[token, default: 0] += application.totalActivityDuration
        }

        for await website in category.webDomains {
          guard let token = website.webDomain.token else { continue }
          webDurations[token, default: 0] += website.totalActivityDuration
        }
      }
    }
  }

  let applications = appDurations
    .map { AnastaAppActivity(token: $0.key, duration: $0.value) }
    .sorted { $0.duration > $1.duration }
    .prefix(10)
  let websites = webDurations
    .map { AnastaWebActivity(token: $0.key, duration: $0.value) }
    .sorted { $0.duration > $1.duration }
    .prefix(6)
  let categories = categoryDurations
    .map { AnastaNamedActivity(id: $0.key, name: $0.key, duration: $0.value) }
    .sorted { $0.duration > $1.duration }
  let buckets = bucketDurations
    .map { AnastaActivityBucket(date: $0.key, duration: $0.value) }
    .sorted { $0.date < $1.date }
  let groups = mode == .daily
    ? AnastaReportMetadata.groups(for: appDurations, on: firstDate ?? Date())
    : []

  return AnastaActivityConfiguration(
    mode: mode,
    essentialsOnly: mode == .daily
      && AnastaReportMetadata.isEssentialsOnly(on: firstDate ?? Date()),
    totalDuration: totalDuration,
    applications: Array(applications),
    websites: Array(websites),
    categories: categories,
    groups: groups,
    buckets: buckets
  )
}

private enum AnastaReportMetadata {
  private static let payloadKey = "anasta.focus.payload.v4"
  private static let reportSelectionScopesKey = "anasta.focus.report-selection-scopes.v4"

  private static var appGroup: String {
    Bundle.main.object(forInfoDictionaryKey: "AnastaFocusAppGroup") as? String
      ?? "group.com.anasta.app.focus"
  }

  private static var defaults: UserDefaults {
    UserDefaults(suiteName: appGroup) ?? .standard
  }

  private static var payload: [String: Any]? {
    guard
      let json = defaults.string(forKey: payloadKey),
      let data = json.data(using: .utf8),
      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return value
  }

  private static func dateKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = .autoupdatingCurrent
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  private static func plan(on date: Date) -> [String: Any]? {
    guard let payload else { return nil }
    let key = dateKey(date)
    if let snapshot = (payload["reportPlanSnapshots"] as? [String: Any])?[key] {
      return snapshot is NSNull ? nil : snapshot as? [String: Any]
    }
    guard
      let plans = payload["plans"] as? [[String: Any]],
      let schedule = payload["weeklySchedule"] as? [Any]
    else { return nil }
    let overrides = payload["dayOverrides"] as? [String: Any]
    let planId: String?
    if let override = overrides?[key] {
      planId = override is NSNull ? nil : override as? String
    } else {
      let appleWeekday = Calendar.autoupdatingCurrent.component(.weekday, from: date)
      let mondayFirst = (appleWeekday + 5) % 7
      planId = mondayFirst < schedule.count ? schedule[mondayFirst] as? String : nil
    }
    return plans.first { ($0["id"] as? String) == planId }
  }

  private static func selectionKey(_ id: String) -> String {
    "anasta.focus.selection.\(id)"
  }

  private static func selection(_ id: String) -> FamilyActivitySelection {
    let key = selectionKey(id)
    guard
      let data = defaults.data(forKey: key),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return selection
  }

  private static func groupSelection(
    planId: String,
    groupId: String,
    on date: Date
  ) -> FamilyActivitySelection {
    let day = dateKey(date)
    let scopes = defaults.dictionary(forKey: reportSelectionScopesKey) as? [String: String]
    if let scope = scopes?[day] {
      let snapshotId = "report.\(scope).group.\(groupId)"
      if defaults.data(forKey: selectionKey(snapshotId)) != nil {
        return selection(snapshotId)
      }
    }
    return selection("plan.\(planId).group.\(groupId)")
  }

  private static func appSelection(
    planId: String,
    groupId: String,
    appId: String,
    on date: Date
  ) -> FamilyActivitySelection {
    let day = dateKey(date)
    let scopes = defaults.dictionary(forKey: reportSelectionScopesKey) as? [String: String]
    if let scope = scopes?[day] {
      let snapshotId = "report.\(scope).group.\(groupId).app.\(appId)"
      if defaults.data(forKey: selectionKey(snapshotId)) != nil {
        return selection(snapshotId)
      }
    }
    return selection("plan.\(planId).group.\(groupId).app.\(appId)")
  }

  private static func boundary(from rule: [String: Any]?) -> AnastaActivityBoundary {
    guard let rule else {
      return AnastaActivityBoundary(mode: .noLimit, minutes: nil)
    }
    let minutes = (rule["dailyMinutes"] as? Int) ?? (rule["minutes"] as? Int)
    let rawMode = rule["mode"] as? String ?? (minutes == nil ? "noLimit" : "limit")
    switch rawMode {
    case "blocked":
      return AnastaActivityBoundary(mode: .blocked, minutes: nil)
    case "limit":
      return AnastaActivityBoundary(mode: .limit, minutes: minutes)
    default:
      return AnastaActivityBoundary(mode: .noLimit, minutes: nil)
    }
  }

  private static func minuteOfDay(_ date: Date) -> Int {
    let components = Calendar.autoupdatingCurrent.dateComponents([.hour, .minute], from: date)
    return (components.hour ?? 0) * 60 + (components.minute ?? 0)
  }

  private static func sessionContains(_ session: [String: Any], minute: Int) -> Bool {
    let start = session["startMinutes"] as? Int ?? 0
    let end = session["endMinutes"] as? Int ?? 0
    if start == end { return true }
    if end > start { return minute >= start && minute < end }
    return minute >= start || minute < end
  }

  private static func effectiveRules(in plan: [String: Any], on date: Date) -> [[String: Any]] {
    if plan["essentialsOnly"] as? Bool == true { return [] }
    if plan["kind"] as? String != "session" {
      return plan["dailyRules"] as? [[String: Any]] ?? []
    }
    guard Calendar.autoupdatingCurrent.isDateInToday(date) else { return [] }
    let minute = minuteOfDay(Date())
    let sessions = plan["sessions"] as? [[String: Any]] ?? []
    return sessions.first(where: { sessionContains($0, minute: minute) })?["rules"] as? [[String: Any]] ?? []
  }

  /// An Essentials-only plan carries no group boundaries at all, so the group
  /// list is replaced rather than left empty and unexplained.
  static func isEssentialsOnly(on date: Date) -> Bool {
    guard let plan = plan(on: date) else { return false }
    return plan["essentialsOnly"] as? Bool == true
  }

  static func groups(
    for appDurations: [ApplicationToken: TimeInterval],
    on date: Date
  ) -> [AnastaGroupActivity] {
    guard
      let plan = plan(on: date),
      let planId = plan["id"] as? String,
      let catalog = plan["groupCatalog"] as? [String: Any]
    else { return [] }
    let names = plan["groupNames"] as? [String: String] ?? [:]
    let rules = effectiveRules(in: plan, on: date)
    let rulesByGroup = Dictionary(uniqueKeysWithValues: rules.compactMap { rule -> (String, [String: Any])? in
      guard let groupId = rule["groupId"] as? String else { return nil }
      return (groupId, rule)
    })
    var ownedTokens = Set<ApplicationToken>()

    var groups = catalog.keys.map { groupId in
      let selectedApps = groupSelection(
        planId: planId,
        groupId: groupId,
        on: date
      ).applicationTokens
      ownedTokens.formUnion(selectedApps)
      let groupRule = rulesByGroup[groupId]
      let appRules = groupRule?["appRules"] as? [[String: Any]] ?? []
      var appBoundaries: [ApplicationToken: AnastaActivityBoundary] = [:]
      for appRule in appRules {
        guard let appId = appRule["appId"] as? String else { continue }
        let appSelection = appSelection(
          planId: planId,
          groupId: groupId,
          appId: appId,
          on: date
        )
        let appBoundary = boundary(from: appRule)
        for token in appSelection.applicationTokens {
          appBoundaries[token] = appBoundary
        }
      }
      let applications = selectedApps.map { token in
        AnastaGroupAppActivity(
          token: token,
          duration: appDurations[token] ?? 0,
          boundary: appBoundaries[token]
        )
      }.sorted { first, second in
        let firstActive = first.duration > 0
        let secondActive = second.duration > 0
        if firstActive != secondActive { return firstActive }
        return first.duration > second.duration
      }
      let duration = selectedApps.reduce(0) { partial, token in
        partial + (appDurations[token] ?? 0)
      }
      return AnastaGroupActivity(
        id: groupId,
        name: names[groupId] ?? groupId,
        duration: duration,
        boundary: boundary(from: groupRule),
        applications: applications
      )
    }

    let unassignedApps = appDurations.keys.filter { !ownedTokens.contains($0) }
      .map { token in
        AnastaGroupAppActivity(token: token, duration: appDurations[token] ?? 0, boundary: nil)
      }
      .sorted { $0.duration > $1.duration }
    let unassignedDuration = unassignedApps.reduce(0) { $0 + $1.duration }
    if unassignedDuration > 0 {
      groups.append(AnastaGroupActivity(
        id: "__other",
        name: "Other activity",
        duration: unassignedDuration,
        boundary: AnastaActivityBoundary(mode: .noLimit, minutes: nil),
        applications: unassignedApps
      ))
    }

    return groups.sorted { first, second in
      let firstActive = first.duration > 0
      let secondActive = second.duration > 0
      if firstActive != secondActive { return firstActive }
      if firstActive && secondActive && first.duration != second.duration {
        return first.duration > second.duration
      }
      return first.name.localizedCaseInsensitiveCompare(second.name) == .orderedAscending
    }
  }
}

struct AnastaActivityReportContent: View {
  let configuration: AnastaActivityConfiguration
  @State private var expandedGroupId: String?
  @State private var showingMoreDetail = false

  init(configuration: AnastaActivityConfiguration) {
    self.configuration = configuration
    _expandedGroupId = State(initialValue: nil)
  }

  var body: some View {
    ScrollView(.vertical, showsIndicators: false) {
      VStack(alignment: .leading, spacing: 16) {
        if configuration.mode == .trend {
          header
          if !configuration.buckets.isEmpty {
            activityChart
          }
          trendContent
        } else {
          dailyOverview
          if !configuration.buckets.isEmpty {
            activityChart
          }
          dailyContent
        }

        privacyNote
      }
      .padding(16)
    }
    .background(reportBackground)
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private var dailyOverview: some View {
    let activeGroups = configuration.groups.filter { $0.duration > 0 }
    let total = max(activeGroups.reduce(0) { $0 + $1.duration }, 1)
    let overCount = activeGroups.filter {
      usageState(boundary: $0.boundary, duration: $0.duration) == .overLimit
    }.count
    let atLimitCount = activeGroups.filter {
      usageState(boundary: $0.boundary, duration: $0.duration) == .atLimit
    }.count
    let onTrackCount = activeGroups.filter {
      usageState(boundary: $0.boundary, duration: $0.duration) == .limitActive
    }.count
    let openCount = activeGroups.filter {
      usageState(boundary: $0.boundary, duration: $0.duration) == .noLimit
    }.count

    return VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        ZStack {
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(gold.opacity(0.1))
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .stroke(gold.opacity(0.24), lineWidth: 1)
          Image(systemName: "chart.bar.fill")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(gold)
        }
        .frame(width: 38, height: 38)

        VStack(alignment: .leading, spacing: 2) {
          Text("TODAY · GROUP STATUS")
            .font(.system(size: 7.5, weight: .bold))
            .tracking(1.35)
            .foregroundStyle(gold)
          Text("How your groups stand")
            .font(.system(size: 19, weight: .semibold, design: .serif))
            .foregroundStyle(ink)
        }

        Spacer(minLength: 8)

        VStack(spacing: 1) {
          Text("\(activeGroups.count)")
            .font(.system(size: 17, weight: .semibold, design: .serif))
            .foregroundStyle(gold)
          Text("ACTIVE")
            .font(.system(size: 5.5, weight: .bold))
            .tracking(0.75)
            .foregroundStyle(gold)
        }
        .frame(width: 46, height: 46)
        .background(Color.white.opacity(0.58))
        .clipShape(Circle())
        .overlay(Circle().stroke(gold.opacity(0.25), lineWidth: 1))
      }

      GeometryReader { proxy in
        if activeGroups.isEmpty {
          Capsule().fill(ink.opacity(0.06))
        } else {
          HStack(spacing: 3) {
            ForEach(activeGroups) { group in
              let state = usageState(boundary: group.boundary, duration: group.duration)
              Capsule()
                .fill(stateColor(state).opacity(0.88))
                .frame(width: max(5, (proxy.size.width - CGFloat(max(0, activeGroups.count - 1) * 3)) * CGFloat(group.duration / total)))
            }
          }
        }
      }
      .frame(height: 8)

      HStack(spacing: 10) {
        Text("\(duration(configuration.totalDuration)) tracked")
          .font(.system(size: 9.5, weight: .semibold, design: .rounded))
          .foregroundStyle(secondary)
        Spacer(minLength: 6)
        if onTrackCount > 0 {
          overviewSignal("\(onTrackCount) on track", color: limitGold)
        }
        if atLimitCount > 0 {
          overviewSignal("\(atLimitCount) at limit", color: limitMet)
        }
        if overCount > 0 {
          overviewSignal("\(overCount) over", color: danger)
        }
        if openCount > 0 && onTrackCount == 0 && atLimitCount == 0 && overCount == 0 {
          overviewSignal("\(openCount) open", color: secondary)
        }
        if openCount == 0 && onTrackCount == 0 && atLimitCount == 0 && overCount == 0 {
          Text("Tap a group for apps")
            .font(.system(size: 8.5, weight: .medium))
            .foregroundStyle(secondary)
        }
      }
    }
    .padding(14)
    .background(
      LinearGradient(
        colors: [Color.white.opacity(0.9), gold.opacity(0.08)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 21, style: .continuous)
        .stroke(gold.opacity(0.22), lineWidth: 1)
    )
  }

  private func overviewSignal(_ value: String, color: Color) -> some View {
    HStack(spacing: 4) {
      Circle().fill(color).frame(width: 5, height: 5)
      Text(value)
        .font(.system(size: 8.5, weight: .medium))
        .foregroundStyle(color)
    }
  }

  private var dailyContent: some View {
    // Apple's own bucket is not a plan group: it takes no rule, no state and no
    // part in any count, and it rides at the very end of the list.
    let planGroups = configuration.groups.filter { $0.id != "__other" }
    let otherActivity = configuration.groups.first { $0.id == "__other" }
    let activeGroups = planGroups.filter { $0.duration > 0 }
    let quietGroups = planGroups.filter { $0.duration <= 0 }
    return VStack(alignment: .leading, spacing: 13) {
      if activeGroups.isEmpty && configuration.totalDuration <= 0 && !configuration.essentialsOnly {
        emptyActivity
      }

      if configuration.essentialsOnly {
        dailySectionHeading(
          "Plan groups",
          subtitle: "Replaced while Essentials-only holds",
          count: 0
        )
        essentialsOnlyCard
      }

      if !configuration.essentialsOnly, !activeGroups.isEmpty {
        dailySectionHeading(
          "Active today",
          subtitle: "Ranked by screen time",
          count: activeGroups.count
        )
        VStack(spacing: 8) {
          ForEach(activeGroups) { group in
            groupCard(group, rank: (activeGroups.firstIndex(where: { $0.id == group.id }) ?? 0) + 1)
          }
        }
      }

      if !configuration.essentialsOnly, !quietGroups.isEmpty {
        dailySectionHeading(
          activeGroups.isEmpty ? "Plan groups" : "Inactive today",
          subtitle: activeGroups.isEmpty ? "No group activity yet" : "No screen time recorded",
          count: quietGroups.count
        )
        VStack(spacing: 6) {
          ForEach(quietGroups) { group in
            quietGroupRow(group)
          }
        }
      }

      if planGroups.isEmpty && configuration.totalDuration > 0 && !configuration.essentialsOnly {
        sectionHeading("MOST USED APPS", count: configuration.applications.count)
        appFallbackRows
      }

      if let otherActivity, otherActivity.duration > 0 {
        dailySectionHeading(
          "Other activity",
          subtitle: "Outside your plan groups",
          count: 1
        )
        otherActivityRow(otherActivity)
      }

      if !configuration.categories.isEmpty || !configuration.websites.isEmpty {
        moreDetail
      }
    }
  }

  private var trendContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      if configuration.totalDuration <= 0 {
        Text("No iPhone activity was reported for this period.")
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
      }
      if !configuration.categories.isEmpty {
        sectionHeading("APPLE CATEGORIES", count: configuration.categories.count)
        namedRows(configuration.categories.prefix(6), color: crimson)
      }
      if !configuration.applications.isEmpty {
        sectionHeading("MOST USED APPS", count: configuration.applications.count)
        appFallbackRows
      }
      if !configuration.websites.isEmpty {
        sectionHeading("WEBSITES", count: configuration.websites.count)
        websiteRows
      }
    }
  }

  private var header: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(configuration.mode == .trend ? "PRIVATE 30-DAY TREND" : "PRIVATE IPHONE ACTIVITY")
          .font(.system(size: 9, weight: .bold))
          .tracking(1.55)
          .foregroundStyle(gold)
        Text(headlineDuration)
          .font(.system(size: 32, weight: .medium, design: .serif))
          .foregroundStyle(ink)
        Text(configuration.mode == .trend ? "daily average" : "in this report window")
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(secondary)
      }
      Spacer(minLength: 8)
      ZStack {
        Circle().fill(gold.opacity(0.11)).frame(width: 44, height: 44)
        Circle().stroke(gold.opacity(0.28), lineWidth: 1).frame(width: 34, height: 34)
        Image(systemName: "lock.shield")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(gold)
      }
    }
  }

  private var headlineDuration: String {
    if configuration.mode == .trend {
      return duration(configuration.totalDuration / 30)
    }
    return duration(configuration.totalDuration)
  }

  private var activityChart: some View {
    let visible = configuration.mode == .trend
      ? Array(configuration.buckets.suffix(14))
      : Array(configuration.buckets.suffix(24))
    let maximum = max(visible.map(\.duration).max() ?? 0, 60)
    return VStack(alignment: .leading, spacing: 8) {
      Text(configuration.mode == .trend ? "LAST 14 DAYS" : "HOURLY RHYTHM")
        .font(.system(size: 8, weight: .bold))
        .tracking(1.25)
        .foregroundStyle(secondary)
      HStack(alignment: .bottom, spacing: 3) {
        ForEach(visible) { bucket in
          VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
              .fill(configuration.mode == .trend ? gold : crimson)
              .frame(height: max(CGFloat(3), CGFloat(48 * bucket.duration / maximum)))
            Text(bucketLabel(bucket.date))
              .font(.system(size: 6.5, weight: .semibold))
              .foregroundStyle(secondary)
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: 66, alignment: .bottom)
    }
    .padding(12)
    .background(Color.white.opacity(0.65))
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(Color.black.opacity(0.05), lineWidth: 1)
    )
  }

  private func groupCard(_ group: AnastaGroupActivity, rank: Int) -> some View {
    let state = usageState(boundary: group.boundary, duration: group.duration)
    let expanded = expandedGroupId == group.id
    let color = stateColor(state)
    return VStack(spacing: 0) {
      Button {
        withAnimation(.easeInOut(duration: 0.18)) {
          expandedGroupId = expanded ? nil : group.id
        }
      } label: {
        VStack(alignment: .leading, spacing: 11) {
          HStack(spacing: 10) {
            Text(String(format: "%02d", rank))
              .font(.system(size: 8, weight: .bold, design: .rounded))
              .foregroundStyle(color.opacity(0.76))
              .frame(width: 21, height: 42)

            groupMark(group)

            VStack(alignment: .leading, spacing: 2) {
              Text(group.name)
                .font(.system(size: 19.5, weight: .semibold, design: .serif))
                .foregroundStyle(ink)
                .lineLimit(1)
              Text(boundaryCaption(state, boundary: group.boundary, duration: group.duration))
                .font(.system(size: 9.3, weight: .medium))
                .foregroundStyle(state == .overLimit || state == .atLimit ? color : secondary)
                .lineLimit(1)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 4) {
              Text(duration(group.duration))
                .font(.system(size: 18.5, weight: .semibold, design: .rounded))
                .foregroundStyle(state == .overLimit || state == .atLimit ? color : ink)
              statusBadge(state, boundary: group.boundary, duration: group.duration)
            }
          }

          if group.boundary.mode == .limit, let minutes = group.boundary.minutes {
            progressRail(group.duration, limitMinutes: minutes, color: color)
          }

          HStack(spacing: 6) {
            // What the children did, without taking their colour.
            if let signal = secondarySignalLabel(group) {
              Text(signal)
                .font(.system(size: 8.5, weight: .bold))
                .tracking(0.9)
                .foregroundStyle(secondary)
                .padding(.horizontal, 7)
                .padding(.vertical, 3.5)
                .overlay(
                  RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(stateBorder(state), lineWidth: 0.5)
                )
            } else {
              Circle().fill(color.opacity(0.7)).frame(width: 5, height: 5)
            }
            Text(expanded ? "Hide app detail" : "View \(group.applications.count) \(group.applications.count == 1 ? "app" : "apps")")
              .font(.system(size: 9.2, weight: .semibold))
              .foregroundStyle(secondary)
            Spacer()
            Image(systemName: expanded ? "chevron.down" : "chevron.right")
              .font(.system(size: 9, weight: .bold))
              .foregroundStyle(secondary)
              .frame(width: 28, height: 28)
              .background(Color.white.opacity(expanded ? 0.35 : 0.6))
              .clipShape(Circle())
          }
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)

      if expanded {
        groupApps(group)
          .transition(.opacity.combined(with: .move(edge: .top)))
      }
    }
    .background(
      LinearGradient(
        colors: [Color.white.opacity(0.82), stateBackground(state)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 21, style: .continuous)
        .stroke(stateBorder(state), lineWidth: 1)
    )
    .overlay(alignment: .leading) {
      Rectangle()
        .fill(color)
        .frame(width: 3)
    }
    .animation(.easeInOut(duration: 0.23), value: state)
  }

  private func quietGroupRow(_ group: AnastaGroupActivity) -> some View {
    let expanded = expandedGroupId == group.id
    let protectedGroup = group.boundary.mode == .blocked
    let state = usageState(boundary: group.boundary, duration: group.duration)
    let color = stateColor(state)
    return VStack(spacing: 0) {
      Button {
        withAnimation(.easeInOut(duration: 0.18)) {
          expandedGroupId = expanded ? nil : group.id
        }
      } label: {
        HStack(spacing: 10) {
          ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(color.opacity(0.09))
            if group.boundary.mode == .blocked {
              Image(systemName: "lock.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(color)
            } else {
              Text(String(group.name.prefix(1)).uppercased())
                .font(.system(size: 16.5, weight: .semibold, design: .serif))
                .foregroundStyle(color)
            }
          }
          .frame(width: 38, height: 38)

          VStack(alignment: .leading, spacing: 2) {
            Text(group.name)
              .font(.system(size: 16.5, weight: .medium, design: .serif))
              .foregroundStyle(ink)
              .lineLimit(1)
            Text("\(quietBoundaryLabel(group.boundary))  ·  \(group.applications.count) \(group.applications.count == 1 ? "app" : "apps")")
              .font(.system(size: 8.8, weight: .medium))
              .foregroundStyle(secondary)
              .lineLimit(1)
          }

          Spacer(minLength: 6)

          VStack(alignment: .trailing, spacing: 3) {
            Text("0m")
              .font(.system(size: 11.5, weight: .semibold, design: .rounded))
              .foregroundStyle(secondary)
            Text(AnastaAnalyticsPure.statusLabel(state, limitMinutes: group.boundary.minutes, usedMinutes: displayedMinutes(group.duration), formatMinutes: minutesText))
              .font(.system(size: 5.8, weight: .bold))
              .tracking(0.62)
              .foregroundStyle(color)
              .padding(.horizontal, 5.5)
              .frame(minHeight: 15)
              .background(color.opacity(0.1))
              .clipShape(Capsule())
          }

          Image(systemName: expanded ? "chevron.down" : "chevron.right")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(secondary)
            .frame(width: 26, height: 26)
            .background(Color.white.opacity(expanded ? 0.4 : 0.72))
            .clipShape(Circle())
        }
        .padding(.leading, 13)
        .padding(.trailing, 11)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      if expanded {
        groupApps(group)
          .transition(.opacity.combined(with: .move(edge: .top)))
      }
    }
    .background(
      LinearGradient(
        colors: [Color.white.opacity(0.82), stateBackground(state)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 19, style: .continuous)
        .stroke(stateBorder(state), lineWidth: 1)
    )
    .overlay(alignment: .leading) {
      Capsule()
        .fill(color.opacity(0.72))
        .frame(width: 2, height: 40)
    }
    .animation(.easeInOut(duration: 0.23), value: state)
  }

  private func quietBoundaryLabel(_ boundary: AnastaActivityBoundary) -> String {
    if boundary.mode == .blocked { return "Blocked" }
    if let minutes = boundary.minutes { return "\(duration(TimeInterval(minutes * 60))) limit" }
    return "No limit"
  }

  private func groupMark(_ group: AnastaGroupActivity) -> some View {
    let state = usageState(boundary: group.boundary, duration: group.duration)
    let color = stateColor(state)
    return ZStack {
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(Color(red: 0.95, green: 0.94, blue: 0.92))
        .frame(width: 44, height: 44)
        .overlay(
          RoundedRectangle(cornerRadius: 14, style: .continuous)
            .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
      if group.boundary.mode == .blocked {
        Image(systemName: "lock.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(color)
      } else {
        Text(String(group.name.prefix(1)).uppercased())
          .font(.system(size: 19, weight: .semibold, design: .serif))
          .foregroundStyle(secondary)
      }
    }
  }

  private func groupApps(_ group: AnastaGroupActivity) -> some View {
    let state = usageState(boundary: group.boundary, duration: group.duration)
    let color = stateColor(state)
    return VStack(alignment: .leading, spacing: 0) {
      HStack {
        ZStack {
          RoundedRectangle(cornerRadius: 11, style: .continuous)
            .fill(color.opacity(0.11))
          Image(systemName: "chart.bar.fill")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(color)
        }
        .frame(width: 34, height: 34)

        VStack(alignment: .leading, spacing: 1) {
          Text("Apps in this group")
            .font(.system(size: 15.5, weight: .medium, design: .serif))
            .foregroundStyle(ink)
          Text("RANKED BY USE")
            .font(.system(size: 7.3, weight: .bold))
            .tracking(1.05)
            .foregroundStyle(secondary)
        }

        Spacer(minLength: 8)

        ZStack {
          Circle().fill(Color.black.opacity(0.055))
          Text("\(group.applications.count)")
            .font(.system(size: 9, weight: .bold, design: .rounded))
            .foregroundStyle(secondary)
            .monospacedDigit()
        }
        .frame(width: 28, height: 28)
      }
      .padding(.bottom, 10)

      if group.applications.isEmpty {
        Text("No private app selections are stored for this group.")
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(secondary)
          .padding(.vertical, 8)
      } else {
        ForEach(Array(group.applications.enumerated()), id: \.element.token) { index, application in
          appRow(application, groupBoundary: group.boundary)
          if index < group.applications.count - 1 {
            Divider().padding(.leading, 48)
          }
        }
      }
    }
    .padding(.horizontal, 13)
    .padding(.top, 11)
    .padding(.bottom, 6)
    .background(Color.white.opacity(0.7))
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .stroke(Color.black.opacity(0.045), lineWidth: 1)
    )
    .padding(.horizontal, 8)
    .padding(.bottom, 8)
  }

  private func appRow(_ application: AnastaGroupAppActivity, groupBoundary: AnastaActivityBoundary) -> some View {
    // An app inside a blocked group is closed by the group; its own dormant
    // rule must never be shown as if it were doing the work.
    let groupBlocks = groupBoundary.mode == .blocked
    let effectiveBoundary = groupBlocks ? nil : application.boundary
    let specificState = effectiveBoundary.map { usageState(boundary: $0, duration: application.duration) }
    let specificColor = specificState.map(stateColor) ?? secondary
    let groupAppearance = usageState(boundary: groupBoundary, duration: 0)
    return VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 9) {
        VStack(alignment: .leading, spacing: 2) {
          Label(application.token)
            .labelStyle(.titleAndIcon)
            .font(.system(size: 12.2, weight: .medium))
            .lineLimit(1)
          Text(appRuleCaption(application.boundary, groupBoundary: groupBoundary))
            .font(.system(size: 8.6, weight: .medium))
            .foregroundStyle(secondary)
        }
        Spacer(minLength: 6)
        if let boundary = effectiveBoundary, let state = specificState {
          VStack(alignment: .trailing, spacing: 2) {
            Text(duration(application.duration))
              .font(.system(size: 11.5, weight: .semibold, design: .rounded))
              .foregroundStyle(state == .overLimit || state == .atLimit ? specificColor : ink.opacity(0.72))
            Text(appBoundaryLabel(boundary, state: state, duration: application.duration))
              .font(.system(size: 6.8, weight: .bold))
              .tracking(0.65)
              .foregroundStyle(specificColor)
          }
        } else {
          VStack(alignment: .trailing, spacing: 2) {
            Text(duration(application.duration))
              .font(.system(size: 11.5, weight: .semibold, design: .rounded))
              .foregroundStyle(ink.opacity(0.72))
            Text(AnastaAnalyticsPure.inheritedBoundaryLabel(
              groupAppearance: groupAppearance,
              groupMode: pureMode(groupBoundary.mode)
            ))
              .font(.system(size: 6.8, weight: .bold))
              .tracking(0.65)
              .foregroundStyle(secondary)
          }
        }
      }

      if
        let boundary = effectiveBoundary,
        boundary.mode == .limit,
        let minutes = boundary.minutes
      {
        progressRail(
          application.duration,
          limitMinutes: minutes,
          color: specificColor
        )
        .frame(height: 3)
      }
    }
    .padding(.vertical, 9)
  }

  private func appRuleCaption(
    _ boundary: AnastaActivityBoundary?,
    groupBoundary: AnastaActivityBoundary
  ) -> String {
    guard let boundary else {
      return groupBoundary.mode == .noLimit ? "No individual limit" : "Uses group boundary"
    }
    if boundary.mode == .blocked { return "Blocked" }
    if let minutes = boundary.minutes { return "\(duration(TimeInterval(minutes * 60))) app limit" }
    return "No limit"
  }

  /// An Essentials-only plan has no group boundaries to report on, so the one
  /// fact that is true is stated instead.
  private var essentialsOnlyCard: some View {
    HStack(alignment: .center, spacing: 13) {
      ZStack {
        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(crimson)
        Image(systemName: "lock.fill")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(Color.white)
      }
      .frame(width: 42, height: 42)

      VStack(alignment: .leading, spacing: 4) {
        Text("ESSENTIALS ONLY")
          .font(.system(size: 11, weight: .bold))
          .tracking(1.7)
          .foregroundStyle(crimson)
        Text("Only essential apps are available during this plan.")
          .font(.system(size: 14))
          .foregroundStyle(secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 0)
    }
    .padding(15)
    .background(stateBackground(.blocked))
    .overlay(
      RoundedRectangle(cornerRadius: 21, style: .continuous)
        .strokeBorder(stateBorder(.blocked), lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "Essentials only. Only essential apps are available during this plan."
    )
  }

  private func otherActivityRow(_ group: AnastaGroupActivity) -> some View {
    HStack(spacing: 11) {
      ZStack {
        RoundedRectangle(cornerRadius: 11, style: .continuous)
          .fill(Color.black.opacity(0.045))
        Image(systemName: "waveform.path.ecg")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(secondary)
      }
      .frame(width: 34, height: 34)

      VStack(alignment: .leading, spacing: 2) {
        Text("Other activity")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(ink)
        Text("Outside your plan groups")
          .font(.system(size: 12))
          .foregroundStyle(secondary)
      }
      Spacer(minLength: 8)
      Text(duration(group.duration))
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(ink)
        .monospacedDigit()
    }
    .padding(13)
    .background(stateBackground(.noLimit))
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .strokeBorder(stateBorder(.noLimit), lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "Other activity, \(duration(group.duration)), outside your plan groups"
    )
  }

  private var moreDetail: some View {
    VStack(spacing: 0) {
      Button {
        withAnimation(.easeInOut(duration: 0.18)) {
          showingMoreDetail.toggle()
        }
      } label: {
        HStack(spacing: 8) {
          Image(systemName: "chart.bar.xaxis")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(gold)
          Text("MORE IPHONE DETAIL")
            .font(.system(size: 8, weight: .bold))
            .tracking(1.15)
            .foregroundStyle(secondary)
          Spacer()
          Image(systemName: showingMoreDetail ? "chevron.down" : "chevron.right")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(secondary)
        }
        .padding(12)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)

      if showingMoreDetail {
        VStack(alignment: .leading, spacing: 13) {
          if !configuration.categories.isEmpty {
            sectionHeading("APPLE CATEGORIES", count: configuration.categories.count)
            namedRows(configuration.categories.prefix(6), color: crimson)
          }
          if !configuration.websites.isEmpty {
            sectionHeading("WEBSITES", count: configuration.websites.count)
            websiteRows
          }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
        .transition(.opacity.combined(with: .move(edge: .top)))
      }
    }
    .background(Color.white.opacity(0.65))
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(Color.black.opacity(0.05), lineWidth: 1)
    )
  }

  private var appFallbackRows: some View {
    VStack(spacing: 0) {
      ForEach(configuration.applications, id: \.token) { application in
        HStack(spacing: 9) {
          Label(application.token)
            .labelStyle(.titleAndIcon)
            .font(.system(size: 11, weight: .medium))
            .lineLimit(1)
          Spacer(minLength: 8)
          durationText(application.duration)
        }
        .padding(.vertical, 6)
      }
    }
  }

  private var websiteRows: some View {
    VStack(spacing: 0) {
      ForEach(configuration.websites, id: \.token) { website in
        HStack(spacing: 9) {
          Label(website.token)
            .labelStyle(.titleAndIcon)
            .font(.system(size: 11, weight: .medium))
            .lineLimit(1)
          Spacer(minLength: 8)
          durationText(website.duration)
        }
        .padding(.vertical, 6)
      }
    }
  }

  private var emptyActivity: some View {
    HStack(spacing: 11) {
      ZStack {
        Circle().fill(gold.opacity(0.1)).frame(width: 36, height: 36)
        Image(systemName: "moon.stars")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(gold)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text("A quiet report window")
          .font(.system(size: 15, weight: .semibold, design: .serif))
          .foregroundStyle(ink)
        Text("No iPhone activity was recorded here.")
          .font(.system(size: 9.5, weight: .medium))
          .foregroundStyle(secondary)
      }
    }
    .padding(12)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.white.opacity(0.7))
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }

  private var privacyNote: some View {
    HStack(spacing: 6) {
      Image(systemName: "lock.shield")
      Text("App names and activity stay inside Apple's private report.")
    }
    .font(.system(size: 9, weight: .medium))
    .foregroundStyle(secondary)
    .padding(.top, 1)
  }

  private func dailySectionHeading(
    _ title: String,
    subtitle: String,
    count: Int
  ) -> some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.system(size: 20, weight: .semibold, design: .serif))
          .foregroundStyle(ink)
        Text(subtitle)
          .font(.system(size: 9.5, weight: .medium))
          .foregroundStyle(secondary)
      }
      Spacer(minLength: 8)
      ZStack {
        Circle().fill(Color(red: 0.96, green: 0.94, blue: 0.90))
        Circle().stroke(gold.opacity(0.16), lineWidth: 1)
        Text("\(count)")
          .font(.system(size: 12.5, weight: .semibold, design: .serif))
          .foregroundStyle(ink.opacity(0.76))
          .monospacedDigit()
      }
      .frame(width: 36, height: 36)
    }
    .frame(minHeight: 44)
    .padding(.horizontal, 3)
  }

  private func sectionHeading(_ value: String, count: Int) -> some View {
    HStack(spacing: 6) {
      Text(value)
        .font(.system(size: 8, weight: .bold))
        .tracking(1.35)
        .foregroundStyle(secondary)
      Text("\(count)")
        .font(.system(size: 7, weight: .bold, design: .rounded))
        .foregroundStyle(secondary)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Color.black.opacity(0.045))
        .clipShape(Capsule())
    }
  }

  private func namedRows<C: RandomAccessCollection>(
    _ values: C,
    color: Color
  ) -> some View where C.Element == AnastaNamedActivity {
    VStack(spacing: 8) {
      ForEach(Array(values)) { item in
        HStack(spacing: 9) {
          Circle().fill(color).frame(width: 7, height: 7)
          Text(item.name).font(.system(size: 12, weight: .medium)).lineLimit(1)
          Spacer(minLength: 8)
          durationText(item.duration)
        }
      }
    }
  }

  /// The report always has a figure, so `pending` cannot arise here — but the
  /// state model is the same one the React Native breakdown resolves, so a
  /// block stays a block whether or not minutes were recorded against it.
  private func usageState(
    boundary: AnastaActivityBoundary,
    duration: TimeInterval
  ) -> AnastaAnalyticsPure.BoundaryAppearance {
    AnastaAnalyticsPure.boundaryAppearance(
      mode: pureMode(boundary.mode),
      limitMinutes: boundary.minutes,
      usedMinutes: displayedMinutes(duration)
    )
  }

  private func pureMode(_ mode: AnastaBoundaryMode) -> AnastaAnalyticsPure.BoundaryMode {
    switch mode {
    case .blocked: return .blocked
    case .limit: return .limit
    case .noLimit: return .noLimit
    }
  }

  private func displayedMinutes(_ duration: TimeInterval) -> Int {
    Int(max(0, duration) / 60)
  }

  private func minutesText(_ minutes: Int) -> String {
    duration(TimeInterval(minutes * 60))
  }

  /// The children's states, so a group can report what they did without taking
  /// their colour. Never counts Apple's own `__other` bucket.
  private func childAppearances(
    _ group: AnastaGroupActivity
  ) -> [AnastaAnalyticsPure.BoundaryAppearance] {
    guard group.id != "__other" else { return [] }
    return group.applications.map { application in
      let effective = group.boundary.mode == .blocked
        ? AnastaActivityBoundary(mode: .blocked, minutes: nil)
        : (application.boundary ?? AnastaActivityBoundary(mode: .noLimit, minutes: nil))
      return usageState(boundary: effective, duration: application.duration)
    }
  }

  private func secondarySignalLabel(_ group: AnastaGroupActivity) -> String? {
    let appearance = usageState(boundary: group.boundary, duration: group.duration)
    let signal = AnastaAnalyticsPure.secondarySignal(
      appearance: appearance,
      usedMinutes: displayedMinutes(group.duration),
      childAppearances: childAppearances(group)
    )
    return AnastaAnalyticsPure.secondarySignalLabel(signal, formatMinutes: minutesText)
  }

  private func statusBadge(
    _ state: AnastaAnalyticsPure.BoundaryAppearance,
    boundary: AnastaActivityBoundary,
    duration value: TimeInterval = 0
  ) -> some View {
    let label = AnastaAnalyticsPure.statusLabel(
      state,
      limitMinutes: boundary.minutes,
      usedMinutes: displayedMinutes(value),
      formatMinutes: minutesText
    )
    return HStack(spacing: 3) {
      // Colour alone cannot separate a standing block from a passed boundary —
      // they sit six degrees apart in hue — so each carries its own mark.
      if state == .limitActive {
        Image(systemName: "checkmark").font(.system(size: 6.5, weight: .heavy))
      } else if state == .blocked {
        Image(systemName: "lock.fill").font(.system(size: 6, weight: .bold))
      } else if state == .overLimit {
        Image(systemName: "exclamationmark").font(.system(size: 7, weight: .heavy))
      }
      Text(label)
        .font(.system(size: 7, weight: .bold))
        .tracking(0.65)
    }
    .foregroundStyle(stateColor(state))
    .padding(.horizontal, 8)
    .padding(.vertical, 4.5)
    .background(stateColor(state).opacity(0.1))
    .clipShape(Capsule())
  }

  private func boundaryCaption(
    _ state: AnastaAnalyticsPure.BoundaryAppearance,
    boundary: AnastaActivityBoundary,
    duration value: TimeInterval
  ) -> String {
    if state == .blocked { return "Closed for this plan" }
    guard let minutes = boundary.minutes else { return "Open use · no daily limit" }
    let used = displayedMinutes(value)
    switch state {
    case .overLimit:
      return "\(minutesText(minutes)) limit · recorded today"
    case .limitActive:
      return used == 0
        ? "\(minutesText(minutes)) daily limit"
        : "\(minutesText(AnastaAnalyticsPure.remainingMinutes(limitMinutes: minutes, usedMinutes: used))) left · \(minutesText(minutes)) limit"
    case .atLimit:
      return "Limit reached · \(minutesText(minutes)) limit"
    default:
      return "Waiting for activity"
    }
  }

  private func appBoundaryLabel(
    _ boundary: AnastaActivityBoundary,
    state: AnastaAnalyticsPure.BoundaryAppearance,
    duration value: TimeInterval = 0
  ) -> String {
    AnastaAnalyticsPure.statusLabel(
      state,
      limitMinutes: boundary.minutes,
      usedMinutes: displayedMinutes(value),
      formatMinutes: minutesText
    )
  }

  private func progressRail(_ value: TimeInterval, limitMinutes: Int, color: Color) -> some View {
    let limit = max(TimeInterval(limitMinutes * 60), 1)
    let fraction = min(max(value / limit, 0), 1)
    return GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.black.opacity(0.065))
        Capsule().fill(color).frame(width: proxy.size.width * CGFloat(fraction))
      }
    }
    .frame(height: 6)
  }

  private func durationText(_ value: TimeInterval) -> some View {
    Text(duration(value))
      .font(.system(size: 11, weight: .semibold, design: .rounded))
      .foregroundStyle(secondary)
  }

  private func bucketLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
    formatter.dateFormat = configuration.mode == .trend ? "EEEEE" : "HH"
    return formatter.string(from: date)
  }

  // The same six tones the React Native breakdown wears. Blocked rose and
  // over-limit scarlet are deliberately both in the red family; what tells them
  // apart is saturation, the mark they carry and the words they use.
  private func stateColor(_ state: AnastaAnalyticsPure.BoundaryAppearance) -> Color {
    switch state {
    case .pending: return Color(red: 0.569, green: 0.545, blue: 0.506)
    case .noLimit: return secondary
    case .limitActive: return limitPurple
    case .blocked: return crimson
    case .atLimit: return limitMet
    case .overLimit: return scarlet
    }
  }

  private func stateBackground(_ state: AnastaAnalyticsPure.BoundaryAppearance) -> Color {
    switch state {
    case .pending: return Color(red: 0.969, green: 0.965, blue: 0.949)
    case .noLimit: return Color(red: 1.0, green: 0.992, blue: 0.976)
    case .limitActive: return Color(red: 0.957, green: 0.949, blue: 0.980)
    case .blocked: return Color(red: 1.0, green: 0.976, blue: 0.980)
    case .atLimit: return Color(red: 0.984, green: 0.949, blue: 0.863)
    case .overLimit: return Color(red: 1.0, green: 0.945, blue: 0.953)
    }
  }

  private func stateBorder(_ state: AnastaAnalyticsPure.BoundaryAppearance) -> Color {
    switch state {
    case .pending: return Color(red: 0.863, green: 0.847, blue: 0.812)
    case .noLimit: return Color.black.opacity(0.06)
    case .limitActive: return limitPurple.opacity(0.34)
    case .blocked: return crimson.opacity(0.30)
    case .atLimit: return limitMet.opacity(0.42)
    case .overLimit: return scarlet.opacity(0.32)
    }
  }

  private func duration(_ value: TimeInterval) -> String {
    let formatter = DateComponentsFormatter()
    formatter.allowedUnits = [.hour, .minute]
    formatter.unitsStyle = .abbreviated
    formatter.zeroFormattingBehavior = .pad
    return formatter.string(from: value) ?? "0m"
  }

  private var reportBackground: Color { Color(red: 1.0, green: 0.987, blue: 0.955) }
  private var ink: Color { Color(red: 0.16, green: 0.14, blue: 0.11) }
  private var secondary: Color { Color(red: 0.47, green: 0.44, blue: 0.40) }
  private var gold: Color { Color(red: 0.63, green: 0.45, blue: 0.16) }
  private var limitGold: Color { Color(red: 0.773, green: 0.627, blue: 0.349) }
  private var limitMet: Color { Color(red: 0.545, green: 0.420, blue: 0.184) }
  private var crimson: Color { Color(red: 0.635, green: 0.263, blue: 0.318) }
  private var limitPurple: Color { Color(red: 0.427, green: 0.353, blue: 0.682) }
  private var scarlet: Color { Color(red: 0.745, green: 0.071, blue: 0.235) }
  private var danger: Color { Color(red: 0.66, green: 0.28, blue: 0.34) }
  private var safe: Color { Color(red: 0.23, green: 0.48, blue: 0.42) }
}

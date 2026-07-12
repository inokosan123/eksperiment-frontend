import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import SwiftUI

extension DeviceActivityReport.Context {
  static let anastaDaily = Self("anasta.daily")
  static let anastaTrend = Self("anasta.trend")
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

struct AnastaActivityBucket: Identifiable {
  let date: Date
  let duration: TimeInterval
  var id: Date { date }
}

struct AnastaActivityConfiguration {
  let mode: AnastaReportMode
  let totalDuration: TimeInterval
  let applications: [AnastaAppActivity]
  let websites: [AnastaWebActivity]
  let categories: [AnastaNamedActivity]
  let groups: [AnastaNamedActivity]
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

  static func groups(
    for appDurations: [ApplicationToken: TimeInterval],
    on date: Date
  ) -> [AnastaNamedActivity] {
    guard
      let plan = plan(on: date),
      let planId = plan["id"] as? String,
      let catalog = plan["groupCatalog"] as? [String: Any]
    else { return [] }
    let names = plan["groupNames"] as? [String: String] ?? [:]

    return catalog.keys.compactMap { groupId in
      let selectedApps = groupSelection(
        planId: planId,
        groupId: groupId,
        on: date
      ).applicationTokens
      let duration = selectedApps.reduce(0) { partial, token in
        partial + (appDurations[token] ?? 0)
      }
      guard duration > 0 else { return nil }
      return AnastaNamedActivity(
        id: groupId,
        name: names[groupId] ?? groupId,
        duration: duration
      )
    }.sorted { $0.duration > $1.duration }
  }
}

struct AnastaActivityReportContent: View {
  let configuration: AnastaActivityConfiguration

  var body: some View {
    ScrollView(.vertical, showsIndicators: false) {
      VStack(alignment: .leading, spacing: 14) {
        header

        if !configuration.buckets.isEmpty {
          activityChart
        }

        if configuration.totalDuration <= 0 {
          Text(configuration.mode == .trend
            ? "No iPhone activity was reported for this period."
            : "No iPhone activity was reported for this day.")
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
        } else {
          if !configuration.groups.isEmpty {
            sectionTitle("ANASTA GROUPS")
            namedRows(configuration.groups.prefix(6), color: gold)
          }

          if !configuration.categories.isEmpty {
            sectionTitle("APPLE CATEGORIES")
            namedRows(configuration.categories.prefix(6), color: crimson)
          }

          if !configuration.applications.isEmpty {
            sectionTitle("MOST USED APPS")
            ForEach(configuration.applications, id: \.token) { application in
              HStack(spacing: 10) {
                Label(application.token)
                  .labelStyle(.titleAndIcon)
                  .lineLimit(1)
                Spacer(minLength: 8)
                durationText(application.duration)
              }
              .padding(.vertical, 3)
            }
          }

          if !configuration.websites.isEmpty {
            sectionTitle("WEBSITES")
            ForEach(configuration.websites, id: \.token) { website in
              HStack(spacing: 10) {
                Label(website.token)
                  .labelStyle(.titleAndIcon)
                  .lineLimit(1)
                Spacer(minLength: 8)
                durationText(website.duration)
              }
              .padding(.vertical, 3)
            }
          }
        }

        HStack(spacing: 6) {
          Image(systemName: "lock.shield")
          Text("Activity detail stays inside Apple's private report.")
        }
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.secondary)
        .padding(.top, 2)
      }
      .padding(16)
    }
    .background(Color(red: 1.0, green: 0.985, blue: 0.94))
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text(configuration.mode == .trend ? "PRIVATE 30-DAY TREND" : "PRIVATE DAILY ACTIVITY")
          .font(.system(size: 10, weight: .bold))
          .tracking(1.5)
          .foregroundStyle(.secondary)
        Text(headlineDuration)
          .font(.system(size: 30, weight: .medium, design: .serif))
        Text(configuration.mode == .trend ? "daily average" : "total iPhone time")
          .font(.system(size: 11))
          .foregroundStyle(.secondary)
      }
      Spacer()
      Image(systemName: "lock.shield")
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(gold)
    }
  }

  private var headlineDuration: String {
    if configuration.mode == .trend {
      // The host's trend context is one complete 30-day window. Divide by the
      // calendar window, not only buckets returned by iOS, so zero-use days do
      // not inflate the displayed average.
      return duration(configuration.totalDuration / 30)
    }
    return duration(configuration.totalDuration)
  }

  private var activityChart: some View {
    let visible = configuration.mode == .trend
      ? Array(configuration.buckets.suffix(14))
      : Array(configuration.buckets.suffix(24))
    let maximum = max(visible.map(\.duration).max() ?? 0, 60)
    return VStack(alignment: .leading, spacing: 7) {
      Text(configuration.mode == .trend ? "LAST 14 DAYS" : "HOURLY RHYTHM")
        .font(.system(size: 9, weight: .bold))
        .tracking(1.1)
        .foregroundStyle(.secondary)
      HStack(alignment: .bottom, spacing: 4) {
        ForEach(visible) { bucket in
          VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
              .fill(configuration.mode == .trend ? gold : crimson)
              .frame(height: max(CGFloat(4), CGFloat(62 * bucket.duration / maximum)))
            Text(bucketLabel(bucket.date))
              .font(.system(size: 7, weight: .semibold))
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: 82, alignment: .bottom)
    }
    .padding(.vertical, 4)
  }

  private var gold: Color {
    Color(red: 0.63, green: 0.45, blue: 0.16)
  }

  private var crimson: Color {
    Color(red: 0.63, green: 0.24, blue: 0.29)
  }

  private func sectionTitle(_ value: String) -> some View {
    Text(value)
      .font(.system(size: 9, weight: .bold))
      .tracking(1.1)
      .foregroundStyle(.secondary)
      .padding(.top, 2)
  }

  private func namedRows<C: RandomAccessCollection>(
    _ values: C,
    color: Color
  ) -> some View where C.Element == AnastaNamedActivity {
    VStack(spacing: 8) {
      ForEach(Array(values)) { item in
        HStack(spacing: 9) {
          Circle().fill(color).frame(width: 7, height: 7)
          Text(item.name).font(.system(size: 13, weight: .medium)).lineLimit(1)
          Spacer(minLength: 8)
          durationText(item.duration)
        }
      }
    }
  }

  private func durationText(_ value: TimeInterval) -> some View {
    Text(duration(value))
      .font(.system(size: 13, weight: .semibold, design: .rounded))
      .foregroundStyle(.secondary)
  }

  private func bucketLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
    formatter.dateFormat = configuration.mode == .trend ? "EEEEE" : "HH"
    return formatter.string(from: date)
  }

  private func duration(_ value: TimeInterval) -> String {
    let formatter = DateComponentsFormatter()
    formatter.allowedUnits = [.hour, .minute]
    formatter.unitsStyle = .abbreviated
    formatter.zeroFormattingBehavior = .pad
    return formatter.string(from: value) ?? "0m"
  }
}

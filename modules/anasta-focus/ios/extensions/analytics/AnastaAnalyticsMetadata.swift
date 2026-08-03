import FamilyControls
import Foundation

struct AnastaAnalyticsSelectionScope {
  let id: String
  let groups: [AnastaAnalyticsGroupDefinition]

  func owner(of token: ApplicationToken) -> AnastaAnalyticsGroupDefinition? {
    groups.first { $0.selection.applicationTokens.contains(token) }
  }

  func owner(of token: ActivityCategoryToken) -> AnastaAnalyticsGroupDefinition? {
    groups.first { $0.selection.categoryTokens.contains(token) }
  }

  func owner(of token: WebDomainToken) -> AnastaAnalyticsGroupDefinition? {
    groups.first { $0.selection.webDomainTokens.contains(token) }
  }

  func higherPriority(
    _ first: AnastaAnalyticsGroupDefinition,
    than second: AnastaAnalyticsGroupDefinition
  ) -> Bool {
    priority(of: first) < priority(of: second)
  }

  func priority(of group: AnastaAnalyticsGroupDefinition) -> Int {
    groups.firstIndex { $0.id == group.id } ?? Int.max
  }
}

enum AnastaAnalyticsMetadata {
  private static let payloadKey = "anasta.focus.payload.v4"
  private static let reportSelectionScopesKey = "anasta.focus.report-selection-scopes.v4"
  private static let contextPointerKey = "anasta.focus.analytics-context.current.v1"
  private static let contextRequestPrefix = "anasta.focus.analytics-context.request."

  private static var defaults: UserDefaults? {
    guard
      let appGroup = Bundle.main.object(
        forInfoDictionaryKey: "AnastaFocusAppGroup"
      ) as? String,
      !appGroup.isEmpty
    else { return nil }
    return UserDefaults(suiteName: appGroup)
  }

  static func context(
    expectedPeriod: AnastaAnalyticsPeriod
  ) -> AnastaAnalyticsContextPayload? {
    guard
      let defaults,
      let requestId = defaults.string(forKey: contextPointerKey),
      let json = defaults.string(
        forKey: "\(contextRequestPrefix)\(requestId).v1"
      ),
      let data = json.data(using: .utf8),
      AnastaAnalyticsPure.contextSchemaStatus(
        data: data,
        expectedRequestId: requestId,
        expectedPeriod: AnastaAnalyticsPure.Period(
          rawValue: expectedPeriod.rawValue
        )!
      ) == .accepted,
      let context = try? JSONDecoder().decode(
        AnastaAnalyticsContextPayload.self,
        from: data
      ),
      context.schemaVersion == 1,
      context.requestId == requestId,
      context.period == expectedPeriod
    else { return nil }
    return context
  }

  static func calendar(for context: AnastaAnalyticsContextPayload) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = Locale(identifier: context.locale)
    calendar.timeZone = TimeZone(identifier: context.timezone) ?? .autoupdatingCurrent
    return calendar
  }

  static func date(
    _ value: String,
    context: AnastaAnalyticsContextPayload
  ) -> Date? {
    let formatter = DateFormatter()
    formatter.calendar = calendar(for: context)
    formatter.timeZone = formatter.calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value).map {
      formatter.calendar.startOfDay(for: $0)
    }
  }

  static func dayKey(
    _ date: Date,
    context: AnastaAnalyticsContextPayload
  ) -> String {
    let formatter = DateFormatter()
    formatter.calendar = calendar(for: context)
    formatter.timeZone = formatter.calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  static func outcome(
    for date: Date,
    context: AnastaAnalyticsContextPayload
  ) -> AnastaAnalyticsDayOutcome? {
    let key = dayKey(date, context: context)
    return context.dayOutcomes.first { $0.date == key }
  }

  static func selectionScope(
    for date: Date,
    context: AnastaAnalyticsContextPayload,
    period: AnastaAnalyticsPeriod
  ) -> AnastaAnalyticsSelectionScope? {
    let key = dayKey(date, context: context)
    guard
      let defaults,
      let scopes = defaults.dictionary(forKey: reportSelectionScopesKey) as? [String: String],
      let scopeId = scopes[key]
    else { return nil }

    let plan = plan(on: date, context: context)
    let catalog = plan?["groupCatalog"] as? [String: Any] ?? [:]
    let explicitOrder = plan?["groupOrder"] as? [String] ?? []
    let fullGroupOrder = explicitOrder + catalog.keys
      .filter { !explicitOrder.contains($0) }
      .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    let names = plan?["groupNames"] as? [String: String] ?? [:]
    let dailyRules = plan?["dailyRules"] as? [[String: Any]] ?? []
    let sessions = plan?["sessions"] as? [[String: Any]] ?? []
    let rules: [[String: Any]]
    if sessions.isEmpty {
      rules = dailyRules
    } else if period == .day {
      rules = sessionRules(at: date, sessions: sessions, context: context)
    } else {
      rules = sessions.flatMap { $0["rules"] as? [[String: Any]] ?? [] }
    }
    let activeGroupIds = Set(rules.compactMap { $0["groupId"] as? String })
    let groupOrder = fullGroupOrder.filter(activeGroupIds.contains)

    var definitions: [AnastaAnalyticsGroupDefinition] = []
    var always = FamilyActivitySelection()
    merge(
      selection("report.\(scopeId).always.strict"),
      into: &always
    )
    merge(
      selection("report.\(scopeId).always.loose"),
      into: &always
    )
    if !isEmpty(always) {
      definitions.append(
        AnastaAnalyticsGroupDefinition(
          id: "always-blocked",
          name: "Always Blocked",
          selection: always,
          isAlwaysBlocked: true
        )
      )
    }

    for groupId in groupOrder {
      var groupSelection = selection("report.\(scopeId).group.\(groupId)")
      let appIds = rules
        .filter { ($0["groupId"] as? String) == groupId }
        .flatMap { $0["appRules"] as? [[String: Any]] ?? [] }
        .compactMap { $0["appId"] as? String }
      for appId in appIds {
        merge(
          selection("report.\(scopeId).group.\(groupId).app.\(appId)"),
          into: &groupSelection
        )
      }
      guard !isEmpty(groupSelection) else { continue }
      definitions.append(
        AnastaAnalyticsGroupDefinition(
          id: groupId,
          name: names[groupId] ?? displayName(groupId),
          selection: groupSelection,
          isAlwaysBlocked: false
        )
      )
    }

    return AnastaAnalyticsSelectionScope(id: scopeId, groups: definitions)
  }

  private static func sessionRules(
    at date: Date,
    sessions: [[String: Any]],
    context: AnastaAnalyticsContextPayload
  ) -> [[String: Any]] {
    let components = calendar(for: context).dateComponents(
      [.hour, .minute],
      from: date
    )
    let minute = (components.hour ?? 0) * 60 + (components.minute ?? 0)
    let session = sessions.first { value in
      guard
        let start = value["startMinutes"] as? Int,
        let end = value["endMinutes"] as? Int
      else { return false }
      if start == end { return true }
      if start < end {
        return minute >= start && minute < end
      }
      return minute >= start || minute < end
    }
    return session?["rules"] as? [[String: Any]] ?? []
  }

  private static var payload: [String: Any]? {
    guard
      let defaults,
      let json = defaults.string(forKey: payloadKey),
      let data = json.data(using: .utf8),
      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return value
  }

  private static func plan(
    on date: Date,
    context: AnastaAnalyticsContextPayload
  ) -> [String: Any]? {
    guard let payload else { return nil }
    let key = dayKey(date, context: context)
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
      let weekday = calendar(for: context).component(.weekday, from: date)
      let mondayFirst = (weekday + 5) % 7
      planId = mondayFirst < schedule.count ? schedule[mondayFirst] as? String : nil
    }
    return plans.first { ($0["id"] as? String) == planId }
  }

  private static func selection(_ id: String) -> FamilyActivitySelection {
    guard
      let defaults,
      let data = defaults.data(forKey: "anasta.focus.selection.\(id)"),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return selection
  }

  private static func merge(
    _ source: FamilyActivitySelection,
    into destination: inout FamilyActivitySelection
  ) {
    destination.applicationTokens.formUnion(source.applicationTokens)
    destination.categoryTokens.formUnion(source.categoryTokens)
    destination.webDomainTokens.formUnion(source.webDomainTokens)
  }

  private static func isEmpty(_ selection: FamilyActivitySelection) -> Bool {
    selection.applicationTokens.isEmpty
      && selection.categoryTokens.isEmpty
      && selection.webDomainTokens.isEmpty
  }

  private static func displayName(_ id: String) -> String {
    id
      .replacingOccurrences(of: "-", with: " ")
      .replacingOccurrences(of: "_", with: " ")
      .split(separator: " ")
      .map { $0.prefix(1).uppercased() + String($0.dropFirst()) }
      .joined(separator: " ")
  }
}

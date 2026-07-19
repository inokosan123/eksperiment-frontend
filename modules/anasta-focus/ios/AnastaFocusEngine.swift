import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

enum AnastaFocusShared {
  static let payloadKey = "anasta.focus.payload.v4"
  static let eventMapKey = "anasta.focus.event-map.v4"
  static let reachedSelectionsKey = "anasta.focus.reached-selections.v4"
  static let reachedMetadataKey = "anasta.focus.reached-metadata.v4"
  static let reachedScopeKey = "anasta.focus.reached-scope.v4"
  static let dailyHardWallKey = "anasta.focus.daily-hard-wall.v4"
  static let dailyHardWallContextKey = "anasta.focus.daily-hard-wall-context.v4"
  static let activeRuleFingerprintKey = "anasta.focus.active-rule-fingerprint.v4"
  static let activeRuleScopeFingerprintKey = "anasta.focus.active-rule-scope-fingerprint.v4"
  static let planMonitoringFingerprintKey = "anasta.focus.plan-monitoring-fingerprint.v4"
  static let planMonitoringRevisionKey = "anasta.focus.plan-monitoring-revision.v4"
  static let quietMonitoringFingerprintKey = "anasta.focus.quiet-monitoring-fingerprint.v4"
  static let temporaryAccessKey = "anasta.focus.temporary-access.v4"
  static let pendingInterventionKey = "anasta.focus.pending-intervention.v4"
  static let nativeEventQueueKey = "anasta.focus.native-event-queue.v4"
  static let deliveredEventKeysKey = "anasta.focus.delivered-event-keys.v4"
  static let appliedWebDomainCountKey = "anasta.focus.web-domains-applied.v4"
  static let omittedWebDomainCountKey = "anasta.focus.web-domains-omitted.v4"
  static let adultFilterActiveKey = "anasta.focus.adult-filter-active.v4"
  static let targetArmedDaysKey = "anasta.focus.target-armed-days.v4"
  static let targetLostDaysKey = "anasta.focus.target-lost-days.v4"
  static let reportSelectionScopesKey = "anasta.focus.report-selection-scopes.v4"

  static var appGroup: String {
    Bundle.main.object(forInfoDictionaryKey: "AnastaFocusAppGroup") as? String
      ?? "group.com.anasta.app.focus"
  }

  static var defaults: UserDefaults {
    UserDefaults(suiteName: appGroup) ?? .standard
  }

  static func payload() -> [String: Any]? {
    guard
      let json = defaults.string(forKey: payloadKey),
      let data = json.data(using: .utf8),
      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return value
  }

  static func consumePendingIntervention() -> [String: Any]? {
    let value = defaults.dictionary(forKey: pendingInterventionKey)
    defaults.removeObject(forKey: pendingInterventionKey)
    return value
  }

  static func appendNativeEvent(_ value: [String: Any]) {
    var queue = defaults.array(forKey: nativeEventQueueKey) as? [[String: Any]] ?? []
    queue.append(value)
    defaults.set(Array(queue.suffix(512)), forKey: nativeEventQueueKey)
  }

  static func consumeNativeEvents() -> [[String: Any]] {
    let queue = defaults.array(forKey: nativeEventQueueKey) as? [[String: Any]] ?? []
    defaults.removeObject(forKey: nativeEventQueueKey)
    return queue
  }

  static func markEventDelivered(activity: DeviceActivityName, event: DeviceActivityEvent.Name) -> Bool {
    let key = "\(activity.rawValue)|\(event.rawValue)"
    var delivered = defaults.stringArray(forKey: deliveredEventKeysKey) ?? []
    if delivered.contains(key) { return false }
    delivered.append(key)
    defaults.set(Array(delivered.suffix(512)), forKey: deliveredEventKeysKey)
    return true
  }

  static func markDailyTargetLost(day: String, planId: String) {
    guard !day.isEmpty, !planId.isEmpty else { return }
    var values = defaults.dictionary(forKey: targetLostDaysKey) as? [String: String] ?? [:]
    values[day] = planId
    let retained = values.keys.sorted().suffix(400)
    let compact = Dictionary(uniqueKeysWithValues: retained.compactMap { key in
      values[key].map { (key, $0) }
    })
    defaults.set(compact, forKey: targetLostDaysKey)
  }
}

enum AnastaSelectionStore {
  private static func key(_ selectionId: String) -> String {
    "anasta.focus.selection.\(selectionId)"
  }

  static func load(selectionId: String) -> FamilyActivitySelection {
    if
      let data = AnastaFocusShared.defaults.data(forKey: key(selectionId)),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    {
      return selection
    }
    if
      let legacyId = legacyIndividualSelectionId(selectionId),
      let data = AnastaFocusShared.defaults.data(forKey: key(legacyId)),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    {
      save(selection, selectionId: selectionId)
      return selection
    }
    return FamilyActivitySelection()
  }

  static func save(_ selection: FamilyActivitySelection, selectionId: String) {
    guard let data = try? JSONEncoder().encode(selection) else { return }
    AnastaFocusShared.defaults.set(data, forKey: key(selectionId))
  }

  static func saveFromPicker(
    _ proposedSelection: FamilyActivitySelection,
    selectionId: String
  ) -> [String: Any] {
    if isSingleApplication(selectionId), proposedSelection.applicationTokens.count > 1 {
      var result = summary(selectionId: selectionId)
      result["notice"] = "Choose exactly one app for an individual app rule. Nothing changed."
      return result
    }

    var selection = normalized(proposedSelection, selectionId: selectionId)
    var notices: [String] = []
    let removedNonApplications = proposedSelection.categoryTokens.count
      + proposedSelection.webDomainTokens.count

    if isApplicationsOnly(selectionId), removedNonApplications > 0 {
      notices.append(
        isSingleApplication(selectionId)
          ? "Choose one individual app; categories and websites were not saved."
          : "Only individual apps are saved in this list."
      )
    } else if selectionId.hasPrefix("plan.") && !proposedSelection.webDomainTokens.isEmpty {
      notices.append("Websites belong in Web Protection and were not saved here.")
    }

    if
      isSingleApplication(selectionId),
      !selection.applicationTokens.isEmpty,
      let parentId = parentPlanGroupSelectionId(selectionId)
    {
      let parent = load(selectionId: parentId)
      let outsideGroup = selection.applicationTokens.subtracting(parent.applicationTokens)
      if !outsideGroup.isEmpty {
        var result = summary(selectionId: selectionId)
        result["notice"] = parent.applicationTokens.isEmpty
          ? "Choose this group's apps first, then add an individual rule. Nothing changed."
          : "An individual rule must use an app already selected in this group. Nothing changed."
        return result
      }
    }

    let alwaysApplications = load(selectionId: "always.strict").applicationTokens
      .union(load(selectionId: "always.loose").applicationTokens)
    let permanentEssentials = load(selectionId: "core.designated").applicationTokens
      .union(load(selectionId: "global.essentials").applicationTokens)

    if isPlanEssentials(selectionId) {
      let rejected = selection.applicationTokens.intersection(alwaysApplications)
      let alreadyPermanent = selection.applicationTokens.intersection(permanentEssentials)
      selection.applicationTokens.subtract(alwaysApplications)
      selection.applicationTokens.subtract(permanentEssentials)
      if !rejected.isEmpty {
        notices.append("Always Blocked apps were not allowed by this plan.")
      }
      if !alreadyPermanent.isEmpty {
        notices.append("Apps already in global Essentials stay available without being duplicated here.")
      }
    }

    switch selectionId {
    case "core.designated":
      let existing = load(selectionId: selectionId).applicationTokens
      let rejected = selection.applicationTokens.intersection(alwaysApplications)
      selection.applicationTokens.subtract(alwaysApplications)
      selection.applicationTokens.formUnion(existing)
      if !rejected.isEmpty {
        notices.append("Always Blocked apps were not made Core. Remove that protection first.")
      }
      let preserved = existing.subtracting(proposedSelection.applicationTokens)
      if !preserved.isEmpty {
        notices.append("Existing Core apps stay locked.")
      }

    case "global.essentials":
      let rejected = selection.applicationTokens.intersection(alwaysApplications)
      selection.applicationTokens.subtract(alwaysApplications)
      if !rejected.isEmpty {
        notices.append("Always Blocked apps were not added to Essentials.")
      }

    case "quiet.current":
      let rejected = selection.applicationTokens.intersection(alwaysApplications)
      selection.applicationTokens.subtract(alwaysApplications)
      if !rejected.isEmpty {
        notices.append("Always Blocked apps stay unavailable during Quiet Hour.")
      }

    case "always.strict", "always.loose":
      let rejected = selection.applicationTokens.intersection(permanentEssentials)
      selection.applicationTokens.subtract(permanentEssentials)
      if !rejected.isEmpty {
        notices.append("Essential apps were not blocked. Remove them from Essentials first.")
      }

      let otherId = selectionId == "always.strict" ? "always.loose" : "always.strict"
      var otherSelection = load(selectionId: otherId)
      let moved = otherSelection.applicationTokens.intersection(selection.applicationTokens)
      if !moved.isEmpty {
        otherSelection.applicationTokens.subtract(selection.applicationTokens)
        save(normalized(otherSelection, selectionId: otherId), selectionId: otherId)
        notices.append("Apps already in the other Always Blocked mode were moved here.")
      }

    default:
      break
    }

    var clearedIndividualRules = 0
    if isPlanGroup(selectionId) {
      let changes = removeFromSiblingPlanGroups(
        selection.applicationTokens,
        keeping: selectionId
      )
      clearedIndividualRules += changes.clearedRules
      if changes.moved > 0 {
        notices.append(
          "Selected apps were moved out of their previous group in this plan."
        )
      }
    }

    save(selection, selectionId: selectionId)
    if isPlanGroup(selectionId) {
      clearedIndividualRules += clearChildSelectionsOutsideGroup(
        selectionId,
        allowedApplications: selection.applicationTokens
      )
    }
    if clearedIndividualRules > 0 {
      notices.append(
        "Individual app rules whose app left its group were cleared."
      )
    }
    var result = summary(selectionId: selectionId)
    if !notices.isEmpty { result["notice"] = notices.joined(separator: " ") }
    return result
  }

  static func copy(sourceId: String, destinationId: String) -> [String: Any] {
    saveFromPicker(load(selectionId: sourceId), selectionId: destinationId)
  }

  static func clear(selectionId: String) {
    if selectionId == "core.designated" { return }
    AnastaFocusShared.defaults.removeObject(forKey: key(selectionId))
  }

  static func clear(prefix: String) {
    let storagePrefix = key(prefix)
    for storedKey in AnastaFocusShared.defaults.dictionaryRepresentation().keys
      where storedKey.hasPrefix(storagePrefix) {
      AnastaFocusShared.defaults.removeObject(forKey: storedKey)
    }
  }

  static func clearReportSelections(exceptScopes: Set<String>) {
    let storagePrefix = key("report.")
    let selectionKeyPrefix = key("")
    for storedKey in AnastaFocusShared.defaults.dictionaryRepresentation().keys
      where storedKey.hasPrefix(storagePrefix) {
      let selectionId = String(storedKey.dropFirst(selectionKeyPrefix.count))
      let parts = selectionId.split(separator: ".", maxSplits: 2).map(String.init)
      guard parts.count >= 2, parts[0] == "report" else { continue }
      if !exceptScopes.contains(parts[1]) {
        AnastaFocusShared.defaults.removeObject(forKey: storedKey)
      }
    }
  }

  static func summary(selectionId: String) -> [String: Any] {
    let selection = load(selectionId: selectionId)
    return [
      "selectionId": selectionId,
      "applicationCount": selection.applicationTokens.count,
      "categoryCount": selection.categoryTokens.count,
      "webDomainCount": selection.webDomainTokens.count,
      "selectionPolicy": isApplicationsOnly(selectionId)
        ? "applicationsOnly"
        : selectionId.hasPrefix("plan.") ? "appsAndCategories" : "mixed",
    ]
  }

  private static func isApplicationsOnly(_ selectionId: String) -> Bool {
    selectionId == "core.designated"
      || selectionId == "global.essentials"
      || selectionId == "quiet.current"
      || selectionId.hasPrefix("always.")
      || selectionId.hasPrefix("group.library.")
      || isPlanEssentials(selectionId)
      || isPlanGroup(selectionId)
      || isSingleApplication(selectionId)
  }

  private static func isPlanEssentials(_ selectionId: String) -> Bool {
    selectionId.hasPrefix("plan.") && selectionId.hasSuffix(".essentials")
  }

  private static func isPlanGroup(_ selectionId: String) -> Bool {
    selectionId.hasPrefix("plan.")
      && selectionId.contains(".group.")
      && !selectionId.contains(".app.")
  }

  private static func isSingleApplication(_ selectionId: String) -> Bool {
    selectionId.hasPrefix("plan.") && selectionId.contains(".app.")
  }

  private static func parentPlanGroupSelectionId(_ selectionId: String) -> String? {
    guard let appMarker = selectionId.range(of: ".app.", options: .backwards) else {
      return nil
    }
    let parent = String(selectionId[..<appMarker.lowerBound])
    return isPlanGroup(parent) ? parent : nil
  }

  private static func legacyIndividualSelectionId(_ selectionId: String) -> String? {
    guard
      let groupMarker = selectionId.range(of: ".group."),
      let appMarker = selectionId.range(of: ".app.", options: .backwards),
      groupMarker.lowerBound < appMarker.lowerBound
    else { return nil }
    let planPrefix = String(selectionId[..<groupMarker.lowerBound])
    let appSuffix = String(selectionId[appMarker.upperBound...])
    return "\(planPrefix).app.\(appSuffix)"
  }

  private static func normalized(
    _ source: FamilyActivitySelection,
    selectionId: String
  ) -> FamilyActivitySelection {
    if isApplicationsOnly(selectionId) {
      var result = FamilyActivitySelection(includeEntireCategory: false)
      result.applicationTokens = source.applicationTokens
      return result
    }
    if selectionId.hasPrefix("plan.") {
      var result = FamilyActivitySelection(includeEntireCategory: source.includeEntireCategory)
      result.applicationTokens = source.applicationTokens
      result.categoryTokens = source.categoryTokens
      return result
    }
    return source
  }

  private static func removeFromSiblingPlanGroups(
    _ applications: Set<ApplicationToken>,
    keeping selectionId: String
  ) -> (moved: Int, clearedRules: Int) {
    guard
      !applications.isEmpty,
      let groupMarker = selectionId.range(of: ".group.")
    else { return (0, 0) }

    let planPrefix = String(selectionId[..<groupMarker.lowerBound]) + ".group."
    let storagePrefix = key(planPrefix)
    let selectionKeyPrefix = key("")
    var moved = 0
    var clearedRules = 0

    for storedKey in AnastaFocusShared.defaults.dictionaryRepresentation().keys
      where storedKey.hasPrefix(storagePrefix) {
      let siblingId = String(storedKey.dropFirst(selectionKeyPrefix.count))
      guard siblingId != selectionId, isPlanGroup(siblingId) else { continue }
      var sibling = load(selectionId: siblingId)
      let overlap = sibling.applicationTokens.intersection(applications)
      sibling.applicationTokens.subtract(applications)
      moved += overlap.count
      save(normalized(sibling, selectionId: siblingId), selectionId: siblingId)
      clearedRules += clearChildSelectionsOutsideGroup(
        siblingId,
        allowedApplications: sibling.applicationTokens
      )
    }
    return (moved, clearedRules)
  }

  private static func clearChildSelectionsOutsideGroup(
    _ groupSelectionId: String,
    allowedApplications: Set<ApplicationToken>
  ) -> Int {
    let childPrefix = key("\(groupSelectionId).app.")
    let selectionKeyPrefix = key("")
    var cleared = 0
    for storedKey in AnastaFocusShared.defaults.dictionaryRepresentation().keys
      where storedKey.hasPrefix(childPrefix) {
      let childId = String(storedKey.dropFirst(selectionKeyPrefix.count))
      let child = load(selectionId: childId)
      if !child.applicationTokens.isSubset(of: allowedApplications) {
        AnastaFocusShared.defaults.removeObject(forKey: storedKey)
        cleared += 1
      }
    }
    return cleared
  }

  static func saveTemporary(application: ApplicationToken) -> String {
    var selection = FamilyActivitySelection()
    selection.applicationTokens = [application]
    save(selection, selectionId: "temporary.request")
    return "temporary.request"
  }

  static func saveTemporary(category: ActivityCategoryToken) -> String {
    var selection = FamilyActivitySelection()
    selection.categoryTokens = [category]
    save(selection, selectionId: "temporary.request")
    return "temporary.request"
  }

  static func saveTemporary(webDomain: WebDomainToken) -> String {
    var selection = FamilyActivitySelection()
    selection.webDomainTokens = [webDomain]
    save(selection, selectionId: "temporary.request")
    return "temporary.request"
  }
}

enum AnastaFocusEngine {
  private static let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("anasta.focus"))
  private static let center = DeviceActivityCenter()
  private static let calendar = Calendar.autoupdatingCurrent

  private static let packDomains: [String: [String]] = [
    "gambling": ["bet365.com", "stake.com", "1xbet.com", "williamhill.com", "betway.com", "pokerstars.com"],
    "adult": ["pornhub.com", "xvideos.com", "onlyfans.com", "xnxx.com", "chaturbate.com"],
    "social": ["x.com", "facebook.com", "reddit.com", "instagram.com", "tiktok.com", "threads.net"],
    "news": ["news.google.com", "cnn.com", "bbc.com", "dailymail.co.uk", "nypost.com"],
  ]

  static func apply(payloadJson: String) throws {
    guard
      let data = payloadJson.data(using: .utf8),
      let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      (payload["schemaVersion"] as? Int) == 4
    else {
      throw NSError(domain: "AnastaFocus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid Focus protection payload."])
    }

    let now = Date()
    try validatePlanSelections(payload: payload, now: now)
    AnastaFocusShared.defaults.set(payloadJson, forKey: AnastaFocusShared.payloadKey)
    snapshotReportSelections(payload: payload, now: now)
    reconcileTrackingState(payload: payload, now: now)

    do {
      try refreshQuietMonitoring(payload: payload, now: now)
    } catch {
      // A Quiet Hour without a reliable native expiry must never remain applied.
      var safePayload = payload
      safePayload["quietHour"] = NSNull()
      if
        let data = try? JSONSerialization.data(withJSONObject: safePayload),
        let json = String(data: data, encoding: .utf8)
      {
        AnastaFocusShared.defaults.set(json, forKey: AnastaFocusShared.payloadKey)
      } else {
        AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.payloadKey)
      }
      applyEffectiveProtection(payload: safePayload, now: now)
      throw error
    }

    // Prove strict expiry before any later fallback can apply Quiet Hour. A
    // plan-scheduling failure may preserve an already reliable Quiet Hour, but
    // can never create a new allowlist without an expiry monitor.
    do {
      try refreshPlanMonitoring(payload: payload, now: now)
    } catch {
      applyPersistentFallback(payload: payload, now: now)
      throw error
    }

    applyEffectiveProtection(payload: payload, now: now)
  }

  private static func validatePlanSelections(payload: [String: Any], now: Date) throws {
    let start = calendar.startOfDay(for: now)
    var missing = Set<String>()

    for offset in 0...1 {
      guard
        let day = calendar.date(byAdding: .day, value: offset, to: start),
        let plan = planForDay(payload: payload, day: day),
        let planId = plan["id"] as? String
      else { continue }
      let groupNames = plan["groupNames"] as? [String: String] ?? [:]
      let ruleSets: [[[String: Any]]]
      if (plan["kind"] as? String) == "session" {
        ruleSets = (plan["sessions"] as? [[String: Any]] ?? []).map {
          $0["rules"] as? [[String: Any]] ?? []
        }
      } else {
        ruleSets = [plan["dailyRules"] as? [[String: Any]] ?? []]
      }

      for rules in ruleSets {
        for rule in rules {
          let groupId = rule["groupId"] as? String ?? "group"
          let mode = rule["mode"] as? String ?? "noLimit"
          let appRules = rule["appRules"] as? [[String: Any]] ?? []
          let activeApps = appRules.filter { appRule in
            let appMode = appRule["mode"] as? String ?? "noLimit"
            return appMode == "blocked"
              || (appMode == "limit" && (appRule["minutes"] as? Int ?? 0) > 0)
          }
          let groupHasBoundary = mode == "blocked"
            || (mode == "limit" && (rule["dailyMinutes"] as? Int ?? 0) > 0)
          if groupHasBoundary || !activeApps.isEmpty {
            let groupSelection = AnastaSelectionStore.load(
              selectionId: "plan.\(planId).group.\(groupId)"
            )
            if groupSelection.applicationTokens.isEmpty {
              missing.insert("\(groupNames[groupId] ?? groupId) group")
            }
          }
          for appRule in activeApps {
            let appId = appRule["appId"] as? String ?? "app"
            let appSelection = AnastaSelectionStore.load(
              selectionId: "plan.\(planId).group.\(groupId).app.\(appId)"
            )
            if appSelection.applicationTokens.count != 1 {
              if let label = appRule["label"] as? String, !label.isEmpty {
                missing.insert(label)
              } else {
                missing.insert("individual app rule")
              }
            }
          }
        }
      }
    }

    guard missing.isEmpty else {
      let names = missing.sorted().prefix(3).joined(separator: ", ")
      let remainder = missing.count > 3 ? " and \(missing.count - 3) more" : ""
      throw NSError(
        domain: "AnastaFocus",
        code: 6,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Choose real iPhone apps for \(names)\(remainder) before this Screen Time plan can protect the device."
        ]
      )
    }
  }

  static func runtimeStatus(now: Date = Date()) -> [String: Any] {
    let hardWallReached = AnastaFocusShared.defaults.bool(
      forKey: AnastaFocusShared.dailyHardWallKey
    )
    let context = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.dailyHardWallContextKey
    ) ?? ""
    let contextDay = context.split(separator: "|").first.map(String.init) ?? ""
    let today = localDayKey(now)
    let quietHourActive = AnastaFocusShared.payload().map {
      activeQuietHour(payload: $0, now: now) != nil
    } ?? false
    let quietHourMonitored = center.activities.contains {
      $0.rawValue.hasPrefix("anasta.quiet-hour.")
    }
    return [
      "hardWallReached": hardWallReached && contextDay == today,
      "hardWallDate": hardWallReached && contextDay == today ? today : NSNull(),
      "webDomainsApplied": AnastaFocusShared.defaults.integer(
        forKey: AnastaFocusShared.appliedWebDomainCountKey
      ),
      "webDomainsOmitted": AnastaFocusShared.defaults.integer(
        forKey: AnastaFocusShared.omittedWebDomainCountKey
      ),
      "adultFilterActive": AnastaFocusShared.defaults.bool(
        forKey: AnastaFocusShared.adultFilterActiveKey
      ),
      "quietHourActive": quietHourActive && quietHourMonitored,
      "targetArmedDays": AnastaFocusShared.defaults.dictionary(
        forKey: AnastaFocusShared.targetArmedDaysKey
      ) as? [String: String] ?? [:],
      "targetLostDays": AnastaFocusShared.defaults.dictionary(
        forKey: AnastaFocusShared.targetLostDaysKey
      ) as? [String: String] ?? [:],
    ]
  }

  static func clearAll() {
    stopOwnedMonitoring()
    store.clearAllSettings()
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.payloadKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.eventMapKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedSelectionsKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedMetadataKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedScopeKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.dailyHardWallKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.dailyHardWallContextKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.activeRuleFingerprintKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.activeRuleScopeFingerprintKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.planMonitoringFingerprintKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.planMonitoringRevisionKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.quietMonitoringFingerprintKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.temporaryAccessKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.pendingInterventionKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.nativeEventQueueKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.deliveredEventKeysKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.appliedWebDomainCountKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.omittedWebDomainCountKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.adultFilterActiveKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.targetArmedDaysKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.targetLostDaysKey)
  }

  static func grantTemporaryAccess(
    selectionId: String,
    sourceSelectionId: String,
    sourceKind: String,
    sourceMinutes: Int,
    minutes: Int
  ) throws {
    let now = Date()
    let grantedMinutes = max(15, min(minutes, 60))
    let end = now.addingTimeInterval(TimeInterval(grantedMinutes * 60))

    guard AnastaFocusShared.payload() != nil else {
      throw NSError(
        domain: "AnastaFocus",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "This protection is no longer active."]
      )
    }
    let requestedSelection = AnastaSelectionStore.load(selectionId: selectionId)
    let applicationAllowed = requestedSelection.applicationTokens.contains { token in
      temporaryContextAllows(
        context: interventionContext(for: token),
        sourceSelectionId: sourceSelectionId,
        sourceKind: sourceKind,
        sourceMinutes: sourceMinutes
      )
    }
    let categoryAllowed = requestedSelection.categoryTokens.contains { token in
      temporaryContextAllows(
        context: interventionContext(for: token),
        sourceSelectionId: sourceSelectionId,
        sourceKind: sourceKind,
        sourceMinutes: sourceMinutes
      )
    }
    let webDomainAllowed = requestedSelection.webDomainTokens.contains { token in
      temporaryContextAllows(
        context: interventionContext(for: token),
        sourceSelectionId: sourceSelectionId,
        sourceKind: sourceKind,
        sourceMinutes: sourceMinutes
      )
    }
    guard applicationAllowed || categoryAllowed || webDomainAllowed else {
      throw NSError(
        domain: "AnastaFocus",
        code: 5,
        userInfo: [NSLocalizedDescriptionKey: "The active protection changed. Return to the blocked app and try again."]
      )
    }

    let existingTemporary = center.activities.filter {
      $0.rawValue.hasPrefix("anasta.temporary-access")
    }
    if !existingTemporary.isEmpty { center.stopMonitoring(existingTemporary) }
    let name = DeviceActivityName("anasta.temporary-access.\(Int(end.timeIntervalSince1970 * 1000))")
    let schedule = DeviceActivitySchedule(
      intervalStart: dateComponents(now),
      intervalEnd: dateComponents(end),
      repeats: false
    )
    do {
      try center.startMonitoring(name, during: schedule)
      AnastaFocusShared.defaults.set(
        [
          "selectionId": selectionId,
          "sourceSelectionId": sourceSelectionId,
          "sourceKind": sourceKind,
          "sourceMinutes": sourceMinutes,
          "endsAt": end.timeIntervalSince1970 * 1000,
          "activity": name.rawValue,
        ],
        forKey: AnastaFocusShared.temporaryAccessKey
      )
      if let payload = AnastaFocusShared.payload() {
        applyEffectiveProtection(payload: payload, now: now)
      }
    } catch {
      AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.temporaryAccessKey)
      applyStoredProtection(now: now)
      throw error
    }
  }

  static func applyStoredProtection(now: Date = Date()) {
    guard let payload = AnastaFocusShared.payload() else {
      store.clearAllSettings()
      return
    }
    applyEffectiveProtection(payload: payload, now: now)
  }

  static func scheduleStoredRollingWindow(now: Date = Date()) {
    guard let payload = AnastaFocusShared.payload() else { return }
    snapshotReportSelections(payload: payload, now: now)
    reconcileTrackingState(payload: payload, now: now)
    try? refreshPlanMonitoring(payload: payload, now: now)
    try? refreshQuietMonitoring(payload: payload, now: now)
  }

  static func selectionDidChange(selectionId: String, now: Date = Date()) {
    guard let payload = AnastaFocusShared.payload() else { return }
    snapshotReportSelections(payload: payload, now: now)
    if selectionId.hasPrefix("plan.") {
      do {
        try refreshPlanMonitoring(payload: payload, now: now, forceRebuild: true)
      } catch {
        applyPersistentFallback(payload: payload, now: now)
        return
      }
    }
    applyEffectiveProtection(payload: payload, now: now)
  }

  static func beginRuleScope(_ activity: DeviceActivityName) {
    guard isRuleActivity(activity), isCurrentPlanActivity(activity) else { return }
    let current = AnastaFocusShared.defaults.string(forKey: AnastaFocusShared.reachedScopeKey)
    guard current != activity.rawValue else { return }
    let sameLogicalScope = current.map(logicalRuleScope) == logicalRuleScope(activity.rawValue)
    if !sameLogicalScope {
      AnastaFocusShared.defaults.set([], forKey: AnastaFocusShared.reachedSelectionsKey)
      AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedMetadataKey)
    }
    AnastaFocusShared.defaults.set(activity.rawValue, forKey: AnastaFocusShared.reachedScopeKey)
  }

  static func endRuleScope(_ activity: DeviceActivityName) {
    guard isCurrentPlanActivity(activity) else { return }
    guard AnastaFocusShared.defaults.string(forKey: AnastaFocusShared.reachedScopeKey) == activity.rawValue else { return }
    clearReachedRuleState()
  }

  static func recordReachedSelection(
    _ selectionId: String,
    activity: DeviceActivityName,
    metadata: [String: Any]
  ) {
    guard isCurrentPlanActivity(activity) else { return }
    beginRuleScope(activity)
    var reached = AnastaFocusShared.defaults.stringArray(forKey: AnastaFocusShared.reachedSelectionsKey) ?? []
    if !reached.contains(selectionId) { reached.append(selectionId) }
    AnastaFocusShared.defaults.set(reached, forKey: AnastaFocusShared.reachedSelectionsKey)
    var reachedMetadata = AnastaFocusShared.defaults.dictionary(
      forKey: AnastaFocusShared.reachedMetadataKey
    ) ?? [:]
    reachedMetadata[selectionId] = metadata
    AnastaFocusShared.defaults.set(reachedMetadata, forKey: AnastaFocusShared.reachedMetadataKey)
  }

  static func interventionContext(for token: ApplicationToken) -> [String: Any] {
    resolveInterventionContext(
      protectsByAllowlist: true,
      fallbackKind: "limit",
      matches: { $0.applicationTokens.contains(token) }
    )
  }

  static func interventionContext(for token: ActivityCategoryToken) -> [String: Any] {
    resolveInterventionContext(
      protectsByAllowlist: true,
      fallbackKind: "limit",
      matches: { $0.categoryTokens.contains(token) }
    )
  }

  static func interventionContext(for token: WebDomainToken) -> [String: Any] {
    resolveInterventionContext(
      protectsByAllowlist: false,
      fallbackKind: "web",
      matches: { $0.webDomainTokens.contains(token) }
    )
  }

  private static func stopOwnedMonitoring(includeTemporaryAccess: Bool = true) {
    let owned = center.activities.filter {
      $0.rawValue.hasPrefix("anasta.")
        && (includeTemporaryAccess || !$0.rawValue.hasPrefix("anasta.temporary-access"))
    }
    if !owned.isEmpty { center.stopMonitoring(owned) }
  }

  private static func stopPlanMonitoring() {
    let activities = center.activities.filter {
      $0.rawValue.hasPrefix("anasta.")
        && !$0.rawValue.hasPrefix("anasta.quiet-hour.")
        && !$0.rawValue.hasPrefix("anasta.temporary-access")
    }
    if !activities.isEmpty { center.stopMonitoring(activities) }
  }

  private static func stopQuietMonitoring() {
    let activities = center.activities.filter { $0.rawValue.hasPrefix("anasta.quiet-hour.") }
    if !activities.isEmpty { center.stopMonitoring(activities) }
  }

  private static func pruneExpiredMonitoring(now: Date) {
    let expired = center.activities.filter { activity in
      guard
        activity.rawValue.hasPrefix("anasta."),
        let schedule = center.schedule(for: activity),
        let end = calendar.date(from: schedule.intervalEnd)
      else { return false }
      return end <= now
    }
    if !expired.isEmpty { center.stopMonitoring(expired) }
  }

  private static func reconcileTrackingState(payload: [String: Any], now: Date) {
    let plan = planForDay(payload: payload, day: now)
    let planId = plan?["id"] as? String ?? "none"
    let kind = plan?["kind"] as? String ?? "none"
    let session = plan.flatMap { activeSession(plan: $0, now: now) }
    let scopeFingerprint = stableFingerprint([
      "day": localDayKey(now),
      "planId": planId,
      "kind": kind,
      "sessionId": session?["id"] as? String ?? (kind == "daily" ? "daily" : "none"),
    ])
    let ruleFingerprint = stableFingerprint([
      "scope": scopeFingerprint,
      "rules": plan.map { activeRules(plan: $0, now: now) } ?? [],
    ])
    let storedScopeFingerprint = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.activeRuleScopeFingerprintKey
    )
    let storedRuleFingerprint = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.activeRuleFingerprintKey
    )
    if storedScopeFingerprint != scopeFingerprint {
      clearReachedRuleState()
      AnastaFocusShared.defaults.set(
        scopeFingerprint,
        forKey: AnastaFocusShared.activeRuleScopeFingerprintKey
      )
    } else if storedRuleFingerprint != ruleFingerprint {
      reconcileReachedRuleState(plan: plan, planId: planId, now: now)
    }
    if storedRuleFingerprint != ruleFingerprint {
      AnastaFocusShared.defaults.set(ruleFingerprint, forKey: AnastaFocusShared.activeRuleFingerprintKey)
    }

    let hardContext = localDayKey(now)
    let storedHardContext = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.dailyHardWallContextKey
    )
    let storedHardDay = storedHardContext?.split(separator: "|").first.map(String.init)
    if storedHardDay != hardContext {
      AnastaFocusShared.defaults.set(false, forKey: AnastaFocusShared.dailyHardWallKey)
      AnastaFocusShared.defaults.set(hardContext, forKey: AnastaFocusShared.dailyHardWallContextKey)
    }
  }

  private static func reconcileReachedRuleState(
    plan: [String: Any]?,
    planId: String,
    now: Date
  ) {
    guard let plan else {
      clearReachedRuleState()
      return
    }

    var currentRules: [String: [String: Any]] = [:]
    for rule in activeRules(plan: plan, now: now) {
      let groupId = rule["groupId"] as? String ?? "group"
      currentRules["plan.\(planId).group.\(groupId)"] = rule
      for appRule in rule["appRules"] as? [[String: Any]] ?? [] {
        let appId = appRule["appId"] as? String ?? "app"
        currentRules["plan.\(planId).group.\(groupId).app.\(appId)"] = appRule
      }
    }

    let reached = AnastaFocusShared.defaults.stringArray(
      forKey: AnastaFocusShared.reachedSelectionsKey
    ) ?? []
    let metadata = AnastaFocusShared.defaults.dictionary(
      forKey: AnastaFocusShared.reachedMetadataKey
    ) ?? [:]
    var keptSelections: [String] = []
    var keptMetadata: [String: [String: Any]] = [:]

    for selectionId in reached {
      guard
        let current = currentRules[selectionId],
        var previous = metadata[selectionId] as? [String: Any]
      else { continue }
      let mode = current["mode"] as? String ?? "noLimit"
      guard mode == "limit" else { continue }

      let previousKind = previous["kind"] as? String ?? "limit"
      let previousMinutes = previous["minutes"] as? Int ?? 0
      let currentMinutes = (current["dailyMinutes"] as? Int)
        ?? (current["minutes"] as? Int)
        ?? 0
      let remainsReached: Bool
      if previousKind == "checkin" {
        let currentCheckIn = current["checkInMinutes"] as? Int ?? 0
        remainsReached = currentCheckIn > 0 && currentCheckIn <= previousMinutes
      } else {
        // Family Controls does not expose exact foreground usage to the host
        // app. Once this boundary has fired in the active Session, increasing
        // it cannot safely reconstruct only the remaining minutes. Keep the
        // wall until the next Session. No Limit is still an explicit removal.
        remainsReached = currentMinutes > 0
      }
      guard remainsReached else { continue }

      previous["strength"] = previousKind == "checkin"
        ? "loose"
        : current["strength"] as? String ?? "loose"
      previous["practice"] = current["practice"] as? String ?? "prayer"
      keptSelections.append(selectionId)
      keptMetadata[selectionId] = previous
    }

    AnastaFocusShared.defaults.set(keptSelections, forKey: AnastaFocusShared.reachedSelectionsKey)
    AnastaFocusShared.defaults.set(keptMetadata, forKey: AnastaFocusShared.reachedMetadataKey)
  }

  private static func clearReachedRuleState() {
    AnastaFocusShared.defaults.set([], forKey: AnastaFocusShared.reachedSelectionsKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedMetadataKey)
    AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.reachedScopeKey)
  }

  private static func stableFingerprint(_ value: Any) -> String {
    guard
      JSONSerialization.isValidJSONObject(value),
      let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
      let string = String(data: data, encoding: .utf8)
    else { return String(describing: value) }
    return string
  }

  private static func encodedTokens<T: Encodable & Hashable>(_ values: Set<T>) -> [String] {
    values.compactMap { value in
      try? JSONEncoder().encode(value).base64EncodedString()
    }.sorted()
  }

  private static func compactFingerprint(_ value: String) -> String {
    var hash: UInt64 = 14_695_981_039_346_656_037
    for byte in value.utf8 {
      hash ^= UInt64(byte)
      hash &*= 1_099_511_628_211
    }
    return String(hash, radix: 16)
  }

  private static func snapshotReportSelections(payload: [String: Any], now: Date) {
    var dayScopes = AnastaFocusShared.defaults.dictionary(
      forKey: AnastaFocusShared.reportSelectionScopesKey
    ) as? [String: String] ?? [:]
    let start = calendar.startOfDay(for: now)

    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: start) else { continue }
      let dayKey = localDayKey(day)
      guard
        let plan = planForDay(payload: payload, day: day),
        let planId = plan["id"] as? String,
        let catalog = plan["groupCatalog"] as? [String: Any]
      else {
        dayScopes.removeValue(forKey: dayKey)
        continue
      }

      let groupIds = catalog.keys.sorted()
      let dailyRules = plan["dailyRules"] as? [[String: Any]] ?? []
      let sessionRules = (plan["sessions"] as? [[String: Any]] ?? []).flatMap { session in
        session["rules"] as? [[String: Any]] ?? []
      }
      let appRulePairs: [(groupId: String, appId: String)] = (dailyRules + sessionRules).flatMap { rule in
        guard let groupId = rule["groupId"] as? String else { return [] }
        return (rule["appRules"] as? [[String: Any]] ?? []).compactMap { appRule in
          guard let appId = appRule["appId"] as? String else { return nil }
          return (groupId: groupId, appId: appId)
        }
      }
      let fingerprintGroups: [[String: Any]] = groupIds.map { groupId in
        let selection = AnastaSelectionStore.load(
          selectionId: "plan.\(planId).group.\(groupId)"
        )
        let appSelections = appRulePairs
          .filter { $0.groupId == groupId }
          .map { pair -> [String: Any] in
            let appSelection = AnastaSelectionStore.load(
              selectionId: "plan.\(planId).group.\(groupId).app.\(pair.appId)"
            )
            return [
              "appId": pair.appId,
              "applications": encodedTokens(appSelection.applicationTokens),
            ]
          }
        return [
          "groupId": groupId,
          "applications": encodedTokens(selection.applicationTokens),
          "categories": encodedTokens(selection.categoryTokens),
          "webDomains": encodedTokens(selection.webDomainTokens),
          "appSelections": appSelections,
        ]
      }
      let scope = "\(planId)-\(compactFingerprint(stableFingerprint(fingerprintGroups)))"
      for groupId in groupIds {
        let selection = AnastaSelectionStore.load(
          selectionId: "plan.\(planId).group.\(groupId)"
        )
        AnastaSelectionStore.save(
          selection,
          selectionId: "report.\(scope).group.\(groupId)"
        )
      }
      for pair in appRulePairs {
        let selection = AnastaSelectionStore.load(
          selectionId: "plan.\(planId).group.\(pair.groupId).app.\(pair.appId)"
        )
        AnastaSelectionStore.save(
          selection,
          selectionId: "report.\(scope).group.\(pair.groupId).app.\(pair.appId)"
        )
      }
      dayScopes[dayKey] = scope
    }

    let retainedDays = dayScopes.keys.sorted().suffix(400)
    dayScopes = Dictionary(uniqueKeysWithValues: retainedDays.compactMap { key in
      dayScopes[key].map { (key, $0) }
    })
    AnastaSelectionStore.clearReportSelections(exceptScopes: Set(dayScopes.values))
    AnastaFocusShared.defaults.set(
      dayScopes,
      forKey: AnastaFocusShared.reportSelectionScopesKey
    )
  }

  private static func planMonitoringFingerprint(payload: [String: Any], now: Date) -> String {
    let start = calendar.startOfDay(for: now)
    var days: [[String: Any]] = []
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: start) else { continue }
      var entry: [String: Any] = ["day": localDayKey(day)]
      if let plan = planForDay(payload: payload, day: day) {
        entry["plan"] = plan
      } else {
        entry["plan"] = NSNull()
      }
      days.append(entry)
    }
    return stableFingerprint([
      "timezone": payload["timezone"] as? String ?? TimeZone.current.identifier,
      "days": days,
    ])
  }

  private static func quietMonitoringFingerprint(payload: [String: Any]) -> String {
    guard let quiet = payload["quietHour"] as? [String: Any] else { return "none" }
    return stableFingerprint([
      "startsAt": quiet["startsAt"] as? Double ?? 0,
      "endsAt": quiet["endsAt"] as? Double ?? 0,
    ])
  }

  private static func refreshPlanMonitoring(
    payload: [String: Any],
    now: Date,
    forceRebuild: Bool = false
  ) throws {
    pruneExpiredMonitoring(now: now)
    let fingerprint = planMonitoringFingerprint(payload: payload, now: now)
    let stored = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.planMonitoringFingerprintKey
    )
    let rebuild = forceRebuild || stored != fingerprint
    var revision = AnastaFocusShared.defaults.integer(
      forKey: AnastaFocusShared.planMonitoringRevisionKey
    )
    if rebuild {
      revision += 1
      AnastaFocusShared.defaults.set(
        revision,
        forKey: AnastaFocusShared.planMonitoringRevisionKey
      )
      stopPlanMonitoring()
    }

    do {
      try scheduleRollingWindow(
        payload: payload,
        from: now,
        revision: revision,
        skipExisting: !rebuild
      )
      AnastaFocusShared.defaults.set(
        fingerprint,
        forKey: AnastaFocusShared.planMonitoringFingerprintKey
      )
      updateTargetArmedDays(payload: payload, now: now, armed: true)
    } catch {
      stopPlanMonitoring()
      updateTargetArmedDays(payload: payload, now: now, armed: false)
      AnastaFocusShared.defaults.removeObject(
        forKey: AnastaFocusShared.planMonitoringFingerprintKey
      )
      throw error
    }
  }

  private static func updateTargetArmedDays(
    payload: [String: Any],
    now: Date,
    armed: Bool
  ) {
    var values = AnastaFocusShared.defaults.dictionary(
      forKey: AnastaFocusShared.targetArmedDaysKey
    ) as? [String: String] ?? [:]
    let start = calendar.startOfDay(for: now)
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: start) else { continue }
      let key = localDayKey(day)
      guard
        armed,
        let plan = planForDay(payload: payload, day: day),
        let planId = plan["id"] as? String,
        (plan["targetMinutes"] as? Int ?? 0) > 0
      else {
        values.removeValue(forKey: key)
        continue
      }
      values[key] = planId
    }
    let retained = values.keys.sorted().suffix(400)
    let compact = Dictionary(uniqueKeysWithValues: retained.compactMap { key in
      values[key].map { (key, $0) }
    })
    AnastaFocusShared.defaults.set(compact, forKey: AnastaFocusShared.targetArmedDaysKey)
  }

  private static func refreshQuietMonitoring(payload: [String: Any], now: Date) throws {
    pruneExpiredMonitoring(now: now)
    let fingerprint = quietMonitoringFingerprint(payload: payload)
    let stored = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.quietMonitoringFingerprintKey
    )
    let rebuild = stored != fingerprint
    if rebuild { stopQuietMonitoring() }

    do {
      try scheduleQuietHour(payload: payload, now: now, skipExisting: !rebuild)
      AnastaFocusShared.defaults.set(
        fingerprint,
        forKey: AnastaFocusShared.quietMonitoringFingerprintKey
      )
    } catch {
      stopQuietMonitoring()
      AnastaFocusShared.defaults.removeObject(
        forKey: AnastaFocusShared.quietMonitoringFingerprintKey
      )
      throw error
    }
  }

  private static func isRuleActivity(_ activity: DeviceActivityName) -> Bool {
    activity.rawValue.hasPrefix("anasta.")
      && !activity.rawValue.hasPrefix("anasta.temporary-access")
      && !activity.rawValue.hasPrefix("anasta.quiet-hour.")
      && !activity.rawValue.contains(".daily-observations")
      && !activity.rawValue.contains(".rollover.")
  }

  static func isCurrentPlanActivity(_ activity: DeviceActivityName) -> Bool {
    guard
      activity.rawValue.hasPrefix("anasta."),
      !activity.rawValue.hasPrefix("anasta.quiet-hour."),
      !activity.rawValue.hasPrefix("anasta.temporary-access"),
      let revision = planRevision(activity.rawValue)
    else { return false }
    return revision == AnastaFocusShared.defaults.integer(
      forKey: AnastaFocusShared.planMonitoringRevisionKey
    )
  }

  private static func planRevision(_ rawValue: String) -> Int? {
    guard let marker = rawValue.range(of: ".r", options: .backwards) else { return nil }
    return Int(rawValue[marker.upperBound...])
  }

  private static func logicalRuleScope(_ rawValue: String) -> String {
    let withoutRevision: String
    if let marker = rawValue.range(of: ".r", options: .backwards) {
      withoutRevision = String(rawValue[..<marker.lowerBound])
    } else {
      withoutRevision = rawValue
    }
    if withoutRevision.hasSuffix(".early") {
      return String(withoutRevision.dropLast(".early".count))
    }
    if withoutRevision.hasSuffix(".late") {
      return String(withoutRevision.dropLast(".late".count))
    }
    return withoutRevision
  }

  private static func scheduleQuietHour(
    payload: [String: Any],
    now: Date,
    skipExisting: Bool
  ) throws {
    guard let quiet = payload["quietHour"] as? [String: Any] else { return }
    let startsAt = quiet["startsAt"] as? Double ?? now.timeIntervalSince1970 * 1000
    let endsAt = quiet["endsAt"] as? Double ?? 0
    guard endsAt > now.timeIntervalSince1970 * 1000 else { return }

    let configuredStart = Date(timeIntervalSince1970: startsAt / 1000)
    let end = Date(timeIntervalSince1970: endsAt / 1000)
    let name = DeviceActivityName("anasta.quiet-hour.\(Int(endsAt))")
    if skipExisting && center.activities.contains(name) { return }

    // Use the original start so an exact 15-minute Quiet Hour does not become
    // 14:59 while the React state crosses the native bridge.
    let start = configuredStart
    guard end.timeIntervalSince(start) >= 15 * 60 else {
      throw DeviceActivityCenter.MonitoringError.intervalTooShort
    }

    let schedule = DeviceActivitySchedule(
      intervalStart: dateComponents(start),
      intervalEnd: dateComponents(end),
      repeats: false
    )
    try center.startMonitoring(name, during: schedule)
  }

  private static func scheduleRollingWindow(
    payload: [String: Any],
    from now: Date,
    revision: Int,
    skipExisting: Bool
  ) throws {
    var eventMap: [String: [String: Any]] = [:]
    let existingActivities = Set(center.activities)
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) else { continue }
      try scheduleRollover(
        day: day,
        revision: revision,
        existingActivities: existingActivities,
        skipExisting: skipExisting
      )
      guard let plan = planForDay(payload: payload, day: day) else { continue }
      let planId = plan["id"] as? String ?? "plan"
      let kind = plan["kind"] as? String ?? "daily"
      try scheduleDailyObservations(
        day: day,
        planId: planId,
        revision: revision,
        targetMinutes: plan["targetMinutes"] as? Int,
        essentialOnlyMinutes: plan["essentialOnlyMinutes"] as? Int,
        existingActivities: existingActivities,
        skipExisting: skipExisting,
        eventMap: &eventMap
      )
      if kind == "session", let sessions = plan["sessions"] as? [[String: Any]], !sessions.isEmpty {
        for session in sessions {
          try schedule(
            day: day,
            notBefore: now,
            planId: planId,
            revision: revision,
            session: session,
            existingActivities: existingActivities,
            skipExisting: skipExisting,
            eventMap: &eventMap
          )
        }
      } else {
        let session: [String: Any] = [
          "id": "daily",
          "name": "Daily Plan",
          "startMinutes": 0,
          "endMinutes": 0,
          "rules": plan["dailyRules"] as? [[String: Any]] ?? [],
        ]
        try schedule(
          day: day,
          notBefore: now,
          planId: planId,
          revision: revision,
          session: session,
          existingActivities: existingActivities,
          skipExisting: skipExisting,
          eventMap: &eventMap
        )
      }
    }
    AnastaFocusShared.defaults.set(eventMap, forKey: AnastaFocusShared.eventMapKey)
  }

  private static func scheduleRollover(
    day: Date,
    revision: Int,
    existingActivities: Set<DeviceActivityName>,
    skipExisting: Bool
  ) throws {
    let nextDay = calendar.date(byAdding: .day, value: 1, to: day) ?? day
    let activityName = DeviceActivityName(
      "anasta.\(dateStamp(day)).rollover.r\(revision)"
    )
    if skipExisting && existingActivities.contains(activityName) { return }
    let schedule = DeviceActivitySchedule(
      intervalStart: dateComponents(day),
      intervalEnd: dateComponents(nextDay),
      repeats: false
    )
    try center.startMonitoring(activityName, during: schedule)
  }

  private static func schedule(
    day: Date,
    notBefore: Date,
    planId: String,
    revision: Int,
    session: [String: Any],
    existingActivities: Set<DeviceActivityName>,
    skipExisting: Bool,
    eventMap: inout [String: [String: Any]]
  ) throws {
    let sessionId = session["id"] as? String ?? "session"
    let startMinutes = session["startMinutes"] as? Int ?? 0
    let endMinutes = session["endMinutes"] as? Int ?? 0

    let nextDay = calendar.date(byAdding: .day, value: 1, to: day) ?? day
    let parts: [(suffix: String?, start: Date, end: Date)]
    if startMinutes == endMinutes {
      parts = [(nil, day, nextDay)]
    } else if endMinutes > startMinutes {
      parts = [(nil, date(day: day, minutes: startMinutes), date(day: day, minutes: endMinutes))]
    } else {
      parts = [
        ("early", day, date(day: day, minutes: endMinutes)),
        ("late", date(day: day, minutes: startMinutes), nextDay),
      ]
    }

    for part in parts where part.end > part.start && part.end > notBefore {
      var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
      // Apple rounds backward to the nearest full hour when this is true for a
      // non-round start. Preserve elapsed use on exact-hour rebuilds without
      // charging a 09:30 Session for activity from 09:00-09:30.
      let includesPastActivity = calendar.component(.minute, from: part.start) == 0
      for rule in session["rules"] as? [[String: Any]] ?? [] {
        let groupId = rule["groupId"] as? String ?? "group"
        let selectionId = "plan.\(planId).group.\(groupId)"
        addEvents(
          rule: rule,
          selectionId: selectionId,
          sessionId: sessionId,
          dayKey: localDayKey(day),
          planId: planId,
          prefix: "\(sessionId)|group",
          includesPastActivity: includesPastActivity,
          events: &events,
          eventMap: &eventMap
        )
        for appRule in rule["appRules"] as? [[String: Any]] ?? [] {
          let appId = appRule["appId"] as? String ?? "app"
          addEvents(
            rule: appRule,
            selectionId: "plan.\(planId).group.\(groupId).app.\(appId)",
            sessionId: sessionId,
            dayKey: localDayKey(day),
            planId: planId,
            prefix: "\(sessionId)|app",
            includesPastActivity: includesPastActivity,
            events: &events,
            eventMap: &eventMap
          )
        }
      }
      let suffix = part.suffix.map { ".\($0)" } ?? ""
      let activityName = DeviceActivityName(
        "anasta.\(dateStamp(day)).\(planId).\(sessionId)\(suffix).r\(revision)"
      )
      if skipExisting && existingActivities.contains(activityName) { continue }
      let schedule = DeviceActivitySchedule(
        intervalStart: dateComponents(part.start),
        intervalEnd: dateComponents(part.end),
        repeats: false
      )
      try center.startMonitoring(activityName, during: schedule, events: events)
    }
  }

  private static func scheduleDailyObservations(
    day: Date,
    planId: String,
    revision: Int,
    targetMinutes: Int?,
    essentialOnlyMinutes: Int?,
    existingActivities: Set<DeviceActivityName>,
    skipExisting: Bool,
    eventMap: inout [String: [String: Any]]
  ) throws {
    guard (targetMinutes ?? 0) > 0 || (essentialOnlyMinutes ?? 0) > 0 else { return }
    let nextDay = calendar.date(byAdding: .day, value: 1, to: day) ?? day
    let activityName = DeviceActivityName(
      "anasta.\(dateStamp(day)).\(planId).daily-observations.r\(revision)"
    )
    var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
    if let targetMinutes, targetMinutes > 0 {
      let rawName = "daily-target|\(dateStamp(day))|\(planId)|\(targetMinutes)"
      events[DeviceActivityEvent.Name(rawName)] = DeviceActivityEvent(
        // The trophy is kept at exactly the configured target and lost only
        // after it is crossed. App/group walls intentionally fire at equality.
        threshold: DateComponents(minute: targetMinutes, second: 1),
        includesPastActivity: true
      )
      eventMap[rawName] = [
        "kind": "daily-target",
        "day": localDayKey(day),
        "planId": planId,
        "selectionId": "",
        "strength": "strict",
        "minutes": targetMinutes,
      ]
    }
    if let essentialOnlyMinutes, essentialOnlyMinutes > 0 {
      let rawName = "daily-hard|\(dateStamp(day))|\(planId)|\(essentialOnlyMinutes)|strict"
      events[DeviceActivityEvent.Name(rawName)] = DeviceActivityEvent(
        threshold: DateComponents(minute: essentialOnlyMinutes),
        includesPastActivity: true
      )
      eventMap[rawName] = [
        "kind": "daily-hard",
        "day": localDayKey(day),
        "planId": planId,
        "selectionId": "",
        "strength": "strict",
        "minutes": essentialOnlyMinutes,
      ]
    }
    if skipExisting && existingActivities.contains(activityName) { return }
    let schedule = DeviceActivitySchedule(
      intervalStart: dateComponents(day),
      intervalEnd: dateComponents(nextDay),
      repeats: false
    )
    try center.startMonitoring(activityName, during: schedule, events: events)
  }

  private static func addEvents(
    rule: [String: Any],
    selectionId: String,
    sessionId: String,
    dayKey: String,
    planId: String,
    prefix: String,
    includesPastActivity: Bool,
    events: inout [DeviceActivityEvent.Name: DeviceActivityEvent],
    eventMap: inout [String: [String: Any]]
  ) {
    let mode = rule["mode"] as? String ?? ((rule["dailyMinutes"] ?? rule["minutes"]) is NSNull ? "noLimit" : "limit")
    guard mode == "limit" else { return }
    let minutes = (rule["dailyMinutes"] as? Int) ?? (rule["minutes"] as? Int)
    guard let minutes, minutes > 0 else { return }
    let selection = AnastaSelectionStore.load(selectionId: selectionId)
    guard !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty else { return }
    let strength = rule["strength"] as? String ?? "loose"
    let practice = rule["practice"] as? String ?? "prayer"
    let label = rule["label"] as? String ?? ""
    let finalName = "limit|\(prefix)|\(selectionId)|\(minutes)|\(strength)|\(practice)"
    events[DeviceActivityEvent.Name(finalName)] = DeviceActivityEvent(
      applications: selection.applicationTokens,
      categories: selection.categoryTokens,
      webDomains: selection.webDomainTokens,
      threshold: DateComponents(minute: minutes),
      includesPastActivity: includesPastActivity
    )
    eventMap[finalName] = [
      "kind": "limit",
      "day": dayKey,
      "planId": planId,
      "selectionId": selectionId,
      "sessionId": sessionId,
      "strength": strength,
      "minutes": minutes,
      "practice": practice,
      "label": label,
    ]

    if let checkIn = rule["checkInMinutes"] as? Int, checkIn > 0, checkIn < minutes {
      for threshold in stride(from: checkIn, to: minutes, by: checkIn) {
        let checkName = "checkin|\(prefix)|\(selectionId)|\(threshold)|\(practice)"
        events[DeviceActivityEvent.Name(checkName)] = DeviceActivityEvent(
          applications: selection.applicationTokens,
          categories: selection.categoryTokens,
          webDomains: selection.webDomainTokens,
          threshold: DateComponents(minute: threshold),
          includesPastActivity: includesPastActivity
        )
        eventMap[checkName] = [
          "kind": "checkin",
          "day": dayKey,
          "planId": planId,
          "selectionId": selectionId,
          "sessionId": sessionId,
          "strength": "loose",
          "minutes": threshold,
          "practice": practice,
          "label": label,
        ]
      }
    }
  }

  private static func applyPersistentFallback(payload: [String: Any], now: Date) {
    // Scheduling may fail, but direct Blocked rules and already-reached walls
    // are still enforceable through Managed Settings. Preserve every layer we
    // can while the host reports that future thresholds are not fully armed.
    applyEffectiveProtection(payload: payload, now: now)
  }

  private static func applyEffectiveProtection(
    payload: [String: Any],
    now: Date,
    includeQuiet: Bool = true
  ) {
    store.clearAllSettings()
    applyWebProtection(payload: payload)

    let plan = planForDay(payload: payload, day: now)
    let planId = plan?["id"] as? String ?? "plan"
    let temporary = activeTemporaryAccess(now: now)
    let temporarySelectionId = temporary?["selectionId"] as? String
    let temporarySourceId = temporary?["sourceSelectionId"] as? String
    let temporarySourceKind = temporary?["sourceKind"] as? String ?? ""
    let temporarySourceMinutes = temporary?["sourceMinutes"] as? Int ?? -1
    let rawTemporarySelection = temporarySelectionId.map {
      AnastaSelectionStore.load(selectionId: $0)
    }
    var temporaryApplications = Set<ApplicationToken>()
    var temporaryCategories = Set<ActivityCategoryToken>()
    var temporaryWebDomains = Set<WebDomainToken>()
    if let rawTemporarySelection, let temporarySourceId, !temporarySourceId.isEmpty {
      for token in rawTemporarySelection.applicationTokens {
        if temporaryContextAllows(
          context: interventionContext(for: token),
          sourceSelectionId: temporarySourceId,
          sourceKind: temporarySourceKind,
          sourceMinutes: temporarySourceMinutes
        ) { temporaryApplications.insert(token) }
      }
      for token in rawTemporarySelection.categoryTokens {
        if temporaryContextAllows(
          context: interventionContext(for: token),
          sourceSelectionId: temporarySourceId,
          sourceKind: temporarySourceKind,
          sourceMinutes: temporarySourceMinutes
        ) { temporaryCategories.insert(token) }
      }
      for token in rawTemporarySelection.webDomainTokens {
        if temporaryContextAllows(
          context: interventionContext(for: token),
          sourceSelectionId: temporarySourceId,
          sourceKind: temporarySourceKind,
          sourceMinutes: temporarySourceMinutes
        ) { temporaryWebDomains.insert(token) }
      }
    }
    let quiet = includeQuiet ? activeQuietHour(payload: payload, now: now) : nil
    let hardWallContext = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.dailyHardWallContextKey
    ) ?? ""
    let hardWallDay = hardWallContext.split(separator: "|").first.map(String.init) ?? ""
    let hardWall = hardWallDay == localDayKey(now)
      && AnastaFocusShared.defaults.bool(forKey: AnastaFocusShared.dailyHardWallKey)
    let globalEssentials = AnastaSelectionStore.load(selectionId: "global.essentials")
    let designatedCore = AnastaSelectionStore.load(selectionId: "core.designated")
    let quietEssentials = AnastaSelectionStore.load(selectionId: "quiet.current")
    let alwaysStrict = AnastaSelectionStore.load(selectionId: "always.strict")
    let alwaysLoose = AnastaSelectionStore.load(selectionId: "always.loose")
    let permanentEssentials = globalEssentials.applicationTokens.union(designatedCore.applicationTokens)
    let alwaysApplications = alwaysStrict.applicationTokens.union(alwaysLoose.applicationTokens)
    let essentialsOnlyPlan = plan?["essentialsOnly"] as? Bool ?? false
    let planEssentials = AnastaSelectionStore.load(
      selectionId: plan?["essentialsSelectionId"] as? String ?? "plan.\(planId).essentials"
    )
    var planAllowed = permanentEssentials.union(planEssentials.applicationTokens)
    planAllowed.subtract(alwaysApplications)
    var quietAllowed = quietEssentials.applicationTokens.union(designatedCore.applicationTokens)
    quietAllowed.subtract(alwaysApplications)

    var allowedApplications: Set<ApplicationToken>? = nil
    if essentialsOnlyPlan { allowedApplications = planAllowed }
    if hardWall && !essentialsOnlyPlan { allowedApplications = permanentEssentials }
    if quiet != nil {
      allowedApplications = allowedApplications == nil
        ? quietAllowed
        : allowedApplications!.intersection(quietAllowed)
    }
    if let allowedApplications {
      store.shield.applicationCategories = .all(except: allowedApplications)
    }

    var ordinaryApplications = Set<ApplicationToken>()
    var ordinaryCategories = Set<ActivityCategoryToken>()
    var ordinaryWebDomains = Set<WebDomainToken>()
    let rules = plan.map { activeRules(plan: $0, now: now) } ?? []
    for rule in rules where (rule["mode"] as? String) == "blocked" {
      let groupId = rule["groupId"] as? String ?? "group"
      appendSelection(
        id: "plan.\(planId).group.\(groupId)",
        excluding: nil,
        applications: &ordinaryApplications,
        categories: &ordinaryCategories,
        webDomains: &ordinaryWebDomains
      )
    }
    for rule in rules {
      let groupId = rule["groupId"] as? String ?? "group"
      for appRule in rule["appRules"] as? [[String: Any]] ?? [] where (appRule["mode"] as? String) == "blocked" {
        let appId = appRule["appId"] as? String ?? "app"
        appendSelection(
          id: "plan.\(planId).group.\(groupId).app.\(appId)",
          excluding: nil,
          applications: &ordinaryApplications,
          categories: &ordinaryCategories,
          webDomains: &ordinaryWebDomains
        )
      }
    }

    for selectionId in AnastaFocusShared.defaults.stringArray(forKey: AnastaFocusShared.reachedSelectionsKey) ?? [] {
      appendSelection(
        id: selectionId,
        excluding: nil,
        applications: &ordinaryApplications,
        categories: &ordinaryCategories,
        webDomains: &ordinaryWebDomains
      )
    }

    var ordinaryExceptions = permanentEssentials
    if quiet != nil { ordinaryExceptions.formUnion(quietAllowed) }
    ordinaryExceptions.formUnion(temporaryApplications)
    ordinaryCategories.subtract(temporaryCategories)
    ordinaryWebDomains.subtract(temporaryWebDomains)
    ordinaryApplications.subtract(ordinaryExceptions)

    var permanentlyBlockedApplications = Set<ApplicationToken>()
    var alwaysCategories = Set<ActivityCategoryToken>()
    var alwaysWebDomains = Set<WebDomainToken>()
    appendAlwaysBlocked(
      payload: payload,
      excluding: nil,
      applications: &permanentlyBlockedApplications,
      categories: &alwaysCategories,
      webDomains: &alwaysWebDomains
    )
    permanentlyBlockedApplications.subtract(temporaryApplications)
    alwaysCategories.subtract(temporaryCategories)
    alwaysWebDomains.subtract(temporaryWebDomains)

    let blockedApplications = ordinaryApplications.union(permanentlyBlockedApplications)
    let blockedCategories = ordinaryCategories.union(alwaysCategories)
    let blockedWebDomains = ordinaryWebDomains.union(alwaysWebDomains)
    store.shield.applications = blockedApplications.isEmpty ? nil : blockedApplications
    if allowedApplications == nil {
      store.shield.applicationCategories = blockedCategories.isEmpty
        ? nil
        : .specific(blockedCategories, except: ordinaryExceptions)
    }
    store.shield.webDomains = blockedWebDomains.isEmpty ? nil : blockedWebDomains
  }

  private static func resolveInterventionContext(
    protectsByAllowlist: Bool,
    fallbackKind: String,
    matches: (FamilyActivitySelection) -> Bool
  ) -> [String: Any] {
    let fallback: [String: Any] = [
      "kind": fallbackKind,
      "selectionId": "",
      "strength": "strict",
      "minutes": 0,
    ]
    guard let payload = AnastaFocusShared.payload() else { return fallback }
    let now = Date()

    let hardWallContext = AnastaFocusShared.defaults.string(
      forKey: AnastaFocusShared.dailyHardWallContextKey
    ) ?? ""
    let hardWallDay = hardWallContext.split(separator: "|").first.map(String.init) ?? ""
    let hardWallIsCurrent = hardWallDay == localDayKey(now)
      && AnastaFocusShared.defaults.bool(forKey: AnastaFocusShared.dailyHardWallKey)
    if protectsByAllowlist && hardWallIsCurrent {
      return ["kind": "daily-hard", "selectionId": "", "strength": "strict", "minutes": 0, "practice": "prayer"]
    }

    if
      protectsByAllowlist,
      let plan = planForDay(payload: payload, day: now),
      plan["essentialsOnly"] as? Bool == true
    {
      let planId = plan["id"] as? String ?? "plan"
      let planEssentials = AnastaSelectionStore.load(
        selectionId: plan["essentialsSelectionId"] as? String ?? "plan.\(planId).essentials"
      )
      let globalEssentials = AnastaSelectionStore.load(selectionId: "global.essentials")
      let designatedCore = AnastaSelectionStore.load(selectionId: "core.designated")
      if !matches(planEssentials) && !matches(globalEssentials) && !matches(designatedCore) {
        return ["kind": "daily-hard", "selectionId": "", "strength": "strict", "minutes": 0, "practice": "prayer"]
      }
    }

    if protectsByAllowlist, activeQuietHour(payload: payload, now: now) != nil {
      let quiet = AnastaSelectionStore.load(selectionId: "quiet.current")
      let core = AnastaSelectionStore.load(selectionId: "core.designated")
      if !matches(quiet) && !matches(core) {
        return ["kind": "quiet", "selectionId": "quiet.current", "strength": "strict", "minutes": 0, "practice": "prayer"]
      }
    }

    if matches(AnastaSelectionStore.load(selectionId: "always.strict")) {
      return ["kind": "always", "selectionId": "always.strict", "strength": "strict", "minutes": 0, "practice": "prayer"]
    }
    if matches(AnastaSelectionStore.load(selectionId: "always.loose")) {
      return ["kind": "always", "selectionId": "always.loose", "strength": "loose", "minutes": 0, "practice": "prayer"]
    }

    var candidates: [[String: Any]] = []
    let reachedMetadata = AnastaFocusShared.defaults.dictionary(
      forKey: AnastaFocusShared.reachedMetadataKey
    ) ?? [:]
    for selectionId in AnastaFocusShared.defaults.stringArray(
      forKey: AnastaFocusShared.reachedSelectionsKey
    ) ?? [] where matches(AnastaSelectionStore.load(selectionId: selectionId)) {
      var metadata = reachedMetadata[selectionId] as? [String: Any] ?? [:]
      metadata["selectionId"] = selectionId
      metadata["kind"] = metadata["kind"] as? String ?? "limit"
      metadata["strength"] = metadata["strength"] as? String ?? "strict"
      metadata["minutes"] = metadata["minutes"] as? Int ?? 0
      candidates.append(metadata)
    }

    if let plan = planForDay(payload: payload, day: now) {
      let planId = plan["id"] as? String ?? "plan"
      let sessionId = (plan["kind"] as? String) == "session"
        ? activeSession(plan: plan, now: now)?["id"] as? String ?? "session"
        : "daily"
      for rule in activeRules(plan: plan, now: now) {
        let groupId = rule["groupId"] as? String ?? "group"
        if (rule["mode"] as? String) == "blocked" {
          let selectionId = "plan.\(planId).group.\(groupId)"
          if matches(AnastaSelectionStore.load(selectionId: selectionId)) {
            candidates.append([
              "kind": "blocked",
              "day": localDayKey(now),
              "planId": planId,
              "selectionId": selectionId,
              "sessionId": sessionId,
              "strength": rule["strength"] as? String ?? "strict",
              "minutes": 0,
              "practice": rule["practice"] as? String ?? "prayer",
            ])
          }
        }
        for appRule in rule["appRules"] as? [[String: Any]] ?? [] where (appRule["mode"] as? String) == "blocked" {
          let appId = appRule["appId"] as? String ?? "app"
          let selectionId = "plan.\(planId).group.\(groupId).app.\(appId)"
          if matches(AnastaSelectionStore.load(selectionId: selectionId)) {
            candidates.append([
              "kind": "blocked",
              "day": localDayKey(now),
              "planId": planId,
              "selectionId": selectionId,
              "sessionId": sessionId,
              "strength": appRule["strength"] as? String ?? "strict",
              "minutes": 0,
              "practice": appRule["practice"] as? String ?? "prayer",
              "label": appRule["label"] as? String ?? "",
            ])
          }
        }
      }
    }

    return candidates.max { contextPriority($0) < contextPriority($1) } ?? fallback
  }

  private static func contextPriority(_ context: [String: Any]) -> Int {
    let strength = context["strength"] as? String ?? "strict"
    let kind = context["kind"] as? String ?? "limit"
    let strengthScore = strength == "strict" ? 100 : 0
    let kindScore: Int
    switch kind {
    case "blocked": kindScore = 40
    case "limit": kindScore = 30
    case "checkin": kindScore = 20
    default: kindScore = 10
    }
    return strengthScore + kindScore
  }

  private static func temporaryContextAllows(
    context: [String: Any],
    sourceSelectionId: String,
    sourceKind: String,
    sourceMinutes: Int
  ) -> Bool {
    let sameSource = context["selectionId"] as? String == sourceSelectionId
    let strength = context["strength"] as? String ?? "strict"
    let kind = context["kind"] as? String ?? "limit"
    let minutes = context["minutes"] as? Int ?? 0
    return sameSource
      && kind == sourceKind
      && minutes == sourceMinutes
      && (strength == "loose" || kind == "checkin")
  }

  private static func applyAlwaysBlocked(payload: [String: Any], excluding: String?) {
    var apps = Set<ApplicationToken>()
    var categories = Set<ActivityCategoryToken>()
    var domains = Set<WebDomainToken>()
    appendAlwaysBlocked(
      payload: payload,
      excluding: excluding,
      applications: &apps,
      categories: &categories,
      webDomains: &domains
    )
    store.shield.applications = apps.isEmpty ? nil : apps
    store.shield.applicationCategories = categories.isEmpty ? nil : .specific(categories)
    store.shield.webDomains = domains.isEmpty ? nil : domains
  }

  private static func appendAlwaysBlocked(
    payload: [String: Any],
    excluding: String?,
    applications: inout Set<ApplicationToken>,
    categories: inout Set<ActivityCategoryToken>,
    webDomains: inout Set<WebDomainToken>
  ) {
    appendSelection(
      id: "always.strict",
      excluding: excluding,
      applications: &applications,
      categories: &categories,
      webDomains: &webDomains
    )
    appendSelection(
      id: "always.loose",
      excluding: excluding,
      applications: &applications,
      categories: &categories,
      webDomains: &webDomains
    )
    for rule in payload["alwaysBlocked"] as? [[String: Any]] ?? [] {
      guard let appId = rule["appId"] as? String else { continue }
      appendSelection(
        id: "always.\(appId)",
        excluding: excluding,
        applications: &applications,
        categories: &categories,
        webDomains: &webDomains
      )
    }
  }

  private static func appendSelection(
    id: String,
    excluding: String?,
    applications: inout Set<ApplicationToken>,
    categories: inout Set<ActivityCategoryToken>,
    webDomains: inout Set<WebDomainToken>
  ) {
    if id == excluding { return }
    let selection = AnastaSelectionStore.load(selectionId: id)
    applications.formUnion(selection.applicationTokens)
    categories.formUnion(selection.categoryTokens)
    webDomains.formUnion(selection.webDomainTokens)
  }

  private static func applyWebProtection(payload: [String: Any]) {
    guard let web = payload["webProtection"] as? [String: Any] else {
      AnastaFocusShared.defaults.set(0, forKey: AnastaFocusShared.appliedWebDomainCountKey)
      AnastaFocusShared.defaults.set(0, forKey: AnastaFocusShared.omittedWebDomainCountKey)
      AnastaFocusShared.defaults.set(false, forKey: AnastaFocusShared.adultFilterActiveKey)
      return
    }

    var orderedDomains: [String] = []
    var seenDomains = Set<String>()
    func appendDomain(_ raw: String) {
      let domain = raw
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
        .replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
        .replacingOccurrences(of: "/.*$", with: "", options: .regularExpression)
      guard domain.contains("."), !seenDomains.contains(domain) else { return }
      seenDomains.insert(domain)
      orderedDomains.append(domain)
    }

    if let resolvedDomains = web["resolvedDomains"] as? [String] {
      resolvedDomains.forEach(appendDomain)
    } else {
      for entry in web["customDomains"] as? [[String: Any]] ?? [] {
        if let domain = entry["domain"] as? String { appendDomain(domain) }
      }
      for pack in web["customPacks"] as? [[String: Any]] ?? [] where (pack["mode"] as? String) != "off" {
        (pack["domains"] as? [String] ?? []).forEach(appendDomain)
      }
      for pack in web["packs"] as? [[String: Any]] ?? [] {
        guard
          (pack["mode"] as? String) != "off",
          let id = pack["id"] as? String
        else { continue }
        (packDomains[id] ?? []).forEach(appendDomain)
      }
    }

    let adultFilter = web["adultFilterActive"] as? Bool
      ?? (web["packs"] as? [[String: Any]] ?? []).contains {
        ($0["id"] as? String) == "adult" && ($0["mode"] as? String) != "off"
      }
    let appliedDomains = Array(orderedDomains.prefix(50))
    let omittedCount = max(
      web["omittedDomainCount"] as? Int ?? 0,
      orderedDomains.count - appliedDomains.count
    )
    AnastaFocusShared.defaults.set(
      appliedDomains.count,
      forKey: AnastaFocusShared.appliedWebDomainCountKey
    )
    AnastaFocusShared.defaults.set(
      omittedCount,
      forKey: AnastaFocusShared.omittedWebDomainCountKey
    )
    AnastaFocusShared.defaults.set(
      adultFilter,
      forKey: AnastaFocusShared.adultFilterActiveKey
    )

    let webDomains = Set(appliedDomains.map { WebDomain(domain: $0) })
    if adultFilter {
      store.webContent.blockedByFilter = .auto(webDomains, except: [])
    } else if !webDomains.isEmpty {
      store.webContent.blockedByFilter = .specific(webDomains)
    }
  }

  private static func planForDay(payload: [String: Any], day: Date) -> [String: Any]? {
    if let plans = payload["plans"] as? [[String: Any]], let schedule = payload["weeklySchedule"] as? [Any] {
      let dayKey = localDayKey(day)
      let overrides = payload["dayOverrides"] as? [String: Any]
      let override = overrides?[dayKey]
      let planId: String?
      if let overrideId = override as? String { planId = overrideId }
      else if override is NSNull { planId = nil }
      else {
        let index = mondayFirstWeekday(day)
        planId = index < schedule.count ? schedule[index] as? String : nil
      }
      return plans.first { ($0["id"] as? String) == planId }
    }
    return payload["plan"] as? [String: Any]
  }

  private static func activeRules(plan: [String: Any], now: Date) -> [[String: Any]] {
    guard (plan["kind"] as? String) == "session" else {
      return plan["dailyRules"] as? [[String: Any]] ?? []
    }
    return activeSession(plan: plan, now: now)?["rules"] as? [[String: Any]] ?? []
  }

  private static func activeSession(plan: [String: Any], now: Date) -> [String: Any]? {
    guard (plan["kind"] as? String) == "session" else { return nil }
    let minute = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
    let sessions = plan["sessions"] as? [[String: Any]] ?? []
    return sessions.first { entry in
      let start = entry["startMinutes"] as? Int ?? 0
      let end = entry["endMinutes"] as? Int ?? 0
      return end > start ? minute >= start && minute < end : minute >= start || minute < end
    }
  }

  private static func activeQuietHour(payload: [String: Any], now: Date) -> [String: Any]? {
    guard let quiet = payload["quietHour"] as? [String: Any] else { return nil }
    let endsAt = quiet["endsAt"] as? Double ?? 0
    return endsAt > now.timeIntervalSince1970 * 1000 ? quiet : nil
  }

  private static func activeTemporaryAccess(now: Date) -> [String: Any]? {
    guard let temporary = AnastaFocusShared.defaults.dictionary(forKey: AnastaFocusShared.temporaryAccessKey) else { return nil }
    let endsAt = temporary["endsAt"] as? Double ?? 0
    if endsAt <= now.timeIntervalSince1970 * 1000 {
      AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.temporaryAccessKey)
      return nil
    }
    return temporary
  }

  private static func date(day: Date, minutes: Int) -> Date {
    calendar.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: day) ?? day
  }

  private static func dateComponents(_ date: Date) -> DateComponents {
    calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
  }

  private static func dateStamp(_ date: Date) -> String {
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d%02d%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
  }

  private static func localDayKey(_ date: Date) -> String {
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
  }

  private static func mondayFirstWeekday(_ date: Date) -> Int {
    (calendar.component(.weekday, from: date) + 5) % 7
  }
}

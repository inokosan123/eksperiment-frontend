import DeviceActivity
import Foundation

final class AnastaDeviceActivityMonitor: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    AnastaFocusEngine.scheduleStoredRollingWindow()
    AnastaFocusEngine.beginRuleScope(activity)
    AnastaFocusEngine.applyStoredProtection()
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    if activity.rawValue.hasPrefix("anasta.temporary-access") {
      let temporary = AnastaFocusShared.defaults.dictionary(
        forKey: AnastaFocusShared.temporaryAccessKey
      )
      if temporary?["activity"] as? String == activity.rawValue {
        AnastaFocusShared.defaults.removeObject(forKey: AnastaFocusShared.temporaryAccessKey)
      }
    }
    AnastaFocusEngine.endRuleScope(activity)
    AnastaFocusEngine.scheduleStoredRollingWindow()
    AnastaFocusEngine.applyStoredProtection()
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    guard AnastaFocusEngine.isCurrentPlanActivity(activity) else { return }
    guard AnastaFocusShared.markEventDelivered(activity: activity, event: event) else { return }
    let map = AnastaFocusShared.defaults.dictionary(forKey: AnastaFocusShared.eventMapKey)
    let metadata = map?[event.rawValue] as? [String: Any] ?? [:]
    let kind = metadata["kind"] as? String ?? "limit"
    let selectionId = metadata["selectionId"] as? String ?? ""
    let createdAt = Date().timeIntervalSince1970 * 1000
    let nativeEvent: [String: Any] = [
      "kind": kind,
      "day": metadata["day"] as? String ?? "",
      "planId": metadata["planId"] as? String ?? "",
      "selectionId": selectionId,
      "sessionId": metadata["sessionId"] as? String ?? "",
      "strength": metadata["strength"] as? String ?? "strict",
      "practice": metadata["practice"] as? String ?? "prayer",
      "minutes": metadata["minutes"] as? Int ?? 0,
      "label": metadata["label"] as? String ?? "",
      "activity": activity.rawValue,
      "event": event.rawValue,
      "createdAt": createdAt,
    ]
    AnastaFocusShared.appendNativeEvent(nativeEvent)

    if kind == "daily-target" {
      AnastaFocusShared.markDailyTargetLost(
        day: metadata["day"] as? String ?? "",
        planId: metadata["planId"] as? String ?? ""
      )
      return
    }

    if kind == "daily-hard" {
      AnastaFocusShared.defaults.set(true, forKey: AnastaFocusShared.dailyHardWallKey)
    } else if !selectionId.isEmpty {
      AnastaFocusEngine.recordReachedSelection(
        selectionId,
        activity: activity,
        metadata: metadata
      )
    }

    AnastaFocusShared.defaults.set(nativeEvent, forKey: AnastaFocusShared.pendingInterventionKey)
    AnastaFocusEngine.applyStoredProtection()
  }
}

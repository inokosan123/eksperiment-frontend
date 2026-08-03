import DeviceActivity
import ExpoModulesCore
import FamilyControls
import Foundation
import SwiftUI
import UIKit

public final class AnastaFocusModule: Module {
  private var pickerSession: AnastaActivityPickerSession?

  public func definition() -> ModuleDefinition {
    Name("AnastaFocus")

    AsyncFunction("authorizationStatus") { () -> String in
      Self.authorizationStatusString()
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
      return Self.authorizationStatusString()
    }

    AsyncFunction("applyProtection") { (payloadJson: String) throws -> [String: Any] in
      do {
        try AnastaFocusEngine.apply(payloadJson: payloadJson)
        var result = AnastaFocusEngine.runtimeStatus()
        result["applied"] = true
        return result
      } catch {
        return Self.applyErrorPayload(error)
      }
    }

    AsyncFunction("syncAnalyticsContext") { (payloadJson: String) throws -> [String: Any] in
      try AnastaFocusShared.storeAnalyticsContext(payloadJson: payloadJson)
    }

    AsyncFunction("runtimeStatus") { () -> [String: Any] in
      AnastaFocusEngine.runtimeStatus()
    }

    AsyncFunction("clearProtection") { () in
      AnastaFocusEngine.clearAll()
    }

    AsyncFunction("activitySelectionSummary") { (selectionId: String) -> [String: Any] in
      AnastaSelectionStore.summary(selectionId: selectionId)
    }

    AsyncFunction("copyActivitySelection") { (sourceId: String, destinationId: String) -> [String: Any] in
      let result = AnastaSelectionStore.copy(sourceId: sourceId, destinationId: destinationId)
      AnastaFocusEngine.selectionDidChange(selectionId: destinationId)
      return result
    }

    AsyncFunction("activitySelectionsEqual") { (firstId: String, secondId: String) -> Bool in
      let first = AnastaSelectionStore.load(selectionId: firstId)
      let second = AnastaSelectionStore.load(selectionId: secondId)
      return first.applicationTokens == second.applicationTokens
        && first.categoryTokens == second.categoryTokens
        && first.webDomainTokens == second.webDomainTokens
    }

    AsyncFunction("clearActivitySelection") { (selectionId: String) in
      AnastaSelectionStore.clear(selectionId: selectionId)
      AnastaFocusEngine.selectionDidChange(selectionId: selectionId)
    }

    AsyncFunction("clearActivitySelectionsWithPrefix") { (prefix: String) in
      AnastaSelectionStore.clear(prefix: prefix)
    }

    AsyncFunction("openActivityPicker") { (selectionId: String, title: String, promise: Promise) in
      DispatchQueue.main.async {
        guard self.pickerSession == nil else {
          promise.reject("ERR_PICKER_ACTIVE", "An activity picker is already open.")
          return
        }
        guard let presenter = self.appContext?.utilities?.currentViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Anasta could not present the activity picker.")
          return
        }
        let session = AnastaActivityPickerSession(
          selectionId: selectionId,
          title: title,
          presenter: presenter,
          promise: promise,
          onFinish: { [weak self] in self?.pickerSession = nil }
        )
        self.pickerSession = session
        session.present()
      }
    }

    AsyncFunction("grantTemporaryAccess") {
      (selectionId: String, sourceSelectionId: String, sourceKind: String, sourceMinutes: Int, minutes: Int) throws in
      try AnastaFocusEngine.grantTemporaryAccess(
        selectionId: selectionId,
        sourceSelectionId: sourceSelectionId,
        sourceKind: sourceKind,
        sourceMinutes: max(0, sourceMinutes),
        minutes: max(15, min(minutes, 60))
      )
    }

    AsyncFunction("consumePendingIntervention") { () -> [String: Any]? in
      AnastaFocusShared.consumePendingIntervention()
    }

    AsyncFunction("consumeNativeEvents") { () -> [[String: Any]] in
      AnastaFocusShared.consumeNativeEvents()
    }

    View(AnastaActivityReportView.self) {
      Prop("date") { (view: AnastaActivityReportView, date: String) in
        view.date = date
      }
      Prop("days") { (view: AnastaActivityReportView, days: Int) in
        view.days = days
      }
      Prop("startMinutes") { (view: AnastaActivityReportView, startMinutes: Int) in
        view.startMinutes = startMinutes
      }
      Prop("endMinutes") { (view: AnastaActivityReportView, endMinutes: Int) in
        view.endMinutes = endMinutes
      }
      Prop("analyticsRequestJson") {
        (view: AnastaActivityReportView, analyticsRequestJson: String) in
        view.analyticsRequestJson = analyticsRequestJson
      }
    }
  }

  private static func authorizationStatusString() -> String {
    let status = AuthorizationCenter.shared.authorizationStatus
    if #available(iOS 26.0, *), status == .approvedWithDataAccess {
      // Anasta still uses opaque tokens and the privacy-preserving report. The
      // broader status must nevertheless remain valid for blocker enforcement.
      return "approved"
    }
    switch status {
    case .notDetermined: return "notDetermined"
    case .denied: return "denied"
    case .approved: return "approved"
    @unknown default: return "denied"
    }
  }

  private static func applyErrorPayload(_ error: Error) -> [String: Any] {
    var result = AnastaFocusEngine.runtimeStatus()
    let nativeError = error as NSError
    if nativeError.domain == "AnastaFocus", nativeError.code == 6 {
      result["applied"] = false
      result["errorCode"] = "missingSelections"
      result["error"] = nativeError.localizedDescription
      result["recovery"] = "Open the affected plan and choose its apps in Apple's private picker."
      return result
    }
    guard let monitoringError = error as? DeviceActivityCenter.MonitoringError else {
      result["applied"] = false
      result["errorCode"] = "unknown"
      result["error"] = error.localizedDescription
      result["recovery"] = "Review the Focus settings and try applying protection again."
      return result
    }

    let code: String
    let message: String
    let recovery: String
    switch monitoringError {
    case .unauthorized:
      code = "unauthorized"
      message = "Screen Time access is no longer available."
      recovery = "Re-enable Anasta in iPhone Settings under Screen Time access."
    case .excessiveActivities:
      code = "excessiveActivities"
      message = "iPhone could not start another Focus schedule."
      recovery = "Try again after the current Session ends or reduce the number of Sessions in this plan."
    case .intervalTooShort:
      code = "intervalTooShort"
      message = "This protection interval is shorter than Apple's 15-minute minimum."
      recovery = "Choose a duration of at least 15 minutes."
    case .intervalTooLong:
      code = "intervalTooLong"
      message = "This protection interval is longer than iPhone allows."
      recovery = "Shorten the interval and try again."
    case .invalidDateComponents:
      code = "invalidDateComponents"
      message = "iPhone could not understand one of the scheduled times."
      recovery = "Check the Session times and the iPhone time zone, then try again."
    @unknown default:
      code = "unknown"
      message = monitoringError.localizedDescription
      recovery = "Review the Focus settings and try applying protection again."
    }

    result["applied"] = false
    result["errorCode"] = code
    result["error"] = "\(message) \(recovery)"
    result["recovery"] = recovery
    return result
  }
}

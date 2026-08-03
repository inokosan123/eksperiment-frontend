import Foundation
import ManagedSettings

final class AnastaShieldAction: ShieldActionDelegate {
  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action: action,
      context: AnastaFocusEngine.interventionContext(for: application),
      saveAccessSelection: { AnastaSelectionStore.saveTemporary(application: application) },
      completionHandler: completionHandler
    )
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action: action,
      context: AnastaFocusEngine.interventionContext(for: category),
      saveAccessSelection: { AnastaSelectionStore.saveTemporary(category: category) },
      completionHandler: completionHandler
    )
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action: action,
      context: AnastaFocusEngine.interventionContext(for: webDomain),
      saveAccessSelection: { AnastaSelectionStore.saveTemporary(webDomain: webDomain) },
      completionHandler: completionHandler
    )
  }

  private func respond(
    action: ShieldAction,
    context: [String: Any],
    saveAccessSelection: () -> String,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    let strength = context["strength"] as? String ?? "strict"
    let kind = context["kind"] as? String ?? "limit"
    let isNeverAllowedWeb = kind == "web-never"
    let canOpenAnasta = strength == "loose" || kind == "checkin" || isNeverAllowedWeb

    switch action {
    case .primaryButtonPressed where canOpenAnasta:
      var pending = context
      // A Never Allowed reminder must never create a temporary access token.
      pending["accessSelectionId"] = isNeverAllowedWeb ? "" : saveAccessSelection()
      pending["createdAt"] = Date().timeIntervalSince1970 * 1000
      AnastaFocusShared.defaults.set(pending, forKey: AnastaFocusShared.pendingInterventionKey)
      if #available(iOS 26.0, *) {
        completionHandler(.openParentalControlsApp)
      } else {
        completionHandler(.close)
      }
    case .primaryButtonPressed, .secondaryButtonPressed:
      completionHandler(.close)
    @unknown default:
      completionHandler(.close)
    }
  }
}

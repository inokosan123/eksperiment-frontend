import ManagedSettings
import ManagedSettingsUI
import UIKit

final class AnastaShieldConfiguration: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    configuration(context: context(application.token))
  }

  override func configuration(
    shielding application: Application,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    configuration(context: context(application.token))
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    configuration(isWebsite: true, context: context(webDomain.token))
  }

  override func configuration(
    shielding webDomain: WebDomain,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    configuration(isWebsite: true, context: context(webDomain.token))
  }

  private func configuration(
    isWebsite: Bool = false,
    context: [String: Any]? = nil
  ) -> ShieldConfiguration {
    let pending = AnastaFocusShared.defaults.dictionary(forKey: AnastaFocusShared.pendingInterventionKey)
    let strength = context?["strength"] as? String ?? pending?["strength"] as? String ?? "strict"
    let kind = context?["kind"] as? String ?? pending?["kind"] as? String ?? (isWebsite ? "web" : "limit")
    let isLoose = strength == "loose" || kind == "checkin"
    let opensAnastaDirectly: Bool
    if #available(iOS 26.0, *) {
      opensAnastaDirectly = true
    } else {
      opensAnastaDirectly = false
    }
    let title: String
    var subtitle: String
    switch kind {
    case "daily-hard":
      title = "Today's phone boundary is holding"
      subtitle = "Your Essentials and iOS system access remain available for the rest of today."
    case "quiet":
      title = "Quiet Hour is active"
      subtitle = "This app is outside the phone you chose for this protected time."
    case "always":
      title = isLoose ? "Open this app intentionally" : "This app is Always Blocked"
      subtitle = isLoose
        ? "Return to Anasta before choosing a conscious 15-minute window."
        : "The permanent boundary you chose is holding."
    case "checkin":
      title = "A moment of attention"
      subtitle = "Notice the time you have spent. Leave now, or continue intentionally in Anasta."
    default:
      title = "This boundary is active"
      subtitle = isWebsite
        ? "Web Protection is protecting a choice you made before this moment."
        : "Your time and attention are being protected by today's plan."
    }
    if isLoose && !opensAnastaDirectly {
      subtitle += " Close this shield, then open Anasta to choose what happens next."
    }

    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterial,
      backgroundColor: UIColor(red: 0.98, green: 0.97, blue: 0.94, alpha: 0.96),
      icon: UIImage(systemName: isWebsite ? "globe.badge.chevron.backward" : "shield.lefthalf.filled"),
      title: ShieldConfiguration.Label(text: title, color: UIColor(red: 0.14, green: 0.13, blue: 0.11, alpha: 1)),
      subtitle: ShieldConfiguration.Label(text: subtitle, color: UIColor(red: 0.36, green: 0.34, blue: 0.30, alpha: 1)),
      primaryButtonLabel: ShieldConfiguration.Label(
        text: isLoose
          ? (opensAnastaDirectly ? "Open Anasta" : "Close this shield")
          : "Leave this app",
        color: .white
      ),
      primaryButtonBackgroundColor: UIColor(red: 0.63, green: 0.45, blue: 0.16, alpha: 1),
      secondaryButtonLabel: isLoose
        ? ShieldConfiguration.Label(text: "Not now", color: UIColor(red: 0.40, green: 0.37, blue: 0.31, alpha: 1))
        : nil
    )
  }

  private func context(_ token: ApplicationToken?) -> [String: Any]? {
    guard let token else { return nil }
    return AnastaFocusEngine.interventionContext(for: token)
  }

  private func context(_ token: WebDomainToken?) -> [String: Any]? {
    guard let token else { return nil }
    return AnastaFocusEngine.interventionContext(for: token)
  }
}

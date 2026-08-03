import SwiftUI

enum AnastaAnalyticsStyle {
  static let background = Color(red: 0.996, green: 0.986, blue: 0.957)
  static let surface = Color.white.opacity(0.94)
  static let ink = Color(red: 0.12, green: 0.105, blue: 0.085)
  static let secondary = Color(red: 0.43, green: 0.40, blue: 0.36)
  static let muted = Color(red: 0.46, green: 0.43, blue: 0.39)
  static let border = Color(red: 0.89, green: 0.86, blue: 0.79)
  static let gold = Color(red: 0.69, green: 0.53, blue: 0.25)
  static let goldDark = Color(red: 0.50, green: 0.36, blue: 0.15)
  static let goldLight = Color(red: 0.97, green: 0.92, blue: 0.80)
  static let crimson = Color(red: 0.63, green: 0.23, blue: 0.30)
  static let crimsonSoft = Color(red: 0.94, green: 0.82, blue: 0.82)
  static let stone = Color(red: 0.44, green: 0.40, blue: 0.34)
  static let sage = Color(red: 0.25, green: 0.47, blue: 0.37)
  static let sageSoft = Color(red: 0.83, green: 0.90, blue: 0.84)
  static let amber = Color(red: 0.72, green: 0.43, blue: 0.12)

  static func duration(_ value: TimeInterval?) -> String {
    guard let value, value.isFinite else { return "—" }
    let totalMinutes = max(0, Int((value / 60).rounded()))
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    if hours == 0 { return "\(minutes)m" }
    if minutes == 0 { return "\(hours)h" }
    return "\(hours)h \(minutes)m"
  }

  static func longDuration(_ value: TimeInterval?) -> String {
    guard let value, value.isFinite else { return "Unavailable" }
    let totalMinutes = max(0, Int((value / 60).rounded()))
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    if hours == 0 { return "\(minutes) minutes" }
    if minutes == 0 { return "\(hours) \(hours == 1 ? "hour" : "hours")" }
    return "\(hours) \(hours == 1 ? "hour" : "hours") \(minutes) minutes"
  }

  static func percent(_ value: Double) -> String {
    "\(Int(abs(value).rounded()))%"
  }
}

extension Font {
  static var anastaEyebrow: Font {
    .system(.caption2, design: .default, weight: .bold)
  }

  static var anastaCaption: Font {
    .system(.caption, design: .default, weight: .medium)
  }

  static var anastaCaptionStrong: Font {
    .system(.caption, design: .default, weight: .semibold)
  }

  static var anastaBody: Font {
    .system(.subheadline, design: .default, weight: .medium)
  }

  static var anastaBodyStrong: Font {
    .system(.subheadline, design: .rounded, weight: .semibold)
  }

  static var anastaCardTitle: Font {
    .system(.title3, design: .serif, weight: .semibold)
  }

  static var anastaMetric: Font {
    .system(.title2, design: .serif, weight: .semibold)
  }

  static var anastaHero: Font {
    .system(.largeTitle, design: .serif, weight: .semibold)
  }
}

struct AnastaAnalyticsCard: ViewModifier {
  var radius: CGFloat = 20
  var emphasized = false

  func body(content: Content) -> some View {
    content
      .background(AnastaAnalyticsStyle.surface)
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: radius, style: .continuous)
          .stroke(AnastaAnalyticsStyle.border.opacity(0.78), lineWidth: 1)
      )
      .shadow(
        color: emphasized ? Color.black.opacity(0.075) : Color.clear,
        radius: emphasized ? 12 : 0,
        x: 0,
        y: emphasized ? 5 : 0
      )
  }
}

extension View {
  func anastaAnalyticsCard(
    radius: CGFloat = 20,
    emphasized: Bool = false
  ) -> some View {
    modifier(AnastaAnalyticsCard(radius: radius, emphasized: emphasized))
  }
}

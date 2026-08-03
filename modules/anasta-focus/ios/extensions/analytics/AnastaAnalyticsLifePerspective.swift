import SwiftUI

struct AnastaAnalyticsLifePerspective: View {
  let configuration: AnastaAnalyticsConfiguration

  private var observedDays: Double? {
    configuration.selectedTotal.flatMap {
      AnastaAnalyticsPure.observedFullDays(totalSeconds: $0)
    }
  }

  private var annualPaceDays: Double? {
    configuration.selectedCompleteDayAverage.flatMap {
      AnastaAnalyticsPure.annualPaceFullDays(
        completeDayAverageSeconds: $0,
        completeDayCount: configuration.selectedCompleteDayCount
      )
    }
  }

  private var targetPaceDays: Double? {
    let minutes = configuration.dayOutcomes
      .sorted { $0.date < $1.date }
      .compactMap(\.targetMinutes)
      .last
    return minutes.flatMap {
      AnastaAnalyticsPure.targetPaceFullDays(dailyTargetMinutes: $0)
    }
  }

  private var managedShare: Double? {
    guard
      let managed = configuration.selectedManaged,
      let total = configuration.selectedTotal,
      total > 0
    else { return nil }
    return managed / total * 100
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 17) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Text("TIME MADE VISIBLE")
            .font(.anastaEyebrow)
            .tracking(1.45)
            .foregroundStyle(AnastaAnalyticsStyle.goldDark)
          Text(observedHeadline)
            .font(.anastaHero)
            .foregroundStyle(AnastaAnalyticsStyle.ink)
            .minimumScaleFactor(0.72)
            .accessibilityLabel(observedAccessibility)
          Text("Full 24-hour days represented by observed iPhone activity.")
            .font(.anastaBody)
            .foregroundStyle(AnastaAnalyticsStyle.secondary)
        }
        Spacer(minLength: 4)
        ZStack {
          Circle()
            .fill(AnastaAnalyticsStyle.goldLight.opacity(0.72))
          Circle()
            .stroke(AnastaAnalyticsStyle.gold.opacity(0.25), lineWidth: 1)
          Image(systemName: "hourglass")
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        }
        .frame(width: 50, height: 50)
      }

      LazyVGrid(
        columns: Array(
          repeating: GridItem(.flexible(minimum: 2), spacing: 2),
          count: 53
        ),
        spacing: 3
      ) {
        ForEach(0..<(53 * 7), id: \.self) { position in
          let column = position % 53
          let row = position / 53
          let dayIndex = column * 7 + row
          if dayIndex < 365 {
            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
              .fill(beadColor(dayIndex))
              .aspectRatio(1, contentMode: .fit)
              .accessibilityHidden(true)
          } else {
            Color.clear
              .aspectRatio(1, contentMode: .fit)
              .accessibilityHidden(true)
          }
        }
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(beadAccessibility)

      ViewThatFits(in: .horizontal) {
        HStack(spacing: 8) {
          perspectiveMetrics
        }
        VStack(spacing: 8) {
          perspectiveMetrics
        }
      }

      Text("Projection uses complete observed days. It is perspective, not a promise of time saved.")
        .font(.anastaCaption)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
    }
    .padding(18)
    .background(
      LinearGradient(
        colors: [
          Color.white.opacity(0.98),
          AnastaAnalyticsStyle.goldLight.opacity(0.44),
          AnastaAnalyticsStyle.crimsonSoft.opacity(0.20),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 25, style: .continuous)
        .stroke(AnastaAnalyticsStyle.gold.opacity(0.20), lineWidth: 1)
    )
    .shadow(color: Color.black.opacity(0.075), radius: 14, x: 0, y: 6)
  }

  private var observedHeadline: String {
    guard let observedDays else { return "Still preparing" }
    let value: String
    if observedDays < 10 {
      value = String(format: "%.1f full days", observedDays)
    } else {
      value = "\(Int(observedDays.rounded())) full days"
    }
    if configuration.isCurrentPeriod {
      return "\(value) so far"
    }
    guard let selectedInterval = configuration.selectedInterval else {
      return value
    }
    let year = Calendar.current.component(
      .year,
      from: selectedInterval.start
    )
    return "\(value) in \(year)"
  }

  private var paceBeads: Int {
    let represented: Double
    if configuration.isCurrentPeriod {
      represented = annualPaceDays ?? observedDays ?? 0
    } else {
      represented = observedDays ?? 0
    }
    return min(365, max(0, Int(represented.rounded())))
  }

  private var observedAccessibility: String {
    guard let observedDays else {
      return "Observed full days are still preparing"
    }
    return String(
      format: "%.1f full days represented by observed iPhone activity",
      observedDays
    )
  }

  private var beadAccessibility: String {
    if configuration.isCurrentPeriod, annualPaceDays != nil {
      return "Annual pace projection: \(paceBeads) of 365 full days in iPhone activity."
    }
    if !configuration.isCurrentPeriod {
      return "Observed activity represents \(paceBeads) of 365 full days in the selected year."
    }
    return "Observed activity currently represents \(paceBeads) of 365 full days. A projection unlocks after seven complete days."
  }

  private func beadColor(_ index: Int) -> Color {
    if index < paceBeads {
      return index < max(1, paceBeads / 4)
        ? AnastaAnalyticsStyle.crimson
        : AnastaAnalyticsStyle.gold
    }
    return AnastaAnalyticsStyle.border.opacity(0.58)
  }

  private func perspectiveMetric(
    kicker: String,
    value: String
  ) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(kicker)
        .font(.anastaEyebrow)
        .tracking(0.9)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      Text(value)
        .font(.anastaBodyStrong)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
    }
    .padding(11)
    .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
    .background(Color.white.opacity(0.62))
    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
  }

  @ViewBuilder
  private var perspectiveMetrics: some View {
    perspectiveMetric(
      kicker: "AT THIS PACE",
      value: annualPaceDays.map { "About \(Int($0.rounded())) days" }
        ?? "Unlocks after a week"
    )
    perspectiveMetric(
      kicker: "DAILY TARGET PACE",
      value: targetPaceDays.map { "About \(Int($0.rounded())) days" }
        ?? "No target"
    )
    perspectiveMetric(
      kicker: "MANAGED PORTION",
      value: managedShare.map { "\(Int($0.rounded()))%" }
        ?? "Coverage unavailable"
    )
  }
}

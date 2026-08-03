import Foundation
import FamilyControls
import SwiftUI

struct AnastaAnalyticsReportContent: View {
  let configuration: AnastaAnalyticsConfiguration
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    ScrollView(.vertical, showsIndicators: false) {
      VStack(alignment: .leading, spacing: 16) {
        if let reason = configuration.unavailableReason {
          unavailableState(reason)
        } else if shouldShowEmptyActivityState {
          emptyActivityState
          privacyFooter
        } else {
          if configuration.period == .year {
            AnastaAnalyticsLifePerspective(configuration: configuration)
          } else {
            activityHero
          }

          if configuration.coverage.kind != .complete {
            coverageNotice
          }
          if
            configuration.period != .day,
            configuration.comparison == nil,
            configuration.selectedTotal != nil
          {
            comparisonUnavailableNotice
          }

          AnastaAnalyticsPeriodChart(configuration: configuration)

          if configuration.period == .year {
            yearSummary
          } else {
            signalSection
            if !configuration.groups.isEmpty {
              managedGroups
            }
            insightCard
            protectionSection
          }

          if configuration.period == .year {
            insightCard
          }

          privacyFooter
        }
      }
      .padding(.horizontal, 16)
      .padding(.top, 10)
      .padding(.bottom, 36)
    }
    .background(AnastaAnalyticsStyle.background)
  }

  private var activityHero: some View {
    VStack(alignment: .leading, spacing: 17) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text("MANAGED ACTIVITY")
            .font(.anastaEyebrow)
            .tracking(1.55)
            .foregroundStyle(AnastaAnalyticsStyle.goldDark)
          Text(heroValue)
            .font(.anastaHero)
            .foregroundStyle(AnastaAnalyticsStyle.ink)
            .monospacedDigit()
            .minimumScaleFactor(0.72)
            .accessibilityLabel(heroAccessibilityValue)
          Text(heroCaption)
            .font(.anastaBody)
            .foregroundStyle(AnastaAnalyticsStyle.secondary)
        }
        Spacer(minLength: 6)
        heroSeal
      }

      if
        configuration.period == .day,
        let planName = selectedOutcome?.planName,
        !planName.isEmpty
      {
        HStack(spacing: 7) {
          Image(systemName: "calendar.badge.checkmark")
            .font(.system(size: 10, weight: .semibold))
          Text("PLAN · \(planName)")
            .font(.anastaEyebrow)
            .tracking(0.75)
            .lineLimit(2)
        }
        .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(AnastaAnalyticsStyle.goldLight.opacity(0.55))
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
      }

      Divider().overlay(AnastaAnalyticsStyle.border)

      ViewThatFits(in: .horizontal) {
        HStack(spacing: 9) {
          heroSupportingMetrics
        }
        VStack(spacing: 8) {
          heroSupportingMetrics
        }
      }

      if let comparison = configuration.comparison {
        comparisonBand(comparison)
      }
    }
    .padding(19)
    .background(
      LinearGradient(
        colors: [
          Color.white.opacity(0.99),
          AnastaAnalyticsStyle.goldLight.opacity(0.42),
          AnastaAnalyticsStyle.crimsonSoft.opacity(0.16),
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
    .shadow(color: Color.black.opacity(0.07), radius: 14, x: 0, y: 6)
  }

  @ViewBuilder
  private var heroSupportingMetrics: some View {
    if configuration.period == .day {
      heroMetric(
        label: "TOTAL IPHONE",
        value: AnastaAnalyticsStyle.duration(configuration.selectedTotal)
      )
      heroMetric(
        label: "DAILY TARGET",
        value: selectedTargetText
      )
    } else {
      heroMetric(
        label: "PERIOD TOTAL",
        value: AnastaAnalyticsStyle.duration(configuration.selectedManaged)
      )
      heroMetric(
        label: "IPHONE DAILY AVG",
        value: AnastaAnalyticsStyle.duration(configuration.selectedCompleteDayAverage)
      )
    }
  }

  private var heroSeal: some View {
    ZStack {
      Circle()
        .fill(AnastaAnalyticsStyle.goldLight.opacity(0.82))
      Circle()
        .stroke(AnastaAnalyticsStyle.gold.opacity(0.28), lineWidth: 1)
      Image(systemName: configuration.isCurrentPeriod ? "waveform.path.ecg" : "checkmark.seal")
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(AnastaAnalyticsStyle.goldDark)
    }
    .frame(width: 52, height: 52)
    .accessibilityHidden(true)
  }

  private func heroMetric(label: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(label)
        .font(.anastaEyebrow)
        .tracking(0.85)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      Text(value)
        .font(.anastaBodyStrong)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
        .monospacedDigit()
        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
        .minimumScaleFactor(0.78)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.white.opacity(0.65))
    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
  }

  private func comparisonBand(
    _ comparison: AnastaAnalyticsComparison
  ) -> some View {
    let lower = comparison.absoluteDelta < 0
    let changed = abs(comparison.absoluteDelta) >= 60
    let symbol = changed
      ? (lower ? "arrow.down.right" : "arrow.up.right")
      : "arrow.left.arrow.right"
    let tint = changed
      ? (lower ? AnastaAnalyticsStyle.sage : AnastaAnalyticsStyle.crimson)
      : AnastaAnalyticsStyle.goldDark
    let band = changed
      ? (lower ? AnastaAnalyticsStyle.sageSoft : AnastaAnalyticsStyle.crimsonSoft)
      : AnastaAnalyticsStyle.goldLight
    return HStack(spacing: 10) {
      Image(systemName: symbol)
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(tint)
      VStack(alignment: .leading, spacing: 2) {
        Text(comparisonCopy(comparison))
          .font(.anastaCaptionStrong)
          .foregroundStyle(AnastaAnalyticsStyle.secondary)
          .fixedSize(horizontal: false, vertical: true)
        if changed, let percent = comparison.percentDelta {
          Text(
            "\(AnastaAnalyticsStyle.percent(percent)) change across \(comparison.matchedUnitCount) matched complete \(comparison.matchedUnitCount == 1 ? "day" : "days")"
          )
          .font(.anastaEyebrow)
          .foregroundStyle(AnastaAnalyticsStyle.muted)
          .fixedSize(horizontal: false, vertical: true)
        }
      }
      Spacer(minLength: 2)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(band.opacity(0.46))
    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    .accessibilityElement(children: .combine)
  }

  private var signalSection: some View {
    VStack(alignment: .leading, spacing: 11) {
      sectionHeading(
        eyebrow: "BEHAVIOR SIGNALS",
        title: signalTitle,
        symbol: "chart.bar.xaxis"
      )
      LazyVGrid(
        columns: signalGridColumns,
        spacing: 9
      ) {
        ForEach(signalItems, id: \.label) { item in
          signalCard(item)
        }
      }
      if configuration.period == .day {
        HStack(alignment: .top, spacing: 7) {
          Image(systemName: "info.circle")
            .font(.system(size: 10, weight: .semibold))
          Text("iPhone pickups include alarms, time checks, and other phone use. They are a neutral behavior signal, not proof of distraction.")
            .font(.anastaCaption)
            .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(AnastaAnalyticsStyle.muted)
        .accessibilityElement(children: .combine)
      }
    }
  }

  private func signalCard(_ item: SignalItem) -> some View {
    VStack(alignment: .leading, spacing: 9) {
      Image(systemName: item.symbol)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(item.tint)
        .frame(width: 28, height: 28)
        .background(item.tint.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
      Text(item.value)
        .font(.anastaMetric)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
        .monospacedDigit()
        .minimumScaleFactor(0.74)
      Text(item.label)
        .font(.anastaEyebrow)
        .tracking(0.7)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
    }
    .padding(13)
    .frame(
      maxWidth: .infinity,
      minHeight: dynamicTypeSize.isAccessibilitySize ? nil : 116,
      alignment: .leading
    )
    .anastaAnalyticsCard(radius: 17)
    .accessibilityElement(children: .combine)
  }

  private var managedGroups: some View {
    VStack(alignment: .leading, spacing: 11) {
      sectionHeading(
        eyebrow: "PRIVATE BREAKDOWN",
        title: "Where managed time gathered",
        symbol: "square.stack.3d.up"
      )
      VStack(spacing: 0) {
        ForEach(Array(configuration.groups.enumerated()), id: \.element.id) {
          index,
          group in
          groupRow(group)
          if index < configuration.groups.count - 1 {
            Divider()
              .padding(.leading, 15)
              .overlay(AnastaAnalyticsStyle.border)
          }
        }
      }
      .anastaAnalyticsCard(radius: 20)
    }
  }

  private func groupRow(_ group: AnastaAnalyticsGroup) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 10) {
        ZStack {
          RoundedRectangle(cornerRadius: 11, style: .continuous)
            .fill(
              group.isAlwaysBlocked
                ? AnastaAnalyticsStyle.crimsonSoft.opacity(0.58)
                : AnastaAnalyticsStyle.goldLight.opacity(0.75)
            )
          Image(systemName: group.isAlwaysBlocked ? "lock.shield.fill" : "square.stack.3d.up.fill")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(
              group.isAlwaysBlocked
                ? AnastaAnalyticsStyle.crimson
                : AnastaAnalyticsStyle.goldDark
            )
        }
        .frame(width: 38, height: 38)

        VStack(alignment: .leading, spacing: 2) {
          Text(group.name)
            .font(.anastaCardTitle)
            .foregroundStyle(AnastaAnalyticsStyle.ink)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
          Text(groupShareCopy(group))
            .font(.anastaCaption)
            .foregroundStyle(AnastaAnalyticsStyle.muted)
        }
        Spacer(minLength: 8)
        VStack(alignment: .trailing, spacing: 2) {
          Text(AnastaAnalyticsStyle.duration(group.duration))
            .font(.anastaBodyStrong)
            .foregroundStyle(AnastaAnalyticsStyle.ink)
            .monospacedDigit()
          if let delta = groupDelta(group) {
            Text(delta)
              .font(.anastaEyebrow)
              .foregroundStyle(AnastaAnalyticsStyle.secondary)
          }
        }
      }

      if configuration.period == .day {
        ForEach(Array(group.applications.prefix(3).enumerated()), id: \.element.id) {
          index,
          application in
          HStack(spacing: 9) {
            Label(application.token)
              .labelStyle(.titleAndIcon)
              .font(.anastaCaption)
              .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
            Spacer(minLength: 6)
            Text(AnastaAnalyticsStyle.duration(application.duration))
              .font(.anastaCaptionStrong)
              .foregroundStyle(AnastaAnalyticsStyle.secondary)
              .monospacedDigit()
          }
          .padding(.leading, 47)
          if index < min(3, group.applications.count) - 1 {
            Divider()
              .padding(.leading, 47)
              .overlay(AnastaAnalyticsStyle.border.opacity(0.7))
          }
        }
      }
    }
    .padding(15)
    .accessibilityElement(children: .contain)
  }

  private var insightCard: some View {
    HStack(alignment: .top, spacing: 13) {
      ZStack {
        Circle().fill(insightTint.opacity(0.11))
        Image(systemName: configuration.insight.symbol)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(insightTint)
      }
      .frame(width: 42, height: 42)
      .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 4) {
        Text("ONE THING WORTH NOTICING")
          .font(.anastaEyebrow)
          .tracking(1.05)
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        Text(configuration.insight.title)
          .font(.anastaCardTitle)
          .foregroundStyle(AnastaAnalyticsStyle.ink)
        Text(configuration.insight.body)
          .font(.anastaCaption)
          .foregroundStyle(AnastaAnalyticsStyle.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      LinearGradient(
        colors: [AnastaAnalyticsStyle.goldLight.opacity(0.55), Color.white.opacity(0.96)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 20, style: .continuous)
        .stroke(AnastaAnalyticsStyle.gold.opacity(0.18), lineWidth: 1)
    )
    .accessibilityElement(children: .combine)
  }

  private var protectionSection: some View {
    VStack(alignment: .leading, spacing: 11) {
      sectionHeading(
        eyebrow: configuration.period == .day ? "HOW PROTECTION HELD" : "PROTECTION CHOICES",
        title: protectionTitle,
        symbol: "shield.lefthalf.filled"
      )

      VStack(spacing: 0) {
        ForEach(Array(protectionItems.enumerated()), id: \.element.label) {
          index,
          item in
          HStack(spacing: 11) {
            Image(systemName: item.symbol)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(item.tint)
              .frame(width: 31, height: 31)
              .background(item.tint.opacity(0.10))
              .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
              Text(item.label)
                .font(.anastaCaptionStrong)
                .foregroundStyle(AnastaAnalyticsStyle.ink)
              if let detail = item.detail {
                Text(detail)
                  .font(.anastaCaption)
                  .foregroundStyle(AnastaAnalyticsStyle.muted)
                  .fixedSize(horizontal: false, vertical: true)
              }
            }
            Spacer(minLength: 6)
            Text(item.value)
              .font(.anastaBodyStrong)
              .foregroundStyle(AnastaAnalyticsStyle.secondary)
              .monospacedDigit()
          }
          .padding(.horizontal, 14)
          .padding(.vertical, 11)
          if index < protectionItems.count - 1 {
            Divider()
              .padding(.leading, 56)
              .overlay(AnastaAnalyticsStyle.border)
          }
        }
      }
      .anastaAnalyticsCard(radius: 19)
    }
  }

  private var yearSummary: some View {
    VStack(alignment: .leading, spacing: 11) {
      sectionHeading(
        eyebrow: "YEAR SUMMARY",
        title: "The scale behind the rhythm",
        symbol: "calendar.badge.clock"
      )
      LazyVGrid(
        columns: yearGridColumns,
        spacing: 9
      ) {
        yearMetric("SELECTED-YEAR TOTAL", AnastaAnalyticsStyle.duration(configuration.selectedTotal))
        yearMetric("COMPLETE-DAY AVG", AnastaAnalyticsStyle.duration(configuration.selectedCompleteDayAverage))
        yearMetric("DAILY TARGET KEPT", targetRateText)
        yearMetric("MANAGED PORTION", managedShareText)
        yearMetric("LIGHTEST COVERED MONTH", lightestMonthText)
        yearMetric("HEAVIEST COVERED MONTH", heaviestMonthText)
      }
    }
  }

  private func yearMetric(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(label)
        .font(.anastaEyebrow)
        .tracking(0.75)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      Text(value)
        .font(.anastaCardTitle)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
        .monospacedDigit()
        .minimumScaleFactor(0.72)
    }
    .padding(14)
    .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
    .anastaAnalyticsCard(radius: 17)
    .accessibilityElement(children: .combine)
  }

  private var coverageNotice: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: coverageSymbol)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(AnastaAnalyticsStyle.goldDark)
      VStack(alignment: .leading, spacing: 3) {
        Text(coverageTitle)
          .font(.anastaCaptionStrong)
          .foregroundStyle(AnastaAnalyticsStyle.ink)
        Text(coverageBody)
          .font(.anastaCaption)
          .foregroundStyle(AnastaAnalyticsStyle.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 2)
    }
    .padding(13)
    .background(AnastaAnalyticsStyle.goldLight.opacity(0.48))
    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 15, style: .continuous)
        .stroke(
          AnastaAnalyticsStyle.gold.opacity(0.22),
          style: StrokeStyle(lineWidth: 1, dash: [4, 3])
        )
    )
    .accessibilityElement(children: .combine)
  }

  private var comparisonUnavailableNotice: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: "arrow.left.arrow.right")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      Text("Not enough matched iPhone activity for a reliable comparison yet.")
        .font(.anastaCaptionStrong)
        .foregroundStyle(AnastaAnalyticsStyle.secondary)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 2)
    }
    .padding(13)
    .background(Color.white.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 15, style: .continuous)
        .stroke(AnastaAnalyticsStyle.border.opacity(0.75), lineWidth: 1)
    )
    .accessibilityElement(children: .combine)
  }

  private var privacyFooter: some View {
    VStack(spacing: 8) {
      HStack(spacing: 7) {
        Image(systemName: "lock.shield")
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        Text("Private Screen Time details stay inside Apple’s activity report.")
          .font(.anastaCaptionStrong)
          .foregroundStyle(AnastaAnalyticsStyle.secondary)
      }
      Text(freshnessCopy)
        .font(.anastaCaption)
        .foregroundStyle(freshnessTint)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.top, 4)
    .accessibilityElement(children: .combine)
  }

  private func unavailableState(_ reason: String) -> some View {
    VStack(spacing: 14) {
      ZStack {
        Circle().fill(AnastaAnalyticsStyle.goldLight.opacity(0.72))
        Image(systemName: "hourglass")
          .font(.system(size: 21, weight: .semibold))
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
      }
      .frame(width: 54, height: 54)
      Text("Preparing your private report")
        .font(.anastaMetric)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
      Text(reason)
        .font(.anastaBody)
        .foregroundStyle(AnastaAnalyticsStyle.secondary)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(23)
    .frame(maxWidth: .infinity, minHeight: 230)
    .anastaAnalyticsCard(radius: 24, emphasized: true)
  }

  private var emptyActivityState: some View {
    VStack(spacing: 14) {
      ZStack {
        Circle().fill(AnastaAnalyticsStyle.sageSoft.opacity(0.65))
        Image(systemName: "moon.zzz")
          .font(.system(size: 21, weight: .semibold))
          .foregroundStyle(AnastaAnalyticsStyle.sage)
      }
      .frame(width: 54, height: 54)
      Text("No iPhone activity in this period")
        .font(.anastaMetric)
        .foregroundStyle(AnastaAnalyticsStyle.ink)
        .multilineTextAlignment(.center)
      Text("If this period is recent, iPhone may still be preparing it.")
        .font(.anastaBody)
        .foregroundStyle(AnastaAnalyticsStyle.secondary)
        .multilineTextAlignment(.center)
    }
    .padding(23)
    .frame(maxWidth: .infinity, minHeight: 230)
    .anastaAnalyticsCard(radius: 24, emphasized: true)
    .accessibilityElement(children: .combine)
  }

  private func sectionHeading(
    eyebrow: String,
    title: String,
    symbol: String
  ) -> some View {
    HStack(alignment: .center, spacing: 9) {
      VStack(alignment: .leading, spacing: 3) {
        Text(eyebrow)
          .font(.anastaEyebrow)
          .tracking(1.2)
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        Text(title)
          .font(.anastaCardTitle)
          .foregroundStyle(AnastaAnalyticsStyle.ink)
      }
      Spacer(minLength: 8)
      Image(systemName: symbol)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(AnastaAnalyticsStyle.goldDark)
        .accessibilityHidden(true)
    }
  }

  private var heroValue: String {
    if hasNoFocusPlan {
      return "No managed activity"
    }
    switch configuration.period {
    case .day:
      return AnastaAnalyticsStyle.duration(configuration.selectedManaged)
    case .week, .month:
      return AnastaAnalyticsStyle.duration(
        configuration.selectedCompleteManagedDayAverage
          ?? (configuration.isCurrentPeriod ? configuration.selectedManaged : nil)
      )
    case .year:
      return AnastaAnalyticsStyle.duration(configuration.selectedTotal)
    }
  }

  private var shouldShowEmptyActivityState: Bool {
    if
      configuration.selectedTotal == 0,
      configuration.coverage.availableUnitCount > 0
    {
      return true
    }
    return configuration.selectedTotal == nil
      && configuration.coverage.kind == .missing
  }

  private var heroCaption: String {
    if hasNoFocusPlan {
      return "No managed activity for this period because no Focus plan covered it"
    }
    switch configuration.period {
    case .day:
      if configuration.isCurrentPeriod {
        return "so far, of \(AnastaAnalyticsStyle.duration(configuration.selectedTotal)) total iPhone activity"
      }
      return "of \(AnastaAnalyticsStyle.duration(configuration.selectedTotal)) total iPhone activity"
    case .week:
      if configuration.isCurrentPeriod
        && configuration.selectedCompleteManagedDayAverage == nil
      {
        return "today so far; the complete-day average appears after the first full day"
      }
      return "per complete day in this seven-day rhythm"
    case .month:
      if configuration.isCurrentPeriod
        && configuration.selectedCompleteManagedDayAverage == nil
      {
        return "today so far; the complete-day average appears after the first full day"
      }
      return "per complete observed day this month"
    case .year:
      return "selected-year iPhone activity"
    }
  }

  private var heroAccessibilityValue: String {
    "Managed activity \(AnastaAnalyticsStyle.longDuration(configuration.selectedManaged))"
  }

  private var selectedOutcome: AnastaAnalyticsDayOutcome? {
    configuration.dayOutcomes.first
  }

  private var signalTitle: String {
    configuration.period == .day ? "How the day felt in motion" : "What supported the rhythm"
  }

  private var signalItems: [SignalItem] {
    switch configuration.period {
    case .day:
      return [
        SignalItem(
          label: "IPHONE PICKUPS",
          value: count(configuration.signals.pickups),
          symbol: "iphone",
          tint: AnastaAnalyticsStyle.goldDark
        ),
        SignalItem(
          label: "FIRST PICKUP",
          value: firstPickupText,
          symbol: "sunrise",
          tint: AnastaAnalyticsStyle.amber
        ),
        SignalItem(
          label: "MANAGED SHARE",
          value: managedShareText,
          symbol: "chart.pie.fill",
          tint: AnastaAnalyticsStyle.crimson
        ),
      ]
    case .week:
      return [
        SignalItem(
          label: "PICKUPS / DAY",
          value: pickupsPerDayText,
          symbol: "hand.tap",
          tint: AnastaAnalyticsStyle.goldDark
        ),
        SignalItem(
          label: "DAILY TARGET KEPT",
          value: targetRateText,
          symbol: "target",
          tint: AnastaAnalyticsStyle.sage
        ),
        SignalItem(
          label: "RETURNED MOMENTS",
          value: count(configuration.localSummary?.returnedMoments),
          symbol: "arrow.uturn.backward.circle.fill",
          tint: AnastaAnalyticsStyle.crimson
        ),
      ]
    case .month:
      return [
        SignalItem(
          label: "PICKUPS / DAY",
          value: pickupsPerDayText,
          symbol: "hand.tap",
          tint: AnastaAnalyticsStyle.goldDark
        ),
        SignalItem(
          label: "DAILY TARGET KEPT",
          value: targetRateText,
          symbol: "target",
          tint: AnastaAnalyticsStyle.sage
        ),
        SignalItem(
          label: "RESOLVED PLAN DAYS",
          value: count(configuration.localSummary?.resolvedTargetDays),
          symbol: "checkmark.seal.fill",
          tint: AnastaAnalyticsStyle.crimson
        ),
      ]
    case .year:
      return []
    }
  }

  private var protectionTitle: String {
    configuration.period == .day
      ? "The choices behind the result"
      : "Choices made when the boundary arrived"
  }

  private var protectionItems: [ProtectionItem] {
    let summary = configuration.localSummary ?? .empty
    var items: [ProtectionItem] = []
    if configuration.period == .day {
      items.append(
        ProtectionItem(
          label: "Daily Target",
          value: targetStateText,
          detail: nil,
          symbol: targetStateSymbol,
          tint: targetStateTint
        )
      )
      items.append(
        ProtectionItem(
          label: "Returned Moments",
          value: "\(summary.returnedMoments)",
          detail: nil,
          symbol: "arrow.uturn.backward.circle",
          tint: AnastaAnalyticsStyle.crimson
        )
      )
    }
    items.append(
      ProtectionItem(
        label: "Extra access chosen",
        value: "\(summary.doorOpened + summary.checkinsContinued)",
        detail: "\(summary.doorOpened) Loose \(summary.doorOpened == 1 ? "door" : "doors") · \(summary.checkinsContinued) \(summary.checkinsContinued == 1 ? "check-in" : "check-ins")",
        symbol: "lock.open",
        tint: AnastaAnalyticsStyle.amber
      )
    )
    items.append(
      ProtectionItem(
        label: "Lower-level limit events",
        value: "\(summary.limitExceeded + summary.zoneBreaches)",
        detail: "\(summary.limitExceeded) limit \(summary.limitExceeded == 1 ? "event" : "events") · \(summary.zoneBreaches) zone \(summary.zoneBreaches == 1 ? "breach" : "breaches")",
        symbol: "gauge.medium",
        tint: AnastaAnalyticsStyle.crimson
      )
    )
    items.append(
      ProtectionItem(
        label: "Quiet Hours started",
        value: "\(summary.quietHoursStarted)",
        detail: nil,
        symbol: "moon.stars.fill",
        tint: AnastaAnalyticsStyle.goldDark
      )
    )
    return items
  }

  private var targetStateText: String {
    guard let outcome = selectedOutcome else { return "Unresolved" }
    switch outcome.state {
    case "kept": return "Kept"
    case "broken": return "Missed"
    case "pending": return "In progress"
    case "noTarget": return "No target"
    case "off": return "Rest day"
    default: return "Unresolved"
    }
  }

  private var selectedTargetText: String {
    guard let targetMinutes = selectedOutcome?.targetMinutes else {
      return selectedOutcome?.hasExactPlanContext == false
        ? "Unavailable"
        : "No target"
    }
    return shortMinutes(targetMinutes)
  }

  private var targetStateSymbol: String {
    switch selectedOutcome?.state {
    case "kept": return "checkmark.circle.fill"
    case "broken": return "xmark.circle.fill"
    case "pending": return "clock.fill"
    default: return "minus.circle"
    }
  }

  private var targetStateTint: Color {
    switch selectedOutcome?.state {
    case "kept": return AnastaAnalyticsStyle.sage
    case "broken": return AnastaAnalyticsStyle.crimson
    default: return AnastaAnalyticsStyle.goldDark
    }
  }

  private var targetRateText: String {
    guard let summary = configuration.localSummary else { return "—" }
    let resolved = summary.keptTargetDays + summary.brokenTargetDays
    guard resolved > 0 else { return "—" }
    return "\(summary.keptTargetDays) of \(resolved)"
  }

  private var pickupsPerDayText: String {
    guard
      let pickups = configuration.signals.pickups,
      configuration.selectedCompleteDayCount > 0
    else { return "—" }
    return String(
      format: "%.0f",
      Double(configuration.signals.completeDayPickups ?? pickups)
        / Double(configuration.selectedCompleteDayCount)
    )
  }

  private var firstPickupText: String {
    guard let firstPickup = configuration.signals.firstPickup else { return "—" }
    let formatter = DateFormatter()
    formatter.calendar = configuration.calendar
    formatter.locale = configuration.locale
    formatter.timeZone = configuration.calendar.timeZone
    formatter.timeStyle = .short
    formatter.dateStyle = .none
    return formatter.string(from: firstPickup)
  }

  private var hasNoFocusPlan: Bool {
    !configuration.dayOutcomes.isEmpty
      && !configuration.dayOutcomes.contains(where: { $0.planId != nil })
  }

  private var signalGridColumns: [GridItem] {
    if dynamicTypeSize.isAccessibilitySize {
      return [GridItem(.flexible())]
    }
    return [GridItem(.adaptive(minimum: 94), spacing: 9)]
  }

  private var yearGridColumns: [GridItem] {
    if dynamicTypeSize.isAccessibilitySize {
      return [GridItem(.flexible())]
    }
    return [GridItem(.adaptive(minimum: 135), spacing: 9)]
  }

  private var managedShareText: String {
    guard
      let managed = configuration.selectedManaged,
      let total = configuration.selectedTotal,
      total > 0
    else { return "—" }
    return "\(Int((managed / total * 100).rounded()))%"
  }

  private var coverageSymbol: String {
    configuration.coverage.kind == .inconsistent
      ? "exclamationmark.triangle"
      : "circle.dotted"
  }

  private var coverageTitle: String {
    switch configuration.coverage.kind {
    case .complete: return "Complete activity"
    case .partial: return "A partial private report"
    case .missing: return "Some activity is not available"
    case .inconsistent: return "Some iPhone detail was inconsistent"
    }
  }

  private var coverageBody: String {
    switch configuration.coverage.kind {
    case .complete:
      return "All expected intervals are represented."
    case .partial:
      return "\(configuration.coverage.availableUnitCount) of \(configuration.coverage.expectedUnitCount) expected intervals are available. Partial intervals are labeled and excluded from complete-day averages."
    case .missing:
      return "Unknown intervals stay empty. Anasta never turns unavailable Screen Time into a zero."
    case .inconsistent:
      return "\(configuration.coverage.invalidUnitCount) interval contained inconsistent private detail. Trustworthy totals remain visible; unavailable detail is withheld instead of being shown as exact."
    }
  }

  private var freshnessCopy: String {
    guard let date = configuration.signals.lastUpdatedDate else {
      return "iPhone controls when private activity becomes available."
    }
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = configuration.locale
    formatter.unitsStyle = .full
    return "Updated by iPhone \(formatter.localizedString(for: date, relativeTo: Date())). Recent intervals may still be revised."
  }

  private var freshnessTint: Color {
    guard
      configuration.isCurrentPeriod,
      let date = configuration.signals.lastUpdatedDate,
      Date().timeIntervalSince(date) > 30 * 60
    else {
      return AnastaAnalyticsStyle.muted
    }
    return AnastaAnalyticsStyle.amber
  }

  private var insightTint: Color {
    switch configuration.insight.tone {
    case .lower: return AnastaAnalyticsStyle.sage
    case .higher: return AnastaAnalyticsStyle.crimson
    case .protective: return AnastaAnalyticsStyle.amber
    case .neutral: return AnastaAnalyticsStyle.goldDark
    }
  }

  private func groupShareCopy(_ group: AnastaAnalyticsGroup) -> String {
    guard let managed = configuration.selectedManaged, managed > 0 else {
      return "Managed group"
    }
    return "\(Int((group.duration / managed * 100).rounded()))% of managed activity"
  }

  private func groupDelta(_ group: AnastaAnalyticsGroup) -> String? {
    guard
      let current = group.currentDailyAverage,
      let previous = group.previousDailyAverage
    else { return nil }
    let delta = current - previous
    if abs(delta) < 60 { return "about the same" }
    return "\(delta < 0 ? "↓" : "↑") \(AnastaAnalyticsStyle.duration(abs(delta)))/day"
  }

  private var lightestMonthText: String {
    coveredMonth(
      sufficientlyCoveredMonths.min {
        ($0.totalDuration ?? TimeInterval.greatestFiniteMagnitude)
          < ($1.totalDuration ?? TimeInterval.greatestFiniteMagnitude)
      }
    )
  }

  private var heaviestMonthText: String {
    coveredMonth(
      sufficientlyCoveredMonths.max {
        ($0.totalDuration ?? -TimeInterval.greatestFiniteMagnitude)
          < ($1.totalDuration ?? -TimeInterval.greatestFiniteMagnitude)
      }
    )
  }

  private var sufficientlyCoveredMonths: [AnastaAnalyticsBucket] {
    configuration.selectedBuckets.filter {
      $0.availability == .available && $0.totalDuration != nil
    }
  }

  private func coveredMonth(_ bucket: AnastaAnalyticsBucket?) -> String {
    guard
      let bucket,
      bucket.availability == .available,
      let total = bucket.totalDuration
    else { return "—" }
    let formatter = DateFormatter()
    formatter.calendar = configuration.calendar
    formatter.locale = configuration.locale
    formatter.timeZone = configuration.calendar.timeZone
    formatter.setLocalizedDateFormatFromTemplate("MMM")
    let month = formatter.string(from: bucket.start)
    return "\(month) · \(AnastaAnalyticsStyle.duration(total))/day"
  }

  private func comparisonCopy(_ comparison: AnastaAnalyticsComparison) -> String {
    if abs(comparison.absoluteDelta) < 60 {
      return "About the same per matched complete day as the previous \(configuration.period.rawValue)."
    }
    let lower = comparison.absoluteDelta < 0
    let direction = lower ? "lower" : "higher"
    return "\(AnastaAnalyticsStyle.duration(abs(comparison.absoluteDelta))) \(direction) per matched complete day than the previous \(configuration.period.rawValue)."
  }

  private func count(_ value: Int?) -> String {
    guard let value else { return "—" }
    return String(value)
  }

  private func shortMinutes(_ value: Int) -> String {
    AnastaAnalyticsStyle.duration(TimeInterval(value * 60))
  }
}

private struct SignalItem {
  let label: String
  let value: String
  let symbol: String
  let tint: Color
}

private struct ProtectionItem {
  let label: String
  let value: String
  let detail: String?
  let symbol: String
  let tint: Color
}

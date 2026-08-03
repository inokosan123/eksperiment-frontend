import Charts
import SwiftUI
import UIKit

struct AnastaAnalyticsPeriodChart: View {
  let configuration: AnastaAnalyticsConfiguration
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var selectedDate: Date?

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 3) {
          Text(chartTitle)
            .font(.anastaCardTitle)
            .foregroundStyle(AnastaAnalyticsStyle.ink)
          Text(chartSubtitle)
            .font(.anastaCaption)
            .foregroundStyle(AnastaAnalyticsStyle.secondary)
        }
        Spacer(minLength: 8)
        HStack(spacing: 10) {
          if configuration.period == .year {
            legend(color: AnastaAnalyticsStyle.crimson, text: "Selected")
            if configuration.comparisonBuckets.contains(where: { $0.totalDuration != nil }) {
              legend(color: AnastaAnalyticsStyle.goldDark, text: "Previous")
            }
          } else {
            legend(color: AnastaAnalyticsStyle.crimson, text: "Managed")
            legend(color: AnastaAnalyticsStyle.stone, text: "Other")
          }
        }
      }

      if configuration.period == .year {
        yearChart
      } else {
        activityChart
      }

      if let bucket = selectedBucket {
        selectedCallout(bucket)
          .transition(reduceMotion ? .opacity : .opacity.combined(with: .move(edge: .top)))
      } else {
        Text(selectionHint)
          .font(.anastaCaption)
          .foregroundStyle(AnastaAnalyticsStyle.muted)
      }
    }
    .padding(17)
    .anastaAnalyticsCard(radius: 20)
    .onChange(of: configuration.requestId) { _ in
      selectedDate = nil
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(accessibilitySummary)
  }

  private var activityChart: some View {
    Chart {
      ForEach(configuration.selectedBuckets) { bucket in
        if
          let total = bucket.totalDuration,
          let managed = bucket.managedDuration
        {
          BarMark(
            x: .value("Period", bucket.start),
            y: .value("Managed activity", managed)
          )
          .foregroundStyle(AnastaAnalyticsStyle.crimson)
          .opacity(bucket.availability == .partialToday ? 0.66 : 0.92)
          .accessibilityLabel(Text(bucketLabel(bucket.start)))
          .accessibilityValue(Text(bucketAccessibilityValue(bucket)))

          BarMark(
            x: .value("Period", bucket.start),
            y: .value("Other activity", max(0, total - managed))
          )
          .foregroundStyle(AnastaAnalyticsStyle.stone)
          .opacity(bucket.availability == .partialToday ? 0.50 : 0.82)
          .accessibilityHidden(true)
          .annotation(position: .top, spacing: 3) {
            if bucket.availability == .partialToday {
              Text("SO FAR")
                .font(.anastaEyebrow)
                .tracking(0.55)
                .foregroundStyle(AnastaAnalyticsStyle.goldDark)
            }
          }

          if configuration.period != .day, let target = bucket.targetMinutes {
            PointMark(
              x: .value("Period", bucket.start),
              y: .value("Daily Target", Double(target * 60))
            )
            .symbol {
              Capsule()
                .fill(AnastaAnalyticsStyle.goldDark)
                .frame(width: configuration.period == .month ? 7 : 13, height: 2)
            }
            .accessibilityHidden(true)
          }
        } else if let total = bucket.totalDuration {
          BarMark(
            x: .value("Period", bucket.start),
            y: .value("Total iPhone activity", total)
          )
          .foregroundStyle(AnastaAnalyticsStyle.stone.opacity(0.38))
          .accessibilityLabel(Text(bucketLabel(bucket.start)))
          .accessibilityValue(
            Text(
              "Total iPhone activity \(AnastaAnalyticsStyle.longDuration(total)). Managed activity details unavailable."
            )
          )
          .annotation(position: .top, spacing: 3) {
            Text("TOTAL")
              .font(.anastaEyebrow)
              .tracking(0.55)
              .foregroundStyle(AnastaAnalyticsStyle.muted)
          }
        } else if bucket.availability != .future {
          PointMark(
            x: .value("Period", bucket.start),
            y: .value("Unavailable", 0)
          )
          .symbol {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
              .stroke(
                AnastaAnalyticsStyle.muted.opacity(0.55),
                style: StrokeStyle(lineWidth: 1, dash: [2, 2])
              )
              .frame(width: configuration.period == .month ? 6 : 12, height: 8)
          }
          .accessibilityLabel(Text(bucketLabel(bucket.start)))
          .accessibilityValue(Text("Activity unavailable"))
        }
      }
    }
    .chartYAxis {
      AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
        AxisGridLine().foregroundStyle(AnastaAnalyticsStyle.border.opacity(0.65))
        AxisValueLabel {
          if let seconds = value.as(Double.self) {
            Text(axisDuration(seconds))
          }
        }
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      }
    }
    .chartXAxis {
      AxisMarks(values: xAxisValues) { value in
        AxisValueLabel(format: xAxisFormat)
          .font(.anastaEyebrow)
          .foregroundStyle(AnastaAnalyticsStyle.muted)
      }
    }
    .chartPlotStyle { plot in
      plot
        .background(AnastaAnalyticsStyle.background.opacity(0.54))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        Rectangle()
          .fill(.clear)
          .contentShape(Rectangle())
          .gesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                let frame = geometry[proxy.plotAreaFrame]
                let x = value.location.x - frame.origin.x
                guard
                  x >= 0,
                  x <= frame.width,
                  let date: Date = proxy.value(atX: x)
                else { return }
                if let nearest = nearestDate(to: date) {
                  select(nearest)
                }
              }
          )
      }
    }
    .frame(height: configuration.period == .day ? 190 : 205)
  }

  private var yearChart: some View {
    Chart {
      ForEach(Array(configuration.selectedBuckets.enumerated()), id: \.element.id) {
        index,
        bucket in
        if let total = bucket.totalDuration {
          BarMark(
            x: .value("Month", index + 1),
            y: .value("Selected year", total)
          )
          .foregroundStyle(AnastaAnalyticsStyle.crimson.opacity(0.78))
          .opacity(bucket.availability == .partialToday ? 0.48 : 0.86)
          .cornerRadius(3)
          .accessibilityLabel(Text(bucketLabel(bucket.start)))
          .accessibilityValue(
            Text(
              "Selected-year daily average \(AnastaAnalyticsStyle.longDuration(total))"
            )
          )
          .annotation(position: .top, spacing: 3) {
            if bucket.availability == .partialToday {
              Text("SO FAR")
                .font(.anastaEyebrow)
                .tracking(0.55)
                .foregroundStyle(AnastaAnalyticsStyle.goldDark)
            }
          }
        }
      }
      ForEach(Array(configuration.comparisonBuckets.enumerated()), id: \.element.id) {
        index,
        bucket in
        if let total = bucket.totalDuration {
          LineMark(
            x: .value("Month", index + 1),
            y: .value("Previous year", total)
          )
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
          .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
          .interpolationMethod(.catmullRom)
          .accessibilityLabel(Text("Previous year, \(bucketLabel(bucket.start))"))
          .accessibilityValue(
            Text(
              "Daily average \(AnastaAnalyticsStyle.longDuration(total))"
            )
          )
        }
      }
    }
    .chartXAxis {
      AxisMarks(values: [1, 3, 5, 7, 9, 11]) { value in
        AxisValueLabel {
          if let month = value.as(Int.self) {
            Text(monthSymbol(month))
          }
        }
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      }
    }
    .chartYAxis {
      AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
        AxisGridLine().foregroundStyle(AnastaAnalyticsStyle.border.opacity(0.65))
        AxisValueLabel {
          if let seconds = value.as(Double.self) {
            Text(axisDuration(seconds))
          }
        }
        .foregroundStyle(AnastaAnalyticsStyle.muted)
      }
    }
    .chartPlotStyle { plot in
      plot
        .background(AnastaAnalyticsStyle.background.opacity(0.54))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        Rectangle()
          .fill(.clear)
          .contentShape(Rectangle())
          .gesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                let frame = geometry[proxy.plotAreaFrame]
                let x = value.location.x - frame.origin.x
                guard
                  x >= 0,
                  x <= frame.width,
                  let month: Int = proxy.value(atX: x),
                  !configuration.selectedBuckets.isEmpty
                else { return }
                let index = max(
                  0,
                  min(configuration.selectedBuckets.count - 1, month - 1)
                )
                select(configuration.selectedBuckets[index].start)
              }
          )
      }
    }
    .frame(height: 205)
  }

  private func selectedCallout(_ bucket: AnastaAnalyticsBucket) -> some View {
    HStack(spacing: 10) {
      Image(systemName: "scope")
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(AnastaAnalyticsStyle.goldDark)
      VStack(alignment: .leading, spacing: 2) {
        Text(bucketLabel(bucket.start))
          .font(.anastaCaptionStrong)
          .foregroundStyle(AnastaAnalyticsStyle.ink)
        Text(selectedCalloutValue(bucket))
        .font(.anastaCaption)
        .foregroundStyle(AnastaAnalyticsStyle.secondary)
      }
      Spacer(minLength: 4)
      if bucket.availability == .partialToday {
        Text("SO FAR")
          .font(.anastaEyebrow)
          .tracking(0.8)
          .foregroundStyle(AnastaAnalyticsStyle.goldDark)
      }
    }
    .padding(10)
    .background(AnastaAnalyticsStyle.goldLight.opacity(0.55))
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "\(bucketLabel(bucket.start)). \(bucketAccessibilityValue(bucket))"
    )
  }

  private func legend(color: Color, text: String) -> some View {
    HStack(spacing: 4) {
      Circle().fill(color).frame(width: 6, height: 6)
      Text(text)
        .font(.anastaEyebrow)
        .foregroundStyle(AnastaAnalyticsStyle.muted)
    }
  }

  private var selectedBucket: AnastaAnalyticsBucket? {
    guard let selectedDate else { return nil }
    return configuration.selectedBuckets.min {
      abs($0.start.timeIntervalSince(selectedDate))
        < abs($1.start.timeIntervalSince(selectedDate))
    }
  }

  private func nearestDate(to value: Date) -> Date? {
    configuration.selectedBuckets.min {
      abs($0.start.timeIntervalSince(value))
        < abs($1.start.timeIntervalSince(value))
    }?.start
  }

  private func select(_ date: Date) {
    guard selectedDate != date else { return }
    UISelectionFeedbackGenerator().selectionChanged()
    selectedDate = date
  }

  private var chartTitle: String {
    switch configuration.period {
    case .day: return "Hourly rhythm"
    case .week: return "Your seven-day rhythm"
    case .month: return "The month, day by day"
    case .year: return "Twelve months in view"
    }
  }

  private var chartSubtitle: String {
    switch configuration.period {
    case .day: return "Where managed activity gathered across the day"
    case .week: return "Managed and other iPhone activity, Monday through Sunday"
    case .month: return "Daily activity with your target held in view"
    case .year: return "Monthly iPhone activity beside the previous year"
    }
  }

  private var selectionHint: String {
    if configuration.period != .year {
      return "Touch or glide across the chart to inspect a moment."
    }
    return configuration.comparisonBuckets.contains(where: { $0.totalDuration != nil })
      ? "Bars show the selected year; the dotted line shows the previous year."
      : "Only the selected year is shown because previous-year coverage is unavailable."
  }

  private var accessibilitySummary: String {
    "\(chartTitle). \(chartSubtitle). \(configuration.coverage.availableUnitCount) of \(configuration.coverage.expectedUnitCount) expected units are available."
  }

  private var xAxisValues: AxisMarkValues {
    switch configuration.period {
    case .day: return .stride(by: .hour, count: 5)
    case .week: return .stride(by: .day, count: 1)
    case .month: return .stride(by: .day, count: 7)
    case .year: return .automatic
    }
  }

  private var xAxisFormat: Date.FormatStyle {
    switch configuration.period {
    case .day:
      return .dateTime.hour(.defaultDigits(amPM: .abbreviated))
    case .week:
      return .dateTime.weekday(.narrow)
    case .month:
      return .dateTime.day()
    case .year:
      return .dateTime.month(.narrow)
    }
  }

  private func axisDuration(_ seconds: Double) -> String {
    let hours = seconds / 3600
    if hours < 1 { return "\(Int((seconds / 60).rounded()))m" }
    return hours.rounded() == hours
      ? "\(Int(hours))h"
      : String(format: "%.1fh", hours)
  }

  private func bucketLabel(_ date: Date) -> String {
    switch configuration.period {
    case .day:
      return formattedDate(date, template: "j")
    case .week, .month:
      return formattedDate(date, template: "EEEE MMM d")
    case .year:
      return formattedDate(date, template: "MMMM y")
    }
  }

  private func formattedDate(_ date: Date, template: String) -> String {
    let formatter = DateFormatter()
    formatter.calendar = configuration.calendar
    formatter.locale = configuration.locale
    formatter.timeZone = configuration.calendar.timeZone
    formatter.setLocalizedDateFormatFromTemplate(template)
    return formatter.string(from: date)
  }

  private func bucketAccessibilityValue(
    _ bucket: AnastaAnalyticsBucket
  ) -> String {
    var parts = [
      "Managed activity \(AnastaAnalyticsStyle.longDuration(bucket.managedDuration))",
      "Total iPhone activity \(AnastaAnalyticsStyle.longDuration(bucket.totalDuration))",
    ]
    if let targetMinutes = bucket.targetMinutes {
      let target = AnastaAnalyticsStyle.longDuration(
        TimeInterval(targetMinutes * 60)
      )
      let state = targetState(for: bucket.start)
      if let state {
        parts.append("Daily Target \(target), \(state)")
      } else {
        parts.append("Daily Target \(target)")
      }
    }
    if bucket.availability == .partialToday {
      parts.append("So far")
    }
    return parts.joined(separator: ". ")
  }

  private func selectedCalloutValue(
    _ bucket: AnastaAnalyticsBucket
  ) -> String {
    guard bucket.managedDuration != nil else {
      return "Total \(AnastaAnalyticsStyle.duration(bucket.totalDuration)) · Managed details unavailable"
    }
    return "Managed \(AnastaAnalyticsStyle.duration(bucket.managedDuration)) · Total \(AnastaAnalyticsStyle.duration(bucket.totalDuration))"
  }

  private func targetState(for date: Date) -> String? {
    let state = configuration.dayOutcomes.first {
      guard let outcomeDate = dateFromDayKey($0.date) else { return false }
      return configuration.calendar.isDate(
        outcomeDate,
        inSameDayAs: date
      )
    }?.state
    switch state {
    case "kept": return "kept"
    case "broken": return "missed"
    case "pending": return "in progress"
    case "noTarget": return "no target"
    case "off": return "rest day"
    default: return nil
    }
  }

  private func dateFromDayKey(_ value: String) -> Date? {
    let formatter = DateFormatter()
    formatter.calendar = configuration.calendar
    formatter.timeZone = configuration.calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value)
  }

  private func monthSymbol(_ value: Int) -> String {
    let formatter = DateFormatter()
    formatter.calendar = configuration.calendar
    formatter.locale = configuration.locale
    formatter.timeZone = configuration.calendar.timeZone
    let symbols = formatter.shortMonthSymbols ?? []
    let index = max(0, min(11, value - 1))
    return index < symbols.count ? symbols[index] : "\(value)"
  }
}

import DeviceActivity
import ExpoModulesCore
import Foundation
import SwiftUI
import UIKit

extension DeviceActivityReport.Context {
  static let anastaDaily = Self("anasta.daily")
  static let anastaTrend = Self("anasta.trend")
  static let anastaAnalyticsDay = Self("anasta.analytics.day")
  static let anastaAnalyticsWeek = Self("anasta.analytics.week")
  static let anastaAnalyticsMonth = Self("anasta.analytics.month")
  static let anastaAnalyticsYear = Self("anasta.analytics.year")
}

final class AnastaActivityReportView: ExpoView {
  private static let analyticsMountLock = NSLock()
  private static var activeAnalyticsMounts = 0

  var date: String = "" {
    didSet { renderLegacy() }
  }
  var days: Int = 1 {
    didSet { renderLegacy() }
  }
  var startMinutes: Int = -1 {
    didSet { renderLegacy() }
  }
  var endMinutes: Int = -1 {
    didSet { renderLegacy() }
  }
  var analyticsRequestJson: String = "" {
    didSet { renderAnalyticsRequest() }
  }

  private var hostingController: UIHostingController<AnyView>?
  private weak var containingController: UIViewController?
  private var renderedAnalyticsRequestId: String?
  private var attachedAnalyticsReport = false

  private struct AnalyticsRequest: Decodable {
    let schemaVersion: Int
    let requestId: String
    let timezone: String
    let period: String
    let selectedStartDate: String
    let selectedEndDateExclusive: String
    let comparisonStartDate: String?
    let comparisonEndDateExclusive: String?
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }

  deinit {
    detachCurrentReport()
  }

  private func renderLegacy() {
    guard analyticsRequestJson.isEmpty else { return }
    let formatter = DateFormatter()
    formatter.calendar = .autoupdatingCurrent
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    let selectedDate = formatter.date(from: date) ?? Date()
    let calendar = Calendar.autoupdatingCurrent
    let selectedDay = calendar.startOfDay(for: selectedDate)
    let safeDays = max(1, min(days, 31))
    let fullStart = calendar.date(byAdding: .day, value: -(safeDays - 1), to: selectedDay) ?? selectedDay
    let fullEnd = calendar.date(byAdding: .day, value: 1, to: selectedDay) ?? selectedDate
    let hasSessionScope = safeDays == 1 && startMinutes >= 0 && endMinutes >= 0
    let current = calendar.dateComponents([.hour, .minute], from: Date())
    let currentMinute = (current.hour ?? 0) * 60 + (current.minute ?? 0)
    let wrappedSessionContinuesFromYesterday = hasSessionScope
      && endMinutes <= startMinutes
      && currentMinute < endMinutes
    let start = hasSessionScope
      ? wrappedSessionContinuesFromYesterday
        ? selectedDay
        : calendar.date(byAdding: .minute, value: startMinutes, to: selectedDay) ?? selectedDay
      : fullStart
    let sessionEndDay = endMinutes <= startMinutes && !wrappedSessionContinuesFromYesterday
      ? calendar.date(byAdding: .day, value: 1, to: selectedDay) ?? selectedDay
      : selectedDay
    let end = hasSessionScope
      ? calendar.date(byAdding: .minute, value: endMinutes, to: sessionEndDay) ?? fullEnd
      : fullEnd
    let interval = DateInterval(start: start, end: end)
    let segment: DeviceActivityFilter.SegmentInterval = safeDays > 1
      ? .daily(during: interval)
      : .hourly(during: interval)
    let filter = DeviceActivityFilter(
      segment: segment,
      users: .all,
      devices: .init([.iPhone])
    )
    let context: DeviceActivityReport.Context = safeDays > 1 ? .anastaTrend : .anastaDaily
    attachReport(context: context, filter: filter, isAnalytics: false)
  }

  private func renderAnalyticsRequest() {
    guard !analyticsRequestJson.isEmpty else {
      renderedAnalyticsRequestId = nil
      detachCurrentReport()
      return
    }
    guard
      let data = analyticsRequestJson.data(using: .utf8),
      let request = try? JSONDecoder().decode(AnalyticsRequest.self, from: data),
      request.schemaVersion == 1,
      !request.requestId.isEmpty,
      request.requestId != renderedAnalyticsRequestId,
      analyticsContextIsCurrent(request),
      let selectedStart = parseDay(
        request.selectedStartDate,
        timezone: request.timezone
      ),
      let selectedEndBoundary = parseDay(
        request.selectedEndDateExclusive,
        timezone: request.timezone
      )
    else { return }

    let filterStart = request.comparisonStartDate.flatMap {
      parseDay($0, timezone: request.timezone)
    } ?? selectedStart
    let now = Date()
    let filterEnd = min(selectedEndBoundary, now)
    guard filterStart < filterEnd else { return }

    let interval = DateInterval(start: filterStart, end: filterEnd)
    let segment: DeviceActivityFilter.SegmentInterval = request.period == "day"
      ? .hourly(during: interval)
      : .daily(during: interval)
    let context: DeviceActivityReport.Context
    switch request.period {
    case "day": context = .anastaAnalyticsDay
    case "week": context = .anastaAnalyticsWeek
    case "month": context = .anastaAnalyticsMonth
    case "year": context = .anastaAnalyticsYear
    default: return
    }
    let filter = DeviceActivityFilter(
      segment: segment,
      users: .all,
      devices: .init([.iPhone])
    )
    renderedAnalyticsRequestId = request.requestId
    attachReport(context: context, filter: filter, isAnalytics: true)
  }

  private func analyticsContextIsCurrent(
    _ request: AnalyticsRequest
  ) -> Bool {
    guard
      let appGroup = Bundle.main.object(
        forInfoDictionaryKey: "AnastaFocusAppGroup"
      ) as? String,
      !appGroup.isEmpty,
      let defaults = UserDefaults(suiteName: appGroup),
      defaults.string(
        forKey: "anasta.focus.analytics-context.current.v1"
      ) == request.requestId,
      let json = defaults.string(
        forKey: "anasta.focus.analytics-context.request.\(request.requestId).v1"
      ),
      let data = json.data(using: .utf8),
      let envelope = try? JSONDecoder().decode(
        AnalyticsRequest.self,
        from: data
      )
    else { return false }

    return envelope.schemaVersion == request.schemaVersion
      && envelope.requestId == request.requestId
      && envelope.timezone == request.timezone
      && envelope.period == request.period
      && envelope.selectedStartDate == request.selectedStartDate
      && envelope.selectedEndDateExclusive
        == request.selectedEndDateExclusive
      && envelope.comparisonStartDate == request.comparisonStartDate
      && envelope.comparisonEndDateExclusive
        == request.comparisonEndDateExclusive
  }

  private func parseDay(_ value: String, timezone: String) -> Date? {
    let formatter = DateFormatter()
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: timezone) ?? .autoupdatingCurrent
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value).map {
      calendar.startOfDay(for: $0)
    }
  }

  private func attachReport(
    context: DeviceActivityReport.Context,
    filter: DeviceActivityFilter,
    isAnalytics: Bool
  ) {
    // The report is an out-of-process remote view. Detach first so the old and
    // new configurations are never simultaneously present in the hierarchy.
    detachCurrentReport()

    let report = DeviceActivityReport(context, filter: filter)
    let controller = UIHostingController(rootView: AnyView(report))
    controller.view.backgroundColor = .clear
    hostingController = controller
    if isAnalytics {
      Self.analyticsMountLock.lock()
      Self.activeAnalyticsMounts += 1
      let activeMounts = Self.activeAnalyticsMounts
      Self.analyticsMountLock.unlock()
      attachedAnalyticsReport = true
      #if DEBUG
      assert(
        activeMounts == 1,
        "Focus Analytics mounted more than one DeviceActivityReport."
      )
      #endif
    }
    if let parent = appContext?.utilities?.currentViewController() {
      parent.addChild(controller)
      containingController = parent
    }
    addSubview(controller.view)
    controller.didMove(toParent: containingController)
    setNeedsLayout()
  }

  private func detachCurrentReport() {
    guard let controller = hostingController else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    hostingController = nil
    containingController = nil
    if attachedAnalyticsReport {
      Self.analyticsMountLock.lock()
      Self.activeAnalyticsMounts = max(0, Self.activeAnalyticsMounts - 1)
      Self.analyticsMountLock.unlock()
      attachedAnalyticsReport = false
    }
  }
}

import DeviceActivity
import ExpoModulesCore
import SwiftUI
import UIKit

extension DeviceActivityReport.Context {
  static let anastaDaily = Self("anasta.daily")
  static let anastaTrend = Self("anasta.trend")
}

final class AnastaActivityReportView: ExpoView {
  var date: String = "" {
    didSet { render() }
  }
  var days: Int = 1 {
    didSet { render() }
  }

  private var hostingController: UIHostingController<AnyView>?
  private weak var containingController: UIViewController?

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

  private func render() {
    let formatter = DateFormatter()
    formatter.calendar = .autoupdatingCurrent
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    let selectedDate = formatter.date(from: date) ?? Date()
    let calendar = Calendar.autoupdatingCurrent
    let selectedDay = calendar.startOfDay(for: selectedDate)
    let safeDays = max(1, min(days, 31))
    let start = calendar.date(byAdding: .day, value: -(safeDays - 1), to: selectedDay) ?? selectedDay
    let end = calendar.date(byAdding: .day, value: 1, to: selectedDay) ?? selectedDate
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
    let report = DeviceActivityReport(context, filter: filter)
    let controller = UIHostingController(rootView: AnyView(report))
    controller.view.backgroundColor = .clear

    detachCurrentReport()
    hostingController = controller
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
  }
}

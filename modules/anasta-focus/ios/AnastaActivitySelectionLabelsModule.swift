import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

public final class AnastaActivitySelectionLabelsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AnastaFocusLabels")

    View(AnastaActivitySelectionLabelsView.self) {
      Prop("selectionId") { (view: AnastaActivitySelectionLabelsView, selectionId: String) in
        view.selectionId = selectionId
      }
      Prop("refreshKey") { (view: AnastaActivitySelectionLabelsView, refreshKey: Int) in
        view.refreshKey = refreshKey
      }
      Prop("maxItems") { (view: AnastaActivitySelectionLabelsView, maxItems: Int) in
        view.maxItems = maxItems
      }
    }
  }
}

final class AnastaActivitySelectionLabelsView: ExpoView {
  var selectionId = "" {
    didSet { reloadSelection() }
  }
  var refreshKey = 0 {
    didSet { reloadSelection() }
  }
  var maxItems = 4 {
    didSet { reloadSelection() }
  }

  private var hostingController: UIHostingController<AnyView>?
  private weak var containingController: UIViewController?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = false
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }

  deinit {
    detachContent()
  }

  private func reloadSelection() {
    guard !selectionId.isEmpty else { return }
    let selection = AnastaSelectionStore.load(selectionId: selectionId)
    let content = AnastaActivitySelectionLabelsContent(
      applications: Self.sorted(selection.applicationTokens),
      categories: Self.sorted(selection.categoryTokens),
      webDomains: Self.sorted(selection.webDomainTokens),
      maxItems: max(1, min(maxItems, 8))
    )

    if let controller = hostingController {
      controller.rootView = AnyView(content)
      return
    }

    let controller = UIHostingController(rootView: AnyView(content))
    controller.view.backgroundColor = .clear
    controller.view.isUserInteractionEnabled = false
    hostingController = controller

    if let parent = appContext?.utilities?.currentViewController() {
      parent.addChild(controller)
      containingController = parent
      addSubview(controller.view)
      controller.didMove(toParent: parent)
    } else {
      addSubview(controller.view)
    }
    setNeedsLayout()
  }

  private func detachContent() {
    guard let controller = hostingController else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    hostingController = nil
    containingController = nil
  }

  private static func sorted<Token: Hashable & Encodable>(_ tokens: Set<Token>) -> [Token] {
    tokens.sorted { stableKey($0) < stableKey($1) }
  }

  private static func stableKey<Token: Encodable>(_ token: Token) -> String {
    (try? JSONEncoder().encode(token).base64EncodedString()) ?? ""
  }
}

private struct AnastaActivitySelectionLabelsContent: View {
  let applications: [ApplicationToken]
  let categories: [ActivityCategoryToken]
  let webDomains: [WebDomainToken]
  let maxItems: Int

  private var totalCount: Int {
    applications.count + categories.count + webDomains.count
  }

  var body: some View {
    let visibleApplications = Array(applications.prefix(maxItems))
    let categorySlots = max(0, maxItems - visibleApplications.count)
    let visibleCategories = Array(categories.prefix(categorySlots))
    let webDomainSlots = max(0, categorySlots - visibleCategories.count)
    let visibleWebDomains = Array(webDomains.prefix(webDomainSlots))
    let visibleCount = visibleApplications.count + visibleCategories.count + visibleWebDomains.count
    let remainingCount = max(0, totalCount - visibleCount)

    VStack(spacing: 0) {
      header
      Divider().overlay(border.opacity(0.7))

      ForEach(visibleApplications, id: \.self) { token in
        applicationRow(token)
      }
      ForEach(visibleCategories, id: \.self) { token in
        categoryRow(token)
      }
      ForEach(visibleWebDomains, id: \.self) { token in
        webDomainRow(token)
      }

      if remainingCount > 0 {
        Text("+\(remainingCount) more \(remainingCount == 1 ? "selection" : "selections")")
          .font(.system(size: 10, weight: .semibold, design: .rounded))
          .foregroundStyle(secondary)
          .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
          .padding(.horizontal, 13)
          .background(gold.opacity(0.035))
      }
    }
    .background(
      LinearGradient(
        colors: [Color.white.opacity(0.96), cream],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 17, style: .continuous)
        .stroke(border, lineWidth: 1)
    )
  }

  private var header: some View {
    HStack(spacing: 8) {
      ZStack {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
          .fill(gold.opacity(0.11))
        Image(systemName: "checkmark.shield.fill")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(gold)
      }
      .frame(width: 29, height: 29)

      VStack(alignment: .leading, spacing: 1) {
        Text("SELECTED ON THIS IPHONE")
          .font(.system(size: 7.5, weight: .bold, design: .rounded))
          .tracking(1.05)
          .foregroundStyle(gold)
        Text("Apple keeps these labels private")
          .font(.system(size: 9, weight: .medium))
          .foregroundStyle(secondary)
      }

      Spacer(minLength: 6)

      Text("\(totalCount)")
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(ink)
        .frame(minWidth: 27, minHeight: 27)
        .background(Color.white.opacity(0.7))
        .clipShape(Circle())
        .overlay(Circle().stroke(border.opacity(0.8), lineWidth: 1))
    }
    .frame(height: 46)
    .padding(.horizontal, 12)
  }

  private func applicationRow(_ token: ApplicationToken) -> some View {
    nativeRow {
      Label(token)
        .labelStyle(.titleAndIcon)
        .font(.system(size: 14, weight: .medium))
        .lineLimit(1)
    }
  }

  private func categoryRow(_ token: ActivityCategoryToken) -> some View {
    nativeRow {
      Label(token)
        .labelStyle(.titleAndIcon)
        .font(.system(size: 14, weight: .medium))
        .lineLimit(1)
    }
  }

  private func webDomainRow(_ token: WebDomainToken) -> some View {
    nativeRow {
      Label(token)
        .labelStyle(.titleAndIcon)
        .font(.system(size: 14, weight: .medium))
        .lineLimit(1)
    }
  }

  private func nativeRow<Content: View>(
    @ViewBuilder content: () -> Content
  ) -> some View {
    HStack(spacing: 9) {
      content()
      Spacer(minLength: 8)
      Image(systemName: "checkmark")
        .font(.system(size: 8, weight: .bold))
        .foregroundStyle(gold)
        .frame(width: 22, height: 22)
        .background(gold.opacity(0.09))
        .clipShape(Circle())
    }
    .padding(.horizontal, 13)
    .frame(height: 42)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(border.opacity(0.55))
        .frame(height: 0.5)
        .padding(.leading, 43)
    }
  }

  private var ink: Color { Color(red: 0.16, green: 0.14, blue: 0.11) }
  private var secondary: Color { Color(red: 0.47, green: 0.44, blue: 0.40) }
  private var gold: Color { Color(red: 0.63, green: 0.45, blue: 0.16) }
  private var cream: Color { Color(red: 1.0, green: 0.98, blue: 0.92) }
  private var border: Color { Color(red: 0.88, green: 0.81, blue: 0.65) }
}

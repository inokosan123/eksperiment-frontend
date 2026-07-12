import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

private struct AnastaActivityPickerScreen: View {
  let title: String
  let initialSelection: FamilyActivitySelection
  let onCancel: () -> Void
  let onSave: (FamilyActivitySelection) -> Void

  @State private var selection: FamilyActivitySelection

  init(
    title: String,
    initialSelection: FamilyActivitySelection,
    onCancel: @escaping () -> Void,
    onSave: @escaping (FamilyActivitySelection) -> Void
  ) {
    self.title = title
    self.initialSelection = initialSelection
    self.onCancel = onCancel
    self.onSave = onSave
    _selection = State(initialValue: initialSelection)
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Save") { onSave(selection) }
              .fontWeight(.semibold)
          }
        }
    }
  }
}

final class AnastaActivityPickerSession: NSObject, UIAdaptivePresentationControllerDelegate {
  private let selectionId: String
  private weak var presenter: UIViewController?
  private let promise: Promise
  private let onFinish: () -> Void
  private var controller: UIViewController?
  private var settled = false

  init(
    selectionId: String,
    title: String,
    presenter: UIViewController,
    promise: Promise,
    onFinish: @escaping () -> Void
  ) {
    self.selectionId = selectionId
    self.presenter = presenter
    self.promise = promise
    self.onFinish = onFinish
    super.init()

    let screen = AnastaActivityPickerScreen(
      title: title,
      initialSelection: AnastaSelectionStore.load(selectionId: selectionId),
      onCancel: { [weak self] in self?.cancel() },
      onSave: { [weak self] selection in self?.save(selection) }
    )
    let hostingController = UIHostingController(rootView: screen)
    hostingController.modalPresentationStyle = .formSheet
    controller = hostingController
  }

  func present() {
    guard let controller, let presenter else {
      promise.reject("ERR_PICKER", "The activity picker could not be created.")
      finish()
      return
    }
    presenter.present(controller, animated: true) { [weak self, weak controller] in
      controller?.presentationController?.delegate = self
    }
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    cancel(dismiss: false)
  }

  private func save(_ selection: FamilyActivitySelection) {
    guard !settled else { return }
    let result = AnastaSelectionStore.saveFromPicker(selection, selectionId: selectionId)
    AnastaFocusEngine.selectionDidChange(selectionId: selectionId)
    settled = true
    controller?.dismiss(animated: true) { [weak self] in
      guard let self else { return }
      self.promise.resolve(result)
      self.finish()
    }
  }

  private func cancel(dismiss: Bool = true) {
    guard !settled else { return }
    settled = true
    let complete = { [weak self] in
      guard let self else { return }
      self.promise.resolve(AnastaSelectionStore.summary(selectionId: self.selectionId))
      self.finish()
    }
    if dismiss { controller?.dismiss(animated: true, completion: complete) }
    else { complete() }
  }

  private func finish() {
    controller = nil
    onFinish()
  }
}

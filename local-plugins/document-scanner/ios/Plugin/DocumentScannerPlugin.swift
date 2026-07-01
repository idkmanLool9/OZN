import Foundation
import Capacitor
import VisionKit
import UIKit

// Capacitor-plugin dat Apple's eigen documentscanner opent
// (VNDocumentCameraViewController — dezelfde als "Scan Document" in de
// Camera/Notities/Bestanden-app: randherkenning, recht trekken, meerdere
// pagina's). Geeft de gescande pagina's terug als data-URL's (JPEG).
@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DocumentScannerPlugin"
    public let jsName = "DocumentScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    private var savedCall: CAPPluginCall?

    @objc func scan(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("De documentscanner wordt niet ondersteund op dit toestel.")
            return
        }
        savedCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let vc = VNDocumentCameraViewController()
            vc.delegate = self
            self.bridge?.viewController?.present(vc, animated: true, completion: nil)
        }
    }
}

extension DocumentScannerPlugin: VNDocumentCameraViewControllerDelegate {
    public func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                             didFinishWith scan: VNDocumentCameraScan) {
        var images: [String] = []
        for i in 0..<scan.pageCount {
            if let data = scan.imageOfPage(at: i).jpegData(compressionQuality: 0.85) {
                images.append("data:image/jpeg;base64," + data.base64EncodedString())
            }
        }
        controller.dismiss(animated: true) { [weak self] in
            self?.savedCall?.resolve(["images": images])
            self?.savedCall = nil
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true) { [weak self] in
            self?.savedCall?.resolve(["images": [], "cancelled": true])
            self?.savedCall = nil
        }
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                             didFailWithError error: Error) {
        controller.dismiss(animated: true) { [weak self] in
            self?.savedCall?.reject("Scannen mislukt: \(error.localizedDescription)")
            self?.savedCall = nil
        }
    }
}

import SwiftUI
import WebKit

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0xD7 / 255, green: 0xE6 / 255, blue: 0xF4 / 255, alpha: 1)
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        view.isInspectable = true
        #endif
        if let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            view.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url,
               url.scheme == "https" || url.scheme == "http" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

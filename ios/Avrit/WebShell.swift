import SwiftUI
import WebKit
import UserNotifications

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "avritFeedback")
        configuration.userContentController.add(context.coordinator, name: "avritReminders")
        let view = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = view
        UNUserNotificationCenter.current().delegate = context.coordinator
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0xF6 / 255, green: 0xF5 / 255, blue: 0xF0 / 255, alpha: 1)
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

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "avritFeedback")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "avritReminders")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
        weak var webView: WKWebView?
        private let selection = UISelectionFeedbackGenerator()
        private let impact = UIImpactFeedbackGenerator(style: .soft)

        override init() {
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(refreshReminders), name: UIApplication.didBecomeActiveNotification, object: nil)
        }
        deinit { NotificationCenter.default.removeObserver(self) }
        @objc private func refreshReminders() {
            webView?.evaluateJavaScript("window.dispatchEvent(new Event('avrit-device-resume'))", completionHandler: nil)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.request.url?.isFileURL == true else { return }
            if message.name == "avritReminders", let request = message.body as? [String: Any] {
                Task { @MainActor in await handleReminder(request) }
                return
            }
            guard let kind = message.body as? String else { return }
            switch kind {
            case "selection": selection.selectionChanged()
            case "grab": impact.impactOccurred(intensity: 0.45)
            case "release": impact.impactOccurred(intensity: 0.3)
            case "success": impact.impactOccurred(intensity: 0.65)
            default: return
            }
        }

        func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
            completionHandler([.banner, .sound, .list])
        }

        @MainActor private func handleReminder(_ request: [String: Any]) async {
            guard let id = request["id"] as? Int, let action = request["action"] as? String else { return }
            let center = UNUserNotificationCenter.current()
            var reply: [String: Any] = ["id": id]
            do {
                if action == "request" { _ = try await center.requestAuthorization(options: [.alert, .sound, .badge]) }
                let settings = await center.notificationSettings()
                let granted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional || settings.authorizationStatus == .ephemeral
                reply["permission"] = granted ? "granted" : settings.authorizationStatus == .notDetermined ? "default" : "denied"
                if action == "settings", let url = URL(string: UIApplication.openSettingsURLString) {
                    await UIApplication.shared.open(url)
                }
                if action == "test" {
                    guard granted else { throw NSError(domain: "Avrit", code: 1, userInfo: [NSLocalizedDescriptionKey: "Allow notifications in device settings first."]) }
                    let content = UNMutableNotificationContent()
                    content.title = "A little care, on repeat."
                    content.body = "Your Avrit test notification is here."
                    content.sound = .default
                    try await center.add(UNNotificationRequest(identifier: "avrit-test", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
                }
                if action == "sync", let items = request["items"] as? [[String: Any]] {
                    let previous = UserDefaults.standard.dictionary(forKey: "avrit.scheduled") as? [String: Double] ?? [:]
                    var current: [String: Double] = [:]
                    var failure: Error?
                    for item in items.prefix(60) {
                        guard granted, let itemID = item["id"] as? String, let at = item["at"] as? Double, at.isFinite, at > 0,
                              let title = item["title"] as? String else { continue }
                        let key = "avrit-" + itemID
                        if previous[key] == at { current[key] = at; continue }
                        center.removePendingNotificationRequests(withIdentifiers: [key])
                        center.removeDeliveredNotifications(withIdentifiers: [key])
                        let content = UNMutableNotificationContent()
                        content.title = String(title.prefix(100))
                        content.body = "A little care when you can. Open Avrit to log it or adjust your rhythm."
                        content.sound = .default
                        let date = Date(timeIntervalSince1970: at / 1000)
                        let trigger: UNNotificationTrigger = date.timeIntervalSinceNow > 0
                            ? UNCalendarNotificationTrigger(dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date), repeats: false)
                            : UNTimeIntervalNotificationTrigger(timeInterval: 60, repeats: false)
                        do {
                            try await center.add(UNNotificationRequest(identifier: key, content: content, trigger: trigger))
                            current[key] = at
                        } catch { failure = error }
                    }
                    let removed = previous.keys.filter { current[$0] == nil }
                    center.removePendingNotificationRequests(withIdentifiers: Array(removed))
                    center.removeDeliveredNotifications(withIdentifiers: Array(removed))
                    UserDefaults.standard.set(current, forKey: "avrit.scheduled")
                    if let failure { throw failure }
                }
                reply["scheduled"] = await center.pendingNotificationRequests().filter { $0.identifier.hasPrefix("avrit-") && $0.identifier != "avrit-test" }.count
            } catch { reply["error"] = error.localizedDescription }
            if let data = try? JSONSerialization.data(withJSONObject: reply), let json = String(data: data, encoding: .utf8) {
                webView?.evaluateJavaScript("window.AvritReminderReply && window.AvritReminderReply(\(json))", completionHandler: nil)
            }
        }
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

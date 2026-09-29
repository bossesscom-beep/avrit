import SwiftUI

@main
struct AvritApp: App {
    var body: some Scene {
        WindowGroup {
            WebShell()
                .ignoresSafeArea()
        }
    }
}

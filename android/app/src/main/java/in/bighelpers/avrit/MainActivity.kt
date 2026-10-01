package `in`.bighelpers.avrit

import android.content.Intent
import android.os.Bundle
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.result.contract.ActivityResultContracts
import android.view.View
import android.view.HapticFeedbackConstants
import android.widget.FrameLayout
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import android.Manifest
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import org.json.JSONArray

class MainActivity : AppCompatActivity() {
    private var remindersView: WebView? = null
    private var permissionRequestID: Int? = null
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        permissionRequestID?.let { replyReminder(it) }
        permissionRequestID = null
    }
    private fun replyReminder(id: Int, count: Int = 0, error: String? = null) {
        val asked = getSharedPreferences("avrit-reminders", MODE_PRIVATE).getBoolean("asked", false)
        val permission = if (ReminderScheduler.allowed(this)) "granted" else if (Build.VERSION.SDK_INT >= 33 && !asked) "default" else "denied"
        val reply = JSONObject().put("id", id).put("permission", permission).put("scheduled", count)
        if (error != null) reply.put("error", error)
        remindersView?.evaluateJavascript("window.AvritReminderReply && window.AvritReminderReply($reply)", null)
    }
    private fun handleReminder(raw: String) {
        var id = 0
        try {
            val request = JSONObject(raw)
            id = request.getInt("id")
            var count = 0
            when (request.getString("action")) {
                "request" -> if (Build.VERSION.SDK_INT >= 33 && !ReminderScheduler.allowed(this)) {
                    check(permissionRequestID == null) { "A permission request is already open." }
                    permissionRequestID = id
                    getSharedPreferences("avrit-reminders", MODE_PRIVATE).edit().putBoolean("asked", true).apply()
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    return
                }
                "sync" -> count = ReminderScheduler.sync(this, request.optJSONArray("items") ?: JSONArray())
                "test" -> ReminderScheduler.test(this)
                "settings" -> startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
            }
            replyReminder(id, count)
        } catch (error: Exception) { replyReminder(id, error = error.message ?: "Could not update reminders.") }
    }
    private var photoCallback: ValueCallback<Array<Uri>>? = null
    private val photoPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        photoCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        photoCallback = null
    }

    override fun onDestroy() {
        remindersView = null
        photoCallback?.onReceiveValue(null)
        photoCallback = null
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        remindersView?.evaluateJavascript("window.dispatchEvent(new Event('avrit-device-resume'))", null)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val webView = WebView(this)
        remindersView = webView
        val container = FrameLayout(this)
        container.addView(webView, FrameLayout.LayoutParams(-1, -1))
        setContentView(container)
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
            insets
        }
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams
            ): Boolean {
                if (Uri.parse(view.url).host != "appassets.androidplatform.net") return false
                photoCallback?.onReceiveValue(null)
                photoCallback = callback
                try {
                    photoPicker.launch("image/*")
                } catch (_: android.content.ActivityNotFoundException) {
                    photoCallback?.onReceiveValue(null)
                    photoCallback = null
                }
                return true
            }
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView, "AvritReminders", setOf("https://appassets.androidplatform.net")
            ) { _, message, _, isMainFrame, _ ->
                if (isMainFrame) message.data?.let { handleReminder(it) }
            }
            WebViewCompat.addWebMessageListener(
                webView, "AvritNative", setOf("https://appassets.androidplatform.net")
            ) { view, message, _, isMainFrame, _ ->
                if (isMainFrame) {
                    val feedback = when (message.data) {
                        "selection" -> HapticFeedbackConstants.CLOCK_TICK
                        "grab" -> HapticFeedbackConstants.LONG_PRESS
                        "release", "success" -> HapticFeedbackConstants.CONTEXT_CLICK
                        else -> null
                    }
                    if (feedback != null) view.performHapticFeedback(feedback)
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val host = request.url.host
                if (host == "appassets.androidplatform.net") return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                return true
            }
        }
        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }
}

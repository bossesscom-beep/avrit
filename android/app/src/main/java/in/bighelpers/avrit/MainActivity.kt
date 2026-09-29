package `in`.bighelpers.avrit

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val webView = WebView(this)
        setContentView(webView)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.overScrollMode = View.OVER_SCROLL_NEVER
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

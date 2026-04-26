package com.son24.dauphim;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME_URL = "file:///android_asset/www/index.html";

    private FrameLayout root;
    private WebView webView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(17, 19, 26));
        window.setNavigationBarColor(Color.rgb(8, 9, 13));

        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        configureWebView(webView);
        webView.loadUrl(HOME_URL);
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        view.addJavascriptInterface(new AndroidBridge(), "DauPhimAndroid");

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                view.loadUrl(url);
                return true;
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                fullscreenView = view;
                fullscreenCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(fullscreenView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                ));
            }

            @Override
            public void onHideCustomView() {
                if (fullscreenView == null) {
                    return;
                }

                root.removeView(fullscreenView);
                fullscreenView = null;
                webView.setVisibility(View.VISIBLE);

                if (fullscreenCallback != null) {
                    fullscreenCallback.onCustomViewHidden();
                    fullscreenCallback = null;
                }
            }
        });
    }

    private boolean canUsePictureInPicture() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    private boolean isWatchPage() {
        String url = webView != null ? webView.getUrl() : null;
        return url != null && url.contains("watch.html");
    }

    private void enterPictureInPictureModeIfPossible() {
        if (!isWatchPage()) {
            return;
        }

        if (!canUsePictureInPicture()) {
            Toast.makeText(this, "Máy này chưa hỗ trợ Pop-up video", Toast.LENGTH_SHORT).show();
            return;
        }

        PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .build();
        enterPictureInPictureMode(params);
    }

    @Override
    protected void onUserLeaveHint() {
        if (isWatchPage()) {
            enterPictureInPictureModeIfPossible();
            return;
        }

        super.onUserLeaveHint();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (webView != null) {
            webView.evaluateJavascript(
                    "document.body.classList.toggle('android-pip-active'," + isInPictureInPictureMode + ");",
                    null
            );
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean isPictureInPictureSupported() {
            return canUsePictureInPicture();
        }

        @JavascriptInterface
        public void enterPictureInPicture() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    enterPictureInPictureModeIfPossible();
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            webView.getWebChromeClient().onHideCustomView();
            return;
        }

        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }
}

package com.son24.dauphim;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME_URL = "file:///android_asset/www/index.html";
    private static final String[] BLOCKED_AD_HOSTS = {
            "doubleclick.net",
            "googlesyndication.com",
            "googleadservices.com",
            "adservice.google.com",
            "pagead2.googlesyndication.com",
            "securepubads.g.doubleclick.net",
            "adsystem.com",
            "adnxs.com",
            "adsrvr.org",
            "taboola.com",
            "outbrain.com",
            "criteo.com",
            "criteo.net",
            "pubmatic.com",
            "rubiconproject.com",
            "openx.net",
            "ads-twitter.com",
            "advertising.com",
            "yieldmo.com",
            "scorecardresearch.com"
    };
    private static final String[] BLOCKED_AD_PATHS = {
            "/ads/",
            "/adserver/",
            "/advert/",
            "/banner/",
            "/banners/",
            "/popunder/",
            "/prebid",
            "/vast",
            "/vpaid",
            "/pagead/",
            "/gampad/"
    };

    private FrameLayout root;
    private WebView webView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private AudioManager audioManager;

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

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
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
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (isBlockedAdUrl(url)) {
                    return createEmptyResponse();
                }

                return super.shouldInterceptRequest(view, request);
            }

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

    private boolean isBlockedAdUrl(String url) {
        if (url == null || url.startsWith("file:///android_asset/www/")) {
            return false;
        }

        String normalizedUrl = url.toLowerCase(Locale.US);
        String host = "";
        String path = "";
        try {
            java.net.URI uri = new java.net.URI(normalizedUrl);
            host = uri.getHost() != null ? uri.getHost() : "";
            path = uri.getRawPath() != null ? uri.getRawPath() : "";
        } catch (Exception ignored) {
            return false;
        }

        for (String blockedHost : BLOCKED_AD_HOSTS) {
            if (host.equals(blockedHost) || host.endsWith("." + blockedHost)) {
                return true;
            }
        }

        for (String blockedPath : BLOCKED_AD_PATHS) {
            if (path.contains(blockedPath)) {
                return true;
            }
        }

        return false;
    }

    private WebResourceResponse createEmptyResponse() {
        return new WebResourceResponse(
                "text/plain",
                "utf-8",
                new ByteArrayInputStream(new byte[0])
        );
    }

    private boolean canUsePictureInPicture() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    private int getVolumePercent() {
        if (audioManager == null) {
            return 50;
        }

        int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        if (maxVolume <= 0) {
            return 50;
        }

        int currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        return Math.round((currentVolume * 100f) / maxVolume);
    }

    private int setVolumePercent(int percent) {
        if (audioManager == null) {
            return percent;
        }

        int clampedPercent = clampPercent(percent);
        int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int targetVolume = Math.round((clampedPercent / 100f) * maxVolume);
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVolume, 0);
        return getVolumePercent();
    }

    private int getBrightnessPercent() {
        float brightness = getWindow().getAttributes().screenBrightness;
        if (brightness < 0f) {
            return 60;
        }
        return clampPercent(Math.round(brightness * 100f));
    }

    private int setBrightnessPercent(int percent) {
        int clampedPercent = Math.max(5, clampPercent(percent));
        Window window = getWindow();
        android.view.WindowManager.LayoutParams attrs = window.getAttributes();
        attrs.screenBrightness = clampedPercent / 100f;
        window.setAttributes(attrs);
        return clampedPercent;
    }

    private int clampPercent(int percent) {
        return Math.max(0, Math.min(100, percent));
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

        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.trim().isEmpty()) {
                return;
            }

            final String targetUrl = url.trim();
            if (!targetUrl.startsWith("https://")
                    && !targetUrl.startsWith("http://")
                    && !targetUrl.startsWith("file:///android_asset/www/")) {
                return;
            }

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    webView.loadUrl(targetUrl);
                }
            });
        }

        @JavascriptInterface
        public int getVolumePercent() {
            return MainActivity.this.getVolumePercent();
        }

        @JavascriptInterface
        public int setVolumePercent(final int percent) {
            return MainActivity.this.setVolumePercent(percent);
        }

        @JavascriptInterface
        public int getBrightnessPercent() {
            return MainActivity.this.getBrightnessPercent();
        }

        @JavascriptInterface
        public int setBrightnessPercent(final int percent) {
            final int[] appliedPercent = new int[] { clampPercent(percent) };
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    appliedPercent[0] = MainActivity.this.setBrightnessPercent(percent);
                }
            });
            return appliedPercent[0];
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

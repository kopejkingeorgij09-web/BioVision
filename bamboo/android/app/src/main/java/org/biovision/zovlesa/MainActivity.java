package org.biovision.zovlesa;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final String ASSETS = "/assets/www/";
    private static final String BAMBOO = ASSETS + "bamboo/";
    private static final String HOME = ORIGIN + BAMBOO + "index.html";
    private static final String SITE = "https://kopejkingeorgij09-web.github.io/BioVision/";
    private static final int PICK = 1, SAVE = 2, MAX_BASE64 = 8 * 1024 * 1024;

    private WebView web;
    private ValueCallback<Uri[]> picker;
    private StringBuilder download;
    private String name, mime;
    private byte[] pendingSave;

    private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if (!request.isForMainFrame()) return !local(url);
                if (local(url) && path != null && path.startsWith(BAMBOO)) return false;
                if (request.hasGesture()) {
                    if (local(url) && path != null && path.startsWith(ASSETS)) {
                        String encoded = url.getEncodedPath().substring(ASSETS.length());
                        String suffix = (url.getEncodedQuery() == null ? "" : "?" + url.getEncodedQuery())
                                + (url.getEncodedFragment() == null ? "" : "#" + url.getEncodedFragment());
                        openExternal(Uri.parse(SITE + encoded + suffix));
                    } else if ("https".equals(url.getScheme()) || "http".equals(url.getScheme())) {
                        openExternal(url);
                    }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = cb;
                try {
                    startActivityForResult(params.createIntent(), PICK);
                } catch (ActivityNotFoundException e) {
                    cb.onReceiveValue(null);
                    picker = null;
                    toast("Не удалось открыть выбор файла");
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "ZovAndroid", Collections.singleton(ORIGIN),
                    (view, message, origin, mainFrame, reply) -> {
                        String current = view.getUrl();
                        if (mainFrame && local(origin) && current != null && current.startsWith(ORIGIN + BAMBOO)) {
                            receiveDownload(message.getData());
                        }
                    });
        }
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        } else root.setFitsSystemWindows(true);
        setContentView(root);
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    private void openExternal(Uri url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
        catch (ActivityNotFoundException e) { toast("Не удалось открыть ссылку"); }
    }

    private void receiveDownload(String text) {
        if (text == null || text.length() > 100000 || pendingSave != null) return;
        try {
            JSONObject packet = new JSONObject(text);
            switch (packet.getString("op")) {
                case "start":
                    name = packet.getString("name").replaceAll("[\\\\/\\p{Cntrl}]", "_").trim();
                    if (name.isEmpty()) name = "zov-lesa";
                    if (name.length() > 200) name = name.substring(0, 200);
                    mime = packet.getString("mime");
                    if (!mime.matches("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+")) mime = "application/octet-stream";
                    download = new StringBuilder();
                    break;
                case "chunk":
                    if (download == null) return;
                    String data = packet.getString("data");
                    if (download.length() + data.length() > MAX_BASE64) {
                        download = null;
                        toast("Файл слишком большой");
                    } else download.append(data);
                    break;
                case "end":
                    if (download == null) return;
                    pendingSave = Base64.decode(download.toString(), Base64.DEFAULT);
                    download = null;
                    startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
                            .putExtra(Intent.EXTRA_TITLE, name), SAVE);
                    break;
                default:
                    break;
            }
        } catch (JSONException | IllegalArgumentException | ActivityNotFoundException e) {
            download = null;
            pendingSave = null;
            toast("Не удалось сохранить файл");
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK && picker != null) {
            ValueCallback<Uri[]> cb = picker;
            picker = null;
            cb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        } else if (request == SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            Uri target = data.getData();
            new Thread(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(target, "w")) {
                    if (stream == null) throw new IOException("Missing output");
                    stream.write(bytes);
                    runOnUiThread(() -> toast("Файл сохранён"));
                } catch (IOException | SecurityException e) {
                    runOnUiThread(() -> toast("Не удалось сохранить файл"));
                }
            }).start();
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){if (!window.B) return false;"
                + "if (!document.getElementById('dlgScrim').hidden) {B.closeDialog(false); return true;}"
                + "if (B.sheetOpen()) {B.closeSheet(); return true;} return false;})()", handled -> {
            if ("true".equals(handled)) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }

    @Override protected void onDestroy() {
        if (picker != null) picker.onReceiveValue(null);
        web.destroy();
        super.onDestroy();
    }
}

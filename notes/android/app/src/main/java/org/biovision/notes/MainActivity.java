package org.biovision.notes;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int PICK_FILES = 11;
    private static final int STYLUS_BUTTONS = MotionEvent.BUTTON_STYLUS_PRIMARY | MotionEvent.BUTTON_STYLUS_SECONDARY;
    private static final int PEN_BUTTONS = STYLUS_BUTTONS | MotionEvent.BUTTON_SECONDARY;
    private PenWebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private volatile boolean penButtonDown;
    private boolean fullscreen;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        web = new PenWebView();
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setAllowFileAccessFromFileURLs(false);
        web.getSettings().setAllowUniversalAccessFromFileURLs(false);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new InkBridge(), "NotesAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                WebResourceResponse response = assets.shouldInterceptRequest(uri);
                String path = uri.getPath();
                if (response != null && path != null) {
                    if (path.endsWith(".mjs")) response.setMimeType("text/javascript");
                    if (path.endsWith(".wasm")) response.setMimeType("application/wasm");
                }
                return response;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost()) && url.getPath() != null
                        && url.getPath().startsWith("/assets/www/")) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && ("https".equals(url.getScheme()) || "http".equals(url.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams options) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*")
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, options.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE)
                    .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "text/plain", "image/*", "video/*"});
                try { startActivityForResult(intent, PICK_FILES); }
                catch (ActivityNotFoundException error) { callback.onReceiveValue(null); pendingFiles = null; }
                return true;
            }
        });
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(root);
        if (state == null || web.restoreState(state) == null) web.loadUrl("https://" + HOST + "/assets/www/index.html");
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == PICK_FILES && pendingFiles != null) {
            pendingFiles.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pendingFiles = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onBackPressed() {
        if (fullscreen) setFullscreen(false);
        else if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void setFullscreen(boolean enabled) {
        fullscreen = enabled;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (enabled) controller.hide(WindowInsets.Type.systemBars());
                else controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(enabled
                ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                : 0);
        }
        web.evaluateJavascript("window.notesFullscreenChanged?.(" + fullscreen + ");", null);
    }

    @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
        if (web != null && web.observePenButton(event, false)) return true;
        return super.dispatchGenericMotionEvent(event);
    }

    @Override protected void onDestroy() {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        pendingFiles = null;
        web.destroy();
        super.onDestroy();
    }

    private final class PenWebView extends WebView {
        private int penId = -1;
        private boolean suppressFingers;
        private final MotionEvent.PointerProperties[] properties = { new MotionEvent.PointerProperties() };
        private final MotionEvent.PointerCoords[] coordinates = { new MotionEvent.PointerCoords() };
        PenWebView() { super(MainActivity.this); }

        private boolean penButtonContact;
        private boolean touchReportsButton;
        private int penSample;
        private long lastButtonEdge = -1000;

        private void publishPenButton(boolean down, boolean contact, boolean canceled, long time, String source) {
            boolean changed = down != penButtonDown || (down && contact && !penButtonContact);
            penButtonDown = down;
            penButtonContact = down && contact;
            if (changed || canceled) {
                evaluateJavascript("window.notesPenButton?.(" + down + "," + contact + "," + canceled + "," + time
                    + "," + JSONObject.quote(source) + ");", null);
            }
        }

        private boolean observePenButton(MotionEvent event, boolean contact) {
            int action = event.getActionMasked();
            boolean stylus = event.isFromSource(InputDevice.SOURCE_STYLUS)
                || ((event.getButtonState() | event.getActionButton()) & STYLUS_BUTTONS) != 0;
            for (int i = 0; !stylus && i < event.getPointerCount(); i++) {
                int tool = event.getToolType(i);
                stylus = tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER;
            }
            if (!stylus) return false;
            int sample = ++penSample;
            if (action == MotionEvent.ACTION_HOVER_EXIT) {
                postDelayed(() -> {
                    if (sample != penSample) return;
                    lastButtonEdge = -1000;
                    if (penButtonDown) publishPenButton(false, false, true, SystemClock.uptimeMillis(), "reset");
                }, 170);
                return false;
            }
            if (action == MotionEvent.ACTION_CANCEL) {
                lastButtonEdge = -1000;
                touchReportsButton = false;
                publishPenButton(false, false, true, event.getEventTime(), "reset");
                return false;
            }
            long time = event.getEventTime();
            boolean explicit = (action == MotionEvent.ACTION_BUTTON_PRESS || action == MotionEvent.ACTION_BUTTON_RELEASE)
                && (event.getActionButton() & PEN_BUTTONS) != 0;
            boolean down = (event.getButtonState() & PEN_BUTTONS) != 0;
            if (explicit) {
                lastButtonEdge = time;
                down = action == MotionEvent.ACTION_BUTTON_PRESS;
            } else if (contact) {
                if (penId < 0) touchReportsButton = false;
                touchReportsButton |= down;
                // On some pens, hover and button events carry a mask but tip events omit it.
                if (!touchReportsButton) down = penButtonDown;
            } else if (time - lastButtonEdge < 40) {
                // Some devices echo the pre-edge mask in the next hover event.
                down = penButtonDown;
            }
            publishPenButton(down, contact || penId >= 0, false, time, explicit ? "button" : contact ? "touch" : "hover");
            return explicit;
        }

        @Override public void onWindowFocusChanged(boolean focused) {
            super.onWindowFocusChanged(focused);
            if (!focused) {
                ++penSample;
                lastButtonEdge = -1000;
                publishPenButton(false, false, true, SystemClock.uptimeMillis(), "reset");
            }
        }

        @Override public boolean onTouchEvent(MotionEvent event) {
            observePenButton(event, true);
            int action = event.getActionMasked();
            int index = event.getActionIndex();
            int type = event.getToolType(index);
            if (action == MotionEvent.ACTION_DOWN) suppressFingers = false;
            if (penId < 0 && (type == MotionEvent.TOOL_TYPE_STYLUS || type == MotionEvent.TOOL_TYPE_ERASER)
                    && (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN)) {
                penId = event.getPointerId(index);
                if (action == MotionEvent.ACTION_POINTER_DOWN) {
                    MotionEvent cancel = MotionEvent.obtain(event);
                    cancel.setAction(MotionEvent.ACTION_CANCEL);
                    super.onTouchEvent(cancel);
                    cancel.recycle();
                }
            }
            if (penId < 0) {
                if (suppressFingers) return true;
                return super.onTouchEvent(event);
            }
            int penIndex = event.findPointerIndex(penId);
            if (penIndex < 0) return true;
            if ((action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_POINTER_UP)
                    && penIndex != index) return true;
            int penAction = action == MotionEvent.ACTION_POINTER_DOWN ? MotionEvent.ACTION_DOWN
                : action == MotionEvent.ACTION_POINTER_UP ? MotionEvent.ACTION_UP : action;
            if (Build.VERSION.SDK_INT >= 33 && (event.getFlags() & MotionEvent.FLAG_CANCELED) != 0
                    && penAction == MotionEvent.ACTION_UP) penAction = MotionEvent.ACTION_CANCEL;
            event.getPointerProperties(penIndex, properties[0]);
            int history = penAction == MotionEvent.ACTION_MOVE ? event.getHistorySize() : 0;
            if (history > 0) event.getHistoricalPointerCoords(penIndex, 0, coordinates[0]);
            else event.getPointerCoords(penIndex, coordinates[0]);
            MotionEvent pen = MotionEvent.obtain(event.getDownTime(),
                history > 0 ? event.getHistoricalEventTime(0) : event.getEventTime(),
                penAction, 1, properties, coordinates, event.getMetaState(), event.getButtonState() & ~PEN_BUTTONS,
                event.getXPrecision(), event.getYPrecision(), event.getDeviceId(), event.getEdgeFlags(),
                event.getSource(), event.getFlags());
            if (history > 0) {
                for (int i = 1; i < history; i++) {
                    event.getHistoricalPointerCoords(penIndex, i, coordinates[0]);
                    pen.addBatch(event.getHistoricalEventTime(i), coordinates, event.getMetaState());
                }
                event.getPointerCoords(penIndex, coordinates[0]);
                pen.addBatch(event.getEventTime(), coordinates, event.getMetaState());
            }
            super.onTouchEvent(pen);
            pen.recycle();
            if (penAction == MotionEvent.ACTION_UP || penAction == MotionEvent.ACTION_CANCEL) {
                penId = -1;
                suppressFingers = event.getPointerCount() > 1;
            }
            return true;
        }
    }

    private final class InkBridge {
        @JavascriptInterface public boolean penButtonPressed() { return penButtonDown; }
        @JavascriptInterface public void setFullscreen(boolean enabled) {
            runOnUiThread(() -> { if (!isDestroyed()) MainActivity.this.setFullscreen(enabled); });
        }

        @JavascriptInterface public void recognize(String points, String language) {
            if (points.length() > 2_000_000 || !("ru".equals(language) || "en".equals(language))) {
                reply("", "Неподдерживаемый формат рукописи.");
                return;
            }
            runOnUiThread(() -> recognizeInk(points, language));
        }
    }

    private void recognizeInk(String points, String language) {
        try {
            Ink.Builder ink = Ink.builder();
            JSONArray strokes = new JSONArray(points);
            for (int i = 0; i < strokes.length(); i++) {
                JSONArray samples = strokes.getJSONArray(i);
                Ink.Stroke.Builder stroke = Ink.Stroke.builder();
                for (int j = 0; j < samples.length(); j++) {
                    JSONArray sample = samples.getJSONArray(j);
                    stroke.addPoint(Ink.Point.create((float) sample.getDouble(0), (float) sample.getDouble(1)));
                }
                if (samples.length() > 0) ink.addStroke(stroke.build());
            }
            String tag = "ru".equals(language) ? "ru-RU" : "en-US";
            DigitalInkRecognitionModelIdentifier identifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag(tag);
            if (identifier == null) { reply("", "Языковая модель недоступна."); return; }
            DigitalInkRecognitionModel model = DigitalInkRecognitionModel.builder(identifier).build();
            RemoteModelManager.getInstance().download(model, new DownloadConditions.Builder().build())
                .addOnSuccessListener(unused -> {
                    DigitalInkRecognizer recognizer = DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(model).build());
                    recognizer.recognize(ink.build())
                        .addOnSuccessListener(result -> {
                            if (result.getCandidates().isEmpty()) reply("", "Не удалось распознать текст.");
                            else reply(result.getCandidates().get(0).getText(), "");
                        })
                        .addOnFailureListener(error -> reply("", "Ошибка распознавания: " + error.getMessage()))
                        .addOnCompleteListener(task -> recognizer.close());
                })
                .addOnFailureListener(error -> reply("", "Не удалось скачать языковую модель: " + error.getMessage()));
        } catch (Exception error) {
            reply("", "Ошибка чтения штрихов: " + error.getMessage());
        }
    }

    private void reply(String text, String error) {
        runOnUiThread(() -> {
            if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(
                "window.notesInkResult?.(" + JSONObject.quote(text) + "," + JSONObject.quote(error) + ");", null);
        });
    }
}

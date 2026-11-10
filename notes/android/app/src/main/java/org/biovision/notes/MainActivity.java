package org.biovision.notes;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.InputStream;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int PICK_FILES = 11;
    private static final long MAX_CLIP_FILE = 50L * 1024 * 1024;
    private final ExecutorService clipboardWorker = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, ClipboardFile> clipboardFiles = new ConcurrentHashMap<>();
    private boolean clipboardBusy;
    private volatile boolean clipboardClosed;
    private static final class ClipboardFile {
        final File file;
        final String mime;
        ClipboardFile(File file, String mime) { this.file = file; this.mime = mime; }
    }
    private static final int STYLUS_BUTTONS = MotionEvent.BUTTON_STYLUS_PRIMARY | MotionEvent.BUTTON_STYLUS_SECONDARY;
    private static final int PEN_BUTTONS = STYLUS_BUTTONS | MotionEvent.BUTTON_SECONDARY;
    private PenWebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private volatile boolean penButtonDown;
    private boolean fullscreen;
    private final Map<String, DigitalInkRecognizer> recognizers = new HashMap<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        web = new PenWebView();
        if (Build.VERSION.SDK_INT >= 33) web.setAutoHandwritingEnabled(false);
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
                if (HOST.equals(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/clipboard/")) {
                    ClipboardFile entry = clipboardFiles.remove(uri.getLastPathSegment());
                    if (entry == null) return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
                    try {
                        InputStream stream = new FilterInputStream(new FileInputStream(entry.file)) {
                            @Override public void close() throws IOException {
                                try { super.close(); } finally { entry.file.delete(); }
                            }
                        };
                        return new WebResourceResponse(entry.mime, null, stream);
                    } catch (IOException error) {
                        entry.file.delete();
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
                    }
                }
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
        clipboardClosed = true;
        clipboardWorker.shutdownNow();
        for (ClipboardFile entry : clipboardFiles.values()) entry.file.delete();
        clipboardFiles.clear();
        for (DigitalInkRecognizer recognizer : recognizers.values()) recognizer.close();
        recognizers.clear();
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
        @JavascriptInterface public void readClipboard(String requestId) {
            if (!requestId.matches("[a-fA-F0-9-]{36}")) return;
            runOnUiThread(() -> pasteClipboard(requestId));
        }

        @JavascriptInterface public boolean penButtonPressed() { return penButtonDown; }
        @JavascriptInterface public void setFullscreen(boolean enabled) {
            runOnUiThread(() -> { if (!isDestroyed()) MainActivity.this.setFullscreen(enabled); });
        }

        @JavascriptInterface public void recognizeIndexed(int request, String points, String language, float width, float height) {
            if (points.length() > 2_000_000 || !("ru".equals(language) || "en".equals(language))) {
                reply(request, "", "Неподдерживаемый формат рукописи.");
                return;
            }
            runOnUiThread(() -> recognizeInk(request, points, language, width, height));
        }
    }

    private void clipboardReply(String id, JSONArray files, String error) {
        runOnUiThread(() -> {
            clipboardBusy = false;
            if (isFinishing() || isDestroyed()) return;
            web.evaluateJavascript("window.notesClipboardResult?.(" + JSONObject.quote(id) + ","
                + files.toString() + "," + JSONObject.quote(error) + ");", null);
        });
    }

    private void pasteClipboard(String id) {
        if (isFinishing() || isDestroyed()) return;
        String page = web.getUrl();
        if (page == null || !page.startsWith("https://" + HOST + "/assets/www/")) return;
        if (clipboardBusy) {
            web.evaluateJavascript("window.notesClipboardResult?.(" + JSONObject.quote(id)
                + ",[],\"Дождись завершения вставки\");", null);
            return;
        }
        ClipboardManager manager = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        final ClipData clip;
        try { clip = manager.getPrimaryClip(); }
        catch (Exception error) { clipboardReply(id, new JSONArray(), "Нет доступа к буферу обмена"); return; }
        if (clip == null) { clipboardReply(id, new JSONArray(), "Буфер обмена пуст"); return; }
        clipboardBusy = true;
        clipboardWorker.execute(() -> {
            JSONArray result = new JSONArray();
            java.util.ArrayList<String> tokens = new java.util.ArrayList<>();
            File copying = null;
            try {
                if (clip.getItemCount() > 16) throw new IOException("Можно вставить до 16 файлов за раз");
                for (int i = 0; i < clip.getItemCount(); i++) {
                    if (Thread.currentThread().isInterrupted()) throw new IOException("Вставка отменена");
                    Uri uri = clip.getItemAt(i).getUri();
                    if (uri == null || !"content".equals(uri.getScheme())) continue;
                    String mime = getContentResolver().getType(uri);
                    if (mime == null || !(mime.startsWith("image/") || mime.startsWith("video/") || "application/pdf".equals(mime))) continue;
                    String name = "";
                    try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                            if (sizeIndex >= 0 && !cursor.isNull(sizeIndex) && cursor.getLong(sizeIndex) > MAX_CLIP_FILE)
                                throw new IOException("Файл в буфере больше 50 МБ");
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            if (nameIndex >= 0) name = cursor.getString(nameIndex);
                        }
                    }
                    if (name == null || name.isEmpty()) {
                        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
                        name = "Вставка-" + (i + 1) + (extension == null ? "" : "." + extension);
                    }
                    copying = File.createTempFile("polya-paste-", ".tmp", getCacheDir());
                    long size = 0;
                    try (InputStream input = getContentResolver().openInputStream(uri);
                         FileOutputStream output = new FileOutputStream(copying)) {
                        if (input == null) throw new IOException("Файл из буфера недоступен");
                        byte[] buffer = new byte[64 * 1024];
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            size += count;
                            if (size > MAX_CLIP_FILE) throw new IOException("Файл в буфере больше 50 МБ");
                            if (Thread.currentThread().isInterrupted()) throw new IOException("Вставка отменена");
                            output.write(buffer, 0, count);
                        }
                    }
                    if (size == 0) throw new IOException("В буфере пустой файл");
                    String token = UUID.randomUUID().toString();
                    clipboardFiles.put(token, new ClipboardFile(copying, mime));
                    tokens.add(token);
                    copying = null;
                    result.put(new JSONObject().put("token", token).put("mime", mime).put("name", name));
                }
                if (clipboardClosed || isFinishing() || isDestroyed()) throw new IOException("Вставка отменена");
                web.postDelayed(() -> {
                    for (String token : tokens) {
                        ClipboardFile file = clipboardFiles.remove(token);
                        if (file != null) file.file.delete();
                    }
                }, 60000);
                clipboardReply(id, result, "");
            } catch (Exception error) {
                if (copying != null) copying.delete();
                for (String token : tokens) {
                    ClipboardFile file = clipboardFiles.remove(token);
                    if (file != null) file.file.delete();
                }
                clipboardReply(id, new JSONArray(), "Не удалось вставить файл. " + error.getMessage());
            }
        });
    }

    private void recognizeInk(int request, String points, String language, float width, float height) {
        try {
            Ink.Builder ink = Ink.builder();
            JSONArray strokes = new JSONArray(points);
            long previousTime = 0;
            for (int i = 0; i < strokes.length(); i++) {
                JSONArray samples = strokes.getJSONArray(i);
                Ink.Stroke.Builder stroke = Ink.Stroke.builder();
                for (int j = 0; j < samples.length(); j++) {
                    JSONArray sample = samples.getJSONArray(j);
                    previousTime = Math.max(previousTime + 1, sample.optLong(2, previousTime + 1));
                    stroke.addPoint(Ink.Point.create((float) sample.getDouble(0), (float) sample.getDouble(1), previousTime));
                }
                if (samples.length() > 0) ink.addStroke(stroke.build());
            }
            String tag = "ru".equals(language) ? "ru-RU" : "en-US";
            DigitalInkRecognizer cached = recognizers.get(tag);
            if (cached != null) {
                recognizeWith(request, cached, ink.build(), width, height);
                return;
            }
            DigitalInkRecognitionModelIdentifier identifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag(tag);
            if (identifier == null) { reply(request, "", "Языковая модель недоступна."); return; }
            DigitalInkRecognitionModel model = DigitalInkRecognitionModel.builder(identifier).build();
            RemoteModelManager.getInstance().download(model, new DownloadConditions.Builder().build())
                .addOnSuccessListener(unused -> {
                    if (isDestroyed()) return;
                    DigitalInkRecognizer recognizer = recognizers.computeIfAbsent(tag,
                        key -> DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(model).build()));
                    recognizeWith(request, recognizer, ink.build(), width, height);
                })
                .addOnFailureListener(error -> reply(request, "", "Не удалось скачать языковую модель: " + error.getMessage()));
        } catch (Exception error) {
            reply(request, "", "Ошибка чтения штрихов: " + error.getMessage());
        }
    }

    private void recognizeWith(int request, DigitalInkRecognizer recognizer, Ink ink, float width, float height) {
        var task = width > 0 && height > 0
            ? recognizer.recognize(ink, RecognitionContext.builder().setWritingArea(new WritingArea(width, height)).build())
            : recognizer.recognize(ink);
        task.addOnSuccessListener(result ->
                reply(request, result.getCandidates().isEmpty() ? "" : result.getCandidates().get(0).getText(), ""))
            .addOnFailureListener(error -> reply(request, "", "Ошибка распознавания: " + error.getMessage()));
    }

    private void reply(int request, String text, String error) {
        runOnUiThread(() -> {
            if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(
                "window.notesIndexedInkResult?.(" + request + "," + JSONObject.quote(text) + "," + JSONObject.quote(error) + ");", null);
        });
    }
}

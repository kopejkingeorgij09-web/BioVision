package org.biovision.zovlesa;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Iterator;
import java.util.regex.Pattern;

/** The next alarm belongs to Android. The WebView only supplies the saved schedule. */
final class ReminderScheduler {
    static final String FIRE = "org.biovision.zovlesa.REMIND";
    static final String OPEN = "org.biovision.zovlesa.OPEN_REMINDER";
    private static final String CHANNEL = "reminders";
    private static final long DAY = 24 * 60 * 60_000L;
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,100}");
    private static final Pattern DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern MINUTE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}");

    private ReminderScheduler() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("reminders", Context.MODE_PRIVATE);
    }

    private static JSONArray entries(Context c) {
        try { return new JSONArray(prefs(c).getString("schedule", "[]")); }
        catch (JSONException e) { return new JSONArray(); }
    }

    private static JSONObject delivered(Context c) {
        try { return new JSONObject(prefs(c).getString("delivered", "{}")); }
        catch (JSONException e) { return new JSONObject(); }
    }

    static void createChannel(Context c) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Напоминания", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Задачи и события «Зова леса»");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    static boolean enabled(Context c) {
        if (Build.VERSION.SDK_INT >= 33 &&
                c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        return manager.areNotificationsEnabled() && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
    }

    static boolean exact(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    private static long due(JSONObject item) {
        String start = item.optString("start");
        if (!MINUTE.matcher(start).matches()) return -1;
        int minutesBefore = item.optInt("before", 0);
        if (minutesBefore < 0 || minutesBefore > 525600) return -1;
        try {
            return LocalDateTime.parse(start).atZone(ZoneId.systemDefault()).toInstant()
                    .minusSeconds(minutesBefore * 60L).toEpochMilli();
        } catch (DateTimeException e) { return -1; }
    }

    static boolean validTarget(String kind, String id, String date) {
        return ("task".equals(kind) || "event".equals(kind)) && id != null && ID.matcher(id).matches()
                && (date == null || date.isEmpty() || DATE.matcher(date).matches());
    }

    private static String key(JSONObject item) {
        return item.optString("kind") + "/" + item.optString("id") + "/" + item.optString("start")
                + "/" + item.optInt("before", 0);
    }

    static synchronized void replace(Context c, JSONArray input) {
        JSONArray previous = entries(c), next = new JSONArray();
        HashSet<String> existing = new HashSet<>(), included = new HashSet<>();
        for (int i = 0; i < previous.length(); i++) {
            JSONObject item = previous.optJSONObject(i);
            if (item != null) existing.add(key(item));
        }
        long now = System.currentTimeMillis();
        for (int i = 0; i < Math.min(input.length(), 1800); i++) {
            JSONObject item = input.optJSONObject(i);
            if (item == null || !validTarget(item.optString("kind"), item.optString("id"), item.optString("date"))) continue;
            long at = due(item);
            String key = key(item);
            if (at < now - (existing.contains(key) ? DAY : 10 * 60_000L) || !included.add(key)) continue;
            next.put(item);
        }
        String json = next.toString();
        if (!json.equals(previous.toString())) prefs(c).edit().putString("schedule", json).commit();
        refresh(c);
    }

    static synchronized void refresh(Context c) {
        AlarmManager alarm = c.getSystemService(AlarmManager.class);
        PendingIntent signal = PendingIntent.getBroadcast(c, 0,
                new Intent(c, ReminderReceiver.class).setAction(FIRE), PendingIntent.FLAG_IMMUTABLE);
        if (!enabled(c)) { alarm.cancel(signal); return; }
        long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
        JSONArray reminders = entries(c);
        JSONObject seen = delivered(c);
        boolean changed = false;
        Iterator<String> keys = seen.keys();
        while (keys.hasNext()) {
            if (seen.optLong(keys.next()) < now - 2 * DAY) { keys.remove(); changed = true; }
        }
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject item = reminders.optJSONObject(i);
            if (item == null) continue;
            long at = due(item);
            String key = key(item);
            if (seen.has(key) || at < now - DAY) continue;
            if (at > now) {
                next = Math.min(next, at);
            } else if (post(c, item, key)) {
                try { seen.put(key, now); changed = true; }
                catch (JSONException ignored) { }
            }
        }
        if (changed) prefs(c).edit().putString("delivered", seen.toString()).commit();
        if (next == Long.MAX_VALUE) { alarm.cancel(signal); return; }
        if (exact(c)) {
            try { alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, signal); return; }
            catch (SecurityException ignored) { }
        }
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, signal);
    }

    private static boolean post(Context c, JSONObject item, String key) {
        String kind = item.optString("kind"), title = item.optString("title").trim();
        if (title.isEmpty()) title = "event".equals(kind) ? "Событие" : "Задача";
        if (title.length() > 160) title = title.substring(0, 160);
        Intent open = new Intent(c, MainActivity.class)
                .setAction(OPEN).setData(Uri.parse("zov-lesa://reminder/" + Uri.encode(key)))
                .putExtra("kind", kind).putExtra("id", item.optString("id")).putExtra("date", item.optString("date"))
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String label = "event".equals(kind) ? "Событие календаря" : "Напоминание о задаче";
        if ("test".equals(kind)) label = "Уведомления включены";
        Notification notification = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.zov_notification).setContentTitle(title).setContentText(label)
                .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE)
                .setAutoCancel(true).setContentIntent(tap).build();
        try { c.getSystemService(NotificationManager.class).notify(key, 0, notification); return true; }
        catch (SecurityException e) { return false; }
    }

    static void test(Context c) {
        if (!enabled(c)) return;
        JSONObject item = new JSONObject();
        try { item.put("kind", "test").put("title", "Зов леса"); }
        catch (JSONException ignored) { }
        post(c, item, "test");
    }
}

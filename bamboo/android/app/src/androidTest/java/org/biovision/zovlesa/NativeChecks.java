package org.biovision.zovlesa;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.NotificationManager;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.widget.TextView;
import org.json.JSONArray;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Exercises the real WebView bridge, RemoteViews and AlarmManager on Android. */
public final class NativeChecks extends Instrumentation {
    private WebView web;
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    private String js(String source) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        runOnMainSync(()->web.evaluateJavascript(source,result->{value.set(result);latch.countDown();}));
        if(!latch.await(10,TimeUnit.SECONDS))throw new AssertionError("WebView timeout");
        return value.get();
    }
    private void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    @Override public void onStart() {
        Bundle result=new Bundle();
        try {
            Context c=getTargetContext();
            Activity activity=startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            java.lang.reflect.Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity);
            for(int i=0;i<60;i++){if("true".equals(js("!!window.B?.shad.plan.length")))break;Thread.sleep(250);}
            check("true".equals(js("!!window.B?.shad.plan.length")),"Bundled plan not loaded");
            String start=LocalDateTime.now().plusMinutes(1).withSecond(0).withNano(0).format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
            String date=start.substring(0,10);
            c.getSystemService(NotificationManager.class).cancelAll();
            js("B.put('t_nativecheck',{id:'nativecheck',title:'Native task',due:'"+date+"',remind:{at:'"+start+"'}});"
                +"B.put('e_nativeevent',{id:'nativeevent',title:'Native event',start:'"+start+"',end:'"+LocalDateTime.parse(start).plusHours(1)+"',alerts:[0]});true");
            Thread.sleep(1800);
            String schedule=c.getSharedPreferences("reminders",Context.MODE_PRIVATE).getString("schedule","");
            check(schedule.contains("nativecheck")&&schedule.contains("nativeevent"),"WebView did not schedule task and event");
            check(c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("items","").contains("Native task"),"Widget bridge did not persist task");
            AtomicReference<View> view=new AtomicReference<>();
            runOnMainSync(()->view.set(ZovWidget.buildViews(c,AppWidgetManager.getInstance(c),999,false).apply(c,null)));
            check(((TextView)view.get().findViewById(R.id.widget_title)).getText().toString().equals("Дела на сегодня"),"Today RemoteViews render failed");
            runOnMainSync(()->view.set(ZovWidget.buildViews(c,AppWidgetManager.getInstance(c),999,true).apply(c,null)));
            check(((TextView)view.get().findViewById(R.id.widget_title)).getText().toString().equals("Ближайшие события"),"Agenda RemoteViews render failed");
            c.startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            long deadline=System.currentTimeMillis()+80000;boolean task=false,event=false;
            while(System.currentTimeMillis()<deadline){
                for(android.service.notification.StatusBarNotification n:c.getSystemService(NotificationManager.class).getActiveNotifications()) {
                    task|=n.getTag()!=null&&n.getTag().startsWith("task/nativecheck/");
                    event|=n.getTag()!=null&&n.getTag().startsWith("event/nativeevent/");
                }
                if(task&&event)break;Thread.sleep(1000);
            }
            check(task&&event,"Task/event notification was not delivered with Activity in background");
            js("window.ZovReminder.postMessage(JSON.stringify({op:'clear'}));true");Thread.sleep(300);
            check(c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("items","[]").equals("[]"),"Widget private snapshot not cleared");
            check(new JSONArray(c.getSharedPreferences("reminders",Context.MODE_PRIVATE).getString("schedule","[]")).length()==0,"Reminder schedule not cleared");
            check(!ReminderScheduler.validTarget("page","bad/page",""),"Invalid navigation accepted");
            check(!ReminderScheduler.validTarget("shad","../5",date),"Invalid SHAD id accepted");
            result.putString("stream","PASS: WebView bridge, task/event background notifications, two native widget layouts, private snapshot cleanup\n");
            finish(Activity.RESULT_OK,result);
        } catch(Throwable e) {result.putString("stream","FAIL: "+e+"\n");finish(Activity.RESULT_CANCELED,result);}
    }
}

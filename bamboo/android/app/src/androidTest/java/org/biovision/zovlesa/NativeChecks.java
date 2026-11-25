package org.biovision.zovlesa;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.NotificationManager;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
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
        if(!latch.await(30,TimeUnit.SECONDS))throw new AssertionError("WebView timeout: "+source.substring(0,Math.min(source.length(),120)));
        return value.get();
    }
    private void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    private String visibleText(View v){
        if(v.getVisibility()!=View.VISIBLE)return "";
        if(v instanceof TextView)return ((TextView)v).getText().toString()+"\n";
        StringBuilder text=new StringBuilder();
        if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)text.append(visibleText(((ViewGroup)v).getChildAt(i)));
        return text.toString();
    }
    private void preview(Context c,boolean agenda,int width,int height,String name) throws Exception {
        AtomicReference<Throwable> error=new AtomicReference<>();
        runOnMainSync(()->{try {
            View widget=ZovWidget.buildViews(c,agenda,width,height).apply(c,null);
            float density=c.getResources().getDisplayMetrics().density;
            int w=Math.round(width*density),h=Math.round(height*density);
            widget.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
            widget.layout(0,0,w,h);
            ViewGroup rows=widget.findViewById(R.id.widget_rows);
            check(rows.getChildCount()>0,"Widget has no visible cards at "+width+"x"+height);
            for(int i=0;i<rows.getChildCount();i++)check(rows.getChildAt(i).getBottom()<=rows.getHeight(),"Widget card clipped at "+width+"x"+height);
            String text=visibleText(widget);
            check(text.contains("Корпус В-86")&&text.contains("К-215")&&text.contains("Кожухарь"),"Calendar details missing from rendered widget");
            android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(w,h,android.graphics.Bitmap.Config.ARGB_8888);
            widget.draw(new android.graphics.Canvas(bitmap));
            try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(c.getExternalFilesDir(null),name+".png"))){bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
            bitmap.recycle();
        }catch(Throwable e){error.set(e);}});
        if(error.get()!=null)throw new AssertionError(error.get());
    }
    private void habitPreview(Context c,View widget) {
        int w=ZovWidget.dp(c,320),h=ZovWidget.dp(c,310);
        widget.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
        widget.layout(0,0,w,h);
        android.graphics.Bitmap image=android.graphics.Bitmap.createBitmap(w,h,android.graphics.Bitmap.Config.ARGB_8888);
        try(java.io.FileOutputStream file=new java.io.FileOutputStream(new java.io.File(c.getExternalFilesDir(null),"habits.png"))){
            widget.draw(new android.graphics.Canvas(image));image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,file);
        }catch(java.io.IOException ex){throw new RuntimeException(ex);}finally{image.recycle();}
    }
    @Override public void onStart() {
        Bundle result=new Bundle();
        try {
            Context c=getTargetContext();
            Activity activity=startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            java.lang.reflect.Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity);
            for(int i=0;i<60;i++){if("true".equals(js("!!window.B?.shad.plan.length && !!window.B?.alberts?.book")))break;Thread.sleep(250);}
            check("true".equals(js("!!window.B?.shad.plan.length && !!window.B?.alberts?.book")),"Bundled plan not loaded");
            check("true".equals(js("(()=>{const day=B.today(), start=day+'T10:00';"
                +"const source={id:'nativeboard',title:'Дело из календаря',start,end:day+'T11:00'};"
                +"B.put('e_nativeboard',source);location.hash='#/tasks/calendar';B.render(true);"
                +"B.acts.acMode({dataset:{v:'day'}});B.$('.ac-item[data-id=nativeboard] .ac-card-menu').click();"
                +"B.$('[data-act=acBoardCopy]').click();B.$('[data-board-choice=active]').click();"
                +"location.hash='#/board';B.render(true);const card=B.$('[data-board-lane=active] .bd-card-title');"
                +"const copied=card?.textContent===source.title && getComputedStyle(B.$('.bd-grid')).display==='grid';"
                +"B.put('e_nativeboard',null);const copy=B.get('board_'+card?.closest('[data-board-card]').dataset.boardCard);"
                +"if(copy)B.put('board_'+copy.id,null);location.hash='#/today';return copied && copy?.title===source.title;})()")),
                "Calendar copy must reach the independent board in the bundled WebView");
            String start=LocalDateTime.now().plusSeconds(90).withSecond(0).withNano(0).format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
            String date=start.substring(0,10);
            c.getSystemService(NotificationManager.class).cancelAll();
            js("B.put('t_nativecheck',{id:'nativecheck',title:'Native task',due:'"+date+"',remind:{at:'"+start+"'}});"
                +"B.put('e_nativeevent',{id:'nativeevent',title:'Информатика · практика',location:'К-215 (В-86)',notes:'РТУ МИРЭА · ХББО-04-26\\n4-я пара · чётная неделя\\nКожухарь О. Ю.',start:'"+start+"',end:'"+LocalDateTime.parse(start).plusHours(1)+"',alerts:[0]});true");
            js("B.put('study_alberts',AlbertsPlan.log(B.alberts.book,B.alberts.state(),35,B.today()));true");
            Thread.sleep(1800);
            String schedule=c.getSharedPreferences("reminders",Context.MODE_PRIVATE).getString("schedule","");
            check(schedule.contains("nativecheck")&&schedule.contains("nativeevent"),"WebView did not schedule task and event");
            check(c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("items","").contains("Native task"),"Widget bridge did not persist task");
            AtomicReference<View> view=new AtomicReference<>();
            runOnMainSync(()->view.set(ZovWidget.buildViews(c,AppWidgetManager.getInstance(c),999,false).apply(c,null)));
            check(((TextView)view.get().findViewById(R.id.widget_title)).getText().toString().equals("Дела на сегодня"),"Today RemoteViews render failed");
            runOnMainSync(()->view.set(ZovWidget.buildViews(c,AppWidgetManager.getInstance(c),999,true).apply(c,null)));
            check(((TextView)view.get().findViewById(R.id.widget_title)).getText().toString().equals("Ближайшие события"),"Agenda RemoteViews render failed");
            String snapshot=c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("items","[]");
            check(snapshot.contains("Кожухарь")&&snapshot.contains("Корпус В-86"),"WebView did not extract calendar details");
            // Fixtures exercise long titles, two subgroups, narrow widgets and large system text.
            JSONArray fixtures=new JSONArray(snapshot);
            fixtures.put(new org.json.JSONObject().put("kind","event").put("id","preview-long").put("date",date).put("time","23:40")
                .put("title","Линейная алгебра и аналитическая геометрия · лекция").put("location","Корпус В-86 · ауд. К-7").put("teacher","Тишаева И. Р."));
            fixtures.put(new org.json.JSONObject().put("kind","event").put("id","preview-lab").put("date",date).put("time","23:50")
                .put("title","Физика · лабораторная").put("location","Ауд. В-321 / В-324").put("teacher","1-я п/г · Санжаровский, В-321\n2-я п/г · Савинов, В-324"));
            ZovWidget.replace(c,fixtures);
            preview(c,false,320,440,"today");preview(c,true,320,540,"agenda");
            preview(c,true,180,200,"narrow");preview(c,true,320,150,"compact");
            android.content.res.Configuration config=new android.content.res.Configuration(c.getResources().getConfiguration());config.fontScale=1.3f;
            preview(c.createConfigurationContext(config),true,320,440,"large-text");
            js("B.setShadOver(5,{w:{date:'"+date+"',from:'18:00'},h:{date:'"+date+"'}});true");Thread.sleep(500);
            for(int mode=0;mode<StudyWidget.TYPES.length;mode++){
                final int kind=mode;AtomicReference<View> study=new AtomicReference<>();
                runOnMainSync(()->{View w=StudyWidget.buildViews(c,kind,320,440).apply(c,null);int width=Math.round(320*c.getResources().getDisplayMetrics().density),height=Math.round(440*c.getResources().getDisplayMetrics().density);w.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));w.layout(0,0,width,height);study.set(w);
                    try{android.graphics.Bitmap b=android.graphics.Bitmap.createBitmap(width,height,android.graphics.Bitmap.Config.ARGB_8888);w.draw(new android.graphics.Canvas(b));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(c.getExternalFilesDir(null),"study-"+kind+".png"))){b.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}b.recycle();}catch(Exception e){throw new RuntimeException(e);}});
                check(visibleText(study.get()).contains((mode==StudyWidget.ALBERTS||mode==StudyWidget.BOOKMARK)?"Альбертс":"ШАД"),"Study widget title missing");
                check(!((TextView)study.get().findViewById(R.id.study_label)).getText().toString().isEmpty(),"Study widget snapshot not loaded");
            }
            js("B.put('h_widgettest',{id:'widgettest',order:-100,name:'Прогулка',created:B.today()});true");
            Thread.sleep(600);
            String habitDate=HabitWidget.day().toString();
            AtomicReference<View> habit=new AtomicReference<>();
            runOnMainSync(()->habit.set(HabitWidget.buildViews(c,17,320,310).apply(c,null)));
            check(visibleText(habit.get()).contains("Прогулка"),"Habit row missing");
            // Invoke the actual RemoteViews action while the WebView has no foreground activity.
            c.startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Thread.sleep(400);
            runOnMainSync(()->((ViewGroup)habit.get().findViewById(R.id.widget_rows)).getChildAt(0).performClick());
            Thread.sleep(350);
            check(HabitWidget.pending(c).length()==1 && HabitWidget.pending(c).getJSONObject(0).getBoolean("checked"),"Home screen tap was not queued");
            String token=HabitWidget.pending(c).getJSONObject(0).getString("token");
            runOnMainSync(()->habitPreview(c,HabitWidget.buildViews(c,17,320,310).apply(c,null)));
            HabitWidget.mark(c,"widgettest",habitDate,true).send();Thread.sleep(200);
            check(token.equals(HabitWidget.pending(c).getJSONObject(0).getString("token")),"Duplicate tap created a second change");
            HabitWidget.mark(c,"widgettest",habitDate,false).send();Thread.sleep(200);
            check(!HabitWidget.pending(c).getJSONObject(0).getBoolean("checked"),"Could not undo an offline mark");
            HabitWidget.mark(c,"widgettest",habitDate,true).send();Thread.sleep(200);
            ZovWidget.open(c,"page","habits","").send();
            for(int i=0;i<60 && HabitWidget.pending(c).length()>0;i++)Thread.sleep(100);
            check(HabitWidget.pending(c).length()==0,"Habit changes not acknowledged");
            check("true".equals(js("!!B.day(B.today()).h.widgettest && !!JSON.parse(localStorage.getItem('bamboo-docs'))['d_'+B.today()].h.widgettest && location.hash==='#/habits'")),"Widget mark not persisted by normal diary");
            ZovWidget.open(c,"albertsLog","book",habitDate).send();
            for(int i=0;i<30 && !"true".equals(js("!!document.querySelector('#albertsPage')"));i++)Thread.sleep(100);
            check("true".equals(js("!!document.querySelector('#albertsPage')")),"Widget could not open the reading log");
            check(c.getPackageManager().getApplicationIcon(c.getPackageName()) instanceof android.graphics.drawable.AdaptiveIconDrawable,"Launcher icon is not adaptive");
            java.io.File installed=new java.io.File(c.getApplicationInfo().sourceDir);
            AppUpdater.validate(activity,installed,AppUpdater.hash(installed),c.getPackageManager().getPackageInfo(c.getPackageName(),0).versionCode);
            boolean rejected=false;try{AppUpdater.validate(activity,installed,"0".repeat(64),5);}catch(Exception expected){rejected=true;}check(rejected,"Wrong update digest accepted");
            js("window.ZovReminder.postMessage(JSON.stringify({op:'clear'}));true");Thread.sleep(300);
            check(!c.getSharedPreferences("widgets",Context.MODE_PRIVATE).contains("habits") && HabitWidget.pending(c).length()==0,"Habit snapshot not cleared");
            check(!c.getSharedPreferences("widgets",Context.MODE_PRIVATE).contains("study"),"Study snapshot not cleared");
            check(c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("items","[]").equals("[]"),"Widget private snapshot not cleared");
            check(new JSONArray(c.getSharedPreferences("reminders",Context.MODE_PRIVATE).getString("schedule","[]")).length()==0,"Reminder schedule not cleared");
            ReminderScheduler.replace(c,new JSONArray(schedule));
            c.startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            // Finish is asynchronous; destroy the renderer explicitly so no browser
            // timer can deliver the notifications under test.
            runOnMainSync(()->{web.stopLoading();web.destroy();activity.finishAndRemoveTask();});
            check(activity.isFinishing(),"Activity must be closing before alarm delivery");
            long deadline=System.currentTimeMillis()+110000;boolean task=false,event=false;
            while(System.currentTimeMillis()<deadline){
                for(android.service.notification.StatusBarNotification n:c.getSystemService(NotificationManager.class).getActiveNotifications()) {
                    task|=n.getTag()!=null&&n.getTag().startsWith("task/nativecheck/");
                    event|=n.getTag()!=null&&n.getTag().startsWith("event/nativeevent/");
                }
                if(task&&event)break;Thread.sleep(1000);
            }
            check(task&&event,"Task/event notification was not delivered with Activity in background");
            ZovWidget.clear(c);ReminderScheduler.replace(c,new JSONArray());
            check(!ReminderScheduler.validTarget("page","bad/page",""),"Invalid navigation accepted");
            check(!ReminderScheduler.validTarget("shad","../5",date),"Invalid SHAD id accepted");
            result.putString("stream","PASS: WebView bridge, task/event background notifications, eight native widget types and offline habit actions, private snapshot cleanup\n");
            finish(Activity.RESULT_OK,result);
        } catch(Throwable e) {result.putString("stream","FAIL: "+e+"\n");finish(Activity.RESULT_CANCELED,result);}
    }
}

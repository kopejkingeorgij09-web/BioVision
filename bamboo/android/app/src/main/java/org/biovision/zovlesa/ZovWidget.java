package org.biovision.zovlesa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Locale;

/** Native widgets render the last local snapshot without starting a WebView. */
public class ZovWidget extends AppWidgetProvider {
    private static SharedPreferences prefs(Context c) {return c.getSharedPreferences("widgets",Context.MODE_PRIVATE);}
    static void replace(Context c, JSONArray input) {
        JSONArray clean = new JSONArray();
        for(int i=0;i<Math.min(300,input.length());i++) {
            JSONObject x=input.optJSONObject(i);
            if(x==null||!ReminderScheduler.validTarget(x.optString("kind"),x.optString("id"),x.optString("date")))continue;
            if(!x.optString("time").matches("(?:(?:[01][0-9]|2[0-3]):[0-5][0-9])?"))continue;
            try {LocalDate.parse(x.getString("date"));} catch(Exception e){continue;}
            clean.put(x);
        }
        prefs(c).edit().putString("items",clean.toString()).putLong("updated",System.currentTimeMillis()).commit();
    }
    static void clear(Context c) {prefs(c).edit().clear().commit();refresh(c);}
    static void pin(Context c, boolean agenda) {
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        if(m.isRequestPinAppWidgetSupported())m.requestPinAppWidget(new ComponentName(c,agenda?AgendaWidget.class:TodayWidget.class),null,null);
        else android.widget.Toast.makeText(c,"Добавь виджет через меню рабочего стола Android",android.widget.Toast.LENGTH_LONG).show();
    }
    static void refresh(Context c) {
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        StudyWidget.refresh(c);
        HabitWidget.refresh(c);
        for(Class<?> type:new Class<?>[]{TodayWidget.class,AgendaWidget.class})
            for(int id:m.getAppWidgetIds(new ComponentName(c,type)))render(c,m,id,type==AgendaWidget.class);
    }
    static PendingIntent open(Context c,String kind,String id,String date) {
        Intent i=new Intent(c,MainActivity.class).setAction(ReminderScheduler.OPEN)
            .setData(Uri.parse("zov-lesa://widget/"+Uri.encode(kind+"/"+id+"/"+date)))
            .putExtra("kind",kind).putExtra("id",id).putExtra("date",date)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void render(Context c,AppWidgetManager m,int id,boolean agenda) {
        WidgetLayout.update(c,m,id,(width,height)->buildViews(c,agenda,width,height));
    }
    static RemoteViews buildViews(Context c,AppWidgetManager m,int id,boolean agenda) {
        android.os.Bundle options=m.getAppWidgetOptions(id);
        return buildViews(c,agenda,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,320),
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,300));
    }
    private static String text(JSONObject x,String key){return x.optString(key, "").trim();}
    private static boolean ended(JSONObject x,LocalDateTime now){
        if(!"event".equals(x.optString("kind")))return false;
        try {return !LocalDateTime.parse(x.optString("end")).isAfter(now);}catch(Exception ignored){return false;}
    }
    private static boolean ongoing(JSONObject x,LocalDateTime now){
        if(!"event".equals(x.optString("kind"))||text(x,"time").isEmpty())return false;
        try {return !LocalDateTime.parse(text(x,"date")+"T"+text(x,"time")).isAfter(now)
            && LocalDateTime.parse(text(x,"end")).isAfter(now);}catch(Exception ignored){return false;}
    }
    private static String timeLabel(JSONObject x,LocalDate today,boolean agenda,LocalDateTime now){
        LocalDate date=LocalDate.parse(text(x,"date"));
        String label=date.isBefore(today)?"Хвост":agenda?(date.equals(today)?"Сегодня":date.equals(today.plusDays(1))?"Завтра":date.format(DateTimeFormatter.ofPattern("d MMM, EEE",new Locale("ru")))):"";
        String time=text(x,"time");
        if(!time.isEmpty()){
            String end=text(x,"end");
            if(end.startsWith(date+"T")&&end.length()>=16)time+="–"+end.substring(11,16);
            label+=(label.isEmpty()?"":" · ")+time;
        } else label+=(label.isEmpty()?"":" · ")+("event".equals(text(x,"kind"))?"Весь день":"Без времени");
        if(ongoing(x,now))label="Сейчас · "+time;
        return label;
    }
    static int dp(Context c,float n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
    static void emphasize(Context c,RemoteViews row) {
        row.setInt(R.id.widget_row,"setBackgroundResource",R.drawable.widget_card_active);
        row.setTextColor(R.id.widget_event_title,c.getColor(R.color.widget_inverse_ink));
        for(int field:new int[]{R.id.widget_time,R.id.widget_location,R.id.widget_teacher})
            row.setTextColor(field,c.getColor(R.color.widget_inverse_sub));
    }
    static RemoteViews buildViews(Context c,boolean agenda,int width,int height){
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.zov_widget);
        LocalDateTime clock=LocalDateTime.now();LocalDate now=clock.toLocalDate();
        String today=now.toString(),until=now.plusDays(7).toString();
        boolean compact=height<220, narrow=width<225;
        boolean shortHeader=narrow&&height<260;
        int padding=compact?10:14, rowPadding=compact?6:9, titleSize=compact?15:16, detailSize=14;
        v.setViewPadding(R.id.widget_root,dp(c,padding),dp(c,padding),dp(c,padding),dp(c,padding));
        String heading=shortHeader?(agenda?"События":"Сегодня"):(agenda?"Ближайшие события":"Дела на сегодня");
        v.setTextViewText(R.id.widget_title,heading);
        v.setTextViewTextSize(R.id.widget_title,TypedValue.COMPLEX_UNIT_SP,compact?18:21);
        String dateLabel=now.format(DateTimeFormatter.ofPattern("d MMMM, EEEE",new Locale("ru")));
        v.setTextViewText(R.id.widget_date,dateLabel);
        v.setViewVisibility(R.id.widget_date,compact?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.widget_open,height<180||shortHeader?View.GONE:View.VISIBLE);
        v.setOnClickPendingIntent(R.id.widget_header,open(c,"page",agenda?"calendar":"today",""));
        v.setOnClickPendingIntent(R.id.widget_open,open(c,"page",agenda?"calendar":"tasks/week",""));
        ArrayList<JSONObject> rows=new ArrayList<>();
        try {
            JSONArray all=new JSONArray(prefs(c).getString("items","[]"));
            for(int i=0;i<all.length();i++) {
                JSONObject x=all.getJSONObject(i);String date=x.optString("date");
                if(agenda) {if(date.compareTo(today)<0||date.compareTo(until)>0)continue;}
                else if(date.compareTo(today)>0||(!date.equals(today)&&!x.optString("kind").equals("task")&&!x.optString("kind").equals("shad")))continue;
                if(ended(x,clock))continue;
                rows.add(x);
            }
        } catch(JSONException ignored){}
        rows.sort(Comparator.comparingInt((JSONObject x)->!agenda&&text(x,"date").compareTo(today)<0?1:0)
            .thenComparing(x->text(x,"date"))
            .thenComparing(x->text(x,"time").isEmpty()?"99:99":text(x,"time")));
        WidgetLayout layout = new WidgetLayout(c,v,width,height);
        int shown=0;
        v.removeAllViews(R.id.widget_rows);
        for(JSONObject x:rows){
            String title=text(x,"title"),location=text(x,"location"),teacher=text(x,"teacher"),time=timeLabel(x,now,agenda,clock);
            RemoteViews card=new RemoteViews(c.getPackageName(),R.layout.zov_widget_row);
            card.setViewPadding(R.id.widget_row,dp(c,rowPadding),dp(c,rowPadding),dp(c,rowPadding),dp(c,rowPadding));
            card.setTextViewText(R.id.widget_time,time);
            card.setTextViewText(R.id.widget_event_title,title);
            card.setTextViewText(R.id.widget_location,location);
            card.setTextViewText(R.id.widget_teacher,teacher);
            card.setTextViewTextSize(R.id.widget_event_title,TypedValue.COMPLEX_UNIT_SP,titleSize);
            card.setInt(R.id.widget_event_title,"setMaxLines",compact&&!narrow?1:3);
            for(int field:new int[]{R.id.widget_location,R.id.widget_teacher}){
                card.setTextViewTextSize(field,TypedValue.COMPLEX_UNIT_SP,detailSize);
                card.setInt(field,"setMaxLines",compact&&!narrow?1:3);
            }
            card.setViewVisibility(R.id.widget_location,location.isEmpty()?View.GONE:View.VISIBLE);
            card.setViewVisibility(R.id.widget_teacher,teacher.isEmpty()?View.GONE:View.VISIBLE);
            if(shown==0 || ongoing(x,clock)) emphasize(c,card);
            card.setContentDescription(R.id.widget_row,time+". "+title+". "+location+". "+teacher);
            card.setOnClickPendingIntent(R.id.widget_row,open(c,text(x,"kind"),text(x,"id"),text(x,"date")));
            if(!layout.fits(card)){
                if(shown>0)break;
                // Keep the first title available even with the largest accessibility fonts.
                for(int field:new int[]{R.id.widget_event_title,R.id.widget_location,R.id.widget_teacher})
                    card.setInt(field,"setMaxLines",1);
                if(!layout.fits(card))break;
            }
            v.addView(R.id.widget_rows,card);shown++;
            if(shown==8)break;
        }
        long updated=prefs(c).getLong("updated",0);
        v.setViewVisibility(R.id.widget_rows,shown==0?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.widget_empty,shown==0?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.widget_empty,updated==0?"Открой Зов леса,\nчтобы загрузить календарь и дела":!rows.isEmpty()?"Открой список или увеличь виджет":agenda?"Ближайшие дни свободны":"На сегодня всё свободно");
        String footer=rows.size()>shown?"Ещё "+(rows.size()-shown)+" · ":"";
        footer+=agenda?"Открыть календарь":"Все дела";
        if(shortHeader && rows.size()>shown){
            v.setTextViewText(R.id.widget_title,heading+" · +"+(rows.size()-shown));
            v.setContentDescription(R.id.widget_header,heading+". "+footer);
        }
        v.setTextViewText(R.id.widget_open,footer);
        v.setContentDescription(R.id.widget_open,footer+(updated==0?"":". Данные обновлены "+java.time.Instant.ofEpochMilli(updated).atZone(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("d.MM HH:mm"))));
        return v;
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){refresh(c);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,android.os.Bundle options){refresh(c);}
    @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(!AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(i.getAction()))refresh(c);}
}

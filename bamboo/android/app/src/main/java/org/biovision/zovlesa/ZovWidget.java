package org.biovision.zovlesa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
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
    private static final int[] ROWS = {R.id.widget_row1,R.id.widget_row2,R.id.widget_row3,R.id.widget_row4,R.id.widget_row5,R.id.widget_row6};
    private static SharedPreferences prefs(Context c) {return c.getSharedPreferences("widgets",Context.MODE_PRIVATE);}
    static void replace(Context c, JSONArray input) {
        JSONArray clean = new JSONArray();
        for(int i=0;i<Math.min(300,input.length());i++) {
            JSONObject x=input.optJSONObject(i);
            if(x==null||!ReminderScheduler.validTarget(x.optString("kind"),x.optString("id"),x.optString("date")))continue;
            if(!x.optString("time").matches("(?:[0-2][0-9]:[0-5][0-9])?"))continue;
            try {LocalDate.parse(x.getString("date"));} catch(Exception e){continue;}
            clean.put(x);
        }
        prefs(c).edit().putString("items",clean.toString()).putLong("updated",System.currentTimeMillis()).commit();
        refresh(c);
    }
    static void clear(Context c) {prefs(c).edit().clear().commit();refresh(c);}
    static void pin(Context c, boolean agenda) {
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        if(m.isRequestPinAppWidgetSupported())m.requestPinAppWidget(new ComponentName(c,agenda?AgendaWidget.class:TodayWidget.class),null,null);
        else android.widget.Toast.makeText(c,"Добавь виджет через меню рабочего стола Android",android.widget.Toast.LENGTH_LONG).show();
    }
    static void refresh(Context c) {
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        for(Class<?> type:new Class<?>[]{TodayWidget.class,AgendaWidget.class})
            for(int id:m.getAppWidgetIds(new ComponentName(c,type)))render(c,m,id,type==AgendaWidget.class);
    }
    private static PendingIntent open(Context c,String kind,String id,String date) {
        Intent i=new Intent(c,MainActivity.class).setAction(ReminderScheduler.OPEN)
            .setData(Uri.parse("zov-lesa://widget/"+Uri.encode(kind+"/"+id+"/"+date)))
            .putExtra("kind",kind).putExtra("id",id).putExtra("date",date)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void render(Context c,AppWidgetManager m,int id,boolean agenda) {
        m.updateAppWidget(id, buildViews(c,m,id,agenda));
    }
    static RemoteViews buildViews(Context c,AppWidgetManager m,int id,boolean agenda) {
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.zov_widget);
        LocalDate now=LocalDate.now();String today=now.toString(),until=now.plusDays(7).toString();
        v.setTextViewText(R.id.widget_title,agenda?"Ближайшие события":"Дела на сегодня");
        v.setTextViewText(R.id.widget_date,now.format(DateTimeFormatter.ofPattern("d MMMM, EEE",new Locale("ru"))));
        v.setOnClickPendingIntent(R.id.widget_header,open(c,"page",agenda?"tasks/calendar":"today",""));
        v.setOnClickPendingIntent(R.id.widget_open,open(c,"page",agenda?"tasks/calendar":"tasks/week",""));
        ArrayList<JSONObject> rows=new ArrayList<>();
        try {
            JSONArray all=new JSONArray(prefs(c).getString("items","[]"));
            for(int i=0;i<all.length();i++) {
                JSONObject x=all.getJSONObject(i);String date=x.optString("date");
                if(agenda) {if(date.compareTo(today)<0||date.compareTo(until)>0)continue;}
                else if(date.compareTo(today)>0||(!date.equals(today)&&!x.optString("kind").equals("task")&&!x.optString("kind").equals("shad")))continue;
                rows.add(x);
            }
        } catch(JSONException ignored){}
        rows.sort(Comparator.comparing(x->x.optString("date")+"T"+x.optString("time")));
        int max=m.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,200)<180?3:6;
        for(int i=0;i<ROWS.length;i++) {
            boolean visible=i<Math.min(max,rows.size());v.setViewVisibility(ROWS[i],visible?View.VISIBLE:View.GONE);
            if(!visible)continue;
            JSONObject x=rows.get(i);String date=x.optString("date"),time=x.optString("time");
            String label=agenda?LocalDate.parse(date).format(DateTimeFormatter.ofPattern("d.MM")):(date.compareTo(today)<0?"Хвост":"");
            if(!time.isEmpty())label+=(label.isEmpty()?"":" · ")+time;
            if(!label.isEmpty())label+="  ";
            v.setTextViewText(ROWS[i],label+x.optString("title"));
            v.setOnClickPendingIntent(ROWS[i],open(c,x.optString("kind"),x.optString("id"),date));
        }
        long updated=prefs(c).getLong("updated",0);
        String footer=updated==0?"Открой приложение для загрузки дел":rows.isEmpty()?"Дел нет · Открыть приложение":rows.size()>max?"Ещё "+(rows.size()-max)+" · Открыть все":"Открыть все";
        if(updated>0)footer+=" · "+java.time.Instant.ofEpochMilli(updated).atZone(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("d.MM HH:mm"));
        v.setTextViewText(R.id.widget_open,footer);
        return v;
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){refresh(c);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,android.os.Bundle options){refresh(c);}
    @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(!AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(i.getAction()))refresh(c);}
}

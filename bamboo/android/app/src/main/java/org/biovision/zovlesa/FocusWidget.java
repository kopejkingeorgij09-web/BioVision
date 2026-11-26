package org.biovision.zovlesa;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DateFormat;
import java.time.LocalDate;
import java.util.Date;

public final class FocusWidget extends AppWidgetProvider {
    static void save(Context c, JSONObject snapshot) {
        if(snapshot!=null) c.getSharedPreferences("widgets",0).edit().putString("focus",snapshot.toString()).apply();
    }
    static void refresh(Context c) {
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        new FocusWidget().onUpdate(c,manager,manager.getAppWidgetIds(new ComponentName(c,FocusWidget.class)));
    }
    @Override public void onUpdate(Context c,AppWidgetManager manager,int[] ids) {
        JSONObject s;
        try {s=new JSONObject(c.getSharedPreferences("widgets",0).getString("focus","{}"));}
        catch(Exception ignored){s=new JSONObject();}
        for(int id:ids){
            RemoteViews views=new RemoteViews(c.getPackageName(),R.layout.widget_focus);
            long until=s.optLong("until");
            String clock=until>System.currentTimeMillis()?"До "+DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(until)):
                until>0?"Сеанс завершён":s.optString("clock","25:00");
            views.setTextViewText(R.id.focus_clock,clock);
            views.setTextViewText(R.id.focus_title,s.optString("title","Фокус"));
            JSONArray plan=s.optJSONArray("plan"),week=s.optJSONArray("week");
            StringBuilder details=new StringBuilder();int minutes=0;
            if(week!=null)for(int i=0;i<week.length();i++)minutes+=week.optInt(i);
            details.append("За 7 дней · ").append(minutes).append(" мин");
            if(plan!=null)for(int i=0;i<Math.min(3,plan.length());i++)details.append("\n").append(plan.optString(i));
            views.setTextViewText(R.id.focus_details,details.toString());
            views.setViewVisibility(R.id.focus_details,manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)>=100?View.VISIBLE:View.GONE);
            views.setOnClickPendingIntent(R.id.focus_root,ZovWidget.open(c,"page","board/focus",LocalDate.now().toString()));
            manager.updateAppWidget(id,views);
        }
    }
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){onUpdate(c,m,new int[]{id});}
}

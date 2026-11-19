package org.biovision.zovlesa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Iterator;
import java.util.UUID;

public final class HabitWidget extends AppWidgetProvider {
    private static final String MARK="org.biovision.zovlesa.MARK_HABIT", PAGE="org.biovision.zovlesa.HABIT_PAGE";
    private static final String SNAPSHOT="habits", QUEUE="habitQueue";
    static LocalDate day(){return Instant.now().minusSeconds(4*3600L).atZone(ZoneId.systemDefault()).toLocalDate();}
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("widgets",Context.MODE_PRIVATE);}
    private static JSONObject read(Context c,String key){
        try{return new JSONObject(prefs(c).getString(key,"{}"));}
        catch(JSONException ignored){return new JSONObject();}
    }
    private static JSONArray rows(JSONObject snapshot){
        JSONArray rows=snapshot.optJSONArray("rows");return rows==null?new JSONArray():rows;
    }
    static JSONArray pending(Context c){
        JSONObject queue=read(c,QUEUE);JSONArray result=new JSONArray();
        for(Iterator<String> keys=queue.keys();keys.hasNext();)result.put(queue.optJSONObject(keys.next()));
        return result;
    }
    static void replace(Context c,JSONObject snapshot,JSONArray acks) throws JSONException {
        if(snapshot==null || snapshot.optJSONArray("rows")==null)return;
        JSONObject queue=read(c,QUEUE);
        if(acks!=null)for(int i=0;i<acks.length();i++){
            JSONObject ack=acks.optJSONObject(i);if(ack==null)continue;
            String key=ack.optString("date")+"/"+ack.optString("id");JSONObject current=queue.optJSONObject(key);
            if(current!=null && current.optString("token").equals(ack.optString("token")))queue.remove(key);
        }
        prefs(c).edit().putString(SNAPSHOT,snapshot.toString()).putString(QUEUE,queue.toString()).commit();
    }
    private static double value(JSONObject snapshot,JSONObject queue,JSONObject h,String date){
        JSONObject change=queue.optJSONObject(date+"/"+h.optString("id"));
        if(change!=null)return change.optBoolean("checked")?1:0;
        return date.equals(snapshot.optString("date"))?h.optDouble("value",0):0;
    }
    static PendingIntent mark(Context c,String id,String date,boolean checked){
        Uri data=new Uri.Builder().scheme("zov-lesa").authority("habitmark").appendPath(date).appendPath(id).appendPath(checked?"1":"0").build();
        Intent intent=new Intent(c,HabitWidget.class).setAction(MARK).setData(data)
            .putExtra("id",id).putExtra("date",date).putExtra("checked",checked);
        return PendingIntent.getBroadcast(c,0,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private static void record(Context c,Intent intent) throws JSONException {
        String date=intent.getStringExtra("date"),id=intent.getStringExtra("id");
        if(!day().toString().equals(date)||id==null)return;
        JSONObject snapshot=read(c,SNAPSHOT),queue=read(c,QUEUE);
        JSONArray list=rows(snapshot);
        for(int i=0;i<list.length();i++){
            JSONObject h=list.optJSONObject(i);
            if(h==null||!id.equals(h.optString("id"))||!h.optString("auto").isEmpty())continue;
            boolean checked=intent.getBooleanExtra("checked",false);
            if(checked==(value(snapshot,queue,h,date)>0))return;
            queue.put(date+"/"+id,new JSONObject().put("id",id).put("date",date).put("checked",checked)
                .put("token",UUID.randomUUID().toString()));
            prefs(c).edit().putString(QUEUE,queue.toString()).commit();
            return;
        }
    }
    private static PendingIntent page(Context c,int id,int start){
        Intent i=new Intent(c,HabitWidget.class).setAction(PAGE)
            .setData(Uri.parse("zov-lesa://habits/"+id+"/"+start)).putExtra("widget",id).putExtra("start",start);
        return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    }
    static RemoteViews buildViews(Context c,int widget,int width,int height){
        JSONObject snapshot=read(c,SNAPSHOT),queue=read(c,QUEUE);
        String date=day().toString();JSONArray list=rows(snapshot);
        int total=list.length(),done=0;
        for(int i=0;i<total;i++)if(value(snapshot,queue,list.optJSONObject(i),date)>0)done++;
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.zov_widget);
        int pad=ZovWidget.dp(c,height<220?10:14);v.setViewPadding(R.id.widget_root,pad,pad,pad,pad);
        PendingIntent all=ZovWidget.open(c,"page","habits","");
        v.setTextViewText(R.id.widget_title,"Привычки");
        v.setTextViewText(R.id.widget_date,"Сегодня · отмечено "+done+" из "+total);
        v.setViewVisibility(R.id.widget_date,total==0?View.GONE:View.VISIBLE);
        v.setOnClickPendingIntent(R.id.widget_header,all);
        v.setOnClickPendingIntent(R.id.widget_root,all);
        v.setOnClickPendingIntent(R.id.widget_open,all);
        v.setTextViewText(R.id.widget_open,"Все привычки");
        v.removeAllViews(R.id.widget_rows);
        WidgetLayout layout=new WidgetLayout(c,v,width,height);
        int start=prefs(c).getInt("habitPage"+widget,0);
        if(start<0||start>=total)start=0;
        int shown=0;
        for(int i=start;i<total;i++){
            JSONObject h=list.optJSONObject(i);String name=h.optString("name"),id=h.optString("id");
            boolean manual=h.optString("auto").isEmpty();
            double val=value(snapshot,queue,h,date);
            RemoteViews row=new RemoteViews(c.getPackageName(),R.layout.habit_widget_row);
            row.setTextViewText(R.id.habit_name,name);
            row.setTextViewText(R.id.habit_state,val==0?"□":val==0.5?"◐":"✓");
            row.setViewVisibility(R.id.habit_entry,manual?View.GONE:View.VISIBLE);
            if(val>0){
                row.setInt(R.id.widget_row,"setBackgroundResource",R.drawable.widget_card_active);
                row.setTextColor(R.id.habit_name,c.getColor(R.color.widget_inverse_ink));
                row.setTextColor(R.id.habit_state,c.getColor(R.color.widget_inverse_ink));
                row.setTextColor(R.id.habit_entry,c.getColor(R.color.widget_inverse_ink));
            }
            String state=val==0?"Без отметки":val==0.5?"Минимум":"Выполнено";
            row.setContentDescription(R.id.widget_row,name+". "+state+". "+(manual?(val>0?"Снять отметку":"Отметить"):"Открыть запись"));
            row.setOnClickPendingIntent(R.id.widget_row,manual?mark(c,id,date,val==0):ZovWidget.open(c,"habit",id,date));
            if(!layout.fits(row))break;
            v.addView(R.id.widget_rows,row);if(++shown==10)break;
        }
        if(shown>0 && shown<total){
            int next=start+shown<total?start+shown:0;
            v.setTextViewText(R.id.widget_open,(next==0?"В начало":"Дальше")+" · "+(start+1)+"–"+(start+shown)+" из "+total);
            v.setOnClickPendingIntent(R.id.widget_open,page(c,widget,next));
        }
        v.setViewVisibility(R.id.widget_rows,shown==0?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.widget_empty,shown==0?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.widget_empty,!snapshot.has("rows")?"Открой приложение для загрузки привычек":total==0?"Добавь первую привычку в приложении":"Увеличь виджет для отметок");
        return v;
    }
    static void refresh(Context c){
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        for(int id:m.getAppWidgetIds(new ComponentName(c,HabitWidget.class)))
            WidgetLayout.update(c,m,id,(w,h)->buildViews(c,id,w,h));
    }
    @Override public void onReceive(Context c,Intent i){
        if(MARK.equals(i.getAction())){try{record(c,i);}catch(JSONException ignored){}refresh(c);return;}
        if(PAGE.equals(i.getAction())){prefs(c).edit().putInt("habitPage"+i.getIntExtra("widget",0),i.getIntExtra("start",0)).apply();refresh(c);return;}
        super.onReceive(c,i);
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){refresh(c);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){refresh(c);}
    @Override public void onDeleted(Context c,int[] ids){
        SharedPreferences.Editor e=prefs(c).edit();for(int id:ids)e.remove("habitPage"+id);e.apply();
    }
}

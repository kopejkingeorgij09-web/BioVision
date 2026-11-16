package org.biovision.zovlesa;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Locale;

/** Offline study dashboards share the same signed local snapshot as the agenda. */
public class StudyWidget extends AppWidgetProvider {
 static final Class<?>[] TYPES={ShadTodayWidget.class,ShadProgressWidget.class,AlbertsWidget.class};
 static void replace(Context c,JSONObject data){
  if(data==null||data.toString().length()>160000)return;
  c.getSharedPreferences("widgets",0).edit().putString("study",data.toString()).commit();refresh(c);
 }
 static void clear(Context c){c.getSharedPreferences("widgets",0).edit().remove("study").commit();refresh(c);}
 static void pin(Context c,Class<?> type){AppWidgetManager m=AppWidgetManager.getInstance(c);if(m.isRequestPinAppWidgetSupported())m.requestPinAppWidget(new ComponentName(c,type),null,null);else android.widget.Toast.makeText(c,"Добавь виджет через меню рабочего стола Android",android.widget.Toast.LENGTH_LONG).show();}
 static void refresh(Context c){AppWidgetManager m=AppWidgetManager.getInstance(c);for(int type=0;type<TYPES.length;type++)for(int id:m.getAppWidgetIds(new ComponentName(c,TYPES[type]))){Bundle o=m.getAppWidgetOptions(id);m.updateAppWidget(id,buildViews(c,type,o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,320),o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,350)));}}
 static RemoteViews buildViews(Context c,int mode,int width,int height){
  RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.study_widget);LocalDate today=LocalDate.now();
  String date=today.toString(),ws=today.minusDays(today.getDayOfWeek().getValue()-1).toString(),we=LocalDate.parse(ws).plusDays(6).toString();
  boolean small=height<270;String page=mode==2?"tasks/alberts":"tasks/shad";
  v.setTextViewText(R.id.widget_title,mode==0?"ШАД сегодня":mode==1?"Прогресс ШАДа":"Альбертс");
  v.setTextViewText(R.id.widget_date,today.format(DateTimeFormatter.ofPattern("d MMMM, EEEE",new Locale("ru"))));
  v.setViewVisibility(R.id.widget_brand,small?View.GONE:View.VISIBLE);
  v.setOnClickPendingIntent(R.id.widget_header,ZovWidget.open(c,"page",page,""));
  v.setOnClickPendingIntent(R.id.widget_open,ZovWidget.open(c,"page",page,""));
  v.setTextViewText(R.id.widget_open,"Открыть "+(mode==2?"Альбертса":"ШАД")+"  →");
  v.removeAllViews(R.id.widget_rows);
  JSONObject data;try{data=new JSONObject(c.getSharedPreferences("widgets",0).getString("study","{}"));}catch(Exception e){data=new JSONObject();}
  JSONObject shad=data.optJSONObject("shad"),alberts=data.optJSONObject("alberts");
  ArrayList<JSONObject> cards=new ArrayList<>();int value=0,total=0;String label="",empty="";
  if(mode<2&&shad!=null){
   JSONArray schedule=shad.optJSONArray("schedule");if(schedule==null)schedule=new JSONArray();
   int weekDone=0,weekTotal=0,unplaced=0,dayDone=0,dayTotal=0;
   for(int i=0;i<schedule.length();i++){
    JSONObject x=schedule.optJSONObject(i);if(x==null)continue;String d=x.optString("date");
    if(d.compareTo(ws)>=0&&d.compareTo(we)<=0){weekTotal++;if(x.optBoolean("done"))weekDone++;else if(!x.optBoolean("placed"))unplaced++;}
    if(d.equals(date)&&x.optBoolean("placed")){dayTotal++;if(x.optBoolean("done"))dayDone++;if(mode==0)cards.add(x);}
   }
   if(mode==0){value=dayDone;total=dayTotal;label="вебов и ДЗ выполнено сегодня";empty=unplaced>0?"На неделю без выбранного дня: "+unplaced:"На сегодня вебы и ДЗ не назначены";}
   else {value=shad.optInt("closed");total=shad.optInt("total");label="вебов закрыто · просмотрено "+shad.optInt("watched")+" · ДЗ сдано "+shad.optInt("homework");
    try{cards.add(new JSONObject().put("title","Неделя ШАДа").put("detail",weekDone+" из "+weekTotal+" дел выполнено · без дня: "+unplaced));}catch(Exception ignored){}
    for(int i=0;i<schedule.length();i++){JSONObject x=schedule.optJSONObject(i);if(x!=null&&!x.optBoolean("done")&&x.optString("date").compareTo(we)<=0){cards.add(x);break;}}
   }
  }else if(mode==2&&alberts!=null){
   int current=alberts.optInt("current",17);JSONArray plan=alberts.optJSONArray("plan");JSONObject week=null;
   if(plan!=null)for(int i=0;i<plan.length();i++){JSONObject w=plan.optJSONObject(i);if(w!=null&&w.optString("from").compareTo(date)<=0&&w.optString("to").compareTo(date)>=0)week=w;}
   if(week!=null){total=week.optInt("pages");value=Math.max(0,Math.min(total,current-week.optInt("pageFrom")+1));label="страниц за эту неделю · до "+LocalDate.parse(week.optString("to")).format(DateTimeFormatter.ofPattern("d.MM"));}
   else {total=alberts.optInt("total");value=alberts.optInt("done");label=alberts.optBoolean("complete")?"Том 1 прочитан":"страниц прочитано в томе 1";}
   try{cards.add(new JSONObject().put("title","Глава "+alberts.optInt("chapter")+" · "+alberts.optString("title")).put("detail",alberts.optBoolean("complete")?"Том 1 прочитан":"Продолжить: стр. PDF "+alberts.optInt("next")+(week==null?"":" · цель до "+week.optInt("pageTo"))));}catch(Exception ignored){}
  }else empty="Открой приложение и дождись синхронизации";
  v.setTextViewText(R.id.study_value,value+" / "+total);v.setTextViewText(R.id.study_label,label);
  v.setProgressBar(R.id.study_bar,1000,total>0?(int)(value*1000L/total):0,false);
  boolean metric=!(mode==0&&small);v.setViewVisibility(R.id.study_metric,metric?View.VISIBLE:View.GONE);
  v.setViewVisibility(R.id.widget_open,height<230?View.GONE:View.VISIBLE);
  int textWidth=ZovWidget.dp(c,width-48),remaining=ZovWidget.dp(c,height-28-(height<230?0:32)-60-(small?0:16));
  if(metric)remaining-=ZovWidget.linesHeight(c,value+" / "+total,30,textWidth,1,true)+ZovWidget.linesHeight(c,label,11,textWidth,2,false)+ZovWidget.dp(c,31);
  int shown=0;
  for(JSONObject x:cards){
   String title=x.optString("title"),detail=x.optString("detail"),time=x.optString("time");
   if(mode<2&&x.has("id"))detail=(x.optBoolean("done")?"✓ ":"")+detail+(x.optBoolean("placed")?"":" · выбрать день");
   int size=ZovWidget.dp(c,30)+(time.isEmpty()?0:ZovWidget.linesHeight(c,time,11,textWidth,1,true))+ZovWidget.linesHeight(c,title,15,textWidth,2,true)+(detail.isEmpty()?0:ZovWidget.linesHeight(c,detail,12,textWidth,2,false)+ZovWidget.dp(c,4));
   if(size>remaining)break;
   RemoteViews card=new RemoteViews(c.getPackageName(),R.layout.zov_widget_row);
   card.setTextViewText(R.id.widget_time,time);card.setViewVisibility(R.id.widget_time,time.isEmpty()?View.GONE:View.VISIBLE);
   card.setTextViewText(R.id.widget_event_title,title);card.setTextViewText(R.id.widget_location,detail);card.setViewVisibility(R.id.widget_location,detail.isEmpty()?View.GONE:View.VISIBLE);card.setViewVisibility(R.id.widget_teacher,View.GONE);
   card.setContentDescription(R.id.widget_row,title+". "+detail);
   card.setOnClickPendingIntent(R.id.widget_row,mode<2&&x.has("id")?ZovWidget.open(c,"shad",x.optString("id"),x.optString("date")):ZovWidget.open(c,"page",page,""));
   v.addView(R.id.widget_rows,card);shown++;remaining-=size;if(shown==6)break;
  }
  if(shown<cards.size())v.setTextViewText(R.id.widget_open,"Ещё "+(cards.size()-shown)+" · Открыть трек →");
  v.setViewVisibility(R.id.widget_empty,!empty.isEmpty()&&shown==0?View.VISIBLE:View.GONE);v.setTextViewText(R.id.widget_empty,empty);
  return v;
 }
 @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){refresh(c);}
 @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){refresh(c);}
 @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(!AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(i.getAction()))refresh(c);}
}

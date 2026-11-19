package org.biovision.zovlesa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class StudyWidget extends AppWidgetProvider {
    static final int TODAY=0, COURSE=1, ALBERTS=2, WEEK=3, BOOKMARK=4;
    static final Class<?>[] TYPES={ShadTodayWidget.class,ShadProgressWidget.class,AlbertsWidget.class,ShadWeekWidget.class,BookmarkWidget.class};
    private static final String[] TITLES={"ШАД сегодня","Прогресс ШАДа","Альбертс","ШАД на неделю","Альбертс"};
    private static final DateTimeFormatter DATE=DateTimeFormatter.ofPattern("d MMMM, EEEE",new Locale("ru"));
    private static final DateTimeFormatter SHORT=DateTimeFormatter.ofPattern("d.MM");

    static void replace(Context c,JSONObject data){
        if(data!=null && data.toString().length()<=240000)
            c.getSharedPreferences("widgets",0).edit().putString("study",data.toString()).apply();
    }
    static void pin(Context c,Class<?> type){
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        if(m.isRequestPinAppWidgetSupported())m.requestPinAppWidget(new ComponentName(c,type),null,null);
        else android.widget.Toast.makeText(c,"Добавь виджет через меню рабочего стола Android",android.widget.Toast.LENGTH_LONG).show();
    }
    static void refresh(Context c){
        AppWidgetManager m=AppWidgetManager.getInstance(c);
        for(int index=0;index<TYPES.length;index++){
            final int mode=index;
            for(int id:m.getAppWidgetIds(new ComponentName(c,TYPES[mode])))
                WidgetLayout.update(c,m,id,(w,h)->buildViews(c,mode,w,h));
        }
    }
    private static JSONObject saved(Context c){
        try{return new JSONObject(c.getSharedPreferences("widgets",0).getString("study","{}"));}
        catch(Exception ignored){return new JSONObject();}
    }
    private static final class Card {
        final String title,detail,kicker;
        final PendingIntent action;
        Card(String title,String detail,String kicker,PendingIntent action){
            this.title=title;this.detail=detail;this.kicker=kicker;this.action=action;
        }
        RemoteViews view(Context c,boolean first){
            RemoteViews row=new RemoteViews(c.getPackageName(),R.layout.zov_widget_row);
            row.setTextViewText(R.id.widget_time,kicker);
            row.setViewVisibility(R.id.widget_time,kicker.isEmpty()?View.GONE:View.VISIBLE);
            row.setTextViewText(R.id.widget_event_title,title);
            row.setTextViewText(R.id.widget_location,detail);
            row.setViewVisibility(R.id.widget_location,detail.isEmpty()?View.GONE:View.VISIBLE);
            row.setViewVisibility(R.id.widget_teacher,View.GONE);
            row.setContentDescription(R.id.widget_row,kicker+" "+title+". "+detail);
            row.setOnClickPendingIntent(R.id.widget_row,action);
            if(first)ZovWidget.emphasize(c,row);
            return row;
        }
    }
    private static final class Content {
        String value="",label="",empty="Открой приложение, чтобы загрузить трек";
        int count,total;
        PendingIntent primary,footer;
        String link;
        final List<Card> cards=new ArrayList<>();
        void progress(int n,int all,String caption){
            count=n;total=all;value=n+" / "+all;label=caption;
        }
    }
    private static void reading(Context c,Content out,JSONObject book,LocalDate today,boolean bookmark){
        if(book==null)return;
        int next=book.optInt("next"),current=book.optInt("current");
        if(next<1 || next>796)return;
        boolean complete=book.optBoolean("complete");
        String chapter="Глава "+book.optInt("chapter")+" · "+book.optString("title");
        Uri uri=Uri.parse("https://kopejkingeorgij09-web.github.io/BioVision/#/reading/alberts/pdf/"+next);
        PendingIntent read=PendingIntent.getActivity(c,0,new Intent(Intent.ACTION_VIEW,uri),PendingIntent.FLAG_IMMUTABLE);
        JSONArray plan=book.optJSONArray("plan");JSONObject week=null;
        String date=today.toString();
        for(int i=0;plan!=null&&i<plan.length();i++){
            JSONObject w=plan.optJSONObject(i);
            if(w!=null && w.optString("from").compareTo(date)<=0 && w.optString("to").compareTo(date)>=0){week=w;break;}
        }
        out.empty="";
        if(bookmark){
            out.value=complete?"Прочитано":"Стр. "+next;
            out.label=chapter;out.primary=read;out.link=complete?"Открыть книгу":"Продолжить чтение";out.footer=read;
            return;
        }
        if(week!=null && !complete){
            int n=week.optInt("pages");
            out.progress(Math.max(0,Math.min(n,current-week.optInt("pageFrom")+1)),n,"стр. за неделю · цель до стр. "+week.optInt("pageTo"));
        }else out.progress(book.optInt("done"),book.optInt("total"),complete?"Том 1 прочитан":"страниц в первом томе");
        out.cards.add(new Card(chapter,complete?"Открыть книгу":"Продолжить со стр. "+next,"",read));
        out.link="Записать страницу";out.footer=ZovWidget.open(c,"albertsLog","book",date);
    }
    private static void shad(Context c,Content out,JSONObject data,LocalDate now,int mode){
        if(data==null || data.optInt("total")==0)return;
        LocalDate monday=now.minusDays(now.getDayOfWeek().getValue()-1);
        String today=now.toString(),start=monday.toString(),end=monday.plusDays(6).toString();
        JSONArray schedule=data.optJSONArray("schedule");
        List<JSONObject> selected=new ArrayList<>();
        int web=0,hw=0,webDone=0,hwDone=0,dailyDone=0;
        for(int i=0;schedule!=null&&i<schedule.length();i++){
            JSONObject x=schedule.optJSONObject(i);if(x==null)continue;
            String d=x.optString("date");boolean inWeek=d.compareTo(start)>=0&&d.compareTo(end)<=0;
            boolean onDay=d.equals(today)&&x.optBoolean("placed"),done=x.optBoolean("done");
            if(inWeek){
                if(x.optString("title").startsWith("ДЗ ·")){hw++;if(done)hwDone++;}
                else {web++;if(done)webDone++;}
            }
            if(onDay&&done)dailyDone++;
            if(mode==TODAY?onDay:inWeek&&!done)selected.add(x);
        }
        selected.sort(Comparator.comparing((JSONObject x)->x.optBoolean("done"))
            .thenComparing(x->!x.optBoolean("placed")).thenComparing(x->x.optString("date"))
            .thenComparing(x->x.optString("time").isEmpty()?"99:99":x.optString("time")));
        String weekly="Вебы "+webDone+"/"+web+" · ДЗ "+hwDone+"/"+hw;
        if(mode==TODAY){
            out.progress(dailyDone,selected.size(),"дел ШАД выполнено сегодня");
            out.empty="На сегодня ничего не назначено";
        }else if(mode==WEEK){
            out.progress(webDone+hwDone,web+hw,weekly);
            out.empty=web+hw==0?"На эту неделю пока ничего не запланировано":"План недели выполнен";
        }else{
            out.progress(data.optInt("closed"),data.optInt("total"),"закрыто · просмотрено "+data.optInt("watched")+" · ДЗ сдано "+data.optInt("homework"));
            out.cards.add(new Card("На этой неделе",weekly,"",out.footer));
            out.empty="";
        }
        for(JSONObject x:selected){
            String time=x.optString("time"),date=x.optString("date"),kicker;
            if(!x.optBoolean("placed"))kicker="Выбрать день";
            else if(mode==TODAY)kicker=time;
            else kicker=LocalDate.parse(date).format(SHORT)+(time.isEmpty()?"":" · "+time);
            PendingIntent open=ZovWidget.open(c,"shad",x.optString("id"),date);
            out.cards.add(new Card(x.optString("title"),x.optBoolean("done")?"Выполнено":x.optString("detail"),kicker,open));
            if(mode==COURSE)break;
        }
    }
    static RemoteViews buildViews(Context c,int mode,int width,int height){
        boolean book=mode==ALBERTS||mode==BOOKMARK,bookmark=mode==BOOKMARK,compact=height<210;
        LocalDate today=LocalDate.now();Content out=new Content();
        PendingIntent track=ZovWidget.open(c,"page",book?"tasks/alberts":"tasks/shad","");
        out.footer=track;out.primary=track;out.link=book?"План чтения":"Открыть ШАД";
        JSONObject data=saved(c);
        if(book)reading(c,out,data.optJSONObject("alberts"),HabitWidget.day(),bookmark);
        else shad(c,out,data.optJSONObject("shad"),today,mode);
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.study_widget);
        int pad=ZovWidget.dp(c,compact?10:14);v.setViewPadding(R.id.widget_root,pad,pad,pad,pad);
        v.setTextViewText(R.id.widget_title,TITLES[mode]);
        v.setTextViewTextSize(R.id.widget_title,TypedValue.COMPLEX_UNIT_SP,compact?17:21);
        v.setTextViewText(R.id.widget_date,(book?HabitWidget.day():today).format(DATE));
        v.setViewVisibility(R.id.widget_date,compact||bookmark?View.GONE:View.VISIBLE);
        v.setOnClickPendingIntent(R.id.widget_header,track);
        v.setOnClickPendingIntent(R.id.widget_root,out.primary);
        v.setOnClickPendingIntent(R.id.study_metric,out.primary);
        v.setOnClickPendingIntent(R.id.widget_open,out.footer);
        v.setTextViewText(R.id.widget_open,out.link);
        v.setViewVisibility(R.id.widget_open,height<(bookmark?160:180)?View.GONE:View.VISIBLE);
        v.setTextViewText(R.id.study_value,out.value);v.setTextViewText(R.id.study_label,out.label);
        v.setViewVisibility(R.id.study_metric,out.value.isEmpty()||(mode==TODAY&&compact&&!out.cards.isEmpty())?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.study_bar,out.total>0?View.VISIBLE:View.GONE);
        v.setProgressBar(R.id.study_bar,1000,out.total==0?0:(int)(out.count*1000L/out.total),false);
        v.removeAllViews(R.id.widget_rows);
        WidgetLayout layout=new WidgetLayout(c,v,width,height);
        int shown=0;
        for(Card item:out.cards){
            RemoteViews row=item.view(c,shown==0);
            if(!layout.fits(row))break;
            v.addView(R.id.widget_rows,row);if(++shown==6)break;
        }
        if(shown<out.cards.size() && !book)v.setTextViewText(R.id.widget_open,"Ещё "+(out.cards.size()-shown)+" · Открыть ШАД");
        boolean empty=out.cards.isEmpty()&&!out.empty.isEmpty();
        v.setViewVisibility(R.id.widget_rows,shown==0?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.widget_empty,empty?View.VISIBLE:View.GONE);
        v.setTextViewText(R.id.widget_empty,out.empty);
        return v;
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){refresh(c);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){refresh(c);}
}

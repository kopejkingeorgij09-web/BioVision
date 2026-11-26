package org.biovision.zovlesa;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;

/** Explicit user initiated updates. Android's package installer makes the final decision. */
final class AppUpdater {
 static final String ROOT="https://kopejkingeorgij09-web.github.io/BioVision/";
 private final MainActivity activity;private JSONObject release;private String message="Проверь наличие новой версии",status="idle";private volatile boolean busy;
 AppUpdater(MainActivity a){activity=a;}
 static String hash(File file)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");try(java.io.InputStream in=new java.io.FileInputStream(file)){byte[] b=new byte[32768];int n;while((n=in.read(b))>0)digest.update(b,0,n);}StringBuilder out=new StringBuilder();for(byte b:digest.digest())out.append(String.format("%02x",b&255));return out.toString();}
 static boolean allowed(String url){return url.startsWith(ROOT+"releases/zov-lesa/")&&!url.contains("..")&&!url.contains("?")&&!url.contains("#");}
 static HttpURLConnection connection(String url)throws Exception{if(!allowed(url))throw new Exception("Неверный адрес обновления");HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Cache-Control","no-cache");if(c.getResponseCode()!=200){c.disconnect();throw new Exception("Сервер обновлений временно недоступен");}return c;}
 void publish(){try{JSONObject x=new JSONObject().put("status",status).put("message",message).put("current",activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName);activity.updateStatus(x);}catch(Exception ignored){}}
 void check(){if(busy)return;busy=true;status="busy";message="Проверяю новую версию…";publish();new Thread(()->{
  try{HttpURLConnection c=connection(ROOT+"releases/zov-lesa/manifest.json");byte[] bytes;try(java.io.InputStream in=c.getInputStream()){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))>0){out.write(buffer,0,n);if(out.size()>128000)throw new Exception("Слишком большой манифест");}bytes=out.toByteArray();}finally{c.disconnect();}JSONObject feed=new JSONObject(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));JSONObject next=feed.getJSONObject("android");
   int current=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;
   if(next.getInt("build")>current&&allowed(next.getString("url"))&&next.getString("sha256").matches("[a-f0-9]{64}")){release=next;status="available";message="Доступна версия "+next.getString("version");}else {release=null;status="current";message="Установлена актуальная версия";}
  }catch(Exception e){status="error";message="Не удалось проверить обновления. Попробуй позже.";}finally{busy=false;activity.runOnUiThread(this::publish);}
 },"zov-update-check").start();}
 static void validate(Activity a,File apk,String expected,int version)throws Exception{
  if(!hash(apk).equals(expected))throw new Exception("Контрольная сумма не совпала");
  PackageManager pm=a.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
  PackageInfo next=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags),own=pm.getPackageInfo(a.getPackageName(),flags);
  if(next==null||!a.getPackageName().equals(next.packageName)||next.versionCode!=version)throw new Exception("Неверный пакет обновления");
  android.content.pm.Signature[] n=Build.VERSION.SDK_INT>=28?next.signingInfo.getApkContentsSigners():next.signatures,o=Build.VERSION.SDK_INT>=28?own.signingInfo.getApkContentsSigners():own.signatures;
  if(!Arrays.equals(n,o))throw new Exception("Подпись обновления не совпала");
 }
 void install(){if(busy||release==null)return;
  if(!activity.getPackageManager().canRequestPackageInstalls()) {message="Разреши установку обновлений для Зова леса и нажми ещё раз";publish();activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));return;}
  busy=true;status="busy";message="Скачиваю и проверяю обновление…";publish();JSONObject selected=release;
  new Thread(()->{try{
   File apk=new File(activity.getCacheDir(),"zov-update.apk");HttpURLConnection c=connection(selected.getString("url"));long count=0,max=40000000;
   try(java.io.InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(apk)){byte[] b=new byte[32768];int n;while((n=in.read(b))>0){count+=n;if(count>max)throw new Exception("Слишком большой пакет");out.write(b,0,n);}}finally{c.disconnect();}
   validate(activity,apk,selected.getString("sha256"),selected.getInt("build"));
   activity.runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("content://"+activity.getPackageName()+".updates/apk"),"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(intent);status="available";message="Подтверди установку в системном окне";publish();});
  }catch(Exception e){status="error";message="Не удалось установить обновление: "+e.getMessage();activity.runOnUiThread(this::publish);}finally{busy=false;}},"zov-update-download").start();
 }
}

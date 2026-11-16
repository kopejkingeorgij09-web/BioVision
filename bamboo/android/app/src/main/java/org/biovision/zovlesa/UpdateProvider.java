package org.biovision.zovlesa;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;
public final class UpdateProvider extends ContentProvider {
 @Override public boolean onCreate(){return true;}
 private File file(Uri u)throws FileNotFoundException{if(!"/apk".equals(u.getPath()))throw new FileNotFoundException();return new File(getContext().getCacheDir(),"zov-update.apk");}
 @Override public String getType(Uri u){return "application/vnd.android.package-archive";}
 @Override public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.MODE_READ_ONLY);}
 @Override public Cursor query(Uri u,String[] p,String s,String[] a,String order){MatrixCursor c=new MatrixCursor(new String[]{"_display_name","_size"});try{File f=file(u);c.addRow(new Object[]{"Zov-Lesa.apk",f.length()});}catch(Exception ignored){}return c;}
 @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
 @Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
 @Override public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}

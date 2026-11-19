package org.biovision.zovlesa;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Use the launcher's reported sizes and measure the actual text at the user's font scale. */
final class WidgetLayout {
    interface Renderer { RemoteViews build(int width, int height); }

    static void update(Context context, AppWidgetManager manager, int id, Renderer renderer) {
        Bundle options = manager.getAppWidgetOptions(id);
        if (Build.VERSION.SDK_INT >= 31) {
            List<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty() && sizes.size() <= 16) {
                Map<SizeF, RemoteViews> views = new LinkedHashMap<>();
                for (SizeF size : sizes) if (size.getWidth() > 0 && size.getHeight() > 0)
                    views.put(size, renderer.build((int) size.getWidth(), (int) size.getHeight()));
                if (!views.isEmpty()) { manager.updateAppWidget(id, new RemoteViews(views)); return; }
            }
        }
        boolean wide = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int width = options.getInt(wide ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320);
        int height = options.getInt(wide ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 300);
        manager.updateAppWidget(id, renderer.build(width, height));
    }

    final LinearLayout rows;
    private final Context context;
    private int room;

    WidgetLayout(Context c, RemoteViews widget, int width, int height) {
        context = c;
        View root = widget.apply(c, null);
        root.measure(exact(ZovWidget.dp(c,width)), exact(ZovWidget.dp(c,height)));
        rows = root.findViewById(R.id.widget_rows);
        room = rows.getMeasuredHeight();
    }

    boolean fits(RemoteViews card) {
        View view = card.apply(context, rows);
        view.measure(exact(rows.getMeasuredWidth()), View.MeasureSpec.UNSPECIFIED);
        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
        int height = view.getMeasuredHeight() + lp.topMargin + lp.bottomMargin;
        if (height > room) return false;
        room -= height;
        return true;
    }

    private static int exact(int pixels) { return View.MeasureSpec.makeMeasureSpec(pixels, View.MeasureSpec.EXACTLY); }
}

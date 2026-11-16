package org.biovision.zovlesa;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        ReminderScheduler.createChannel(context);
        if (ReminderScheduler.TEST_FIRE.equals(intent.getAction())) ReminderScheduler.showTest(context);
        else ReminderScheduler.refresh(context);
        ZovWidget.refresh(context);
    }
}

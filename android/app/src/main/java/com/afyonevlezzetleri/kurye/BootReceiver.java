package com.afyonevlezzetleri.kurye;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context baglam, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String eylem = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(eylem)
            && !"android.intent.action.QUICKBOOT_POWERON".equals(eylem)) {
            return;
        }

        SharedPreferences tercihler = baglam.getSharedPreferences(MainActivity.TERCIH_ADI, Context.MODE_PRIVATE);
        String kuryeId = tercihler.getString(MainActivity.ANAHTAR_KURYE_ID, "");
        if (kuryeId == null || kuryeId.isEmpty()) {
            return;
        }

        Intent servisIntent = new Intent(baglam, KuryeDinleyiciServisi.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            baglam.startForegroundService(servisIntent);
        } else {
            baglam.startService(servisIntent);
        }
    }
}

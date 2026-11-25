package com.afyonevlezzetleri.kurye;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class KuryeDinleyiciServisi extends Service {

    public static final String EYLEM_ALARM_CAL = "com.afyonevlezzetleri.kurye.EYLEM_ALARM_CAL";
    public static final String EYLEM_OTURUM_GUNCELLENDI = "com.afyonevlezzetleri.kurye.EYLEM_OTURUM_GUNCELLENDI";
    public static final String EKSTRA_BASLIK = "baslik";
    public static final String EKSTRA_MESAJ = "mesaj";

    private static final String GOREV_KANAL_ID = "afyon_kurye_gorev_kanali";
    private static final String ALARM_KANAL_ID = "afyon_kurye_siparis_alarmi";
    private static final int ON_PLAN_BILDIRIM_ID = 3001;
    private static final int ALARM_BILDIRIM_ID = 3002;

    private PowerManager.WakeLock kismiKilit;
    private ScheduledExecutorService zamanlayici;
    private final Set<String> bilinenSiparisIdleri = new HashSet<>();
    private String firebaseProjeId = "";
    private String firebaseApiAnahtari = "";
    private String firestoreDbId = "(default)";

    @Override
    public void onCreate() {
        super.onCreate();
        bildirimKanallariniOlustur();
        firebaseYapilandirmasiniOku();

        PowerManager gucYonetimi = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (gucYonetimi != null) {
            kismiKilit = gucYonetimi.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AfyonKurye::DinleyiciKilidi");
            kismiKilit.acquire(10 * 60 * 1000L);
        }

        startForeground(ON_PLAN_BILDIRIM_ID, gorevBildirimiOlustur("Afyon Kurye aktif — yeni siparişler dinleniyor."));
        canliDinlemeyiBaslat();
    }

    @Override
    public int onStartCommand(Intent intent, int bayraklar, int baslangicId) {
        if (intent != null && EYLEM_ALARM_CAL.equals(intent.getAction())) {
            String baslik = intent.getStringExtra(EKSTRA_BASLIK);
            String mesaj = intent.getStringExtra(EKSTRA_MESAJ);
            yuksekOncelikliAlarmTetikle(
                baslik != null ? baslik : "Yeni Paket Hazır!",
                mesaj != null ? mesaj : "Sevk masasında yeni teslimat bekliyor."
            );
        } else if (intent != null && EYLEM_OTURUM_GUNCELLENDI.equals(intent.getAction())) {
            SharedPreferences tercihler = getSharedPreferences(MainActivity.TERCIH_ADI, MODE_PRIVATE);
            String kuryeAdi = tercihler.getString(MainActivity.ANAHTAR_KURYE_ADI, "Kurye");
            NotificationManager bildirimYoneticisi = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (bildirimYoneticisi != null) {
                bildirimYoneticisi.notify(
                    ON_PLAN_BILDIRIM_ID,
                    gorevBildirimiOlustur(kuryeAdi + " görevde — canlı paket takibi açık.")
                );
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (zamanlayici != null) {
            zamanlayici.shutdownNow();
        }
        if (kismiKilit != null && kismiKilit.isHeld()) {
            kismiKilit.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void bildirimKanallariniOlustur() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici == null) return;

        NotificationChannel gorevKanali = new NotificationChannel(
            GOREV_KANAL_ID,
            "Kurye Görev Takibi",
            NotificationManager.IMPORTANCE_LOW
        );
        gorevKanali.setDescription("Kurye arka plan dinleme servisi durumu");
        yonetici.createNotificationChannel(gorevKanali);

        Uri zilSesi = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (zilSesi == null) {
            zilSesi = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        NotificationChannel alarmKanali = new NotificationChannel(
            ALARM_KANAL_ID,
            "Acil Sipariş Alarmı",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarmKanali.setDescription("Yeni paket veya şube siparişi hazır olduğunda sesli uyandırma");
        alarmKanali.enableVibration(true);
        alarmKanali.setVibrationPattern(new long[]{0, 450, 200, 450, 200, 600});
        alarmKanali.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        AudioAttributes sesOzellikleri = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alarmKanali.setSound(zilSesi, sesOzellikleri);
        yonetici.createNotificationChannel(alarmKanali);
    }

    private Notification gorevBildirimiOlustur(String icerikMetni) {
        Intent acilisIntent = new Intent(this, MainActivity.class);
        PendingIntent bekleyenIntent = PendingIntent.getActivity(
            this,
            0,
            acilisIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder kurucu = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, GOREV_KANAL_ID)
            : new Notification.Builder(this);

        return kurucu
            .setContentTitle("Afyon Kurye")
            .setContentText(icerikMetni)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setContentIntent(bekleyenIntent)
            .build();
    }

    private void yuksekOncelikliAlarmTetikle(String baslik, String mesaj) {
        PowerManager gucYonetimi = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (gucYonetimi != null) {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock ekranKilidi = gucYonetimi.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "AfyonKurye::AlarmUyandirma"
            );
            ekranKilidi.acquire(10000L);
        }

        Vibrator titresim = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (titresim != null && titresim.hasVibrator()) {
            long[] desen = new long[]{0, 400, 150, 400, 150, 550};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                titresim.vibrate(VibrationEffect.createWaveform(desen, -1));
            } else {
                titresim.vibrate(desen, -1);
            }
        }

        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            Ringtone zil = RingtoneManager.getRingtone(getApplicationContext(), alarmUri);
            if (zil != null) {
                zil.play();
            }
        } catch (Exception ignored) {
        }

        Intent tamEkranIntent = new Intent(this, MainActivity.class);
        tamEkranIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tamEkranBekleyen = PendingIntent.getActivity(
            this,
            1,
            tamEkranIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder kurucu = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, ALARM_KANAL_ID)
            : new Notification.Builder(this);

        Notification bildirim = kurucu
            .setContentTitle(baslik)
            .setContentText(mesaj)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setAutoCancel(true)
            .setContentIntent(tamEkranBekleyen)
            .setFullScreenIntent(tamEkranBekleyen, true)
            .build();

        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici != null) {
            yonetici.notify(ALARM_BILDIRIM_ID, bildirim);
        }
    }

    private void firebaseYapilandirmasiniOku() {
        try (InputStream girdi = getAssets().open("www/apk-meta.json");
             BufferedReader okuyucu = new BufferedReader(new InputStreamReader(girdi, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String satir;
            while ((satir = okuyucu.readLine()) != null) {
                sb.append(satir);
            }
            JSONObject meta = new JSONObject(sb.toString());
            firebaseProjeId = meta.optString("firebaseProjectId", "");
            firebaseApiAnahtari = meta.optString("firebaseApiKey", "");
            String dbId = meta.optString("firestoreDatabaseId", "(default)");
            firestoreDbId = (dbId == null || dbId.isEmpty()) ? "(default)" : dbId;
        } catch (Exception ignored) {
        }
    }

    private void canliDinlemeyiBaslat() {
        zamanlayici = Executors.newSingleThreadScheduledExecutor();
        zamanlayici.scheduleWithFixedDelay(() -> {
            if (firebaseProjeId.isEmpty() || firebaseApiAnahtari.isEmpty() || firebaseApiAnahtari.contains("Dummy")) {
                return;
            }
            koleksiyonKontrolEt("siparisler", "paketlendi", "Yeni Mutfak Paketi Hazır!");
            koleksiyonKontrolEt("sube_siparisleri", "teslime_hazir", "Yeni Şube Siparişi Hazır!");
        }, 12, 18, TimeUnit.SECONDS);
    }

    private void koleksiyonKontrolEt(String koleksiyonAdi, String hedefDurum, String alarmBasligi) {
        HttpURLConnection baglanti = null;
        try {
            String adres = "https://firestore.googleapis.com/v1/projects/"
                + firebaseProjeId
                + "/databases/"
                + firestoreDbId
                + "/documents/"
                + koleksiyonAdi
                + "?pageSize=25&key="
                + firebaseApiAnahtari;

            baglanti = (HttpURLConnection) new URL(adres).openConnection();
            baglanti.setConnectTimeout(8000);
            baglanti.setReadTimeout(8000);
            if (baglanti.getResponseCode() != HttpURLConnection.HTTP_OK) return;

            StringBuilder yanit = new StringBuilder();
            try (BufferedReader okuyucu = new BufferedReader(new InputStreamReader(baglanti.getInputStream(), StandardCharsets.UTF_8))) {
                String satir;
                while ((satir = okuyucu.readLine()) != null) {
                    yanit.append(satir);
                }
            }

            JSONObject kok = new JSONObject(yanit.toString());
            JSONArray belgeler = kok.optJSONArray("documents");
            if (belgeler == null) return;

            for (int i = 0; i < belgeler.length(); i++) {
                JSONObject belge = belgeler.getJSONObject(i);
                String adYolu = belge.optString("name", "");
                JSONObject alanlar = belge.optJSONObject("fields");
                if (alanlar == null) continue;

                JSONObject durumObj = alanlar.optJSONObject("durum");
                String durum = durumObj != null ? durumObj.optString("stringValue", "") : "";
                JSONObject kuryeObj = alanlar.optJSONObject("kurye_id");
                String atananKurye = kuryeObj != null ? kuryeObj.optString("stringValue", "") : "";

                if (hedefDurum.equals(durum) && atananKurye.isEmpty() && !bilinenSiparisIdleri.contains(adYolu)) {
                    bilinenSiparisIdleri.add(adYolu);
                    JSONObject kodObj = alanlar.optJSONObject("siparis_kodu");
                    String kod = kodObj != null ? kodObj.optString("stringValue", "Yeni") : "Yeni";
                    yuksekOncelikliAlarmTetikle(alarmBasligi, "#" + kod + " numaralı paket teslim alınmayı bekliyor.");
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (baglanti != null) {
                baglanti.disconnect();
            }
        }
    }
}

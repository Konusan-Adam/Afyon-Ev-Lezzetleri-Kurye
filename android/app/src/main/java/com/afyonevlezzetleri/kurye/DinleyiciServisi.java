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
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
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

public class DinleyiciServisi extends Service {

    public static volatile boolean uygulamaOnPlanda = false;

    public static final String EYLEM_ZIL_CAL = "com.afyonevlezzetleri.kurye.EYLEM_ZIL_CAL";
    public static final String EYLEM_ZIL_SUSTUR = "com.afyonevlezzetleri.kurye.EYLEM_ZIL_SUSTUR";
    public static final String EYLEM_OTURUM_GUNCELLENDI = "com.afyonevlezzetleri.kurye.EYLEM_OTURUM_GUNCELLENDI";
    public static final String EKSTRA_BASLIK = "baslik";
    public static final String EKSTRA_MESAJ = "mesaj";
    public static final String EKSTRA_KESINTISIZ = "kesintisiz";
    public static final String EKSTRA_SURE_SN = "sure_sn";

    private static final String ORTAK_PROJE_ID = "tfy-smart-fishing-511521";
    private static final String ORTAK_VERITABANI_ID = "ai-studio-afyonevlezzetler-373e291d-b34e-4126-ac5e-613533550d71";

    private static final String GOREV_KANAL_ID = "afyon_kurye_gorev_kanali";
    private static final String ALARM_KANAL_ID = "afyon_kurye_siparis_alarmi";
    private static final int ON_PLAN_BILDIRIM_ID = 3001;
    private static final int ALARM_BILDIRIM_ID = 3002;

    private PowerManager.WakeLock kismiKilit;
    private ScheduledExecutorService zamanlayici;
    private final Set<String> bilinenSiparisler = new HashSet<>();
    private final Set<String> bilinenIptaller = new HashSet<>();
    private final Handler anaIsParcacigi = new Handler(Looper.getMainLooper());
    private MediaPlayer aktifCalar;
    private String firebaseApiAnahtari = "";

    @Override
    public void onCreate() {
        super.onCreate();
        bildirimKanallariniOlustur();
        apiAnahtariniOku();

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
        if (intent == null) return START_STICKY;

        String eylem = intent.getAction();
        if (EYLEM_ZIL_CAL.equals(eylem)) {
            String baslik = intent.getStringExtra(EKSTRA_BASLIK);
            String mesaj = intent.getStringExtra(EKSTRA_MESAJ);
            boolean kesintisiz = intent.getBooleanExtra(EKSTRA_KESINTISIZ, true);
            int sureSn = intent.getIntExtra(EKSTRA_SURE_SN, 15);
            alarmTetikle(
                baslik != null ? baslik : "Yeni Kurye Görevi!",
                mesaj != null ? mesaj : "Teslime hazır yeni sipariş bekliyor.",
                kesintisiz,
                sureSn,
                true
            );
        } else if (EYLEM_ZIL_SUSTUR.equals(eylem)) {
            alarmiSustur();
        } else if (EYLEM_OTURUM_GUNCELLENDI.equals(eylem)) {
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
        alarmiSustur();
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

        NotificationChannel alarmKanali = new NotificationChannel(
            ALARM_KANAL_ID,
            "Acil Kurye Alarmı",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarmKanali.setDescription("Yeni paket, şube teslimatı veya iptal uyarısı");
        alarmKanali.enableVibration(true);
        alarmKanali.setVibrationPattern(new long[]{0, 450, 200, 450, 200, 600});
        alarmKanali.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alarmKanali.setSound(null, null);
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

    private synchronized void alarmiSustur() {
        anaIsParcacigi.removeCallbacksAndMessages(null);
        if (aktifCalar != null) {
            try {
                if (aktifCalar.isPlaying()) {
                    aktifCalar.stop();
                }
                aktifCalar.release();
            } catch (Exception ignored) {
            }
            aktifCalar = null;
        }
        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici != null) {
            yonetici.cancel(ALARM_BILDIRIM_ID);
        }
    }

    private void alarmTetikle(String baslik, String mesaj, boolean kesintisiz, int sureSn, boolean zorlaCal) {
        // Ekran açık ve uygulama ön plandaysa (zorunlu test değilse) çift ses olmaması için sesi WebView çalar
        if (uygulamaOnPlanda && !zorlaCal) {
            bildirimGoster(baslik, mesaj);
            return;
        }

        PowerManager gucYonetimi = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (gucYonetimi != null) {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock ekranKilidi = gucYonetimi.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "AfyonKurye::AlarmUyandirma"
            );
            ekranKilidi.acquire(12000L);
        }

        Vibrator titresim = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (titresim != null && titresim.hasVibrator()) {
            long[] desen = new long[]{0, 450, 150, 450, 150, 600};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                titresim.vibrate(VibrationEffect.createWaveform(desen, -1));
            } else {
                titresim.vibrate(desen, -1);
            }
        }

        medyaCalarBaslat(kesintisiz, sureSn);
        bildirimGoster(baslik, mesaj);
    }

    private synchronized void medyaCalarBaslat(boolean kesintisiz, int sureSn) {
        alarmiSustur();

        SharedPreferences tercihler = getSharedPreferences(MainActivity.TERCIH_ADI, MODE_PRIVATE);
        String seciliKimlik = tercihler.getString(MainActivity.ANAHTAR_ZIL_KIMLIK, "korna_klasik");
        float sesSeviyesi = tercihler.getFloat(MainActivity.ANAHTAR_ZIL_SES_SEVIYESI, 0.9f);

        try {
            MediaPlayer calar = new MediaPlayer();
            calar.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );

            File ozelDosya = new File(getFilesDir(), MainActivity.OZEL_ZIL_DOSYASI);
            boolean kaynakHazir = false;

            if ("ozel".equals(seciliKimlik) && ozelDosya.exists() && ozelDosya.length() > 0) {
                calar.setDataSource(ozelDosya.getAbsolutePath());
                kaynakHazir = true;
            } else {
                int rawId = getResources().getIdentifier("zil_" + seciliKimlik, "raw", getPackageName());
                if (rawId == 0) {
                    rawId = getResources().getIdentifier("zil_korna_klasik", "raw", getPackageName());
                }
                if (rawId != 0) {
                    Uri rawUri = Uri.parse("android.resource://" + getPackageName() + "/" + rawId);
                    calar.setDataSource(getApplicationContext(), rawUri);
                    kaynakHazir = true;
                }
            }

            if (!kaynakHazir) {
                Uri varsayilanAlarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (varsayilanAlarm == null) {
                    varsayilanAlarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                calar.setDataSource(getApplicationContext(), varsayilanAlarm);
            }

            calar.setLooping(kesintisiz);
            calar.setVolume(sesSeviyesi, sesSeviyesi);
            calar.prepare();
            calar.start();
            aktifCalar = calar;

            long durdurmaMs = Math.max(3000L, Math.min(sureSn * 1000L, 60000L));
            anaIsParcacigi.postDelayed(this::alarmiSustur, durdurmaMs);
        } catch (Exception ignored) {
        }
    }

    private void bildirimGoster(String baslik, String mesaj) {
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

    private void apiAnahtariniOku() {
        try (InputStream girdi = getAssets().open("www/apk-meta.json");
             BufferedReader okuyucu = new BufferedReader(new InputStreamReader(girdi, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String satir;
            while ((satir = okuyucu.readLine()) != null) {
                sb.append(satir);
            }
            JSONObject meta = new JSONObject(sb.toString());
            String anahtar = meta.optString("firebaseApiKey", "");
            if (!anahtar.contains("Dummy")) {
                firebaseApiAnahtari = anahtar;
            }
        } catch (Exception ignored) {
        }
    }

    private void canliDinlemeyiBaslat() {
        zamanlayici = Executors.newSingleThreadScheduledExecutor();
        zamanlayici.scheduleWithFixedDelay(() -> {
            SharedPreferences tercihler = getSharedPreferences(MainActivity.TERCIH_ADI, MODE_PRIVATE);
            String aktifKuryeId = tercihler.getString(MainActivity.ANAHTAR_KURYE_ID, "");
            koleksiyonKontrolEt("siparisler", "paketlendi", aktifKuryeId, false);
            koleksiyonKontrolEt("sube_siparisleri", "teslime_hazir", aktifKuryeId, true);
        }, 8, 12, TimeUnit.SECONDS);
    }

    private void koleksiyonKontrolEt(
        String koleksiyonAdi,
        String hazirDurum,
        String aktifKuryeId,
        boolean subeSiparisiMi
    ) {
        HttpURLConnection baglanti = null;
        try {
            StringBuilder urlBuilder = new StringBuilder();
            urlBuilder.append("https://firestore.googleapis.com/v1/projects/")
                .append(ORTAK_PROJE_ID)
                .append("/databases/")
                .append(ORTAK_VERITABANI_ID)
                .append("/documents/")
                .append(koleksiyonAdi)
                .append("?pageSize=30");

            if (!firebaseApiAnahtari.isEmpty()) {
                urlBuilder.append("&key=").append(firebaseApiAnahtari);
            }

            baglanti = (HttpURLConnection) new URL(urlBuilder.toString()).openConnection();
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
                String belgeYolu = belge.optString("name", "");
                JSONObject alanlar = belge.optJSONObject("fields");
                if (alanlar == null) continue;

                String durum = metinAlaniOku(alanlar, "durum");
                String atananKurye = metinAlaniOku(alanlar, "kurye_id");
                String kod = metinAlaniOku(alanlar, "siparis_kodu");
                if (kod.isEmpty()) kod = "Yeni";

                if (subeSiparisiMi) {
                    String teslimatTipi = metinAlaniOku(alanlar, "teslimat_tipi");
                    if (!teslimatTipi.isEmpty() && !"teslimat".equals(teslimatTipi)) {
                        continue;
                    }
                }

                boolean kuryeyeAtandi = !aktifKuryeId.isEmpty() && aktifKuryeId.equals(atananKurye);
                boolean havuzdaHazir = hazirDurum.equals(durum) && (atananKurye.isEmpty() || kuryeyeAtandi);

                if (havuzdaHazir && !bilinenSiparisler.contains(belgeYolu)) {
                    bilinenSiparisler.add(belgeYolu);
                    String baslik = subeSiparisiMi ? "Yeni Şube Teslimatı Hazır!" : "Yeni Mutfak Paketi Hazır!";
                    String adres = metinAlaniOku(alanlar, "teslimat_adresi_metni");
                    String detay = "#" + kod + (adres.isEmpty() ? " teslim alınmayı bekliyor." : " • " + adres);
                    alarmTetikle(baslik, detay, true, 20, false);
                }

                if ("iptal".equals(durum) && kuryeyeAtandi && !bilinenIptaller.contains(belgeYolu)) {
                    bilinenIptaller.add(belgeYolu);
                    alarmTetikle("Sipariş İptal Edildi", "#" + kod + " numaralı teslimat iptal edildi.", false, 6, false);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (baglanti != null) {
                baglanti.disconnect();
            }
        }
    }

    private String metinAlaniOku(JSONObject alanlar, String anahtar) {
        JSONObject obje = alanlar.optJSONObject(anahtar);
        return obje != null ? obje.optString("stringValue", "") : "";
    }
}

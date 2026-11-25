package com.afyonevlezzetleri.kurye;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    public static final String TERCIH_ADI = "AfyonKuryeTercihler";
    public static final String ANAHTAR_KURYE_ID = "kurye_id";
    public static final String ANAHTAR_KURYE_ADI = "kurye_adi";
    public static final String ANAHTAR_CANLI_ADRES = "canli_panel_adresi";
    private static final int IZIN_ISTEK_KODU = 1042;
    private static final String VARSAYILAN_YEREL_ADRES = "file:///android_asset/www/index.html";

    private WebView webGorunumu;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle kayitliDurum) {
        super.onCreate(kayitliDurum);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webGorunumu = new WebView(this);
        webGorunumu.setBackgroundColor(Color.parseColor("#0C020E"));

        WebSettings ayarlar = webGorunumu.getSettings();
        ayarlar.setJavaScriptEnabled(true);
        ayarlar.setDomStorageEnabled(true);
        ayarlar.setDatabaseEnabled(true);
        ayarlar.setGeolocationEnabled(true);
        ayarlar.setAllowFileAccess(true);
        ayarlar.setAllowContentAccess(true);
        ayarlar.setMediaPlaybackRequiresUserGesture(false);
        ayarlar.setCacheMode(WebSettings.LOAD_DEFAULT);

        webGorunumu.addJavascriptInterface(new KuryeAndroidKopru(this), "AfyonKuryeAndroid");

        webGorunumu.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView gorunum, WebResourceRequest istek) {
                Uri uri = istek.getUrl();
                String semasi = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                if ("tel".equals(semasi) || "mailto".equals(semasi) || "geo".equals(semasi)) {
                    Intent disIntent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(disIntent);
                    return true;
                }
                return false;
            }
        });

        webGorunumu.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                String kaynak,
                GeolocationPermissions.Callback geriBildirim
            ) {
                geriBildirim.invoke(kaynak, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest istek) {
                runOnUiThread(() -> istek.grant(istek.getResources()));
            }
        });

        setContentView(webGorunumu);

        gerekliIzinleriIste();
        dinleyiciServisiBaslat();

        SharedPreferences tercihler = getSharedPreferences(TERCIH_ADI, MODE_PRIVATE);
        String ozelAdres = tercihler.getString(ANAHTAR_CANLI_ADRES, "");
        if (ozelAdres != null && ozelAdres.startsWith("https://")) {
            webGorunumu.loadUrl(ozelAdres);
        } else {
            webGorunumu.loadUrl(VARSAYILAN_YEREL_ADRES);
        }
    }

    @Override
    public void onBackPressed() {
        if (webGorunumu != null && webGorunumu.canGoBack()) {
            webGorunumu.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void gerekliIzinleriIste() {
        List<String> istenecekler = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            istenecekler.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            istenecekler.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            istenecekler.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                istenecekler.add("android.permission.POST_NOTIFICATIONS");
            }
        }
        if (!istenecekler.isEmpty()) {
            requestPermissions(istenecekler.toArray(new String[0]), IZIN_ISTEK_KODU);
        }
    }

    private void dinleyiciServisiBaslat() {
        Intent servisIntent = new Intent(this, KuryeDinleyiciServisi.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(servisIntent);
        } else {
            startService(servisIntent);
        }
    }

    public static class KuryeAndroidKopru {
        private final Activity aktivite;

        public KuryeAndroidKopru(Activity aktivite) {
            this.aktivite = aktivite;
        }

        @JavascriptInterface
        public void oturumBilgisiKaydet(String kuryeId, String kuryeAdi) {
            SharedPreferences tercihler = aktivite.getSharedPreferences(TERCIH_ADI, Context.MODE_PRIVATE);
            tercihler.edit()
                .putString(ANAHTAR_KURYE_ID, kuryeId != null ? kuryeId : "")
                .putString(ANAHTAR_KURYE_ADI, kuryeAdi != null ? kuryeAdi : "Kurye")
                .apply();

            Intent servisIntent = new Intent(aktivite, KuryeDinleyiciServisi.class);
            servisIntent.setAction(KuryeDinleyiciServisi.EYLEM_OTURUM_GUNCELLENDI);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                aktivite.startForegroundService(servisIntent);
            } else {
                aktivite.startService(servisIntent);
            }
        }

        @JavascriptInterface
        public void oturumTemizle() {
            SharedPreferences tercihler = aktivite.getSharedPreferences(TERCIH_ADI, Context.MODE_PRIVATE);
            tercihler.edit()
                .remove(ANAHTAR_KURYE_ID)
                .remove(ANAHTAR_KURYE_ADI)
                .apply();
        }

        @JavascriptInterface
        public void titre(long sureMs) {
            long guvenliSure = Math.max(50L, Math.min(sureMs, 3000L));
            Vibrator titresim = (Vibrator) aktivite.getSystemService(Context.VIBRATOR_SERVICE);
            if (titresim == null || !titresim.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                titresim.vibrate(VibrationEffect.createOneShot(guvenliSure, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                titresim.vibrate(guvenliSure);
            }
        }

        @JavascriptInterface
        public void sesliAlarmCal(String baslik, String mesaj) {
            Intent alarmIntent = new Intent(aktivite, KuryeDinleyiciServisi.class);
            alarmIntent.setAction(KuryeDinleyiciServisi.EYLEM_ALARM_CAL);
            alarmIntent.putExtra(KuryeDinleyiciServisi.EKSTRA_BASLIK, baslik != null ? baslik : "Yeni Kurye Görevi");
            alarmIntent.putExtra(KuryeDinleyiciServisi.EKSTRA_MESAJ, mesaj != null ? mesaj : "Teslime hazır yeni paket bekliyor.");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                aktivite.startForegroundService(alarmIntent);
            } else {
                aktivite.startService(alarmIntent);
            }
        }

        @JavascriptInterface
        public boolean pilMuafiyetiVarMi() {
            PowerManager gucYonetimi = (PowerManager) aktivite.getSystemService(Context.POWER_SERVICE);
            if (gucYonetimi == null) return false;
            return gucYonetimi.isIgnoringBatteryOptimizations(aktivite.getPackageName());
        }

        @JavascriptInterface
        @SuppressLint("BatteryLife")
        public void pilMuafiyetiIste() {
            if (pilMuafiyetiVarMi()) return;
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + aktivite.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            aktivite.startActivity(intent);
        }

        @JavascriptInterface
        public String uygulamaBilgisiGetir() {
            try {
                PackageInfo bilgi = aktivite.getPackageManager().getPackageInfo(aktivite.getPackageName(), 0);
                long surumKodu = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? bilgi.getLongVersionCode()
                    : bilgi.versionCode;
                String surumAdi = bilgi.versionName != null ? bilgi.versionName : "1.0.0";
                return "{\"paketAdi\":\"" + aktivite.getPackageName()
                    + "\",\"surumAdi\":\"" + surumAdi
                    + "\",\"surumKodu\":" + surumKodu + "}";
            } catch (Exception e) {
                return "{\"paketAdi\":\"com.afyonevlezzetleri.kurye\",\"surumAdi\":\"1.0.0\",\"surumKodu\":100}";
            }
        }

        @JavascriptInterface
        public void apkGuncelleIndirVeKur(final String indirmeAdresi, final String surumAdi) {
            if (indirmeAdresi == null || !indirmeAdresi.startsWith("https://")) {
                return;
            }
            new Thread(() -> {
                HttpURLConnection baglanti = null;
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        && !aktivite.getPackageManager().canRequestPackageInstalls()) {
                        Intent izinIntent = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + aktivite.getPackageName())
                        );
                        izinIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        aktivite.startActivity(izinIntent);
                        return;
                    }

                    URL hedefUrl = new URL(indirmeAdresi);
                    baglanti = (HttpURLConnection) hedefUrl.openConnection();
                    baglanti.setConnectTimeout(15000);
                    baglanti.setReadTimeout(60000);
                    baglanti.setInstanceFollowRedirects(true);
                    baglanti.connect();

                    if (baglanti.getResponseCode() != HttpURLConnection.HTTP_OK) {
                        return;
                    }

                    File hedefDosya = new File(aktivite.getCacheDir(), "afyon-kurye-guncelleme.apk");
                    try (InputStream girdi = new BufferedInputStream(baglanti.getInputStream());
                         FileOutputStream cikti = new FileOutputStream(hedefDosya)) {
                        byte[] tampon = new byte[8192];
                        int okunan;
                        while ((okunan = girdi.read(tampon)) != -1) {
                            cikti.write(tampon, 0, okunan);
                        }
                        cikti.flush();
                    }

                    Uri icerikUri = ApkDosyaSaglayici.uriOlustur(aktivite, hedefDosya);
                    Intent kurulumIntent = new Intent(Intent.ACTION_VIEW);
                    kurulumIntent.setDataAndType(icerikUri, "application/vnd.android.package-archive");
                    kurulumIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    aktivite.startActivity(kurulumIntent);
                } catch (Exception ignored) {
                } finally {
                    if (baglanti != null) {
                        baglanti.disconnect();
                    }
                }
            }, "AfyonApkGuncelleme").start();
        }
    }
}

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
import android.provider.Settings;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    public static final String TERCIH_ADI = "AfyonKuryeTercihler";
    public static final String ANAHTAR_KURYE_ID = "kurye_id";
    public static final String ANAHTAR_KURYE_ADI = "kurye_adi";
    public static final String ANAHTAR_ROL = "kullanici_rol";
    public static final String ANAHTAR_ZIL_KIMLIK = "zil_kimlik";
    public static final String ANAHTAR_ZIL_SES_SEVIYESI = "zil_ses_seviyesi";
    public static final String OZEL_ZIL_DOSYASI = "ozel_zil_sesi.audio";

    private static final int IZIN_ISTEK_KODU = 1042;
    private static final String UYGULAMA_YEREL_KONAK = "appassets.androidplatform.net";
    private static final String BASLANGIC_ADRESI = "https://appassets.androidplatform.net/index.html";

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
            public WebResourceResponse shouldInterceptRequest(WebView gorunum, WebResourceRequest istek) {
                Uri uri = istek.getUrl();
                if (uri != null && UYGULAMA_YEREL_KONAK.equalsIgnoreCase(uri.getHost())) {
                    String yol = uri.getPath();
                    if (yol == null || yol.equals("/") || yol.isEmpty()) {
                        yol = "/index.html";
                    }
                    String temizYol = yol.startsWith("/") ? yol.substring(1) : yol;
                    try {
                        InputStream girdi = getAssets().open("www/" + temizYol);
                        return new WebResourceResponse(mimeTuruBelirle(temizYol), "UTF-8", girdi);
                    } catch (IOException hata) {
                        try {
                            InputStream yedek = getAssets().open("www/index.html");
                            return new WebResourceResponse("text/html", "UTF-8", yedek);
                        } catch (IOException ignored) {
                            return null;
                        }
                    }
                }
                return super.shouldInterceptRequest(gorunum, istek);
            }

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
        webGorunumu.loadUrl(BASLANGIC_ADRESI);
    }

    @Override
    protected void onResume() {
        super.onResume();
        DinleyiciServisi.uygulamaOnPlanda = true;
    }

    @Override
    protected void onPause() {
        DinleyiciServisi.uygulamaOnPlanda = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webGorunumu != null && webGorunumu.canGoBack()) {
            webGorunumu.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private String mimeTuruBelirle(String dosyaYolu) {
        String kucuk = dosyaYolu.toLowerCase();
        if (kucuk.endsWith(".html")) return "text/html";
        if (kucuk.endsWith(".js") || kucuk.endsWith(".mjs")) return "application/javascript";
        if (kucuk.endsWith(".css")) return "text/css";
        if (kucuk.endsWith(".json")) return "application/json";
        if (kucuk.endsWith(".png")) return "image/png";
        if (kucuk.endsWith(".jpg") || kucuk.endsWith(".jpeg")) return "image/jpeg";
        if (kucuk.endsWith(".svg")) return "image/svg+xml";
        if (kucuk.endsWith(".wav")) return "audio/wav";
        if (kucuk.endsWith(".mp3")) return "audio/mpeg";
        if (kucuk.endsWith(".ogg")) return "audio/ogg";
        if (kucuk.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
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
        Intent servisIntent = new Intent(this, DinleyiciServisi.class);
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
        public void oturumAyarla(String kuryeId, String kuryeAdi, String rol) {
            SharedPreferences tercihler = aktivite.getSharedPreferences(TERCIH_ADI, Context.MODE_PRIVATE);
            tercihler.edit()
                .putString(ANAHTAR_KURYE_ID, kuryeId != null ? kuryeId : "")
                .putString(ANAHTAR_KURYE_ADI, kuryeAdi != null ? kuryeAdi : "Kurye")
                .putString(ANAHTAR_ROL, rol != null ? rol : "kurye")
                .apply();

            Intent servisIntent = new Intent(aktivite, DinleyiciServisi.class);
            servisIntent.setAction(DinleyiciServisi.EYLEM_OTURUM_GUNCELLENDI);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                aktivite.startForegroundService(servisIntent);
            } else {
                aktivite.startService(servisIntent);
            }
        }

        @JavascriptInterface
        public void oturumKapat() {
            SharedPreferences tercihler = aktivite.getSharedPreferences(TERCIH_ADI, Context.MODE_PRIVATE);
            tercihler.edit()
                .remove(ANAHTAR_KURYE_ID)
                .remove(ANAHTAR_KURYE_ADI)
                .remove(ANAHTAR_ROL)
                .apply();

            Intent servisIntent = new Intent(aktivite, DinleyiciServisi.class);
            aktivite.stopService(servisIntent);
        }

        @JavascriptInterface
        public void zilAyarla(String seciliKimlik, double sesSeviyesi, String ozelSesVeriUrl) {
            float guvenliSes = (float) Math.max(0.2, Math.min(1.0, sesSeviyesi));
            String temizKimlik = (seciliKimlik != null && !seciliKimlik.trim().isEmpty())
                ? seciliKimlik.trim()
                : "korna_klasik";

            SharedPreferences tercihler = aktivite.getSharedPreferences(TERCIH_ADI, Context.MODE_PRIVATE);
            tercihler.edit()
                .putString(ANAHTAR_ZIL_KIMLIK, temizKimlik)
                .putFloat(ANAHTAR_ZIL_SES_SEVIYESI, guvenliSes)
                .apply();

            File ozelDosya = new File(aktivite.getFilesDir(), OZEL_ZIL_DOSYASI);
            if (ozelSesVeriUrl != null && !ozelSesVeriUrl.trim().isEmpty()) {
                try {
                    String base64Icerik = ozelSesVeriUrl.trim();
                    int virgulIndeks = base64Icerik.indexOf(',');
                    if (virgulIndeks >= 0) {
                        base64Icerik = base64Icerik.substring(virgulIndeks + 1);
                    }
                    byte[] sesBaytlari = Base64.decode(base64Icerik, Base64.DEFAULT);
                    try (FileOutputStream cikti = new FileOutputStream(ozelDosya)) {
                        cikti.write(sesBaytlari);
                        cikti.flush();
                    }
                } catch (Exception ignored) {
                }
            } else if (!"ozel".equals(temizKimlik) && ozelDosya.exists()) {
                ozelDosya.delete();
            }
        }

        @JavascriptInterface
        public void zilCal(String baslik, String detay, boolean kesintisiz, int sureSn) {
            Intent alarmIntent = new Intent(aktivite, DinleyiciServisi.class);
            alarmIntent.setAction(DinleyiciServisi.EYLEM_ZIL_CAL);
            alarmIntent.putExtra(DinleyiciServisi.EKSTRA_BASLIK, baslik != null ? baslik : "Yeni Kurye Görevi");
            alarmIntent.putExtra(DinleyiciServisi.EKSTRA_MESAJ, detay != null ? detay : "Teslime hazır yeni paket bekliyor.");
            alarmIntent.putExtra(DinleyiciServisi.EKSTRA_KESINTISIZ, kesintisiz);
            alarmIntent.putExtra(DinleyiciServisi.EKSTRA_SURE_SN, Math.max(3, Math.min(sureSn, 60)));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                aktivite.startForegroundService(alarmIntent);
            } else {
                aktivite.startService(alarmIntent);
            }
        }

        @JavascriptInterface
        public void zilSustur() {
            Intent susturIntent = new Intent(aktivite, DinleyiciServisi.class);
            susturIntent.setAction(DinleyiciServisi.EYLEM_ZIL_SUSTUR);
            aktivite.startService(susturIntent);
        }

        @JavascriptInterface
        public boolean pilMuafiyetiVarMi() {
            PowerManager gucYonetimi = (PowerManager) aktivite.getSystemService(Context.POWER_SERVICE);
            if (gucYonetimi == null) return false;
            return gucYonetimi.isIgnoringBatteryOptimizations(aktivite.getPackageName());
        }

        @JavascriptInterface
        @SuppressLint("BatteryLife")
        public void pilOptimizasyonuIste() {
            if (pilMuafiyetiVarMi()) return;
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + aktivite.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            aktivite.startActivity(intent);
        }

        @JavascriptInterface
        public String uygulamaSurumu() {
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
                return "{\"paketAdi\":\"com.afyonevlezzetleri.kurye\",\"surumAdi\":\"1.0.0\",\"surumKodu\":102}";
            }
        }

        @JavascriptInterface
        public void apkGuncelleIndirVeKur(final String indirmeUrl) {
            if (indirmeUrl == null || !indirmeUrl.startsWith("https://")) {
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

                    URL hedefUrl = new URL(indirmeUrl);
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

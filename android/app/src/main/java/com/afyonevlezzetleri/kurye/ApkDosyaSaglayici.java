package com.afyonevlezzetleri.kurye;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

public class ApkDosyaSaglayici extends ContentProvider {

    public static final String YETKI = "com.afyonevlezzetleri.kurye.dosyasaglayici";

    public static Uri uriOlustur(Context baglam, File dosya) {
        return new Uri.Builder()
            .scheme("content")
            .authority(YETKI)
            .appendPath("guncelleme")
            .appendPath(dosya.getName())
            .build();
    }

    private File guvenliDosyaCoz(Uri uri) throws FileNotFoundException {
        Context baglam = getContext();
        if (baglam == null) {
            throw new FileNotFoundException("Uygulama bağlamı bulunamadı.");
        }
        String dosyaAdi = uri.getLastPathSegment();
        if (dosyaAdi == null || dosyaAdi.contains("..") || dosyaAdi.contains("/")) {
            throw new FileNotFoundException("Geçersiz dosya yolu.");
        }
        File onbellekDizini = baglam.getCacheDir();
        File hedefDosya = new File(onbellekDizini, dosyaAdi);
        try {
            String kanonikKok = onbellekDizini.getCanonicalPath();
            String kanonikHedef = hedefDosya.getCanonicalPath();
            if (!kanonikHedef.startsWith(kanonikKok + File.separator)) {
                throw new FileNotFoundException("Dizin dışı erişim engellendi.");
            }
        } catch (IOException e) {
            throw new FileNotFoundException("Dosya yolu çözümlenemedi.");
        }
        if (!hedefDosya.exists()) {
            throw new FileNotFoundException("APK dosyası bulunamadı.");
        }
        return hedefDosya;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] sutunlar, String secim, String[] secimArgumanlari, String siralama) {
        try {
            File dosya = guvenliDosyaCoz(uri);
            String[] basliklar = (sutunlar != null && sutunlar.length > 0)
                ? sutunlar
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};

            MatrixCursor imlec = new MatrixCursor(basliklar, 1);
            Object[] degerler = new Object[basliklar.length];
            for (int i = 0; i < basliklar.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(basliklar[i])) {
                    degerler[i] = dosya.getName();
                } else if (OpenableColumns.SIZE.equals(basliklar[i])) {
                    degerler[i] = dosya.length();
                } else {
                    degerler[i] = null;
                }
            }
            imlec.addRow(degerler);
            return imlec;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mod) throws FileNotFoundException {
        File dosya = guvenliDosyaCoz(uri);
        return ParcelFileDescriptor.open(dosya, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues degerler) {
        return null;
    }

    @Override
    public int delete(Uri uri, String secim, String[] secimArgumanlari) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues degerler, String secim, String[] secimArgumanlari) {
        return 0;
    }
}

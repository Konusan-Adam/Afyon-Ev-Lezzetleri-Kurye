import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { imzaAnahtariniHazirla } from './araclar/ImzaAnahtariYonetimi.mjs';
import { ikiliDosyaYollariXmlOlustur, ikiliManifestOlustur } from './araclar/IkiliXmlOlusturucu.mjs';
import { ikonVeKaynakTablosuOlustur } from './araclar/KaynakTablosuOlusturucu.mjs';
import { hazirZilSesleriniOlustur } from './araclar/SesUretici.mjs';
import { dexOlustur } from './araclar/DexOlusturucu.mjs';
import { apkImzala, zipArsiviOlustur } from './araclar/ZipPaketleyici.mjs';

const KOK_DIZIN = path.resolve(import.meta.dirname, '..');
const ANDROID_DIZIN = path.join(KOK_DIZIN, 'android');
const CIKTI_DIZIN = path.join(ANDROID_DIZIN, 'cikti');
const KEYSTORE_YOLU = path.join(ANDROID_DIZIN, 'afyon-kurye.keystore');
const PUBLIC_DIZIN = path.join(KOK_DIZIN, 'public');
const PUBLIC_SESLER_DIZIN = path.join(PUBLIC_DIZIN, 'sesler');
const DIST_DIZIN = path.join(KOK_DIZIN, 'dist');
const ASSETS_WWW_DIZIN = path.join(ANDROID_DIZIN, 'app', 'src', 'main', 'assets', 'www');
const RES_RAW_DIZIN = path.join(ANDROID_DIZIN, 'app', 'src', 'main', 'res', 'raw');

const PAKET_KIMLIGI = 'com.afyonevlezzetleri.kurye';
const UYGULAMA_ADI = 'Afyon Kurye';
const APK_DOSYA_ADI = 'afyon-kurye.apk';

function diziniTemizleVeKopyala(kaynak, hedef) {
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.mkdirSync(hedef, { recursive: true });

  const ogeler = fs.readdirSync(kaynak, { withFileTypes: true });
  for (const oge of ogeler) {
    if (oge.name.toLowerCase().endsWith('.apk')) continue;
    const kYol = path.join(kaynak, oge.name);
    const hYol = path.join(hedef, oge.name);
    if (oge.isDirectory()) {
      diziniTemizleVeKopyala(kYol, hYol);
    } else {
      fs.copyFileSync(kYol, hYol);
    }
  }
}

function dizinDosyalariniTopla(kok, altYol = '') {
  const sonuc = [];
  const aktif = path.join(kok, altYol);
  for (const oge of fs.readdirSync(aktif, { withFileTypes: true })) {
    const goreli = altYol ? `${altYol}/${oge.name}` : oge.name;
    if (oge.isDirectory()) {
      sonuc.push(...dizinDosyalariniTopla(kok, goreli));
    } else {
      if (oge.name.toLowerCase().endsWith('.apk')) continue;
      sonuc.push({
        yol: `assets/www/${goreli.replace(/\\/g, '/')}`,
        veri: fs.readFileSync(path.join(kok, goreli)),
        sikistirmasiz: oge.name.toLowerCase().endsWith('.wav')
      });
    }
  }
  return sonuc;
}

function ortamAraclariniKontrolEt() {
  const sdkKok = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
  const sdkMevcut = fs.existsSync(sdkKok);

  const komutVarMi = (cmd) => {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  return {
    sdkKok,
    sdkMevcut,
    javacVar: komutVarMi('javac'),
    keytoolVar: komutVarMi('keytool')
  };
}

function surumBilgisiniHesapla() {
  const pkgYolu = path.join(KOK_DIZIN, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgYolu, 'utf8'));
  const hamSurum = pkg.version && pkg.version !== '0.0.0' ? pkg.version : '1.0.0';

  const metaYolu = path.join(CIKTI_DIZIN, 'apk-meta.json');
  let oncekiKod = 102;
  if (fs.existsSync(metaYolu)) {
    try {
      const onceki = JSON.parse(fs.readFileSync(metaYolu, 'utf8'));
      if (typeof onceki.versionCode === 'number') {
        oncekiKod = onceki.versionCode;
      }
    } catch {
      // Yoksay
    }
  }

  const simdi = new Date();
  return {
    version: hamSurum,
    versionCode: oncekiKod + 1,
    builtAt: simdi.toISOString(),
    builtTimestamp: simdi.getTime()
  };
}

async function anaDerleme() {
  console.log('=== Afyon Ev Lezzetleri Kurye — Native Android APK Derleyici ===');
  const ortam = ortamAraclariniKontrolEt();
  console.log(
    `[Ortam] SDK: ${ortam.sdkMevcut ? ortam.sdkKok : 'Yok'} | javac: ${ortam.javacVar ? 'Var' : 'Yok'} | keytool: ${ortam.keytoolVar ? 'Var' : 'Yok'}`
  );

  // Kural 3: APK ve meta ASLA public/ içinde tutulmaz
  for (const eskiYol of [
    path.join(PUBLIC_DIZIN, APK_DOSYA_ADI),
    path.join(PUBLIC_DIZIN, 'apk-meta.json'),
    path.join(DIST_DIZIN, APK_DOSYA_ADI)
  ]) {
    if (fs.existsSync(eskiYol)) {
      fs.rmSync(eskiYol, { force: true });
    }
  }

  fs.mkdirSync(CIKTI_DIZIN, { recursive: true });

  console.log('[1/6] Hazır alarm zil sesleri (res/raw ve public/sesler) üretiliyor...');
  const zilDosyalari = hazirZilSesleriniOlustur([RES_RAW_DIZIN, PUBLIC_SESLER_DIZIN]);

  const surumMeta = surumBilgisiniHesapla();
  const firebaseCfgYolu = path.join(KOK_DIZIN, 'firebase-applet-config.json');
  let firebaseMeta = {};
  if (fs.existsSync(firebaseCfgYolu)) {
    try {
      const fb = JSON.parse(fs.readFileSync(firebaseCfgYolu, 'utf8'));
      firebaseMeta = {
        firebaseProjectId: fb.projectId || '',
        firebaseApiKey: fb.apiKey || '',
        firestoreDatabaseId: fb.firestoreDatabaseId || '(default)'
      };
    } catch {
      // Yoksay
    }
  }

  const apkMetaIcerik = {
    appName: UYGULAMA_ADI,
    applicationId: PAKET_KIMLIGI,
    apkFileName: APK_DOSYA_ADI,
    version: surumMeta.version,
    versionCode: surumMeta.versionCode,
    builtAt: surumMeta.builtAt,
    builtTimestamp: surumMeta.builtTimestamp,
    ...firebaseMeta
  };

  console.log('[2/6] Güncel web paketi derleniyor (npx vite build)...');
  execSync('npx vite build', { cwd: KOK_DIZIN, stdio: 'inherit' });

  console.log('[3/6] dist/ içeriği android/app/src/main/assets/www içine gömülüyor...');
  diziniTemizleVeKopyala(DIST_DIZIN, ASSETS_WWW_DIZIN);
  // Gömülü web uygulamasının kendi sürümünü okuyabilmesi için apk-meta.json yalnızca assets/www/ içine yazılır
  fs.writeFileSync(
    path.join(ASSETS_WWW_DIZIN, 'apk-meta.json'),
    JSON.stringify(apkMetaIcerik, null, 2) + '\n',
    'utf8'
  );

  console.log('[4/6] AndroidManifest, resources.arsc, ikonlar, res/raw ve classes.dex hazırlanıyor...');
  const manifestTamponu = ikiliManifestOlustur({
    paketKimligi: PAKET_KIMLIGI,
    uygulamaAdi: UYGULAMA_ADI,
    surumKodu: surumMeta.versionCode,
    surumAdi: surumMeta.version
  });
  const dosyaYollariXml = ikiliDosyaYollariXmlOlustur();
  const { kaynakTablosu, ikonlar, rawDosyalar } = await ikonVeKaynakTablosuOlustur({
    paketKimligi: PAKET_KIMLIGI,
    uygulamaAdi: UYGULAMA_ADI,
    zilDosyalari
  });
  const classesDex = dexOlustur({
    paketKimligi: PAKET_KIMLIGI,
    surumAdi: surumMeta.version,
    surumKodu: surumMeta.versionCode
  });

  const webVarliklari = dizinDosyalariniTopla(ASSETS_WWW_DIZIN);
  const apkDosyalari = [
    { yol: 'AndroidManifest.xml', veri: manifestTamponu, sikistirmasiz: false },
    { yol: 'classes.dex', veri: classesDex, sikistirmasiz: false },
    { yol: 'resources.arsc', veri: kaynakTablosu, sikistirmasiz: true },
    { yol: 'res/xml/dosya_yollari.xml', veri: dosyaYollariXml, sikistirmasiz: false },
    ...ikonlar.map((ikon) => ({ yol: ikon.yol, veri: ikon.veri, sikistirmasiz: true })),
    ...rawDosyalar.map((ses) => ({ yol: ses.yol, veri: ses.veri, sikistirmasiz: true })),
    ...webVarliklari
  ];

  console.log(`[5/6] APK ZIP paketi (${apkDosyalari.length} dosya) oluşturuluyor...`);
  const hamApk = zipArsiviOlustur(apkDosyalari);

  console.log('[6/6] Keystore hazırlanıyor ve JAR v1 + APK v2/v3 ile imzalanıyor...');
  const imzaBilgisi = await imzaAnahtariniHazirla(KEYSTORE_YOLU);
  const { imzaliApk, imzaBlokBoyutu } = await apkImzala({
    hamApkTamponu: hamApk,
    ozelAnahtarPem: imzaBilgisi.ozelAnahtarPem,
    sertifikaPem: imzaBilgisi.sertifikaPem
  });

  const ciktiApkYolu = path.join(CIKTI_DIZIN, APK_DOSYA_ADI);
  const ciktiMetaYolu = path.join(CIKTI_DIZIN, 'apk-meta.json');

  fs.writeFileSync(ciktiApkYolu, imzaliApk);
  fs.writeFileSync(ciktiMetaYolu, JSON.stringify(apkMetaIcerik, null, 2) + '\n', 'utf8');

  const boyutKb = (imzaliApk.length / 1024).toFixed(1);
  console.log(`✅ İmzalı Android APK hazır: android/cikti/${APK_DOSYA_ADI} (${boyutKb} KB, v2/v3 imza bloğu: ${imzaBlokBoyutu} B)`);
  console.log(`✅ Meta: android/cikti/apk-meta.json (v${surumMeta.version}, versionCode=${surumMeta.versionCode})`);
}

anaDerleme().catch((hata) => {
  console.error('❌ APK derleme hatası:', hata);
  process.exit(1);
});

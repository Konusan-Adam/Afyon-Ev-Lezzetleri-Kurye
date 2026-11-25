import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { imzaAnahtariniHazirla } from './araclar/ImzaAnahtariYonetimi.mjs';
import { ikiliDosyaYollariXmlOlustur, ikiliManifestOlustur } from './araclar/IkiliXmlOlusturucu.mjs';
import { ikonVeKaynakTablosuOlustur } from './araclar/KaynakTablosuOlusturucu.mjs';
import { dexOlustur } from './araclar/DexOlusturucu.mjs';
import { apkImzala, zipArsiviOlustur } from './araclar/ZipPaketleyici.mjs';

const KOK_DIZIN = path.resolve(import.meta.dirname, '..');
const ANDROID_DIZIN = path.join(KOK_DIZIN, 'android');
const KEYSTORE_YOLU = path.join(ANDROID_DIZIN, 'afyon-kurye.keystore');
const PUBLIC_DIZIN = path.join(KOK_DIZIN, 'public');
const DIST_DIZIN = path.join(KOK_DIZIN, 'dist');
const ASSETS_WWW_DIZIN = path.join(ANDROID_DIZIN, 'app', 'src', 'main', 'assets', 'www');

const PAKET_KIMLIGI = 'com.afyonevlezzetleri.kurye';
const UYGULAMA_ADI = 'Afyon Kurye';

function diziniTemizleVeKopyala(kaynak, hedef, haricDosyalar = new Set()) {
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.mkdirSync(hedef, { recursive: true });

  const ogeler = fs.readdirSync(kaynak, { withFileTypes: true });
  for (const oge of ogeler) {
    if (haricDosyalar.has(oge.name)) continue;
    const kYol = path.join(kaynak, oge.name);
    const hYol = path.join(hedef, oge.name);
    if (oge.isDirectory()) {
      diziniTemizleVeKopyala(kYol, hYol, haricDosyalar);
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
      sonuc.push({
        yol: `assets/www/${goreli.replace(/\\/g, '/')}`,
        veri: fs.readFileSync(path.join(kok, goreli)),
        sikistirmasiz: false
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
    keytoolVar: komutVarMi('keytool'),
    aapt2Var: komutVarMi('aapt2'),
    d8Var: komutVarMi('d8'),
    zipalignVar: komutVarMi('zipalign'),
    apksignerVar: komutVarMi('apksigner')
  };
}

function surumBilgisiniHesapla() {
  const pkgYolu = path.join(KOK_DIZIN, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgYolu, 'utf8'));
  const hamSurum = pkg.version && pkg.version !== '0.0.0' ? pkg.version : '1.0.0';

  const metaYolu = path.join(PUBLIC_DIZIN, 'apk-meta.json');
  let oncekiKod = 100;
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
  console.log('=== Afyon Ev Lezzetleri Kurye — Android APK Derleyici ===');
  const ortam = ortamAraclariniKontrolEt();
  console.log(
    `[Ortam] SDK: ${ortam.sdkMevcut ? ortam.sdkKok : 'Yok'} | javac: ${ortam.javacVar ? 'Var' : 'Yok'} | keytool: ${ortam.keytoolVar ? 'Var' : 'Yok'}`
  );
  console.log('[Mod] Kurulumsuz Saf Node.js + apk_sign_ts (JAR v1 + APK v2/v3) kullanılıyor.');

  if (!fs.existsSync(PUBLIC_DIZIN)) {
    fs.mkdirSync(PUBLIC_DIZIN, { recursive: true });
  }

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
    version: surumMeta.version,
    versionCode: surumMeta.versionCode,
    builtAt: surumMeta.builtAt,
    builtTimestamp: surumMeta.builtTimestamp,
    ...firebaseMeta
  };

  // public/apk-meta.json dosyası Vite build öncesinde yazılır ki assets/www içine birebir gömülsün
  fs.writeFileSync(
    path.join(PUBLIC_DIZIN, 'apk-meta.json'),
    JSON.stringify(apkMetaIcerik, null, 2) + '\n',
    'utf8'
  );

  // Önceki APK çıktısının dist/assets içine tekrar gömülmesini engellemek için geçici temizle
  const publicApkYolu = path.join(PUBLIC_DIZIN, 'afyon-kurye.apk');
  if (fs.existsSync(publicApkYolu)) {
    fs.rmSync(publicApkYolu, { force: true });
  }

  console.log('[1/5] Güncel web paketi derleniyor (npx vite build --base=./)...');
  execSync('npx vite build --base=./', { cwd: KOK_DIZIN, stdio: 'inherit' });

  console.log('[2/5] dist/ içeriği android/app/src/main/assets/www içine gömülüyor...');
  diziniTemizleVeKopyala(DIST_DIZIN, ASSETS_WWW_DIZIN, new Set(['afyon-kurye.apk']));

  console.log('[3/5] AndroidManifest, resources.arsc, ikonlar ve classes.dex hazırlanıyor...');
  const manifestTamponu = ikiliManifestOlustur({
    paketKimligi: PAKET_KIMLIGI,
    uygulamaAdi: UYGULAMA_ADI,
    surumKodu: surumMeta.versionCode,
    surumAdi: surumMeta.version
  });
  const dosyaYollariXml = ikiliDosyaYollariXmlOlustur();
  const { kaynakTablosu, ikonlar } = await ikonVeKaynakTablosuOlustur({
    paketKimligi: PAKET_KIMLIGI,
    uygulamaAdi: UYGULAMA_ADI
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
    ...webVarliklari
  ];

  console.log(`[4/5] APK ZIP paketi (${apkDosyalari.length} dosya) oluşturuluyor...`);
  const hamApk = zipArsiviOlustur(apkDosyalari);

  console.log('[5/5] Keystore hazırlanıyor ve JAR v1 + APK v2/v3 ile imzalanıyor...');
  const imzaBilgisi = await imzaAnahtariniHazirla(KEYSTORE_YOLU);
  const { imzaliApk, imzaBlokBoyutu } = await apkImzala({
    hamApkTamponu: hamApk,
    ozelAnahtarPem: imzaBilgisi.ozelAnahtarPem,
    sertifikaPem: imzaBilgisi.sertifikaPem
  });

  const distApkYolu = path.join(DIST_DIZIN, 'afyon-kurye.apk');
  fs.writeFileSync(publicApkYolu, imzaliApk);
  fs.writeFileSync(distApkYolu, imzaliApk);

  const boyutKb = (imzaliApk.length / 1024).toFixed(1);
  console.log(`✅ İmzalı Android APK hazır: public/afyon-kurye.apk (${boyutKb} KB, v2/v3 imza bloğu: ${imzaBlokBoyutu} B)`);
  console.log(`✅ Sürüm: v${surumMeta.version} (versionCode=${surumMeta.versionCode}, builtTimestamp=${surumMeta.builtTimestamp})`);
}

anaDerleme().catch((hata) => {
  console.error('❌ APK derleme hatası:', hata);
  process.exit(1);
});

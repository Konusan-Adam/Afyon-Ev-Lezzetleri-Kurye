import crypto from 'node:crypto';

function uleb128Yaz(deger) {
  const baytlar = [];
  let v = deger >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    baytlar.push(b);
  } while (v !== 0);
  return Buffer.from(baytlar);
}

function sleb128Yaz(deger) {
  const baytlar = [];
  let v = deger | 0;
  let devam = true;
  while (devam) {
    let b = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (b & 0x40) === 0) || (v === -1 && (b & 0x40) !== 0)) {
      devam = false;
    } else {
      b |= 0x80;
    }
    baytlar.push(b);
  }
  return Buffer.from(baytlar);
}

function dortBaytaHizala(n) {
  return (n + 3) & ~3;
}

function adler32Hesapla(veri) {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < veri.length; i++) {
    a = (a + veri[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function kisaTipHarfi(tip) {
  if (['V', 'Z', 'B', 'S', 'C', 'I', 'J', 'F', 'D'].includes(tip)) return tip;
  return 'L';
}

function tipGenisligi(tip) {
  return tip === 'J' || tip === 'D' ? 2 : 1;
}

// Sembolik etiket ve try/catch destekli Dalvik kod birleştirici
class KodBirlestirici {
  constructor() {
    this.ogeler = [];
    this.etiketKonumlari = new Map();
  }
  ekle(birimler) {
    this.ogeler.push({ tip: 'insns', birimler });
    return this;
  }
  etiket(ad) {
    this.ogeler.push({ tip: 'label', ad });
    return this;
  }
  ifEqz(v, hedefEtiket) {
    this.ogeler.push({ tip: 'branch21t', opcode: 0x38, v, hedefEtiket });
    return this;
  }
  ifNez(v, hedefEtiket) {
    this.ogeler.push({ tip: 'branch21t', opcode: 0x39, v, hedefEtiket });
    return this;
  }
  git(hedefEtiket) {
    this.ogeler.push({ tip: 'goto16', opcode: 0x29, hedefEtiket });
    return this;
  }
  derle() {
    let imlec = 0;
    for (const o of this.ogeler) {
      if (o.tip === 'label') {
        this.etiketKonumlari.set(o.ad, imlec);
      } else if (o.tip === 'insns') {
        imlec += o.birimler.length;
      } else if (o.tip === 'branch21t' || o.tip === 'goto16') {
        imlec += 2;
      }
    }
    const birimler = [];
    imlec = 0;
    for (const o of this.ogeler) {
      if (o.tip === 'label') continue;
      if (o.tip === 'insns') {
        birimler.push(...o.birimler);
        imlec += o.birimler.length;
      } else if (o.tip === 'branch21t') {
        const hedef = this.etiketKonumlari.get(o.hedefEtiket);
        if (hedef === undefined) throw new Error(`Etiket bulunamadı: ${o.hedefEtiket}`);
        const fark = (hedef - imlec) & 0xffff;
        birimler.push(((o.v & 0xff) << 8) | o.opcode, fark);
        imlec += 2;
      } else if (o.tip === 'goto16') {
        const hedef = this.etiketKonumlari.get(o.hedefEtiket);
        if (hedef === undefined) throw new Error(`Etiket bulunamadı: ${o.hedefEtiket}`);
        const fark = (hedef - imlec) & 0xffff;
        birimler.push(o.opcode, fark);
        imlec += 2;
      }
    }
    return { birimler, etiketler: this.etiketKonumlari };
  }
}

const Op = {
  returnVoid: () => [0x000e],
  returnReg: (v) => [((v & 0xff) << 8) | 0x000f],
  returnObject: (v) => [((v & 0xff) << 8) | 0x0011],
  moveResult: (v) => [((v & 0xff) << 8) | 0x000a],
  moveResultObject: (v) => [((v & 0xff) << 8) | 0x000c],
  moveException: (v) => [((v & 0xff) << 8) | 0x000d],
  const4: (v, val) => [((val & 0xf) << 12) | ((v & 0xf) << 8) | 0x0012],
  const32: (v, val) => [((v & 0xff) << 8) | 0x0014, val & 0xffff, (val >>> 16) & 0xffff],
  constString: (v, strIdx) => [((v & 0xff) << 8) | 0x001a, strIdx & 0xffff],
  checkCast: (v, typeIdx) => [((v & 0xff) << 8) | 0x001f, typeIdx & 0xffff],
  newInstance: (v, typeIdx) => [((v & 0xff) << 8) | 0x0022, typeIdx & 0xffff],
  igetObject: (vDest, vObj, fieldIdx) => [
    ((vObj & 0xf) << 12) | ((vDest & 0xf) << 8) | 0x0054,
    fieldIdx & 0xffff
  ],
  iputObject: (vSrc, vObj, fieldIdx) => [
    ((vObj & 0xf) << 12) | ((vSrc & 0xf) << 8) | 0x005b,
    fieldIdx & 0xffff
  ],
  doubleToFloat: (vDest, vSrc) => [((vSrc & 0xf) << 12) | ((vDest & 0xf) << 8) | 0x008c],
  invoke: (opcode, methodIdx, regList) => {
    const count = regList.length;
    const c = count > 0 ? regList[0] & 0xf : 0;
    const d = count > 1 ? regList[1] & 0xf : 0;
    const e = count > 2 ? regList[2] & 0xf : 0;
    const f = count > 3 ? regList[3] & 0xf : 0;
    const g = count > 4 ? regList[4] & 0xf : 0;
    return [
      ((count & 0xf) << 12) | ((g & 0xf) << 8) | (opcode & 0xff),
      methodIdx & 0xffff,
      ((f & 0xf) << 12) | ((e & 0xf) << 8) | ((d & 0xf) << 4) | (c & 0xf)
    ];
  },
  invokeVirtual: (m, regs) => Op.invoke(0x6e, m, regs),
  invokeSuper: (m, regs) => Op.invoke(0x6f, m, regs),
  invokeDirect: (m, regs) => Op.invoke(0x70, m, regs),
  invokeStatic: (m, regs) => Op.invoke(0x71, m, regs),
  invokeInterface: (m, regs) => Op.invoke(0x72, m, regs)
};

export function dexOlustur({
  paketKimligi = 'com.afyonevlezzetleri.kurye',
  surumAdi = '1.0.0',
  surumKodu = 102
}) {
  const paketYolu = paketKimligi.replace(/\./g, '/');
  const T_MAIN = `L${paketYolu}/MainActivity;`;
  const T_VARLIK = `L${paketYolu}/VarlikYukleyiciIstemci;`;
  const T_KOPRU = `L${paketYolu}/KuryeKopru;`;
  const T_SERVIS = `L${paketYolu}/DinleyiciServisi;`;
  const T_BOOT = `L${paketYolu}/BootReceiver;`;
  const T_SAGLAYICI = `L${paketYolu}/ApkDosyaSaglayici;`;

  const metinKumesi = new Set();
  const tipKumesi = new Set();
  const protoHaritasi = new Map();
  const alanHaritasi = new Map();
  const metotHaritasi = new Map();

  function metinEkle(s) {
    metinKumesi.add(s);
    return s;
  }
  function tipEkle(t) {
    metinEkle(t);
    tipKumesi.add(t);
    return t;
  }
  function protoEkle(donus, paramlar = []) {
    tipEkle(donus);
    paramlar.forEach(tipEkle);
    const kisa = kisaTipHarfi(donus) + paramlar.map(kisaTipHarfi).join('');
    metinEkle(kisa);
    const anahtar = `${donus}|${paramlar.join(',')}`;
    if (!protoHaritasi.has(anahtar)) {
      protoHaritasi.set(anahtar, { donus, paramlar, kisa, anahtar });
    }
    return anahtar;
  }
  function alanEkle(sinif, ad, tip) {
    tipEkle(sinif);
    metinEkle(ad);
    tipEkle(tip);
    const anahtar = `${sinif}->${ad}:${tip}`;
    if (!alanHaritasi.has(anahtar)) {
      alanHaritasi.set(anahtar, { sinif, ad, tip, anahtar });
    }
    return anahtar;
  }
  function metotEkle(sinif, ad, donus, paramlar = []) {
    tipEkle(sinif);
    metinEkle(ad);
    const protoAnahtar = protoEkle(donus, paramlar);
    const anahtar = `${sinif}->${ad}(${paramlar.join('')})${donus}`;
    if (!metotHaritasi.has(anahtar)) {
      metotHaritasi.set(anahtar, { sinif, ad, protoAnahtar, donus, paramlar, anahtar });
    }
    return anahtar;
  }

  // Sabit metinler
  const STR_KOPRU_ADI = metinEkle('AfyonKuryeAndroid');
  const STR_BASLANGIC_URL = metinEkle('https://appassets.androidplatform.net/index.html');
  const STR_KONAK = metinEkle('appassets.androidplatform.net');
  const STR_INDEX_YOL = metinEkle('/index.html');
  const STR_KOK_YOL = metinEkle('/');
  const STR_WWW_ON_EK = metinEkle('www/');
  const STR_UTF8 = metinEkle('UTF-8');
  const STR_EXT_JS = metinEkle('.js');
  const STR_EXT_CSS = metinEkle('.css');
  const STR_EXT_JSON = metinEkle('.json');
  const STR_EXT_SVG = metinEkle('.svg');
  const STR_EXT_WAV = metinEkle('.wav');
  const STR_MIME_JS = metinEkle('application/javascript');
  const STR_MIME_CSS = metinEkle('text/css');
  const STR_MIME_JSON = metinEkle('application/json');
  const STR_MIME_SVG = metinEkle('image/svg+xml');
  const STR_MIME_WAV = metinEkle('audio/wav');
  const STR_MIME_BIN = metinEkle('application/octet-stream');
  const STR_TERCIH_ADI = metinEkle('AfyonKuryeTercihler');
  const STR_KURYE_ID = metinEkle('kurye_id');
  const STR_KURYE_ADI = metinEkle('kurye_adi');
  const STR_ROL = metinEkle('kullanici_rol');
  const STR_ZIL_KIMLIK = metinEkle('zil_kimlik');
  const STR_ZIL_SES = metinEkle('zil_ses_seviyesi');
  const STR_UYGULAMA_BILGI = metinEkle(
    JSON.stringify({ paketAdi: paketKimligi, surumAdi, surumKodu })
  );
  const STR_MIME_APK = metinEkle('application/vnd.android.package-archive');
  const STR_ACTION_VIEW = metinEkle('android.intent.action.VIEW');
  const STR_ACTION_BATTERY = metinEkle('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
  const STR_PKG_URI = metinEkle(`package:${paketKimligi}`);

  const T_OBJ = tipEkle('Ljava/lang/Object;');
  const T_STR = tipEkle('Ljava/lang/String;');
  const T_ACT = tipEkle('Landroid/app/Activity;');
  const T_CTX = tipEkle('Landroid/content/Context;');
  const T_BND = tipEkle('Landroid/os/Bundle;');
  const T_VIEW = tipEkle('Landroid/view/View;');
  const T_WV = tipEkle('Landroid/webkit/WebView;');
  const T_WVS = tipEkle('Landroid/webkit/WebSettings;');
  const T_WVC = tipEkle('Landroid/webkit/WebViewClient;');
  const T_WCC = tipEkle('Landroid/webkit/WebChromeClient;');
  const T_WRQ = tipEkle('Landroid/webkit/WebResourceRequest;');
  const T_WRS = tipEkle('Landroid/webkit/WebResourceResponse;');
  const T_JSIF = tipEkle('Landroid/webkit/JavascriptInterface;');
  const T_AM = tipEkle('Landroid/content/res/AssetManager;');
  const T_IS = tipEkle('Ljava/io/InputStream;');
  const T_URLC = tipEkle('Ljava/net/URLConnection;');
  const T_SVC = tipEkle('Landroid/app/Service;');
  const T_BR = tipEkle('Landroid/content/BroadcastReceiver;');
  const T_CP = tipEkle('Landroid/content/ContentProvider;');
  const T_INTENT = tipEkle('Landroid/content/Intent;');
  const T_IBINDER = tipEkle('Landroid/os/IBinder;');
  const T_URI = tipEkle('Landroid/net/Uri;');
  const T_CURSOR = tipEkle('Landroid/database/Cursor;');
  const T_CV = tipEkle('Landroid/content/ContentValues;');
  const T_SP = tipEkle('Landroid/content/SharedPreferences;');
  const T_SPE = tipEkle('Landroid/content/SharedPreferences$Editor;');
  const T_RM = tipEkle('Landroid/media/RingtoneManager;');
  const T_RING = tipEkle('Landroid/media/Ringtone;');
  tipEkle('[Ljava/lang/String;');

  // Alanlar
  const F_VARLIK_AKTIVITE = alanEkle(T_VARLIK, 'aktivite', T_ACT);
  const F_KOPRU_AKTIVITE = alanEkle(T_KOPRU, 'aktivite', T_ACT);

  // Dış metotlar
  const M_OBJ_INIT = metotEkle(T_OBJ, '<init>', 'V', []);
  const M_OBJ_EQUALS = metotEkle(T_OBJ, 'equals', 'Z', [T_OBJ]);
  const M_STR_EQ_IGN = metotEkle(T_STR, 'equalsIgnoreCase', 'Z', [T_STR]);
  const M_STR_STARTS = metotEkle(T_STR, 'startsWith', 'Z', [T_STR]);
  const M_STR_ENDS = metotEkle(T_STR, 'endsWith', 'Z', [T_STR]);
  const M_STR_SUB = metotEkle(T_STR, 'substring', T_STR, ['I']);
  const M_STR_CONCAT = metotEkle(T_STR, 'concat', T_STR, [T_STR]);
  const M_STR_LOWER = metotEkle(T_STR, 'toLowerCase', T_STR, []);

  const M_ACT_INIT = metotEkle(T_ACT, '<init>', 'V', []);
  const M_ACT_ONCREATE = metotEkle(T_ACT, 'onCreate', 'V', [T_BND]);
  const M_ACT_REQ_FEAT = metotEkle(T_ACT, 'requestWindowFeature', 'Z', ['I']);
  const M_ACT_SET_CV = metotEkle(T_ACT, 'setContentView', 'V', [T_VIEW]);
  const M_ACT_GET_SP = metotEkle(T_ACT, 'getSharedPreferences', T_SP, [T_STR, 'I']);
  const M_ACT_GET_ASSETS = metotEkle(T_ACT, 'getAssets', T_AM, []);
  const M_ACT_START_ACT = metotEkle(T_ACT, 'startActivity', 'V', [T_INTENT]);

  const M_AM_OPEN = metotEkle(T_AM, 'open', T_IS, [T_STR]);
  const M_URLC_GUESS = metotEkle(T_URLC, 'guessContentTypeFromName', T_STR, [T_STR]);
  const M_WRS_INIT = metotEkle(T_WRS, '<init>', 'V', [T_STR, T_STR, T_IS]);

  const M_WV_INIT = metotEkle(T_WV, '<init>', 'V', [T_CTX]);
  const M_WV_BG = metotEkle(T_WV, 'setBackgroundColor', 'V', ['I']);
  const M_WV_SETTINGS = metotEkle(T_WV, 'getSettings', T_WVS, []);
  const M_WV_ADD_JS = metotEkle(T_WV, 'addJavascriptInterface', 'V', [T_OBJ, T_STR]);
  const M_WV_SET_WVC = metotEkle(T_WV, 'setWebViewClient', 'V', [T_WVC]);
  const M_WV_SET_WCC = metotEkle(T_WV, 'setWebChromeClient', 'V', [T_WCC]);
  const M_WV_LOAD = metotEkle(T_WV, 'loadUrl', 'V', [T_STR]);

  const M_WVS_JS = metotEkle(T_WVS, 'setJavaScriptEnabled', 'V', ['Z']);
  const M_WVS_DOM = metotEkle(T_WVS, 'setDomStorageEnabled', 'V', ['Z']);
  const M_WVS_DB = metotEkle(T_WVS, 'setDatabaseEnabled', 'V', ['Z']);
  const M_WVS_GEO = metotEkle(T_WVS, 'setGeolocationEnabled', 'V', ['Z']);
  const M_WVS_FILE = metotEkle(T_WVS, 'setAllowFileAccess', 'V', ['Z']);

  const M_WVC_INIT = metotEkle(T_WVC, '<init>', 'V', []);
  const M_WCC_INIT = metotEkle(T_WCC, '<init>', 'V', []);
  const M_WRQ_URL = metotEkle(T_WRQ, 'getUrl', T_URI, []);

  const M_URI_PARSE = metotEkle(T_URI, 'parse', T_URI, [T_STR]);
  const M_URI_HOST = metotEkle(T_URI, 'getHost', T_STR, []);
  const M_URI_PATH = metotEkle(T_URI, 'getPath', T_STR, []);

  const M_SP_EDIT = metotEkle(T_SP, 'edit', T_SPE, []);
  const M_SPE_PUT_STR = metotEkle(T_SPE, 'putString', T_SPE, [T_STR, T_STR]);
  const M_SPE_PUT_FLT = metotEkle(T_SPE, 'putFloat', T_SPE, [T_STR, 'F']);
  const M_SPE_REM = metotEkle(T_SPE, 'remove', T_SPE, [T_STR]);
  const M_SPE_APPLY = metotEkle(T_SPE, 'apply', 'V', []);

  const M_RM_URI = metotEkle(T_RM, 'getDefaultUri', T_URI, ['I']);
  const M_RM_GET = metotEkle(T_RM, 'getRingtone', T_RING, [T_CTX, T_URI]);
  const M_RING_PLAY = metotEkle(T_RING, 'play', 'V', []);

  const M_INTENT_ACT_URI = metotEkle(T_INTENT, '<init>', 'V', [T_STR, T_URI]);
  const M_SVC_INIT = metotEkle(T_SVC, '<init>', 'V', []);
  const M_BR_INIT = metotEkle(T_BR, '<init>', 'V', []);
  const M_CP_INIT = metotEkle(T_CP, '<init>', 'V', []);

  // Kendi sınıflarımızın metotları
  const M_MAIN_INIT = metotEkle(T_MAIN, '<init>', 'V', []);
  const M_MAIN_ONCREATE = metotEkle(T_MAIN, 'onCreate', 'V', [T_BND]);

  const M_VARLIK_INIT = metotEkle(T_VARLIK, '<init>', 'V', [T_ACT]);
  const M_VARLIK_INTERCEPT = metotEkle(T_VARLIK, 'shouldInterceptRequest', T_WRS, [T_WV, T_WRQ]);

  const M_KOPRU_INIT = metotEkle(T_KOPRU, '<init>', 'V', [T_ACT]);
  const M_KOPRU_OTURUM_AYARLA = metotEkle(T_KOPRU, 'oturumAyarla', 'V', [T_STR, T_STR, T_STR]);
  const M_KOPRU_OTURUM_KAPAT = metotEkle(T_KOPRU, 'oturumKapat', 'V', []);
  const M_KOPRU_ZIL_AYARLA = metotEkle(T_KOPRU, 'zilAyarla', 'V', [T_STR, 'D', T_STR]);
  const M_KOPRU_ZIL_CAL = metotEkle(T_KOPRU, 'zilCal', 'V', [T_STR, T_STR, 'Z', 'I']);
  const M_KOPRU_ZIL_SUSTUR = metotEkle(T_KOPRU, 'zilSustur', 'V', []);
  const M_KOPRU_PIL_VAR = metotEkle(T_KOPRU, 'pilMuafiyetiVarMi', 'Z', []);
  const M_KOPRU_PIL_ISTE = metotEkle(T_KOPRU, 'pilOptimizasyonuIste', 'V', []);
  const M_KOPRU_SURUM = metotEkle(T_KOPRU, 'uygulamaSurumu', T_STR, []);
  const M_KOPRU_GUNCELLE = metotEkle(T_KOPRU, 'apkGuncelleIndirVeKur', 'V', [T_STR]);

  const M_SVC_K_INIT = metotEkle(T_SERVIS, '<init>', 'V', []);
  const M_SVC_ONBIND = metotEkle(T_SERVIS, 'onBind', T_IBINDER, [T_INTENT]);
  const M_SVC_ONSTART = metotEkle(T_SERVIS, 'onStartCommand', 'I', [T_INTENT, 'I', 'I']);

  const M_BOOT_INIT = metotEkle(T_BOOT, '<init>', 'V', []);
  const M_BOOT_ONRCV = metotEkle(T_BOOT, 'onReceive', 'V', [T_CTX, T_INTENT]);

  const M_SAG_INIT = metotEkle(T_SAGLAYICI, '<init>', 'V', []);
  const M_SAG_ONCREATE = metotEkle(T_SAGLAYICI, 'onCreate', 'Z', []);
  const M_SAG_QUERY = metotEkle(T_SAGLAYICI, 'query', T_CURSOR, [T_URI, '[Ljava/lang/String;', T_STR, '[Ljava/lang/String;', T_STR]);
  const M_SAG_GETTYPE = metotEkle(T_SAGLAYICI, 'getType', T_STR, [T_URI]);
  const M_SAG_INSERT = metotEkle(T_SAGLAYICI, 'insert', T_URI, [T_URI, T_CV]);
  const M_SAG_DELETE = metotEkle(T_SAGLAYICI, 'delete', 'I', [T_URI, T_STR, '[Ljava/lang/String;']);
  const M_SAG_UPDATE = metotEkle(T_SAGLAYICI, 'update', 'I', [T_URI, T_CV, T_STR, '[Ljava/lang/String;']);

  // DEX Sıralaması
  const siraliMetinler = [...metinKumesi].sort((a, b) =>
    Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  );
  const metinIndeks = new Map(siraliMetinler.map((s, i) => [s, i]));

  const siraliTipler = [...tipKumesi].sort((a, b) => metinIndeks.get(a) - metinIndeks.get(b));
  const tipIndeks = new Map(siraliTipler.map((t, i) => [t, i]));

  const siraliProtolar = [...protoHaritasi.values()].sort((a, b) => {
    const d = tipIndeks.get(a.donus) - tipIndeks.get(b.donus);
    if (d !== 0) return d;
    const minLen = Math.min(a.paramlar.length, b.paramlar.length);
    for (let i = 0; i < minLen; i++) {
      const pd = tipIndeks.get(a.paramlar[i]) - tipIndeks.get(b.paramlar[i]);
      if (pd !== 0) return pd;
    }
    return a.paramlar.length - b.paramlar.length;
  });
  const protoIndeks = new Map(siraliProtolar.map((p, i) => [p.anahtar, i]));

  const siraliAlanlar = [...alanHaritasi.values()].sort((a, b) => {
    return (
      tipIndeks.get(a.sinif) - tipIndeks.get(b.sinif) ||
      metinIndeks.get(a.ad) - metinIndeks.get(b.ad) ||
      tipIndeks.get(a.tip) - tipIndeks.get(b.tip)
    );
  });
  const alanIndeks = new Map(siraliAlanlar.map((f, i) => [f.anahtar, i]));

  const siraliMetotlar = [...metotHaritasi.values()].sort((a, b) => {
    return (
      tipIndeks.get(a.sinif) - tipIndeks.get(b.sinif) ||
      metinIndeks.get(a.ad) - metinIndeks.get(b.ad) ||
      protoIndeks.get(a.protoAnahtar) - protoIndeks.get(b.protoAnahtar)
    );
  });
  const metotIndeks = new Map(siraliMetotlar.map((m, i) => [m.anahtar, i]));

  const sIdx = (s) => metinIndeks.get(s);
  const tIdx = (t) => tipIndeks.get(t);
  const fIdx = (f) => alanIndeks.get(f);
  const mIdx = (m) => metotIndeks.get(m);

  function kodHazirla(metotAnahtari, locals, outs, insnsList, denemeYakala = null) {
    const m = metotHaritasi.get(metotAnahtari);
    const ins = 1 + m.paramlar.reduce((t, p) => t + tipGenisligi(p), 0);
    return {
      metotAnahtari,
      registersSize: locals + ins,
      insSize: ins,
      outsSize: outs,
      insns: insnsList.flat(),
      denemeYakala
    };
  }

  // VarlikYukleyiciIstemci.shouldInterceptRequest(WebView, WebResourceRequest) -> WebResourceResponse
  // locals = 4 (v0..v3), ins = 3 (v4=this, v5=view, v6=request), outs = 4
  const varlikKb = new KodBirlestirici();
  varlikKb
    .ekle(Op.invokeInterface(mIdx(M_WRQ_URL), [6]))
    .ekle(Op.moveResultObject(0))
    .ifEqz(0, 'bosDon')
    .ekle(Op.invokeVirtual(mIdx(M_URI_HOST), [0]))
    .ekle(Op.moveResultObject(1))
    .ekle(Op.constString(2, sIdx(STR_KONAK)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_EQ_IGN), [2, 1]))
    .ekle(Op.moveResult(1))
    .ifEqz(1, 'bosDon')
    .ekle(Op.invokeVirtual(mIdx(M_URI_PATH), [0]))
    .ekle(Op.moveResultObject(0))
    .ifNez(0, 'yolKontrol')
    .ekle(Op.constString(0, sIdx(STR_INDEX_YOL)))
    .etiket('yolKontrol')
    .ekle(Op.constString(1, sIdx(STR_KOK_YOL)))
    .ekle(Op.invokeVirtual(mIdx(M_OBJ_EQUALS), [1, 0]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'basTaksim')
    .ekle(Op.constString(0, sIdx(STR_INDEX_YOL)))
    .etiket('basTaksim')
    .ekle(Op.invokeVirtual(mIdx(M_STR_STARTS), [0, 1]))
    .ekle(Op.moveResult(1))
    .ifEqz(1, 'varlikAcBas')
    .ekle(Op.const4(1, 1))
    .ekle(Op.invokeVirtual(mIdx(M_STR_SUB), [0, 1]))
    .ekle(Op.moveResultObject(0))
    .etiket('varlikAcBas')
    .ekle(Op.igetObject(1, 4, fIdx(F_VARLIK_AKTIVITE)))
    .ekle(Op.invokeVirtual(mIdx(M_ACT_GET_ASSETS), [1]))
    .ekle(Op.moveResultObject(1))
    .ekle(Op.constString(2, sIdx(STR_WWW_ON_EK)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_CONCAT), [2, 0]))
    .ekle(Op.moveResultObject(2))
    .ekle(Op.invokeVirtual(mIdx(M_AM_OPEN), [1, 2]))
    .ekle(Op.moveResultObject(1))
    .ekle(Op.invokeVirtual(mIdx(M_STR_LOWER), [0]))
    .ekle(Op.moveResultObject(0))
    .ekle(Op.constString(2, sIdx(STR_EXT_JS)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_ENDS), [0, 2]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'mimeCss')
    .ekle(Op.constString(0, sIdx(STR_MIME_JS)))
    .git('yanitOlustur')
    .etiket('mimeCss')
    .ekle(Op.constString(2, sIdx(STR_EXT_CSS)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_ENDS), [0, 2]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'mimeJson')
    .ekle(Op.constString(0, sIdx(STR_MIME_CSS)))
    .git('yanitOlustur')
    .etiket('mimeJson')
    .ekle(Op.constString(2, sIdx(STR_EXT_JSON)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_ENDS), [0, 2]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'mimeSvg')
    .ekle(Op.constString(0, sIdx(STR_MIME_JSON)))
    .git('yanitOlustur')
    .etiket('mimeSvg')
    .ekle(Op.constString(2, sIdx(STR_EXT_SVG)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_ENDS), [0, 2]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'mimeWav')
    .ekle(Op.constString(0, sIdx(STR_MIME_SVG)))
    .git('yanitOlustur')
    .etiket('mimeWav')
    .ekle(Op.constString(2, sIdx(STR_EXT_WAV)))
    .ekle(Op.invokeVirtual(mIdx(M_STR_ENDS), [0, 2]))
    .ekle(Op.moveResult(2))
    .ifEqz(2, 'mimeTahmin')
    .ekle(Op.constString(0, sIdx(STR_MIME_WAV)))
    .git('yanitOlustur')
    .etiket('mimeTahmin')
    .ekle(Op.invokeStatic(mIdx(M_URLC_GUESS), [0]))
    .ekle(Op.moveResultObject(0))
    .ifNez(0, 'yanitOlustur')
    .ekle(Op.constString(0, sIdx(STR_MIME_BIN)))
    .etiket('yanitOlustur')
    .ekle(Op.newInstance(2, tIdx(T_WRS)))
    .ekle(Op.constString(3, sIdx(STR_UTF8)))
    .ekle(Op.invokeDirect(mIdx(M_WRS_INIT), [2, 0, 3, 1]))
    .ekle(Op.returnObject(2))
    .etiket('varlikAcSon')
    .ekle(Op.moveException(0))
    .etiket('bosDon')
    .ekle(Op.const4(0, 0))
    .ekle(Op.returnObject(0));

  const varlikDerlenen = varlikKb.derle();
  const tryStart = varlikDerlenen.etiketler.get('varlikAcBas');
  const tryEnd = varlikDerlenen.etiketler.get('varlikAcSon');

  // MainActivity.onCreate: https://appassets.androidplatform.net/index.html üzerinden aç
  const mainOnCreateKod = kodHazirla(M_MAIN_ONCREATE, 3, 3, [
    Op.invokeSuper(mIdx(M_ACT_ONCREATE), [3, 4]),
    Op.const4(0, 1),
    Op.invokeVirtual(mIdx(M_ACT_REQ_FEAT), [3, 0]),
    Op.newInstance(0, tIdx(T_WV)),
    Op.invokeDirect(mIdx(M_WV_INIT), [0, 3]),
    Op.const32(1, 0xff0c020e),
    Op.invokeVirtual(mIdx(M_WV_BG), [0, 1]),
    Op.invokeVirtual(mIdx(M_WV_SETTINGS), [0]),
    Op.moveResultObject(1),
    Op.const4(2, 1),
    Op.invokeVirtual(mIdx(M_WVS_JS), [1, 2]),
    Op.invokeVirtual(mIdx(M_WVS_DOM), [1, 2]),
    Op.invokeVirtual(mIdx(M_WVS_DB), [1, 2]),
    Op.invokeVirtual(mIdx(M_WVS_GEO), [1, 2]),
    Op.invokeVirtual(mIdx(M_WVS_FILE), [1, 2]),
    Op.newInstance(1, tIdx(T_KOPRU)),
    Op.invokeDirect(mIdx(M_KOPRU_INIT), [1, 3]),
    Op.constString(2, sIdx(STR_KOPRU_ADI)),
    Op.invokeVirtual(mIdx(M_WV_ADD_JS), [0, 1, 2]),
    Op.newInstance(1, tIdx(T_VARLIK)),
    Op.invokeDirect(mIdx(M_VARLIK_INIT), [1, 3]),
    Op.invokeVirtual(mIdx(M_WV_SET_WVC), [0, 1]),
    Op.newInstance(1, tIdx(T_WCC)),
    Op.invokeDirect(mIdx(M_WCC_INIT), [1]),
    Op.invokeVirtual(mIdx(M_WV_SET_WCC), [0, 1]),
    Op.invokeVirtual(mIdx(M_ACT_SET_CV), [3, 0]),
    Op.constString(1, sIdx(STR_BASLANGIC_URL)),
    Op.invokeVirtual(mIdx(M_WV_LOAD), [0, 1]),
    Op.returnVoid()
  ]);

  // KuryeKopru.oturumAyarla(String kuryeId, String kuryeAdi, String rol)
  // locals = 3 (v0, v1, v2), ins = 4 (v3=this, v4=kuryeId, v5=kuryeAdi, v6=rol)
  const kopruOturumAyarlaKod = kodHazirla(M_KOPRU_OTURUM_AYARLA, 3, 3, [
    Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)),
    Op.constString(1, sIdx(STR_TERCIH_ADI)),
    Op.const4(2, 0),
    Op.invokeVirtual(mIdx(M_ACT_GET_SP), [0, 1, 2]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SP_EDIT), [0]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_KURYE_ID)),
    Op.invokeVirtual(mIdx(M_SPE_PUT_STR), [0, 1, 4]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_KURYE_ADI)),
    Op.invokeVirtual(mIdx(M_SPE_PUT_STR), [0, 1, 5]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_ROL)),
    Op.invokeVirtual(mIdx(M_SPE_PUT_STR), [0, 1, 6]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SPE_APPLY), [0]),
    Op.returnVoid()
  ]);

  // KuryeKopru.oturumKapat()
  const kopruOturumKapatKod = kodHazirla(M_KOPRU_OTURUM_KAPAT, 3, 3, [
    Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)),
    Op.constString(1, sIdx(STR_TERCIH_ADI)),
    Op.const4(2, 0),
    Op.invokeVirtual(mIdx(M_ACT_GET_SP), [0, 1, 2]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SP_EDIT), [0]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_KURYE_ID)),
    Op.invokeVirtual(mIdx(M_SPE_REM), [0, 1]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_KURYE_ADI)),
    Op.invokeVirtual(mIdx(M_SPE_REM), [0, 1]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SPE_APPLY), [0]),
    Op.returnVoid()
  ]);

  // KuryeKopru.zilAyarla(String seciliKimlik, double sesSeviyesi, String ozelSesVeriUrl)
  // locals = 3 (v0, v1, v2), ins = 5 (v3=this, v4=seciliKimlik, v5..v6=sesSeviyesi, v7=ozelSesVeriUrl)
  const kopruZilAyarlaKod = kodHazirla(M_KOPRU_ZIL_AYARLA, 3, 3, [
    Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)),
    Op.constString(1, sIdx(STR_TERCIH_ADI)),
    Op.const4(2, 0),
    Op.invokeVirtual(mIdx(M_ACT_GET_SP), [0, 1, 2]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SP_EDIT), [0]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_ZIL_KIMLIK)),
    Op.invokeVirtual(mIdx(M_SPE_PUT_STR), [0, 1, 4]),
    Op.moveResultObject(0),
    Op.constString(1, sIdx(STR_ZIL_SES)),
    Op.doubleToFloat(2, 5),
    Op.invokeVirtual(mIdx(M_SPE_PUT_FLT), [0, 1, 2]),
    Op.moveResultObject(0),
    Op.invokeVirtual(mIdx(M_SPE_APPLY), [0]),
    Op.returnVoid()
  ]);

  // KuryeKopru.zilCal(String, String, boolean, int)
  const alarmKb = new KodBirlestirici();
  alarmKb
    .ekle(Op.const4(0, 2))
    .ekle(Op.invokeStatic(mIdx(M_RM_URI), [0]))
    .ekle(Op.moveResultObject(1))
    .ekle(Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)))
    .ekle(Op.invokeStatic(mIdx(M_RM_GET), [0, 1]))
    .ekle(Op.moveResultObject(0))
    .ifEqz(0, 'bitti')
    .ekle(Op.invokeVirtual(mIdx(M_RING_PLAY), [0]))
    .etiket('bitti')
    .ekle(Op.returnVoid());

  const kopruZilCalKod = kodHazirla(M_KOPRU_ZIL_CAL, 3, 2, [alarmKb.derle().birimler]);

  // KuryeKopru.pilOptimizasyonuIste()
  const kopruPilIsteKod = kodHazirla(M_KOPRU_PIL_ISTE, 3, 3, [
    Op.constString(0, sIdx(STR_PKG_URI)),
    Op.invokeStatic(mIdx(M_URI_PARSE), [0]),
    Op.moveResultObject(0),
    Op.newInstance(1, tIdx(T_INTENT)),
    Op.constString(2, sIdx(STR_ACTION_BATTERY)),
    Op.invokeDirect(mIdx(M_INTENT_ACT_URI), [1, 2, 0]),
    Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)),
    Op.invokeVirtual(mIdx(M_ACT_START_ACT), [0, 1]),
    Op.returnVoid()
  ]);

  // KuryeKopru.apkGuncelleIndirVeKur(String indirmeUrl)
  const kopruGuncelleKod = kodHazirla(M_KOPRU_GUNCELLE, 3, 3, [
    Op.invokeStatic(mIdx(M_URI_PARSE), [4]),
    Op.moveResultObject(0),
    Op.newInstance(1, tIdx(T_INTENT)),
    Op.constString(2, sIdx(STR_ACTION_VIEW)),
    Op.invokeDirect(mIdx(M_INTENT_ACT_URI), [1, 2, 0]),
    Op.igetObject(0, 3, fIdx(F_KOPRU_AKTIVITE)),
    Op.invokeVirtual(mIdx(M_ACT_START_ACT), [0, 1]),
    Op.returnVoid()
  ]);

  const metotKodlari = new Map([
    [M_MAIN_INIT, kodHazirla(M_MAIN_INIT, 0, 1, [Op.invokeDirect(mIdx(M_ACT_INIT), [0]), Op.returnVoid()])],
    [M_MAIN_ONCREATE, mainOnCreateKod],

    [
      M_VARLIK_INIT,
      kodHazirla(M_VARLIK_INIT, 0, 1, [
        Op.invokeDirect(mIdx(M_WVC_INIT), [0]),
        Op.iputObject(1, 0, fIdx(F_VARLIK_AKTIVITE)),
        Op.returnVoid()
      ])
    ],
    [
      M_VARLIK_INTERCEPT,
      kodHazirla(M_VARLIK_INTERCEPT, 4, 4, [varlikDerlenen.birimler], {
        startAddr: tryStart,
        insnCount: tryEnd - tryStart,
        catchAddr: tryEnd
      })
    ],

    [
      M_KOPRU_INIT,
      kodHazirla(M_KOPRU_INIT, 0, 1, [
        Op.invokeDirect(mIdx(M_OBJ_INIT), [0]),
        Op.iputObject(1, 0, fIdx(F_KOPRU_AKTIVITE)),
        Op.returnVoid()
      ])
    ],
    [M_KOPRU_OTURUM_AYARLA, kopruOturumAyarlaKod],
    [M_KOPRU_OTURUM_KAPAT, kopruOturumKapatKod],
    [M_KOPRU_ZIL_AYARLA, kopruZilAyarlaKod],
    [M_KOPRU_ZIL_CAL, kopruZilCalKod],
    [M_KOPRU_ZIL_SUSTUR, kodHazirla(M_KOPRU_ZIL_SUSTUR, 0, 0, [Op.returnVoid()])],
    [M_KOPRU_PIL_VAR, kodHazirla(M_KOPRU_PIL_VAR, 1, 0, [Op.const4(0, 0), Op.returnReg(0)])],
    [M_KOPRU_PIL_ISTE, kopruPilIsteKod],
    [M_KOPRU_SURUM, kodHazirla(M_KOPRU_SURUM, 1, 0, [Op.constString(0, sIdx(STR_UYGULAMA_BILGI)), Op.returnObject(0)])],
    [M_KOPRU_GUNCELLE, kopruGuncelleKod],

    [M_SVC_K_INIT, kodHazirla(M_SVC_K_INIT, 0, 1, [Op.invokeDirect(mIdx(M_SVC_INIT), [0]), Op.returnVoid()])],
    [M_SVC_ONBIND, kodHazirla(M_SVC_ONBIND, 1, 0, [Op.const4(0, 0), Op.returnObject(0)])],
    [M_SVC_ONSTART, kodHazirla(M_SVC_ONSTART, 1, 0, [Op.const4(0, 1), Op.returnReg(0)])],

    [M_BOOT_INIT, kodHazirla(M_BOOT_INIT, 0, 1, [Op.invokeDirect(mIdx(M_BR_INIT), [0]), Op.returnVoid()])],
    [M_BOOT_ONRCV, kodHazirla(M_BOOT_ONRCV, 0, 0, [Op.returnVoid()])],

    [M_SAG_INIT, kodHazirla(M_SAG_INIT, 0, 1, [Op.invokeDirect(mIdx(M_CP_INIT), [0]), Op.returnVoid()])],
    [M_SAG_ONCREATE, kodHazirla(M_SAG_ONCREATE, 1, 0, [Op.const4(0, 1), Op.returnReg(0)])],
    [M_SAG_QUERY, kodHazirla(M_SAG_QUERY, 1, 0, [Op.const4(0, 0), Op.returnObject(0)])],
    [M_SAG_GETTYPE, kodHazirla(M_SAG_GETTYPE, 1, 0, [Op.constString(0, sIdx(STR_MIME_APK)), Op.returnObject(0)])],
    [M_SAG_INSERT, kodHazirla(M_SAG_INSERT, 1, 0, [Op.const4(0, 0), Op.returnObject(0)])],
    [M_SAG_DELETE, kodHazirla(M_SAG_DELETE, 1, 0, [Op.const4(0, 0), Op.returnReg(0)])],
    [M_SAG_UPDATE, kodHazirla(M_SAG_UPDATE, 1, 0, [Op.const4(0, 0), Op.returnReg(0)])]
  ]);

  const sinifTanimlari = [
    {
      tip: T_MAIN,
      ustTip: T_ACT,
      erisim: 0x0001,
      alanlar: [],
      dogrudanMetotlar: [M_MAIN_INIT],
      sanalMetotlar: [M_MAIN_ONCREATE],
      ekliMetotlar: []
    },
    {
      tip: T_VARLIK,
      ustTip: T_WVC,
      erisim: 0x0001,
      alanlar: [{ anahtar: F_VARLIK_AKTIVITE, erisim: 0x0012 }],
      dogrudanMetotlar: [M_VARLIK_INIT],
      sanalMetotlar: [M_VARLIK_INTERCEPT],
      ekliMetotlar: []
    },
    {
      tip: T_KOPRU,
      ustTip: T_OBJ,
      erisim: 0x0001,
      alanlar: [{ anahtar: F_KOPRU_AKTIVITE, erisim: 0x0012 }],
      dogrudanMetotlar: [M_KOPRU_INIT],
      sanalMetotlar: [
        M_KOPRU_OTURUM_AYARLA,
        M_KOPRU_OTURUM_KAPAT,
        M_KOPRU_ZIL_AYARLA,
        M_KOPRU_ZIL_CAL,
        M_KOPRU_ZIL_SUSTUR,
        M_KOPRU_PIL_VAR,
        M_KOPRU_PIL_ISTE,
        M_KOPRU_SURUM,
        M_KOPRU_GUNCELLE
      ],
      ekliMetotlar: [
        M_KOPRU_OTURUM_AYARLA,
        M_KOPRU_OTURUM_KAPAT,
        M_KOPRU_ZIL_AYARLA,
        M_KOPRU_ZIL_CAL,
        M_KOPRU_ZIL_SUSTUR,
        M_KOPRU_PIL_VAR,
        M_KOPRU_PIL_ISTE,
        M_KOPRU_SURUM,
        M_KOPRU_GUNCELLE
      ]
    },
    {
      tip: T_SERVIS,
      ustTip: T_SVC,
      erisim: 0x0001,
      alanlar: [],
      dogrudanMetotlar: [M_SVC_K_INIT],
      sanalMetotlar: [M_SVC_ONBIND, M_SVC_ONSTART],
      ekliMetotlar: []
    },
    {
      tip: T_BOOT,
      ustTip: T_BR,
      erisim: 0x0001,
      alanlar: [],
      dogrudanMetotlar: [M_BOOT_INIT],
      sanalMetotlar: [M_BOOT_ONRCV],
      ekliMetotlar: []
    },
    {
      tip: T_SAGLAYICI,
      ustTip: T_CP,
      erisim: 0x0001,
      alanlar: [],
      dogrudanMetotlar: [M_SAG_INIT],
      sanalMetotlar: [M_SAG_ONCREATE, M_SAG_QUERY, M_SAG_GETTYPE, M_SAG_INSERT, M_SAG_DELETE, M_SAG_UPDATE],
      ekliMetotlar: []
    }
  ];

  const BASLIK_BOYUTU = 0x70;
  const stringIdsOff = BASLIK_BOYUTU;
  const typeIdsOff = stringIdsOff + siraliMetinler.length * 4;
  const protoIdsOff = typeIdsOff + siraliTipler.length * 4;
  const fieldIdsOff = protoIdsOff + siraliProtolar.length * 12;
  const methodIdsOff = fieldIdsOff + siraliAlanlar.length * 8;
  const classDefsOff = methodIdsOff + siraliMetotlar.length * 8;
  const dataOff = dortBaytaHizala(classDefsOff + sinifTanimlari.length * 32);

  const veriParcalari = [];
  let veriImleci = dataOff;
  const haritaKayitlari = [
    { tip: 0x0000, boyut: 1, ofset: 0 },
    { tip: 0x0001, boyut: siraliMetinler.length, ofset: stringIdsOff },
    { tip: 0x0002, boyut: siraliTipler.length, ofset: typeIdsOff },
    { tip: 0x0003, boyut: siraliProtolar.length, ofset: protoIdsOff },
    { tip: 0x0004, boyut: siraliAlanlar.length, ofset: fieldIdsOff },
    { tip: 0x0005, boyut: siraliMetotlar.length, ofset: methodIdsOff },
    { tip: 0x0006, boyut: sinifTanimlari.length, ofset: classDefsOff }
  ];

  function veriHizala(hizalama = 4) {
    const bosluk = (hizalama - (veriImleci % hizalama)) % hizalama;
    if (bosluk > 0) {
      veriParcalari.push(Buffer.alloc(bosluk));
      veriImleci += bosluk;
    }
  }
  function veriEkle(tampon) {
    const baslangic = veriImleci;
    veriParcalari.push(tampon);
    veriImleci += tampon.length;
    return baslangic;
  }

  // 1. type_list
  const protoParamOfsetleri = new Map();
  let typeListIlkOfset = 0;
  let typeListSayisi = 0;
  for (const p of siraliProtolar) {
    if (p.paramlar.length > 0) {
      veriHizala(4);
      const tBuf = Buffer.alloc(4 + p.paramlar.length * 2);
      tBuf.writeUInt32LE(p.paramlar.length, 0);
      p.paramlar.forEach((pt, idx) => tBuf.writeUInt16LE(tIdx(pt), 4 + idx * 2));
      const ofset = veriEkle(tBuf);
      if (typeListSayisi === 0) typeListIlkOfset = ofset;
      typeListSayisi++;
      protoParamOfsetleri.set(p.anahtar, ofset);
    } else {
      protoParamOfsetleri.set(p.anahtar, 0);
    }
  }
  if (typeListSayisi > 0) {
    haritaKayitlari.push({ tip: 0x1001, boyut: typeListSayisi, ofset: typeListIlkOfset });
  }

  // 2. code_item blokları
  const kodOfsetleri = new Map();
  let codeIlkOfset = 0;
  let codeSayisi = 0;
  for (const [anahtar, kod] of metotKodlari.entries()) {
    veriHizala(4);
    const triesSayisi = kod.denemeYakala ? 1 : 0;
    const hizalamaPad = triesSayisi > 0 && kod.insns.length % 2 === 1 ? 2 : 0;

    let tryParca = Buffer.alloc(0);
    if (kod.denemeYakala) {
      const tryItem = Buffer.alloc(8);
      tryItem.writeUInt32LE(kod.denemeYakala.startAddr, 0);
      tryItem.writeUInt16LE(kod.denemeYakala.insnCount, 4);
      tryItem.writeUInt16LE(1, 6); // handler_off (1 bayt sonra: size uleb128(1)'den hemen sonra)

      const yakalayiciListesi = Buffer.concat([
        uleb128Yaz(1),
        sleb128Yaz(0), // 0 => sadece catch-all
        uleb128Yaz(kod.denemeYakala.catchAddr)
      ]);
      tryParca = Buffer.concat([tryItem, yakalayiciListesi]);
    }

    const cBuf = Buffer.alloc(16 + kod.insns.length * 2 + hizalamaPad);
    cBuf.writeUInt16LE(kod.registersSize, 0);
    cBuf.writeUInt16LE(kod.insSize, 2);
    cBuf.writeUInt16LE(kod.outsSize, 4);
    cBuf.writeUInt16LE(triesSayisi, 6);
    cBuf.writeUInt32LE(0, 8);
    cBuf.writeUInt32LE(kod.insns.length, 12);
    for (let i = 0; i < kod.insns.length; i++) {
      cBuf.writeUInt16LE(kod.insns[i] & 0xffff, 16 + i * 2);
    }

    const ofset = veriEkle(Buffer.concat([cBuf, tryParca]));
    if (codeSayisi === 0) codeIlkOfset = ofset;
    codeSayisi++;
    kodOfsetleri.set(anahtar, ofset);
  }
  haritaKayitlari.push({ tip: 0x2001, boyut: codeSayisi, ofset: codeIlkOfset });

  // 3. @JavascriptInterface ek açıklamaları
  const annItemBuf = Buffer.concat([
    Buffer.from([0x01]),
    uleb128Yaz(tIdx(T_JSIF)),
    uleb128Yaz(0)
  ]);
  const annItemOff = veriEkle(annItemBuf);
  haritaKayitlari.push({ tip: 0x2004, boyut: 1, ofset: annItemOff });

  veriHizala(4);
  const annSetBuf = Buffer.alloc(8);
  annSetBuf.writeUInt32LE(1, 0);
  annSetBuf.writeUInt32LE(annItemOff, 4);
  const annSetOff = veriEkle(annSetBuf);
  haritaKayitlari.push({ tip: 0x1003, boyut: 1, ofset: annSetOff });

  const sinifAnnDirOfsetleri = new Map();
  let annDirIlkOfset = 0;
  let annDirSayisi = 0;
  for (const s of sinifTanimlari) {
    if (s.ekliMetotlar.length > 0) {
      veriHizala(4);
      const siraliEkli = [...s.ekliMetotlar].sort((a, b) => mIdx(a) - mIdx(b));
      const dirBuf = Buffer.alloc(16 + siraliEkli.length * 8);
      dirBuf.writeUInt32LE(0, 0);
      dirBuf.writeUInt32LE(0, 4);
      dirBuf.writeUInt32LE(siraliEkli.length, 8);
      dirBuf.writeUInt32LE(0, 12);
      siraliEkli.forEach((ma, idx) => {
        dirBuf.writeUInt32LE(mIdx(ma), 16 + idx * 8);
        dirBuf.writeUInt32LE(annSetOff, 16 + idx * 8 + 4);
      });
      const ofset = veriEkle(dirBuf);
      if (annDirSayisi === 0) annDirIlkOfset = ofset;
      annDirSayisi++;
      sinifAnnDirOfsetleri.set(s.tip, ofset);
    } else {
      sinifAnnDirOfsetleri.set(s.tip, 0);
    }
  }
  if (annDirSayisi > 0) {
    haritaKayitlari.push({ tip: 0x2006, boyut: annDirSayisi, ofset: annDirIlkOfset });
  }

  // 4. string_data_item
  const stringDataOfsetleri = [];
  const strIlkOfset = veriImleci;
  for (const s of siraliMetinler) {
    const utf8 = Buffer.from(s, 'utf8');
    const kayit = Buffer.concat([uleb128Yaz(s.length), utf8, Buffer.from([0x00])]);
    stringDataOfsetleri.push(veriEkle(kayit));
  }
  haritaKayitlari.push({ tip: 0x2002, boyut: siraliMetinler.length, ofset: strIlkOfset });

  // 5. class_data_item
  const classDataOfsetleri = new Map();
  const classDataIlkOfset = veriImleci;
  for (const s of sinifTanimlari) {
    const alanSirali = [...s.alanlar].sort((a, b) => fIdx(a.anahtar) - fIdx(b.anahtar));
    const dogrudanSirali = [...s.dogrudanMetotlar].sort((a, b) => mIdx(a) - mIdx(b));
    const sanalSirali = [...s.sanalMetotlar].sort((a, b) => mIdx(a) - mIdx(b));

    const parcalar = [
      uleb128Yaz(0),
      uleb128Yaz(alanSirali.length),
      uleb128Yaz(dogrudanSirali.length),
      uleb128Yaz(sanalSirali.length)
    ];

    let oncekiAlan = 0;
    for (const f of alanSirali) {
      const idx = fIdx(f.anahtar);
      parcalar.push(uleb128Yaz(idx - oncekiAlan));
      parcalar.push(uleb128Yaz(f.erisim));
      oncekiAlan = idx;
    }

    const metotYaz = (liste, bayraklar) => {
      let onceki = 0;
      for (const ma of liste) {
        const idx = mIdx(ma);
        const ad = metotHaritasi.get(ma).ad;
        const erisim = ad === '<init>' ? 0x10001 : bayraklar;
        parcalar.push(uleb128Yaz(idx - onceki));
        parcalar.push(uleb128Yaz(erisim));
        parcalar.push(uleb128Yaz(kodOfsetleri.get(ma)));
        onceki = idx;
      }
    };
    metotYaz(dogrudanSirali, 0x0001);
    metotYaz(sanalSirali, 0x0001);

    classDataOfsetleri.set(s.tip, veriEkle(Buffer.concat(parcalar)));
  }
  haritaKayitlari.push({ tip: 0x2000, boyut: sinifTanimlari.length, ofset: classDataIlkOfset });

  // 6. map_list
  veriHizala(4);
  const mapOff = veriImleci;
  haritaKayitlari.push({ tip: 0x1000, boyut: 1, ofset: mapOff });
  haritaKayitlari.sort((a, b) => a.ofset - b.ofset);

  const mapBuf = Buffer.alloc(4 + haritaKayitlari.length * 12);
  mapBuf.writeUInt32LE(haritaKayitlari.length, 0);
  haritaKayitlari.forEach((hk, i) => {
    const o = 4 + i * 12;
    mapBuf.writeUInt16LE(hk.tip, o);
    mapBuf.writeUInt16LE(0, o + 2);
    mapBuf.writeUInt32LE(hk.boyut, o + 4);
    mapBuf.writeUInt32LE(hk.ofset, o + 8);
  });
  veriEkle(mapBuf);
  veriHizala(4);

  const toplamBoyut = veriImleci;
  const dex = Buffer.alloc(toplamBoyut);

  stringDataOfsetleri.forEach((off, i) => dex.writeUInt32LE(off, stringIdsOff + i * 4));
  siraliTipler.forEach((t, i) => dex.writeUInt32LE(sIdx(t), typeIdsOff + i * 4));
  siraliProtolar.forEach((p, i) => {
    const o = protoIdsOff + i * 12;
    dex.writeUInt32LE(sIdx(p.kisa), o);
    dex.writeUInt32LE(tIdx(p.donus), o + 4);
    dex.writeUInt32LE(protoParamOfsetleri.get(p.anahtar), o + 8);
  });
  siraliAlanlar.forEach((f, i) => {
    const o = fieldIdsOff + i * 8;
    dex.writeUInt16LE(tIdx(f.sinif), o);
    dex.writeUInt16LE(tIdx(f.tip), o + 2);
    dex.writeUInt32LE(sIdx(f.ad), o + 4);
  });
  siraliMetotlar.forEach((m, i) => {
    const o = methodIdsOff + i * 8;
    dex.writeUInt16LE(tIdx(m.sinif), o);
    dex.writeUInt16LE(protoIndeks.get(m.protoAnahtar), o + 2);
    dex.writeUInt32LE(sIdx(m.ad), o + 4);
  });
  sinifTanimlari.forEach((s, i) => {
    const o = classDefsOff + i * 32;
    dex.writeUInt32LE(tIdx(s.tip), o);
    dex.writeUInt32LE(s.erisim, o + 4);
    dex.writeUInt32LE(tIdx(s.ustTip), o + 8);
    dex.writeUInt32LE(0, o + 12);
    dex.writeInt32LE(-1, o + 16);
    dex.writeUInt32LE(sinifAnnDirOfsetleri.get(s.tip), o + 20);
    dex.writeUInt32LE(classDataOfsetleri.get(s.tip), o + 24);
    dex.writeUInt32LE(0, o + 28);
  });

  Buffer.concat(veriParcalari).copy(dex, dataOff);

  Buffer.from('dex\n035\0', 'ascii').copy(dex, 0);
  dex.writeUInt32LE(toplamBoyut, 32);
  dex.writeUInt32LE(BASLIK_BOYUTU, 36);
  dex.writeUInt32LE(0x12345678, 40);
  dex.writeUInt32LE(0, 44);
  dex.writeUInt32LE(0, 48);
  dex.writeUInt32LE(mapOff, 52);
  dex.writeUInt32LE(siraliMetinler.length, 56);
  dex.writeUInt32LE(stringIdsOff, 60);
  dex.writeUInt32LE(siraliTipler.length, 64);
  dex.writeUInt32LE(typeIdsOff, 68);
  dex.writeUInt32LE(siraliProtolar.length, 72);
  dex.writeUInt32LE(protoIdsOff, 76);
  dex.writeUInt32LE(siraliAlanlar.length, 80);
  dex.writeUInt32LE(fieldIdsOff, 84);
  dex.writeUInt32LE(siraliMetotlar.length, 88);
  dex.writeUInt32LE(methodIdsOff, 92);
  dex.writeUInt32LE(sinifTanimlari.length, 96);
  dex.writeUInt32LE(classDefsOff, 100);
  dex.writeUInt32LE(toplamBoyut - dataOff, 104);
  dex.writeUInt32LE(dataOff, 108);

  const sha1 = crypto.createHash('sha1').update(dex.subarray(32)).digest();
  sha1.copy(dex, 12);
  const adler = adler32Hesapla(dex.subarray(12));
  dex.writeUInt32LE(adler, 8);

  return dex;
}

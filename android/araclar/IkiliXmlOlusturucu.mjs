const ANDROID_NS = 'http://schemas.android.com/apk/res/android';

const OZELLIK_KAYNAK_KIMLIKLERI = {
  theme: 0x01010000,
  label: 0x01010001,
  icon: 0x01010002,
  name: 0x01010003,
  enabled: 0x0101000e,
  exported: 0x01010010,
  authorities: 0x01010018,
  grantUriPermissions: 0x0101001b,
  launchMode: 0x0101001d,
  configChanges: 0x0101001f,
  resource: 0x01010025,
  path: 0x0101002a,
  minSdkVersion: 0x0101020c,
  versionCode: 0x0101021b,
  versionName: 0x0101021c,
  targetSdkVersion: 0x01010270,
  allowBackup: 0x01010280,
  usesCleartextTraffic: 0x010104ec,
  roundIcon: 0x0101052c,
  showWhenLocked: 0x01010567,
  turnScreenOn: 0x01010568,
  foregroundServiceType: 0x01010599
};

const TIP_REFERANS = 0x01;
const TIP_METIN = 0x03;
const TIP_TAM_SAYI = 0x10;
const TIP_HEX = 0x11;
const TIP_MANTIKSAL = 0x12;

function dortBaytaHizala(uzunluk) {
  return (uzunluk + 3) & ~3;
}

function metinHavuzuOlustur(metinler) {
  const kodlanmis = metinler.map((m) => {
    const icerik = Buffer.from(m, 'utf16le');
    const tampon = Buffer.alloc(2 + icerik.length + 2);
    tampon.writeUInt16LE(m.length, 0);
    icerik.copy(tampon, 2);
    tampon.writeUInt16LE(0, 2 + icerik.length);
    return tampon;
  });

  const ofsetler = [];
  let gecerliOfset = 0;
  for (const parca of kodlanmis) {
    ofsetler.push(gecerliOfset);
    gecerliOfset += parca.length;
  }

  const veriUzunlugu = dortBaytaHizala(gecerliOfset);
  const baslikBoyutu = 28;
  const ofsetTabloBoyutu = metinler.length * 4;
  const metinBaslangici = baslikBoyutu + ofsetTabloBoyutu;
  const toplamBoyut = metinBaslangici + veriUzunlugu;

  const sonuc = Buffer.alloc(toplamBoyut);
  sonuc.writeUInt16LE(0x0001, 0); // RES_STRING_POOL_TYPE
  sonuc.writeUInt16LE(baslikBoyutu, 2);
  sonuc.writeUInt32LE(toplamBoyut, 4);
  sonuc.writeUInt32LE(metinler.length, 8);
  sonuc.writeUInt32LE(0, 12); // styleCount
  sonuc.writeUInt32LE(0, 16); // UTF-16LE
  sonuc.writeUInt32LE(metinBaslangici, 20);
  sonuc.writeUInt32LE(0, 24); // stylesStart

  for (let i = 0; i < ofsetler.length; i++) {
    sonuc.writeUInt32LE(ofsetler[i], baslikBoyutu + i * 4);
  }

  let yazmaOfseti = metinBaslangici;
  for (const parca of kodlanmis) {
    parca.copy(sonuc, yazmaOfseti);
    yazmaOfseti += parca.length;
  }

  return sonuc;
}

function kaynakHaritasiOlustur(kaynakKimlikleri) {
  const boyut = 8 + kaynakKimlikleri.length * 4;
  const tampon = Buffer.alloc(boyut);
  tampon.writeUInt16LE(0x0180, 0); // RES_XML_RESOURCE_MAP_TYPE
  tampon.writeUInt16LE(8, 2);
  tampon.writeUInt32LE(boyut, 4);
  for (let i = 0; i < kaynakKimlikleri.length; i++) {
    tampon.writeUInt32LE(kaynakKimlikleri[i] >>> 0, 8 + i * 4);
  }
  return tampon;
}

function dugumBasligiYaz(tampon, tip, boyut, satirNo) {
  tampon.writeUInt16LE(tip, 0);
  tampon.writeUInt16LE(16, 2);
  tampon.writeUInt32LE(boyut, 4);
  tampon.writeUInt32LE(satirNo, 8);
  tampon.writeInt32LE(-1, 12);
}

function ikiliXmlDerle(kokDugum, adAlaniKullan = true) {
  const ozellikListesi = [];
  const ozellikHaritasi = new Map();
  const digerMetinler = [];
  const digerHarita = new Map();

  function ozellikIndeksiAl(ad, androidAdAlani) {
    if (androidAdAlani && OZELLIK_KAYNAK_KIMLIKLERI[ad] !== undefined) {
      if (!ozellikHaritasi.has(ad)) {
        ozellikHaritasi.set(ad, ozellikListesi.length);
        ozellikListesi.push({ ad, kimlik: OZELLIK_KAYNAK_KIMLIKLERI[ad] });
      }
      return ozellikHaritasi.get(ad);
    }
    return null;
  }

  function genelMetinEkle(metin) {
    if (!digerHarita.has(metin)) {
      digerHarita.set(metin, digerMetinler.length);
      digerMetinler.push(metin);
    }
  }

  function agaciTara(dugum) {
    genelMetinEkle(dugum.etiket);
    for (const oz of dugum.ozellikler || []) {
      const indeks = ozellikIndeksiAl(oz.ad, oz.android === true);
      if (indeks === null) {
        genelMetinEkle(oz.ad);
      }
      if (oz.tip === TIP_METIN) {
        genelMetinEkle(String(oz.deger));
      }
    }
    for (const alt of dugum.cocuklar || []) {
      agaciTara(alt);
    }
  }

  if (adAlaniKullan) {
    genelMetinEkle('android');
    genelMetinEkle(ANDROID_NS);
  }
  agaciTara(kokDugum);

  const tumMetinler = [
    ...ozellikListesi.map((o) => o.ad),
    ...digerMetinler
  ];
  const indeksBul = (metin, androidOzellik = false) => {
    if (androidOzellik && ozellikHaritasi.has(metin)) {
      return ozellikHaritasi.get(metin);
    }
    if (digerHarita.has(metin)) {
      return ozellikListesi.length + digerHarita.get(metin);
    }
    throw new Error(`İkili XML metni bulunamadı: ${metin}`);
  };

  const parcalar = [];
  parcalar.push(metinHavuzuOlustur(tumMetinler));
  parcalar.push(kaynakHaritasiOlustur(ozellikListesi.map((o) => o.kimlik)));

  if (adAlaniKullan) {
    const basNs = Buffer.alloc(24);
    dugumBasligiYaz(basNs, 0x0100, 24, 1);
    basNs.writeInt32LE(indeksBul('android'), 16);
    basNs.writeInt32LE(indeksBul(ANDROID_NS), 20);
    parcalar.push(basNs);
  }

  let satir = 2;
  function dugumYaz(dugum) {
    const mevcutSatir = satir++;
    const ozellikler = dugum.ozellikler || [];
    const tagBoyutu = 36 + ozellikler.length * 20;
    const tag = Buffer.alloc(tagBoyutu);
    dugumBasligiYaz(tag, 0x0102, tagBoyutu, mevcutSatir);
    tag.writeInt32LE(-1, 16); // ns
    tag.writeInt32LE(indeksBul(dugum.etiket), 20);
    tag.writeUInt16LE(20, 24); // attributeStart
    tag.writeUInt16LE(20, 26); // attributeSize
    tag.writeUInt16LE(ozellikler.length, 28);
    tag.writeUInt16LE(0, 30); // idIndex
    tag.writeUInt16LE(0, 32); // classIndex
    tag.writeUInt16LE(0, 34); // styleIndex

    let ofset = 36;
    for (const oz of ozellikler) {
      const nsIdx = oz.android ? indeksBul(ANDROID_NS) : -1;
      const adIdx = indeksBul(oz.ad, oz.android === true);
      const hamDegerIdx = oz.tip === TIP_METIN ? indeksBul(String(oz.deger)) : -1;

      tag.writeInt32LE(nsIdx, ofset);
      tag.writeInt32LE(adIdx, ofset + 4);
      tag.writeInt32LE(hamDegerIdx, ofset + 8);
      tag.writeUInt16LE(8, ofset + 12); // Res_value.size
      tag.writeUInt8(0, ofset + 14); // res0
      tag.writeUInt8(oz.tip, ofset + 15);

      if (oz.tip === TIP_METIN) {
        tag.writeInt32LE(hamDegerIdx, ofset + 16);
      } else if (oz.tip === TIP_MANTIKSAL) {
        tag.writeInt32LE(oz.deger ? -1 : 0, ofset + 16);
      } else {
        tag.writeUInt32LE(Number(oz.deger) >>> 0, ofset + 16);
      }
      ofset += 20;
    }
    parcalar.push(tag);

    for (const alt of dugum.cocuklar || []) {
      dugumYaz(alt);
    }

    const sonTag = Buffer.alloc(24);
    dugumBasligiYaz(sonTag, 0x0103, 24, mevcutSatir);
    sonTag.writeInt32LE(-1, 16);
    sonTag.writeInt32LE(indeksBul(dugum.etiket), 20);
    parcalar.push(sonTag);
  }

  dugumYaz(kokDugum);

  if (adAlaniKullan) {
    const bitNs = Buffer.alloc(24);
    dugumBasligiYaz(bitNs, 0x0101, 24, satir);
    bitNs.writeInt32LE(indeksBul('android'), 16);
    bitNs.writeInt32LE(indeksBul(ANDROID_NS), 20);
    parcalar.push(bitNs);
  }

  const govde = Buffer.concat(parcalar);
  const ustBaslik = Buffer.alloc(8);
  ustBaslik.writeUInt16LE(0x0003, 0); // RES_XML_TYPE
  ustBaslik.writeUInt16LE(8, 2);
  ustBaslik.writeUInt32LE(8 + govde.length, 4);

  return Buffer.concat([ustBaslik, govde]);
}

export function ikiliManifestOlustur({
  paketKimligi = 'com.afyonevlezzetleri.kurye',
  uygulamaAdi = 'Afyon Kurye',
  surumKodu = 100,
  surumAdi = '1.0.0'
}) {
  const izinler = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_LOCATION',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.WAKE_LOCK',
    'android.permission.VIBRATE',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.USE_FULL_SCREEN_INTENT',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.REQUEST_INSTALL_PACKAGES',
    'android.permission.CAMERA'
  ];

  const manifestAgaci = {
    etiket: 'manifest',
    ozellikler: [
      { ad: 'versionCode', android: true, tip: TIP_TAM_SAYI, deger: surumKodu },
      { ad: 'versionName', android: true, tip: TIP_METIN, deger: surumAdi },
      { ad: 'package', android: false, tip: TIP_METIN, deger: paketKimligi }
    ],
    cocuklar: [
      {
        etiket: 'uses-sdk',
        ozellikler: [
          { ad: 'minSdkVersion', android: true, tip: TIP_TAM_SAYI, deger: 24 },
          { ad: 'targetSdkVersion', android: true, tip: TIP_TAM_SAYI, deger: 34 }
        ]
      },
      ...izinler.map((izin) => ({
        etiket: 'uses-permission',
        ozellikler: [{ ad: 'name', android: true, tip: TIP_METIN, deger: izin }]
      })),
      {
        etiket: 'application',
        ozellikler: [
          { ad: 'label', android: true, tip: TIP_METIN, deger: uygulamaAdi },
          { ad: 'icon', android: true, tip: TIP_REFERANS, deger: 0x7f010000 },
          { ad: 'roundIcon', android: true, tip: TIP_REFERANS, deger: 0x7f010001 },
          { ad: 'allowBackup', android: true, tip: TIP_MANTIKSAL, deger: false },
          { ad: 'usesCleartextTraffic', android: true, tip: TIP_MANTIKSAL, deger: false }
        ],
        cocuklar: [
          {
            etiket: 'activity',
            ozellikler: [
              { ad: 'name', android: true, tip: TIP_METIN, deger: `${paketKimligi}.MainActivity` },
              { ad: 'exported', android: true, tip: TIP_MANTIKSAL, deger: true },
              { ad: 'launchMode', android: true, tip: TIP_TAM_SAYI, deger: 1 },
              { ad: 'configChanges', android: true, tip: TIP_HEX, deger: 0x04a0 },
              { ad: 'showWhenLocked', android: true, tip: TIP_MANTIKSAL, deger: true },
              { ad: 'turnScreenOn', android: true, tip: TIP_MANTIKSAL, deger: true }
            ],
            cocuklar: [
              {
                etiket: 'intent-filter',
                cocuklar: [
                  {
                    etiket: 'action',
                    ozellikler: [{ ad: 'name', android: true, tip: TIP_METIN, deger: 'android.intent.action.MAIN' }]
                  },
                  {
                    etiket: 'category',
                    ozellikler: [{ ad: 'name', android: true, tip: TIP_METIN, deger: 'android.intent.category.LAUNCHER' }]
                  }
                ]
              }
            ]
          },
          {
            etiket: 'service',
            ozellikler: [
              { ad: 'name', android: true, tip: TIP_METIN, deger: `${paketKimligi}.KuryeDinleyiciServisi` },
              { ad: 'enabled', android: true, tip: TIP_MANTIKSAL, deger: true },
              { ad: 'exported', android: true, tip: TIP_MANTIKSAL, deger: false },
              { ad: 'foregroundServiceType', android: true, tip: TIP_HEX, deger: 0x0009 }
            ]
          },
          {
            etiket: 'receiver',
            ozellikler: [
              { ad: 'name', android: true, tip: TIP_METIN, deger: `${paketKimligi}.BootReceiver` },
              { ad: 'enabled', android: true, tip: TIP_MANTIKSAL, deger: true },
              { ad: 'exported', android: true, tip: TIP_MANTIKSAL, deger: true }
            ],
            cocuklar: [
              {
                etiket: 'intent-filter',
                cocuklar: [
                  {
                    etiket: 'action',
                    ozellikler: [{ ad: 'name', android: true, tip: TIP_METIN, deger: 'android.intent.action.BOOT_COMPLETED' }]
                  },
                  {
                    etiket: 'action',
                    ozellikler: [{ ad: 'name', android: true, tip: TIP_METIN, deger: 'android.intent.action.QUICKBOOT_POWERON' }]
                  }
                ]
              }
            ]
          },
          {
            etiket: 'provider',
            ozellikler: [
              { ad: 'name', android: true, tip: TIP_METIN, deger: `${paketKimligi}.ApkDosyaSaglayici` },
              { ad: 'authorities', android: true, tip: TIP_METIN, deger: `${paketKimligi}.dosyasaglayici` },
              { ad: 'exported', android: true, tip: TIP_MANTIKSAL, deger: false },
              { ad: 'grantUriPermissions', android: true, tip: TIP_MANTIKSAL, deger: true }
            ],
            cocuklar: [
              {
                etiket: 'meta-data',
                ozellikler: [
                  { ad: 'name', android: true, tip: TIP_METIN, deger: 'android.support.FILE_PROVIDER_PATHS' },
                  { ad: 'resource', android: true, tip: TIP_REFERANS, deger: 0x7f030000 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  return ikiliXmlDerle(manifestAgaci, true);
}

export function ikiliDosyaYollariXmlOlustur() {
  const yolAgaci = {
    etiket: 'paths',
    cocuklar: [
      {
        etiket: 'cache-path',
        ozellikler: [
          { ad: 'name', android: false, tip: TIP_METIN, deger: 'apk_guncelleme' },
          { ad: 'path', android: false, tip: TIP_METIN, deger: '.' }
        ]
      },
      {
        etiket: 'files-path',
        ozellikler: [
          { ad: 'name', android: false, tip: TIP_METIN, deger: 'apk_dosyalar' },
          { ad: 'path', android: false, tip: TIP_METIN, deger: '.' }
        ]
      },
      {
        etiket: 'external-cache-path',
        ozellikler: [
          { ad: 'name', android: false, tip: TIP_METIN, deger: 'harici_apk' },
          { ad: 'path', android: false, tip: TIP_METIN, deger: '.' }
        ]
      }
    ]
  };

  return ikiliXmlDerle(yolAgaci, false);
}

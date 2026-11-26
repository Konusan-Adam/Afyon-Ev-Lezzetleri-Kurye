import sharp from 'sharp';

const YOGUNLUKLAR = [
  { ad: 'mdpi', boyut: 48, dpi: 160 },
  { ad: 'hdpi', boyut: 72, dpi: 240 },
  { ad: 'xhdpi', boyut: 96, dpi: 320 },
  { ad: 'xxhdpi', boyut: 144, dpi: 480 },
  { ad: 'xxxhdpi', boyut: 192, dpi: 640 }
];

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

  const veriBoyutu = dortBaytaHizala(gecerliOfset);
  const baslikBoyutu = 28;
  const ofsetTabloBoyutu = metinler.length * 4;
  const metinBaslangici = baslikBoyutu + ofsetTabloBoyutu;
  const toplamBoyut = metinBaslangici + veriBoyutu;

  const sonuc = Buffer.alloc(toplamBoyut);
  sonuc.writeUInt16LE(0x0001, 0);
  sonuc.writeUInt16LE(baslikBoyutu, 2);
  sonuc.writeUInt32LE(toplamBoyut, 4);
  sonuc.writeUInt32LE(metinler.length, 8);
  sonuc.writeUInt32LE(0, 12);
  sonuc.writeUInt32LE(0, 16);
  sonuc.writeUInt32LE(metinBaslangici, 20);
  sonuc.writeUInt32LE(0, 24);

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

function tipSpecOlustur(tipId, kayitSayisi) {
  const boyut = 16 + kayitSayisi * 4;
  const tampon = Buffer.alloc(boyut);
  tampon.writeUInt16LE(0x0202, 0);
  tampon.writeUInt16LE(16, 2);
  tampon.writeUInt32LE(boyut, 4);
  tampon.writeUInt8(tipId, 8);
  tampon.writeUInt32LE(kayitSayisi, 12);
  return tampon;
}

function tipVeriBlokuOlustur(tipId, dpi, kayitlar) {
  const configBoyutu = 64;
  const baslikBoyutu = 20 + configBoyutu;
  const ofsetTabloBoyutu = kayitlar.length * 4;
  const kayitBaslangici = baslikBoyutu + ofsetTabloBoyutu;

  const girisParcalari = [];
  const ofsetler = [];
  let gecerliOfset = 0;

  for (const kayit of kayitlar) {
    ofsetler.push(gecerliOfset);
    const parca = Buffer.alloc(16);
    parca.writeUInt16LE(8, 0);
    parca.writeUInt16LE(0, 2);
    parca.writeInt32LE(kayit.anahtarIndeksi, 4);
    parca.writeUInt16LE(8, 8);
    parca.writeUInt8(0, 10);
    parca.writeUInt8(0x03, 11);
    parca.writeInt32LE(kayit.metinIndeksi, 12);
    girisParcalari.push(parca);
    gecerliOfset += parca.length;
  }

  const toplamBoyut = kayitBaslangici + gecerliOfset;
  const tampon = Buffer.alloc(toplamBoyut);
  tampon.writeUInt16LE(0x0201, 0);
  tampon.writeUInt16LE(baslikBoyutu, 2);
  tampon.writeUInt32LE(toplamBoyut, 4);
  tampon.writeUInt8(tipId, 8);
  tampon.writeUInt32LE(kayitlar.length, 12);
  tampon.writeUInt32LE(kayitBaslangici, 16);

  tampon.writeUInt32LE(configBoyutu, 20);
  if (dpi > 0) {
    tampon.writeUInt16LE(dpi, 48);
  }

  for (let i = 0; i < ofsetler.length; i++) {
    tampon.writeUInt32LE(ofsetler[i], baslikBoyutu + i * 4);
  }
  Buffer.concat(girisParcalari).copy(tampon, kayitBaslangici);
  return tampon;
}

function ikonSvgMetni(boyut, yuvarlakMi) {
  const koseYaricapi = yuvarlakMi ? Math.round(boyut / 2) : Math.round(boyut * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 192 192">
    <defs>
      <linearGradient id="morZemin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3E1646"/>
        <stop offset="100%" stop-color="#140519"/>
      </linearGradient>
      <linearGradient id="altinVurgu" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FBBF24"/>
        <stop offset="100%" stop-color="#D97706"/>
      </linearGradient>
    </defs>
    <rect width="192" height="192" rx="${Math.round((koseYaricapi / boyut) * 192)}" fill="url(#morZemin)"/>
    <rect x="10" y="10" width="172" height="172" rx="${Math.max(12, Math.round((koseYaricapi / boyut) * 192) - 8)}" fill="none" stroke="#F59E0B" stroke-opacity="0.45" stroke-width="4"/>
    <circle cx="96" cy="72" r="34" fill="url(#altinVurgu)" fill-opacity="0.18" stroke="#FBBF24" stroke-width="4"/>
    <path d="M74 84 L96 52 L118 84" fill="none" stroke="#FBBF24" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M84 74 H108" stroke="#10B981" stroke-width="6" stroke-linecap="round"/>
    <text x="96" y="138" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="24" fill="#FFFFFF" letter-spacing="1.5">AFYON</text>
    <text x="96" y="160" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="16" fill="#FBBF24" letter-spacing="2">KURYE</text>
  </svg>`;
}

export async function ikonVeKaynakTablosuOlustur({
  paketKimligi = 'com.afyonevlezzetleri.kurye',
  uygulamaAdi = 'Afyon Kurye',
  zilDosyalari = []
}) {
  const ikonDosyalari = [];
  const genelMetinler = [];

  for (const y of YOGUNLUKLAR) {
    const normalYol = `res/mipmap-${y.ad}-v4/ic_launcher.png`;
    const yuvarlakYol = `res/mipmap-${y.ad}-v4/ic_launcher_round.png`;

    const normalPng = await sharp(Buffer.from(ikonSvgMetni(y.boyut, false))).png().toBuffer();
    const yuvarlakPng = await sharp(Buffer.from(ikonSvgMetni(y.boyut, true))).png().toBuffer();

    ikonDosyalari.push({
      yol: normalYol,
      dpi: y.dpi,
      tip: 'normal',
      metinIndeksi: genelMetinler.length,
      veri: normalPng
    });
    genelMetinler.push(normalYol);

    ikonDosyalari.push({
      yol: yuvarlakYol,
      dpi: y.dpi,
      tip: 'yuvarlak',
      metinIndeksi: genelMetinler.length,
      veri: yuvarlakPng
    });
    genelMetinler.push(yuvarlakYol);
  }

  const uygulamaAdiIndeksi = genelMetinler.length;
  genelMetinler.push(uygulamaAdi);

  const dosyaYollariIndeksi = genelMetinler.length;
  genelMetinler.push('res/xml/dosya_yollari.xml');

  const rawKayitlar = zilDosyalari.map((z) => {
    const kaynakAdi = z.ad.replace(/\.[^.]+$/, '');
    const apkYolu = `res/raw/${z.ad}`;
    const metinIndeksi = genelMetinler.length;
    genelMetinler.push(apkYolu);
    return { kaynakAdi, apkYolu, metinIndeksi, veri: z.veri };
  });

  const anahtarListesi = [
    'ic_launcher',
    'ic_launcher_round',
    'app_name',
    'dosya_yollari',
    ...rawKayitlar.map((r) => r.kaynakAdi)
  ];

  const genelMetinHavuzu = metinHavuzuOlustur(genelMetinler);
  const tipMetinHavuzu = metinHavuzuOlustur(['mipmap', 'string', 'xml', 'raw']);
  const anahtarMetinHavuzu = metinHavuzuOlustur(anahtarListesi);

  const mipmapSpec = tipSpecOlustur(1, 2);
  const mipmapBloklari = YOGUNLUKLAR.map((y) => {
    const normal = ikonDosyalari.find((i) => i.dpi === y.dpi && i.tip === 'normal');
    const yuvarlak = ikonDosyalari.find((i) => i.dpi === y.dpi && i.tip === 'yuvarlak');
    return tipVeriBlokuOlustur(1, y.dpi, [
      { anahtarIndeksi: 0, metinIndeksi: normal.metinIndeksi },
      { anahtarIndeksi: 1, metinIndeksi: yuvarlak.metinIndeksi }
    ]);
  });

  const stringSpec = tipSpecOlustur(2, 1);
  const stringBlok = tipVeriBlokuOlustur(2, 0, [
    { anahtarIndeksi: 2, metinIndeksi: uygulamaAdiIndeksi }
  ]);

  const xmlSpec = tipSpecOlustur(3, 1);
  const xmlBlok = tipVeriBlokuOlustur(3, 0, [
    { anahtarIndeksi: 3, metinIndeksi: dosyaYollariIndeksi }
  ]);

  const rawParcalari = [];
  if (rawKayitlar.length > 0) {
    rawParcalari.push(tipSpecOlustur(4, rawKayitlar.length));
    rawParcalari.push(
      tipVeriBlokuOlustur(
        4,
        0,
        rawKayitlar.map((r, idx) => ({
          anahtarIndeksi: 4 + idx,
          metinIndeksi: r.metinIndeksi
        }))
      )
    );
  }

  const paketGovdesi = Buffer.concat([
    tipMetinHavuzu,
    anahtarMetinHavuzu,
    mipmapSpec,
    ...mipmapBloklari,
    stringSpec,
    stringBlok,
    xmlSpec,
    xmlBlok,
    ...rawParcalari
  ]);

  const paketBaslikBoyutu = 288;
  const paketToplamBoyutu = paketBaslikBoyutu + paketGovdesi.length;
  const paketBasligi = Buffer.alloc(paketBaslikBoyutu);
  paketBasligi.writeUInt16LE(0x0200, 0);
  paketBasligi.writeUInt16LE(paketBaslikBoyutu, 2);
  paketBasligi.writeUInt32LE(paketToplamBoyutu, 4);
  paketBasligi.writeUInt32LE(0x7f, 8);
  Buffer.from(paketKimligi, 'utf16le').copy(paketBasligi, 12, 0, 256);

  const typeStringsOfset = paketBaslikBoyutu;
  const keyStringsOfset = paketBaslikBoyutu + tipMetinHavuzu.length;
  paketBasligi.writeUInt32LE(typeStringsOfset, 268);
  paketBasligi.writeUInt32LE(4, 272); // mipmap, string, xml, raw
  paketBasligi.writeUInt32LE(keyStringsOfset, 276);
  paketBasligi.writeUInt32LE(anahtarListesi.length, 280);
  paketBasligi.writeUInt32LE(0, 284);

  const paketBloku = Buffer.concat([paketBasligi, paketGovdesi]);
  const tabloGovdesi = Buffer.concat([genelMetinHavuzu, paketBloku]);
  const tabloBasligi = Buffer.alloc(12);
  tabloBasligi.writeUInt16LE(0x0002, 0);
  tabloBasligi.writeUInt16LE(12, 2);
  tabloBasligi.writeUInt32LE(12 + tabloGovdesi.length, 4);
  tabloBasligi.writeUInt32LE(1, 8);

  return {
    kaynakTablosu: Buffer.concat([tabloBasligi, tabloGovdesi]),
    ikonlar: ikonDosyalari.map((i) => ({ yol: i.yol, veri: i.veri })),
    rawDosyalar: rawKayitlar.map((r) => ({ yol: r.apkYolu, veri: r.veri }))
  };
}

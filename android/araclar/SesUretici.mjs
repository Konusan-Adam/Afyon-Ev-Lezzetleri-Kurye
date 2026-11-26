import fs from 'node:fs';
import path from 'node:path';

const ORNEKLEME_HIZI = 22050;

function wavTamponuOlustur(ornekler) {
  const veriBoyutu = ornekler.length * 2;
  const tampon = Buffer.alloc(44 + veriBoyutu);

  tampon.write('RIFF', 0);
  tampon.writeUInt32LE(36 + veriBoyutu, 4);
  tampon.write('WAVE', 8);
  tampon.write('fmt ', 12);
  tampon.writeUInt32LE(16, 16); // PCM
  tampon.writeUInt16LE(1, 20); // Linear PCM
  tampon.writeUInt16LE(1, 22); // Mono
  tampon.writeUInt32LE(ORNEKLEME_HIZI, 24);
  tampon.writeUInt32LE(ORNEKLEME_HIZI * 2, 28);
  tampon.writeUInt16LE(2, 32);
  tampon.writeUInt16LE(16, 34); // 16-bit
  tampon.write('data', 36);
  tampon.writeUInt32LE(veriBoyutu, 40);

  for (let i = 0; i < ornekler.length; i++) {
    const kirpilmis = Math.max(-1, Math.min(1, ornekler[i]));
    tampon.writeInt16LE(Math.round(kirpilmis * 32767), 44 + i * 2);
  }
  return tampon;
}

function tonEkle(hedef, baslangicSn, sureSn, frekans1, frekans2, genlik = 0.72, dalga = 'kare') {
  const bas = Math.floor(baslangicSn * ORNEKLEME_HIZI);
  const uzunluk = Math.floor(sureSn * ORNEKLEME_HIZI);
  for (let i = 0; i < uzunluk && bas + i < hedef.length; i++) {
    const oran = i / uzunluk;
    const t = i / ORNEKLEME_HIZI;
    const f = frekans1 + (frekans2 - frekans1) * oran;
    const zarf = Math.min(1, i / (ORNEKLEME_HIZI * 0.015)) * Math.min(1, (uzunluk - i) / (ORNEKLEME_HIZI * 0.03));
    const faz = 2 * Math.PI * f * t;
    let deger = Math.sin(faz);
    if (dalga === 'kare') {
      deger = Math.sin(faz) * 0.65 + Math.sin(3 * faz) * 0.22 + Math.sin(5 * faz) * 0.12;
    } else if (dalga === 'ucgen') {
      deger = (2 / Math.PI) * Math.asin(Math.sin(faz));
    }
    hedef[bas + i] += deger * genlik * zarf;
  }
}

export function hazirZilSesleriniOlustur(hedefDizinler) {
  const korna = new Float32Array(Math.floor(ORNEKLEME_HIZI * 1.4));
  tonEkle(korna, 0.04, 0.22, 660, 680, 0.78, 'kare');
  tonEkle(korna, 0.30, 0.26, 880, 900, 0.82, 'kare');
  tonEkle(korna, 0.68, 0.22, 660, 680, 0.78, 'kare');
  tonEkle(korna, 0.94, 0.32, 880, 920, 0.84, 'kare');

  const siren = new Float32Array(Math.floor(ORNEKLEME_HIZI * 1.6));
  tonEkle(siren, 0.02, 0.38, 620, 1240, 0.85, 'kare');
  tonEkle(siren, 0.42, 0.38, 1240, 620, 0.85, 'kare');
  tonEkle(siren, 0.82, 0.38, 620, 1240, 0.85, 'kare');
  tonEkle(siren, 1.22, 0.35, 1240, 660, 0.85, 'kare');

  const melodi = new Float32Array(Math.floor(ORNEKLEME_HIZI * 1.5));
  tonEkle(melodi, 0.04, 0.24, 523.25, 523.25, 0.72, 'ucgen');
  tonEkle(melodi, 0.30, 0.24, 659.25, 659.25, 0.72, 'ucgen');
  tonEkle(melodi, 0.56, 0.28, 783.99, 783.99, 0.76, 'ucgen');
  tonEkle(melodi, 0.88, 0.48, 1046.5, 1046.5, 0.8, 'ucgen');

  const tekUyari = new Float32Array(Math.floor(ORNEKLEME_HIZI * 1.1));
  tonEkle(tekUyari, 0.05, 0.22, 987.77, 987.77, 0.75, 'sinus');
  tonEkle(tekUyari, 0.34, 0.42, 1318.5, 1318.5, 0.8, 'sinus');

  const dosyalar = [
    { ad: 'zil_korna_klasik.wav', veri: wavTamponuOlustur(korna) },
    { ad: 'zil_acil_siren.wav', veri: wavTamponuOlustur(siren) },
    { ad: 'zil_yumusak_melodi.wav', veri: wavTamponuOlustur(melodi) },
    { ad: 'zil_tek_uyari.wav', veri: wavTamponuOlustur(tekUyari) }
  ];

  for (const dizin of hedefDizinler) {
    fs.mkdirSync(dizin, { recursive: true });
    for (const d of dosyalar) {
      fs.writeFileSync(path.join(dizin, d.ad), d.veri);
    }
  }

  return dosyalar;
}

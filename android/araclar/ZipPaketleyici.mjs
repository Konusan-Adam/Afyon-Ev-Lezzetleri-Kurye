import zlib from 'node:zlib';
import { ApkSigner, SigningKey } from 'apk_sign_ts';

function dosZamaniHesapla(tarih = new Date()) {
  const saat = tarih.getHours();
  const dakika = tarih.getMinutes();
  const saniye = Math.floor(tarih.getSeconds() / 2);
  const yil = Math.max(1980, tarih.getFullYear()) - 1980;
  const ay = tarih.getMonth() + 1;
  const gun = tarih.getDate();
  return {
    dosTime: (saat << 11) | (dakika << 5) | saniye,
    dosDate: (yil << 9) | (ay << 5) | gun
  };
}

export function zipArsiviOlustur(dosyalar) {
  const yerelParcalar = [];
  const merkezParcalar = [];
  let ofset = 0;
  const { dosTime, dosDate } = dosZamaniHesapla();

  for (const dosya of dosyalar) {
    const adTampon = Buffer.from(dosya.yol, 'utf8');
    const hamVeri = Buffer.isBuffer(dosya.veri) ? dosya.veri : Buffer.from(dosya.veri);
    const crc = zlib.crc32(hamVeri) >>> 0;

    // resources.arsc ve PNG/APK gibi dosyalar STORE (0) + 4 bayt hizalı saklanır
    const sikistirmasiz = dosya.sikistirmasiz === true;
    const sikistirilmis = sikistirmasiz ? hamVeri : zlib.deflateRawSync(hamVeri, { level: 6 });
    const yontem = sikistirmasiz ? 0 : 8;

    let ekstraUzunluk = 0;
    if (sikistirmasiz) {
      const veriOfseti = ofset + 30 + adTampon.length;
      const kalan = veriOfseti % 4;
      if (kalan !== 0) {
        ekstraUzunluk = 4 - kalan;
      }
    }

    const yerelBaslik = Buffer.alloc(30 + adTampon.length + ekstraUzunluk);
    yerelBaslik.writeUInt32LE(0x04034b50, 0);
    yerelBaslik.writeUInt16LE(20, 4); // version needed
    yerelBaslik.writeUInt16LE(0x0800, 6); // UTF-8
    yerelBaslik.writeUInt16LE(yontem, 8);
    yerelBaslik.writeUInt16LE(dosTime, 10);
    yerelBaslik.writeUInt16LE(dosDate, 12);
    yerelBaslik.writeUInt32LE(crc, 14);
    yerelBaslik.writeUInt32LE(sikistirilmis.length, 18);
    yerelBaslik.writeUInt32LE(hamVeri.length, 22);
    yerelBaslik.writeUInt16LE(adTampon.length, 26);
    yerelBaslik.writeUInt16LE(ekstraUzunluk, 28);
    adTampon.copy(yerelBaslik, 30);

    yerelParcalar.push(yerelBaslik, sikistirilmis);

    const merkezBaslik = Buffer.alloc(46 + adTampon.length);
    merkezBaslik.writeUInt32LE(0x02014b50, 0);
    merkezBaslik.writeUInt16LE(20, 4);
    merkezBaslik.writeUInt16LE(20, 6);
    merkezBaslik.writeUInt16LE(0x0800, 8);
    merkezBaslik.writeUInt16LE(yontem, 10);
    merkezBaslik.writeUInt16LE(dosTime, 12);
    merkezBaslik.writeUInt16LE(dosDate, 14);
    merkezBaslik.writeUInt32LE(crc, 16);
    merkezBaslik.writeUInt32LE(sikistirilmis.length, 20);
    merkezBaslik.writeUInt32LE(hamVeri.length, 24);
    merkezBaslik.writeUInt16LE(adTampon.length, 28);
    merkezBaslik.writeUInt16LE(0, 30);
    merkezBaslik.writeUInt16LE(0, 32);
    merkezBaslik.writeUInt16LE(0, 34);
    merkezBaslik.writeUInt16LE(0, 36);
    merkezBaslik.writeUInt32LE(0, 38);
    merkezBaslik.writeUInt32LE(ofset, 42);
    adTampon.copy(merkezBaslik, 46);
    merkezParcalar.push(merkezBaslik);

    ofset += yerelBaslik.length + sikistirilmis.length;
  }

  const merkezDizin = Buffer.concat(merkezParcalar);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(dosyalar.length, 8);
  eocd.writeUInt16LE(dosyalar.length, 10);
  eocd.writeUInt32LE(merkezDizin.length, 12);
  eocd.writeUInt32LE(ofset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...yerelParcalar, merkezDizin, eocd]);
}

export async function apkImzala({ hamApkTamponu, ozelAnahtarPem, sertifikaPem }) {
  const imzaAnahtari = SigningKey.fromPEM(ozelAnahtarPem, sertifikaPem);
  const imzalayici = new ApkSigner({
    signingKey: imzaAnahtari,
    digestAlgorithm: 'SHA-256',
    jarKeyName: 'AFYON'
  });

  const sonuc = await imzalayici.sign(new Uint8Array(hamApkTamponu));
  return {
    imzaliApk: Buffer.from(sonuc.signedApk),
    imzaBlokBoyutu: sonuc.signatureSize
  };
}

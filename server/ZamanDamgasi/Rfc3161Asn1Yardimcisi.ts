import crypto from 'crypto';

/**
 * RFC 3161 Zaman Damgası ASN.1 DER Yardımcı Modülü
 * Harici bağımlılık olmadan SHA-256 tabanlı TimeStampReq üretir
 * ve TSA sunucusundan dönen TimeStampResp (DER) yanıtını doğrular.
 */

// SHA-256 OID: 2.16.840.1.101.3.4.2.1
const SHA256_OID_BAYTLARI = Buffer.from([
  0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01
]);

function derUzunlukKodla(uzunluk: number): Buffer {
  if (uzunluk < 0x80) {
    return Buffer.from([uzunluk]);
  }
  const baytlar: number[] = [];
  let kalan = uzunluk;
  while (kalan > 0) {
    baytlar.unshift(kalan & 0xff);
    kalan >>= 8;
  }
  return Buffer.from([0x80 | baytlar.length, ...baytlar]);
}

function derTlvOlustur(tag: number, icerik: Buffer): Buffer {
  const uzunluk = derUzunlukKodla(icerik.length);
  return Buffer.concat([Buffer.from([tag]), uzunluk, icerik]);
}

function derSequence(parcalar: Buffer[]): Buffer {
  return derTlvOlustur(0x30, Buffer.concat(parcalar));
}

function derInteger(hamBaytlar: Buffer): Buffer {
  let baslangic = 0;
  while (baslangic < hamBaytlar.length - 1 && hamBaytlar[baslangic] === 0x00) {
    baslangic++;
  }
  let temiz = hamBaytlar.subarray(baslangic);
  if (temiz.length === 0) {
    temiz = Buffer.from([0x00]);
  } else if (temiz[0] >= 0x80) {
    temiz = Buffer.concat([Buffer.from([0x00]), temiz]);
  }
  return derTlvOlustur(0x02, temiz);
}

export interface Rfc3161IstekSonucu {
  istekBuffer: Buffer;
  nonceHex: string;
}

/**
 * Verilen 64 karakterlik SHA-256 hex özetinden RFC 3161 TimeStampReq DER paketi üretir.
 */
export function rfc3161IstekOlustur(sha256Hex: string): Rfc3161IstekSonucu {
  const temizHex = String(sha256Hex || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(temizHex)) {
    throw new Error('Geçersiz SHA-256 özet formatı (64 karakter hex bekleniyor).');
  }

  const ozetBuffer = Buffer.from(temizHex, 'hex');
  const nonceBaytlari = crypto.randomBytes(8);
  nonceBaytlari[0] &= 0x7f; // Pozitif tam sayı garantisi

  // version INTEGER { v1(1) }
  const versiyon = derInteger(Buffer.from([0x01]));

  // AlgorithmIdentifier ::= SEQUENCE { algorithm sha256, parameters NULL }
  const oid = derTlvOlustur(0x06, SHA256_OID_BAYTLARI);
  const nullParam = Buffer.from([0x05, 0x00]);
  const algoritma = derSequence([oid, nullParam]);

  // MessageImprint ::= SEQUENCE { hashAlgorithm, hashedMessage OCTET STRING }
  const mesajOzeti = derTlvOlustur(0x04, ozetBuffer);
  const messageImprint = derSequence([algoritma, mesajOzeti]);

  // nonce INTEGER
  const nonce = derInteger(nonceBaytlari);

  // certReq BOOLEAN TRUE (TSA sertifikasını da yanıtta döndürmek için)
  const certReq = derTlvOlustur(0x01, Buffer.from([0xff]));

  const istekBuffer = derSequence([versiyon, messageImprint, nonce, certReq]);
  return {
    istekBuffer,
    nonceHex: nonceBaytlari.toString('hex')
  };
}

interface DerEleman {
  tag: number;
  icerikBaslangic: number;
  icerikBitis: number;
  sonrakiKonum: number;
}

function derElemanOku(buf: Buffer, konum: number): DerEleman {
  if (konum + 2 > buf.length) {
    throw new Error('ASN.1 DER tamponu beklenmedik şekilde sonlandı.');
  }

  const tag = buf[konum];
  const ilkUzunluk = buf[konum + 1];
  let icerikBaslangic = konum + 2;
  let icerikUzunlugu = 0;

  if ((ilkUzunluk & 0x80) === 0) {
    icerikUzunlugu = ilkUzunluk;
  } else {
    const uzunlukBaytSayisi = ilkUzunluk & 0x7f;
    if (uzunlukBaytSayisi === 0 || uzunlukBaytSayisi > 4 || icerikBaslangic + uzunlukBaytSayisi > buf.length) {
      throw new Error('Geçersiz ASN.1 DER uzunluk bilgisi.');
    }
    for (let i = 0; i < uzunlukBaytSayisi; i++) {
      icerikUzunlugu = (icerikUzunlugu << 8) | buf[icerikBaslangic + i];
    }
    icerikBaslangic += uzunlukBaytSayisi;
  }

  const icerikBitis = icerikBaslangic + icerikUzunlugu;
  if (icerikBitis > buf.length) {
    throw new Error('ASN.1 DER içerik boyutu tampon sınırını aşıyor.');
  }

  return {
    tag,
    icerikBaslangic,
    icerikBitis,
    sonrakiKonum: icerikBitis
  };
}

export interface Rfc3161YanitSonucu {
  gecerliMi: boolean;
  durumKodu: number;
  tokenBase64?: string;
  hata?: string;
}

/**
 * TSA sunucusundan dönen DER TimeStampResp baytlarını ayrıştırır ve onay durumunu doğrular.
 */
export function rfc3161YanitDogrula(tsrBuffer: Buffer): Rfc3161YanitSonucu {
  try {
    if (!tsrBuffer || tsrBuffer.length < 10) {
      return { gecerliMi: false, durumKodu: -1, hata: 'Boş veya eksik TSR yanıtı.' };
    }

    // TimeStampResp ::= SEQUENCE
    const disSekans = derElemanOku(tsrBuffer, 0);
    if (disSekans.tag !== 0x30) {
      return { gecerliMi: false, durumKodu: -1, hata: 'TimeStampResp kök SEQUENCE bulunamadı.' };
    }

    // 1. alan: status PKIStatusInfo ::= SEQUENCE
    const pkiStatusInfo = derElemanOku(tsrBuffer, disSekans.icerikBaslangic);
    if (pkiStatusInfo.tag !== 0x30) {
      return { gecerliMi: false, durumKodu: -1, hata: 'PKIStatusInfo SEQUENCE bulunamadı.' };
    }

    // PKIStatus ::= INTEGER (0 = granted, 1 = grantedWithMods)
    const pkiStatus = derElemanOku(tsrBuffer, pkiStatusInfo.icerikBaslangic);
    if (pkiStatus.tag !== 0x02) {
      return { gecerliMi: false, durumKodu: -1, hata: 'PKIStatus INTEGER bulunamadı.' };
    }

    let durumKodu = 0;
    for (let i = pkiStatus.icerikBaslangic; i < pkiStatus.icerikBitis; i++) {
      durumKodu = (durumKodu << 8) | tsrBuffer[i];
    }

    if (durumKodu !== 0 && durumKodu !== 1) {
      return {
        gecerliMi: false,
        durumKodu,
        hata: `TSA reddetti (PKIStatus=${durumKodu}).`
      };
    }

    // 2. alan: timeStampToken ContentInfo (SEQUENCE)
    if (pkiStatusInfo.sonrakiKonum >= disSekans.icerikBitis) {
      return {
        gecerliMi: false,
        durumKodu,
        hata: 'TSA yanıtında timeStampToken eksik.'
      };
    }

    const tokenElemani = derElemanOku(tsrBuffer, pkiStatusInfo.sonrakiKonum);
    if (tokenElemani.tag !== 0x30) {
      return {
        gecerliMi: false,
        durumKodu,
        hata: 'TSA timeStampToken SEQUENCE formatında değil.'
      };
    }

    return {
      gecerliMi: true,
      durumKodu,
      tokenBase64: tsrBuffer.toString('base64')
    };
  } catch (hata: any) {
    return {
      gecerliMi: false,
      durumKodu: -1,
      hata: hata?.message || 'RFC 3161 yanıt doğrulama hatası.'
    };
  }
}

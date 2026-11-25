import fs from 'node:fs';
import path from 'node:path';
import forge from 'node-forge';
import { convertToPEM } from 'apk_sign_ts';

const VARSAYILAN_SIFRE = process.env.AFYON_KEYSTORE_SIFRE || 'afyonKurye2026!';
const VARSAYILAN_TAKMA_AD = process.env.AFYON_KEY_ALIAS || 'afyon-kurye-anahtar';

export async function imzaAnahtariniHazirla(anahtarDosyaYolu) {
  const dizin = path.dirname(anahtarDosyaYolu);
  if (!fs.existsSync(dizin)) {
    fs.mkdirSync(dizin, { recursive: true });
  }

  if (!fs.existsSync(anahtarDosyaYolu)) {
    const anahtarCifti = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });
    const sertifika = forge.pki.createCertificate();
    sertifika.publicKey = anahtarCifti.publicKey;
    sertifika.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));

    const simdi = new Date();
    const bitis = new Date(simdi);
    bitis.setFullYear(simdi.getFullYear() + 25);

    sertifika.validity.notBefore = simdi;
    sertifika.validity.notAfter = bitis;

    const ozneAlanlari = [
      { name: 'commonName', value: 'Afyon Kurye' },
      { name: 'organizationName', value: 'Afyon Ev Lezzetleri' },
      { name: 'localityName', value: 'Afyonkarahisar' },
      { name: 'countryName', value: 'TR' }
    ];
    sertifika.setSubject(ozneAlanlari);
    sertifika.setIssuer(ozneAlanlari);

    sertifika.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'subjectKeyIdentifier' }
    ]);

    sertifika.sign(anahtarCifti.privateKey, forge.md.sha256.create());

    const pkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
      anahtarCifti.privateKey,
      [sertifika],
      VARSAYILAN_SIFRE,
      {
        friendlyName: VARSAYILAN_TAKMA_AD,
        algorithm: '3des',
        generateLocalKeyId: true
      }
    );

    const pkcs12Der = forge.asn1.toDer(pkcs12Asn1).getBytes();
    fs.writeFileSync(anahtarDosyaYolu, Buffer.from(pkcs12Der, 'binary'));
  }

  const depoVerisi = new Uint8Array(fs.readFileSync(anahtarDosyaYolu));
  // convertToPEM(..., 'jks') jks-js içindeki toPem metodunu kullanır; PKCS12 ve JKS biçimlerini otomatik tanır
  const { privateKey, certificate } = await convertToPEM(depoVerisi, VARSAYILAN_SIFRE, 'jks');

  return {
    ozelAnahtarPem: privateKey,
    sertifikaPem: certificate,
    sifre: VARSAYILAN_SIFRE,
    takmaAd: VARSAYILAN_TAKMA_AD
  };
}

export interface AfyonKuryeAndroidKopru {
  oturumAyarla?: (kuryeId: string, kuryeAdi: string, rol: string) => void;
  oturumKapat?: () => void;
  zilAyarla?: (seciliKimlik: string, sesSeviyesi: number, ozelSesVeriUrl: string) => void;
  zilCal?: (baslik: string, detay: string, kesintisiz: boolean, sureSn: number) => void;
  zilSustur?: () => void;
  pilMuafiyetiVarMi?: () => boolean;
  pilOptimizasyonuIste?: () => void;
  uygulamaSurumu?: () => string;
  apkGuncelleIndirVeKur?: (indirmeUrl: string) => void;
}

export interface AndroidUygulamaBilgisi {
  paketAdi: string;
  surumAdi: string;
  surumKodu: number;
}

declare global {
  interface Window {
    AfyonKuryeAndroid?: AfyonKuryeAndroidKopru;
  }
}

function kopruGetir(): AfyonKuryeAndroidKopru | null {
  if (typeof window === 'undefined') return null;
  return window.AfyonKuryeAndroid ?? null;
}

export function androidOrtamiMi(): boolean {
  return kopruGetir() !== null;
}

export function androidOturumAyarla(kuryeId: string, kuryeAdi: string, rol: string = 'kurye'): void {
  try {
    kopruGetir()?.oturumAyarla?.(kuryeId, kuryeAdi, rol);
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidOturumKapat(): void {
  try {
    kopruGetir()?.oturumKapat?.();
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidZilAyarla(
  seciliKimlik: string,
  sesSeviyesi: number,
  ozelSesVeriUrl: string = ''
): void {
  try {
    const guvenliSeviye = Math.max(0.2, Math.min(1.0, Number(sesSeviyesi) || 0.9));
    kopruGetir()?.zilAyarla?.(seciliKimlik, guvenliSeviye, ozelSesVeriUrl);
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidZilCal(
  baslik: string,
  detay: string,
  kesintisiz: boolean = true,
  sureSn: number = 20
): void {
  try {
    kopruGetir()?.zilCal?.(baslik, detay, kesintisiz, sureSn);
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidZilSustur(): void {
  try {
    kopruGetir()?.zilSustur?.();
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidPilMuafiyetiVarMi(): boolean {
  try {
    const kopru = kopruGetir();
    if (!kopru?.pilMuafiyetiVarMi) return true;
    return Boolean(kopru.pilMuafiyetiVarMi());
  } catch {
    return true;
  }
}

export function androidPilOptimizasyonuIste(): void {
  try {
    kopruGetir()?.pilOptimizasyonuIste?.();
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidUygulamaSurumuGetir(): AndroidUygulamaBilgisi | null {
  try {
    const kopru = kopruGetir();
    if (!kopru?.uygulamaSurumu) return null;
    const ham = kopru.uygulamaSurumu();
    if (!ham) return null;
    const cozumlenmis = JSON.parse(ham);
    return {
      paketAdi: String(cozumlenmis.paketAdi || 'com.afyonevlezzetleri.kurye'),
      surumAdi: String(cozumlenmis.surumAdi || '1.0.0'),
      surumKodu: Number(cozumlenmis.surumKodu || 102)
    };
  } catch {
    return null;
  }
}

export function androidApkGuncelleIndirVeKur(indirmeUrl: string): boolean {
  try {
    const kopru = kopruGetir();
    if (!kopru?.apkGuncelleIndirVeKur) return false;
    kopru.apkGuncelleIndirVeKur(indirmeUrl);
    return true;
  } catch {
    return false;
  }
}

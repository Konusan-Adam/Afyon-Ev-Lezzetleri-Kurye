export interface AfyonKuryeAndroidKopru {
  oturumBilgisiKaydet?: (kuryeId: string, kuryeAdi: string) => void;
  oturumTemizle?: () => void;
  titre?: (sureMs: number) => void;
  sesliAlarmCal?: (baslik: string, mesaj: string) => void;
  pilMuafiyetiVarMi?: () => boolean;
  pilMuafiyetiIste?: () => void;
  uygulamaBilgisiGetir?: () => string;
  apkGuncelleIndirVeKur?: (indirmeAdresi: string, surumAdi: string) => void;
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

export function androidOturumKaydet(kuryeId: string, kuryeAdi: string): void {
  try {
    kopruGetir()?.oturumBilgisiKaydet?.(kuryeId, kuryeAdi);
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidOturumTemizle(): void {
  try {
    kopruGetir()?.oturumTemizle?.();
  } catch {
    // Tarayıcı ortamında sessiz geçiş
  }
}

export function androidTitre(sureMs: number = 450): void {
  try {
    const kopru = kopruGetir();
    if (kopru?.titre) {
      kopru.titre(sureMs);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(sureMs);
    }
  } catch {
    // Sessiz geçiş
  }
}

export function androidSesliAlarmCal(baslik: string, mesaj: string): void {
  try {
    kopruGetir()?.sesliAlarmCal?.(baslik, mesaj);
  } catch {
    // Sessiz geçiş
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

export function androidPilMuafiyetiIste(): void {
  try {
    kopruGetir()?.pilMuafiyetiIste?.();
  } catch {
    // Sessiz geçiş
  }
}

export function androidUygulamaBilgisiGetir(): AndroidUygulamaBilgisi | null {
  try {
    const kopru = kopruGetir();
    if (!kopru?.uygulamaBilgisiGetir) return null;
    const ham = kopru.uygulamaBilgisiGetir();
    if (!ham) return null;
    const cozumlenmis = JSON.parse(ham);
    return {
      paketAdi: String(cozumlenmis.paketAdi || 'com.afyonevlezzetleri.kurye'),
      surumAdi: String(cozumlenmis.surumAdi || '1.0.0'),
      surumKodu: Number(cozumlenmis.surumKodu || 100)
    };
  } catch {
    return null;
  }
}

export function androidApkGuncelleIndirVeKur(indirmeAdresi: string, surumAdi: string): boolean {
  try {
    const kopru = kopruGetir();
    if (!kopru?.apkGuncelleIndirVeKur) return false;
    kopru.apkGuncelleIndirVeKur(indirmeAdresi, surumAdi);
    return true;
  } catch {
    return false;
  }
}

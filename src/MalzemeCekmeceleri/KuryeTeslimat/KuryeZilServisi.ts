import { sekmeAlarmiBaslat, sekmeAlarmiDurdur } from '@/src/MalzemeCekmeceleri/SekmeAlarmi';
import {
  androidOrtamiMi,
  androidZilCal,
  androidZilSustur
} from '@/src/MalzemeCekmeceleri/AndroidKopru/AndroidKopruServisi';
import {
  webZilSesiCal,
  webZilSustur,
  zilAyariniYukle
} from './ZilSesiYonetimi';

export const kuryeZiliSustur = () => {
  webZilSustur();
  androidZilSustur();
  sekmeAlarmiDurdur();
};

const yedekKornaCal = (sesSeviyesi: number = 0.7) => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const sesMerkezi = new AudioContextClass();
    if (sesMerkezi.state === 'suspended') {
      sesMerkezi.resume().catch(() => {});
    }
    const simdi = sesMerkezi.currentTime;
    const guc = Math.max(0.2, Math.min(1.0, sesSeviyesi)) * 0.55;

    const osilator1 = sesMerkezi.createOscillator();
    const kazanc1 = sesMerkezi.createGain();
    osilator1.type = 'triangle';
    osilator1.frequency.setValueAtTime(750, simdi);
    kazanc1.gain.setValueAtTime(guc, simdi);
    kazanc1.gain.exponentialRampToValueAtTime(0.001, simdi + 0.25);
    osilator1.connect(kazanc1);
    kazanc1.connect(sesMerkezi.destination);
    osilator1.start(simdi);
    osilator1.stop(simdi + 0.25);

    const osilator2 = sesMerkezi.createOscillator();
    const kazanc2 = sesMerkezi.createGain();
    osilator2.type = 'triangle';
    osilator2.frequency.setValueAtTime(950, simdi + 0.2);
    kazanc2.gain.setValueAtTime(guc, simdi + 0.2);
    kazanc2.gain.exponentialRampToValueAtTime(0.001, simdi + 0.55);
    osilator2.connect(kazanc2);
    kazanc2.connect(sesMerkezi.destination);
    osilator2.start(simdi + 0.2);
    osilator2.stop(simdi + 0.55);
  } catch (hata) {
    console.warn('Kurye yedek zili çalınamadı:', hata);
  }
};

// Kurye Dağıtım Masası Sesli Korna/Zil ve Masaüstü/Telefon Bildirim Servisi
export const kuryeZiliCal = (
  baslik?: string,
  detay?: string,
  ozelSecenek?: { kesintisiz?: boolean; sureSn?: number; zorlaNative?: boolean }
) => {
  const bildirimBaslik = baslik || 'Yeni Paket Dağıtıma Hazır!';
  const bildirimDetay = detay || 'Mutfakta veya şubede paketlenen yeni sipariş kurye bekliyor.';
  const androidIcinde = androidOrtamiMi();
  const onPlanda = typeof document === 'undefined' ? true : document.visibilityState === 'visible';
  const ayar = zilAyariniYukle();

  // Çift ses çakışmasını önle:
  // Uygulama arka planda/ekran kapalıyken yalnızca Native Android alarm motoru (USAGE_ALARM) çalar;
  // ön plandayken yalnızca WebView seçili zil sesi çalar.
  if (androidIcinde && (!onPlanda || ozelSecenek?.zorlaNative)) {
    androidZilCal(
      bildirimBaslik,
      bildirimDetay,
      ozelSecenek?.kesintisiz ?? true,
      ozelSecenek?.sureSn ?? 20
    );
  } else {
    const calindi = webZilSesiCal(ayar);
    if (!calindi) {
      yedekKornaCal(ayar.sesSeviyesi);
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([300, 120, 300]);
      } catch {
        // Yoksay
      }
    }
  }

  // Sekme Başlığı Yanıp Sönen Alarm
  sekmeAlarmiBaslat('🛵 (1) YENİ PAKET HAZIR!');

  // Tarayıcı Masaüstü/SW Bildirimi (Android WebView dışında)
  if (!androidIcinde && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const bildirimSecenekleri: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body: bildirimDetay,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'afyon-kurye-paket',
      renotify: true,
      silent: false
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((kayit) => {
          kayit
            .showNotification(bildirimBaslik, {
              ...bildirimSecenekleri,
              vibrate: [350, 150, 350, 150, 350]
            } as NotificationOptions)
            .catch(() => {
              try {
                new Notification(bildirimBaslik, bildirimSecenekleri);
              } catch {
                // Yoksay
              }
            });
        })
        .catch(() => {
          try {
            new Notification(bildirimBaslik, bildirimSecenekleri);
          } catch {
            // Yoksay
          }
        });
    } else {
      try {
        const bildirim = new Notification(bildirimBaslik, bildirimSecenekleri);
        bildirim.onclick = () => {
          window.focus();
          bildirim.close();
        };
      } catch {
        // Yoksay
      }
    }
  }
};

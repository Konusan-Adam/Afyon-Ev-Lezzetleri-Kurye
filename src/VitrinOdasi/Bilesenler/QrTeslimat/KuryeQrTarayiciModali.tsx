import React, { useState } from 'react';
import { X, QrCode, KeyRound, Flashlight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useCanliKameraTarayici } from '@/src/MalzemeCekmeceleri/QrTeslimat/useCanliKameraTarayici';

export interface KuryeQrTarayiciModaliProps {
  siparisKodu: string;
  onKapat: () => void;
  onTeslimatTamamlandi: (kod: string, pin: string) => Promise<{ basarili: boolean; mesaj: string }>;
}

export const KuryeQrTarayiciModali: React.FC<KuryeQrTarayiciModaliProps> = ({
  siparisKodu,
  onKapat,
  onTeslimatTamamlandi
}) => {
  const [manuelPin, setManuelPin] = useState('');
  const [durumMesaji, setDurumMesaji] = useState<{ tip: 'basari' | 'hata'; metin: string } | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);

  const qrIsle = async (okunanVeri: string) => {
    if (isleniyor) return;
    setIsleniyor(true);
    setDurumMesaji(null);

    let pin = okunanVeri.trim();
    let kod = siparisKodu;

    try {
      // JSON formatında ise ayrıştır
      if (okunanVeri.startsWith('{') && okunanVeri.endsWith('}')) {
        const parsed = JSON.parse(okunanVeri);
        pin = parsed.pin || parsed.pinKodu || pin;
        kod = parsed.siparisKodu || parsed.siparis_kodu || kod;
      } else if (okunanVeri.includes(':')) {
        const parcalar = okunanVeri.split(':');
        pin = parcalar[parcalar.length - 1].trim();
      }

      const sonuc = await onTeslimatTamamlandi(kod, pin);
      if (sonuc.basarili) {
        setDurumMesaji({ tip: 'basari', metin: sonuc.mesaj || 'Teslimat başarıyla onaylandı!' });
        setTimeout(() => {
          onKapat();
        }, 1500);
      } else {
        setDurumMesaji({ tip: 'hata', metin: sonuc.mesaj || 'Geçersiz QR veya PIN kodu!' });
        setTimeout(() => {
          sonKoduSifirla();
          setIsleniyor(false);
        }, 2000);
      }
    } catch (err: any) {
      setDurumMesaji({ tip: 'hata', metin: err.message || 'Teslimat işleminde hata oluştu.' });
      setTimeout(() => {
        sonKoduSifirla();
        setIsleniyor(false);
      }, 2000);
    }
  };

  const {
    videoRef,
    kameraDurumu,
    hataMesaji,
    fenerDestegi,
    fenerAcik,
    feneriDegistir,
    sonKoduSifirla
  } = useCanliKameraTarayici({
    onKodBulundu: qrIsle,
    aktifMi: true
  });

  const handleManuelGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manuelPin.trim()) return;
    await qrIsle(manuelPin.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#16061B] border-2 border-purple-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Başlık */}
        <div className="px-5 py-4 bg-[#260B2E] border-b border-purple-800/60 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-amber-300">
                Müşteri QR & PIN Teslimat Doğrulama
              </h3>
              <p className="text-[11px] text-gray-400">Sipariş: #{siparisKodu}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onKapat}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Kamera ve Tarayıcı Alanı */}
        <div className="p-4 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-purple-900/60 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Tarayıcı Kılavuz Çerçevesi */}
            <div className="absolute inset-8 border-2 border-amber-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                <div className="w-4 h-4 border-t-4 border-r-4 border-amber-400" />
              </div>
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                <div className="w-4 h-4 border-b-4 border-r-4 border-amber-400" />
              </div>
            </div>

            {/* Durum / Hata Overlay */}
            {kameraDurumu === 'hata' && (
              <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center text-rose-300 text-xs">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p>{hataMesaji || 'Kamera açılamadı. Lütfen aşağıdaki alandan PIN kodunu manuel giriniz.'}</p>
              </div>
            )}

            {/* Fener Butonu */}
            {fenerDestegi && (
              <button
                type="button"
                onClick={feneriDegistir}
                className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all ${
                  fenerAcik ? 'bg-amber-500 text-black' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
                title="Feneri Aç/Kapat"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bildirim Durum Kutusu */}
          {durumMesaji && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                durumMesaji.tip === 'basari'
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/90 border-rose-500 text-rose-200'
              }`}
            >
              {durumMesaji.tip === 'basari' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{durumMesaji.metin}</span>
            </div>
          )}

          {/* Manuel PIN Girişi */}
          <div className="bg-[#210926] p-3.5 rounded-2xl border border-purple-900/60 space-y-2">
            <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Kamera Çalışmıyorsa 4 Haneli Müşteri PIN Kodunu Girin:
            </span>
            <form onSubmit={handleManuelGonder} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={manuelPin}
                onChange={(e) => setManuelPin(e.target.value)}
                placeholder="Örn: 4821"
                className="flex-1 bg-[#100313] border border-purple-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isleniyor || !manuelPin.trim()}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Onayla
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

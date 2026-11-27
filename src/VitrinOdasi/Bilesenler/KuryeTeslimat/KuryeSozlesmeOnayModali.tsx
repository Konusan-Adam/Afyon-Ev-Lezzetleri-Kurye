import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, ShieldCheck, X } from 'lucide-react';
import { useCanliSozlesmeler } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/useCanliSozlesmeler';
import {
  kuryeKayitSozlesmeleriniDamgala,
  type HukukiDelilSonucu
} from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';

export interface KuryeSozlesmeOnayModaliProps {
  kuryeId: string;
  kuryeAdi: string;
  kuryeTelefon?: string;
  onKapat: () => void;
  onOnayTamamlandi?: (sonuclar: HukukiDelilSonucu[]) => void;
}

export const KuryeSozlesmeOnayModali: React.FC<KuryeSozlesmeOnayModaliProps> = ({
  kuryeId,
  kuryeAdi,
  kuryeTelefon = '',
  onKapat,
  onOnayTamamlandi
}) => {
  const {
    sozlesmeler: dinamikSozlesmeler,
    yukleniyor: sozlesmelerYukleniyor,
    hata: sozlesmeHatasi
  } = useCanliSozlesmeler('kurye_basvuru');

  const [acikMetinTuru, setAcikMetinTuru] = useState<string | null>(null);
  const [okunanSozlesmeler, setOkunanSozlesmeler] = useState<Record<string, boolean>>({});
  const [onaylananSozlesmeler, setOnaylananSozlesmeler] = useState<Record<string, boolean>>({});
  const [damgalaniyor, setDamgalaniyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');
  const [sonuclar, setSonuclar] = useState<HukukiDelilSonucu[] | null>(null);

  const zorunluSozlesmeler = useMemo(
    () => dinamikSozlesmeler.filter((s) => s.zorunluMu !== false),
    [dinamikSozlesmeler]
  );

  const tumZorunluOnayliMi = useMemo(
    () =>
      !sozlesmelerYukleniyor &&
      dinamikSozlesmeler.length > 0 &&
      zorunluSozlesmeler.every(
        (s) => Boolean(okunanSozlesmeler[s.tur]) && Boolean(onaylananSozlesmeler[s.tur])
      ),
    [
      dinamikSozlesmeler.length,
      okunanSozlesmeler,
      onaylananSozlesmeler,
      sozlesmelerYukleniyor,
      zorunluSozlesmeler
    ]
  );

  const metniAcVeOkunduSay = (tur: string) => {
    setOkunanSozlesmeler((onceki) => ({ ...onceki, [tur]: true }));
    setAcikMetinTuru((mevcut) => (mevcut === tur ? null : tur));
  };

  const handleOnaylaVeDamgala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tumZorunluOnayliMi) {
      setHataMesaji(
        'Devam etmek için aktif tüm zorunlu sözleşmeleri açıp okuyarak işaretlemelisiniz.'
      );
      return;
    }

    const onaylananListe = dinamikSozlesmeler.filter((s) =>
      Boolean(onaylananSozlesmeler[s.tur])
    );

    setDamgalaniyor(true);
    setHataMesaji('');
    try {
      const damgaSonuclari = await kuryeKayitSozlesmeleriniDamgala({
        kullaniciKimlik: kuryeId,
        kullaniciTelefon: kuryeTelefon,
        kullaniciAdSoyad: kuryeAdi,
        sozlesmeler: onaylananListe,
        ekDetay: {
          onayKanali: 'kurye_paneli_sozlesme_modali'
        }
      });
      setSonuclar(damgaSonuclari);
      if (onOnayTamamlandi) {
        onOnayTamamlandi(damgaSonuclari);
      }
    } catch (err: any) {
      setHataMesaji(err?.message || 'Zaman damgası oluşturulurken bir hata oluştu.');
    } finally {
      setDamgalaniyor(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans">
      <div className="w-full max-w-2xl bg-[#16061B] border-2 border-[#4B1D55] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 bg-[#260B2E] border-b border-purple-800/60 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-amber-300">
                Kurye Sözleşmeleri ve Hukuki Onay
              </h3>
              <p className="text-[11px] text-purple-200/75">
                Firestore Merkezli Canlı Liste • RFC 3161 + SHA-256 Zaman Damgalı
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onKapat}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleOnaylaVeDamgala}
          className="p-5 overflow-y-auto space-y-4 text-xs text-purple-100"
        >
          {sozlesmelerYukleniyor ? (
            <div className="py-8 text-center text-purple-200/80">
              Sözleşmeler Firestore üzerinden yükleniyor...
            </div>
          ) : dinamikSozlesmeler.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#110415] border border-purple-900/60 text-center text-purple-200/80">
              {sozlesmeHatasi || 'Kurye paneli için tanımlı aktif sözleşme bulunamadı.'}
            </div>
          ) : (
            dinamikSozlesmeler.map((sozlesme) => {
              const acik = acikMetinTuru === sozlesme.tur;
              const okundu = Boolean(okunanSozlesmeler[sozlesme.tur]);
              const onayli = Boolean(onaylananSozlesmeler[sozlesme.tur]);

              return (
                <div
                  key={sozlesme.tur}
                  className="p-3.5 rounded-2xl bg-[#110415] border border-purple-900/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>{sozlesme.baslik}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-300 font-mono">
                        v{sozlesme.versiyon}
                      </span>
                      <button
                        type="button"
                        onClick={() => metniAcVeOkunduSay(sozlesme.tur)}
                        className="px-2.5 py-1 rounded-lg bg-[#2A0E33] hover:bg-[#3A1447] text-amber-300 font-bold text-[10px] border border-[#562163] cursor-pointer"
                      >
                        {acik ? 'Gizle' : okundu ? 'Tekrar Oku ✓' : 'Metni Oku'}
                      </button>
                    </div>
                  </div>

                  {acik && (
                    <pre className="whitespace-pre-wrap font-sans text-[11px] text-purple-100/85 max-h-44 overflow-y-auto leading-relaxed bg-black/30 p-3 rounded-xl border border-purple-950">
                      {sozlesme.icerik}
                    </pre>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer pt-1 text-white font-semibold">
                    <input
                      type="checkbox"
                      checked={onayli}
                      onChange={(e) => {
                        if (!okundu) {
                          metniAcVeOkunduSay(sozlesme.tur);
                          return;
                        }
                        setOnaylananSozlesmeler((onceki) => ({
                          ...onceki,
                          [sozlesme.tur]: e.target.checked
                        }));
                      }}
                      className="accent-amber-500 w-4 h-4 mt-0.5 rounded shrink-0"
                    />
                    <span>
                      {sozlesme.kisaBaslik || sozlesme.baslik} metnini okudum, kabul ediyorum.{' '}
                      <span className="text-[10px] text-amber-300">
                        {sozlesme.zorunluMu !== false ? '(Zorunlu)' : '(İsteğe Bağlı)'}
                      </span>
                    </span>
                  </label>
                </div>
              );
            })
          )}

          {hataMesaji && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 font-semibold">
              {hataMesaji}
            </div>
          )}

          {sonuclar && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Hukuki Onaylar Zaman Damgası ile Mühürlendi</span>
              </div>
              {sonuclar.map((s) => (
                <div
                  key={s.log.kimlik}
                  className="p-2 rounded-xl bg-black/35 border border-emerald-900/50 space-y-0.5"
                >
                  <div className="flex justify-between text-white font-bold">
                    <span>{s.log.sozlesmeTuru}</span>
                    <span className="text-amber-300">{s.log.damgaDurumu}</span>
                  </div>
                  <div className="text-purple-200/75 font-mono truncate">
                    TSA: {s.log.tsaSaglayici || 'yerel'} • IP: {s.log.ipAdresi}
                  </div>
                  {s.log.ozetHash && (
                    <div className="text-purple-200/75 font-mono truncate">
                      SHA-256: {s.log.ozetHash}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onKapat}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 font-semibold cursor-pointer transition-colors"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={damgalaniyor || !tumZorunluOnayliMi}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#180A1F] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {damgalaniyor
                ? 'Zaman Damgası Alınıyor...'
                : 'Onayla ve Zaman Damgasıyla Mühürle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

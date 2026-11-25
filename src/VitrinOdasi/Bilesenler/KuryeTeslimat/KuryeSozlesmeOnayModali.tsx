import React, { useState } from 'react';
import { CheckCircle2, FileText, ShieldCheck, X } from 'lucide-react';
import { hukukiSozlesmeleriGetir } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukDeposu';
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
  const sozlesmeler = hukukiSozlesmeleriGetir();
  const kuryeSozlesmesi = sozlesmeler.kurye_kayit_sozlesmesi;
  const kvkkSozlesmesi = sozlesmeler.kvkk_aydinlatma;

  const [tasimaOnayli, setTasimaOnayli] = useState(false);
  const [kvkkOnayli, setKvkkOnayli] = useState(false);
  const [damgalaniyor, setDamgalaniyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');
  const [sonuclar, setSonuclar] = useState<HukukiDelilSonucu[] | null>(null);

  const handleOnaylaVeDamgala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tasimaOnayli || !kvkkOnayli) {
      setHataMesaji('Devam etmek için her iki sözleşme onay kutusunu işaretlemelisiniz.');
      return;
    }

    setDamgalaniyor(true);
    setHataMesaji('');
    try {
      const damgaSonuclari = await kuryeKayitSozlesmeleriniDamgala({
        kullaniciKimlik: kuryeId,
        kullaniciTelefon: kuryeTelefon,
        kullaniciAdSoyad: kuryeAdi,
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
                Kurye Taşıma Sözleşmesi ve KVKK Onayı
              </h3>
              <p className="text-[11px] text-purple-200/75">
                RFC 3161 + SHA-256 Zaman Damgalı Hukuki Delil Kaydı
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

        <form onSubmit={handleOnaylaVeDamgala} className="p-5 overflow-y-auto space-y-4 text-xs text-purple-100">
          {/* Kurye Taşıma Sözleşmesi */}
          <div className="p-3.5 rounded-2xl bg-[#110415] border border-purple-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {kuryeSozlesmesi?.baslik || 'Kurye Taşıma ve Bağımsız Hizmet Sözleşmesi'}
              </span>
              <span className="text-[10px] text-purple-300 font-mono">v{kuryeSozlesmesi?.versiyon || '1.0.0'}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-purple-100/85 max-h-36 overflow-y-auto leading-relaxed bg-black/30 p-2.5 rounded-xl border border-purple-950">
              {kuryeSozlesmesi?.icerik}
            </pre>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-white font-semibold">
              <input
                type="checkbox"
                checked={tasimaOnayli}
                onChange={(e) => setTasimaOnayli(e.target.checked)}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <span>Kurye Taşıma ve Bağımsız Hizmet Sözleşmesini okudum, kabul ediyorum.</span>
            </label>
          </div>

          {/* KVKK Aydınlatma Metni */}
          <div className="p-3.5 rounded-2xl bg-[#110415] border border-purple-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {kvkkSozlesmesi?.baslik || 'KVKK Aydınlatma ve Açık Rıza Metni'}
              </span>
              <span className="text-[10px] text-purple-300 font-mono">v{kvkkSozlesmesi?.versiyon || '1.0.0'}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-purple-100/85 max-h-32 overflow-y-auto leading-relaxed bg-black/30 p-2.5 rounded-xl border border-purple-950">
              {kvkkSozlesmesi?.icerik}
            </pre>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-white font-semibold">
              <input
                type="checkbox"
                checked={kvkkOnayli}
                onChange={(e) => setKvkkOnayli(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 rounded"
              />
              <span>KVKK Aydınlatma Metnini okudum, kişisel verilerimin işlenmesini onaylıyorum.</span>
            </label>
          </div>

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
                <div key={s.log.kimlik} className="p-2 rounded-xl bg-black/35 border border-emerald-900/50 space-y-0.5">
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
              disabled={damgalaniyor}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#180A1F] font-black cursor-pointer disabled:opacity-50 transition-all shadow-sm"
            >
              {damgalaniyor ? 'Zaman Damgası Alınıyor...' : 'Onayla ve Zaman Damgasıyla Mühürle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

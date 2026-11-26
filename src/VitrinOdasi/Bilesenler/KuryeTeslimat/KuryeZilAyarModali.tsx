import React, { useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Music,
  Play,
  Square,
  Trash2,
  Upload,
  Volume2,
  X
} from 'lucide-react';
import {
  HAZIR_ZIL_SESLERI,
  KuryeZilAyari,
  webZilSesiCal,
  webZilSustur,
  zilAyariniKaydetVeSenkronizeEt,
  zilAyariniYukle
} from '@/src/MalzemeCekmeceleri/KuryeTeslimat/ZilSesiYonetimi';
import { androidZilSustur } from '@/src/MalzemeCekmeceleri/AndroidKopru/AndroidKopruServisi';

interface KuryeZilAyarModaliProps {
  onKapat: () => void;
  onKaydedildi?: (ayar: KuryeZilAyari) => void;
}

const MAKS_SES_DOSYA_BOYUTU = 1500 * 1024; // 1.5 MB

export const KuryeZilAyarModali: React.FC<KuryeZilAyarModaliProps> = ({
  onKapat,
  onKaydedildi
}) => {
  const [ayar, setAyar] = useState<KuryeZilAyari>(() => zilAyariniYukle());
  const [calinanKimlik, setCalinanKimlik] = useState<string | null>(null);
  const [hataMesaji, setHataMesaji] = useState('');
  const dosyaGirdiRef = useRef<HTMLInputElement | null>(null);

  const testCal = (hedefKimlik: string, guncelAyar: KuryeZilAyari = ayar) => {
    if (calinanKimlik === hedefKimlik) {
      webZilSustur();
      androidZilSustur();
      setCalinanKimlik(null);
      return;
    }
    setHataMesaji('');
    const testAyar: KuryeZilAyari = {
      ...guncelAyar,
      seciliKimlik: hedefKimlik
    };
    webZilSesiCal(testAyar);
    setCalinanKimlik(hedefKimlik);
    setTimeout(() => {
      setCalinanKimlik((mevcut) => (mevcut === hedefKimlik ? null : mevcut));
    }, 2200);
  };

  const ozelSesSecildi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHataMesaji('');

    const gecerliTip = /\.(mp3|wav|ogg|m4a)$/i.test(dosya.name) || dosya.type.startsWith('audio/');
    if (!gecerliTip) {
      setHataMesaji('Lütfen geçerli bir .mp3, .wav veya .ogg ses dosyası seçiniz.');
      return;
    }
    if (dosya.size > MAKS_SES_DOSYA_BOYUTU) {
      setHataMesaji('Özel zil sesi dosyası en fazla 1.5 MB olabilir.');
      return;
    }

    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      const veriUrl = typeof okuyucu.result === 'string' ? okuyucu.result : '';
      if (!veriUrl) {
        setHataMesaji('Ses dosyası okunamadı.');
        return;
      }
      const guncel: KuryeZilAyari = {
        ...ayar,
        seciliKimlik: 'ozel',
        ozelSesAdi: dosya.name,
        ozelSesVeriUrl: veriUrl
      };
      setAyar(guncel);
      testCal('ozel', guncel);
    };
    okuyucu.readAsDataURL(dosya);
  };

  const ozelSesiKaldir = () => {
    webZilSustur();
    setAyar((onceki) => ({
      ...onceki,
      seciliKimlik: onceki.seciliKimlik === 'ozel' ? 'korna_klasik' : onceki.seciliKimlik,
      ozelSesAdi: '',
      ozelSesVeriUrl: ''
    }));
  };

  const kaydetVeKapat = () => {
    webZilSustur();
    androidZilSustur();
    const kaydedilen = zilAyariniKaydetVeSenkronizeEt(ayar);
    onKaydedildi?.(kaydedilen);
    onKapat();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#16061B] border border-[#4B1D55] rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Başlık */}
        <div className="px-5 py-4 bg-[#220929] border-b border-[#3E1646] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-extrabold text-white">Zil Sesi Seç & Ekle</h3>
              <p className="text-[11px] text-purple-200/75">
                Ekran kapalıyken çalacak Android alarm sesini seçin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              webZilSustur();
              onKapat();
            }}
            className="w-8 h-8 rounded-xl bg-[#140519] hover:bg-[#34123F] border border-[#4B1D55] text-purple-200 flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {hataMesaji && (
            <div className="p-2.5 rounded-xl bg-rose-950/75 border border-rose-700/60 text-rose-200 text-xs font-semibold">
              {hataMesaji}
            </div>
          )}

          {/* Hazır Melodi Listesi */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
              Hazır Kurye Alarmları
            </span>
            <div className="space-y-2">
              {HAZIR_ZIL_SESLERI.map((zil) => {
                const secili = ayar.seciliKimlik === zil.kimlik;
                const caliyor = calinanKimlik === zil.kimlik;
                return (
                  <div
                    key={zil.kimlik}
                    onClick={() => setAyar((o) => ({ ...o, seciliKimlik: zil.kimlik }))}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      secili
                        ? 'bg-[#2B1032] border-amber-400/70 shadow-md'
                        : 'bg-[#1D0A20] border-[#3E1646] hover:border-purple-700/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          secili
                            ? 'bg-amber-500 text-[#18071C]'
                            : 'bg-[#120614] text-purple-300 border border-[#3E1646]'
                        }`}
                      >
                        {secili ? <CheckCircle2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{zil.ad}</div>
                        <div className="text-[10px] text-purple-200/70 truncate">{zil.aciklama}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        testCal(zil.kimlik);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-all ${
                        caliyor
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#120614] hover:bg-[#34123F] border border-[#4B1D55] text-amber-300'
                      }`}
                    >
                      {caliyor ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      <span>{caliyor ? 'Dur' : 'Dinle'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cihazdan Özel Ses Yükleme */}
          <div className="p-3.5 rounded-2xl bg-[#1D0A20] border border-[#3E1646] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">Telefondan Özel Zil Sesi Ekle</span>
              <span className="text-[10px] text-purple-300/75">.mp3 / .wav / .ogg</span>
            </div>

            <input
              ref={dosyaGirdiRef}
              type="file"
              accept=".mp3,.wav,.ogg,audio/*"
              onChange={ozelSesSecildi}
              className="hidden"
            />

            {ayar.ozelSesVeriUrl ? (
              <div
                onClick={() => setAyar((o) => ({ ...o, seciliKimlik: 'ozel' }))}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                  ayar.seciliKimlik === 'ozel'
                    ? 'bg-emerald-950/50 border-emerald-500/60'
                    : 'bg-[#120614] border-purple-900/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-300 truncate">
                    {ayar.ozelSesAdi || 'Özel Zil Sesi'}
                  </div>
                  <div className="text-[10px] text-purple-200/70">
                    {ayar.seciliKimlik === 'ozel' ? 'Aktif özel alarm sesi' : 'Kullanmak için seçin'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      testCal('ozel');
                    }}
                    className="px-2 py-1 rounded-lg bg-[#260E2A] border border-[#4B1D55] text-amber-300 text-[11px] font-bold cursor-pointer"
                  >
                    {calinanKimlik === 'ozel' ? 'Dur' : 'Dinle'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      ozelSesiKaldir();
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 cursor-pointer"
                    title="Özel sesi kaldır"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => dosyaGirdiRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-xl bg-[#260E2A] hover:bg-[#321238] border border-dashed border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>{ayar.ozelSesVeriUrl ? 'Farklı Ses Dosyası Seç' : 'Cihazdan Ses Dosyası Yükle'}</span>
            </button>
          </div>

          {/* Ses Seviyesi Çubuğu */}
          <div className="p-3.5 rounded-2xl bg-[#1D0A20] border border-[#3E1646] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-purple-100 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Alarm Ses Seviyesi</span>
              </span>
              <span className="font-mono font-extrabold text-amber-300">
                %{Math.round(ayar.sesSeviyesi * 100)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={ayar.sesSeviyesi}
              onChange={(e) =>
                setAyar((o) => ({ ...o, sesSeviyesi: parseFloat(e.target.value) }))
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Alt Aksiyonlar */}
        <div className="px-5 py-3.5 bg-[#120614] border-t border-[#3E1646] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              webZilSustur();
              onKapat();
            }}
            className="px-4 py-2 rounded-xl bg-[#260E2A] hover:bg-[#321238] border border-[#4B1D55] text-purple-200 text-xs font-semibold cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={kaydetVeKapat}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#18071C] text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer"
          >
            Kaydet ve Uygula
          </button>
        </div>
      </div>
    </div>
  );
};

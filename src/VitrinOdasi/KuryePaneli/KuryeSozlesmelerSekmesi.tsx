import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileCode2,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X
} from 'lucide-react';
import { hukukiSozlesmeleriGetir } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukDeposu';
import {
  kuryeKayitSozlesmeleriniDamgala,
  kuryeOnayLoglariniGetir,
  muhurluHtmlBelgeIndir,
  tsrDosyasiIndir
} from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';
import type { HukukiIslemTuru, HukukiOnayLogu } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/tipler';

export interface KuryeSozlesmelerSekmesiProps {
  kuryeId: string;
  kuryeAdi: string;
  kuryeTelefon?: string;
  onBilgiMesaji?: (mesaj: string) => void;
}

const ZORUNLU_KURYE_SOZLESMELERI = [
  'kurye_kayit_sozlesmesi',
  'kvkk_aydinlatma',
  'kurye_ehliyet_arac_beyani'
] as const;

function islemTuruEtiketi(tur: HukukiIslemTuru | string): string {
  switch (tur) {
    case 'kayit':
      return 'Kurye Kayıt & Taahhüt';
    case 'ozel_onay':
      return 'Paket Teslim Alma';
    case 'teslimat':
      return 'Müşteriye Teslimat (PIN/QR)';
    case 'iptal':
      return 'Kurye Sipariş İptal Beyanı';
    case 'hakedis':
      return 'Hakediş / Çekim Talebi';
    default:
      return tur;
  }
}

function damgaDurumuRozeti(durum?: string): { etiket: string; sinif: string } {
  if (durum === 'rfc3161_onayli') {
    return {
      etiket: 'RFC 3161 TSA Onaylı',
      sinif: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    };
  }
  if (durum === 'sunucu_muhurlu') {
    return {
      etiket: 'Sunucu HMAC Mühürlü',
      sinif: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
    };
  }
  return {
    etiket: 'Yerel SHA-256 Özet',
    sinif: 'bg-purple-500/15 text-purple-200 border-purple-500/40'
  };
}

export const KuryeSozlesmelerSekmesi: React.FC<KuryeSozlesmelerSekmesiProps> = ({
  kuryeId,
  kuryeAdi,
  kuryeTelefon = '',
  onBilgiMesaji
}) => {
  const sozlesmeler = useMemo(() => hukukiSozlesmeleriGetir(), []);
  const [loglar, setLoglar] = useState<HukukiOnayLogu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [damgalananTur, setDamgalananTur] = useState<string | null>(null);
  const [okunanSozlesmeTuru, setOkunanSozlesmeTuru] = useState<string | null>(null);

  const loglariYenile = useCallback(async () => {
    setYukleniyor(true);
    try {
      const kayitlar = await kuryeOnayLoglariniGetir(kuryeId, kuryeTelefon);
      setLoglar(kayitlar);
    } finally {
      setYukleniyor(false);
    }
  }, [kuryeId, kuryeTelefon]);

  useEffect(() => {
    loglariYenile();
  }, [loglariYenile]);

  const onayHaritasi = useMemo(() => {
    const harita = new Map<string, HukukiOnayLogu>();
    for (const log of loglar) {
      if (log.onaylandiMi && !harita.has(log.sozlesmeTuru)) {
        harita.set(log.sozlesmeTuru, log);
      }
    }
    return harita;
  }, [loglar]);

  const eksikSozlesmeler = useMemo(
    () => ZORUNLU_KURYE_SOZLESMELERI.filter((tur) => !onayHaritasi.has(tur)),
    [onayHaritasi]
  );

  const tekSozlesmeDamgala = async (sozlesmeTurleri: string[]) => {
    if (sozlesmeTurleri.length === 0) return;
    setDamgalananTur(sozlesmeTurleri.length === 1 ? sozlesmeTurleri[0] : '__hepsi__');
    try {
      await kuryeKayitSozlesmeleriniDamgala({
        kullaniciKimlik: kuryeId,
        kullaniciTelefon: kuryeTelefon,
        kullaniciAdSoyad: kuryeAdi,
        sozlesmeTurleri,
        ekDetay: {
          onayKanali: 'kurye_sozlesmelerim_sekmesi'
        }
      });
      await loglariYenile();
      if (onBilgiMesaji) {
        onBilgiMesaji('Sözleşme onayı RFC 3161 + SHA-256 zaman damgası ile mühürlendi.');
      }
    } finally {
      setDamgalananTur(null);
    }
  };

  const okunanSozlesme = okunanSozlesmeTuru ? sozlesmeler[okunanSozlesmeTuru] : null;

  return (
    <div className="space-y-5 font-sans">
      {/* Üst Başlık ve Eksik Sözleşme Uyarısı */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#180A1F] border border-[#3E1646] space-y-3 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-[#180A1F] flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white">
                Onaylanan Sözleşmelerim &amp; Hukuki Deliller
              </h2>
              <p className="text-[11px] text-purple-200/75">
                Tüm kurye sözleşmelerinizi okuyabilir, mühürlü HTML belgenizi ve .tsr dosyanızı indirebilirsiniz.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loglariYenile}
            disabled={yukleniyor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#240B2C] hover:bg-[#34123F] border border-[#4D1E57] text-purple-200 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${yukleniyor ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        {eksikSozlesmeler.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-950/55 border border-amber-500/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Hesabınızda henüz zaman damgalanmamış{' '}
                <strong>{eksikSozlesmeler.length}</strong> zorunlu kurye sözleşmesi bulunuyor.
              </span>
            </div>
            <button
              type="button"
              disabled={damgalananTur !== null}
              onClick={() => tekSozlesmeDamgala([...eksikSozlesmeler])}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#180A1F] font-black text-xs shrink-0 cursor-pointer disabled:opacity-50"
            >
              {damgalananTur === '__hepsi__' ? 'Damgalanıyor...' : 'Tüm Eksikleri Tek Tuşla Damgala'}
            </button>
          </div>
        )}
      </div>

      {/* 3 Zorunlu Kurye Sözleşmesi Kartları */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-300/80 px-1">
          Zorunlu Kurye Sözleşmeleri
        </h3>

        {ZORUNLU_KURYE_SOZLESMELERI.map((tur) => {
          const sozlesme = sozlesmeler[tur];
          const kayit = onayHaritasi.get(tur);
          const rozet = kayit ? damgaDurumuRozeti(kayit.damgaDurumu) : null;

          return (
            <div
              key={tur}
              className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646] space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">
                      {sozlesme?.baslik || tur}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300/75">
                      v{sozlesme?.versiyon || '1.0.0'}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/70">
                    {kayit
                      ? `Onay Zamanı: ${kayit.sunucuUtc || kayit.tarihSaat} • IP: ${kayit.ipAdresi}`
                      : 'Bu sözleşme için henüz zaman damgalı onay kaydı bulunamadı.'}
                  </p>
                </div>

                {rozet ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${rozet.sinif}`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{rozet.etiket}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-rose-500/15 text-rose-300 border-rose-500/40">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Eksik / Onaysız</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOkunanSozlesmeTuru(tur)}
                  className="px-3 py-1.5 rounded-xl bg-[#270F30] hover:bg-[#351541] border border-[#4D1E57] text-purple-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Sözleşmeyi Oku</span>
                </button>

                {kayit ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        muhurluHtmlBelgeIndir(kayit, sozlesme?.baslik, sozlesme?.icerik)
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Mühürlü Belge (.html)</span>
                    </button>

                    {kayit.tsaTokenBase64 && (
                      <button
                        type="button"
                        onClick={() => {
                          const ok = tsrDosyasiIndir(kayit);
                          if (ok && onBilgiMesaji) {
                            onBilgiMesaji('RFC 3161 .tsr zaman damgası dosyası indirildi.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                        <span>.tsr Dosyası İndir</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={damgalananTur !== null}
                    onClick={() => tekSozlesmeDamgala([tur])}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#180A1F] text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{damgalananTur === tur ? 'Damgalanıyor...' : 'Tek Tuşla Onayla & Damgala'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tüm İşlem & Teslimat Zaman Damgaları */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-300/80">
            Zaman Damgalı İşlem Geçmişim ({loglar.length})
          </h3>
        </div>

        {yukleniyor ? (
          <div className="p-6 rounded-2xl bg-[#180A1F] border border-[#3E1646] text-center text-xs text-purple-200/75">
            Hukuki zaman damgası kayıtları yükleniyor...
          </div>
        ) : loglar.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#180A1F] border border-[#3E1646] text-center text-xs text-purple-200/75">
            Henüz kayıtlı zaman damgalı işleminiz bulunmuyor.
          </div>
        ) : (
          <div className="space-y-2.5">
            {loglar.map((log) => {
              const rozet = damgaDurumuRozeti(log.damgaDurumu);
              const eslesenSozlesme = sozlesmeler[log.sozlesmeTuru];
              return (
                <div
                  key={log.kimlik}
                  className="p-3.5 rounded-2xl bg-[#180A1F] border border-[#3E1646] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">
                        {islemTuruEtiketi(log.islemTuru)}
                      </span>
                      {log.ilgiliKayitId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#240B2C] text-amber-300 border border-[#4B1D55]">
                          #{log.ilgiliKayitId}
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rozet.sinif}`}>
                      {rozet.etiket}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-purple-200/75 font-mono">
                    <span className="truncate">UTC: {log.sunucuUtc || log.tarihSaat}</span>
                    <span className="truncate">IP: {log.ipAdresi}</span>
                    {log.ozetHash && (
                      <span className="truncate sm:col-span-2">SHA-256: {log.ozetHash}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        muhurluHtmlBelgeIndir(
                          log,
                          eslesenSozlesme?.baslik || islemTuruEtiketi(log.islemTuru),
                          eslesenSozlesme?.icerik
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/35 text-emerald-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Mühürlü Belge (.html)</span>
                    </button>

                    {log.tsaTokenBase64 && (
                      <button
                        type="button"
                        onClick={() => tsrDosyasiIndir(log)}
                        className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/35 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FileCode2 className="w-3 h-3" />
                        <span>.tsr Dosyası</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sözleşme Metni Okuma Modalı */}
      {okunanSozlesme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#180A1F] border-2 border-[#4B1D55] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-[#260B2E] border-b border-purple-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="font-bold text-sm text-white truncate">{okunanSozlesme.baslik}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOkunanSozlesmeTuru(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-xs text-purple-100 leading-relaxed bg-[#110415] p-4 rounded-2xl border border-[#3E1646]">
                {okunanSozlesme.icerik}
              </pre>
            </div>
            <div className="px-5 py-3 bg-[#120616] border-t border-[#3E1646] flex justify-end">
              <button
                type="button"
                onClick={() => setOkunanSozlesmeTuru(null)}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#180A1F] text-xs font-black cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

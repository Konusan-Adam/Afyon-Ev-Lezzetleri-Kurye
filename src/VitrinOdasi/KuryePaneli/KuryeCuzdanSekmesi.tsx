import React, { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Building,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Coins,
  ShieldCheck,
  Send,
  Bike,
  Award
} from 'lucide-react';
import { useCanliHakedisTalepleri } from '@/src/MalzemeCekmeceleri/useCanliHakedisTalepleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeKaydet } from '@/src/veritabani/FirebaseKoleksiyonServisi';

interface KuryeCuzdanSekmesiProps {
  kuryeId?: string;
  kuryeAdi?: string;
  aktifKullanici?: any;
  teslimEdilenler?: any[];
}

export const KuryeCuzdanSekmesi: React.FC<KuryeCuzdanSekmesiProps> = ({
  kuryeId = 'kurye-1',
  kuryeAdi = 'Kurye',
  aktifKullanici,
  teslimEdilenler = []
}) => {
  const { talepler, yeniTalepOlustur } = useCanliHakedisTalepleri();

  // IBAN Bilgileri (Kuryenin kendi profili veya boş)
  const [hesapSahibi, setHesapSahibi] = useState(aktifKullanici?.ad_soyad || kuryeAdi || '');
  const [bankaAdi, setBankaAdi] = useState(aktifKullanici?.banka_adi || 'Ziraat Bankası');
  const [iban, setIban] = useState(aktifKullanici?.iban || '');
  const [ibanDuzenlemeModu, setIbanDuzenlemeModu] = useState(!aktifKullanici?.iban);

  // Çekim Talebi Formu
  const [cekimTutari, setCekimTutari] = useState<number | ''>('');
  const [islemBasarili, setIslemBasarili] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');
  const [, setGuncellemeSayaci] = useState(0);

  // Paket Başı Prim: 45 ₺
  const paketBasiUcret = 45;
  const tamamlananTeslimatSayisi = (teslimEdilenler && teslimEdilenler.length > 0)
    ? teslimEdilenler.length
    : (aktifKullanici?.tamamlanan_siparis || aktifKullanici?.toplam_teslimat || 0);

  const bugunKazanc = tamamlananTeslimatSayisi * paketBasiUcret;

  // Gerçek Hak Edilen Kazanç: Kullanıcı bakiyesi tanımlıysa veya teslimat adedi üzerinden
  const toplamHakEdilen = typeof aktifKullanici?.bakiye === 'number' && aktifKullanici.bakiye > 0
    ? aktifKullanici.bakiye
    : bugunKazanc;

  // Canlı Kurye Çekim Talepleri
  const kuryeTalepleri = talepler.filter(
    (t) => t.kurye_id === kuryeId || (t.rol_tipi === 'kurye' && t.kurye_adi === kuryeAdi)
  );

  const odenenToplam = kuryeTalepleri
    .filter((t) => t.durum === 'odendi')
    .reduce((acc, t) => acc + t.tutar, 0);

  const bekleyenToplam = kuryeTalepleri
    .filter((t) => t.durum === 'beklemede')
    .reduce((acc, t) => acc + t.tutar, 0);

  // Çekilebilir net bakiye (Yeni kuryede teslimatı yoksa kesinlikle 0 TL)
  const cekilebilirNetBakiye = Math.max(0, toplamHakEdilen - odenenToplam - bekleyenToplam);

  const ibanKaydet = async () => {
    setIbanDuzenlemeModu(false);
    if (kuryeId && canliFirebaseAktifMi()) {
      try {
        await belgeKaydet('kullanicilar', kuryeId, {
          iban: iban.trim(),
          banka_adi: bankaAdi.trim(),
          hesap_sahibi: hesapSahibi.trim()
        });
      } catch (err) {
        console.warn('IBAN kaydetme hatası:', err);
      }
    }
  };

  const talepGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji('');

    if (!cekimTutari || Number(cekimTutari) <= 0) {
      setHataMesaji('Lütfen geçerli bir çekim tutarı yazınız.');
      return;
    }
    if (Number(cekimTutari) < 300) {
      setHataMesaji('Minimum kurye prim çekim tutarı 300 ₺\'dir.');
      return;
    }
    if (Number(cekimTutari) > cekilebilirNetBakiye) {
      setHataMesaji(`Çekilebilir bakiyenizden (${cekilebilirNetBakiye} ₺) fazla tutar talep edemezsiniz.`);
      return;
    }
    if (!iban.trim() || !hesapSahibi.trim()) {
      setHataMesaji('Lütfen geçerli bir IBAN ve Hesap Sahibi adı giriniz.');
      return;
    }

    const yeniTalepId = `hak-kurye-${Date.now()}`;
    await yeniTalepOlustur({
      id: yeniTalepId,
      rol_tipi: 'kurye',
      kurye_id: kuryeId,
      kurye_adi: kuryeAdi,
      kurye_telefon: aktifKullanici?.telefon || '',
      mutfak_id: '',
      mutfak_adi: kuryeAdi,
      tutar: Number(cekimTutari),
      iban: iban.trim(),
      hesap_sahibi: hesapSahibi.trim(),
      banka_adi: bankaAdi.trim(),
      talep_tarihi: new Date().toLocaleString('tr-TR'),
      durum: 'beklemede'
    });

    setCekimTutari('');
    setIslemBasarili(true);
    setGuncellemeSayaci((s) => s + 1);
    setTimeout(() => setIslemBasarili(false), 4000);
  };

  return (
    <div className="space-y-6 font-sans text-white">
      
      {/* 4 Ana Finansal Gösterge Kartı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Çekilebilir Bakiye */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-[#180A1F] to-[#120614] border border-emerald-500/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200">Çekilebilir Kurye Bakiyesi</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {cekilebilirNetBakiye.toLocaleString('tr-TR')} ₺
          </div>
          <p className="text-[10px] text-emerald-200/75 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Banka hesabına aktarılmaya hazır</span>
          </p>
        </div>

        {/* Bugün Teslim Edilen & Kazanç */}
        <div className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-200">Teslimat Kazancı</span>
            <div className="w-8 h-8 rounded-xl bg-purple-900/40 text-purple-300 flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {bugunKazanc.toLocaleString('tr-TR')} ₺
          </div>
          <p className="text-[10px] text-purple-200/70 mt-1">
            {tamamlananTeslimatSayisi} Paket Teslim Edildi (45 ₺ / Paket)
          </p>
        </div>

        {/* Toplam Kazanılan Prim */}
        <div className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">Toplam Kazanılan Prim</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {toplamHakEdilen.toLocaleString('tr-TR')} ₺
          </div>
          <p className="text-[10px] text-purple-200/70 mt-1">{tamamlananTeslimatSayisi} Paket teslimatı yapıldı</p>
        </div>

        {/* Bugüne Kadar Ödenen */}
        <div className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300">Hesabıma Yatan Toplam</span>
            <div className="w-8 h-8 rounded-xl bg-purple-900/40 text-purple-300 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-100 mt-2 font-mono">
            {odenenToplam.toLocaleString('tr-TR')} ₺
          </div>
          <p className="text-[10px] text-purple-200/70 mt-1">
            Bekleyen: <strong className="text-amber-300 font-mono">{bekleyenToplam.toLocaleString('tr-TR')} ₺</strong>
          </p>
        </div>
      </div>

      {/* Sol = IBAN & Çekim Formu, Sağ = Çekim Geçmişi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Sol Kolon (5 Kolon) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Kayıtlı Banka & IBAN Kartı */}
          <div className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h4 className="font-sans text-xs font-bold text-white">Kayıtlı Banka & IBAN Bilgim</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (ibanDuzenlemeModu) {
                    ibanKaydet();
                  } else {
                    setIbanDuzenlemeModu(true);
                  }
                }}
                className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
              >
                {ibanDuzenlemeModu ? 'Kaydet' : 'Değiştir'}
              </button>
            </div>

            {ibanDuzenlemeModu ? (
              <div className="space-y-2.5 pt-1 text-xs">
                <div>
                  <label className="text-purple-200/75 block text-[10px] mb-1">Hesap Sahibi (Ad Soyad)</label>
                  <input
                    type="text"
                    value={hesapSahibi}
                    onChange={(e) => setHesapSahibi(e.target.value)}
                    className="w-full bg-[#120614] border border-purple-900 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-purple-200/75 block text-[10px] mb-1">Banka Adı</label>
                    <input
                      type="text"
                      value={bankaAdi}
                      onChange={(e) => setBankaAdi(e.target.value)}
                      placeholder="Örn: İş Bankası"
                      className="w-full bg-[#120614] border border-purple-900 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-purple-200/75 block text-[10px] mb-1">Şube</label>
                    <input
                      type="text"
                      defaultValue="Afyon Anıt Şubesi"
                      className="w-full bg-[#120614] border border-purple-900 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-purple-200/75 block text-[10px] mb-1">IBAN Numarası</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="TR00 0000 0000..."
                    className="w-full bg-[#120614] border border-purple-900 rounded-xl px-3 py-2 font-mono text-emerald-300 font-bold outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#140616] border border-purple-900/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-200/75">Hesap Sahibi:</span>
                  <span className="font-bold text-white">{hesapSahibi}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-200/75">Banka:</span>
                  <span className="font-semibold text-purple-200">{bankaAdi}</span>
                </div>
                <div className="pt-1.5 border-t border-purple-900/40 flex items-center justify-between text-xs">
                  <span className="text-purple-200/75">IBAN:</span>
                  <span className="font-mono text-emerald-400 font-bold tracking-wider">{iban || 'Belirtilmedi'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Çekim Talebi Gönderme Formu */}
          <form onSubmit={talepGonder} className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646] space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <h4 className="font-sans text-xs font-bold text-white">Primimi Banka Hesabıma Çek</h4>
            </div>

            {islemBasarili && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Kurye çekim talebiniz muhasebeye iletildi. Gün içinde hesabınıza aktarılacaktır.</span>
              </div>
            )}

            {hataMesaji && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{hataMesaji}</span>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-purple-100 font-semibold">Çekilecek Tutar (₺)</label>
                <button
                  type="button"
                  onClick={() => setCekimTutari(cekilebilirNetBakiye)}
                  className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Tüm Bakiyeyi Çek ({cekilebilirNetBakiye} ₺)
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="300"
                  max={cekilebilirNetBakiye}
                  value={cekimTutari}
                  onChange={(e) => {
                    setCekimTutari(e.target.value ? Number(e.target.value) : '');
                    setHataMesaji('');
                  }}
                  placeholder="Min. 300 ₺"
                  className="w-full bg-[#120614] border border-purple-900 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-emerald-400 pl-8"
                />
                <span className="absolute left-3 top-2.5 text-emerald-400 font-bold">₺</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={cekilebilirNetBakiye < 300}
              className={`w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                cekilebilirNetBakiye >= 300
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-[#180A1F] shadow-emerald-500/20'
                  : 'bg-[#2B1130] text-purple-300/60 cursor-not-allowed border border-[#4D1E57]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{cekilebilirNetBakiye < 300 ? 'Minimum Çekim Tutarı 300 ₺' : 'Kurye Hakediş Çekim Talebi Ver'}</span>
            </button>
          </form>
        </div>

        {/* Sağ Kolon: Hakediş & Çekim Geçmişi (7 Kolon) */}
        <div className="lg:col-span-7">
          <div className="p-4 rounded-2xl bg-[#1D0A20] border border-[#3E1646] h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-300" />
                <h4 className="font-sans text-xs font-bold text-white">Hakediş & Çekim Hareketleri</h4>
              </div>
              <span className="text-[10px] text-purple-200/75">{kuryeTalepleri.length} Talep Kayıtlı</span>
            </div>

            {kuryeTalepleri.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-purple-200/75">
                <Wallet className="w-10 h-10 text-purple-700 mb-2" />
                <p className="font-sans text-xs font-bold text-white">Henüz çekim talebi oluşturmadınız.</p>
                <p className="text-[11px] mt-0.5 text-purple-200/70">Bakiyeniz 300 ₺&apos;ye ulaştığında banka hesabınıza çekim yapabilirsiniz.</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                {kuryeTalepleri.map((talep) => (
                  <div
                    key={talep.id}
                    className="p-3 rounded-xl bg-[#140616] border border-purple-900/60 hover:border-purple-700 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm font-mono">
                          {talep.tutar.toLocaleString('tr-TR')} ₺
                        </span>
                        {talep.durum === 'odendi' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ödendi / Hesaba Geçti</span>
                          </span>
                        )}
                        {talep.durum === 'beklemede' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Onay Bekliyor</span>
                          </span>
                        )}
                        {talep.durum === 'reddedildi' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Reddedildi</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-purple-200/75 truncate">
                        {talep.banka_adi} • <span className="font-mono text-purple-100">{talep.iban.slice(0, 14)}...</span>
                      </div>

                      {talep.dekont_notu && (
                        <div className="text-[10px] text-emerald-300/90 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-900/40">
                          {talep.dekont_notu}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-[10px] text-purple-200/75 shrink-0">
                      <div>Talep: {talep.talep_tarihi}</div>
                      {talep.odeme_tarihi && (
                        <div className="text-emerald-400 font-semibold mt-0.5">Ödeme: {talep.odeme_tarihi}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

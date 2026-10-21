# V7 Kod Denetimi ve Yapılan Değişiklikler — 21 Ekim 2026

## Gerçekte kullanılan girdi

`gta5-main(1).zip`: yalnızca `index.html`, `script.js`, `styles.css`. Bunlardan tarayıcıda asıl çalışan kod `index.html` içindeki `<script>` idi. 97 kanal adı korunmuştur.

## Kaynakta belirlenen kusurlar

1. `debounce` fonksiyonu yok: arama input olayında ReferenceError.
2. `lastOfflineUpdate` ve `OFFLINE_UPDATE_INTERVAL` yok: veri güncelleme koşulunda ReferenceError.
3. `APP_STATE.isFirstLoad` değişmiyor: yanlış cache stratejisi.
4. Aynı kanal için iki kez `/api/v2/channels/...` çağrısı: gereksiz trafik.
5. API başarısızsa `isLive:false`: doğrulanmayanı çevrimdışı gösterme.
6. `livestream.is_live || false`: bazı geçerli canlı JSON nesnelerinde flag yok, yayın kaçırılabilir.
7. Yanlış UTC tarih birleştirme: `...Z` sonuna ikinci `Z` eklenmesi.
8. Kartların tamamı `innerHTML=''` ile yeniden oluşturuluyor: video iframe kesiliyor.
9. Ekranda görünür eski CSS kuralları favori ikonunun `pointer-events:none` kalmasına neden oluyor.
10. Doğrudan tarayıcı Kick API erişiminin GitHub Pages'te CORS/403 ile engellenme riski.
11. `index.html` 3 × 500px kart dizilimi 1200px kapsayıcıyı aşıyor.

## Düzenlemeler

- HTML/CSS temelini ve 97 yayıncıyı koruyan ayrı `app.js`.
- Gerçek `player.kick.com/KANAL` iframe, yalnız kullanıcı basınca oluşturma, açık oynatıcı güncellemede koruma, Kick'de izle/videolar bağlantıları.
- Önce Github Pages JSON, sonra tarayıcıda izin varsa orijinal `/api/v2/channels` istekleri; başarısızlıkta sistemi durdurma.
- GitHub Actions: OAuth ile resmî Kick kanal/yayın/profil API'si; başarısızsa orijinal gayriresmî uç nokta **en fazla ardışık 3 hatadan sonra durarak** denenir.
- Avatar bilgisi resmî `users` API'sinden; başarısızsa önceki doğru URL, sonra CDN görseli, sonra harfler.
- Tarih, izleyici, kategori, canlı ve doğrulanmamış durumlarını ayrı gösterme; esnek filtre ve arama.
- Eski kaynaklar `ORIJINAL_KAYNAK/` içinde saklandı, GitHub Pages'e yayımlanmıyor.

## Doğrulanabilenler

- Node `node --check app.js` JS sözdizimi kontrolü.
- Python `unittest`: 10 test, resmî API canlı/offline, profil resimleri, başarısız cevap, eski yayın tarihi saklama, gayriresmî JSON live flag eksikliği.
- Chromium + Playwright **çevrimdışı örnek verilerle**: 97 kart; canlı/offline ayrımı; Flavorr'ın kayıtlı yayın tarihinin gösterimi; eski canlı durumu bilinmeyen kanalda iframe açma/kapatma; `Yenile` sırasında iframe'i koruma; arama; favoriler ve filtre. Tarayıcı JS exception: 0.
- GitHub Pages için build allowlist oluşturuldu; çıktı üzerinden statik dosyalar kontrol edildi.

## Doğrulanamayanlar

- Ağ erişimi kısıtlandığı için gerçek Kick API, gerçek avatar CDN bağlantısı, gerçek canlı video dekodlaması ve GitHub Actions bulut ortamında tam çalışma **PASS değildir**.
- Şu anki `data/streamers.json` **canlı veriler uydurularak doldurulmadı**. API bağlanana kadar status `unknown` olabilir.

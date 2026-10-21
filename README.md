# GTA LIVE — Orijinal Kaynak Temelli V7

Bu sürüm **kullanıcının `gta5-main(1).zip` arşivindeki `index.html` kaynak kodu esas alınarak** hazırlanmıştır. V5/V6 görünümü kopyalanmadı. Orijinal tasarımın koyu/yeşil renkleri, sponsor yayıncı (`keempiu`) ve 97 kanal korunmuştur. Dosyaların ilk hâli `ORIJINAL_KAYNAK/` klasöründedir; bu klasör GitHub Pages'e yayımlanmaz.

## 1. Bilgisayarda çalıştır

1. ZIP'i çıkart; `index.html`, `app.js`, `channels.json` aynı klasörde kalsın.
2. VS Code'da o klasörü aç.
3. **Terminal → New Terminal** seçip şu komutu çalıştır:

```powershell
py -m http.server 8080
```

4. Tarayıcıda `http://localhost:8080` aç. Durdurmak için terminalde **Ctrl+C** bas.

## 2. GitHub Pages'e kurulum (keem-piu/gta5)

1. ZIP **içeriğini** mevcut `gta5` depo klasörünün kök dizinine kopyala (ZIP dosyasını tek başına yükleme). `.github/workflows/publish.yml` dosyasının da kopyalandığından emin ol.
2. VS Code terminalinde:

```powershell
git add -A
git commit -m "Restore original GTA LIVE and fix player/API"
git push origin main
```

3. GitHub deposunda **Settings → Pages → Source: GitHub Actions** seç.
4. GitHub deposunda **Actions → GTA LIVE — Original Restored Pages → Run workflow** ile yayınlamayı çalıştır.
5. `https://keem-piu.github.io/gta5/` adresini aç. Eski JS önbelleği için Ctrl+Shift+R yap.

### Kick kanal bilgilerinin gelmesi için

Veri alımında iki yöntem var:

* İlk tercih **resmî Kick Developer API**: https://dev.kick.com/ üzerinden oluşturduğun uygulamanın **KICK_CLIENT_ID** ve **KICK_CLIENT_SECRET** değerlerini GitHub deponda **Settings → Secrets and variables → Actions** bölümüne *Repository secrets* olarak ekle. Bunlar sadece GitHub Actions'ta kullanılır, web sayfasına veya JSON'a yazılmaz.
* Anahtar bulunmazsa veya resmî API başarısız olursa **orijinal projenin `kick.com/api/v2/channels/...` yöntemi** GitHub Actions tarafından denenecektir. Eski ve gayriresmî uç nokta olduğu için Kick tarafından 403/429 ile engellenebilir; **çalışacağı garanti değildir**. Tarayıcıda CORS izin veriyorsa aynı yöntemle doğrudan güncel bilgiler denenir.

**GitHub Pages bir Python sunucusu çalıştırmaz.** `kick_official.py`, `kick_legacy.py`, `update_snapshot.py` sadece GitHub Actions sırasında çalışır. Siteyi açan kullanıcı JSON anlık durumu alır. GitHub Actions saatlik zamanlama gecikebilir; bu **gerçek zamanlı bir sistem değildir**.

## 3. Özellikler ve sınırlamalar

- 97 yayıncı, arama, favoriler (tarayıcıda saklanır), sponsor sıralama, canlı/çevrimdışı/bilinmiyor ayrımı, kategori, izleyici sayısı, yayın başlangıcı, son bilinen yayın zamanı.
- **Canlı olmadığı bilinmeyen bir kanalda bile “▶ Yayını aç”** ile `https://player.kick.com/KANAL?autoplay=true&muted=true` resmi Kick iframe açılır. Harici Kick bağlantısı da sunulur.
- Oynatıcıyı elle açmak gerekir; **tüm 97 videoyu aynı anda açmaz**. Açık video yeni verilerle güncellenirken yeniden oluşturulmaz.
- “Son yayın” yalnızca bir kaynak tarih sağladıysa gösterilir; geçmiş kayıt tarihini geleceğe/tahmine çevirmiyoruz.
- “DURUM DOĞRULANAMADI” ifadesi kanalın çevrimdışı olduğu anlamına **gelmez**.
- **Kick'in gerçek medya oynatımını bu ortamdan test edemedik.** Gerçek yayın engellenirse iframe kendi hata sayfasını gösterebilir veya kullanıcının tarayıcı uzantıları/üçüncü taraf çerezleri engel olabilir.
- Oynatma ve video arşivi **farklıdır**: iframe canlı yayın oynatıcısıdır, “Yayın videoları” Kick profilindeki arşive götürür. Geçmiş VOD oynatımı için resmî genel gömme API'si varsayılmadı.
- GitHub Actions'a erişim için `Actions` sekmesini aç. Loglarda `Kick API`, `Orijinal Kick kanal API yedeği`, `Doğrulanan` satırlarını kontrol et.

## 4. Testler

```powershell
py -m unittest discover -s tests -v
py build_pages.py
```

`build_pages.py` yalnızca `index.html`, `app.js`, `channels.json`, `data/streamers.json` ve `.nojekyll` dosyalarını `_site/` içine kopyalar; eski kaynaklar, Python dosyaları ve kimlik bilgileri siteye taşınmaz.

### Veri gelmiyorsa yapılacak kontrol

1. GitHub **Actions** işlemi yeşil mi?
2. `data/streamers.json` dosyasında `source` ne yazıyor (`official`, `legacy`, `unconfigured`, `kick-unavailable`)? `successCount` sıfır mı?
3. GitHub Secrets gerçekten eklenmiş mi? **Secret değerini kimseyle paylaşma.**
4. Tarayıcı F12 → Console'da `CORS` veya `403` hatası var mı? Bu, `GitHub Pages` içindeki statik web sayfasının çözebileceği bir engel değildir.
5. Kick'teki canlı kanal `https://player.kick.com/kanal` adresinde doğrudan açılıyor mu? Eğer orada da çalışmıyorsa sitemizde HTML değiştirerek yayın açmayı garantileyemeyiz.

## 5. Mimari: neyi neden değiştirdik?

Orijinal `script.js` ve `styles.css` üretim sayfasına **bağlı değildi**. Uygulama esas olarak `index.html` sonundaki ~700 satırlık gömülü JS'de bulunuyordu. Bu gömülü JS'de `debounce`, `lastOfflineUpdate`, `OFFLINE_UPDATE_INTERVAL` tanımları eksikti. Veri istekleri başarısız olsa bile sahte çevrimdışı gösteriliyor, API çağrıları yineleniyor, kartların yeniden render edilmesi video iframe'lerini siliyordu. Orijinal HTML/CSS temelini koruyarak bu JS, bakımı kolay `app.js` içine değiştirildi; orijinal kaynaklar yedeklendi. Resmî Kick API'de kanalın profil resmi her zaman kanal nesnesinde bulunmadığı için kullanıcı API'sinden ayrıca çekiliyor. Gayriresmî ilk sürümdeki kanal yanıtı ayrıca denenebiliyor.

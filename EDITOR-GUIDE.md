# Sweden Journal — İçerik Rehberi

Fotoğraf ekleme, hikâye yaratma ve yayınlama akışının eksiksiz rehberi.
Editör: `02-content-editor/photo-blog-direct-editor.html` (Chrome veya Edge'de açın).

## Nasıl çalışır (kısa özet)

- Sitenin tek içerik kaynağı: `01-website-ready-to-upload/assets/data/site-content.json`.
- Editör bu klasöre **doğrudan yazar**. "Değişiklikleri kaydet" tek tuşla her şeyi
  senkronlar: içerik JSON'ı, görsel varyantları, sayfa metadata'ları, sitemap.xml,
  feed.xml, robots.txt.
- Yayın: **GitHub Desktop'ta Commit + Push** → GitHub Actions siteyi derleyip
  GitHub Pages'e yayınlar (~1-2 dk). Başka bir şey yapmanıza gerek yok.
- Her fotoğrafın kalıcı sayfası vardır: `sweden-journal.com/photos/<id>/`.
  Her hikâye: `sweden-journal.com/stories/<slug>/`.

---

## BÖLÜM 1 — Yeni Fotoğraf Ekleme

### Ön koşullar
- Dosya: JPEG / PNG / WebP / AVIF, **en fazla 25 MB**. Uzun kenar 2200px+ ideal.
- Editör açık, **"Proje klasörünü seç"** ile GitHub Desktop'taki proje klasörü
  (içinde `01-website-ready-to-upload` olan) bağlanmış.

### Adımlar
1. Sol menü → **Fotoğraflar** → **"Yeni fotoğraf ekle"**.
2. Görseli sürükle-bırak. Otomatik dolanlar: başlık (dosya adından), ID,
   genişlik/yükseklik, EXIF tarihi; fotoğrafta GPS varsa bildirim çıkar
   (hikâye haritasında kullanılabilir).
3. Alanları doldurun:

| Alan | Kural |
|---|---|
| **Başlık** (zorunlu) | İngilizce, kısa, betimleyici. Figcaption + foto sayfası başlığı olur. |
| **ID / slug** | Otomatik geleni bırakın. Kalıcı adres: `photos/<id>/`. Yayından sonra değiştirmeyin. |
| **Lokasyon** | "Gamla Stan, Stockholm, Sweden" formatı. |
| **Tarih / Sezon / Tema** | Serbest metin: "Spring 2026", "Ancient site". |
| **Tags** | Virgülle. İlgili içerik eşleştirmesini besler; yer + konu terimleri. |
| **Galeri kategorisi** | Dropdown'dan seçin. Boşsa foto sadece "All" filtresinde görünür. Yeni kategori önce **Galeri** bölümündeki filtre listesine eklenir. |
| **Sıra** | Düşük sayı galeride önce. 10'ar adım kullanın (10, 20, 30…). İlk 12 foto öncelikli yüklenir. |
| **Alt text** (önemli) | Görselde *gerçekten görüneni* tarif eden bir İngilizce cümle. Erişilebilirlik + Google Görseller bunu okur. |
| **Açıklama** | Figcaption'da başlık altında görünen 1-2 cümle. |

4. **"Fotoğrafı siteye ekle"** → üst bardan **"Değişiklikleri kaydet"** (Cmd/Ctrl+S).
   Kayıt otomatik olarak kaynak dosyayı yazar ve thumb/medium/full × JPEG/WebP
   (+uygunsa AVIF) varyantlarını üretir.
5. Durum çubuğundaki görsel seti sayacı tam olmalı. Eksikse foto formundaki
   **"Varyantları editörde üret"** butonunu kullanın.

### Dikkat
- Aynı dosya adı iki fotoğrafta kullanılamaz — editör engeller.
- Foto kaydını silmek fiziksel dosyayı silmez; silinen fotonun sayfasını
  build otomatik temizler.

---

## BÖLÜM 2 — Yeni Hikâye Yaratma

Hikâyede kullanılacak **tüm fotoğrafları önce Bölüm 1 ile ekleyin** (hero dahil).

### Adımlar
1. Sol menü → **Hikâyeler** → **"Yeni hikâye ekle"**.

### Kimlik alanları

| Alan | Kural |
|---|---|
| **Hikâye başlığı** (zorunlu) | Örn. "Ales Stenar". |
| **Slug** | URL olur: `stories/<slug>/`. Taslak adını **mutlaka** anlamlıya çevirin: yer-konu (`ales-stenar`). Yayından sonra sabit tutun. |
| **Lokasyon** | Kart ve sayfa rozetinde görünür. |
| **Tarih (görünen)** | Serbest metin: "Spring 2026". |
| **Yayın tarihi (RSS/sıralama)** | Takvimden gerçek tarih. **Boş bırakmayın:** arşiv sırası, önceki/sonraki gezinme, RSS ve sitemap buna bakar. |
| **Okuma süresi** | Dokunmayın — kayıtta otomatik hesaplanır. |

### Harita konumu (Atlas) — üç yöntem
1. **En kolay:** hero fotoğrafta GPS varsa **"📷 Hero fotoğrafın GPS konumunu kullan"**.
2. Google Maps'te yeri açın → linki kopyalayın → **"Google Maps linki yapıştır"**
   kutusuna yapıştırın → enlem/boylam otomatik dolar.
3. Formdaki haritaya tıklayın veya pini sürükleyin.

Koordinatlı hikâye Atlas haritasında pin olur. Boşsa sadece haritada görünmez.

### Sınıflandırma

| Alan | Kural |
|---|---|
| **Kategori** | Stories sayfası filtresi olur. Mevcut adlarla birebir aynı yazın ("Ancient Sites", "Castles"…). |
| **Hero fotoğrafı** | Kartlar, sayfa tepesi, RSS ve sosyal paylaşım görseli. |
| **Öne çıkan hikâye** | Stories sayfası tepesindeki büyük blok. Genelde tek hikâyede açık tutun. |
| **Özet** | 2-3 cümle. Kartlarda, arama sonucunda ve paylaşım metninde görünür — özenli yazın. |
| **Tags** | Fotoğraflarla ortak terimler → "Related notes and photographs" bunu besler. |

### Gövde blokları (6 tip)

| Blok | Kullanım |
|---|---|
| **Paragraf** | Normal metin. |
| **Görsel** | Metin sütunu genişliğinde tek foto + açıklama. |
| **İkili görsel** | İki foto yan yana (mobilde alt alta) + ortak açıklama. Dikey kadrajlar için. |
| **Panorama** | Metin sütunundan taşıp tam genişliğe yayılan foto. Yatay/geniş kadrajlar için. |
| **Bölüm başlığı** | Ara başlık. |
| **Alıntı** | Vurgulu alıntı bloğu. |

- Sıralamak için **⠿ tutamacından sürükleyin** veya ↑/↓ okları.
- İyi ritim: giriş paragrafı → görsel → 1-2 paragraf → panorama veya ikili →
  paragraf → kapanış. En az bir görsel bloğu koyun (yoksa QA uyarır).
- Sağ paneldeki **Ön izleme → Story** sekmesinden ara ara kontrol edin.

### Ana sayfaya çıkarma (opsiyonel)
Sol menü → **Ana Sayfa** → "Öne çıkan hikâyeler"de işaretleyin (en fazla 2 kart
iyi durur). "Seçili galeri fotoğrafları" da aynı ekrandan (3-6 arası ideal).

---

## BÖLÜM 3 — Kontrol ve Yayın

1. **QA Center** → "Kontrolü yenile". Kırmızı = engelleyici, düzeltin. Sarı = tavsiye.
2. **"Değişiklikleri kaydet"** — tek tuş her şeyi senkronlar.
3. **GitHub Desktop** → değişiklikleri gözden geçirin → kısa commit mesajı →
   Commit to main → **Push origin**.
4. GitHub Actions ~1-2 dk'da yayınlar. Canlı domainden doğrulayın.

### Kısayollar
| Kısayol | İşlev |
|---|---|
| Cmd/Ctrl+S | Kaydet |
| Cmd/Ctrl+Z / Shift+Z | Geri al / yinele |
| Cmd/Ctrl+B | JSON yedeği indir |
| Cmd/Ctrl+Enter | Aktif önizlemenin public sayfasını aç |

### Emniyet
- Büyük değişiklik öncesi **"JSON yedeği indir"** — tek tık, tüm içerik.
- Kaydetmeden kapatırsanız taslak tarayıcıda saklanır → tekrar açılışta
  "Draft'ı geri yükle" banner'ı çıkar.
- Hikâye silmek fotoğraflara dokunmaz; artık sayfaları build temizler.

---

## Sorun Giderme

| Belirti | Çözüm |
|---|---|
| "Yanlış klasör seçildi" | `01-website-ready-to-upload`'ı içeren ANA proje klasörünü seçin. |
| Görsel seti eksik uyarısı | Foto formu → "Varyantları editörde üret" ya da Yayın Akışı → "Tüm varyantları editörde üret". |
| Kategori filtrede yok uyarısı | Galeri bölümü → filtre listesine kategoriyi ekleyin veya fotonun kategorisini mevcut birine çevirin. |
| Editör eski davranıyor | Sayfayı hard-refresh yapın (Cmd+Shift+R). |
| Yayın sonrası değişiklik görünmüyor | GitHub'da Actions sekmesi yeşil mi bakın; sayfayı hard-refresh yapın. |
| QA "does not match canonical" | Sitemap/feed elle değiştirilmiş → `npm run build` ile yeniden üretin. |

# Kamera ile squat tekrar sayımı ve form uyarısı — tasarım

- **Tarih:** 2026-10-07
- **Dal:** `kisisel` (iamtechnoana/openGym fork'u; ana projeye PR hedeflenmiyor)
- **Durum:** Tasarım onaylandı, uygulama planı bekleniyor

## 1. Amaç

Squat yaparken telefon kamerası tekrarları kendisi sayar (elle giriş zahmeti biter) ve
formdaki belirgin hataları sesli olarak söyler. Set bitince tekrar sayısı onayla sete yazılır.

**Kapsamda:** yalnızca iki bacakla yapılan squat (barbell, dambıl, goblet, vücut ağırlığı),
yandan çekim, Android APK ve geliştirme için bilgisayar tarayıcısı.

**Kapsam dışında (ilk sürüm):** diğer hareketler; split, tek bacak ve zıplamalı squat'lar;
önden çekim; dizlerin içe kaçması, sağ-sol dengesizlik ve bel yuvarlanması tespiti; iPhone;
video kaydı.

## 2. Kullanım akışı

1. **Giriş:** Squat türü bir hareketin "⋯" menüsünde, *Bugün* bölümünde **"Kamerayla say"**.
   Uygun olmayan hareketlerde bu seçenek görünmez.
2. **Hazırlık:** Tam ekran kamera açılır (varsayılan arka kamera, ön kameraya geçiş düğmesi
   var). Yönerge: *"Telefonu yanına, kalça hizasına koy; baştan ayağa görünmen lazım."*
   Vücudun üzerine iskelet çizilir. Kalça, diz ve ayak bileği **2 saniye** boyunca net
   görününce uygulama **"Hazır"** der ve sayım başlar.
3. **Set:** Her tekrarda Türkçe sayım yapılır ("bir", "iki", …). Hatalı bir tekrarın sonunda
   en fazla bir kısa uyarı verilir. Hatalı tekrar da sayılır, sadece işaretlenir.
4. **Bitiş:** Set **yalnızca "Bitir" düğmesiyle** biter; otomatik bitiş yok. Özet hem
   sesli hem ekranda verilir: *"8 tekrar. 2 tekrarda derinlik yetersiz."*
5. **Kayıt:** **"Sete yaz"**, tekrar sayısını sıradaki tamamlanmamış çalışma setine yazar
   ve seti tamamlandı işaretler. Ağırlık her zamanki gibi önceden doludur, dinlenme sayacı
   normal şekilde başlar. **"Vazgeç"** hiçbir şey kaydetmez.

**Gizlilik:** Kamera görüntüsü yalnızca o an işlenir. Kaydedilmez, saklanmaz, hiçbir yere
gönderilmez.

## 3. Yapı

Mevcut koda dokunuş en aza indirilir, böylece upstream güncellemeleri çakışmasız alınır.
Var olan dosyalarda tek değişiklik: `Workout.jsx`'e bir menü satırı ve kayıt çağrısı,
ayrıca dil dosyalarına yeni metinler.

```
Kamera karesi
  → lib/pose.js                MediaPipe Pose Landmarker: kare başına 33 nokta
  → lib/squat/angles.js        diz açısı, kalça açısı, gövde eğimi, görünen taraf seçimi
  → lib/squat/rep-counter.js   durum makinesi, tekrar olayları üretir
  → lib/squat/form-rules.js    tekrarın dip/tepe verisinden hata listesi
  → lib/speech.js              Türkçe seslendirme (tarayıcı / Android eklentisi)
  → components/RepCamera.jsx   ekran: video, iskelet, sayı, Bitir / Sete yaz / Vazgeç
```

| Birim | Ne yapar | Bağımlılığı |
|---|---|---|
| `lib/squat/angles.js` | Nokta listesinden açıları hesaplar. Sol ve sağ taraftan görünürlüğü yüksek olanı seçer. | Yok (saf) |
| `lib/squat/rep-counter.js` | Açı akışını işler; `ready`, `rep`, `lost`, `found` olayları üretir. | `angles` (saf) |
| `lib/squat/form-rules.js` | Bir tekrarın özet verisinden öncelik sıralı hata listesi döndürür. | Yok (saf) |
| `lib/pose.js` | MediaPipe'ı yükler; `detect(video, t) → landmarks` | `@mediapipe/tasks-vision` |
| `lib/speech.js` | `speak(text)`, `beep(kind)`; kuyruk, iptal, fallback | `speechSynthesis` / `@capacitor-community/text-to-speech` |
| `components/RepCamera.jsx` | Ekran durumları: hazırlık → sayım → özet | Yukarıdakiler |

**Yeni bağımlılıklar:** `@mediapipe/tasks-vision` (model ve WASM dosyaları uygulamanın
içine konur, CDN'den yüklenmez, çevrimdışı çalışır) ve `@capacitor-community/text-to-speech`
(yalnızca APK'da). Android WebView Web Speech API'yi desteklemediği için eklenti gerekiyor.

**Model:** Pose Landmarker *lite*. Hız deneyi yetersiz çıkarsa önce *lite* ayarları ve
çözünürlük düşürülür; o da yetmezse yaklaşım yeniden konuşulur (ML Kit, native).

## 4. Tekrar sayımı

- **Sinyal:** görünen taraftaki diz açısı (kalça–diz–ayak bileği), üstel hareketli ortalamayla
  yumuşatılmış.
- **Durumlar:** `AYAKTA` → `İNİŞ` → `DİP` → `ÇIKIŞ` → `AYAKTA`.
- **Eşikler (histerezis):** diz < **110°** ise dipte sayılır; diz > **150°** ise ayakta sayılır
  ve tekrar o anda sayılır.
- **Gürültü reddi:** 0,6 saniyeden kısa süren tekrar sayılmaz.
- **Hazır olma:** kalça, diz ve ayak bileği görünürlüğü ≥ 0,6 olarak **2 saniye** sürmeli.
- **Kayıp:** önemli noktalar 1 saniyeden uzun süre görünmezse sayım duraklar ve bir kez
  "Görünmüyorsun" denir. Noktalar geri gelince sayım kaldığı yerden devam eder.

## 5. Form kuralları

Her tekrar için dipteki ve tepedeki ölçümlerden hata listesi çıkar. **Tekrar başına yalnızca
en öncelikli uyarı** söylenir. Özette ise tüm hatalar sayılır.

| Öncelik | Hata | Ölçüt (başlangıç eşiği) | Uyarı |
|---|---|---|---|
| 1 | Yetersiz derinlik | Dipte kalça noktası diz noktasının üstünde kaldı (görüntü y'si). Kalça görünmüyorsa: en düşük diz açısı > **95°** | "Daha derin" |
| 2 | Aşırı öne eğilme | Dipte gövde (omuz–kalça) ile dikey arasındaki açı > **55°** | "Göğsünü kaldır" |
| 3 | Topuk kalkması | Topuk noktası, ayaktaki referansa göre bacak boyunun > **%4**'ü kadar yükseldi | "Topuklarına bas" |
| 4 | Tam kalkmama | Tekrarın tepesinde diz açısı < **165°** | "Tam kalk" |

Tüm eşikler `form-rules.js` içinde tek bir ayar nesnesinde durur. Gerçek videolarla
kalibre edilecek; low-bar squat için gövde eşiği gevşetilebilir.

## 6. Hatalar ve kenar durumları

| Durum | Davranış |
|---|---|
| Kamera izni yok veya kamera yok | Yerinde mesaj gösterilir, çökme olmaz (`CameraScan.jsx` deseni) |
| Model yüklenemedi | Mesaj gösterilir; set elle girilmeye devam edilebilir |
| Kadrajdan çıkma | Sayım duraklar, bir kez "Görünmüyorsun" denir |
| Saniyede 10 karenin altı | "Bu cihazda sayım hatalı olabilir" uyarısı |
| Türkçe ses yok | Sesli sayım yerine bip sesi; sayı ekranda |
| Ekrandan çıkış veya arka plana atma | Kamera ve döngü hemen durur |
| Hiç tekrar sayılmadan "Bitir" | "Sete yaz" pasif kalır |

## 7. Test

1. **Birim testleri (Vitest):** `angles`, `rep-counter` ve `form-rules` elle üretilmiş
   açı ve nokta dizileriyle test edilir: tam tekrar, sığ tekrar, titreme, kısa tekrar,
   kadrajdan çıkma, öne eğilme, yarım kalkış.
2. **Gerçek veri fixture'ları:** kullanıcının çektiği 4–5 squat videosundan, yalnızca
   geliştirme sunucusunda açılan bir sayfa (`/#/dev/pose-extract`; MediaPipe tarayıcıda
   çalıştığı için Node script'i değil) nokta koordinatlarını JSON olarak indirir. Testler bu
   dosyalarda beklenen tekrar sayısını ve işaretlenen tekrarları doğrular.
   **Videolar repoya girmez**, sadece koordinatlar girer.
3. **Elle test:** bilgisayar tarayıcısında kamerayla ya da geliştirici modundaki
   "videodan dene" seçeneğiyle.
4. **Telefon:** GitHub Actions'ta derlenen debug APK telefona kurulur.

## 8. Teslim (APK)

Fork'a `.github/workflows/android-apk.yml` eklenir. `kisisel` dalına her push'ta şu adımlar
çalışır: `npm ci` → `npm run build:mobile` → `cap sync` → `./gradlew assembleDebug`.
Debug APK, workflow artifact'ı olarak indirilir.

**İmza anahtarı sabit olmalı.** Bulut her çalışmada yeni bir debug anahtarı üretirse Android
yeni APK'yı eskisinin üzerine kurmaz; uygulamayı silmek gerekir, bu da telefondaki antrenman
verilerini siler. Bu yüzden bir kez üretilen debug keystore base64 olarak fork'un GitHub
**secret**'ı (`DEBUG_KEYSTORE_B64`) yapılır ve workflow her derlemede onu kullanır. Keystore
dosyası repoya girmez; yerel kopyası `C:\Users\90531\.secrets\bertalanffy\opengym\` altında
durur (workspace sır kuralı).

## 9. Başarı ölçütleri

- Test videolarında setlerin **≥ %95**'inde tekrar sayısı birebir doğru.
- Kullanıcının telefonunda **≥ 15 kare/saniye**.
- Form uyarıları, kullanıcının videolarda "hatalı" dediği tekrarlarla örtüşüyor
  (eşik kalibrasyonundan sonra).

## 10. Yapım sırası

0. **Hız deneyi:** MediaPipe'ı APK içinde çalıştırıp kare/saniye ölç. Sonuç yetersizse dur
   ve yaklaşımı yeniden konuş. Bu adım APK workflow'unu da kurar.
1. `angles`, `rep-counter` ve `form-rules` için önce testler, sonra kod.
2. `pose.js` ve `RepCamera.jsx` (bilgisayarda, kamera ve video girişiyle).
3. `speech.js` (tarayıcı ve Android eklentisi).
4. `Workout.jsx` entegrasyonu ve dil metinleri (tr ve en gerçek; diğer 15 dile İngilizce kopya).
5. Gerçek video fixture'ları, eşik kalibrasyonu ve telefonda salon testi.

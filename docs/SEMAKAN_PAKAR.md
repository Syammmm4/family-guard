# Semakan Pakar (Cognitive Walkthrough): Family Guard

> **PENTING: Ini BUKAN ujian pengguna sebenar.**
> Semakan ini dibuat oleh pembantu AI (Kiro) dengan menelusuri kod aplikasi langkah demi langkah dari sudut pandangan persona **Puan Rosnah, 68**. Tiada orang sebenar terlibat, dan tiada skor atau petikan pengguna di sini.
> Taklimat masih memerlukan ujian dengan **sekurang-kurangnya 3 orang di luar kumpulan**. Gunakan [UJIAN_PENGGUNA.md](UJIAN_PENGGUNA.md) untuk ujian sebenar dan [KEPUTUSAN_UJIAN.md](KEPUTUSAN_UJIAN.md) untuk merekod hasilnya.

**Kaedah:** Untuk setiap tugasan, empat soalan disemak:

1. Adakah pengguna tahu apa yang perlu dibuat?
2. Adakah dia nampak butang atau tindakan yang betul?
3. Adakah dia faham bahawa tindakan itu betul?
4. Adakah dia faham apa yang berlaku selepas itu?

**Versi yang disemak:** Aplikasi Android (`android/`) dan pelayan (`server/`), 10 November 2026.

---

## Ringkasan

| Tugasan (dari UJIAN_PENGGUNA.md) | Jangkaan hasil | Isu utama |
|---|---|---|
| 1. Pautan biasa | ✅ Lancar | Tiada |
| 2. Skrin tunggu | ⚠️ Kebanyakannya jelas | Tidak tahu **kenapa** pautan bahaya (#2) |
| 2b. "Kembali ke telefon" | ❌ Masalah | Tidak dimaklumkan keputusan anak selepas keluar (#1) |
| 3. Pautan disekat | ✅ Jelas | Arahan "padam mesej" mungkin sukar (#6) |
| 4. Pautan sama disekat | ✅ Jelas | Tiada |
| 5. Tiada jawapan → 997 | ⚠️ Berisiko | Peranan 997 mungkin disalah faham (#3). Pengguna sendiri melaporkan jawapan 997 (#4). |
| 6. Peranan anak | ✅ Jelas | Amaran SEDERHANA mungkin terlalu kerap (#5) |
| Luar talian | ⚠️ Berisiko | Butang "Buka juga" mudah ditekan oleh pengguna yang mudah percaya (#7) |

---

## Penemuan

### #1: Selepas "Kembali ke telefon", ibu/bapa tidak tahu keputusan anak · **Tinggi**
- **Apa berlaku:** Butang "Kembali ke telefon (pautan tidak dibuka)" menutup skrin tunggu (`finish()`), jadi semakan keputusan berhenti. Apabila anak membuat keputusan, telefon ibu/bapa tidak memaparkan apa-apa.
- **Kesan pada persona:** Puan Rosnah mungkin tertanya-tanya "Boleh saya buka atau tidak?" dan menekan pautan sekali lagi. Jika anak kata scam, pautan itu disekat ketika itu. Tetapi dia tidak pernah diberitahu secara proaktif.
- **Cadangan:** Hantar **notifikasi** pada telefon ibu/bapa apabila keputusan sampai, contohnya *"Faiz kata pautan Maybank itu SCAM. Jangan buka."*

### #2: Ibu/bapa tidak diberitahu **kenapa** pautan bahaya · **Sederhana**
- **Apa berlaku:** Skrin tunggu hanya berkata *"Pautan ini menunjukkan tanda-tanda scam."* Sebab-sebabnya hanya ditunjukkan kepada anak.
- **Kaitan taklimat:** *"How can the tool explain the risk in simple words?"* Persona sendiri tidak belajar apa-apa.
- **Cadangan:** Tunjukkan 1–2 sebab paling mudah kepada ibu/bapa, contohnya *"Ini bukan laman rasmi Maybank"* atau *"Laman ini minta kod OTP."* Ini membantu dia mengenal scam pada masa hadapan.

### #3: Peranan 997 mungkin disalah faham · **Sederhana**
- **Apa berlaku:** Skrin escalation berkata *"Hubungi 997 untuk semak pautan ini."*
- **Risiko:** NSRC 997 terutamanya untuk **melaporkan penipuan kewangan yang sudah berlaku** (contohnya wang sudah dipindahkan). Pegawai mungkin tidak "menyemak pautan" seperti yang dijangka. Juri mungkin bertanya tentang perkara ini.
- **Cadangan:** Tukar mesej kepada *"Jangan buka pautan ini. Hubungi anak atau ahli keluarga lain. Jika anda sudah beri maklumat bank atau pindah wang, hubungi bank anda dan 997 segera."* Sahkan peranan 997 dengan sumber rasmi sebelum pembentangan.

### #4: Ibu/bapa sendiri yang melaporkan jawapan 997 · **Sederhana**
- **Apa berlaku:** Selepas panggilan, dia perlu kembali ke aplikasi dan tekan "997 kata SCAM" atau "997 kata selamat".
- **Risiko:** Dia mungkin tersilap tekan "selamat", atau terus lupa kembali ke aplikasi. Butang "997 kata selamat" kemudian membuka pautan.
- **Cadangan:** Jadikan **"Jangan buka"** pilihan lalai yang paling besar. Selepas escalation, benarkan pautan dibuka **hanya** dengan kelulusan anak.

### #5: Amaran SEDERHANA mungkin terlalu kerap untuk anak · **Rendah–Sederhana**
- **Apa berlaku:** Skor 30 ke atas sudah memanggil anak. Pautan `http://` (20 mata) dengan perkataan seperti "update" atau "login" (18 mata) sudah mencapai 38.
- **Risiko:** Anak menerima terlalu banyak amaran ("alert fatigue") dan mula menekan "Selamat" tanpa menyemak.
- **Cadangan:** Uji dengan pautan sebenar yang biasa diterima. Pertimbangkan untuk menghantar hanya risiko TINGGI kepada anak, dan menunjukkan amaran ringan sahaja untuk SEDERHANA.

### #6: "Anda boleh padam mesej itu dalam WhatsApp" · **Rendah**
- **Risiko:** Warga emas mungkin tidak tahu cara memadam mesej.
- **Cadangan:** Tambah arahan ringkas (*"Tekan lama mesej itu → ikon tong sampah"*) atau buang ayat ini, kerana pautan sudah disekat.

### #7: Butang "Buka juga" semasa luar talian · **Rendah–Sederhana**
- **Apa berlaku:** Jika pelayan tidak dapat dihubungi, ada tiga butang. "Buka juga" memerlukan pengesahan, tetapi persona ini *"mudah percaya"* dan mungkin terus tekan "Buka".
- **Cadangan:** Sembunyikan "Buka juga" atau kecilkan ia. Dalam mod luar talian, lebih selamat untuk menyuruh dia menghubungi anak.

### #8: Persediaan memerlukan bantuan anak · **Rendah (dijangka)**
- **Apa berlaku:** Memasukkan alamat IP dan menukar pelayar lalai adalah langkah teknikal.
- **Cadangan:** Nyatakan dalam pembentangan bahawa **anak yang memasang dan menyediakan aplikasi**, dan ibu/bapa hanya menggunakannya. Untuk versi sebenar, gunakan pasangan kod QR antara telefon anak dan ibu/bapa.

### #9: Kontras teks kecil pada skrin gelap · **Rendah**
- **Apa berlaku:** Nota kaki 14sp berwarna kelabu kebiruan (`#B8D3D6`) atas biru gelap.
- **Cadangan:** Besarkan kepada 16sp dan gunakan warna yang lebih terang untuk mesej penting seperti "Telefon anda boleh digunakan seperti biasa".

---

## Apa yang dijangka berjaya

- **Pautan selamat terus dibuka**, jadi telefon terasa normal. Ini sesuai dengan kebimbangan bahawa aplikasi akan "mengunci" telefon.
- **Tajuk skrin tunggu besar, jelas dan dalam BM:** "Biar Faiz sahkan pautan ini dulu."
- **Pautan scam yang sama terus disekat** apabila ditekan lagi.
- **Butang besar (60dp)** sesuai untuk skrin kecil.
- **Notifikasi anak dengan "⛔ Scam, sekat"** membolehkan anak bertindak dalam beberapa saat.

---

## Status pembetulan (dikemas kini)

| Penemuan | Status |
|---|---|
| #1 Notifikasi keputusan kepada ibu/bapa | ✅ Dibetulkan: `ParentWatchService` memaklumkan keputusan anak dan masa tamat |
| #2 Sebab mudah untuk ibu/bapa | ✅ Dibetulkan: "Kenapa pautan ini bahaya?" dengan maksimum 2 sebab |
| #3 Mesej 997 | ✅ Dibetulkan: "Jangan buka pautan ini." 997 hanya untuk kes maklumat atau wang sudah diberikan |
| #4 "997 kata selamat" | ✅ Dibuang. Ibu/bapa hanya boleh **sekat**; pelayan menolak SAFE daripada ibu/bapa (403) |
| #5 Ambang SEDERHANA | ⏳ Belum. Perlu keputusan kumpulan |
| #6 Arahan padam mesej | ✅ Dibetulkan: diganti dengan "Jika ditekan, ia akan terus disekat." |
| #7 "Buka juga" | ✅ Dibetulkan: butang teks kecil, dengan pengesahan yang lebih tegas |
| #8 Persediaan oleh anak | ℹ️ Nyatakan dalam pembentangan |
| #9 Kontras teks kecil | ✅ Sebahagian: mesej penting kini 16sp putih |

## Cadangan keutamaan (sebelum finale)

| Keutamaan | Penemuan | Usaha |
|---|---|---|
| 1 | #1 Notifikasi keputusan kepada ibu/bapa | Kecil |
| 2 | #3 + #4 Betulkan mesej 997, dan jangan benarkan "997 kata selamat" membuka pautan | Kecil |
| 3 | #2 Tunjuk 1–2 sebab mudah kepada ibu/bapa | Kecil |
| 4 | #7 Kecilkan "Buka juga" | Sangat kecil |
| 5 | #5 Ambang amaran SEDERHANA | Kecil, tetapi perlu keputusan kumpulan |

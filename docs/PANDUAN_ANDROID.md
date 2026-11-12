# Panduan Aplikasi Android Family Guard

Aplikasi Android ini menangkap pautan yang ditekan oleh ibu/bapa dalam **WhatsApp sebenar** (juga SMS, Telegram dan aplikasi lain). Jika pautan nampak bahaya, anak akan sahkan dahulu sebelum pautan dibuka.

**Satu aplikasi, dua mod:**

| Telefon | Mod | Apa yang berlaku |
|---|---|---|
| Telefon ibu/bapa | **Ibu / bapa** | Family Guard menjadi "pelayar lalai". Setiap pautan yang ditekan disemak dahulu. Pautan selamat terus dibuka dalam Chrome. |
| Telefon anak | **Anak** | Menerima notifikasi amaran dan memilih **Selamat** atau **Scam, sekat**. |

Anak juga boleh menggunakan **papan pemuka web** (http://ALAMAT-KOMPUTER:3000) dan bukan aplikasi. Kedua-duanya berkongsi pelayan yang sama.

---

## Cara ia berfungsi

1. Ibu/bapa menekan pautan dalam WhatsApp.
2. Android membuka **Family Guard dahulu**, bukan Chrome.
3. **Pautan selamat:** terus dibuka dalam Chrome, dan ibu/bapa hampir tidak perasan.
4. **Pautan bahaya:** keluar skrin **"Biar anak anda sahkan pautan ini dulu."**
   - Ibu/bapa boleh tekan **"Kembali ke telefon"** dan guna telefon seperti biasa. Hanya pautan itu yang menunggu.
5. Telefon anak menerima notifikasi. Anak tekan **Scam, sekat** (terus dari notifikasi) atau buka aplikasi untuk lihat sebab dan pilih **Selamat**.
6. **Anak kata selamat:** pautan dibuka dalam Chrome.
   **Anak kata scam:** skrin "Ini SCAM. Pautan telah disekat."
7. **Ibu/bapa dimaklumkan.** Jika ibu/bapa sudah kembali ke WhatsApp, notifikasi akan memberitahu keputusan anak. Tekan notifikasi "selamat" untuk terus membuka pautan.
8. **Tiada jawapan dalam 3 minit:** skrin bertukar kepada **"Jangan buka pautan ini."** Ibu/bapa boleh hubungi anak, atau tekan **"Saya tidak akan buka. Sekat pautan ini."** Butang **Hubungi 997** ditunjukkan untuk kes maklumat bank, OTP atau wang sudah diberikan. **Hanya anak boleh membenarkan pautan dibuka.**
9. **Laman yang sudah diputuskan diingati.** Jika ibu/bapa tekan pautan scam yang sama sekali lagi, ia terus disekat tanpa bertanya anak.

---

## 1. Sediakan pelayan (komputer riba)

Telefon perlu boleh sampai ke komputer melalui Wi-Fi.

1. Buka fail `.env` dan tukar baris ini:
   ```ini
   HOST=0.0.0.0
   GUARDIAN_NAME=Faiz (Anak)
   ```
   Pilihan: `GUARDIAN_PHONE=+60123456789` untuk butang "Hubungi anak".
2. Mulakan pelayan:
   ```powershell
   npm.cmd start
   ```
3. Jika Windows bertanya tentang **Firewall untuk Node.js**, pilih **Private networks** sahaja dan tekan **Allow**.
4. Cari alamat komputer dengan `ipconfig`, contohnya `IPv4 Address: 192.168.1.10`.
   Alamat pelayan ialah **`http://192.168.1.10:3000`**.
5. Uji dari pelayar telefon: buka `http://192.168.1.10:3000`. Jika halaman Family Guard keluar, sambungan berjaya.

> Jangan buka port ini kepada internet. Gunakan Wi-Fi rumah atau Wi-Fi peribadi sahaja.

---

## 2. Pasang aplikasi pada telefon

### Dari Android Studio (disyorkan)

1. Android Studio, kemudian **File, Open**, dan pilih folder **`family-guard/android`**.
2. Tunggu sehingga "Gradle sync" selesai.
3. Pada telefon: **Tetapan, Perihal telefon**, ketik **Nombor binaan** 7 kali, kemudian **Pilihan pembangun** dan hidupkan **Penyahpepijatan USB**.
4. Sambungkan telefon dengan kabel USB dan benarkan "USB debugging".
5. Pilih telefon di bahagian atas Android Studio, kemudian tekan **Run ▶**.

Ulang untuk telefon kedua (telefon anak).

### Atau pasang fail APK

Fail APK yang sudah dibina ada di:
`android/app/build/outputs/apk/debug/app-debug.apk`

Salin ke telefon dan buka. Benarkan "Pasang aplikasi tidak diketahui" jika ditanya.

---

## 3. Sediakan telefon ibu/bapa

1. Buka **Family Guard**.
2. Alamat pelayan: `http://192.168.1.10:3000` (alamat komputer anda).
3. Pilih **Ibu / bapa (dilindungi)** dan masukkan PIN **1357**, kemudian tekan **Log masuk**.
4. Tekan **Aktifkan perlindungan** dan pilih **Family Guard** sebagai aplikasi pelayar.
   - Jika tiada dialog: **Tetapan, Aplikasi, Aplikasi lalai, Apl pelayar**, kemudian pilih **Family Guard**.
5. Kad hijau **"Perlindungan pautan AKTIF"** akan muncul.
   - Tekan **Benarkan** apabila diminta kebenaran notifikasi, supaya ibu/bapa dimaklumkan keputusan anak.
6. Pastikan **Chrome** (atau pelayar lain) masih dipasang. Family Guard menghantar pautan selamat ke situ.

## 4. Sediakan telefon anak

1. Buka **Family Guard**.
2. Masukkan alamat pelayan yang sama.
3. Pilih **Anak** dan masukkan PIN **2468**, kemudian tekan **Log masuk**.
4. Tekan **Benarkan** apabila diminta kebenaran notifikasi.
5. Notifikasi kecil **"Family Guard sedang memantau"** akan sentiasa ada. Ini bermakna amaran akan sampai walaupun aplikasi ditutup.

---

## 5. Skrip demo

> Untuk demo cepat, tetapkan `INCIDENT_TIMEOUT_SECONDS=20` dalam `.env` dan mulakan semula pelayan.

**Sediakan pautan ujian:** dari telefon lain (atau WhatsApp Web), hantar mesej WhatsApp kepada telefon ibu/bapa:

```
Akaun MAYBANK anda akan digantung. Sahkan di https://maybank-secure-verification.example/verify
```

```
Bungkusan anda ditahan. Bayar di http://pos-laju-delivery-update.top/claim
```

```
Resepi rendang: https://www.google.com
```

> Domain `.example` tidak wujud, jadi ia selamat untuk demo. Pautan itu tidak akan membuka laman sebenar.

### Senario 1: Anak menjawab
1. Telefon ibu/bapa: tekan pautan Maybank dalam WhatsApp.
2. Skrin **"Biar Faiz (Anak) sahkan pautan ini dulu"** muncul.
3. Telefon anak: notifikasi **"⚠️ Puan Rosnah menekan pautan mencurigakan"** muncul. Tekan **⛔ Scam, sekat**.
4. Telefon ibu/bapa: **"Ini SCAM. Pautan telah disekat."**, kemudian tekan **Kembali ke telefon**.
5. Tekan pautan Maybank sekali lagi. Ia **terus disekat** tanpa menunggu anak.

### Senario 2: Anak tidak menjawab
1. Telefon ibu/bapa: tekan pautan POS.
2. Jangan sentuh telefon anak. Tunggu masa tamat.
3. Telefon ibu/bapa bertukar kepada **"Jangan buka pautan ini."**, dengan sebab-sebab mudah (cth. "Laman ini mungkin akan minta kod OTP…").
4. Tunjukkan kotak **"Sudah beri maklumat bank, OTP atau pindah wang?"** dan butang **📞 Hubungi 997 sekarang**. Ia membuka aplikasi telefon dengan nombor 997 tetapi tidak membuat panggilan sendiri.
5. Tekan **⛔ Saya tidak akan buka. Sekat pautan ini.**, kemudian **Ya, sekat**.
6. Terangkan: *"Hanya anak boleh membenarkan pautan. Ibu/bapa yang mudah percaya tidak boleh membukanya seorang diri."*

### Notifikasi kepada ibu/bapa
1. Tekan **Pulihkan mesej demo** di papan pemuka web, kemudian tekan pautan Maybank pada telefon ibu/bapa.
2. Tekan **Kembali ke telefon (pautan tidak dibuka)** dan buka WhatsApp.
3. Telefon anak: tekan **⛔ Scam, sekat**.
4. Telefon ibu/bapa: notifikasi **"⛔ [anak] kata pautan ini SCAM"** muncul walaupun ibu/bapa berada dalam WhatsApp.

### Pautan selamat
Tekan pautan Google. Ia terus dibuka dalam Chrome tanpa amaran.

### Ulang demo
Di papan pemuka web anak, tekan **Pulihkan mesej demo**. Ini juga melupakan keputusan "diingati" supaya senario boleh diulang.

---

## 6. Had prototaip (beritahu penonton dengan jujur)

- **Mesej WhatsApp tidak dipadam.** WhatsApp tidak membenarkan aplikasi lain memadam mesej. Sebaliknya, pautan scam **disekat dan diingati**, jadi menekannya lagi tidak membahayakan.
- **997 tidak disambungkan secara automatik.** Butang hanya membuka dail. Ibu/bapa yang melaporkan jawapan 997.
- **Hanya pautan yang dibuka melalui pelayar** ditangkap. Sesetengah aplikasi (cth. Telegram dengan "pelayar dalam aplikasi", atau Facebook) membuka pautan di dalam aplikasi mereka sendiri. Laman yang "disahkan" oleh aplikasi rasmi (cth. pautan Shopee yang dibuka terus dalam aplikasi Shopee) tidak melalui Family Guard.
- **Android sahaja.** iPhone tidak membenarkan ini dengan cara yang sama.
- **Pelayan di komputer riba melalui HTTP biasa.** Ini sesuai untuk demo di Wi-Fi yang sama sahaja. Versi sebenar perlu pelayan dalam talian dengan HTTPS dan akaun sebenar.
- **Pengesanan menggunakan peraturan mudah** (heuristik), bukan pangkalan data scam rasmi.

---

## 7. Masalah biasa

| Masalah | Penyelesaian |
|---|---|
| "Tidak dapat berhubung dengan pelayan" | Pastikan `HOST=0.0.0.0`, pelayan sedang berjalan, telefon dalam Wi-Fi yang sama, dan Firewall membenarkan Node.js. Uji `http://ALAMAT:3000` dalam Chrome telefon. |
| Pautan terus dibuka dalam Chrome tanpa disemak | Family Guard bukan pelayar lalai. Buka aplikasi dan tekan **Aktifkan perlindungan**. |
| "Tiada pelayar lain dijumpai" | Pasang atau aktifkan semula Chrome. |
| Anak tidak menerima notifikasi | Benarkan notifikasi untuk Family Guard. Pada Xiaomi, Oppo, Vivo dan Samsung, matikan **pengoptimuman bateri** untuk Family Guard supaya pemantauan tidak dihentikan. |
| Selepas pelayan dimulakan semula | Tiada tindakan diperlukan. Aplikasi akan log masuk semula secara automatik. |
| Mahu tukar peranan atau alamat | Tekan **Tukar tetapan / log keluar**. |

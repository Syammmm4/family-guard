# Pelan Ujian Pengguna Family Guard

**Tujuan:** Menguji sama ada warga emas faham dan boleh guna Family Guard tanpa bantuan, seperti yang diminta oleh taklimat (*"Build and test your prototype with at least 3 people outside your team"*).

**Persona:** Puan Rosnah, 68. Guna WhatsApp, skrin kecil, lebih suka Bahasa Malaysia, mudah percaya mesej yang nampak rasmi.

**Masa setiap peserta:** 15–20 minit.

---

## 1. Siapa yang diuji

| Peserta | Cadangan | Kenapa |
|---|---|---|
| P1 | Umur 55 tahun ke atas (ibu bapa, datuk/nenek, jiran) | Paling hampir dengan persona |
| P2 | Umur 55 tahun ke atas | Bandingkan dengan P1 |
| P3 | Dewasa muda (20–35) **sebagai anak** | Uji skrin anak: adakah sebab-sebab amaran jelas? |

Mereka mesti **bukan ahli kumpulan anda**. Lebih ramai lebih baik, tetapi minimum 3 orang.

---

## 2. Peraturan keselamatan (wajib)

- Gunakan **pautan ujian sahaja** (domain `.example`). Laman-laman ini tidak wujud dan tidak boleh mencuri apa-apa.
- **Jangan** minta peserta masukkan nombor kad, TAC, kata laluan atau maklumat sebenar.
- **Jangan** buat panggilan sebenar ke 997. Apabila peserta tekan "Hubungi 997", tutup aplikasi telefon sebelum menekan butang panggil.
- Jangan rakam muka atau suara tanpa izin. Catat **nama pertama atau kod (P1, P2, P3)** dan julat umur sahaja.

---

## 3. Persediaan (sebelum peserta tiba)

- [ ] Pelayan Render sudah bangun: buka `https://…onrender.com/api/health` dan pastikan `{"status":"ok"}`. Tetapkan `INCIDENT_TIMEOUT_SECONDS` = `20` di **Render → Environment** supaya senario 2 cepat.
- [ ] Telefon / emulator **ibu/bapa** sudah log masuk (alamat Render + PIN ibu/bapa), dengan **Perlindungan pautan AKTIF**.
- [ ] Peranan **anak** dimainkan oleh anda, pada telefon kedua atau papan pemuka web (PIN anak).
- [ ] Hanya **seorang peserta pada satu masa**, kerana semua berkongsi satu keluarga.
- [ ] Tekan **Pulihkan mesej demo** supaya tiada keputusan lama diingati.
- [ ] Hantar 3 mesej ini ke telefon ibu/bapa (WhatsApp atau SMS):
  1. `Aisyah: Mak, ni resepi rendang: https://www.google.com`
  2. `MAYBANK: Akaun anda akan DIGANTUNG hari ini. Sahkan segera: https://maybank-secure-verification.example/verify`
  3. `POS: Bungkusan anda ditahan. Kemas kini alamat: http://parcel-update.example/track`
- [ ] Sediakan jam randik (stopwatch telefon) dan borang di Bahagian 6.

---

## 4. Skrip (baca kepada peserta)

> "Terima kasih kerana membantu. Kami sedang menguji aplikasi yang membantu warga emas mengelak pautan scam di WhatsApp. **Kami menguji aplikasi, bukan anda.** Tiada jawapan salah. Sila cakap apa yang anda fikir semasa menggunakannya. Semua pautan di sini adalah pautan ujian dan selamat. Anda boleh berhenti bila-bila masa. Boleh kami teruskan?"

Catat persetujuan: **Ya / Tidak**.

---

## 5. Tugasan

Untuk setiap tugasan, **jangan bantu** melainkan peserta tersekat lebih 1 minit. Catat:

- **B** = Berjaya sendiri
- **BB** = Berjaya dengan bantuan
- **G** = Gagal

Catat juga masa dan apa yang peserta katakan.

### Tugasan 1: Pautan biasa
> "Anak perempuan anda hantar resepi. Sila buka pautan itu."

- **Dijangka:** pautan Google terus dibuka dalam Chrome.
- **Tanya:** "Adakah anda perasan apa-apa yang berbeza?"

### Tugasan 2: Pautan scam (skrin tunggu)
> "Anda dapat mesej daripada Maybank. Sila buat apa yang anda biasa buat."

- **Dijangka:** skrin *"Biar [anak] sahkan pautan ini dulu."*
- **Mulakan jam** apabila skrin muncul. **Henti** apabila peserta boleh terangkan apa yang perlu dibuat.
- **Tanya:**
  - "Apa yang skrin ini beritahu anda?"
  - "Apa yang anda akan buat sekarang?"
  - "Bolehkah anda guna telefon untuk benda lain sementara menunggu?" (Jawapan dijangka: tekan "Kembali ke telefon".)

### Tugasan 3: Anak sekat pautan
*(Anda, sebagai anak, tekan **Scam, sekat**.)*

- **Dijangka:** *"Ini SCAM. Pautan telah disekat."*
- **Tanya:**
  - "Apa maksud mesej ini?"
  - "Jika anda sudah beri maklumat bank, apa yang perlu anda buat?" (Jawapan dijangka: hubungi bank / 997.)

### Tugasan 4: Tekan pautan scam yang sama sekali lagi
> "Cuba buka mesej Maybank itu sekali lagi."

- **Dijangka:** terus disekat tanpa menunggu anak.
- **Tanya:** "Adakah ini membuat anda rasa lebih selamat atau keliru?"

### Tugasan 5: Anak tidak menjawab (997)
> "Sila buka mesej POS." *(Jangan tekan apa-apa sebagai anak. Tunggu 20 saat.)*

- **Dijangka:** skrin *"Jangan buka pautan ini."*
- **Tanya:**
  - "Apa yang aplikasi minta anda buat?"
  - "Bila anda perlu hubungi 997?" (Jawapan dijangka: jika maklumat bank atau wang sudah diberikan.)
- Minta peserta tekan **Saya tidak akan buka. Sekat pautan ini.**

### Tugasan 5b: Notifikasi keputusan
*(Tekan **Pulihkan mesej demo**. Minta peserta buka mesej Maybank, kemudian tekan **Kembali ke telefon** dan buka WhatsApp. Anda tekan **Scam, sekat** sebagai anak.)*

- **Dijangka:** notifikasi *"⛔ [anak] kata pautan ini SCAM"*.
- **Tanya:** "Adakah anda perasan notifikasi itu? Apa maksudnya?"

### Tugasan 6 (untuk P3 sahaja): Peranan anak
*(Tekan **Pulihkan mesej demo**. Anda tekan pautan Maybank pada telefon ibu/bapa. P3 memegang telefon anak / papan pemuka.)*

- **Tanya:**
  - "Adakah sebab-sebab amaran ini jelas?"
  - "Berapa lama anda perlukan untuk buat keputusan?"
  - "Apa yang anda perlukan untuk yakin pautan itu selamat?"

---

## 6. Soalan selepas ujian

### Skala 1–5 (1 = Sangat tidak setuju, 5 = Sangat setuju)

| # | Kenyataan | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| S1 | Saya faham apa yang perlu dibuat apabila skrin berhenti. | | | | | |
| S2 | Tulisan dan butang cukup besar untuk saya. | | | | | |
| S3 | Bahasa yang digunakan mudah difahami. | | | | | |
| S4 | Saya rasa lebih selamat apabila anak saya menyemak pautan dahulu. | | | | | |
| S5 | Aplikasi ini tidak mengganggu penggunaan telefon saya. | | | | | |
| S6 | Saya tahu apa yang perlu dibuat jika anak tidak menjawab. | | | | | |
| S7 | Saya akan benarkan anak saya memasang aplikasi ini pada telefon saya. | | | | | |

### Soalan terbuka

- T1. Apa yang paling mengelirukan?
- T2. Apa yang anda paling suka?
- T3. Pernahkah anda terima mesej atau panggilan scam? Apa yang berlaku?
- T4. Selain pautan, apa lagi yang anda risau? (Contoh: panggilan "polis" atau "bank", "Hi Mak, nombor baru".)
- T5. Jika anda boleh ubah satu perkara, apa dia?

---

## 7. Versi Google Form

Salin soalan-soalan ini ke dalam Google Form:

1. Kod peserta (P1/P2/P3)
2. Julat umur: *18–34 / 35–54 / 55–64 / 65+*
3. Telefon yang biasa digunakan: *Android / iPhone / Lain-lain*
4. Saya faham apa yang perlu dibuat apabila skrin berhenti. *(Skala linear 1–5)*
5. Tulisan dan butang cukup besar untuk saya. *(1–5)*
6. Bahasa yang digunakan mudah difahami. *(1–5)*
7. Saya rasa lebih selamat apabila anak saya menyemak pautan dahulu. *(1–5)*
8. Aplikasi ini tidak mengganggu penggunaan telefon saya. *(1–5)*
9. Saya tahu apa yang perlu dibuat jika anak tidak menjawab. *(1–5)*
10. Saya akan benarkan anak saya memasang aplikasi ini. *(1–5)*
11. Apa yang paling mengelirukan? *(Jawapan panjang)*
12. Apa yang anda paling suka? *(Jawapan panjang)*
13. Pernahkah anda terima mesej atau panggilan scam? *(Jawapan panjang)*
14. Selain pautan, apa lagi yang anda risau? *(Jawapan panjang)*
15. Jika anda boleh ubah satu perkara, apa dia? *(Jawapan panjang)*

---

## 8. Kaitan dengan taklimat

| Soalan panduan taklimat | Diuji dalam |
|---|---|
| Bagaimana menerangkan risiko dalam perkataan mudah? | Tugasan 2, 3, 6 · S1, S3 |
| Apa yang pengguna perlu buat selepas mesej ditanda? | Tugasan 3, 5 · S6 |
| Bagaimana mengelak amaran palsu pada mesej bank sebenar? | Tugasan 1 · S5 |
| Adakah ia sesuai untuk warga emas (persona)? | Semua tugasan · S2, S4, S7 |

Catat keputusan dalam **[KEPUTUSAN_UJIAN.md](KEPUTUSAN_UJIAN.md)**.

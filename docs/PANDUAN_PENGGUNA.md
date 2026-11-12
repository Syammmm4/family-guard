# Panduan Pengguna Family Guard

Family Guard ialah prototaip yang membantu ibu/bapa warga emas mengelak pautan scam di WhatsApp. Apabila ibu/bapa menekan pautan yang nampak bahaya, anak mereka akan sahkan dahulu sama ada pautan itu scam atau tidak.

> **Penting:** Ini adalah **demo**. Telefon dan WhatsApp dalam aplikasi ini ialah olok-olok. Laman web tidak boleh membaca atau memadam mesej dalam WhatsApp sebenar, tidak boleh mengunci telefon, dan tidak boleh menghubungi 997 secara automatik. Versi sebenar perlu dibina sebagai aplikasi Android.

---

## 1. Cara menjalankan sistem

Keperluan: **Node.js 20 atau lebih baharu**.

**Cara paling mudah (Windows):** klik dua kali fail `start-windows.bat`.

**Cara manual (PowerShell):**

```powershell
Copy-Item .env.example .env   # sekali sahaja
npm.cmd ci                    # sekali sahaja
npm.cmd start
```

Kemudian buka **http://127.0.0.1:3000** dalam **dua tab** pelayar:

| Tab | Peranan | PIN demo |
|---|---|---|
| Tab 1 | Ibu / bapa | `1357` |
| Tab 2 | Anak | `2468` |

Untuk berhenti, tekan **Ctrl + C** dalam terminal.

### Tetapan dalam fail `.env`

| Tetapan | Maksud | Contoh |
|---|---|---|
| `SENIOR_NAME` | Nama ibu/bapa | `Puan Rosnah` |
| `GUARDIAN_NAME` | Nama anak | `Faiz (Anak)` |
| `GUARDIAN_PHONE` | Nombor telefon anak (untuk butang "Hubungi anak") | `+60123456789` |
| `INCIDENT_TIMEOUT_SECONDS` | Masa menunggu jawapan anak | `180` (3 minit) |
| `SENIOR_PIN`, `GUARDIAN_PIN` | PIN log masuk | Tukar sebelum demo di rangkaian kongsi |

Mulakan semula pelayan (`Ctrl + C`, kemudian `npm.cmd start`) selepas menukar `.env`.

---

## 2. Panduan untuk ibu / bapa

1. Log masuk dan pilih **"Saya ibu / bapa"**, kemudian masukkan PIN.
2. Anda akan nampak telefon dengan senarai **Sembang**, seperti WhatsApp.
3. Tekan satu sembang untuk membukanya, kemudian tekan pautan biru dalam mesej.

**Apa yang berlaku selepas anda tekan pautan:**

- **Pautan nampak selamat:** keluar mesej "Tiada tanda bahaya ditemui" dan butang **Buka pautan**.
- **Pautan nampak bahaya:** skrin akan berhenti dengan mesej **"Biar anak anda sahkan pautan ini dulu."** Tunggu sebentar. Anda boleh tekan **Hubungi anak** jika nombor anak telah ditetapkan.

**Selepas anak membuat keputusan:**

- **Anak kata selamat:** keluar butang **Buka pautan**.
- **Anak kata scam:** mesej itu **dipadam** dari sembang anda dan diganti dengan "Mesej ini telah dipadam oleh Family Guard". Tekan **Faham, teruskan** dan guna telefon seperti biasa.

**Jika anak tidak menjawab dalam 3 minit:**

1. Skrin akan berubah kepada **"Jangan buka pautan ini."**
2. Hubungi anak atau ahli keluarga lain untuk bertanya.
3. Tekan **Saya tidak akan buka. Sekat pautan ini.** Mesej dipadam dan telefon kembali seperti biasa.
4. Hanya anak boleh membenarkan pautan itu dibuka.

> Jika anda sudah memberi maklumat bank atau memindahkan wang, hubungi bank anda dan NSRC 997 **dengan segera**.

---

## 3. Panduan untuk anak

1. Log masuk dan pilih **"Saya anak"**, kemudian masukkan PIN.
2. Biarkan **Papan pemuka anak** terbuka. Apabila ibu/bapa menekan pautan bahaya, amaran akan muncul serta-merta.
3. Semak maklumat amaran:
   - **Mesej yang diterima** oleh ibu/bapa
   - **Pautan** dan pengirimnya
   - **Kenapa pautan ini ditanda** (sebab-sebab amaran)
   - **Masa untuk menjawab** (kiraan detik)
4. Buat keputusan:
   - **Selamat, benarkan**: hanya jika anda sudah sahkan alamat rasmi laman itu.
   - **Scam, padam mesej**: mesej itu dipadam dari WhatsApp ibu/bapa dan skrin mereka dibuka semula.
5. Jika masa tamat, ibu/bapa akan diberi butang hubungi 997. **Anda masih boleh membuat keputusan** selepas itu.

Jadual **Aktiviti terkini** menunjukkan semua amaran dan siapa yang membuat keputusan (anak atau melalui 997).

---

## 4. Skrip demo untuk pembentang

Sediakan dua tab bersebelahan: **ibu/bapa** di kiri, **anak** di kanan.

> Untuk demo yang lebih cepat, tetapkan `INCIDENT_TIMEOUT_SECONDS=20` dalam `.env`, kemudian mulakan semula pelayan.

### Senario 1: Anak menjawab (kira-kira 1 minit)

1. Tab ibu/bapa: buka sembang **+60 11-5555 0000** (mesej "MAYBANK").
2. Tekan pautan. Skrin berhenti: **"Biar anak anda sahkan pautan ini dulu."**
3. Tab anak: amaran muncul dengan mesej, pautan dan sebab-sebabnya.
4. Tekan **Scam, padam mesej** dan sahkan.
5. Tab ibu/bapa: skrin dibuka semula, mesej telah **dipadam**, dan telefon boleh digunakan seperti biasa.

### Senario 2: Anak tidak menjawab (kira-kira 30 saat dengan masa 20 saat)

1. Tab ibu/bapa: buka sembang **+60 13-222 8080** (mesej "POS").
2. Tekan pautan. Skrin berhenti dan kiraan detik bermula.
3. **Jangan** tekan apa-apa di tab anak. Tunggu sehingga masa tamat.
4. Tab ibu/bapa: skrin bertukar kepada **"Jangan buka pautan ini."**
5. Tunjukkan butang **Hubungi 997 sekarang**, untuk kes maklumat bank atau wang sudah diberikan (di komputer, ia hanya membuka aplikasi panggilan).
6. Tekan **Saya tidak akan buka. Sekat pautan ini.** Mesej dipadam dan telefon kembali seperti biasa.

### Tambahan: Pautan selamat

Buka sembang **Keluarga Kita** dan tekan pautan daripada Aisyah. Tiada amaran; terus keluar butang **Buka pautan**.

### Ulang demo

Tekan **Pulihkan mesej demo** (di tab ibu/bapa atau tab anak) untuk mengembalikan semua mesej yang telah dipadam.

---

## 5. Soalan lazim

**Kenapa skrin tidak berubah selepas anak membuat keputusan?**
Pastikan kedua-dua tab menunjukkan "Bersambung secara langsung". Jika tidak, muat semula halaman.

**Kenapa saya tidak boleh tekan pautan lain semasa menunggu?**
Hanya satu amaran boleh aktif pada satu masa. Tunggu keputusan anak atau 997 dahulu.

**Adakah 997 benar-benar disambungkan?**
Tidak. Butang itu hanya membuka panggilan biasa ke 997 apabila ditekan. Ibu/bapa yang melaporkan jawapan 997 dalam aplikasi.

**Bolehkah sistem ini memadam mesej WhatsApp sebenar?**
Tidak. Pemadaman hanya berlaku dalam telefon demo. WhatsApp sebenar tidak membenarkan aplikasi lain memadam mesej.

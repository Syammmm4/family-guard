# Panduan Deploy ke Render (percuma)

Selepas deploy, Family Guard ada alamat awam seperti **`https://family-guard-xxxx.onrender.com`**. Penguji tidak perlu `npm`, komputer riba atau Wi-Fi yang sama.

> **Had pelan percuma Render**
> - Pelayan **tidur** selepas kira-kira 15 minit tanpa pelawat. Pelawat pertama selepas itu menunggu **30–60 saat**.
> - **Sejarah amaran hilang** apabila pelayan dimulakan semula atau dideploy semula. Ini OK untuk demo.
> - Semua penguji **berkongsi satu keluarga** (seorang ibu/bapa, seorang anak). Uji **seorang demi seorang**.

---

## Langkah 1: Letak projek dalam GitHub

Jalankan dalam terminal folder `family-guard`:

```powershell
git init
git add .
git status
```

**Semak senarai fail sebelum commit.** Fail-fail ini **tidak boleh** ada dalam senarai:

| Fail | Kenapa |
|---|---|
| `.env` | PIN dan rahsia anda |
| `node_modules/` | Besar, dan dipasang semula oleh Render |
| `data/*.json` | Sejarah amaran |
| `android/local.properties`, `*.apk` | Khusus untuk komputer anda |

Semua fail ini sudah ada dalam `.gitignore`. Jika ada yang tersenarai juga, berhenti dan semak semula.

Kemudian:

```powershell
git commit -m "Family Guard prototype"
git branch -M main
```

Di **github.com**, tekan **New repository**. Beri nama `family-guard`, pilih **Private**, dan **jangan** tanda "Add a README". Kemudian jalankan arahan yang GitHub tunjukkan:

```powershell
git remote add origin https://github.com/NAMA-ANDA/family-guard.git
git push -u origin main
```

---

## Langkah 2: Deploy di Render

1. Daftar di **https://render.com** menggunakan akaun GitHub.
2. Tekan **New → Blueprint**, kemudian pilih repo `family-guard`.
3. Render membaca fail `render.yaml` dan meminta dua rahsia:

   | Kunci | Isi | Contoh |
   |---|---|---|
   | `SENIOR_PIN` | PIN ibu/bapa, 6 digit atau lebih | `582614` |
   | `GUARDIAN_PIN` | PIN anak, 6 digit atau lebih, **berbeza** | `937105` |

   > Pelayan **tidak akan bermula** jika anda guna PIN demo (1357/2468), PIN pendek, atau dua PIN yang sama. Ini disengajakan, supaya orang asing tidak boleh log masuk.

4. Tekan **Apply**. Tunggu 2–4 minit sehingga status menjadi **Live**.
5. Salin alamat di bahagian atas, cth. `https://family-guard-xxxx.onrender.com`.
6. Uji: buka `https://…onrender.com/api/health`. Jawapan yang betul ialah `{"status":"ok"}`.

### Tukar tetapan kemudian
**Render → family-guard → Environment.** Tukar nilai, simpan, dan Render akan memulakan semula pelayan.

| Mahu | Tetapkan |
|---|---|
| Demo senario 2 yang cepat | `INCIDENT_TIMEOUT_SECONDS` = `20` |
| Nama sebenar | `SENIOR_NAME`, `GUARDIAN_NAME` |
| Butang "Hubungi anak" | `GUARDIAN_PHONE` = `+60123456789` |

### Kemas kini kod
Setiap kali anda `git push` ke `main`, Render akan deploy semula secara automatik.

---

## Langkah 3: Cara penguji menggunakannya

### Web (paling mudah, tiada pemasangan)
1. Hantar alamat `https://…onrender.com` kepada penguji.
2. **Tab 1:** pilih **Saya ibu / bapa** dan masukkan PIN ibu/bapa.
3. **Tab 2:** pilih **Saya anak** dan masukkan PIN anak.
4. Ikut skrip dalam [UJIAN_PENGGUNA.md](UJIAN_PENGGUNA.md).

### Android
1. Kongsi fail `android/app/build/outputs/apk/debug/app-debug.apk` (cth. melalui Google Drive).
2. Penguji pasang APK (benarkan "Pasang aplikasi tidak diketahui").
3. Dalam aplikasi, **Alamat pelayan** = `https://family-guard-xxxx.onrender.com`. Masukkan PIN yang betul.

> **Bangunkan pelayan sebelum sesi ujian:** buka alamat Render dalam pelayar 1 minit lebih awal.

---

## Keselamatan

- Repo GitHub perlu **Private**.
- **Jangan kongsi PIN** di tempat awam. Tukar PIN selepas sesi ujian (Render → Environment).
- Ini **prototaip demo**. Jangan gunakannya untuk data atau wang sebenar.

# Parkir Event — GitHub Pages + Apps Script

```
index.html          Formulir permohonan (publik)
admin.html          Konsol admin & operator (dilindungi PIN)
assets/config.js    URL API + tarif tampilan  <- edit API_URL di sini
assets/api.js       Penghubung fetch ke Apps Script
Code.gs             Backend (tempel di Apps Script, bukan di GitHub Pages)
```

## 1. Backend (Apps Script)
1. Buka spreadsheet > Extensions > Apps Script, tempel isi `Code.gs`.
2. Project Settings > **Script properties**, tambahkan:
   - `DRIVE_FOLDER_ID` = ID folder Drive untuk bukti transfer
   - `INIT_PIN_MANAGEMENT`, `INIT_PIN_OPERATOR1`, `INIT_PIN_OPERATOR2` = PIN 6-10 digit
   - `FONNTE_TOKEN` (opsional)
3. Jalankan fungsi `ensureSheetsExist` lalu `setupPins` (sekali). Properti `INIT_PIN_*` terhapus otomatis.
4. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Salin URL `/exec`.
5. Setiap mengubah `Code.gs`: **Deploy > Manage deployments > Edit > Version: New version > Deploy**.
   Lupa langkah ini adalah penyebab umum fitur baru "tidak ada" di server.

## 2. Frontend (GitHub Pages)
1. Isi `API_URL` di `assets/config.js` dengan URL `/exec`.
2. Push ke GitHub, aktifkan Settings > Pages (branch `main`, folder `/root`).
3. Form: `https://USERNAME.github.io/REPO/` · Admin: `https://USERNAME.github.io/REPO/admin.html`

## Catatan keamanan
- Repo publik aman: tidak ada PIN, token, atau ID folder di kode.
- Halaman admin tetap bisa dibuka siapa saja, tetapi semua data hanya keluar setelah PIN benar. Jangan menautkannya di halaman publik.
- Tes cepat backend: buka URL `/exec` di browser, harus muncul `{"ok":true,"service":"parkir-api",...}`.

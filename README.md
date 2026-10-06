# Parkir Event — GitHub Pages + Apps Script

Semua file frontend ditaruh di **satu folder yang sama** (root repo):

```
index.html     Formulir permohonan (publik)
admin.html     Konsol admin & operator (dilindungi PIN)
config.js      <- isi API_URL di sini
api.js         Penghubung fetch ke Apps Script
Code.gs        Backend: tempel di Apps Script (BUKAN di GitHub Pages)
```

## Backend (Apps Script)
1. Tempel isi `Code.gs`. File HTML lama di project Apps Script (FormUser, AdminDashboard) boleh dihapus.
2. Project Settings > Script properties: `DRIVE_FOLDER_ID`, `INIT_PIN_MANAGEMENT`, `INIT_PIN_OPERATOR1`, `INIT_PIN_OPERATOR2` (opsional `FONNTE_TOKEN`).
3. Jalankan `ensureSheetsExist`, lalu `setupPins` (sekali).
4. Deploy > Web app: Execute as **Me**, akses **Anyone**. Salin URL `/exec`.
5. Setiap mengubah Code.gs: Deploy > Manage deployments > Edit > Version: **New version**.

## Frontend (GitHub Pages)
1. Isi `API_URL` di `config.js`, commit semua file ke root repo.
2. Settings > Pages (branch `main`, folder `/root`).
3. Form: `https://USERNAME.github.io/REPO/` · Admin: `https://USERNAME.github.io/REPO/admin.html`

Tes backend: buka URL `/exec` di browser, harus muncul `{"ok":true,"service":"parkir-api",...}`.
Halaman login admin juga menampilkan status koneksi server.

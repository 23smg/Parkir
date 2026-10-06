// Konfigurasi frontend. Aman untuk repo publik (tidak berisi rahasia).
window.APP_CONFIG = {
  // URL Web App Apps Script: Deploy > Manage deployments > Web app URL (berakhiran /exec)
  API_URL: "GANTI_DENGAN_URL_WEB_APP/exec",

  // Hanya untuk tampilan estimasi. Server selalu menghitung ulang total dari tarif di Code.gs.
  TARIF: { Motor: 5000, Mobil: 15000 }
};

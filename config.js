// Konfigurasi frontend. Aman untuk repo publik (tidak berisi rahasia).
window.APP_CONFIG = {
  // URL Web App Apps Script: Deploy > Manage deployments > Web app URL (berakhiran /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbwGf1NqisGaog7mH3gZ-itIUOHVVfXPD0WwY5EuTiYiLQNGhnNA-3zZ6OvLyocV6lyn/exec",

  // Hanya untuk tampilan estimasi. Server selalu menghitung ulang total dari tarif di Code.gs.
  TARIF: { Motor: 5000, Mobil: 15000 },

  // Detail pembayaran yang dikirim operator lewat WhatsApp setelah permohonan disetujui
  PAYMENT: { bank: "Mandiri", va: "8878720368020000" }
};

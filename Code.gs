// ==========================================================
// PARKIR EVENT ENTERPRISE — Code.gs (versi diperbaiki)
// ==========================================================
// SETUP SEKALI JALAN (Project Settings > Script properties):
//   FONNTE_TOKEN  = token Fonnte (opsional, untuk WA otomatis)
// PIN awal di bawah hanya dipakai SEBELUM PIN diganti lewat dashboard.
// GANTI semuanya segera, lalu ubah dari menu Pengaturan di dashboard.
// ==========================================================

const DRIVE_FOLDER_ID = "1nay88gUpr3hC0e98O3PolF_BXW0AGBxu";
const TZ              = "Asia/Jakarta";
const TARIF           = { Motor: 5000, Mobil: 15000 };   // satu-satunya sumber tarif
const MAX_HARI        = 31;                              // batas durasi per permohonan
const MAX_FILE_BYTES  = 2 * 1024 * 1024;                 // 2 MB (setelah dikompres)
const ALLOW_EMBED     = false;                           // true jika halaman di-embed (mis. Google Sites)
const DEFAULT_PINS    = { management: "123456", operator1: "654321", operator2: "654321" };
const MAX_FAILED_LOGIN = 5;
const LOCKOUT_SECONDS  = 900;                            // 15 menit

const STATUS = {
  PENDING: "Pending Verification",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected"
};

// Nomor kolom (1-based) di sheet Requests
const COL = { ID: 1, TS: 2, NAMA: 3, WA: 4, JENIS: 5, NOPOL: 6, EVENT: 7, START: 8, END: 9,
              HARI: 10, TOTAL: 11, BUKTI: 12, STATUS: 13, CATATAN: 14, WAKTU_WA: 15 };

// ==========================================================
// SETUP SHEET
// ==========================================================
function ensureSheetsExist() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headerStyle = function (sh) {
    sh.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  };

  var req = ss.getSheetByName("Requests");
  if (!req) {
    req = ss.insertSheet("Requests");
    req.appendRow(["ID Request", "Timestamp", "Nama", "No WA", "Jenis", "Nopol", "Event", "Tgl Mulai",
                   "Tgl Selesai", "Total Hari", "Total Bayar", "Bukti URL", "Status", "Catatan", "Waktu Konfirmasi WA"]);
    headerStyle(req);
  }
  // Format teks: mencegah angka 0 di depan nomor WA hilang dan mencegah isi sel dibaca sebagai rumus
  req.getRange("C:G").setNumberFormat("@");
  req.getRange("H:I").setNumberFormat("@");
  req.getRange("N:O").setNumberFormat("@");

  var evt = ss.getSheetByName("Events");
  if (!evt) {
    evt = ss.insertSheet("Events");
    evt.appendRow(["ID Event", "Nama Event", "Tgl Mulai", "Tgl Selesai", "Status"]);
    evt.getRange("C:D").setNumberFormat("@");
    evt.appendRow(["EVT-001", "Pameran Event Semarang 2026", "2026-01-01", "2026-12-31", "Aktif"]);
    headerStyle(evt);
  }
  evt.getRange("C:D").setNumberFormat("@");

  var log = ss.getSheetByName("AuditLog");
  if (!log) {
    log = ss.insertSheet("AuditLog");
    log.appendRow(["Waktu", "User", "Aksi", "Detail"]);
    headerStyle(log);
  }
}

function getSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) { ensureSheetsExist(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
  return sh;
}

function audit_(user, action, detail) {
  try { getSheet_("AuditLog").appendRow([new Date(), user || "-", action, detail || ""]); } catch (e) {}
}

// ==========================================================
// ROUTING
// ==========================================================
function doGet(e) {
  try {
    ensureSheetsExist();
    var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : "user";
    var isAdmin = page === "admin";
    var out = HtmlService.createHtmlOutputFromFile(isAdmin ? "AdminDashboard" : "FormUser")
      .setTitle(isAdmin ? "Enterprise Parking Management System" : "Form Request Parkir Event")
      .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
    if (ALLOW_EMBED) out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return out;
  } catch (err) {
    Logger.log("doGet error: " + err);
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif;padding:40px;text-align:center'>" +
      "<h2>Halaman tidak dapat dimuat</h2><p>Silakan coba lagi beberapa saat lagi.</p></div>");
  }
}

// ==========================================================
// HELPER UMUM
// ==========================================================
function fail_(msg) { return { success: false, message: msg }; }

function todayIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }

function isoDate_(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  var s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function daysBetween_(startIso, endIso) {
  return Math.round((Date.parse(endIso + "T00:00:00Z") - Date.parse(startIso + "T00:00:00Z")) / 86400000) + 1;
}

// Simpan data mentah (HTML di-escape saat dirender di klien). Buang karakter kontrol & awalan rumus.
function cleanText_(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[=+\-@]+/, "")
    .slice(0, max || 100);
}

function normalizeWa_(v) {
  var d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.indexOf("0") === 0) d = "62" + d.slice(1);
  else if (d.indexOf("8") === 0) d = "62" + d;
  return /^62\d{8,13}$/.test(d) ? d : "";
}

function normalizeNopol_(v) {
  var s = String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  var m = s.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
  if (!m) return "";
  return [m[1], m[2], m[3]].filter(Boolean).join(" ");
}

function findRow_(sheet, id, col) {
  var last = sheet.getLastRow();
  if (last < 2 || !id) return 0;
  var vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

// ==========================================================
// AUTENTIKASI (PIN ter-hash + pembatasan percobaan)
// ==========================================================
function hashPin_(pin, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function pinMatches_(user, pin) {
  var rec = PropertiesService.getScriptProperties().getProperty("PIN_" + user);
  if (!rec) return pin === DEFAULT_PINS[user];
  var p = rec.split("$");
  return p.length === 2 && hashPin_(pin, p[0]) === p[1];
}

function authenticate_(inputPin) {
  var cache = CacheService.getScriptCache();
  if (Number(cache.get("login_fail") || 0) >= MAX_FAILED_LOGIN) {
    return { ok: false, message: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit." };
  }
  var pin = String(inputPin == null ? "" : inputPin).trim();
  var users = ["management", "operator1", "operator2"];
  if (pin) {
    for (var i = 0; i < users.length; i++) {
      if (pinMatches_(users[i], pin)) {
        cache.remove("login_fail");
        return { ok: true, user: users[i], role: users[i] === "management" ? "management" : "operator" };
      }
    }
  }
  cache.put("login_fail", String(Number(cache.get("login_fail") || 0) + 1), LOCKOUT_SECONDS);
  return { ok: false, message: "PIN Akses Salah atau Tidak Valid!" };
}

function updateOperatorPin(data, adminPin) {
  var a = authenticate_(adminPin);
  if (!a.ok) return fail_(a.message);
  if (a.role !== "management") return fail_("Akses Ditolak. Hanya Management yang dapat mengubah PIN!");

  var allowed = ["management", "operator1", "operator2"];
  if (!data || allowed.indexOf(data.username) === -1) return fail_("Akun tidak dikenal.");
  var newPin = String(data.newPin == null ? "" : data.newPin).trim();
  if (!/^\d{6,10}$/.test(newPin)) return fail_("PIN harus 6–10 digit angka.");

  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] !== data.username && pinMatches_(allowed[i], newPin)) {
      return fail_("PIN sudah dipakai akun lain. Pilih PIN yang berbeda.");
    }
  }
  var salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("PIN_" + data.username, salt + "$" + hashPin_(newPin, salt));
  audit_(a.user, "UBAH_PIN", data.username);
  return { success: true, message: "PIN untuk " + data.username + " berhasil diperbarui!" };
}

// ==========================================================
// PUBLIK: DAFTAR EVENT & FORM PERMOHONAN
// ==========================================================
function getEvents_() {
  var data = getSheet_("Events").getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    list.push({ id: String(data[i][0] || ""), name: String(data[i][1]), start: isoDate_(data[i][2]),
                end: isoDate_(data[i][3]), status: String(data[i][4] || "Aktif").trim() });
  }
  return list;
}

function activeEvents_() {
  var list = getEvents_().filter(function (e) { return e.status.toLowerCase() === "aktif"; });
  return list.length ? list : [{ id: "", name: "Pameran Event Semarang 2026", start: "", end: "", status: "Aktif" }];
}

function getActiveEvents() {
  try {
    return activeEvents_().map(function (e) { return { name: e.name, start: e.start, end: e.end }; });
  } catch (err) {
    return [{ name: "Pameran Event Semarang 2026", start: "", end: "" }];
  }
}

function submitFormRequest(form, fileData) {
  var lock = LockService.getScriptLock();
  var result, notify = null;
  try {
    form = form || {}; fileData = fileData || {};

    // --- Validasi input ---
    var nama = cleanText_(form.nama, 80);
    if (nama.length < 3) return fail_("Nama lengkap wajib diisi.");
    var wa = normalizeWa_(form.noWhatsapp);
    if (!wa) return fail_("Nomor WhatsApp tidak valid.");
    var jenis = String(form.jenisKendaraan || "");
    if (!Object.prototype.hasOwnProperty.call(TARIF, jenis)) return fail_("Jenis kendaraan tidak valid.");
    var nopol = normalizeNopol_(form.noPolisi);
    if (!nopol) return fail_("Format nomor polisi tidak valid. Contoh: H 1234 ABC.");

    var evName = cleanText_(form.eventName, 120);
    var ev = activeEvents_().filter(function (e) { return e.name === evName; })[0];
    if (!ev) return fail_("Event tidak ditemukan atau sudah tidak aktif.");

    var start = isoDate_(form.startDate), end = isoDate_(form.endDate);
    if (!start || !end) return fail_("Tanggal mulai dan selesai wajib diisi.");
    if (start < todayIso_()) return fail_("Tanggal mulai tidak boleh sebelum hari ini.");
    if (end < start) return fail_("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    if (ev.start && start < ev.start) return fail_("Tanggal mulai di luar periode event.");
    if (ev.end && end > ev.end) return fail_("Tanggal selesai di luar periode event.");
    var hari = daysBetween_(start, end);
    if (hari > MAX_HARI) return fail_("Durasi maksimal " + MAX_HARI + " hari per permohonan.");
    var total = hari * TARIF[jenis];                      // dihitung ulang di server

    var b64 = String(fileData.data || "");
    if (!b64 || b64.length > MAX_FILE_BYTES * 1.4) return fail_("Foto bukti transfer wajib diunggah (maks. 2 MB).");
    var bytes = Utilities.base64Decode(b64);
    if (bytes.length > MAX_FILE_BYTES) return fail_("Ukuran foto terlalu besar (maks. 2 MB).");
    if (!(bytes[0] === -1 && bytes[1] === -40 && bytes[2] === -1)) return fail_("Berkas harus berupa foto JPG.");

    var cache = CacheService.getScriptCache();
    if (cache.get("rl_" + wa)) return fail_("Permohonan dari nomor ini baru saja dikirim. Tunggu 1 menit.");
    cache.put("rl_" + wa, "1", 60);

    // --- Tulis data (di dalam lock) ---
    lock.waitLock(20000);
    var sheet = getSheet_("Requests");

    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[COL.NOPOL - 1]).replace(/\s/g, "") === nopol.replace(/\s/g, "") &&
          String(r[COL.EVENT - 1]) === evName &&
          String(r[COL.STATUS - 1]) !== STATUS.REJECTED &&
          isoDate_(r[COL.START - 1]) <= end && isoDate_(r[COL.END - 1]) >= start) {
        return fail_("Kendaraan ini sudah terdaftar pada periode tersebut (" + r[COL.ID - 1] + ").");
      }
    }

    var requestId = "REQ-" + Utilities.formatDate(new Date(), TZ, "yyyyMMdd-HHmmss") + "-" +
                    Utilities.getUuid().slice(0, 4).toUpperCase();
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file = folder.createFile(Utilities.newBlob(bytes, "image/jpeg", "Bukti_" + requestId + ".jpg"));

    sheet.appendRow([requestId, new Date(), nama, wa, jenis, nopol, evName, start, end, hari, total,
                     file.getUrl(), STATUS.PENDING, "-", "-"]);

    result = { success: true, message: "Permohonan berhasil dikirim!", requestId: requestId, hari: hari, total: total };
    notify = { wa: wa, text: "Halo " + nama + ",\n\nPermohonan parkir Anda (" + requestId + ") untuk event *" + evName +
      "* telah diterima.\nTotal: Rp " + total.toLocaleString("id-ID") + "\nStatus: *Pending Verification*.\n" +
      "Admin sedang memverifikasi bukti pembayaran Anda." };
  } catch (err) {
    Logger.log("submitFormRequest error: " + err);
    return fail_("Terjadi kesalahan sistem. Silakan coba lagi.");
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  if (notify) sendWhatsAppNotification(notify.wa, notify.text);
  return result;
}

// ==========================================================
// ADMIN: PENGAMBILAN DATA
// ==========================================================
function getAdminData(inputPin) {
  var a = authenticate_(inputPin);
  if (!a.ok) return { authorized: false, message: a.message };

  try {
    var reqData = getSheet_("Requests").getDataRange().getValues();
    var requests = [];
    for (var i = 1; i < reqData.length; i++) {
      var r = reqData[i];
      if (!r[COL.ID - 1]) continue;
      var status = String(r[COL.STATUS - 1] || STATUS.PENDING);
      if (status === "Pending") status = STATUS.PENDING;
      if (a.role === "operator" && status !== STATUS.APPROVED && status !== STATUS.COMPLETED) continue;

      var waktu = r[COL.WAKTU_WA - 1];
      requests.push({
        id: String(r[COL.ID - 1]),
        timestamp: r[COL.TS - 1] ? Utilities.formatDate(new Date(r[COL.TS - 1]), TZ, "yyyy-MM-dd HH:mm") : "-",
        nama: String(r[COL.NAMA - 1] || "-"),
        wa: String(r[COL.WA - 1] || ""),
        jenis: String(r[COL.JENIS - 1] || "-"),
        nopol: String(r[COL.NOPOL - 1] || "-"),
        event: String(r[COL.EVENT - 1] || "-"),
        tglMulai: isoDate_(r[COL.START - 1]) || "-",
        tglSelesai: isoDate_(r[COL.END - 1]) || "-",
        totalHari: Number(r[COL.HARI - 1]) || 0,
        totalBayar: Number(r[COL.TOTAL - 1]) || 0,
        buktiUrl: String(r[COL.BUKTI - 1] || "#"),
        status: status,
        catatan: String(r[COL.CATATAN - 1] || "-"),
        waktuKonfirmasiWa: waktu instanceof Date ? Utilities.formatDate(waktu, TZ, "dd/MM/yyyy HH:mm") : String(waktu || "-")
      });
    }

    var eventsList = [];
    if (a.role === "management") {
      eventsList = getEvents_().map(function (e) {
        return { id: e.id, nama: e.name, start: e.start || "-", end: e.end || "-", status: e.status || "Aktif" };
      });
    }
    return { authorized: true, role: a.role, user: a.user, requests: requests, eventsList: eventsList };
  } catch (err) {
    Logger.log("getAdminData error: " + err);
    return { authorized: false, message: "Gagal membaca Spreadsheet." };
  }
}

// ==========================================================
// ADMIN: MUTASI
// ==========================================================
function updateStatus(requestId, newStatus, inputPin, catatan) {
  var a = authenticate_(inputPin);
  if (!a.ok) return fail_(a.message);

  var lock = LockService.getScriptLock();
  var notify = null;
  try {
    lock.waitLock(15000);
    var sheet = getSheet_("Requests");
    var row = findRow_(sheet, requestId, COL.ID);
    if (!row) return fail_("Data permohonan tidak ditemukan.");

    var cur = sheet.getRange(row, 1, 1, 15).getValues()[0];
    var curStatus = String(cur[COL.STATUS - 1] || STATUS.PENDING);
    if (curStatus === "Pending") curStatus = STATUS.PENDING;
    newStatus = String(newStatus);
    var note = cleanText_(catatan, 200);

    var allowed =
      (a.role === "management" && curStatus === STATUS.PENDING &&
        (newStatus === STATUS.APPROVED || newStatus === STATUS.REJECTED)) ||
      (a.role === "operator" && newStatus === STATUS.COMPLETED &&
        (curStatus === STATUS.APPROVED || curStatus === STATUS.COMPLETED));
    if (!allowed) return fail_("Perubahan status ini tidak diizinkan untuk akun Anda.");
    if (newStatus === STATUS.REJECTED && !note) return fail_("Alasan penolakan wajib diisi.");

    var firstCompletion = curStatus !== STATUS.COMPLETED;
    sheet.getRange(row, COL.STATUS).setValue(newStatus);
    if (note && (newStatus !== STATUS.COMPLETED || firstCompletion)) sheet.getRange(row, COL.CATATAN).setValue(note);
    if (newStatus === STATUS.COMPLETED && firstCompletion) {
      sheet.getRange(row, COL.WAKTU_WA).setValue(Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss"));
    }
    audit_(a.user, "STATUS_" + newStatus.toUpperCase(), requestId);

    var nama = cur[COL.NAMA - 1], ev = cur[COL.EVENT - 1], nopol = cur[COL.NOPOL - 1], wa = String(cur[COL.WA - 1]);
    if (newStatus === STATUS.APPROVED) {
      notify = { wa: wa, text: "Halo " + nama + ",\n\nPermohonan parkir *" + requestId + "* untuk event *" + ev +
        "* (" + nopol + ") telah *disetujui*. Petugas akan mengirim konfirmasi akses." };
    } else if (newStatus === STATUS.REJECTED) {
      notify = { wa: wa, text: "Halo " + nama + ",\n\nMohon maaf, permohonan parkir *" + requestId +
        "* belum dapat disetujui.\nAlasan: " + note + "\nSilakan ajukan kembali dengan data yang sesuai." };
    }
  } catch (err) {
    Logger.log("updateStatus error: " + err);
    return fail_("Gagal memperbarui status.");
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  if (notify) sendWhatsAppNotification(notify.wa, notify.text);
  return { success: true };
}

function addOrUpdateEvent(eventData, inputPin) {
  var a = authenticate_(inputPin);
  if (!a.ok) return fail_(a.message);
  if (a.role !== "management") return fail_("Unauthorized");

  eventData = eventData || {};
  var nama = cleanText_(eventData.nama, 120);
  if (!nama) return fail_("Nama event wajib diisi.");
  var start = isoDate_(eventData.start), end = isoDate_(eventData.end);
  if (start && end && end < start) return fail_("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  var status = eventData.status === "Nonaktif" ? "Nonaktif" : "Aktif";

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet_("Events");
    if (eventData.id) {
      var row = findRow_(sheet, eventData.id, 1);
      if (!row) return fail_("Event tidak ditemukan.");
      sheet.getRange(row, 2, 1, 4).setValues([[nama, start, end, status]]);
      audit_(a.user, "EDIT_EVENT", eventData.id);
    } else {
      var id = "EVT-" + Utilities.formatDate(new Date(), TZ, "MMddHHmmss") + Utilities.getUuid().slice(0, 2).toUpperCase();
      sheet.appendRow([id, nama, start, end, status]);
      audit_(a.user, "TAMBAH_EVENT", id);
    }
    return { success: true };
  } catch (err) {
    Logger.log("addOrUpdateEvent error: " + err);
    return fail_("Gagal menyimpan event.");
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function deleteEvent(eventId, inputPin) {
  var a = authenticate_(inputPin);
  if (!a.ok) return fail_(a.message);
  if (a.role !== "management") return fail_("Unauthorized");

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet_("Events");
    var row = findRow_(sheet, eventId, 1);
    if (!row) return fail_("Event tidak ditemukan.");
    sheet.deleteRow(row);
    audit_(a.user, "HAPUS_EVENT", eventId);
    return { success: true };
  } catch (err) {
    Logger.log("deleteEvent error: " + err);
    return fail_("Gagal menghapus event.");
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ==========================================================
// NOTIFIKASI WHATSAPP (Fonnte) — token dari Script Properties
// ==========================================================
function sendWhatsAppNotification(target, message) {
  var token = PropertiesService.getScriptProperties().getProperty("FONNTE_TOKEN");
  if (!token || !target) return;
  try {
    UrlFetchApp.fetch("https://api.fonnte.com/send", {
      method: "post",
      headers: { Authorization: token },
      payload: { target: target, message: message },
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Fonnte error: " + e); }
}

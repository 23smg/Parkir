// Penghubung ke Apps Script Web App lewat fetch (JSON).
// Memakai Content-Type text/plain agar tidak memicu preflight CORS.
(function (w) {
  var cfg = w.APP_CONFIG || {};

  function fail(msg) { return Promise.reject(new Error(msg)); }

  w.Api = {
    call: function (fn, args) {
      if (!cfg.API_URL || /GANTI/.test(cfg.API_URL)) {
        return fail('API_URL belum diisi. Edit assets/config.js dengan URL Web App Apps Script Anda.');
      }
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 45000);

      return fetch(cfg.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fn, args: args || [] }),
        redirect: 'follow',
        signal: ctrl.signal
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('Server mengembalikan status ' + r.status + '.');
        return r.json();
      }).then(function (j) {
        if (j && j.ok) return j.data;
        throw new Error((j && j.error) || 'Respons server tidak valid.');
      }).catch(function (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('Server tidak merespons (timeout). Coba lagi.');
        if (e instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet, API_URL, dan setelan deploy (akses: Anyone).');
        throw e;
      });
    }
  };
})(window);

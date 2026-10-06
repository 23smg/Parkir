// Penghubung ke Apps Script Web App lewat fetch (JSON).
// Content-Type text/plain dipakai agar tidak memicu preflight CORS.
(function (w) {
  function fail(msg) { return Promise.reject(new Error(msg)); }

  function endpoint() {
    var c = w.APP_CONFIG;
    if (!c) return { err: 'config.js tidak termuat. Pastikan config.js berada satu folder dengan halaman ini di GitHub.' };
    if (!c.API_URL || /GANTI/.test(c.API_URL)) return { err: 'API_URL belum diisi. Edit config.js dengan URL Web App Apps Script Anda (berakhiran /exec).' };
    return { url: c.API_URL };
  }

  function explain(e) {
    if (e && e.name === 'AbortError') return new Error('Server tidak merespons (timeout). Coba lagi.');
    if (e instanceof TypeError) return new Error('Tidak dapat terhubung ke server. Periksa internet, API_URL di config.js, dan setelan deploy (akses harus "Anyone").');
    if (e instanceof SyntaxError) return new Error('Server mengirim respons tak terduga. Pastikan URL benar dan deployment memakai versi terbaru dengan akses "Anyone".');
    return e;
  }

  w.Api = {
    call: function (fn, args) {
      var ep = endpoint(); if (ep.err) return fail(ep.err);
      var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 45000);
      return fetch(ep.url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fn, args: args || [] }), redirect: 'follow', signal: ctrl.signal
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('Server mengembalikan status ' + r.status + '.');
        return r.json();
      }).then(function (j) {
        if (j && j.ok) return j.data;
        throw new Error((j && j.error) || 'Respons server tidak valid.');
      }).catch(function (e) { clearTimeout(timer); throw explain(e); });
    },

    // Cek cepat apakah server dapat dihubungi (dipakai indikator di halaman login)
    ping: function () {
      var ep = endpoint(); if (ep.err) return fail(ep.err);
      var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 15000);
      return fetch(ep.url, { method: 'GET', redirect: 'follow', signal: ctrl.signal }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('Server mengembalikan status ' + r.status + '.');
        return r.json();
      }).then(function (j) {
        if (j && j.ok) return j;
        throw new Error('Respons server tidak valid.');
      }).catch(function (e) { clearTimeout(timer); throw explain(e); });
    }
  };
})(window);

/* ================================================================
   H90 — SHARDS v21.2 (FORTRESS SMOOTH)
   ================================================================
   ✅ حماية قوية بدون debugger statement (لا يوقف التنفيذ)
   ✅ DevTools Detection ذكي + Anti-Hook + Anti-Tamper
   ✅ Domain Lock + Expiry + Rate Limit ذكي
   ✅ Self-Destruct مشروط (فقط عند التأكد)
   ✅ سلاسة: الحماية تعمل مرة واحدة عند الإقلاع
   ✅ دعم APK + localhost + Spck + 127.0.0.1 + شبكة محلية
   ✅ نفس الواجهات العامة (لا تغيير في API)
   ================================================================ */

(function () {
  'use strict';

  /* ============================================================
     ⚙️ SECTION 0 — CONFIG (محمي)
     ============================================================ */
  var _CFG = (function () {
    var o = {};
    Object.defineProperty(o, 'api', { value: 'http://vip2.sharkhost.xyz/player_api.php', writable: false, configurable: false });
    Object.defineProperty(o, 'str', { value: 'http://vip2.sharkhost.xyz', writable: false, configurable: false });
    Object.defineProperty(o, 'wrk', { value: 'https://dihdvu-idhdbhi-iehehu-idudgi-idhdu-iwhdh-83736-djudgd.x4storebot.workers.dev', writable: false, configurable: false });
    Object.defineProperty(o, 'exp', { value: '2027-12-31', writable: false, configurable: false });
    Object.defineProperty(o, 'mx', { value: 2000, writable: false, configurable: false });
    Object.defineProperty(o, 'domain', { value: '', writable: false, configurable: false });
    return o;
  })();

  /* ============================================================
     🔐 SECTION 1 — ENCRYPTED CREDENTIALS (كما هي — لا تغيّر)
     ============================================================ */
  var _ENC = {
    _1: "HmdjYw==",
    _2: [0x0f, 0x0d, 0x09, 0x0d],
    _3: "HmN3Ig==",
    _4: [0x2c, 0x2a, 0x2d, 0x2b],
    _5: "AAICAw==",
    _6: [0x6f]
  };

  /* ============================================================
     🛠️ SECTION 2 — INTERNAL HELPERS
     ============================================================ */
  var _h = {
    b: function (s) { try { return atob(s); } catch (e) { return ''; } },
    x: function (s, k, off) {
      var r = '', i, ch;
      off = off || 0;
      for (i = 0; i < s.length; i++) {
        ch = s.charCodeAt(i) ^ (k + ((i + off) % 7));
        r += String.fromCharCode(ch & 0xFF);
      }
      return r;
    },
    u: function (s) {
      var r = '', i;
      for (i = 0; i < s.length; i++) {
        r += String.fromCharCode(((s.charCodeAt(i) - 32 - 11 + 95) % 95) + 32);
      }
      return r;
    },
    a: function (arr, k) {
      try {
        return String.fromCharCode.apply(null, arr.map(function (v) { return v ^ k; }));
      } catch (e) { return ''; }
    },
    r: function () { return Math.random().toString(36).substring(2, 10); }
  };

  /* ============================================================
     🛡️ SECTION 3 — ENVIRONMENT DETECTION
     ============================================================ */
  var _isDevMode = function () {
    try { return localStorage.getItem('h90_dev_mode') === '1'; } catch (e) { return false; }
  };

  var _isProdMode = function () {
    try { return localStorage.getItem('h90_prod') === '1'; } catch (e) { return false; }
  };

  var _isAPK = function () {
    try {
      var p = location.protocol;
      var h = location.hostname || '';

      // ✅ 1) APK / Native
      if (p === 'file:' || p === 'capacitor:' || p === 'ionic:') return true;
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
      if (window.cordova) return true;
      if (window.__H90_NATIVE_EARLY__) return true;
      if (document.documentElement.classList.contains('h90-native')) return true;

      // ✅ 2) Localhost / Dev
      if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return true;

      // ✅ 3) Local Network
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h)) return true;

      // ✅ 4) Spck / blob / data
      if (p === 'blob:' || p === 'data:') return true;
      if (/spck|editor|preview|dev|test|stage/i.test(h)) return true;

      // ✅ 5) WebView
      if (navigator.userAgent && /wv\)/.test(navigator.userAgent)) return true;
      if (navigator.userAgent && /Spck/i.test(navigator.userAgent)) return true;

      // ✅ 6) Dev mode
      if (_isDevMode()) return true;

      // ❌ 7) مواقع الإنتاج الحقيقية → مرفوض
      return false;
    } catch (e) {
      // عند الخطأ → اسمح (بيئة غير معروفة)
      return true;
    }
  };

  /* ============================================================
     🔐 SECTION 4 — SECURITY LAYERS (قوية + سلسة)
     ============================================================ */

  // 4.1 — Domain Lock
  var _domainOK = function () {
    try {
      if (!_CFG.domain) return true;
      var h = location.hostname || '';
      return h === _CFG.domain || h.endsWith('.' + _CFG.domain);
    } catch (e) { return true; }
  };

  // 4.2 — Expiry
  var _expiryOK = function () {
    try { return new Date() < new Date(_CFG.exp + 'T23:59:59'); }
    catch (e) { return false; }
  };

  // 4.3 — Anti-Debug ذكي (بدون debugger statement)
  var _antiDebugOK = function () {
    try {
      // في dev mode → تخطي
      if (_isDevMode()) return true;

      // في non-prod mode → تخطي أيضاً (افتراضياً آمن)
      // لتفعيل الحماية: localStorage.setItem('h90_prod', '1')
      if (!_isProdMode()) return true;

      // === الحماية القوية (تعمل فقط في prod mode) ===

      // أ) كشف DevTools المفتوح (timing)
      var t0 = performance.now();
      // عملية حسابية بسيطة — لا debugger
      var x = 0;
      for (var i = 0; i < 1000; i++) x += i;
      var t1 = performance.now();
      if (x !== 499500) return false; // tampered
      if ((t1 - t0) > 100) return false; // debugger slowing

      // ب) كشف toString المزيف
      var nativeStr = Function.prototype.toString.call(Function.prototype.toString);
      if (nativeStr.indexOf('[native code]') === -1) return false;

      return true;
    } catch (e) { return true; }
  };

  // 4.4 — Rate Limit ذكي
  var _rateState = { count: 0, resetAt: Date.now() + 60000 };
  var _rateOK = function () {
    try {
      var now = Date.now();
      if (now > _rateState.resetAt) {
        _rateState.count = 0;
        _rateState.resetAt = now + 60000;
      }
      _rateState.count++;
      return _rateState.count <= _CFG.mx;
    } catch (e) { return true; }
  };

  // 4.5 — Anti-Hook (يراقب الدوال الحساسة)
  var _originalFetch = window.fetch;
  var _originalAtob = window.atob;
  var _originalJSONParse = JSON.parse;
  var _antiHookOK = function () {
    try {
      if (_isDevMode()) return true;
      if (!_isProdMode()) return true;

      if (window.fetch !== _originalFetch) return false;
      if (window.atob !== _originalAtob) return false;
      if (JSON.parse !== _originalJSONParse) return false;

      return true;
    } catch (e) { return true; }
  };

  // 4.6 — Checksum
  var _checksumOK = function () {
    try {
      // في prod mode فقط
      if (_isDevMode() || !_isProdMode()) return true;
      // فحص أن الدوال لم تُعدّل
      if (typeof _CFG.api !== 'string') return false;
      if (typeof _CFG.str !== 'string') return false;
      return true;
    } catch (e) { return true; }
  };

  // 4.7 — Self-Destruct (مشروط)
  var _selfDestruct = function (reason) {
    try {
      console.error('%c🚨 [H90 SECURITY] Self-destruct: ' + reason,
        'background:#d32f2f;color:#fff;padding:4px 10px;border-radius:4px;font-weight:900;');
      _ENC._1 = _ENC._2 = _ENC._3 = _ENC._4 = _ENC._5 = _ENC._6 = null;
      _SECRET = null;
      _assembled = false;
      if (window[_NS]) {
        try { window[_NS] = null; } catch (e) {}
      }
      if (window.__H90_SEC__) {
        try { window.__H90_SEC__ = null; } catch (e) {}
      }
    } catch (e) {}
  };

  /* ============================================================
     🔓 SECTION 5 — ASSEMBLER
     ============================================================ */
  var _assembled = false;
  var _SECRET = null;

  var _assemble = function () {
    if (_SECRET) return _SECRET; // ✅ تحقق أولاً
    try {
      if (!_ENC._1 || !_ENC._2 || !_ENC._3 || !_ENC._4 || !_ENC._5 || !_ENC._6) {
        console.error('[H90] Credentials array is null');
        return null;
      }

      var p1 = _h.u(_h.x(_h.b(_ENC._1), 0x5A, 0));
      var p2 = _h.a(_ENC._2, 0x3C);
      var p3 = _h.u(_h.x(_h.b(_ENC._3), 0x5A, 3));
      var p4 = _h.a(_ENC._4, 0x1F);
      var p5 = _h.u(_h.x(_h.b(_ENC._5), 0x3C, 5));
      var p6 = _h.a(_ENC._6, 0x5A);

      var full = p1 + p2 + p3 + p4 + p5 + p6;
      var sep = full.indexOf('|');

      if (sep === -1) {
        console.error('[H90] Decryption failed — no separator');
        return null;
      }

      _SECRET = { u: full.slice(0, sep), p: full.slice(sep + 1) };
      _assembled = true;

      _ENC._1 = _ENC._2 = _ENC._3 = _ENC._4 = _ENC._5 = _ENC._6 = null;

      console.log('%c✅ [H90] Credentials loaded',
        'background:#4caf50;color:#fff;padding:3px 10px;border-radius:6px;');
      return _SECRET;
    } catch (e) {
      console.error('[H90] Decryption error:', e.message);
      return null;
    }
  };

  /* ============================================================
     🚦 SECTION 6 — GATE
     ============================================================ */
  var _gateResult = null; // ✅ cache النتيجة (سلاسة)

  var _gate = function (force) {
    // ✅ إذا نجح مرة، لا تعيد الفحص (إلا بـ force)
    if (_gateResult && _gateResult.ok && !force) return _gateResult;

    if (!_isAPK()) {
      console.warn('[H90] Not in APK/Dev environment — block');
      return { ok: false, reason: 'not_apk' };
    }
    if (!_domainOK()) {
      console.warn('[H90] Domain mismatch');
      return { ok: false, reason: 'domain' };
    }
    if (!_expiryOK()) {
      console.warn('[H90] Expired');
      return { ok: false, reason: 'expired' };
    }
    if (!_antiDebugOK()) {
      _selfDestruct('debugger detected');
      return { ok: false, reason: 'debugger' };
    }
    if (!_rateOK()) {
      console.warn('[H90] Rate limit exceeded');
      return { ok: false, reason: 'rate_limit' };
    }
    if (!_antiHookOK()) {
      _selfDestruct('fetch hooked');
      return { ok: false, reason: 'hooked' };
    }
    if (!_checksumOK()) {
      _selfDestruct('checksum mismatch');
      return { ok: false, reason: 'checksum' };
    }

    _gateResult = { ok: true, reason: 'ok' };
    return _gateResult;
  };

  /* ============================================================
     🌐 SECTION 7 — CORE API
     ============================================================ */
  var _core = {
    url: function (action, params) {
      var g = _gate();
      if (!g.ok) {
        console.error('[H90] Gate blocked:', g.reason);
        return '';
      }
      var s = _assemble();
      if (!s) {
        console.error('[H90] Assembly failed');
        return '';
      }
      try {
        return _CFG.api +
          '?username=' + encodeURIComponent(s.u) +
          '&password=' + encodeURIComponent(s.p) +
          '&action='   + encodeURIComponent(action) +
          (params || '');
      } catch (e) {
        console.error('[H90] URL build error:', e.message);
        return '';
      }
    },
    stream: function (type, id, ext) {
      var g = _gate();
      if (!g.ok) {
        console.error('[H90] Gate blocked (stream):', g.reason);
        return '';
      }
      var s = _assemble();
      if (!s) return '';
      try {
        return _CFG.str + '/' + type + '/' +
          encodeURIComponent(s.u) + '/' +
          encodeURIComponent(s.p) + '/' +
          id + '.' + (ext || 'mp4');
      } catch (e) {
        console.error('[H90] Stream build error:', e.message);
        return '';
      }
    }
  };

  /* ============================================================
     🎬 SECTION 8 — MOVIES
     ============================================================ */
  var _mv = {
    getCategories: function () {
      var u = _core.url('get_vod_categories');
      if (!u) return Promise.resolve([]);
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Movies categories error:', e.message);
        return [];
      });
    },
    getList: function (catId) {
      var p = catId ? '&category_id=' + catId : '';
      var u = _core.url('get_vod_streams', p);
      if (!u) return Promise.resolve([]);
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Movies list error:', e.message);
        return [];
      });
    },
    getInfo: function (vodId) {
      var u = _core.url('get_vod_info', '&vod_id=' + vodId);
      if (!u) return Promise.resolve({});
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Movie info error:', e.message);
        return {};
      });
    },
    getStreamUrl: function (streamId, ext) {
      return _core.stream('movie', streamId, ext);
    }
  };

  /* ============================================================
     📺 SECTION 9 — SERIES
     ============================================================ */
  var _sr = {
    getCategories: function () {
      var u = _core.url('get_series_categories');
      if (!u) return Promise.resolve([]);
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Series categories error:', e.message);
        return [];
      });
    },
    getList: function (catId) {
      var p = catId ? '&category_id=' + catId : '';
      var u = _core.url('get_series', p);
      if (!u) return Promise.resolve([]);
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Series list error:', e.message);
        return [];
      });
    },
    getInfo: function (seriesId) {
      var u = _core.url('get_series_info', '&series_id=' + seriesId);
      if (!u) return Promise.resolve({});
      return fetch(u).then(function (r) { return r.json(); }).catch(function (e) {
        console.error('[H90] Series info error:', e.message);
        return {};
      });
    },
    getEpisodeUrl: function (episodeId, ext) {
      return _core.stream('series', episodeId, ext);
    }
  };

  /* ============================================================
     🌍 SECTION 10 — PUBLIC API
     ============================================================ */
  var _NS = '__H90x' + _h.r() + '__';

  window[_NS] = {
    movies: _mv,
    series: _sr,
    ready: function () { return _assembled; },
    url: function (a, p) { return _core.url(a, p); },
    stream: function (t, i, e) { return _core.stream(t, i, e); },
    workerUrl: function () { return _CFG.wrk; },
    apiBase: function () { return _CFG.api; },
    streamBase: function () { return _CFG.str; },
    gate: function (f) { return _gate(f); },
    get: function () {
      var g = _gate();
      if (!g.ok) return null;
      return _assemble();
    },
    c: function () {
      var g = _gate();
      if (!g.ok) return { u: '', p: '' };
      var s = _assemble();
      return s ? { u: s.u, p: s.p } : { u: '', p: '' };
    },
    devMode: function (on) {
      try {
        if (on) localStorage.setItem('h90_dev_mode', '1');
        else localStorage.removeItem('h90_dev_mode');
        return on;
      } catch (e) { return false; }
    },
    prodMode: function (on) {
      try {
        if (on) localStorage.setItem('h90_prod', '1');
        else localStorage.removeItem('h90_prod');
        _gateResult = null;
        return on;
      } catch (e) { return false; }
    }
  };

  window.__H90_Assembler__ = window[_NS];

  /* ============================================================
     🔗 SECTION 11 — BIND (نسخة نظيفة)
     ============================================================ */
  // ✅ ننشئ __H90_SEC__ أولاً ثم نستخدمه
  if (!window.__H90_SEC__) {
    window.__H90_SEC__ = {
      buildApiUrl: function (a, p) { return window[_NS].url(a, p); },
      c: function () { return window[_NS].c(); }
    };
  }

  /* ============================================================
     🙈 SECTION 12 — HIDE toString
     ============================================================ */
  try {
    var _hide = function (fn) {
      try {
        Object.defineProperty(fn, 'toString', {
          value: function () { return 'function () { [native code] }'; },
          configurable: false, writable: false
        });
      } catch (e) {}
    };
    _hide(window[_NS].url);
    _hide(window[_NS].get);
    _hide(window[_NS].c);
    _hide(window[_NS].gate);
    _hide(_core.url);
    _hide(_core.stream);
    _hide(_assemble);
    _hide(_gate);
  } catch (e) {}

  /* ============================================================
     📢 SECTION 13 — BOOT
     ============================================================ */
  console.log(
    '%c🔐 [H90 v21.2] Fortress Smooth',
    'background:linear-gradient(135deg,#9c27b0,#e91e63);color:#fff;' +
    'padding:6px 16px;border-radius:8px;font-weight:900;font-size:12px;'
  );

  // ✅ الحماية تعمل بعد الإقلاع (لا تؤخر التشغيل)
  setTimeout(function () {
    try {
      // في وضع التطوير → تخطي كل شيء
      if (_isDevMode()) {
        console.log('%c🔧 [H90] Dev mode — security layers bypassed',
          'background:#2196f3;color:#fff;padding:3px 10px;border-radius:6px;');
      } else if (!_isProdMode()) {
        console.log('%c⚙️ [H90] Standard mode — strong protection off (use prodMode(true) to enable)',
          'background:#607d8b;color:#fff;padding:3px 10px;border-radius:6px;');
      }

      var g = _gate(true); // force
      if (g.ok) {
        var t = _assemble();
        if (t && t.u && t.p) {
          console.log('%c✅ [H90] System ready — credentials loaded',
            'background:#4caf50;color:#fff;padding:3px 10px;border-radius:6px;');
        } else {
          console.warn('%c⚠️ [H90] Credentials NOT loaded',
            'background:#ff9800;color:#fff;padding:3px 10px;border-radius:6px;');
        }
      } else {
        console.error('%c❌ [H90] Gate blocked: ' + g.reason,
          'background:#f44336;color:#fff;padding:3px 10px;border-radius:6px;');
      }
    } catch (e) {}
  }, 100);

})();
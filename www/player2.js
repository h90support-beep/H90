/* ================================================================
   H90 Movies & Series Player — player2.js v8.0 (Universal)
   ================================================================
   ✅ إصلاح "خطأ في الشبكة" عند التقديم/التأخير (سحب الشريط / لمس / مزدوج)
        - تجميع طلبات التقديم (debounce) بدل إغراق السيرفر بطلبات Range
        - استرجاع تلقائي: إعادة تحميل المصدر من نفس الموضع قبل إظهار أي خطأ
        - مراقب تعليق (Stall Watchdog) + إعادة الاتصال عند عودة الإنترنت
   ✅ محرّر مناطق الإيماءات (زر في الشريط العلوي أو مفتاح G):
        - اسحب الخطوط لتحديد منطقة السطوع / التقديم / الصوت
        - اسحب الحواف البرتقالية لتحديد الحواف الميتة (تتجاهل اللمس)
        - تبديل الصوت/السطوع، تفعيل/تعطيل كل إيماءة، الحساسية، قفزة النقر المزدوج
        - يعمل داخل وضع ملء الشاشة وكل الأوضاع ويُحفظ تلقائياً
   ✅ تحميل مسبق ذكي: الحلقة/الفيلم التالي (MP4 + HLS) + preconnect للسيرفر
   ✅ تخزين مؤقت متكيّف حسب سرعة الشبكة (HLS) ووضع توفير البيانات
   ✅ شريط تقدم سلس (rAF) + Media Session Position
   ================================================================
   إعدادات اختيارية قبل التشغيل:
     H90MoviesPlayer.config.hlsLocal = 'libs/hls.min.js';
     H90MoviesPlayer.config.screenshotCors = true;
     H90MoviesPlayer.config.prefetchEnabled = false; // لإيقاف التحميل المسبق
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     🌐 [1] كشف البيئة
     ================================================================ */
  const ENV = (function () {
    const ua = navigator.userAgent;
    const cap = window.Capacitor;
    return {
      isIOS: (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !window.MSStream,
      isAndroid: /Android/i.test(ua),
      isMobile: /Mobi|Android|iPhone|iPad|iPod/i.test(ua),
      isSafari: /^((?!chrome|android).)*safari/i.test(ua),
      isChrome: /Chrome/i.test(ua) && !/Edg/i.test(ua),
      isPWA: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             window.navigator.standalone === true,
      isCapacitor: !!(cap && cap.isNativePlatform && cap.isNativePlatform()),
      isCordova: !!window.cordova,
      isNative: (function () {
        try {
          return !!(
            (cap && cap.isNativePlatform && cap.isNativePlatform()) ||
            window.cordova ||
            location.protocol === 'file:'
          );
        } catch (e) { return false; }
      })(),
      isHTTPS: location.protocol === 'https:',
      canPlayHLS: (function () {
        try { return document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== ''; }
        catch (e) { return false; }
      })()
    };
  })();

  function plugin(name) {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null; }
    catch (e) { return null; }
  }

  /* ================================================================
     ⚙️ إعدادات عامة
     ================================================================ */
  const CONFIG = {
    hlsLocal: '',
    hlsCdn: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js',
    screenshotCors: false,
    hlsMaxNetRetries: 4,
    resumeEnabled: true,
    wvcPackage: 'com.instantbits.cast.webvideo',
    wvcStoreUrl: 'https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo',

    // التقديم/التأخير
    seekDebounceMs: 220,          // تجميع طلبات التقديم المتتالية
    maxRecoverAttempts: 4,        // محاولات الاسترجاع التلقائي قبل إظهار الخطأ
    stallTimeoutMs: 12000,        // تعليق أطول من هذا = إعادة اتصال

    // التحميل المسبق الذكي
    prefetchEnabled: true,
    prefetchAtPercent: 0.5,       // يبدأ عند 50% من الحلقة الحالية
    prefetchSeconds: 40,          // كم ثانية يحمّل مسبقاً من MP4
    prefetchHlsSegments: 3        // عدد مقاطع HLS التي تُسخَّن
  };

  const FORMATS = {
    UNSUPPORTED: ['mkv', 'avi', 'flv', 'wmv', 'ts', 'mpg', 'mpeg', '3gp'],
    HLS_EXT: ['m3u8']
  };

  /* ================================================================
     🎯 detectFormat
     ================================================================ */
  function detectFormat(url) {
    if (!url || typeof url !== 'string') {
      return { ext: 'unknown', isHLS: false, isUnsupported: false, isHttp: false, isWorkerStream: false };
    }
    const isHttp = url.indexOf('http://') === 0;
    const isHLSUrl = /\.m3u8(\?|#|$)/i.test(url);
    const isWorkerStream = /\/stream\//i.test(url) || /\/v\//i.test(url);

    if (isHLSUrl) {
      return { ext: 'm3u8', isHLS: true, isUnsupported: false, isHttp: isHttp, isWorkerStream: isWorkerStream };
    }
    if (isWorkerStream) {
      return { ext: 'mp4', isHLS: false, isUnsupported: false, isHttp: isHttp, isWorkerStream: true };
    }
    const clean = url.split('?')[0].split('#')[0].toLowerCase();
    const ext = clean.split('.').pop();
    return {
      ext: ext,
      isHLS: FORMATS.HLS_EXT.indexOf(ext) !== -1,
      isUnsupported: FORMATS.UNSUPPORTED.indexOf(ext) !== -1,
      isHttp: isHttp,
      isWorkerStream: false
    };
  }

  /* ================================================================
     📥 hls.js loader (محلي ثم CDN)
     ================================================================ */
  let _hlsPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(!!window.Hls); };
      s.onerror = function () { s.remove(); resolve(false); };
      document.head.appendChild(s);
    });
  }
  function ensureHlsLoaded() {
    if (window.Hls && window.Hls.isSupported()) return Promise.resolve(true);
    if (_hlsPromise) return _hlsPromise;
    _hlsPromise = (async function () {
      const sources = [];
      if (CONFIG.hlsLocal) sources.push(CONFIG.hlsLocal);
      if (CONFIG.hlsCdn) sources.push(CONFIG.hlsCdn);
      for (let i = 0; i < sources.length; i++) {
        if (await loadScript(sources[i])) return true;
      }
      return false;
    })();
    _hlsPromise.then(function (ok) { if (!ok) _hlsPromise = null; });
    return _hlsPromise;
  }

  /* ================================================================
     🔐 طبقات الحماية
     ================================================================ */
  (function verifySignatureEarly() {
    try {
      if (window.H90SignVerifier && typeof window.H90SignVerifier.verify === 'function') {
        window.H90SignVerifier.verify().catch(function () {});
      }
    } catch (e) {}
  })();

  const URL_LOCK = (function () {
    const map = new Map();
    let counter = 0;
    return {
      protect: function (url) {
        if (!url) return '';
        const token = '__url_' + (++counter) + '_' + Math.random().toString(36).substring(2, 8);
        map.set(token, url);
        return token;
      },
      resolve: function (t) { return map.get(t) || ''; },
      wipe: function (t) { map.delete(t); },
      wipeAll: function () { map.clear(); }
    };
  })();

  const RATE_LIMIT = (function () {
    const ops = new Map();
    return {
      check: function (key, maxPerSecond) {
        const now = Date.now();
        const list = (ops.get(key) || []).filter(function (t) { return now - t < 1000; });
        if (list.length >= maxPerSecond) return false;
        list.push(now);
        ops.set(key, list);
        return true;
      }
    };
  })();

  (function protectConsole() {
    try {
      if (console._h90masked) return;
      const orig = console.log;
      console.log = function () {
        const args = Array.prototype.slice.call(arguments).map(function (a) {
          return typeof a === 'string'
            ? a.replace(/(https?:\/\/[^\s]{40,})/g, function (m) { return m.substring(0, 20) + '...[masked]'; })
            : a;
        });
        orig.apply(console, args);
      };
      console._h90masked = true;
    } catch (e) {}
  })();

  function bindAntiCopyGuards(rootEl) {
    if (!rootEl) return;
    ['copy', 'cut', 'paste', 'dragstart', 'selectstart', 'contextmenu'].forEach(function (ev) {
      rootEl.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
    });
  }

  /* ================================================================
     🌐 الحالة
     ================================================================ */
  const GESTURE_DEFAULTS = {
    left: 35,      // نهاية منطقة اليسار (٪ من العرض)
    right: 65,     // بداية منطقة اليمين (٪)
    edge: 2,       // عرض الحافة الميتة من كل جهة (٪)
    swap: false,   // false: يسار=سطوع ، يمين=صوت
    bri: true, vol: true, seek: true,
    sens: 1,       // حساسية السحب
    dt: 10,        // ثواني النقر المزدوج
    dtOn: true
  };

  const MP = {
    video: null, screen: null, loading: null, header: null, controls: null, welcome: null,
    isNative: false, isLocked: false, isFullscreen: false, _fsMode: null,

    currentUrl: '', currentTitle: '', currentPoster: '', currentId: '',
    _urlToken: '', _lastPlay: null,
    _currentFormat: null, _lastError: null,
    _resumeKey: '', _lastSave: 0, _subtitleUrl: '',
    _disposers: [],

    // التقديم والاسترجاع
    _pendingSeek: null, _seekTimer: 0, _seeking: false,
    _startAt: null, _startFromResume: false,
    _lastGoodTime: 0, _stallTimer: 0, _raf: 0, _lastPosState: 0,
    _recover: { count: 0, timer: 0, okSince: 0 },

    // الإيماءات
    g: Object.assign({}, GESTURE_DEFAULTS),
    _editing: false, _suppressClick: false, _barJustDragged: false,

    playlist: [], currentIndex: -1,
    _sessionId: Math.random().toString(36).substring(2, 10),

    settings: { brightness: 1.0, volume: 1.0, speed: 1.0, isMuted: false, aspect: 'fit', sleepTimer: 0 },

    state: {
      isPlaying: false, isDragging: false, controlsVisible: true,
      lastTapTime: 0, tapTimeout: null, hideControlsTimeout: null,
      sleepInterval: null, sleepRemaining: 0, activeMenu: null,
      wakeLock: null, isCasting: false, castTimer: null
    }
  };

  const UI = {}; // عناصر مخزّنة للأداء

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  let _rtl = null;
  function refreshRTL() {
    try { _rtl = getComputedStyle(MP.screen || document.documentElement).direction === 'rtl'; }
    catch (e) { _rtl = document.documentElement.dir === 'rtl'; }
  }
  function isRTL() { if (_rtl === null) refreshRTL(); return _rtl; }

  function listen(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts);
    MP._disposers.push(function () { target.removeEventListener(ev, fn, opts); });
  }

  /* ================================================================
     🧠 الشبكة والتحميل المسبق الذكي
     ================================================================ */
  function netProfile() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const et = c && c.effectiveType;
    const dl = (c && c.downlink) || 0;
    const save = !!(c && c.saveData);
    let tier = 'high';
    if (save || et === 'slow-2g' || et === '2g') tier = 'low';
    else if (et === '3g' || (dl && dl < 3)) tier = 'mid';
    return { tier: tier, downlink: dl, saveData: save };
  }

  const _warmed = {};
  function warmOrigin(url) {
    try {
      const o = new URL(url).origin;
      if (_warmed[o] || o === location.origin) return;
      _warmed[o] = true;
      const l = document.createElement('link');
      l.rel = 'preconnect'; l.href = o; l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    } catch (e) {}
  }

  const PF = { url: '', video: null, ctrl: null, timer: 0 };

  function stopPrefetchWork() {
    clearTimeout(PF.timer);
    if (PF.ctrl) { try { PF.ctrl.abort(); } catch (e) {} PF.ctrl = null; }
    if (PF.video) {
      try { PF.video.removeAttribute('src'); PF.video.load(); } catch (e) {}
      PF.video = null;
    }
  }
  function cancelPrefetch() { stopPrefetchWork(); PF.url = ''; }

  function shouldPrefetch() {
    if (!CONFIG.prefetchEnabled) return false;
    if (navigator.onLine === false) return false;
    return netProfile().tier !== 'low';
  }

  function maybePrefetch() {
    if (PF.url || !shouldPrefetch()) return;
    const v = MP.video;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    if (v.currentTime / v.duration < CONFIG.prefetchAtPercent) return;
    const next = MP.playlist[MP.currentIndex + 1];
    if (!next || !next.url) return;
    startPrefetch(next.url);
  }

  function startPrefetch(url) {
    PF.url = url;
    warmOrigin(url);
    const f = detectFormat(url);
    if (f.isHttp && ENV.isHTTPS && !ENV.isNative) return;
    if (f.isHLS) prefetchHls(url); else prefetchVideo(url);
  }

  function prefetchVideo(url) {
    try {
      const pv = document.createElement('video');
      pv.muted = true; pv.preload = 'auto';
      pv.setAttribute('playsinline', '');
      const done = function () { stopPrefetchWork(); };
      pv.addEventListener('progress', function () {
        try {
          if (pv.buffered.length && pv.buffered.end(pv.buffered.length - 1) >= CONFIG.prefetchSeconds) done();
        } catch (e) {}
      });
      pv.addEventListener('error', done);
      pv.src = url;
      pv.load();
      PF.video = pv;
      PF.timer = setTimeout(done, 60000);
    } catch (e) {}
  }

  async function prefetchHls(url) {
    try {
      const ctrl = new AbortController();
      PF.ctrl = ctrl;
      const opt = { signal: ctrl.signal, mode: 'cors', credentials: 'omit' };
      const getText = async function (u) {
        const r = await fetch(u, opt);
        if (!r.ok) throw new Error('http ' + r.status);
        return r.text();
      };
      let base = url;
      let text = await getText(url);

      if (/#EXT-X-STREAM-INF/.test(text)) {
        const lines = text.split(/\r?\n/);
        const variants = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].indexOf('#EXT-X-STREAM-INF') === 0) {
            const bw = parseInt((/BANDWIDTH=(\d+)/.exec(lines[i]) || [0, 0])[1], 10);
            let j = i + 1;
            while (j < lines.length && (!lines[j] || lines[j][0] === '#')) j++;
            if (lines[j]) variants.push({ bw: bw, uri: lines[j] });
          }
        }
        if (!variants.length) return;
        variants.sort(function (a, b) { return a.bw - b.bw; });
        const pick = variants[Math.floor((variants.length - 1) / 2)];
        base = new URL(pick.uri, url).href;
        text = await getText(base);
      }

      const segs = text.split(/\r?\n/).filter(function (l) { return l && l[0] !== '#'; })
        .slice(0, CONFIG.prefetchHlsSegments);
      for (let i = 0; i < segs.length; i++) {
        const r = await fetch(new URL(segs[i], base).href, opt);
        await r.arrayBuffer();
      }
    } catch (e) {}
    PF.ctrl = null;
  }

  /* ================================================================
     🎨 HTML
     ================================================================ */
  function buildPlayerHTML() {
    const showCast = ENV.isAndroid;
    return `
    <div id="moviesPlayerScreen" data-session="${MP._sessionId}">
      <video id="moviesVideoPlayer" playsinline webkit-playsinline x5-playsinline preload="auto"></video>
      <div id="moviesBrightnessOverlay"></div>

      <div id="moviesLoadingOverlay">
        <div class="loading-spinner"></div>
        <div class="loading-text" id="moviesLoadingText">جارٍ التحميل...</div>
      </div>

      <div id="moviesLockOverlay">
        <button id="moviesUnlockBtn" aria-label="فتح القفل">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
        </button>
      </div>

      <div class="gesture-indicator" id="moviesVolumeIndicator">
        <div class="gesture-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        </div>
        <div class="gesture-bar"><div class="gesture-fill" id="moviesVolumeFill"></div></div>
        <div class="gesture-value" id="moviesVolumeValue">100%</div>
      </div>

      <div class="gesture-indicator" id="moviesBrightnessIndicator">
        <div class="gesture-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </div>
        <div class="gesture-bar"><div class="gesture-fill brightness-fill" id="moviesBrightnessFill"></div></div>
        <div class="gesture-value" id="moviesBrightnessValue">100%</div>
      </div>

      <div class="seek-indicator" id="moviesSeekIndicator">
        <div class="seek-icon" id="moviesSeekIcon"></div>
        <div class="seek-text" id="moviesSeekText">10 ثواني</div>
      </div>

      <div class="toast-indicator" id="moviesToastIndicator">
        <div class="toast-icon" id="moviesToastIcon"></div>
        <div class="toast-text" id="moviesToastText" style="white-space:pre-line"></div>
      </div>

      <div id="moviesCastOverlay">
        <div class="cast-overlay-content">
          <div class="cast-overlay-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
              <line x1="2" y1="20" x2="2.01" y2="20"/>
            </svg>
          </div>
          <div class="cast-overlay-title">البث عبر Web Video Caster</div>
          <div class="cast-overlay-sub" id="moviesCastOverlaySub">جارٍ فتح التطبيق...</div>
          <button id="moviesCastCancelBtn" class="cast-overlay-btn">إغلاق</button>
        </div>
      </div>

      <div id="moviesPlayerHeader">
        <button class="player-btn" id="moviesBackBtn" aria-label="رجوع">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div id="moviesTitle">H90 Player</div>
        <button class="player-btn" id="moviesCastBtn" aria-label="بث" style="${showCast ? '' : 'display:none'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
            <line x1="2" y1="20" x2="2.01" y2="20"/>
          </svg>
        </button>
        <button class="player-btn" id="moviesGestureBtn" aria-label="تخصيص الإيماءات">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
        </button>
        <button class="player-btn" id="moviesInfoBtn" aria-label="معلومات">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <button class="player-btn" id="moviesLockBtn" aria-label="قفل">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </button>
      </div>

      <div id="moviesActiveTimer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <span id="moviesActiveTimerText">00:00</span>
      </div>

      <div id="moviesPopupOverlay"></div>

      <div class="popup-menu" id="moviesAspectMenu">
        <div class="popup-title">نسبة العرض</div>
        <button class="popup-item" data-aspect="fit">ملاءمة <span class="popup-check">✓</span></button>
        <button class="popup-item" data-aspect="cover">تغطية <span class="popup-check">✓</span></button>
        <button class="popup-item" data-aspect="fill">تمديد <span class="popup-check">✓</span></button>
        <button class="popup-item" data-aspect="16:9">16:9 <span class="popup-check">✓</span></button>
        <button class="popup-item" data-aspect="4:3">4:3 <span class="popup-check">✓</span></button>
      </div>

      <div class="popup-menu" id="moviesSpeedMenu">
        <div class="popup-title">السرعة</div>
        <button class="popup-item" data-speed="0.5">0.5x <span class="popup-check">✓</span></button>
        <button class="popup-item" data-speed="0.75">0.75x <span class="popup-check">✓</span></button>
        <button class="popup-item" data-speed="1">عادي <span class="popup-check">✓</span></button>
        <button class="popup-item" data-speed="1.25">1.25x <span class="popup-check">✓</span></button>
        <button class="popup-item" data-speed="1.5">1.5x <span class="popup-check">✓</span></button>
        <button class="popup-item" data-speed="2">2x <span class="popup-check">✓</span></button>
      </div>

      <div class="popup-menu" id="moviesSleepMenu">
        <div class="popup-title">مؤقت النوم</div>
        <button class="popup-item" data-minutes="0">إيقاف <span class="popup-check">✓</span></button>
        <button class="popup-item" data-minutes="15">15 دقيقة <span class="popup-check">✓</span></button>
        <button class="popup-item" data-minutes="30">30 دقيقة <span class="popup-check">✓</span></button>
        <button class="popup-item" data-minutes="60">ساعة <span class="popup-check">✓</span></button>
        <button class="popup-item" data-minutes="120">ساعتان <span class="popup-check">✓</span></button>
      </div>

      <div class="popup-menu" id="moviesSubtitleMenu">
        <div class="popup-title">الترجمة</div>
        <button class="popup-item" data-sub="none">إخفاء <span class="popup-check">✓</span></button>
        <button class="popup-item" id="moviesLoadSubBtn">تحميل ملف SRT/VTT</button>
        <input type="file" id="moviesSubtitleFile" accept=".srt,.vtt" style="display:none">
      </div>

      <div id="moviesGestureEditor">
        <div class="gz gz-l" id="gzL"><span id="gzLName"></span></div>
        <div class="gz gz-c" id="gzC"><span>تقديم / تأخير ↔</span></div>
        <div class="gz gz-r" id="gzR"><span id="gzRName"></span></div>
        <div class="gz-dead" id="gzDL"></div>
        <div class="gz-dead" id="gzDR"></div>
        <div class="gz-handle gz-handle-edge" id="gzHEL" data-h="edgeL"></div>
        <div class="gz-handle" id="gzHL" data-h="left"></div>
        <div class="gz-handle" id="gzHR" data-h="right"></div>
        <div class="gz-handle gz-handle-edge" id="gzHER" data-h="edgeR"></div>
        <div class="gz-panel" id="gzPanel">
          <div class="gz-title">اسحب الخطوط البيضاء لتحديد المناطق • والبرتقالية للحواف الميتة</div>
          <div class="gz-row">
            <button data-gz="swap">⇄ تبديل الصوت/السطوع</button>
            <button data-gz="bri">السطوع</button>
            <button data-gz="vol">الصوت</button>
            <button data-gz="seek">سحب التقديم</button>
            <button data-gz="dtOn">نقر مزدوج</button>
          </div>
          <div class="gz-row">
            <span class="gz-lbl">الحساسية</span>
            <button data-gz="sens" data-v="0.6">بطيئة</button>
            <button data-gz="sens" data-v="1">عادية</button>
            <button data-gz="sens" data-v="1.6">سريعة</button>
            <span class="gz-lbl">القفزة</span>
            <button data-gz="dt" data-v="5">5s</button>
            <button data-gz="dt" data-v="10">10s</button>
            <button data-gz="dt" data-v="15">15s</button>
            <button data-gz="dt" data-v="30">30s</button>
          </div>
          <div class="gz-row">
            <button data-gz="reset">إعادة ضبط</button>
            <button data-gz="done" class="primary">تم</button>
          </div>
        </div>
      </div>

      <div id="moviesPlayerControls">
        <div id="moviesProgressWrap">
          <div class="progress-track">
            <div id="moviesProgressBuffer"></div>
            <div id="moviesProgressFill"></div>
            <div id="moviesProgressThumb"></div>
          </div>
        </div>

        <div class="times">
          <span id="moviesCurrentTime">0:00</span>
          <span class="time-sep">/</span>
          <span id="moviesDuration">0:00</span>
        </div>

        <div class="buttons-main">
          <button class="ctrl-btn" id="moviesPrevBtn" title="السابق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/><line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesSeekBackBtn" title="-10 ثواني">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
          </button>
          <button class="ctrl-btn ctrl-play" id="moviesPlayBtn" title="تشغيل/إيقاف">
            <svg id="moviesPlayIcon" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </button>
          <button class="ctrl-btn" id="moviesSeekFwdBtn" title="+10 ثواني">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesNextBtn" title="التالي">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesMuteBtn" title="كتم الصوت">
            <svg id="moviesVolumeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesAspectBtn" title="نسبة العرض">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
          </button>
          <button class="ctrl-btn" id="moviesSpeedBtn" title="السرعة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesSubtitleBtn" title="الترجمة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <line x1="7" y1="15" x2="12" y2="15"/><line x1="14" y1="15" x2="17" y2="15"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesSleepBtn" title="مؤقت النوم">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button class="ctrl-btn" id="moviesPipBtn" title="صورة داخل صورة" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesScreenshotBtn" title="لقطة شاشة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <button class="ctrl-btn" id="moviesFullscreenBtn" title="ملء الشاشة">
            <svg id="moviesFullscreenIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h6v2H5v4H3V3zM15 3h6v6h-2V5h-4V3zM21 15v6h-6v-2h4v-4h2zM3 15h2v4h4v2H3v-6z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div id="moviesWelcomeScreen">
      <div class="welcome-content">
        <div class="welcome-icon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>
        <div class="welcome-title">H90 Movies</div>
        <div class="welcome-subtitle">مشغل الأفلام والمسلسلات</div>
      </div>
    </div>
    `;
  }

  /* أنماط محرّر الإيماءات (مضمّنة حتى لا تحتاج تعديل ملف CSS) */
  function injectStyles() {
    if (document.getElementById('h90GestureStyles')) return;
    const st = document.createElement('style');
    st.id = 'h90GestureStyles';
    st.textContent =
      '#moviesGestureEditor{position:absolute;inset:0;z-index:80;display:none;direction:ltr;background:rgba(0,0,0,.4);touch-action:none;user-select:none;-webkit-user-select:none}' +
      '#moviesGestureEditor.show{display:block}' +
      '.gz{position:absolute;top:0;bottom:0;display:flex;align-items:flex-start;justify-content:center;padding-top:12px;color:#fff;font-size:13px;font-weight:800;text-align:center;pointer-events:none}' +
      '.gz span{background:rgba(0,0,0,.6);padding:4px 10px;border-radius:10px;direction:rtl}' +
      '.gz-l{background:rgba(255,193,7,.2)}.gz-c{background:rgba(0,229,255,.15)}.gz-r{background:rgba(229,57,53,.22)}' +
      '.gz-dead{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.16) 0 6px,transparent 6px 12px);pointer-events:none}' +
      '.gz-handle{position:absolute;top:0;bottom:0;width:36px;margin-left:-18px;cursor:ew-resize;touch-action:none;z-index:2}' +
      '.gz-handle::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.6)}' +
      '.gz-handle::after{content:"\\21D4";position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);width:30px;height:30px;line-height:30px;border-radius:50%;background:#fff;color:#111;font-size:16px;text-align:center;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.5)}' +
      '.gz-handle-edge::before{background:#ff9800}.gz-handle-edge::after{background:#ff9800;content:"|";top:18%}' +
      '.gz-panel{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:3;width:min(94%,660px);background:rgba(15,15,20,.93);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:8px 10px;color:#fff;direction:rtl}' +
      '.gz-panel button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:5px 9px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;margin:2px}' +
      '.gz-panel button.on{background:#e53935;border-color:#e53935}' +
      '.gz-panel button.primary{background:linear-gradient(135deg,#e53935,#c62828);border:none}' +
      '.gz-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2px}' +
      '.gz-title{font-size:11px;text-align:center;opacity:.8;margin-bottom:3px}' +
      '.gz-lbl{font-size:11px;opacity:.7;margin:0 4px}';
    document.head.appendChild(st);
  }

  /* ================================================================
     🚀 التهيئة
     ================================================================ */
  function init() {
    if (MP.video) return;

    injectStyles();

    if (!document.getElementById('moviesPlayerScreen')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildPlayerHTML();
      while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
    }

    MP.video = document.getElementById('moviesVideoPlayer');
    MP.screen = document.getElementById('moviesPlayerScreen');
    MP.loading = document.getElementById('moviesLoadingOverlay');
    MP.header = document.getElementById('moviesPlayerHeader');
    MP.controls = document.getElementById('moviesPlayerControls');
    MP.welcome = document.getElementById('moviesWelcomeScreen');

    if (!MP.video) { console.error('❌ moviesVideoPlayer not found'); return; }

    UI.fill = document.getElementById('moviesProgressFill');
    UI.thumb = document.getElementById('moviesProgressThumb');
    UI.cur = document.getElementById('moviesCurrentTime');
    UI.dur = document.getElementById('moviesDuration');
    UI.buf = document.getElementById('moviesProgressBuffer');

    MP.isNative = ENV.isNative;
    MP.video.setAttribute('playsinline', '');
    MP.video.setAttribute('webkit-playsinline', '');
    MP.video.preload = 'auto';
    MP.video.controls = false;

    if (MP.welcome) { MP.welcome.classList.remove('show'); MP.welcome.style.display = 'none'; }

    const pip = document.getElementById('moviesPipBtn');
    if (pip && pipSupported()) pip.style.display = '';

    refreshRTL();
    bindAntiCopyGuards(MP.screen);
    loadSettings();
    loadGestures();
    bindVideoEvents();
    bindControls();
    bindProgressBar();
    bindMenus();
    bindGestures();
    bindGestureEditor();
    bindKeyboard();
    bindSubtitleInput();
    bindWakeLock();
    bindFullscreenEvents();
    bindNativeBackButton();
    bindMediaSession();
    bindNetwork();

    listen(window, 'resize', function () { refreshRTL(); });
    listen(window, 'orientationchange', function () { setTimeout(refreshRTL, 200); });

    console.log('%c✅ H90 Player v8.0 Ready',
      'background:linear-gradient(135deg,#e53935,#c62828);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;',
      { android: ENV.isAndroid, ios: ENV.isIOS, capacitor: ENV.isCapacitor, rtl: isRTL() });
  }

  /* ================================================================
     💾 الإعدادات + الإيماءات + الاستئناف
     ================================================================ */
  function saveSettings() {
    try {
      localStorage.setItem('h90movies_settings', JSON.stringify({
        brightness: MP.settings.brightness, volume: MP.settings.volume,
        speed: MP.settings.speed, aspect: MP.settings.aspect
      }));
    } catch (e) {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem('h90movies_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.volume === 'number') MP.settings.volume = s.volume;
        if (typeof s.brightness === 'number') MP.settings.brightness = s.brightness;
        if (typeof s.speed === 'number') MP.settings.speed = s.speed;
        if (typeof s.aspect === 'string') MP.settings.aspect = s.aspect;
      }
    } catch (e) {}
    if (MP.video) {
      MP.video.volume = MP.settings.volume;
      MP.video.playbackRate = MP.settings.speed;
    }
    applyBrightness(MP.settings.brightness);
  }

  function normalizeGestures() {
    const g = MP.g;
    g.edge = Math.round(clamp(Number(g.edge) || 0, 0, 15) * 10) / 10;
    g.left = clamp(Number(g.left) || 35, g.edge + 8, 100 - g.edge - 20);
    g.right = clamp(Number(g.right) || 65, g.left + 12, 100 - g.edge - 8);
    g.left = Math.round(g.left * 10) / 10;
    g.right = Math.round(g.right * 10) / 10;
    g.sens = clamp(Number(g.sens) || 1, 0.3, 3);
    g.dt = clamp(parseInt(g.dt, 10) || 10, 3, 60);
    g.swap = !!g.swap; g.bri = !!g.bri; g.vol = !!g.vol; g.seek = !!g.seek; g.dtOn = !!g.dtOn;
  }

  function loadGestures() {
    try {
      const raw = localStorage.getItem('h90movies_gestures');
      if (raw) MP.g = Object.assign({}, GESTURE_DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    normalizeGestures();
  }

  function saveGestures() {
    try { localStorage.setItem('h90movies_gestures', JSON.stringify(MP.g)); } catch (e) {}
  }

  function resumeKeyFor(data) {
    const base = (data && (data.id || data.title)) || '';
    return base ? 'h90pos_' + base : '';
  }

  function savePosition(force) {
    if (!CONFIG.resumeEnabled || !MP._resumeKey) return;
    const v = MP.video;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    const now = Date.now();
    if (!force && now - MP._lastSave < 5000) return;
    MP._lastSave = now;
    const t = MP._pendingSeek != null ? MP._pendingSeek : v.currentTime;
    try {
      if (t > v.duration - 20) localStorage.removeItem(MP._resumeKey);
      else if (t > 5) localStorage.setItem(MP._resumeKey, String(Math.floor(t)));
    } catch (e) {}
  }

  function getSavedPosition() {
    if (!CONFIG.resumeEnabled || !MP._resumeKey) return 0;
    try {
      const s = parseFloat(localStorage.getItem(MP._resumeKey));
      return s > 5 ? s : 0;
    } catch (e) { return 0; }
  }

  /* ================================================================
     🎬 التشغيل
     ================================================================ */
  function resetRuntimeState() {
    clearTimeout(MP._seekTimer); MP._pendingSeek = null; MP._seeking = false;
    clearTimeout(MP._recover.timer); MP._recover.count = 0; MP._recover.okSince = 0;
    clearStall();
    MP._lastGoodTime = 0;
    const buf = UI.buf; if (buf) buf.style.width = '0%';
  }

  async function play(data) {
    if (!MP.video) init();
    if (!MP.video) return;
    if (!RATE_LIMIT.check('play', 3)) return;

    const d = data || {};
    const url = d.url, title = d.title, poster = d.poster, isLive = d.isLive;

    if (!url) { showError('لا يوجد رابط للتشغيل'); return; }

    const format = detectFormat(url);
    MP._currentFormat = format;
    MP._lastError = null;
    MP._lastPlay = { url: url, title: title, poster: poster, id: d.id, isLive: isLive };

    hideError();
    closeGestureEditor();

    if (format.isHttp && ENV.isHTTPS && !ENV.isNative) {
      showError('الرابط غير آمن (http)', 'الصفحة تعمل عبر https\nالمتصفح يحجب الفيديو');
      return;
    }

    resetRuntimeState();
    warmOrigin(url);
    if (PF.url && PF.url !== url) cancelPrefetch();

    if (MP._urlToken) URL_LOCK.wipe(MP._urlToken);
    MP._urlToken = URL_LOCK.protect(url);
    MP.currentTitle = title || 'H90 Player';
    MP.currentPoster = poster || '';
    MP.currentId = d.id || '';
    MP._resumeKey = isLive ? '' : resumeKeyFor(d);

    if (MP.welcome) { MP.welcome.classList.remove('show'); MP.welcome.style.display = 'none'; }
    MP.screen.classList.add('show');
    MP.screen.style.display = 'block';
    document.body.classList.add('movies-page-open');

    lockLandscape();

    const titleEl = document.getElementById('moviesTitle');
    if (titleEl) titleEl.textContent = MP.currentTitle;

    updateMediaSessionMeta();
    showLoading('جارٍ التحميل...');
    updateNavButtons();

    const startAt = isLive ? 0 : getSavedPosition();

    try {
      await useHtml5Player(url, format, { startAt: startAt, resume: startAt > 0 });
    } catch (e) {
      console.error('❌ play() exception:', e);
      showError('فشل التشغيل', (e && e.message) || 'خطأ غير معروف');
    }
  }

  async function useHtml5Player(url, format, opts) {
    opts = opts || {};
    const video = MP.video;

    try { video.pause(); } catch (e) {}
    if (video._hls) { try { video._hls.destroy(); } catch (e) {} video._hls = null; }

    video.removeAttribute('src');
    try { video.load(); } catch (e) {}

    MP._startAt = opts.startAt > 0 ? opts.startAt : null;
    MP._startFromResume = !!opts.resume;

    if (CONFIG.screenshotCors) video.crossOrigin = 'anonymous';
    else video.removeAttribute('crossorigin');

    video.preload = 'auto';
    video.playbackRate = MP.settings.speed;
    video.volume = MP.settings.volume;
    video.muted = MP.settings.isMuted;
    applyAspect(MP.settings.aspect);

    if (format.isHLS) await playHLS(url, video, opts);
    else playDirect(url, video, format);
  }

  function safePlay(video) {
    const p = video.play();
    if (!p || !p.catch) return;
    p.catch(function (err) {
      if (err && err.name === 'NotAllowedError') {
        video.muted = true;
        video.play().then(function () {
          showToast('الصوت مكتوم — اضغط زر الصوت لتشغيله', 'info');
          updateVolumeIcon();
        }).catch(function () { updatePlayIcon(false); });
      } else if (err && err.name === 'NotSupportedError') {
        const f = MP._currentFormat || { ext: '?' };
        showError('الصيغة ' + String(f.ext).toUpperCase() + ' غير مدعومة', 'جرب صيغة أخرى أو متصفح آخر');
      } else {
        updatePlayIcon(false);
      }
    });
  }

  /* ================================================================
     🛟 الاسترجاع التلقائي (يمنع ظهور "خطأ في الشبكة" عند التقديم)
     ================================================================ */
  function recoverPlayback(reason) {
    const R = MP._recover;
    const v = MP.video;
    if (!v || !MP._urlToken || !MP._lastPlay) return false;
    if (R.count >= CONFIG.maxRecoverAttempts) return false;
    R.count++;

    const t = MP._pendingSeek != null ? MP._pendingSeek
      : (v.currentTime > 0 ? v.currentTime : MP._lastGoodTime) || 0;
    MP._pendingSeek = null;
    clearTimeout(MP._seekTimer);
    clearStall();

    console.warn('🔄 recover (' + reason + ') #' + R.count + ' @' + Math.floor(t) + 's');
    showLoading('إعادة الاتصال (' + R.count + '/' + CONFIG.maxRecoverAttempts + ')...');

    clearTimeout(R.timer);
    R.timer = setTimeout(function () {
      if (!MP._urlToken) return;
      const url = URL_LOCK.resolve(MP._urlToken);
      if (!url) return;
      const live = MP._lastPlay && MP._lastPlay.isLive;
      useHtml5Player(url, MP._currentFormat || detectFormat(url), { startAt: live ? 0 : t, resume: false })
        .catch(function () { showError('فشل إعادة الاتصال'); });
    }, Math.min(600 * R.count, 2400));
    return true;
  }

  function armStall() {
    clearStall();
    if (navigator.onLine === false) { showLoading('لا يوجد اتصال بالإنترنت...'); return; }
    MP._stallTimer = setTimeout(function () {
      const v = MP.video;
      if (!MP._urlToken || !v || v.paused || v.ended || v.readyState >= 3) return;
      recoverPlayback('stall');
    }, CONFIG.stallTimeoutMs);
  }
  function clearStall() { clearTimeout(MP._stallTimer); MP._stallTimer = 0; }

  function bindNetwork() {
    listen(window, 'online', function () {
      if (!MP.screen || !MP.screen.classList.contains('show')) return;
      const v = MP.video;
      if (v && !v.paused && v.readyState < 3) recoverPlayback('online');
      else if (MP.state.isPlaying) showToast('عاد الاتصال', 'success');
    });
    listen(window, 'offline', function () {
      if (MP.screen && MP.screen.classList.contains('show')) showToast('انقطع الاتصال', 'error');
    });
  }

  /* ================================================================
     ⏩ التقديم الذكي (Debounce) — يمنع إغراق السيرفر بطلبات Range
     ================================================================ */
  function seekBase() {
    return MP._pendingSeek != null ? MP._pendingSeek : MP.video.currentTime;
  }

  function requestSeek(t, immediate) {
    const v = MP.video;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    t = clamp(t, 0, v.duration);
    MP._pendingSeek = t;

    setProgressUI((t / v.duration) * 100);
    if (UI.cur) UI.cur.textContent = formatTime(t);

    clearTimeout(MP._seekTimer);
    const run = function () {
      const tt = MP._pendingSeek;
      MP._pendingSeek = null;
      if (tt == null) return;
      try { v.currentTime = tt; } catch (e) {}
    };
    if (immediate) run(); else MP._seekTimer = setTimeout(run, CONFIG.seekDebounceMs);
  }

  function seekBy(sec) { requestSeek(seekBase() + sec, false); }

  /* ================================================================
     📡 HLS
     ================================================================ */
  async function playHLS(url, video, opts) {
    if (ENV.canPlayHLS && (ENV.isIOS || ENV.isSafari)) {
      video.src = url;
      safePlay(video);
      return;
    }

    if (!window.Hls || !window.Hls.isSupported()) await ensureHlsLoaded();

    if (window.Hls && window.Hls.isSupported()) {
      const live = !!(MP._lastPlay && MP._lastPlay.isLive);
      const net = netProfile();
      const prof = net.tier === 'low' ? { a: 20, b: 40, s: 30 }
                 : net.tier === 'mid' ? { a: 40, b: 80, s: 60 }
                 : { a: 90, b: 180, s: 100 };

      const retryPolicy = function (net, timeout) {
        return {
          default: {
            maxTimeToFirstByteMs: 12000, maxLoadTimeMs: 120000,
            timeoutRetry: { maxNumRetry: timeout, retryDelayMs: 0, maxRetryDelayMs: 0 },
            errorRetry: { maxNumRetry: net, retryDelayMs: 1000, maxRetryDelayMs: 8000 }
          }
        };
      };

      const cfg = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: live ? 30 : prof.a,
        maxMaxBufferLength: live ? 60 : prof.b,
        maxBufferSize: prof.s * 1000 * 1000,
        maxBufferHole: 0.5,
        nudgeMaxRetry: 6,
        startLevel: -1,
        startFragPrefetch: true,
        capLevelToPlayerSize: true,
        fragLoadPolicy: retryPolicy(6, 4),
        manifestLoadPolicy: retryPolicy(4, 3),
        playlistLoadPolicy: retryPolicy(4, 3),
        xhrSetup: function (xhr) { xhr.withCredentials = false; }
      };
      if (net.downlink) cfg.abrEwmaDefaultEstimate = Math.round(net.downlink * 1e6 * 0.8);
      if (opts && opts.startAt > 0 && !live) cfg.startPosition = opts.startAt;

      const hls = new window.Hls(cfg);

      let netRetries = 0;
      let mediaRetries = 0;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        netRetries = 0;
        hideLoading();
        safePlay(video);
      });

      hls.on(window.Hls.Events.FRAG_LOADED, function () { netRetries = 0; });

      hls.on(window.Hls.Events.ERROR, function (event, data) {
        if (!data || !data.fatal) return;
        console.error('❌ HLS fatal:', data.type, data.details);

        const fail = function (title, detail) {
          try { hls.destroy(); } catch (e) {}
          if (video._hls === hls) video._hls = null;
          if (!recoverPlayback('hls-' + data.details)) showError(title, detail);
        };

        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          if (netRetries < CONFIG.hlsMaxNetRetries) {
            netRetries++;
            showLoading('إعادة الاتصال (' + netRetries + '/' + CONFIG.hlsMaxNetRetries + ')...');
            setTimeout(function () {
              try {
                const pos = MP._pendingSeek != null ? MP._pendingSeek : video.currentTime;
                hls.startLoad(pos > 0 ? pos : -1);
              } catch (e) {}
            }, 800 * netRetries);
          } else {
            fail('خطأ في الشبكة', 'تعذّر تحميل البث بعد عدة محاولات\nتحقق من الاتصال أو انتهاء الرابط');
          }
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRetries === 0) { mediaRetries++; hls.recoverMediaError(); }
          else if (mediaRetries === 1) { mediaRetries++; try { hls.swapAudioCodec(); } catch (e) {} hls.recoverMediaError(); }
          else fail('خطأ في فك الترميز', data.details);
        } else {
          fail('تعذّر تشغيل البث', data.details);
        }
      });

      video._hls = hls;
      return;
    }

    if (ENV.canPlayHLS) { video.src = url; safePlay(video); return; }
    showError('المتصفح لا يدعم HLS', 'استخدم Chrome أو Safari أو ضمّن hls.js محلياً');
  }

  /* ================================================================
     🎯 Direct
     ================================================================ */
  function playDirect(url, video, format) {
    if (format.isUnsupported) {
      console.warn('⚠️ Format ' + format.ext.toUpperCase() + ' قد لا يكون مدعوماً');
    }
    video.src = url;
    safePlay(video);
  }

  /* ================================================================
     📺 أحداث الفيديو
     ================================================================ */
  function bindVideoEvents() {
    const v = MP.video;

    v.addEventListener('loadedmetadata', function () {
      if (UI.dur) UI.dur.textContent = formatTime(v.duration);
      hideLoading();
      if (MP._startAt != null) {
        const t = MP._startAt;
        const fromResume = MP._startFromResume;
        MP._startAt = null; MP._startFromResume = false;
        if (t > 0 && (!isFinite(v.duration) || t < v.duration - 1) && Math.abs(v.currentTime - t) > 2) {
          try { v.currentTime = t; } catch (e) {}
        }
        if (fromResume) showToast('استئناف من ' + formatTime(t), 'info');
      }
    });

    v.addEventListener('durationchange', function () {
      if (UI.dur) UI.dur.textContent = formatTime(v.duration);
    });

    v.addEventListener('canplay', function () { hideLoading(); clearStall(); });

    v.addEventListener('waiting', function () {
      showLoading('جارٍ التحميل...');
      armStall();
    });

    v.addEventListener('seeking', function () { MP._seeking = true; });
    v.addEventListener('seeked', function () {
      MP._seeking = false;
      clearStall();
      if (v.readyState >= 3) hideLoading();
    });

    v.addEventListener('playing', function () {
      MP.state.isPlaying = true;
      MP._recover.okSince = Date.now();
      clearStall();
      hideLoading();
      updatePlayIcon(true);
      showControls();
      requestWakeLock();
      startRaf();
      setMediaSessionState('playing');
      if (PF.url && PF.url === URL_LOCK.resolve(MP._urlToken)) cancelPrefetch();
    });

    v.addEventListener('play', function () {
      MP.state.isPlaying = true;
      updatePlayIcon(true);
      requestWakeLock();
      startRaf();
    });

    v.addEventListener('pause', function () {
      MP.state.isPlaying = false;
      clearStall();
      updatePlayIcon(false);
      showControls();
      releaseWakeLock();
      stopRaf();
      savePosition(true);
      setMediaSessionState('paused');
    });

    v.addEventListener('ended', function () {
      MP.state.isPlaying = false;
      clearStall();
      stopRaf();
      updatePlayIcon(false);
      showControls();
      releaseWakeLock();
      try { if (MP._resumeKey) localStorage.removeItem(MP._resumeKey); } catch (e) {}
      autoPlayNext();
    });

    v.addEventListener('timeupdate', function () {
      if (!MP._seeking && v.currentTime > 0) MP._lastGoodTime = v.currentTime;

      // نجاح مستقر لمدة 8 ثواني = تصفير عدّاد الاسترجاع
      if (MP._recover.count && MP._recover.okSince && Date.now() - MP._recover.okSince > 8000) MP._recover.count = 0;

      if (!MP.state.isPlaying && !MP.state.isDragging) updateProgress();
      savePosition(false);
      maybePrefetch();

      const now = Date.now();
      if (now - MP._lastPosState > 1000) { MP._lastPosState = now; updatePositionState(); }
    });

    v.addEventListener('progress', function () {
      try {
        if (v.buffered && v.buffered.length > 0 && v.duration && isFinite(v.duration)) {
          // آخر مدى يحتوي الموضع الحالي
          let end = v.buffered.end(v.buffered.length - 1);
          for (let i = 0; i < v.buffered.length; i++) {
            if (v.currentTime >= v.buffered.start(i) && v.currentTime <= v.buffered.end(i)) { end = v.buffered.end(i); break; }
          }
          const pct = (end / v.duration) * 100;
          if (UI.buf && isFinite(pct) && pct >= 0) UI.buf.style.width = Math.min(100, pct) + '%';
        }
      } catch (e) {}
    });

    v.addEventListener('error', function () {
      if (v._hls) return; // أخطاء HLS تُعالج عبر hls.js
      const err = v.error;
      if (!err || !v.getAttribute('src')) return;
      const format = MP._currentFormat || { ext: 'unknown' };

      // ✅ الإصلاح الأساسي: لا نعرض الخطأ فوراً — نعيد تحميل المصدر من نفس الموضع
      const progressed = MP._lastGoodTime > 0 || MP._pendingSeek != null || MP._seeking;
      const canRetry = err.code === 2 || (progressed && (err.code === 3 || err.code === 4));
      if (canRetry && recoverPlayback('error-' + err.code)) return;

      let userMsg = 'تعذّر تشغيل الفيديو';
      let detailMsg = '';

      switch (err.code) {
        case 1: userMsg = 'تم إلغاء التحميل'; break;
        case 2:
          userMsg = 'خطأ في الشبكة';
          detailMsg = 'تعذّر الاتصال بالسيرفر\n• قد يكون الرابط منتهياً\n• أو انقطع الإنترنت\n• أو السيرفر لا يدعم Range (206) للتقديم';
          break;
        case 3:
          userMsg = 'خطأ في فك الترميز';
          detailMsg = 'الملف تالف أو بصيغة غير مدعومة';
          break;
        case 4:
          if (format.isHttp && ENV.isHTTPS) {
            userMsg = 'الرابط غير آمن'; detailMsg = 'http محجوب من https';
          } else if (format.isWorkerStream) {
            userMsg = 'فشل تحميل الفيديو من Worker';
            detailMsg = 'قد يكون:\n• الرابط منتهي الصلاحية\n• صيغة الملف غير مدعومة\n• الـ Worker لا يرسل Accept-Ranges / 206';
          } else if (format.isUnsupported) {
            userMsg = 'الصيغة ' + format.ext.toUpperCase() + ' غير مدعومة';
            detailMsg = 'جرب متصفحاً آخر';
          } else {
            userMsg = 'الصيغة غير مدعومة أو الرابط لا يعمل';
            detailMsg = 'extension: .' + format.ext;
          }
          break;
        default: userMsg = 'خطأ غير معروف';
      }

      MP._lastError = { code: err.code, message: err.message, format: format, time: Date.now() };
      showError(userMsg, detailMsg);
    });

    v.addEventListener('volumechange', updateVolumeIcon);
    v.addEventListener('enterpictureinpicture', function () { showToast('صورة داخل صورة', 'info'); });
  }

  /* حلقة رسم سلسة لشريط التقدم */
  function startRaf() {
    if (MP._raf) return;
    let last = 0;
    const loop = function (ts) {
      MP._raf = requestAnimationFrame(loop);
      if (ts - last < 100) return;
      last = ts;
      if (!MP.state.isPlaying || MP.state.isDragging || MP._pendingSeek != null || document.hidden) return;
      updateProgress();
    };
    MP._raf = requestAnimationFrame(loop);
  }
  function stopRaf() {
    if (MP._raf) { cancelAnimationFrame(MP._raf); MP._raf = 0; }
  }

  /* ================================================================
     🔒 Wake Lock
     ================================================================ */
  function bindWakeLock() {
    listen(document, 'visibilitychange', function () {
      if (document.visibilityState === 'visible' && MP.state.isPlaying) requestWakeLock();
    });
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || MP.state.wakeLock) return;
    try {
      MP.state.wakeLock = await navigator.wakeLock.request('screen');
      MP.state.wakeLock.addEventListener('release', function () { MP.state.wakeLock = null; });
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (MP.state.wakeLock) {
      try { MP.state.wakeLock.release(); } catch (e) {}
      MP.state.wakeLock = null;
    }
  }

  /* ================================================================
     📱 Media Session
     ================================================================ */
  function bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = function (name, fn) { try { ms.setActionHandler(name, fn); } catch (e) {} };
    set('play', function () { MP.video.play().catch(function () {}); });
    set('pause', function () { MP.video.pause(); });
    set('seekbackward', function () { seekBy(-10); });
    set('seekforward', function () { seekBy(10); });
    set('previoustrack', playPrevious);
    set('nexttrack', playNext);
    set('seekto', function (d) { if (d && typeof d.seekTime === 'number') requestSeek(d.seekTime, true); });
  }

  function updateMediaSessionMeta() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: MP.currentTitle || 'H90 Player',
        artist: 'H90 Movies',
        artwork: MP.currentPoster ? [{ src: MP.currentPoster, sizes: '512x512' }] : []
      });
    } catch (e) {}
  }

  function setMediaSessionState(state) {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = state; } catch (e) {}
  }

  function updatePositionState() {
    const v = MP.video;
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      if (v && isFinite(v.duration) && v.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: v.duration,
          playbackRate: v.playbackRate || 1,
          position: Math.min(v.currentTime, v.duration)
        });
      }
    } catch (e) {}
  }

  /* ================================================================
     🎛️ ربط الأزرار
     ================================================================ */
  function byId(id, ev, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  function bindControls() {
    byId('moviesBackBtn', 'click', closePlayer);
    byId('moviesInfoBtn', 'click', showInfo);
    byId('moviesLockBtn', 'click', toggleLock);
    byId('moviesUnlockBtn', 'click', unlockScreen);
    byId('moviesGestureBtn', 'click', openGestureEditor);
    byId('moviesPlayBtn', 'click', togglePlay);
    byId('moviesSeekBackBtn', 'click', function () { seekBy(-10); });
    byId('moviesSeekFwdBtn', 'click', function () { seekBy(10); });
    byId('moviesPrevBtn', 'click', playPrevious);
    byId('moviesNextBtn', 'click', playNext);
    byId('moviesMuteBtn', 'click', toggleMute);
    byId('moviesAspectBtn', 'click', function () { toggleMenu('moviesAspectMenu'); });
    byId('moviesSpeedBtn', 'click', function () { toggleMenu('moviesSpeedMenu'); });
    byId('moviesSubtitleBtn', 'click', function () { toggleMenu('moviesSubtitleMenu'); });
    byId('moviesSleepBtn', 'click', function () { toggleMenu('moviesSleepMenu'); });
    byId('moviesScreenshotBtn', 'click', takeScreenshot);
    byId('moviesFullscreenBtn', 'click', toggleFullscreen);
    byId('moviesPipBtn', 'click', togglePiP);
    byId('moviesCastBtn', 'click', startCasting);
    byId('moviesCastCancelBtn', 'click', stopCasting);
  }

  /* ================================================================
     🖼️ Picture-in-Picture
     ================================================================ */
  function pipSupported() {
    return !!(document.pictureInPictureEnabled && MP.video && MP.video.requestPictureInPicture) ||
           !!(MP.video && typeof MP.video.webkitSetPresentationMode === 'function');
  }

  async function togglePiP() {
    const v = MP.video;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture();
      } else if (v.webkitSetPresentationMode) {
        v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      }
    } catch (e) {
      showToast('الميزة غير متاحة الآن', 'error');
    }
  }

  /* ================================================================
     📱 الاتجاه + شريط الحالة + زر الرجوع
     ================================================================ */
  function lockLandscape() {
    if (!ENV.isMobile) return;
    const so = plugin('ScreenOrientation');
    try {
      if (so && so.lock) { so.lock({ orientation: 'landscape' }).catch(function () {}); return; }
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
    } catch (e) {}
  }

  function unlockOrientation() {
    if (!ENV.isMobile) return;
    const so = plugin('ScreenOrientation');
    try {
      if (so && so.unlock) { so.unlock(); return; }
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
  }

  function setStatusBarHidden(hidden) {
    const sb = plugin('StatusBar');
    if (!sb) return;
    try { (hidden ? sb.hide() : sb.show()); } catch (e) {}
  }

  function handleBack() {
    if (MP._editing) closeGestureEditor();
    else if (MP.state.activeMenu) closeAllMenus();
    else if (isFullscreen()) exitFullscreen();
    else closePlayer();
  }

  function bindNativeBackButton() {
    const app = plugin('App');
    if (app && app.addListener) {
      try {
        app.addListener('backButton', function () {
          if (!MP.screen || !MP.screen.classList.contains('show')) return;
          handleBack();
        });
      } catch (e) {}
    }
    if (window.cordova) {
      listen(document, 'backbutton', function (e) {
        if (!MP.screen || !MP.screen.classList.contains('show')) return;
        e.preventDefault();
        handleBack();
      }, false);
    }
  }

  /* ================================================================
     🖥️ FULLSCREEN
     ================================================================ */
  async function enterFullscreen() {
    const el = MP.screen;
    const v = MP.video;
    setStatusBarHidden(true);

    if (ENV.isIOS && !el.requestFullscreen && !el.webkitRequestFullscreen &&
        v && typeof v.webkitEnterFullscreen === 'function' && v.readyState >= 1) {
      try {
        v.webkitEnterFullscreen();
        MP.isFullscreen = true; MP._fsMode = 'ios-video';
        setTimeout(updateFullscreenIcon, 100);
        return;
      } catch (e) {}
    }

    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        MP.isFullscreen = true; MP._fsMode = 'standard';
        setTimeout(updateFullscreenIcon, 100);
        return;
      } catch (e) {}
    }

    if (el.webkitRequestFullscreen) {
      try {
        el.webkitRequestFullscreen();
        MP.isFullscreen = true; MP._fsMode = 'webkit';
        setTimeout(updateFullscreenIcon, 100);
        return;
      } catch (e) {}
    }

    if (ENV.isIOS && v && typeof v.webkitEnterFullscreen === 'function') {
      try {
        v.webkitEnterFullscreen();
        MP.isFullscreen = true; MP._fsMode = 'ios-video';
        setTimeout(updateFullscreenIcon, 100);
        return;
      } catch (e) {}
    }

    simulateFullscreen(true);
  }

  async function exitFullscreen() {
    setStatusBarHidden(false);

    if (MP._fsMode === 'ios-video' && MP.video && typeof MP.video.webkitExitFullscreen === 'function') {
      try { MP.video.webkitExitFullscreen(); } catch (e) {}
    }

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (e) {}
    }

    if (document.body.classList.contains('movies-simulated-fs')) simulateFullscreen(false);

    MP.isFullscreen = false;
    MP._fsMode = null;
    setTimeout(updateFullscreenIcon, 100);
  }

  function simulateFullscreen(enter) {
    const s = MP.screen;
    if (enter) {
      document.body.classList.add('movies-simulated-fs');
      s.style.position = 'fixed';
      s.style.inset = '0';
      s.style.width = '100vw';
      s.style.height = '100vh';
      s.style.height = '100dvh';
      s.style.zIndex = '99999';
      document.body.style.overflow = 'hidden';
      MP.isFullscreen = true;
      MP._fsMode = 'simulated';
    } else {
      document.body.classList.remove('movies-simulated-fs');
      s.style.position = ''; s.style.inset = ''; s.style.width = '';
      s.style.height = ''; s.style.zIndex = '';
      document.body.style.overflow = '';
      MP.isFullscreen = false;
      MP._fsMode = null;
    }
    setTimeout(updateFullscreenIcon, 100);
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.body.classList.contains('movies-simulated-fs') ||
      MP._fsMode === 'ios-video'
    );
  }

  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreen(); else enterFullscreen();
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function bindFullscreenEvents() {
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (evt) {
      listen(document, evt, function () {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && MP._fsMode !== 'simulated' && MP._fsMode !== 'ios-video') {
          MP.isFullscreen = false; MP._fsMode = null;
          setStatusBarHidden(false);
        }
        refreshRTL();
        updateFullscreenIcon();
      });
    });

    MP.video.addEventListener('webkitbeginfullscreen', function () {
      MP.isFullscreen = true; MP._fsMode = 'ios-video'; updateFullscreenIcon();
    });
    MP.video.addEventListener('webkitendfullscreen', function () {
      MP.isFullscreen = false; MP._fsMode = null; updateFullscreenIcon();
    });
  }

  function updateFullscreenIcon() {
    const icon = document.getElementById('moviesFullscreenIcon');
    if (!icon) return;
    icon.innerHTML = isFullscreen()
      ? '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'
      : '<path d="M3 3h6v2H5v4H3V3zM15 3h6v6h-2V5h-4V3zM21 15v6h-6v-2h4v-4h2zM3 15h2v4h4v2H3v-6z"/>';
  }

  /* ================================================================
     📡 CAST — أندرويد فقط عبر Web Video Caster
     ================================================================ */
  function buildWvcIntent(url, title, format) {
    let u;
    try { u = new URL(url); } catch (e) { return ''; }
    const scheme = u.protocol.replace(':', '');
    const mime = format && format.isHLS ? 'application/x-mpegURL' : 'video/mp4';
    const safeTitle = String(title || 'H90').replace(/[;=#]/g, ' ');
    return 'intent://' + u.host + u.pathname + u.search +
      '#Intent;action=android.intent.action.VIEW;scheme=' + scheme +
      ';type=' + mime +
      ';package=' + CONFIG.wvcPackage +
      ';S.title=' + encodeURIComponent(safeTitle) +
      ';S.secure_uri=true;end';
  }

  function buildWvcScheme(url, title) {
    return 'wvc-x-callback://open?url=' + encodeURIComponent(url) +
           '&title=' + encodeURIComponent(title || '') + '&secure_uri=true';
  }

  function showCastMessage(html) {
    const sub = document.getElementById('moviesCastOverlaySub');
    if (sub) sub.innerHTML = html;
  }

  function showWvcMissing() {
    showCastMessage(
      'تعذّر فتح Web Video Caster — ' +
      '<a href="' + CONFIG.wvcStoreUrl + '" target="_blank" rel="noopener" style="color:#00e5ff;">تحميل من Play Store</a>'
    );
  }

  async function startCasting() {
    if (!ENV.isAndroid) {
      showToast('البث متاح على أندرويد فقط', 'info');
      return;
    }
    if (MP.state.isCasting) { showToast('جاري البث بالفعل', 'info'); return; }
    if (!MP._urlToken) { showToast('لا يوجد فيديو', 'warning'); return; }

    const url = URL_LOCK.resolve(MP._urlToken);
    if (!url) { showToast('فشل استخراج الرابط', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) { showToast('رابط غير صالح للبث', 'error'); return; }

    const castOverlay = document.getElementById('moviesCastOverlay');
    if (castOverlay) castOverlay.classList.add('show');
    showCastMessage('جارٍ فتح التطبيق...');

    MP.state.isCasting = true;
    try { MP.video.pause(); } catch (e) {}

    const format = MP._currentFormat || detectFormat(url);
    const title = MP.currentTitle;

    const launcher = plugin('AppLauncher');
    if (launcher && launcher.openUrl) {
      try {
        await launcher.openUrl({ url: buildWvcScheme(url, title) });
        showCastMessage('تم فتح Web Video Caster — اختر الجهاز من التطبيق');
        return;
      } catch (e) {
        showWvcMissing();
        return;
      }
    }

    if (window.startApp && window.startApp.set) {
      try {
        window.startApp.set({
          action: 'ACTION_VIEW',
          uri: url,
          type: format.isHLS ? 'application/x-mpegURL' : 'video/mp4',
          intentstart: 'startActivity',
          component: [CONFIG.wvcPackage, 'com.instantbits.cast.webvideo.WebVideoCasterActivity']
        }, { title: title, secure_uri: 'true' }).start(
          function () { showCastMessage('تم فتح Web Video Caster'); },
          function () { showWvcMissing(); }
        );
        return;
      } catch (e) {}
    }

    const intentUrl = buildWvcIntent(url, title, format);
    if (!intentUrl) { showToast('رابط غير صالح للبث', 'error'); MP.state.isCasting = false; castOverlay && castOverlay.classList.remove('show'); return; }

    let left = false;
    const onLeave = function () { left = true; };
    document.addEventListener('visibilitychange', onLeave, { once: true });
    window.addEventListener('pagehide', onLeave, { once: true });
    window.addEventListener('blur', onLeave, { once: true });

    clearTimeout(MP.state.castTimer);
    MP.state.castTimer = setTimeout(function () {
      document.removeEventListener('visibilitychange', onLeave);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('blur', onLeave);
      if (!left && MP.state.isCasting) showWvcMissing();
    }, 2500);

    window.location.href = intentUrl;
  }

  function stopCasting() {
    clearTimeout(MP.state.castTimer);
    MP.state.isCasting = false;
    const castOverlay = document.getElementById('moviesCastOverlay');
    if (castOverlay) castOverlay.classList.remove('show');
  }

  /* ================================================================
     📊 شريط التقدم (RTL / LTR)
     ================================================================ */
  function setProgressUI(pct) {
    if (UI.fill) UI.fill.style.width = pct + '%';
    const thumb = UI.thumb;
    if (thumb) {
      if (isRTL()) { thumb.style.right = pct + '%'; thumb.style.left = 'auto'; }
      else { thumb.style.left = pct + '%'; thumb.style.right = 'auto'; }
    }
  }

  function bindProgressBar() {
    const wrap = document.getElementById('moviesProgressWrap');
    const v = MP.video;
    if (!wrap) return;

    let dragging = false;
    let dragPct = 0;
    let wasPlaying = false;

    function getPct(clientX) {
      const r = wrap.getBoundingClientRect();
      const raw = isRTL() ? (r.right - clientX) / r.width : (clientX - r.left) / r.width;
      return clamp(raw, 0, 1);
    }

    function updateUI(pct) {
      setProgressUI(pct * 100);
      if (UI.cur && v.duration && isFinite(v.duration)) UI.cur.textContent = formatTime(pct * v.duration);
    }

    function start(cx) {
      if (MP.isLocked) return;
      dragging = true;
      MP.state.isDragging = true;
      wrap.classList.add('dragging');
      wasPlaying = !v.paused;
      dragPct = getPct(cx);
      updateUI(dragPct);
    }
    function move(cx) { if (!dragging) return; dragPct = getPct(cx); updateUI(dragPct); }
    function end() {
      if (!dragging) return;
      dragging = false;
      MP.state.isDragging = false;
      wrap.classList.remove('dragging');
      MP._barJustDragged = true;
      setTimeout(function () { MP._barJustDragged = false; }, 120);
      if (v.duration && isFinite(v.duration)) requestSeek(dragPct * v.duration, true);
      if (wasPlaying && v.paused) v.play().catch(function () {});
    }

    if (window.PointerEvent) {
      wrap.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        start(e.clientX);
        try { wrap.setPointerCapture(e.pointerId); } catch (er) {}
        e.preventDefault(); e.stopPropagation();
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        move(e.clientX); e.preventDefault();
      });
      wrap.addEventListener('pointerup', function (e) {
        end();
        try { wrap.releasePointerCapture(e.pointerId); } catch (er) {}
        e.preventDefault(); e.stopPropagation();
      });
      wrap.addEventListener('pointercancel', end);
    } else {
      wrap.addEventListener('touchstart', function (e) { start(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
      wrap.addEventListener('touchmove', function (e) { if (!dragging) return; move(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
      wrap.addEventListener('touchend', function (e) { end(); e.preventDefault(); }, { passive: false });
    }

    // النقر المباشر (يُتجاهل إذا انتهى سحب للتو لمنع تقديم مزدوج)
    wrap.addEventListener('click', function (e) {
      if (MP.isLocked || dragging || MP._barJustDragged) return;
      if (!v.duration || !isFinite(v.duration)) return;
      requestSeek(getPct(e.clientX) * v.duration, true);
    });
  }

  /* ================================================================
     📋 القوائم
     ================================================================ */
  function bindMenus() {
    const overlay = document.getElementById('moviesPopupOverlay');
    if (overlay) overlay.addEventListener('click', closeAllMenus);

    document.querySelectorAll('#moviesAspectMenu .popup-item').forEach(function (btn) {
      btn.addEventListener('click', function () { setAspect(this.dataset.aspect); closeAllMenus(); });
    });
    document.querySelectorAll('#moviesSpeedMenu .popup-item').forEach(function (btn) {
      btn.addEventListener('click', function () { setSpeed(parseFloat(this.dataset.speed)); closeAllMenus(); });
    });
    document.querySelectorAll('#moviesSleepMenu .popup-item').forEach(function (btn) {
      btn.addEventListener('click', function () { setSleepTimer(parseInt(this.dataset.minutes, 10)); closeAllMenus(); });
    });

    const noneSub = document.querySelector('#moviesSubtitleMenu .popup-item[data-sub="none"]');
    if (noneSub) noneSub.addEventListener('click', function () { removeSubtitle(); closeAllMenus(); });

    byId('moviesLoadSubBtn', 'click', function () {
      const f = document.getElementById('moviesSubtitleFile');
      if (f) f.click();
    });
  }

  function toggleMenu(id) {
    const menu = document.getElementById(id);
    const overlay = document.getElementById('moviesPopupOverlay');
    if (!menu) return;
    const isOpen = menu.classList.contains('show');
    closeAllMenus();
    if (!isOpen) {
      menu.classList.add('show');
      if (overlay) overlay.classList.add('show');
      MP.state.activeMenu = id;
    }
  }

  function closeAllMenus() {
    document.querySelectorAll('#moviesPlayerScreen .popup-menu').forEach(function (m) { m.classList.remove('show'); });
    const o = document.getElementById('moviesPopupOverlay');
    if (o) o.classList.remove('show');
    MP.state.activeMenu = null;
  }

  /* ================================================================
     🎚️ محرّر مناطق الإيماءات (يعمل في ملء الشاشة وكل الأوضاع)
     ================================================================ */
  function layoutEditor() {
    const g = MP.g;
    const $ = function (id) { return document.getElementById(id); };
    const setBox = function (el, l, r) { if (el) { el.style.left = l + '%'; el.style.width = Math.max(0, r - l) + '%'; } };

    setBox($('gzDL'), 0, g.edge);
    setBox($('gzDR'), 100 - g.edge, 100);
    setBox($('gzL'), g.edge, g.left);
    setBox($('gzC'), g.left, g.right);
    setBox($('gzR'), g.right, 100 - g.edge);

    const pos = function (id, p) { const e = $(id); if (e) e.style.left = p + '%'; };
    pos('gzHEL', g.edge); pos('gzHL', g.left); pos('gzHR', g.right); pos('gzHER', 100 - g.edge);

    const lName = $('gzLName'), rName = $('gzRName');
    if (lName) lName.textContent = (g.swap ? '🔊 الصوت' : '☀️ السطوع') + ' ↕';
    if (rName) rName.textContent = (g.swap ? '☀️ السطوع' : '🔊 الصوت') + ' ↕';

    document.querySelectorAll('#gzPanel button[data-gz]').forEach(function (b) {
      const k = b.dataset.gz;
      let on = false;
      if (k === 'swap') on = g.swap;
      else if (k === 'bri' || k === 'vol' || k === 'seek' || k === 'dtOn') on = g[k];
      else if (k === 'sens') on = Math.abs(g.sens - parseFloat(b.dataset.v)) < 0.01;
      else if (k === 'dt') on = g.dt === parseInt(b.dataset.v, 10);
      b.classList.toggle('on', on);
    });
  }

  function setHandle(kind, pct) {
    const g = MP.g;
    if (kind === 'left') g.left = pct;
    else if (kind === 'right') g.right = pct;
    else if (kind === 'edgeL') g.edge = pct;
    else if (kind === 'edgeR') g.edge = 100 - pct;
    normalizeGestures();
    layoutEditor();
  }

  function bindGestureEditor() {
    const ed = document.getElementById('moviesGestureEditor');
    if (!ed) return;

    ed.querySelectorAll('.gz-handle').forEach(function (h) {
      let drag = false;
      h.addEventListener('pointerdown', function (e) {
        drag = true;
        try { h.setPointerCapture(e.pointerId); } catch (er) {}
        e.preventDefault(); e.stopPropagation();
      });
      h.addEventListener('pointermove', function (e) {
        if (!drag) return;
        const r = ed.getBoundingClientRect();
        setHandle(h.dataset.h, ((e.clientX - r.left) / r.width) * 100);
        e.preventDefault();
      });
      const up = function (e) {
        if (!drag) return;
        drag = false;
        try { h.releasePointerCapture(e.pointerId); } catch (er) {}
        saveGestures();
      };
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });

    const panel = document.getElementById('gzPanel');
    if (panel) {
      panel.addEventListener('click', function (e) {
        const b = e.target.closest('button[data-gz]');
        if (!b) return;
        const k = b.dataset.gz, g = MP.g;
        if (k === 'swap') g.swap = !g.swap;
        else if (k === 'bri' || k === 'vol' || k === 'seek' || k === 'dtOn') g[k] = !g[k];
        else if (k === 'sens') g.sens = parseFloat(b.dataset.v);
        else if (k === 'dt') g.dt = parseInt(b.dataset.v, 10);
        else if (k === 'reset') MP.g = Object.assign({}, GESTURE_DEFAULTS);
        else if (k === 'done') { closeGestureEditor(); return; }
        normalizeGestures();
        saveGestures();
        layoutEditor();
        e.stopPropagation();
      });
    }

    // منع تسرّب اللمس للإيماءات الأساسية
    ['touchstart', 'touchmove', 'touchend', 'click'].forEach(function (ev) {
      ed.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
    });
  }

  function openGestureEditor() {
    const ed = document.getElementById('moviesGestureEditor');
    if (!ed) return;
    closeAllMenus();
    MP._editing = true;
    hideControls();
    layoutEditor();
    ed.classList.add('show');
  }

  function closeGestureEditor() {
    const ed = document.getElementById('moviesGestureEditor');
    if (ed) ed.classList.remove('show');
    if (MP._editing) {
      MP._editing = false;
      saveGestures();
      showControls();
    }
  }

  /* ================================================================
     👆 الإيماءات (بحسب المناطق التي يحددها المستخدم)
     ================================================================ */
  function bindGestures() {
    const screen = MP.screen;
    const v = MP.video;
    if (!screen) return;

    let mode = null, startY = 0, startX = 0, startValue = 0;
    let horizontal = false, vertical = false, moved = false, seekAmt = 0, seekFrom = 0;
    let tapAccum = 0, tapAccumTimer = 0;

    function ignoreTarget(t) {
      return t.closest('#moviesProgressWrap') || t.closest('.ctrl-btn') ||
             t.closest('.player-btn') || t.closest('.popup-menu') ||
             t.closest('#moviesErrorBox') || t.closest('#moviesCastOverlay') ||
             t.closest('#moviesGestureEditor') || t.closest('#moviesLockOverlay');
    }

    // يرجع: null (حافة ميتة) | 'brightness' | 'volume' | 'seek'
    function zoneAt(pct) {
      const g = MP.g;
      if (pct < g.edge || pct > 100 - g.edge) return null;
      if (pct < g.left) return g.swap ? 'volume' : 'brightness';
      if (pct > g.right) return g.swap ? 'brightness' : 'volume';
      return 'seek';
    }

    screen.addEventListener('touchstart', function (e) {
      mode = null;
      if (MP.isLocked || MP._editing || e.touches.length > 1 || ignoreTarget(e.target)) return;
      const t = e.touches[0];
      const r = screen.getBoundingClientRect();
      const x = t.clientX - r.left;
      const z = zoneAt((x / r.width) * 100);
      if (z === null) return; // حافة ميتة: تجاهل اللمس بالكامل

      startX = x; startY = t.clientY - r.top;
      horizontal = false; vertical = false; moved = false; seekAmt = 0;

      mode = z;
      if (z === 'volume') startValue = MP.settings.volume;
      else if (z === 'brightness') startValue = MP.settings.brightness;
      seekFrom = seekBase();
    }, { passive: true });

    screen.addEventListener('touchmove', function (e) {
      if (MP.isLocked || MP._editing || !mode) return;
      const g = MP.g;
      const t = e.touches[0];
      const r = screen.getBoundingClientRect();
      const dx = (t.clientX - r.left) - startX;
      const dy = startY - (t.clientY - r.top);

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;

      if (!horizontal && !vertical) {
        if (g.seek && Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          horizontal = true; seekFrom = seekBase();
        } else if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          vertical = true;
        }
      }

      if (horizontal) {
        if (!v.duration || !isFinite(v.duration)) { e.preventDefault(); return; }
        const dir = isRTL() ? -1 : 1;
        seekAmt = Math.round((dx * dir * g.sens) / 8);
        const nt = clamp(seekFrom + seekAmt, 0, v.duration);
        setProgressUI((nt / v.duration) * 100);
        if (UI.cur) UI.cur.textContent = formatTime(nt);
        showSeekIndicator(seekAmt > 0 ? 'forward' : 'backward', (seekAmt > 0 ? '+' : '') + seekAmt + ' ثانية');
        e.preventDefault();
        return;
      }

      if (vertical) {
        const delta = (dy / (r.height * 0.7)) * g.sens;
        if (mode === 'volume' && g.vol) {
          MP.settings.volume = clamp(startValue + delta, 0, 1);
          v.volume = MP.settings.volume;
          v.muted = MP.settings.volume === 0;
          updateVolumeIcon();
          showGesture('volume', MP.settings.volume);
          e.preventDefault();
        } else if (mode === 'brightness' && g.bri) {
          MP.settings.brightness = clamp(startValue + delta, 0.1, 1);
          applyBrightness(MP.settings.brightness);
          showGesture('brightness', MP.settings.brightness);
          e.preventDefault();
        }
      }
    }, { passive: false });

    function finish() {
      if (MP.isLocked) return;
      if (horizontal && seekAmt !== 0 && v.duration) {
        requestSeek(seekFrom + seekAmt, true);
        setTimeout(function () {
          const si = document.getElementById('moviesSeekIndicator');
          if (si) si.classList.remove('show');
        }, 400);
      } else if (vertical && (mode === 'volume' || mode === 'brightness')) {
        setTimeout(hideGestures, 600);
        saveSettings();
      }
      if (moved) {
        MP._suppressClick = true;
        setTimeout(function () { MP._suppressClick = false; }, 350);
      }
      seekAmt = 0; mode = null; horizontal = false; vertical = false;
    }
    screen.addEventListener('touchend', finish);
    screen.addEventListener('touchcancel', finish);

    screen.addEventListener('click', function (e) {
      if (MP.isLocked || MP._editing || MP._suppressClick || ignoreTarget(e.target)) return;

      const g = MP.g;
      const now = Date.now();
      const dt = now - MP.state.lastTapTime;
      const r = screen.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      const onLeft = pct < g.left;
      const onRight = pct > g.right;
      const center = !onLeft && !onRight;

      if (dt < 300 && (center || g.dtOn)) {
        clearTimeout(MP.state.tapTimeout);
        MP.state.lastTapTime = 0;
        if (center) {
          togglePlay();
        } else {
          const forward = isRTL() ? onLeft : onRight;
          const step = forward ? g.dt : -g.dt;
          seekBy(step);
          tapAccum += step;
          clearTimeout(tapAccumTimer);
          tapAccumTimer = setTimeout(function () { tapAccum = 0; }, 900);
          showSeekIndicator(tapAccum >= 0 ? 'forward' : 'backward', (tapAccum > 0 ? '+' : '') + tapAccum + ' ثانية');
        }
      } else {
        MP.state.lastTapTime = now;
        clearTimeout(MP.state.tapTimeout);
        MP.state.tapTimeout = setTimeout(function () {
          if (MP.state.controlsVisible) hideControls(); else showControls();
        }, 250);
      }
    });
  }

  /* ================================================================
     ⌨️ الكيبورد
     ================================================================ */
  function bindKeyboard() {
    listen(document, 'keydown', function (e) {
      if (!MP.screen || !MP.screen.classList.contains('show')) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const rtl = isRTL();
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': seekBy(rtl ? -10 : 10); break;
        case 'ArrowLeft': seekBy(rtl ? 10 : -10); break;
        case 'ArrowUp': e.preventDefault(); adjustVolume(0.1); break;
        case 'ArrowDown': e.preventDefault(); adjustVolume(-0.1); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'm': case 'M': toggleMute(); break;
        case 'l': case 'L': toggleLock(); break;
        case 'p': case 'P': togglePiP(); break;
        case 'g': case 'G': if (MP._editing) closeGestureEditor(); else openGestureEditor(); break;
        case 'Escape': handleBack(); break;
      }
    });
  }

  /* ================================================================
     📁 الترجمة
     ================================================================ */
  function bindSubtitleInput() {
    const input = document.getElementById('moviesSubtitleFile');
    if (!input) return;
    input.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      loadSubtitleFile(file);
      input.value = '';
    });
  }

  function clearSubtitleTracks() {
    Array.prototype.slice.call(MP.video.querySelectorAll('track')).forEach(function (t) { t.remove(); });
    if (MP._subtitleUrl) {
      try { URL.revokeObjectURL(MP._subtitleUrl); } catch (e) {}
      MP._subtitleUrl = '';
    }
  }

  function loadSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = String(e.target.result || '');
      const ext = file.name.split('.').pop().toLowerCase();
      let vtt;
      if (ext === 'srt') vtt = srtToVtt(content);
      else if (ext === 'vtt') vtt = content;
      else { showToast('صيغة غير مدعومة', 'error'); return; }

      clearSubtitleTracks();

      const blob = new Blob([vtt], { type: 'text/vtt' });
      MP._subtitleUrl = URL.createObjectURL(blob);

      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = 'العربية';
      track.srclang = 'ar';
      track.src = MP._subtitleUrl;
      track.default = true;
      MP.video.appendChild(track);

      setTimeout(function () {
        const tt = MP.video.textTracks;
        for (let i = 0; i < tt.length; i++) tt[i].mode = 'showing';
      }, 100);

      showToast('تم تحميل الترجمة', 'success');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function srtToVtt(srt) {
    return 'WEBVTT\n\n' + srt
      .replace(/^\uFEFF/, '')
      .replace(/\r+/g, '')
      .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, '')
      .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4')
      .trim();
  }

  function removeSubtitle() {
    clearSubtitleTracks();
    showToast('تم إزالة الترجمة', 'info');
  }

  /* ================================================================
     📸 لقطة شاشة (ويب + تطبيق)
     ================================================================ */
  function takeScreenshot() {
    const v = MP.video;
    if (!v.duration || v.readyState < 2 || !v.videoWidth) {
      showToast('لا يمكن أخذ لقطة الآن', 'error');
      return;
    }
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

      c.toBlob(function (blob) {
        if (!blob) { showToast('فشل أخذ اللقطة', 'error'); return; }
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        saveImageBlob(blob, 'h90_' + ts + '.png');
      }, 'image/png');
    } catch (e) {
      showToast('اللقطة غير متاحة لهذا المصدر (CORS)', 'error');
    }
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onloadend = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function saveImageBlob(blob, filename) {
    const fs = plugin('Filesystem');
    const share = plugin('Share');
    if (ENV.isCapacitor && fs) {
      try {
        const data = await blobToBase64(blob);
        const res = await fs.writeFile({ path: filename, data: data, directory: 'CACHE' });
        if (share && share.share) await share.share({ title: 'لقطة H90', url: res.uri });
        showToast('تم حفظ اللقطة', 'success');
        return;
      } catch (e) {}
    }
    downloadBlob(blob, filename);
    showToast('تم حفظ اللقطة', 'success');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ================================================================
     🔲 نسبة العرض / ⚡ السرعة / 🌙 المؤقت
     ================================================================ */
  function setAspect(aspect) {
    MP.settings.aspect = aspect;
    applyAspect(aspect);
    document.querySelectorAll('#moviesAspectMenu .popup-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.aspect === aspect);
    });
    saveSettings();
    showToast('نسبة العرض: ' + aspect, 'info');
  }

  function applyAspect(aspect) {
    const v = MP.video;
    if (!v) return;
    v.classList.remove('cover', 'fill', 'ratio-16-9', 'ratio-4-3');
    switch (aspect) {
      case 'cover': v.classList.add('cover'); break;
      case 'fill': v.classList.add('fill'); break;
      case '16:9': v.classList.add('ratio-16-9'); break;
      case '4:3': v.classList.add('ratio-4-3'); break;
    }
  }

  function setSpeed(speed) {
    if (!isFinite(speed) || speed <= 0) return;
    MP.video.playbackRate = speed;
    MP.settings.speed = speed;
    document.querySelectorAll('#moviesSpeedMenu .popup-item').forEach(function (btn) {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
    });
    saveSettings();
    showToast('السرعة: ' + speed + 'x', 'info');
  }

  function setSleepTimer(minutes) {
    if (MP.state.sleepInterval) { clearInterval(MP.state.sleepInterval); MP.state.sleepInterval = null; }
    MP.settings.sleepTimer = minutes;
    const badge = document.getElementById('moviesActiveTimer');

    if (!minutes) {
      if (badge) badge.classList.remove('show');
      showToast('تم إلغاء المؤقت', 'info');
      return;
    }

    MP.state.sleepRemaining = minutes * 60;
    MP.state.sleepInterval = setInterval(function () {
      MP.state.sleepRemaining--;
      const m = Math.floor(MP.state.sleepRemaining / 60);
      const s = MP.state.sleepRemaining % 60;
      const el = document.getElementById('moviesActiveTimerText');
      if (el) el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

      if (MP.state.sleepRemaining <= 0) {
        clearInterval(MP.state.sleepInterval);
        MP.state.sleepInterval = null;
        MP.video.pause();
        if (badge) badge.classList.remove('show');
        showToast('توقف التشغيل', 'info');
      }
    }, 1000);

    if (badge) badge.classList.add('show');
    showToast('مؤقت النوم: ' + minutes + ' دقيقة', 'success');
  }

  /* ================================================================
     🔒 القفل
     ================================================================ */
  function toggleLock() {
    MP.isLocked = !MP.isLocked;
    const overlay = document.getElementById('moviesLockOverlay');
    const btn = document.getElementById('moviesLockBtn');
    if (MP.isLocked) {
      if (overlay) overlay.classList.add('show');
      if (btn) btn.classList.add('active');
      hideControls();
      showToast('تم القفل', 'info');
    } else {
      if (overlay) overlay.classList.remove('show');
      if (btn) btn.classList.remove('active');
      showControls();
      showToast('تم الفتح', 'info');
    }
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function unlockScreen() {
    MP.isLocked = false;
    const o = document.getElementById('moviesLockOverlay');
    const b = document.getElementById('moviesLockBtn');
    if (o) o.classList.remove('show');
    if (b) b.classList.remove('active');
    showControls();
    showToast('تم الفتح', 'info');
  }

  /* ================================================================
     ▶️ التحكم
     ================================================================ */
  function togglePlay() {
    const v = MP.video;
    if (v.paused) v.play().catch(function () {}); else v.pause();
    showControls();
  }

  function toggleMute() {
    const v = MP.video;
    v.muted = !v.muted;
    MP.settings.isMuted = v.muted;
    updateVolumeIcon();
    showToast(v.muted ? 'كتم الصوت' : 'تشغيل الصوت', 'info');
  }

  function adjustVolume(d) {
    MP.settings.volume = clamp(MP.settings.volume + d, 0, 1);
    MP.video.volume = MP.settings.volume;
    MP.video.muted = false;
    updateVolumeIcon();
    showGesture('volume', MP.settings.volume);
    setTimeout(hideGestures, 600);
  }

  /* ================================================================
     ⏭️ التالي / السابق
     ================================================================ */
  function playNext() {
    if (MP.playlist.length === 0 || MP.currentIndex < 0) { showToast('لا توجد حلقات أخرى', 'info'); return; }
    if (MP.currentIndex >= MP.playlist.length - 1) { showToast('آخر حلقة', 'info'); return; }
    MP.currentIndex++;
    playFromPlaylist(MP.currentIndex);
  }

  function playPrevious() {
    if (MP.playlist.length === 0 || MP.currentIndex < 0) { showToast('لا توجد حلقات أخرى', 'info'); return; }
    if (MP.currentIndex <= 0) { showToast('أول حلقة', 'info'); return; }
    MP.currentIndex--;
    playFromPlaylist(MP.currentIndex);
  }

  function playFromPlaylist(i) {
    const item = MP.playlist[i];
    if (!item) return;
    savePosition(true);
    play({ url: item.url, title: item.title, poster: item.poster || '', id: item.id, isLive: false });
  }

  function autoPlayNext() {
    if (MP.playlist.length > 0 && MP.currentIndex < MP.playlist.length - 1) {
      setTimeout(playNext, 1500);
    }
  }

  function updateNavButtons() {
    const prev = document.getElementById('moviesPrevBtn');
    const next = document.getElementById('moviesNextBtn');
    const has = MP.playlist.length > 1;
    if (prev) prev.style.opacity = has && MP.currentIndex > 0 ? '1' : '0.3';
    if (next) next.style.opacity = has && MP.currentIndex < MP.playlist.length - 1 ? '1' : '0.3';
  }

  /* ================================================================
     🎨 الإضاءة / الأيقونات / التقدم
     ================================================================ */
  function applyBrightness(value) {
    const overlay = document.getElementById('moviesBrightnessOverlay');
    if (overlay) overlay.style.opacity = (1 - value).toFixed(2);
  }

  function updatePlayIcon(isPlaying) {
    const icon = document.getElementById('moviesPlayIcon');
    if (!icon) return;
    icon.innerHTML = isPlaying
      ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
      : '<polygon points="6 3 20 12 6 21 6 3"/>';
  }

  function updateVolumeIcon() {
    const icon = document.getElementById('moviesVolumeIcon');
    const v = MP.video;
    if (!icon || !v) return;
    const spk = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>';
    if (v.muted || v.volume === 0) {
      icon.innerHTML = spk + '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
    } else if (v.volume < 0.5) {
      icon.innerHTML = spk + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
    } else {
      icon.innerHTML = spk + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
    }
  }

  function updateProgress() {
    const v = MP.video;
    if (!v || MP._pendingSeek != null) return;
    if (!v.duration || !isFinite(v.duration) || v.duration <= 0) return;
    const pct = Math.min(100, (v.currentTime / v.duration) * 100);
    if (!isFinite(pct)) return;
    setProgressUI(pct);
    if (UI.cur) UI.cur.textContent = formatTime(v.currentTime);
  }

  /* ================================================================
     🎨 المؤشرات + Toast
     ================================================================ */
  function showGesture(type, value) {
    const isVol = type === 'volume';
    const ind = document.getElementById(isVol ? 'moviesVolumeIndicator' : 'moviesBrightnessIndicator');
    const fill = document.getElementById(isVol ? 'moviesVolumeFill' : 'moviesBrightnessFill');
    const val = document.getElementById(isVol ? 'moviesVolumeValue' : 'moviesBrightnessValue');
    if (!ind) return;
    ind.classList.add('show');
    if (fill) fill.style.height = (value * 100) + '%';
    if (val) val.textContent = Math.round(value * 100) + '%';
  }

  function hideGestures() {
    ['moviesVolumeIndicator', 'moviesBrightnessIndicator'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  }

function showSeekIndicator(direction, text) {
    const ind = document.getElementById('moviesSeekIndicator');
    const txt = document.getElementById('moviesSeekText');
    if (!ind) return;
    ind.classList.remove('forward', 'backward');
    ind.classList.add(direction, 'show');
    if (txt) txt.textContent = text;
    clearTimeout(ind._t);
    ind._t = setTimeout(function () { ind.classList.remove('show'); }, 800);
  }

  function showToast(text, type) {
    const t = document.getElementById('moviesToastIndicator');
    const tt = document.getElementById('moviesToastText');
    const ti = document.getElementById('moviesToastIcon');
    if (!t || !tt) return;

    tt.textContent = text;
    if (ti) {
      if (type === 'success') {
        ti.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      } else if (type === 'error') {
        ti.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#e53935" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      } else {
        ti.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      }
    }
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ================================================================
     👁️ إظهار/إخفاء عناصر التحكم
     ================================================================ */
  function showControls() {
    if (MP.isLocked || MP._editing) return;
    MP.state.controlsVisible = true;
    if (MP.header) MP.header.classList.remove('hidden');
    if (MP.controls) MP.controls.classList.remove('hidden');
    clearTimeout(MP.state.hideControlsTimeout);
    if (MP.state.isPlaying) MP.state.hideControlsTimeout = setTimeout(hideControls, 4000);
  }

  function hideControls() {
    if (MP.isLocked) return;
    MP.state.controlsVisible = false;
    if (MP.header) MP.header.classList.add('hidden');
    if (MP.controls) MP.controls.classList.add('hidden');
  }

  /* ================================================================
     ⏳ التحميل
     ================================================================ */
  function showLoading(text) {
    if (!MP.loading) return;
    const tt = document.getElementById('moviesLoadingText');
    if (tt) tt.textContent = text || 'جارٍ التحميل...';
    MP.loading.classList.add('show');
  }

  function hideLoading() {
    if (MP.loading) MP.loading.classList.remove('show');
  }

  /* ================================================================
     ❌ الأخطاء — عنصر مستقل (لا يلمس شاشة التحميل)
     ================================================================ */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hideError() {
    const old = document.getElementById('moviesErrorBox');
    if (old) old.remove();
  }

  function showError(msg, detail) {
    if (!MP.screen) return;
    hideLoading();
    hideError();
    clearStall();

    const box = document.createElement('div');
    box.id = 'moviesErrorBox';
    box.style.cssText =
      'position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;background:rgba(0,0,0,0.85);' +
      'color:#fff;text-align:center;padding:20px;';

    box.innerHTML =
      '<div style="font-size:18px;font-weight:900;color:#e53935;margin-bottom:8px;">' + escapeHTML(msg) + '</div>' +
      (detail
        ? '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.7;white-space:pre-line;">' + escapeHTML(detail) + '</div>'
        : '<div style="height:12px"></div>') +
      '<button id="moviesErrorCloseBtn" style="padding:10px 24px;background:linear-gradient(135deg,#e53935,#c62828);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;margin-bottom:8px;">إغلاق</button>' +
      '<button id="moviesErrorRetryBtn" style="padding:8px 20px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">إعادة المحاولة</button>';

    MP.screen.appendChild(box);

    document.getElementById('moviesErrorCloseBtn').addEventListener('click', closePlayer);
    document.getElementById('moviesErrorRetryBtn').addEventListener('click', function () {
      const last = MP._lastPlay;
      const pos = MP._lastGoodTime;
      hideError();
      if (last && last.url) {
        MP._lastSave = 0;
        setTimeout(function () {
          play(last);
        }, 350);
        // العودة إلى آخر موضع سليم بعد إعادة المحاولة (إن لم يوجد استئناف محفوظ)
        if (pos > 5 && !getSavedPosition()) {
          try { if (MP._resumeKey) localStorage.setItem(MP._resumeKey, String(Math.floor(pos))); } catch (e) {}
        }
      }
    });
  }

  /* ================================================================
     🚪 الإغلاق / التنظيف
     ================================================================ */
  function closePlayer() {
    const v = MP.video;
    savePosition(true);

    clearTimeout(MP._seekTimer); MP._pendingSeek = null;
    clearTimeout(MP._recover.timer); MP._recover.count = 0;
    clearStall();
    stopRaf();
    cancelPrefetch();
    closeGestureEditor();

    if (v) {
      try {
        v.pause();
        if (v._hls) { v._hls.destroy(); v._hls = null; }
        v.removeAttribute('src');
        v.load();
      } catch (e) {}
    }

    clearSubtitleTracks();
    hideError();
    hideLoading();
    stopCasting();

    if (MP._urlToken) { URL_LOCK.wipe(MP._urlToken); MP._urlToken = ''; }

    MP.currentUrl = ''; MP.currentTitle = ''; MP.currentPoster = ''; MP.currentId = '';
    MP._currentFormat = null; MP._lastError = null; MP._lastPlay = null; MP._resumeKey = '';
    MP._startAt = null; MP._lastGoodTime = 0;

    if (MP.state.sleepInterval) { clearInterval(MP.state.sleepInterval); MP.state.sleepInterval = null; }
    const badge = document.getElementById('moviesActiveTimer');
    if (badge) badge.classList.remove('show');
    clearTimeout(MP.state.hideControlsTimeout);
    clearTimeout(MP.state.tapTimeout);

    releaseWakeLock();
    setMediaSessionState('none');

    try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {}

    if (isFullscreen()) exitFullscreen();
    if (document.body.classList.contains('movies-simulated-fs')) simulateFullscreen(false);

    if (MP.screen) {
      MP.screen.classList.remove('show');
      MP.screen.style.display = 'none';
    }

    document.body.classList.remove('movies-simulated-fs', 'movies-page-open');
    document.body.style.overflow = '';

    unlockOrientation();
    setStatusBarHidden(false);

    try { window.dispatchEvent(new CustomEvent('h90movies:closed')); } catch (e) {}
  }

  function destroy() {
    closePlayer();
    MP._disposers.forEach(function (fn) { try { fn(); } catch (e) {} });
    MP._disposers = [];
    URL_LOCK.wipeAll();
  }

  function showInfo() {
    const v = MP.video;
    const format = MP._currentFormat || { ext: 'unknown' };
    const errInfo = MP._lastError ? ' | خطأ: ' + MP._lastError.code : '';
    const net = netProfile();
    showToast(
      MP.currentTitle + '\n' + formatTime(v.duration) + '\n' +
      String(format.ext || 'unknown').toUpperCase() + (format.isWorkerStream ? ' (Worker)' : '') +
      '\n' + v.playbackRate + 'x' + ' | شبكة: ' + net.tier + errInfo,
      'info'
    );
  }

  /* ================================================================
     🛠️ مساعدات
     ================================================================ */
  function formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec) || sec < 0) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  /* ================================================================
     📨 Message Events (iframe / WebView)
     ================================================================ */
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'H90_MOVIES_PLAY') play(event.data);
  });

  /* ================================================================
     🌐 API العام
     ================================================================ */
  window.H90MoviesPlayer = {
    config: CONFIG,

    play: play,
    playUrl: function (url, title, poster) {
      return play({ url: url, title: title || 'H90 Player', poster: poster || '' });
    },
    playPlaylist: function (playlist, index) {
      MP.playlist = playlist || [];
      MP.currentIndex = index || 0;
      if (MP.playlist[MP.currentIndex]) {
        const it = MP.playlist[MP.currentIndex];
        return play({ url: it.url, title: it.title, poster: it.poster, id: it.id });
      }
    },
    addToPlaylist: function (item) { MP.playlist.push(item); updateNavButtons(); },

    close: closePlayer,
    destroy: destroy,
    toggleFullscreen: toggleFullscreen,
    isFullscreen: isFullscreen,
    enterFullscreen: enterFullscreen,
    exitFullscreen: exitFullscreen,
    togglePiP: togglePiP,

    openGestureEditor: openGestureEditor,
    closeGestureEditor: closeGestureEditor,
    getGestures: function () { return Object.assign({}, MP.g); },
    setGestures: function (o) { MP.g = Object.assign(MP.g, o || {}); normalizeGestures(); saveGestures(); layoutEditor(); },

    prefetchNext: function () { const n = MP.playlist[MP.currentIndex + 1]; if (n && n.url) { cancelPrefetch(); startPrefetch(n.url); } },
    seekTo: function (t) { requestSeek(t, true); },

    startCasting: startCasting,
    stopCasting: stopCasting,
    isCasting: function () { return MP.state.isCasting; },
    isCastSupported: function () { return ENV.isAndroid; },

    isNative: function () { return MP.isNative; },
    getEnv: function () { return ENV; },
    getState: function () { return MP.state; },
    getSettings: function () { return MP.settings; },
    getCurrentIndex: function () { return MP.currentIndex; },
    getPlaylist: function () { return MP.playlist; },
    getFormat: function () { return MP._currentFormat; },
    getLastError: function () { return MP._lastError; },
    ensureHls: ensureHlsLoaded,
    detectFormat: detectFormat
  };

  /* ================================================================
     🚀 التشغيل
     ================================================================ */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.log('%c🎬 H90 Player v8.0 Loaded',
    'background:linear-gradient(135deg,#e53935,#c62828);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px;');

})();

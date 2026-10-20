/* ================================================================
   H90 — SERIES API v20.0 (Full Details, Fast Built-in Encryption)
   ================================================================
   ✅ جلب القصة (Plot) والممثلين (Cast) والمخرج (Director).
   ✅ تشفير داخلي سريع (Built-in XOR + Base64) بدون مكتبات خارجية.
   ✅ كاش لمدة أسبوع كامل (لا يعيد التحميل إلا عند الحاجة).
   ✅ تخزين هجين: IndexedDB (أساسي) + localStorage (احتياطي).
   ✅ حفظ موثوق للبيانات الكبيرة والحلقات.
   ✅ تحميل الحلقات والمواسم بدقة، متزامن مع movies-styles.css.
   ✅ حماية من الأخطاء الصامتة (Silent Errors).
   ================================================================ */
'use strict';

const SeriesAPI = (function () {
  /* ================================================================
     ⚙️ الإعدادات الأساسية
     ================================================================ */
  const CONFIG = {
    CACHE_HOURS: 168,           // 7 أيام
    TIMEOUT_MS: 30000,          // 30 ثانية
    SECRET_KEY: 'H90_Series_Secure_Key_2026_!@#',
    SILENT: false,
    DB_NAME: 'H90_SeriesDB',
    DB_VERSION: 1,
    STORE: 'cache'
  };

  function log(...a) { if (!CONFIG.SILENT) console.log('%c[S]', 'color:#00e5ff;font-weight:900;', ...a); }
  function warn(...a) { if (!CONFIG.SILENT) console.warn('%c[S]', 'color:#ffb300;font-weight:900;', ...a); }
  function error(...a) { console.error('%c[S]', 'color:#ff2d55;font-weight:900;', ...a); }

  /* ================================================================
     📂 التصنيفات
     ================================================================ */
  const CATEGORIES = {
    '224': 'رمضان 2026', '257': 'Top 50', '197': 'Shahid', '212': 'Netflix',
    '219': 'Amazon', '221': 'HBO', '218': 'Apple TV+', '220': 'Disney+',
    '232': 'Hulu', '191': 'وثائقي', '202': 'هندية', '190': 'آسيوي', '196': 'أنمي',
    '187': 'تركي', '188': 'تركي', '194': 'برامج', '174': 'خليجي', '175': 'مصري',
    '173': 'سوري', '189': 'لبناني', '216': 'المغرب وتونس', '215': 'أردنية', '210': 'بدوي'
  };

  const KEYS = { 
    ALL: 'h90_sr_enc_v20', 
    TS: 'h90_sr_ts_v20', 
    INFO: 'h90_sr_info_v20_' 
  };

  const IMG_PROXY = { WESERV: 'https://images.weserv.nl/?url=' };

  /* ================================================================
     🔐 التشفير وفك التشفير (XOR + Base64)
     ================================================================ */
  function encryptData(data) {
    try {
      const str = JSON.stringify(data);
      let result = '';
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ CONFIG.SECRET_KEY.charCodeAt(i % CONFIG.SECRET_KEY.length));
      }
      return btoa(unescape(encodeURIComponent(result)));
    } catch (e) { 
      error('Encrypt failed:', e);
      return JSON.stringify(data); 
    }
  }

  function decryptData(cipher) {
    try {
      if (!cipher) return null;
      const str = decodeURIComponent(escape(atob(cipher)));
      let result = '';
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ CONFIG.SECRET_KEY.charCodeAt(i % CONFIG.SECRET_KEY.length));
      }
      return JSON.parse(result);
    } catch (e) { 
      warn('Decrypt failed:', e.message);
      return null; 
    }
  }

  /* ================================================================
     🗄️ IndexedDB — التخزين الأساسي (يدعم بيانات كبيرة)
     ================================================================ */
  let _dbPromise = null;
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      try {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB unsupported'));
        const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
        req.onupgradeneeded = (e) => {
          const idb = e.target.result;
          if (!idb.objectStoreNames.contains(CONFIG.STORE)) {
            idb.createObjectStore(CONFIG.STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
    return _dbPromise;
  }

  async function idbSet(key, value) {
    try {
      const idb = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(CONFIG.STORE, 'readwrite');
        tx.objectStore(CONFIG.STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (e) {
      warn('IndexedDB set failed:', e.message);
      return false;
    }
  }

  async function idbGet(key) {
    try {
      const idb = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(CONFIG.STORE, 'readonly');
        const req = tx.objectStore(CONFIG.STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      warn('IndexedDB get failed:', e.message);
      return null;
    }
  }

  async function idbDel(key) {
    try {
      const idb = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(CONFIG.STORE, 'readwrite');
        tx.objectStore(CONFIG.STORE).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { return false; }
  }

  async function idbKeys() {
    try {
      const idb = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(CONFIG.STORE, 'readonly');
        const req = tx.objectStore(CONFIG.STORE).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return []; }
  }

  /* ================================================================
     💾 التخزين الهجين (IndexedDB + localStorage fallback)
     ================================================================ */
  function safeLocalSet(key, value) {
    try {
      const encrypted = encryptData(value);
      if (encrypted.length > 4.5 * 1024 * 1024) {
        warn('Data too large for localStorage (' + (encrypted.length/1024/1024).toFixed(2) + 'MB)');
        return false;
      }
      localStorage.setItem(key, encrypted);
      return true;
    } catch (e) {
      warn('localStorage set failed:', e.name);
      return false;
    }
  }

  function safeLocalGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const dec = decryptData(raw);
      if (dec === null && raw) {
        localStorage.removeItem(key);
        warn('Corrupted cache removed for:', key);
      }
      return dec;
    } catch (e) { return null; }
  }

  const db = {
    set: async (k, v) => {
      const okIdb = await idbSet(k, v);
      if (okIdb) return true;
      return safeLocalSet(k, v);
    },
    
    get: async (k) => {
      const idbVal = await idbGet(k);
      if (idbVal !== null) return idbVal;
      return safeLocalGet(k);
    },
    
    del: async (k) => {
      await idbDel(k);
      try { localStorage.removeItem(k); } catch (e) {}
      return true;
    },
    
    keys: async () => {
      const idbK = await idbKeys();
      const lsK = [];
      try {
        for (const k in localStorage) {
          if (localStorage.hasOwnProperty(k)) lsK.push(k);
        }
      } catch (e) {}
      return Array.from(new Set([...idbK, ...lsK]));
    },
    
    info: async () => {
      const keys = await db.keys();
      let lsBytes = 0;
      try {
        for (const k in localStorage) {
          if (localStorage.hasOwnProperty(k)) lsBytes += localStorage[k].length;
        }
      } catch (e) {}
      return { 
        keys: keys.length, 
        localStorageMB: (lsBytes / 1024 / 1024).toFixed(2),
        hasIDB: 'indexedDB' in window
      };
    }
  };

  /* ================================================================
     🛠️ أدوات مساعدة
     ================================================================ */
  function buildApiUrl(action, extra) {
    if (window.__H90_Assembler__ && typeof window.__H90_Assembler__.url === 'function') {
      return window.__H90_Assembler__.url(action, extra);
    }
    error('shards.js is not loaded or __H90_Assembler__ is missing!');
    return null;
  }

  function pickYear(raw) {
    if (!raw) return 0;
    let m = String(raw.name || '').match(/\((\d{4})\)/);
    if (m) return parseInt(m[1], 10);
    m = String(raw.year || raw.releaseDate || '').match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function cleanImageUrl(u) { return u ? u.replace(/\\/g, '') : ''; }
  
  function proxyImage(url) {
    if (!url || !url.startsWith('http')) return url || '';
    return IMG_PROXY.WESERV + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=300';
  }

  async function httpGet(url, timeout) {
    if (!url) throw new Error('Empty URL');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout || CONFIG.TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', mode: 'cors' });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(t); throw e; }
  }

  /* ================================================================
     📡 جلب المسلسلات
     ================================================================ */
  async function loadSeries(force) {
    if (!force) {
      const ts = await db.get(KEYS.TS);
      if (ts && (Date.now() - ts) / 3600000 < CONFIG.CACHE_HOURS) {
        const cached = await db.get(KEYS.ALL);
        if (cached && Array.isArray(cached) && cached.length) {
          log('✅ Loaded from cache:', cached.length, 'series');
          return cached;
        }
        warn('⚠️ Timestamp valid but data missing — reloading');
      }
    }
    
    try {
      const url = buildApiUrl('get_series');
      const raw = await httpGet(url);
      if (!Array.isArray(raw)) {
        warn('API returned non-array');
        return (await db.get(KEYS.ALL)) || [];
      }
      
      const series = raw.map(r => ({
        id: r.series_id || r.id,
        name: r.name || '',
        title: r.name || '',
        year: pickYear(r),
        rating: parseFloat(r.rating) || 0,
        poster: proxyImage(cleanImageUrl(r.cover)),
        originalPoster: cleanImageUrl(r.cover),
        categoryId: String(r.category_id || ''),
        categoryName: CATEGORIES[r.category_id] || 'مسلسل',
        addedAt: parseInt(r.last_modified || '0', 10) || 0
      }));
      
      log('Saving', series.length, 'series...');
      const savedSeries = await db.set(KEYS.ALL, series);
      const savedTs = await db.set(KEYS.TS, Date.now());
      
      if (!savedSeries || !savedTs) {
        error('❌ Cache save FAILED!', await db.info());
      } else {
        log('✅ Cache saved OK:', series.length, 'series');
      }
      
      log('Total series fetched:', series.length);
      return series;
    } catch (e) {
      error('Load failed:', e);
      return (await db.get(KEYS.ALL)) || [];
    }
  }

  /* ================================================================
     🎯 جلب تفاصيل المسلسل (القصة + الحلقات)
     ================================================================ */
  async function getSeriesInfo(seriesId) {
    const cacheKey = KEYS.INFO + seriesId;
    const cached = await db.get(cacheKey);
    if (cached) return cached;
    
    try {
      const url = buildApiUrl('get_series_info', '&series_id=' + seriesId);
      const data = await httpGet(url, 15000);
      
      const episodes = data.episodes || {};
      const info = data.info || {};
      const seasons = Object.keys(episodes).sort((a, b) => parseInt(a) - parseInt(b));
      
      const result = { 
        plot: info.plot || info.description || '', 
        cast: info.cast || '', 
        director: info.director || '',
        genre: info.genre || '',
        releaseDate: info.releaseDate || '',
        episodes: episodes, 
        seasons: seasons 
      };
      await db.set(cacheKey, result);
      return result;
    } catch (e) {
      error('Info failed:', e);
      return { plot: '', cast: '', director: '', genre: '', releaseDate: '', episodes: {}, seasons: [] };
    }
  }

  async function buildStreamUrl(epId, ext) {
    if (window.__H90_Assembler__ && window.__H90_Assembler__.series) {
      return window.__H90_Assembler__.series.getEpisodeUrl(epId, ext || 'mp4');
    }
    return null;
  }

  /* ================================================================
     🗂️ التصنيفات (Featured Groups)
     ================================================================ */
  function getFeaturedGroups(s) {
    const f = id => s.filter(x => String(x.categoryId) === id);
    return {
      ramadan: f('224'), 
      top50: f('257'), 
      netflix: f('212'), 
      shahid: f('197'), 
      amazon: f('219'), 
      hbo: f('221'), 
      apple: f('218'), 
      disney: f('220'), 
      hulu: f('232'), 
      turkish: [...f('187'), ...f('188')], 
      anime: f('196'), 
      asian: f('190'), 
      indian: f('202'), 
      documentary: f('191'), 
      kids: [...f('223'), ...f('222'), ...f('176')], 
      tv: f('194'), 
      gulf: f('174'), 
      egypt: f('175'), 
      syria: f('173'), 
      lebanon: f('189'), 
      morocco: f('216'), 
      jordan: f('215'), 
      history: f('210')
    };
  }

  /* ================================================================
     🌍 الواجهة العامة (Public API)
     ================================================================ */
  return {
    loadSeries, 
    getSeriesInfo, 
    buildStreamUrl, 
    proxyImage, 
    getFeaturedGroups,
    
    // فلاتر
    getTrending: (s, l) => [...s].sort((a, b) => b.rating - a.rating).slice(0, l || 20),
    getTopRated: (s, l) => [...s].filter(x => x.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, l || 20),
    getRecentlyAdded: (s, l) => [...s].sort((a, b) => b.addedAt - a.addedAt).slice(0, l || 20),
    getNewReleases: (s, l) => [...s].filter(x => x.year >= 2023).sort((a, b) => b.year - a.year).slice(0, l || 20),
    filterByCategory: (s, id) => !id ? s : s.filter(x => String(x.categoryId) === String(id)),
    search: (s, q, l) => {
      if (!q || q.length < 2) return [];
      const ql = q.toLowerCase();
      return s.filter(x => x.title.toLowerCase().includes(ql)).slice(0, l || 50);
    },
    
    // إدارة الكاش
    clearCache: async () => { 
      await db.del(KEYS.ALL); 
      await db.del(KEYS.TS);
      try {
        const allKeys = await db.keys();
        for (const k of allKeys) {
          if (k.startsWith(KEYS.INFO) || k.startsWith('h90_sr_')) {
            await db.del(k);
          }
        }
      } catch (e) {}
      log('🧹 Cache cleared');
      return true;
    },
    
    // معلومات التخزين (للتشخيص)
    storageInfo: () => db.info()
  };
})();

window.SeriesAPI = SeriesAPI;
console.log('%cH90 Series v20.0 (Hybrid Storage: IndexedDB + localStorage) 🗄️🔐', 'background:linear-gradient(135deg,#00e5ff,#9c27b0);color:#fff;padding:5px 12px;border-radius:8px;font-weight:900;font-size:11px;');
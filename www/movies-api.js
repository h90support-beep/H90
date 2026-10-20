/* ================================================================
   H90 — MOVIES API v20.0 (Full Details, Fast Built-in Encryption)
   ================================================================
   ✅ جلب القصة (Plot) والممثلين (Cast) والمخرج (Director).
   ✅ تشفير داخلي سريع (Built-in XOR + Base64) بدون مكتبات خارجية.
   ✅ كاش لمدة أسبوع كامل (لا يعيد التحميل إلا عند الحاجة).
   ✅ تخزين هجين: IndexedDB (أساسي) + localStorage (احتياطي).
   ✅ حفظ موثوق للبيانات الكبيرة (يدعم عشرات الآلاف من الأفلام).
   ✅ حماية من الأخطاء الصامتة، وتزامن كامل مع movies-styles.css.
   ================================================================ */
'use strict';

const MoviesAPI = (function () {
  /* ================================================================
     ⚙️ الإعدادات الأساسية
     ================================================================ */
  const CONFIG = {
    CACHE_HOURS: 168,           // 7 أيام
    TIMEOUT_MS: 30000,          // 30 ثانية
    SECRET_KEY: 'H90_Movies_Secure_Key_2026_!@#',
    SILENT: false,
    DB_NAME: 'H90_MoviesDB',
    DB_VERSION: 1,
    STORE: 'cache'
  };

  function log(...a) { if (!CONFIG.SILENT) console.log('%c[M]', 'color:#00e5ff;font-weight:900;', ...a); }
  function warn(...a) { if (!CONFIG.SILENT) console.warn('%c[M]', 'color:#ffb300;font-weight:900;', ...a); }
  function error(...a) { console.error('%c[M]', 'color:#ff2d55;font-weight:900;', ...a); }

  /* ================================================================
     📂 التصنيفات
     ================================================================ */
  const CATEGORIES = {
    '254': '2026', '98': '2024-2026 UHD', '122': 'TOP IMDB', '192': 'English 4K',
    '256': 'Marvel', '255': 'DC', '241': 'Horror', '248': 'Thriller',
    '242': 'Drama', '246': 'Crime', '243': 'Adventure', '251': 'Comedy',
    '247': 'Romance', '245': 'War', '171': 'Documentary', '186': 'KIDS',
    '213': 'Anime', '159': 'KIDS 2', '168': 'Arabic', '227': 'WWE PPV'
  };

  const KEYS = { 
    ALL: 'h90_mv_enc_v20', 
    TS: 'h90_mv_ts_v20', 
    INFO: 'h90_mv_info_v20_' 
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
      // استخدم btoa على بايتات آمنة (نتفادى مشاكل Unicode)
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
        // بيانات تالفة — نظّف
        localStorage.removeItem(key);
        warn('Corrupted cache removed for:', key);
      }
      return dec;
    } catch (e) { return null; }
  }

  const db = {
    // حفظ: IndexedDB أولاً (بيانات كبيرة)، localStorage احتياطي (timestamp صغير)
    set: async (k, v) => {
      const okIdb = await idbSet(k, v);
      if (okIdb) return true;
      // Fallback: localStorage
      return safeLocalSet(k, v);
    },
    
    get: async (k) => {
      // جرّب IndexedDB أولاً
      const idbVal = await idbGet(k);
      if (idbVal !== null) return idbVal;
      // Fallback: localStorage
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
     📡 جلب الأفلام
     ================================================================ */
  async function loadMovies(force) {
    if (!force) {
      const ts = await db.get(KEYS.TS);
      if (ts && (Date.now() - ts) / 3600000 < CONFIG.CACHE_HOURS) {
        const cached = await db.get(KEYS.ALL);
        if (cached && Array.isArray(cached) && cached.length) {
          log('✅ Loaded from cache:', cached.length, 'movies');
          return cached;
        }
        warn('⚠️ Timestamp valid but data missing — reloading');
      }
    }
    
    try {
      const url = buildApiUrl('get_vod_streams');
      const raw = await httpGet(url);
      if (!Array.isArray(raw)) {
        warn('API returned non-array');
        return (await db.get(KEYS.ALL)) || [];
      }
      
      const movies = raw.map(r => ({
        id: r.stream_id || r.id,
        name: r.name || '',
        title: r.name || '',
        year: pickYear(r),
        rating: parseFloat(r.rating) || 0,
        poster: proxyImage(cleanImageUrl(r.stream_icon)),
        originalPoster: cleanImageUrl(r.stream_icon),
        categoryId: String(r.category_id || ''),
        categoryName: CATEGORIES[r.category_id] || 'أفلام',
        extension: r.container_extension || 'mkv',
        addedAt: parseInt(r.added || '0', 10) || 0
      }));
      
      // ✅ حفظ مع التحقق
      log('Saving', movies.length, 'movies...');
      const savedMovies = await db.set(KEYS.ALL, movies);
      const savedTs = await db.set(KEYS.TS, Date.now());
      
      if (!savedMovies || !savedTs) {
        error('❌ Cache save FAILED!', await db.info());
      } else {
        log('✅ Cache saved OK:', movies.length, 'movies');
      }
      
      log('Total movies fetched:', movies.length);
      return movies;
    } catch (e) {
      error('Load failed:', e);
      return (await db.get(KEYS.ALL)) || [];
    }
  }

  /* ================================================================
     🎯 جلب تفاصيل الفيلم (القصة + الممثلين)
     ================================================================ */
  async function getMovieInfo(movieId) {
    const cacheKey = KEYS.INFO + movieId;
    const cached = await db.get(cacheKey);
    if (cached) return cached;
    
    try {
      const url = buildApiUrl('get_vod_info', '&vod_id=' + movieId);
      const data = await httpGet(url, 15000);
      
      const info = data.info || {};
      const movieData = data.movie_data || {};
      
      const result = { 
        plot: info.plot || info.description || movieData.plot || '', 
        cast: info.cast || movieData.cast || '', 
        director: info.director || movieData.director || '',
        genre: info.genre || movieData.genre || '',
        releaseDate: info.releasedate || movieData.releasedate || '',
        duration: info.duration || movieData.duration || ''
      };
      await db.set(cacheKey, result);
      return result;
    } catch (e) {
      error('Info failed:', e);
      return { plot: '', cast: '', director: '', genre: '', releaseDate: '', duration: '' };
    }
  }

  async function buildStreamUrl(movieId, ext) {
    if (window.__H90_Assembler__ && window.__H90_Assembler__.movies) {
      return window.__H90_Assembler__.movies.getStreamUrl(movieId, ext || 'mkv');
    }
    return null;
  }

  /* ================================================================
     🌍 الواجهة العامة (Public API)
     ================================================================ */
  return {
    loadMovies, 
    getMovieInfo, 
    buildStreamUrl, 
    proxyImage,
    
    // فلاتر
    getTrending: (m, l) => [...m].sort((a, b) => b.rating - a.rating).slice(0, l || 20),
    getTopRated: (m, l) => [...m].filter(x => x.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, l || 20),
    getRecentlyAdded: (m, l) => [...m].sort((a, b) => b.addedAt - a.addedAt).slice(0, l || 20),
    getNewReleases: (m, l) => [...m].filter(x => x.year >= 2023).sort((a, b) => b.year - a.year).slice(0, l || 20),
    filterByCategory: (m, id) => !id ? m : m.filter(x => String(x.categoryId) === String(id)),
    search: (m, q, l) => {
      if (!q || q.length < 2) return [];
      const ql = q.toLowerCase();
      return m.filter(x => x.title.toLowerCase().includes(ql)).slice(0, l || 50);
    },
    
    // إدارة الكاش
    clearCache: async () => { 
      await db.del(KEYS.ALL); 
      await db.del(KEYS.TS);
      try {
        const allKeys = await db.keys();
        for (const k of allKeys) {
          if (k.startsWith(KEYS.INFO) || k.startsWith('h90_mv_')) {
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

window.MoviesAPI = MoviesAPI;
console.log('%cH90 Movies v20.0 (Hybrid Storage: IndexedDB + localStorage) 🗄️🔐', 'background:linear-gradient(135deg,#00e5ff,#9c27b0);color:#fff;padding:5px 12px;border-radius:8px;font-weight:900;font-size:11px;');
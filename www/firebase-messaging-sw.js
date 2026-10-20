/* ══════════════════════════════════════════════════════════════════════
   H90 — FIREBASE MESSAGING SERVICE WORKER
   Fixed Edition v5.1 — GitHub Pages Compatible
   ══════════════════════════════════════════════════════════════════════
   
   ✅ معالجة إشعارات Firebase في الخلفية
   ✅ 🆕 TRUSTED_HOSTS يشمل GitHub Pages
   ✅ 🆕 أيقونات SVG افتراضية (لا تعتمد على ملفات خارجية)
   ✅ 🆕 دعم كامل لإشعارات الغرف
   ✅ 🆕 نظام كتم الغرف (Room Mute)
   ✅ 🆕 أزرار تفاعلية (فتح / كتم)
   ✅ 🆕 اهتزاز على الجوال
   ✅ تعقيم المدخلات (XSS)
   ✅ فحص URLs (منع phishing)
   ✅ منع تكرار الإشعارات
   ✅ Bootstrap فوري
   ================================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════════
   [01] Firebase Config
   ══════════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCcSOO7ucaSokbvUUrFFNNbpbbMaXsmSUk",
  authDomain: "h90-app.firebaseapp.com",
  databaseURL: "https://h90-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "h90-app",
  storageBucket: "h90-app.firebasestorage.app",
  messagingSenderId: "790663609291",
  appId: "1:790663609291:web:a28a42f4b493ebdba2144e"
};

/* ══════════════════════════════════════════════════════════════════
   [02] الإعدادات — محدّثة لتشمل GitHub Pages
   ══════════════════════════════════════════════════════════════════ */

const SETTINGS = {
  MAX_PAYLOAD_SIZE: 8192,
  MAX_TITLE_LENGTH: 100,
  MAX_BODY_LENGTH: 300,
  DEDUP_TTL: 300000,
  DEDUP_MAX_ENTRIES: 50,
  TRUSTED_HOSTS: [
    'h90support-beep.github.io',      /* 🆕 GitHub Pages */
    'h90-app.com',
    'www.h90-app.com',
    'h90-app.firebaseapp.com',
    'h90-app.web.app',
    'localhost',
    '127.0.0.1'
  ],
  MUTE_CACHE: 'h90-muted-v1',
  MUTE_PATH: '/muted-rooms.json',
  DEFAULT_ICON: 'https://h90support-beep.github.io/H90app/H90.jpg',
  DEFAULT_BADGE: 'https://h90support-beep.github.io/H90app/H90.jpg'
};

/* ══════════════════════════════════════════════════════════════════
   [03] LOGGER
   ══════════════════════════════════════════════════════════════════ */

const LOG = {
  info: function(msg, data) { console.log('[H90-SW]', msg, data || ''); },
  warn: function(msg, data) { console.warn('[H90-SW]', msg, data || ''); },
  error: function(msg, data) { console.error('[H90-SW]', msg, data || ''); }
};

/* ══════════════════════════════════════════════════════════════════
   [04] Sanitizer
   ══════════════════════════════════════════════════════════════════ */

const Sanitizer = (function() {

  const DANGEROUS_PATTERNS = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /on\w+\s*=/gi,
    /<img[^>]+onerror/gi,
    /<svg[^>]+onload/gi
  ];

  function clean(input, maxLength) {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') input = String(input);

    let output = input;

    for (let i = 0; i < DANGEROUS_PATTERNS.length; i++) {
      output = output.replace(DANGEROUS_PATTERNS[i], '');
    }

    output = output.replace(/[<>]/g, '');
    output = output.replace(/[\x00-\x1F\x7F]/g, '');

    if (maxLength && output.length > maxLength) {
      output = output.substring(0, maxLength);
    }

    return output.trim();
  }

  return { clean: clean };

})();

/* ══════════════════════════════════════════════════════════════════
   [05] URL Guard
   ══════════════════════════════════════════════════════════════════ */

const URLGuard = (function() {

  const DANGEROUS_PROTOCOLS = [
    'javascript:', 'data:', 'vbscript:', 'file:', 'blob:'
  ];

  function isValid(url) {
    if (typeof url !== 'string' || !url) return false;

    const lower = url.toLowerCase().trim();

    for (let i = 0; i < DANGEROUS_PROTOCOLS.length; i++) {
      if (lower.indexOf(DANGEROUS_PROTOCOLS[i]) === 0) return false;
    }

    if (lower.indexOf('//') === 0) return false;
    if (lower.indexOf('\\') > -1) return false;

    if (lower.indexOf('%00') > -1 ||
        lower.indexOf('%0a') > -1 ||
        lower.indexOf('%0d') > -1) {
      return false;
    }

    return true;
  }

  function isTrusted(url) {
    try {
      const parsed = new URL(url);
      for (let i = 0; i < SETTINGS.TRUSTED_HOSTS.length; i++) {
        const host = SETTINGS.TRUSTED_HOSTS[i];
        if (parsed.hostname === host ||
            parsed.hostname.endsWith('.' + host)) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /* ✅ استخراج URL آمن — يرجع رابطاً نسبياً أو موثوقاً */
  function extractSafe(rawUrl) {
    if (!rawUrl) return '/';

    const url = String(rawUrl).trim();

    /* رابط نسبي */
    if (url.charAt(0) === '/' && url.indexOf('//') !== 0 && url.indexOf('/\\') !== 0) {
      return url.substring(0, 200);
    }

    /* رابط مطلق */
    if (isValid(url)) {
      /* 🆕 إذا كان الرابط مطلقاً، حوّله لمسار نسبي إن كان من نفس الأصل */
      try {
        const parsed = new URL(url);
        if (parsed.pathname && isTrusted(url)) {
          return parsed.pathname + parsed.search + parsed.hash;
        }
      } catch (e) {}

      if (isTrusted(url)) return url;
      return '/';
    }

    return '/';
  }

  return {
    isValid: isValid,
    isTrusted: isTrusted,
    extractSafe: extractSafe
  };

})();

/* ══════════════════════════════════════════════════════════════════
   [06] Deduplicator
   ══════════════════════════════════════════════════════════════════ */

const Deduplicator = (function() {

  const _seen = new Map();

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  }

  function isDuplicate(payload) {
    try {
      const title = (payload.notification && payload.notification.title) || '';
      const body = (payload.notification && payload.notification.body) || '';
      const tag = (payload.data && payload.data.tag) || '';
      const ts = (payload.data && payload.data.timestamp) || '';
      const key = hash(title + '|' + body + '|' + tag + '|' + ts);

      const now = Date.now();

      if (_seen.size > SETTINGS.DEDUP_MAX_ENTRIES) {
        const firstKey = _seen.keys().next().value;
        _seen.delete(firstKey);
      }

      if (_seen.has(key)) {
        const lastSeen = _seen.get(key);
        if (now - lastSeen < SETTINGS.DEDUP_TTL) {
          return true;
        }
      }

      _seen.set(key, now);
      return false;

    } catch (e) {
      return false;
    }
  }

  return { isDuplicate: isDuplicate };

})();

/* ══════════════════════════════════════════════════════════════════
   [07] Muted Rooms Manager
   ══════════════════════════════════════════════════════════════════ */

const MuteManager = (function() {

  let _mutedRooms = [];
  let _loaded = false;
  let _loadPromise = null;

  async function load() {
    if (_loaded) return _mutedRooms;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async function() {
      try {
        const cache = await caches.open(SETTINGS.MUTE_CACHE);
        const res = await cache.match(SETTINGS.MUTE_PATH);
        if (res) {
          const arr = await res.json();
          _mutedRooms = Array.isArray(arr) ? arr.map(String) : [];
        } else {
          _mutedRooms = [];
        }
      } catch (e) {
        LOG.warn('Mute load failed:', e.message);
        _mutedRooms = [];
      }
      _loaded = true;
      _loadPromise = null;
      return _mutedRooms;
    })();

    return _loadPromise;
  }

  async function save(arr) {
    try {
      const safe = (Array.isArray(arr) ? arr : []).map(String).slice(0, 200);
      const cache = await caches.open(SETTINGS.MUTE_CACHE);
      await cache.put(
        SETTINGS.MUTE_PATH,
        new Response(JSON.stringify(safe), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
      _mutedRooms = safe;
      _loaded = true;
      LOG.info('🔕 Muted rooms saved:', safe.length);
      return true;
    } catch (e) {
      LOG.error('Mute save failed:', e.message);
      return false;
    }
  }

  function isMuted(roomId) {
    if (!roomId) return false;
    return _mutedRooms.indexOf(String(roomId)) !== -1;
  }

  async function add(roomId) {
    await load();
    if (!roomId) return false;
    const id = String(roomId);
    if (_mutedRooms.indexOf(id) === -1) {
      _mutedRooms.push(id);
      await save(_mutedRooms);
      return true;
    }
    return false;
  }

  async function remove(roomId) {
    await load();
    if (!roomId) return false;
    const id = String(roomId);
    const idx = _mutedRooms.indexOf(id);
    if (idx !== -1) {
      _mutedRooms.splice(idx, 1);
      await save(_mutedRooms);
      return true;
    }
    return false;
  }

  return {
    load: load,
    save: save,
    isMuted: isMuted,
    add: add,
    remove: remove,
    getList: function() { return _mutedRooms.slice(); }
  };

})();

/* ══════════════════════════════════════════════════════════════════
   [08] Firebase Init
   ══════════════════════════════════════════════════════════════════ */

let _firebaseReady = false;
let _messaging = null;
let _scriptsLoaded = false;
let _handlersReady = false;

function initFirebase() {
  if (_firebaseReady) return true;

  try {
    if (!_scriptsLoaded) {
      importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
      importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');
      _scriptsLoaded = true;
    }

    if (typeof firebase === 'undefined') {
      LOG.error('Firebase SDK not loaded');
      return false;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    if (firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported()) {
      _messaging = firebase.messaging();
      _firebaseReady = true;
      LOG.info('Firebase initialized ✅');
      return true;
    } else {
      LOG.warn('Firebase Messaging غير مدعوم');
      return false;
    }

  } catch (e) {
    LOG.error('Firebase init failed:', e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════
   [09] Icon per notification type
   ══════════════════════════════════════════════════════════════════ */

function pickIcon(type, fallback) {
  /* 🆕 كل الأيقونات ترجع للأيقونة الرئيسية — لأن ملفات icons/*.png غير موجودة */
  return fallback || SETTINGS.DEFAULT_ICON;
}

/* ══════════════════════════════════════════════════════════════════
   [10] Build Notification
   ══════════════════════════════════════════════════════════════════ */

function buildNotification(payload) {
  try {
    const rawTitle = (payload.notification && payload.notification.title) ||
                     (payload.data && payload.data.title) || 'H90';
    const rawBody = (payload.notification && payload.notification.body) ||
                    (payload.data && payload.data.body) || 'لديك إشعار جديد';
    const rawIcon = (payload.notification && payload.notification.icon) ||
                    (payload.data && payload.data.icon) || SETTINGS.DEFAULT_ICON;
    const rawTag = (payload.data && payload.data.tag) || 'h90-bg';
    const rawURL = (payload.data && payload.data.url) || '/';
    const type = (payload.data && payload.data.type) || '';
    const roomId = (payload.data && payload.data.roomId) || '';

    const title = Sanitizer.clean(rawTitle, SETTINGS.MAX_TITLE_LENGTH);
    const body = Sanitizer.clean(rawBody, SETTINGS.MAX_BODY_LENGTH);
    const icon = rawIcon || SETTINGS.DEFAULT_ICON;
    const tag = Sanitizer.clean(rawTag, 50) + (roomId ? '-' + Sanitizer.clean(roomId, 30) : '');
    const url = URLGuard.extractSafe(rawURL);

    if (!title || title.length < 1) {
      LOG.warn('Empty title — skip');
      return null;
    }

    const importantTypes = ['room_kick', 'room_close'];
    const requireInteraction = importantTypes.indexOf(type) !== -1;

    const actions = [];
    actions.push({ action: 'open', title: '📂 فتح' });
    if (roomId && type.indexOf('room_') === 0) {
      actions.push({ action: 'mute', title: '🔕 كتم الغرفة' });
    }

    return {
      title: title,
      options: {
        body: body,
        icon: icon,
        badge: SETTINGS.DEFAULT_BADGE,
        tag: tag,
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: requireInteraction,
        silent: false,
        renotify: true,
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
        actions: actions,
        data: {
          url: url,
          roomId: roomId,
          type: type,
          ts: Date.now()
        }
      }
    };

  } catch (e) {
    LOG.error('Build notification failed:', e.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════
   [11] Background Handler
   ══════════════════════════════════════════════════════════════════ */

function setupBackgroundHandler() {
  if (!_messaging) {
    LOG.warn('Messaging not ready');
    return;
  }

  if (_handlersReady) {
    LOG.info('Background handler already set up');
    return;
  }

  _messaging.onBackgroundMessage(function(payload) {
    LOG.info('🔔 BG message received:', JSON.stringify(payload).substring(0, 200));

    return (async function() {
      try {
        const payloadSize = (function() {
          try { return JSON.stringify(payload).length; }
          catch (e) { return 0; }
        })();

        if (payloadSize > SETTINGS.MAX_PAYLOAD_SIZE) {
          LOG.warn('Payload too large:', payloadSize);
          return;
        }

        await MuteManager.load();
        const roomId = (payload.data && payload.data.roomId) || '';
        if (roomId && MuteManager.isMuted(roomId)) {
          LOG.info('🔕 Room muted — skip:', roomId);
          return;
        }

        if (Deduplicator.isDuplicate(payload)) {
          LOG.info('Duplicate — skip');
          return;
        }

        const notification = buildNotification(payload);
        if (!notification) {
          LOG.warn('Build failed');
          return;
        }

        try {
          await self.registration.showNotification(notification.title, notification.options);
          LOG.info('📬 Shown:', notification.title);
        } catch (err) {
          LOG.error('showNotification failed:', err.message);
        }

      } catch (e) {
        LOG.error('BG handler error:', e.message);
      }
    })();
  });

  _handlersReady = true;
  LOG.info('Background handler setup ✅');
}

/* ══════════════════════════════════════════════════════════════════
   [12] Notification Click Handler
   ══════════════════════════════════════════════════════════════════ */

function setupClickHandler() {
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    try {
      const data = event.notification.data || {};
      const roomId = data.roomId || '';
      const action = event.action || '';

      if (action === 'mute' && roomId) {
        event.waitUntil((async function() {
          const added = await MuteManager.add(roomId);
          LOG.info(added ? '🔕 Muted room: ' + roomId : 'Already muted: ' + roomId);
        })());
        return;
      }

      const rawURL = data.url || '/';
      const safeURL = URLGuard.extractSafe(rawURL);

      event.waitUntil(handleClick(safeURL));

    } catch (e) {
      LOG.error('Click handler error:', e.message);
    }
  });

  LOG.info('Click handler setup ✅');
}

async function handleClick(safeURL) {
  try {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (let i = 0; i < clientList.length; i++) {
      const client = clientList[i];

      try {
        const clientURL = new URL(client.url);
        if (clientURL.origin !== self.location.origin) continue;

        if ('focus' in client) {
          await client.focus();

          if (safeURL.charAt(0) === '/' && 'navigate' in client) {
            try { await client.navigate(safeURL); } catch (e) {}
          }
          return;
        }
      } catch (e) {}
    }

    if (clients.openWindow) {
      /* 🆕 استخدم scope الصحيح للتطبيق على GitHub Pages */
      let targetURL = self.registration.scope;
      if (safeURL.charAt(0) === '/') {
        targetURL = self.registration.scope.replace(/\/$/, '') + safeURL;
      }
      return clients.openWindow(targetURL);
    }

  } catch (e) {
    LOG.error('Handle click failed:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   [13] Message Handler
   ══════════════════════════════════════════════════════════════════ */

function setupMessageHandler() {
  self.addEventListener('message', function(event) {
    try {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
      }

      if (data.type === 'PING') {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'PONG',
            timestamp: Date.now(),
            ready: _firebaseReady
          });
        }
      }

      if (data.type === 'GET_STATUS') {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'STATUS',
            firebaseReady: _firebaseReady,
            hasMessaging: !!_messaging,
            mutedRooms: MuteManager.getList(),
            timestamp: Date.now()
          });
        }
      }

      if (data.type === 'MUTE_ROOMS_UPDATE') {
        MuteManager.save(data.mutedRooms || []).then(function(ok) {
          LOG.info('🔕 MUTE_ROOMS_UPDATE from app:', ok);
        });
      }

      if (data.type === 'MUTE_ROOM') {
        MuteManager.add(data.roomId).then(function() {
          LOG.info('🔕 MUTE_ROOM:', data.roomId);
        });
      }

      if (data.type === 'UNMUTE_ROOM') {
        MuteManager.remove(data.roomId).then(function() {
          LOG.info('🔔 UNMUTE_ROOM:', data.roomId);
        });
      }

      if (data.type === 'GET_MUTED_ROOMS') {
        if (event.ports && event.ports[0]) {
          MuteManager.load().then(function() {
            event.ports[0].postMessage({
              type: 'MUTED_ROOMS',
              rooms: MuteManager.getList()
            });
          });
        }
      }

    } catch (e) {
      LOG.error('Message handler error:', e.message);
    }
  });

  LOG.info('Message handler setup ✅');
}

/* ══════════════════════════════════════════════════════════════════
   [14] Lifecycle
   ══════════════════════════════════════════════════════════════════ */

self.addEventListener('install', function(event) {
  LOG.info('Installing...');
  event.waitUntil(
    (async function() {
      try {
        await MuteManager.load();
        await self.skipWaiting();
        LOG.info('Install complete ✅');
      } catch (e) {
        LOG.error('Install failed:', e.message);
        try { await self.skipWaiting(); } catch (e2) {}
      }
    })()
  );
});

self.addEventListener('activate', function(event) {
  LOG.info('Activating...');
  event.waitUntil(
    (async function() {
      try {
        initFirebase();
        setupBackgroundHandler();
        setupClickHandler();
        setupMessageHandler();
        await self.clients.claim();
        LOG.info('Activate complete ✅');
      } catch (e) {
        LOG.error('Activate failed:', e.message);
      }
    })()
  );
});

/* ══════════════════════════════════════════════════════════════════
   [15] Push Event (Firebase يتعامل معها عبر onBackgroundMessage)
   ══════════════════════════════════════════════════════════════════ */

self.addEventListener('push', function(event) {
  LOG.info('Push event received (handled by FCM)');
});

/* ══════════════════════════════════════════════════════════════════
   [16] Bootstrap فوري
   ══════════════════════════════════════════════════════════════════ */

(function bootstrap() {
  try {
    MuteManager.load().catch(function(e) {
      LOG.warn('Bootstrap mute load:', e.message);
    });

    const ok = initFirebase();
    if (ok) {
      setupBackgroundHandler();
      setupClickHandler();
      setupMessageHandler();
      LOG.info('Bootstrap complete ✅');
    } else {
      LOG.warn('Bootstrap: Firebase not ready');
    }
  } catch (e) {
    LOG.error('Bootstrap failed:', e.message);
  }
})();

/* ══════════════════════════════════════════════════════════════════
   [17] Global Error Handler
   ══════════════════════════════════════════════════════════════════ */

self.addEventListener('error', function(event) {
  LOG.error('Global error:', event.message || 'unknown');
});

self.addEventListener('unhandledrejection', function(event) {
  LOG.error('Unhandled rejection:', (event.reason && event.reason.message) || 'unknown');
});

/* ══════════════════════════════════════════════════════════════════
   END OF FILE — v5.1
   ══════════════════════════════════════════════════════════════════ */

LOG.info('🚀 H90 Firebase Messaging SW v5.1 loaded — GitHub Pages Ready');
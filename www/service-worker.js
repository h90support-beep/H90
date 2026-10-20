/* ================================================================
   H90 Ultra Edition — Service Worker v5.0 (Fixed)
   ================================================================
   ✅ منع فتح التطبيق بدون إنترنت
   ✅ لا يخزن HTML أبداً
   ✅ يعرض شاشة "غير متصل" أنيقة فقط
   ✅ تخزين كل ملفات JS/CSS الأساسية
   ✅ كشف دقيق للـ Streaming
   ✅ Status codes صحيحة
   ----------------------------------------------------------------
   🆕 v5.0 إصلاحات:
   ✅ إضافة كل ملفات JS المفقودة
   ✅ إصلاح cache: 'reload' → 'default'
   ✅ إصلاح status: 200 → 503 في offline
   ✅ تحسين كشف Streaming (قائمة صريحة)
   ✅ حذف networkFirst (غير مستخدمة)
   ✅ try/catch في install
   ✅ logs أنظف (فقط الأخطاء)
   ================================================================ */

const CACHE_VERSION = '5.0.0';
const CACHE_NAME = `h90-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `h90-runtime-${CACHE_VERSION}`;

/* ============================================================
   ✅ كل الملفات المهمة (بدون HTML)
   ⚠️ لا تضع: './' أو './index.html'
   ============================================================ */
const STATIC_ASSETS = [
  /* CSS */
  './style.css',

  /* Core JS */
  './script.js',
  './player.js',
  './channels.js',
  './matches.js',
  './firebase-config.js',

  /* Servers */
  './channels-server1.js',
  './channels-server2.js',

  /* Extras */
  './vpn-detector.js',
  './rooms.js',

  /* PWA */
  './manifest.json',

  /* Assets */
  './H90.jpg',
  './alwan.png'
];

/* ============================================================
   صفحة "غير متصل" الأنيقة
   ============================================================ */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ff2d55">
<title>H90 — غير متصل</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body {
    background: #0a0a0f;
    color: #fff;
    font-family: -apple-system, Tahoma, 'Cairo', sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center; padding: 30px;
  }
  .tower {
    width: 170px; height: 170px; margin-bottom: 24px;
  }
  .signal-arc {
    transform-origin: 12px 20px;
    animation: pulseArc 2s ease-in-out infinite;
    opacity: 0;
  }
  .signal-arc:nth-child(1) { animation-delay: 0s; }
  .signal-arc:nth-child(2) { animation-delay: 0.3s; }
  .signal-arc:nth-child(3) { animation-delay: 0.6s; }
  @keyframes pulseArc {
    0% { opacity: 0; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.15); }
  }
  .tower-body { animation: floatTower 3s ease-in-out infinite; }
  @keyframes floatTower {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  h1 {
    font-size: 22px; font-weight: 900; margin-bottom: 10px;
    color: #fff;
    letter-spacing: -0.3px;
  }
  p {
    opacity: 0.85; max-width: 320px; line-height: 1.7;
    font-size: 14px; color: rgba(255,255,255,0.75);
    margin-bottom: 28px;
  }
  button {
    background: #ff2d55;
    color: #fff; border: none;
    padding: 14px 36px; border-radius: 30px;
    font-size: 15px; font-weight: 800;
    font-family: inherit; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: transform 0.15s;
  }
  button:active { transform: scale(0.96); }
  button svg { width: 18px; height: 18px; }
</style>
</head>
<body>
  <svg class="tower" viewBox="0 0 24 24" fill="none">
    <g stroke="#ff2d55" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path class="signal-arc" d="M 12 9 A 5 5 0 0 1 17 14" />
      <path class="signal-arc" d="M 12 6 A 8 8 0 0 1 20 14" />
      <path class="signal-arc" d="M 12 3 A 11 11 0 0 1 23 14" />
    </g>
    <g class="tower-body" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <line x1="8" y1="21" x2="12" y2="14" />
      <line x1="16" y1="21" x2="12" y2="14" />
      <line x1="6" y1="18" x2="18" y2="18" />
      <line x1="7" y1="21" x2="17" y2="21" />
      <circle cx="12" cy="13" r="1.2" fill="#fff" stroke="none" />
      <line x1="12" y1="12" x2="12" y2="9" />
    </g>
    <g stroke="#ff2d55" stroke-width="2.2" stroke-linecap="round">
      <line x1="14" y1="17" x2="19" y2="22" />
      <line x1="19" y1="17" x2="14" y2="22" />
    </g>
  </svg>
  <h1>لا يوجد اتصال بالإنترنت</h1>
  <p>يرجى التحقق من اتصالك بالشبكة والمحاولة مرة أخرى</p>
  <button onclick="location.reload()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
    إعادة المحاولة
  </button>
</body>
</html>`;

/* ============================================================
   ✅ قوائم النطاقات المسموح/الممنوع
   ============================================================ */

/* ✅ نطاقات البث (لا تخزين إطلاقاً) */
const STREAMING_HOSTS = [
  'prime-fast.sytes.net',
  'blcco.linkip.org',
  'dairalzor33.workers.dev',
  'houssenali222333.workers.dev',
  'workers.dev'
];

/* ✅ نطاقات الإعلانات والتتبع (نتجاهلها تماماً) */
const AD_HOSTS = [
  'quge5.com',
  'monetag',
  'googletagmanager',
  'google-analytics',
  'googlesyndication',
  'doubleclick',
  'facebook'
];

/* ✅ إمتدادات البث (لا تخزين) */
const STREAMING_EXTENSIONS = ['.m3u8', '.ts', '.mp4', '.mpd', '.m4s', '.mkv', '.webm'];

/* ✅ إمتدادات الملفات الثابتة (نخزنها) */
const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.ico', '.gif'
];

/* ✅ نطاقات CDN (Cache First) */
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

/* ============================================================
   Install — تخزين الملفات (بدون HTML)
   ✅ try/catch لكل ملف
   ✅ نكمل حتى لو بعض الملفات فشلت
   ============================================================ */
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installing', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        /* ✅ نخزن كل الملفات بشكل متوازي مع try/catch لكل واحد */
        return Promise.all(
          STATIC_ASSETS.map((url) => {
            return cache.add(url)
              .catch((err) => {
                console.warn(`[SW] ⚠️ فشل تخزين ${url}:`, err.message);
              });
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Install complete');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] ❌ Install failed:', err);
        /* ✅ حتى لو فشل، نفعّل الـ SW الجديد */
        return self.skipWaiting();
      })
  );
});

/* ============================================================
   Activate — حذف الكاش القديم
   ============================================================ */
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activating', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] 🗑️ حذف كاش قديم:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Activate complete');
        return self.clients.claim();
      })
  );
});

/* ============================================================
   Helper — هل الطلب بث؟
   ============================================================ */
function isStreamingRequest(url, request) {
  /* 1. النطاق */
  for (let i = 0; i < STREAMING_HOSTS.length; i++) {
    if (url.hostname.includes(STREAMING_HOSTS[i])) {
      /* ✅ حتى لو النطاق معروف، نتحقق من الامتداد */
      for (let j = 0; j < STREAMING_EXTENSIONS.length; j++) {
        if (url.pathname.endsWith(STREAMING_EXTENSIONS[j])) return true;
      }
      /* ✅ أو path يحتوي على مؤشرات البث */
      if (url.pathname.includes('/live/') ||
          url.pathname.includes('/stream/') ||
          url.pathname.includes('/hls/')) {
        return true;
      }
      /* ✅ أو فيه token */
      if (url.searchParams.has('token')) return true;
    }
  }

  /* 2. الامتداد */
  for (let i = 0; i < STREAMING_EXTENSIONS.length; i++) {
    if (url.pathname.endsWith(STREAMING_EXTENSIONS[i])) return true;
  }

  /* 3. Accept header */
  const accept = request.headers.get('accept') || '';
  if (accept.includes('application/vnd.apple.mpegurl') ||
      accept.includes('application/x-mpegURL')) {
    return true;
  }

  /* 4. Destination */
  if (request.destination === 'video' || request.destination === 'audio') {
    return true;
  }

  return false;
}

/* ============================================================
   Helper — هل الطلب إعلان؟
   ============================================================ */
function isAdRequest(url) {
  for (let i = 0; i < AD_HOSTS.length; i++) {
    if (url.hostname.includes(AD_HOSTS[i])) return true;
  }
  return false;
}

/* ============================================================
   Helper — هل الطلب HTML؟
   ============================================================ */
function isHTMLRequest(url, request) {
  if (request.destination === 'document') return true;
  if (url.pathname.endsWith('.html')) return true;
  if (url.pathname === '/' || url.pathname === '') return true;

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;

  return false;
}

/* ============================================================
   Helper — هل الطلب ملف ثابت؟
   ============================================================ */
function isStaticRequest(url) {
  for (let i = 0; i < STATIC_EXTENSIONS.length; i++) {
    if (url.pathname.endsWith(STATIC_EXTENSIONS[i])) return true;
  }
  return false;
}

/* ============================================================
   Helper — هل الطلب CDN؟
   ============================================================ */
function isCDNRequest(url) {
  for (let i = 0; i < CDN_HOSTS.length; i++) {
    if (url.hostname.includes(CDN_HOSTS[i])) return true;
  }
  return false;
}

/* ============================================================
   Fetch — الاستراتيجية الرئيسية
   ============================================================ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* 1. تجاهل الطلبات غير GET */
  if (request.method !== 'GET') return;

  /* 2. تجاهل الإعلانات */
  if (isAdRequest(url)) return;

  /* 3. روابط البث → Network Only (بدون Cache) */
  if (isStreamingRequest(url, request)) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('Stream Unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  /* 4. CDN → Cache First */
  if (isCDNRequest(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* 5. ملفات ثابتة → Cache First */
  if (isStaticRequest(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* 6. HTML → Network Only (لا نخزن) */
  if (isHTMLRequest(url, request)) {
    event.respondWith(htmlNetworkOnly(request));
    return;
  }

  /* 7. الافتراضي → Stale While Revalidate */
  event.respondWith(staleWhileRevalidate(request));
});

/* ============================================================
   ✅ HTML: Network Only — لا يعرض نسخة مخزنة
   ✅ عند الفشل → status 503 (لتشغيل شاشة "غير متصل")
   ============================================================ */
async function htmlNetworkOnly(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (e) {
    /* ✅ status 503 مهم عشان المتصفح يفهم إن في مشكلة */
    return new Response(OFFLINE_HTML, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }
}

/* ============================================================
   Cache First — للملفات الثابتة
   ✅ يخزن الملفات الجديدة تلقائياً
   ============================================================ */
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);

    /* ✅ نخزن فقط responses صالحة */
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      /* ✅ نخزن clone بدون انتظار */
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (e) {
    /* ✅ جرب الكاش مرة تانية لو فشل الـ fetch */
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/* ============================================================
   Stale While Revalidate — الافتراضي
   ✅ يعرض المخزن فوراً + يحدّث في الخلفية
   ============================================================ */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        caches.open(RUNTIME_CACHE)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/* ============================================================
   Messages — أوامر من الصفحة
   ============================================================ */
self.addEventListener('message', (event) => {
  if (!event.data) return;

  /* ✅ تخطي الانتظار (تفعيل SW الجديد فوراً) */
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  /* ✅ مسح كل الكاش */
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
  }

  /* ✅ مسح كاش معين */
  if (event.data.type === 'CLEAR_RUNTIME_CACHE') {
    caches.delete(RUNTIME_CACHE).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});

console.log('%c[SW] ✅ H90 Service Worker v5.0 — جاهز',
  'background:linear-gradient(135deg,#ff2d55,#00e5ff);color:#fff;padding:4px 10px;border-radius:6px;font-weight:900;');
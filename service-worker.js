/* ================================================================
   H90 Ultra Edition — Service Worker v4.1 (Fixed)
   PWA offline support + smart cache strategy
   ================================================================ */

// ⚠️ غيّر هذا الرقم مع كل تحديث مهم للتطبيق
const CACHE_VERSION = '4.1.0';
const CACHE_NAME = `h90-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `h90-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './player.js',
  './channels.js',
  './manifest.json',
  './H90.jpg'
];

// ============ Offline Fallback Page ============
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>H90 — غير متصل</title>
<style>
  body {
    margin: 0; min-height: 100vh;
    background: linear-gradient(180deg, #e53935, #7B0F1E);
    color: #fff; font-family: -apple-system, Tahoma, sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center; padding: 30px;
  }
  svg { width: 120px; height: 120px; margin-bottom: 20px; }
  h1 { font-size: 22px; font-weight: 900; margin: 0 0 10px; }
  p { opacity: 0.85; max-width: 300px; line-height: 1.6; font-size: 14px; }
  button {
    margin-top: 24px; background: #fff; color: #e53935;
    border: none; padding: 14px 36px; border-radius: 30px;
    font-size: 15px; font-weight: 800; font-family: inherit;
    cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
</style>
</head>
<body>
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
  <h1>لا يوجد اتصال بالإنترنت</h1>
  <p>يرجى التحقق من اتصالك بالشبكة والمحاولة مرة أخرى</p>
  <button onclick="location.reload()">إعادة المحاولة</button>
</body>
</html>`;

// ============ Install ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_VERSION, '...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets individually');
      // ✅ تخزين فردي — لا يفشل الكل بسبب ملف واحد
      return Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
          .catch(err => console.warn(`[SW] فشل تخزين ${url}:`, err.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============ Activate ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_VERSION, '...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
        .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
        .map(name => {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============ Fetch ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;
  
  // ✅ تجاهل الإعلانات و Analytics تماماً
  if (url.hostname.includes('quge5.com') ||
    url.hostname.includes('monetag') ||
    url.hostname.includes('googletagmanager') ||
    url.hostname.includes('google-analytics') ||
    url.hostname.includes('googlesyndication') ||
    url.hostname === 'www.google.com' ||
    url.hostname.includes('facebook')) {
    return;
  }
  
  // ✅ كشف روابط Streaming (HLS/TS/MP4/MPD) → لا تخزين
  const isStreaming =
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.mpd') ||
    url.pathname.endsWith('.m4s') ||
    url.pathname.includes('/live/') ||
    url.pathname.includes('/stream/') ||
    url.pathname.includes('/hls/') ||
    url.searchParams.has('token') ||
    request.headers.get('accept')?.includes('application/vnd.apple.mpegurl') ||
    request.headers.get('accept')?.includes('video/');
  
  if (isStreaming) {
    // ✅ Streaming: دائماً من الشبكة — بدون تخزين
    event.respondWith(
      fetch(request).catch(() => new Response('Stream Unavailable', { status: 503 }))
    );
    return;
  }
  
  // ✅ CDN خارجية (hls.js, mpegts.js) → Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // ملفات JS/CSS/صور → Cache First
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|eot|ico)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // HTML → Network First with Offline Fallback
  if (request.headers.get('accept')?.includes('text/html') ||
    request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // الافتراضي: Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ============ Strategies ============

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // ✅ صفحة offline أنيقة للمستخدم
    if (request.headers.get('accept')?.includes('text/html') ||
      request.destination === 'document') {
      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200 && response.type !== 'opaque') {
      caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// ============ Messages ============
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

console.log('[SW] ✅ H90 Service Worker loaded — Version', CACHE_VERSION);

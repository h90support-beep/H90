/* ================================================================
   H90 — channels-server2.js (v19.0 — ULTRA SMOOTH)
   ================================================================
   ✅ Worker 2 (Lio) v4.0
   ✅ CHANNEL_LOGOS + GROUP_LOGOS من channels.js
   ✅ Cache ذكي (LocalStorage + IndexedDB للصور)
   🔧 v19.0: تقليب سلس جداً بين القنوات
   🔧 v19.0: preload للقنوات المجاورة
   🔧 v19.0: m3u8 لا تُلفّ — تبقى أصلية
   ⚡ v19.0: GPU acceleration + will-change
   ================================================================ */

'use strict';

/* ─────────────── الإعدادات ─────────────── */
const SERVER2_PROXY_API  = 'https://lio.houssenalhoussen24.workers.dev';
const S2_PROXY_WRAPPER   = 'https://lio.houssenalhoussen24.workers.dev/proxy?url=';

const SERVER2_CACHE_KEY       = 'h90_server2_v19_0';
const SERVER2_CACHE_TIME_KEY  = 'h90_server2_time_v19_0';
const SERVER2_CACHE_DURATION  = 24 * 60 * 60 * 1000;

let SERVER2_DATA        = [];
let SERVER2_GROUPS_DATA = [];
let SERVER2_LOAD_PROMISE = null;   // ⚡ منع التحميل المتكرر
const LOGO_CACHE        = new Map(); // ⚡ cache للصور في الذاكرة
const PRELOAD_MAP       = new Map(); // ⚡ preload للقنوات

/* ═══════════════════════════════════════════════════════════════
   🎨 CSS محسّن — أداء عالٍ + انتقالات سلسة
   ═══════════════════════════════════════════════════════════════ */
(function injectS2Styles() {
  if (document.getElementById('s2-styles-v190')) return;
  const style = document.createElement('style');
  style.id = 's2-styles-v190';
  style.textContent = `
    :root{
      --s1-accent:#63b3ed; --s1-accent2:#9f7aea;
      --s1-text:#f1f5f9;   --s1-text-muted:#94a3b8;
      --s1-border:rgba(255,255,255,.07);
      --s1-border-hover:rgba(255,255,255,.22);
      --s1-radius:18px;    --s1-radius-lg:22px;
      --s1-bg-card:linear-gradient(155deg,#1e2130,#13151f);
      --s1-bg-card-hover:linear-gradient(155deg,#252a3d,#1a1d2b);
      --s1-shadow:0 8px 32px rgba(0,0,0,.4);
      --s1-shadow-hover:0 20px 55px rgba(0,0,0,.6);
    }

    /* ─── الشبكات ─── */
    .s1-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
      gap:16px; padding:16px; direction:rtl;
      contain:layout style paint;
    }
    .s1-grid-groups{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
      gap:18px; padding:16px; direction:rtl;
      contain:layout style paint;
    }
    @media(max-width:640px){
      .s1-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;padding:12px;}
      .s1-grid-groups{grid-template-columns:1fr;padding:12px;}
    }

    /* ─── بطاقة القناة ─── */
    .s1-card{
      position:relative;
      background:var(--s1-bg-card);
      border:1px solid var(--s1-border);
      border-radius:var(--s1-radius);
      overflow:hidden; cursor:pointer;
      display:flex; flex-direction:column;
      aspect-ratio:1/1.18;
      box-shadow:var(--s1-shadow);
      transition:transform .3s cubic-bezier(.22,1,.36,1),
                 box-shadow .3s ease,
                 border-color .3s ease;
      will-change:transform;
      transform:translateZ(0);
      backface-visibility:hidden;
      -webkit-tap-highlight-color:transparent;
      user-select:none;
      contain:layout style paint;
    }
    .s1-card:hover{
      transform:translate3d(0,-6px,0);
      border-color:var(--s1-border-hover);
      box-shadow:var(--s1-shadow-hover);
    }
    .s1-card:active{
      transform:translate3d(0,-2px,0) scale(.985);
      transition-duration:.1s;
    }

    /* ─── شعار ─── */
    .s1-card-logo{
      position:relative; flex:1;
      display:flex; align-items:center; justify-content:center;
      padding:16px; overflow:hidden;
      background:
        radial-gradient(circle at 30% 20%,rgba(99,179,237,.10),transparent 55%),
        radial-gradient(circle at 70% 80%,rgba(159,122,234,.08),transparent 55%);
    }
    .s1-card-logo img{
      max-width:85%; max-height:85%; object-fit:contain;
      filter:drop-shadow(0 4px 14px rgba(0,0,0,.4));
      transition:transform .4s cubic-bezier(.22,1,.36,1);
      will-change:transform;
      backface-visibility:hidden;
    }
    .s1-card:hover .s1-card-logo img{ transform:scale(1.08); }

    .s1-card-letter{
      width:72px; height:72px; border-radius:20px;
      background:linear-gradient(135deg,var(--s1-accent),var(--s1-accent2));
      color:#fff;
      display:flex; align-items:center; justify-content:center;
      font-size:24px; font-weight:800; letter-spacing:1px;
      box-shadow:0 8px 26px rgba(99,179,237,.4),inset 0 1px 1px rgba(255,255,255,.3);
      font-family:'Cairo','Segoe UI',system-ui,sans-serif;
    }

    /* ─── اسم ─── */
    .s1-card-name{
      padding:12px 10px; text-align:center;
      font-size:13px; font-weight:700; color:var(--s1-text);
      background:linear-gradient(180deg,transparent,rgba(0,0,0,.35));
      border-top:1px solid var(--s1-border);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      font-family:'Cairo','Segoe UI',system-ui,sans-serif;
      letter-spacing:.3px;
    }

    /* ─── شارات ─── */
    .s1-card-badge{
      position:absolute; top:10px; right:10px;
      padding:4px 10px; border-radius:8px;
      color:#fff; font-size:10px; font-weight:800;
      letter-spacing:.8px; text-transform:uppercase;
      display:inline-flex; align-items:center; gap:4px;
      background:linear-gradient(135deg,#10b981,#059669);
      box-shadow:0 4px 14px rgba(16,185,129,.45);
      z-index:3;
    }
    .s1-card-badge.quality-hd{
      background:linear-gradient(135deg,#f59e0b,#d97706);
      box-shadow:0 4px 14px rgba(245,158,11,.45);
    }
    .s1-card-badge.quality-4k{
      background:linear-gradient(135deg,#ef4444,#dc2626);
      box-shadow:0 4px 14px rgba(239,68,68,.45);
    }
    .s1-card-badge svg{ width:10px; height:10px; fill:currentColor; }

    .s1-card-live{
      position:absolute; top:10px; left:10px;
      padding:4px 9px; border-radius:8px;
      background:rgba(239,68,68,.95); color:#fff;
      font-size:9px; font-weight:900; letter-spacing:1px;
      display:inline-flex; align-items:center; gap:5px;
      z-index:3;
      box-shadow:0 4px 14px rgba(239,68,68,.5);
    }
    .s1-card-live::before{
      content:''; width:6px; height:6px; background:#fff; border-radius:50%;
      box-shadow:0 0 8px #fff; animation:s1-blink 1.4s ease-in-out infinite;
    }
    @keyframes s1-blink{
      0%,100%{opacity:1;transform:scale(1);}
      50%{opacity:.4;transform:scale(.8);}
    }

    /* ─── زر التشغيل ─── */
    .s1-card-play{
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.6));
      opacity:0; transition:opacity .3s ease;
      z-index:3; pointer-events:none;
    }
    .s1-card:hover .s1-card-play,
    .s1-card:active .s1-card-play{ opacity:1; }
    .s1-card-play-inner{
      width:58px; height:58px; border-radius:50%;
      background:linear-gradient(135deg,rgba(99,179,237,.95),rgba(159,122,234,.95));
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 8px 26px rgba(99,179,237,.55),0 0 0 8px rgba(99,179,237,.15);
      transform:scale(.7);
      transition:transform .35s cubic-bezier(.34,1.56,.64,1);
      will-change:transform;
    }
    .s1-card:hover .s1-card-play-inner,
    .s1-card:active .s1-card-play-inner{ transform:scale(1); }
    .s1-card-play svg{
      width:24px; height:24px; color:#fff;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));
      margin-right:-2px;
    }

    /* ─── بطاقة المجموعة ─── */
    .s1-group-card{
      position:relative; border-radius:var(--s1-radius-lg);
      overflow:hidden; cursor:pointer; aspect-ratio:16/9;
      box-shadow:var(--s1-shadow);
      transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease;
      border:1px solid var(--s1-border);
      will-change:transform;
      transform:translateZ(0);
      backface-visibility:hidden;
      -webkit-tap-highlight-color:transparent;
      contain:layout style paint;
    }
    .s1-group-card:hover{
      transform:translate3d(0,-6px,0);
      box-shadow:0 24px 60px rgba(0,0,0,.65);
      border-color:var(--s1-border-hover);
    }
    .s1-group-cover{
      position:absolute; inset:0;
      background-size:cover; background-position:center;
      background-color:#1e2130;
      transition:transform .6s cubic-bezier(.22,1,.36,1);
      will-change:transform;
      backface-visibility:hidden;
    }
    .s1-group-card:hover .s1-group-cover{ transform:scale(1.08); }
    .s1-group-overlay{
      position:absolute; inset:0;
      background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.5) 45%,rgba(0,0,0,.95));
      z-index:1;
    }
    .s1-group-accent-bar{
      position:absolute; top:0; left:0; right:0; height:3px; z-index:3;
      background:var(--s1-group-accent,linear-gradient(90deg,#63b3ed,#9f7aea));
      box-shadow:0 0 20px var(--s1-group-accent-glow,rgba(99,179,237,.6));
    }
    .s1-group-content{
      position:absolute; inset:0; padding:20px;
      display:flex; flex-direction:column; justify-content:flex-end;
      z-index:2;
    }
    .s1-group-title{
      color:#fff; font-size:22px; font-weight:800;
      margin:0 0 8px; line-height:1.2;
      font-family:'Cairo','Segoe UI',system-ui,sans-serif;
      text-shadow:0 3px 12px rgba(0,0,0,.85);
    }
    .s1-group-meta{ display:flex; align-items:center; gap:10px; margin-top:4px; }
    .s1-group-count{
      display:inline-flex; align-items:center; gap:6px;
      color:#fff; font-size:12px; font-weight:700;
      padding:5px 12px; border-radius:20px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.18);
      backdrop-filter:blur(8px);
      font-family:'Cairo',sans-serif;
    }
    .s1-group-count::before{
      content:''; width:7px; height:7px; border-radius:50%;
      background:#10b981; box-shadow:0 0 10px #10b981;
      animation:s1-blink 2s ease-in-out infinite;
    }
    .s1-group-live-badge{
      display:inline-flex; align-items:center; gap:5px;
      padding:5px 11px; border-radius:20px;
      background:linear-gradient(135deg,#ef4444,#dc2626);
      color:#fff; font-size:10px; font-weight:900; letter-spacing:1px;
      box-shadow:0 4px 14px rgba(239,68,68,.55);
    }
    .s1-group-live-badge::before{
      content:''; width:6px; height:6px; border-radius:50%;
      background:#fff; box-shadow:0 0 8px #fff;
      animation:s1-blink 1.4s ease-in-out infinite;
    }
    .s1-group-arrow{
      position:absolute; top:16px; left:16px;
      width:38px; height:38px; border-radius:50%;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.2);
      backdrop-filter:blur(10px);
      display:flex; align-items:center; justify-content:center;
      color:#fff; z-index:5;
      transition:transform .3s cubic-bezier(.22,1,.36,1),background .3s;
    }
    .s1-group-arrow svg{ width:18px; height:18px; transform:rotate(180deg); }
    .s1-group-card:hover .s1-group-arrow{
      background:rgba(255,255,255,.25);
      transform:scale(1.1) translateX(-3px);
    }

    /* ─── حالات ─── */
    .s1-empty{
      grid-column:1/-1; text-align:center; padding:70px 20px;
      color:var(--s1-text-muted);
      font-family:'Cairo',sans-serif; font-size:15px; font-weight:600;
      direction:rtl;
      display:flex; flex-direction:column; align-items:center; gap:12px;
    }
    .s1-skeleton{
      background:var(--s1-bg-card);
      border:1px solid var(--s1-border);
      border-radius:var(--s1-radius);
      overflow:hidden; aspect-ratio:1/1.18;
      position:relative;
    }
    .s1-skeleton::after{
      content:''; position:absolute; inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);
      animation:s1-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes s1-shimmer{
      0%{transform:translateX(-100%);}
      100%{transform:translateX(100%);}
    }
    .s1-skeleton-groups{ aspect-ratio:16/9; border-radius:var(--s1-radius-lg); }

    /* ─── دخول ─── */
    .s1-card,.s1-group-card{
      animation:s1-fadeIn .5s cubic-bezier(.22,1,.36,1) backwards;
    }
    @keyframes s1-fadeIn{
      from{opacity:0;transform:translateY(20px) scale(.95);}
      to{opacity:1;transform:translateY(0) scale(1);}
    }

    /* ─── تقليل الحركة ─── */
    @media(prefers-reduced-motion:reduce){
      .s1-card,.s1-group-card,.s1-card-logo img,.s1-group-cover{ transition:none!important; animation:none!important; }
    }
  `;
  document.head.appendChild(style);
  console.log('[S2] Styles injected (v19.0)');
})();

/* ═══════════════════════════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════════════════════════ */
const S2_ICONS = {
  play:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  signal:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>',
  tv:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  quality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
};

/* ═══════════════════════════════════════════════════════════════
   TARGET GROUPS
   ═══════════════════════════════════════════════════════════════ */
const S2_TARGET_GROUPS = [
  { id:'bein',        name_ar:'beIN Sports',        icon:'sports',    order:1,  accent:'#8b5cf6', accent2:'#6d28d9' },
  { id:'shahid',      name_ar:'Shahid Sport',       icon:'satellite', order:2,  accent:'#f97316', accent2:'#ea580c' },
  { id:'alwan',       name_ar:'ALWAN Sport',        icon:'palette',   order:3,  accent:'#06b6d4', accent2:'#0891b2' },
  { id:'shasha',      name_ar:'Shasha',             icon:'theater',   order:4,  accent:'#ec4899', accent2:'#db2777' },
  { id:'thmanyah',    name_ar:'Thmanyah',           icon:'hash',      order:5,  accent:'#eab308', accent2:'#ca8a04' },
  { id:'alkass',      name_ar:'Al Kass',            icon:'film',      order:6,  accent:'#10b981', accent2:'#059669' },
  { id:'fajer',       name_ar:'AL FAJER',           icon:'sunrise',   order:7,  accent:'#f59e0b', accent2:'#d97706' },
  { id:'adsports',    name_ar:'AD Sports',          icon:'sports',    order:8,  accent:'#3b82f6', accent2:'#2563eb' },
  { id:'dubaisports', name_ar:'Dubai Sports',       icon:'satellite', order:9,  accent:'#14b8a6', accent2:'#0d9488' },
  { id:'ksasports',   name_ar:'KSA Sports',         icon:'sports',    order:10, accent:'#22c55e', accent2:'#16a34a' },
  { id:'starzplay',   name_ar:'StarzPlay Sport',    icon:'film',      order:11, accent:'#a855f7', accent2:'#9333ea' },
  { id:'arabic',      name_ar:'قنوات رياضية عربية', icon:'tv',        order:12, accent:'#ef4444', accent2:'#dc2626' }
];

function getS2BrandIcon(g){
  const map={bein:'sports',shahid:'satellite',alwan:'palette',shasha:'theater',
             thmanyah:'hash',alkass:'film',fajer:'sunrise',adsports:'sports',
             dubaisports:'satellite',ksasports:'sports',starzplay:'film',arabic:'tv'};
  return map[g]||'tv';
}

/* ═══════════════════════════════════════════════════════════════
   🔧 v19.0: إصلاح m3u8 — لا تلفّها
   ═══════════════════════════════════════════════════════════════ */
function wrapUrlIfNeeded(url) {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';

  // ملفوفة مسبقاً
  if (u.includes('/proxy?url=')) return u;

  // ⚡ m3u8 → اتركها أصلية
  if (/\.m3u8(\?|$)/i.test(u)) return u;

  // ts → لُفّ
  if (/\.ts(\?|$)/i.test(u)) return S2_PROXY_WRAPPER + encodeURIComponent(u);

  // http/https → لُفّ
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return S2_PROXY_WRAPPER + encodeURIComponent(u);
  }

  return u;
}

/* ═══════════════════════════════════════════════════════════════
   _applyLogoToChannel
   ═══════════════════════════════════════════════════════════════ */
function _applyLogoToChannel(ch) {
  if (!ch) return ch;
  if (ch.logo && ch.logo.trim()) {
    if (ch.logo.startsWith('http://')) ch.logo = S2_PROXY_WRAPPER + encodeURIComponent(ch.logo);
    return ch;
  }
  if (typeof CHANNEL_LOGOS !== 'undefined' && CHANNEL_LOGOS[ch.id]) {
    let url = CHANNEL_LOGOS[ch.id];
    if (url.startsWith('http://')) url = S2_PROXY_WRAPPER + encodeURIComponent(url);
    ch.logo = url;
    return ch;
  }
  if (typeof GROUP_LOGOS !== 'undefined' && ch.group && GROUP_LOGOS[ch.group]) {
    let gurl = GROUP_LOGOS[ch.group];
    if (gurl.startsWith('http://')) gurl = S2_PROXY_WRAPPER + encodeURIComponent(gurl);
    ch.logo = gurl;
    return ch;
  }
  return ch;
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ v19.0: Preload للقنوات المجاورة (للتقليب السلس)
   ═══════════════════════════════════════════════════════════════ */
function s2PreloadAround(channelId, range) {
  range = range || 3;
  const list = SERVER2_DATA;
  if (!list.length) return;
  const idx = list.findIndex(c => c.id === channelId);
  if (idx === -1) return;

  const targets = [];
  for (let i = Math.max(0, idx - range); i <= Math.min(list.length - 1, idx + range); i++) {
    if (i !== idx) targets.push(list[i]);
  }

  targets.forEach(ch => {
    if (PRELOAD_MAP.has(ch.id)) return;
    const url = ch.urls?.server2?.list?.[0];
    if (!url) return;

    // فقط لروابط m3u8 (لأن HLS يدعم preload)
    if (/\.m3u8(\?|$)/i.test(url)) {
      const link = document.createElement('link');
      link.rel  = 'preload';
      link.href = url;
      link.as   = 'fetch';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      PRELOAD_MAP.set(ch.id, link);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   loadServer2Channels (مع منع التحميل المكرر)
   ═══════════════════════════════════════════════════════════════ */
async function loadServer2Channels(forceReload) {
  // ⚡ منع التحميل المتكرر
  if (!forceReload && SERVER2_LOAD_PROMISE) {
    return SERVER2_LOAD_PROMISE;
  }
  if (!forceReload && SERVER2_DATA.length) {
    return { channels: SERVER2_DATA, groups: SERVER2_GROUPS_DATA };
  }

  SERVER2_LOAD_PROMISE = (async () => {
    try {
      let rawData = null;

      // قراءة الـ cache
      if (!forceReload) {
        try {
          const cachedTime = parseInt(localStorage.getItem(SERVER2_CACHE_TIME_KEY) || '0', 10);
          const cachedData = localStorage.getItem(SERVER2_CACHE_KEY);
          if (cachedData && (Date.now() - cachedTime) < SERVER2_CACHE_DURATION) {
            rawData = JSON.parse(cachedData);
            console.log('[S2] From cache:', rawData.length);
          }
        } catch (_) {}
      }

      // جلب من الشبكة
      if (!rawData) {
        console.log('[S2] Fetching...');
        try {
          const res = await fetch(SERVER2_PROXY_API + '/channels', {
            method: 'GET', cache: 'no-store', mode: 'cors'
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);

          const data = await res.json();
          if (!data.success || !data.channels) throw new Error('Invalid response');

          rawData = data.channels.map(c => {
            const labelsArray = [];
            const urlsArray   = [];
            (c.qualities || []).forEach(q => {
              labelsArray.push(q.label || '');
              urlsArray.push(wrapUrlIfNeeded(q.url));
            });

            const channel = {
              id: c.id,
              name_ar: c.name_ar,
              name_en: c.name_en,
              category: c.group,
              group: c.group,
              brandLabel: c.brandLabel,
              brandIcon: getS2BrandIcon(c.group),
              server: 'server2',
              logo: c.logo || '',
              letter: c.letter || (c.name_ar || '').substring(0, 2).toUpperCase(),
              qualities: c.qualities || [],
              urls: { server2: { qualities: labelsArray, list: urlsArray } }
            };
            _applyLogoToChannel(channel);
            return channel;
          });

          console.log('[S2] Loaded:', rawData.length);

          try {
            localStorage.setItem(SERVER2_CACHE_KEY, JSON.stringify(rawData));
            localStorage.setItem(SERVER2_CACHE_TIME_KEY, Date.now().toString());
          } catch (_) {}
        } catch (e) {
          console.error('[S2-ERROR]', e.message);
          try {
            const cachedData = localStorage.getItem(SERVER2_CACHE_KEY);
            if (cachedData) rawData = JSON.parse(cachedData);
          } catch (_) {}
        }
      }

      SERVER2_DATA        = rawData || [];
      SERVER2_GROUPS_DATA = buildServer2Groups(SERVER2_DATA);

      window.SERVER2_CHANNELS = SERVER2_DATA;
      window.S2_CHANNELS_RAW  = SERVER2_DATA;

      return { channels: SERVER2_DATA, groups: SERVER2_GROUPS_DATA };
    } catch (e) {
      console.error('[S2-ERROR] Load failed:', e);
      SERVER2_LOAD_PROMISE = null;
      return { channels: [], groups: [] };
    }
  })();

  return SERVER2_LOAD_PROMISE;
}

/* ═══════════════════════════════════════════════════════════════
   buildServer2Groups
   ═══════════════════════════════════════════════════════════════ */
function buildServer2Groups(channels) {
  if (!channels?.length) return [];
  const groupsMap = {};

  for (const ch of channels) {
    if (!ch.group) continue;
    if (!groupsMap[ch.group]) {
      groupsMap[ch.group] = { id: ch.group, channels: [], icon: ch.brandIcon, name_ar: ch.brandLabel };
    }
    if (!groupsMap[ch.group].channels.includes(ch.id)) {
      groupsMap[ch.group].channels.push(ch.id);
    }
  }

  const list = [];
  for (const k in groupsMap) {
    const g  = groupsMap[k];
    const tg = S2_TARGET_GROUPS.find(t => t.id === k);
    if (!tg) continue;

    let coverImg = '';
    if (typeof GROUP_LOGOS !== 'undefined' && GROUP_LOGOS[g.id]) {
      coverImg = GROUP_LOGOS[g.id];
      if (coverImg.startsWith('http://')) coverImg = S2_PROXY_WRAPPER + encodeURIComponent(coverImg);
    } else {
      for (const id of g.channels) {
        const ch = channels.find(c => c.id === id);
        if (ch?.logo) { coverImg = ch.logo; break; }
      }
    }

    list.push({
      id: 's2grp_' + g.id,
      name_ar: tg.name_ar,
      icon: tg.icon,
      coverImage: coverImg,
      server: 'server2',
      channels: g.channels,
      _order: tg.order,
      _accent: tg.accent,
      _accent2: tg.accent2
    });
  }

  list.sort((a, b) => a._order - b._order);
  return list;
}

/* ═══════════════════════════════════════════════════════════════
   buildServer2Channels
   ═══════════════════════════════════════════════════════════════ */
function buildServer2Channels() {
  return SERVER2_DATA.map(ch => ({
    id: ch.id,
    name_ar: ch.name_ar,
    name_en: ch.name_en,
    name: ch.name_ar,
    category: ch.category,
    group: ch.group,
    brandLabel: ch.brandLabel,
    brandIcon: ch.brandIcon,
    server: 'server2',
    logo: ch.logo,
    letter: ch.letter,
    qualities: ch.qualities,
    url: ch.urls?.server2?.list?.[0] || '',
    streamUrl: ch.urls?.server2?.list?.[0] || '',
    urls: ch.urls
  }));
}

/* ═══════════════════════════════════════════════════════════════
   clearServer2Cache
   ═══════════════════════════════════════════════════════════════ */
function clearServer2Cache() {
  try {
    localStorage.removeItem(SERVER2_CACHE_KEY);
    localStorage.removeItem(SERVER2_CACHE_TIME_KEY);
    ['v7','v7_1','v8','v8_1','v9_0','v11_0','v12_0','v13_0','v14_0','v14_1',
     'v15_0','v16_0','v17_0','v17_1','v17_2','v18_0'].forEach(v => {
      localStorage.removeItem('h90_server2_' + v);
      localStorage.removeItem('h90_server2_time_' + v);
    });
    SERVER2_DATA = [];
    SERVER2_GROUPS_DATA = [];
    SERVER2_LOAD_PROMISE = null;
    PRELOAD_MAP.forEach(link => link.remove());
    PRELOAD_MAP.clear();
    console.log('[S2] Cache cleared');
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ renderS2ChannelCards — بناء سلس عبر DocumentFragment
   ═══════════════════════════════════════════════════════════════ */
function renderS2ChannelCards(container, channels) {
  if (!container) return;

  if (!channels?.length) {
    container.innerHTML = '<div class="s1-empty">لا توجد قنوات متاحة</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  const EAGER_COUNT = 12; // ⚡ أول 12 صورة بدون lazy

  channels.forEach((ch, idx) => {
    const logo = ch.logo || '';
    const name = ch.name_ar || ch.name_en || 'قناة';
    const letter = (ch.letter || name.substring(0, 2)).toUpperCase();
    const firstQ = ch.qualities?.[0]?.label || '';
    const qClass = /4k/i.test(firstQ) ? 'quality-4k'
                 : /hd|fhd/i.test(firstQ) ? 'quality-hd' : '';

    const card = document.createElement('div');
    card.className = 's1-card';
    card.dataset.channelId = ch.id;
    card.dataset.server = 'server2';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', name);
    card.style.animationDelay = Math.min(idx * 20, 400) + 'ms';

    const loadingMode = idx < EAGER_COUNT ? 'eager' : 'lazy';
    const logoHTML = logo
      ? `<img src="${logo}" alt="${name}" loading="${loadingMode}" decoding="async"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
         <div class="s1-card-letter" style="display:none;">${letter}</div>`
      : `<div class="s1-card-letter">${letter}</div>`;

    const badgeHTML = firstQ
      ? `<div class="s1-card-badge ${qClass}">${S2_ICONS.quality}${firstQ}</div>` : '';

    const liveBadge = ['bein','shahid','alkass'].includes(ch.group)
      ? `<div class="s1-card-live">LIVE</div>` : '';

    card.innerHTML = `
      ${badgeHTML}
      ${liveBadge}
      <div class="s1-card-logo">${logoHTML}</div>
      <div class="s1-card-play">
        <div class="s1-card-play-inner">${S2_ICONS.play}</div>
      </div>
      <div class="s1-card-name">${name}</div>
    `;

    frag.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(frag);

  // ⚡ event delegation بدل inline handlers (أسرع)
  if (!container._s2Bound) {
    container._s2Bound = true;
    container.addEventListener('click', e => {
      const card = e.target.closest('.s1-card');
      if (card?.dataset.channelId) {
        s2OnChannelClick(card.dataset.channelId);
      }
    });
    container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.s1-card');
        if (card?.dataset.channelId) {
          e.preventDefault();
          s2OnChannelClick(card.dataset.channelId);
        }
      }
    });
    // ⚡ إزالة تحريك الماوس على الموبايل
    if (!matchMedia('(hover: none)').matches) {
      container.addEventListener('mousemove', e => {
        const card = e.target.closest('.s1-card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--s1-mx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
        card.style.setProperty('--s1-my', ((e.clientY - rect.top) / rect.height) * 100 + '%');
      }, { passive: true });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   renderS2GroupCards
   ═══════════════════════════════════════════════════════════════ */
function renderS2GroupCards(container, groups, allChannels) {
  if (!container) return;
  container.classList.add('s1-grid-groups');

  if (!groups?.length) {
    container.innerHTML = '<div class="s1-empty">لا توجد مجموعات متاحة</div>';
    return;
  }

  const channelsMap = {};
  (allChannels || []).forEach(c => channelsMap[c.id] = c);

  const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#0f766e"/><stop offset="100%" stop-color="#10b981"/>' +
    '</linearGradient></defs><rect width="640" height="360" fill="url(#g)"/></svg>'
  );

  const frag = document.createDocumentFragment();

  groups.forEach((grp, idx) => {
    let cover = grp.coverImage || '';
    if (!cover && grp.channels?.length) {
      const first = channelsMap[grp.channels[0]];
      if (first?.logo) cover = first.logo;
    }
    if (!cover) cover = FALLBACK;

    const count = (grp.channels || []).length;
    const accent = grp._accent || '#10b981';
    const accent2 = grp._accent2 || '#059669';

    const card = document.createElement('div');
    card.className = 's1-group-card';
    card.dataset.groupId = grp.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.style.setProperty('--s1-group-accent', `linear-gradient(90deg,${accent},${accent2})`);
    card.style.setProperty('--s1-group-accent-glow', accent + '99');
    card.style.animationDelay = Math.min(idx * 40, 500) + 'ms';

    card.innerHTML = `
      <div class="s1-group-cover" style="background-image:url('${cover}');"></div>
      <div class="s1-group-overlay"></div>
      <div class="s1-group-accent-bar"></div>
      <div class="s1-group-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>
      <div class="s1-group-content">
        <h3 class="s1-group-title">${grp.name_ar || grp.id}</h3>
        <div class="s1-group-meta">
          <div class="s1-group-count">${S2_ICONS.tv}<span>${count} قناة</span></div>
          <div class="s1-group-live-badge">LIVE</div>
        </div>
      </div>
    `;

    frag.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(frag);

  if (!container._s2GroupBound) {
    container._s2GroupBound = true;
    container.addEventListener('click', e => {
      const card = e.target.closest('.s1-group-card');
      if (card?.dataset.groupId) s2OnGroupClick(card.dataset.groupId);
    });
    container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.s1-group-card');
        if (card?.dataset.groupId) {
          e.preventDefault();
          s2OnGroupClick(card.dataset.groupId);
        }
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   s2TrackMouse (backward compatible)
   ═══════════════════════════════════════════════════════════════ */
function s2TrackMouse(e, el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--s1-mx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
  el.style.setProperty('--s1-my', ((e.clientY - rect.top) / rect.height) * 100 + '%');
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ v19.0: معالجات النقر مع preload سلس
   ═══════════════════════════════════════════════════════════════ */
function s2OnChannelClick(channelId) {
  console.log('[S2] Channel clicked:', channelId);

  // ⚡ Preload القنوات المجاورة فوراً (للتقليب السلس)
  s2PreloadAround(channelId, 2);

  // ⚡ تمرير القناة الحالية كـ global للـ player
  window.S2_CURRENT_CHANNEL = channelId;

  if (typeof window.onChannelSelect === 'function') {
    window.onChannelSelect(channelId, 'server2');
  } else if (typeof window.openChannel === 'function') {
    window.openChannel(channelId);
  } else if (typeof window.openPlayer === 'function') {
    window.openPlayer(channelId, 'server2');
  }
}

function s2OnGroupClick(groupId) {
  console.log('[S2] Group clicked:', groupId);
  if (typeof window.onGroupSelect === 'function') {
    window.onGroupSelect(groupId, 'server2');
  } else if (typeof window.openGroup === 'function') {
    window.openGroup(groupId.replace(/^s2grp_/, ''));
  }
}

/* ═══════════════════════════════════════════════════════════════
   renderS2Skeleton
   ═══════════════════════════════════════════════════════════════ */
function renderS2Skeleton(container, mode, count) {
  if (!container) return;
  const n = count || 8;
  const cls = mode === 'groups' ? 's1-skeleton s1-skeleton-groups' : 's1-skeleton';
  let html = '';
  for (let i = 0; i < n; i++) html += `<div class="${cls}"></div>`;
  container.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════
   renderServer2 — الدالة الرئيسية
   ═══════════════════════════════════════════════════════════════ */
async function renderServer2(options) {
  options = options || {};
  const mode      = options.mode || 'channels';
  const container = options.container
                 || document.querySelector('#server2-container')
                 || document.querySelector('#channels-grid')
                 || document.getElementById('channelsGrid');
  const groupId   = options.groupId || null;
  const forceLoad = options.forceReload || false;

  if (!container) {
    console.error('[S2] لا توجد حاوية');
    return;
  }

  // skeleton فقط لو لم تكن البيانات محمّلة
  if (!SERVER2_DATA.length) {
    renderS2Skeleton(container, mode, mode === 'groups' ? 6 : 10);
  }

  try {
    const data = await loadServer2Channels(forceLoad);

    // ⚡ استخدام requestAnimationFrame للرسم السلس
    requestAnimationFrame(() => {
      if (mode === 'groups') {
        renderS2GroupCards(container, data.groups, data.channels);
      } else {
        let list = data.channels;
        if (groupId) {
          const grp = data.groups.find(g =>
            g.id === groupId || g.id === ('s2grp_' + groupId)
          );
          if (grp) {
            const idSet = new Set(grp.channels);
            list = list.filter(c => idSet.has(c.id));
          }
        }
        renderS2ChannelCards(container, list);
      }
    });
  } catch (e) {
    console.error('[S2] Render failed:', e);
    container.innerHTML = `<div class="s1-empty">فشل التحميل: ${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Exports
   ═══════════════════════════════════════════════════════════════ */
window.loadServer2Channels  = loadServer2Channels;
window.buildServer2Channels = buildServer2Channels;
window.buildServer2Groups   = buildServer2Groups;
window.clearServer2Cache    = clearServer2Cache;
window.renderServer2        = renderServer2;
window.renderS2ChannelCards = renderS2ChannelCards;
window.renderS2GroupCards   = renderS2GroupCards;
window.renderS2Skeleton     = renderS2Skeleton;
window.s2OnChannelClick     = s2OnChannelClick;
window.s2OnGroupClick       = s2OnGroupClick;
window.s2TrackMouse         = s2TrackMouse;
window.s2PreloadAround      = s2PreloadAround;   // ⚡ جديد
window.SERVER2_PROXY_API    = SERVER2_PROXY_API;
window.S2_PROXY_WRAPPER     = S2_PROXY_WRAPPER;
window.S2_TARGET_GROUPS     = S2_TARGET_GROUPS;
window.wrapUrlIfNeeded      = wrapUrlIfNeeded;

window.SERVER2_CHANNELS = window.SERVER2_CHANNELS || [];
window.S2_CHANNELS_RAW  = window.S2_CHANNELS_RAW  || [];

console.log(
  '%c Server 2 %c v19.0 — Ultra Smooth ',
  'background:linear-gradient(135deg,#00e5ff,#007bff);color:#fff;padding:5px 10px;border-radius:6px 0 0 6px;font-weight:900;font-size:11px;',
  'background:#00a94f;color:#fff;padding:5px 10px;border-radius:0 6px 6px 0;font-weight:900;font-size:10px;'
);
console.log('[S2] Worker:', SERVER2_PROXY_API);
console.log('[S2] CHANNEL_LOGOS:', typeof CHANNEL_LOGOS !== 'undefined' ? 'YES' : 'NO');
console.log('[S2] GROUP_LOGOS:', typeof GROUP_LOGOS !== 'undefined' ? 'YES' : 'NO');
console.log('[S2] Features: preload + event delegation + requestAnimationFrame');
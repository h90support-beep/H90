/* ================================================================
   H90 v32.3 — Core Script (Fixed v5)
   ================================================================
   [v32.3]
   - ✅ إصلاح nav indicator (RTL)
   - ✅ إزالة loading="lazy" و onload (الصور تظهر فوراً)
   - ✅ شعارات الفرق في الرئيسية عبر h90ProxyImage
   - ✅ صور الأفلام/المسلسلات مباشرة من API
   - ✅ Entertainment auto-opens series + sticky topbar
   - ✅ IPTV: rectangular channel cards with AR + EN names
   ================================================================ */

'use strict';

/* ================================================================
   0. Sound Helper
   ================================================================ */
const SoundBridge = {
  tap()      { try { typeof H90Sounds !== 'undefined' && H90Sounds.tap      && H90Sounds.tap();      } catch (e) {} },
  nav()      { try { typeof H90Sounds !== 'undefined' && H90Sounds.nav      && H90Sounds.nav();      } catch (e) {} },
  open()     { try { typeof H90Sounds !== 'undefined' && H90Sounds.open     && H90Sounds.open();     } catch (e) {} },
  close()    { try { typeof H90Sounds !== 'undefined' && H90Sounds.close    && H90Sounds.close();    } catch (e) {} },
  favorite() { try { typeof H90Sounds !== 'undefined' && H90Sounds.favorite && H90Sounds.favorite(); } catch (e) {} },
  success()  { try { typeof H90Sounds !== 'undefined' && (H90Sounds.success ? H90Sounds.success() : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  error()    { try { typeof H90Sounds !== 'undefined' && (H90Sounds.error   ? H90Sounds.error()   : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  warning()  { try { typeof H90Sounds !== 'undefined' && (H90Sounds.warning ? H90Sounds.warning() : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  toggle()   { try { typeof H90Sounds !== 'undefined' && (H90Sounds.toggle  ? H90Sounds.toggle()  : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  add()      { try { typeof H90Sounds !== 'undefined' && (H90Sounds.add     ? H90Sounds.add()     : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  remove()   { try { typeof H90Sounds !== 'undefined' && (H90Sounds.remove  ? H90Sounds.remove()  : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} },
  message()  { try { typeof H90Sounds !== 'undefined' && (H90Sounds.message ? H90Sounds.message() : (H90Sounds.tap && H90Sounds.tap())); } catch (e) {} }
};
window.SoundBridge = SoundBridge;

(function unlockAudioOnce() {
  const events = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
  const handler = () => {
    try {
      if (typeof H90Sounds !== 'undefined' && typeof H90Sounds.unlock === 'function') H90Sounds.unlock();
    } catch (e) {}
    events.forEach(evt => document.removeEventListener(evt, handler, true));
  };
  events.forEach(evt => document.addEventListener(evt, handler, true));
})();

/* ================================================================
   APK Detection
   ================================================================ */
const __H90_IS_APK__ = (function () {
  try {
    return !!(window.__H90_APK_MODE__ || window.__H90_NATIVE_EARLY__ ||
      (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      window.cordova || location.protocol === 'file:');
  } catch (e) { return false; }
})();

/* ================================================================
   Scroll helpers
   ================================================================ */
function restorePageScroll() {
  try {
    document.body.classList.remove('no-scroll', 'player-open', 'immersive-fullscreen');
    document.body.style.overflow = '';
    document.body.style.overflowY = 'auto';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.bottom = '';
    document.body.style.width = '';
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100vh';
    document.body.style.touchAction = 'pan-y';

    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.height = 'auto';
    document.documentElement.style.touchAction = '';
  } catch (e) {}
}
window.restorePageScroll = restorePageScroll;

function lockPageScroll() {
  try {
    document.body.classList.add('player-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.touchAction = 'none';
  } catch (e) {}
}
window.lockPageScroll = lockPageScroll;

/* ================================================================
   Image Proxy (للشعارات فقط — الصور الأخرى proxied مسبقاً)
   ================================================================ */
function h90ProxyImage(url, size) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!url.startsWith('http')) return url;
  if (url.includes('images.weserv.nl')) return url;
  var w = size || 300;
  return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=' + w;
}
window.h90ProxyImage = h90ProxyImage;

/* ================================================================
   State
   ================================================================ */
let currentTab = 'home';
let currentEntTab = 'series';
let currentSubScreen = null;
let favorites = [];
let recentChannels = [];
let _currentRenderedTab = null;
let _entSeriesLoaded = false;
let _entMoviesLoaded = false;

const FAV_KEY = 'h90_favorites';
const RECENT_KEY = 'h90_recent';
const THEME_KEY = 'h90_theme';
const SETTINGS_KEY = 'h90_settings';
const NOTIF_SETTINGS_KEY = 'h90_notif_settings';
const MATCH_TIME_KEY = 'h90_match_reminder_time';
const NOTIF_API = 'https://h90-notfiy.dairalzor33.workers.dev';
const LAST_SEEN_NOTIF_KEY = 'h90_last_seen_notif';

const DEFAULT_NOTIF_SETTINGS = {
  general: true, matches: true, breaking: false,
  newchannels: true, streamOffline: true, dnd: false
};

const TIME_OPTIONS = [
  { id: 5,   label: '5 دقائق' },
  { id: 10,  label: '10 دقائق' },
  { id: 15,  label: '15 دقيقة' },
  { id: 30,  label: '30 دقيقة' },
  { id: 60,  label: 'ساعة واحدة' },
  { id: 120, label: 'ساعتان' }
];

let _iptvCurrentChannel = null;
let _iptvControlsTimer = null;

/* ================================================================
   SVG Icons
   ================================================================ */
const SVG_ICONS = {
  check:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  close:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  alert:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  star:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  tv:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  play:       '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  chevronRight:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  clock:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  bell:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  search:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  ball:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 7l3 2.5-1 3.5h-4l-1-3.5L12 7z"/><path d="M12 2v5M19.5 8.5L15 10.5M18 18l-3.5-2M6 18l3.5-2M4.5 8.5L9 10.5"/></svg>',
  help:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  message:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  bookOpen:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  zap:        '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  diamond:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M12 21V9M6 3l6 6 6-6"/></svg>',
  palette:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
};

function getIcon(name) { return SVG_ICONS[name] || SVG_ICONS.info; }
function haptic(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern || 10); } catch (e) {} } }
function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  var n = parseInt(h, 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

/* ================================================================
   Toast
   ================================================================ */
function showToast(msg, type) {
  var existing = document.querySelector('.toast.h90-toast-new');
  if (existing) existing.remove();

  var typeMap = {
    success: { icon: 'check', accent: '#00e676' },
    error:   { icon: 'alert', accent: '#ff2d55' },
    warning: { icon: 'alert', accent: '#ffb300' },
    info:    { icon: 'info',  accent: '#00e5ff' }
  };
  var cfg = typeMap[type] || typeMap.info;

  var t = document.createElement('div');
  t.className = 'toast h90-toast-new ' + (type || '');
  t.style.cssText =
    'position:fixed;bottom:110px;left:50%;transform:translateX(-50%) translateY(20px);' +
    'background:rgba(20,20,28,0.98);color:#fff;padding:12px 20px 12px 16px;border-radius:16px;font-size:13px;font-weight:700;' +
    'box-shadow:0 15px 45px rgba(0,0,0,0.5);border:1px solid rgba(' + hexToRgb(cfg.accent) + ',0.4);' +
    'opacity:0;transition:opacity 0.3s,transform 0.3s;z-index:99999;max-width:90%;display:flex;align-items:center;gap:10px;pointer-events:none;';

  var iconWrap = document.createElement('div');
  iconWrap.style.cssText = 'width:26px;height:26px;border-radius:50%;background:' + cfg.accent + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#000;';
  var iconInner = document.createElement('div');
  iconInner.style.cssText = 'width:14px;height:14px;';
  iconInner.innerHTML = getIcon(cfg.icon);
  iconWrap.appendChild(iconInner);

  var textSpan = document.createElement('span');
  textSpan.textContent = msg;

  t.appendChild(iconWrap);
  t.appendChild(textSpan);
  document.body.appendChild(t);

  setTimeout(function () {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  }, 10);

  setTimeout(function () {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(function () { t.remove(); }, 350);
  }, 2600);
}
window.showToast = showToast;

/* ================================================================
   Notifications helpers
   ================================================================ */
function getNotifSettings() {
  try {
    return Object.assign({}, DEFAULT_NOTIF_SETTINGS, JSON.parse(localStorage.getItem(NOTIF_SETTINGS_KEY) || '{}'));
  } catch (e) { return Object.assign({}, DEFAULT_NOTIF_SETTINGS); }
}
function saveNotifSettings(s) { try { localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(s)); } catch (e) {} }

function getMatchReminderTime() {
  if (typeof window.getMatchReminderTime === 'function' && window.getMatchReminderTime !== getMatchReminderTime) {
    try {
      var t = window.getMatchReminderTime();
      if (typeof t === 'number' && t > 0) return t;
    } catch (e) {}
  }
  var t2 = parseInt(localStorage.getItem(MATCH_TIME_KEY) || '30', 10);
  return isNaN(t2) ? 30 : t2;
}

function areNotificationsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

async function requestNotificationPermissionUnified() {
  if (typeof Notification === 'undefined') { showToast('متصفحك لا يدعم الإشعارات', 'warning'); return false; }
  if (Notification.permission === 'granted') {
    showToast('الإشعارات مفعّلة مسبقاً', 'success');
    if (window.H90Firebase && window.H90Firebase.register) window.H90Firebase.register().catch(function() {});
    updateNotifToggles();
    return true;
  }
  if (Notification.permission === 'denied') { showToast('الإشعارات مرفوضة', 'warning'); return false; }
  try {
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    showToast('تم تفعيل الإشعارات', 'success');
    if (window.H90Firebase && window.H90Firebase.register) window.H90Firebase.register().catch(function() {});
    updateNotifToggles();
    return true;
  } catch (e) { return false; }
}
function requestNotificationPermission() { return requestNotificationPermissionUnified(); }

function updateNotifToggles() {
  var settings = getNotifSettings();
  ['general', 'matches', 'breaking', 'newchannels', 'streamOffline', 'dnd'].forEach(function (key) {
    var el = document.getElementById('toggle-notif-' + key);
    if (el) el.classList.toggle('on', settings[key] === true);
  });

  var timeBtn = document.getElementById('changeMatchTimeBtn');
  if (timeBtn) timeBtn.style.display = settings.matches ? 'flex' : 'none';

  var timeLabel = document.getElementById('currentMatchTimeValue');
  if (timeLabel) {
    var mins = getMatchReminderTime();
    var opt = TIME_OPTIONS.find(function (o) { return o.id === mins; });
    timeLabel.textContent = opt ? opt.label : (mins + ' دقيقة');
  }

  var reqBtn = document.getElementById('requestNotifPermissionBtn');
  if (reqBtn) {
    var hide = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    reqBtn.style.display = hide ? 'none' : 'flex';
  }
}

async function toggleNotifSetting(key) {
  var settings = getNotifSettings();
  var newValue = !settings[key];
  var notifKeys = ['general', 'matches', 'breaking', 'newchannels', 'streamOffline'];
  if (newValue && notifKeys.indexOf(key) > -1 && !areNotificationsEnabled()) {
    showToast('جارٍ طلب إذن الإشعارات...', 'info');
    var granted = await requestNotificationPermissionUnified();
    if (!granted) { showToast('يجب السماح بالإشعارات', 'warning'); updateNotifToggles(); return; }
  }
  settings[key] = newValue;
  saveNotifSettings(settings);
  if (key === 'dnd') {
    var indicator = document.getElementById('dndIndicator');
    if (indicator) indicator.classList.toggle('show', newValue);
  }
  if (key === 'matches') {
    if (newValue && typeof window.startMatchReminders === 'function') window.startMatchReminders();
    else if (!newValue && typeof window.stopMatchReminders === 'function') window.stopMatchReminders();
  }
  updateNotifToggles();
  SoundBridge.toggle();
  haptic(10);
}

function initDNDState() {
  var indicator = document.getElementById('dndIndicator');
  if (indicator) indicator.classList.toggle('show', getNotifSettings().dnd === true);
}

/* ================================================================
   Notifications Page
   ================================================================ */
async function fetchH90Notifications() {
  try {
    const res = await fetch(NOTIF_API + '/notifications?limit=50', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.notifications || [];
  } catch (e) { return null; }
}

async function renderNotifPageContent() {
  var body = document.getElementById('notifDrawerBody');
  if (!body) return;

  body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center;color:rgba(255,255,255,0.5);"><div style="width:50px;height:50px;border-radius:50%;border:3px solid rgba(255,45,85,0.2);border-top-color:#ff2d55;animation:spin 1s linear infinite;margin-bottom:18px;"></div><div style="font-weight:700;font-size:14px;">جارٍ تحميل الإشعارات...</div></div>';

  var notifs = await fetchH90Notifications();

  if (notifs === null) {
    body.innerHTML = '<div style="text-align:center;padding:60px 20px;"><div style="font-weight:800;color:#fff;font-size:15px;margin-bottom:14px;">فشل تحميل الإشعارات</div><button onclick="renderNotifPageContent()" style="padding:10px 24px;background:linear-gradient(135deg,#ff2d55,#e6003d);color:#fff;border:none;border-radius:12px;font-weight:800;font-family:inherit;cursor:pointer;font-size:13px;">إعادة المحاولة</button></div>';
    return;
  }

  if (notifs.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:80px 20px;color:rgba(255,255,255,0.4);"><div style="font-weight:800;color:#fff;font-size:15px;">لا توجد إشعارات</div></div>';
    return;
  }

  var html = '';
  notifs.forEach(function (n) {
    var d2 = new Date(n.timestamp);
    var timeStr = d2.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    var isNew = (Date.now() - n.timestamp) < 86400000;

    html += '<div style="background:rgba(255,255,255,0.04);border:1px solid ' + (isNew ? 'rgba(255,45,85,0.4)' : 'rgba(255,255,255,0.08)') + ';border-radius:14px;padding:14px;margin-bottom:10px;">' +
      '<div style="font-weight:800;color:#fff;font-size:14px;margin-bottom:8px;text-align:right;">' + n.title + '</div>' +
      '<div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.7;margin-bottom:10px;text-align:right;word-wrap:break-word;">' + n.body + '</div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,0.4);">' + timeStr + '</div>' +
    '</div>';
  });
  body.innerHTML = html;
  try { localStorage.setItem(LAST_SEEN_NOTIF_KEY, Date.now().toString()); } catch (e) {}
}

async function checkNewH90Notifications() {
  try {
    var settings = getNotifSettings();
    if (settings.dnd === true || settings.general === false) return;
    var notifs = await fetchH90Notifications();
    if (notifs && notifs.length > 0) {
      var lastSeen = parseInt(localStorage.getItem(LAST_SEEN_NOTIF_KEY) || '0', 10);
      if (notifs[0].timestamp > lastSeen) {
        var badge = document.getElementById('notifBadge');
        if (badge) badge.style.display = 'block';
      }
    }
  } catch (e) {}
}
window.checkNewH90Notifications = checkNewH90Notifications;

/* ================================================================
   Drawer
   ================================================================ */
function openDrawer() {
  var d = document.getElementById('drawer');
  var o = document.getElementById('drawerOverlay');
  if (d) d.classList.add('show');
  if (o) o.classList.add('show');
  SoundBridge.open();
  haptic(8);
}
function closeDrawer() {
  var d = document.getElementById('drawer');
  var o = document.getElementById('drawerOverlay');
  var wasOpen = d && d.classList.contains('show');
  if (d) d.classList.remove('show');
  if (o) o.classList.remove('show');
  if (wasOpen) SoundBridge.close();
}

/* ================================================================
   Theme
   ================================================================ */
function loadTheme() { applyTheme(localStorage.getItem(THEME_KEY) || 'crimson'); }
function applyTheme(theme) {
  if (theme === 'black') document.body.classList.add('theme-black');
  else document.body.classList.remove('theme-black');
}

function renderThemeGrid() {
  var grid = document.getElementById('themeGrid');
  if (!grid) return;
  var current = localStorage.getItem(THEME_KEY) || 'crimson';
  if (current === 'red') current = 'crimson';
  var themes = [
    { id: 'crimson', name: 'أحمر نيون', color: '#ff2d55', bg: '#0a0a0f', icon: 'zap' },
    { id: 'black',   name: 'أسود نقي',  color: '#ffffff', bg: '#000000', icon: 'diamond' }
  ];
  var html = '';
  themes.forEach(function (t) {
    var active = t.id === current;
    var borderStyle = active ? 'border-color:rgba(255,255,255,0.9);' : 'border-color:rgba(255,255,255,0.1);opacity:0.7;';
    html += '<button onclick="setTheme(\'' + t.id + '\')" style="aspect-ratio:1.6;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;border:2.5px solid;background:linear-gradient(135deg,' + t.bg + ' 45%,' + t.color + ' 130%);color:#fff;font-weight:800;font-size:13px;font-family:inherit;position:relative;' + borderStyle + '">' +
      '<div style="width:28px;height:28px;color:' + t.color + ';margin-bottom:6px;">' + getIcon(t.icon) + '</div>' +
      '<div style="font-size:12px;letter-spacing:0.5px;">' + t.name + '</div>' +
      (active ? '<div style="position:absolute;top:8px;right:8px;width:20px;height:20px;background:' + t.color + ';border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;"><div style="width:12px;height:12px;">' + getIcon('check') + '</div></div>' : '') +
    '</button>';
  });
  grid.innerHTML = html;
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  renderThemeGrid();
  showToast(theme === 'crimson' ? 'تم تطبيق الثيم الأحمر' : 'تم تطبيق الثيم الأسود', 'success');
  SoundBridge.success();
  haptic(12);
}

/* ================================================================
   Nav Indicator
   ================================================================ */
function updateNavIndicator(tab) {
  var nav = document.getElementById('bottomNav');
  var indicator = document.getElementById('navIndicator');
  if (!nav || !indicator) return;

  var btn = nav.querySelector('.nav-item[data-tab="' + tab + '"]');
  if (!btn) {
    indicator.style.opacity = '0';
    return;
  }

  indicator.style.opacity = '1';

  var navRect = nav.getBoundingClientRect();
  var btnRect = btn.getBoundingClientRect();
  var offsetFromRight = navRect.right - btnRect.right;

  indicator.style.width = btnRect.width + 'px';
  indicator.style.transform = 'none';
  indicator.style.right = offsetFromRight + 'px';
  indicator.style.left = 'auto';
}

/* ================================================================
   switchTab
   ================================================================ */
function switchTab(tab) {
  var pp = document.getElementById('playerPage');
  if (!pp || !pp.classList.contains('show')) {
    if (document.body.classList.contains('player-open')) restorePageScroll();
  }

  if (_currentRenderedTab === tab && tab !== 'channels' && tab !== 'home' && tab !== 'matches' && tab !== 'entertainment' && tab !== 'settings') {
    return;
  }

  _currentRenderedTab = tab;
  currentTab = tab;

  document.querySelectorAll('.page-section').forEach(function (s) {
    s.classList.remove('active');
  });
  var targetSection = document.getElementById(tab + 'Page');
  if (targetSection) targetSection.classList.add('active');

  if (tab === 'home') {
    document.body.classList.remove('hide-header');
    document.body.classList.add('on-home');
  } else {
    document.body.classList.add('hide-header');
    document.body.classList.remove('on-home');
    var h = document.getElementById('appHeader');
    if (h) h.classList.remove('header-hidden');
  }

  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.tab === tab);
  });

  setTimeout(function() { updateNavIndicator(tab); }, 10);

  currentSubScreen = null;

  try {
    if (tab === 'home') {
      renderHomePage();
    } else if (tab === 'entertainment') {
      switchEntertainmentTab(currentEntTab || 'series');
    } else if (tab === 'channels') {
      renderIPTVLayout();
    } else if (tab === 'matches') {
      renderMatchesPage();
    } else if (tab === 'rooms') {
      renderRoomsPage();
    } else if (tab === 'settings') {
      renderSettingsPage();
    }
  } catch (e) {
    console.error('[switchTab] error:', e);
  }

  SoundBridge.nav();
  haptic(10);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.switchTab = switchTab;

/* ================================================================
   HOME PAGE
   ================================================================ */
function renderHomePage() {
  var rowsContainer = document.getElementById('homeRows');
  if (!rowsContainer) return;
  if (!rowsContainer._initialized) {
    rowsContainer._initialized = true;
    rowsContainer.innerHTML = buildHomeSkeleton();
  }
  loadHomeDataProgressive();
}

function buildHomeSkeleton() {
  var rows = [
    { title: 'المباريات اليوم', wide: true, icon: 'ball' },
    { title: 'مسلسلات سورية', icon: 'tv' },
    { title: 'أفلام', icon: 'play' },
    { title: 'القنوات', icon: 'tv' },
    { title: 'شاهد الآن', icon: 'zap' },
    { title: 'مسلسلات تركية', icon: 'tv' }
  ];
  var html = '';
  rows.forEach(function (row) {
    html += '<div class="home-row">' +
      '<div class="home-row-header">' +
        '<div class="home-row-title">' +
          '<span class="home-row-title-icon">' + getIcon(row.icon) + '</span>' +
          '<span>' + row.title + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="home-row-scroll">';
    var count = row.wide ? 3 : 6;
    for (var i = 0; i < count; i++) {
      html += '<div class="home-skeleton' + (row.wide ? ' home-skeleton-wide' : '') + '">' +
        '<div class="home-skeleton-poster"></div>' +
        '<div class="home-skeleton-title"></div>' +
      '</div>';
    }
    html += '</div></div>';
  });
  return html;
}

function buildSkeletonCards(count, wide) {
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="home-skeleton' + (wide ? ' home-skeleton-wide' : '') + '">' +
      '<div class="home-skeleton-poster"></div>' +
      '<div class="home-skeleton-title"></div>' +
    '</div>';
  }
  return html;
}

async function loadHomeDataProgressive() {
  var rowsContainer = document.getElementById('homeRows');
  if (!rowsContainer) return;

  var allRowsHtml = '';
  allRowsHtml += buildRowMatches();
  allRowsHtml += buildRowSyrianSeries();
  allRowsHtml += buildRowMovies();
  allRowsHtml += buildRowChannels();
  allRowsHtml += buildRowWatchNow();
  allRowsHtml += buildRowTurkishSeries();
  rowsContainer.innerHTML = allRowsHtml;

  loadMatchesRowData();
  loadSeriesRowData();
  loadMoviesRowData();
  loadChannelsRowData();
}

function buildRowMatches() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('ball') + '</span>' +
        '<span>المباريات اليوم</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'matches\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowMatches">' + buildSkeletonCards(4, true) + '</div>' +
  '</div>';
}
function buildRowSyrianSeries() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('tv') + '</span>' +
        '<span>مسلسلات سورية</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'entertainment\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowSyria">' + buildSkeletonCards(6, false) + '</div>' +
  '</div>';
}
function buildRowMovies() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('play') + '</span>' +
        '<span>أفلام</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'entertainment\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowMovies">' + buildSkeletonCards(6, false) + '</div>' +
  '</div>';
}
function buildRowChannels() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('tv') + '</span>' +
        '<span>القنوات</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'channels\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowChannels">' + buildSkeletonCards(6, false) + '</div>' +
  '</div>';
}
function buildRowWatchNow() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('zap') + '</span>' +
        '<span>شاهد الآن</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'entertainment\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowWatchNow">' + buildSkeletonCards(6, false) + '</div>' +
  '</div>';
}
function buildRowTurkishSeries() {
  return '<div class="home-row">' +
    '<div class="home-row-header">' +
      '<div class="home-row-title">' +
        '<span class="home-row-title-icon">' + getIcon('tv') + '</span>' +
        '<span>مسلسلات تركية</span>' +
      '</div>' +
      '<button class="home-row-more" onclick="switchTab(\'entertainment\')">عرض الكل</button>' +
    '</div>' +
    '<div class="home-row-scroll" id="homeRowTurkish">' + buildSkeletonCards(6, false) + '</div>' +
  '</div>';
}

/* ---------- Home Row Loaders ---------- */

async function loadMatchesRowData() {
  var container = document.getElementById('homeRowMatches');
  if (!container) return;
  if (typeof window.fetchMatchesWithCache !== 'function') {
    container.innerHTML = '<div class="home-empty">لا توجد مباريات</div>';
    return;
  }
  try {
    var data = await window.fetchMatchesWithCache();
    var matches = (data.matches || []).filter(function (m) {
      var code = (m.competition && m.competition.code) || '';
      var allowed = (window.ALLOWED_COMPETITIONS || []).indexOf(code) > -1;
      return allowed || (typeof window.isFavoriteTeamMatch === 'function' && window.isFavoriteTeamMatch(m));
    });
    if (matches.length === 0) {
      container.innerHTML = '<div class="home-empty">لا توجد مباريات اليوم</div>';
      return;
    }
    matches = (typeof window.sortMatchesSmart === 'function') ? window.sortMatchesSmart(matches) : matches;

    var html = '';
    matches.slice(0, 10).forEach(function (m) {
      var home = (m.homeTeam && m.homeTeam.name) || 'TBD';
      var away = (m.awayTeam && m.awayTeam.name) || 'TBD';

      var homeCrestRaw = (m.homeTeam && m.homeTeam.crest) || '';
      var awayCrestRaw = (m.awayTeam && m.awayTeam.crest) || '';
      var homeCrest = homeCrestRaw ? h90ProxyImage(homeCrestRaw, 100) : '';
      var awayCrest = awayCrestRaw ? h90ProxyImage(awayCrestRaw, 100) : '';

      var date = new Date(m.utcDate);
      var time = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      var isLive = (m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED');
      var score = (m.score && m.score.fullTime && m.score.fullTime.home !== null) ? m.score.fullTime.home + ' - ' + m.score.fullTime.away : 'VS';
      var statusLabel = isLive ? 'مباشر' : time;
      var statusColor = isLive ? '#ff2d55' : '#ffb300';

      html += '<div class="home-card home-card-wide" onclick="switchTab(\'matches\')">' +
        '<div class="home-card-poster" style="display:flex;flex-direction:column;justify-content:space-between;padding:14px;background:linear-gradient(135deg,rgba(0,230,118,.15),rgba(0,229,255,.08));border:1px solid rgba(0,230,118,.3);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:11px;font-weight:800;color:' + statusColor + ';background:rgba(0,0,0,.4);padding:3px 8px;border-radius:10px;">' + statusLabel + '</span>' +
            '<span style="font-size:11px;font-weight:800;color:#fff;">' + score + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
              (homeCrest ? '<img src="' + homeCrest + '" style="width:32px;height:32px;object-fit:contain;" onerror="this.style.display=\'none\'">' : '') +
              '<div style="font-size:10px;font-weight:700;color:#fff;text-align:center;line-height:1.2;">' + home + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;font-size:10px;font-weight:900;color:rgba(255,255,255,.5);">VS</div>' +
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
              (awayCrest ? '<img src="' + awayCrest + '" style="width:32px;height:32px;object-fit:contain;" onerror="this.style.display=\'none\'">' : '') +
              '<div style="font-size:10px;font-weight:700;color:#fff;text-align:center;line-height:1.2;">' + away + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="home-empty">تعذّر تحميل المباريات</div>';
  }
}

async function loadSeriesRowData() {
  if (typeof SeriesAPI === 'undefined') return;
  try {
    await SeriesAPI.loadSeriesProgressively(function(batch) {
      updateSyrianRow(batch);
      updateTurkishRow(batch);
    }, false);
  } catch (e) {}
}

function updateSyrianRow(series) {
  var container = document.getElementById('homeRowSyria');
  if (!container) return;
  var syrian = series.filter(function (s) { return String(s.categoryId) === '173'; });
  if (syrian.length === 0) { container.innerHTML = '<div class="home-empty">لا توجد مسلسلات سورية</div>'; return; }
  container.innerHTML = syrian.slice(0, 15).map(buildSeriesCard).join('');
}
function updateTurkishRow(series) {
  var container = document.getElementById('homeRowTurkish');
  if (!container) return;
  var turkish = series.filter(function (s) { return String(s.categoryId) === '187' || String(s.categoryId) === '188'; });
  if (turkish.length === 0) { container.innerHTML = '<div class="home-empty">لا توجد مسلسلات تركية</div>'; return; }
  container.innerHTML = turkish.slice(0, 15).map(buildSeriesCard).join('');
}

function buildSeriesCard(s) {
  /* ✅ API يوفر صور proxied مسبقاً */
  var poster = s.poster || '';
  var title = s.title || s.name || '';
  var rating = s.rating || 0;
  var safeId = String(s.id).replace(/'/g, "\\'");
  var safeTitle = String(title).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  var safePoster = String(poster).replace(/'/g, "\\'");
  return '<div class="home-card" onclick="openSeriesFromHome(\'' + safeId + '\',\'' + safeTitle + '\',\'' + safePoster + '\')">' +
    '<div class="home-card-poster">' +
      (poster ? '<img src="' + poster + '" alt="" onerror="this.style.display=\'none\'">' : '') +
      (rating > 0 ? '<span class="home-card-badge">' + getIcon('starFilled') + ' ' + rating.toFixed(1) + '</span>' : '') +
    '</div>' +
    '<div class="home-card-title">' + title + '</div>' +
  '</div>';
}

async function loadMoviesRowData() {
  if (typeof MoviesAPI === 'undefined') return;
  try {
    await MoviesAPI.loadMoviesProgressively(function(batch) {
      updateMoviesRow(batch);
      updateWatchNowRow(batch);
    }, false);
  } catch (e) {}
}

function updateMoviesRow(movies) {
  var container = document.getElementById('homeRowMovies');
  if (!container) return;
  if (movies.length === 0) { container.innerHTML = '<div class="home-empty">لا توجد أفلام</div>'; return; }
  container.innerHTML = movies.slice(0, 15).map(buildMovieCard).join('');
}
function updateWatchNowRow(movies) {
  var container = document.getElementById('homeRowWatchNow');
  if (!container) return;
  var trending = (typeof MoviesAPI !== 'undefined' && MoviesAPI.getTrending) ? MoviesAPI.getTrending(movies, 15) : movies.slice(0, 15);
  container.innerHTML = trending.map(buildMovieCard).join('');
}

function buildMovieCard(m) {
  /* ✅ API يوفر صور proxied مسبقاً */
  var poster = m.poster || '';
  var title = m.title || m.name || '';
  var rating = m.rating || 0;
  var safeId = String(m.id).replace(/'/g, "\\'");
  var safeTitle = String(title).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  var safePoster = String(poster).replace(/'/g, "\\'");
  return '<div class="home-card" onclick="openMovieFromHome(\'' + safeId + '\',\'' + safeTitle + '\',\'' + safePoster + '\')">' +
    '<div class="home-card-poster">' +
      (poster ? '<img src="' + poster + '" alt="" onerror="this.style.display=\'none\'">' : '') +
      (rating > 0 ? '<span class="home-card-badge">' + getIcon('starFilled') + ' ' + rating.toFixed(1) + '</span>' : '') +
    '</div>' +
    '<div class="home-card-title">' + title + '</div>' +
  '</div>';
}

function loadChannelsRowData() {
  var container = document.getElementById('homeRowChannels');
  if (!container) return;
  var groups = (typeof getAllGroups === 'function') ? getAllGroups() : [];
  if (groups.length === 0) {
    container.innerHTML = '<div class="home-empty">جارٍ تحميل القنوات...</div>';
    setTimeout(loadChannelsRowData, 2000);
    return;
  }
  container.innerHTML = groups.slice(0, 12).map(function (g) {
    var cover = (typeof getGroupCoverImage === 'function') ? getGroupCoverImage(g) : '';
    var name = g.name_ar || 'قناة';
    var safeId = String(g.id).replace(/'/g, "\\'");
    return '<div class="home-card" onclick="openGroupFromHome(\'' + safeId + '\')">' +
      '<div class="home-card-poster">' +
        (cover ? '<img src="' + cover + '" alt="" onerror="this.style.display=\'none\'">' : '') +
      '</div>' +
      '<div class="home-card-title">' + name + '</div>' +
    '</div>';
  }).join('');
}

function openSeriesFromHome(id) {
  SoundBridge.tap(); haptic(10);
  if (typeof openSeriesDetails === 'function') openSeriesDetails(id);
  else {
    switchTab('entertainment');
    switchEntertainmentTab('series');
  }
}
window.openSeriesFromHome = openSeriesFromHome;

function openMovieFromHome(id) {
  SoundBridge.tap(); haptic(10);
  if (typeof openMovieDetails === 'function') openMovieDetails(id);
  else {
    switchTab('entertainment');
    switchEntertainmentTab('movies');
  }
}
window.openMovieFromHome = openMovieFromHome;

function openGroupFromHome(groupId) {
  SoundBridge.tap(); haptic(10);
  switchTab('channels');
  setTimeout(function() {
    if (typeof window.openGroup === 'function') window.openGroup(groupId);
  }, 300);
}
window.openGroupFromHome = openGroupFromHome;

/* ================================================================
   ENTERTAINMENT
   ================================================================ */
function switchEntertainmentTab(tab) {
  currentEntTab = tab;

  document.querySelectorAll('.ent-topbar-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.ent === tab);
  });

  var container = document.getElementById('entertainmentContent');
  if (!container) return;

  if (tab === 'series') {
    if (!_entSeriesLoaded) {
      container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,.5);font-size:13px;">جارٍ تحميل المسلسلات...</div>';
      loadEntertainmentContent('series', container);
      _entSeriesLoaded = true;
    }
  } else if (tab === 'movies') {
    if (!_entMoviesLoaded) {
      container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,.5);font-size:13px;">جارٍ تحميل الأفلام...</div>';
      loadEntertainmentContent('movies', container);
      _entMoviesLoaded = true;
    }
  }

  SoundBridge.tap();
  haptic(8);
}
window.switchEntertainmentTab = switchEntertainmentTab;

async function loadEntertainmentContent(type, container) {
  if (type === 'series') {
    if (typeof window.renderSeriesPage === 'function') {
      try { window.renderSeriesPage(); } catch (e) {
        console.error('[ent] series failed:', e);
      }
    }
  } else if (type === 'movies') {
    if (typeof window.renderMoviesPage === 'function') {
      try { window.renderMoviesPage(); } catch (e) {
        console.error('[ent] movies failed:', e);
      }
    }
  }
}

(function initEntTopbarScroll() {
  var _lastY = 0;
  var _ticking = false;
  var _HIDE_AFTER = 80;

  function updateEntTopbar() {
    var tb = document.getElementById('entTopbar');
    if (!tb) { _ticking = false; return; }

    var isEnt = currentTab === 'entertainment';
    if (!isEnt) { tb.classList.remove('ent-topbar-hidden'); _ticking = false; return; }

    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var diff = y - _lastY;

    if (y > _HIDE_AFTER && diff > 3) tb.classList.add('ent-topbar-hidden');
    else if (diff < -5 || y < 20) tb.classList.remove('ent-topbar-hidden');

    _lastY = y;
    _ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!_ticking) {
      _ticking = true;
      requestAnimationFrame(updateEntTopbar);
    }
  }, { passive: true });
})();

/* ================================================================
   MATCHES PAGE
   ================================================================ */
function renderMatchesPage() {
  var grid = document.getElementById('matchesGrid');
  if (!grid) return;

  if (typeof window.renderMatches === 'function') {
    try {
      window.renderMatches();
    } catch (e) {
      grid.innerHTML = '<div class="home-empty" style="padding:60px 20px;">تعذّر تحميل المباريات</div>';
    }
  } else {
    grid.innerHTML = '<div class="home-empty" style="padding:60px 20px;">وحدة المباريات غير جاهزة</div>';
  }
}

/* ================================================================
   ROOMS PAGE
   ================================================================ */
function renderRoomsPage() {
  var container = document.getElementById('roomsContent');
  if (!container) return;
  if (typeof window.openRoomsScreen === 'function') {
    try { window.openRoomsScreen(container); }
    catch (e) { container.innerHTML = '<div class="home-empty" style="padding:60px 20px;">شاشة الغرف غير متوفرة</div>'; }
  } else {
    container.innerHTML = '<div class="home-empty" style="padding:60px 20px;">وحدة الغرف غير جاهزة</div>';
  }
}

/* ================================================================
   SETTINGS PAGE
   ================================================================ */
function renderSettingsPage() {
  renderThemeGrid();
  loadSettingToggles();
  updateNotifToggles();
  if (typeof window.updateTeamsCountLabel === 'function') window.updateTeamsCountLabel();
}
function openSettings() { switchTab('settings'); }
function closeSettings() { /* no-op */ }

function loadSettingToggles() {
  try {
    var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    var ta = document.getElementById('toggle-autoplay');
    if (ta) ta.classList.toggle('on', s.autoplay !== false);
  } catch (e) {}
  updateNotifToggles();
}
function toggleSetting(key) {
  var s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) {}
  s[key] = !s[key];
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  var el = document.getElementById('toggle-' + key);
  if (el) el.classList.toggle('on', s[key]);
  SoundBridge.toggle();
  haptic(10);
}
function clearAppCache() {
  if (!confirm('هل تريد مسح كل البيانات؟')) return;
  if (typeof clearM3UCache === 'function') clearM3UCache();
  if (typeof window.clearMatchesCache === 'function') window.clearMatchesCache();
  if (typeof window.clearDailyMatchesCache === 'function') window.clearDailyMatchesCache();
  if (typeof clearServer2Cache === 'function') clearServer2Cache();
  localStorage.clear();
  sessionStorage.clear();
  SoundBridge.error();
  location.reload();
}

/* ================================================================
   Time Picker
   ================================================================ */
function openTimePicker() {
  var modal = document.getElementById('timePickerModal');
  var list = document.getElementById('timeOptionsList');
  if (!modal || !list) return;
  var current = getMatchReminderTime();
  list.innerHTML = TIME_OPTIONS.map(function (opt) {
    var selected = opt.id === current ? 'selected' : '';
    return '<button class="time-option ' + selected + '" onclick="selectMatchTime(' + opt.id + ')"><span>' + opt.label + '</span></button>';
  }).join('');
  modal.classList.add('show');
  SoundBridge.open();
}
function closeTimePicker() {
  var m = document.getElementById('timePickerModal');
  if (m) m.classList.remove('show');
  SoundBridge.close();
}
function selectMatchTime(minutes) {
  var mins = parseInt(minutes, 10);
  if (isNaN(mins) || mins < 1) return;
  if (typeof window.saveMatchReminderTime === 'function') {
    try { window.saveMatchReminderTime(mins); }
    catch (e) { try { localStorage.setItem(MATCH_TIME_KEY, String(mins)); } catch (e2) {} }
  } else {
    try { localStorage.setItem(MATCH_TIME_KEY, String(mins)); } catch (e) {}
  }
  var opt = TIME_OPTIONS.find(function (o) { return o.id === mins; });
  showToast('وقت التذكير: ' + (opt ? opt.label : mins), 'success');
  closeTimePicker();
  updateNotifToggles();
  SoundBridge.success();
  haptic(12);
  try { window.dispatchEvent(new CustomEvent('h90:reminder:time-changed', { detail: { minutes: mins } })); } catch (e) {}
}

/* ================================================================
   SEARCH
   ================================================================ */
var searchDebounceTimer = null;

function openSearchOverlay() {
  var o = document.getElementById('searchOverlay');
  if (o) o.classList.add('show');
  setTimeout(function () {
    var i = document.getElementById('searchOverlayInput');
    if (i) i.focus();
  }, 100);
  renderSearchBody('');
  SoundBridge.open();
}
function closeSearchOverlay() {
  var o = document.getElementById('searchOverlay');
  var wasOpen = o && o.classList.contains('show');
  if (o) o.classList.remove('show');
  if (wasOpen) SoundBridge.close();
}
function handleSearchOverlay(q) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(function () { renderSearchBody(q); }, 120);
}
function renderSearchBody(q) {
  var body = document.getElementById('searchOverlayBody');
  if (!body) return;
  q = (q || '').trim();

  if (!q) {
    body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.35);"><div style="width:60px;height:60px;margin:0 auto 16px;opacity:0.5;color:#ff2d55;">' + getIcon('search') + '</div><div style="font-weight:700;font-size:14px;">ابحث عن قناة</div></div>';
    return;
  }

  var results = (typeof getAllChannels === 'function' ? getAllChannels() : []).filter(function (ch) {
    return ch.name_ar && ch.name_ar.toLowerCase().indexOf(q.toLowerCase()) > -1;
  });

  if (results.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);"><div style="font-weight:800;font-size:15px;color:#fff;margin-bottom:6px;">لا نتائج</div><div style="font-size:12px;">لم يتم العثور على "' + q + '"</div></div>';
    return;
  }

  var html = '<div style="color:rgba(255,255,255,0.55);font-size:12px;font-weight:800;padding:12px 4px 10px;">' + results.length + ' نتيجة</div>';
  results.slice(0, 50).forEach(function (ch) {
    var safeId = ch.id.replace(/'/g, "\\'");
    html += '<button onclick="selectSearch(\'' + safeId + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:#fff;cursor:pointer;font-family:inherit;text-align:right;width:100%;margin-bottom:8px;">' +
      '<div style="width:42px;height:42px;background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.3);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#00e676;"><div style="width:20px;height:20px;">' + getIcon('tv') + '</div></div>' +
      '<div style="flex:1;text-align:right;">' +
        '<div style="font-weight:700;font-size:13px;color:#fff;">' + ch.name_ar + '</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">' + (ch.group || '') + '</div>' +
      '</div>' +
    '</button>';
  });
  body.innerHTML = html;
}
function selectSearch(id) {
  SoundBridge.tap();
  closeSearchOverlay();
  setTimeout(function () { openChannel(id); }, 250);
}

/* ================================================================
   FAVORITES & RECENT
   ================================================================ */
function loadFavorites() {
  try { favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch (e) { favorites = []; }
}
function saveFavorites() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
}
function toggleFavorite(id) {
  var idx = favorites.indexOf(id);
  if (idx > -1) {
    favorites.splice(idx, 1);
    showToast('تمت الإزالة من المفضلة', 'info');
    SoundBridge.remove();
  } else {
    favorites.push(id);
    showToast('تمت الإضافة للمفضلة', 'success');
    SoundBridge.favorite();
  }
  saveFavorites();
  haptic(12);
}
function loadRecent() {
  try { recentChannels = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch (e) { recentChannels = []; }
}
function addToRecent(id) {
  recentChannels = recentChannels.filter(function (x) { return x !== id; });
  recentChannels.unshift(id);
  recentChannels = recentChannels.slice(0, 20);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentChannels)); } catch (e) {}
}

/* ================================================================
   HELP / CONTACT / FAQ
   ================================================================ */
function openHelp() {
  closeDrawer();
  var m = document.getElementById('helpModal');
  if (m) m.classList.add('show');
  SoundBridge.open();
}
function closeHelp() {
  var m = document.getElementById('helpModal');
  if (m) m.classList.remove('show');
  SoundBridge.close();
}
function openContact() {
  closeHelp();
  var m = document.getElementById('contactModal');
  if (m) m.classList.add('show');
  SoundBridge.open();
}
function closeContact() {
  var m = document.getElementById('contactModal');
  if (m) m.classList.remove('show');
  SoundBridge.close();
}
function openFAQ() {
  closeHelp();
  var FAQ_DATA = (window.H90_FAQ_DATA || []);
  if (!FAQ_DATA || FAQ_DATA.length === 0) {
    FAQ_DATA = [{ cat: 'عام', q: 'ما هو H90؟', a: 'تطبيق مجاني لمشاهدة القنوات والمباريات.' }];
  }
  var categories = [];
  var grouped = {};
  FAQ_DATA.forEach(function (f) {
    if (!grouped[f.cat]) { grouped[f.cat] = []; categories.push(f.cat); }
    grouped[f.cat].push(f);
  });

  var html = '<div style="background:linear-gradient(135deg,rgba(255,45,85,0.15),rgba(0,229,255,0.08));border:1px solid rgba(255,45,85,0.35);border-radius:16px;padding:16px;margin-bottom:16px;">' +
    '<div style="font-size:14px;font-weight:900;color:#fff;">' + FAQ_DATA.length + ' سؤالاً</div>' +
  '</div>';

  categories.forEach(function (cat) {
    var items = grouped[cat];
    html += '<div style="margin-bottom:22px;">';
    html += '<div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:14px;">' + cat + '</div>';
    items.forEach(function (f) {
      var safeQ = String(f.q || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var safeA = String(f.a || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      html += '<div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:14px;margin-bottom:10px;padding:14px;">' +
        '<div style="font-weight:800;color:#fff;font-size:13px;margin-bottom:8px;">' + safeQ + '</div>' +
        '<div style="color:rgba(255,255,255,0.72);font-size:12.5px;line-height:1.75;">' + safeA + '</div>' +
      '</div>';
    });
    html += '</div>';
  });

  var c = document.getElementById('faqContent');
  if (c) c.innerHTML = html;
  var m = document.getElementById('faqModal');
  if (m) m.classList.add('show');
  SoundBridge.open();
}
function closeFAQ() {
  var m = document.getElementById('faqModal');
  if (m) m.classList.remove('show');
  SoundBridge.close();
}

/* ================================================================
   shareApp
   ================================================================ */
async function shareApp() {
  var shareData = {
    title: 'H90 — البث المباشر',
    text: 'شاهد قنواتك المفضلة بث مباشر بجودة عالية',
    url: window.location.href
  };
  if (navigator.share) { try { await navigator.share(shareData); } catch (e) {} }
  closeDrawer();
  SoundBridge.tap();
}

/* ================================================================
   IPTV LAYOUT
   ================================================================ */
function renderIPTVLayout() {
  var sidebar = document.getElementById('iptvSidebar');
  var channelsGrid = document.getElementById('iptvChannelsGrid');
  if (!sidebar || !channelsGrid) return;

  var groups = (typeof getAllGroups === 'function') ? getAllGroups() : [];

  if (groups.length === 0) {
    sidebar.innerHTML = '<div style="padding:20px 10px;font-size:11px;color:rgba(255,255,255,.4);text-align:center;">جارٍ التحميل...</div>';
    channelsGrid.innerHTML = '<div style="padding:20px;font-size:11px;color:rgba(255,255,255,.4);text-align:center;">جارٍ التحميل...</div>';
    setTimeout(function() {
      if (typeof getAllGroups === 'function' && getAllGroups().length > 0) renderIPTVLayout();
    }, 2000);
    return;
  }

  var sidebarHtml = '';
  groups.forEach(function (g, idx) {
    var nameAr = g.name_ar || g.id;
    var nameEn = g.name_en || '';
    if (!nameEn) nameEn = String(g.id || '').replace(/^s\d+grp_/, '').replace(/_/g, ' ');
    var isFirst = idx === 0;
    var safeId = String(g.id).replace(/'/g, "\\'");
    sidebarHtml += '<div class="iptv-package' + (isFirst ? ' active' : '') + '" ' +
      'data-group-id="' + g.id + '" ' +
      'onclick="selectIPTVPackage(\'' + safeId + '\')">' +
      '<span class="iptv-package-name-ar">' + nameAr + '</span>' +
      (nameEn && nameEn !== nameAr ? '<span class="iptv-package-name-en">' + nameEn + '</span>' : '') +
    '</div>';
  });
  sidebar.innerHTML = sidebarHtml;

  if (groups[0]) selectIPTVPackage(groups[0].id, true);
}

function selectIPTVPackage(groupId, silent) {
  document.querySelectorAll('.iptv-package').forEach(function (p) {
    p.classList.toggle('active', p.dataset.groupId === groupId);
  });

  var channels = [];
  if (typeof getChannelsByGroup === 'function') {
    channels = getChannelsByGroup(groupId) || [];
  }

  var grid = document.getElementById('iptvChannelsGrid');
  if (!grid) return;

  if (channels.length === 0) {
    grid.innerHTML = '<div style="padding:20px;font-size:12px;color:rgba(255,255,255,.4);text-align:center;">لا توجد قنوات في هذه الباقة</div>';
    return;
  }

  var html = '';
  channels.forEach(function (ch) {
    var logo = ch.logo || '';
    var nameAr = ch.name_ar || 'قناة';
    var nameEn = ch.name_en || '';
    var letter = (ch.letter || nameAr.substring(0, 2)).toUpperCase();
    var safeId = String(ch.id).replace(/'/g, "\\'");
    var isActive = _iptvCurrentChannel && _iptvCurrentChannel.id === ch.id;

    html += '<div class="iptv-channel-card' + (isActive ? ' active' : '') + '" ' +
      'data-channel-id="' + ch.id + '" ' +
      'onclick="selectIPTVChannel(\'' + safeId + '\')">' +
      '<div class="iptv-channel-logo">' +
        (logo
          ? '<img src="' + logo + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div style="display:none;font-size:14px;font-weight:900;color:#ff2d55;">' + letter + '</div>'
          : '<div style="font-size:14px;font-weight:900;color:#ff2d55;">' + letter + '</div>'
        ) +
      '</div>' +
      '<div class="iptv-channel-names">' +
        '<span class="iptv-channel-name-ar">' + nameAr + '</span>' +
        (nameEn && nameEn !== nameAr ? '<span class="iptv-channel-name-en">' + nameEn + '</span>' : '') +
      '</div>' +
    '</div>';
  });
  grid.innerHTML = html;

  if (!silent) { SoundBridge.tap(); haptic(8); }
}
window.selectIPTVPackage = selectIPTVPackage;

function selectIPTVChannel(channelId) {
  var channel = (typeof getChannelById === 'function') ? getChannelById(channelId) : null;
  if (!channel) { showToast('القناة غير موجودة', 'error'); return; }

  document.querySelectorAll('.iptv-channel-card').forEach(function (c) {
    c.classList.toggle('active', c.dataset.channelId === channelId);
  });

  _iptvCurrentChannel = channel;

  var placeholder = document.getElementById('iptvPlayerPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  playInIPTVPlayer(channel);

  SoundBridge.tap();
  haptic(10);
}
window.selectIPTVChannel = selectIPTVChannel;

function playInIPTVPlayer(channel) {
  var video = document.getElementById('iptvVideoPlayer');
  if (!video) return;

  if (window.PlayerEngine && typeof window.PlayerEngine.loadChannelInElement === 'function') {
    try {
      window.PlayerEngine.loadChannelInElement(channel, video);
      showIPTVControls();
      return;
    } catch (e) {
      console.warn('loadChannelInElement failed, fallback to direct:', e);
    }
  }

  playIPTVDirect(video, channel);
  showIPTVControls();
}

function playIPTVDirect(video, channel) {
  var urls = (typeof getChannelUrls === 'function') ? getChannelUrls(channel, 'server2') : [];
  var url = urls[0] || '';

  if (!url) { showToast('لا يوجد رابط للقناة', 'error'); return; }

  if (/\.m3u8(\?|$)/i.test(url) && typeof Hls !== 'undefined' && Hls.isSupported()) {
    if (video._hls) { try { video._hls.destroy(); } catch (e) {} }
    var hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20 });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play().catch(function() {}); });
    video._hls = hls;
  } else {
    video.src = url;
    video.play().catch(function() {});
  }
}

/* ---------- IPTV Controls ---------- */
function showIPTVControls() {
  var controls = document.getElementById('iptvPlayerControls');
  if (!controls) return;
  controls.classList.add('visible');
  if (_iptvControlsTimer) clearTimeout(_iptvControlsTimer);
  _iptvControlsTimer = setTimeout(function() { controls.classList.remove('visible'); }, 3000);
}

function toggleIPTVControls() {
  var controls = document.getElementById('iptvPlayerControls');
  if (!controls) return;
  if (controls.classList.contains('visible')) {
    controls.classList.remove('visible');
    if (_iptvControlsTimer) clearTimeout(_iptvControlsTimer);
  } else {
    showIPTVControls();
  }
}

document.addEventListener('click', function(e) {
  var area = e.target.closest('.iptv-player-area');
  if (!area) return;
  if (e.target.closest('.iptv-ctrl-btn') || e.target.closest('.iptv-progress-track')) return;
  toggleIPTVControls();
});

function toggleIPTVPlay() {
  var video = document.getElementById('iptvVideoPlayer');
  var icon = document.getElementById('iptvPlayIcon');
  if (!video) return;
  if (video.paused) {
    video.play().catch(function() {});
    if (icon) icon.innerHTML = '<polygon points="6 4 20 12 6 20"/>';
  } else {
    video.pause();
    if (icon) icon.innerHTML = '<polygon points="6 3 20 12 6 21"/>';
  }
  showIPTVControls();
  SoundBridge.tap();
  haptic(8);
}
window.toggleIPTVPlay = toggleIPTVPlay;

function toggleIPTVFullscreen() {
  if (!_iptvCurrentChannel) { showToast('يرجى اختيار قناة أولاً', 'warning'); return; }
  if (typeof openChannel === 'function') openChannel(_iptvCurrentChannel.id);
}
window.toggleIPTVFullscreen = toggleIPTVFullscreen;

function seekIPTV(e) {
  var video = document.getElementById('iptvVideoPlayer');
  if (!video || !video.duration || !isFinite(video.duration)) return;
  var track = e.currentTarget;
  var rect = track.getBoundingClientRect();
  var pct = (rect.right - e.clientX) / rect.width;
  pct = Math.max(0, Math.min(1, pct));
  video.currentTime = video.duration * pct;
  var fill = document.getElementById('iptvProgressFill');
  if (fill) fill.style.width = (pct * 100) + '%';
  showIPTVControls();
}
window.seekIPTV = seekIPTV;

function attachIPTVVideoListeners() {
  var video = document.getElementById('iptvVideoPlayer');
  if (!video || video._iptvBound) return;
  video._iptvBound = true;

  video.addEventListener('timeupdate', function() {
    if (!video.duration || !isFinite(video.duration)) return;
    var pct = (video.currentTime / video.duration) * 100;
    var fill = document.getElementById('iptvProgressFill');
    if (fill) fill.style.width = pct + '%';
    var cur = document.getElementById('iptvCurrentTime');
    if (cur) {
      var m = Math.floor(video.currentTime / 60);
      var s = Math.floor(video.currentTime % 60);
      cur.textContent = m + ':' + String(s).padStart(2, '0');
    }
  });

  video.addEventListener('loadedmetadata', function() {
    var total = document.getElementById('iptvTotalTime');
    if (total && video.duration && isFinite(video.duration)) {
      var m = Math.floor(video.duration / 60);
      var s = Math.floor(video.duration % 60);
      total.textContent = m + ':' + String(s).padStart(2, '0');
    }
  });

  video.addEventListener('play', function() {
    var icon = document.getElementById('iptvPlayIcon');
    if (icon) icon.innerHTML = '<polygon points="6 4 20 12 6 20"/>';
  });

  video.addEventListener('pause', function() {
    var icon = document.getElementById('iptvPlayIcon');
    if (icon) icon.innerHTML = '<polygon points="6 3 20 12 6 21"/>';
  });
}

/* ================================================================
   OPEN CHANNEL (fullscreen)
   ================================================================ */
function openChannel(channelId) {
  var channel = (typeof getChannelById === 'function') ? getChannelById(channelId) : null;
  if (!channel) { showToast('القناة غير موجودة', 'error'); return; }

  SoundBridge.tap();
  haptic(12);

  if (!window.PlayerEngine || typeof window.PlayerEngine.loadChannel !== 'function') {
    showToast('المشغل غير جاهز', 'error');
    SoundBridge.error();
    return;
  }

  addToRecent(channel.id);
  _iptvCurrentChannel = channel;

  lockPageScroll();

  var playerPage = document.getElementById('playerPage');
  if (playerPage) {
    playerPage.classList.add('show');
    playerPage.style.display = 'flex';
  }

  var title = document.getElementById('playerTitle');
  if (title) title.textContent = channel.name_ar || '';

  try {
    window.PlayerEngine.loadChannel(channel, 0, 'server2');
  } catch (e) {
    showToast('فشل تشغيل القناة', 'error');
    SoundBridge.error();
    restorePageScroll();
  }

  haptic(15);
}
window.openChannel = openChannel;

function closePlayer() {
  var playerPage = document.getElementById('playerPage');
  var video = document.getElementById('videoPlayer');
  if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {} }
  if (playerPage) { playerPage.classList.remove('show'); playerPage.style.display = 'none'; }
  restorePageScroll();
  SoundBridge.close();
}
window.closePlayer = closePlayer;

/* ================================================================
   PLAYER BINDINGS
   ================================================================ */
window.togglePlay   = function () { return window.PlayerEngine && window.PlayerEngine.togglePlay(); };
window.seekBy       = function (s) { return window.PlayerEngine && window.PlayerEngine.seekBy(s); };
window.seekFromClick= function (e) { return window.PlayerEngine && window.PlayerEngine.seekFromClick(e); };
window.toggleMute   = function () { return window.PlayerEngine && window.PlayerEngine.toggleMute(); };
window.cycleSpeed   = function () { return window.PlayerEngine && window.PlayerEngine.cycleSpeed(); };
window.reloadStream = function () { return window.PlayerEngine && window.PlayerEngine.reloadStream(); };

/* ================================================================
   GLOBAL EXPORTS
   ================================================================ */
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.toggleSetting = toggleSetting;
window.setTheme = setTheme;
window.renderThemeGrid = renderThemeGrid;
window.clearAppCache = clearAppCache;
window.openHelp = openHelp;
window.closeHelp = closeHelp;
window.openFAQ = openFAQ;
window.closeFAQ = closeFAQ;
window.openContact = openContact;
window.closeContact = closeContact;
window.shareApp = shareApp;
window.openSearch = openSearchOverlay;
window.closeSearch = closeSearchOverlay;
window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.handleSearchOverlay = handleSearchOverlay;
window.selectSearch = selectSearch;
window.toggleNotifSetting = toggleNotifSetting;
window.updateNotifToggles = updateNotifToggles;
window.requestNotificationPermission = requestNotificationPermission;
window.openTimePicker = openTimePicker;
window.closeTimePicker = closeTimePicker;
window.selectMatchTime = selectMatchTime;
window.getIcon = getIcon;
window.haptic = haptic;
window.hexToRgb = hexToRgb;
window.getNotifSettings = getNotifSettings;
window.getMatchReminderTime = getMatchReminderTime;
window.toggleFavorite = toggleFavorite;
window.switchTab = switchTab;
window.switchEntertainmentTab = switchEntertainmentTab;
window.renderNotifPageContent = renderNotifPageContent;
window.renderHomePage = renderHomePage;
window.renderIPTVLayout = renderIPTVLayout;
window.renderMatchesPage = renderMatchesPage;
window.renderRoomsPage = renderRoomsPage;
window.renderSettingsPage = renderSettingsPage;
window.showToast = showToast;
window.updateNavIndicator = updateNavIndicator;
window.restorePageScroll = restorePageScroll;
window.lockPageScroll = lockPageScroll;

/* ================================================================
   BOOT
   ================================================================ */
document.addEventListener('DOMContentLoaded', async function () {
  console.log('%cH90 v32.3 — Core Ready', 'color:#ff2d55;font-weight:900;font-size:14px');

  setTimeout(restorePageScroll, 100);
  setTimeout(restorePageScroll, 1500);

  loadFavorites();
  loadRecent();
  loadTheme();
  updateNotifToggles();
  initDNDState();

  if (typeof loadM3UFromWorker === 'function') {
    try { await loadM3UFromWorker(); }
    catch (e) { console.error('فشل تحميل القنوات:', e); }
  }

  if (window.PlayerEngine && typeof window.PlayerEngine.init === 'function') {
    setTimeout(function () { try { window.PlayerEngine.init(); } catch (e) {} }, 500);
  }

  attachIPTVVideoListeners();

  document.body.classList.add('on-home');

  setTimeout(function() { updateNavIndicator('home'); }, 100);
  setTimeout(function() { updateNavIndicator('home'); }, 500);

  document.querySelectorAll('.nav-item').forEach(function (item) {
    if (item.dataset.bound === '1') return;
    item.dataset.bound = '1';
    item.addEventListener('click', function () {
      var tab = item.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  window.addEventListener('resize', function() {
    updateNavIndicator(currentTab);
  }, { passive: true });

  setTimeout(function() { try { renderHomePage(); } catch (e) {} }, 100);

  if (typeof window.updateTeamsCountLabel === 'function') {
    setTimeout(window.updateTeamsCountLabel, 500);
  }

  setTimeout(function () {
    if (typeof window.startMatchReminders === 'function' && areNotificationsEnabled()) {
      window.startMatchReminders();
    }
  }, 3000);

  setTimeout(checkNewH90Notifications, 3000);
  setTimeout(bindSoundEvents, 300);
});

function bindSoundEvents() {
  if (typeof H90Sounds === 'undefined') return;
  document.querySelectorAll('.header-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { SoundBridge.tap(); }, { passive: true });
  });
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.home-card, .iptv-channel-card, .iptv-package');
    if (card) SoundBridge.tap();
  }, { passive: true });
}

/* Scroll safety */
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    var playerPage = document.getElementById('playerPage');
    if (!playerPage || !playerPage.classList.contains('show')) {
      if (document.body.classList.contains('player-open')) restorePageScroll();
    }
  }
});

window.addEventListener('pageshow', function() {
  var playerPage = document.getElementById('playerPage');
  if (!playerPage || !playerPage.classList.contains('show')) {
    if (document.body.classList.contains('player-open')) restorePageScroll();
  }
});

setInterval(function() {
  var playerPage = document.getElementById('playerPage');
  var playerOpen = playerPage && playerPage.classList.contains('show');
  if (!playerOpen && document.body.classList.contains('player-open')) {
    var noInternetOpen = document.getElementById('noInternetScreen') && document.getElementById('noInternetScreen').classList.contains('show');
    if (!noInternetOpen) restorePageScroll();
  }
}, 2500);

console.log('%cH90 Core v32.3 Ready',
  'background:linear-gradient(135deg,#ff2d55,#00e5ff);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px');
/* ================================================================
   H90 — Extensions Module (h90-extensions.js)
   ================================================================
   ✅ إدارة الشاشات (Splash, Welcome, No Internet)
   ✅ Toast موحد
   ✅ Particles
   ✅ Header Scroll
   ✅ Legal (Terms/Privacy/About)
   ✅ Notifications Page (full screen)
   ✅ Drawer shortcuts
   ✅ Theme toggle
   ✅ Auto-hide header on scroll (home only)
   ================================================================ */

'use strict';

(function h90Extensions() {

/* ================================================================
   Helpers
   ================================================================ */
var $ = function(id) { return document.getElementById(id); };

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

if (typeof window.__H90_KEYS__ === 'undefined') {
  window.__H90_KEYS__ = {
    WELCOME_SEEN: 'h90_welcome_seen_v1',
    TERMS_ACCEPTED: 'h90_terms_accepted_v1',
    NOTIF_ASKED: 'h90_notif_asked_after_welcome_v1'
  };
}

var WELCOME_SEEN_KEY = window.__H90_KEYS__.WELCOME_SEEN;
var TERMS_ACCEPTED_KEY = window.__H90_KEYS__.TERMS_ACCEPTED;

/* ================================================================
   Toast (unified)
   ================================================================ */
function showToastSafe(msg, type) {
  if (typeof window.showToast === 'function' && window.showToast !== showToastSafe) {
    try { window.showToast(msg, type); return; } catch (e) {}
  }
  var old = document.querySelector('.h90-toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'h90-toast ' + (type || '');
  
  var colors = {
    success: '#00e676',
    error:   '#ff2d55',
    warning: '#ffb300',
    info:    '#00e5ff'
  };
  var accent = colors[type] || colors.info;
  
  var icon = document.createElement('span');
  icon.style.cssText = 'width:20px;height:20px;background:' + accent + ';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;color:#000';
  icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
  
  var m = document.createElement('span');
  m.textContent = msg;
  t.appendChild(icon); t.appendChild(m);
  document.body.appendChild(t);
  
  setTimeout(function() {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(function() { t.remove(); }, 300);
  }, 2600);
}
window.showToastSafe = showToastSafe;

/* ================================================================
   Particles (light, reduced)
   ================================================================ */
(function createParticles() {
  var container = $('bgParticles');
  if (!container) return;
  
  var lowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
  var count = lowEnd ? 5 : 10;
  var frag = document.createDocumentFragment();
  
  for (var i = 0; i < count; i++) {
    var p = document.createElement('div');
    p.className = 'p';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (14 + Math.random() * 12) + 's';
    p.style.animationDelay = (-Math.random() * 12) + 's';
    frag.appendChild(p);
  }
  container.appendChild(frag);
  
  document.addEventListener('visibilitychange', function() {
    document.body.classList.toggle('page-hidden', document.hidden);
  });
})();

/* ================================================================
   Header — auto hide on scroll + show only on home
   ================================================================ */
var _lastScrollY = 0;
var _headerTicking = false;
var _SCROLL_THRESHOLD = 8;
var _HIDE_AFTER = 60;

function updateHeaderOnScroll() {
  var h = $('appHeader');
  if (!h) { _headerTicking = false; return; }
  
  var y = window.scrollY || document.documentElement.scrollTop || 0;
  var diff = y - _lastScrollY;
  
  // add scrolled class
  h.classList.toggle('scrolled', y > _SCROLL_THRESHOLD);
  
  // hide/show only on home page
  var isHome = document.body.classList.contains('on-home');
  if (isHome) {
    if (y > _HIDE_AFTER && diff > 2) {
      h.classList.add('header-hidden');
    } else if (diff < -5 || y < 20) {
      h.classList.remove('header-hidden');
    }
  } else {
    h.classList.remove('header-hidden');
  }
  
  _lastScrollY = y;
  _headerTicking = false;
}

window.addEventListener('scroll', function() {
  if (!_headerTicking) {
    _headerTicking = true;
    requestAnimationFrame(updateHeaderOnScroll);
  }
}, { passive: true });

/* ================================================================
   Connectivity
   ================================================================ */
var noInternetScreen = $('noInternetScreen');
var splashScreenEl = $('splashScreen');

function isOnline() { return navigator.onLine; }

function showNoInternet() {
  if (noInternetScreen) noInternetScreen.classList.add('show');
  if (splashScreenEl) splashScreenEl.classList.add('hidden');
  document.body.classList.add('no-internet');
}

function hideNoInternet() {
  if (noInternetScreen) noInternetScreen.classList.remove('show');
  document.body.classList.remove('no-internet');
}

function retryConnection() {
  var btn = $('retryBtn');
  if (btn) btn.classList.add('spinning');
  
  if (isOnline()) {
    hideNoInternet();
    setTimeout(function() { location.reload(); }, 300);
    return;
  }
  
  fetch('https://www.google.com/generate_204', {
    method: 'HEAD',
    cache: 'no-store',
    mode: 'no-cors'
  })
    .then(function() { hideNoInternet(); setTimeout(function() { location.reload(); }, 300); })
    .catch(function() { if (btn) btn.classList.remove('spinning'); });
}

if (!isOnline() && !window.__H90_APK_MODE__) showNoInternet();
window.addEventListener('online', hideNoInternet);
window.addEventListener('offline', function() {
  if (!window.__H90_APK_MODE__) showNoInternet();
});

/* ================================================================
   Scroll-lock safety valve
   ================================================================ */
function unlockScrollIfStuck() {
  try {
    var b = document.body;
    if (!b) return;
    
    var pp = $('playerPage');
    var niVisible = noInternetScreen && noInternetScreen.classList.contains('show');
    var playerVisible = pp && pp.classList.contains('show');
    
    if (!niVisible) b.classList.remove('no-internet');
    if (!playerVisible) b.classList.remove('player-open', 'immersive-fullscreen');
    
    if (!niVisible && !playerVisible) {
      if (b.style.overflow === 'hidden') b.style.overflow = '';
      if (document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = '';
    }
  } catch (e) {}
}

setInterval(function() { if (!document.hidden) unlockScrollIfStuck(); }, 2500);
window.addEventListener('online', unlockScrollIfStuck);
window.addEventListener('pageshow', unlockScrollIfStuck);
document.addEventListener('visibilitychange', function() { if (!document.hidden) unlockScrollIfStuck(); });

/* ================================================================
   Legal (Terms / Privacy / About)
   ================================================================ */
function showLegal(id, resetSel) {
  var el = $(id);
  if (!el) return;
  el.style.zIndex = '9999999';
  el.classList.add('show');
  var body = el.querySelector(resetSel || '.legal-modal-body');
  if (body) body.scrollTop = 0;
  if (typeof Sound !== 'undefined' && Sound.open) Sound.open();
}

function openTerms() {
  if (typeof closeSettings === 'function') closeSettings();
  setTimeout(function() { showLegal('termsModal'); updateTermsBtnState(); }, 180);
}

function openPrivacy() {
  if (typeof closeSettings === 'function') closeSettings();
  setTimeout(function() { showLegal('privacyModal'); }, 180);
}

function openAbout() {
  if (typeof closeSettings === 'function') closeSettings();
  setTimeout(function() {
    showLegal('aboutModal', 'div[style*="overflow-y:auto"], .legal-modal-body');
    if (navigator.vibrate) navigator.vibrate(10);
  }, 180);
}

function acceptTerms() {
  lsSet(TERMS_ACCEPTED_KEY, 'true');
  lsSet('h90_terms_accepted_at', new Date().toISOString());
  if (typeof Sound !== 'undefined' && Sound.success) Sound.success();
  if (navigator.vibrate) navigator.vibrate(30);
  showToastSafe('شكراً لموافقتك على الشروط', 'success');
  updateTermsBtnState();
  setTimeout(function() {
    var el = $('termsModal');
    if (el) { el.classList.remove('show'); el.style.zIndex = ''; }
  }, 900);
}

function updateTermsBtnState() {
  var accepted = lsGet(TERMS_ACCEPTED_KEY) === 'true';
  var btn = $('acceptTermsBtn');
  var txt = $('acceptTermsText');
  if (btn && txt) {
    btn.disabled = accepted;
    txt.textContent = accepted ? 'تمت الموافقة على الشروط' : 'أوافق على الشروط والأحكام';
  }
}

window.closeModal = function(id) {
  var m = $(id);
  if (m) {
    m.classList.remove('show');
    if (id === 'termsModal' || id === 'privacyModal' || id === 'aboutModal') m.style.zIndex = '';
    if (typeof Sound !== 'undefined' && Sound.close) Sound.close();
  }
};

/* ================================================================
   ESC / Android back — close top modal
   ================================================================ */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var ids = ['aboutModal', 'privacyModal', 'termsModal', 'timePickerModal',
             'helpModal', 'faqModal', 'contactModal', 'notifPage', 'searchOverlay'];
  for (var i = 0; i < ids.length; i++) {
    var m = $(ids[i]);
    if (m && m.classList.contains('show')) { window.closeModal(ids[i]); return; }
  }
});

/* ================================================================
   Notifications Page (full screen, opens from settings)
   ================================================================ */
function openNotifPage() {
  if (typeof closeSettings === 'function') closeSettings();
  setTimeout(function() {
    var el = $('notifPage');
    if (el) el.classList.add('show');
    if (typeof Sound !== 'undefined' && Sound.open) Sound.open();
    if (typeof window.renderNotifPageContent === 'function') {
      try { window.renderNotifPageContent(); } catch (e) {}
    }
  }, 180);
}

function closeNotifPage() {
  var el = $('notifPage');
  if (el) el.classList.remove('show');
  if (typeof Sound !== 'undefined' && Sound.close) Sound.close();
}

/* ================================================================
   Drawer shortcuts
   ================================================================ */
function drawerGo(openFn, toast, goTab) {
  if (typeof closeDrawer === 'function') closeDrawer();
  setTimeout(function() {
    if (goTab && typeof switchTab === 'function') switchTab(goTab);
    setTimeout(function() {
      if (openFn) openFn();
      if (toast) showToastSafe(toast, 'success');
    }, goTab ? 300 : 0);
  }, 200);
}

function drawerOpenFavorites() {
  drawerGo(function() {
    if (typeof showFavoritesOnly === 'function') showFavoritesOnly();
    else if (typeof openFavorites === 'function') openFavorites();
  }, 'المفضلة للقنوات', 'channels');
}

function drawerOpenTeamsFavorites() {
  drawerGo(function() {
    if (typeof openTeamsFavorites === 'function') openTeamsFavorites();
    else if (typeof openTeamsPicker === 'function') openTeamsPicker();
  }, 'مفضلة الفرق', null);
}

function drawerOpenRecent() {
  drawerGo(function() {
    if (typeof showRecentChannels === 'function') showRecentChannels();
    else if (typeof openRecent === 'function') openRecent();
  }, 'الأخيرة للقنوات', 'channels');
}

/* ================================================================
   Splash dismiss
   ================================================================ */
function hideSplash() {
  if (splashScreenEl) splashScreenEl.classList.add('hidden');
}

/* ================================================================
   Init
   ================================================================ */
function initApp() {
  updateTermsBtnState();

  /* show request-notif button if permission is default */
  if ('Notification' in window && Notification.permission === 'default') {
    var btn = $('requestNotifPermissionBtn');
    if (btn) btn.style.display = 'flex';
  }

  var started = Date.now();
  var MIN_SPLASH = 1800;

  function finish() {
    var wait = Math.max(0, MIN_SPLASH - (Date.now() - started));
    setTimeout(function() { hideSplash(); }, wait);
  }

  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  setTimeout(hideSplash, 4500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else setTimeout(initApp, 50);

/* ================================================================
   Notification polling (lightweight, in extensions)
   ================================================================ */
var notifCheckInterval = null;

function startNotifPolling() {
  if (notifCheckInterval) clearInterval(notifCheckInterval);
  notifCheckInterval = setInterval(function() {
    if (!document.hidden && typeof window.checkNewH90Notifications === 'function') {
      window.checkNewH90Notifications();
    }
  }, 120000);
}

function stopNotifPolling() {
  if (notifCheckInterval) {
    clearInterval(notifCheckInterval);
    notifCheckInterval = null;
  }
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    stopNotifPolling();
  } else {
    startNotifPolling();
    if (typeof window.checkNewH90Notifications === 'function') {
      window.checkNewH90Notifications();
    }
  }
});

setTimeout(startNotifPolling, 5000);

/* ================================================================
   Public API
   ================================================================ */
window.retryConnection = retryConnection;
window.openTerms = openTerms;
window.openPrivacy = openPrivacy;
window.openAbout = openAbout;
window.acceptTerms = acceptTerms;
window.updateTermsBtnState = updateTermsBtnState;
window.openNotifPage = openNotifPage;
window.closeNotifPage = closeNotifPage;
window.drawerOpenFavorites = drawerOpenFavorites;
window.drawerOpenTeamsFavorites = drawerOpenTeamsFavorites;
window.drawerOpenRecent = drawerOpenRecent;
window.unlockScrollIfStuck = unlockScrollIfStuck;

window.H90APK = {
  isNative: function() { return !!window.__H90_APK_MODE__; },
  getStatus: function() {
    return {
      apkMode: !!window.__H90_APK_MODE__,
      hasCapacitor: !!window.Capacitor,
      hasCordova: !!window.cordova,
      firebaseReady: window.H90Firebase ? window.H90Firebase.isReady() : false,
      soundsReady: typeof H90Sounds !== 'undefined'
    };
  },
  resetAll: function() {
    try {
      localStorage.removeItem(WELCOME_SEEN_KEY);
      localStorage.removeItem(TERMS_ACCEPTED_KEY);
      return true;
    } catch (e) { return false; }
  }
};

console.log(
  '%c H90 Extensions %c v1.0 ',
  'background:linear-gradient(135deg,#00e5ff,#9c27b0);color:#fff;padding:4px 10px;border-radius:6px 0 0 6px;font-weight:900;font-size:11px;',
  'background:#00a94f;color:#fff;padding:4px 10px;border-radius:0 6px 6px 0;font-weight:900;font-size:10px;'
);

})();
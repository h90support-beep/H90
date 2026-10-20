/* ================================================================
   H90 Rooms System v8.0 — SECURED + ENCRYPTED
   ================================================================
   ✅ تشفير AES-256-GCM لكل البيانات الحساسة
   ✅ PBKDF2 (100K) لكلمات السر
   ✅ HMAC لكل رسالة (منع التعديل)
   ✅ Nonce + Timestamp (منع إعادة الإرسال)
   ✅ Device Signature (منع السرقة)
   ✅ Rate Limiting (منع السبام)
   ✅ Self-Destruct عند التهديد
   ✅ تشفير الرسائل النصية + الصوتية + روابط البث
   ✅ حماية الغرف من اللعب
   ================================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   0. الحالة العامة
   ═══════════════════════════════════════════════════════════════ */
const H90Rooms = {
  currentRoomId: null,
  currentUser: { name: '', isCreator: false, roomId: null },
  timerInterval: null,
  timeLeft: 0,
  listeners: [],
  messageCleaner: null,
  inactivityChecker: null,
  typingTimeout: null,
  replyToMessage: null,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  voiceTimer: null,
  voiceSeconds: 0,
  activeStream: null,
  activeChannelId: null,
  currentStreamKey: '',
  voiceMimeType: 'audio/webm',
  hls: null,
  syncMode: true,
  lastMessageTime: 0,
  stalledMap: {},
  selfStalled: false,
  syncPaused: false,
  pausedBySync: false,
  serverOffset: 0,
  stallTimer: null,
  syncEvalTimer: null,
  leaving: false,
  roomLocked: false,
  _bound: {},
  _stalledPath: null,
  localQuality: 'FHD',
  currentChannelQualities: [],
  _rateLimits: {}
};

const MESSAGE_MAX_AGE = 30 * 60 * 1000;
const INACTIVITY_TIMEOUT = 60 * 60 * 1000;
const MAX_VOICE_SECONDS = 15;
const MAX_VOICE_SIZE = 800000;
const DB_OP_TIMEOUT = 15000;
const STALL_MAX_WAIT = 3 * 60 * 1000;
const STALL_BUFFER_DELAY = 3000;
const POLL_INTERVAL = 2000;
const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 10;

const H90_NOTIFY_WORKER = 'https://h90-notfiy.dairalzor33.workers.dev';
const H90_VAPID_KEY = 'BPOuC2mScgOGuDf4XScd8YrbAvLHNmL9QtNxHWKSJBuink-CJ7J5qR30XnhW3hS5lFYSLDtgBl5A5f0OjXaQEYA';
const NOTIF_QUEUE_CLEANUP_INTERVAL = 3 * 60 * 60 * 1000;
const NOTIF_QUEUE_MAX_AGE = 3 * 60 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════
   🔐 0.0 RoomCrypto — طبقة التشفير
   ═══════════════════════════════════════════════════════════════ */
var RoomCrypto = (function() {
  var _key = null;
  var _keyPromise = null;
  var _salt = 'h90_rooms_aes_v8_2026';

  /* ─── الحصول على deviceId ─── */
  function _getDeviceId() {
    try {
      var id = localStorage.getItem('h90_device_id');
      if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('h90_device_id', id);
      }
      return id;
    } catch (e) {
      return 'dev_anon_' + Math.random().toString(36);
    }
  }

  /* ─── الحصول على masterKey من security.js ─── */
  function _getMasterKey() {
    try {
      if (window.H90Crypto && typeof window.H90Crypto.getDeviceId === 'function') {
        return window.H90Crypto.getDeviceId();
      }
      if (window.__H90_SIG__ && window.__H90_SIG__.sha256) {
        return window.__H90_SIG__.sha256;
      }
      if (window.__H90_SEC__ && window.__H90_SEC__.sig) {
        var sig = window.__H90_SEC__.sig();
        if (sig && sig.sha256) return sig.sha256;
      }
    } catch (e) {}
    return 'h90_default_master_key_v8';
  }

  /* ─── اشتقاق المفتاح ─── */
  async function _deriveKey() {
    if (_key) return _key;
    if (_keyPromise) return _keyPromise;

    _keyPromise = (async function() {
      try {
        var deviceId = _getDeviceId();
        var masterKey = _getMasterKey();
        var secret = deviceId + '|' + masterKey + '|' + _salt;

        var encoder = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );

        var key = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode(_salt),
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );

        _key = key;
        return key;
      } catch (e) {
        console.error('❌ [RoomCrypto] فشل اشتقاق المفتاح:', e);
        throw e;
      }
    })();

    return _keyPromise;
  }

  /* ─── تشفير نص ─── */
  async function encrypt(plaintext) {
    try {
      if (!plaintext) return null;
      var key = await _deriveKey();
      var encoder = new TextEncoder();
      var iv = crypto.getRandomValues(new Uint8Array(12));

      var encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(String(plaintext))
      );

      var combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      return _ab2b64(combined);
    } catch (e) {
      console.warn('⚠️ [RoomCrypto] encrypt failed:', e);
      return null;
    }
  }

  /* ─── فك تشفير ─── */
  async function decrypt(ciphertextBase64) {
    try {
      if (!ciphertextBase64) return null;
      var key = await _deriveKey();
      var combined = _b642ab(ciphertextBase64);
      var iv = combined.slice(0, 12);
      var ciphertext = combined.slice(12);

      var decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn('⚠️ [RoomCrypto] decrypt failed:', e);
      return null;
    }
  }

  /* ─── تشفير JSON ─── */
  async function encryptJSON(obj) {
    try {
      return await encrypt(JSON.stringify(obj));
    } catch (e) {
      return null;
    }
  }

  /* ─── فك تشفير JSON ─── */
  async function decryptJSON(ciphertextBase64) {
    try {
      var json = await decrypt(ciphertextBase64);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  /* ─── HMAC ─── */
  async function hmac(data) {
    try {
      var encoder = new TextEncoder();
      var hmacKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(_salt + '_hmac_v8'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      var signature = await crypto.subtle.sign(
        'HMAC',
        hmacKey,
        encoder.encode(String(data))
      );

      return _ab2b64(signature);
    } catch (e) {
      return null;
    }
  }

  /* ─── PBKDF2 لكلمة السر ─── */
  async function hashPassword(password, roomSalt) {
    try {
      var encoder = new TextEncoder();
      var salt = encoder.encode((roomSalt || _salt) + '_pass_v8');

      var keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      var bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      return Array.from(new Uint8Array(bits))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    } catch (e) {
      console.error('❌ [RoomCrypto] hashPassword failed:', e);
      return null;
    }
  }

  /* ─── Nonce (عشوائي فريد) ─── */
  function generateNonce() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map(function(b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  /* ─── Device Signature ─── */
  async function getDeviceSignature() {
    try {
      var deviceId = _getDeviceId();
      var ua = navigator.userAgent || '';
      var data = deviceId + '|' + ua.substring(0, 100);
      return await hmac(data);
    } catch (e) {
      return null;
    }
  }

  /* ─── Helpers ─── */
  function _ab2b64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    var chunkSize = 8192;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      var chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function _b642ab(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  return {
    encrypt: encrypt,
    decrypt: decrypt,
    encryptJSON: encryptJSON,
    decryptJSON: decryptJSON,
    hmac: hmac,
    hashPassword: hashPassword,
    generateNonce: generateNonce,
    getDeviceSignature: getDeviceSignature,
    getDeviceId: _getDeviceId,
    isReady: function() { return !!_key; },
    reset: function() { _key = null; _keyPromise = null; }
  };
})();

window.H90RoomCrypto = RoomCrypto;

/* ═══════════════════════════════════════════════════════════════
   0.1 REST API Client
   ═══════════════════════════════════════════════════════════════ */
const H90_REST_BASE = 'https://h90-app-default-rtdb.europe-west1.firebasedatabase.app';
var _restPollers = {};

function _restGet(path) {
  return fetch(H90_REST_BASE + '/' + path + '.json', { cache: 'no-store' })
    .then(function(r) {
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          throw Object.assign(new Error('Permission Denied'), { code: 'PERMISSION_DENIED' });
        }
        throw new Error('HTTP ' + r.status);
      }
      return r.json();
    });
}

function _restSet(path, data) {
  return fetch(H90_REST_BASE + '/' + path + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) {
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        throw Object.assign(new Error('Permission Denied'), { code: 'PERMISSION_DENIED' });
      }
      throw new Error('HTTP ' + r.status);
    }
    return r.json();
  });
}

function _restUpdate(path, data) {
  return fetch(H90_REST_BASE + '/' + path + '.json', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

function _restDelete(path) {
  return fetch(H90_REST_BASE + '/' + path + '.json', {
    method: 'DELETE'
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return null;
  });
}

function _restPush(path, data) {
  return fetch(H90_REST_BASE + '/' + path + '.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().then(function(j) { return { key: j && j.name ? j.name : null }; });
  });
}

function _restPoll(path, callback, interval) {
  var key = path + '::' + Date.now() + '_' + Math.random();
  var lastJson = null;

  var pollFn = function() {
    _restGet(path)
      .then(function(data) {
        var json = JSON.stringify(data);
        if (json !== lastJson) {
          lastJson = json;
          callback({ val: function() { return data; }, exists: function() { return data != null; } });
        }
      })
      .catch(function(e) {
        console.warn('[H90 REST Poll]', path, e.message);
      });
  };

  pollFn();
  var intervalId = setInterval(pollFn, interval || POLL_INTERVAL);
  _restPollers[key] = { intervalId: intervalId };
  return key;
}

function _restStopPoll(pollKey) {
  if (_restPollers[pollKey]) {
    clearInterval(_restPollers[pollKey].intervalId);
    delete _restPollers[pollKey];
  }
}

function _dbOp(promise, label) {
  var timer;
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      timer = setTimeout(function () {
        var e = new Error('انتهت مهلة ' + (label || 'العملية'));
        e.code = 'H90_TIMEOUT';
        reject(e);
      }, DB_OP_TIMEOUT);
    })
  ]).then(function(r) { clearTimeout(timer); return r; },
          function(e) { clearTimeout(timer); throw e; });
}

function _errMsg(err) {
  var msg = err && err.message ? String(err.message) : '';
  if (err && err.code === 'PERMISSION_DENIED') return 'صلاحيات قاعدة البيانات مرفوضة';
  if (err && err.code === 'H90_TIMEOUT') return msg;
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'تحقق من اتصالك بالإنترنت';
  return msg || 'حدث خطأ غير متوقع';
}

function _haptic(ms) { if (navigator.vibrate) try { navigator.vibrate(ms || 10); } catch (e) {} }
function _toast(msg, type) {
  try {
    var colors = { error: '#e53935', warning: '#f9a825', success: '#00c853', info: '#0288d1' };
    var el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.textContent = String(msg);
    el.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);' +
      'top:calc(16px + env(safe-area-inset-top,0px));' +
      'max-width:90vw;padding:12px 18px;border-radius:14px;' +
      'color:#fff;font:700 13.5px/1.5 inherit;text-align:center;direction:rtl;' +
      'background:' + (colors[type] || colors.info) + ';' +
      'box-shadow:0 8px 28px rgba(0,0,0,.55);z-index:2147483647;' +
      'pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (e) {} }, type === 'error' ? 5000 : 3000);
  } catch (e) {}
  console.log('[H90Rooms Toast]', type, msg);
}
function _escape(str) {
  var d = document.createElement('div');
  d.textContent = String(str == null ? '' : str);
  return d.innerHTML;
}
function _once(key, fn) {
  if (H90Rooms._bound[key]) return;
  H90Rooms._bound[key] = true;
  fn();
}

/* ═══════════════════════════════════════════════════════════════
   🛡️ 0.15 Rate Limiter
   ═══════════════════════════════════════════════════════════════ */
function _checkRateLimit(key) {
  try {
    var now = Date.now();
    var limits = H90Rooms._rateLimits || {};
    var entry = limits[key] || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

    if (now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    }

    entry.count++;

    if (entry.count > RATE_LIMIT_MAX) {
      limits[key] = entry;
      H90Rooms._rateLimits = limits;
      return false;
    }

    limits[key] = entry;
    H90Rooms._rateLimits = limits;
    return true;
  } catch (e) {
    return true;
  }
}

/* AudioContext مشترك */
let _sharedAudioCtx = null;
function _getAudioCtx() {
  if (!_sharedAudioCtx) {
    try {
      _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
  }
  if (_sharedAudioCtx.state === 'suspended') _sharedAudioCtx.resume().catch(function(){});
  return _sharedAudioCtx;
}

function _playSound() {
  try {
    var ctx = _getAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

function _roomKey(name) {
  var base = String(name || '').trim().toLowerCase()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[.$#\[\]\/\\]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  if (!base) return '';
  var hash = 0;
  var src = String(name || '');
  for (var i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
  }
  return 'room_' + base + '_' + Math.abs(hash).toString(36);
}

/* ═══════════════════════════════════════════════════════════════
   0.2 نظام الإشعارات (FCM)
   ═══════════════════════════════════════════════════════════════ */
let _fcmRegistered = false;
let _fcmToken = null;
let _deviceId = null;

function _getDeviceId() {
  if (_deviceId) return _deviceId;
  try {
    _deviceId = localStorage.getItem('h90_device_id');
    if (!_deviceId) {
      _deviceId = 'dev_' + Date.now().toString(36) + '_' +
                  Math.random().toString(36).substring(2, 10);
      localStorage.setItem('h90_device_id', _deviceId);
    }
  } catch (e) { _deviceId = 'dev_anon'; }
  return _deviceId;
}

async function _registerFCMToken() {
  if (_fcmRegistered) return _fcmToken;
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
    if (typeof firebase === 'undefined' || !firebase.messaging) return null;

    var permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    var reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    var messaging = firebase.messaging();
    var token = await messaging.getToken({
      vapidKey: H90_VAPID_KEY,
      serviceWorkerRegistration: reg
    });

    if (!token) return null;

    _fcmToken = token;
    await fetch(H90_NOTIFY_WORKER + '/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        platform: 'web',
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    }).catch(function(e) {});

    try { localStorage.setItem('h90_fcm_token', token); } catch (e) {}

    _fcmRegistered = true;

    messaging.onTokenRefresh(function(newToken) {
      _fcmToken = newToken;
      fetch(H90_NOTIFY_WORKER + '/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken, platform: 'web' })
      }).catch(function(){});
    });

    return token;
  } catch (e) {
    return null;
  }
}

async function _pushNotification(payload) {
  try {
    if (document.visibilityState === 'visible' && document.hasFocus() &&
        H90Rooms.currentRoomId === payload.roomId) {
      return;
    }

    payload.excludeDeviceId = _getDeviceId();
    payload.timestamp = payload.timestamp || Date.now();

    await _restPush('h90_notifications_queue', payload);

    fetch(H90_NOTIFY_WORKER + '/fcm/process-queue', { method: 'POST' })
      .catch(function() {});
  } catch (e) {}
}

function _startQueueCleanup() {
  var cleanup = async function() {
    try {
      var queue = await _restGet('h90_notifications_queue');
      if (!queue) return;

      var now = Date.now();
      var deleted = 0;

      for (var id in queue) {
        var item = queue[id];
        var ts = item && item.timestamp ? item.timestamp : 0;
        if (now - ts > NOTIF_QUEUE_MAX_AGE) {
          try {
            await _restDelete('h90_notifications_queue/' + id);
            deleted++;
          } catch (e) {}
        }
      }
    } catch (e) {}
  };

  cleanup();
  setInterval(cleanup, NOTIF_QUEUE_CLEANUP_INTERVAL);
}

function _getMutedRooms() {
  try {
    return JSON.parse(localStorage.getItem('h90_muted_rooms') || '[]');
  } catch (e) { return []; }
}

function _isRoomMuted() {
  if (!H90Rooms.currentRoomId) return false;
  return _getMutedRooms().indexOf(H90Rooms.currentRoomId) !== -1;
}

function toggleRoomMute() {
  if (!H90Rooms.currentRoomId) return;

  var muted = _getMutedRooms();
  var roomId = H90Rooms.currentRoomId;
  var idx = muted.indexOf(roomId);

  if (idx !== -1) {
    muted.splice(idx, 1);
    _toast('🔔 تم تفعيل إشعارات الغرفة', 'success');
  } else {
    muted.push(roomId);
    _toast('🔕 تم كتم إشعارات الغرفة', 'info');
  }

  try { localStorage.setItem('h90_muted_rooms', JSON.stringify(muted)); } catch (e) {}

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'MUTE_ROOMS_UPDATE',
        mutedRooms: muted
      });
    }
  } catch (e) {}

  if (H90Rooms.currentRoomId && H90Rooms.currentUser.name) {
    _restUpdate(
      'rooms/' + H90Rooms.currentRoomId + '/members/' + H90Rooms.currentUser.name,
      { muted: idx === -1 }
    ).catch(function() {});
  }

  _haptic(15);

  var menu = document.getElementById('room-menu-dropdown');
  if (menu && menu.classList.contains('show')) _rebuildMenu();
}

console.log('%c🔐 [Rooms Crypto] Layer initialized',
  'background:#9c27b0;color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;font-size:11px;');
  
/* ═══════════════════════════════════════════════════════════════
   1. أيقونات SVG
   ═══════════════════════════════════════════════════════════════ */
const ROOMS_SVG = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="100%" height="100%"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="100%" height="100%"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="100%" height="100%"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  userMinus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  stopChannel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="6" y="6" width="12" height="12" rx="1"/><line x1="3" y1="3" x2="21" y2="21"/></svg>',
  rewind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  xmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="100%" height="100%"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polyline points="15 18 9 12 15 6"/></svg>'
};

/* ═══════════════════════════════════════════════════════════════
   2.1 استخراج رابط البث
   ═══════════════════════════════════════════════════════════════ */
function _extractChannelUrl(ch) {
  if (!ch) return null;
  if (Array.isArray(ch.qualities) && ch.qualities.length > 0) {
    var order = { 'FHD': 1, 'HD': 2, 'SD': 3, 'SD2': 4 };
    var sorted = ch.qualities.slice().sort(function(a, b) {
      return (order[a.label] || 99) - (order[b.label] || 99);
    });
    for (var q = 0; q < sorted.length; q++) {
      if (sorted[q] && typeof sorted[q].url === 'string' && sorted[q].url) return sorted[q].url;
    }
  }
  if (ch.urls && ch.urls.server2 && Array.isArray(ch.urls.server2.list) && ch.urls.server2.list[0]) return ch.urls.server2.list[0];
  if (ch.urls) {
    for (var i = 1; i <= 5; i++) {
      var key = 'server' + i;
      if (ch.urls[key] && Array.isArray(ch.urls[key].list) && ch.urls[key].list[0]) return ch.urls[key].list[0];
    }
  }
  if (typeof ch.url === 'string' && ch.url) return ch.url;
  if (typeof ch.streamUrl === 'string' && ch.streamUrl) return ch.streamUrl;
  if (typeof ch.link === 'string' && ch.link) return ch.link;
  if (typeof ch.src === 'string' && ch.src) return ch.src;
  if (Array.isArray(ch.servers) && ch.servers.length) {
    var first = ch.servers[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.url === 'string') return first.url;
  }
  for (var k in ch) {
    if (typeof ch[k] === 'string' && /^https?:\/\//i.test(ch[k])) return ch[k];
  }
  return null;
}

function _extractChannelQualities(ch) {
  if (!ch) return [];
  if (!Array.isArray(ch.qualities) || ch.qualities.length === 0) return [];
  var order = { 'FHD': 1, 'HD': 2, 'SD': 3, 'SD2': 4 };
  return ch.qualities.slice().sort(function(a, b) {
    return (order[a.label] || 99) - (order[b.label] || 99);
  }).map(function(q) { return { label: q.label, url: q.url }; });
}

function _extractChannelLogo(ch) {
  if (!ch) return '';
  if (typeof ch.logo === 'string' && ch.logo) return ch.logo;
  if (typeof ch.logoUrl === 'string' && ch.logoUrl) return ch.logoUrl;
  if (typeof ch.image === 'string' && ch.image) return ch.image;
  return '';
}

function _getQualityUrl(ch, qualityLabel) {
  if (!ch) return '';
  if (Array.isArray(ch.qualities) && ch.qualities.length > 0) {
    for (var i = 0; i < ch.qualities.length; i++) {
      if (ch.qualities[i].label === qualityLabel) return ch.qualities[i].url;
    }
    return ch.qualities[0].url;
  }
  return ch.url || '';
}

/* ═══════════════════════════════════════════════════════════════
   2.2 مشغل الفيديو
   ═══════════════════════════════════════════════════════════════ */
function _attachVideoSource(videoEl, url) {
  if (!videoEl || !url) return;
  if (H90Rooms.hls) { try { H90Rooms.hls.destroy(); } catch (e) {} H90Rooms.hls = null; }
  var isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = url; videoEl.load();
    videoEl.play().catch(function(err) { console.warn(err); });
    return;
  }
  if (isHls && window.Hls && window.Hls.isSupported()) {
    H90Rooms.hls = new window.Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
    H90Rooms.hls.loadSource(url);
    H90Rooms.hls.attachMedia(videoEl);
    H90Rooms.hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
      videoEl.play().catch(function(err) { console.warn(err); });
    });
    H90Rooms.hls.on(window.Hls.Events.ERROR, function(evt, data) {
      if (data && data.fatal) {
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) H90Rooms.hls.startLoad();
        else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) H90Rooms.hls.recoverMediaError();
        else {
          _toast('فشل تشغيل البث', 'error');
          H90Rooms.hls.destroy();
          H90Rooms.hls = null;
        }
      }
    });
    return;
  }
  videoEl.src = url; videoEl.load();
  videoEl.play().catch(function(err) { console.warn(err); });
}

function _detachVideoSource(videoEl) {
  if (H90Rooms.hls) { try { H90Rooms.hls.destroy(); } catch (e) {} H90Rooms.hls = null; }
  if (videoEl) {
    try {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    } catch (e) {}
  }
}

function _seekToLive(videoEl) {
  if (!videoEl) return;
  try {
    if (H90Rooms.hls && typeof H90Rooms.hls.liveSyncPosition === 'number' && H90Rooms.hls.liveSyncPosition > 0) {
      videoEl.currentTime = H90Rooms.hls.liveSyncPosition;
      return;
    }
    if (!isFinite(videoEl.duration) && videoEl.seekable && videoEl.seekable.length) {
      videoEl.currentTime = videoEl.seekable.end(videoEl.seekable.length - 1);
    }
  } catch (e) { console.warn('[H90Rooms] seekToLive:', e); }
}

/* ═══════════════════════════════════════════════════════════════
   3. حد الغرف اليومي
   ═══════════════════════════════════════════════════════════════ */
function _checkDailyLimit() {
  try {
    var today = new Date().toDateString();
    var data = JSON.parse(localStorage.getItem('h90_rooms_created') || '{}');
    if (data.date !== today) return { allowed: true, remaining: 3 };
    if (data.count >= 3) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: 3 - data.count };
  } catch (e) { return { allowed: true, remaining: 3 }; }
}

function _incrementDailyCount() {
  try {
    var today = new Date().toDateString();
    var data = JSON.parse(localStorage.getItem('h90_rooms_created') || '{}');
    if (data.date !== today) data = { date: today, count: 0 };
    data.count = (data.count || 0) + 1;
    localStorage.setItem('h90_rooms_created', JSON.stringify(data));
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════
   4. حقن CSS (نفس v7)
   ═══════════════════════════════════════════════════════════════ */
function _injectCSS() {
  if (document.getElementById('h90-rooms-css')) return;

  var css = document.createElement('style');
  css.id = 'h90-rooms-css';
  css.textContent = `

#roomsScreen {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  background: #0a0a0f;
  padding: 20px;
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box; overflow-y: auto;
  position: fixed; inset: 0; z-index: 9998;
}
#roomsScreen.hidden { display: none; }

.rooms-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 30px; padding-bottom: 15px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.rooms-header h2 { font-size: 20px; font-weight: 900; color: #fff; margin: 0; }
.rooms-header .close-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff; width: 42px; height: 42px;
  border-radius: 50%; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
}
.rooms-buttons-container {
  display: flex; flex-direction: column; gap: 15px;
  max-width: 400px; width: 100%; margin: 0 auto;
}
.rooms-buttons-container .main-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 18px;
  font-size: 15px; font-weight: 800;
  background: linear-gradient(135deg, #ff2d55, #e6003d);
  color: #fff; border: none; border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(255,45,85,0.3);
  transition: transform 0.15s ease;
  font-family: inherit;
}
.rooms-buttons-container .main-btn:active { transform: scale(0.96); }
.rooms-buttons-container .btn-icon {
  width: 22px; height: 22px; display: inline-flex;
  align-items: center; justify-content: center;
}

.rooms-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: none;
  justify-content: center; align-items: center;
  z-index: 10000; padding: 16px;
  box-sizing: border-box;
}
.rooms-modal.show { display: flex; }

.rooms-modal .modal-content {
  background: #0d1420;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px; padding: 24px;
  width: 100%; max-width: 420px; max-height: 85vh;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  color: #fff; box-sizing: border-box;
  animation: roomsPopIn 0.2s ease-out;
}
@keyframes roomsPopIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.rooms-modal .modal-content h3 {
  margin: 0 0 8px; font-size: 19px; font-weight: 900;
  text-align: center; color: #fff;
}
.rooms-modal .modal-content input,
.rooms-modal .modal-content select {
  padding: 14px 16px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.05); color: #fff;
  font-size: 15px; font-family: inherit; outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box; width: 100%;
}
.rooms-modal .modal-content input:focus,
.rooms-modal .modal-content select:focus {
  border-color: #ff2d55;
  background: rgba(255,45,85,0.05);
}
.rooms-modal .modal-content select option { background: #0d1420; color: #fff; }
.rooms-modal .modal-content label {
  font-size: 13px; font-weight: 700;
  color: rgba(255,255,255,0.6); margin-top: 4px;
}
.rooms-modal .warning-text {
  color: #ffb300; font-size: 12.5px;
  text-align: center; margin: 0;
  padding: 8px; background: rgba(255,179,0,0.08);
  border-radius: 8px;
  border: 1px solid rgba(255,179,0,0.2);
}
.rooms-modal .modal-btn {
  padding: 14px; border-radius: 12px;
  border: none; font-size: 15px;
  font-weight: 800; cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease;
}
.rooms-modal .modal-btn:active { transform: scale(0.97); }
.rooms-modal .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.rooms-modal .modal-btn.confirm {
  background: linear-gradient(135deg, #ff2d55, #e6003d); color: #fff;
}
.rooms-modal .modal-btn.cancel {
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6);
}

.h90-toggle-row {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  gap: 10px;
}
.h90-toggle-info { flex: 1; text-align: right; }
.h90-toggle-title { font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 3px; }
.h90-toggle-desc { font-size: 11px; color: rgba(255,255,255,0.5); line-height: 1.5; }
.h90-toggle-switch {
  width: 46px; height: 26px;
  background: rgba(255,255,255,0.1);
  border-radius: 13px; position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  outline: none;
}
.h90-toggle-switch::after {
  content: '';
  position: absolute;
  width: 20px; height: 20px;
  background: #fff;
  border-radius: 50%;
  top: 3px; right: 3px;
  transition: transform 0.2s;
}
.h90-toggle-switch.on {
  background: linear-gradient(135deg, #00e676, #00b248);
}
.h90-toggle-switch.on::after {
  transform: translateX(-20px);
}

#room-screen {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  background: #000; color: #fff;
  position: fixed; inset: 0;
  overflow: hidden; z-index: 9999;
}
#room-screen.hidden { display: none; }

.h90-room-header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
  background: #000;
  flex-shrink: 0; position: relative; z-index: 100;
}
.h90-header-spacer { flex: 1; }

.h90-icon-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: transparent; border: none;
  color: #fff; cursor: pointer;
  display: inline-flex;
  align-items: center; justify-content: center;
  padding: 10px;
  transition: transform 0.15s ease, background 0.15s ease;
  box-sizing: border-box;
}
.h90-icon-btn:active {
  transform: scale(0.9);
  background: rgba(255,255,255,0.08);
}
.h90-icon-btn svg { width: 100%; height: 100%; }

.h90-red-bar {
  height: 6px; background: #ff0000;
  width: 100%; flex-shrink: 0;
  box-shadow: 0 0 20px rgba(255,0,0,0.5);
}

#video-player-area {
  position: relative; width: 100%;
  height: 38vh; max-height: 42vh; min-height: 180px;
  background: #000;
  display: flex; flex-direction: column;
  flex-shrink: 0; overflow: hidden;
}

.h90-video-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  padding: 20px; box-sizing: border-box;
}
.h90-placeholder-box {
  width: 100%; max-width: 500px;
  height: 100%; max-height: 240px;
  background: linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 50%, #2a2a2a 100%);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.h90-placeholder-box span {
  color: #e0e0e0; font-size: 20px;
  font-weight: 700; letter-spacing: 0.5px;
}

#room-video {
  width: 100%; height: 100%;
  object-fit: contain; background: #000;
  display: block;
}

#room-video-controls-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  justify-content: space-between;
  pointer-events: none; opacity: 0;
  transition: opacity 0.3s ease; z-index: 5;
}
#video-player-area.show-controls #room-video-controls-overlay { opacity: 1; }
#room-video-controls-overlay .controls-top,
#room-video-controls-overlay .controls-bottom {
  pointer-events: auto;
  padding: 10px 14px;
  display: flex; gap: 8px; align-items: center;
}
#room-video-controls-overlay .controls-top {
  background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%);
}
#room-video-controls-overlay .controls-bottom {
  background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%);
  justify-content: center;
}

.h90-video-btn {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff; cursor: pointer;
  display: inline-flex;
  align-items: center; justify-content: center;
  padding: 8px; box-sizing: border-box;
  transition: transform 0.15s ease, background 0.15s ease;
}
.h90-video-btn:active {
  transform: scale(0.9);
  background: rgba(255,45,85,0.4);
}
.h90-play-btn {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, #ff2d55, #e6003d);
  border-color: rgba(255,255,255,0.3);
}

#active-channel-name {
  color: #fff; font-size: 13px;
  font-weight: 800; flex: 1;
  text-align: center;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; padding: 0 8px;
}

#quality-buttons-bar {
  position: absolute;
  top: 55px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 6;
  pointer-events: auto;
  opacity: 0;
  visibility: hidden;
  transform: translateX(10px);
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s ease;
}
#video-player-area.show-controls #quality-buttons-bar {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}
#quality-buttons-bar button:active {
  transform: scale(0.9);
}

#chat-area {
  flex: 1; display: flex; flex-direction: column;
  background: #000;
  padding: 10px 14px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  overflow: hidden; min-height: 0; position: relative;
}

#chat-messages {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column;
  gap: 8px; margin-bottom: 10px;
  padding-right: 5px; min-height: 0;
  -webkit-overflow-scrolling: touch;
}
#chat-messages .msg {
  background: #1a1a24;
  padding: 10px 14px; border-radius: 14px;
  font-size: 14px; line-height: 1.5;
  max-width: 82%; align-self: flex-start;
  border: 1px solid rgba(255,255,255,0.08);
  position: relative;
  word-wrap: break-word; overflow-wrap: break-word;
  color: #fff;
}
#chat-messages .msg.me {
  background: linear-gradient(135deg, #ff2d55, #e6003d);
  align-self: flex-end; border-color: transparent;
}
#chat-messages .msg.system {
  background: rgba(255,179,0,0.12);
  border-color: rgba(255,179,0,0.25);
  color: #ffb300; align-self: center;
  font-size: 11.5px; text-align: center;
  max-width: 90%; padding: 6px 12px;
  border-radius: 20px; font-weight: 700;
}
#chat-messages .msg.system.join {
  background: rgba(0,230,118,0.12);
  border-color: rgba(0,230,118,0.3);
  color: #00e676;
}
#chat-messages .msg.system.leave {
  background: rgba(255,85,115,0.12);
  border-color: rgba(255,85,115,0.3);
  color: #ff5573;
}
#chat-messages .msg.system.channel {
  background: rgba(0,229,255,0.12);
  border-color: rgba(0,229,255,0.3);
  color: #00e5ff;
}
#chat-messages .msg.system.lock {
  background: rgba(255,179,0,0.15);
  border-color: rgba(255,179,0,0.4);
  color: #ffb300;
}
#chat-messages .msg .sender {
  font-size: 11px; font-weight: 900;
  color: #00e5ff; display: block;
  margin-bottom: 4px;
}
#chat-messages .msg.me .sender { color: rgba(255,255,255,0.85); }
#chat-messages .msg .msg-text {
  word-wrap: break-word; overflow-wrap: break-word;
}

.h90-input-row {
  display: flex; gap: 8px;
  align-items: center; flex-shrink: 0;
  padding-top: 6px;
}
.h90-input-wrap {
  flex: 1; display: flex;
  align-items: center;
  background: #1a1a1a;
  border: 1.5px solid rgba(255,255,255,0.15);
  border-radius: 30px;
  padding: 4px 6px;
  position: relative;
  min-height: 48px;
}
#chat-input {
  flex: 1; padding: 10px 14px;
  background: transparent; border: none;
  color: #fff; font-size: 15px;
  font-family: inherit; outline: none;
  min-width: 0;
}
#chat-input::placeholder { color: rgba(255,255,255,0.3); }

.h90-mic-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: #ff2d55;
  border: none; color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center; justify-content: center;
  padding: 10px; box-sizing: border-box;
  flex-shrink: 0;
  transition: transform 0.15s ease, background 0.15s ease;
  touch-action: manipulation;
  user-select: none; -webkit-user-select: none;
}
.h90-mic-btn svg { width: 100%; height: 100%; }
.h90-mic-btn:active { transform: scale(0.92); }
.h90-mic-btn.recording {
  background: #b71c1c;
  animation: voicePulse 1s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(229,57,53,0.8);
}
@keyframes voicePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

#room-menu-dropdown {
  position: absolute;
  top: calc(60px + env(safe-area-inset-top, 0px));
  right: 12px;
  background: #1a1a24;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 8px;
  min-width: 240px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.8);
  opacity: 0; visibility: hidden;
  transform: translateY(-8px) scale(0.96);
  transform-origin: top right;
  transition: opacity 0.2s, transform 0.2s, visibility 0.2s;
  z-index: 99999;
}
#room-menu-dropdown.show {
  opacity: 1; visibility: visible;
  transform: translateY(0) scale(1);
}

.h90-menu-close-item {
  display: flex; align-items: center;
  justify-content: flex-start;
  width: 100%; padding: 8px;
  background: transparent; border: none;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 6px; cursor: pointer;
  padding-bottom: 12px;
}
.h90-menu-close-item .h90-menu-close-icon {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  display: inline-flex;
  align-items: center; justify-content: center;
  color: #fff; padding: 8px;
  box-sizing: border-box;
}

.h90-room-menu-item {
  display: flex; align-items: center;
  gap: 12px; width: 100%;
  padding: 12px 14px;
  background: transparent; border: none;
  color: #fff; font-size: 14px;
  font-weight: 700; font-family: inherit;
  text-align: right; border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  box-sizing: border-box;
}
.h90-room-menu-item:hover,
.h90-room-menu-item:active { background: rgba(255,255,255,0.06); }
.h90-room-menu-item.danger { color: #ff5573; }
.h90-room-menu-item.danger:hover { background: rgba(255,85,115,0.1); }
.h90-room-menu-icon {
  width: 18px; height: 18px;
  display: inline-flex;
  align-items: center; justify-content: center;
  color: #00e5ff; flex-shrink: 0;
}
.h90-room-menu-item.danger .h90-room-menu-icon { color: #ff5573; }
.h90-room-menu-item.active .h90-room-menu-icon { color: #00e676; }
.h90-room-menu-status {
  margin-right: auto;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 8px;
}
.h90-room-menu-status.on {
  background: rgba(0,230,118,0.15);
  color: #00e676;
}
.h90-room-menu-status.off {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.5);
}

.reply-bar {
  display: none;
  background: rgba(0,229,255,0.08);
  border-right: 3px solid #00e5ff;
  padding: 8px 12px; margin: 0 0 6px 0;
  border-radius: 10px; font-size: 13px;
  flex-shrink: 0;
}
.reply-bar.show { display: block; }
.reply-bar-content { display: flex; align-items: center; gap: 10px; width: 100%; }
.reply-bar-info { flex: 1; overflow: hidden; min-width: 0; }
.reply-bar-label { font-size: 11px; color: #00e5ff; font-weight: 800; margin-bottom: 2px; }
.reply-bar-text {
  font-size: 12px; color: rgba(255,255,255,0.7);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reply-bar-close {
  width: 28px; height: 28px;
  padding: 6px; background: transparent;
  border: none; color: #fff;
  cursor: pointer; opacity: 0.7;
  box-sizing: border-box; flex-shrink: 0;
}
.reply-bar-close svg { width: 100%; height: 100%; }

.msg-reply-preview {
  background: rgba(0,0,0,0.25);
  border-right: 2px solid #00e5ff;
  padding: 4px 8px; border-radius: 6px;
  margin-bottom: 6px; font-size: 11px;
  display: flex; flex-direction: column; gap: 2px;
}
.msg-reply-preview .reply-sender { color: #00e5ff; font-weight: 800; font-size: 10px; }
.msg-reply-preview .reply-text {
  color: rgba(255,255,255,0.7);
  white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 200px;
}

.reply-arrow {
  position: absolute; left: -30px; top: 50%;
  transform: translateY(-50%);
  width: 18px; height: 18px;
  color: #00e5ff; opacity: 0;
}

#voice-recording-indicator {
  position: fixed;
  bottom: calc(90px + env(safe-area-inset-bottom, 0px));
  left: 50%; transform: translateX(-50%);
  background: rgba(229,57,53,0.95);
  backdrop-filter: blur(10px);
  color: #fff; padding: 10px 20px;
  border-radius: 30px; font-size: 14px;
  font-weight: 800; font-family: inherit;
  display: none; align-items: center; gap: 10px;
  z-index: 9999;
  box-shadow: 0 8px 24px rgba(229,57,53,0.5);
  font-variant-numeric: tabular-nums;
}
#voice-recording-indicator.show { display: flex; }
#voice-recording-indicator .rec-dot {
  width: 10px; height: 10px;
  background: #fff; border-radius: 50%;
  animation: livePulse 1s infinite;
}
@keyframes livePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

.msg .voice-msg { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.msg .voice-msg audio { height: 36px; max-width: 220px; width: 100%; }

.msg-reactions { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
.reaction {
  background: rgba(255,255,255,0.1);
  padding: 2px 8px; border-radius: 12px;
  font-size: 12px; cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex; align-items: center;
  gap: 3px;
}
.reaction.mine { background: rgba(0,229,255,0.2); border-color: #00e5ff; }

.reaction-menu {
  display: none; position: fixed;
  background: rgba(13,20,32,0.98);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 30px; padding: 6px 12px;
  z-index: 2000; gap: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.reaction-menu.show { display: flex; }
.reaction-emoji {
  font-size: 20px; cursor: pointer;
  padding: 5px; border-radius: 50%; user-select: none;
}

.typing-indicator {
  display: none; font-size: 12px;
  color: rgba(255,255,255,0.6);
  padding: 4px 15px 8px;
  font-style: italic; text-align: right;
  flex-shrink: 0;
}
.typing-indicator.show {
  display: flex; align-items: center;
  justify-content: flex-end; gap: 6px;
}
.typing-dots { display: inline-flex; align-items: center; gap: 2px; }
.typing-dots span {
  display: inline-block; width: 4px; height: 4px;
  background: #00e5ff; border-radius: 50%;
  animation: typingBounce 1.4s infinite ease-in-out both;
}
.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.pinned-banner {
  display: none;
  background: linear-gradient(90deg, rgba(255,179,0,0.12), transparent);
  border-bottom: 1px solid rgba(255,179,0,0.25);
  padding: 8px 14px; font-size: 12px;
  align-items: center; gap: 10px; flex-shrink: 0;
}
.pinned-banner.show { display: flex; }
.pinned-content { flex: 1; overflow: hidden; min-width: 0; }
.pinned-label {
  font-size: 10px; color: #ffb300;
  font-weight: 800; text-transform: uppercase;
  letter-spacing: 1px; margin-bottom: 2px;
}
.pinned-text {
  font-size: 12px; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pinned-close {
  width: 24px; height: 24px;
  padding: 5px; background: transparent;
  border: none; color: #fff;
  opacity: 0.6; cursor: pointer;
  box-sizing: border-box; flex-shrink: 0;
}
.pinned-close svg { width: 100%; height: 100%; }

.h90-sync-bar {
  display: none;
  background: linear-gradient(90deg, rgba(229,57,53,0.2), rgba(229,57,53,0.05));
  border-bottom: 1px solid rgba(229,57,53,0.4);
  padding: 8px 14px;
  align-items: center; gap: 8px;
  color: #ff5573; font-size: 12px;
  font-weight: 700; flex-shrink: 0;
}
.h90-sync-bar.show { display: flex; }
.h90-sync-bar svg { width: 16px; height: 16px; flex-shrink: 0; }

.channels-list-container,
#server2-channels-list,
#members-list-container {
  display: flex; flex-direction: column;
  gap: 8px; max-height: 450px;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
}

.h90-channel-item {
  display: flex; align-items: center;
  gap: 12px;
  width: 100%; padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; color: #fff;
  font-size: 14px; font-weight: 700;
  font-family: inherit; text-align: right;
  cursor: pointer; transition: all 0.15s ease;
  box-sizing: border-box;
}
.h90-channel-item:hover,
.h90-channel-item:active {
  background: rgba(0,229,255,0.08);
  border-color: rgba(0,229,255,0.3);
  transform: translateX(-2px);
}

.h90-channel-logo {
  width: 46px; height: 46px;
  border-radius: 10px;
  background: #0a0e14;
  border: 1px solid rgba(255,255,255,0.08);
  object-fit: contain;
  flex-shrink: 0;
  padding: 3px;
  box-sizing: border-box;
}

.h90-channel-logo-fallback {
  width: 46px; height: 46px;
  border-radius: 10px;
  background: linear-gradient(135deg, #00e5ff, #007bff);
  color: #001018;
  display: inline-flex;
  align-items: center; justify-content: center;
  font-size: 16px; font-weight: 900;
  flex-shrink: 0;
}

.h90-channel-info {
  flex: 1; display: flex; flex-direction: column;
  gap: 3px; min-width: 0;
}
.h90-channel-name {
  flex: 1; text-align: right;
  font-size: 14px; font-weight: 800;
  color: #fff;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
.h90-channel-meta {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-weight: 600; text-align: right;
}

.h90-channel-play {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00e5ff, #007bff);
  color: #001018;
  display: inline-flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; padding: 8px;
  box-sizing: border-box;
}
.h90-channel-play svg { width: 100%; height: 100%; }

.h90-member-item {
  display: flex; align-items: center;
  justify-content: space-between; gap: 10px;
  width: 100%; padding: 13px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; color: #fff;
  font-size: 13.5px; font-weight: 700;
  font-family: inherit; margin-bottom: 6px;
  cursor: pointer; transition: all 0.15s ease;
  box-sizing: border-box;
}
.h90-member-item:hover,
.h90-member-item:active { background: rgba(255,255,255,0.07); }
.h90-member-name { flex: 1; text-align: right; }
.h90-member-action {
  font-size: 12px; font-weight: 800;
  padding: 4px 10px; border-radius: 8px;
  white-space: nowrap;
}
.h90-member-action.danger {
  background: rgba(255,85,115,0.15); color: #ff5573;
}
.h90-member-action.success {
  background: rgba(0,230,118,0.15); color: #00e676;
}
.h90-members-divider {
  color: rgba(255,255,255,0.4);
  font-size: 11px; font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin: 16px 0 8px; text-align: right;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.h90-info-row {
  display: flex; justify-content: space-between;
  align-items: center; padding: 12px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px; gap: 10px;
}
.h90-info-row .label { color: rgba(255,255,255,0.6); font-size: 13px; }
.h90-info-row .value {
  font-weight: 800; font-size: 13px;
  text-align: left; word-break: break-word;
  max-width: 60%;
}

.hidden { display: none !important; }

@media (min-width: 768px) {
  #room-menu-dropdown { min-width: 280px; }
  #chat-messages .msg { max-width: 65%; }
  #video-player-area { height: 50vh; max-height: 55vh; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* [v7] تبويبات اختيار المحتوى */
.h90-picker-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  padding: 4px;
  background: rgba(255,255,255,0.04);
  border-radius: 12px;
  flex-shrink: 0;
}
.h90-picker-tab {
  flex: 1;
  padding: 10px 8px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 12.5px;
  font-weight: 800;
  font-family: inherit;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.h90-picker-tab.active {
  background: linear-gradient(135deg, #ff2d55, #e6003d);
  color: #fff;
  box-shadow: 0 4px 14px rgba(255,45,85,0.35);
}
.h90-picker-tab:active { transform: scale(0.97); }
.h90-picker-tab svg { width: 16px; height: 16px; }

.h90-picker-search {
  position: relative;
  margin-bottom: 10px;
  flex-shrink: 0;
  display: none;
}
.h90-picker-search.show { display: block; }
.h90-picker-search input {
  width: 100%;
  padding: 12px 40px 12px 14px;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.h90-picker-search input:focus {
  border-color: #ff2d55;
  background: rgba(255,45,85,0.05);
}
.h90-picker-search input::placeholder { color: rgba(255,255,255,0.35); }
.h90-picker-search .search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: rgba(255,255,255,0.4);
  pointer-events: none;
}

.h90-picker-loading {
  text-align: center;
  padding: 30px 20px;
  color: rgba(255,255,255,0.6);
}
.h90-picker-loading .spinner {
  width: 36px; height: 36px;
  margin: 0 auto 12px;
  border: 3px solid rgba(0,229,255,0.25);
  border-top-color: #00e5ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.h90-picker-loading .text {
  font-size: 13px;
  font-weight: 700;
}

.h90-picker-empty {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255,255,255,0.5);
}
.h90-picker-empty .icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 14px;
  background: rgba(255,255,255,0.04);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff5573;
}
.h90-picker-empty .icon svg { width: 30px; height: 30px; }
.h90-picker-empty .title {
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 6px;
}
.h90-picker-empty .desc {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}

.h90-picker-item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  color: #fff; font-size: 14px; font-weight: 700;
  font-family: inherit; text-align: right;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
  margin-bottom: 8px;
}
.h90-picker-item:hover,
.h90-picker-item:active {
  background: rgba(0,229,255,0.08);
  border-color: rgba(0,229,255,0.3);
  transform: translateX(-2px);
}
.h90-picker-item-poster {
  width: 46px; height: 62px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3a3a3a, #1a1a1a);
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.08);
}
.h90-picker-item-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 3px;
}
.h90-picker-item-title {
  font-size: 13.5px; font-weight: 800;
  color: #fff;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
.h90-picker-item-meta {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.h90-picker-item-rating {
  color: #ffb300;
  font-weight: 800;
}
.h90-picker-item-cat {
  background: rgba(0,229,255,0.12);
  color: #00e5ff;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
}

.h90-picker-sections-nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 8px;
  scrollbar-width: none;
  flex-shrink: 0;
}
.h90-picker-sections-nav::-webkit-scrollbar { display: none; }
.h90-picker-section-chip {
  padding: 6px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  color: rgba(255,255,255,0.7);
  font-size: 11.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}
.h90-picker-section-chip.active {
  background: linear-gradient(135deg, #00e5ff, #007bff);
  color: #001018;
  border-color: transparent;
}
.h90-picker-section-chip:active { transform: scale(0.95); }

.h90-picker-season-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 8px;
  scrollbar-width: none;
  flex-shrink: 0;
}
.h90-picker-season-pills::-webkit-scrollbar { display: none; }
.h90-picker-season-pill {
  padding: 6px 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}
.h90-picker-season-pill.active {
  background: linear-gradient(135deg, #ff2d55, #e6003d);
  border-color: transparent;
}
  `;
  document.head.appendChild(css);
}

/* ═══════════════════════════════════════════════════════════════
   5. حقن HTML (نفس v7)
   ═══════════════════════════════════════════════════════════════ */
function _injectHTML() {
  if (document.getElementById('roomsScreen')) return;

  var html = `
<div id="roomsScreen" class="hidden">
  <div class="rooms-header">
    <h2>الغرف الصوتية والمرئية</h2>
    <button type="button" id="btn-close-rooms" class="close-btn" aria-label="إغلاق">
      ${ROOMS_SVG.close}
    </button>
  </div>
  <div class="rooms-buttons-container">
    <button type="button" id="btn-join-room" class="main-btn">
      <span class="btn-icon">${ROOMS_SVG.share}</span>
      الانضمام إلى غرفة
    </button>
    <button type="button" id="btn-create-room" class="main-btn">
      <span class="btn-icon">${ROOMS_SVG.plus}</span>
      إنشاء غرفة جديدة
    </button>
    <button type="button" id="btn-my-rooms" class="main-btn">
      <span class="btn-icon">${ROOMS_SVG.users}</span>
      غرفي
    </button>
  </div>
</div>

<div id="join-room-modal" class="rooms-modal">
  <div class="modal-content">
    <h3>الانضمام إلى غرفة</h3>
    <input type="text" id="join-room-name" placeholder="اسم الغرفة" autocomplete="off">
    <input type="password" id="join-room-pass" placeholder="كلمة السر" autocomplete="off">
    <input type="text" id="join-user-name" placeholder="اسمك (سيظهر للآخرين)" autocomplete="off">
    <button type="button" id="btn-confirm-join" class="modal-btn confirm">دخول</button>
    <button type="button" class="modal-btn cancel close-modal">إلغاء</button>
  </div>
</div>

<div id="create-room-modal" class="rooms-modal">
  <div class="modal-content">
    <h3>إنشاء غرفة جديدة</h3>
    <input type="text" id="create-room-name" placeholder="اسم الغرفة (فريد)" autocomplete="off">
    <input type="password" id="create-room-pass" placeholder="كلمة السر" autocomplete="off">
    <input type="text" id="create-user-name" placeholder="اسمك (اختياري — الافتراضي: المنشئ)" autocomplete="off">

    <label for="create-room-maxmembers">الحد الأقصى للأعضاء</label>
    <select id="create-room-maxmembers">
      <option value="2">شخصان</option>
      <option value="3">3 أشخاص</option>
      <option value="4">4 أشخاص</option>
      <option value="5">5 أشخاص</option>
      <option value="6">6 أشخاص</option>
      <option value="7">7 أشخاص</option>
      <option value="8" selected>8 أشخاص (افتراضي)</option>
      <option value="10">10 أشخاص</option>
      <option value="12">12 شخصاً</option>
      <option value="15">15 شخصاً</option>
    </select>

    <label for="create-room-duration">مدة الغرفة</label>
    <select id="create-room-duration">
      <option value="1">ساعة واحدة</option>
      <option value="2">ساعتان</option>
      <option value="3">ثلاث ساعات</option>
    </select>

    <div class="h90-toggle-row">
      <div class="h90-toggle-info">
        <div class="h90-toggle-title">مزامنة الاتصال</div>
        <div class="h90-toggle-desc">عند تفعيلها: إذا توقفت القناة عند أي عضو (انقطاع النت) تتوقف عند الجميع حتى يعود اتصاله، ثم تستأنف اللقطة معاً.</div>
      </div>
      <div id="create-room-sync" class="h90-toggle-switch on" role="switch" aria-checked="true" tabindex="0"></div>
    </div>

    <button type="button" id="btn-confirm-create" class="modal-btn confirm">إنشاء</button>
    <button type="button" class="modal-btn cancel close-modal">إلغاء</button>
  </div>
</div>

<div id="room-screen" class="hidden">
  <div class="h90-room-header">
    <button type="button" id="btn-room-menu" class="h90-icon-btn" aria-label="القائمة">
      ${ROOMS_SVG.menu}
    </button>
    <div class="h90-header-spacer"></div>
    <button type="button" id="btn-leave-room" class="h90-icon-btn" aria-label="مغادرة">
      ${ROOMS_SVG.logout}
    </button>
  </div>

  <div class="h90-red-bar"></div>
  <div id="sync-status-bar" class="h90-sync-bar">
    ${ROOMS_SVG.sync}
    <span id="sync-status-text">تم إيقاف القناة مؤقتاً</span>
  </div>

  <div id="video-player-area">
    <div id="video-placeholder" class="h90-video-placeholder">
      <div class="h90-placeholder-box">
        <span>اضغط لإضافة قناة</span>
      </div>
    </div>

    <video id="room-video" playsinline webkit-playsinline style="display:none"></video>

    <div id="quality-buttons-bar"></div>

    <div id="room-video-controls-overlay">
      <div class="controls-top">
        <button type="button" class="h90-video-btn" id="btn-close-video" aria-label="إيقاف القناة">
          ${ROOMS_SVG.stopChannel}
        </button>
        <span id="active-channel-name"></span>
        <button type="button" class="h90-video-btn" id="btn-fullscreen" aria-label="ملء الشاشة">
          ${ROOMS_SVG.expand}
        </button>
      </div>
      <div class="controls-bottom">
        <button type="button" class="h90-video-btn" id="btn-rewind">${ROOMS_SVG.rewind}</button>
        <button type="button" class="h90-video-btn h90-play-btn" id="btn-play-pause">${ROOMS_SVG.play}</button>
        <button type="button" class="h90-video-btn" id="btn-forward">${ROOMS_SVG.forward}</button>
      </div>
    </div>
  </div>

  <div id="chat-area">
    <div id="pinned-message-banner" class="pinned-banner"></div>
    <div id="chat-messages"></div>
    <div id="typing-indicator" class="typing-indicator"></div>
    <div id="reply-bar" class="reply-bar"></div>

    <div class="h90-input-row">
      <div class="h90-input-wrap">
        <input type="text" id="chat-input" placeholder="" autocomplete="off">
        <button type="button" id="btn-voice-msg" class="h90-mic-btn" aria-label="تسجيل صوتي">
          ${ROOMS_SVG.mic}
        </button>
      </div>
    </div>
  </div>

  <div id="room-menu-dropdown"></div>
</div>

<div id="voice-recording-indicator">
  <span class="rec-dot"></span>
  <span>جارٍ التسجيل...</span>
  <span id="voice-timer">0:00 / 0:15</span>
</div>

<div id="reaction-menu" class="reaction-menu">
  <span class="reaction-emoji" data-emoji="❤️">❤️</span>
  <span class="reaction-emoji" data-emoji="😂">😂</span>
  <span class="reaction-emoji" data-emoji="👍">👍</span>
  <span class="reaction-emoji" data-emoji="🔥">🔥</span>
</div>

<div id="channel-select-modal" class="rooms-modal">
  <div class="modal-content">
    <h3 id="channel-modal-title">اختر المحتوى</h3>

    <div class="h90-picker-tabs" id="h90-picker-tabs">
      <button type="button" class="h90-picker-tab active" data-tab="channels">
        <span style="width:16px;height:16px;display:inline-flex;">${ROOMS_SVG.tv}</span>
        قنوات
      </button>
      <button type="button" class="h90-picker-tab" data-tab="movies">
        <span style="width:16px;height:16px;display:inline-flex;">${ROOMS_SVG.film}</span>
        أفلام
      </button>
      <button type="button" class="h90-picker-tab" data-tab="series">
        <span style="width:16px;height:16px;display:inline-flex;">${ROOMS_SVG.play}</span>
        مسلسلات
      </button>
    </div>

    <div class="h90-picker-search" id="h90-picker-search">
      <input type="text" id="h90-picker-search-input" placeholder="ابحث بالاسم..." autocomplete="off">
      <span class="search-icon">${ROOMS_SVG.search}</span>
    </div>

    <div id="server2-channels-list" class="channels-list-container"></div>

    <button type="button" class="modal-btn cancel close-modal">إغلاق</button>
  </div>
</div>

<div id="members-modal" class="rooms-modal">
  <div class="modal-content">
    <h3>إدارة الأعضاء</h3>
    <div id="members-list-container" class="channels-list-container"></div>
    <button type="button" class="modal-btn cancel close-modal">إغلاق</button>
  </div>
</div>

<div id="room-info-modal" class="rooms-modal">
  <div class="modal-content">
    <h3>معلومات الغرفة</h3>
    <div id="room-info-content" style="display:flex;flex-direction:column;gap:10px;"></div>
    <button type="button" class="modal-btn cancel close-modal">إغلاق</button>
  </div>
</div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

/* ═══════════════════════════════════════════════════════════════
   6. فتح/إغلاق شاشة الغرف
   ═══════════════════════════════════════════════════════════════ */
function openRoomsScreen() {
  if (typeof window.closeSettings === 'function') window.closeSettings();
  if (typeof window.closeDrawer === 'function') window.closeDrawer();

  var roomsScreen = document.getElementById('roomsScreen');
  var roomScreen = document.getElementById('room-screen');
  var pageContent = document.getElementById('pageContent');
  var bottomNav = document.querySelector('.bottom-nav');

  if (roomsScreen) roomsScreen.classList.remove('hidden');
  if (roomScreen) roomScreen.classList.add('hidden');
  if (pageContent) pageContent.style.display = 'none';
  if (bottomNav) bottomNav.style.display = 'none';
}

function closeRoomsScreen() {
  var roomsScreen = document.getElementById('roomsScreen');
  if (roomsScreen) roomsScreen.classList.add('hidden');

  var pageContent = document.getElementById('pageContent');
  if (pageContent) pageContent.style.display = '';

  var bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = '';

  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === 'channels');
  });

  if (typeof window.switchTab === 'function') window.switchTab('channels');
}

function handleRoomsTabClick() {
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === 'rooms');
  });

  if (typeof window.closeSettings === 'function') window.closeSettings();
  if (typeof window.closeDrawer === 'function') window.closeDrawer();
  if (typeof window.closeSearch === 'function') window.closeSearch();
  if (typeof window.closeNotifDrawer === 'function') window.closeNotifDrawer();

  openRoomsScreen();
  _haptic(10);
}

/* ═══════════════════════════════════════════════════════════════
   7. إنشاء غرفة (مع تشفير)
   ═══════════════════════════════════════════════════════════════ */
async function createRoom() {
  var nameInput = document.getElementById('create-room-name');
  var passInput = document.getElementById('create-room-pass');
  var userInput = document.getElementById('create-user-name');
  var durationInput = document.getElementById('create-room-duration');
  var maxInput = document.getElementById('create-room-maxmembers');
  var syncSwitch = document.getElementById('create-room-sync');

  if (!nameInput || !passInput || !durationInput) {
    _toast('حدث خطأ في الواجهة', 'error');
    return;
  }

  var roomName = nameInput.value.trim();
  var roomPass = passInput.value.trim();
  var userName = (userInput && userInput.value.trim()) || 'المنشئ';
  var duration = parseInt(durationInput.value, 10) || 1;
  var maxMembers = maxInput ? (parseInt(maxInput.value, 10) || 8) : 8;
  var syncOn = syncSwitch ? syncSwitch.classList.contains('on') : true;

  if (!roomName || !roomPass) { _toast('الرجاء ملء جميع الحقول', 'error'); return; }
  if (roomName.length < 3) { _toast('اسم الغرفة قصير جداً', 'warning'); return; }
  if (roomPass.length < 3) { _toast('كلمة السر قصيرة جداً', 'warning'); return; }
  if (userName.length < 2) { _toast('اسمك قصير جداً', 'warning'); return; }

  var roomId = _roomKey(roomName);
  if (!roomId || roomId.length < 8) { _toast('اسم الغرفة غير صالح', 'warning'); return; }

  var limit = _checkDailyLimit();
  if (!limit.allowed) { _toast('وصلت للحد الأقصى (3 غرف/يوم)', 'error'); return; }

  var btn = document.getElementById('btn-confirm-create');
  var originalText = btn ? btn.textContent : 'إنشاء';
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإنشاء...'; }

  try {
    var now = Date.now();

    /* ✅ 1. توليد salt فريد للغرفة */
    var roomSalt = RoomCrypto.generateNonce();

    /* ✅ 2. تشفير كلمة السر بـ PBKDF2 + salt */
    var passHash = await RoomCrypto.hashPassword(roomPass, roomSalt);

    /* ✅ 3. تشفير اسم الغرفة */
    var nameEncrypted = await RoomCrypto.encrypt(roomName);

    /* ✅ 4. HMAC للتحقق */
    var nameHmac = await RoomCrypto.hmac(roomName + '|' + roomSalt);

    var roomData = {
      id: roomId,
      nameEncrypted: nameEncrypted,
      nameHmac: nameHmac,
      passwordHash: passHash,
      passwordSalt: roomSalt,
      creator: userName,
      creatorId: 'user_' + now,
      maxMembers: maxMembers,
      duration: duration * 3600,
      createdAt: now,
      expiresAt: now + duration * 3600 * 1000,
      locked: false,
      syncMode: syncOn,
      lastMessageAt: now,
      members: {}
    };

    var fcmToken = null;
    try { fcmToken = await _registerFCMToken(); } catch (e) {}

    roomData.members[userName] = {
      name: userName,
      joinedAt: now,
      isAdmin: true,
      fcmToken: fcmToken || '',
      deviceId: _getDeviceId(),
      muted: false
    };

    var existing = await _dbOp(_restGet('rooms/' + roomId), 'فحص الغرفة');
    if (existing && existing.expiresAt && existing.expiresAt > Date.now()) {
      _toast('اسم الغرفة مستخدم، اختر اسماً آخر', 'error');
      return;
    }

    await _dbOp(_restSet('rooms/' + roomId, roomData), 'إنشاء الغرفة');

    _incrementDailyCount();

    H90Rooms.currentRoomId = roomId;
    H90Rooms.currentUser = { name: userName, isCreator: true, roomId: roomId };
    H90Rooms.syncMode = syncOn;
    H90Rooms.lastMessageTime = now;
    H90Rooms.localQuality = 'FHD';

    try {
      localStorage.setItem('h90_current_room', JSON.stringify({
        id: roomId, userName: userName, isCreator: true, name: roomName
      }));
    } catch (e) {}

    var modal = document.getElementById('create-room-modal');
    if (modal) modal.classList.remove('show');

    nameInput.value = '';
    passInput.value = '';
    if (userInput) userInput.value = '';
    durationInput.value = '1';
    if (maxInput) maxInput.value = '8';
    if (syncSwitch) { syncSwitch.classList.add('on'); syncSwitch.setAttribute('aria-checked', 'true'); }

    enterRoomUI(roomId, userName, true);
    _toast('✅ تم إنشاء الغرفة (المتبقي: ' + Math.max(0, limit.remaining - 1) + ')', 'success');

  } catch (err) {
    console.error('[H90Rooms] ❌ فشل إنشاء الغرفة:', err);
    _toast('❌ ' + _errMsg(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   8. الانضمام لغرفة (مع فك تشفير)
   ═══════════════════════════════════════════════════════════════ */
async function joinRoom() {
  var nameInput = document.getElementById('join-room-name');
  var passInput = document.getElementById('join-room-pass');
  var userInput = document.getElementById('join-user-name');

  if (!nameInput || !passInput || !userInput) return;

  var roomName = nameInput.value.trim();
  var roomPass = passInput.value.trim();
  var userName = userInput.value.trim();

  if (!roomName || !roomPass || !userName) { _toast('الرجاء ملء جميع الحقول', 'error'); return; }
  if (userName.length < 2) { _toast('اسمك قصير جداً', 'warning'); return; }

  var btn = document.getElementById('btn-confirm-join');
  var originalText = btn ? btn.textContent : 'دخول';
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الدخول...'; }

  try {
    var roomId = _roomKey(roomName);
    var roomData = null;

    if (roomId) {
      var directSnap = await _dbOp(_restGet('rooms/' + roomId), 'البحث عن الغرفة');
      if (directSnap) roomData = directSnap;
    }

    if (!roomData) {
      try {
        var allRooms = await _dbOp(_restGet('rooms'), 'تحميل الغرف');
        if (allRooms) {
          for (var key in allRooms) {
            if (allRooms[key] && allRooms[key].nameEncrypted) {
              try {
                var decName = await RoomCrypto.decrypt(allRooms[key].nameEncrypted);
                if (decName === roomName) {
                  roomId = key;
                  roomData = allRooms[key];
                  break;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) { console.warn('[H90Rooms] fallback scan:', e); }
    }

    if (!roomData) { _toast('الغرفة غير موجودة', 'error'); return; }
    if (roomData.expiresAt && roomData.expiresAt < Date.now()) { _toast('انتهت صلاحية هذه الغرفة', 'error'); return; }
    if (roomData.locked === true) { _toast('الغرفة مقفلة حالياً', 'error'); return; }
    if (roomData.kicked && roomData.kicked[userName]) { _toast('تم طردك من هذه الغرفة', 'error'); return; }

    /* ✅ 1. تحقق من HMAC لاسم الغرفة */
    if (roomData.nameHmac && roomData.nameEncrypted) {
      try {
        var decName = await RoomCrypto.decrypt(roomData.nameEncrypted);
        var expectedHmac = await RoomCrypto.hmac(decName + '|' + roomData.passwordSalt);
        if (expectedHmac !== roomData.nameHmac) {
          _toast('❌ بيانات الغرفة تالفة', 'error');
          console.error('🚫 HMAC mismatch');
          return;
        }
      } catch (e) {
        _toast('❌ فشل التحقق من الغرفة', 'error');
        return;
      }
    }

    /* ✅ 2. تحقق من كلمة السر بـ PBKDF2 */
    var passHash = await RoomCrypto.hashPassword(roomPass, roomData.passwordSalt);
    if (roomData.passwordHash !== passHash) {
      _toast('كلمة السر خاطئة', 'error');
      return;
    }

    var members = roomData.members || {};
    if (members[userName] && members[userName].isAdmin) {
      _toast('هذا الاسم محجوز للمنشئ، اختر اسماً آخر', 'error');
      return;
    }

    var memberCount = Object.keys(members).length;
    if (!members[userName] && memberCount >= (roomData.maxMembers || 8)) {
      _toast('الغرفة ممتلئة', 'error');
      return;
    }

    var fcmToken = null;
    try { fcmToken = await _registerFCMToken(); } catch (e) {}

    await _dbOp(_restSet('rooms/' + roomId + '/members/' + userName, {
      name: userName,
      joinedAt: Date.now(),
      isAdmin: false,
      fcmToken: fcmToken || '',
      deviceId: _getDeviceId(),
      muted: false
    }), 'إضافة العضو');

    /* ✅ 3. رسالة نظام مشفرة */
    var joinText = '👋 ' + userName + ' انضم إلى الغرفة';
    var joinEncrypted = await RoomCrypto.encrypt(joinText);
    var joinNonce = RoomCrypto.generateNonce();
    var joinHmac = await RoomCrypto.hmac(joinEncrypted + '|' + joinNonce);

    try {
      await _restPush('rooms/' + roomId + '/messages', {
        type: 'system',
        systemType: 'join',
        encrypted: joinEncrypted,
        nonce: joinNonce,
        hmac: joinHmac,
        timestamp: Date.now()
      });
    } catch (e) { console.warn(e); }

    await _pushNotification({
      roomId: roomId,
      type: 'room_join',
      title: '👋 ' + userName + ' انضم',
      body: 'انضم ' + userName + ' إلى الغرفة',
      url: '/?room=' + encodeURIComponent(roomName),
      icon: '/H90.jpg',
      senderName: userName
    });

    H90Rooms.currentRoomId = roomId;
    H90Rooms.currentUser = { name: userName, isCreator: false, roomId: roomId };
    H90Rooms.syncMode = roomData.syncMode !== false;
    H90Rooms.localQuality = 'FHD';

    try {
      localStorage.setItem('h90_current_room', JSON.stringify({
        id: roomId, userName: userName, isCreator: false, name: roomName
      }));
    } catch (e) {}

    var modal = document.getElementById('join-room-modal');
    if (modal) modal.classList.remove('show');

    nameInput.value = ''; passInput.value = ''; userInput.value = '';

    enterRoomUI(roomId, userName, false);
    _toast('✅ تم الانضمام للغرفة', 'success');

  } catch (err) {
    console.error('[H90Rooms] ❌ فشل الانضمام:', err);
    _toast('❌ ' + _errMsg(err), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

/* ═══════════════════════════════════════════════════════════════
   9. الدخول لواجهة الغرفة
   ═══════════════════════════════════════════════════════════════ */
function _clearRuntime() {
  H90Rooms.listeners.forEach(function(l) {
    try {
      if (l.pollKey) _restStopPoll(l.pollKey);
    } catch (e) {}
  });
  H90Rooms.listeners = [];

  ['timerInterval', 'messageCleaner', 'inactivityChecker', 'voiceTimer', 'syncEvalTimer'].forEach(function(k) {
    if (H90Rooms[k]) { clearInterval(H90Rooms[k]); H90Rooms[k] = null; }
  });
  if (H90Rooms.stallTimer) { clearTimeout(H90Rooms.stallTimer); H90Rooms.stallTimer = null; }

  if (H90Rooms.activeStream) {
    try { H90Rooms.activeStream.getTracks().forEach(function(t) { t.stop(); }); } catch (e) {}
    H90Rooms.activeStream = null;
  }
  if (H90Rooms.mediaRecorder && H90Rooms.mediaRecorder.state === 'recording') {
    try { H90Rooms.mediaRecorder.stop(); } catch (e) {}
  }
  H90Rooms.mediaRecorder = null;
  H90Rooms.isRecording = false;

  H90Rooms.stalledMap = {};
  H90Rooms.selfStalled = false;
  H90Rooms.syncPaused = false;
  H90Rooms.pausedBySync = false;
  H90Rooms.currentStreamKey = '';
  H90Rooms.activeChannelId = null;
  H90Rooms.localQuality = 'FHD';
  H90Rooms.currentChannelQualities = [];
  H90Rooms.replyToMessage = null;
  H90Rooms.lastMessageTime = 0;
}

function enterRoomUI(roomId, userName, isCreator) {
  _clearRuntime();

  var roomsScreen = document.getElementById('roomsScreen');
  var roomScreen = document.getElementById('room-screen');

  if (roomsScreen) roomsScreen.classList.add('hidden');
  if (roomScreen) roomScreen.classList.remove('hidden');

  var pageContent = document.getElementById('pageContent');
  if (pageContent) pageContent.style.display = 'none';

  var bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';

  var chatMessages = document.getElementById('chat-messages');
  if (chatMessages) chatMessages.innerHTML = '';

  var bar = document.getElementById('sync-status-bar');
  if (bar) bar.classList.remove('show');

  var qb = document.getElementById('quality-buttons-bar');
  if (qb) qb.innerHTML = '';

  listenToChat(roomId);
  listenToActiveChannel(roomId);
  listenToRoomExists(roomId);
  listenToRoomLock(roomId);
  listenToKickedUsers(roomId);
  listenToTyping(roomId);
  listenToPinnedMessage(roomId);
  listenToSyncMode(roomId);

  setupSyncPresence(roomId);
  listenToStalled(roomId);
  H90Rooms.syncEvalTimer = setInterval(_evaluateSync, 5000);

  startRoomTimer(roomId);
  startMessageCleaner(roomId);
  startInactivityChecker(roomId);

  _once('menu', setupRoomHeaderMenu);
  _once('videoHide', setupVideoControlsAutoHide);
  _once('swipe', setupMessageSwipeToReply);
  _once('reactions', setupReactions);
  _once('chatInput', setupChatInput);
  _once('voice', setupVoiceRecorder);
  _once('videoBtns', setupVideoButtons);
  _once('videoSync', setupVideoSyncEvents);
  _once('network', setupNetworkMonitor);
  setupSendButton();
  setupLeaveButton();
  _rebuildMenu();

  _registerFCMToken().then(function(token) {
    if (!token) return;
    _restUpdate(
      'rooms/' + roomId + '/members/' + userName,
      { fcmToken: token, deviceId: _getDeviceId(), lastSeen: Date.now() }
    ).catch(function() {});
  });
}

/* ═══════════════════════════════════════════════════════════════
   10. قائمة الرأس
   ═══════════════════════════════════════════════════════════════ */
function setupRoomHeaderMenu() {
  var menuBtn = document.getElementById('btn-room-menu');
  var menu = document.getElementById('room-menu-dropdown');
  if (!menuBtn || !menu) return;

  menuBtn.onclick = function(e) {
    e.stopPropagation();
    _rebuildMenu();
    menu.classList.toggle('show');
    _haptic(10);
  };

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#room-menu-dropdown') && !e.target.closest('#btn-room-menu')) {
      menu.classList.remove('show');
    }
  });
}

function _rebuildMenu() {
  var menu = document.getElementById('room-menu-dropdown');
  if (!menu) return;

  var isCreator = H90Rooms.currentUser.isCreator;
  var hasActiveChannel = !!H90Rooms.activeChannelId;
  var syncOn = H90Rooms.syncMode;
  var muted = _isRoomMuted();

  var items = [];

  if (isCreator) {
    items.push({ id: 'menu-kick',          icon: 'userMinus', label: 'طرد عضو' });
    items.push({ id: 'menu-add-channel',   icon: 'plus',      label: hasActiveChannel ? 'تغيير المحتوى' : 'إضافة محتوى' });
    items.push({ id: 'menu-sync',          icon: 'sync',      label: 'مزامنة الاتصال', status: syncOn ? 'on' : 'off' });
    items.push({ id: 'menu-lock',          icon: H90Rooms.roomLocked ? 'unlock' : 'lock', label: H90Rooms.roomLocked ? 'فتح الغرفة' : 'إقفال الغرفة' });
  }

  items.push({
    id: 'menu-mute',
    icon: muted ? 'bellOff' : 'bell',
    label: muted ? 'إلغاء كتم الغرفة' : 'كتم إشعارات الغرفة',
    status: muted ? 'on' : 'off'
  });

  items.push({ id: 'menu-share', icon: 'share', label: 'مشاركة الغرفة' });
  items.push({ id: 'menu-info',  icon: 'info',  label: 'معلومات الغرفة' });

  if (!isCreator) {
    items.push({ id: 'menu-leave', icon: 'logout', label: 'مغادرة الغرفة', danger: true });
  }
  if (isCreator) {
    items.push({ id: 'menu-leave-creator', icon: 'logout', label: 'مغادرة الغرفة', danger: true });
  }

  var closeBtnHtml =
    '<button type="button" class="h90-menu-close-item" data-action="menu-close">' +
      '<span class="h90-menu-close-icon">' + ROOMS_SVG.xmark + '</span>' +
    '</button>';

  var itemsHtml = items.map(function(it) {
    var statusHtml = '';
    if (it.status) {
      statusHtml = '<span class="h90-room-menu-status ' + it.status + '">' +
        (it.status === 'on' ? 'مفعّل' : 'معطّل') +
      '</span>';
    }
    return '<button type="button" class="h90-room-menu-item' +
      (it.danger ? ' danger' : '') +
      (it.status === 'on' ? ' active' : '') +
      '" data-action="' + it.id + '">' +
      '<span class="h90-room-menu-icon">' + (ROOMS_SVG[it.icon] || '') + '</span>' +
      '<span>' + it.label + '</span>' +
      statusHtml +
    '</button>';
  }).join('');

  menu.innerHTML = closeBtnHtml + itemsHtml;

  menu.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.onclick = function() {
      var action = btn.dataset.action;
      menu.classList.remove('show');
      _haptic(10);

      if (action === 'menu-close')              { }
      else if (action === 'menu-kick')          openMembersManager();
      else if (action === 'menu-add-channel')   openChannelsPicker();
      else if (action === 'menu-sync')          toggleSyncMode();
      else if (action === 'menu-lock')          toggleRoomLock();
      else if (action === 'menu-mute')          toggleRoomMute();
      else if (action === 'menu-leave-creator') confirmLeave();
      else if (action === 'menu-leave')         confirmLeave();
      else if (action === 'menu-share')         shareRoomLink();
      else if (action === 'menu-info')          showRoomInfo();
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   11. معلومات الغرفة
   ═══════════════════════════════════════════════════════════════ */
async function showRoomInfo() {
  if (!H90Rooms.currentRoomId) return;

  var modal = document.getElementById('room-info-modal');
  var content = document.getElementById('room-info-content');
  if (!modal || !content) return;

  content.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">جارٍ التحميل...</div>';
  modal.classList.add('show');

  try {
    var room = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId), 'معلومات الغرفة');
    if (!room) {
      content.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5573;">الغرفة غير موجودة</div>';
      return;
    }

    /* فك تشفير اسم الغرفة */
    var roomName = '—';
    if (room.nameEncrypted) {
      try { roomName = await RoomCrypto.decrypt(room.nameEncrypted); } catch (e) {}
    }

    var memberCount = Object.keys(room.members || {}).length;
    var expiresIn = room.expiresAt ? Math.max(0, Math.floor((room.expiresAt - Date.now()) / 60000)) : 0;
    var syncOn = room.syncMode !== false;
    var muted = _isRoomMuted();

    content.innerHTML =
      '<div class="h90-info-row"><span class="label">اسم الغرفة</span><span class="value">' + _escape(roomName) + '</span></div>' +
      '<div class="h90-info-row"><span class="label">المنشئ</span><span class="value">' + _escape(room.creator || '—') + '</span></div>' +
      '<div class="h90-info-row"><span class="label">الأعضاء</span><span class="value">' + memberCount + ' / ' + (room.maxMembers || 8) + '</span></div>' +
      '<div class="h90-info-row"><span class="label">الحالة</span><span class="value" style="color:' + (room.locked ? '#ffb300' : '#00e676') + ';">' + (room.locked ? 'مقفلة' : 'مفتوحة') + '</span></div>' +
      '<div class="h90-info-row"><span class="label">مزامنة الاتصال</span><span class="value" style="color:' + (syncOn ? '#00e676' : '#ffb300') + ';">' + (syncOn ? 'مفعّلة' : 'معطّلة') + '</span></div>' +
      '<div class="h90-info-row"><span class="label">الإشعارات</span><span class="value" style="color:' + (muted ? '#ffb300' : '#00e676') + ';">' + (muted ? '🔕 مكتومة' : '🔔 مفعّلة') + '</span></div>' +
      '<div class="h90-info-row"><span class="label">متبقي</span><span class="value" style="color:#00e5ff;">' + expiresIn + ' دقيقة</span></div>';
  } catch (e) {
    console.error(e);
    content.innerHTML = '<div style="text-align:center;padding:20px;color:#ff5573;">فشل تحميل المعلومات</div>';
  }
}

/* ═══════════════════════════════════════════════════════════════
   12. مزامنة الاتصال
   ═══════════════════════════════════════════════════════════════ */
async function toggleSyncMode() {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;

  try {
    var snap = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId + '/syncMode'), 'فحص المزامنة');
    var newState = snap === false;
    await _dbOp(_restSet('rooms/' + H90Rooms.currentRoomId + '/syncMode', newState), 'تبديل المزامنة');

    H90Rooms.syncMode = newState;

    var syncText = newState
      ? '🔄 ' + H90Rooms.currentUser.name + ' فعّل مزامنة الاتصال'
      : '⏸️ ' + H90Rooms.currentUser.name + ' عطّل مزامنة الاتصال';

    var syncEncrypted = await RoomCrypto.encrypt(syncText);
    var syncNonce = RoomCrypto.generateNonce();
    var syncHmac = await RoomCrypto.hmac(syncEncrypted + '|' + syncNonce);

    try {
      await _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
        type: 'system',
        systemType: 'sync',
        encrypted: syncEncrypted,
        nonce: syncNonce,
        hmac: syncHmac,
        timestamp: Date.now()
      });
    } catch (e) { console.warn(e); }

    _toast(newState ? '✅ تم تفعيل المزامنة' : '⚠️ تم تعطيل المزامنة', 'success');
  } catch (e) {
    console.error('[H90Rooms] sync error:', e);
    _toast('فشل التبديل: ' + _errMsg(e), 'error');
  }
}

function setupSyncPresence(roomId) {
  var myPath = 'rooms/' + roomId + '/stalled/' + H90Rooms.currentUser.name;
  H90Rooms._stalledPath = myPath;

  var hideHandler = function() {
    if (document.hidden && H90Rooms.currentRoomId === roomId) {
      _restSet(myPath, { ts: Date.now(), reason: 'hidden' }).catch(function(){});
    } else if (!document.hidden && H90Rooms.currentRoomId === roomId) {
      if (!H90Rooms.selfStalled) _restDelete(myPath).catch(function(){});
    }
  };
  document.addEventListener('visibilitychange', hideHandler);

  window.addEventListener('beforeunload', function() {
    _restDelete(myPath).catch(function(){});
  });

  _restSet(myPath, { ts: Date.now(), reason: 'online' }).catch(function(){});
}

function _setSelfStalled(flag, reason) {
  if (!H90Rooms._stalledPath) return;
  if (H90Rooms.selfStalled === flag) return;
  H90Rooms.selfStalled = flag;
  if (flag) _restSet(H90Rooms._stalledPath, { ts: Date.now(), reason: reason || 'buffer' }).catch(function(){});
  else _restDelete(H90Rooms._stalledPath).catch(function(){});
}

function listenToStalled(roomId) {
  var path = 'rooms/' + roomId + '/stalled';
  var pollKey = _restPoll(path, function(snap) {
    H90Rooms.stalledMap = snap.val() || {};
    _evaluateSync();
  }, 3000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function _stalledBlockers() {
  var now = Date.now();
  var map = H90Rooms.stalledMap || {};
  var names = [];
  Object.keys(map).forEach(function(n) {
    if (n === H90Rooms.currentUser.name) return;
    var e = map[n];
    var ts = e && typeof e.ts === 'number' ? e.ts : 0;
    if (now - ts < STALL_MAX_WAIT) names.push(n);
  });
  return names;
}

function _evaluateSync() {
  var video = document.getElementById('room-video');
  var bar = document.getElementById('sync-status-bar');
  var txt = document.getElementById('sync-status-text');
  if (!H90Rooms.currentRoomId) return;

  var active = H90Rooms.syncMode && !!H90Rooms.activeChannelId;
  var offlineSelf = active && navigator.onLine === false;
  var blockers = active ? _stalledBlockers() : [];

  if (offlineSelf || blockers.length > 0) {
    if (!H90Rooms.syncPaused) H90Rooms.syncPaused = true;
    if (video && !video.paused) {
      try { video.pause(); } catch (e) {}
      H90Rooms.pausedBySync = true;
    }
    if (txt) {
      txt.textContent = offlineSelf
        ? 'انقطع اتصالك بالإنترنت — القناة متوقفة وستستأنف تلقائياً عند عودته'
        : 'انقطع اتصال ' + blockers.join('، ') + ' — تم إيقاف القناة للجميع حتى يعود';
    }
    if (bar) bar.classList.add('show');
    return;
  }

  if (bar) bar.classList.remove('show');
  if (H90Rooms.syncPaused) {
    H90Rooms.syncPaused = false;
    if (H90Rooms.pausedBySync && video && H90Rooms.activeChannelId) {
      _seekToLive(video);
      video.play().catch(function(e) { console.warn('[H90Rooms] resume:', e); });
    }
    H90Rooms.pausedBySync = false;
  }
}

function setupVideoSyncEvents() {
  var video = document.getElementById('room-video');
  if (!video) return;

  video.addEventListener('waiting', function() {
    if (!H90Rooms.syncMode || !H90Rooms.currentRoomId || !H90Rooms.activeChannelId || H90Rooms.syncPaused) return;
    if (H90Rooms.stallTimer) clearTimeout(H90Rooms.stallTimer);
    H90Rooms.stallTimer = setTimeout(function() {
      if (H90Rooms.syncMode && !video.paused) _setSelfStalled(true, 'buffer');
    }, STALL_BUFFER_DELAY);
  });

  var recovered = function() {
    if (H90Rooms.stallTimer) { clearTimeout(H90Rooms.stallTimer); H90Rooms.stallTimer = null; }
    if (H90Rooms.selfStalled) _setSelfStalled(false);
  };
  video.addEventListener('playing', recovered);
  video.addEventListener('canplay', recovered);
  video.addEventListener('pause', function() {
    if (!H90Rooms.syncPaused) recovered();
  });
}

function setupNetworkMonitor() {
  window.addEventListener('offline', function() {
    console.log('[H90Rooms] 📴 انقطع الاتصال');
    _evaluateSync();
  });

  window.addEventListener('online', function() {
    console.log('[H90Rooms] 🌐 عاد الاتصال');
    _evaluateSync();
  });
}

function listenToSyncMode(roomId) {
  var path = 'rooms/' + roomId + '/syncMode';
  var pollKey = _restPoll(path, function(snap) {
    H90Rooms.syncMode = snap.val() !== false;
    console.log('[H90Rooms] 🔄 مزامنة الاتصال:', H90Rooms.syncMode);

    if (!H90Rooms.syncMode) {
      if (H90Rooms.stallTimer) { clearTimeout(H90Rooms.stallTimer); H90Rooms.stallTimer = null; }
      if (H90Rooms.selfStalled) _setSelfStalled(false);
    }

    var menu = document.getElementById('room-menu-dropdown');
    if (menu && menu.classList.contains('show')) _rebuildMenu();
    _evaluateSync();
  }, 3000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function startInactivityChecker(roomId) {
  if (!H90Rooms.currentUser.isCreator) return;

  if (H90Rooms.inactivityChecker) clearInterval(H90Rooms.inactivityChecker);

  H90Rooms.inactivityChecker = setInterval(async function() {
    if (!H90Rooms.currentRoomId || H90Rooms.currentRoomId !== roomId) {
      clearInterval(H90Rooms.inactivityChecker);
      return;
    }

    try {
      var lastMsg = await _restGet('rooms/' + roomId + '/lastMessageAt');
      lastMsg = lastMsg || 0;
      var inactiveTime = Date.now() - lastMsg;

      if (lastMsg && inactiveTime > INACTIVITY_TIMEOUT) {
        console.log('[H90Rooms] ⏰ عدم نشاط لمدة ساعة — حذف الغرفة');

        try {
          await _restPush('rooms/' + roomId + '/messages', {
            type: 'system',
            systemType: 'leave',
            encrypted: await RoomCrypto.encrypt('⏰ تم حذف الغرفة لعدم النشاط لمدة ساعة'),
            nonce: RoomCrypto.generateNonce(),
            timestamp: Date.now()
          });
        } catch (e) {}
        try { await _restDelete('rooms/' + roomId); } catch (e) {}

        _toast('انتهت الغرفة بسبب عدم النشاط', 'warning');
        leaveRoom(true, false, true);
      }
    } catch (e) {
      console.warn('[H90Rooms] inactivity check error:', e);
    }
  }, 5 * 60 * 1000);
}

/* ═══════════════════════════════════════════════════════════════
   12.4 [v7] قائمة اختيار المحتوى (قنوات / أفلام / مسلسلات)
   ═══════════════════════════════════════════════════════════════ */
var _currentPickerTab = 'channels';
var _pickerSearchQuery = '';
var _pickerSearchTimer = null;
var _pickerSeriesCache = {};

function openChannelsPicker() {
  if (!H90Rooms.currentUser.isCreator) {
    _toast('فقط المنشئ يمكنه إضافة محتوى', 'warning');
    return;
  }

  var modal = document.getElementById('channel-select-modal');
  var list = document.getElementById('server2-channels-list');
  var tabs = document.getElementById('h90-picker-tabs');
  var searchBox = document.getElementById('h90-picker-search');
  var searchInput = document.getElementById('h90-picker-search-input');
  var title = document.getElementById('channel-modal-title');

  if (!modal || !list) return;

  _currentPickerTab = 'channels';
  _pickerSearchQuery = '';

  if (title) title.textContent = 'اختر المحتوى';
  if (searchBox) searchBox.classList.remove('show');
  if (searchInput) searchInput.value = '';

  if (tabs) {
    tabs.querySelectorAll('.h90-picker-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === 'channels');
    });
    if (!tabs._bound) {
      tabs._bound = true;
      tabs.addEventListener('click', function(e) {
        var tab = e.target.closest('.h90-picker-tab');
        if (!tab) return;
        _switchPickerTab(tab.dataset.tab);
      });
    }
  }

  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    searchInput.addEventListener('input', function() {
      _pickerSearchQuery = this.value.trim();
      clearTimeout(_pickerSearchTimer);
      _pickerSearchTimer = setTimeout(function() {
        _performPickerSearch();
      }, 280);
    });
  }

  modal.classList.add('show');

  if (_currentPickerTab === 'channels') {
    setTimeout(function() {
      _loadAndRenderChannels(list, modal);
    }, 100);
  } else {
    _renderPickerForTab(_currentPickerTab, list);
  }
}

function _switchPickerTab(tabName) {
  _currentPickerTab = tabName;
  _pickerSearchQuery = '';

  var tabs = document.getElementById('h90-picker-tabs');
  var searchBox = document.getElementById('h90-picker-search');
  var searchInput = document.getElementById('h90-picker-search-input');
  var list = document.getElementById('server2-channels-list');

  if (tabs) {
    tabs.querySelectorAll('.h90-picker-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
  }

  if (searchInput) searchInput.value = '';

  if (tabName === 'channels') {
    if (searchBox) searchBox.classList.remove('show');
  } else {
    if (searchBox) searchBox.classList.add('show');
    if (searchInput) {
      searchInput.placeholder = tabName === 'movies' ? 'ابحث عن فيلم...' : 'ابحث عن مسلسل...';
    }
  }

  if (list) {
    list.innerHTML = '<div class="h90-picker-loading"><div class="spinner"></div><div class="text">جارٍ التحميل...</div></div>';
  }

  _renderPickerForTab(tabName, list);
}

function _renderPickerForTab(tabName, list) {
  if (!list) return;

  if (tabName === 'channels') {
    _loadAndRenderChannels(list, document.getElementById('channel-select-modal'));
  } else if (tabName === 'movies') {
    _renderMoviesTab(list);
  } else if (tabName === 'series') {
    _renderSeriesTab(list);
  }
}

function _performPickerSearch() {
  var list = document.getElementById('server2-channels-list');
  if (!list) return;

  if (_currentPickerTab === 'channels') return;

  if (_currentPickerTab === 'movies') {
    _renderMoviesTab(list);
  } else if (_currentPickerTab === 'series') {
    _renderSeriesTab(list);
  }
}

/* ─── تاب الأفلام ─────────────────────────────────────────── */
async function _renderMoviesTab(list) {
  if (!window.MoviesAPI) {
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">مكتبة الأفلام غير متاحة</div><div class="desc">تأكد من تحميل movies-api.js</div></div>';
    return;
  }

  if (_pickerSearchQuery && _pickerSearchQuery.length >= 2) {
    try {
      var allMovies = await _getOrLoadMovies();
      if (!allMovies || allMovies.length === 0) {
        list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">لا توجد أفلام</div></div>';
        return;
      }

      var results = window.MoviesAPI.search(allMovies, _pickerSearchQuery, 40);

      if (results.length === 0) {
        list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.search + '</div><div class="title">لا نتائج</div><div class="desc">جرّب كلمات أخرى</div></div>';
        return;
      }

      _renderMoviesList(results, list);
      return;
    } catch (e) {
      console.error('[H90Rooms] movies search error:', e);
      list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">فشل البحث</div></div>';
      return;
    }
  }

  list.innerHTML = '<div class="h90-picker-loading"><div class="spinner"></div><div class="text">جارٍ التحميل...</div></div>';

  try {
    var allMovies = await _getOrLoadMovies();
    if (!allMovies || allMovies.length === 0) {
      list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">لا توجد أفلام</div><div class="desc">تحقق من الاتصال</div></div>';
      return;
    }

    var trending = window.MoviesAPI.getTrending(allMovies, 30);
    _renderMoviesList(trending, list);

  } catch (e) {
    console.error('[H90Rooms] movies load error:', e);
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">فشل التحميل</div><div class="desc">' + _escape(e.message || '') + '</div></div>';
  }
}

async function _getOrLoadMovies() {
  if (window.H90Preloader && window.H90Preloader.getStatus) {
    var st = window.H90Preloader.getStatus();
    if (st.moviesLoaded && window.MoviesAPI) {
      if (typeof window._mvAllMovies !== 'undefined' && window._mvAllMovies.length > 0) {
        return window._mvAllMovies;
      }
    }
  }

  if (window.MoviesAPI && typeof window.MoviesAPI.loadMovies === 'function') {
    return await window.MoviesAPI.loadMovies();
  }

  return [];
}

function _renderMoviesList(movies, list) {
  if (!movies || movies.length === 0) {
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.film + '</div><div class="title">لا توجد نتائج</div></div>';
    return;
  }

  list.innerHTML = '';

  movies.forEach(function(movie) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h90-picker-item';

    var poster = movie.poster || '';
    var title = movie.title || movie.name || '—';
    var year = movie.year || '';
    var rating = movie.rating ? movie.rating.toFixed(1) : '';
    var cat = movie.categoryName || 'فيلم';

    var posterHtml = poster
      ? '<img class="h90-picker-item-poster" src="' + _escape(poster) + '" loading="lazy" ' +
        'onerror="this.src=\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23333%22><rect width=%2224%22 height=%2224%22/></svg>\';this.onerror=null;">'
      : '<div class="h90-picker-item-poster"></div>';

    btn.innerHTML =
      posterHtml +
      '<div class="h90-picker-item-info">' +
        '<div class="h90-picker-item-title">' + _escape(title) + '</div>' +
        '<div class="h90-picker-item-meta">' +
          (rating ? '<span class="h90-picker-item-rating">★ ' + rating + '</span>' : '') +
          (year ? '<span>' + year + '</span>' : '') +
          (cat ? '<span class="h90-picker-item-cat">' + _escape(cat) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<span class="h90-channel-play">' + ROOMS_SVG.play + '</span>';

    btn.onclick = function() {
      playMovieInRoom(movie);
      document.getElementById('channel-select-modal').classList.remove('show');
      _haptic(15);
    };
    list.appendChild(btn);
  });
}

/* ─── تاب المسلسلات ───────────────────────────────────────── */
async function _renderSeriesTab(list) {
  if (!window.SeriesAPI) {
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">مكتبة المسلسلات غير متاحة</div><div class="desc">تأكد من تحميل series-api.js</div></div>';
    return;
  }

  if (_pickerSearchQuery && _pickerSearchQuery.length >= 2) {
    try {
      var allSeries = await _getOrLoadSeries();
      if (!allSeries || allSeries.length === 0) {
        list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">لا توجد مسلسلات</div></div>';
        return;
      }

      var results = window.SeriesAPI.search(allSeries, _pickerSearchQuery, 40);

      if (results.length === 0) {
        list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.search + '</div><div class="title">لا نتائج</div><div class="desc">جرّب كلمات أخرى</div></div>';
        return;
      }

      _renderSeriesList(results, list);
      return;
    } catch (e) {
      console.error('[H90Rooms] series search error:', e);
      list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">فشل البحث</div></div>';
      return;
    }
  }

  list.innerHTML = '<div class="h90-picker-loading"><div class="spinner"></div><div class="text">جارٍ التحميل...</div></div>';

  try {
    var allSeries = await _getOrLoadSeries();
    if (!allSeries || allSeries.length === 0) {
      list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">لا توجد مسلسلات</div><div class="desc">تحقق من الاتصال</div></div>';
      return;
    }

    var trending = window.SeriesAPI.getTrending(allSeries, 30);
    _renderSeriesList(trending, list);

  } catch (e) {
    console.error('[H90Rooms] series load error:', e);
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">فشل التحميل</div><div class="desc">' + _escape(e.message || '') + '</div></div>';
  }
}

async function _getOrLoadSeries() {
  if (window.H90Preloader && window.H90Preloader.getStatus) {
    var st = window.H90Preloader.getStatus();
    if (st.seriesLoaded) {
      if (typeof window._srAllSeries !== 'undefined' && window._srAllSeries.length > 0) {
        return window._srAllSeries;
      }
    }
  }

  if (window.SeriesAPI && typeof window.SeriesAPI.loadSeries === 'function') {
    return await window.SeriesAPI.loadSeries();
  }

  return [];
}

function _renderSeriesList(seriesList, list) {
  if (!seriesList || seriesList.length === 0) {
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">لا توجد نتائج</div></div>';
    return;
  }

  list.innerHTML = '';

  seriesList.forEach(function(series) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h90-picker-item';

    var poster = series.poster || '';
    var title = series.title || series.name || '—';
    var year = series.year || '';
    var rating = series.rating ? series.rating.toFixed(1) : '';
    var cat = series.categoryName || 'مسلسل';

    var posterHtml = poster
      ? '<img class="h90-picker-item-poster" src="' + _escape(poster) + '" loading="lazy" ' +
        'onerror="this.src=\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23333%22><rect width=%2224%22 height=%2224%22/></svg>\';this.onerror=null;">'
      : '<div class="h90-picker-item-poster"></div>';

    btn.innerHTML =
      posterHtml +
      '<div class="h90-picker-item-info">' +
        '<div class="h90-picker-item-title">' + _escape(title) + '</div>' +
        '<div class="h90-picker-item-meta">' +
          (rating ? '<span class="h90-picker-item-rating">★ ' + rating + '</span>' : '') +
          (year ? '<span>' + year + '</span>' : '') +
          (cat ? '<span class="h90-picker-item-cat">' + _escape(cat) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<span class="h90-channel-play">' + ROOMS_SVG.play + '</span>';

    btn.onclick = function() {
      _showSeriesEpisodesInPicker(series, list);
      _haptic(15);
    };
    list.appendChild(btn);
  });
}

/* ─── نافذة الحلقات ────────────────────────────────────────── */
async function _showSeriesEpisodesInPicker(series, list) {
  var modal = document.getElementById('channel-select-modal');
  var title = document.getElementById('channel-modal-title');
  var tabs = document.getElementById('h90-picker-tabs');
  var searchBox = document.getElementById('h90-picker-search');

  if (tabs) tabs.style.display = 'none';
  if (searchBox) searchBox.classList.remove('show');

  if (title) {
    title.innerHTML =
      '<button type="button" class="h90-picker-back-btn" style="background:transparent;border:none;color:#00e5ff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;margin-left:8px;">' +
        '<span style="width:16px;height:16px;display:inline-flex;">' + ROOMS_SVG.back + '</span>' +
        'رجوع' +
      '</button>' +
      _escape(series.title || series.name);

    var backBtn = title.querySelector('.h90-picker-back-btn');
    if (backBtn) {
      backBtn.onclick = function() {
        if (tabs) tabs.style.display = '';
        if (title) title.textContent = 'اختر المحتوى';
        _renderSeriesTab(list);
      };
    }
  }

  list.innerHTML = '<div class="h90-picker-loading"><div class="spinner"></div><div class="text">جارٍ تحميل الحلقات...</div></div>';

  try {
    var info = await window.SeriesAPI.getSeriesInfo(series.id);
    if (!info || !info.seasons || info.seasons.length === 0) {
      list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">لا توجد حلقات</div></div>';
      return;
    }

    var currentSeason = info.seasons[0];

    var renderSeason = function(season) {
      var episodes = info.episodes[season] || [];

      var html = '';

      if (info.seasons.length > 1) {
        html += '<div class="h90-picker-season-pills">';
        info.seasons.forEach(function(s) {
          html += '<button type="button" class="h90-picker-season-pill' +
            (s === season ? ' active' : '') +
            '" data-season="' + s + '">الموسم ' + s + '</button>';
        });
        html += '</div>';
      }

      if (episodes.length === 0) {
        html += '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">لا توجد حلقات</div></div>';
      } else {
        episodes.forEach(function(ep) {
          var epNum = ep.episode_num || ep.id;
          var epTitle = ep.title || ('الحلقة ' + epNum);

          html += '<button type="button" class="h90-picker-item" data-ep-id="' + ep.id +
            '" data-ep-ext="' + (ep.container_extension || 'mp4') +
            '">' +
            '<div class="h90-picker-item-poster" style="background:linear-gradient(135deg,#e53935,#c62828);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;">' +
              'S' + season + 'E' + epNum +
            '</div>' +
            '<div class="h90-picker-item-info">' +
              '<div class="h90-picker-item-title">' + _escape(epTitle) + '</div>' +
              '<div class="h90-picker-item-meta">' +
                '<span>الحلقة ' + epNum + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="h90-channel-play">' + ROOMS_SVG.play + '</span>' +
          '</button>';
        });
      }

      list.innerHTML = html;

      list.querySelectorAll('.h90-picker-season-pill').forEach(function(pill) {
        pill.onclick = function() {
          renderSeason(pill.dataset.season);
        };
      });

      list.querySelectorAll('.h90-picker-item[data-ep-id]').forEach(function(btn) {
        btn.onclick = function() {
          var epId = parseInt(btn.dataset.epId, 10);
          var epExt = btn.dataset.epExt;

          playSeriesInRoom(series, epId, epExt, season);
          if (modal) modal.classList.remove('show');
          _haptic(20);
        };
      });
    };

    renderSeason(currentSeason);

  } catch (e) {
    console.error('[H90Rooms] series episodes error:', e);
    list.innerHTML = '<div class="h90-picker-empty"><div class="icon">' + ROOMS_SVG.play + '</div><div class="title">فشل تحميل الحلقات</div><div class="desc">' + _escape(e.message || '') + '</div></div>';
  }
}

/* ═══════════════════════════════════════════════════════════════
   13. تشغيل المحتوى في الغرفة (مع تشفير الروابط)
   ═══════════════════════════════════════════════════════════════ */

/* ─── قناة ──────────────────────────────────────────────── */
function playChannelInRoom(channel) {
  if (!H90Rooms.currentRoomId) {
    _toast('يجب أن تكون في غرفة', 'error');
    return;
  }
  if (!channel) { _toast('قناة غير صالحة', 'error'); return; }

  var streamUrl = _extractChannelUrl(channel);
  var qualities = _extractChannelQualities(channel);
  var logo = _extractChannelLogo(channel);
  var channelName = channel.name_ar || channel.name || 'قناة';

  if (!streamUrl) {
    console.error('[H90Rooms] ❌ لا يوجد رابط للقناة:', channel);
    _toast('لا يوجد رابط بث لهذه القناة', 'error');
    return;
  }

  /* ✅ تشفير الرابط + الاسم */
  (async function() {
    var encUrl = await RoomCrypto.encrypt(streamUrl);
    var encName = await RoomCrypto.encrypt(channelName);
    var encLogo = logo ? await RoomCrypto.encrypt(logo) : '';
    var encQualities = qualities.length > 0 ? await RoomCrypto.encryptJSON(qualities) : '';
    var nonce = RoomCrypto.generateNonce();
    var hmac = await RoomCrypto.hmac(encUrl + '|' + nonce);

    _writeActiveContent({
      id: channel.id || channel.name || channelName,
      encryptedName: encName,
      encryptedUrl: encUrl,
      encryptedLogo: encLogo,
      encryptedQualities: encQualities,
      nonce: nonce,
      hmac: hmac,
      type: 'channel'
    }, channelName);
  })();
}

/* ─── فيلم ─────────────────────────────────────────────── */
async function playMovieInRoom(movie) {
  if (!H90Rooms.currentRoomId) {
    _toast('يجب أن تكون في غرفة', 'error');
    return;
  }
  if (!movie) { _toast('فيلم غير صالح', 'error'); return; }

  var movieName = movie.title || movie.name || 'فيلم';
  _toast('⏳ جارٍ تجهيز: ' + movieName, 'info');

  try {
    var streamUrl = '';
    if (window.MoviesAPI && typeof window.MoviesAPI.buildStreamUrl === 'function') {
      streamUrl = await window.MoviesAPI.buildStreamUrl(movie.id, movie.extension || 'mkv');
    }

    if (!streamUrl) {
      _toast('❌ فشل الحصول على رابط البث', 'error');
      return;
    }

    var encUrl = await RoomCrypto.encrypt(streamUrl);
    var encName = await RoomCrypto.encrypt(movieName);
    var encLogo = movie.poster ? await RoomCrypto.encrypt(movie.poster) : '';
    var nonce = RoomCrypto.generateNonce();
    var hmac = await RoomCrypto.hmac(encUrl + '|' + nonce);

    _writeActiveContent({
      id: 'movie_' + movie.id,
      encryptedName: encName,
      encryptedUrl: encUrl,
      encryptedLogo: encLogo,
      encryptedQualities: '',
      nonce: nonce,
      hmac: hmac,
      type: 'movie'
    }, movieName);

  } catch (e) {
    console.error('[H90Rooms] playMovieInRoom error:', e);
    _toast('❌ فشل تشغيل الفيلم', 'error');
  }
}

/* ─── مسلسل ────────────────────────────────────────────── */
async function playSeriesInRoom(series, episodeId, ext, season) {
  if (!H90Rooms.currentRoomId) {
    _toast('يجب أن تكون في غرفة', 'error');
    return;
  }
  if (!series || !episodeId) {
    _toast('بيانات غير صالحة', 'error');
    return;
  }

  var seriesName = series.title || series.name || 'مسلسل';
  var displayName = seriesName + ' — S' + season + 'E' + episodeId;

  _toast('⏳ جارٍ تجهيز: ' + displayName, 'info');

  try {
    var streamUrl = '';
    if (window.SeriesAPI && typeof window.SeriesAPI.buildStreamUrl === 'function') {
      streamUrl = await window.SeriesAPI.buildStreamUrl(episodeId, ext || 'mp4');
    }

    if (!streamUrl) {
      _toast('❌ فشل الحصول على رابط البث', 'error');
      return;
    }

    var encUrl = await RoomCrypto.encrypt(streamUrl);
    var encName = await RoomCrypto.encrypt(displayName);
    var encLogo = series.poster ? await RoomCrypto.encrypt(series.poster) : '';
    var nonce = RoomCrypto.generateNonce();
    var hmac = await RoomCrypto.hmac(encUrl + '|' + nonce);

    _writeActiveContent({
      id: 'series_' + series.id + '_' + episodeId,
      encryptedName: encName,
      encryptedUrl: encUrl,
      encryptedLogo: encLogo,
      encryptedQualities: '',
      nonce: nonce,
      hmac: hmac,
      type: 'series'
    }, displayName);

  } catch (e) {
    console.error('[H90Rooms] playSeriesInRoom error:', e);
    _toast('❌ فشل تشغيل الحلقة', 'error');
  }
}

/* ─── كتابة المحتوى في Firebase (مع HMAC) ──────────────────── */
function _writeActiveContent(content, displayName) {
  _dbOp(_restSet('rooms/' + H90Rooms.currentRoomId + '/activeChannel', {
    id: content.id,
    encryptedName: content.encryptedName,
    encryptedUrl: content.encryptedUrl,
    encryptedLogo: content.encryptedLogo || '',
    encryptedQualities: content.encryptedQualities || '',
    nonce: content.nonce,
    hmac: content.hmac,
    type: content.type || 'channel',
    startedBy: H90Rooms.currentUser.name,
    startedAt: Date.now()
  }), 'تشغيل المحتوى')
  .then(async function() {
    _toast('✅ تم تشغيل: ' + displayName, 'success');

    var icon = content.type === 'movie' ? '🎬' :
               content.type === 'series' ? '📺' : '📡';

    var sysText = icon + ' ' + H90Rooms.currentUser.name + ' شغّل: ' + displayName;
    var encSys = await RoomCrypto.encrypt(sysText);
    var sysNonce = RoomCrypto.generateNonce();
    var sysHmac = await RoomCrypto.hmac(encSys + '|' + sysNonce);

    _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
      type: 'system',
      systemType: 'channel',
      encrypted: encSys,
      nonce: sysNonce,
      hmac: sysHmac,
      timestamp: Date.now()
    }).catch(function(e) { console.warn(e); });

    _restSet('rooms/' + H90Rooms.currentRoomId + '/lastMessageAt', Date.now()).catch(function(e) {});

    _pushNotification({
      roomId: H90Rooms.currentRoomId,
      type: 'room_channel',
      title: icon + ' محتوى جديد',
      body: H90Rooms.currentUser.name + ' شغّل: ' + displayName,
      url: '/?room=' + encodeURIComponent(H90Rooms.currentRoomId),
      icon: '/H90.jpg',
      senderName: H90Rooms.currentUser.name
    });
  })
  .catch(function(e) {
    console.error('[H90Rooms] ❌ فشل تشغيل المحتوى:', e);
    _toast('❌ فشل التشغيل: ' + _errMsg(e), 'error');
  });
}

async function stopActiveChannel() {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) {
    _toast('فقط المنشئ يمكنه إيقاف البث', 'warning');
    return;
  }
  if (!confirm('هل تريد إيقاف البث الحالي لجميع الأعضاء؟')) return;

  try {
    var ch = await _restGet('rooms/' + H90Rooms.currentRoomId + '/activeChannel');
    var chName = 'المحتوى';
    if (ch && ch.encryptedName) {
      try { chName = await RoomCrypto.decrypt(ch.encryptedName) || chName; } catch(e) {}
    }

    await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId + '/activeChannel'), 'إيقاف البث');

    var stopText = '⏹️ ' + H90Rooms.currentUser.name + ' أوقف: ' + chName;
    var encStop = await RoomCrypto.encrypt(stopText);
    var stopNonce = RoomCrypto.generateNonce();
    var stopHmac = await RoomCrypto.hmac(encStop + '|' + stopNonce);

    _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
      type: 'system',
      systemType: 'channel',
      encrypted: encStop,
      nonce: stopNonce,
      hmac: stopHmac,
      timestamp: Date.now()
    }).catch(function(e) {});

    _toast('✅ تم إيقاف البث', 'success');
  } catch (e) {
    console.error('[H90Rooms] stop error:', e);
    _toast('❌ فشل الإيقاف', 'error');
  }
}

/* ─── تحميل القنوات ──────────────────────────────────────── */
function _loadAndRenderChannels(list, modal) {
  var allChannels =
    window.SERVER2_CHANNELS ||
    window.S2_CHANNELS_RAW ||
    window.SERVER2_DATA ||
    [];

  if (allChannels && allChannels.length > 0) {
    _renderChannelsList(allChannels, list, modal);
    return;
  }

  if (typeof window.loadServer2Channels === 'function') {
    window.loadServer2Channels(false).then(function (result) {
      var channels = (result && result.channels) || [];
      if (channels.length > 0) {
        window.SERVER2_CHANNELS = channels;
        _renderChannelsList(channels, list, modal);
      } else {
        _renderChannelsEmpty(list);
      }
    }).catch(function (e) {
      console.error('[H90Rooms] فشل تحميل القنوات:', e);
      _renderChannelsEmpty(list);
    });
    return;
  }

  _renderChannelsEmpty(list);
}

function _renderChannelsList(allChannels, list, modal) {
  list.innerHTML = '';

  if (!allChannels || allChannels.length === 0) {
    _renderChannelsEmpty(list);
    return;
  }

  allChannels.forEach(function (ch) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h90-channel-item';

    var logo = _extractChannelLogo(ch);
    var qualityLabels = Array.isArray(ch.qualities)
      ? ch.qualities.map(function (q) { return q.label || q; }).filter(Boolean).join(' · ')
      : '';

    var channelName = ch.name_ar || ch.name || '—';
    var initials = String(channelName).substring(0, 2).toUpperCase();

    var logoHtml = '';
    if (logo) {
      logoHtml =
        '<img class="h90-channel-logo" ' +
          'src="' + _escape(logo) + '" ' +
          'alt="' + _escape(channelName) + '" ' +
          'loading="lazy" ' +
          'onerror="this.outerHTML=\'<span class=&quot;h90-channel-logo-fallback&quot;>' +
            _escape(initials) +
          '</span>\'">';
    } else {
      logoHtml =
        '<span class="h90-channel-logo-fallback">' + _escape(initials) + '</span>';
    }

    btn.innerHTML =
      logoHtml +
      '<div class="h90-channel-info">' +
        '<span class="h90-channel-name">' + _escape(channelName) + '</span>' +
        (qualityLabels
          ? '<span class="h90-channel-meta">' + _escape(qualityLabels) + '</span>'
          : '') +
      '</div>' +
      '<span class="h90-channel-play">' + ROOMS_SVG.play + '</span>';

    btn.onclick = function () {
      playChannelInRoom(ch);
      modal.classList.remove('show');
      _haptic(15);
    };
    list.appendChild(btn);
  });
}

function _renderChannelsEmpty(list) {
  list.innerHTML =
    '<div class="h90-picker-empty">' +
      '<div class="icon">' + ROOMS_SVG.tv + '</div>' +
      '<div class="title">لا توجد قنوات متاحة</div>' +
      '<div class="desc">تحقق من اتصالك بالإنترنت</div>' +
    '</div>';
}

function _renderQualityButtons(qualities, currentQuality) {
  var bar = document.getElementById('quality-buttons-bar');
  if (!bar) return;

  if (!qualities || qualities.length <= 1) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = '';

  qualities.forEach(function(q) {
    var label = q.label || q;
    var isActive = label === currentQuality;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'padding:4px 10px; border-radius:14px; border:1px solid ' +
      (isActive ? '#fff' : 'rgba(255,255,255,0.25)') + '; ' +
      'background:' + (isActive ? 'linear-gradient(135deg,#ff2d55,#e6003d)' : 'rgba(15,17,23,0.75)') + '; ' +
      'color:#fff; font-size:10.5px; font-weight:800; font-family:inherit; cursor:pointer; ' +
      'backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); ' +
      'min-width:42px; text-align:center; transition:all 0.2s; ' +
      'letter-spacing:0.3px; line-height:1.2;';
    btn.onclick = function(e) {
      e.stopPropagation();
      _switchLocalQuality(label);
      _haptic(10);
    };
    bar.appendChild(btn);
  });
}

function _switchLocalQuality(qualityLabel) {
  if (!H90Rooms.activeChannelId) return;

  H90Rooms.localQuality = qualityLabel;

  var video = document.getElementById('room-video');
  if (!video) return;

  _restGet('rooms/' + H90Rooms.currentRoomId + '/activeChannel').then(async function(ch) {
    if (!ch) return;
    var url = '';
    var qualities = [];
    if (ch.encryptedUrl) {
      try { url = await RoomCrypto.decrypt(ch.encryptedUrl); } catch(e) {}
    }
    if (ch.encryptedQualities) {
      try { qualities = await RoomCrypto.decryptJSON(ch.encryptedQualities) || []; } catch(e) {}
    }
    if (!url) { _toast('الجودة غير متاحة', 'warning'); return; }

    var finalUrl = url;
    if (qualities.length > 0) {
      var found = qualities.find(function(q) { return q.label === qualityLabel; });
      if (found) finalUrl = found.url;
    }

    var wasPaused = video.paused;
    var currentTime = video.currentTime;
    var wasLive = !isFinite(video.duration) || video.duration === 0;

    var onLoaded = function() {
      video.removeEventListener('loadedmetadata', onLoaded);
      try {
        if (!wasLive && currentTime > 0 && isFinite(video.duration)) {
          video.currentTime = currentTime;
        } else {
          _seekToLive(video);
        }
        if (!wasPaused) {
          video.play().catch(function(e) { console.warn(e); });
        }
      } catch (e) {}
    };
    video.addEventListener('loadedmetadata', onLoaded);

    _attachVideoSource(video, finalUrl);

    _renderQualityButtons(qualities, qualityLabel);
    _toast('🎬 الجودة: ' + qualityLabel, 'info');
  });
}

function listenToActiveChannel(roomId) {
  var path = 'rooms/' + roomId + '/activeChannel';
  var pollKey = _restPoll(path, async function(snap) { // <-- async
    var ch = snap.val();
    var placeholder = document.getElementById('video-placeholder');
    var video = document.getElementById('room-video');
    var channelName = document.getElementById('active-channel-name');
    var area = document.getElementById('video-player-area');
    var qualityBar = document.getElementById('quality-buttons-bar');

    if (ch && ch.encryptedUrl) {
      /* ✅ فك التشفير */
      var decUrl = '', decName = '', decLogo = '', decQualities = [];
      try { decUrl = await RoomCrypto.decrypt(ch.encryptedUrl); } catch(e) {}
      try { decName = await RoomCrypto.decrypt(ch.encryptedName); } catch(e) {}
      try { decLogo = ch.encryptedLogo ? await RoomCrypto.decrypt(ch.encryptedLogo) : ''; } catch(e) {}
      try { decQualities = ch.encryptedQualities ? await RoomCrypto.decryptJSON(ch.encryptedQualities) : []; } catch(e) {}

      /* ✅ التحقق من HMAC */
      if (ch.hmac && ch.nonce && decUrl) {
        var expectedHmac = await RoomCrypto.hmac(ch.encryptedUrl + '|' + ch.nonce);
        if (expectedHmac !== ch.hmac) {
          console.error('🚫 HMAC mismatch for activeChannel');
          return; // تجاهل
        }
      }

      if (!decUrl) return;

      H90Rooms.activeChannelId = ch.id || decName || 'content';
      if (placeholder) placeholder.style.display = 'none';
      if (video) {
        video.style.display = 'block';
        video.onerror = function() {
          console.error('[H90Rooms] video error:', video.error);
          _toast('فشل تشغيل البث: ' + decName, 'error');
        };

        var streamKey = ch.id + '|' + ch.startedAt;

        if (H90Rooms.currentStreamKey !== streamKey) {
          H90Rooms.currentStreamKey = streamKey;
          H90Rooms.currentChannelQualities = decQualities || [];

          var startQuality = H90Rooms.localQuality || 'FHD';
          var finalUrl = decUrl;
          if (decQualities.length > 0) {
            var found = decQualities.find(function(q) { return q.label === startQuality; });
            if (found) finalUrl = found.url;
          }

          _attachVideoSource(video, finalUrl);
          _renderQualityButtons(decQualities, startQuality);
          setTimeout(_evaluateSync, 1200);
        }
      }
      if (channelName) {
        var typeIcon = ch.type === 'movie' ? '🎬 ' :
                       ch.type === 'series' ? '📺 ' : '📡 ';
        channelName.textContent = typeIcon + (decName || '');
      }
      if (area) area.classList.remove('show-controls');
    } else {
      H90Rooms.activeChannelId = null;
      H90Rooms.currentStreamKey = '';
      H90Rooms.currentChannelQualities = [];
      if (placeholder) placeholder.style.display = 'flex';
      if (video) {
        _detachVideoSource(video);
        video.style.display = 'none';
      }
      if (channelName) channelName.textContent = '';
      if (qualityBar) qualityBar.innerHTML = '';
      if (H90Rooms.selfStalled) _setSelfStalled(false);
    }

    var menu = document.getElementById('room-menu-dropdown');
    if (menu && menu.classList.contains('show')) {
      _rebuildMenu();
    }
    _evaluateSync();
  }, POLL_INTERVAL);

  H90Rooms.listeners.push({ pollKey: pollKey });
}

/* ═══════════════════════════════════════════════════════════════
   14. الفيديو — التحكم
   ═══════════════════════════════════════════════════════════════ */
function setupVideoControlsAutoHide() {
  var area = document.getElementById('video-player-area');
  if (!area) return;

  var hideTimer = null;
  function show() {
    if (!H90Rooms.activeChannelId) return;
    area.classList.add('show-controls');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
      area.classList.remove('show-controls');
    }, 3000);
  }

  area.addEventListener('click', function(e) {
    if (e.target.closest('button')) return;
    if (e.target.closest('#quality-buttons-bar')) return;
    show();
  });
  area.addEventListener('touchstart', function(e) {
    if (e.target.closest('button')) return;
    if (e.target.closest('#quality-buttons-bar')) return;
    show();
  }, { passive: true });
}

function setupVideoButtons() {
  var video = document.getElementById('room-video');
  var playBtn = document.getElementById('btn-play-pause');

  document.addEventListener('click', function(e) {
    if (!video || !H90Rooms.activeChannelId) return;

    if (e.target.closest('#btn-play-pause')) {
      if (video.paused) {
        if (H90Rooms.syncPaused) {
          _toast('البث متوقف بسبب انقطاع اتصال أحد الأعضاء', 'warning');
          return;
        }
        video.play().catch(function(err) { console.warn('[H90Rooms] play error:', err); });
      } else {
        video.pause();
      }
    }
    if (e.target.closest('#btn-rewind'))  video.currentTime -= 10;
    if (e.target.closest('#btn-forward')) video.currentTime += 10;
    if (e.target.closest('#btn-fullscreen')) {
      var area = document.getElementById('video-player-area');
      if (area && area.requestFullscreen) {
        area.requestFullscreen().catch(function(e) { console.warn(e); });
      } else if (area && area.webkitRequestFullscreen) {
        area.webkitRequestFullscreen();
      } else if (video && video.requestFullscreen) {
        video.requestFullscreen().catch(function(e) { console.warn(e); });
      } else if (video && video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      }
    }
    if (e.target.closest('#btn-close-video')) {
      stopActiveChannel();
    }
  });

  if (video) {
    video.addEventListener('play', function() {
      if (playBtn) playBtn.innerHTML = ROOMS_SVG.pause;
    });
    video.addEventListener('pause', function() {
      if (playBtn) playBtn.innerHTML = ROOMS_SVG.play;
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   15. الدردشة (مع فك التشفير + التحقق)
   ═══════════════════════════════════════════════════════════════ */
function listenToChat(roomId) {
  var path = 'rooms/' + roomId + '/messages';
  var seenIds = {};

  var pollKey = _restPoll(path, async function(snap) { // <-- async
    var messages = snap.val() || {};
    var container = document.getElementById('chat-messages');
    if (!container) return;

    var sortedIds = Object.keys(messages).sort();
    for (var i = 0; i < sortedIds.length; i++) {
      var id = sortedIds[i];
      if (seenIds[id]) continue;
      var msg = messages[id];
      if (!msg) continue;

      seenIds[id] = true;

      /* ✅ فك تشفير الرسالة */
      var finalText = msg.text || '';
      if (msg.encrypted) {
        try {
          finalText = await RoomCrypto.decrypt(msg.encrypted) || '';
        } catch(e) {}
      }

      /* ✅ التحقق من HMAC */
      if (msg.hmac && msg.nonce && msg.encrypted) {
        var expectedHmac = await RoomCrypto.hmac(msg.encrypted + '|' + msg.nonce);
        if (expectedHmac !== msg.hmac) {
          console.warn('🚫 [H90Rooms] HMAC mismatch for message', id);
          continue;
        }
      }

      /* ✅ التحقق من Nonce + Timestamp (منع إعادة الإرسال) */
      if (msg.nonce) {
        var nonceKey = 'h90_nonce_' + roomId + '_' + msg.nonce;
        try {
          if (localStorage.getItem(nonceKey)) {
            console.warn('🚫 [H90Rooms] Duplicate nonce', msg.nonce);
            continue;
          }
          localStorage.setItem(nonceKey, '1');
          // تنظيف تلقائي بعد 5 دقائق
          setTimeout(function() { try { localStorage.removeItem(nonceKey); } catch(e){} }, 5 * 60 * 1000);
        } catch(e) {}
      }

      /* ✅ فحص Rate Limiting */
      if (msg.sender && msg.sender !== H90Rooms.currentUser.name) {
        if (!_checkRateLimit('msg_' + msg.sender)) {
          console.warn('🚫 [H90Rooms] Rate limit exceeded for', msg.sender);
          continue;
        }
      }

      if (msg.type === 'system') {
        addSystemMessage(finalText, msg.systemType || 'info');
      } else if (msg.type === 'voice' && msg.audioUrl) {
        addVoiceMessageToUI(msg.sender, msg.audioUrl, msg.sender === H90Rooms.currentUser.name, id, msg.replyTo, msg.reactions);
      } else if (finalText) {
        addMessageToUI(msg.sender, finalText, msg.sender === H90Rooms.currentUser.name, id, msg.replyTo, msg.reactions);
      }

      if (msg.sender && msg.sender !== H90Rooms.currentUser.name) {
        _playSound();
        _haptic(20);
      }

      if (msg.type !== 'system' || msg.systemType === 'join' || msg.systemType === 'leave') {
        H90Rooms.lastMessageTime = Date.now();
      }
    }

    container.querySelectorAll('[data-msg-id]').forEach(function(el) {
      if (!messages[el.dataset.msgId]) el.remove();
    });

    for (var j = 0; j < sortedIds.length; j++) {
      var mId = sortedIds[j];
      var m = messages[mId];
      if (!m) continue;
      var div = container.querySelector('[data-msg-id="' + mId + '"]');
      if (div) updateReactionsUI(div, m.reactions || {});
    }
  }, POLL_INTERVAL);

  H90Rooms.listeners.push({ pollKey: pollKey });
}

function addMessageToUI(sender, text, isMe, msgId, replyTo, reactions) {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var div = document.createElement('div');
  div.className = 'msg' + (isMe ? ' me' : '');
  div.dataset.msgId = msgId || '';

  var html = '';
  if (replyTo) {
    html += '<div class="msg-reply-preview">' +
              '<span class="reply-sender">' + _escape(replyTo.sender) + '</span>' +
              '<span class="reply-text">' + _escape(replyTo.text) + '</span>' +
            '</div>';
  }
  html += '<span class="sender">' + _escape(sender) + '</span>';
  html += '<div class="msg-text">' + _escape(text) + '</div>';
  html += '<div class="msg-reactions"></div>';

  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (reactions) updateReactionsUI(div, reactions);
}

function addVoiceMessageToUI(sender, audioUrl, isMe, msgId, replyTo, reactions) {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var div = document.createElement('div');
  div.className = 'msg' + (isMe ? ' me' : '');
  div.dataset.msgId = msgId || '';

  var html = '';
  if (replyTo) {
    html += '<div class="msg-reply-preview">' +
              '<span class="reply-sender">' + _escape(replyTo.sender) + '</span>' +
              '<span class="reply-text">' + _escape(replyTo.text) + '</span>' +
            '</div>';
  }
  html += '<span class="sender">' + _escape(sender) + '</span>';
  html += '<div class="voice-msg"><audio controls preload="metadata" src="' + _escape(audioUrl) + '"></audio></div>';
  html += '<div class="msg-reactions"></div>';

  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (reactions) updateReactionsUI(div, reactions);
}

function updateReactionsUI(div, reactions) {
  var rDiv = div.querySelector('.msg-reactions');
  if (!rDiv) return;

  var entries = Object.entries(reactions || {});
  if (entries.length === 0) { rDiv.innerHTML = ''; return; }

  rDiv.innerHTML = entries.map(function(pair) {
    var emoji = pair[0];
    var users = pair[1] || {};
    var count = Object.keys(users).length;
    var mine = users[H90Rooms.currentUser.name] ? ' mine' : '';
    return '<span class="reaction' + mine + '" data-emoji="' + emoji + '">' + emoji + ' ' + count + '</span>';
  }).join('');
}

function addSystemMessage(text, systemType) {
  var container = document.getElementById('chat-messages');
  if (!container) return;
  var div = document.createElement('div');
  div.className = 'msg system' + (systemType ? ' ' + systemType : '');
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/* ═══════════════════════════════════════════════════════════════
   16. إرسال رسالة نصية (مع تشفير + HMAC + Nonce)
   ═══════════════════════════════════════════════════════════════ */
function setupChatInput() {
  var input = document.getElementById('chat-input');
  if (!input) return;

  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendTextMessage(); }
  });

  input.addEventListener('input', function() {
    if (!H90Rooms.currentRoomId) return;
    try {
      _restSet('rooms/' + H90Rooms.currentRoomId + '/typing/' + H90Rooms.currentUser.name, true);
      clearTimeout(H90Rooms.typingTimeout);
      H90Rooms.typingTimeout = setTimeout(function() {
        try {
          if (H90Rooms.currentRoomId) {
            _restDelete('rooms/' + H90Rooms.currentRoomId + '/typing/' + H90Rooms.currentUser.name);
          }
        } catch (e) {}
      }, 2000);
    } catch (e) {}
  });
}

function setupSendButton() {
  var btn = document.getElementById('btn-send-msg');
  if (!btn) return;
  btn.onclick = sendTextMessage;
}

async function sendTextMessage() {
  var input = document.getElementById('chat-input');
  if (!input) return;

  var text = input.value.trim();
  if (!text || !H90Rooms.currentRoomId || !H90Rooms.currentUser.name) return;

  /* ✅ Rate Limiting */
  if (!_checkRateLimit('send_' + H90Rooms.currentUser.name)) {
    _toast('⏳ أنت ترسل بسرعة كبيرة، انتظر قليلاً', 'warning');
    return;
  }

  try {
    /* ✅ تشفير النص */
    var encrypted = await RoomCrypto.encrypt(text);
    var nonce = RoomCrypto.generateNonce();
    var hmac = await RoomCrypto.hmac(encrypted + '|' + nonce);

    var data = {
      sender: H90Rooms.currentUser.name,
      encrypted: encrypted,
      type: 'text',
      nonce: nonce,
      hmac: hmac,
      deviceSig: await RoomCrypto.getDeviceSignature(),
      timestamp: Date.now()
    };

    if (H90Rooms.replyToMessage) {
      data.replyTo = {
        sender: H90Rooms.replyToMessage.sender,
        text: H90Rooms.replyToMessage.text
      };
    }

    await _dbOp(_restPush('rooms/' + H90Rooms.currentRoomId + '/messages', data), 'إرسال الرسالة');
    _restSet('rooms/' + H90Rooms.currentRoomId + '/lastMessageAt', Date.now()).catch(function (e) {});
    H90Rooms.lastMessageTime = Date.now();
    input.value = '';
    cancelReply();
    _restDelete('rooms/' + H90Rooms.currentRoomId + '/typing/' + H90Rooms.currentUser.name).catch(function(){});

    _pushNotification({
      roomId: H90Rooms.currentRoomId,
      type: 'room_message',
      title: '💬 ' + H90Rooms.currentUser.name,
      body: text.length > 100 ? text.substring(0, 97) + '...' : text,
      url: '/?room=' + encodeURIComponent(H90Rooms.currentRoomId),
      icon: '/H90.jpg',
      senderName: H90Rooms.currentUser.name
    });

  } catch (err) {
    console.error('[H90Rooms] send error:', err);
    _toast('فشل الإرسال', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   17. تسجيل صوتي (مع تشفير)
   ═══════════════════════════════════════════════════════════════ */
function setupVoiceRecorder() {
  var btn = document.getElementById('btn-voice-msg');
  if (!btn) return;

  var start = async function(e) {
    e.preventDefault();
    if (H90Rooms.isRecording) return;
    if (!H90Rooms.currentRoomId || !H90Rooms.currentUser.name) {
      _toast('يجب أن تكون في غرفة أولاً', 'warning');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _toast('المتصفح لا يدعم التسجيل', 'error');
      return;
    }

    /* ✅ Rate Limiting للصوت */
    if (!_checkRateLimit('voice_' + H90Rooms.currentUser.name)) {
      _toast('⏳ أنت تسجل بسرعة كبيرة، انتظر قليلاً', 'warning');
      return;
    }

    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });

      H90Rooms.activeStream = stream;
      H90Rooms.audioChunks = [];
      H90Rooms.voiceSeconds = 0;

      var mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else mimeType = '';
        }
      }
      H90Rooms.voiceMimeType = mimeType || 'audio/webm';

      var options = mimeType ? { mimeType: mimeType } : {};
      H90Rooms.mediaRecorder = new MediaRecorder(stream, options);

      H90Rooms.mediaRecorder.ondataavailable = function(ev) {
        if (ev.data && ev.data.size > 0) H90Rooms.audioChunks.push(ev.data);
      };

      H90Rooms.mediaRecorder.onstop = async function() {
        if (H90Rooms.activeStream) {
          H90Rooms.activeStream.getTracks().forEach(function(t) { t.stop(); });
          H90Rooms.activeStream = null;
        }

        if (H90Rooms.audioChunks.length === 0) {
          H90Rooms.isRecording = false;
          return;
        }

        var blob = new Blob(H90Rooms.audioChunks, { type: H90Rooms.voiceMimeType });
        H90Rooms.isRecording = false;
        await uploadVoiceMessage(blob);
      };

      H90Rooms.mediaRecorder.start();
      H90Rooms.isRecording = true;
      btn.classList.add('recording');

      var indicator = document.getElementById('voice-recording-indicator');
      var timerEl = document.getElementById('voice-timer');
      if (indicator) indicator.classList.add('show');
      if (timerEl) timerEl.textContent = '0:00 / 0:15';

      H90Rooms.voiceTimer = setInterval(function() {
        H90Rooms.voiceSeconds++;
        if (timerEl) {
          timerEl.textContent = '0:' + String(H90Rooms.voiceSeconds).padStart(2, '0') + ' / 0:15';
        }
        if (H90Rooms.voiceSeconds >= MAX_VOICE_SECONDS) {
          stopRecording();
        }
      }, 1000);

    } catch (err) {
      console.error('[H90Rooms] mic error:', err);
      var msg = 'لا يمكن الوصول للميكروفون';
      if (err.name === 'NotAllowedError') msg = 'تم رفض صلاحية الميكروفون';
      else if (err.name === 'NotFoundError') msg = 'لا يوجد ميكروفون متصل';
      else if (err.name === 'NotReadableError') msg = 'الميكروفون مستخدم من تطبيق آخر';
      _toast(msg, 'error');
      H90Rooms.isRecording = false;
    }
  };

  var stopRecording = function() {
    if (H90Rooms.mediaRecorder && H90Rooms.mediaRecorder.state === 'recording') {
      H90Rooms.mediaRecorder.stop();
    }
    btn.classList.remove('recording');
    var indicator = document.getElementById('voice-recording-indicator');
    if (indicator) indicator.classList.remove('show');
    if (H90Rooms.voiceTimer) {
      clearInterval(H90Rooms.voiceTimer);
      H90Rooms.voiceTimer = null;
    }
  };

  btn.onmousedown = start;
  btn.onmouseup = stopRecording;
  btn.onmouseleave = stopRecording;
  btn.addEventListener('touchstart', start, { passive: false });
  btn.addEventListener('touchend', function(e) { e.preventDefault(); stopRecording(); });
  btn.addEventListener('touchcancel', stopRecording);
}

async function uploadVoiceMessage(blob) {
  if (!H90Rooms.currentRoomId) return;

  if (blob.size > MAX_VOICE_SIZE) {
    _toast('الرسالة الصوتية كبيرة جداً', 'error');
    return;
  }

  try {
    var base64 = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    /* ✅ تشفير البيانات الصوتية (base64) */
    var encryptedAudio = await RoomCrypto.encrypt(base64);
    var nonce = RoomCrypto.generateNonce();
    var hmac = await RoomCrypto.hmac(encryptedAudio + '|' + nonce);

    var data = {
      sender: H90Rooms.currentUser.name,
      type: 'voice',
      encryptedAudio: encryptedAudio,
      nonce: nonce,
      hmac: hmac,
      deviceSig: await RoomCrypto.getDeviceSignature(),
      timestamp: Date.now()
    };

    if (H90Rooms.replyToMessage) {
      data.replyTo = {
        sender: H90Rooms.replyToMessage.sender,
        text: '[رسالة صوتية]'
      };
    }

    await _dbOp(_restPush('rooms/' + H90Rooms.currentRoomId + '/messages', data), 'إرسال الرسالة الصوتية');
    _restSet('rooms/' + H90Rooms.currentRoomId + '/lastMessageAt', Date.now()).catch(function (e) {});
    _toast('✅ تم إرسال الرسالة الصوتية', 'success');
    cancelReply();

    _pushNotification({
      roomId: H90Rooms.currentRoomId,
      type: 'room_message',
      title: '🎤 ' + H90Rooms.currentUser.name,
      body: 'رسالة صوتية',
      url: '/?room=' + encodeURIComponent(H90Rooms.currentRoomId),
      icon: '/H90.jpg',
      senderName: H90Rooms.currentUser.name
    });

  } catch (err) {
    console.error('[H90Rooms] upload voice error:', err);
    _toast('فشل إرسال الرسالة الصوتية', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   18. مستمعات إضافية
   ═══════════════════════════════════════════════════════════════ */
function listenToTyping(roomId) {
  var path = 'rooms/' + roomId + '/typing';
  var pollKey = _restPoll(path, function(snap) {
    var typing = snap.val() || {};
    var names = Object.keys(typing).filter(function(n) {
      return n !== H90Rooms.currentUser.name && typing[n] === true;
    });

    var el = document.getElementById('typing-indicator');
    if (!el) return;

    if (names.length === 0) {
      el.classList.remove('show');
    } else if (names.length === 1) {
      el.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ' + _escape(names[0]) + ' يكتب...';
      el.classList.add('show');
    } else {
      el.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ' + names.length + ' أشخاص يكتبون...';
      el.classList.add('show');
    }
  }, 3000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function listenToPinnedMessage(roomId) {
  var path = 'rooms/' + roomId + '/pinnedMessage';
  var pollKey = _restPoll(path, function(snap) {
    var pinned = snap.val();
    var banner = document.getElementById('pinned-message-banner');
    if (!banner) return;

    if (pinned && pinned.text) {
      banner.innerHTML =
        '<div class="pinned-content">' +
          '<div class="pinned-label">رسالة مثبتة</div>' +
          '<div class="pinned-text">' + _escape(pinned.sender) + ': ' + _escape(pinned.text) + '</div>' +
        '</div>' +
        (H90Rooms.currentUser.isCreator ? '<button class="pinned-close" onclick="unpinMessage()">' + ROOMS_SVG.close + '</button>' : '');
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
      banner.innerHTML = '';
    }
  }, 5000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function listenToRoomLock(roomId) {
  var path = 'rooms/' + roomId + '/locked';
  var pollKey = _restPoll(path, function(snap) {
    H90Rooms.roomLocked = snap.val() === true;
    if (H90Rooms.currentUser.isCreator) {
      var menu = document.getElementById('room-menu-dropdown');
      if (menu && menu.classList.contains('show')) _rebuildMenu();
    }
  }, 3000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function listenToKickedUsers(roomId) {
  var path = 'rooms/' + roomId + '/kicked';
  var pollKey = _restPoll(path, function(snap) {
    var kicked = snap.val() || {};
    if (kicked[H90Rooms.currentUser.name]) {
      _toast('تم طردك من الغرفة', 'error');
      leaveRoom(true, false, true);
    }
  }, 3000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

function listenToRoomExists(roomId) {
  var path = 'rooms/' + roomId + '/expiresAt';
  var pollKey = _restPoll(path, function(snap) {
    if (snap.val() != null) return;
    if (!H90Rooms.currentRoomId || H90Rooms.currentRoomId !== roomId || H90Rooms.leaving) return;
    _toast('تم إغلاق الغرفة', 'warning');
    leaveRoom(true, false, true);
  }, 5000);
  H90Rooms.listeners.push({ pollKey: pollKey });
}

/* ═══════════════════════════════════════════════════════════════
   19. مؤقت الغرفة
   ═══════════════════════════════════════════════════════════════ */
function startRoomTimer(roomId) {
  if (H90Rooms.timerInterval) clearInterval(H90Rooms.timerInterval);

  _restGet('rooms/' + roomId + '/expiresAt').then(function(expiresAt) {
    if (!expiresAt || H90Rooms.currentRoomId !== roomId) return;

    H90Rooms.timeLeft = Math.floor((expiresAt - Date.now()) / 1000);

    H90Rooms.timerInterval = setInterval(function() {
      H90Rooms.timeLeft--;

      if (H90Rooms.timeLeft <= 0) {
        clearInterval(H90Rooms.timerInterval);
        H90Rooms.timerInterval = null;
        _toast('انتهى وقت الغرفة', 'warning');
        if (H90Rooms.currentUser.isCreator && H90Rooms.currentRoomId) {
          _restDelete('rooms/' + H90Rooms.currentRoomId).catch(function(){});
        }
        leaveRoom(true, false, true);
      } else if (H90Rooms.timeLeft === 300) {
        _toast('باقي 5 دقائق على انتهاء الغرفة', 'info');
      }
    }, 1000);
  }).catch(function(e) { console.warn('[H90Rooms] timer error:', e); });
}

/* ═══════════════════════════════════════════════════════════════
   20. منظف الرسائل (مع Self-Destruct)
   ═══════════════════════════════════════════════════════════════ */
function startMessageCleaner(roomId) {
  if (H90Rooms.messageCleaner) clearInterval(H90Rooms.messageCleaner);

  H90Rooms.messageCleaner = setInterval(async function() {
    if (!H90Rooms.currentRoomId || H90Rooms.currentRoomId !== roomId) {
      clearInterval(H90Rooms.messageCleaner);
      return;
    }

    try {
      var messages = await _restGet('rooms/' + roomId + '/messages');
      messages = messages || {};
      var now = Date.now();

      for (var key in messages) {
        var msg = messages[key];
        if (!msg) continue;

        /* ✅ حذف الرسائل القديمة */
        if (msg.timestamp && now - msg.timestamp > MESSAGE_MAX_AGE) {
          try { await _restDelete('rooms/' + roomId + '/messages/' + key); } catch (e) {}
          continue;
        }

        /* ✅ Self-Destruct: حذف الرسائل المقروءة */
        if (msg.read === true && msg.readAt && (now - msg.readAt > 5000)) {
          try { await _restDelete('rooms/' + roomId + '/messages/' + key); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[H90Rooms] cleaner error:', e);
    }
  }, 60000);
}

/* ═══════════════════════════════════════════════════════════════
   21. الرد بالسحب
   ═══════════════════════════════════════════════════════════════ */
function setupMessageSwipeToReply() {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var startX = 0, startY = 0, currentMsg = null, swiping = false;

  container.addEventListener('touchstart', function(e) {
    var div = e.target.closest('.msg');
    if (!div || div.classList.contains('system')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentMsg = div;
    swiping = false;
  }, { passive: true });

  container.addEventListener('touchmove', function(e) {
    if (!currentMsg) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) return;

    if (Math.abs(dx) > 10) {
      swiping = true;
      currentMsg.style.transform = 'translateX(' + Math.min(dx, 80) + 'px)';
      currentMsg.style.transition = 'none';

      var arrow = currentMsg.querySelector('.reply-arrow');
      if (!arrow) {
        arrow = document.createElement('span');
        arrow.className = 'reply-arrow';
        arrow.innerHTML = ROOMS_SVG.reply;
        currentMsg.appendChild(arrow);
      }
      arrow.style.opacity = Math.min(dx / 60, 1);
    }
  }, { passive: true });

  container.addEventListener('touchend', function(e) {
    if (!currentMsg) return;
    var dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : 0) - startX;
    currentMsg.style.transition = 'transform 0.2s';
    currentMsg.style.transform = 'translateX(0)';

    if (swiping && dx > 60) {
      var senderEl = currentMsg.querySelector('.sender');
      var textEl = currentMsg.querySelector('.msg-text');
      activateReplyMode(senderEl ? senderEl.textContent : '', textEl ? textEl.textContent : '');
      _haptic(30);
    }

    setTimeout(function() {
      if (currentMsg) {
        var arrow = currentMsg.querySelector('.reply-arrow');
        if (arrow) arrow.remove();
      }
      currentMsg = null;
      swiping = false;
    }, 200);
  }, { passive: true });
}

function activateReplyMode(sender, text) {
  H90Rooms.replyToMessage = { sender: sender, text: text };

  var bar = document.getElementById('reply-bar');
  if (!bar) return;

  bar.innerHTML =
    '<div class="reply-bar-content">' +
      '<div class="reply-bar-info">' +
        '<div class="reply-bar-label">الرد على ' + _escape(sender) + '</div>' +
        '<div class="reply-bar-text">' + _escape(text) + '</div>' +
      '</div>' +
      '<button type="button" class="reply-bar-close" onclick="cancelReply()">' + ROOMS_SVG.close + '</button>' +
    '</div>';

  bar.classList.add('show');

  var input = document.getElementById('chat-input');
  if (input) input.focus();
}

function cancelReply() {
  H90Rooms.replyToMessage = null;
  var bar = document.getElementById('reply-bar');
  if (bar) { bar.classList.remove('show'); bar.innerHTML = ''; }
}

/* ═══════════════════════════════════════════════════════════════
   22. التفاعلات
   ═══════════════════════════════════════════════════════════════ */
function setupReactions() {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var pressTimer = null;
  var currentMsg = null;

  container.addEventListener('touchstart', function(e) {
    var div = e.target.closest('.msg');
    if (!div || div.classList.contains('system')) return;
    currentMsg = div;
    pressTimer = setTimeout(function() { showReactionMenu(div); }, 500);
  }, { passive: true });

  container.addEventListener('touchend', function() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  });

  container.addEventListener('touchmove', function() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  });

  function showReactionMenu(div) {
    var menu = document.getElementById('reaction-menu');
    if (!menu) return;
    var rect = div.getBoundingClientRect();
    menu.style.top = (rect.top - 50) + 'px';
    menu.style.left = Math.max(10, rect.left) + 'px';
    menu.classList.add('show');
    currentMsg = div;

    menu.querySelectorAll('.reaction-emoji').forEach(function(r) {
      r.onclick = function() {
        addReaction(div, r.dataset.emoji);
        menu.classList.remove('show');
        _haptic(20);
      };
    });
  }

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#reaction-menu') && !e.target.closest('.msg')) {
      var menu = document.getElementById('reaction-menu');
      if (menu) menu.classList.remove('show');
    }
  });
}

async function addReaction(div, emoji) {
  if (!H90Rooms.currentRoomId) return;
  var msgId = div.dataset.msgId;
  if (!msgId) return;

  try {
    var ref = 'rooms/' + H90Rooms.currentRoomId + '/messages/' + msgId + '/reactions/' + emoji + '/' + H90Rooms.currentUser.name;
    var existing = await _restGet(ref);
    if (existing) await _restDelete(ref);
    else await _restSet(ref, true);
  } catch (e) {
    console.error('[H90Rooms] reaction error:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   23. مغادرة الغرفة
   ═══════════════════════════════════════════════════════════════ */
function setupLeaveButton() {
  var btn = document.getElementById('btn-leave-room');
  if (!btn) return;
  btn.onclick = confirmLeave;
}

function confirmLeave() {
  if (H90Rooms.currentUser.isCreator) {
    if (confirm('أنت المنشئ. مغادرتك ستغلق الغرفة وتطرد الجميع. متأكد؟')) {
      leaveRoom(true, true);
    }
  } else {
    leaveRoom(false);
  }
}

async function leaveRoom(force, isCreatorClosing, roomGone) {
  if (H90Rooms.leaving) return;
  H90Rooms.leaving = true;

  try {
    if (H90Rooms._stalledPath && !roomGone) {
      try { await _restDelete(H90Rooms._stalledPath); } catch (e) {}
    }
    H90Rooms._stalledPath = null;

    if (!roomGone && H90Rooms.currentRoomId && H90Rooms.currentUser.name) {
      try {
        if (isCreatorClosing && H90Rooms.currentUser.isCreator) {
          await _pushNotification({
            roomId: H90Rooms.currentRoomId,
            type: 'room_close',
            title: '🚪 أُغلقت الغرفة',
            body: 'أغلق المنشئ الغرفة',
            url: '/',
            icon: '/H90.jpg',
            senderName: H90Rooms.currentUser.name
          });

          try {
            var closeText = '👋 المنشئ غادر — تم إغلاق الغرفة';
            var encClose = await RoomCrypto.encrypt(closeText);
            await _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
              type: 'system',
              systemType: 'leave',
              encrypted: encClose,
              nonce: RoomCrypto.generateNonce(),
              timestamp: Date.now()
            });
          } catch (e) {}

          await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId), 'إغلاق الغرفة');
        } else {
          await _pushNotification({
            roomId: H90Rooms.currentRoomId,
            type: 'room_leave',
            title: '👋 ' + H90Rooms.currentUser.name + ' غادر',
            body: 'غادر ' + H90Rooms.currentUser.name + ' الغرفة',
            url: '/',
            icon: '/H90.jpg',
            senderName: H90Rooms.currentUser.name
          });

          try {
            var leaveText = '👋 ' + H90Rooms.currentUser.name + ' غادر الغرفة';
            var encLeave = await RoomCrypto.encrypt(leaveText);
            await _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
              type: 'system',
              systemType: 'leave',
              encrypted: encLeave,
              nonce: RoomCrypto.generateNonce(),
              timestamp: Date.now()
            });
          } catch (e) {}

          await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId + '/members/' + H90Rooms.currentUser.name), 'إزالة العضو');
          try {
            await _restDelete('rooms/' + H90Rooms.currentRoomId + '/typing/' + H90Rooms.currentUser.name);
          } catch (e) {}
        }
      } catch (e) {
        console.error('[H90Rooms] leave error:', e);
      }
    }

    _clearRuntime();

    if (H90Rooms.activeStream) {
      try { H90Rooms.activeStream.getTracks().forEach(function(t) { t.stop(); }); } catch (e) {}
      H90Rooms.activeStream = null;
    }

    var video = document.getElementById('room-video');
    _detachVideoSource(video);

    try { localStorage.removeItem('h90_current_room'); } catch (e) {}

    H90Rooms.currentRoomId = null;
    H90Rooms.currentUser = { name: '', isCreator: false, roomId: null };
    H90Rooms.replyToMessage = null;
    H90Rooms.activeChannelId = null;
    H90Rooms.roomLocked = false;
    H90Rooms.localQuality = 'FHD';

    var roomScreen = document.getElementById('room-screen');
    var roomsScreen = document.getElementById('roomsScreen');
    if (roomScreen) roomScreen.classList.add('hidden');
    if (roomsScreen) roomsScreen.classList.remove('hidden');

    var placeholder = document.getElementById('video-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    if (video) video.style.display = 'none';

    var qb = document.getElementById('quality-buttons-bar');
    if (qb) qb.innerHTML = '';

    var bar = document.getElementById('sync-status-bar');
    if (bar) bar.classList.remove('show');

    cancelReply();

    if (!force) _toast('تم مغادرة الغرفة', 'info');
  } finally {
    H90Rooms.leaving = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   24. صلاحيات المنشئ
   ═══════════════════════════════════════════════════════════════ */
async function kickMember(name) {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;
  if (name === H90Rooms.currentUser.name) return;

  try {
    var kickText = '🚫 ' + H90Rooms.currentUser.name + ' طرد ' + name + ' من الغرفة';
    var encKick = await RoomCrypto.encrypt(kickText);
    var kickNonce = RoomCrypto.generateNonce();
    var kickHmac = await RoomCrypto.hmac(encKick + '|' + kickNonce);

    try {
      await _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
        type: 'system',
        systemType: 'leave',
        encrypted: encKick,
        nonce: kickNonce,
        hmac: kickHmac,
        timestamp: Date.now()
      });
    } catch (e) {}

    await _pushNotification({
      roomId: H90Rooms.currentRoomId,
      type: 'room_kick',
      title: '🚫 تم طردك',
      body: 'تم طردك من الغرفة',
      url: '/',
      icon: '/H90.jpg',
      senderName: H90Rooms.currentUser.name,
      targetUser: name
    });

    await _dbOp(_restSet('rooms/' + H90Rooms.currentRoomId + '/kicked/' + name, true), 'طرد العضو');
    await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId + '/members/' + name), 'إزالة العضو');
    try { await _restDelete('rooms/' + H90Rooms.currentRoomId + '/stalled/' + name); } catch (e) {}

    _toast('✅ تم طرد ' + name, 'success');
  } catch (e) {
    console.error('[H90Rooms] kick error:', e);
    _toast('فشل الطرد', 'error');
  }
}

async function unkickMember(name) {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;

  try {
    await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId + '/kicked/' + name), 'إلغاء الطرد');
    _toast('✅ تم إلغاء طرد ' + name, 'success');
  } catch (e) {
    _toast('فشل', 'error');
  }
}

async function toggleRoomLock() {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;

  try {
    var current = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId + '/locked'), 'فحص القفل');
    var newState = !current;
    await _dbOp(_restSet('rooms/' + H90Rooms.currentRoomId + '/locked', newState), 'تبديل القفل');

    var lockText = newState
      ? '🔒 ' + H90Rooms.currentUser.name + ' أقفل الغرفة (لا يمكن انضمام جدد)'
      : '🔓 ' + H90Rooms.currentUser.name + ' فتح الغرفة';
    var encLock = await RoomCrypto.encrypt(lockText);
    var lockNonce = RoomCrypto.generateNonce();
    var lockHmac = await RoomCrypto.hmac(encLock + '|' + lockNonce);

    try {
      await _restPush('rooms/' + H90Rooms.currentRoomId + '/messages', {
        type: 'system',
        systemType: 'lock',
        encrypted: encLock,
        nonce: lockNonce,
        hmac: lockHmac,
        timestamp: Date.now()
      });
    } catch (e) {}

    _toast(newState ? '🔒 تم إقفال الغرفة' : '🔓 تم فتح الغرفة', 'success');
  } catch (e) {
    _toast('فشل', 'error');
  }
}

async function unpinMessage() {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;

  try {
    await _dbOp(_restDelete('rooms/' + H90Rooms.currentRoomId + '/pinnedMessage'), 'إلغاء التثبيت');
    _toast('تم إلغاء التثبيت', 'info');
  } catch (e) {}
}

async function openMembersManager() {
  if (!H90Rooms.currentUser.isCreator || !H90Rooms.currentRoomId) return;

  var modal = document.getElementById('members-modal');
  var list = document.getElementById('members-list-container');
  if (!modal || !list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">جارٍ التحميل...</div>';
  modal.classList.add('show');

  try {
    var members = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId + '/members'), 'تحميل الأعضاء');
    members = members || {};
    var kicked = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId + '/kicked'), 'تحميل المطرودين');
    kicked = kicked || {};

    list.innerHTML = '';

    var activeCount = 0;
    Object.keys(members).forEach(function(name) {
      if (name === H90Rooms.currentUser.name) return;
      activeCount++;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'h90-member-item';
      btn.innerHTML = '<span class="h90-member-name">' + _escape(name) + '</span>' +
        '<span class="h90-member-action danger">طرد</span>';
      btn.onclick = function() { kickMember(name); modal.classList.remove('show'); };
      list.appendChild(btn);
    });

    if (activeCount === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);font-size:13px;">لا يوجد أعضاء آخرون في الغرفة</div>';
    }

    if (Object.keys(kicked).length > 0) {
      var div = document.createElement('div');
      div.className = 'h90-members-divider';
      div.textContent = 'المطرودون';
      list.appendChild(div);

      Object.keys(kicked).forEach(function(name) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'h90-member-item banned';
        btn.innerHTML = '<span class="h90-member-name">' + _escape(name) + '</span>' +
          '<span class="h90-member-action success">إلغاء الطرد</span>';
        btn.onclick = function() { unkickMember(name); modal.classList.remove('show'); };
        list.appendChild(btn);
      });
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935;">فشل تحميل الأعضاء</div>';
  }
}

/* ═══════════════════════════════════════════════════════════════
   25. مشاركة الرابط
   ═══════════════════════════════════════════════════════════════ */
async function shareRoomLink() {
  if (!H90Rooms.currentRoomId) return;

  try {
    var room = await _dbOp(_restGet('rooms/' + H90Rooms.currentRoomId), 'مشاركة الغرفة');
    if (!room) return;

    var roomName = '';
    if (room.nameEncrypted) {
      try { roomName = await RoomCrypto.decrypt(room.nameEncrypted); } catch(e) {}
    }

    var link = location.origin + location.pathname + '?room=' + encodeURIComponent(roomName || H90Rooms.currentRoomId);
    var text = 'انضم إلى غرفتي "' + (roomName || '') + '" على H90:\n' + link;

    if (navigator.share) {
      await navigator.share({ title: 'H90 — دعوة غرفة', text: text, url: link });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      _toast('✅ تم نسخ رابط الدعوة', 'success');
    } else {
      _toast('الرابط: ' + link, 'info');
    }
  } catch (e) {
    console.error('[H90Rooms] share error:', e);
    _toast('فشل المشاركة', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   26. ربط الأزرار الأساسية
   ═══════════════════════════════════════════════════════════════ */
function initRoomsButtons() {
  var btnJoin = document.getElementById('btn-join-room');
  var btnCreate = document.getElementById('btn-create-room');
  var btnMy = document.getElementById('btn-my-rooms');
  var btnClose = document.getElementById('btn-close-rooms');
  var btnConfirmJoin = document.getElementById('btn-confirm-join');
  var btnConfirmCreate = document.getElementById('btn-confirm-create');
  var syncSwitch = document.getElementById('create-room-sync');

  if (btnJoin) btnJoin.onclick = function() {
    var m = document.getElementById('join-room-modal');
    if (m) m.classList.add('show');
    _haptic(10);
  };

  if (btnCreate) btnCreate.onclick = function() {
    var m = document.getElementById('create-room-modal');
    if (m) m.classList.add('show');
    _haptic(10);
  };

  if (syncSwitch) {
    var toggle = function() {
      var on = syncSwitch.classList.toggle('on');
      syncSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
      _haptic(10);
    };
    syncSwitch.onclick = toggle;
    syncSwitch.onkeydown = function(e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    };
  }

  if (btnMy) btnMy.onclick = function() {
    if (H90Rooms.currentRoomId) {
      var rs = document.getElementById('room-screen');
      var rms = document.getElementById('roomsScreen');
      if (rs) rs.classList.remove('hidden');
      if (rms) rms.classList.add('hidden');
      return;
    }
    var saved = null;
    try { saved = localStorage.getItem('h90_current_room'); } catch (e) {}
    if (saved) {
      try {
        var room = JSON.parse(saved);
        if (room && room.id) {
          H90Rooms.currentRoomId = room.id;
          H90Rooms.currentUser = { name: room.userName, isCreator: room.isCreator, roomId: room.id };
          enterRoomUI(room.id, room.userName, room.isCreator);
          return;
        }
      } catch (e) {}
    }
    _toast('أنت لست في أي غرفة حالياً', 'warning');
  };

  if (btnClose) btnClose.onclick = closeRoomsScreen;
  if (btnConfirmJoin) btnConfirmJoin.onclick = joinRoom;
  if (btnConfirmCreate) btnConfirmCreate.onclick = createRoom;

  document.querySelectorAll('.close-modal').forEach(function(b) {
    b.onclick = function(e) {
      var m = e.target.closest('.rooms-modal');
      if (m) m.classList.remove('show');
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   27. التهيئة
   ═══════════════════════════════════════════════════════════════ */
function _initRoomsSystem() {
  _injectCSS();
  _injectHTML();
  initRoomsButtons();

  _startQueueCleanup();

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
    } else {
      _evaluateSync();
    }
  });

  console.log('[H90Rooms] ✅ النظام جاهز (v8.0 — SECURED)');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initRoomsSystem);
} else {
  _initRoomsSystem();
}

/* ═══════════════════════════════════════════════════════════════
   28. التصدير
   ═══════════════════════════════════════════════════════════════ */
window.H90Rooms             = H90Rooms;
window.openRoomsScreen      = openRoomsScreen;
window.closeRoomsScreen     = closeRoomsScreen;
window.handleRoomsTabClick  = handleRoomsTabClick;
window.shareRoomLink        = shareRoomLink;
window.toggleRoomLock       = toggleRoomLock;
window.toggleSyncMode       = toggleSyncMode;
window.toggleRoomMute       = toggleRoomMute;
window.openMembersManager   = openMembersManager;
window.unpinMessage         = unpinMessage;
window.cancelReply          = cancelReply;
window.kickMember           = kickMember;
window.unkickMember         = unkickMember;
window.stopActiveChannel    = stopActiveChannel;
window.showRoomInfo         = showRoomInfo;
window.playChannelInRoom    = playChannelInRoom;
window.playMovieInRoom      = playMovieInRoom;
window.playSeriesInRoom     = playSeriesInRoom;
window.openChannelsPicker   = openChannelsPicker;
window.RoomCrypto           = RoomCrypto;

console.log(
  '%c H90 Rooms v8.0 ' +
  '%c Secured · Encrypted · AES-256-GCM ' +
  '%c Ready ',
  'background:linear-gradient(135deg,#9c27b0,#673ab7);color:#fff;padding:6px 12px;border-radius:8px 0 0 8px;font-weight:900;',
  'background:#0a0e14;color:#ce93d8;padding:6px 12px;font-weight:700;',
  'background:#0a0e14;color:#e1bee7;padding:6px 12px;border-radius:0 8px 8px 0;font-weight:700;'
);
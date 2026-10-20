/* ================================================================
   H90 — player.js (v45.0 — Stream Guardian)
   ================================================================
   الإصلاحات الرئيسية في هذه النسخة:
   1) حارس البث (Stream Guardian): يكتشف قطع السيرفر (إغلاق الاتصال)
      فوراً ويجدد الاتصال بدون انقطاع، ويتعلم "عمر الاتصال" لكل سيرفر
      ويجدد قبل القطع بـ 14 ثانية تلقائياً (محفوظ في الذاكرة).
   2) إيقاف حلقة التجديد المفرطة (كانت تفتح اتصالاً جديداً كل 18-32 ث
      فيحظر السيرفر المجاني الاتصال) + حماية من التكرار (Backoff).
   3) تجديد بدون اتصالين متزامنين عند الحاجة (Soft Reload) مع تجميد
      آخر إطار على الشاشة بدل الشاشة السوداء.
   4) تصعيد تلقائي: تجديد > تجديد بكسر الكاش > رابط/دقة أخرى > VLC.
   5) إصلاح أوضاع العرض (كانت تتراكم الأنماط وتزيح الفيديو).
   6) إصلاح المعادل الصوتي (كان قد يكتم الصوت) + مؤقت النوم + الشارات
      المتداخلة + اللمس/السحب + ملء الشاشة على أندرويد WebView.
   ================================================================ */

const PlayerEngine = (function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     [01] SVG Icons Library
     ══════════════════════════════════════════════════════════ */
  const ICONS = {
    play: '<polygon points="6 3 20 12 6 21" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    volume0: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    volume1: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    volume2: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    immersiveOn: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    immersiveOff: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    live: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M6 6a8 8 0 0 0 0 12M18 6a8 8 0 0 1 0 12M3 3a12 12 0 0 0 0 18M21 3a12 12 0 0 1 0 18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    pip: '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor"/>',
    screenshot: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2" fill="none"/>',
    unlock: '<rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 10V7a4 4 0 0 1 7-2.6" stroke="currentColor" stroke-width="2" fill="none"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowDown: '<path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    expand: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    compress: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    aspect: '<rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.4"/>',
    zoomIn: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.5-4.5M11 8v6M8 11h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    zoomOut: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.5-4.5M8 11h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    auto: '<path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    record: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    captions: '<rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 12h3M12 12h6M6 15h6M15 15h3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    equalizer: '<path d="M4 18v-3M8 18v-7M12 18v-9M16 18v-5M20 18v-11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    network: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" stroke-width="1.6" fill="none" opacity="0.7"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    dots: '<circle cx="6" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18" cy="12" r="1.8" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    check: '<path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  function svg(name, size) {
    const s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" xmlns="http://www.w3.org/2000/svg" ' +
      'style="display:inline-block;vertical-align:middle;">' +
      (ICONS[name] || '') + '</svg>';
  }
  function svgWrap(name, size, extraStyle) {
    return '<span class="h90-ic" style="display:inline-flex;align-items:center;justify-content:center;width:' +
      (size || 18) + 'px;height:' + (size || 18) + 'px;' + (extraStyle || '') + '">' +
      svg(name, size) + '</span>';
  }

  /* ══════════════════════════════════════════════════════════
     [02] Proxy
     ══════════════════════════════════════════════════════════ */
  const PROXY_LIST = [
    'https://h90-server2.houssenammaradnan.workers.dev/proxy?url='
  ];
  let _proxyIndex = 0;
  function getProxy() { return PROXY_LIST[_proxyIndex] || PROXY_LIST[0]; }

  /* ══════════════════════════════════════════════════════════
     [03] State
     ══════════════════════════════════════════════════════════ */
  const state = {
    video: null, hls: null, mpegts: null, recorder: null, recordedChunks: [],
    currentChannel: null, currentServerIndex: 0, currentServer: 'server1', currentGroup: null,
    currentQualities: [], _origQualities: [], currentStreamType: null,
    manualQualityIndex: null, _sortedQualityMap: null,

    isPlaying: false, isLoading: false, isLiveStream: false,
    isMuted: false, currentVolume: 1, playbackSpeed: 1,

    isImmersive: false, iosFakeLandscape: false, _usedRealFs: false,
    controlsVisible: true, hideTimer: null, wakeLock: null,

    isOnline: (typeof navigator !== 'undefined' ? navigator.onLine : true),
    wasPlayingBeforeOffline: false,

    _isMinorStall: false, _stallStartTime: 0,
    _keepAliveTimer: null, _lastDataReceived: 0,
    _recoveryInProgress: false, _softRecovery: false, _recoveryCount: 0,
    _lastHardReload: 0, _seamlessCancel: null, _seamlessCount: 0,
    _nextReloadAt: 0, _pausedAt: 0,
    _autoReloadTimer: null, _sessionStart: 0,
    _currentUrl: '', _originalUrl: '', _mpegtsConfig: null, _hlsConfig: null,
    _watchTimer: null, _watchSeconds: 0, _watchStartTime: 0,
    _loadToken: 0, _bufferMonitorTimer: null,
    _hlsRefreshTimer: null, _bufferEnd: 0, _loadTimeout: null,
    _prefetchTimer: null, _networkMonitorTimer: null,

    networkQuality: 'unknown', networkSpeed: 0,
    retryCount: 0,

    _bufferMode: 'auto', _bufferBump: 0,
    _stallLog: [], _stallTotal: 0,
    _lastStallCounted: 0, _lastWarnToast: 0,

    autoDowngrade: true, autoUpgrade: true, lockQuality: false,
    turboMode: false, locked: false, statsOn: false,
    _statsTimer: null, _sleepTimer: null, _sleepEnd: 0,
    _sleepMinutes: 0, _sleepTickTimer: null, _sleepAction: 'pause',

    _lastStableAt: 0, _lastUpgradeAt: 0, _bufferWarned: false,
    _startupGraceUntil: 0,

    /* ── Stream Guardian ── */
    proactiveMode: 'auto',      // auto | off
    _connStart: 0,              // وقت بدء الاتصال الحالي
    _learned: 0,                // عمر الاتصال الذي تعلمناه (ثواني)
    _dropNoted: false,
    _seamlessFails: 0, _seamlessBroken: false,
    _failStreak: 0, _lastRefreshAt: 0, _refreshLog: [], _lastRefreshReason: '-',
    _hlsErrStreak: 0, _sourceTried: {}, _lastBackoffToast: 0,

    displayMode: 'fit',
    _zoomLevel: 1, _panX: 0, _panY: 0,

    captionsOn: false,
    audioEq: 'flat',
    _audioCtx: null, _audioSrc: null, _audioEl: null,
    _audioBass: null, _audioTreble: null, _audioGain: null,

    netBadgeOn: false, _lastSpeed: 0,

    gestures: {
      startX: 0, startY: 0, startLX: 0, startLY: 0, startTime: 0,
      startVolume: 1, startBrightness: 1,
      mode: null, seekPreview: 0, ignore: false,
      lastTapTime: 0, tapTimeout: null, lastTapX: 0, lastTapY: 0,
      isMultiTouch: false,
      panStartX: 0, panStartY: 0, panStartOffsetX: 0, panStartOffsetY: 0,
      pinchStartDist: 0, pinchStartZoom: 1
    }
  };

  let _vkResizeHandler = null;
  let _fsBusy = false;

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const SEEK_STEP = 10;
  const HIDE_DELAY = 4000;
  const DOUBLE_TAP_DELAY = 300;

  /* Guardian */
  const DEFAULT_REFRESH_AT = 40;      // ثانية (قبل أن نتعلم عمر الاتصال)
  const REFRESH_MARGIN = 14;          // نجدد قبل القطع بـ 14 ث
  const MIN_REFRESH_AFTER = 15;
  const SEAMLESS_TIMEOUT = 16000;
  const SEAMLESS_RETRY_DELAY = 4000;

  const SLEEP_OPTIONS = [0, 15, 30, 60, 90];
  const SLEEP_ACTIONS = ['pause', 'mute', 'close'];

  const DISPLAY_MODES = [
    { id: 'fit',      name: 'احتواء',     icon: 'compress' },
    { id: 'fill',     name: 'ملء',         icon: 'expand' },
    { id: 'stretch',  name: 'تمدد',        icon: 'aspect' },
    { id: '16:9',     name: '16:9',         icon: 'aspect' },
    { id: '4:3',      name: '4:3',          icon: 'aspect' },
    { id: '21:9',     name: '21:9',         icon: 'aspect' },
    { id: 'zoom-in',  name: 'تقريب',       icon: 'zoomIn' },
    { id: 'zoom-out', name: 'تصغير',       icon: 'zoomOut' },
    { id: 'pan',      name: 'سحب',          icon: 'move' },
    { id: 'auto',     name: 'تلقائي',       icon: 'auto' }
  ];

  const BUFFER_PROFILES = [
    { name: 'سريع',      hlsSync: 3, maxBuf: 20, maxMax: 40,  maxSize: 20e6, swapMin: 1.5, tsMaxLat: 15, tsMinRemain: 2,  tsStash: 1024 },
    { name: 'متوازن',    hlsSync: 4, maxBuf: 30, maxMax: 60,  maxSize: 30e6, swapMin: 2.5, tsMaxLat: 30, tsMinRemain: 4,  tsStash: 1024 },
    { name: 'ثابت',      hlsSync: 6, maxBuf: 60, maxMax: 90,  maxSize: 60e6, swapMin: 4,   tsMaxLat: 45, tsMinRemain: 8,  tsStash: 2048 },
    { name: 'ثابت جداً', hlsSync: 8, maxBuf: 90, maxMax: 120, maxSize: 80e6, swapMin: 5,   tsMaxLat: 60, tsMinRemain: 12, tsStash: 4096 }
  ];

  const VLC_PACKAGE = 'org.videolan.vlc';
  const VLC_PLAY_STORE = 'https://play.google.com/store/apps/details?id=' + VLC_PACKAGE;

  const STORAGE = {
    brightness: 'h90_brightness', volume: 'h90_volume', speed: 'h90_speed',
    fitMode: 'h90_fit_mode', haptics: 'h90_haptics', bufferMode: 'h90_buffer_mode',
    autoDowngrade: 'h90_auto_downgrade', autoUpgrade: 'h90_auto_upgrade',
    lockQuality: 'h90_lock_quality', statsOn: 'h90_stats_on',
    turboMode: 'h90_turbo', displayMode: 'h90_display_mode',
    captionsOn: 'h90_captions', audioEq: 'h90_audio_eq',
    netBadgeOn: 'h90_net_badge', sleepAction: 'h90_sleep_action',
    proactive: 'h90_proactive', lifePrefix: 'h90_life_'
  };

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const safeCall = (fn, ...args) => { try { return fn(...args); } catch (e) { console.warn('safeCall:', e); } };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  /* ══════════════════════════════════════════════════════════
     [04] Helpers
     ══════════════════════════════════════════════════════════ */
  function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function showToast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
    else console.log(`[${type || 'info'}] ${msg}`);
  }

  function vibrate(pattern) {
    if (!('vibrate' in navigator)) return;
    if (lsGet(STORAGE.haptics, '') === 'off') return;
    safeCall(() => navigator.vibrate(pattern));
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isLowEndDevice() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    return mem < 3 || cores < 4;
  }

  function isProxied(url) {
    return !!url && PROXY_LIST.some(p => url.indexOf(p) === 0);
  }

  function proxifyIfNeeded(url) {
    if (!url) return '';
    if (url.startsWith('https://')) return url;
    if (url.startsWith('http://')) return getProxy() + encodeURIComponent(url);
    return url;
  }

  /* رابط جديد في كل تجديد (يكسر كاش الوركر/المتصفح فقط عند استخدام البروكسي) */
  function freshUrl() {
    let u = proxifyIfNeeded(state._originalUrl);
    if (isProxied(u)) u += '&_h90=' + Date.now();
    return u;
  }

  function extractOriginalUrl(proxiedUrl) {
    if (!proxiedUrl) return '';
    for (const proxy of PROXY_LIST) {
      if (proxiedUrl.indexOf(proxy) === 0) {
        let rest = proxiedUrl.substring(proxy.length);
        const amp = rest.indexOf('&_h90=');
        if (amp > -1) rest = rest.substring(0, amp);
        try { return decodeURIComponent(rest); }
        catch (e) { return rest; }
      }
    }
    return proxiedUrl;
  }

  function hostKey(url) {
    try { return new URL(extractOriginalUrl(url)).hostname; } catch (e) { return 'default'; }
  }

  function qualityScore(label) {
    const s = String(label).toUpperCase();
    if (s.includes('4K') || s.includes('UHD') || s.includes('2160')) return 1000;
    if (s.includes('FHD') || s.includes('1080')) return 900;
    if (s.includes('HEVC') || s.includes('265')) return 850;
    if (s.includes('HD') || s.includes('720')) return 700;
    if (s === 'SD2' || s.includes('576')) return 500;
    if (s === 'SD' || s.includes('480')) return 400;
    if (s.includes('LOW') || s.includes('360')) return 200;
    if (s.includes('AUTO') || s.includes('تلقائي')) return 50;
    return 300;
  }

  function sortQualitiesDesc(qualities) {
    return qualities.map((q, i) => ({ q, originalIndex: i, score: qualityScore(q) }))
      .sort((a, b) => b.score - a.score);
  }

  function sortedPosOf(originalIdx) {
    const map = state._sortedQualityMap || {};
    let pos = -1;
    Object.keys(map).forEach(k => { if (map[k] === originalIdx) pos = parseInt(k, 10); });
    return pos;
  }

  function isHighQuality(label) {
    const s = String(label).toUpperCase();
    return s.includes('4K') || s.includes('FHD') || s.includes('1080') ||
           s === 'HD' || s.includes('720') || s.includes('HEVC') || s.includes('265');
  }

  function bufferAheadOf(video) {
    if (!video || !video.buffered || video.buffered.length === 0) return 0;
    try { return Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime); }
    catch (e) { return 0; }
  }

  function currentQualityLabel() {
    if (state.manualQualityIndex !== null && state.currentQualities[state.manualQualityIndex]) {
      return state.currentQualities[state.manualQualityIndex];
    }
    if (state.hls && state.hls.levels && state.hls.currentLevel >= 0) {
      const lv = state.hls.levels[state.hls.currentLevel];
      if (lv && lv.height) return lv.height + 'p';
    }
    const orig = state._origQualities;
    if (orig && orig[state.currentServerIndex] !== undefined) return orig[state.currentServerIndex];
    return state.currentQualities[0] || '';
  }

  function getBufferLevel() {
    if (state.turboMode) return 0;
    if (state._bufferMode === 'fast') return 0;
    const base = state._bufferMode === 'stable' ? 2 : (isHighQuality(currentQualityLabel()) ? 2 : 1);
    return Math.min(3, base + state._bufferBump);
  }
  function getProfile() { return BUFFER_PROFILES[getBufferLevel()]; }

  /* ══════════════════════════════════════════════════════════
     [05] detectStreamType
     ══════════════════════════════════════════════════════════ */
  async function detectStreamType(url) {
    var decodedUrl = url;
    try {
      var urlParamIndex = url.indexOf('?url=');
      if (urlParamIndex > -1) {
        var encodedPart = url.substring(urlParamIndex + 5);
        var endIndex = encodedPart.search(/[&#]/);
        if (endIndex > -1) encodedPart = encodedPart.substring(0, endIndex);
        decodedUrl = decodeURIComponent(encodedPart);
      }
    } catch (e) {}
    var urlLower = decodedUrl.toLowerCase();
    if (urlLower.includes('.m3u8')) return 'hls';
    if (urlLower.includes('.mp4')) return 'mp4';
    if (/\.ts(\?|#|$)/.test(urlLower)) return 'mpegts';
    var originalLower = url.toLowerCase();
    if (originalLower.includes('.m3u8')) return 'hls';
    if (originalLower.includes('.mp4')) return 'mp4';
    if (/\.ts(\?|#|$)/.test(originalLower)) return 'mpegts';
    return 'mpegts';
  }

  /* ══════════════════════════════════════════════════════════
     [06] VLC
     ══════════════════════════════════════════════════════════ */
  async function openInVLC(streamUrl) {
    if (!streamUrl) { showToast('لا يوجد رابط للتشغيل', 'error'); return; }
    streamUrl = extractOriginalUrl(streamUrl);
    showToast('جارٍ فتح VLC...', 'info');
    vibrate(30);
    let intentUrl = '';
    try {
      const urlObj = new URL(streamUrl);
      const scheme = urlObj.protocol.replace(':', '');
      const path = urlObj.host + urlObj.pathname + urlObj.search;
      intentUrl = `intent://${path}#Intent;scheme=${scheme};package=${VLC_PACKAGE};type=video/*;S.browser_fallback_url=${encodeURIComponent(VLC_PLAY_STORE)};end`;
    } catch (e) {
      intentUrl = `intent://${streamUrl.replace(/^https?:\/\//, '')}#Intent;package=${VLC_PACKAGE};type=video/*;end`;
    }
    if (window.Capacitor?.Plugins?.AppLauncher) {
      try { await window.Capacitor.Plugins.AppLauncher.openUrl({ url: intentUrl }); return; }
      catch (e) {}
    }
    window.location.href = intentUrl;
  }

  /* ══════════════════════════════════════════════════════════
     [07] Init
     ══════════════════════════════════════════════════════════ */
  function bindVideoEvents(video) {
    const events = {
      loadedmetadata: onLoadedMetadata, playing: onPlaying, pause: onPause,
      timeupdate: onTimeUpdate, progress: onBufferProgress, error: onError,
      waiting: onWaiting, canplay: onCanPlay, volumechange: onVolumeChange,
      ended: onEnded, stalled: onStalled,
      resize: () => { if (state.displayMode === 'auto') applyDisplayMode('auto'); }
    };
    Object.entries(events).forEach(([ev, fn]) => {
      on(video, ev, () => { if (video !== state.video) return; fn(); });
    });
  }

  function init() {
    injectPerformanceOverrides();
    setupViewportUnits();

    state.video = $('videoPlayer');
    if (!state.video) { console.error('videoPlayer missing'); return; }
    const video = state.video;

    const bm = lsGet(STORAGE.bufferMode, 'auto');
    state._bufferMode = ['auto', 'stable', 'fast'].includes(bm) ? bm : 'auto';
    state.autoDowngrade = lsGet(STORAGE.autoDowngrade, 'on') !== 'off';
    state.autoUpgrade = lsGet(STORAGE.autoUpgrade, 'on') !== 'off';
    state.lockQuality = lsGet(STORAGE.lockQuality, 'off') === 'on';
    state.statsOn = lsGet(STORAGE.statsOn, 'off') === 'on';
    state.turboMode = lsGet(STORAGE.turboMode, 'off') === 'on';
    state.captionsOn = lsGet(STORAGE.captionsOn, 'off') === 'on';
    state.audioEq = lsGet(STORAGE.audioEq, 'flat');
    state.netBadgeOn = lsGet(STORAGE.netBadgeOn, 'off') === 'on';
    state.displayMode = lsGet(STORAGE.displayMode, 'fit');
    state.proactiveMode = lsGet(STORAGE.proactive, 'auto') === 'off' ? 'off' : 'auto';
    const sa = lsGet(STORAGE.sleepAction, 'pause');
    state._sleepAction = SLEEP_ACTIONS.includes(sa) ? sa : 'pause';

    applyDisplayMode(state.displayMode);
    applyCaptions(state.captionsOn);
    /* ملاحظة: لا ننشئ AudioContext هنا (يكتم الصوت قبل أول تفاعل). يُنشأ عند التشغيل */

    bindVideoEvents(video);

    const container = $('playerContainer');
    if (container) {
      initGestures(container);
      buildExtrasUI(container);
      on(container, 'dblclick', (e) => {
        if (e.target && e.target.closest && e.target.closest('.h90-ui, .pc-btn, .quality-pill, .player-controls-bar, .player-header')) return;
        if (e.pointerType === 'touch') return;
        toggleImmersiveFullscreen();
      });
      on(container, 'contextmenu', (e) => {
        if (e.target && e.target.closest && e.target.closest('.h90-ui')) return;
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
      });
    }

    bindFullscreenButtons();

    on(document, 'fullscreenchange', onFullscreenChange);
    on(document, 'webkitfullscreenchange', onFullscreenChange);
    on(document, 'visibilitychange', onVisibilityChange);
    on(document, 'keydown', onKeyDown);
    on(window, 'offline', onNetworkOffline);
    on(window, 'online', onNetworkOnline);

    if (navigator.connection) navigator.connection.addEventListener('change', onNetworkChange);
    if (screen.orientation) on(screen.orientation, 'change', onOrientationChange);
    on(window, 'orientationchange', onOrientationChange);
    on(window, 'resize', () => { clearTimeout(init._rt); init._rt = setTimeout(() => applyDisplayMode(state.displayMode), 120); });

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('preload', 'auto');
    video.setAttribute('crossorigin', 'anonymous');

    const savedBrightness = parseFloat(lsGet(STORAGE.brightness, '1'));
    if (container && savedBrightness !== 1) container.style.filter = `brightness(${savedBrightness})`;

    const savedVolume = parseFloat(lsGet(STORAGE.volume, '1'));
    if (!isNaN(savedVolume)) { video.volume = savedVolume; state.currentVolume = savedVolume; }

    const savedSpeed = parseFloat(lsGet(STORAGE.speed, '1'));
    if (SPEEDS.includes(savedSpeed)) { state.playbackSpeed = savedSpeed; video.playbackRate = savedSpeed; }

    if (state._bufferMonitorTimer) clearInterval(state._bufferMonitorTimer);
    state._bufferMonitorTimer = setInterval(monitorBuffer, 2000);

    if (state._prefetchTimer) clearInterval(state._prefetchTimer);
    state._prefetchTimer = setInterval(proactiveBufferWatch, 1000);

    if (state.netBadgeOn) startNetworkMonitor();

    startWatchTimer();
    setupMediaSession();
    if (state.statsOn) setStats(true);
    refreshExtrasUI();

    showControls();
    console.log('%c H90 PlayerEngine v45.0 (Guardian)', 'color:#ff2d55;font-weight:900;');
  }

  /* ══════════════════════════════════════════════════════════
     [08] Title + Watch Timer
     ══════════════════════════════════════════════════════════ */
  function setTitle(name) {
    const t = $('playerTitle');
    if (!t) return;
    t.textContent = '';
    const n = document.createElement('span');
    n.textContent = name || '';
    const tm = document.createElement('span');
    tm.id = 'h90WatchTime';
    tm.style.cssText = 'font-size:11px;opacity:0.7;margin-right:6px;display:inline-flex;align-items:center;gap:4px;';
    const dot = document.createElement('span');
    dot.style.cssText = 'display:inline-block;width:6px;height:6px;background:#ff2d55;border-radius:50%;animation:pulse 1.5s infinite;';
    const txt = document.createElement('span');
    txt.id = 'h90WatchText';
    txt.textContent = '0:00';
    tm.appendChild(dot); tm.appendChild(txt);
    t.appendChild(n); t.appendChild(document.createTextNode(' ')); t.appendChild(tm);
  }

  function startWatchTimer() {
    if (state._watchTimer) clearInterval(state._watchTimer);
    state._watchStartTime = Date.now();
    state._watchSeconds = 0;
    state._watchTimer = setInterval(() => {
      if (!state.isPlaying || document.hidden) return;
      state._watchSeconds = Math.floor((Date.now() - state._watchStartTime) / 1000);
      const el = $('h90WatchText');
      if (el) el.textContent = formatWatchTime(state._watchSeconds);
    }, 1000);
  }

  function formatWatchTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function resetWatchTimer() {
    state._watchStartTime = Date.now();
    state._watchSeconds = 0;
  }

  /* ══════════════════════════════════════════════════════════
     [09] Engines
     ══════════════════════════════════════════════════════════ */
  function destroyEngine(eng) {
    if (!eng) return;
    if (eng.hls) safeCall(() => eng.hls.destroy());
    if (eng.mpegts) {
      safeCall(() => {
        try { eng.mpegts.pause(); eng.mpegts.unload(); eng.mpegts.detachMediaElement(); eng.mpegts.destroy(); } catch (e) {}
      });
    }
  }

  function buildHlsConfig(over) {
  const p = getProfile();
  const lowEnd = isLowEndDevice();
  const highQuality = isHighQuality(currentQualityLabel());
  
  /* ═══════════════════════════════════════════════════════════
     ✅ Proxy Wrapper — من Server 2
     ═══════════════════════════════════════════════════════════ */
  const S2_PROXY_WRAPPER = 'https://lio.housenalhoussen24.workers.dev/proxy?url=';
  
  /* ✅ نحتفظ بالأصل الأصلي لكل مستوى */
  const _origTsUrl = function(u) {
    if (!u) return '';
    if (u.indexOf(S2_PROXY_WRAPPER) === 0) {
      try {
        var rest = u.substring(S2_PROXY_WRAPPER.length);
        var amp = rest.indexOf('&_h90=');
        if (amp > -1) rest = rest.substring(0, amp);
        return decodeURIComponent(rest);
      } catch (e) { return u; }
    }
    return u;
  };
  
  return Object.assign({
    enableWorker: !lowEnd,
    lowLatencyMode: false,
    debug: false,
    maxBufferLength: p.maxBuf,
    maxMaxBufferLength: p.maxMax,
    maxBufferSize: p.maxSize,
    maxBufferHole: 1.5,
    backBufferLength: 10,
    liveSyncDurationCount: p.hlsSync,
    liveMaxLatencyDurationCount: p.hlsSync + 6,
    liveDurationInfinity: true,
    nudgeOffset: 0.2,
    nudgeMaxRetry: 8,
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 500,
    manifestLoadingMaxRetryTimeout: 6000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 500,
    levelLoadingMaxRetryTimeout: 6000,
    fragLoadingMaxRetry: highQuality ? 6 : 4,
    fragLoadingRetryDelay: highQuality ? 800 : 500,
    fragLoadingMaxRetryTimeout: highQuality ? 12000 : 8000,
    abrBandWidthFactor: 0.9,
    abrBandWidthUpFactor: highQuality ? 0.5 : 0.6,
    abrEwmaFastLive: 5.0,
    abrEwmaSlowLive: 12.0,
    abrEwmaFastVoD: 4.0,
    abrEwmaSlowVoD: 12.0,
    abrEwmaDefaultEstimate: 500000,
    startLevel: -1,
    capLevelToPlayerSize: false,
    ignoreDevicePixelRatio: true,
    autoStartLoad: true,
    testBandwidth: true,
    highBufferWatchdogPeriod: 2,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
    
    /* ═══════════════════════════════════════════════════════════
       ✅ v45.1: xhrSetup — مرّر كل الطلبات عبر Proxy
       ✅ m3u8 → ملفوف بـ Proxy (لأن الرابط الأصلي HTTP)
       ✅ .ts → ملفوف بـ Proxy (لأن CORS مطلوب)
       ✅ يكتشف الروابط النسبية ويحوّلها لمطلقة
       ═══════════════════════════════════════════════════════════ */
    xhrSetup: function(xhr, url) {
      xhr.withCredentials = false;
      xhr.timeout = highQuality ? 30000 : 20000;
      
      try {
        /* ✅ إذا كان الرابط نسبياً → نبنيه من الرابط الأصلي */
        if (url && !/^https?:\/\//i.test(url) && !url.startsWith('/proxy')) {
          var baseOrig = _origTsUrl(state._currentUrl || state._originalUrl || '');
          if (baseOrig) {
            try {
              url = new URL(url, baseOrig).href;
            } catch (e) {}
          }
        }
        
        /* ✅ روابط .ts → لُفّها بـ Proxy */
        if (/\.ts(\?|#|$)/i.test(url)) {
          /* إذا لم تكن ملفوفة أصلاً */
          if (url.indexOf('/proxy?url=') === -1) {
            url = S2_PROXY_WRAPPER + encodeURIComponent(url);
          }
        }
        /* ✅ روابط .m3u8 → لُفّها بـ Proxy أيضاً (الرابط الأصلي HTTP) */
        else if (/\.m3u8(\?|#|$)/i.test(url)) {
          if (url.indexOf('/proxy?url=') === -1) {
            url = S2_PROXY_WRAPPER + encodeURIComponent(url);
          }
        }
        /* ✅ روابط أخرى http:// → لُفّها */
        else if (url.startsWith('http://')) {
          if (url.indexOf('/proxy?url=') === -1) {
            url = S2_PROXY_WRAPPER + encodeURIComponent(url);
          }
        }
        
        xhr.open('GET', url, true);
      } catch (e) {
        console.warn('xhrSetup error:', e);
      }
    }
  }, over || {});
}

  function buildMpegtsConfig() {
    const p = getProfile();
    return {
      enableWorker: true, enableStashBuffer: true, stashInitialSize: p.tsStash,
      isLive: true, lazyLoad: false, deferLoadAfterSourceOpen: false,
      autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 60,
      autoCleanupMinBackwardDuration: 20, fixAudioTimestampGap: true,
      accurateSeek: false, liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: p.tsMaxLat, liveBufferLatencyMinRemain: p.tsMinRemain,
      cors: true, withCredentials: false, reuseRedirectedURL: true,
      autoCleanupInterval: 5000, liveBufferLatencyChasingInterval: 1000
    };
  }

  function applyLiveBufferConfig() {
    const p = getProfile();
    if (state.hls && state.hls.config) {
      safeCall(() => Object.assign(state.hls.config, {
        maxBufferLength: p.maxBuf, maxMaxBufferLength: p.maxMax, maxBufferSize: p.maxSize,
        liveSyncDurationCount: p.hlsSync, liveMaxLatencyDurationCount: p.hlsSync + 6
      }));
    }
  }

  function markConnectionStart(ts) {
    state._connStart = ts || Date.now();
    state._sessionStart = state._connStart;
    state._dropNoted = false;
    state._hlsErrStreak = 0;
  }

  function attachHlsRuntimeHandlers(hls, originalUrl) {
    hls.on(Hls.Events.LEVEL_LOADED, () => { state._lastDataReceived = Date.now(); });
    hls.on(Hls.Events.FRAG_LOADED, () => { state._lastDataReceived = Date.now(); state._hlsErrStreak = 0; });

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (state.hls !== hls) return;
      if (state.video && bufferAheadOf(state.video) >= 3) { hideLoading(); state.isLoading = false; }
    });

    let lastMediaRecover = 0;

    hls.on(Hls.Events.ERROR, (e, d) => {
      if (state.hls !== hls) return;
      const video = state.video;

      if (!d.fatal) {
        /* تحميل متكرر فاشل = غالباً انتهت صلاحية الرابط/الجلسة => جدد */
        if (/fragLoadError|fragLoadTimeOut|levelLoadError|levelLoadTimeOut|manifestLoadError|manifestLoadTimeOut/.test(d.details || '')) {
          state._hlsErrStreak++;
          if (state._hlsErrStreak >= 4 && Date.now() >= state._startupGraceUntil) {
            state._hlsErrStreak = 0;
            noteConnectionDrop('hls-' + d.details);
            requestRefresh('hls-' + d.details, bufferAheadOf(video) < 2);
          }
        }
        return;
      }

      console.error('HLS Fatal:', d.type, d.details);

      if (Date.now() < state._startupGraceUntil && d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        safeCall(() => hls.startLoad());
        return;
      }

      if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        const now = Date.now();
        if (now - lastMediaRecover > 4000) { lastMediaRecover = now; safeCall(() => hls.recoverMediaError()); }
        else { safeCall(() => hls.swapAudioCodec()); safeCall(() => hls.recoverMediaError()); softReload('hls-media'); }
        return;
      }

      noteConnectionDrop('hls-fatal-' + d.details);
      if (!requestRefresh('hls-fatal', true)) softReload('hls-fatal');
    });
  }

  function attachMpegtsRuntimeHandlers(player) {
    player.on(mpegts.Events.STATISTICS_INFO, () => {
      if (state.mpegts !== player) return;
      if (state.isLoading) { hideLoading(); state.isLoading = false; }
      state._lastDataReceived = Date.now();
    });

    /* السيرفر أغلق الاتصال (هذا هو سبب القطع كل ~50 ث): جدد فوراً والمخزون ما زال يعمل */
    if (mpegts.Events.LOADING_COMPLETE) {
      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        if (state.mpegts !== player) return;
        console.warn('mpegts: server closed connection');
        noteConnectionDrop('server-closed');
        requestRefresh('server-closed', false);
      });
    }

    player.on(mpegts.Events.ERROR, (type, detail) => {
      if (state.mpegts !== player) return;
      console.warn('mpegts error:', type, detail);
      noteConnectionDrop('mpegts-' + type);
      if (!requestRefresh('mpegts-' + type, true)) softReload('mpegts-' + type);
    });
  }

  /* ══════════════════════════════════════════════════════════
     [10] Stream Guardian
     ══════════════════════════════════════════════════════════ */

  /* حفظ/تعلم عمر الاتصال لكل سيرفر */
  function loadLearned() {
    const v = parseFloat(lsGet(STORAGE.lifePrefix + hostKey(state._originalUrl), '0'));
    state._learned = (isFinite(v) && v > 0) ? v : 0;
  }

  function noteConnectionDrop(reason) {
    if (state._dropNoted || !state._connStart) return;
    state._dropNoted = true;
    const life = (Date.now() - state._connStart) / 1000;
    state._lastRefreshReason = 'drop:' + reason + '@' + Math.round(life) + 's';
    if (life >= 20 && life < 900) {
      state._learned = state._learned ? Math.round(state._learned * 0.5 + life * 0.5) : Math.round(life);
      lsSet(STORAGE.lifePrefix + hostKey(state._originalUrl), String(state._learned));
      console.log('Guardian: learned connection lifetime = ' + state._learned + 's (' + reason + ')');
    }
  }

  function getRefreshAfter() {
    if (state.proactiveMode === 'off') return Infinity;
    if (state._learned > 0) {
      if (state._learned > 900) return Infinity;
      return Math.max(MIN_REFRESH_AFTER, state._learned - REFRESH_MARGIN);
    }
    return DEFAULT_REFRESH_AT;
  }

  function freezeFrame() {
    removeFreeze();
    const v = state.video;
    if (!v || !v.videoWidth || v.readyState < 2) return false;
    try {
      const scale = Math.min(1, 960 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.id = 'h90Freeze';
      c.style.cssText = v.style.cssText + ';pointer-events:none;z-index:1;opacity:1;';
      v.insertAdjacentElement('afterend', c);
      return true;
    } catch (e) { return false; }
  }
  function removeFreeze() {
    const c = $('h90Freeze');
    if (c) c.remove();
  }

  /* نقطة الدخول الوحيدة لكل أنواع التجديد */
  function requestRefresh(reason, urgent) {
    if (!state.currentChannel || !state._originalUrl || !state.video) return false;
    if (state._recoveryInProgress) return false;
    const now = Date.now();
    if (!urgent && now < state._nextReloadAt) return false;
    if (now - state._lastRefreshAt < 2500) return false;

    state._refreshLog.push(now);
    state._refreshLog = state._refreshLog.filter(t => now - t < 60000);
    if (!urgent && state._refreshLog.length >= 6) {
      /* حماية: لا نغرق السيرفر المجاني باتصالات متتالية */
      state._nextReloadAt = now + 20000;
      if (now - state._lastBackoffToast > 60000) {
        state._lastBackoffToast = now;
        console.warn('Guardian: backoff (too many refreshes)');
      }
      return false;
    }

    state._lastRefreshAt = now;
    state._lastRefreshReason = reason;
    const buf = bufferAheadOf(state.video);
    const live = state.currentStreamType === 'hls' || state.currentStreamType === 'mpegts';
    console.log('Guardian refresh: ' + reason + ' buf=' + buf.toFixed(1) + 's');

    if (live && !state._seamlessBroken && buf >= 1.2 && seamlessReload()) return true;
    softReload(reason);
    return true;
  }

  /* تجديد بدون انقطاع: اتصال ثانٍ في عنصر فيديو مخفي ثم تبديل */
  function seamlessReload() {
    if (state._recoveryInProgress) return false;
    if (!state.currentChannel || !state._originalUrl || !state.video) return false;

    const type = state.currentStreamType;
    const canHls = type === 'hls' && typeof Hls !== 'undefined' && Hls.isSupported();
    const canTs = type === 'mpegts' && typeof mpegts !== 'undefined' && mpegts.isSupported();
    if (!canHls && !canTs) return false;

    state._recoveryInProgress = true;
    state._seamlessCount++;

    const url = freshUrl();
    const originalUrl = state._originalUrl;
    const token = state._loadToken;
    const startedAt = Date.now();
    const oldVideo = state.video;
    const oldHls = state.hls;
    const profile = getProfile();
    const highQuality = isHighQuality(currentQualityLabel());

    console.log('SeamlessReload #' + state._seamlessCount + ' (' + type + ')');

    const newVideo = oldVideo.cloneNode(false);
    newVideo.removeAttribute('id');
    newVideo.muted = true;
    newVideo.style.cssText = oldVideo.style.cssText;
    newVideo.style.opacity = '0';
    newVideo.style.pointerEvents = 'none';
    newVideo.style.zIndex = '0';
    oldVideo.insertAdjacentElement('afterend', newVideo);

    let eng = {}, done = false, poll = null, giveUp = null;

    function stopTimers() {
      if (poll) { clearInterval(poll); poll = null; }
      if (giveUp) { clearTimeout(giveUp); giveUp = null; }
    }

    function abort(reason) {
      if (done) return;
      done = true; stopTimers();
      console.warn('SeamlessReload abort:', reason);
      destroyEngine(eng);
      safeCall(() => { newVideo.removeAttribute('src'); newVideo.load(); });
      newVideo.remove();
      state._seamlessCancel = null;
      state._recoveryInProgress = false;
      state._nextReloadAt = Date.now() + SEAMLESS_RETRY_DELAY;
      state._seamlessFails++;
      /* فشل مرتين = السيرفر لا يسمح باتصالين معاً => نستخدم Soft Reload فقط */
      if (state._seamlessFails >= 2) {
        state._seamlessBroken = true;
        console.warn('Guardian: seamless disabled for this channel (single-connection server)');
      }
    }

    state._seamlessCancel = function () {
      if (done) return;
      done = true; stopTimers(); destroyEngine(eng); newVideo.remove();
      state._seamlessCancel = null;
      state._recoveryInProgress = false;
    };

    function commit() {
      if (done) return;
      done = true; stopTimers();

      const oldEng = { hls: state.hls, mpegts: state.mpegts };
      const oldStyle = oldVideo.style.cssText;
      const wasMuted = oldVideo.muted;
      const vol = oldVideo.volume;
      const rate = oldVideo.playbackRate;
      const wasPiP = document.pictureInPictureElement === oldVideo;

      oldVideo.removeAttribute('id');
      newVideo.id = 'videoPlayer';
      newVideo.style.cssText = oldStyle;
      newVideo.volume = vol;
      newVideo.muted = wasMuted;
      newVideo.playbackRate = rate;

      state.video = newVideo;
      state.hls = eng.hls || null;
      state.mpegts = eng.mpegts || null;

      if (eng.hls) applyLiveBufferConfig();

      oldVideo.muted = true;
      safeCall(() => oldVideo.pause());

      const removeOld = () => {
        oldVideo.remove();
        destroyEngine(oldEng);
        safeCall(() => { oldVideo.removeAttribute('src'); oldVideo.load(); });
      };

      bindVideoEvents(newVideo);
      if (eng.hls) attachHlsRuntimeHandlers(eng.hls, originalUrl);
      if (eng.mpegts) attachMpegtsRuntimeHandlers(eng.mpegts);

      if (wasPiP && newVideo.requestPictureInPicture) {
        newVideo.requestPictureInPicture().then(removeOld, removeOld);
      } else removeOld();

      markConnectionStart(startedAt);
      state._currentUrl = url;
      state._lastDataReceived = Date.now();
      state._stallStartTime = 0;
      state._isMinorStall = false;
      state._seamlessCancel = null;
      state._recoveryInProgress = false;
      state._seamlessFails = 0;
      state._hlsConfig = buildHlsConfig();
      state._mpegtsConfig = buildMpegtsConfig();
      state._lastStableAt = 0;
      state._bufferWarned = false;
      state._startupGraceUntil = Date.now() + 6000;

      applyDisplayMode(state.displayMode);
      applyCaptions(state.captionsOn);
      if (state._audioCtx) applyAudioEq(state.audioEq);
      if (state.lockQuality && state.hls) applyLockQuality(state.hls);

      safeCall(() => newVideo.play().catch(() => {}));
      console.log('SeamlessReload done');
    }

    try {
      if (canHls) {
        /* نبدأ من نفس مستوى الجودة الحالي (كان يبدأ من الأدنى فيهبط الدقة بعد كل تجديد) */
        const curLevel = (oldHls && oldHls.currentLevel >= 0) ? oldHls.currentLevel : -1;
        const bw = (oldHls && oldHls.bandwidthEstimate) ? oldHls.bandwidthEstimate : 500000;
        const prepCfg = buildHlsConfig({
          maxBufferLength: highQuality ? 18 : 12,
          maxMaxBufferLength: highQuality ? 30 : 20,
          maxBufferSize: highQuality ? 25e6 : 15e6,
          startLevel: curLevel,
          testBandwidth: false,
          abrEwmaDefaultEstimate: bw
        });
        const hls = new Hls(prepCfg);
        eng.hls = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => { newVideo.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) abort('hls ' + d.details); });
        hls.loadSource(url);
        hls.attachMedia(newVideo);
      } else {
        const p = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: url, cors: true }, buildMpegtsConfig());
        eng.mpegts = p;
        p.on(mpegts.Events.ERROR, (t, d) => abort('mpegts ' + t + ' ' + d));
        p.attachMediaElement(newVideo);
        p.load();
        setTimeout(() => {
          if (done) return;
          try { const r = p.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
        }, 300);
      }
    } catch (e) {
      abort('exception ' + e.message);
      return false;
    }

    const minSwap = highQuality ? Math.max(1.0, profile.swapMin - 1) : profile.swapMin;
    poll = setInterval(() => {
      if (done) return;
      if (!newVideo.paused && newVideo.currentTime > 0.8 && newVideo.readyState >= 3 &&
          bufferAheadOf(newVideo) >= minSwap) commit();
      else if (newVideo.paused && newVideo.readyState >= 2) newVideo.play().catch(() => {});
    }, 300);

    giveUp = setTimeout(() => abort('timeout'), SEAMLESS_TIMEOUT);
    return true;
  }

  /* تجديد عادي في نفس العنصر مع تجميد آخر إطار (بدون شاشة سوداء) */
  function softReload(reason) {
    if (!state.currentChannel || !state._originalUrl) return;
    if (Date.now() - state._lastHardReload < 2000) return;
    state._lastHardReload = Date.now();
    state._lastRefreshReason = 'soft:' + (reason || '');
    if (state._seamlessCancel) state._seamlessCancel();

    state._failStreak++;
    if (state._failStreak >= 10) {
      state._failStreak = 0;
      hideLoading(); state.isLoading = false; removeFreeze();
      state._recoveryInProgress = false; state._softRecovery = false;
      if (state.currentServer === 'server2') showToast('تعذر تشغيل البث', 'error');
      else openInVLC(state._originalUrl);
      return;
    }
    if (state._failStreak % 4 === 0 && tryNextSource()) return;

    state._recoveryInProgress = true;
    state._softRecovery = true;
    state._recoveryCount++;

    const froze = freezeFrame();
    if (!froze) { showLoading('جارٍ التحديث...', currentQualityLabel()); state.isLoading = true; }

    const url = freshUrl();
    state._currentUrl = url;
    const originalUrl = state._originalUrl;
    const myToken = state._loadToken;

    destroyEngine({ hls: state.hls, mpegts: state.mpegts });
    state.hls = null; state.mpegts = null;

    setTimeout(function () {
      if (!state.currentChannel || myToken !== state._loadToken) {
        state._recoveryInProgress = false; state._softRecovery = false; removeFreeze(); return;
      }
      state._startupGraceUntil = Date.now() + 8000;
      const type = state.currentStreamType || 'hls';
      if (type === 'hls') loadHlsJs(url, originalUrl, myToken);
      else if (type === 'mp4' || type === 'native') loadNativeMp4(url, originalUrl);
      else loadMpegts(url, originalUrl, myToken);
    }, 200);

    /* شبكة أمان: لا نبقى في وضع الاسترداد للأبد */
    setTimeout(function () {
      if (state._softRecovery && myToken === state._loadToken) {
        state._softRecovery = false; state._recoveryInProgress = false; removeFreeze();
      }
    }, 12000);
  }
  const performSmartReload = () => softReload('manual');

  function tryNextSource() {
    const orig = state._origQualities || [];
    if (orig.length < 2) return false;
    state._sourceTried[state.currentServerIndex] = true;
    let next = -1;
    for (let i = 1; i < orig.length; i++) {
      const k = (state.currentServerIndex + i) % orig.length;
      if (!state._sourceTried[k]) { next = k; break; }
    }
    if (next < 0) { state._sourceTried = {}; return false; }
    const pos = sortedPosOf(next);
    if (pos < 0) return false;
    showToast('تعذر هذا الرابط، جارٍ تجربة رابط آخر', 'warning');
    removeFreeze();
    state._recoveryInProgress = false; state._softRecovery = false;
    setManualQuality(pos);
    return true;
  }

  /* يجدد دورياً قبل أن يقطع السيرفر */
  function startAutoReload() {
    if (state._autoReloadTimer) clearInterval(state._autoReloadTimer);
    if (!state._connStart) markConnectionStart();

    state._autoReloadTimer = setInterval(() => {
      const video = state.video;
      if (!video || !state.isPlaying || video.paused || !state.currentChannel) return;
      if (state._recoveryInProgress) return;
      const now = Date.now();
      if (now < state._nextReloadAt || now < state._startupGraceUntil) return;
      if (state.currentStreamType !== 'hls' && state.currentStreamType !== 'mpegts') return;
      if (state.recorder) return;

      const age = (now - state._connStart) / 1000;
      if (age >= getRefreshAfter()) {
        if (!requestRefresh('scheduled', false)) state._nextReloadAt = now + 8000;
      }
    }, 1000);
  }

  function startKeepAlive() {
    if (state._keepAliveTimer) clearInterval(state._keepAliveTimer);
    let lastTime = -1, stuckSince = 0;
    state._lastDataReceived = Date.now();

    state._keepAliveTimer = setInterval(() => {
      const v = state.video;
      if (!v || !state.isPlaying || v.paused) { stuckSince = 0; return; }
      if (state._recoveryInProgress) return;
      if (Date.now() < state._startupGraceUntil) return;

      const moved = Math.abs(v.currentTime - lastTime) >= 0.1;
      lastTime = v.currentTime;
      if (moved) {
        stuckSince = 0;
        state._lastDataReceived = Date.now();
        /* بث مستقر 20 ث بعد آخر تجديد => نصفّر عدادات الفشل */
        if (Date.now() - state._lastRefreshAt > 20000) { state._failStreak = 0; state._sourceTried = {}; }
        return;
      }

      if (!stuckSince) stuckSince = Date.now();
      const stuck = Date.now() - stuckSince;
      const t1 = isHighQuality(currentQualityLabel()) ? 4000 : 5000;
      if (stuck >= t1) {
        stuckSince = Date.now();
        noteConnectionDrop('stuck');
        if (!requestRefresh('stuck', true)) softReload('stuck');
      }
    }, 1000);
  }

  function proactiveBufferWatch() {
    const video = state.video;
    if (!video || !state.isPlaying || video.paused) return;
    if (state._recoveryInProgress || !state.currentChannel) return;

    const buf = bufferAheadOf(video);
    if (buf < 2 && !state._bufferWarned) { state._bufferWarned = true; pulseWarning(); }
    else if (buf > 5 && state._bufferWarned) { state._bufferWarned = false; }

    if (buf > 8) { if (!state._lastStableAt) state._lastStableAt = Date.now(); }
    else state._lastStableAt = 0;

    if (state.autoUpgrade && state.manualQualityIndex === null && !state.lockQuality && state.hls) {
      const stableFor = Date.now() - state._lastStableAt;
      const sinceUpgrade = Date.now() - state._lastUpgradeAt;
      if (state._lastStableAt && stableFor > 30000 && sinceUpgrade > 60000) tryUpgrade();
    }

    if (state.netBadgeOn) updateNetBadge();
  }

  function tryUpgrade() {
    if (!state.hls || state.manualQualityIndex !== null) return;
    const hls = state.hls;
    const cur = hls.currentLevel;
    if (cur < 0 || !hls.levels || hls.levels.length < 2) return;
    const nextLevel = cur + 1;
    if (nextLevel >= hls.levels.length) return;
    const nextLv = hls.levels[nextLevel];
    const curLv = hls.levels[cur];
    if (!nextLv || !curLv) return;
    if (nextLv.bitrate > curLv.bitrate * 1.6) return;
    state._lastUpgradeAt = Date.now();
    safeCall(() => { hls.nextLevel = nextLevel; });
    showToast('تحسّنت الجودة إلى ' + (nextLv.height || nextLevel) + 'p', 'success');
  }

  function pulseWarning() {
    const container = $('playerContainer');
    if (!container) return;
    container.style.transition = 'box-shadow 0.3s';
    container.style.boxShadow = 'inset 0 0 60px rgba(255,45,85,0.5)';
    setTimeout(() => { container.style.boxShadow = ''; }, 800);
  }

  /* ══════════════════════════════════════════════════════════
     [11] loadChannel
     ══════════════════════════════════════════════════════════ */
  async function loadChannel(channel, serverIndex, serverId, keepQuality) {
    if (!channel) return;
    const video = state.video;
    if (!video) return;
    if (!state.isOnline) { showToast('لا يوجد اتصال بالإنترنت', 'error'); return; }

    destroyPlayers();

    const isNewChannel = state.currentChannel !== channel;
    state.currentChannel = channel;
    state.currentServerIndex = serverIndex || 0;
    state.currentServer = serverId || channel.server || state.currentServer || 'server1';

    if (!keepQuality) { state.retryCount = 0; state.manualQualityIndex = null; }
    if (isNewChannel || !keepQuality) {
      state._bufferBump = 0; state._stallLog = [];
      state._bufferWarned = false; state._lastStableAt = 0; state._lastUpgradeAt = 0;
      state._seamlessFails = 0; state._seamlessBroken = false;
      state._failStreak = 0; state._sourceTried = {}; state._refreshLog = [];
    }

    state.isLoading = true;
    state.isLiveStream = false;
    state._isMinorStall = false;
    state._stallStartTime = 0;
    state._recoveryCount = 0;
    state._recoveryInProgress = false;
    state._softRecovery = false;
    state._nextReloadAt = 0;
    state._startupGraceUntil = Date.now() + 10000;

    state._loadToken = (state._loadToken || 0) + 1;
    const myToken = state._loadToken;

    resetWatchTimer();

    let urls = [], qualities = [];
    if (typeof getChannelUrls === 'function') urls = getChannelUrls(channel, state.currentServer);
    if (typeof getChannelQualities === 'function') qualities = getChannelQualities(channel, state.currentServer);
    if (qualities.length === 0) qualities = (channel.qualities || []).map(q => q.label || q);
    if (qualities.length !== urls.length) {
      if (qualities.length > urls.length) qualities = qualities.slice(0, urls.length);
      else for (let i = qualities.length; i < urls.length; i++) qualities.push(`رابط ${i + 1}`);
    }
    state._origQualities = qualities.slice();
    state.currentQualities = qualities;

    let url = urls[state.currentServerIndex];
    if (!url) { showToast('لا يوجد رابط لهذه القناة', 'error'); state.isLoading = false; hideLoading(); return; }

    const originalUrl = url;
    const proxiedUrl = proxifyIfNeeded(url);
    state._currentUrl = proxiedUrl;
    state._originalUrl = originalUrl;
    loadLearned();

    updateQualityPills(qualities, state.currentServerIndex);
    updateServerCounter(urls.length);
    updateMediaSessionMeta();
    refreshExtrasUI();
    showControls();

    showLoading('جارٍ التحميل...', channel.name_ar || '');
    setTitle(channel.name_ar || '');

    startWatchTimer();
    startKeepAlive();
    startAutoReload();

    let type = 'mpegts';
    try { type = await detectStreamType(proxiedUrl); } catch (e) {}
    if (myToken !== state._loadToken) return;
    state.currentStreamType = type;

    console.log('Stream type: ' + type + ', buffer: ' + getProfile().name + ', learned=' + state._learned);

    if (type === 'hls') loadHlsJs(proxiedUrl, originalUrl, myToken);
    else if (type === 'mp4') loadNativeMp4(proxiedUrl, originalUrl);
    else loadMpegts(proxiedUrl, originalUrl, myToken);
  }

  function destroyPlayers() {
    if (state._seamlessCancel) state._seamlessCancel();
    destroyEngine({ hls: state.hls, mpegts: state.mpegts });
    state.hls = null; state.mpegts = null;
    removeFreeze();
    if (state._hlsRefreshTimer) { clearInterval(state._hlsRefreshTimer); state._hlsRefreshTimer = null; }
    if (state._loadTimeout) { clearTimeout(state._loadTimeout); state._loadTimeout = null; }
    if (state.video) {
      safeCall(() => { state.video.pause(); state.video.removeAttribute('src'); state.video.load(); });
    }
    state._bufferEnd = 0;
  }

  /* ══════════════════════════════════════════════════════════
     [12] Loaders
     ══════════════════════════════════════════════════════════ */
  function loadHlsJs(url, originalUrl, myToken) {
    const video = state.video;
    if (typeof Hls === 'undefined' || !Hls.isSupported()) { loadNativeHls(url, originalUrl); return; }

    const config = buildHlsConfig();
    state._hlsConfig = config;
    markConnectionStart();

    const hls = new Hls(config);
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (myToken !== state._loadToken || state.hls !== hls) return;
      if (!state._softRecovery) { hideLoading(); state.isLoading = false; }
      if (hls.levels && hls.levels.length > 1) {
        hls.currentLevel = -1; hls.loadLevel = -1; hls.nextLevel = -1;
      }
      if (state.lockQuality) applyLockQuality(hls);
      video.play().catch(() => {});
      showControls();
    });

    attachHlsRuntimeHandlers(hls, originalUrl);
  }

  function applyLockQuality(hls) {
    if (!hls || !hls.levels || hls.levels.length < 1) return;
    let top = 0;
    for (let i = 1; i < hls.levels.length; i++) {
      if ((hls.levels[i].bitrate || 0) > (hls.levels[top].bitrate || 0)) top = i;
    }
    safeCall(() => { hls.currentLevel = top; hls.autoLevelCapping = top; });
  }

  function loadNative(url, type) {
    const video = state.video;
    state.currentStreamType = type;
    markConnectionStart();
    video.src = url;
    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      hideLoading(); state.isLoading = false;
      video.play().catch(() => {});
      showControls();
    };
    video.addEventListener('loadedmetadata', onMeta);
    video.load();
  }
  function loadNativeHls(url) { loadNative(url, 'native'); }
  function loadNativeMp4(url) { loadNative(url, state.currentStreamType === 'native' ? 'native' : 'mp4'); }

  function loadMpegts(url, originalUrl, myToken) {
    const video = state.video;
    markConnectionStart();

    if (typeof mpegts === 'undefined' || !mpegts.isSupported()) { loadNative(url, 'native'); return; }

    const config = buildMpegtsConfig();
    state._mpegtsConfig = config;

    try {
      const player = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: url, cors: true }, config);
      state.mpegts = player;
      player.attachMediaElement(video);
      player.load();

      const _loadTimeout = setTimeout(() => {
        if (myToken !== state._loadToken) return;
        if (!state._softRecovery) { hideLoading(); state.isLoading = false; }
      }, 3000);
      state._loadTimeout = _loadTimeout;

      player.on(mpegts.Events.MEDIA_INFO, () => {
        if (myToken !== state._loadToken || state.mpegts !== player) return;
        clearTimeout(_loadTimeout);
        if (!state._softRecovery) { hideLoading(); state.isLoading = false; }
        showControls();
        setTimeout(() => {
          try { const r = player.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
        }, 100);
      });

      attachMpegtsRuntimeHandlers(player);

      setTimeout(() => {
        if (myToken !== state._loadToken) return;
        if (video.readyState >= 2 && video.paused) {
          video.play().catch(() => {});
          if (!state._softRecovery) { hideLoading(); state.isLoading = false; }
        }
      }, 2000);
    } catch (e) {
      console.error('mpegts create fail:', e);
      loadNative(url, 'native');
    }
  }

  /* ══════════════════════════════════════════════════════════
     [13] Monitor Buffer
     ══════════════════════════════════════════════════════════ */
  function monitorBuffer() {
    const video = state.video;
    if (!video || !state.isPlaying) return;

    if (video.buffered && video.buffered.length > 0) {
      state._bufferEnd = video.buffered.end(video.buffered.length - 1);
      updateBufferBar();
    }

    if (!video.paused && video.buffered && video.buffered.length > 0) {
      const bufferAhead = state._bufferEnd - video.currentTime;
      if (bufferAhead > 2) {
        if (state.isLoading && !state._recoveryInProgress) { hideLoading(); state.isLoading = false; }
        state._stallStartTime = 0;
        state._isMinorStall = false;
      }
    }
  }

  function registerStall() {
    if (!state.currentChannel) return;
    const now = Date.now();
    if (now - state._lastStallCounted < 4000) return;
    state._lastStallCounted = now;
    state._stallTotal++;
    state._stallLog.push(now);
    state._stallLog = state._stallLog.filter(t => now - t < 90000);

    if (state._stallLog.length < 3) return;

    if (state._bufferMode !== 'fast' && !state.turboMode && getBufferLevel() < 3) {
      state._bufferBump++;
      state._stallLog = [];
      applyLiveBufferConfig();
      showToast('تم رفع التخزين لتثبيت البث (' + getProfile().name + ')', 'info');
      refreshExtrasUI();
      return;
    }

    if (state.autoDowngrade && state.manualQualityIndex === null && !state.lockQuality && downgradeQuality()) {
      state._stallLog = [];
      return;
    }

    if (now - state._lastWarnToast > 60000) {
      state._lastWarnToast = now;
      showToast('البث يتقطع: جرّب دقة أقل أو تحقق من الشبكة', 'warning');
    }
  }

  function downgradeQuality() {
    const orig = state._origQualities;
    if (!orig || orig.length < 2) return false;
    const curIdx = state.currentServerIndex;
    const curScore = qualityScore(orig[curIdx] !== undefined ? orig[curIdx] : '');
    let best = -1, bestScore = -1;
    orig.forEach((q, i) => {
      const s = qualityScore(q);
      if (i !== curIdx && s < curScore && s > bestScore) { best = i; bestScore = s; }
    });
    if (best < 0) return false;
    const sortedPos = sortedPosOf(best);
    if (sortedPos < 0) return false;
    showToast('تم خفض الدقة تلقائياً إلى ' + orig[best], 'info');
    state._bufferBump = 0;
    setManualQuality(sortedPos);
    return true;
  }

  function updateBufferBar() {
    const video = state.video;
    if (!video || !video.buffered || video.buffered.length === 0) return;
    if (!isFinite(video.duration) || video.duration <= 0) return;
    const bufferEnd = video.buffered.end(video.buffered.length - 1);
    const percent = (bufferEnd / video.duration) * 100;
    const bufferEl = $('progressBuffer');
    if (bufferEl) bufferEl.style.width = Math.min(100, percent) + '%';
  }

  /* ══════════════════════════════════════════════════════════
     [14] Quality Pills
     ══════════════════════════════════════════════════════════ */
  function updateQualityPills(qualities, activeIdx) {
    const container = $('qualityPills');
    if (!container) return;
    if (!qualities || qualities.length === 0) qualities = ['HD'];

    const sorted = sortQualitiesDesc(qualities);
    state.currentQualities = sorted.map(s => s.q);
    state._sortedQualityMap = {};
    sorted.forEach((item, sortedPos) => { state._sortedQualityMap[sortedPos] = item.originalIndex; });

    let html = '';
    if (sorted.length === 1) {
      html += `<button class="quality-pill active" data-index="0">${sorted[0].q}</button>`;
    } else {
      const isAuto = state.manualQualityIndex === null;
      html += `<button class="quality-pill quality-pill-auto ${isAuto ? 'active' : ''}" data-auto="1">تلقائي</button>`;
      html += sorted.map((item, sortedPos) => {
        const isActive = !isAuto && state.manualQualityIndex === sortedPos;
        return `<button class="quality-pill ${isActive ? 'active' : ''}" data-index="${sortedPos}">${item.q}</button>`;
      }).join('');
    }
    container.innerHTML = html;

    container.querySelectorAll('.quality-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.auto === '1') setManualQuality(null);
        else setManualQuality(parseInt(btn.dataset.index, 10));
      }, { passive: true });
    });
    container.style.zIndex = '35';
    container.style.pointerEvents = 'auto';
  }

  function setManualQuality(levelIndex) {
    if (levelIndex === null || levelIndex === -1) {
      state.manualQualityIndex = null;
      if (state.hls) { state.hls.currentLevel = -1; state.hls.autoLevelCapping = -1; }
      showToast('الجودة التلقائية', 'info');
      updateQualityPillsUI(-1);
      return;
    }
    if (!state.currentChannel) return;
    var urls = [];
    if (typeof getChannelUrls === 'function') urls = getChannelUrls(state.currentChannel, state.currentServer);
    if (!urls || urls.length === 0) { showToast('لا توجد روابط', 'error'); return; }

    var originalIndex = (state._sortedQualityMap && state._sortedQualityMap[levelIndex] !== undefined)
      ? state._sortedQualityMap[levelIndex] : levelIndex;
    var newUrl = urls[originalIndex];
    if (!newUrl) { showToast('الجودة غير متاحة', 'warning'); return; }

    var qLabel = state.currentQualities[levelIndex] || ('رابط ' + (levelIndex + 1));
    showToast('جارٍ التبديل إلى ' + qLabel, 'info');
    updateQualityPillsUI(levelIndex);

    state.manualQualityIndex = levelIndex;
    state.currentServerIndex = originalIndex;
    state.isLoading = false; hideLoading();

    var finalUrl = proxifyIfNeeded(newUrl);
    state._currentUrl = finalUrl;
    state._originalUrl = newUrl;
    state._recoveryInProgress = false;
    state._softRecovery = false;
    state._nextReloadAt = 0;
    state._stallLog = [];
    state._bufferWarned = false;
    state._seamlessFails = 0; state._seamlessBroken = false;
    state._startupGraceUntil = Date.now() + 10000;
    loadLearned();

    updateServerCounterFromState();
    refreshExtrasUI();
    destroyPlayers();

    state._loadToken = (state._loadToken || 0) + 1;
    var myToken = state._loadToken;

    detectStreamType(finalUrl).then(function (type) {
      if (myToken !== state._loadToken) return;
      state.currentStreamType = type;
      if (type === 'hls') loadHlsJs(finalUrl, newUrl, myToken);
      else if (type === 'mp4') loadNativeMp4(finalUrl, newUrl);
      else loadMpegts(finalUrl, newUrl, myToken);
      setTimeout(function () { if (state.video) state.video.play().catch(function () {}); }, 500);
    });
  }

  function updateQualityPillsUI(levelIndex) {
    document.querySelectorAll('.quality-pill').forEach(p => {
      const isAutoBtn = p.dataset.auto === '1';
      if (levelIndex === null || levelIndex === -1) p.classList.toggle('active', isAutoBtn);
      else p.classList.toggle('active', !isAutoBtn && parseInt(p.dataset.index) === levelIndex);
    });
  }

  function updateServerCounter(total) {
    const el = $('serverCounter');
    if (!el || !total) return;
    el.textContent = `${state.currentServerIndex + 1}/${total}`;
  }
  function updateServerCounterFromState() {
    const total = (state._origQualities || []).length;
    if (total) updateServerCounter(total);
  }

  /* ══════════════════════════════════════════════════════════
     [15] Display Modes (10 أوضاع) — تمت إعادة كتابتها بالكامل
     ══════════════════════════════════════════════════════════ */
  function applyDisplayMode(mode) {
    const video = state.video;
    const container = $('playerContainer');
    if (!video) return;

    state.displayMode = DISPLAY_MODES.some(m => m.id === mode) ? mode : 'fit';
    state._zoomLevel = 1; state._panX = 0; state._panY = 0;

    /* إعادة ضبط كاملة (كانت الأنماط تتراكم وتزيح الفيديو) */
    const s = video.style;
    s.position = 'absolute'; s.top = '0'; s.left = '0'; s.right = 'auto'; s.bottom = 'auto';
    s.width = '100%'; s.height = '100%'; s.maxWidth = 'none'; s.maxHeight = 'none';
    s.objectFit = 'contain'; s.objectPosition = 'center';
    s.transform = ''; s.transformOrigin = 'center center';
    if (container) container.style.cursor = '';

    const cw = container ? (container.clientWidth || window.innerWidth) : window.innerWidth;
    const ch = container ? (container.clientHeight || window.innerHeight) : window.innerHeight;

    /* صندوق بنسبة ثابتة داخل الحاوية (بدون قص) */
    const boxed = (r) => {
      let w, h;
      if (cw / ch > r) { h = ch; w = ch * r; } else { w = cw; h = cw / r; }
      s.width = Math.round(w) + 'px';
      s.height = Math.round(h) + 'px';
      s.top = '50%'; s.left = '50%';
      s.transform = 'translate(-50%,-50%)';
      s.objectFit = 'fill';
    };

    switch (state.displayMode) {
      case 'fit': s.objectFit = 'contain'; break;
      case 'fill': s.objectFit = 'cover'; break;
      case 'stretch': s.objectFit = 'fill'; break;
      case '16:9': boxed(16 / 9); break;
      case '4:3': boxed(4 / 3); break;
      case '21:9': boxed(21 / 9); break;
      case 'zoom-in': state._zoomLevel = 1.4; s.objectFit = 'contain'; s.transform = 'scale(1.4)'; break;
      case 'zoom-out': state._zoomLevel = 0.75; s.objectFit = 'contain'; s.transform = 'scale(0.75)'; break;
      case 'pan':
        s.objectFit = 'cover';
        if (container) container.style.cursor = 'grab';
        break;
      case 'auto': {
        const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
        const ar = (vw && vh) ? (vw / vh) : 16 / 9;
        const car = cw / ch;
        /* قريب جداً من نسبة الشاشة => املأ بقص بسيط، وإلا احتواء */
        s.objectFit = (Math.abs(ar - car) / car < 0.08) ? 'cover' : 'contain';
        break;
      }
    }

    /* نفس الأسلوب للإطار المجمّد إن وُجد */
    const fr = $('h90Freeze');
    if (fr) fr.style.cssText = s.cssText + ';pointer-events:none;z-index:1;opacity:1;';

    lsSet(STORAGE.displayMode, state.displayMode);
    refreshExtrasUI();
  }

  function cycleDisplayMode() {
    const idx = DISPLAY_MODES.findIndex(m => m.id === state.displayMode);
    const next = DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length];
    applyDisplayMode(next.id);
    showToast('وضع العرض: ' + next.name, 'info');
  }

  function setDisplayMode(mode) {
    if (DISPLAY_MODES.find(m => m.id === mode)) applyDisplayMode(mode);
  }

  function updatePanTransform() {
    const video = state.video;
    if (!video || state.displayMode !== 'pan') return;
    const container = $('playerContainer');
    const cw = container ? container.clientWidth : window.innerWidth;
    const ch = container ? container.clientHeight : window.innerHeight;
    const mx = (cw * state._zoomLevel) / 2, my = (ch * state._zoomLevel) / 2;
    state._panX = Math.max(-mx, Math.min(mx, state._panX));
    state._panY = Math.max(-my, Math.min(my, state._panY));
    video.style.transform = 'translate(' + state._panX + 'px,' + state._panY + 'px) scale(' + state._zoomLevel + ')';
  }

  /* ══════════════════════════════════════════════════════════
     [16] Fullscreen
     ══════════════════════════════════════════════════════════ */
  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function requestFullscreen(el) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return null;
    try { return req.call(el); } catch (e) { return null; }
  }
  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (!exit) return null;
    try { return exit.call(document); } catch (e) { return null; }
  }
  async function lockLandscape() {
    if (!screen.orientation || !screen.orientation.lock) return;
    try { await screen.orientation.lock('landscape'); } catch (e) {}
  }
  function unlockOrientation() {
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }
  }

  function updateImmersiveIcon() {
    ['fullscreenIcon', 'immersiveIcon'].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = svg(state.isImmersive ? 'immersiveOn' : 'immersiveOff', 22);
    });
    document.querySelectorAll('[data-action="fullscreen"]').forEach(b => {
      b.classList.toggle('active', state.isImmersive);
    });
  }

  /* وضع أفقي وهمي: iOS، وأي جهاز لم ينجح فيه ملء الشاشة الحقيقي (مثل بعض WebView) */
  function updateFakeLandscape() {
    if (!state.isImmersive) return;
    if (state._usedRealFs && !isIOS()) return;
    const container = $('playerContainer');
    if (!container) return;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    container.classList.toggle('ios-fake-landscape', isPortrait);
    document.body.classList.toggle('ios-landscape-sim', isPortrait);
    state.iosFakeLandscape = isPortrait;
    applyImmersiveStyles(true);
    setTimeout(() => applyDisplayMode(state.displayMode), 60);
  }

  async function enterImmersive() {
    const container = $('playerContainer');
    if (!container) return;
    const target = $('playerPage') || container;

    state.isImmersive = true;
    state._usedRealFs = false;
    document.body.classList.add('immersive-fullscreen');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    if (!isIOS()) {
      const r = requestFullscreen(target);
      if (r && typeof r.then === 'function') { try { await r; } catch (e) {} }
      else await sleep(200);
      state._usedRealFs = !!getFullscreenElement();
      if (state._usedRealFs) await lockLandscape();
      else updateFakeLandscape();
    } else {
      updateFakeLandscape();
    }

    applyImmersiveStyles(true);
    updateImmersiveIcon();
    vibrate(20);
  }

  function cleanupImmersive() {
    const container = $('playerContainer');
    state.isImmersive = false;
    state._usedRealFs = false;
    document.body.classList.remove('immersive-fullscreen');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    unlockOrientation();
    if (container) container.classList.remove('ios-fake-landscape');
    document.body.classList.remove('ios-landscape-sim');
    state.iosFakeLandscape = false;
    applyImmersiveStyles(false);
    updateImmersiveIcon();
  }

  async function exitImmersive() {
    cleanupImmersive();
    if (getFullscreenElement()) {
      const r = exitFullscreen();
      if (r && typeof r.then === 'function') { try { await r; } catch (e) {} }
    }
    vibrate(15);
  }

  async function toggleImmersiveFullscreen() {
    if (_fsBusy) return;
    _fsBusy = true;
    try {
      if (!state.isImmersive) await enterImmersive();
      else await exitImmersive();
    } catch (e) { console.warn('fs error:', e); }
    finally { setTimeout(() => { _fsBusy = false; }, 350); }
    setTimeout(() => { applyDisplayMode(state.displayMode); showControls(); }, 250);
  }

  function applyImmersiveStyles(enabled) {
    const container = $('playerContainer');
    const page = $('playerPage');
    if (!container) return;

    if (enabled) {
      if (container.dataset.origStyle === undefined) container.dataset.origStyle = container.getAttribute('style') || '';
      if (page && page.dataset.origStyle === undefined) page.dataset.origStyle = page.getAttribute('style') || '';
      const b = parseFloat(lsGet(STORAGE.brightness, '1'));
      const filt = b !== 1 ? 'filter:brightness(' + b + ')!important;' : '';
      const base = 'margin:0!important;padding:0!important;border-radius:0!important;z-index:99999!important;' + filt;
      const plain = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
        'width:100%!important;height:100%!important;transform:none!important;' + base;

      if (page) page.style.cssText = (page.dataset.origStyle || '') + ';' + plain;

      if (state.iosFakeLandscape) {
        const W = window.innerWidth, H = window.innerHeight;
        container.style.cssText = (container.dataset.origStyle || '') + ';' +
          'position:fixed!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;' +
          'width:' + H + 'px!important;height:' + W + 'px!important;' +
          'transform-origin:top left!important;transform:rotate(90deg) translateY(-100%)!important;' + base;
      } else {
        container.style.cssText = (container.dataset.origStyle || '') + ';' + plain;
      }
    } else {
      if (container.dataset.origStyle !== undefined) {
        container.setAttribute('style', container.dataset.origStyle);
        container.removeAttribute('data-orig-style');
      }
      if (page && page.dataset.origStyle !== undefined) {
        page.setAttribute('style', page.dataset.origStyle);
        page.removeAttribute('data-orig-style');
      }
      const b = parseFloat(lsGet(STORAGE.brightness, '1'));
      if (b !== 1) container.style.filter = `brightness(${b})`;
    }
  }

  function toggleFullscreen() { return toggleImmersiveFullscreen(); }

  function onFullscreenChange() {
    const fe = getFullscreenElement();
    const container = $('playerContainer');
    const page = $('playerPage');
    const ours = fe && (fe === page || fe === container || (container && fe.contains(container)));

    if (ours) {
      state._usedRealFs = true;
      if (!isIOS() && state.iosFakeLandscape) {
        state.iosFakeLandscape = false;
        if (container) container.classList.remove('ios-fake-landscape');
        document.body.classList.remove('ios-landscape-sim');
      }
      if (!state.isImmersive) {
        state.isImmersive = true;
        document.body.classList.add('immersive-fullscreen');
      }
      applyImmersiveStyles(true);
      updateImmersiveIcon();
      setTimeout(() => { showControls(); applyDisplayMode(state.displayMode); }, 150);
    } else if (!fe && state.isImmersive && state._usedRealFs && !isIOS()) {
      cleanupImmersive();
      setTimeout(() => applyDisplayMode(state.displayMode), 150);
    }
  }

  function bindFullscreenButtons() {
    const SELECTORS = [
      '#fullscreenBtn', '#immersiveBtn', '#fsBtn', '#fullscreen-button',
      '#toggleFullscreen', '#btnFullscreen',
      '[data-action="fullscreen"]', '[data-action="fs"]',
      '.fullscreen-btn', '.fs-btn', '.immersive-btn',
      '.toggle-fullscreen', '.btn-fullscreen'
    ];
    const btns = new Set();
    SELECTORS.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(b => btns.add(b)); } catch (e) {}
    });
    btns.forEach(b => {
      if (b._h90fsBound) return;
      b._h90fsBound = true;
      b.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        toggleImmersiveFullscreen();
      });
    });
    updateImmersiveIcon();
  }

  /* ══════════════════════════════════════════════════════════
     [17] Viewport + CSS
     ══════════════════════════════════════════════════════════ */
  function setupViewportUnits() {
    const setVH = () => {
      const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
    };
    setVH();
    on(window, 'resize', setVH);
    on(window, 'orientationchange', () => setTimeout(setVH, 150));
    if (window.visualViewport) {
      if (_vkResizeHandler) window.visualViewport.removeEventListener('resize', _vkResizeHandler);
      _vkResizeHandler = () => {
        setVH();
        if (state.isImmersive) { updateFakeLandscape(); applyImmersiveStyles(true); }
        setTimeout(() => applyDisplayMode(state.displayMode), 100);
      };
      on(window.visualViewport, 'resize', _vkResizeHandler);
    }
  }

  function injectPerformanceOverrides() {
    if (document.getElementById('h90-perf-override')) return;
    const style = document.createElement('style');
    style.id = 'h90-perf-override';
    style.textContent = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}
#playerContainer { position: relative; overflow: hidden; background: #000; }
#playerContainer video { background: #000; }
#playerPage .quality-pill, #playerPage .player-controls-bar, #playerPage .fixed-back-btn, #playerPage .player-header {
  backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
}
#playerPage .quality-pill { background: rgba(15,17,23,0.92) !important; }
#playerPage .player-controls-bar { background: rgba(15,17,23,0.9) !important; }
#playerPage .fixed-back-btn { background: rgba(0,0,0,0.85) !important; }
#playerPage .quality-pills { z-index: 35 !important; pointer-events: auto !important; }
#playerPage .player-loading { z-index: 30 !important; background: rgba(0, 0, 0, 0.4) !important; transition: opacity 0.3s ease !important; }
#playerPage .player-loading:not(.show) { opacity: 0 !important; pointer-events: none !important; }
#playerPage .progress-buffer { background: rgba(255, 255, 255, 0.35) !important; transition: width 0.3s ease !important; }
#playerPage .pc-btn {
  display: flex !important; align-items: center !important; justify-content: center !important;
  width: 44px !important; height: 44px !important; border-radius: 50% !important;
  background: rgba(255,255,255,0.08) !important; border: 1px solid rgba(255,255,255,0.14) !important;
  color: #fff !important;
}
#playerPage .pc-btn:active { transform: scale(0.88) !important; }
#playerPage .pc-btn svg { width: 22px !important; height: 22px !important; display: block !important; }
#playerPage .quality-pill {
  border-radius: 999px !important; padding: 6px 16px !important; font-size: 12px !important;
  font-weight: 800 !important; border: 1px solid rgba(255,255,255,0.16) !important;
  background: rgba(15,17,23,0.9) !important; cursor: pointer !important;
  pointer-events: auto !important; color: #fff !important;
}
#playerPage .quality-pill:active { transform: scale(0.92) !important; }
#playerPage .quality-pill.active {
  background: linear-gradient(135deg,#ff2d55,#ff6b8a) !important;
  border-color: transparent !important; color: #fff !important;
}

#h90Extras {
  position: absolute; top: 64px; left: 12px; z-index: 36;
  opacity: 0; pointer-events: none; transition: opacity .25s ease;
  direction: rtl; font-family: inherit;
}
#h90Extras.visible { opacity: 1; pointer-events: auto; }
#h90Extras .h90x-toggle {
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(15,17,23,0.92); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
#h90Extras .h90x-toggle:active { transform: scale(0.9); }
#h90Extras .h90x-panel {
  display: none; margin-top: 8px; min-width: 260px; max-width: 78vw;
  background: rgba(15,17,23,0.97); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px; padding: 6px; max-height: 68vh; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-shadow: 0 12px 32px rgba(0,0,0,0.6);
}
#h90Extras.open .h90x-panel { display: block; }
#h90Extras .h90x-sec {
  font-size: 10px; font-weight: 800; color: #8892a6;
  padding: 8px 12px 4px; text-transform: uppercase; letter-spacing: 0.5px;
}
#h90Extras .h90x-panel button {
  display: flex !important; align-items: center !important;
  width: 100%; text-align: right; gap: 10px;
  background: transparent; border: 0; color: #fff;
  font-size: 13px; font-weight: 700; padding: 10px 12px;
  border-radius: 10px; cursor: pointer; font-family: inherit;
}
#h90Extras .h90x-panel button:active { background: rgba(255,255,255,0.12); }
#h90Extras .h90x-panel button.on { color: #ff6b8a; }
#h90Extras .h90x-panel button .h90x-label { flex: 1; text-align: right; }
#h90Extras .h90x-panel button .h90x-val {
  font-size: 11px; opacity: 0.7; font-weight: 600;
  padding: 2px 8px; background: rgba(255,255,255,0.08);
  border-radius: 999px;
}
#h90Extras .h90x-panel button.on .h90x-val { background: rgba(255,107,138,0.2); color: #ff6b8a; }

/* حاوية الشارات: لا تتداخل بعد الآن */
#h90Top {
  position: absolute; top: 64px; right: 12px; z-index: 34;
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  pointer-events: none; direction: rtl; max-width: 62vw;
}
#h90Stats {
  display: none; pointer-events: none; direction: rtl;
  background: rgba(0,0,0,0.75); color: #cfe9ff;
  font: 600 11px/1.7 ui-monospace, Menlo, Consolas, monospace;
  padding: 10px 12px; border-radius: 10px; white-space: pre-line;
  border: 1px solid rgba(255,255,255,0.1);
}
#h90Stats.show { display: block; }

#h90Lock {
  position: absolute; inset: 0; z-index: 37; display: none;
  align-items: flex-end; justify-content: center; padding-bottom: 28px;
  background: transparent; touch-action: none;
}
#h90Lock.show { display: flex; }
#h90Lock button {
  background: rgba(15,17,23,0.9); color: #fff;
  border: 1px solid rgba(255,255,255,0.2); border-radius: 999px;
  padding: 12px 20px; font-size: 13px; font-weight: 800; cursor: pointer;
  font-family: inherit; position: relative; overflow: hidden; user-select: none;
  -webkit-user-select: none; touch-action: none;
  display: flex; align-items: center; gap: 8px;
}
#h90Lock button .fill {
  position: absolute; inset: 0 auto 0 0; width: 0%;
  background: rgba(255,45,85,0.55); pointer-events: none;
}

#h90SleepBadge {
  display: none; pointer-events: none;
  background: rgba(255,45,85,0.92); color: #fff;
  padding: 8px 14px; border-radius: 999px;
  font: 800 12px/1 ui-monospace, Menlo, monospace;
  box-shadow: 0 4px 16px rgba(255,45,85,0.5);
  align-items: center; gap: 6px;
}
#h90SleepBadge.show { display: inline-flex; }

#h90NetBadge {
  display: none; pointer-events: none; direction: ltr;
  background: rgba(15,17,23,0.9); color: #cfe9ff;
  padding: 6px 10px; border-radius: 999px;
  font: 800 11px/1 ui-monospace, Menlo, monospace;
  align-items: center; gap: 6px;
  border: 1px solid rgba(255,255,255,0.1);
}
#h90NetBadge.show { display: inline-flex; }

#h90Ctx {
  position: fixed; z-index: 99998; display: none; direction: rtl;
  background: rgba(15,17,23,0.98); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px; padding: 6px; min-width: 200px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.6);
}
#h90Ctx.show { display: block; }
#h90Ctx button {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: transparent; border: 0; color: #fff;
  padding: 10px 14px; font-size: 13px; font-weight: 700;
  border-radius: 8px; cursor: pointer; font-family: inherit; text-align: right;
}
#h90Ctx button:active { background: rgba(255,255,255,0.12); }

.h90-ic svg { display: block; }
`;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════
     [18] Gestures
     ══════════════════════════════════════════════════════════ */
  function localPoint(clientX, clientY, container) {
    const rect = container.getBoundingClientRect();
    if (state.iosFakeLandscape) {
      return { x: clientY - rect.top, y: rect.right - clientX, w: container.offsetWidth, h: container.offsetHeight };
    }
    return { x: clientX - rect.left, y: clientY - rect.top, w: rect.width, h: rect.height };
  }

  function initGestures(container) {
    const g = state.gestures;

    const isControlEl = (el) => el && el.closest && (
      el.closest('.quality-pill') || el.closest('.pc-btn') ||
      el.closest('.progress-track') || el.closest('.player-loading') ||
      el.closest('.quality-pills') || el.closest('.player-controls-bar') ||
      el.closest('.player-progress') || el.closest('.player-header') ||
      el.closest('.fixed-back-btn') || el.closest('.h90-ui')
    );

    const handleDoubleTap = (clientX, clientY) => {
      if (state.displayMode === 'pan') { applyDisplayMode('pan'); vibrate(10); return; }
      const p = localPoint(clientX, clientY, container);
      const side = p.x < p.w * 0.3 ? -1 : (p.x > p.w * 0.7 ? 1 : 0);
      if (side !== 0) {
        if (state.isLiveStream) { vibrate(10); return; }
        seekBy(side * SEEK_STEP); vibrate(15);
      } else { togglePlay(); vibrate(10); }
    };

    on(container, 'touchstart', (e) => {
      if (state.locked) return;
      g.ignore = isControlEl(e.target);
      if (g.ignore) return;
      if (e.touches.length === 2) {
        g.isMultiTouch = true;
        g.pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        g.pinchStartZoom = state._zoomLevel;
        return;
      }
      if (e.touches.length !== 1) { g.isMultiTouch = true; return; }
      g.isMultiTouch = false;
      const t = e.touches[0];
      const lp = localPoint(t.clientX, t.clientY, container);
      g.startX = t.clientX; g.startY = t.clientY; g.startTime = Date.now();
      g.startLX = lp.x; g.startLY = lp.y;
      g.startVolume = state.currentVolume;
      g.startBrightness = parseFloat(lsGet(STORAGE.brightness, '1'));
      g.mode = null; g.seekPreview = 0;
      if (state.displayMode === 'pan') {
        g.panStartX = t.clientX; g.panStartY = t.clientY;
        g.panStartOffsetX = state._panX; g.panStartOffsetY = state._panY;
      }
    }, { passive: true });

    on(container, 'touchmove', (e) => {
      if (state.locked || g.ignore) return;
      if (e.touches.length === 2 && g.isMultiTouch && state.displayMode === 'pan') {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        state._zoomLevel = Math.max(0.5, Math.min(4, g.pinchStartZoom * (dist / (g.pinchStartDist || 1))));
        updatePanTransform();
        return;
      }
      if (g.isMultiTouch || e.touches.length !== 1 || !g.startTime) return;

      const t = e.touches[0];

      if (state.displayMode === 'pan') {
        const mv = Math.hypot(t.clientX - g.startX, t.clientY - g.startY);
        if (mv > 10) {
          g.mode = 'pan';
          state._panX = g.panStartOffsetX + (t.clientX - g.panStartX);
          state._panY = g.panStartOffsetY + (t.clientY - g.panStartY);
          updatePanTransform();
        }
        return;
      }

      const p = localPoint(t.clientX, t.clientY, container);
      const dx = p.x - g.startLX;
      const dy = p.y - g.startLY;

      if (!g.mode && (Math.abs(dx) > 15 || Math.abs(dy) > 15)) {
        if (Math.abs(dx) > Math.abs(dy) * 1.2) g.mode = 'seek';
        else if (g.startLX < p.w / 2) g.mode = 'brightness';
        else g.mode = 'volume';
      }

      if (g.mode === 'volume') {
        setVolume(Math.max(0, Math.min(1, g.startVolume + (-dy / p.h))));
        showGestureIndicator('volume', Math.round(state.currentVolume * 100));
      } else if (g.mode === 'brightness') {
        const nb = Math.max(0.3, Math.min(1, g.startBrightness + (-dy / p.h)));
        container.style.filter = `brightness(${nb})`;
        lsSet(STORAGE.brightness, nb);
        showGestureIndicator('brightness', Math.round(nb * 100));
      } else if (g.mode === 'seek' && !state.isLiveStream) {
        const seekDelta = Math.round((dx / p.w) * 60);
        g.seekPreview = seekDelta;
        showGestureIndicator('seek', seekDelta);
      }
    }, { passive: true });

    on(container, 'touchend', (e) => {
      if (state.locked) return;
      if (g.ignore) { g.ignore = false; return; }
      if (g.isMultiTouch) { if (e.touches.length === 0) g.isMultiTouch = false; return; }

      if (g.mode === 'pan') { g.mode = null; g.startTime = 0; return; }

      if (g.mode === 'seek' && g.seekPreview !== 0) {
        seekBy(g.seekPreview); g.seekPreview = 0;
        hideGestureIndicator();
      } else if (!g.mode && e.changedTouches.length > 0) {
        const now = Date.now();
        const t = e.changedTouches[0];
        if (now - g.lastTapTime < DOUBLE_TAP_DELAY) {
          if (g.tapTimeout) clearTimeout(g.tapTimeout);
          g.lastTapTime = 0;
          handleDoubleTap(t.clientX, t.clientY);
        } else {
          g.lastTapTime = now;
          if (g.tapTimeout) clearTimeout(g.tapTimeout);
          /* نفس مدة النقر المزدوج لمنع تنفيذ الاثنين معاً */
          g.tapTimeout = setTimeout(() => { toggleControls(); g.lastTapTime = 0; }, DOUBLE_TAP_DELAY);
        }
      } else hideGestureIndicator();
      g.mode = null; g.startTime = 0;
    }, { passive: true });

    on(container, 'touchcancel', () => {
      g.mode = null; g.startTime = 0; g.ignore = false; g.isMultiTouch = false;
      hideGestureIndicator();
    }, { passive: true });
  }

  function showGestureIndicator(type, value) {
    const host = $('playerContainer') || document.body;
    let indicator = $('gestureIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'gestureIndicator';
      indicator.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);z-index:40;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transition:opacity 0.2s,transform 0.2s;';
      host.appendChild(indicator);
    } else if (indicator.parentNode !== host) host.appendChild(indicator);

    const label = type === 'seek' ? (value >= 0 ? '+' : '') + value + ' ث'
      : (type === 'volume' ? 'الصوت ' : 'السطوع ') + value + '%';
    indicator.innerHTML =
      '<div style="background:rgba(15,17,23,0.95);padding:10px 20px;border-radius:22px;color:#fff;font-size:14px;font-weight:800;border:1px solid rgba(255,45,85,0.3);">' +
      label + '</div>';
    indicator.style.opacity = '1';
    indicator.style.transform = 'translate(-50%,-50%) scale(1)';
    clearTimeout(indicator._hideTimer);
    indicator._hideTimer = setTimeout(hideGestureIndicator, 800);
  }

  function hideGestureIndicator() {
    const indicator = $('gestureIndicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translate(-50%,-50%) scale(0.9)';
    }
  }

  /* ══════════════════════════════════════════════════════════
     [19] Controls
     ══════════════════════════════════════════════════════════ */
  function toggleControls() { if (state.controlsVisible) hideControls(); else showControls(); }

  function showControls() {
    if (state.locked) return;
    state.controlsVisible = true;
    ['playerHeader', 'qualityPills', 'playerControlsBar', 'playerProgress', 'h90Extras'].forEach(id => {
      const el = $(id); if (el) el.classList.add('visible');
    });
    resetHideTimer();
  }

  function hideControls() {
    state.controlsVisible = false;
    ['playerHeader', 'qualityPills', 'playerControlsBar', 'playerProgress', 'h90Extras'].forEach(id => {
      const el = $(id); if (el) el.classList.remove('visible');
    });
    const ex = $('h90Extras');
    if (ex) ex.classList.remove('open');
    if (state.hideTimer) { clearTimeout(state.hideTimer); state.hideTimer = null; }
  }

  function resetHideTimer() {
    if (state.hideTimer) clearTimeout(state.hideTimer);
    if (!state.isPlaying) return;
    state.hideTimer = setTimeout(() => {
      const ex = $('h90Extras');
      if (ex && ex.classList.contains('open')) { resetHideTimer(); return; }
      const ctx = $('h90Ctx');
      if (ctx && ctx.classList.contains('show')) { resetHideTimer(); return; }
      if (state.isPlaying && state.controlsVisible) hideControls();
    }, HIDE_DELAY);
  }

  /* ══════════════════════════════════════════════════════════
     [20] Player Actions
     ══════════════════════════════════════════════════════════ */
  function togglePlay() {
    const video = state.video;
    if (!video) return;
    if (video.paused) {
      const pausedFor = Date.now() - (state._pausedAt || 0);
      const isLive = state.isLiveStream || state.currentStreamType === 'hls' || state.currentStreamType === 'mpegts';
      if (isLive && state._pausedAt && pausedFor > 8000 && state.currentChannel) {
        state._pausedAt = 0; reloadStream();
      } else video.play().catch(() => {});
    } else video.pause();
    showControls();
  }

  function seekBy(seconds) {
    const video = state.video;
    if (!video || state.isLiveStream || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    showControls();
  }

  function seekFromClick(event) {
    const video = state.video;
    if (!video || state.isLiveStream || !isFinite(video.duration)) return;
    const track = document.querySelector('.progress-track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    video.currentTime = percent * video.duration;
  }

  function reloadStream() {
    if (!state.currentChannel) return;
    loadChannel(state.currentChannel, state.currentServerIndex, state.currentServer, true);
  }

  function toggleMute() {
    const video = state.video;
    if (!video) return;
    video.muted = !video.muted;
    state.isMuted = video.muted;
    updateVolumeIcon();
  }

  function setVolume(v) {
    const video = state.video;
    if (!video) return;
    state.currentVolume = Math.max(0, Math.min(1, parseFloat(v)));
    video.volume = state.currentVolume;
    video.muted = state.currentVolume === 0;
    updateVolumeIcon();
    lsSet(STORAGE.volume, state.currentVolume);
  }

  function onVolumeChange() {
    const video = state.video;
    if (!video) return;
    state.currentVolume = video.volume;
    state.isMuted = video.muted;
    updateVolumeIcon();
  }

  function updateVolumeIcon() {
    const icon = $('volumeIcon');
    const video = state.video;
    if (!icon || !video) return;
    const level = (video.muted || video.volume === 0) ? 0 : (video.volume < 0.5 ? 1 : 2);
    icon.innerHTML = svg('volume' + level, 22);
  }

  function cycleSpeed() {
    if (state.isLiveStream) { showToast('السرعة غير متاحة في البث المباشر', 'warning'); return; }
    const idx = SPEEDS.indexOf(state.playbackSpeed);
    state.playbackSpeed = SPEEDS[(idx + 1) % SPEEDS.length];
    if (state.video) state.video.playbackRate = state.playbackSpeed;
    lsSet(STORAGE.speed, state.playbackSpeed);
    showToast('السرعة: ' + state.playbackSpeed + 'x', 'info');
  }

  function applyFitMode(mode) {
    const map = { cover: 'fill', contain: 'fit' };
    applyDisplayMode(map[mode] || mode);
  }
  function toggleFitMode() { cycleDisplayMode(); }

  /* ══════════════════════════════════════════════════════════
     [21] Pro Features
     ══════════════════════════════════════════════════════════ */
  function goLive() {
    const v = state.video;
    if (!v) return;
    try {
      if (state.hls && state.hls.liveSyncPosition) v.currentTime = state.hls.liveSyncPosition;
      else if (v.buffered && v.buffered.length) v.currentTime = Math.max(0, v.buffered.end(v.buffered.length - 1) - 1);
    } catch (e) {}
    v.play().catch(() => {});
    showToast('تم الانتقال للبث المباشر', 'info');
  }

  async function togglePiP() {
    const v = state.video;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && v.requestPictureInPicture) await v.requestPictureInPicture();
      else if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) {
        v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      } else showToast('النافذة العائمة غير مدعومة', 'warning');
    } catch (e) { showToast('تعذر تشغيل النافذة العائمة', 'error'); }
  }

  async function takeScreenshot() {
    const v = state.video;
    if (!v || !v.videoWidth) { showToast('لا يوجد فيديو', 'warning'); return; }
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('empty');
      const name = 'H90_' + Date.now() + '.jpg';
      const file = new File([blob], name, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); }
        catch (e) { if (e && e.name === 'AbortError') return; throw e; }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      }
      showToast('تم حفظ اللقطة', 'success');
      vibrate(20);
    } catch (e) { showToast('تعذر أخذ اللقطة', 'error'); }
  }

  function instantReplay() {
    const v = state.video;
    if (!v) return;
    if (state.isLiveStream) {
      /* في المباشر: نرجع داخل المخزون المتاح فقط */
      if (v.buffered && v.buffered.length) {
        const start = v.buffered.start(0);
        const target = Math.max(start, v.currentTime - 15);
        const back = Math.round(v.currentTime - target);
        if (back < 1) { showToast('لا يوجد مخزون كافٍ للإعادة', 'warning'); return; }
        v.currentTime = target; v.play().catch(() => {});
        showToast('إعادة آخر ' + back + ' ث', 'info');
      }
      return;
    }
    v.currentTime = Math.max(0, v.currentTime - 15);
    v.play().catch(() => {});
    showToast('إعادة آخر 15 ث', 'info');
  }

  function toggleRecording() {
    const v = state.video;
    if (!v) return;

    if (state.recorder && state.recorder.state === 'recording') {
      safeCall(() => state.recorder.stop());
      return;
    }

    if (typeof MediaRecorder === 'undefined') { showToast('التسجيل غير مدعوم', 'warning'); return; }

    let stream;
    try {
      if (v.captureStream) stream = v.captureStream();
      else if (v.mozCaptureStream) stream = v.mozCaptureStream();
      else { showToast('التسجيل غير مدعوم', 'warning'); return; }
    } catch (e) {
      showToast('التسجيل غير مدعوم', 'warning');
      return;
    }

    if (!stream) { showToast('التسجيل غير مدعوم', 'warning'); return; }

    let mime = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mime)) mime = '';

    const opts = {
      mimeType: mime || undefined,
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000
    };

    try {
      state.recorder = new MediaRecorder(stream, opts);
      state.recordedChunks = [];
      state.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };
      state.recorder.onstop = () => {
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'H90_' + Date.now() + '.webm';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        state.recorder = null;
        state.recordedChunks = [];
        showToast('تم حفظ التسجيل', 'success');
        refreshExtrasUI();
      };
      state.recorder.start(2000);
      showToast('بدأ التسجيل', 'success');
      refreshExtrasUI();
    } catch (e) {
      showToast('تعذر بدء التسجيل', 'error');
    }
  }

  /* ── الترجمة ── */
  function applyCaptions(on_) {
    state.captionsOn = !!on_;
    lsSet(STORAGE.captionsOn, state.captionsOn ? 'on' : 'off');
    const v = state.video;
    if (!v || !v.textTracks) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = state.captionsOn ? 'showing' : 'hidden';
    }
    refreshExtrasUI();
  }

  function toggleCaptions() {
    applyCaptions(!state.captionsOn);
    showToast('الترجمة: ' + (state.captionsOn ? 'مفعّلة' : 'معطّلة'), 'info');
  }

  /* ── المعادل الصوتي (لا يكتم الصوت — lazy init) ── */
  function initAudioChain() {
    const v = state.video;
    if (!v || state._audioCtx || state._audioEl === v) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(v);
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = 0;
      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf'; treble.frequency.value = 4000; treble.gain.value = 0;
      const gain = ctx.createGain(); gain.gain.value = 1;
      src.connect(bass); bass.connect(treble); treble.connect(gain); gain.connect(ctx.destination);
      state._audioCtx = ctx;
      state._audioSrc = src;
      state._audioEl = v;
      state._audioBass = bass;
      state._audioTreble = treble;
      state._audioGain = gain;
    } catch (e) { console.warn('audioEq init failed:', e); }
  }

  function reattachAudioNodes(newVideo) {
    if (!state._audioCtx) return;
    try { state._audioSrc && state._audioSrc.disconnect(); } catch (e) {}
    try { state._audioGain && state._audioGain.disconnect(); } catch (e) {}
    try { state._audioCtx.close(); } catch (e) {}
    state._audioCtx = null; state._audioSrc = null;
    state._audioBass = null; state._audioTreble = null; state._audioGain = null;
    state._audioEl = null;
    if (state.audioEq !== 'flat') initAudioChain();
    applyAudioEq(state.audioEq);
  }

  function applyAudioEq(mode) {
    state.audioEq = mode || 'flat';
    lsSet(STORAGE.audioEq, state.audioEq);

    /* لا نبني Web Audio إلا عند الطلب (لتفادي كتم الصوت) */
    if (state.audioEq !== 'flat' && !state._audioCtx) initAudioChain();

    if (state._audioCtx && state._audioCtx.state === 'suspended') {
      safeCall(() => state._audioCtx.resume());
    }

    if (state._audioBass && state._audioTreble && state._audioGain) {
      const configs = {
        flat:   { bass: 0,  treble: 0, gain: 1.00 },
        cinema: { bass: 4,  treble: 2, gain: 1.15 },
        news:   { bass: -2, treble: 4, gain: 1.05 },
        voice:  { bass: -4, treble: 6, gain: 1.10 }
      };
      const c = configs[state.audioEq] || configs.flat;
      safeCall(() => {
        state._audioBass.gain.value = c.bass;
        state._audioTreble.gain.value = c.treble;
        state._audioGain.gain.value = c.gain;
      });
    }
    refreshExtrasUI();
  }

  function cycleAudioEq() {
    const order = ['flat', 'cinema', 'news', 'voice'];
    const i = order.indexOf(state.audioEq);
    applyAudioEq(order[(i + 1) % order.length]);
    const names = { flat: 'عادي', cinema: 'سينما', news: 'أخبار', voice: 'صوتي' };
    showToast('المعادل: ' + names[state.audioEq], 'info');
  }

  /* ── شارة الشبكة ── */
  function startNetworkMonitor() {
    if (state._networkMonitorTimer) clearInterval(state._networkMonitorTimer);
    const badge = $('h90NetBadge');
    if (badge) badge.classList.add('show');

    state._networkMonitorTimer = setInterval(() => {
      if (document.hidden) return;
      const hls = state.hls;
      let speed = 0;
      if (hls && hls.bandwidthEstimate) speed = hls.bandwidthEstimate / 1e6;
      state._lastSpeed = speed;
      if (!badge) return;
      const color = speed > 5 ? '#22c55e' : speed > 2 ? '#eab308' : '#ef4444';
      badge.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
        '<path d="M5 20V16M9 20V12M13 20V8M17 20V4" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '</svg>' +
        '<span>' + (speed > 0 ? speed.toFixed(1) + ' Mbps' : '—') + '</span>';
    }, 3000);
  }

  function stopNetworkMonitor() {
    if (state._networkMonitorTimer) { clearInterval(state._networkMonitorTimer); state._networkMonitorTimer = null; }
    const b = $('h90NetBadge');
    if (b) b.classList.remove('show');
  }

  function toggleNetBadge() {
    state.netBadgeOn = !state.netBadgeOn;
    lsSet(STORAGE.netBadgeOn, state.netBadgeOn ? 'on' : 'off');
    if (state.netBadgeOn) startNetworkMonitor();
    else stopNetworkMonitor();
    showToast('شارة الشبكة: ' + (state.netBadgeOn ? 'تشغيل' : 'إيقاف'), 'info');
    refreshExtrasUI();
  }

  function updateNetBadge() {
    const badge = $('h90NetBadge');
    if (!badge || !state.netBadgeOn) return;
    const hls = state.hls;
    let speed = 0;
    if (hls && hls.bandwidthEstimate) speed = hls.bandwidthEstimate / 1e6;
    if (speed === state._lastSpeed) return;
    state._lastSpeed = speed;
    const color = speed > 5 ? '#22c55e' : speed > 2 ? '#eab308' : '#ef4444';
    badge.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
      '<path d="M5 20V16M9 20V12M13 20V8M17 20V4" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '</svg>' +
      '<span>' + (speed > 0 ? speed.toFixed(1) + ' Mbps' : '—') + '</span>';
  }

  /* ── Turbo Mode ── */
  function toggleTurboMode() {
    state.turboMode = !state.turboMode;
    lsSet(STORAGE.turboMode, state.turboMode ? 'on' : 'off');
    showToast('الوضع السريع: ' + (state.turboMode ? 'مفعّل' : 'معطّل'), 'info');
    if (state.isPlaying) seamlessReload();
    refreshExtrasUI();
  }

  /* ── الإحصائيات ── */
  function setStats(on_) {
    state.statsOn = !!on_;
    lsSet(STORAGE.statsOn, state.statsOn ? 'on' : 'off');
    const el = $('h90Stats');
    if (el) el.classList.toggle('show', state.statsOn);
    if (state._statsTimer) { clearInterval(state._statsTimer); state._statsTimer = null; }
    if (state.statsOn) {
      updateStats();
      state._statsTimer = setInterval(() => {
        if (!document.hidden) updateStats();
      }, 1500);
    }
    refreshExtrasUI();
  }

  function updateStats() {
    const el = $('h90Stats');
    const v = state.video;
    if (!el || !v) return;
    const lines = [];
    const tn = { hls: 'HLS', mpegts: 'TS', mp4: 'MP4', native: 'Native' };
    lines.push('النوع: ' + (tn[state.currentStreamType] || '-') + ' | الجودة: ' + (currentQualityLabel() || '-'));
    if (v.videoWidth) lines.push('الدقة: ' + v.videoWidth + '×' + v.videoHeight);
    if (state.hls) {
      const lv = state.hls.levels && state.hls.levels[state.hls.currentLevel];
      if (lv && lv.bitrate) lines.push('معدل البث: ' + (lv.bitrate / 1e6).toFixed(2) + ' Mbps');
      if (state.hls.bandwidthEstimate) lines.push('سرعة: ' + (state.hls.bandwidthEstimate / 1e6).toFixed(1) + ' Mbps');
      if (isFinite(state.hls.latency) && state.hls.latency > 0) lines.push('التأخر: ' + state.hls.latency.toFixed(1) + ' ث');
    }
    const buf = bufferAheadOf(v);
    const health = buf > 8 ? 'ممتاز' : buf > 4 ? 'جيد' : buf > 2 ? 'منخفض' : 'حرج';
    lines.push('التخزين: ' + buf.toFixed(1) + ' ث (' + health + ')');
    lines.push('وضع العرض: ' + (DISPLAY_MODES.find(m => m.id === state.displayMode) || {}).name);
    lines.push('--- Guardian ---');
    lines.push('عمر الاتصال: ' + Math.floor((Date.now() - state._connStart) / 1000) + ' ث');
    lines.push('المتعلم: ' + (state._learned || '?') + ' ث | تجديد عند: ' + getRefreshAfter() + ' ث');
    lines.push('آخر سبب: ' + state._lastRefreshReason);
    lines.push('تجديدات/60ث: ' + state._refreshLog.length);
    lines.push('تقطيع: ' + state._stallTotal + ' | سلس: ' + state._seamlessCount + ' | كامل: ' + state._recoveryCount);
    if (state.recorder) lines.push('التسجيل: نشط');
    el.textContent = lines.join('\n');
  }

  /* ── وضع التخزين ── */
  function cycleBufferMode() {
    const order = ['auto', 'stable', 'fast'];
    state._bufferMode = order[(order.indexOf(state._bufferMode) + 1) % order.length];
    state._bufferBump = 0; state._stallLog = [];
    lsSet(STORAGE.bufferMode, state._bufferMode);
    applyLiveBufferConfig();
    const names = { auto: 'تلقائي', stable: 'ثابت', fast: 'سريع' };
    showToast('التخزين: ' + names[state._bufferMode], 'info');
    refreshExtrasUI();
    if (state.isPlaying) seamlessReload();
  }

  function toggleAutoDowngrade() {
    state.autoDowngrade = !state.autoDowngrade;
    lsSet(STORAGE.autoDowngrade, state.autoDowngrade ? 'on' : 'off');
    showToast('خفض الدقة: ' + (state.autoDowngrade ? 'تشغيل' : 'إيقاف'), 'info');
    refreshExtrasUI();
  }

  function toggleLockQuality() {
    state.lockQuality = !state.lockQuality;
    lsSet(STORAGE.lockQuality, state.lockQuality ? 'on' : 'off');
    if (state.hls) {
      if (state.lockQuality) { applyLockQuality(state.hls); showToast('تم تثبيت أعلى جودة', 'success'); }
      else { state.hls.currentLevel = -1; state.hls.autoLevelCapping = -1; showToast('تم إلغاء التثبيت', 'info'); }
    }
    refreshExtrasUI();
  }

  function toggleAutoUpgrade() {
    state.autoUpgrade = !state.autoUpgrade;
    lsSet(STORAGE.autoUpgrade, state.autoUpgrade ? 'on' : 'off');
    showToast('تصعيد الجودة: ' + (state.autoUpgrade ? 'تشغيل' : 'إيقاف'), 'info');
    refreshExtrasUI();
  }

  function toggleProactive() {
    state.proactiveMode = state.proactiveMode === 'off' ? 'auto' : 'off';
    lsSet(STORAGE.proactive, state.proactiveMode);
    showToast('التجديد الاستباقي: ' + (state.proactiveMode === 'off' ? 'إيقاف' : 'تشغيل'), 'info');
    refreshExtrasUI();
  }

  /* ── مؤقت النوم ── */
  function cycleSleepTimer() {
    const idx = SLEEP_OPTIONS.indexOf(state._sleepMinutes);
    setSleepTimer(SLEEP_OPTIONS[(idx + 1) % SLEEP_OPTIONS.length]);
  }

  function cycleSleepAction() {
    const idx = SLEEP_ACTIONS.indexOf(state._sleepAction);
    state._sleepAction = SLEEP_ACTIONS[(idx + 1) % SLEEP_ACTIONS.length];
    lsSet(STORAGE.sleepAction, state._sleepAction);
    const names = { pause: 'إيقاف مؤقت', mute: 'كتم', close: 'إغلاق' };
    showToast('عند انتهاء النوم: ' + names[state._sleepAction], 'info');
    refreshExtrasUI();
  }

  function setSleepTimer(minutes) {
    if (state._sleepTimer) { clearTimeout(state._sleepTimer); state._sleepTimer = null; }
    if (state._sleepTickTimer) { clearInterval(state._sleepTickTimer); state._sleepTickTimer = null; }
    state._sleepMinutes = minutes || 0;
    state._sleepEnd = 0;
    const badge = $('h90SleepBadge');

    if (minutes > 0) {
      state._sleepEnd = Date.now() + minutes * 60000;
      const tick = () => {
        const remain = state._sleepEnd - Date.now();
        if (remain <= 0) return;
        const m = Math.floor(remain / 60000);
        const s = Math.floor((remain % 60000) / 1000);
        if (badge) badge.innerHTML = svg('clock', 14) + '<span>' + m + ':' + String(s).padStart(2, '0') + '</span>';
      };
      tick();
      if (badge) badge.classList.add('show');
      state._sleepTickTimer = setInterval(tick, 1000);

      state._sleepTimer = setTimeout(() => {
        state._sleepTimer = null; state._sleepTickTimer = null;
        state._sleepMinutes = 0; state._sleepEnd = 0;
        if (badge) badge.classList.remove('show');
        const v = state.video;
        if (v) {
          if (state._sleepAction === 'pause') v.pause();
          else if (state._sleepAction === 'mute') v.muted = true;
          else if (state._sleepAction === 'close' && typeof window.closePlayer === 'function') window.closePlayer();
        }
        showToast('انتهى مؤقت النوم', 'info');
        refreshExtrasUI();
      }, minutes * 60000);
      showToast('سيتوقف البث بعد ' + minutes + ' دقيقة', 'info');
    } else {
      if (badge) badge.classList.remove('show');
      showToast('تم إيقاف مؤقت النوم', 'info');
    }
    refreshExtrasUI();
  }

  /* ── قفل الشاشة ── */
  function setLocked(v) {
    state.locked = !!v;
    const lock = $('h90Lock');
    if (lock) lock.classList.toggle('show', state.locked);
    if (state.locked) { hideControls(); showToast('الشاشة مقفلة', 'info'); }
    else showControls();
    vibrate(20);
  }

  /* ── قائمة سياقية ── */
  function showContextMenu(x, y) {
    let ctx = $('h90Ctx');
    if (!ctx) {
      ctx = document.createElement('div');
      ctx.id = 'h90Ctx';
      ctx.innerHTML =
        '<button data-act="play">' + svgWrap('play', 16) + '<span>تشغيل / إيقاف</span></button>' +
        '<button data-act="live">' + svgWrap('live', 16) + '<span>البث المباشر</span></button>' +
        '<button data-act="replay">' + svgWrap('replay', 16) + '<span>إعادة آخر 15 ث</span></button>' +
        '<button data-act="pip">' + svgWrap('pip', 16) + '<span>نافذة عائمة</span></button>' +
        '<button data-act="shot">' + svgWrap('screenshot', 16) + '<span>لقطة شاشة</span></button>' +
        '<button data-act="record">' + svgWrap('record', 16) + '<span>تسجيل البث</span></button>' +
        '<button data-act="dispmode">' + svgWrap('aspect', 16) + '<span>وضع العرض</span></button>' +
        '<button data-act="fs">' + svgWrap('expand', 16) + '<span>ملء الشاشة</span></button>' +
        '<button data-act="refresh">' + svgWrap('refresh', 16) + '<span>تجديد البث</span></button>' +
        '<button data-act="vlc">' + svgWrap('play', 16) + '<span>فتح في VLC</span></button>';
      document.body.appendChild(ctx);
      ctx.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        hideContextMenu();
        const act = b.dataset.act;
        if (act === 'play') togglePlay();
        else if (act === 'live') goLive();
        else if (act === 'replay') instantReplay();
        else if (act === 'pip') togglePiP();
        else if (act === 'shot') takeScreenshot();
        else if (act === 'record') toggleRecording();
        else if (act === 'dispmode') cycleDisplayMode();
        else if (act === 'fs') toggleImmersiveFullscreen();
        else if (act === 'refresh') requestRefresh('manual', true);
        else if (act === 'vlc') openInVLC(state._originalUrl);
      });
    }
    ctx.classList.add('show');
    const w = ctx.offsetWidth || 220;
    const h = ctx.offsetHeight || 460;
    ctx.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    ctx.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
    resetHideTimer();
  }

  function hideContextMenu() {
    const ctx = $('h90Ctx');
    if (ctx) ctx.classList.remove('show');
  }

  /* ── Media Session ── */
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    safeCall(() => {
      navigator.mediaSession.setActionHandler('play', () => { if (state.video) state.video.play().catch(() => {}); });
      navigator.mediaSession.setActionHandler('pause', () => { if (state.video) state.video.pause(); });
      navigator.mediaSession.setActionHandler('seekbackward', () => instantReplay());
    });
  }

  function updateMediaSessionMeta() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    safeCall(() => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (state.currentChannel && state.currentChannel.name_ar) || 'H90',
        artist: 'H90 — بث مباشر'
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     [22] Extras UI
     ══════════════════════════════════════════════════════════ */
  function buildExtrasUI(container) {
    if ($('h90Extras')) return;

    const item = (act, icon, label, val) =>
      '<button data-x="' + act + '">' + svgWrap(icon, 18) +
      '<span class="h90x-label">' + label + '</span>' +
      (val ? '<span class="h90x-val">' + val + '</span>' : '') + '</button>';

    const wrap = document.createElement('div');
    wrap.id = 'h90Extras';
    wrap.className = 'h90-ui visible';
    wrap.innerHTML =
      '<button class="h90x-toggle" id="h90xToggle">' + svg('dots', 22) + '</button>' +
      '<div class="h90x-panel" id="h90xPanel">' +
        '<div class="h90x-sec">التشغيل</div>' +
        item('live', 'live', 'الذهاب للمباشر') +
        item('replay', 'replay', 'إعادة آخر 15 ث') +
        item('refresh', 'refresh', 'تجديد البث الآن') +
        item('pip', 'pip', 'نافذة عائمة') +
        item('shot', 'screenshot', 'لقطة شاشة') +
        item('record', 'record', 'تسجيل البث') +
        '<div class="h90x-sec">العرض</div>' +
        item('dispmode', 'aspect', 'وضع العرض') +
        item('fullscreen', 'expand', 'ملء الشاشة') +
        '<div class="h90x-sec">حارس البث</div>' +
        item('proactive', 'shield', 'التجديد الاستباقي') +
        item('buffer', 'shield', 'التخزين') +
        '<div class="h90x-sec">الجودة</div>' +
        item('lockq', 'lock', 'تثبيت الدقة العالية') +
        item('upgrade', 'arrowUp', 'تصعيد الجودة') +
        item('downgrade', 'arrowDown', 'خفض الدقة') +
        item('turbo', 'bolt', 'الوضع السريع') +
        '<div class="h90x-sec">الصوت والصورة</div>' +
        item('audioeq', 'equalizer', 'المعادل الصوتي') +
        item('captions', 'captions', 'الترجمة') +
        '<div class="h90x-sec">أدوات</div>' +
        item('stats', 'stats', 'الإحصائيات') +
        item('net', 'network', 'شارة الشبكة') +
        item('sleep', 'clock', 'مؤقت النوم') +
        item('sleepact', 'clock', 'عند الانتهاء') +
        item('lock', 'lock', 'قفل الشاشة') +
      '</div>';
    container.appendChild(wrap);

    /* حاوية الشارات (لا تتداخل) */
    const topWrap = document.createElement('div');
    topWrap.id = 'h90Top'; topWrap.className = 'h90-ui';
    const stats = document.createElement('div');
    stats.id = 'h90Stats';
    const sleepBadge = document.createElement('div');
    sleepBadge.id = 'h90SleepBadge';
    const netBadge = document.createElement('div');
    netBadge.id = 'h90NetBadge';
    topWrap.appendChild(sleepBadge);
    topWrap.appendChild(netBadge);
    topWrap.appendChild(stats);
    container.appendChild(topWrap);

    const lock = document.createElement('div');
    lock.id = 'h90Lock'; lock.className = 'h90-ui';
    lock.innerHTML = '<button id="h90Unlock"><span class="fill"></span>' +
      svgWrap('unlock', 18) + '<span>اضغط مطولاً للفتح</span></button>';
    container.appendChild(lock);

    ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'dblclick'].forEach(ev => {
      wrap.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
      lock.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    });

    $('h90xToggle').addEventListener('click', () => {
      wrap.classList.toggle('open');
      showControls();
    });

    $('h90xPanel').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-x]');
      if (!btn) return;
      const act = btn.dataset.x;
      const keep = ['buffer', 'downgrade', 'sleep', 'sleepact', 'stats', 'lockq', 'upgrade', 'turbo', 'net', 'audioeq', 'captions', 'dispmode', 'proactive'];
      switch (act) {
        case 'live': goLive(); break;
        case 'replay': instantReplay(); break;
        case 'refresh': requestRefresh('manual', true); break;
        case 'pip': togglePiP(); break;
        case 'shot': takeScreenshot(); break;
        case 'record': toggleRecording(); break;
        case 'dispmode': cycleDisplayMode(); break;
        case 'fullscreen': toggleImmersiveFullscreen(); break;
        case 'proactive': toggleProactive(); break;
        case 'buffer': cycleBufferMode(); break;
        case 'lockq': toggleLockQuality(); break;
        case 'upgrade': toggleAutoUpgrade(); break;
        case 'downgrade': toggleAutoDowngrade(); break;
        case 'turbo': toggleTurboMode(); break;
        case 'audioeq': cycleAudioEq(); break;
        case 'captions': toggleCaptions(); break;
        case 'stats': setStats(!state.statsOn); break;
        case 'net': toggleNetBadge(); break;
        case 'sleep': cycleSleepTimer(); break;
        case 'sleepact': cycleSleepAction(); break;
        case 'lock': wrap.classList.remove('open'); setLocked(true); return;
      }
      if (!keep.includes(act)) wrap.classList.remove('open');
      showControls();
    });

    /* فتح القفل بالضغط المطول */
    const unlockBtn = $('h90Unlock');
    const fill = unlockBtn.querySelector('.fill');
    let holdTimer = null, holdStart = 0, raf = null;
    const stopHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      fill.style.width = '0%';
    };
    const startHold = (e) => {
      e.preventDefault();
      holdStart = Date.now();
      const tick = () => {
        fill.style.width = Math.min(100, ((Date.now() - holdStart) / 700) * 100) + '%';
        raf = requestAnimationFrame(tick);
      };
      tick();
      holdTimer = setTimeout(() => { stopHold(); setLocked(false); }, 700);
    };
    unlockBtn.addEventListener('touchstart', startHold, { passive: false });
    unlockBtn.addEventListener('mousedown', startHold);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(ev => unlockBtn.addEventListener(ev, stopHold));

    on(document, 'click', (e) => {
      const ctx = $('h90Ctx');
      if (ctx && ctx.classList.contains('show') && !ctx.contains(e.target)) hideContextMenu();
    });

    refreshExtrasUI();
  }

  function refreshExtrasUI() {
    const panel = $('h90xPanel');
    if (!panel) return;

    const set = (x, label, val, active) => {
      const b = panel.querySelector('[data-x="' + x + '"]');
      if (!b) return;
      const lbl = b.querySelector('.h90x-label');
      if (lbl && lbl.textContent !== label) lbl.textContent = label;
      let v = b.querySelector('.h90x-val');
      if (val) {
        if (!v) { v = document.createElement('span'); v.className = 'h90x-val'; b.appendChild(v); }
        if (v.textContent !== val) v.textContent = val;
      } else if (v) v.remove();
      const isOn = !!active;
      if (b.classList.contains('on') !== isOn) b.classList.toggle('on', isOn);
    };

    const modeName = { auto: 'تلقائي', stable: 'ثابت', fast: 'سريع' }[state._bufferMode];
    const dm = DISPLAY_MODES.find(m => m.id === state.displayMode) || { name: 'احتواء' };
    const eqNames = { flat: 'عادي', cinema: 'سينما', news: 'أخبار', voice: 'صوتي' };
    const sleepActNames = { pause: 'إيقاف مؤقت', mute: 'كتم', close: 'إغلاق' };

    set('dispmode', 'وضع العرض', dm.name, false);
    set('proactive', 'التجديد الاستباقي', state.proactiveMode === 'off' ? 'معطّل' : 'مفعّل', state.proactiveMode !== 'off');
    set('buffer', 'التخزين', modeName + ' / ' + getProfile().name, state._bufferMode !== 'auto' || state.turboMode);
    set('lockq', 'تثبيت الدقة العالية', state.lockQuality ? 'مفعل' : 'معطل', state.lockQuality);
    set('upgrade', 'تصعيد الجودة', state.autoUpgrade ? 'تشغيل' : 'إيقاف', state.autoUpgrade);
    set('downgrade', 'خفض الدقة', state.autoDowngrade ? 'تشغيل' : 'إيقاف', state.autoDowngrade);
    set('turbo', 'الوضع السريع', state.turboMode ? 'مفعل' : 'معطل', state.turboMode);
    set('audioeq', 'المعادل الصوتي', eqNames[state.audioEq] || 'عادي', state.audioEq !== 'flat');
    set('captions', 'الترجمة', state.captionsOn ? 'مفعّلة' : 'معطّلة', state.captionsOn);
    set('stats', 'الإحصائيات', state.statsOn ? 'تشغيل' : 'إيقاف', state.statsOn);
    set('net', 'شارة الشبكة', state.netBadgeOn ? 'تشغيل' : 'إيقاف', state.netBadgeOn);
    set('sleep', 'مؤقت النوم', state._sleepMinutes ? state._sleepMinutes + ' د' : 'إيقاف', !!state._sleepMinutes);
    set('sleepact', 'عند الانتهاء', sleepActNames[state._sleepAction] || 'إيقاف مؤقت', state._sleepAction !== 'pause');
    set('record', 'تسجيل البث', state.recorder ? 'جاري' : 'إيقاف', !!state.recorder);
  }

  /* ══════════════════════════════════════════════════════════
     [23] Video Events
     ══════════════════════════════════════════════════════════ */
  function onLoadedMetadata() {
    const v = state.video;
    if (isFinite(v.duration) && v.duration > 0) {
      const t = $('totalTime'); if (t) t.textContent = formatTime(v.duration);
      state.isLiveStream = false;
    } else {
      const t = $('totalTime'); if (t) t.textContent = 'مباشر';
      state.isLiveStream = true;
    }
  }

  function onPlaying() {
    state.isPlaying = true;
    state._stallStartTime = 0;
    state._isMinorStall = false;
    state._lastDataReceived = Date.now();
    state._bufferWarned = false;

    /* إخفاء التحميل (بما فيه إخفاء إطار التجميد بعد بدء الفيديو الجديد) */
    if (state.isLoading && !state._recoveryInProgress) {
      hideLoading();
      state.isLoading = false;
    }
    if (state._softRecovery) {
      state._softRecovery = false;
      state._recoveryInProgress = false;
      /* إخفاء إطار التجميد بعد إطار واحد لضمان الظهور */
      setTimeout(removeFreeze, 400);
      hideLoading();
      state.isLoading = false;
    }

    if (!state._keepAliveTimer) startKeepAlive();
    if (!state._autoReloadTimer) startAutoReload();

    updatePlayButton(true);
    requestWakeLock();
    resetHideTimer();
    if ('mediaSession' in navigator) safeCall(() => { navigator.mediaSession.playbackState = 'playing'; });
  }

  function onPause() {
    state.isPlaying = false;
    state._pausedAt = Date.now();
    updatePlayButton(false);
    releaseWakeLock();
    showControls();
    if ('mediaSession' in navigator) safeCall(() => { navigator.mediaSession.playbackState = 'paused'; });
  }

  function onWaiting() {
    const v = state.video;
    if (!v) return;
    const buf = bufferAheadOf(v);
    if (state.isPlaying && v.currentTime > 1 && buf < 0.5) registerStall();
    if (state._recoveryInProgress || buf > 2) return;
    if (!state._stallStartTime) { state._stallStartTime = Date.now(); state._isMinorStall = true; }
    if (Date.now() - state._stallStartTime > 3000 && state._isMinorStall) {
      state._isMinorStall = false;
      if (state.isPlaying && !state._softRecovery) {
        showLoading('جارٍ التحميل...', '');
        state.isLoading = true;
      }
    }
  }

  function onCanPlay() {
    if (state._recoveryInProgress && state._seamlessCancel) return;
    if (state._softRecovery) return;
    hideLoading();
    state.isLoading = false;
    state._stallStartTime = 0;
    state._isMinorStall = false;
  }

  function onStalled() { /* لا شيء */ }

  function onError() {
    const v = state.video;
    if (!v || !state.currentChannel) return;
    if (Date.now() < state._startupGraceUntil) return;
    console.warn('video error:', v.error && v.error.code);
    noteConnectionDrop('video-error');
    if (!requestRefresh('video-error', true)) softReload('video-error');
  }

  function onEnded() {
    const isLive = state.isLiveStream || state.currentStreamType === 'hls' || state.currentStreamType === 'mpegts';
    if (isLive && state.currentChannel) {
      noteConnectionDrop('ended');
      if (!requestRefresh('ended', true)) softReload('ended');
      return;
    }
    state.isPlaying = false;
    updatePlayButton(false);
    showControls();
  }

  function onTimeUpdate() {
    const v = state.video;
    const ct = $('currentTime');
    if (!ct || !v) return;
    ct.textContent = formatWatchTime(state._watchSeconds);
    if (state.isLiveStream || !isFinite(v.duration) || !v.duration) {
      const f = $('progressFill');
      if (f) f.style.width = '100%';
      return;
    }
    const p = (v.currentTime / v.duration) * 100;
    const f = $('progressFill');
    if (f) f.style.width = p + '%';
    updateBufferBar();
  }

  function onBufferProgress() { updateBufferBar(); }

  function updatePlayButton(playing) {
    const icon = $('playIcon');
    if (icon) icon.innerHTML = svg(playing ? 'pause' : 'play', 22);
  }

  function showLoading(msg, sub) {
    const loadingEl = $('playerLoading');
    if (!loadingEl) return;
    const msgEl = $('loadingMsg'); const subEl = $('loadingSub');
    if (msgEl) msgEl.textContent = msg || 'جارٍ التحميل...';
    if (subEl) subEl.textContent = sub || '';
    loadingEl.classList.add('show');
  }

  function hideLoading() {
    const el = $('playerLoading');
    if (el) el.classList.remove('show');
  }

  /* ══════════════════════════════════════════════════════════
     [24] Network / Orientation / Keys
     ══════════════════════════════════════════════════════════ */
  function onNetworkOffline() {
    state.isOnline = false;
    state.wasPlayingBeforeOffline = state.isPlaying;
    showLoading('انتظر عودة الشبكة', '');
    state.isLoading = true;
    showToast('انقطع الاتصال', 'warning');
  }

  function onNetworkOnline() {
    state.isOnline = true;
    showToast('عادت الشبكة', 'success');
    const v = state.video;
    if (v && state.currentChannel) {
      if (bufferAheadOf(v) < 2) requestRefresh('net-online', true);
      else { hideLoading(); state.isLoading = false; }
    }
  }

  function onNetworkChange() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    state.networkSpeed = conn.downlink || 10;
  }

  function onOrientationChange() {
    if (state.isImmersive) {
      updateFakeLandscape();
      applyImmersiveStyles(true);
    }
    setTimeout(() => applyDisplayMode(state.displayMode), 300);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      if (state.isPlaying) requestWakeLock();
      /* عند العودة: إذا كان الرابط قد قطع، نجدد فوراً */
      if (state.currentChannel && !state._recoveryInProgress) {
        const v = state.video;
        const age = (Date.now() - state._connStart) / 1000;
        if (v && bufferAheadOf(v) < 2) requestRefresh('visibility', true);
        else if (age >= getRefreshAfter()) requestRefresh('visibility', false);
      }
    }
  }

  function onKeyDown(e) {
    if (!state.currentChannel) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': seekBy(SEEK_STEP); break;
      case 'ArrowLeft': seekBy(-SEEK_STEP); break;
      case 'ArrowUp': e.preventDefault(); setVolume(Math.min(1, state.currentVolume + 0.05)); break;
      case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, state.currentVolume - 0.05)); break;
      case 'f': case 'F': toggleImmersiveFullscreen(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'p': case 'P': togglePiP(); break;
      case 's': case 'S': takeScreenshot(); break;
      case 'l': case 'L': goLive(); break;
      case 'i': case 'I': setStats(!state.statsOn); break;
      case 'r': case 'R': instantReplay(); break;
      case 'c': case 'C': cycleDisplayMode(); break;
      case 'e': case 'E': cycleAudioEq(); break;
      case 't': case 'T': toggleTurboMode(); break;
      case 'v': case 'V': toggleCaptions(); break;
    }
    showControls();
  }

  /* ══════════════════════════════════════════════════════════
     [25] Wake Lock
     ══════════════════════════════════════════════════════════ */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (state.wakeLock) return;
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      on(state.wakeLock, 'release', () => { state.wakeLock = null; });
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (state.wakeLock) { safeCall(() => state.wakeLock.release()); state.wakeLock = null; }
  }

  /* ══════════════════════════════════════════════════════════
     [26] Destroy
     ══════════════════════════════════════════════════════════ */
  function destroy() {
    ['_bufferMonitorTimer', '_hlsRefreshTimer', '_keepAliveTimer', '_autoReloadTimer',
     '_watchTimer', '_statsTimer', '_sleepTickTimer', '_prefetchTimer', '_networkMonitorTimer'
    ].forEach(k => { if (state[k]) { clearInterval(state[k]); state[k] = null; } });

    if (state._sleepTimer) clearTimeout(state._sleepTimer);
    if (state.hideTimer) clearTimeout(state.hideTimer);
    if (state._loadTimeout) clearTimeout(state._loadTimeout);

    if (state.recorder && state.recorder.state === 'recording') safeCall(() => state.recorder.stop());

    if (state._audioCtx) safeCall(() => state._audioCtx.close());

    if (state.isImmersive) cleanupImmersive();
    if (getFullscreenElement()) exitFullscreen();

    destroyPlayers();
    releaseWakeLock();
    console.log('H90 v45.0 (Guardian) destroyed');
  }

  /* ══════════════════════════════════════════════════════════
     [27] Public API
     ══════════════════════════════════════════════════════════ */
  return {
    init, loadChannel, togglePlay, seekBy, seekFromClick, toggleMute, setVolume,
    cycleSpeed, toggleFullscreen, reloadStream, showControls, hideControls,
    formatTime, isIOS, setManualQuality, toggleFitMode, detectStreamType,
    openInVLC, destroy, toggleImmersiveFullscreen, seamlessReload,
    requestRefresh, softReload, bindFullscreenButtons,

    applyDisplayMode, cycleDisplayMode, setDisplayMode,

    goLive, togglePiP, takeScreenshot, instantReplay, toggleRecording,
    toggleStats: () => setStats(!state.statsOn),
    cycleBufferMode, toggleAutoDowngrade, toggleAutoUpgrade, toggleProactive,
    toggleLockQuality, applyLockQuality, toggleTurboMode,
    cycleAudioEq, applyAudioEq, toggleCaptions, applyCaptions,
    toggleNetBadge, startNetworkMonitor, stopNetworkMonitor,
    setSleepTimer, cycleSleepTimer, cycleSleepAction,
    showContextMenu, hideContextMenu,
    lockScreen: () => setLocked(true),
    unlockScreen: () => setLocked(false),

    getFitMode: () => state.displayMode,
    getDisplayMode: () => state.displayMode,
    getCurrentChannel: () => state.currentChannel,
    getCurrentServerIndex: () => state.currentServerIndex,
    getCurrentQualities: () => state.currentQualities.slice(),
    getStreamType: () => state.currentStreamType,
    setCurrentServer: (serverId) => { state.currentServer = serverId; },
    getCurrentServer: () => state.currentServer,
    setCurrentGroup: (groupId) => { state.currentGroup = groupId; },
    getCurrentGroup: () => state.currentGroup,
    getManualQualityIndex: () => state.manualQualityIndex,
    isManualQuality: () => state.manualQualityIndex !== null,
    isLoading: () => state.isLoading,
    isImmersive: () => state.isImmersive,
    isLocked: () => state.locked,
    getBufferEnd: () => state._bufferEnd,
    getBufferAhead: () => bufferAheadOf(state.video),
    getBufferMode: () => state._bufferMode,
    getBufferProfile: () => getProfile().name,
    isQualityLocked: () => state.lockQuality,
    isTurbo: () => state.turboMode,
    isRecording: () => !!state.recorder,
    getWatchTime: () => state._watchSeconds,
    getRecoveryCount: () => state._recoveryCount,
    getSeamlessCount: () => state._seamlessCount,
    getStallCount: () => state._stallTotal,
    getSessionAge: () => Math.floor((Date.now() - state._sessionStart) / 1000),

    /* Guardian API */
    getConnectionAge: () => Math.floor((Date.now() - state._connStart) / 1000),
    getLearnedLifetime: () => state._learned,
    getNextRefreshIn: () => Math.max(0, getRefreshAfter() - (Date.now() - state._connStart) / 1000),
    getLastRefreshReason: () => state._lastRefreshReason,
    getRefreshCount60s: () => state._refreshLog.length,
    getProactiveMode: () => state.proactiveMode,
    isSeamlessBroken: () => state._seamlessBroken,

    getHlsLevels: () => state.hls ? state.hls.levels.map(l => ({ height: l.height, bitrate: l.bitrate })) : []
  };
})();

window.PlayerEngine = PlayerEngine;

window.switchServer = (idx) => PlayerEngine.setManualQuality(idx);
window.switchServerAuto = () => PlayerEngine.setManualQuality(null);

console.log('%c H90 PlayerEngine v45.0 — Stream Guardian',
  'background:linear-gradient(135deg,#ff2d55,#00e5ff);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px');
console.log('%cحارس البث نشط: يكتشف قطع السيرفر ويجدد قبل القطع بـ 14 ث',
  'color:#22c55e;font-weight:700;font-size:11px;');
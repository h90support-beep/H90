/* ================================================================
   H90 v21.0 — player.js (AppLauncher + Quality Picker)
   ================================================================ */

const PlayerEngine = (function() {
  'use strict';

  const state = {
    video: null, hls: null, mpegts: null,
    currentChannel: null, currentServerIndex: 0, currentServer: 'm3u',
    currentGroup: null, isPlaying: false, isMuted: false,
    currentVolume: 1, playbackSpeed: 1, wakeLock: null,
    hideTimer: null, controlsVisible: true, isLiveStream: false,
    isFullscreen: false, isPiP: false, isSeeking: false, isLoaded: false,
    isScrubbing: false, manualQualityIndex: null, pendingQualityIndex: null,
    isLoading: false, currentQualities: [], currentStreamType: null,
    fitMode: 'cover', networkQuality: 'unknown', networkCheckTime: 0,
    networkSamples: [], stallCount: 0, lastStallTime: 0, boostUntil: 0,
    codecFailed: false,
    retry: { count: 0, maxCount: 2, serverAttempts: 0, maxServerAttempts: 2 },
    gestures: {
      startX: 0, startY: 0, startTime: 0, startVolume: 1, startBrightness: 1,
      mode: null, seekPreview: 0, lastTapTime: 0, tapTimeout: null,
      lastTouchTime: 0, longPressTimer: null, isLongPress: false, isMultiTouch: false
    }
  };

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const SEEK_STEP = 10;
  const SEEK_MAX = 120;
  const HIDE_DELAY = 4000;
  const DOUBLE_TAP_DELAY = 300;
  const LONG_PRESS_DELAY = 500;
  const STREAM_PROXY = 'https://apph90.houssenali222333.workers.dev/?url=';

  const VLC_PACKAGE = 'org.videolan.vlc';
  const VLC_PLAY_STORE = 'https://play.google.com/store/apps/details?id=' + VLC_PACKAGE;

  const STORAGE = {
    brightness: 'h90_brightness', volume: 'h90_volume',
    recent: 'h90_recent_full', resume: 'h90_resume_',
    speed: 'h90_speed', haptics: 'h90_haptics', fitMode: 'h90_fit_mode'
  };

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const safeCall = (fn, ...args) => { try { return fn(...args); } catch (e) { console.warn('safeCall:', e); } };

  function formatTime(s) {
    if (!isFinite(s) || s < 0) return 'مباشر';
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
    if (localStorage.getItem(STORAGE.haptics) === 'off') return;
    safeCall(() => navigator.vibrate(pattern));
  }

  function proxifyIfNeeded(url) {
    if (!url) return '';
    if (url.indexOf('workers.dev') > -1) return url;
    if (url.startsWith('https://')) return url;
    if (url.startsWith('http://')) return STREAM_PROXY + encodeURIComponent(url);
    return url;
  }

  // ═══════════════════════════════════════════════════════
  // ✅ فتح VLC (AppLauncher + Fallback)
  // ═══════════════════════════════════════════════════════
  async function openInVLC(streamUrl) {
    if (!streamUrl) {
      showToast('❌ لا يوجد رابط', 'error');
      return;
    }

    console.log('🎬 محاولة فتح VLC بالرابط:', streamUrl);
    showToast('🎬 فتح VLC...', 'info');
    vibrate(30);

    // ✅ Capacitor AppLauncher (الأصح والأحدث)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppLauncher) {
      try {
        await window.Capacitor.Plugins.AppLauncher.openUrl({ url: streamUrl });
        console.log('✅ AppLauncher: تم إرسال الأمر إلى VLC');
        try { localStorage.setItem('h90_last_vlc_open', Date.now().toString()); } catch(e) {}
        return;
      } catch (e) {
        console.warn('AppLauncher.openUrl فشل:', e);
        showToast('⚠️ AppLauncher: ' + e.message, 'warning');
      }
    } else {
      console.warn('AppLauncher plugin غير متاح');
    }

    // 🔄 Fallback 1: @capacitor/app (نسخة قديمة)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      try {
        await window.Capacitor.Plugins.App.openUrl({ url: streamUrl });
        console.log('✅ App.openUrl: تم');
        return;
      } catch (e) {
        console.warn('App.openUrl فشل:', e);
      }
    }

    // 🔄 Fallback 2: Intent URL (PWA / متصفح)
    const vlcIntent = `intent:${streamUrl}#Intent;package=${VLC_PACKAGE};type=video/*;S.browser_fallback_url=${encodeURIComponent(VLC_PLAY_STORE)};end`;
    console.log('🔄 Intent URL:', vlcIntent);
    window.location.href = vlcIntent;
    try { localStorage.setItem('h90_last_vlc_open', Date.now().toString()); } catch(e) {}
  }

  async function detectStreamType(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.m3u8')) return 'hls';
    if (urlLower.includes('.mp4')) return 'mp4';
    if (/\.ts(\?|#|$)/.test(urlLower)) return 'mpegts';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        method: 'GET', headers: { 'Range': 'bytes=0-2047' },
        signal: controller.signal, mode: 'cors', cache: 'no-store'
      });
      clearTimeout(timeout);

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('mpegurl') || contentType.includes('m3u8')) return 'hls';
      if (contentType.includes('mp4')) return 'mp4';
      if (contentType.includes('mp2t') || contentType.includes('mpeg-ts') ||
          contentType.includes('octet-stream') || contentType.includes('video/')) {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes[0] === 0x47) return 'mpegts';
        if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'mp4';
        const text = new TextDecoder().decode(bytes.slice(0, 200));
        if (text.includes('#EXTM3U')) return 'hls';
        return 'mpegts';
      }
    } catch (e) {
      console.warn('⚠️ فشل detectStreamType:', e.message);
    }
    return 'mpegts';
  }

  async function measureNetworkSpeed() {
    const testUrl = 'https://speed.cloudflare.com/__down?bytes=200000';
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(testUrl, { signal: controller.signal, cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      clearTimeout(timeout);
      const seconds = (performance.now() - start) / 1000;
      const kbps = (blob.size * 8) / 1000 / seconds;
      if (kbps < 800) return 'weak';
      if (kbps < 2000) return 'medium';
      if (kbps < 5000) return 'good';
      return 'excellent';
    } catch (e) { return detectFromNetworkAPI(); }
  }

  function detectFromNetworkAPI() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return 'unknown';
    const dl = conn.downlink || 10;
    const et = conn.effectiveType || '4g';
    if (et === '2g' || dl < 0.5) return 'weak';
    if (et === '3g' || dl < 1.5) return 'medium';
    if (et === '4g') return 'good';
    return 'excellent';
  }

  function initNetworkMonitor() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    conn.addEventListener('change', () => {
      state.networkQuality = detectFromNetworkAPI();
      state.networkCheckTime = Date.now();
    });
    state.networkQuality = detectFromNetworkAPI();
    state.networkCheckTime = Date.now();
  }

  function applyFitMode(mode) {
    const video = state.video;
    if (!video) return;
    state.fitMode = mode || 'cover';
    video.style.objectFit = state.fitMode;
    video.style.width = '100%';
    video.style.height = '100%';
    try { localStorage.setItem(STORAGE.fitMode, state.fitMode); } catch (e) {}
  }

  function toggleFitMode() {
    const nextMode = state.fitMode === 'cover' ? 'contain' : 'cover';
    applyFitMode(nextMode);
    showToast(nextMode === 'cover' ? '🔲 ملء الشاشة' : '📺 احتواء', 'info');
    vibrate(15);
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  }

  function requestFullscreen(el) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen || el.msRequestFullscreen;
    if (!req) return null;
    return req.call(el);
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) return exit.call(document);
  }

  function init() {
    state.video = $('videoPlayer');
    if (!state.video) { console.error('❌ videoPlayer not found'); return; }
    const video = state.video;

    const savedFitMode = localStorage.getItem(STORAGE.fitMode) || 'cover';
    state.fitMode = savedFitMode;
    applyFitMode(savedFitMode);

    const events = {
      loadedmetadata: onLoadedMetadata, playing: onPlaying, pause: onPause,
      timeupdate: onTimeUpdate, progress: onBufferProgress, error: onError,
      waiting: onWaiting, canplay: onCanPlay, volumechange: onVolumeChange,
      ended: onEnded, seeking: () => { state.isSeeking = true; },
      seeked: () => { state.isSeeking = false; }, stalled: onStalled, emptied: onStalled
    };
    Object.entries(events).forEach(([ev, fn]) => on(video, ev, fn));

    const container = $('playerContainer');
    if (container) { initGestures(container); initProgressScrub(container); }

    on(document, 'fullscreenchange', onFullscreenChange);
    on(document, 'webkitfullscreenchange', onFullscreenChange);
    on(document, 'visibilitychange', onVisibilityChange);
    on(window, 'beforeunload', saveResume);
    on(window, 'pagehide', saveResume);

    if (screen.orientation) on(screen.orientation, 'change', onOrientationChange);

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('preload', 'auto');

    const savedBrightness = parseFloat(localStorage.getItem(STORAGE.brightness) || '1');
    if (container && savedBrightness !== 1) container.style.filter = `brightness(${savedBrightness})`;

    const savedVolume = parseFloat(localStorage.getItem(STORAGE.volume) || '1');
    if (!isNaN(savedVolume)) { video.volume = savedVolume; state.currentVolume = savedVolume; }

    const savedSpeed = parseFloat(localStorage.getItem(STORAGE.speed) || '1');
    if (SPEEDS.includes(savedSpeed)) { state.playbackSpeed = savedSpeed; video.playbackRate = savedSpeed; }

    initNetworkMonitor();
    showControls();
    console.log('✅ PlayerEngine v21.0 ready');
  }

  function initGestures(container) {
    const g = state.gestures;
    const isControlEl = (el) => el && (
      el.closest('.quality-pill') || el.closest('.pc-btn') || el.closest('.progress-track') ||
      el.closest('.player-loading') || el.closest('.quality-pills') || el.closest('.player-controls-bar') ||
      el.closest('.player-progress') || el.closest('.player-header') || el.closest('#gestureHint') ||
      el.closest('.fixed-back-btn')
    );

    const handleDoubleTap = (clientX) => {
      if (state.isLiveStream) { vibrate(20); return; }
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const w = rect.width;
      if (x < w * 0.3) { seekBy(-SEEK_STEP); vibrate(15); }
      else if (x > w * 0.7) { seekBy(SEEK_STEP); vibrate(15); }
      else { togglePlay(); vibrate(10); }
    };

    on(container, 'touchstart', (e) => {
      if (e.touches.length !== 1) { g.isMultiTouch = true; return; }
      g.isMultiTouch = false;
      if (g.longPressTimer) clearTimeout(g.longPressTimer);
      if (g.tapTimeout) clearTimeout(g.tapTimeout);
      const t = e.touches[0];
      g.startX = t.clientX; g.startY = t.clientY; g.startTime = Date.now();
      g.startVolume = state.currentVolume;
      g.startBrightness = parseFloat(localStorage.getItem(STORAGE.brightness) || '1');
      g.mode = null; g.isLongPress = false;
    }, { passive: true });

    on(container, 'touchmove', (e) => {
      if (g.isMultiTouch || e.touches.length !== 1 || !g.startTime) return;
      if (state.isScrubbing) return;
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      const rect = container.getBoundingClientRect();
      const startX = g.startX - rect.left;
      if (!g.mode && (Math.abs(dx) > 15 || Math.abs(dy) > 15)) {
        if (Math.abs(dx) > Math.abs(dy) * 1.2) g.mode = 'seek';
        else if (startX < rect.width / 2) g.mode = 'brightness';
        else g.mode = 'volume';
      }
      if (g.mode === 'volume') {
        const delta = -dy / rect.height;
        setVolume(Math.max(0, Math.min(1, g.startVolume + delta)), true);
      } else if (g.mode === 'brightness') {
        const delta = -dy / rect.height;
        const nb = Math.max(0.3, Math.min(1, g.startBrightness + delta));
        const cont = $('playerContainer');
        if (cont) cont.style.filter = `brightness(${nb})`;
        localStorage.setItem(STORAGE.brightness, nb);
      }
    }, { passive: true });

    on(container, 'touchend', (e) => {
      if (g.isMultiTouch) { g.isMultiTouch = false; return; }
      if (g.mode === 'seek') { seekBy(Math.round(g.seekPreview)); g.seekPreview = 0; }
      else if (!g.mode && e.changedTouches.length > 0) {
        const now = Date.now();
        const t = e.changedTouches[0];
        if (isControlEl(e.target)) return;
        if (now - g.lastTapTime < DOUBLE_TAP_DELAY) {
          handleDoubleTap(t.clientX);
          g.lastTapTime = 0;
          if (g.tapTimeout) clearTimeout(g.tapTimeout);
        } else {
          g.lastTapTime = now;
          if (g.tapTimeout) clearTimeout(g.tapTimeout);
          g.tapTimeout = setTimeout(() => { toggleControls(); g.lastTapTime = 0; }, 250);
        }
      }
      g.mode = null; g.startTime = 0;
    }, { passive: true });
  }

  function initProgressScrub(container) {
    const progressEl = $('playerProgress') || document.querySelector('.progress-track');
    if (!progressEl) return;
    const getPercent = (clientX) => {
      const rect = progressEl.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };
    on(progressEl, 'touchstart', (e) => {
      if (state.isLiveStream || !isFinite(state.video.duration)) return;
      state.isScrubbing = true;
      const t = e.touches ? e.touches[0] : e;
      const fill = $('progressFill');
      if (fill) fill.style.width = (getPercent(t.clientX) * 100) + '%';
    }, { passive: true });
    on(progressEl, 'touchmove', (e) => {
      if (!state.isScrubbing) return;
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const fill = $('progressFill');
      if (fill) fill.style.width = (getPercent(t.clientX) * 100) + '%';
    }, { passive: false });
    on(progressEl, 'touchend', (e) => {
      if (!state.isScrubbing) return;
      state.isScrubbing = false;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (state.video.duration) state.video.currentTime = getPercent(t.clientX) * state.video.duration;
    }, { passive: true });
  }

  function toggleControls() { if (state.controlsVisible) hideControls(); else showControls(); }

  function showControls() {
    state.controlsVisible = true;
    ['playerHeader', 'qualityPills', 'playerControlsBar', 'playerProgress'].forEach(id => {
      const el = $(id); if (el) el.classList.add('visible');
    });
    resetHideTimer();
  }

  function hideControls() {
    state.controlsVisible = false;
    ['playerHeader', 'qualityPills', 'playerControlsBar', 'playerProgress'].forEach(id => {
      const el = $(id); if (el) el.classList.remove('visible');
    });
    if (state.hideTimer) { clearTimeout(state.hideTimer); state.hideTimer = null; }
  }

  function resetHideTimer() {
    if (state.hideTimer) clearTimeout(state.hideTimer);
    if (!state.isPlaying) return;
    state.hideTimer = setTimeout(() => {
      if (state.isPlaying && state.controlsVisible && !state.isSeeking && !state.isScrubbing) hideControls();
    }, HIDE_DELAY);
  }

  async function loadChannel(channel, serverIndex, serverId) {
    if (!channel) return;
    const video = state.video;
    if (!video) return;
    const effectiveServerId = serverId || state.currentServer || 'm3u';

    state.currentChannel = channel;
    state.currentServerIndex = serverIndex || 0;
    state.currentServer = effectiveServerId;
    state.retry.count = 0;
    state.retry.serverAttempts = 0;
    state.stallCount = 0;
    state.codecFailed = false;
    state.isLoaded = false;
    state.isLoading = true;
    state.pendingQualityIndex = null;
    state.manualQualityIndex = null;
    state.currentStreamType = null;

    let urls = [];
    let serverQualities = [];

    if (typeof getChannelUrls === 'function') urls = getChannelUrls(channel, effectiveServerId);
    if (typeof getChannelQualities === 'function') serverQualities = getChannelQualities(channel, effectiveServerId);

    let url = urls[state.currentServerIndex];
    if (!url) {
      showToast('❌ لا يوجد رابط لهذه القناة', 'error');
      state.isLoading = false;
      hideLoading();
      return;
    }

    const originalUrl = url;
    url = proxifyIfNeeded(url);
    console.log(`🎬 ${channel.name_ar} — Server[${effectiveServerId}] ${state.currentServerIndex + 1}/${urls.length}`);

    addToRecent(channel);
    showLoading('جاري التحميل...', channel.name_ar || '');

    let qualities = serverQualities.length > 0 ? serverQualities.slice() : (channel.qualities || []).slice();
    if (qualities.length !== urls.length) {
      if (qualities.length > urls.length) qualities = qualities.slice(0, urls.length);
      else for (let i = qualities.length; i < urls.length; i++) qualities.push(`رابط ${i + 1}`);
    }
    state.currentQualities = qualities;

    updateQualityPills(qualities, state.currentServerIndex, effectiveServerId);
    updateServerCounter();
    showControls();

    if (state.hls) { safeCall(() => state.hls.destroy()); state.hls = null; }
    if (state.mpegts) {
      safeCall(() => {
        try {
          state.mpegts.pause();
          state.mpegts.unload();
          state.mpegts.detachMediaElement();
          state.mpegts.destroy();
        } catch(e) {}
      });
      state.mpegts = null;
    }
    safeCall(() => { video.pause(); video.removeAttribute('src'); video.load(); });

    applyFitMode(state.fitMode);

    try {
      const detectedType = await detectStreamType(url);
      state.currentStreamType = detectedType;
      console.log(`✅ نوع البث: ${detectedType}`);

      if (detectedType === 'hls') loadHlsOrNative(url, state.networkQuality);
      else if (detectedType === 'mpegts') loadMpegts(url, state.networkQuality, originalUrl);
      else if (detectedType === 'mp4') loadNativeMp4(url);
      else loadMpegts(url, state.networkQuality, originalUrl);
    } catch (e) {
      console.error('❌ فشل الكشف:', e);
      loadMpegts(url, state.networkQuality, originalUrl);
    }

    const titleEl = $('playerTitle');
    if (titleEl) titleEl.textContent = channel.name_ar || '';
  }

  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  function loadHlsOrNative(url, networkQuality) {
    const video = state.video;
    const useNativeHls = isIOS() || (!(typeof Hls !== 'undefined' && Hls.isSupported()) && video.canPlayType('application/vnd.apple.mpegurl'));
    if (useNativeHls && video.canPlayType('application/vnd.apple.mpegurl')) loadNativeHls(url);
    else if (typeof Hls !== 'undefined' && Hls.isSupported()) loadHlsJs(url, networkQuality);
    else loadNativeHls(url);
  }

  function loadNativeHls(url) {
    const video = state.video;
    state.currentStreamType = 'native';
    video.src = url;
    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      hideLoading(); state.isLoading = false;
      restoreResume(video);
      video.play().catch(() => {});
      showControls();
    };
    const onErr = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      if (typeof mpegts !== 'undefined') loadMpegts(url, state.networkQuality, url);
      else tryNextServer();
    };
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onErr);
  }

  function loadNativeMp4(url) {
    const video = state.video;
    state.currentStreamType = 'mp4';
    video.src = url;
    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      hideLoading(); state.isLoading = false;
      video.play().catch(() => {});
      showControls();
    };
    const onErr = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onErr);
      loadMpegts(url, state.networkQuality, url);
    };
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onErr);
  }

  function getHlsConfig(networkQuality) {
    const common = {
      enableWorker: true, testBandwidth: true, debug: false,
      progressive: false, startFragPrefetch: true
    };
    const presets = {
      weak: { lowLatencyMode: false, backBufferLength: 10, maxBufferLength: 20, maxMaxBufferLength: 40, startLevel: 0 },
      medium: { lowLatencyMode: false, backBufferLength: 20, maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1 },
      good: { lowLatencyMode: true, backBufferLength: 40, maxBufferLength: 40, maxMaxBufferLength: 90, startLevel: -1 },
      excellent: { lowLatencyMode: true, backBufferLength: 60, maxBufferLength: 60, maxMaxBufferLength: 120, startLevel: -1 },
      unknown: {}
    };
    return { ...common, ...(presets[networkQuality] || presets.medium) };
  }

  function loadHlsJs(url, networkQuality) {
    const video = state.video;
    state.currentStreamType = 'hls';
    state.hls = new Hls(getHlsConfig(networkQuality));
    state.hls.loadSource(url);
    state.hls.attachMedia(video);

    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hideLoading(); state.isLoading = false;
      restoreResume(video);
      video.play().catch(() => {});
      showControls();
    });

    state.hls.on(Hls.Events.ERROR, (e, d) => {
      if (!d.fatal) return;
      console.warn('HLS fatal:', d.type, d.details);
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (state.retry.count < state.retry.maxCount) {
          state.retry.count++;
          setTimeout(() => safeCall(() => state.hls.startLoad()), 2000);
        } else tryNextServer();
      } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
        safeCall(() => state.hls.recoverMediaError());
      } else tryNextServer();
    });
  }

  function loadMpegts(url, networkQuality, originalUrl) {
    const video = state.video;
    if (typeof mpegts === 'undefined' || !mpegts.isSupported()) {
      video.src = url;
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        hideLoading(); state.isLoading = false;
        video.play().catch(() => {});
        showControls();
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', () => tryNextServer());
      return;
    }

    state.currentStreamType = 'mpegts';
    const isWeak = networkQuality === 'weak' || networkQuality === 'medium';

    const mpegtsConfig = {
      enableWorker: true, enableStashBuffer: false, stashInitialSize: 384,
      isLive: true, lazyLoad: false, deferLoadAfterSourceOpen: false,
      autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: isWeak ? 15 : 30,
      autoCleanupMinBackwardDuration: isWeak ? 6 : 12,
      fixAudioTimestampGap: false, accurateSeek: false,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: isWeak ? 4.0 : 8.0,
      liveBufferLatencyMinRemain: isWeak ? 0.5 : 1.0,
      cors: true, withCredentials: false
    };

    try {
      state.mpegts = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: url, cors: true }, mpegtsConfig);
      state.mpegts.attachMediaElement(video);
      state.mpegts.load();

      setTimeout(() => { state.mpegts.play().catch(() => {}); }, 100);

      state.mpegts.on(mpegts.Events.ERROR, (type, detail) => {
        console.error('❌ mpegts خطأ:', type, detail);

        const errorStr = String(detail || '').toLowerCase();
        const isCodecError =
          errorStr.includes('formatunsupported') ||
          errorStr.includes('format unsupported') ||
          errorStr.includes('mediaerror') ||
          errorStr.includes('codec') ||
          detail === 'MediaError';

        if (isCodecError || type === 'MediaError') {
          if (state.codecFailed) return;
          state.codecFailed = true;

          console.warn('🎯 كوديك غير مدعوم (H.265) — فتح VLC');
          hideLoading();
          state.isLoading = false;

          let streamUrl = originalUrl || url;
          if (streamUrl.includes('workers.dev')) {
            const match = streamUrl.match(/url=([^&]+)/);
            if (match) {
              try { streamUrl = decodeURIComponent(match[1]); } catch(e) {}
            }
          }

          setTimeout(() => openInVLC(streamUrl), 300);
          return;
        }

        if (type === 'NetworkError') {
          if (state.retry.count < state.retry.maxCount) {
            state.retry.count++;
            setTimeout(() => reloadStream(), 2000 * state.retry.count);
          } else tryNextServer();
        } else tryNextServer();
      });

      state.mpegts.on(mpegts.Events.MEDIA_INFO, () => {
        hideLoading(); state.isLoading = false;
        showControls();
      });

      setTimeout(() => {
        if (video.readyState >= 2 && video.paused) {
          video.play().catch(() => {});
          hideLoading(); state.isLoading = false;
        }
      }, 2000);

      setTimeout(() => {
        if (video.paused && state.isLoading && !state.codecFailed) {
          if (state.retry.count < state.retry.maxCount) {
            state.retry.count++;
            reloadStream();
          } else {
            let streamUrl = originalUrl || url;
            if (streamUrl.includes('workers.dev')) {
              const match = streamUrl.match(/url=([^&]+)/);
              if (match) {
                try { streamUrl = decodeURIComponent(match[1]); } catch(e) {}
              }
            }
            showToast('🎬 فتح VLC...', 'info');
            openInVLC(streamUrl);
          }
        }
      }, 8000);

    } catch (e) {
      console.error('❌ فشل mpegts:', e);
      if (typeof Hls !== 'undefined' && Hls.isSupported()) loadHlsJs(url, state.networkQuality);
      else tryNextServer();
    }
  }

  function updateQualityPills(qualities, activeIdx, serverId) {
    const container = $('qualityPills');
    if (!container) return;
    if (!qualities || qualities.length === 0) qualities = ['HD'];
    state.currentQualities = qualities.slice();

    let html = '';
    const isAuto = state.manualQualityIndex === null;
    html += `<button class="quality-pill quality-pill-auto ${isAuto ? 'active' : ''}" data-auto="1" onclick="switchServerAuto()">AUTO</button>`;
    html += qualities.map((q, i) => {
      const isActive = !isAuto && i === activeIdx;
      return `<button class="quality-pill ${isActive ? 'active' : ''}" data-index="${i}" onclick="switchServer(${i})">${q}</button>`;
    }).join('');
    container.innerHTML = html;
  }

  function updateServerCounter() {
    const el = $('serverCounter');
    if (!el || !state.currentChannel) return;
    let total = 0;
    if (typeof getChannelUrls === 'function') total = getChannelUrls(state.currentChannel, state.currentServer).length;
    if (total === 0) return;
    el.textContent = `${state.currentServerIndex + 1}/${total}`;
  }

  function setManualQuality(levelIndex, silent) {
    if (levelIndex === null || levelIndex === -1) {
      state.manualQualityIndex = null;
      if (state.hls) { state.hls.currentLevel = -1; state.hls.autoLevelCapping = -1; }
      if (!silent) showToast('🎚️ جودة تلقائية', 'info');
      updateQualityPillsUI(-1);
      return;
    }
    if (!state.hls || !state.hls.levels || state.hls.levels.length === 0) {
      if (state.currentChannel) {
        if (!silent) showToast(`🔄 تبديل إلى ${state.currentQualities[levelIndex] || 'الرابط ' + (levelIndex + 1)}...`, 'info');
        updateQualityPillsUI(levelIndex);
        loadChannel(state.currentChannel, levelIndex, state.currentServer);
      }
      return;
    }
    state.manualQualityIndex = levelIndex;
    if (levelIndex >= 0 && levelIndex < state.hls.levels.length) {
      state.hls.currentLevel = levelIndex;
      state.hls.autoLevelCapping = levelIndex;
      if (!silent) showToast(`🎚️ جودة ${state.currentQualities[levelIndex]}`, 'info');
      updateQualityPillsUI(levelIndex);
    }
  }

  function updateQualityPillsUI(levelIndex) {
    document.querySelectorAll('.quality-pill').forEach(p => {
      const isAutoBtn = p.dataset.auto === '1';
      if (levelIndex === null || levelIndex === -1) p.classList.toggle('active', isAutoBtn);
      else p.classList.toggle('active', !isAutoBtn && parseInt(p.dataset.index) === levelIndex);
    });
  }

  function addToRecent(channel) {
    try {
      let recent = JSON.parse(localStorage.getItem(STORAGE.recent) || '[]');
      recent = recent.filter(r => r.id !== channel.id);
      recent.unshift({ id: channel.id, name_ar: channel.name_ar, logo: channel.logo, time: Date.now() });
      recent = recent.slice(0, 20);
      localStorage.setItem(STORAGE.recent, JSON.stringify(recent));
    } catch (e) {}
  }

  async function tryNextServer() {
    if (!state.currentChannel) return;
    const effectiveServerId = state.currentServer || 'm3u';
    let urls = [];
    if (typeof getChannelUrls === 'function') urls = getChannelUrls(state.currentChannel, effectiveServerId);
    if (!urls || urls.length <= 1) {
      showToast('⚠️ لا توجد روابط بديلة', 'warning');
      hideLoading(); state.isLoading = false;
      return;
    }
    state.retry.serverAttempts++;
    if (state.retry.serverAttempts > state.retry.maxServerAttempts) {
      showToast('⚠️ تعذر تشغيل القناة', 'error');
      hideLoading(); state.isLoading = false;
      return;
    }
    const next = (state.currentServerIndex + 1) % urls.length;
    showToast(`🔄 جرب الرابط ${next + 1}`, 'info');
    loadChannel(state.currentChannel, next, effectiveServerId);
  }

  function saveResume() {
    if (!state.currentChannel || state.isLiveStream || !state.video) return;
    const t = state.video.currentTime;
    if (t > 5 && isFinite(t)) {
      try { localStorage.setItem(STORAGE.resume + state.currentChannel.id, JSON.stringify({ time: t, ts: Date.now() })); } catch (e) {}
    }
  }

  function restoreResume(video) {
    if (!state.currentChannel) return;
    try {
      const raw = localStorage.getItem(STORAGE.resume + state.currentChannel.id);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Date.now() - data.ts > 7 * 24 * 3600 * 1000) return;
      if (data.time > 10 && video.duration && data.time < video.duration - 10) video.currentTime = data.time;
    } catch (e) {}
  }

  function toggleFullscreen() {
    const container = $('playerContainer');
    if (!container) return;
    if (!getFullscreenElement()) {
      const p = requestFullscreen(container);
      if (p && p.catch) p.catch(() => {
        const page = $('playerPage');
        if (page) {
          const p2 = requestFullscreen(page);
          if (p2 && p2.catch) p2.catch(() => {
            if (state.video.webkitEnterFullscreen) safeCall(() => state.video.webkitEnterFullscreen());
          });
        }
      });
      setTimeout(showControls, 200);
    } else exitFullscreen();
    vibrate(15);
  }

  function onFullscreenChange() {
    state.isFullscreen = !!getFullscreenElement();
    const icon = $('fullscreenIcon');
    if (icon) {
      icon.innerHTML = state.isFullscreen
        ? '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'
        : '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>';
    }
    if (state.isFullscreen) setTimeout(showControls, 100);
  }

  function onOrientationChange() {
    if (state.isFullscreen && state.video) setTimeout(() => state.video.play().catch(() => {}), 200);
  }

  function onVisibilityChange() {
    if (document.hidden) { saveResume(); releaseWakeLock(); }
    else if (state.isPlaying) requestWakeLock();
  }

  function togglePiP() {
    const video = state.video;
    if (!video) return;
    if (!document.pictureInPictureEnabled) { showToast('⚠️ PiP غير مدعوم', 'warning'); return; }
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else video.requestPictureInPicture().catch(() => showToast('⚠️ فشل تفعيل PiP', 'warning'));
  }

  function takeScreenshot() {
    const video = state.video;
    if (!video || !state.currentChannel) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.currentChannel.name_ar || 'screenshot'}_${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('📸 تم حفظ اللقطة', 'success');
      });
    } catch (e) { showToast('⚠️ فشل التقاط الشاشة', 'warning'); }
  }

  function togglePlay() {
    const video = state.video;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
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
    loadChannel(state.currentChannel, state.currentServerIndex, state.currentServer);
  }

  function toggleMute() {
    const video = state.video;
    if (!video) return;
    video.muted = !video.muted;
    state.isMuted = video.muted;
    updateVolumeIcon();
  }

  function setVolume(v, silent) {
    const video = state.video;
    if (!video) return;
    state.currentVolume = Math.max(0, Math.min(1, parseFloat(v)));
    video.volume = state.currentVolume;
    video.muted = state.currentVolume === 0;
    updateVolumeIcon();
    localStorage.setItem(STORAGE.volume, state.currentVolume);
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
    const level = (video.muted || video.volume === 0) ? 0 : video.volume < 0.5 ? 1 : 2;
    const paths = {
      0: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/>',
      1: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
      2: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'
    };
    icon.innerHTML = paths[level];
  }

  function cycleSpeed() {
    if (state.isLiveStream) { showToast('⛔ البث المباشر', 'warning'); return; }
    const idx = SPEEDS.indexOf(state.playbackSpeed);
    state.playbackSpeed = SPEEDS[(idx + 1) % SPEEDS.length];
    state.video.playbackRate = state.playbackSpeed;
    localStorage.setItem(STORAGE.speed, state.playbackSpeed);
    showToast(`⚡ ${state.playbackSpeed}x`, 'info');
  }

  function onLoadedMetadata() {
    const video = state.video;
    if (isFinite(video.duration) && video.duration > 0) {
      const total = $('totalTime');
      if (total) total.textContent = formatTime(video.duration);
      state.isLiveStream = false;
      state.isLoaded = true;
    } else {
      const total = $('totalTime');
      if (total) total.textContent = '🔴 مباشر';
      state.isLiveStream = true;
      state.isLoaded = true;
    }
    applyFitMode(state.fitMode);
  }

  function onPlaying() {
    state.isPlaying = true;
    hideLoading(); state.isLoading = false;
    updatePlayButton(true);
    requestWakeLock();
    resetHideTimer();
  }

  function onPause() {
    state.isPlaying = false;
    updatePlayButton(false);
    releaseWakeLock();
    showControls();
    saveResume();
  }

  function onWaiting() {
    if (state.isPlaying) { showLoading('جاري التحميل...', ''); state.isLoading = true; }
  }

  function onCanPlay() { hideLoading(); state.isLoading = false; }

  function onStalled() {
    if (!state.isPlaying) return;
    showLoading('جاري التحميل...', '');
    state.isLoading = true;
  }

  function onEnded() {
    state.isPlaying = false;
    updatePlayButton(false);
    showControls();
  }

  function onTimeUpdate() {
    const video = state.video;
    const currentTimeEl = $('currentTime');
    if (!currentTimeEl || !video || state.isScrubbing) return;
    if (Math.floor(video.currentTime) % 10 === 0) saveResume();
    if (state.isLiveStream || !isFinite(video.duration) || !video.duration) {
      currentTimeEl.textContent = '🔴 مباشر';
      const f = $('progressFill');
      if (f) f.style.width = '100%';
      return;
    }
    const p = (video.currentTime / video.duration) * 100;
    const fill = $('progressFill');
    if (fill) fill.style.width = p + '%';
    currentTimeEl.textContent = formatTime(video.currentTime);
  }

  function onBufferProgress() {
    const video = state.video;
    if (!video?.buffered || video.buffered.length === 0) return;
    if (!isFinite(video.duration)) return;
    const b = video.buffered.end(video.buffered.length - 1);
    const p = (b / video.duration) * 100;
    const buffer = $('progressBuffer');
    if (buffer) buffer.style.width = p + '%';
  }

  function onError() {
    if (state.currentChannel && !state.codecFailed) tryNextServer();
  }

  function updatePlayButton(playing) {
    const icon = $('playIcon');
    if (icon) {
      icon.innerHTML = playing
        ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
        : '<polygon points="6 3 20 12 6 21"/>';
    }
  }

  function showLoading(msg, sub) {
    const loadingEl = $('playerLoading');
    if (!loadingEl) return;
    const msgEl = $('loadingMsg');
    const subEl = $('loadingSub');
    if (msgEl) msgEl.textContent = msg || 'جاري التحميل...';
    if (subEl) subEl.textContent = sub || '';
    loadingEl.classList.add('show');
  }

  function hideLoading() { const el = $('playerLoading'); if (el) el.classList.remove('show'); }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      on(state.wakeLock, 'release', () => { state.wakeLock = null; });
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (state.wakeLock) { safeCall(() => state.wakeLock.release()); state.wakeLock = null; }
  }

  return {
    init, loadChannel, togglePlay, seekBy, seekFromClick, toggleMute, setVolume,
    cycleSpeed, toggleFullscreen, togglePiP, takeScreenshot, reloadStream,
    showControls, hideControls, formatTime, isIOS, setManualQuality,
    measureNetworkSpeed, toggleFitMode, applyFitMode, detectStreamType,
    openInVLC,
    getFitMode: () => state.fitMode,
    getNetworkQuality: () => state.networkQuality,
    getHlsLevels: () => state.hls ? state.hls.levels.map(l => ({ height: l.height, bitrate: l.bitrate })) : [],
    getCurrentChannel: () => state.currentChannel,
    getCurrentServerIndex: () => state.currentServerIndex,
    getCurrentQualities: () => state.currentQualities.slice(),
    getStreamType: () => state.currentStreamType,
    getState: () => ({ ...state, video: undefined, hls: undefined, mpegts: undefined }),
    setCurrentServer: (serverId) => { state.currentServer = serverId; },
    getCurrentServer: () => state.currentServer,
    setCurrentGroup: (groupId) => { state.currentGroup = groupId; },
    getCurrentGroup: () => state.currentGroup,
    getManualQualityIndex: () => state.manualQualityIndex,
    isManualQuality: () => state.manualQualityIndex !== null,
    isLoading: () => state.isLoading
  };
})();

window.PlayerEngine = PlayerEngine;
console.log('✅ H90 PlayerEngine v21.0 loaded (AppLauncher + Quality Picker)');

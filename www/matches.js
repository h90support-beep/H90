/* ================================================================
   H90 v5.2 — وحدة المباريات (Matches Module) — PREMIUM UI EDITION
   ================================================================
   ✅ [v5.2] تصميم بطاقات جديد واحترافي يدعم الثيمين
   ✅ [v5.1] Proxy لشعارات الفرق (Weserv)
   ✅ [v5.0] تكامل مباشر مع matchesGrid
   ✅ 3 أزرار فلترة (الكل / المفضلة / مباشر)
   ✅ ربط كامل مع teams.js (المفضلة)
   ✅ TEAM_ID_MAP — ربط IDs الفرق مع Football-Data API
   ✅ Cache ذكي (12 ساعة + offset عشوائي لكل مستخدم)
   ✅ إشعارات متعددة مرتبطة بإعدادات المستخدم
   ✅ ترتيب ذكي متقدم
   ✅ حماية شاملة من الأخطاء
   ✅ SVG مدمج
   ================================================================ */

'use strict';

(function() {

  /* ================================================================
     0. ✅ SVG Icons
     ================================================================ */
  var SVG_ICONS = {
    ball: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>',
    refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    alert: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    trophy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starFilled: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    live: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="width:100%;height:100%;display:block"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    database: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    chart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><polyline points="9 18 15 12 9 6"/></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  };

  function svg(name, color, size) {
    var icon = SVG_ICONS[name] || SVG_ICONS.ball;
    var s = size || '100%';
    if (color) {
      icon = icon.replace(/stroke="currentColor"/g, 'stroke="' + color + '"');
      icon = icon.replace(/fill="currentColor"/g, 'fill="' + color + '"');
    }
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + s + ';height:' + s + ';vertical-align:middle;">' + icon + '</span>';
  }

  /* ================================================================
     0.1 ✅ Image Proxy for Team Crests
     ================================================================ */
  function _proxyCrest(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (!url.startsWith('http')) return url;
    /* Use Weserv proxy to bypass hotlinking restrictions */
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=100&h=100&fit=contain';
  }

  /* ================================================================
     1. الإعدادات والثوابت
     ================================================================ */
  const FOOTBALL_API = 'https://h90football.houssenali222333.workers.dev/v4';
  const H90_NOTIFY_WORKER_MATCHES = 'https://h90-notfiy.dairalzor33.workers.dev';
  const H90_FIREBASE_DB = 'https://h90-app-default-rtdb.europe-west1.firebasedatabase.app';

  const ALLOWED_COMPETITIONS = [
    'PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EC', 'WC', 'ELC',
    'PPL', 'DED', 'BSA', 'CLI', 'AFC', 'CAF', 'SAU', 'MLS', 'ECL', 'EL'
  ];

  const TEAM_ID_MAP = {
    'man_city': 65, 'arsenal': 57, 'liverpool': 64, 'man_utd': 66, 'chelsea': 61,
    'tottenham': 73, 'newcastle': 67, 'aston_villa': 58, 'brighton': 397, 'west_ham': 563,
    'everton': 62, 'wolves': 76, 'crystal_palace': 354, 'brentford': 402, 'fulham': 63,
    'nottingham': 351, 'bournemouth': 1044, 'leicester': 338, 'southampton': 340, 'ipswich': 349,
    'real_madrid': 86, 'barcelona': 81, 'atletico': 78, 'sevilla': 559, 'real_betis': 90,
    'real_sociedad': 92, 'athletic': 77, 'villarreal': 94, 'valencia': 95, 'girona': 298,
    'osasuna': 79, 'celta': 558, 'mallorca': 89, 'getafe': 82, 'rayo': 87,
    'alaves': 263, 'las_palmas': 275, 'leganes': 745, 'valladolid': 250, 'espanyol': 80,
    'inter': 108, 'milan': 98, 'juventus': 109, 'napoli': 113, 'roma': 100,
    'lazio': 110, 'atalanta': 102, 'fiorentina': 99, 'bologna': 103, 'torino': 586,
    'udinese': 115, 'genoa': 107, 'monza': 5911, 'lecce': 5890, 'cagliari': 104,
    'verona': 450, 'como': 7397, 'parma': 112, 'venezia': 454, 'empoli': 445,
    'bayern': 5, 'dortmund': 4, 'leipzig': 721, 'leverkusen': 3, 'frankfurt': 19,
    'wolfsburg': 11, 'monchengladbach': 18, 'stuttgart': 10, 'freiburg': 17, 'union_berlin': 28,
    'werder': 12, 'hoffenheim': 2, 'mainz': 15, 'augsburg': 16, 'bochum': 36,
    'heidenheim': 44, 'st_pauli': 20, 'holstein': 720,
    'psg': 524, 'marseille': 516, 'lyon': 523, 'monaco': 548, 'lille': 521,
    'nice': 522, 'lens': 546, 'rennes': 529, 'strasbourg': 576, 'toulouse': 511,
    'reims': 547, 'nantes': 543, 'montpellier': 518, 'brest': 512, 'auxerre': 519,
    'angers': 532, 'le_havre': 533, 'saint_etienne': 527,
    'al_hilal': 2932, 'al_nassr': 2939, 'al_ittihad': 2938, 'al_ahli': 2937,
    'inter_miami': 18411, 'la_galaxy': 1903, 'lafc': 18412,
    'bra': 764, 'arg': 762, 'fra': 773, 'esp': 760, 'ger': 759,
    'ita': 784, 'eng': 770, 'por': 765, 'ned': 8601, 'bel': 805,
    'cro': 799, 'uru': 758, 'mex': 769, 'usa': 771, 'jpn': 766,
    'kor': 772, 'mar': 815, 'egy': 825, 'ksa': 801, 'syr': 8873,
    'ira': 840, 'qat': 803, 'uae': 796, 'jor': 795, 'tun': 802,
    'alg': 778, 'sen': 804, 'nga': 766, 'cmr': 776, 'gha': 763, 'civ': 786
  };

  var _reversedIdMap = null;
  function _getReversedMap() {
    if (_reversedIdMap) return _reversedIdMap;
    _reversedIdMap = {};
    Object.keys(TEAM_ID_MAP).forEach(function(key) {
      _reversedIdMap[TEAM_ID_MAP[key]] = key;
    });
    return _reversedIdMap;
  }

  const MATCH_MODULE_TIME_KEY = 'h90_match_reminder_time';
  const MATCH_MODULE_NOTIFIED_KEY = 'h90_notified_matches_v3';
  const MATCH_MODULE_CACHE_KEY = 'h90_matches_cache';
  const MATCH_MODULE_DAILY_CACHE_KEY = 'h90_matches_daily_cache_v2';
  const DAILY_CACHE_VERSION = 2;
  const MATCH_MODULE_CACHE_DURATION = 60000;
  const MAX_RETRY_ATTEMPTS = 3;
  const H90_OFFSET_KEY = 'h90_cache_offset_v1';

  /* ================================================================
     2. الحالة العامة
     ================================================================ */
  let notifiedMatches = {};
  let matchReminderInterval = null;
  let _currentMatchesFilter = 'all';

  try {
    notifiedMatches = JSON.parse(localStorage.getItem(MATCH_MODULE_NOTIFIED_KEY) || '{}');
  } catch (e) {
    notifiedMatches = {};
  }

  /* ================================================================
     3. دوال مساعدة
     ================================================================ */
  function _showToast(msg, type) {
    if (window.showToast) window.showToast(msg, type);
    else if (window.showToastSafe) window.showToastSafe(msg, type);
  }

  function _getMatchesContainer() {
    var el = document.getElementById('matchesGrid');
    if (el) return el;
    el = document.getElementById('channelsGrid');
    if (el) return el;
    return null;
  }

  function _renderEmptyState(iconName, title, desc) {
    var iconSvg = svg(iconName, 'currentColor', '40px');
    return '<div class="empty-state">' +
      '<div class="icon">' + iconSvg + '</div>' +
      '<div class="title">' + title + '</div>' +
      '<div class="desc">' + desc + '</div>' +
    '</div>';
  }

  function _getNotifSettings() {
    try {
      var DEFAULT = {
        general: true, matches: true, breaking: false,
        newchannels: true, streamOffline: true, dnd: false
      };
      return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem('h90_notif_settings') || '{}'));
    } catch (e) {
      return {
        general: true, matches: true, breaking: false,
        newchannels: true, streamOffline: true, dnd: false
      };
    }
  }

  function normalizeTeamName(name) {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, '')
      .replace(/_(fc|cf|sc|ac|afc)$/i, '')
      .replace(/^(fc|cf|sc|ac|afc)_/i, '');
  }

  /* ================================================================
     4. مطابقة الفرق المفضلة
     ================================================================ */
  function isFavoriteTeamMatch(match) {
    var fav = (window.getFavoriteTeams && window.getFavoriteTeams()) || {};
    var favKeys = Object.keys(fav);
    if (favKeys.length === 0) return false;

    var homeId = match.homeTeam && match.homeTeam.id;
    var awayId = match.awayTeam && match.awayTeam.id;
    var homeName = (match.homeTeam && match.homeTeam.name) || '';
    var awayName = (match.awayTeam && match.awayTeam.name) || '';

    var homeIdStr = homeId ? String(homeId) : '';
    var awayIdStr = awayId ? String(awayId) : '';
    var homeNormalized = normalizeTeamName(homeName);
    var awayNormalized = normalizeTeamName(awayName);

    var reversedMap = _getReversedMap();

    return favKeys.some(function(favKey) {
      var apiId = TEAM_ID_MAP[favKey];
      if (apiId) {
        if (String(apiId) === homeIdStr || String(apiId) === awayIdStr) {
          return true;
        }
      }

      var teamsIdFromApi = reversedMap[homeId];
      if (teamsIdFromApi && teamsIdFromApi === favKey) return true;
      teamsIdFromApi = reversedMap[awayId];
      if (teamsIdFromApi && teamsIdFromApi === favKey) return true;

      var favNormalized = normalizeTeamName(favKey);
      if (favNormalized === homeNormalized || favNormalized === awayNormalized) {
        return true;
      }

      if (homeNormalized.indexOf(favNormalized) > -1 && favNormalized.length >= 4) return true;
      if (awayNormalized.indexOf(favNormalized) > -1 && favNormalized.length >= 4) return true;

      return false;
    });
  }

  function getMatchedFavoriteId(match) {
    var fav = (window.getFavoriteTeams && window.getFavoriteTeams()) || {};
    var favKeys = Object.keys(fav);
    if (favKeys.length === 0) return null;

    var homeId = String(match.homeTeam && match.homeTeam.id || '');
    var awayId = String(match.awayTeam && match.awayTeam.id || '');
    var homeName = (match.homeTeam && match.homeTeam.name) || '';
    var awayName = (match.awayTeam && match.awayTeam.name) || '';

    var homeNormalized = normalizeTeamName(homeName);
    var awayNormalized = normalizeTeamName(awayName);

    for (var i = 0; i < favKeys.length; i++) {
      var favKey = favKeys[i];
      var apiId = TEAM_ID_MAP[favKey];

      if (apiId && (String(apiId) === homeId || String(apiId) === awayId)) {
        return favKey;
      }

      var favNormalized = normalizeTeamName(favKey);
      if (favNormalized === homeNormalized || favNormalized === awayNormalized) {
        return favKey;
      }
    }

    return null;
  }

  /* ================================================================
     5. نظام Cache ذكي
     ================================================================ */
  function _getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _getUserOffset() {
    try {
      var offset = localStorage.getItem(H90_OFFSET_KEY);
      if (offset === null) {
        offset = Math.floor(Math.random() * 12);
        localStorage.setItem(H90_OFFSET_KEY, String(offset));
      }
      return parseInt(offset, 10) || 0;
    } catch (e) { return 0; }
  }

  function _getCacheAgeHours(cached) {
    if (!cached || !cached.time) return 999;
    return (Date.now() - cached.time) / (1000 * 60 * 60);
  }

  function _isDailyCacheValid(cached) {
    if (!cached || !cached.data) return false;
    if (cached.version !== DAILY_CACHE_VERSION) return false;
    var ageHours = _getCacheAgeHours(cached);
    var offset = _getUserOffset();
    var cacheLifetime = 12 + (offset / 60);
    if (ageHours >= cacheLifetime) return false;
    return true;
  }

  function _readDailyCache() {
    try {
      var raw = localStorage.getItem(MATCH_MODULE_DAILY_CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || cached.version !== DAILY_CACHE_VERSION) {
        clearDailyMatchesCache();
        return null;
      }
      if (!_isDailyCacheValid(cached)) {
        clearDailyMatchesCache();
        return null;
      }
      return cached;
    } catch (e) {
      clearDailyMatchesCache();
      return null;
    }
  }

  function _writeDailyCache(data) {
    try {
      var payload = {
        version: DAILY_CACHE_VERSION,
        date: _getTodayKey(),
        time: Date.now(),
        offset: _getUserOffset(),
        data: data
      };
      localStorage.setItem(MATCH_MODULE_DAILY_CACHE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) { return false; }
  }

  function clearDailyMatchesCache() {
    try { localStorage.removeItem(MATCH_MODULE_DAILY_CACHE_KEY); } catch (e) {}
  }

  /* ================================================================
     6. جلب المباريات مع Cache
     ================================================================ */
  async function fetchMatchesWithCache(forceRefresh) {
    if (!forceRefresh) {
      var dailyCache = _readDailyCache();
      if (dailyCache && dailyCache.data) {
        var ageMinutes = Math.floor((Date.now() - dailyCache.time) / 60000);
        dailyCache.data._fromCache = true;
        dailyCache.data._fromDailyCache = true;
        dailyCache.data._cacheAge = ageMinutes * 60;
        return dailyCache.data;
      }
    }

    if (!forceRefresh) {
      var cache = null;
      try {
        cache = JSON.parse(sessionStorage.getItem(MATCH_MODULE_CACHE_KEY) || 'null');
      } catch (e) { cache = null; }

      if (cache && cache.data && (Date.now() - cache.time) < MATCH_MODULE_CACHE_DURATION) {
        cache.data._cacheAge = Math.floor((Date.now() - cache.time) / 1000);
        cache.data._fromCache = true;
        cache.data._fromDailyCache = false;
        return cache.data;
      }
    }

    var lastError = null;
    for (var attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        var controller = new AbortController();
        var timeout = setTimeout(function() { controller.abort(); }, 10000);

        var res = await fetch(FOOTBALL_API + '/matches', {
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error('HTTP ' + res.status);

        var data = await res.json();

        try {
          sessionStorage.setItem(MATCH_MODULE_CACHE_KEY, JSON.stringify({
            data: data,
            time: Date.now()
          }));
        } catch (e) {}

        try { _writeDailyCache(data); } catch (e) {}

        data._fromCache = false;
        data._fromDailyCache = false;
        data._cacheAge = 0;
        return data;

      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
        }
      }
    }

    throw lastError || new Error('فشل الاتصال');
  }

  function clearMatchesCache() {
    try { sessionStorage.removeItem(MATCH_MODULE_CACHE_KEY); } catch (e) {}
  }

  /* ================================================================
     7. ترتيب المباريات
     ================================================================ */
  function sortMatchesSmart(matches) {
    return matches.slice().sort(function (a, b) {
      var aFav = isFavoriteTeamMatch(a) ? 0 : 1;
      var bFav = isFavoriteTeamMatch(b) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      var priority = function (m) {
        if (m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED') return 0;
        if (m.status === 'SCHEDULED' || m.status === 'TIMED') return 1;
        if (m.status === 'FINISHED') return 2;
        return 3;
      };

      var pA = priority(a);
      var pB = priority(b);
      if (pA !== pB) return pA - pB;

      if (pA === 0) return new Date(b.utcDate) - new Date(a.utcDate);
      if (pA === 1) return new Date(a.utcDate) - new Date(b.utcDate);
      return new Date(b.utcDate) - new Date(a.utcDate);
    });
  }

  /* ================================================================
     8. الفلترة
     ================================================================ */
  function filterMatches(matches, filter) {
    if (!filter || filter === 'all') return matches;

    if (filter === 'favorites') {
      return matches.filter(function(m) { return isFavoriteTeamMatch(m); });
    }

    if (filter === 'live') {
      return matches.filter(function(m) {
        return m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED';
      });
    }

    if (filter === 'today') {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return matches.filter(function(m) {
        var d = new Date(m.utcDate);
        return d >= today && d < tomorrow;
      });
    }

    return matches;
  }

  /* ================================================================
     9. Hero
     ================================================================ */
  function _renderMatchesHero(total, live, fav, cacheInfo) {
    var isLive = live > 0;

    var cacheBadge = '';
    if (cacheInfo) {
      if (cacheInfo.fromCache) {
        cacheBadge =
          '<span class="ent-hero-badge" style="color:#00e5ff;border-color:rgba(0,229,255,0.3);background:rgba(0,229,255,0.1);">' +
            '<span style="width:11px;height:11px;display:inline-block;">' + svg('database', '#00e5ff', '100%') + '</span>' +
            'محفوظ' +
          '</span>';
      } else {
        cacheBadge =
          '<span class="ent-hero-badge" style="color:#00e676;border-color:rgba(0,230,118,0.3);background:rgba(0,230,118,0.1);">' +
            '<span style="width:11px;height:11px;display:inline-block;">' + svg('refresh', '#00e676', '100%') + '</span>' +
            'محدث الآن' +
          '</span>';
      }
    }

    return (
      '<div class="matches-container">' +
        '<div class="matches-hero">' +
          '<div class="matches-hero-icon">' +
            svg('ball', '#001a0e', '100%') +
          '</div>' +
          '<div class="matches-hero-content">' +
            '<div class="matches-hero-title">المباريات</div>' +
            '<div class="matches-hero-desc">' +
              total + ' مباراة' +
              (live > 0 ? ' · ' + live + ' مباشر' : '') +
              (fav > 0 ? ' · ' + fav + ' فريقك' : '') +
            '</div>' +
            (isLive ?
              '<div class="matches-hero-badge">' +
                '<span class="pulse-dot"></span>' +
                'LIVE NOW' +
              '</div>' :
              '<div class="matches-hero-badge" style="color:#ffb300;border-color:rgba(255,179,0,0.4);background:rgba(255,179,0,0.1);">' +
                '<span style="width:10px;height:10px;display:inline-block;">' + svg('clock', '#ffb300', '100%') + '</span>' +
                'قريباً' +
              '</div>'
            ) +
            (cacheBadge ? '<div style="margin-top:8px;">' + cacheBadge + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ================================================================
     10. Filter tabs
     ================================================================ */
  function _buildFilterTabs() {
    var tabs = [
      { id: 'all',       label: 'الكل',     icon: 'trophy' },
      { id: 'favorites', label: 'المفضلة',  icon: 'starFilled' },
      { id: 'live',      label: 'مباشر',    icon: 'live' },
    ];

    var html = '<div style="grid-column:1/-1;">';
    html += '<div class="matches-tabs">';

    tabs.forEach(function(t) {
      var isActive = _currentMatchesFilter === t.id;
      html +=
        '<button class="matches-tab' + (isActive ? ' active' : '') + '" data-filter="' + t.id + '">' +
          '<span style="width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;">' +
            svg(t.icon, isActive ? '#001a0e' : 'currentColor', '100%') +
          '</span>' +
          '<span>' + t.label + '</span>' +
        '</button>';
    });

    html += '</div>';
    html += '</div>';
    return html;
  }

  /* ================================================================
     11. Match Card — التصميم الاحترافي الجديد ✅
     ================================================================ */
  function renderMatchCard(match) {
    var homeTeam = (match.homeTeam && match.homeTeam.name) ? match.homeTeam.name : 'TBD';
    var awayTeam = (match.awayTeam && match.awayTeam.name) ? match.awayTeam.name : 'TBD';
    var competition = (match.competition && match.competition.name) ? match.competition.name : '';
    var homeCrestRaw = (match.homeTeam && match.homeTeam.crest) ? match.homeTeam.crest : '';
    var awayCrestRaw = (match.awayTeam && match.awayTeam.crest) ? match.awayTeam.crest : '';
    var date = new Date(match.utcDate);
    var status = match.status;
    var homeScore = (match.score && match.score.fullTime) ? match.score.fullTime.home : null;
    var awayScore = (match.score && match.score.fullTime) ? match.score.fullTime.away : null;

    /* ✅ استخدام Proxy للشعارات */
    var homeCrest = _proxyCrest(homeCrestRaw);
    var awayCrest = _proxyCrest(awayCrestRaw);

    var isLive = (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED');
    var isFinished = (status === 'FINISHED');
    var isUpcoming = (status === 'SCHEDULED' || status === 'TIMED');

    var statusText = '';
    var statusClass = '';

    if (isLive) {
      statusText = 'مباشر الآن';
      statusClass = 'live';
    } else if (isFinished) {
      statusText = 'انتهت';
      statusClass = 'finished';
    } else if (isUpcoming) {
      var hours = String(date.getHours()).padStart(2, '0');
      var minutes = String(date.getMinutes()).padStart(2, '0');
      statusText = hours + ':' + minutes;
      statusClass = 'upcoming';
    } else {
      statusText = status;
      statusClass = 'upcoming';
    }

    var score = (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined)
      ? homeScore + ' - ' + awayScore
      : 'VS';

    var homeLogoHtml = homeCrest
      ? '<div class="match-team-logo-wrap"><img class="match-team-logo" src="' + homeCrest + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><span class="match-team-logo" style="display:none;">' + svg('ball', 'currentColor', '60%') + '</span></div>'
      : '<div class="match-team-logo-wrap"><span class="match-team-logo">' + svg('ball', 'currentColor', '60%') + '</span></div>';

    var awayLogoHtml = awayCrest
      ? '<div class="match-team-logo-wrap"><img class="match-team-logo" src="' + awayCrest + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><span class="match-team-logo" style="display:none;">' + svg('ball', 'currentColor', '60%') + '</span></div>'
      : '<div class="match-team-logo-wrap"><span class="match-team-logo">' + svg('ball', 'currentColor', '60%') + '</span></div>';

    var favId = getMatchedFavoriteId(match);
    var isFavTeam = !!favId;
    var favBadge = isFavTeam
      ? '<span class="fav-team-badge">' +
        '<span style="width:11px;height:11px;display:inline-block;">' + svg('starFilled', '#00e5ff', '100%') + '</span>' +
        'فريقي</span>'
      : '';

    var cardClass = 'match-card-v2' + (isLive ? ' is-live' : '');

    return (
      '<div style="grid-column:1/-1;">' +
        '<div class="' + cardClass + '">' +
          
          // الشريط العلوي (البطولة والحالة)
          '<div class="match-header-v2">' +
            '<div class="match-competition">' +
              '<span style="width:14px;height:14px;display:inline-flex;color:var(--text-dim);">' + svg('trophy', 'currentColor', '100%') + '</span>' +
              '<span>' + competition + '</span>' +
            '</div>' +
            '<div class="match-status-v2 ' + statusClass + '">' + statusText + '</div>' +
          '</div>' +

          // جسم المباراة (الفرق والنتيجة)
          '<div class="match-body-v2">' +
            
            // الفريق المضيف
            '<div class="team-side-v2">' +
              homeLogoHtml +
              '<span class="team-name-v2">' + homeTeam + '</span>' +
            '</div>' +

            // النتيجة / الوقت
            '<div class="match-score-v2">' +
              '<div class="score-text-v2">' + score + '</div>' +
              (isUpcoming ? '<div class="score-time-v2">' + statusText + '</div>' : '') +
            '</div>' +

            // الفريق الضيف
            '<div class="team-side-v2">' +
              awayLogoHtml +
              '<span class="team-name-v2">' + awayTeam + '</span>' +
            '</div>' +

          '</div>' +

          // تذييل البطاقة (شارة المفضلة)
          (favBadge ? '<div class="match-footer-v2">' + favBadge + '</div>' : '') +

        '</div>' +
      '</div>'
    );
  }

  /* ================================================================
     12. Render Matches
     ================================================================ */
  async function renderMatches(filterType) {
    var grid = _getMatchesContainer();
    if (!grid) {
      console.warn('[Matches] لا توجد حاوية لعرض المباريات');
      return;
    }

    if (filterType) _currentMatchesFilter = filterType;

    grid.innerHTML =
      _renderMatchesHero(0, 0, 0, null) +
      _buildFilterTabs() +
      '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.55);">' +
        '<div style="position:relative;width:80px;height:80px;margin:0 auto 20px;">' +
          '<div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(0,230,118,0.2);"></div>' +
          '<div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:#00e676;animation:spin 1s linear infinite;"></div>' +
          '<div style="position:absolute;inset:15px;color:#00e676;">' + svg('ball', '#00e676', '100%') + '</div>' +
        '</div>' +
        '<div style="font-weight:800;font-size:15px;color:#fff;margin-bottom:6px;">جارٍ تحميل المباريات</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.45);">يتم الاتصال بمصدر البيانات...</div>' +
      '</div>';

    _bindFilterTabs(grid);

    try {
      var data = await fetchMatchesWithCache();

      if (!data.matches || data.matches.length === 0) {
        grid.innerHTML =
          _renderMatchesHero(0, 0, 0, null) +
          _buildFilterTabs() +
          _renderEmptyState('ball', 'لا توجد مباريات حالياً', 'عد لاحقاً لرؤية المباريات الجديدة.');
        _bindFilterTabs(grid);
        return;
      }

      var matches = data.matches.filter(function(m) {
        var compCode = (m.competition && m.competition.code) ? m.competition.code : '';
        var isAllowedComp = ALLOWED_COMPETITIONS.indexOf(compCode) > -1;
        var isFavTeam = isFavoriteTeamMatch(m);
        return isAllowedComp || isFavTeam;
      });

      matches = filterMatches(matches, _currentMatchesFilter);

      if (matches.length === 0) {
        var emptyMsg = 'لا توجد مباريات';
        if (_currentMatchesFilter === 'favorites') emptyMsg = 'لا توجد مباريات لفرقك المفضلة';
        else if (_currentMatchesFilter === 'live') emptyMsg = 'لا توجد مباريات مباشرة الآن';
        else if (_currentMatchesFilter === 'today') emptyMsg = 'لا توجد مباريات اليوم';

        grid.innerHTML =
          _renderMatchesHero(0, 0, 0, null) +
          _buildFilterTabs() +
          _renderEmptyState('ball', emptyMsg, 'جرّب تغيير الفلتر أو عد لاحقاً.');
        _bindFilterTabs(grid);
        return;
      }

      matches = sortMatchesSmart(matches);

      var liveCount = matches.filter(function(m) {
        return m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED';
      }).length;

      var favCount = matches.filter(function(m) {
        return isFavoriteTeamMatch(m);
      }).length;

      var cacheInfo = {
        fromCache: !!data._fromCache,
        fromDailyCache: !!data._fromDailyCache,
        age: data._cacheAge || 0
      };

      var html = _renderMatchesHero(matches.length, liveCount, favCount, cacheInfo);
      html += _buildFilterTabs();

      matches.slice(0, 60).forEach(function(match) {
        html += renderMatchCard(match);
      });

      // ✅ إضافة الـ CSS الجديد للبطاقات هنا لضمان تطبيقه فوراً
      if (!document.getElementById('h90-match-cards-v2-css')) {
        var style = document.createElement('style');
        style.id = 'h90-match-cards-v2-css';
        style.innerHTML = `
          /* Match Card V2 - Premium Design */
          .match-card-v2 {
            background: rgba(255, 255, 255, 0.035);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            margin: 0 16px 12px;
            overflow: hidden;
            transition: all 0.3s var(--ease);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          }
          body.theme-black .match-card-v2 {
            background: rgba(20, 20, 25, 0.8);
            border-color: rgba(255, 255, 255, 0.05);
          }
          .match-card-v2.is-live {
            border-color: rgba(255, 45, 85, 0.4);
            background: linear-gradient(180deg, rgba(255,45,85,0.08), rgba(255,255,255,0.02));
            box-shadow: 0 8px 25px rgba(255,45,85,0.15);
          }
          body.theme-black .match-card-v2.is-live {
            background: linear-gradient(180deg, rgba(255,45,85,0.12), rgba(20,20,25,0.9));
          }
          
          .match-header-v2 {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 16px;
            background: rgba(0,0,0,0.15);
            border-bottom: 1px solid rgba(255,255,255,0.04);
          }
          body.theme-black .match-header-v2 { background: rgba(0,0,0,0.4); }
          
          .match-competition {
            display: flex; align-items: center; gap: 6px;
            font-size: 11px; font-weight: 700; color: var(--text-dim);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          
          .match-status-v2 {
            font-size: 10px; font-weight: 900; padding: 3px 10px; border-radius: 12px;
            letter-spacing: 0.5px;
          }
          .match-status-v2.live { background: #ff2d55; color: #fff; box-shadow: 0 0 10px rgba(255,45,85,0.5); }
          .match-status-v2.finished { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
          .match-status-v2.upcoming { background: rgba(255,179,0,0.15); border: 1px solid rgba(255,179,0,0.3); color: #ffb300; }

          .match-body-v2 {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px;
          }
          
          .team-side-v2 {
            flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0;
          }
          
          .match-team-logo-wrap {
            width: 52px; height: 52px; border-radius: 50%;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            display: flex; align-items: center; justify-content: center;
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
          }
          body.theme-black .match-team-logo-wrap { background: #000; border-color: rgba(255,255,255,0.1); }
          
          .match-team-logo {
            width: 36px; height: 36px; object-fit: contain;
            color: var(--text-dim);
          }
          
          .team-name-v2 {
            font-size: 12.5px; font-weight: 800; color: var(--text-main);
            text-align: center; line-height: 1.3;
            overflow: hidden; text-overflow: ellipsis;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            max-width: 100%;
          }
          
          .match-score-v2 {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 0 15px; min-width: 80px;
          }
          
          .score-text-v2 {
            font-size: 22px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums;
            letter-spacing: 1px;
          }
          body.theme-black .score-text-v2 { color: #fff; }
          
          .score-time-v2 {
            font-size: 11px; font-weight: 700; color: var(--crimson-1);
            margin-top: 4px; background: rgba(255,45,85,0.1); padding: 2px 8px; border-radius: 8px;
          }

          .match-footer-v2 {
            padding: 8px 16px;
            background: rgba(0, 229, 255, 0.03);
            border-top: 1px solid rgba(255,255,255,0.04);
            display: flex; justify-content: center;
          }
          .fav-team-badge {
            display: inline-flex; align-items: center; gap: 4px;
            font-size: 10.5px; font-weight: 800; color: #00e5ff;
          }
        `;
        document.head.appendChild(style);
      }

      grid.innerHTML = html;
      _bindFilterTabs(grid);

    } catch (e) {
      console.error('❌ فشل تحميل المباريات:', e);
      grid.innerHTML =
        _renderMatchesHero(0, 0, 0, null) +
        _buildFilterTabs() +
        '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;">' +
          '<div style="width:70px;height:70px;margin:0 auto 18px;color:#ff2d55;">' + svg('alert', '#ff2d55', '100%') + '</div>' +
          '<div style="font-weight:800;font-size:16px;color:#fff;margin-bottom:8px;">فشل تحميل المباريات</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.5);word-break:break-all;margin-bottom:20px;">' + e.message + '</div>' +
          '<button onclick="window.renderMatches()" style="padding:12px 28px;background:linear-gradient(135deg,#00e676,#00b248);color:#001a0e;border:none;border-radius:14px;font-weight:800;font-family:inherit;cursor:pointer;font-size:14px;box-shadow:0 8px 20px rgba(0,230,118,0.4);">إعادة المحاولة</button>' +
        '</div>';
      _bindFilterTabs(grid);
    }
  }

  /* ================================================================
     13. Bind Filter Tabs
     ================================================================ */
  function _bindFilterTabs(grid) {
    grid.querySelectorAll('.matches-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var filter = btn.dataset.filter;
        if (filter === _currentMatchesFilter) return;

        if (typeof window.haptic === 'function') window.haptic(8);
        renderMatches(filter);
      });
    });
  }

  function refreshMatches() {
    clearMatchesCache();
    clearDailyMatchesCache();
    if (typeof window.showToast === 'function') {
      window.showToast('جارٍ التحديث...', 'info');
    }
    renderMatches(_currentMatchesFilter);
  }

  /* ================================================================
     14. Push Worker
     ================================================================ */
  async function _pushMatchToWorker(match, title, body, stageKey) {
    try {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        return false;
      }

      var deviceId = null;
      try {
        deviceId = localStorage.getItem('h90_device_id') || 'dev_anon';
      } catch (e) {
        deviceId = 'dev_anon';
      }

      var payload = {
        roomId: '__matches__',
        type: 'match_reminder',
        targetType: 'match',
        title: title,
        body: body,
        url: '/?match=' + encodeURIComponent(match.id),
        icon: (match.homeTeam && match.homeTeam.crest) ? _proxyCrest(match.homeTeam.crest) : '/H90.jpg',
        senderName: 'H90',
        matchId: match.id,
        stageKey: stageKey,
        excludeDeviceId: deviceId,
        timestamp: Date.now()
      };

      var queueRes = await fetch(H90_FIREBASE_DB + '/h90_notifications_queue.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!queueRes.ok) {
        console.warn('⚠️ [Match Push] فشل:', queueRes.status);
        return false;
      }

      fetch(H90_NOTIFY_WORKER_MATCHES + '/fcm/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result && result.processed > 0) {
          console.log('✅ [Match Push] الوركر عالج', result.processed);
        }
      })
      .catch(function(e) {});

      return true;

    } catch (e) {
      console.warn('⚠️ [Match Push] خطأ:', e.message);
      return false;
    }
  }

  /* ================================================================
     15. Reminders
     ================================================================ */
  function _getReminderTimeFromSettings() {
    try {
      var val = localStorage.getItem(MATCH_MODULE_TIME_KEY);
      if (val !== null && val !== undefined && val !== '') {
        var num = parseInt(val, 10);
        if (!isNaN(num) && num > 0 && num <= 1440) {
          return num;
        }
      }
    } catch (e) {}
    return 30;
  }

  function _getReminderStages() {
    var userTime = _getReminderTimeFromSettings();
    var stages = [];

    if (userTime >= 60) {
      stages = [userTime, 30, 15, 5];
    } else if (userTime >= 30) {
      stages = [userTime, 15, 5];
    } else if (userTime >= 15) {
      stages = [userTime, 5];
    } else {
      stages = [userTime];
    }

    return stages
      .filter(function(v, i, arr) { return arr.indexOf(v) === i; })
      .sort(function(a, b) { return b - a; });
  }

  function saveNotifiedMatches() {
    try {
      localStorage.setItem(MATCH_MODULE_NOTIFIED_KEY, JSON.stringify(notifiedMatches));
    } catch (e) {}
  }

  function cleanOldNotifiedMatches() {
    var now = Date.now();
    var cleaned = {};
    for (var key in notifiedMatches) {
      if (now - notifiedMatches[key] < 6 * 3600 * 1000) {
        cleaned[key] = notifiedMatches[key];
      }
    }
    notifiedMatches = cleaned;
    saveNotifiedMatches();
  }

  function formatTimeUntil(minutes) {
    if (minutes <= 1) return 'أقل من دقيقة';
    if (minutes < 60) return minutes + ' دقيقة';
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    if (mins === 0) return hours + ' ساعة';
    return hours + ' ساعة و ' + mins + ' دقيقة';
  }

  function _canSendNotifications() {
    if (window.H90Firebase && typeof window.H90Firebase.hasCapacitorPush === 'function') {
      if (window.H90Firebase.hasCapacitorPush()) return true;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      return true;
    }
    return false;
  }

  async function _sendMatchNotification(title, body, matchId, stageKey) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      try {
        var LN = window.Capacitor.Plugins.LocalNotifications;
        if (typeof LN.requestPermissions === 'function') {
          try { await LN.requestPermissions(); } catch (pe) {}
        }
        await LN.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title: title,
            body: body,
            schedule: { at: new Date(Date.now() + 500) },
            sound: null,
            attachments: null,
            actionTypeId: '',
            extra: { matchId: matchId, stage: stageKey, type: 'match_reminder' }
          }]
        });
        return true;
      } catch (e) {}
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        var notification = new Notification(title, {
          body: body,
          icon: 'H90.jpg',
          badge: 'H90.jpg',
          dir: 'rtl',
          lang: 'ar',
          tag: 'match-' + stageKey,
          requireInteraction: false,
          vibrate: [200, 100, 200]
        });

        notification.onclick = function() {
          try {
            window.focus();
            if (typeof window.switchTab === 'function') window.switchTab('matches');
          } catch (e) {}
          notification.close();
        };

        setTimeout(function() {
          try { notification.close(); } catch (e) {}
        }, 8000);

        return true;
      } catch (e) {}
    }

    return false;
  }

  async function checkMatchesForReminders() {
    var settings = _getNotifSettings();
    if (settings.matches === false) return;
    if (settings.dnd === true) return;
    if (!_canSendNotifications()) return;

    try {
      var data = await fetchMatchesWithCache();
      if (!data.matches) return;

      var now = Date.now();
      var reminderStages = _getReminderStages();

      data.matches.forEach(function(match) {
        if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') return;

        var compCode = (match.competition && match.competition.code) ? match.competition.code : '';
        var isAllowedComp = ALLOWED_COMPETITIONS.indexOf(compCode) > -1;
        var isFavTeam = isFavoriteTeamMatch(match);
        if (!isAllowedComp && !isFavTeam) return;

        var matchTime = new Date(match.utcDate).getTime();
        var timeUntilMatch = matchTime - now;
        if (timeUntilMatch <= 0) return;

        var minutesLeft = Math.round(timeUntilMatch / 60000);
        var matchId = String(match.id);

        reminderStages.forEach(function(stageMinutes) {
          var stageKey = matchId + '_' + stageMinutes;
          if (notifiedMatches[stageKey]) return;

          if (minutesLeft <= stageMinutes && minutesLeft > stageMinutes - 2) {
            var homeTeam = (match.homeTeam && match.homeTeam.name) ? match.homeTeam.name : 'TBD';
            var awayTeam = (match.awayTeam && match.awayTeam.name) ? match.awayTeam.name : 'TBD';
            var competition = (match.competition && match.competition.name) ? match.competition.name : '';

            var title = isFavTeam ? '⭐ مباراة فريقك — H90' : '⚽ مباراة قريبة — H90';
            var body = homeTeam + ' ضد ' + awayTeam + '\n' + competition + '\n' + 'تبدأ بعد ' + formatTimeUntil(minutesLeft);

            notifiedMatches[stageKey] = now;
            saveNotifiedMatches();

            _sendMatchNotification(title, body, matchId, stageKey);
            _pushMatchToWorker(match, title, body, stageKey);
          }
        });
      });

    } catch (e) {
      console.error('❌ فشل فحص المباريات:', e);
    }
  }

  /* ================================================================
     16. Start/Stop Reminders
     ================================================================ */
  function startMatchReminders() {
    stopMatchReminders();
    cleanOldNotifiedMatches();

    setTimeout(function() {
      checkMatchesForReminders();
    }, 3000);

    matchReminderInterval = setInterval(function() {
      if (!document.hidden) checkMatchesForReminders();
    }, 60000);
  }

  function stopMatchReminders() {
    if (matchReminderInterval) {
      clearInterval(matchReminderInterval);
      matchReminderInterval = null;
    }
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (matchReminderInterval) {
        clearInterval(matchReminderInterval);
        matchReminderInterval = null;
      }
    } else {
      if (!matchReminderInterval) {
        matchReminderInterval = setInterval(function() {
          if (!document.hidden) checkMatchesForReminders();
        }, 60000);
        setTimeout(checkMatchesForReminders, 2000);
      }
    }
  });

  window.addEventListener('online', function() {
    setTimeout(checkMatchesForReminders, 5000);
  });

  window.addEventListener('h90:notifications:enabled', function() {
    setTimeout(startMatchReminders, 1000);
  });

  window.addEventListener('h90:reminder:time-changed', function(e) {
    setTimeout(function() {
      stopMatchReminders();
      startMatchReminders();
    }, 500);
  });

  (function autoStartReminders() {
    function tryStart() {
      var settings = _getNotifSettings();
      if (settings.matches === false) return;
      if (!_canSendNotifications()) return;
      startMatchReminders();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(tryStart, 5000);
      });
    } else {
      setTimeout(tryStart, 5000);
    }
  })();

  /* ================================================================
     17. Settings API
     ================================================================ */
  function saveMatchReminderTime(minutes) {
    var num = parseInt(minutes, 10);
    if (isNaN(num) || num < 1 || num > 1440) return false;

    try {
      localStorage.setItem(MATCH_MODULE_TIME_KEY, String(num));
    } catch (e) { return false; }

    try {
      window.dispatchEvent(new CustomEvent('h90:reminder:time-changed', {
        detail: { minutes: num }
      }));
    } catch (e) {}

    stopMatchReminders();
    startMatchReminders();
    return true;
  }

  function getMatchReminderTime() {
    return _getReminderTimeFromSettings();
  }

  async function sendTestNotification() {
    var canSend = _canSendNotifications();

    if (!canSend) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          var perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            _showToast('⚠️ يجب تفعيل الإشعارات أولاً', 'warning');
            return false;
          }
        } catch (e) {
          _showToast('❌ فشل طلب إذن الإشعارات', 'error');
          return false;
        }
      } else {
        _showToast('⚠️ الإشعارات غير مفعّلة', 'warning');
        return false;
      }
    }

    var userTime = _getReminderTimeFromSettings();
    var title = '🔔 اختبار إشعار — H90';
    var body = 'الإشعارات تعمل بشكل صحيح!\nوقت التذكير الحالي: ' + userTime + ' دقيقة.';

    var sent = await _sendMatchNotification(title, body, 'test_' + Date.now(), 'test_' + Date.now());

    if (sent) {
      _showToast('✅ تم إرسال إشعار تجريبي', 'success');
    } else {
      _showToast('❌ فشل إرسال الإشعار', 'error');
    }

    return sent;
  }

  async function testPushWorker() {
    var title = '🔔 اختبار Push — H90';
    var body = 'هذا اختبار للإشعارات في الخلفية.';

    var fakeMatch = {
      id: 'test_' + Date.now(),
      homeTeam: { name: 'H90', crest: '/H90.jpg' },
      awayTeam: { name: 'Test', crest: '' }
    };

    _showToast('🧪 جاري اختبار Push...', 'info');
    var pushed = await _pushMatchToWorker(fakeMatch, title, body, 'test_push_' + Date.now());

    if (pushed) {
      _showToast('✅ تم إرسال Push', 'success');
    } else {
      _showToast('❌ فشل إرسال Push', 'error');
    }

    return pushed;
  }

  function getReminderStats() {
    var userTime = _getReminderTimeFromSettings();
    var stages = _getReminderStages();
    var settings = _getNotifSettings();
    var notifiedCount = Object.keys(notifiedMatches).length;
    var cacheInfo = window.getCacheInfo ? window.getCacheInfo() : { hasCache: false };

    return {
      userTime: userTime,
      stages: stages,
      canSend: _canSendNotifications(),
      running: !!matchReminderInterval,
      settings: settings,
      notifiedCount: notifiedCount,
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      cache: cacheInfo
    };
  }

  function resetNotifiedMatches() {
    notifiedMatches = {};
    saveNotifiedMatches();
    return true;
  }

  /* ================================================================
     18. Exports
     ================================================================ */
  window.renderMatches = renderMatches;
  window.renderMatchCard = renderMatchCard;
  window.refreshMatches = refreshMatches;
  window.fetchMatchesWithCache = fetchMatchesWithCache;
  window.clearMatchesCache = clearMatchesCache;
  window.clearDailyMatchesCache = clearDailyMatchesCache;
  window.isFavoriteTeamMatch = isFavoriteTeamMatch;
  window.getMatchedFavoriteId = getMatchedFavoriteId;
  window.startMatchReminders = startMatchReminders;
  window.stopMatchReminders = stopMatchReminders;
  window.checkMatchesForReminders = checkMatchesForReminders;
  window.sortMatchesSmart = sortMatchesSmart;
  window.filterMatches = filterMatches;
  window.TEAM_ID_MAP = TEAM_ID_MAP;
  window.normalizeTeamName = normalizeTeamName;
  window.ALLOWED_COMPETITIONS = ALLOWED_COMPETITIONS;

  window._getReminderTimeFromSettings = _getReminderTimeFromSettings;
  window._getReminderStages = _getReminderStages;
  window._canSendNotifications = _canSendNotifications;
  window.saveMatchReminderTime = saveMatchReminderTime;
  window.getMatchReminderTime = getMatchReminderTime;
  window.sendTestNotification = sendTestNotification;
  window.testPushWorker = testPushWorker;
  window.getReminderStats = getReminderStats;
  window.resetNotifiedMatches = resetNotifiedMatches;
  window._pushMatchToWorker = _pushMatchToWorker;
  window._proxyCrest = _proxyCrest;

  window.getCacheOffset = _getUserOffset;
  window.getCacheInfo = function() {
    var cached = _readDailyCache();
    if (!cached) return { hasCache: false };
    var ageHours = _getCacheAgeHours(cached);
    var offset = _getUserOffset();
    return {
      hasCache: true,
      ageHours: ageHours.toFixed(2),
      offset: offset,
      lifetimeHours: (12 + offset / 60).toFixed(2),
      remainingHours: ((12 + offset / 60) - ageHours).toFixed(2)
    };
  };
  window.forceCacheReset = function() {
    clearDailyMatchesCache();
    try { localStorage.removeItem('h90_cache_offset_v1'); } catch (e) {}
  };

  console.log('%c⚽ Matches Module v5.2 — Premium UI Edition',
    'background:linear-gradient(135deg,#00e676,#00e5ff);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px;');

})();
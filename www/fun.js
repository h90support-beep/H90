/* ================================================================
   H90 — Entertainment Module (fun.js) v29.0 (Ultimate & Enhanced UI)
   ================================================================
   ✅ قسم "شوهد مؤخراً" نُقل تحت شاشة العرض (Hero).
   ✅ تصميم شاشة تفاصيل الأفلام والمسلسلات بشكل احترافي.
   ✅ تأثيرات حركية (Animations) وإضاءة ديناميكية (Blur Backdrop).
   ✅ تصميم الحلقات (Episodes) بشكل عصري ومريح.
   ✅ جلب وعرض القصة (Plot) والممثلين والمخرج.
   ✅ يعتمد على التخزين الهجين الجديد من movies-api و series-api.
   ================================================================ */
'use strict';

(function () {

  /* ================================================================
     Image Lazy Loader
     ================================================================ */
  (function initImageLazyLoader() {
    let observer = null;
    function createObserver() {
      if (!('IntersectionObserver' in window)) return null;
      return new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.style.opacity = '0';
            img.onload = () => { img.style.transition = 'opacity 0.4s ease'; img.style.opacity = '1'; };
          }
          observer.unobserve(img);
        });
      }, { rootMargin: '300px', threshold: 0.01 });
    }
    function bindLazyImages(root) {
      if (!('IntersectionObserver' in window)) {
        (root || document).querySelectorAll('img[data-src]').forEach(function (img) {
          img.src = img.getAttribute('data-src');
          img.removeAttribute('data-src');
        });
        return;
      }
      if (!observer) observer = createObserver();
      const scope = root || document;
      scope.querySelectorAll('img[data-src]:not([data-lazy-bound])').forEach(function (img) {
        img.setAttribute('data-lazy-bound', '1');
        observer.observe(img);
      });
    }
    window.H90LazyImages = { bind: bindLazyImages };
  })();

  /* ================================================================
     State
     ================================================================ */
  let _mvAllMovies = [];
  let _mvDisplayedMovies = [];
  let _mvHeroCurrentIndex = 0;
  let _mvHeroItems = [];

  let _srAllSeries = [];
  let _srDisplayedSeries = [];
  let _srHeroCurrentIndex = 0;
  let _srHeroItems = [];
  let _srDetailsCurrentSeries = null;
  let _srCurrentInfo = null;
  let _srCurrentSeason = null;

  let _entSeriesLoading = false;
  let _entMoviesLoading = false;
  let _entSeriesRendered = false;
  let _entMoviesRendered = false;
  
  let _mvHtmlCache = null;
  let _srHtmlCache = null;

  let _currentEntRequest = 0;
  let _activeEntTab = 'movies';

  const MV_HISTORY_KEY = 'h90_recent_movies_v1';
  const SR_HISTORY_KEY = 'h90_recent_series_v1';
  const MAX_ROW_ITEMS = 15;

  /* ================================================================
     Icons
     ================================================================ */
  const MV_ICONS = {
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#ff6b35;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    new: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#00e5ff;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;color:#ffb300;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#e53935;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    lightning: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;color:#ffb300;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#0091ea;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    ghost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#9c27b0;"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>',
    laugh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#ffb300;"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    explosion: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;color:#e53935;"><path d="M12 2l2 5 5-2-3 5 5 3-5 3 3 5-5-2-2 5-2-5-5 2 3-5-5-3 5-3-3-5 5 2z"/></svg>',
    theater: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#e53935;"><path d="M2 3h20v6a5 5 0 0 1-5 5h-1v3h2a2 2 0 0 1 2 2v2H4v-2a2 2 0 0 1 2-2h2v-3H7a5 5 0 0 1-5-5V3z"/><circle cx="8" cy="7" r="1" fill="currentColor"/><circle cx="16" cy="7" r="1" fill="currentColor"/><path d="M9 11c1 1 5 1 6 0"/></svg>',
    anime: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#e91e63;"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M8 16c1 1 7 1 8 0"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#00e5ff;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#e53935;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#ffb300;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#00e5ff;"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#ffb300;"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#00e5ff;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;color:#00e676;"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    moreArrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#00e5ff;"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>'
  };

  function getIcon(name) { return MV_ICONS[name] || MV_ICONS.info; }

  /* ================================================================
     Utils
     ================================================================ */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getSafePoster(item) { return item ? (item.poster || item.originalPoster || '') : ''; }

  /* ================================================================
     History (شوهد مؤخراً)
     ================================================================ */
  function saveToHistory(key, item) {
    try {
      let history = JSON.parse(localStorage.getItem(key) || '[]');
      history = history.filter(x => String(x.id) !== String(item.id));
      history.unshift({
        id: item.id,
        title: item.title,
        poster: item.poster,
        originalPoster: item.originalPoster,
        rating: item.rating,
        year: item.year,
        categoryName: item.categoryName
      });
      if (history.length > 10) history = history.slice(0, 10);
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {}
  }

  function getHistory(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }

  /* ================================================================
     Global Click Handler
     ================================================================ */
  document.addEventListener('click', function(e) {
    const mvCard = e.target.closest('.mv-card[data-mv-id]');
    if (mvCard) {
      e.preventDefault();
      const id = mvCard.getAttribute('data-mv-id');
      if (window.mvOpenDetails) window.mvOpenDetails(id);
      return;
    }

    const srCard = e.target.closest('.mv-card[data-sr-id]');
    if (srCard) {
      e.preventDefault();
      const id = srCard.getAttribute('data-sr-id');
      if (window.srOpenDetails) window.srOpenDetails(id);
      return;
    }
  });

  /* ================================================================
     Open Player
     ================================================================ */
  function openH90Player(options) {
    const { url, title = 'H90 Player', poster = '', isLive = false } = options || {};
    if (!url) { if (window.showToast) showToast('لا يوجد رابط', 'error'); return; }

    if (window.H90MoviesPlayer && typeof window.H90MoviesPlayer.play === 'function') {
      try { window.H90MoviesPlayer.play({ url, title, poster, isLive: !!isLive }); return; } 
      catch (e) { console.error('H90MoviesPlayer failed:', e); }
    }
    if (window.PlayerEngine && typeof window.PlayerEngine.loadDirectUrl === 'function') {
      try { window.PlayerEngine.loadDirectUrl({ url, title, poster }); return; } 
      catch (e) { console.error('PlayerEngine failed:', e); }
    }
    if (window.showToast) showToast('المشغل غير جاهز', 'error');
  }

  /* ================================================================
     RENDER PAGES
     ================================================================ */
  async function renderMoviesPage(reqId) {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;

    try {
      if (!window.MoviesAPI) throw new Error('MoviesAPI not ready');
      const movies = await window.MoviesAPI.loadMovies();
      if (reqId !== undefined && reqId !== _currentEntRequest) return;

      if (movies && movies.length > 0) {
        _mvAllMovies = movies;
        _mvDisplayedMovies = movies;
        _mvHtmlCache = buildMoviesPageHTML();
        body.innerHTML = _mvHtmlCache;
        bindMoviesPageEvents();
        if (window.H90LazyImages) window.H90LazyImages.bind();
        _entMoviesRendered = true;
        renderRecentMovies();
      } else {
        body.innerHTML = '<div class="mv-empty" style="padding:60px 20px;text-align:center;"><div class="mv-empty-title" style="color:#fff;">لا توجد أفلام متاحة</div></div>';
      }
    } catch (e) {
      body.innerHTML = '<div class="mv-empty" style="padding:60px;text-align:center;"><div class="mv-empty-title" style="color:#fff;">فشل تحميل الأفلام</div></div>';
    }
  }

  async function renderSeriesPage(reqId) {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;

    try {
      if (!window.SeriesAPI) throw new Error('SeriesAPI not ready');
      const series = await window.SeriesAPI.loadSeries();
      if (reqId !== undefined && reqId !== _currentEntRequest) return;

      if (series && series.length > 0) {
        _srAllSeries = series;
        _srDisplayedSeries = series;
        _srHtmlCache = buildSeriesPageHTML();
        body.innerHTML = _srHtmlCache;
        bindSeriesPageEvents();
        if (window.H90LazyImages) window.H90LazyImages.bind();
        _entSeriesRendered = true;
        renderRecentSeries();
      } else {
        body.innerHTML = '<div class="mv-empty" style="padding:60px;text-align:center;"><div class="mv-empty-title" style="color:#fff;">لا توجد مسلسلات متاحة</div></div>';
      }
    } catch (e) {
      body.innerHTML = '<div class="mv-empty" style="padding:60px;text-align:center;"><div class="mv-empty-title" style="color:#fff;">فشل تحميل المسلسلات</div></div>';
    }
  }

  /* ================================================================
     BUILD HTML
     ================================================================ */
  function buildMoviesPageHTML() {
    const movies = _mvDisplayedMovies || [];
    if (movies.length === 0) return '<div class="mv-empty"><div class="mv-empty-title">لا توجد أفلام</div></div>';

    const API = window.MoviesAPI;
    if (!API) return '<div class="mv-empty"><div class="mv-empty-title">غير جاهز</div></div>';

    let heroMovies = API.getNewReleases ? API.getNewReleases(movies, 5) : movies.slice(0, 5);
    _mvHeroItems = heroMovies;

    let trending = API.getTrending ? API.getTrending(movies, MAX_ROW_ITEMS) : [];
    let topRated = API.getTopRated ? API.getTopRated(movies, MAX_ROW_ITEMS) : [];
    let recent = API.getRecentlyAdded ? API.getRecentlyAdded(movies, MAX_ROW_ITEMS) : [];
    let newReleases = API.getNewReleases ? API.getNewReleases(movies, MAX_ROW_ITEMS) : [];
    
    let topImdb = API.filterByCategory ? API.filterByCategory(movies, '122').slice(0, MAX_ROW_ITEMS) : [];
    let marvel = API.filterByCategory ? API.filterByCategory(movies, '256').slice(0, MAX_ROW_ITEMS) : [];
    let dc = API.filterByCategory ? API.filterByCategory(movies, '255').slice(0, MAX_ROW_ITEMS) : [];
    let action = API.filterByCategory ? API.filterByCategory(movies, '243').slice(0, MAX_ROW_ITEMS) : [];
    let horror = API.filterByCategory ? API.filterByCategory(movies, '241').slice(0, MAX_ROW_ITEMS) : [];
    let comedy = API.filterByCategory ? API.filterByCategory(movies, '251').slice(0, MAX_ROW_ITEMS) : [];
    let drama = API.filterByCategory ? API.filterByCategory(movies, '242').slice(0, MAX_ROW_ITEMS) : [];
    let anime = API.filterByCategory ? API.filterByCategory(movies, '213').slice(0, MAX_ROW_ITEMS) : [];

    let html = '';

    // 1. شاشة العرض (Hero)
    if (heroMovies.length > 0) {
      html += '<div class="mv-hero" id="mvHero"><div class="mv-hero-track" id="mvHeroTrack">';
      heroMovies.forEach((m, i) => html += buildMovieHeroSlide(m, i));
      html += '</div><div class="mv-hero-dots" id="mvHeroDots">';
      heroMovies.forEach((_, i) => html += `<div class="mv-hero-dot${i===0?' active':''}" data-index="${i}"></div>`);
      html += '</div></div>';
    }

    // 2. شوهد مؤخراً (تحت الـ Hero)
    html += '<div id="mvRecentRow"></div>';

    // 3. البحث
    html += `<div class="mv-search-wrap"><div class="mv-search-box"><div class="mv-search-icon">${getIcon('search')}</div><input type="text" class="mv-search-input" id="mvSearchInput" placeholder="ابحث عن فيلم في الكل..." autocomplete="off"><button class="mv-search-clear" id="mvSearchClear">${getIcon('close')}</button></div></div>`;

    // 4. التصنيفات
    html += `<div class="mv-cats-bar" id="mvCatsBar"><button class="mv-cat-chip active" data-cat="">الكل</button><button class="mv-cat-chip" data-cat="254">2026</button><button class="mv-cat-chip" data-cat="122">TOP IMDB</button><button class="mv-cat-chip" data-cat="256">Marvel</button><button class="mv-cat-chip" data-cat="255">DC</button><button class="mv-cat-chip" data-cat="243">Action</button><button class="mv-cat-chip" data-cat="241">Horror</button><button class="mv-cat-chip" data-cat="251">Comedy</button></div>`;

    // 5. الصفوف
    html += '<div id="mvRowsContainer">';
    if (trending.length > 0)      html += buildMoviesRow('رائج اليوم', 'fire', 'trending', trending);
    if (newReleases.length > 0)   html += buildMoviesRow('أُضيف حديثاً', 'new', 'new', newReleases);
    if (topRated.length > 0)      html += buildMoviesRow('الأعلى تقييماً', 'star', 'top', topRated);
    if (topImdb.length > 0)       html += buildMoviesRow('TOP IMDB', 'target', 'topimdb', topImdb);
    if (marvel.length > 0)        html += buildMoviesRow('Marvel', 'lightning', 'marvel', marvel);
    if (dc.length > 0)            html += buildMoviesRow('DC', 'shield', 'dc', dc);
    if (horror.length > 0)        html += buildMoviesRow('رعب', 'ghost', 'horror', horror);
    if (comedy.length > 0)        html += buildMoviesRow('كوميديا', 'laugh', 'comedy', comedy);
    if (action.length > 0)        html += buildMoviesRow('أكشن', 'explosion', 'action', action);
    if (drama.length > 0)         html += buildMoviesRow('دراما', 'theater', 'drama', drama);
    if (anime.length > 0)         html += buildMoviesRow('أنيمي', 'anime', 'anime', anime);
    if (recent.length > 0)        html += buildMoviesRow('آخر الإضافات', 'clock', 'recent', recent);
    
    html += buildSeeMoreBlock('movies');
    html += '</div>';

    html += '<div id="mvSearchResults" style="display:none;"></div>';
    return html;
  }

  function buildSeriesPageHTML() {
    const series = _srDisplayedSeries || [];
    if (series.length === 0) return '<div class="mv-empty"><div class="mv-empty-title">لا توجد مسلسلات</div></div>';

    const API = window.SeriesAPI;
    if (!API) return '<div class="mv-empty"><div class="mv-empty-title">غير جاهز</div></div>';

    let heroSeries = API.getTrending ? API.getTrending(series, 5) : series.slice(0, 5);
    _srHeroItems = heroSeries;
    let groups = API.getFeaturedGroups ? API.getFeaturedGroups(series) : {};

    let html = '';

    // 1. شاشة العرض (Hero)
    if (heroSeries.length > 0) {
      html += '<div class="mv-hero" id="srHero"><div class="mv-hero-track" id="srHeroTrack">';
      heroSeries.forEach((s, i) => html += buildSeriesHeroSlide(s, i));
      html += '</div><div class="mv-hero-dots" id="srHeroDots">';
      heroSeries.forEach((_, i) => html += `<div class="mv-hero-dot${i===0?' active':''}" data-index="${i}"></div>`);
      html += '</div></div>';
    }

    // 2. شوهد مؤخراً (تحت الـ Hero)
    html += '<div id="srRecentRow"></div>';

    // 3. البحث
    html += `<div class="mv-search-wrap"><div class="mv-search-box"><div class="mv-search-icon">${getIcon('search')}</div><input type="text" class="mv-search-input" id="srSearchInput" placeholder="ابحث عن مسلسل في الكل..." autocomplete="off"><button class="mv-search-clear" id="srSearchClear">${getIcon('close')}</button></div></div>`;

    // 4. الصفوف
    html += '<div id="srRowsContainer">';
    if (groups.ramadan && groups.ramadan.length > 0)         html += buildSeriesRow('رمضان 2026', 'calendar', 'ramadan', groups.ramadan.slice(0, MAX_ROW_ITEMS));
    if (groups.top50 && groups.top50.length > 0)             html += buildSeriesRow('أفضل 50 مسلسل', 'star', 'top50', groups.top50.slice(0, MAX_ROW_ITEMS));
    if (groups.netflix && groups.netflix.length > 0)         html += buildSeriesRow('Netflix', 'tv', 'netflix', groups.netflix.slice(0, MAX_ROW_ITEMS));
    if (groups.shahid && groups.shahid.length > 0)           html += buildSeriesRow('Shahid', 'tv', 'shahid', groups.shahid.slice(0, MAX_ROW_ITEMS));
    if (groups.amazon && groups.amazon.length > 0)           html += buildSeriesRow('Amazon', 'tv', 'amazon', groups.amazon.slice(0, MAX_ROW_ITEMS));
    if (groups.hbo && groups.hbo.length > 0)                 html += buildSeriesRow('HBO', 'tv', 'hbo', groups.hbo.slice(0, MAX_ROW_ITEMS));
    if (groups.apple && groups.apple.length > 0)             html += buildSeriesRow('Apple TV+', 'tv', 'apple', groups.apple.slice(0, MAX_ROW_ITEMS));
    if (groups.disney && groups.disney.length > 0)           html += buildSeriesRow('Disney+', 'tv', 'disney', groups.disney.slice(0, MAX_ROW_ITEMS));
    if (groups.hulu && groups.hulu.length > 0)               html += buildSeriesRow('Hulu', 'tv', 'hulu', groups.hulu.slice(0, MAX_ROW_ITEMS));
    if (groups.turkish && groups.turkish.length > 0)         html += buildSeriesRow('تركي', 'theater', 'turkish', groups.turkish.slice(0, MAX_ROW_ITEMS));
    if (groups.anime && groups.anime.length > 0)             html += buildSeriesRow('أنمي', 'anime', 'anime', groups.anime.slice(0, MAX_ROW_ITEMS));
    if (groups.asian && groups.asian.length > 0)             html += buildSeriesRow('آسيوي', 'film', 'asian', groups.asian.slice(0, MAX_ROW_ITEMS));
    if (groups.indian && groups.indian.length > 0)           html += buildSeriesRow('هندي', 'film', 'indian', groups.indian.slice(0, MAX_ROW_ITEMS));
    if (groups.documentary && groups.documentary.length > 0) html += buildSeriesRow('وثائقي', 'info', 'documentary', groups.documentary.slice(0, MAX_ROW_ITEMS));
    if (groups.kids && groups.kids.length > 0)               html += buildSeriesRow('أطفال', 'play', 'kids', groups.kids.slice(0, MAX_ROW_ITEMS));
    if (groups.tv && groups.tv.length > 0)                   html += buildSeriesRow('برامج ومسابقات', 'tv', 'tvshows', groups.tv.slice(0, MAX_ROW_ITEMS));
    if (groups.gulf && groups.gulf.length > 0)               html += buildSeriesRow('خليجي', 'film', 'gulf', groups.gulf.slice(0, MAX_ROW_ITEMS));
    if (groups.egypt && groups.egypt.length > 0)             html += buildSeriesRow('مصري', 'film', 'egypt', groups.egypt.slice(0, MAX_ROW_ITEMS));
    if (groups.syria && groups.syria.length > 0)             html += buildSeriesRow('سوري', 'film', 'syria', groups.syria.slice(0, MAX_ROW_ITEMS));
    if (groups.lebanon && groups.lebanon.length > 0)         html += buildSeriesRow('لبناني', 'film', 'lebanon', groups.lebanon.slice(0, MAX_ROW_ITEMS));
    if (groups.morocco && groups.morocco.length > 0)         html += buildSeriesRow('المغرب وتونس', 'film', 'morocco', groups.morocco.slice(0, MAX_ROW_ITEMS));
    if (groups.jordan && groups.jordan.length > 0)           html += buildSeriesRow('أردني', 'film', 'jordan', groups.jordan.slice(0, MAX_ROW_ITEMS));
    if (groups.history && groups.history.length > 0)         html += buildSeriesRow('بدوي وتاريخي', 'film', 'history', groups.history.slice(0, MAX_ROW_ITEMS));
    
    html += buildSeeMoreBlock('series');
    html += '</div>';

    html += '<div id="srSearchResults" style="display:none;"></div>';
    return html;
  }

  function buildSeeMoreBlock(type) {
    const title = type === 'movies' ? 'عرض كل الأفلام' : 'عرض كل المسلسلات';
    return `
      <div style="padding: 30px 16px 50px; display: flex; justify-content: center;">
        <button onclick="${type === 'movies' ? 'mvShowAllGrid()' : 'srShowAllGrid()'}" style="
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; padding: 14px 24px; border-radius: 20px; font-family: inherit;
          font-size: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s;
        ">
          ${getIcon('moreArrow')}
          <span>${title}</span>
        </button>
      </div>
    `;
  }

  /* ================================================================
     CARDS & ROWS
     ================================================================ */
  function buildMovieHeroSlide(movie, index) {
    const poster = getSafePoster(movie);
    const title = escapeHtml(movie.title || movie.name);
    const year = movie.year || '';
    const rating = movie.rating ? movie.rating.toFixed(1) : '—';
    
    return `<div class="mv-hero-slide${index === 0 ? ' active' : ''}" data-index="${index}">
      <img class="mv-hero-bg" src="${poster}" onerror="this.style.opacity='0'">
      <div class="mv-hero-overlay"></div>
      <div class="mv-hero-content">
        <img class="mv-hero-poster" src="${poster}" onerror="this.style.opacity='0'">
        <div class="mv-hero-title">${title}</div>
        <div class="mv-hero-meta">
          ${rating !== '—' ? `<div class="mv-hero-rating">★ ${rating}</div>` : ''}
          ${year ? `<div class="mv-hero-year">${year}</div>` : ''}
        </div>
        <div class="mv-hero-actions">
          <button class="mv-hero-btn mv-hero-btn-primary" onclick="event.stopPropagation();mvOpenDetails(${movie.id})">التفاصيل</button>
        </div>
      </div>
    </div>`;
  }

  function buildSeriesHeroSlide(series, index) {
    const poster = getSafePoster(series);
    const title = escapeHtml(series.title || series.name);
    const year = series.year || '';
    const rating = series.rating ? series.rating.toFixed(1) : '—';
    return `<div class="mv-hero-slide${index === 0 ? ' active' : ''}" data-index="${index}">
      <img class="mv-hero-bg" src="${poster}" onerror="this.style.opacity='0'">
      <div class="mv-hero-overlay"></div>
      <div class="mv-hero-content">
        <img class="mv-hero-poster" src="${poster}" onerror="this.style.opacity='0'">
        <div class="mv-hero-title">${title}</div>
        <div class="mv-hero-meta">
          ${rating !== '—' ? `<div class="mv-hero-rating">★ ${rating}</div>` : ''}
          ${year ? `<div class="mv-hero-year">${year}</div>` : ''}
        </div>
        <div class="mv-hero-actions">
          <button class="mv-hero-btn mv-hero-btn-primary" onclick="event.stopPropagation();srOpenDetails(${series.id})">التفاصيل</button>
        </div>
      </div>
    </div>`;
  }

  function buildMoviesRow(title, iconKey, key, movies) {
    const icon = MV_ICONS[iconKey] || '';
    let html = `<div class="mv-section" style="content-visibility: auto; contain-intrinsic-size: 300px;">
      <div class="mv-section-header">
        <div class="mv-section-title">${icon}<span>${title}</span></div>
        <button class="mv-section-see-all" onclick="mvShowAll('${key}')">عرض الكل</button>
      </div>
      <div class="mv-row">`;
    movies.forEach(m => html += buildMovieCard(m));
    html += '</div></div>';
    return html;
  }

  function buildSeriesRow(title, iconKey, key, seriesList) {
    const icon = MV_ICONS[iconKey] || '';
    let html = `<div class="mv-section" style="content-visibility: auto; contain-intrinsic-size: 300px;">
      <div class="mv-section-header">
        <div class="mv-section-title">${icon}<span>${title}</span></div>
        <button class="mv-section-see-all" onclick="srShowAll('${key}')">عرض الكل</button>
      </div>
      <div class="mv-row">`;
    seriesList.forEach(s => html += buildSeriesCard(s));
    html += '</div></div>';
    return html;
  }

  function buildMovieCard(movie) {
    const poster = getSafePoster(movie);
    const fallback = movie.originalPoster || '';
    const title = escapeHtml(movie.title || movie.name);
    const year = movie.year || '';
    const rating = movie.rating ? movie.rating.toFixed(1) : '';
    
    const imgTag = poster ? `<img src="${poster}" loading="lazy" onerror="if('${fallback}'){this.src='${fallback}';this.onerror=null;}else{this.style.opacity='0';}">` : '';

    return `<div class="mv-card" data-mv-id="${movie.id}" style="content-visibility: auto; contain-intrinsic-size: 200px;">
      <div class="mv-card-poster">
        <div class="mv-card-placeholder">${getIcon('film')}</div>
        ${imgTag}
        ${rating ? `<div class="mv-card-rating">★ ${rating}</div>` : ''}
        ${year ? `<div class="mv-card-year">${year}</div>` : ''}
      </div>
      <div class="mv-card-title">${title}</div>
    </div>`;
  }

  function buildSeriesCard(series) {
    const poster = getSafePoster(series);
    const fallback = series.originalPoster || '';
    const title = escapeHtml(series.title || series.name);
    const year = series.year || '';
    const rating = series.rating ? series.rating.toFixed(1) : '';
    
    const imgTag = poster ? `<img src="${poster}" loading="lazy" onerror="if('${fallback}'){this.src='${fallback}';this.onerror=null;}else{this.style.opacity='0';}">` : '';
    
    return `<div class="mv-card" data-sr-id="${series.id}" style="content-visibility: auto; contain-intrinsic-size: 200px;">
      <div class="mv-card-poster">
        <div class="mv-card-placeholder">${getIcon('tv')}</div>
        ${imgTag}
        ${rating ? `<div class="mv-card-rating">★ ${rating}</div>` : ''}
        ${year ? `<div class="mv-card-year">${year}</div>` : ''}
      </div>
      <div class="mv-card-title">${title}</div>
    </div>`;
  }

  /* ================================================================
     RENDER RECENT HISTORY
     ================================================================ */
  function renderRecentMovies() {
    const container = document.getElementById('mvRecentRow');
    if (!container) return;
    const history = getHistory(MV_HISTORY_KEY);
    if (history.length === 0) { container.innerHTML = ''; return; }
    
    let cards = '';
    history.forEach(m => cards += buildMovieCard(m));
    container.innerHTML = `<div class="mv-section">
      <div class="mv-section-header"><div class="mv-section-title">${getIcon('history')}<span>شوهد مؤخراً</span></div></div>
      <div class="mv-row">${cards}</div>
    </div>`;
  }

  function renderRecentSeries() {
    const container = document.getElementById('srRecentRow');
    if (!container) return;
    const history = getHistory(SR_HISTORY_KEY);
    if (history.length === 0) { container.innerHTML = ''; return; }
    
    let cards = '';
    history.forEach(s => cards += buildSeriesCard(s));
    container.innerHTML = `<div class="mv-section">
      <div class="mv-section-header"><div class="mv-section-title">${getIcon('history')}<span>شوهد مؤخراً</span></div></div>
      <div class="mv-row">${cards}</div>
    </div>`;
  }

  /* ================================================================
     BIND EVENTS
     ================================================================ */
  function bindMoviesPageEvents() {
    const heroTrack = document.getElementById('mvHeroTrack');
    const heroDots = document.getElementById('mvHeroDots');
    
    if (heroTrack) {
      let scrollTimeout;
      heroTrack.addEventListener('scroll', () => { 
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (heroTrack.clientWidth === 0) return;
          const idx = Math.round(heroTrack.scrollLeft / heroTrack.clientWidth); 
          if (idx !== _mvHeroCurrentIndex) { 
            _mvHeroCurrentIndex = idx; 
            document.querySelectorAll('#entertainmentContent .mv-hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx)); 
          } 
        }, 50);
      }, { passive: true }); 
    }
    
    if (heroDots && heroTrack) { 
      heroDots.addEventListener('click', e => { 
        const dot = e.target.closest('.mv-hero-dot'); 
        if (!dot) return; 
        heroTrack.scrollTo({ left: parseInt(dot.dataset.index, 10) * heroTrack.clientWidth, behavior: 'smooth' }); 
      }); 
    }

    const searchInput = document.getElementById('mvSearchInput');
    if (searchInput) { 
      let timer = null; 
      searchInput.addEventListener('input', function () { 
        clearTimeout(timer); 
        timer = setTimeout(() => mvPerformSearch(this.value.trim()), 300); 
      }); 
    }
  }

  function bindSeriesPageEvents() {
    const heroTrack = document.getElementById('srHeroTrack');
    const heroDots = document.getElementById('srHeroDots');
    
    if (heroTrack) {
      let scrollTimeout;
      heroTrack.addEventListener('scroll', () => { 
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (heroTrack.clientWidth === 0) return;
          const idx = Math.round(heroTrack.scrollLeft / heroTrack.clientWidth); 
          if (idx !== _srHeroCurrentIndex) { 
            _srHeroCurrentIndex = idx; 
            document.querySelectorAll('#entertainmentContent .mv-hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx)); 
          } 
        }, 50);
      }, { passive: true }); 
    }

    if (heroDots && heroTrack) { 
      heroDots.addEventListener('click', e => { 
        const dot = e.target.closest('.mv-hero-dot'); 
        if (!dot) return; 
        heroTrack.scrollTo({ left: parseInt(dot.dataset.index, 10) * heroTrack.clientWidth, behavior: 'smooth' }); 
      }); 
    }

    const searchInput = document.getElementById('srSearchInput');
    if (searchInput) { 
      let timer = null; 
      searchInput.addEventListener('input', function () { 
        clearTimeout(timer); 
        timer = setTimeout(() => srPerformSearch(this.value.trim()), 300); 
      }); 
    }
  }

  /* ================================================================
     SEARCH & SHOW ALL
     ================================================================ */
  function mvPerformSearch(query) {
    const rowsContainer = document.getElementById('mvRowsContainer');
    const searchResults = document.getElementById('mvSearchResults');
    if (!rowsContainer || !searchResults) return;
    
    if (!query || query.trim().length < 2) { 
      rowsContainer.style.display = ''; 
      searchResults.style.display = 'none'; 
      return; 
    }
    
    rowsContainer.style.display = 'none'; 
    searchResults.style.display = 'block';
    
    const results = window.MoviesAPI.search ? window.MoviesAPI.search(_mvAllMovies, query, 5000) : [];
    
    if (results.length === 0) { 
      searchResults.innerHTML = `<div class="mv-empty"><div class="mv-empty-title">لا نتائج</div></div>`; 
      return; 
    }
    
    searchResults.innerHTML = `<div class="mv-section"><div class="mv-section-title">نتائج البحث (${results.length})</div><div class="mv-grid" id="mvSearchGrid"></div></div>`;
    renderInfiniteGrid(results, 'mvSearchGrid', buildMovieCard);
  }

  function srPerformSearch(query) {
    const rowsContainer = document.getElementById('srRowsContainer');
    const searchResults = document.getElementById('srSearchResults');
    if (!rowsContainer || !searchResults) return;
    
    if (!query || query.trim().length < 2) { 
      rowsContainer.style.display = ''; 
      searchResults.style.display = 'none'; 
      return; 
    }
    
    rowsContainer.style.display = 'none'; 
    searchResults.style.display = 'block';
    
    const results = window.SeriesAPI.search ? window.SeriesAPI.search(_srAllSeries, query, 5000) : [];
    
    if (results.length === 0) { 
      searchResults.innerHTML = `<div class="mv-empty"><div class="mv-empty-title">لا نتائج</div></div>`; 
      return; 
    }
    
    searchResults.innerHTML = `<div class="mv-section"><div class="mv-section-title">نتائج البحث (${results.length})</div><div class="mv-grid" id="srSearchGrid"></div></div>`;
    renderInfiniteGrid(results, 'srSearchGrid', buildSeriesCard);
  }

  window.mvShowAllGrid = function() {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;
    body.innerHTML = `
      <div style="padding: 20px 16px; display: flex; align-items: center; gap: 15px;">
        <button onclick="mvShowAllBack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        <div class="mv-section-title" style="font-size:18px;">كل الأفلام (${_mvAllMovies.length})</div>
      </div>
      <div class="mv-grid" id="mvAllGrid"></div>
    `;
    renderInfiniteGrid(_mvAllMovies, 'mvAllGrid', buildMovieCard);
  };

  window.srShowAllGrid = function() {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;
    body.innerHTML = `
      <div style="padding: 20px 16px; display: flex; align-items: center; gap: 15px;">
        <button onclick="srShowAllBack()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        <div class="mv-section-title" style="font-size:18px;">كل المسلسلات (${_srAllSeries.length})</div>
      </div>
      <div class="mv-grid" id="srAllGrid"></div>
    `;
    renderInfiniteGrid(_srAllSeries, 'srAllGrid', buildSeriesCard);
  };

  window.mvShowAll = function(key) {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;
    let movies = [], title = '', iconKey = 'fire';
    const API = window.MoviesAPI;
    if (!API) return;
    
    switch (key) {
      case 'trending': movies = API.getTrending ? API.getTrending(_mvAllMovies, 10000) : []; title = 'رائج اليوم'; iconKey = 'fire'; break;
      case 'new': movies = API.getNewReleases ? API.getNewReleases(_mvAllMovies, 10000) : []; title = 'أُضيف حديثاً'; iconKey = 'new'; break;
      case 'top': movies = API.getTopRated ? API.getTopRated(_mvAllMovies, 10000) : []; title = 'الأعلى تقييماً'; iconKey = 'star'; break;
      default: movies = _mvAllMovies;
    }
    
    const icon = MV_ICONS[iconKey] || '';
    body.innerHTML = `<div class="mv-section">
      <div class="mv-section-header">
        <button onclick="mvShowAllBack()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        <div class="mv-section-title">${icon}<span>${title} (${movies.length})</span></div>
      </div>
      <div class="mv-grid" id="mvShowAllGrid"></div>
    </div>`;
    renderInfiniteGrid(movies, 'mvShowAllGrid', buildMovieCard);
  };

  window.srShowAll = function(key) {
    const body = document.getElementById('entertainmentContent');
    if (!body) return;

    if (!_srAllSeries || _srAllSeries.length === 0) {
      body.innerHTML = '<div class="mv-empty" style="padding:60px 20px;text-align:center;"><div class="mv-empty-title" style="color:#fff;">جارٍ تحميل المسلسلات...</div></div>';
      window.SeriesAPI.loadSeries().then(function() { renderSeriesPage(_currentEntRequest); });
      return;
    }

    const groups = window.SeriesAPI.getFeaturedGroups ? window.SeriesAPI.getFeaturedGroups(_srAllSeries) : {};
    let list = groups[key] || [];
    
    const titles = { ramadan: 'رمضان 2026', top50: 'أفضل 50 مسلسل', netflix: 'Netflix', shahid: 'Shahid', amazon: 'Amazon', hbo: 'HBO', apple: 'Apple TV+', disney: 'Disney+', hulu: 'Hulu', turkish: 'تركي', anime: 'أنمي', asian: 'آسيوي', indian: 'هندي', documentary: 'وثائقي', kids: 'أطفال', tvshows: 'برامج ومسابقات', gulf: 'خليجي', egypt: 'مصري', syria: 'سوري', lebanon: 'لبناني', morocco: 'المغرب وتونس', jordan: 'أردني', history: 'بدوي وتاريخي' };
    let title = titles[key] || 'مسلسلات';
    
    const icon = MV_ICONS['tv'] || '';
    
    body.innerHTML = `<div class="mv-section">
      <div class="mv-section-header">
        <button onclick="srShowAllBack()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        <div class="mv-section-title">${icon}<span>${title} (${list.length})</span></div>
      </div>
      <div class="mv-grid" id="srShowAllGrid"></div>
    </div>`;
    renderInfiniteGrid(list, 'srShowAllGrid', buildSeriesCard);
  };

  window.mvShowAllBack = function() { 
    const body = document.getElementById('entertainmentContent'); 
    if (body) { 
      body.innerHTML = _mvHtmlCache || buildMoviesPageHTML(); 
      bindMoviesPageEvents(); 
      renderRecentMovies();
    } 
  }
  
  window.srShowAllBack = function() { 
    const body = document.getElementById('entertainmentContent'); 
    if (body) { 
      body.innerHTML = _srHtmlCache || buildSeriesPageHTML(); 
      bindSeriesPageEvents(); 
      renderRecentSeries();
    } 
  }

  /* ================================================================
     INFINITE SCROLL
     ================================================================ */
  function renderInfiniteGrid(items, containerId, buildCardFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let rendered = 0; 
    const batchSize = 30; 
    let isLoading = false;
    
    function handleScroll() { 
      if (isLoading || rendered >= items.length) return; 
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 800) renderBatch(); 
    }

    function cleanup() {
      window.removeEventListener('scroll', handleScroll);
      if (container._infiniteCleanup === cleanup) container._infiniteCleanup = null;
    }
    
    function renderBatch() {
      if (isLoading) return; 
      isLoading = true;
      
      requestAnimationFrame(() => {
        if (!document.body.contains(container)) { cleanup(); return; }

        const fragment = document.createDocumentFragment();
        const end = Math.min(rendered + batchSize, items.length);
        
        for (let i = rendered; i < end; i++) { 
          const temp = document.createElement('div'); 
          temp.innerHTML = buildCardFn(items[i]); 
          fragment.appendChild(temp.firstElementChild); 
        }
        
        container.appendChild(fragment); 
        rendered = end; 
        isLoading = false;
        
        if (window.H90LazyImages) window.H90LazyImages.bind(container);
        if (rendered >= items.length) cleanup();
      });
    }

    if (container._infiniteCleanup) container._infiniteCleanup();
    container._infiniteCleanup = cleanup;
    
    renderBatch(); 
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  /* ================================================================
     PLAYER & DETAILS
     ================================================================ */
  window.mvPlayMovie = function (id) {
    const m = _mvAllMovies.find(x => String(x.id) === String(id));
    if (!m) { if (window.showToast) showToast('فيلم غير موجود', 'error'); return; }
    if (window.showToast) showToast('جارٍ تحضير الرابط...', 'info');
    
    if (!window.MoviesAPI || !window.MoviesAPI.buildStreamUrl) {
      if (window.showToast) showToast('خطأ في النظام', 'error'); return;
    }

    window.MoviesAPI.buildStreamUrl(m.id, m.extension).then(function (url) {
      if (!url) { if (window.showToast) showToast('فشل توليد الرابط', 'error'); return; }
      openH90Player({ url, title: m.title, poster: m.poster });
    }).catch(function (err) { 
      if (window.showToast) showToast('خطأ في الاتصال', 'error'); 
    });
  };

  window.srPlayEpisode = function (episodeId, ext, title, poster) {
    if (window.showToast) showToast('جارٍ تحضير الرابط...', 'info');
    
    if (!window.SeriesAPI || !window.SeriesAPI.buildStreamUrl) {
      if (window.showToast) showToast('خطأ في النظام', 'error'); return;
    }

    window.SeriesAPI.buildStreamUrl(episodeId, ext || 'mp4').then(function (url) {
      if (!url) { if (window.showToast) showToast('فشل توليد الرابط', 'error'); return; }
      openH90Player({ url, title: title || 'حلقة', poster: poster || '' });
    }).catch(function (err) { 
      if (window.showToast) showToast('خطأ في الاتصال', 'error'); 
    });
  };

  /* ================================================================
     [تحديث] شاشة تفاصيل الفيلم — تصميم احترافي
     ================================================================ */
  window.mvOpenDetails = function (id) {
    const existing = document.getElementById('mvDetailsPage');
    if (existing) existing.remove();

    const m = _mvAllMovies.find(x => String(x.id) === String(id));
    if (!m) { if (window.showToast) showToast('الفيلم غير موجود', 'error'); return; }
    
    saveToHistory(MV_HISTORY_KEY, m);

    const rating = m.rating ? m.rating.toFixed(1) : '—'; 
    const year = m.year || '—';
    const poster = getSafePoster(m);
    const catName = m.categoryName || 'فيلم';

    const page = document.createElement('div'); 
    page.className = 'mv-details-page'; 
    page.id = 'mvDetailsPage';
    
    // تصميم جديد ومحسن
    page.innerHTML = `
      <div class="mv-backdrop-wrap">
        ${poster ? `<img class="mv-backdrop-img" src="${poster}" alt="${escapeHtml(m.title)}">` : '<div class="mv-backdrop-img" style="background:#1a1a24;"></div>'}
        <div class="mv-backdrop-overlay"></div>
        <button class="mv-details-back" onclick="mvCloseDetails()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
      </div>
      <div class="mv-details-content">
        <div class="mv-details-header">
          ${poster ? `<img class="mv-details-poster" src="${poster}" alt="${escapeHtml(m.title)}">` : '<div class="mv-details-poster" style="background:#1a1a24;"></div>'}
          <div class="mv-details-info">
            <div class="mv-details-title">${escapeHtml(m.title)}</div>
            <div class="mv-details-meta">
              <span class="mv-chip mv-chip-rating">★ ${rating}</span>
              <span class="mv-chip mv-chip-year">${year}</span>
              <span class="mv-chip mv-chip-cat">${escapeHtml(catName)}</span>
            </div>
          </div>
        </div>
        
        <!-- زر التشغيل -->
        <div class="mv-details-actions">
          <button class="mv-action-btn mv-action-play" onclick="mvPlayMovie(${m.id})">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            شاهد الآن
          </button>
        </div>

        <!-- قسم القصة والمعلومات (يُملأ ديناميكياً) -->
        <div id="mvPlotContainer" class="mv-plot-container">
          <div class="mv-loader-spinner" style="width:28px;height:28px;margin:30px auto;border-width:3px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(page); 
    requestAnimationFrame(() => page.classList.add('show'));

    // جلب القصة
    if (window.MoviesAPI && window.MoviesAPI.getMovieInfo) {
      window.MoviesAPI.getMovieInfo(m.id).then(function(info) {
        const container = document.getElementById('mvPlotContainer');
        if (container && info && info.plot) {
          let plotHtml = `
            <div class="mv-details-section">
              <div class="mv-details-section-title">القصة</div>
              <div class="mv-details-overview">${escapeHtml(info.plot)}</div>
            </div>`;
          
          if (info.cast) {
            plotHtml += `
            <div class="mv-details-section">
              <div class="mv-details-section-title">الممثلون</div>
              <div class="mv-details-overview">${escapeHtml(info.cast)}</div>
            </div>`;
          }
          if (info.director) {
            plotHtml += `
            <div class="mv-details-section">
              <div class="mv-details-section-title">المخرج</div>
              <div class="mv-details-overview">${escapeHtml(info.director)}</div>
            </div>`;
          }
          container.innerHTML = plotHtml;
        } else if (container) {
          container.innerHTML = '';
        }
      }).catch(() => {
        const container = document.getElementById('mvPlotContainer');
        if (container) container.innerHTML = '';
      });
    }
  };

  window.mvCloseDetails = function () { 
    const page = document.getElementById('mvDetailsPage'); 
    if (page) { page.classList.remove('show'); setTimeout(() => page.remove(), 300); } 
  };

  /* ================================================================
     [تحديث] شاشة تفاصيل المسلسل — تصميم احترافي
     ================================================================ */
  window.srOpenDetails = function (id) {
    const existing = document.getElementById('srDetailsPage');
    if (existing) existing.remove();

    const s = _srAllSeries.find(x => String(x.id) === String(id));
    if (!s) { if (window.showToast) showToast('المسلسل غير موجود', 'error'); return; }
    
    saveToHistory(SR_HISTORY_KEY, s);

    _srDetailsCurrentSeries = s; 
    _srCurrentInfo = null; 
    _srCurrentSeason = null;
    
    const rating = s.rating ? s.rating.toFixed(1) : '—'; 
    const year = s.year || '—';
    const poster = getSafePoster(s);
    const catName = s.categoryName || 'مسلسل';

    const page = document.createElement('div'); 
    page.className = 'mv-details-page'; 
    page.id = 'srDetailsPage';
    
    // تصميم جديد
    page.innerHTML = `
      <div class="mv-backdrop-wrap">
        ${poster ? `<img class="mv-backdrop-img" src="${poster}" alt="${escapeHtml(s.title)}">` : '<div class="mv-backdrop-img" style="background:#1a1a24;"></div>'}
        <div class="mv-backdrop-overlay"></div>
        <button class="mv-details-back" onclick="srCloseDetails()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
      </div>
      <div class="mv-details-content">
        <div class="mv-details-header">
          ${poster ? `<img class="mv-details-poster" src="${poster}" alt="${escapeHtml(s.title)}">` : '<div class="mv-details-poster" style="background:#1a1a24;"></div>'}
          <div class="mv-details-info">
            <div class="mv-details-title">${escapeHtml(s.title)}</div>
            <div class="mv-details-meta">
              <span class="mv-chip mv-chip-rating">★ ${rating}</span>
              <span class="mv-chip mv-chip-year">${year}</span>
              <span class="mv-chip mv-chip-cat">${escapeHtml(catName)}</span>
            </div>
          </div>
        </div>
        
        <div id="srPlotContainer" class="mv-plot-container">
          <div class="mv-loader-spinner" style="width:28px;height:28px;margin:30px auto;border-width:3px;"></div>
        </div>
        
        <div id="srSeasonsContainer" class="sr-seasons-container">
          <div class="mv-loader" style="padding: 40px 20px;">
            <div class="mv-loader-spinner"></div>
            <div class="mv-loader-text">جارٍ تحميل الحلقات...</div>
          </div>
        </div>
      </div>
    `;
      
    document.body.appendChild(page); 
    requestAnimationFrame(() => page.classList.add('show'));
    
    window.SeriesAPI.getSeriesInfo(s.id).then(function (info) { 
      if (_srDetailsCurrentSeries !== s) return;
      _srCurrentInfo = info; 
      
      // عرض القصة
      const plotContainer = document.getElementById('srPlotContainer');
      if (plotContainer && info && info.plot) {
        let plotHtml = `
          <div class="mv-details-section">
            <div class="mv-details-section-title">القصة</div>
            <div class="mv-details-overview">${escapeHtml(info.plot)}</div>
          </div>`;
        
        if (info.cast) {
          plotHtml += `
          <div class="mv-details-section">
            <div class="mv-details-section-title">الممثلون</div>
            <div class="mv-details-overview">${escapeHtml(info.cast)}</div>
          </div>`;
        }
        plotContainer.innerHTML = plotHtml;
      } else if (plotContainer) {
        plotContainer.innerHTML = '';
      }

      renderSeasons(); 
    }).catch(function (err) { 
      const c = document.getElementById('srSeasonsContainer'); 
      if (c) c.innerHTML = '<div class="mv-empty"><div class="mv-empty-title">فشل تحميل الحلقات</div></div>'; 
    });
  };

  window.srCloseDetails = function () { 
    const page = document.getElementById('srDetailsPage'); 
    if (page) { page.classList.remove('show'); setTimeout(() => page.remove(), 300); } 
    _srDetailsCurrentSeries = null; 
    _srCurrentInfo = null; 
    _srCurrentSeason = null; 
  };

  function renderSeasons() {
    const container = document.getElementById('srSeasonsContainer'); 
    if (!container || !_srCurrentInfo) return;
    
    const seasons = _srCurrentInfo.seasons || [];
    if (seasons.length === 0) { 
      container.innerHTML = '<div class="mv-empty"><div class="mv-empty-title">لا توجد حلقات متاحة</div></div>'; 
      return; 
    }
    
    if (!_srCurrentSeason) _srCurrentSeason = seasons[0];
    
    let html = '<div class="sr-seasons-tabs">';
    seasons.forEach(function (season) { 
      html += `<button class="sr-season-tab${season === _srCurrentSeason ? ' active' : ''}" onclick="srSelectSeason('${season}', this)">الموسم ${season}</button>`; 
    });
    html += '</div><div class="sr-episodes-grid">';
    
    const episodes = _srCurrentInfo.episodes[_srCurrentSeason] || [];
    if (episodes.length === 0) { 
      html += '<div class="mv-empty" style="grid-column: 1/-1;padding: 40px;"><div class="mv-empty-title">لا توجد حلقات</div></div>'; 
    } else {
      episodes.forEach(function (ep) {
        const epNum = ep.episode_num || '?'; 
        const epTitle = ep.title || ('حلقة ' + epNum); 
        const ext = ep.container_extension || 'mp4'; 
        const epId = ep.id || ep.episode_id; 
        const epPoster = (ep.info && ep.info.movie_image) || getSafePoster(_srDetailsCurrentSeries) || '';
        
        html += `<div class="sr-episode-card" onclick="srPlayEpisode(${epId}, '${escapeHtml(ext)}', '${escapeHtml(epTitle)}', '${escapeHtml(epPoster)}')">
          <div class="sr-episode-number">${epNum}</div>
          <div class="sr-episode-info">
            <div class="sr-episode-title">${escapeHtml(epTitle)}</div>
            ${ep.info && ep.info.duration ? `<div class="sr-episode-duration">${escapeHtml(ep.info.duration)}</div>` : ''}
          </div>
          <div class="sr-episode-play"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>
        </div>`;
      });
    }
    html += '</div>'; 
    container.innerHTML = html;
  }

  window.srSelectSeason = function (seasonNum, btn) { 
    _srCurrentSeason = seasonNum; 
    document.querySelectorAll('.sr-season-tab').forEach(function (b) { b.classList.remove('active'); }); 
    if (btn) btn.classList.add('active'); 
    renderSeasons(); 
  };

  /* ================================================================
     Tab Switching
     ================================================================ */
  window.switchEntertainmentTab = function(type) {
    _activeEntTab = type;
    
    document.querySelectorAll('.ent-topbar-btn').forEach(btn => { 
      btn.classList.toggle('active', btn.dataset.ent === type); 
    });
    
    const body = document.getElementById('entertainmentContent'); 
    if (!body) return;

    _currentEntRequest++;
    const myReqId = _currentEntRequest;

    if (type === 'movies' && _entMoviesRendered && _mvHtmlCache) {
      if (body.innerHTML !== _mvHtmlCache) {
        body.innerHTML = _mvHtmlCache;
        bindMoviesPageEvents();
        if (window.H90LazyImages) window.H90LazyImages.bind();
      }
      renderRecentMovies();
      body.style.opacity = '1';
      return;
    }
    if (type === 'series' && _entSeriesRendered && _srHtmlCache) {
      if (body.innerHTML !== _srHtmlCache) {
        body.innerHTML = _srHtmlCache;
        bindSeriesPageEvents();
        if (window.H90LazyImages) window.H90LazyImages.bind();
      }
      renderRecentSeries();
      body.style.opacity = '1';
      return;
    }

    body.innerHTML = '';
    const loadingText = type === 'movies' ? 'جارٍ تحميل الأفلام...' : 'جارٍ تحميل المسلسلات...';
    body.innerHTML = `<div class="mv-loader" style="padding: 100px 20px; display:flex; flex-direction:column; align-items:center; justify-content:center;"><div class="mv-loader-spinner" style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#ff2d55;border-radius:50%;animation:spin 1s linear infinite;"></div><div class="mv-loader-text" style="margin-top:15px;color:rgba(255,255,255,0.6);font-size:14px;font-weight:700;">${loadingText}</div></div>`;

    if (type === 'movies') {
      renderMoviesPage(myReqId);
    } else if (type === 'series') {
      renderSeriesPage(myReqId);
    }
  };

  /* ================================================================
     INIT
     ================================================================ */
  window.mvRefreshMovies = () => { _entMoviesRendered = false; _mvHtmlCache = null; renderMoviesPage(_currentEntRequest); };
  window.srRefreshSeries = () => { _entSeriesRendered = false; _srHtmlCache = null; renderSeriesPage(_currentEntRequest); };

  (function autoLoadEntertainment() {
    const entPage = document.getElementById('entertainmentPage');
    if (!entPage) return;
    let loadedOnce = false;
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (entPage.classList.contains('active') && !loadedOnce) {
            loadedOnce = true;
            setTimeout(function() { 
              if (typeof window.switchEntertainmentTab === 'function') {
                window.switchEntertainmentTab('movies');
              }
            }, 100);
          }
        }
      });
    });
    observer.observe(entPage, { attributes: true, attributeFilter: ['class'] });
  })();

  console.log('%cH90 — Entertainment v29.0 (Ultimate & Enhanced UI)', 'background:linear-gradient(135deg,#00e5ff,#ffb300);color:#fff;padding:5px 12px;border-radius:8px;font-weight:900;font-size:11px;');

})();
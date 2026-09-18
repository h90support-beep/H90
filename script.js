/* ================================================================
   H90 v19.0 — script.js (Quality Picker Modal)
   ✅ نافذة اختيار الجودة قبل الفتح
   ✅ فتح القناة في VLC بالجودة المحددة
   ✅ Capacitor + PWA
   ================================================================ */

// ============ State ============
let currentLang = 'ar';
let currentCategory = 'all';
let currentTab = 'channels';
let currentView = 'channels';
let currentGroupId = null;
let currentFilteredChannels = [];
let searchQuery = '';
let favorites = [];
let recentChannels = [];
let deferredPrompt = null;

const FAV_KEY = 'h90_favorites';
const RECENT_KEY = 'h90_recent';
const SEARCH_KEY = 'h90_search_history';
const THEME_KEY = 'h90_theme';

// ============ Init ============
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 H90 v19.0 Init');

  loadFavorites();
  loadRecent();
  loadTheme();

  if (typeof loadM3UFromWorker === 'function') {
    try {
      console.log('⏳ جاري تحميل M3U...');
      await loadM3UFromWorker();
      console.log('✅ M3U جاهز');
    } catch (e) {
      console.error('❌ فشل تحميل M3U:', e);
      showToast('⚠️ فشل تحميل القنوات', 'error');
    }
  }

  setTimeout(function() {
    renderGroups();
    renderThemeGrid();
  }, 100);

  document.querySelectorAll('.nav-item').forEach(function(item) {
    if (item.dataset.bound === '1') return;
    item.dataset.bound = '1';
    item.addEventListener('click', function() {
      var tab = item.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  if (window.PlayerEngine && typeof window.PlayerEngine.init === 'function') {
    setTimeout(function() {
      try {
        window.PlayerEngine.init();
        console.log('✅ PlayerEngine.init() called');
      } catch (e) {
        console.error('❌ PlayerEngine.init error:', e);
      }
    }, 500);
  } else {
    console.error('❌ PlayerEngine not available!');
  }

  updateNotifToggles();
  initDNDState();
  initStreamMonitor();

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(function() {
      var banner = document.getElementById('pwaBanner');
      if (banner && !localStorage.getItem('h90_pwa_dismissed')) {
        banner.classList.add('show');
      }
    }, 5000);
  });

  window.addEventListener('online', function() {
    var b = document.getElementById('offlineBanner');
    if (b) b.classList.remove('show');
  });
  window.addEventListener('offline', function() {
    var b = document.getElementById('offlineBanner');
    if (b) b.classList.add('show');
  });
  if (!navigator.onLine) {
    var ob = document.getElementById('offlineBanner');
    if (ob) ob.classList.add('show');
  }

  try {
    var n = JSON.parse(localStorage.getItem('h90_notifications') || '[]');
    if (n.length === 0) {
      n = [
        { id: 1, icon: '👋', title: 'مرحباً بك في H90', desc: 'استمتع بمشاهدة القنوات بث مباشر', time: Date.now(), read: true }
      ];
      localStorage.setItem('h90_notifications', JSON.stringify(n));
    }
  } catch (e) {}

  console.log('✅ H90 Ready');
});

// ============ Switch Tab ============
function switchTab(tab) {
  console.log('📱 Tab:', tab);
  currentTab = tab;

  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.tab === tab);
  });

  var categoriesBar = document.getElementById('categoriesBar');
  var heroBanner = document.getElementById('heroBanner');
  var pageContent = document.getElementById('pageContent');
  var matchesTabContent = document.getElementById('matchesTabContent');

  if (tab === 'matches') {
    if (pageContent) pageContent.style.display = 'none';
    if (matchesTabContent) matchesTabContent.style.display = 'flex';
    renderMatches();
    if (navigator.vibrate) navigator.vibrate(10);
    return;
  } else {
    if (matchesTabContent) matchesTabContent.style.display = 'none';
    if (pageContent) pageContent.style.display = 'block';
  }

  if (tab === 'channels') {
    currentView = 'channels';
    currentCategory = 'all';
    currentGroupId = null;
    if (categoriesBar) categoriesBar.style.display = 'flex';
    if (heroBanner) heroBanner.style.display = 'flex';
    renderGroups();
  } else if (tab === 'favorites') {
    currentView = 'favorites';
    currentGroupId = null;
    if (categoriesBar) categoriesBar.style.display = 'flex';
    if (heroBanner) heroBanner.style.display = 'flex';
    renderChannels();
  } else if (tab === 'recent') {
    currentView = 'recent';
    currentGroupId = null;
    if (categoriesBar) categoriesBar.style.display = 'flex';
    if (heroBanner) heroBanner.style.display = 'flex';
    renderChannels();
  } else if (tab === 'settings') {
    openSettings();
  }

  if (navigator.vibrate) navigator.vibrate(10);
}

// ============ Render Matches ============
async function renderMatches() {
  var grid = document.getElementById('channelsGrid');
  if (!grid) return;

  grid.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center;min-height:60vh">' +
      '<div style="width:110px;height:110px;background:linear-gradient(135deg,var(--accent) 0%,#7B0F1E 100%);border-radius:30px;display:flex;align-items:center;justify-content:center;margin-bottom:26px;box-shadow:0 15px 45px rgba(229,57,53,0.45);animation:floatIcon 3s ease-in-out infinite">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<path d="M12 6v6l4 2"/>' +
        '</svg>' +
      '</div>' +
      '<h2 style="font-size:24px;font-weight:900;color:var(--text-main);margin:0 0 14px;letter-spacing:-0.5px;line-height:1.4">🚧 قسم المباريات تحت الصيانة</h2>' +
      '<p style="font-size:14px;color:var(--text-dim);line-height:1.9;max-width:340px;margin:0 0 30px;font-weight:500">' +
        'نعمل حالياً على تطوير قسم المباريات لتقديم تجربة أفضل مع جدول مباريات محدّث مباشرة. شكراً لصبركم وتفهمكم 💙' +
      '</p>' +
      '<button onclick="switchTab(\'channels\')" style="background:linear-gradient(135deg,var(--accent) 0%,#ff6f00 100%);border:none;color:#fff;padding:15px 38px;border-radius:32px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 10px 28px rgba(229,57,53,0.4);display:flex;align-items:center;gap:10px">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px">' +
          '<path d="M19 12H5M12 19l-7-7 7-7"/>' +
        '</svg>' +
        'العودة للقنوات' +
      '</button>' +
    '</div>';
}

// ============ Categories Bar ============
function renderCategoriesBar() {
  var bar = document.getElementById('categoriesBar');
  if (!bar) return;

  var groups = (typeof getAllGroups === 'function') ? getAllGroups() : [];

  var html = '<button class="category-chip active" data-cat="all" onclick="filterCategory(\'all\', this)">' +
    '<span>📺</span> الكل' +
  '</button>';

  groups.forEach(function(group) {
    var safeId = group.id;
    var icon = group.icon || '📺';
    var count = group.channels.length;

    html += '<button class="category-chip" data-cat="' + safeId + '" onclick="filterCategory(\'' + safeId + '\', this)">' +
      '<span>' + icon + '</span> ' + group.name_ar + ' (' + count + ')' +
    '</button>';
  });

  bar.innerHTML = html;
}

// ============ Groups System ============
function renderGroups() {
  var grid = document.getElementById('channelsGrid');
  if (!grid) return;

  renderCategoriesBar();

  if (typeof getAllGroups !== 'function') {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><div class="title">خطأ</div><div class="desc">ملف القنوات مفقود</div></div>';
    return;
  }

  var groups = getAllGroups();
  if (groups.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📺</div><div class="title">لا توجد مجموعات</div></div>';
    return;
  }

  var html = '';
  groups.forEach(function(group, idx) {
    var coverImg = (typeof getGroupCoverImage === 'function') ? getGroupCoverImage(group) : '';
    var channelCount = group.channels.length;
    var icon = group.icon || '📺';
    var quality = group.quality || 'HD';

    var coverHtml = coverImg
      ? '<img src="' + coverImg + '" alt="' + group.name_ar + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="logo-placeholder" style="display:none">' + icon + '</div>'
      : '<div class="logo-placeholder">' + icon + '</div>';

    html += '<div class="channel-card group-card" style="animation-delay:' + (idx * 40) + 'ms" data-group-id="' + group.id + '">' +
      '<div class="channel-logo">' +
        coverHtml +
        '<span class="status-badge" style="background:linear-gradient(135deg,#ff3b30,#ff9500)">' + channelCount + '</span>' +
      '</div>' +
      '<div class="channel-name">' + group.name_ar + '</div>' +
      '<div class="channel-servers">' + channelCount + ' قنوات</div>' +
      '<div class="server-badge" style="background:rgba(229,57,53,0.15); color:#e53935; border:1px solid rgba(229,57,53,0.3)">' +
        '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:-1px">' +
          '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' +
        '</svg>' +
        'M3U · ' + quality +
      '</div>' +
    '</div>';
  });

  grid.innerHTML = html;

  grid.querySelectorAll('.group-card').forEach(function(card) {
    card.addEventListener('click', function() {
      openGroup(card.dataset.groupId);
    });
  });
}

function openGroup(groupId) {
  var group = (typeof getGroupById === 'function') ? getGroupById(groupId) : null;
  if (!group) return;

  currentGroupId = groupId;
  console.log('📂 openGroup:', groupId);
  renderGroupChannels(group);
  if (navigator.vibrate) navigator.vibrate(10);
}

function renderGroupChannels(group) {
  var grid = document.getElementById('channelsGrid');
  if (!grid) return;

  var channels = (typeof getChannelsByGroup === 'function') ? getChannelsByGroup(group.id) : [];
  var icon = group.icon || '📺';

  if (channels.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📺</div><div class="title">لا توجد قنوات</div></div>';
    return;
  }

  var headerHtml = '<div class="group-header" style="grid-column:1/-1; display:flex; align-items:center; gap:12px; padding:12px 4px; margin-bottom:8px">' +
    '<button class="group-back-btn" onclick="closeGroup()" style="width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);border:1px solid var(--border-color);color:var(--text-main);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-family:inherit">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M15 18l-6-6 6-6"/>' +
      '</svg>' +
    '</button>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-size:16px;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:8px">' +
        icon + ' ' + group.name_ar +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' +
        channels.length + ' قنوات · ' +
        '<span style="color:#e53935; font-weight:700">M3U</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  var channelsHtml = '';
  channels.forEach(function(ch, idx) {
    var isFav = favorites.indexOf(ch.id) > -1;
    var name = currentLang === 'ar' ? ch.name_ar : ch.name_en;
    var logoHtml = ch.logo
      ? '<img src="' + ch.logo + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="logo-placeholder" style="display:none">' + (ch.letter || '📺') + '</div>'
      : '<div class="logo-placeholder">' + (ch.letter || '📺') + '</div>';

    var serverUrls = 0;
    if (typeof getChannelUrls === 'function') {
      serverUrls = getChannelUrls(ch, 'm3u').length;
    }

    var qualitiesBadge = '';
    if (serverUrls > 1) {
      qualitiesBadge = '<div style="font-size:9px;color:#2ed573;text-align:center;margin-top:2px;font-weight:700">' + serverUrls + ' جودات</div>';
    }

    channelsHtml += '<div class="channel-card" style="animation-delay:' + (idx * 30) + 'ms" data-channel-id="' + ch.id + '">' +
      '<button class="channel-fav ' + (isFav ? 'active' : '') + '" data-fav-id="' + ch.id + '">' + (isFav ? '★' : '☆') + '</button>' +
      '<div class="channel-logo">' +
        logoHtml +
        '<span class="status-badge" style="background:linear-gradient(135deg,#ff3b30,#ff9500)">LIVE</span>' +
      '</div>' +
      '<div class="channel-name">' + name + '</div>' +
      '<div class="channel-servers">' + serverUrls + ' روابط</div>' +
      qualitiesBadge +
    '</div>';
  });

  grid.innerHTML = headerHtml + channelsHtml;

  grid.querySelectorAll('.channel-card[data-channel-id]').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.channel-fav')) return;
      openChannelInGroup(card.dataset.channelId, group);
    });
  });

  grid.querySelectorAll('.channel-fav').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFavorite(btn.dataset.favId);
      setTimeout(function() { renderGroupChannels(group); }, 50);
    });
  });
}

function closeGroup() {
  currentGroupId = null;
  renderGroups();
  if (navigator.vibrate) navigator.vibrate(10);
}

function openChannelInGroup(channelId, group) {
  openChannel(channelId, {
    server: 'm3u',
    group: group.id
  });
}

// ============ Render Channels ============
function renderChannels() {
  var grid = document.getElementById('channelsGrid');
  if (!grid) return;
  if (currentView === 'matches') return;
  if (currentGroupId) return;

  var channels = [];
  try {
    if (typeof getAllChannels !== 'function') {
      grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><div class="title">خطأ</div><div class="desc">ملف القنوات مفقود</div></div>';
      return;
    }
    channels = getAllChannels();
  } catch (e) {
    console.error(e);
    return;
  }

  if (currentView === 'favorites') {
    channels = channels.filter(function(c) { return favorites.indexOf(c.id) > -1; });
  } else if (currentView === 'recent') {
    channels = recentChannels.map(function(id) {
      return typeof getChannelById === 'function' ? getChannelById(id) : null;
    }).filter(Boolean);
  } else if (currentCategory !== 'all' && currentCategory !== 'favorites') {
    channels = channels.filter(function(c) { return c.category === currentCategory; });
  }

  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    channels = channels.filter(function(c) {
      return c.name_ar.toLowerCase().indexOf(q) > -1 ||
             c.name_en.toLowerCase().indexOf(q) > -1;
    });
  }

  currentFilteredChannels = channels;

  if (channels.length === 0) {
    var icon = '📺', title = 'لا توجد قنوات', desc = '';
    if (currentView === 'favorites') {
      icon = '⭐'; title = 'لا توجد مفضلات'; desc = 'أضف قنوات بالضغط على أيقونة النجمة';
    } else if (currentView === 'recent') {
      icon = '🕒'; title = 'لا توجد سجلات حديثة'; desc = 'ابدأ بمشاهدة أي قناة وستظهر هنا';
    } else if (searchQuery) {
      icon = '🔍'; title = 'لا توجد نتائج مطابقة'; desc = 'جرب كلمة بحث أخرى';
    }

    grid.innerHTML = '<div class="empty-state" style="text-align:center;padding:70px 20px;color:var(--text-dim)">' +
      '<div style="font-size:56px;margin-bottom:16px">' + icon + '</div>' +
      '<div style="font-weight:700;font-size:16px;color:var(--text-main);margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:13px;opacity:0.7">' + desc + '</div>' +
    '</div>';
    return;
  }

  var html = '';
  channels.forEach(function(ch, idx) {
    var isFav = favorites.indexOf(ch.id) > -1;
    var name = currentLang === 'ar' ? ch.name_ar : ch.name_en;
    var logoHtml = ch.logo
      ? '<img src="' + ch.logo + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="logo-placeholder" style="display:none">' + (ch.letter || '📺') + '</div>'
      : '<div class="logo-placeholder">' + (ch.letter || '📺') + '</div>';

    var serverUrls = 0;
    if (typeof getChannelUrls === 'function') {
      serverUrls = getChannelUrls(ch, 'm3u').length;
    }

    html += '<div class="channel-card" style="animation-delay:' + (idx * 30) + 'ms; position:relative; overflow:hidden;" data-channel-id="' + ch.id + '">' +
      '<button class="channel-fav ' + (isFav ? 'active' : '') + '" data-fav-id="' + ch.id + '">' + (isFav ? '★' : '☆') + '</button>' +
      '<div class="channel-logo" style="position:relative;">' +
        logoHtml +
        '<span class="status-badge" style="background:linear-gradient(135deg,#ff3b30,#ff9500); color:#fff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px;">LIVE</span>' +
      '</div>' +
      '<div class="channel-name" style="font-weight:700; font-size:13px; margin-top:8px;">' + name + '</div>' +
      '<div class="channel-servers" style="font-size:11px; opacity:0.7; margin-top:2px;">' + serverUrls + ' روابط</div>' +
    '</div>';
  });
  grid.innerHTML = html;

  grid.querySelectorAll('.channel-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.channel-fav')) return;
      openChannel(card.dataset.channelId);
    });
  });

  grid.querySelectorAll('.channel-fav').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFavorite(btn.dataset.favId);
    });
  });
}

// ═══════════════════════════════════════════════════════
// ✅✅✅ Open Channel (مع Quality Picker)
// ═══════════════════════════════════════════════════════
function openChannel(channelId, options) {
  console.log('🎬 openChannel:', channelId, options || {});

  if (typeof getChannelById !== 'function') {
    showToast('خطأ في القنوات', 'error');
    return;
  }

  var channel = getChannelById(channelId);
  if (!channel) {
    showToast('القناة غير موجودة', 'error');
    return;
  }

  // ✅ احصل على الجودات
  var urls = [];
  var qualities = [];
  if (typeof getChannelUrls === 'function') urls = getChannelUrls(channel, 'm3u');
  if (typeof getChannelQualities === 'function') qualities = getChannelQualities(channel, 'm3u');

  // ✅ إذا القناة عندها أكثر من جودة → اعرض القائمة
  if (urls.length > 1 && qualities.length > 1) {
    showQualityPicker(channel, urls, qualities, options);
    return;
  }

  // ✅ قناة واحدة → افتح مباشرة
  openChannelDirect(channel, 0, options);
}

// ═══════════════════════════════════════════════════════
// ✅ نافذة اختيار الجودة
// ═══════════════════════════════════════════════════════
function showQualityPicker(channel, urls, qualities, options) {
  // احذف النافذة القديمة
  var old = document.getElementById('qualityPickerModal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'qualityPickerModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

  var qualityButtons = '';

  // ✅ AUTO
  qualityButtons += '<button class="quality-choice-btn" data-index="-1">' +
    '<div class="quality-choice-icon">🤖</div>' +
    '<div class="quality-choice-info">' +
      '<div class="quality-choice-label">تلقائي (AUTO)</div>' +
      '<div class="quality-choice-desc">أفضل جودة تلقائياً</div>' +
    '</div>' +
  '</button>';

  // ✅ الجودات
  qualities.forEach(function(q, i) {
    var emoji = getQualityEmoji(q);
    qualityButtons += '<button class="quality-choice-btn" data-index="' + i + '">' +
      '<div class="quality-choice-icon">' + emoji + '</div>' +
      '<div class="quality-choice-info">' +
        '<div class="quality-choice-label">' + q + '</div>' +
        '<div class="quality-choice-desc">' + getQualityDesc(q) + '</div>' +
      '</div>' +
    '</button>';
  });

  modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:20px;padding:22px;max-width:400px;width:100%;max-height:85vh;overflow-y:auto;animation:popIn 0.3s ease">' +
    '<div style="text-align:center;margin-bottom:20px">' +
      '<div style="width:64px;height:64px;background:linear-gradient(135deg,var(--accent),#ff6f00);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:32px">📺</div>' +
      '<div style="font-size:17px;font-weight:800;color:var(--text-main);margin-bottom:4px">' + channel.name_ar + '</div>' +
      '<div style="font-size:12px;color:var(--text-dim)">اختر الجودة للمشاهدة</div>' +
    '</div>' +
    '<div>' + qualityButtons + '</div>' +
    '<button id="cancelQualityPicker" style="width:100%;padding:12px;background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:12px;color:var(--text-main);font-weight:700;font-family:inherit;cursor:pointer;font-size:13px;margin-top:8px">إلغاء</button>' +
  '</div>';

  document.body.appendChild(modal);

  var style = document.createElement('style');
  style.id = 'qualityPickerStyle';
  style.textContent = `
    .quality-choice-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px 16px;
      background: var(--bg-elevated);
      border: 1.5px solid var(--border-color);
      border-radius: 14px;
      color: var(--text-main);
      font-family: inherit;
      cursor: pointer;
      margin-bottom: 10px;
      text-align: right;
      transition: all 0.2s;
    }
    .quality-choice-btn:hover,
    .quality-choice-btn:active {
      border-color: var(--accent);
      background: rgba(229,57,53,0.1);
      transform: scale(1.02);
    }
    .quality-choice-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--bg-main);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .quality-choice-info { flex: 1; text-align: right; }
    .quality-choice-label {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-main);
    }
    .quality-choice-desc {
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);

  // ✅ ربط الأزرار
  modal.querySelectorAll('.quality-choice-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(btn.dataset.index);

      modal.remove();
      style.remove();

      if (index === -1) {
        // AUTO
        showToast('🤖 ' + qualities[0], 'info');
        openChannelDirect(channel, 0, options);
      } else {
        // جودة محددة
        showToast('📺 ' + qualities[index], 'info');
        openChannelDirect(channel, index, options);
      }
    });
  });

  document.getElementById('cancelQualityPicker').addEventListener('click', function() {
    modal.remove();
    style.remove();
  });
}

function getQualityDesc(q) {
  var ql = String(q).toUpperCase();
  if (ql.includes('4K') || ql.includes('UHD')) return 'جودة فائقة (4K)';
  if (ql.includes('FHD')) return 'جودة عالية (1080p)';
  if (ql === 'HD') return 'جودة متوسطة (720p)';
  if (ql === 'SD') return 'جودة عادية (480p)';
  if (ql.includes('LOW')) return 'جودة منخفضة';
  if (ql.includes('HEVC') || ql.includes('265')) return 'H.265 (يحتاج VLC)';
  return 'جودة ' + q;
}

function getQualityEmoji(q) {
  var ql = String(q).toUpperCase();
  if (ql.includes('4K') || ql.includes('UHD')) return '🌟';
  if (ql.includes('FHD')) return '💎';
  if (ql === 'HD') return '🎯';
  if (ql === 'SD') return '📺';
  if (ql.includes('LOW')) return '🔽';
  if (ql.includes('HEVC') || ql.includes('265')) return '⚡';
  return '🎬';
}

// ✅ فتح القناة مباشرة
function openChannelDirect(channel, serverIndex, options) {
  console.log('▶️ openChannelDirect:', channel.name_ar, 'index:', serverIndex);

  var serverId = (options && options.server) ? options.server : 'm3u';
  var groupId = (options && options.group) ? options.group : (channel.group || null);

  if (window.PlayerEngine) {
    if (typeof window.PlayerEngine.setCurrentServer === 'function') {
      window.PlayerEngine.setCurrentServer(serverId);
    }
    if (groupId && typeof window.PlayerEngine.setCurrentGroup === 'function') {
      window.PlayerEngine.setCurrentGroup(groupId);
    }
  }

  addToRecent(channel.id);
  startStreamMonitor(channel);

  var playerPage = document.getElementById('playerPage');
  if (!playerPage) {
    showToast('صفحة المشغل مفقودة', 'error');
    return;
  }

  playerPage.classList.add('show');
  playerPage.style.display = 'flex';
  document.body.classList.add('player-open');

  setTimeout(function() {
    if (window.PlayerEngine && typeof window.PlayerEngine.loadChannel === 'function') {
      try {
        window.PlayerEngine.loadChannel(channel, serverIndex || 0, serverId);
        console.log('✅ loadChannel called with server:', serverId, 'index:', serverIndex);
      } catch (e) {
        console.error('❌ loadChannel error:', e);
        showToast('خطأ في المشغل: ' + e.message, 'error');
      }
    } else {
      console.error('❌ PlayerEngine not ready');
      showToast('المشغل غير جاهز', 'error');
    }
  }, 100);

  if (navigator.vibrate) navigator.vibrate(15);
}

// ============ Close Player ============
function closePlayer() {
  var playerPage = document.getElementById('playerPage');
  var video = document.getElementById('videoPlayer');

  if (video) {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
  }

  if (playerPage) {
    playerPage.classList.remove('show');
    playerPage.style.display = 'none';
  }

  document.body.classList.remove('player-open');
  stopStreamMonitor();
}

// ============ Switch Server / Quality ============
function switchServer(index) {
  if (!window.PlayerEngine) return;
  var ch = window.PlayerEngine.getCurrentChannel();
  if (!ch) return;

  var server = (typeof window.PlayerEngine.getCurrentServer === 'function')
    ? window.PlayerEngine.getCurrentServer()
    : 'm3u';

  var qualities = (typeof window.PlayerEngine.getCurrentQualities === 'function')
    ? window.PlayerEngine.getCurrentQualities()
    : [];

  if (index < 0 || index >= qualities.length) {
    showToast('⚠️ هذه الجودة غير متاحة', 'warning');
    return;
  }

  var streamType = (typeof window.PlayerEngine.getStreamType === 'function')
    ? window.PlayerEngine.getStreamType()
    : 'hls';

  var hlsLevels = (typeof window.PlayerEngine.getHlsLevels === 'function')
    ? window.PlayerEngine.getHlsLevels()
    : [];

  var canSwitchInternal = 
    streamType === 'hls' && 
    hlsLevels.length > 1 &&
    hlsLevels.length === qualities.length;

  if (canSwitchInternal) {
    window.PlayerEngine.setManualQuality(index);
  } else {
    window.PlayerEngine.loadChannel(ch, index, server);
    showToast('🔄 ' + (qualities[index] || 'الرابط ' + (index + 1)), 'info');
  }
}

function switchServerAuto() {
  if (!window.PlayerEngine) return;
  if (typeof window.PlayerEngine.setManualQuality === 'function') {
    window.PlayerEngine.setManualQuality(-1);
  }
}

// ============ Favorites ============
function loadFavorites() {
  try {
    favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch (e) {
    favorites = [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  } catch (e) {}
}

function toggleFavorite(id) {
  var idx = favorites.indexOf(id);
  if (idx > -1) {
    favorites.splice(idx, 1);
    showToast('💔 حُذفت من المفضلة', 'info');
  } else {
    favorites.push(id);
    showToast('⭐ أُضيفت للمفضلة بنجاح', 'success');
  }
  saveFavorites();
  if (currentGroupId) {
    var g = (typeof getGroupById === 'function') ? getGroupById(currentGroupId) : null;
    if (g) renderGroupChannels(g);
  } else {
    renderChannels();
  }
  if (navigator.vibrate) navigator.vibrate(10);
}

// ============ Recent ============
function loadRecent() {
  try {
    recentChannels = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch (e) {
    recentChannels = [];
  }
}

function addToRecent(id) {
  recentChannels = recentChannels.filter(function(x) { return x !== id; });
  recentChannels.unshift(id);
  recentChannels = recentChannels.slice(0, 20);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentChannels));
  } catch (e) {}
}

// ============ Filters ============
function filterCategory(cat, btn) {
  if (cat !== 'all' && typeof getGroupById === 'function' && getGroupById(cat)) {
    openGroup(cat);
    return;
  }

  currentCategory = cat;
  currentView = 'channels';
  currentGroupId = null;
  document.querySelectorAll('.category-chip').forEach(function(b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  renderChannels();
}

function handleSearch(q) {
  searchQuery = q.trim();
  clearTimeout(window._s);
  window._s = setTimeout(function() {
    renderChannels();
  }, 200);
}

// ============ Drawer / Theme ============
function openDrawer() {
  var d = document.getElementById('drawer');
  var o = document.getElementById('drawerOverlay');
  if (d) d.classList.add('show');
  if (o) o.classList.add('show');
}

function closeDrawer() {
  var d = document.getElementById('drawer');
  var o = document.getElementById('drawerOverlay');
  if (d) d.classList.remove('show');
  if (o) o.classList.remove('show');
}

function loadTheme() {
  var theme = localStorage.getItem(THEME_KEY) || 'red';
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'black') {
    document.body.classList.add('theme-black');
  } else {
    document.body.classList.remove('theme-black');
  }
}

function toggleTheme() {
  var isBlack = document.body.classList.toggle('theme-black');
  var theme = isBlack ? 'black' : 'red';
  localStorage.setItem(THEME_KEY, theme);
  renderThemeGrid();
  showToast(isBlack ? '⚫ تم تفعيل الثيم الأسود' : '🔴 تم تفعيل الثيم الأحمر', 'info');
  closeDrawer();
}

function renderThemeGrid() {
  var grid = document.getElementById('themeGrid');
  if (!grid) return;
  var current = localStorage.getItem(THEME_KEY) || 'red';

  var themes = [
    { id: 'red', name: 'أحمر داكن', color: '#e53935', bg: '#0f0f0f' },
    { id: 'black', name: 'أسود نقي', color: '#ffffff', bg: '#000000' }
  ];

  var html = '';
  themes.forEach(function(t) {
    var active = t.id === current ? 'border-color: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.3);' : 'border-color: transparent; opacity: 0.7;';
    html += '<button onclick="setTheme(\'' + t.id + '\')" style="aspect-ratio:1.6;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;border:3px solid;background:linear-gradient(135deg,' + t.bg + ' 40%,' + t.color + ' 100%);color:#fff;font-weight:700;font-size:14px;font-family:inherit;transition:all 0.2s;' + active + '">' +
      '<div style="font-size:22px">' + (t.id === 'red' ? '🔴' : '⚫') + '</div>' +
      '<div style="margin-top:6px;text-shadow:0 2px 6px rgba(0,0,0,0.5)">' + t.name + '</div>' +
    '</button>';
  });
  grid.innerHTML = html;
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  renderThemeGrid();
  showToast(theme === 'red' ? '🔴 الثيم الأحمر' : '⚫ الثيم الأسود', 'success');
}

// ============ Notifications ============
const NOTIF_SETTINGS_KEY = 'h90_notif_settings';
const SOUND_KEY = 'h90_notif_sound';
const MATCH_TIME_KEY = 'h90_match_reminder_time';

const DEFAULT_NOTIF_SETTINGS = {
  general: true, matches: true, breaking: false,
  newchannels: true, streamOffline: true, dnd: false
};

const SOUND_OPTIONS = [
  { id: 'default', name: 'افتراضي', emoji: '🔔' },
  { id: 'chime', name: 'جرس ناعم', emoji: '🎵' },
  { id: 'beep', name: 'صفير قصير', emoji: '📢' },
  { id: 'alert', name: 'تنبيه قوي', emoji: '⚠️' },
  { id: 'silent', name: 'صامت', emoji: '🔇' }
];

const TIME_OPTIONS = [
  { id: 5, label: '5 دقائق' },
  { id: 10, label: '10 دقائق' },
  { id: 15, label: '15 دقيقة' },
  { id: 30, label: '30 دقيقة' },
  { id: 60, label: 'ساعة كاملة' },
  { id: 120, label: 'ساعتان' }
];

function getNotifSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIF_SETTINGS_KEY) || '{}');
    return { ...DEFAULT_NOTIF_SETTINGS, ...saved };
  } catch (e) {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

function saveNotifSettings(settings) {
  try {
    localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function getSelectedSound() {
  return localStorage.getItem(SOUND_KEY) || 'default';
}

function getMatchReminderTime() {
  const t = parseInt(localStorage.getItem(MATCH_TIME_KEY) || '30', 10);
  return isNaN(t) ? 30 : t;
}

async function toggleNotifSetting(key) {
  const settings = getNotifSettings();
  const newValue = !settings[key];

  if (newValue && 'Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('⚠️ يجب السماح بالإشعارات', 'warning');
        return;
      }
    } else if (Notification.permission === 'denied') {
      showToast('⚠️ الإشعارات محظورة', 'warning');
      return;
    }
  }

  settings[key] = newValue;
  saveNotifSettings(settings);

  if (key === 'dnd') {
    updateDNDIndicator(newValue);
    showToast(newValue ? '🌙 وضع عدم الإزعاج' : '🔔 تم الإيقاف', 'info');
  } else {
    const labels = {
      general: 'التحديثات العامة', matches: 'تذكير المباريات',
      breaking: 'الأخبار العاجلة', newchannels: 'القنوات الجديدة',
      streamOffline: 'إشعار انقطاع البث'
    };
    showToast(newValue ? `🔔 تم تفعيل: ${labels[key]}` : `🔕 تم إيقاف: ${labels[key]}`, 'info');
  }

  updateNotifToggles();
  if (navigator.vibrate) navigator.vibrate(15);
}

function updateNotifToggles() {
  const settings = getNotifSettings();
  ['general', 'matches', 'breaking', 'newchannels', 'streamOffline', 'dnd'].forEach(key => {
    const el = document.getElementById('toggle-notif-' + key);
    if (el) el.classList.toggle('on', settings[key] === true);
  });

  const timeBtn = document.getElementById('changeMatchTimeBtn');
  if (timeBtn) {
    timeBtn.style.display = settings.matches ? 'flex' : 'none';
    const label = document.getElementById('matchesTimeLabel');
    if (label) {
      const mins = getMatchReminderTime();
      const option = TIME_OPTIONS.find(o => o.id === mins);
      label.textContent = `تنبيه قبل ${option ? option.label : mins + ' دقيقة'}`;
    }
  }

  const soundLabel = document.getElementById('currentSoundLabel');
  if (soundLabel) {
    const sound = SOUND_OPTIONS.find(s => s.id === getSelectedSound());
    soundLabel.textContent = sound ? sound.name : 'افتراضي';
  }

  const reqBtn = document.getElementById('requestNotifPermissionBtn');
  if (reqBtn && 'Notification' in window) {
    reqBtn.style.display = Notification.permission === 'granted' ? 'none' : 'flex';
  }
}

function updateDNDIndicator(isOn) {
  const indicator = document.getElementById('dndIndicator');
  if (!indicator) return;
  if (isOn) indicator.classList.add('show');
  else indicator.classList.remove('show');
}

function initDNDState() {
  const settings = getNotifSettings();
  updateDNDIndicator(settings.dnd === true);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) { showToast('⚠️ غير مدعوم', 'warning'); return; }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') { showToast('✅ تم التفعيل', 'success'); updateNotifToggles(); }
    else if (permission === 'denied') { showToast('❌ تم الرفض', 'error'); }
  } catch (e) {}
}

function playNotificationSound(soundId) {
  const id = soundId || getSelectedSound();
  if (id === 'silent' || id === 'default') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const configs = {
      chime: { freq: 880, duration: 0.3, type: 'sine', volume: 0.2 },
      beep: { freq: 1200, duration: 0.15, type: 'square', volume: 0.15 },
      alert: { freq: 600, duration: 0.5, type: 'sawtooth', volume: 0.15 }
    };
    const cfg = configs[id] || configs.chime;
    osc.frequency.value = cfg.freq;
    osc.type = cfg.type;
    gain.gain.setValueAtTime(cfg.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + cfg.duration);
    setTimeout(() => ctx.close(), cfg.duration * 1000 + 100);
  } catch (e) {}
}

function sendLocalNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  const settings = getNotifSettings();
  if (settings.dnd && !options.ignoreDND) { saveNotificationToHistory(title, body, options); return null; }
  try {
    const soundId = options.sound || getSelectedSound();
    const isSilent = soundId === 'silent';
    const notif = new Notification(title, {
      body: body, icon: options.icon || 'H90.jpg', tag: options.tag || 'h90-notif',
      dir: 'rtl', lang: 'ar', silent: isSilent, vibrate: isSilent ? [] : [200, 100, 200]
    });
    if (!isSilent && soundId !== 'default') playNotificationSound(soundId);
    notif.onclick = function() {
      window.focus();
      if (options.url) window.location.href = options.url;
      notif.close();
    };
    saveNotificationToHistory(title, body, options);
    return notif;
  } catch (e) { return null; }
}

function sendTypedNotification(type, title, body, url) {
  const settings = getNotifSettings();
  if (!settings[type]) return;
  return sendLocalNotification(title, body, { tag: type + '-' + Date.now(), url: url });
}

function saveNotificationToHistory(title, body, options = {}) {
  try {
    const notifs = JSON.parse(localStorage.getItem('h90_notifications') || '[]');
    notifs.unshift({
      id: Date.now(), icon: options.icon_emoji || '🔔',
      title: title, desc: body, time: Date.now(), read: false
    });
    const trimmed = notifs.slice(0, 30);
    localStorage.setItem('h90_notifications', JSON.stringify(trimmed));
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'block';
  } catch (e) {}
}

let streamMonitorInterval = null;
let lastStreamState = null;
let currentMonitoredChannel = null;

function startStreamMonitor(channel) {
  stopStreamMonitor();
  currentMonitoredChannel = channel;
  lastStreamState = null;

  streamMonitorInterval = setInterval(() => {
    const video = document.getElementById('videoPlayer');
    if (!video) return;
    const settings = getNotifSettings();
    if (!settings.streamOffline) return;
    const isStalled = video.readyState < 2 && !video.paused;
    if (isStalled && lastStreamState === 'live') {
      sendTypedNotification('streamOffline', '📡 انقطع البث', `قناة "${channel.name_ar || ''}"`, null);
      lastStreamState = 'offline';
    } else if (video.readyState >= 2) {
      lastStreamState = 'live';
    }
  }, 8000);
}

function stopStreamMonitor() {
  if (streamMonitorInterval) {
    clearInterval(streamMonitorInterval);
    streamMonitorInterval = null;
  }
}

function initStreamMonitor() { console.log('📡 Stream Monitor ready'); }

function openTimePicker() {
  const modal = document.getElementById('timePickerModal');
  const list = document.getElementById('timeOptionsList');
  if (!modal || !list) return;
  const current = getMatchReminderTime();
  list.innerHTML = TIME_OPTIONS.map(opt => {
    const selected = opt.id === current;
    return `<button class="time-option ${selected ? 'selected' : ''}" onclick="selectMatchTime(${opt.id})"><span>${opt.label}</span><span class="check"></span></button>`;
  }).join('');
  modal.classList.add('show');
}

function closeTimePicker() { const modal = document.getElementById('timePickerModal'); if (modal) modal.classList.remove('show'); }

function selectMatchTime(minutes) {
  try { localStorage.setItem(MATCH_TIME_KEY, minutes.toString()); } catch (e) {}
  const opt = TIME_OPTIONS.find(o => o.id === minutes);
  showToast(`⏰ ${opt ? opt.label : minutes + ' دقيقة'}`, 'success');
  if (navigator.vibrate) navigator.vibrate(15);
  closeTimePicker();
  updateNotifToggles();
}

function openSoundPicker() {
  const modal = document.getElementById('soundPickerModal');
  const list = document.getElementById('soundOptionsList');
  if (!modal || !list) return;
  const current = getSelectedSound();
  list.innerHTML = SOUND_OPTIONS.map(opt => {
    const selected = opt.id === current;
    return `<button class="sound-option ${selected ? 'selected' : ''}" onclick="selectSound('${opt.id}')"><div class="play-preview" onclick="event.stopPropagation();playSoundPreview('${opt.id}')"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><polygon points="6 3 20 12 6 21"/></svg></div><div style="flex:1;text-align:right"><div style="font-size:14px;font-weight:700">${opt.emoji} ${opt.name}</div></div>${selected ? '<div style="width:22px;height:22px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900">✓</div>' : ''}</button>`;
  }).join('');
  modal.classList.add('show');
}

function closeSoundPicker() { const modal = document.getElementById('soundPickerModal'); if (modal) modal.classList.remove('show'); }

function selectSound(soundId) {
  try { localStorage.setItem(SOUND_KEY, soundId); } catch (e) {}
  const sound = SOUND_OPTIONS.find(s => s.id === soundId);
  showToast(`🔊 ${sound ? sound.name : 'افتراضي'}`, 'success');
  if (soundId !== 'default' && soundId !== 'silent') playNotificationSound(soundId);
  if (navigator.vibrate) navigator.vibrate(15);
  closeSoundPicker();
  updateNotifToggles();
}

function playSoundPreview(soundId) {
  if (soundId === 'silent') { showToast('🔇 صامت', 'info'); return; }
  if (soundId === 'default') { showToast('🔔 النظام', 'info'); return; }
  playNotificationSound(soundId);
}

function openSettings() {
  closeDrawer();
  renderThemeGrid();
  loadSettingToggles();
  updateNotifToggles();
  var m = document.getElementById('settingsModal');
  if (m) m.classList.add('show');
}

function closeSettings() { var m = document.getElementById('settingsModal'); if (m) m.classList.remove('show'); }

function loadSettingToggles() {
  try {
    var s = JSON.parse(localStorage.getItem('h90_settings') || '{}');
    var ta = document.getElementById('toggle-autoplay');
    if (ta) ta.classList.toggle('on', s.autoplay !== false);
  } catch (e) {}
  updateNotifToggles();
}

function toggleSetting(key) {
  var s = JSON.parse(localStorage.getItem('h90_settings') || '{}');
  s[key] = !s[key];
  localStorage.setItem('h90_settings', JSON.stringify(s));
  var el = document.getElementById('toggle-' + key);
  if (el) el.classList.toggle('on', s[key]);
  showToast(s[key] ? '✅ تم' : '⏸️ تم', 'info');
}

function clearAppCache() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:20px;padding:24px;max-width:340px;width:100%;text-align:center">
      <div style="font-size:44px;margin-bottom:12px">🧹</div>
      <div style="font-size:18px;font-weight:800;color:var(--text-main);margin-bottom:8px">مسح كل البيانات؟</div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:20px">سيتم حذف المفضلة، السجل، والإعدادات.</div>
      <div style="display:flex;gap:10px">
        <button id="clearCancel" style="flex:1;padding:12px;background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:12px;color:var(--text-main);font-weight:700;font-family:inherit;cursor:pointer;font-size:14px">إلغاء</button>
        <button id="clearConfirm" style="flex:1;padding:12px;background:linear-gradient(135deg,#e53935,#7B0F1E);border:none;border-radius:12px;color:#fff;font-weight:800;font-family:inherit;cursor:pointer;font-size:14px">مسح</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#clearCancel').onclick = () => modal.remove();
  modal.querySelector('#clearConfirm').onclick = () => {
    if (typeof clearM3UCache === 'function') clearM3UCache();
    localStorage.clear();
    showToast('🧹 تم المسح', 'success');
    setTimeout(() => location.reload(), 800);
  };
}

function openHelp() { closeDrawer(); var m = document.getElementById('helpModal'); if (m) m.classList.add('show'); }
function closeHelp() { var m = document.getElementById('helpModal'); if (m) m.classList.remove('show'); }

function openFAQ() {
  closeHelp();
  var faqs = [
    { q: 'كيف أضيف قناة للمفضلة؟', a: 'اضغط أيقونة النجمة (☆) على بطاقة القناة.' },
    { q: 'كيف أغير الجودة؟', a: 'عند الضغط على قناة، اختر الجودة من النافذة.' },
    { q: 'كيف أستعرض السجل؟', a: 'انتقل لقسم "الأخيرة".' },
    { q: 'لماذا بعض القنوات لا تعمل؟', a: 'بعض القنوات تستخدم كوديك H.265 — سيتم فتح VLC تلقائياً.' },
    { q: 'كيف أفعّل الإشعارات؟', a: 'الإعدادات → الإشعارات → تفعيل إشعارات النظام.' }
  ];
  var html = '';
  faqs.forEach(function(f, i) {
    html += '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;margin-bottom:12px;padding:14px">' +
      '<div style="font-weight:700;color:var(--text-main);font-size:14px;margin-bottom:6px">' + (i+1) + '. ' + f.q + '</div>' +
      '<div style="color:var(--text-dim);font-size:13px;line-height:1.7">' + f.a + '</div>' +
    '</div>';
  });
  var c = document.getElementById('faqContent');
  if (c) c.innerHTML = html;
  var m = document.getElementById('faqModal');
  if (m) m.classList.add('show');
}

function closeFAQ() { var m = document.getElementById('faqModal'); if (m) m.classList.remove('show'); }
function openContact() { closeHelp(); var m = document.getElementById('contactModal'); if (m) m.classList.add('show'); }
function closeContact() { var m = document.getElementById('contactModal'); if (m) m.classList.remove('show'); }

async function shareApp() {
  var shareData = { title: 'H90 — البث الحي', text: 'شاهد قنواتك المفضلة عبر H90', url: window.location.href };
  if (navigator.share) {
    try { await navigator.share(shareData); showToast('✅ تمت المشاركة', 'success'); } catch (e) {}
  } else {
    try {
      await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
      showToast('📋 تم النسخ', 'success');
    } catch (e) {}
  }
  closeDrawer();
}

function openSearchOverlay() {
  var o = document.getElementById('searchOverlay');
  if (o) o.classList.add('show');
  setTimeout(function() {
    var i = document.getElementById('searchOverlayInput');
    if (i) i.focus();
  }, 100);
  renderSearchBody('');
}

function closeSearchOverlay() { var o = document.getElementById('searchOverlay'); if (o) o.classList.remove('show'); }
function handleSearchOverlay(q) { renderSearchBody(q); }

function renderSearchBody(q) {
  var body = document.getElementById('searchOverlayBody');
  if (!body) return;
  q = (q || '').trim();

  if (!q) {
    body.innerHTML = '<div style="color:var(--text-dim);font-size:12px;font-weight:700;padding:12px 0 8px">🔥 بحث شائع</div>' +
      '<button onclick="applyHistory(\'beIN\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;color:var(--text-main);cursor:pointer;font-family:inherit;text-align:right;width:100%;margin-bottom:8px">⚽ beIN Sports</button>';
    return;
  }

  var results = (typeof getAllChannels === 'function' ? getAllChannels() : []).filter(function(ch) {
    return ch.name_ar.toLowerCase().indexOf(q.toLowerCase()) > -1;
  });

  if (results.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-dim)"><div style="font-size:48px;margin-bottom:12px">🔍</div><div style="font-weight:700">لا توجد نتائج</div></div>';
    return;
  }

  var html = '<div style="color:var(--text-dim);font-size:12px;font-weight:700;padding:12px 0 8px">📺 ' + results.length + ' نتيجة</div>';
  results.slice(0, 50).forEach(function(ch) {
    html += '<button onclick="selectSearch(\'' + ch.id.replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;color:var(--text-main);cursor:pointer;font-family:inherit;text-align:right;width:100%;margin-bottom:8px">' +
      '<div style="width:40px;height:40px;background:var(--bg-elevated);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--accent);flex-shrink:0">' + (ch.letter || '📺') + '</div>' +
      '<div style="flex:1;font-weight:700;font-size:13px">' + ch.name_ar + '</div>' +
    '</button>';
  });
  body.innerHTML = html;
}

function applyHistory(q) {
  var i = document.getElementById('searchOverlayInput');
  if (i) i.value = q;
  renderSearchBody(q);
}

function selectSearch(id) {
  closeSearchOverlay();
  setTimeout(function() { openChannel(id); }, 250);
}

function openNotifDrawer() {
  renderNotifs();
  var d = document.getElementById('notifDrawer');
  if (d) d.classList.add('show');
  setTimeout(function() {
    var b = document.getElementById('notifBadge');
    if (b) b.style.display = 'none';
    try {
      const notifs = JSON.parse(localStorage.getItem('h90_notifications') || '[]');
      notifs.forEach(n => n.read = true);
      localStorage.setItem('h90_notifications', JSON.stringify(notifs));
    } catch (e) {}
  }, 500);
}

function closeNotifDrawer() { var d = document.getElementById('notifDrawer'); if (d) d.classList.remove('show'); }

function renderNotifs() {
  var body = document.getElementById('notifDrawerBody');
  if (!body) return;
  var notifs = [];
  try { notifs = JSON.parse(localStorage.getItem('h90_notifications') || '[]'); } catch (e) {}

  if (notifs.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text-dim)"><div style="font-size:64px;opacity:0.5;margin-bottom:16px">🔔</div><div style="font-weight:700">لا توجد إشعارات</div></div>';
    return;
  }

  var html = '';
  notifs.forEach(function(n) {
    html += '<div style="display:flex;gap:14px;padding:16px;background:var(--bg-card);border-radius:16px;margin-bottom:12px;border:1px solid var(--border-color)">' +
      '<div style="width:44px;height:44px;border-radius:12px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:22px">' + (n.icon || '🔔') + '</div>' +
      '<div style="flex:1"><div style="font-weight:700;color:var(--text-main);font-size:14px">' + (n.title || '') + '</div><div style="color:var(--text-dim);font-size:12px;margin-top:4px">' + (n.desc || '') + '</div></div>' +
    '</div>';
  });
  body.innerHTML = html;
}

function showToast(msg, type) {
  var e = document.querySelector('.toast');
  if (e) e.remove();
  var t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  t.style.cssText = 'position:fixed; bottom:90px; left:50%; transform:translateX(-50%) translateY(20px); background:rgba(20,20,20,0.95); backdrop-filter:blur(10px); color:#fff; padding:12px 24px; border-radius:14px; font-size:13px; font-weight:700; box-shadow:0 10px 30px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); opacity:0; transition:all 0.3s; z-index:99999; max-width:90%; text-align:center;';
  if (type === 'success') t.style.borderColor = 'rgba(76,175,80,0.4)';
  else if (type === 'error') t.style.borderColor = 'rgba(244,67,54,0.4)';
  else if (type === 'warning') t.style.borderColor = 'rgba(255,165,2,0.4)';
  document.body.appendChild(t);
  setTimeout(function() { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
  setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 300); }, 2500);
}
window.showToast = showToast;

function refreshAll() {
  showToast('🔄 جاري التحديث...', 'info');
  loadFavorites();
  loadRecent();
  if (currentGroupId) {
    var g = (typeof getGroupById === 'function') ? getGroupById(currentGroupId) : null;
    if (g) renderGroupChannels(g);
  } else {
    renderGroups();
  }
}

// ============ Player Bindings ============
window.togglePlay = function() { return window.PlayerEngine && window.PlayerEngine.togglePlay(); };
window.seekBy = function(s) { return window.PlayerEngine && window.PlayerEngine.seekBy(s); };
window.seekFromClick = function(e) { return window.PlayerEngine && window.PlayerEngine.seekFromClick(e); };
window.toggleMute = function() { return window.PlayerEngine && window.PlayerEngine.toggleMute(); };
window.cycleSpeed = function() { return window.PlayerEngine && window.PlayerEngine.cycleSpeed(); };
window.toggleFullscreen = function() { return window.PlayerEngine && window.PlayerEngine.toggleFullscreen(); };
window.reloadStream = function() { return window.PlayerEngine && window.PlayerEngine.reloadStream(); };
window.openInVLC = function(url) { return window.PlayerEngine && window.PlayerEngine.openInVLC(url); };
window.closePlayer = closePlayer;

var pwaBtn = document.getElementById('pwaInstallBtn');
if (pwaBtn) {
  pwaBtn.addEventListener('click', async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    var r = await deferredPrompt.userChoice;
    if (r.outcome === 'accepted') showToast('✅ تم التثبيت', 'success');
    deferredPrompt = null;
    var b = document.getElementById('pwaBanner');
    if (b) b.classList.remove('show');
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeSearchOverlay(); closeSettings(); closeNotifDrawer(); closeDrawer();
    closeHelp(); closeFAQ(); closeContact(); closeTimePicker(); closeSoundPicker();
  }
});

// ============ Expose All Functions ============
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.toggleSetting = toggleSetting;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.clearAppCache = clearAppCache;
window.openHelp = openHelp;
window.closeHelp = closeHelp;
window.openFAQ = openFAQ;
window.closeFAQ = closeFAQ;
window.openContact = openContact;
window.closeContact = closeContact;
window.shareApp = shareApp;

window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.handleSearchOverlay = handleSearchOverlay;
window.applyHistory = applyHistory;
window.selectSearch = selectSearch;
window.openSearch = openSearchOverlay;
window.closeSearch = closeSearchOverlay;

window.openNotifDrawer = openNotifDrawer;
window.closeNotifDrawer = closeNotifDrawer;
window.filterCategory = filterCategory;
window.switchTab = switchTab;
window.openChannel = openChannel;
window.switchServer = switchServer;
window.switchServerAuto = switchServerAuto;
window.toggleFavorite = toggleFavorite;
window.handleSearch = handleSearch;
window.refreshAll = refreshAll;

// Groups
window.renderGroups = renderGroups;
window.openGroup = openGroup;
window.closeGroup = closeGroup;
window.renderGroupChannels = renderGroupChannels;
window.renderCategoriesBar = renderCategoriesBar;

// Quality Pickerwindow.showQualityPicker = showQualityPicker;
window.openChannelDirect = openChannelDirect;
window.getQualityDesc = getQualityDesc;
window.getQualityEmoji = getQualityEmoji;

// Notification System
window.toggleNotifSetting = toggleNotifSetting;
window.updateNotifToggles = updateNotifToggles;
window.requestNotificationPermission = requestNotificationPermission;
window.sendLocalNotification = sendLocalNotification;
window.sendTypedNotification = sendTypedNotification;
window.getNotifSettings = getNotifSettings;

// Time & Sound Pickers
window.openTimePicker = openTimePicker;
window.closeTimePicker = closeTimePicker;
window.selectMatchTime = selectMatchTime;
window.openSoundPicker = openSoundPicker;
window.closeSoundPicker = closeSoundPicker;
window.selectSound = selectSound;
window.playSoundPreview = playSoundPreview;

// Stream Monitor
window.startStreamMonitor = startStreamMonitor;
window.stopStreamMonitor = stopStreamMonitor;

console.log('✅ H90 script.js v19.0 loaded (Quality Picker Modal)');

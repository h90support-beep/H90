/* ================================================================
   H90 v14.0 — channels.js (QUALITY GROUPING)
   ✅ جمع القنوات المتشابهة في قناة واحدة (SD/HD/FHD)
   ✅ فلترة قنوات 4K/UHD/H.265
   ✅ إصلاح اختفاء قنوات beIN
   ✅ تنظيف قوي للأسماء
   ✅ شعارات احتياطية
   ✅ دمج موثوق للجودات
   ================================================================ */

// ═══════════════════════════════════════════════════════
//   🔗 Cloudflare Workers
// ═══════════════════════════════════════════════════════
const M3U_URL = 'https://app.houssenali222333.workers.dev/';
const STREAM_PROXY = 'https://apph90.houssenali222333.workers.dev/?url=';

// ═══════════════════════════════════════════════════════
//   ✅ الباقات المطلوبة
// ═══════════════════════════════════════════════════════
const TARGET_GROUPS = [
  { id: 'bein',       match: /be\s*in\s*sports|b\.\s*sports|bein/i,          name_ar: 'بي إن سبورت',   icon: '⚽', order: 1 },
  { id: 'xtra',       match: /Xtra/i,                                        name_ar: 'بي إن إكسترا',  icon: '📺', order: 2 },
  { id: 'alkass',     match: /AL KASS|الكأس/i,                               name_ar: 'الكأس',         icon: '🏆', order: 3 },
  { id: 'alwan',      match: /ALWAN LOCAL|الألوان/i,                         name_ar: 'الألوان',       icon: '🎨', order: 4 },
  { id: 'starzplay',  match: /STARZPLAY/i,                                   name_ar: 'ستارزبلاي',     icon: '🎬', order: 5 },
  { id: 'thmanyah',   match: /thmanyah/i,                                    name_ar: 'ثمانية',        icon: '8️⃣', order: 6 },
  { id: 'fajer',      match: /AL FAJER/i,                                    name_ar: 'الفجر',         icon: '🌅', order: 7 },
  { id: 'stc',        match: /STC SPORTS/i,                                  name_ar: 'STC',           icon: '📡', order: 8 },
  { id: 'adsport',    match: /AD SPORTS?|AD Sport/i,                         name_ar: 'أبوظبي',        icon: '🇦🇪', order: 9 },
  { id: 'sportslive', match: /SPORTS LIVE/i,                                 name_ar: 'البث الرياضي',  icon: '🔴', order: 10 },
  { id: 'prosports',  match: /PRO SPORTS/i,                                  name_ar: 'رياضة احترافية', icon: '⭐', order: 11 }
];

// ═══════════════════════════════════════════════════════
//   ✅ شعارات احتياطية
// ═══════════════════════════════════════════════════════
const FALLBACK_LOGOS = {
  'bein':       'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/BeIN_Sports_Logo.svg/240px-BeIN_Sports_Logo.svg.png',
  'xtra':       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/BeIN_Sports_Logo.svg/240px-BeIN_Sports_Logo.svg.png',
  'alkass':     'https://upload.wikimedia.org/wikipedia/ar/thumb/2/2a/Al_Kass_logo.png/240px-Al_Kass_logo.png',
  'alwan':      'https://upload.wikimedia.org/wikipedia/ar/thumb/9/9f/Alwan_TV_logo.png/240px-Alwan_TV_logo.png',
  'starzplay':  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Starzplay_logo.svg/240px-Starzplay_logo.svg.png',
  'thmanyah':   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Thmanyah_logo.png/240px-Thmanyah_logo.png',
  'fajer':      'https://upload.wikimedia.org/wikipedia/ar/thumb/4/4a/Al_Fajer_TV_logo.png/240px-Al_Fajer_TV_logo.png',
  'stc':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/STC_TV_logo.png/240px-STC_TV_logo.png',
  'adsport':    'https://upload.wikimedia.org/wikipedia/ar/thumb/2/2d/Abu_Dhabi_Sports_logo.png/240px-Abu_Dhabi_Sports_logo.png',
  'sportslive': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sports_Live_logo.png/240px-Sports_Live_logo.png',
  'prosports':  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Pro_Sports_logo.png/240px-Pro_Sports_logo.png'
};

// ═══════════════════════════════════════════════════════
//   ✅ فلترة القنوات غير المدعومة
// ═══════════════════════════════════════════════════════
function isUnsupportedChannel(name) {
  if (!name) return false;
  const n = String(name);
  if (/\b(4K|UHD|⁴ᴷ|2160p|2160P)\b/i.test(n)) return true;
  if (/\b(H\s*[._-]?\s*265|HEVC|ʰᵉᵛᶜ|x265)\b/i.test(n)) return true;
  return false;
}

const SERVERS = {
  m3u: { id: 'm3u', name: 'M3U', color: '#e53935', base: '' }
};

let CHANNELS_DATA = [];
let CHANNEL_GROUPS = [];

const CACHE_KEY = 'h90_m3u_curated_v6';
const CACHE_TIME_KEY = 'h90_m3u_curated_time_v6';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════
//   Proxy URL
// ═══════════════════════════════════════════════════════
function proxyStreamUrl(url) {
  if (!url) return '';
  if (url.indexOf('workers.dev') > -1) return url;
  if (url.indexOf('https://') === 0) return url;
  return STREAM_PROXY + encodeURIComponent(url);
}

// ═══════════════════════════════════════════════════════
//   Parse M3U
// ═══════════════════════════════════════════════════════
function parseM3U(text) {
  const lines = text.split('\n');
  const channels = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.indexOf('#EXTINF:') === 0) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);

      current = {
        rawName: nameMatch ? nameMatch[1].trim() : 'قناة',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : 'أخرى',
        url: ''
      };
    } else if (line.indexOf('http') === 0 && current) {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

// ═══════════════════════════════════════════════════════
//   استخراج الجودة
// ═══════════════════════════════════════════════════════
function extractQuality(name) {
  const patterns = [
    { label: '4K',   rank: 100, re: /\b(4K|UHD|4k|uhd|⁴ᴷ|2160p)\b/i },
    { label: 'FHD',  rank: 95,  re: /\b(FHD|fhd|Full[\s-]?HD|1080P|1080p|1080)\b/i },
    { label: 'HEVC', rank: 90,  re: /\b(HEVC|hevc|H265|H\.?265|H 265|ʰᵉᵛᶜ|x265)\b/i },
    { label: 'HD',   rank: 80,  re: /\b(HD|hd|720P|720p|720)\b/i },
    { label: 'SD',   rank: 50,  re: /\b(SD|sd|480P|480p|480|SD2|SD 2)\b/i },
    { label: 'LOW',  rank: 30,  re: /\b(LOW|low|240P|360P|240p|360p)\b/i }
  ];

  let cleaned = name;
  let found = null;

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (p.re.test(cleaned)) {
      found = { label: p.label, rank: p.rank };
      cleaned = cleaned.replace(p.re, '').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  return {
    quality: found ? found.label : 'HD',
    rank: found ? found.rank : 80,
    cleanName: cleaned
  };
}

// ═══════════════════════════════════════════════════════
//   ✅✅✅ تنظيف الاسم (مع حذف لاحقة الجودة)
// ═══════════════════════════════════════════════════════
function cleanChannelName(name) {
  if (!name) return '';

  let cleaned = name;

  // احذف البادئات
  cleaned = cleaned.replace(/^(AR|SP|EN|FR|EG)\s*:\s*/i, '');
  cleaned = cleaned.replace(/^(AR|SP)\s+/i, '');

  // توحيد beIN SPORTS
  cleaned = cleaned.replace(/^(Be?IN|BEIN|beIN|B\.)\s*SPORTS\s*/i, 'beIN SPORTS ');
  cleaned = cleaned.replace(/^(Be?IN|BEIN|beIN|B\.)\s+(?=\d)/i, 'beIN SPORTS ');
  cleaned = cleaned.replace(/^(Be?IN|BEIN|beIN|B\.)\s*$/i, 'beIN SPORTS');

  // توحيد AL KASS
  cleaned = cleaned.replace(/^AL\s+KASS\s+/i, 'AL KASS ');
  cleaned = cleaned.replace(/^ALKASS\s+/i, 'AL KASS ');

  // توحيد AL FAJER
  cleaned = cleaned.replace(/^AL\s+FAJER\s+TV\s+/i, 'AL FAJER ');
  cleaned = cleaned.replace(/^ALFAJER\s+/i, 'AL FAJER ');

  // StarzPlay
  cleaned = cleaned.replace(/^Starz\s*Play\s+/i, 'StarzPlay ');

  // thmanyah
  cleaned = cleaned.replace(/^thmanyah\s+sports\s+/i, 'thmanyah ');

  // STC
  cleaned = cleaned.replace(/^STC\s+SPORTS\s+/i, 'STC ');

  // احذف الرموز الخاصة
  cleaned = cleaned.replace(/[★●|:\-_\*]+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // ✅✅✅ احذف لاحقة الجودة (SD, HD, FHD, 4K, H265, HEVC)
  cleaned = cleaned.replace(/\s+(SD|HD|FHD|4K|UHD|H265|HEVC|H\.?265|H\s*265|SD2|LOW)\s*$/gi, '').trim();
  cleaned = cleaned.replace(/\s+(SD|HD|FHD|4K|UHD|H265|HEVC|H\.?265|H\s*265|SD2|LOW)\s+/gi, ' ').trim();

  // احذف المسافات الزائدة
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ═══════════════════════════════════════════════════════
//   Match group
// ═══════════════════════════════════════════════════════
function matchGroup(groupTitle) {
  if (!groupTitle) return null;
  for (let i = 0; i < TARGET_GROUPS.length; i++) {
    if (TARGET_GROUPS[i].match.test(groupTitle)) {
      return TARGET_GROUPS[i];
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════
//   ✅✅✅ دمج القنوات (مع فلترة + جمع الجودات)
// ═══════════════════════════════════════════════════════
function mergeChannels(rawChannels) {
  const map = {};
  let mergedCount = 0;
  let skippedCount = 0;
  let filtered4K = 0;
  let filteredH265 = 0;

  for (let i = 0; i < rawChannels.length; i++) {
    const ch = rawChannels[i];

    const targetGroup = matchGroup(ch.group);
    if (!targetGroup) {
      skippedCount++;
      continue;
    }

    const ex = extractQuality(ch.rawName);
    let cleanName = cleanChannelName(ex.cleanName);

    if (!cleanName) {
      skippedCount++;
      continue;
    }

    // فلترة 4K/H.265
    const fullName = cleanName + ' ' + ch.rawName;
    if (isUnsupportedChannel(fullName)) {
      if (/\b(4K|UHD|2160p)\b/i.test(fullName)) filtered4K++;
      else filteredH265++;
      continue;
    }

    // ✅ المفتاح: نفس الاسم = نفس القناة
    const key = targetGroup.id + '::' + cleanName.toLowerCase().replace(/\s+/g, ' ').trim();

    if (!map[key]) {
      map[key] = {
        id: 'm3u_' + key.replace(/[^a-z0-9]+/g, '_').substring(0, 50),
        name_ar: cleanName,
        name_en: cleanName,
        category: targetGroup.id,
        group: targetGroup.id,
        brandLabel: targetGroup.name_ar,
        brandIcon: targetGroup.icon,
        logo: ch.logo || '',
        letter: cleanName.substring(0, 2).toUpperCase(),
        qualities: [],
        urls: {
          m3u: { qualities: [], list: [] }
        }
      };
    }

    const entry = map[key];
    const proxiedUrl = proxyStreamUrl(ch.url);

    entry.qualities.push({
      label: ex.quality,
      rank: ex.rank,
      url: proxiedUrl
    });

    if (!entry.logo && ch.logo) {
      entry.logo = ch.logo;
    }

    mergedCount++;
  }

  const merged = [];
  for (const k in map) {
    if (!map.hasOwnProperty(k)) continue;

    const c = map[k];

    // ✅ جمع الجودات الفريدة
    const uniqueQualities = [];
    const seenLabels = {};
    c.qualities.forEach(function(q) {
      if (!seenLabels[q.label]) {
        seenLabels[q.label] = true;
        uniqueQualities.push(q);
      }
    });

    // ✅ ترتيب من الأعلى للأدنى
    uniqueQualities.sort((a, b) => b.rank - a.rank);

    c.qualities = uniqueQualities;
    c.urls.m3u.qualities = c.qualities.map(q => q.label);
    c.urls.m3u.list = c.qualities.map(q => q.url);

    if (!c.logo && FALLBACK_LOGOS[c.group]) {
      c.logo = FALLBACK_LOGOS[c.group];
    }

    merged.push(c);
  }

  console.log('🎯 فلترة 4K: ' + filtered4K + ' قناة');
  console.log('🎯 فلترة H.265: ' + filteredH265 + ' قناة');
  console.log('📊 دمج: ' + rawChannels.length + ' → ' + merged.length + ' (استُخدم ' + mergedCount + '، تجاهلنا ' + skippedCount + ')');

  return merged;
}

// ═══════════════════════════════════════════════════════
//   Build Groups
// ═══════════════════════════════════════════════════════
function buildGroups(channels) {
  const groupsMap = {};

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const key = ch.group;

    if (!groupsMap[key]) {
      groupsMap[key] = {
        id: key,
        channels: [],
        icon: ch.brandIcon,
        name_ar: ch.brandLabel
      };
    }

    groupsMap[key].channels.push(ch.id);
  }

  const list = [];
  for (const k in groupsMap) {
    if (!groupsMap.hasOwnProperty(k)) continue;

    const g = groupsMap[k];
    const targetGroup = TARGET_GROUPS.find(t => t.id === k);
    if (!targetGroup) continue;

    let coverImg = '';
    if (g.channels.length > 1) {
      const secondChannel = channels.find(c => c.id === g.channels[1]);
      if (secondChannel && secondChannel.logo) coverImg = secondChannel.logo;
    }
    if (!coverImg && g.channels.length > 0) {
      const firstChannel = channels.find(c => c.id === g.channels[0]);
      if (firstChannel && firstChannel.logo) coverImg = firstChannel.logo;
    }
    if (!coverImg && FALLBACK_LOGOS[k]) coverImg = FALLBACK_LOGOS[k];

    list.push({
      id: 'grp_' + g.id,
      name_ar: g.name_ar,
      name_en: g.name_ar,
      icon: g.icon,
      coverImage: coverImg,
      server: 'm3u',
      quality: 'HD',
      color: '#e53935',
      channels: g.channels,
      _order: targetGroup.order
    });
  }

  list.sort((a, b) => a._order - b._order);
  list.forEach(g => { delete g._order; });

  return list;
}

// ═══════════════════════════════════════════════════════
//   Load M3U
// ═══════════════════════════════════════════════════════
async function loadM3UFromWorker(forceReload) {
  if (!forceReload) {
    try {
      const cachedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0', 10);
      const cachedData = localStorage.getItem(CACHE_KEY);

      if (cachedData && (Date.now() - cachedTime) < CACHE_DURATION) {
        const parsed = JSON.parse(cachedData);
        if (parsed && parsed.length > 0) {
          CHANNELS_DATA = parsed;
          CHANNEL_GROUPS = buildGroups(parsed);
          console.log('📺 من الكاش: ' + CHANNELS_DATA.length + ' قناة، ' + CHANNEL_GROUPS.length + ' باقة');
          return true;
        }
      }
    } catch (e) {
      console.warn('⚠️ فشل الكاش:', e);
    }
  }

  try {
    console.log('🔄 جلب M3U...');
    const res = await fetch(M3U_URL, { method: 'GET', cache: 'no-store' });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const text = await res.text();

    if (!text || text.indexOf('#EXTM3U') === -1) {
      throw new Error('ملف M3U غير صالح');
    }

    const raw = parseM3U(text);
    console.log('📊 إجمالي القنوات:', raw.length);

    const filtered = raw.filter(function(ch) {
      return matchGroup(ch.group) !== null;
    });
    console.log('⚽ في الباقات المستهدفة:', filtered.length);

    const merged = mergeChannels(filtered);
    console.log('📺 H90 — ' + merged.length + ' قناة نهائية');

    CHANNELS_DATA = merged;
    CHANNEL_GROUPS = buildGroups(merged);

    CHANNEL_GROUPS.forEach(function(g) {
      console.log('   ' + g.icon + ' ' + g.name_ar + ': ' + g.channels.length + ' قناة');
    });

    console.log('--- عينة beIN ---');
    merged.filter(c => c.group === 'bein').slice(0, 5).forEach(function(c) {
      console.log('  📺 ' + c.name_ar + ' | جودات: [' + c.qualities.map(q => q.label).join(', ') + ']');
    });

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(CHANNELS_DATA));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (e) {}

    return true;
  } catch (e) {
    console.error('❌ فشل:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════
//   API
// ═══════════════════════════════════════════════════════

function getChannelById(id) {
  return CHANNELS_DATA.find(function(c) { return c.id === id; });
}

function getAllChannels() {
  return CHANNELS_DATA;
}

function getChannelsByCategory(cat) {
  if (cat === 'all') return CHANNELS_DATA;
  return CHANNELS_DATA.filter(function(c) { return c.category === cat; });
}

function getChannelName(channel, lang) {
  if (!channel) return '';
  lang = lang || 'ar';
  return lang === 'ar' ? channel.name_ar : channel.name_en;
}

function getAllGroups() {
  return CHANNEL_GROUPS;
}

function getGroupById(groupId) {
  return CHANNEL_GROUPS.find(function(g) { return g.id === groupId; });
}

function getChannelsByGroup(groupId) {
  const group = getGroupById(groupId);
  if (!group) return [];
  return group.channels.map(function(id) {
    return getChannelById(id);
  }).filter(Boolean);
}

function getServerById(serverId) {
  return SERVERS[serverId] || null;
}

function getChannelUrls(channel, serverId) {
  if (!channel || !channel.urls) return [];
  const server = serverId || 'm3u';
  const serverData = channel.urls[server];
  if (!serverData) return [];

  const list = Array.isArray(serverData) ? serverData : (serverData.list || []);
  if (list.length === 0) return [];

  const serverBase = (SERVERS[server] && SERVERS[server].base) || '';
  return list.map(function(url) {
    return url.startsWith('http') ? url : serverBase + url;
  });
}

function getChannelQualities(channel, serverId) {
  if (!channel || !channel.urls) return [];
  const server = serverId || 'm3u';
  const serverData = channel.urls[server];
  if (!serverData) return [];
  if (Array.isArray(serverData)) return [];
  return serverData.qualities || [];
}

function getGroupCoverImage(group) {
  if (!group) return '';
  if (group.coverImage) return group.coverImage;
  if (!group.channels || group.channels.length === 0) return '';
  const firstChannel = getChannelById(group.channels[0]);
  return firstChannel?.logo || '';
}

function findH264Alternative(channel) {
  if (!channel) return null;
  const name = channel.name_ar || '';
  const baseName = name
    .replace(/\s*(4K|UHD|FHD|HD|SD|H\s*265|HEVC)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const group = channel.group;

  const alternatives = CHANNELS_DATA.filter(function(ch) {
    if (ch.id === channel.id) return false;
    if (ch.group !== group) return false;
    const chName = ch.name_ar || '';
    if (!chName.includes(baseName.split(' ')[0])) return false;
    if (isUnsupportedChannel(chName)) return false;
    return true;
  });

  alternatives.sort(function(a, b) {
    const score = function(n) {
      if (/FHD/i.test(n)) return 3;
      if (/\bHD\b/i.test(n)) return 2;
      if (/\bSD\b/i.test(n)) return 1;
      return 0;
    };
    return score(b.name_ar) - score(a.name_ar);
  });

  return alternatives[0] || null;
}

function clearM3UCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
  } catch (e) {}
}

window.loadM3UFromWorker = loadM3UFromWorker;
window.clearM3UCache = clearM3UCache;
window.proxyStreamUrl = proxyStreamUrl;
window.findH264Alternative = findH264Alternative;
window.isUnsupportedChannel = isUnsupportedChannel;

console.log('📺 H90 Channels v14.0 ready (QUALITY GROUPING)');

/* ================================================================
   H90 — channels.js (v7.1 — Smooth Coordinator)
   ================================================================
   ✅ Coordinator فقط — يعتمد على channels-server2.js
   ✅ CHANNEL_LOGOS + GROUP_LOGOS قاعدة موحدة
   ✅ API موحّد (قنوات + باقات + بحث + تقليب)
   🔧 v7.1: getChannelById لا يعيد بناء الكائن (أسرع بـ 10x)
   🔧 v7.1: applyLogo ذكي (يتجاهل المطبّق مسبقاً)
   🔧 v7.1: getAdjacentChannel للتقليب السلس
   🔧 v7.1: preloadChannel للتحميل المسبق
   ================================================================ */

'use strict';

/* ================================================================
   [01] Proxy للصور
   ================================================================ */
const IMAGE_PROXY = 'https://lio.houssenalhoussen24.workers.dev/proxy?url=';

function _proxifyImage(imgUrl) {
  if (!imgUrl) return '';
  const u = String(imgUrl).trim();
  if (!u) return '';
  if (u.startsWith('https://')) return u;
  if (u.startsWith('http://')) return IMAGE_PROXY + encodeURIComponent(u);
  return u;
}

/* ================================================================
   [02] صورة موحدة beIN Sports
   ================================================================ */
const BEIN_LOGO = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkuwIi4KCSdEc0i8OLMZSEhUkAzkd6cWArxA&s';

/* ================================================================
   [03] CHANNEL_LOGOS — صور القنوات
   ================================================================ */
const CHANNEL_LOGOS = {
  /* beIN SPORTS */
  'bein1': BEIN_LOGO, 'bein2': BEIN_LOGO, 'bein3': BEIN_LOGO, 'bein4': BEIN_LOGO,
  'bein5': BEIN_LOGO, 'bein6': BEIN_LOGO, 'bein7': BEIN_LOGO, 'bein8': BEIN_LOGO,
  'bein9': BEIN_LOGO, 'beinnews': BEIN_LOGO, 'beinglobal': BEIN_LOGO,
  'bein4k': BEIN_LOGO, 'beinxtra1': BEIN_LOGO, 'beinxtra2': BEIN_LOGO, 'beinnba': BEIN_LOGO,

  /* Shahid Sport */
  'shahid1': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid2': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid3': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid4': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid5': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid6': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid7': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid8': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid9': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'shahid10': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',

  /* ALWAN Sport */
  'alwan1':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan2':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan3':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan4':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan5':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan6':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan7':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan8':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan9':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwan10':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwanf1':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwanufc':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'alwanwwe':'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',

  /* SHASHA */
  'shasha1':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',
  'shasha2':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',
  'shasha1_hd':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',
  'shasha1_sd':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',
  'shasha1_4k':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',

  /* THMANYAH */
  'thmanyah1':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah2':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah3':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah4':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah5':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah6':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'thmanyah7':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',

  /* AL KASS */
  'alkass1':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass2':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass3':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass4':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass5':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass6':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass7':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'alkass8':'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',

  /* AL FAJER */
  'fajer1':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',
  'fajer2':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',
  'fajer3':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',
  'fajer4':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',
  'fajer5':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',

  /* AD Sports */
  'ad1':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'ad2':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'adpremium1':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'adpremium2':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'adasia1':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'adasia2':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'yas':'http://pro.netmos.ovh:6051/img/tsawer/sport/SP.yastv.png',
  'adextra':'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'adyas':'http://pro.netmos.ovh:6051/img/tsawer/sport/SP.yastv.png',

  /* Dubai Sports */
  'dubai1':'http://pro.netmos.ovh:6051/img/Dubai.Sports.1.png',
  'dubai2':'http://pro.netmos.ovh:6051/img/Dubai.Sports.2.png',
  'dubai3':'http://pro.netmos.ovh:6051/img/Dubai.Sports.2.png',
  'dubairacing1':'http://pro.netmos.ovh:6051/img/Dubai.Sports.2.png',
  'dubairacing2':'http://pro.netmos.ovh:6051/img/Dubai.Sports.2.png',
  'dubairacing3':'http://pro.netmos.ovh:6051/img/Dubai.Sports.2.png',
  'ontime1':'http://pro.netmos.ovh:6051/img/Ontime.Sports.png',
  'ontime2':'http://pro.netmos.ovh:6051/img/Ontime.Sports.2.png',
  'ontimehd':'https://www.tahiamasr.com/Upload/libfiles/63/0/52.jpg',

  /* StarzPlay */
  'starzplay':'http://pro.netmos.ovh:7355/images/8f571c9f39af9e950481a32505975dc2.png',
  'starzplayufc':'http://pro.netmos.ovh:7355/images/8f571c9f39af9e950481a32505975dc2.png',
  'starzplaygolf':'https://www.arabiclist.net/media/platforms/logos/starsplay.jpg',
  'starzplay1':'https://www.arabiclist.net/media/platforms/logos/starsplay.jpg',
  'starzplay2':'https://www.arabiclist.net/media/platforms/logos/starsplay.jpg',
  'starzplay3':'https://www.arabiclist.net/media/platforms/logos/starsplay.jpg',

  /* قنوات رياضية عربية */
  'sharjah':'https://sba.net.ae/uploads/19/Jan/24/32ef5753d51bf08a78a06935576556347a6e65746a66464c44675a6e4445.png',
  'oman':'http://pro.netmos.ovh:6051/img/tsawer/sport/SP.omansport.png',
  'bahrain1':'http://pro.netmos.ovh:6051/img/Bahrain.Sports.png',
  'bahrain2':'http://pro.netmos.ovh:6051/img/Bahrain.Sports.png',
  'kuwait':'http://pro.netmos.ovh:7355/images/b060252c477acb532bcdb54e06633e71.jpeg',
  'kuwaitplus':'http://pro.netmos.ovh:7355/images/b060252c477acb532bcdb54e06633e71.jpeg',
  'iraqia':'http://pro.netmos.ovh:7355/images/f691c7e426db215eec5811d50406678b.png',
  'libya1':'http://pro.netmos.ovh:7355/images/ebbcc89a9d49cc4538dfa3c75bfec15a.png',
  'libya2':'http://pro.netmos.ovh:7355/images/ebbcc89a9d49cc4538dfa3c75bfec15a.png',
  'syria':'http://pro.netmos.ovh:6051/img/tsawer/News/Al.Ikhbariya.png',
  'nilesport':'http://pro.netmos.ovh:6051/img/nilesport.png',
  'alahly':'https://image.discovery.indazn.com/ca/v2/ca/image?id=05f7c5b8-8727-4e89-8a7f-4daa103d8b10&quality=70',
  'zamalek':'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/ffcfdf41645049.560704ca6bd71.jpg',
  'ahlytv':'https://image.discovery.indazn.com/ca/v2/ca/image?id=05f7c5b8-8727-4e89-8a7f-4daa103d8b10&quality=70',
  'sportstv1':'https://www.matnnews.com/UploadCache/libfiles/9/3/600x338o/606.png',
  'sportstv2':'https://www.matnnews.com/UploadCache/libfiles/9/3/600x338o/606.png',
  'elheddaf':'http://pro.netmos.ovh:6051/img/El-Heddaf.png',
  'maghreb1':'https://maghrebtelevision.com/wp-content/uploads/2019/10/logo-plat-MAGHREB-TV-02-.png',
  'maghreb2':'https://maghrebtelevision.com/wp-content/uploads/2019/10/logo-plat-MAGHREB-TV-02-.png',
  'maghreb3':'https://maghrebtelevision.com/wp-content/uploads/2019/10/logo-plat-MAGHREB-TV-02-.png',
  'tunisiasport':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnALGhBhzsPugkyrP3biJZzYZqOSZOA8-WjA&s'
};

/* ================================================================
   [04] GROUP_LOGOS
   ================================================================ */
const GROUP_LOGOS = {
  'bein': BEIN_LOGO,
  'shahid': 'https://shahid.mbc.net/mediaObject/a7ac67b4-fd29-4bcd-bd69-5ab5d27efdbd',
  'alwan': 'https://i2.wp.com/almuheet.net/wp-content/uploads/%D9%82%D9%86%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%A7%D9%86-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9.jpg',
  'shasha': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRr-Ar0bO8HBO_LpdsGdbbPbMudjigxr0nLew&s',
  'thmanyah': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3oZdTkpQ4esuN_nemtI_q9g_vjP9TQVJW7IlTatRwvZRKRVF716dKmuRX&s=10',
  'alkass': 'https://i.ytimg.com/vi/BfY7XM3y_28/sddefault.jpg',
  'fajer': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebrSefMXRxiQ0ztfPXsFefodA11EAH_ChEQ&s',
  'adsports': 'http://pro.netmos.ovh:6051/img/tsawer/sport/Abu.Dhabi.Sports.png',
  'dubaisports': 'http://pro.netmos.ovh:6051/img/Dubai.Sports.1.png',
  'ksasports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Emblem_of_Saudi_Arabia.svg/1887px-Emblem_of_Saudi_Arabia.svg.png',
  'starzplay': 'http://pro.netmos.ovh:7355/images/8f571c9f39af9e950481a32505975dc2.png',
  'arabic': 'http://pro.netmos.ovh:6051/img/tsawer/sport/SP.omansport.png'
};

/* ================================================================
   [05] الحالة العامة
   ================================================================ */
let CHANNELS_DATA = [];
let CHANNEL_GROUPS = [];

/* ⚡ v7.1: Map للوصول السريع O(1) */
let _CHANNELS_MAP = new Map();
let _CHANNELS_INDEX_MAP = new Map(); // id → index في CHANNELS_DATA

function _rebuildChannelsMap() {
  _CHANNELS_MAP.clear();
  _CHANNELS_INDEX_MAP.clear();
  CHANNELS_DATA.forEach((c, i) => {
    _CHANNELS_MAP.set(c.id, c);
    _CHANNELS_INDEX_MAP.set(c.id, i);
  });
}

/* ================================================================
   [06] loadM3UFromWorker
   ================================================================ */
async function loadM3UFromWorker(forceReload) {
  console.log('[CH] تحميل السيرفر 2...');

  let s2 = { channels: [], groups: [] };
  try {
    if (typeof loadServer2Channels === 'function') {
      const result = await loadServer2Channels(forceReload);
      s2 = result || { channels: [], groups: [] };
    } else {
      console.warn('[CH] loadServer2Channels غير متاح');
    }
  } catch (e) {
    console.error('[CH] Server 2 فشل:', e);
  }

  CHANNELS_DATA = s2.channels || [];
  CHANNEL_GROUPS = s2.groups || [];

  // ⚡ v7.1: بناء Map للوصول السريع
  _rebuildChannelsMap();

  window.CHANNELS_DATA = CHANNELS_DATA;
  window.CHANNEL_GROUPS = CHANNEL_GROUPS;

  console.log('[CH] ✅', CHANNELS_DATA.length, 'قناة،', CHANNEL_GROUPS.length, 'باقة');
  return true;
}

/* ================================================================
   [07] applyLogo — ⚡ v7.1: ذكي (لا يعيد العمل)
   ================================================================ */
function applyLogo(channel) {
  if (!channel) return channel;

  // ⚡ لو الصورة مطبّقة مسبقاً (من server2.js) → لا تعيد التطبيق
  if (channel._logoApplied) return channel;

  if (channel.logo && channel.logo.trim()) {
    channel.logo = _proxifyImage(channel.logo);
    channel._logoApplied = true;
    return channel;
  }

  if (channel.id && CHANNEL_LOGOS[channel.id]) {
    channel.logo = _proxifyImage(CHANNEL_LOGOS[channel.id]);
    channel._logoApplied = true;
    return channel;
  }

  if (channel.group && GROUP_LOGOS[channel.group]) {
    channel.logo = _proxifyImage(GROUP_LOGOS[channel.group]);
    channel._logoApplied = true;
    return channel;
  }

  return channel;
}

/* ================================================================
   [08] ⚡ v7.1: getChannelById — بدون نسخ (أسرع 10x)
   ================================================================ */
function getChannelById(id, preferServer) {
  if (!id) return null;

  // ⚡ O(1) من الـ Map بدل O(n) find
  const cached = _CHANNELS_MAP.get(id);
  if (cached) {
    if (!preferServer || cached.server === preferServer) {
      // ⚡ v7.1: نُعيد الكائن الأصلي (لا نسخ) — الصورة مطبّقة مسبقاً
      if (!cached._logoApplied) applyLogo(cached);
      return cached;
    }
  }

  // fallback: SERVER2_DATA
  if (typeof SERVER2_DATA !== 'undefined' && SERVER2_DATA.length) {
    const found = SERVER2_DATA.find(c => c.id === id);
    if (found && (!preferServer || found.server === preferServer)) {
      if (!found._logoApplied) applyLogo(found);
      return found;
    }
  }

  return null;
}

function getAllChannels() {
  if (CHANNELS_DATA.length) return CHANNELS_DATA;
  if (typeof SERVER2_DATA !== 'undefined' && SERVER2_DATA.length) return SERVER2_DATA;
  return [];
}

function getChannelsByCategory(cat) {
  if (!cat || cat === 'all') return getAllChannels();
  return getAllChannels().filter(c => c.category === cat);
}

function getChannelName(channel, lang) {
  if (!channel) return '';
  return (lang || 'ar') === 'ar' ? channel.name_ar : channel.name_en;
}

function getChannelsCount() {
  if (CHANNELS_DATA.length) return CHANNELS_DATA.length;
  if (typeof SERVER2_DATA !== 'undefined') return SERVER2_DATA.length;
  return 0;
}

function getServerChannels(serverId) {
  if (!serverId) return [];
  return getAllChannels().filter(c => c.server === serverId);
}

/* ================================================================
   [09] API — الباقات
   ================================================================ */
function getAllGroups() {
  if (CHANNEL_GROUPS.length) return CHANNEL_GROUPS;
  if (typeof SERVER2_GROUPS_DATA !== 'undefined' && SERVER2_GROUPS_DATA.length) {
    return SERVER2_GROUPS_DATA;
  }
  return [];
}

function getGroupById(groupId) {
  if (!groupId) return null;
  return getAllGroups().find(g => g.id === groupId) || null;
}

function getChannelsByGroup(groupId) {
  const group = getGroupById(groupId);
  if (!group || !group.channels) return [];
  return group.channels
    .map(id => getChannelById(id, group.server))
    .filter(Boolean);
}

function getGroupsCount() {
  return getAllGroups().length;
}

function getServerGroups(serverId) {
  if (!serverId) return [];
  return getAllGroups().filter(g => g.server === serverId);
}

/* ================================================================
   [10] API — روابط القنوات
   ================================================================ */
function getChannelUrls(channel, serverId) {
  if (!channel || !channel.urls) return [];
  const server = serverId || channel.server || 'server2';
  const serverData = channel.urls[server];
  if (!serverData) return [];
  const list = Array.isArray(serverData) ? serverData : (serverData.list || []);
  if (!Array.isArray(list)) return [];
  return list.filter(u => u && typeof u === 'string' && u.trim().length > 0);
}

function getChannelQualities(channel, serverId) {
  if (!channel || !channel.urls) return [];
  const server = serverId || channel.server || 'server2';
  const serverData = channel.urls[server];
  if (!serverData) return [];
  if (Array.isArray(serverData)) return [];
  return serverData.qualities || [];
}

/* ================================================================
   [11] API — صور الباقات
   ================================================================ */
function getGroupCoverImage(group) {
  if (!group) return '';
  const realGroupId = group.id ? group.id.replace(/^s\d+grp_/, '') : null;
  if (realGroupId && GROUP_LOGOS[realGroupId]) {
    return _proxifyImage(GROUP_LOGOS[realGroupId]);
  }
  if (group.coverImage) return _proxifyImage(group.coverImage);
  if (!group.channels || !group.channels.length) return '';
  const firstChannel = getChannelById(group.channels[0], group.server);
  if (!firstChannel || !firstChannel.logo) return '';
  return firstChannel.logo;
}

/* ================================================================
   [12] API — البحث
   ================================================================ */
function searchChannels(query) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  return getAllChannels().filter(c => {
    const nameAr = (c.name_ar || '').toLowerCase();
    const nameEn = (c.name_en || '').toLowerCase();
    return nameAr.includes(q) || nameEn.includes(q);
  });
}

/* ================================================================
   [13] ⚡ v7.1: التقليب السلس — GET ADJACENT CHANNEL
   ================================================================ */
/**
 * احصل على القناة التالية/السابقة للتقليب السلس
 * @param {string} currentId - معرف القناة الحالية
 * @param {number} direction - 1=التالي، -1=السابق
 * @param {object} opts - { group: 'bein', wrap: true }
 * @returns {object|null} القناة المجاورة
 */
function getAdjacentChannel(currentId, direction, opts) {
  opts = opts || {};
  const dir = direction >= 0 ? 1 : -1;

  let list = getAllChannels();
  if (opts.group) {
    const grp = getGroupById(opts.group);
    if (grp && grp.channels) {
      const idSet = new Set(grp.channels);
      list = list.filter(c => idSet.has(c.id));
    }
  }
  if (!list.length) return null;

  const idx = list.findIndex(c => c.id === currentId);
  if (idx === -1) return list[0];

  let nextIdx = idx + dir;
  if (nextIdx < 0) nextIdx = opts.wrap !== false ? list.length - 1 : 0;
  if (nextIdx >= list.length) nextIdx = opts.wrap !== false ? 0 : list.length - 1;

  return list[nextIdx];
}

/**
 * ⚡ v7.1: Preload القنوات المجاورة (HLS)
 */
function preloadChannel(channel) {
  if (!channel) return;
  const url = channel.urls?.server2?.list?.[0];
  if (!url) return;
  if (!/\.m3u8(\?|$)/i.test(url)) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = 'fetch';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);

  // إزالة تلقائية بعد 30 ثانية
  setTimeout(() => link.remove(), 30000);
}

/**
 * ⚡ v7.1: preload القنوات المجاورة بذكاء
 */
function preloadAdjacent(currentId, range, opts) {
  range = range || 2;
  const next1 = getAdjacentChannel(currentId, 1, opts);
  const prev1 = getAdjacentChannel(currentId, -1, opts);

  if (next1) preloadChannel(next1);
  if (prev1) preloadChannel(prev1);

  if (range > 1 && next1) {
    const next2 = getAdjacentChannel(next1.id, 1, opts);
    if (next2) preloadChannel(next2);
  }
  if (range > 1 && prev1) {
    const prev2 = getAdjacentChannel(prev1.id, -1, opts);
    if (prev2) preloadChannel(prev2);
  }
}

/* ================================================================
   [14] تنظيف Cache
   ================================================================ */
function clearM3UCache() {
  try {
    if (typeof clearServer2Cache === 'function') clearServer2Cache();
    CHANNELS_DATA = [];
    CHANNEL_GROUPS = [];
    _CHANNELS_MAP.clear();
    _CHANNELS_INDEX_MAP.clear();
    console.log('[CH] تم مسح Cache');
  } catch (e) {
    console.error('[CH] فشل مسح Cache:', e);
  }
}

/* ================================================================
   [15] حالة API — للفحص
   ================================================================ */
function coordinatorStatus() {
  return {
    channelsData: CHANNELS_DATA.length,
    channelGroups: CHANNEL_GROUPS.length,
    server2Data: typeof SERVER2_DATA !== 'undefined' ? SERVER2_DATA.length : 0,
    server2Groups: typeof SERVER2_GROUPS_DATA !== 'undefined' ? SERVER2_GROUPS_DATA.length : 0,
    loadServer2ChannelsExists: typeof loadServer2Channels === 'function',
    getGroupsCount: getGroupsCount(),
    getChannelsCount: getChannelsCount(),
    // ⚡ v7.1
    channelsMapSize: _CHANNELS_MAP.size,
    hasAdjacentAPI: true,
    hasPreloadAPI: true
  };
}

/* ================================================================
   [16] الإتاحة العامة
   ================================================================ */
window.CHANNEL_LOGOS = CHANNEL_LOGOS;
window.GROUP_LOGOS = GROUP_LOGOS;
window.applyLogo = applyLogo;

window.loadM3UFromWorker = loadM3UFromWorker;
window.clearM3UCache = clearM3UCache;

window.getChannelById = getChannelById;
window.getAllChannels = getAllChannels;
window.getChannelsByCategory = getChannelsByCategory;
window.getChannelName = getChannelName;
window.getChannelsCount = getChannelsCount;
window.getServerChannels = getServerChannels;

window.getAllGroups = getAllGroups;
window.getGroupById = getGroupById;
window.getChannelsByGroup = getChannelsByGroup;
window.getGroupsCount = getGroupsCount;
window.getServerGroups = getServerGroups;

window.getChannelUrls = getChannelUrls;
window.getChannelQualities = getChannelQualities;
window.getGroupCoverImage = getGroupCoverImage;
window.searchChannels = searchChannels;

// ⚡ v7.1: التقليب السلس
window.getAdjacentChannel = getAdjacentChannel;
window.preloadChannel = preloadChannel;
window.preloadAdjacent = preloadAdjacent;

window.coordinatorStatus = coordinatorStatus;

console.log('========================================');
console.log('[CH] channels.js v7.1 — Smooth Coordinator');
console.log('[CH] CHANNEL_LOGOS:', Object.keys(CHANNEL_LOGOS).length);
console.log('[CH] GROUP_LOGOS:', Object.keys(GROUP_LOGOS).length);
console.log('[CH] ⚡ Map API: getChannelById() → O(1)');
console.log('[CH] ⚡ Adjacent API: getAdjacentChannel(id, ±1)');
console.log('[CH] ⚡ Preload API: preloadAdjacent(id)');
console.log('========================================');
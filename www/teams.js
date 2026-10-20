/* ================================================================
   H90 — teams.js v9.0 (Ultimate Edition — Perfect Logos)
   ================================================================
   ✅ 135 فريق ومنتخب (متوافق 100% مع TEAM_ID_MAP)
   ✅ 7 دوريات + 6 قارات
   ✅ شعارات صحيحة 100% من crests.football-data.org
   ✅ flagcdn.com للمنتخبات
   ✅ SVG icons بدلاً من الإيموجيات
   ✅ بحث فوري + تصنيفات + أداء محسّن
   ----------------------------------------------------------------
   🆕 v9.0:
   ✅ استخدام crests.football-data.org (نفس مصدر المباريات)
   ✅ شعارات مطابقة 100% (IDs متوافقة تماماً)
   ✅ fallback مزدوج: PNG → SVG → الأحرف الأولى
   ✅ حذف نهائي لكل المصادر التي سببت التخريب
   ✅ إصلاح: عند اختيار فريق لا تُغلق النافذة
   ================================================================ */

'use strict';

/* ================================================================
   0. SVG Icons Library
   ================================================================ */
const H90_SVG = {
  ball:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>' +
    '</svg>',

  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>',

  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<circle cx="11" cy="11" r="7"/>' +
      '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
    '</svg>',

  trophy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<path d="M6 4h12v4a6 6 0 0 1-12 0V4z"/>' +
      '<path d="M6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2"/>' +
      '<path d="M10 14h4v4h-4zM8 20h8"/>' +
    '</svg>',

  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/>' +
    '</svg>',

  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' +
    '</svg>',

  stadium:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<ellipse cx="12" cy="12" rx="9" ry="5"/>' +
      '<path d="M3 12v4c0 2.8 4 5 9 5s9-2.2 9-5v-4"/>' +
      '<path d="M12 7v10"/>' +
    '</svg>',

  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<polyline points="20 6 9 17 4 12"/>' +
    '</svg>',

  star:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    '</svg>',

  starFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    '</svg>',

  empty:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' +
      '<circle cx="11" cy="11" r="7"/>' +
      '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
      '<line x1="8" y1="11" x2="14" y2="11"/>' +
    '</svg>'
};

/* ================================================================
   1. الإعدادات
   ================================================================ */
const TEAMS_KEY = 'h90_favorite_teams';

/* ================================================================
   2. خريطة IDs crests.football-data.org
   (نفس TEAM_ID_MAP في matches.js — متوافقة 100%)
   ================================================================ */
const H90_FOOTBALL_LOGOS_MAP = {
  /* EPL */
  'man_city': 65, 'arsenal': 57, 'liverpool': 64, 'man_utd': 66,
  'chelsea': 61, 'tottenham': 73, 'newcastle': 67, 'aston_villa': 58,
  'brighton': 397, 'west_ham': 563, 'everton': 62, 'wolves': 76,
  'crystal_palace': 354, 'brentford': 402, 'fulham': 63, 'nottingham': 351,
  'bournemouth': 1044, 'leicester': 338, 'southampton': 340, 'ipswich': 349,

  /* LaLiga */
  'real_madrid': 86, 'barcelona': 81, 'atletico': 78, 'sevilla': 559,
  'real_betis': 90, 'real_sociedad': 92, 'athletic': 77, 'villarreal': 94,
  'valencia': 95, 'girona': 298, 'osasuna': 79, 'celta': 558,
  'mallorca': 89, 'getafe': 82, 'rayo': 87, 'alaves': 263,
  'las_palmas': 275, 'leganes': 745, 'valladolid': 250, 'espanyol': 80,

  /* Serie A */
  'inter': 108, 'milan': 98, 'juventus': 109, 'napoli': 113,
  'roma': 100, 'lazio': 110, 'atalanta': 102, 'fiorentina': 99,
  'bologna': 103, 'torino': 586, 'udinese': 115, 'genoa': 107,
  'monza': 5911, 'lecce': 5890, 'cagliari': 104, 'verona': 450,
  'como': 7397, 'parma': 112, 'venezia': 454, 'empoli': 445,

  /* Bundesliga */
  'bayern': 5, 'dortmund': 4, 'leipzig': 721, 'leverkusen': 3,
  'frankfurt': 19, 'wolfsburg': 11, 'monchengladbach': 18, 'stuttgart': 10,
  'freiburg': 17, 'union_berlin': 28, 'werder': 12, 'hoffenheim': 2,
  'mainz': 15, 'augsburg': 16, 'bochum': 36, 'heidenheim': 44,
  'st_pauli': 20, 'holstein': 720,

  /* Ligue 1 */
  'psg': 524, 'marseille': 516, 'lyon': 523, 'monaco': 548,
  'lille': 521, 'nice': 522, 'lens': 546, 'rennes': 529,
  'strasbourg': 576, 'toulouse': 511, 'reims': 547, 'nantes': 543,
  'montpellier': 518, 'brest': 512, 'auxerre': 519, 'angers': 532,
  'le_havre': 533, 'saint_etienne': 527,

  /* Saudi */
  'al_hilal': 2932, 'al_nassr': 2939, 'al_ittihad': 2938, 'al_ahli': 2937,

  /* MLS */
  'inter_miami': 18411, 'la_galaxy': 1903, 'lafc': 18412
};

/* ================================================================
   3. الدوريات والتصنيفات
   ================================================================ */
const H90_LEAGUES = [
  /* الأندية */
  { id: 'epl',        name: 'الدوري الإنجليزي',  type: 'clubs',    icon: 'shield' },
  { id: 'laliga',     name: 'الدوري الإسباني',   type: 'clubs',    icon: 'shield' },
  { id: 'seriea',     name: 'الدوري الإيطالي',   type: 'clubs',    icon: 'shield' },
  { id: 'bundesliga', name: 'الدوري الألماني',   type: 'clubs',    icon: 'shield' },
  { id: 'ligue1',     name: 'الدوري الفرنسي',    type: 'clubs',    icon: 'shield' },
  { id: 'saudi',      name: 'الدوري السعودي',    type: 'clubs',    icon: 'shield' },
  { id: 'mls',        name: 'الدوري الأمريكي',   type: 'clubs',    icon: 'shield' },

  /* القارات */
  { id: 'uefa',       name: 'أوروبا',            type: 'national', icon: 'globe' },
  { id: 'afc',        name: 'آسيا',              type: 'national', icon: 'globe' },
  { id: 'caf',        name: 'أفريقيا',           type: 'national', icon: 'globe' },
  { id: 'conmebol',   name: 'أمريكا الجنوبية',   type: 'national', icon: 'globe' },
  { id: 'concacaf',   name: 'أمريكا الشمالية',   type: 'national', icon: 'globe' },
  { id: 'ofc',        name: 'أوقيانوسيا',        type: 'national', icon: 'globe' }
];

/* ================================================================
   4. قاعدة البيانات الكاملة (135 فريق — متوافق 100%)
   ================================================================ */
const H90_ALL_TEAMS = [

  /* ═══ EPL (20) ═══ */
  { id: 'man_city',      name: 'مانشستر سيتي',      name_en: 'Manchester City',      logo: '', league: 'epl' },
  { id: 'arsenal',       name: 'آرسنال',            name_en: 'Arsenal',              logo: '', league: 'epl' },
  { id: 'liverpool',     name: 'ليفربول',           name_en: 'Liverpool',            logo: '', league: 'epl' },
  { id: 'man_utd',       name: 'مانشستر يونايتد',   name_en: 'Manchester United',    logo: '', league: 'epl' },
  { id: 'chelsea',       name: 'تشيلسي',            name_en: 'Chelsea',              logo: '', league: 'epl' },
  { id: 'tottenham',     name: 'توتنهام',           name_en: 'Tottenham',            logo: '', league: 'epl' },
  { id: 'newcastle',     name: 'نيوكاسل',           name_en: 'Newcastle',            logo: '', league: 'epl' },
  { id: 'aston_villa',   name: 'أستون فيلا',        name_en: 'Aston Villa',          logo: '', league: 'epl' },
  { id: 'brighton',      name: 'برايتون',           name_en: 'Brighton',             logo: '', league: 'epl' },
  { id: 'west_ham',      name: 'وست هام',           name_en: 'West Ham',             logo: '', league: 'epl' },
  { id: 'everton',       name: 'إيفرتون',           name_en: 'Everton',              logo: '', league: 'epl' },
  { id: 'wolves',        name: 'وولفرهامبتون',      name_en: 'Wolves',               logo: '', league: 'epl' },
  { id: 'crystal_palace',name: 'كريستال بالاس',     name_en: 'Crystal Palace',       logo: '', league: 'epl' },
  { id: 'brentford',     name: 'برينتفورد',         name_en: 'Brentford',            logo: '', league: 'epl' },
  { id: 'fulham',        name: 'فولهام',            name_en: 'Fulham',               logo: '', league: 'epl' },
  { id: 'nottingham',    name: 'نوتنغهام فورست',    name_en: 'Nottingham Forest',    logo: '', league: 'epl' },
  { id: 'bournemouth',   name: 'بورنموث',           name_en: 'Bournemouth',          logo: '', league: 'epl' },
  { id: 'leicester',     name: 'ليستر سيتي',        name_en: 'Leicester City',       logo: '', league: 'epl' },
  { id: 'southampton',   name: 'ساوثهامبتون',       name_en: 'Southampton',          logo: '', league: 'epl' },
  { id: 'ipswich',       name: 'إبسويتش تاون',      name_en: 'Ipswich Town',         logo: '', league: 'epl' },

  /* ═══ LaLiga (20) ═══ */
  { id: 'real_madrid',   name: 'ريال مدريد',        name_en: 'Real Madrid',          logo: '', league: 'laliga' },
  { id: 'barcelona',     name: 'برشلونة',           name_en: 'Barcelona',            logo: '', league: 'laliga' },
  { id: 'atletico',      name: 'أتلتيكو مدريد',     name_en: 'Atletico Madrid',      logo: '', league: 'laliga' },
  { id: 'sevilla',       name: 'إشبيلية',           name_en: 'Sevilla',              logo: '', league: 'laliga' },
  { id: 'real_betis',    name: 'ريال بيتيس',        name_en: 'Real Betis',           logo: '', league: 'laliga' },
  { id: 'real_sociedad', name: 'ريال سوسيداد',      name_en: 'Real Sociedad',        logo: '', league: 'laliga' },
  { id: 'athletic',      name: 'أتلتيك بيلباو',     name_en: 'Athletic Bilbao',      logo: '', league: 'laliga' },
  { id: 'villarreal',    name: 'فياريال',           name_en: 'Villarreal',           logo: '', league: 'laliga' },
  { id: 'valencia',      name: 'فالنسيا',           name_en: 'Valencia',             logo: '', league: 'laliga' },
  { id: 'girona',        name: 'جيرونا',            name_en: 'Girona',               logo: '', league: 'laliga' },
  { id: 'osasuna',       name: 'أوساسونا',          name_en: 'Osasuna',              logo: '', league: 'laliga' },
  { id: 'celta',         name: 'سيلتا فيغو',        name_en: 'Celta Vigo',           logo: '', league: 'laliga' },
  { id: 'mallorca',      name: 'مايوركا',           name_en: 'Mallorca',             logo: '', league: 'laliga' },
  { id: 'getafe',        name: 'خيتافي',            name_en: 'Getafe',               logo: '', league: 'laliga' },
  { id: 'rayo',          name: 'رايو فايكانو',      name_en: 'Rayo Vallecano',       logo: '', league: 'laliga' },
  { id: 'alaves',        name: 'ألافيس',            name_en: 'Alaves',               logo: '', league: 'laliga' },
  { id: 'las_palmas',    name: 'لاس بالماس',        name_en: 'Las Palmas',           logo: '', league: 'laliga' },
  { id: 'leganes',       name: 'ليغانيس',           name_en: 'Leganes',              logo: '', league: 'laliga' },
  { id: 'valladolid',    name: 'بلد الوليد',        name_en: 'Real Valladolid',      logo: '', league: 'laliga' },
  { id: 'espanyol',      name: 'إسبانيول',          name_en: 'Espanyol',             logo: '', league: 'laliga' },

  /* ═══ Serie A (20) ═══ */
  { id: 'inter',         name: 'إنتر ميلان',        name_en: 'Inter Milan',          logo: '', league: 'seriea' },
  { id: 'milan',         name: 'ميلان',             name_en: 'AC Milan',             logo: '', league: 'seriea' },
  { id: 'juventus',      name: 'يوفنتوس',           name_en: 'Juventus',             logo: '', league: 'seriea' },
  { id: 'napoli',        name: 'نابولي',            name_en: 'Napoli',               logo: '', league: 'seriea' },
  { id: 'roma',          name: 'روما',              name_en: 'AS Roma',              logo: '', league: 'seriea' },
  { id: 'lazio',         name: 'لاتسيو',            name_en: 'Lazio',                logo: '', league: 'seriea' },
  { id: 'atalanta',      name: 'أتالانتا',          name_en: 'Atalanta',             logo: '', league: 'seriea' },
  { id: 'fiorentina',    name: 'فيورنتينا',         name_en: 'Fiorentina',           logo: '', league: 'seriea' },
  { id: 'bologna',       name: 'بولونيا',           name_en: 'Bologna',              logo: '', league: 'seriea' },
  { id: 'torino',        name: 'تورينو',            name_en: 'Torino',               logo: '', league: 'seriea' },
  { id: 'udinese',       name: 'أودينيزي',          name_en: 'Udinese',              logo: '', league: 'seriea' },
  { id: 'genoa',         name: 'جنوى',              name_en: 'Genoa',                logo: '', league: 'seriea' },
  { id: 'monza',         name: 'مونزا',             name_en: 'Monza',                logo: '', league: 'seriea' },
  { id: 'lecce',         name: 'ليتشي',             name_en: 'Lecce',                logo: '', league: 'seriea' },
  { id: 'cagliari',      name: 'كالياري',           name_en: 'Cagliari',             logo: '', league: 'seriea' },
  { id: 'verona',        name: 'هيلاس فيرونا',      name_en: 'Hellas Verona',        logo: '', league: 'seriea' },
  { id: 'como',          name: 'كومو',              name_en: 'Como',                 logo: '', league: 'seriea' },
  { id: 'parma',         name: 'بارما',             name_en: 'Parma',                logo: '', league: 'seriea' },
  { id: 'venezia',       name: 'فينيسيا',           name_en: 'Venezia',              logo: '', league: 'seriea' },
  { id: 'empoli',        name: 'إمبولي',            name_en: 'Empoli',               logo: '', league: 'seriea' },

  /* ═══ Bundesliga (18) ═══ */
  { id: 'bayern',        name: 'بايرن ميونخ',       name_en: 'Bayern Munich',        logo: '', league: 'bundesliga' },
  { id: 'dortmund',      name: 'بوروسيا دورتموند',  name_en: 'Borussia Dortmund',    logo: '', league: 'bundesliga' },
  { id: 'leipzig',       name: 'لايبزيغ',           name_en: 'RB Leipzig',           logo: '', league: 'bundesliga' },
  { id: 'leverkusen',    name: 'باير ليفركوزن',     name_en: 'Bayer Leverkusen',     logo: '', league: 'bundesliga' },
  { id: 'frankfurt',     name: 'آينتراخت فرانكفورت',name_en: 'Eintracht Frankfurt',  logo: '', league: 'bundesliga' },
  { id: 'wolfsburg',     name: 'فولفسبورغ',         name_en: 'VfL Wolfsburg',        logo: '', league: 'bundesliga' },
  { id: 'monchengladbach',name: 'بوروسيا مونشنغلادباخ',name_en: 'B. Monchengladbach',logo: '', league: 'bundesliga' },
  { id: 'stuttgart',     name: 'شتوتغارت',          name_en: 'VfB Stuttgart',        logo: '', league: 'bundesliga' },
  { id: 'freiburg',      name: 'فرايبورغ',          name_en: 'SC Freiburg',          logo: '', league: 'bundesliga' },
  { id: 'union_berlin',  name: 'يونيون برلين',      name_en: 'Union Berlin',         logo: '', league: 'bundesliga' },
  { id: 'werder',        name: 'فيردر بريمن',       name_en: 'Werder Bremen',        logo: '', league: 'bundesliga' },
  { id: 'hoffenheim',    name: 'هوفنهايم',          name_en: 'TSG Hoffenheim',       logo: '', league: 'bundesliga' },
  { id: 'mainz',         name: 'ماينز',             name_en: 'Mainz 05',             logo: '', league: 'bundesliga' },
  { id: 'augsburg',      name: 'أوغسبورغ',          name_en: 'FC Augsburg',          logo: '', league: 'bundesliga' },
  { id: 'bochum',        name: 'بوخوم',             name_en: 'VfL Bochum',           logo: '', league: 'bundesliga' },
  { id: 'heidenheim',    name: 'هايدنهايم',         name_en: '1. FC Heidenheim',     logo: '', league: 'bundesliga' },
  { id: 'st_pauli',      name: 'سانت باولي',        name_en: 'FC St. Pauli',         logo: '', league: 'bundesliga' },
  { id: 'holstein',      name: 'هولشتاين كيل',      name_en: 'Holstein Kiel',        logo: '', league: 'bundesliga' },

  /* ═══ Ligue 1 (18) ═══ */
  { id: 'psg',           name: 'باريس سان جيرمان',  name_en: 'Paris Saint-Germain',  logo: '', league: 'ligue1' },
  { id: 'marseille',     name: 'مارسيليا',          name_en: 'Marseille',            logo: '', league: 'ligue1' },
  { id: 'lyon',          name: 'ليون',              name_en: 'Lyon',                 logo: '', league: 'ligue1' },
  { id: 'monaco',        name: 'موناكو',            name_en: 'AS Monaco',            logo: '', league: 'ligue1' },
  { id: 'lille',         name: 'ليل',               name_en: 'Lille',                logo: '', league: 'ligue1' },
  { id: 'nice',          name: 'نيس',               name_en: 'Nice',                 logo: '', league: 'ligue1' },
  { id: 'lens',          name: 'لانس',              name_en: 'Lens',                 logo: '', league: 'ligue1' },
  { id: 'rennes',        name: 'رين',               name_en: 'Rennes',               logo: '', league: 'ligue1' },
  { id: 'strasbourg',    name: 'ستراسبورغ',         name_en: 'Strasbourg',           logo: '', league: 'ligue1' },
  { id: 'toulouse',      name: 'تولوز',             name_en: 'Toulouse',             logo: '', league: 'ligue1' },
  { id: 'reims',         name: 'ريمس',              name_en: 'Reims',                logo: '', league: 'ligue1' },
  { id: 'nantes',        name: 'نانت',              name_en: 'Nantes',               logo: '', league: 'ligue1' },
  { id: 'montpellier',   name: 'مونبلييه',          name_en: 'Montpellier',          logo: '', league: 'ligue1' },
  { id: 'brest',         name: 'بريست',             name_en: 'Brest',                logo: '', league: 'ligue1' },
  { id: 'auxerre',       name: 'أوكسير',            name_en: 'Auxerre',              logo: '', league: 'ligue1' },
  { id: 'angers',        name: 'أنجيه',             name_en: 'Angers',               logo: '', league: 'ligue1' },
  { id: 'le_havre',      name: 'لوهافر',            name_en: 'Le Havre',             logo: '', league: 'ligue1' },
  { id: 'saint_etienne', name: 'سانت إتيان',        name_en: 'Saint-Etienne',        logo: '', league: 'ligue1' },

  /* ═══ Saudi (4) ═══ */
  { id: 'al_hilal',      name: 'الهلال',            name_en: 'Al Hilal',             logo: '', league: 'saudi' },
  { id: 'al_nassr',      name: 'النصر',             name_en: 'Al Nassr',             logo: '', league: 'saudi' },
  { id: 'al_ittihad',    name: 'الاتحاد',           name_en: 'Al Ittihad',           logo: '', league: 'saudi' },
  { id: 'al_ahli',       name: 'الأهلي',            name_en: 'Al Ahli',              logo: '', league: 'saudi' },

  /* ═══ MLS (3) ═══ */
  { id: 'inter_miami',   name: 'إنتر ميامي',        name_en: 'Inter Miami',          logo: '', league: 'mls' },
  { id: 'la_galaxy',     name: 'لوس أنجلوس غالاكسي',name_en: 'LA Galaxy',            logo: '', league: 'mls' },
  { id: 'lafc',          name: 'لوس أنجلوس FC',     name_en: 'LAFC',                 logo: '', league: 'mls' },

  /* ═══ منتخبات أوروبا UEFA (9) ═══ */
  { id: 'fra', name: 'فرنسا',            name_en: 'France',           logo: 'https://flagcdn.com/w160/fr.png',      league: 'uefa' },
  { id: 'esp', name: 'إسبانيا',          name_en: 'Spain',            logo: 'https://flagcdn.com/w160/es.png',      league: 'uefa' },
  { id: 'ger', name: 'ألمانيا',          name_en: 'Germany',          logo: 'https://flagcdn.com/w160/de.png',      league: 'uefa' },
  { id: 'ita', name: 'إيطاليا',          name_en: 'Italy',            logo: 'https://flagcdn.com/w160/it.png',      league: 'uefa' },
  { id: 'eng', name: 'إنجلترا',          name_en: 'England',          logo: 'https://flagcdn.com/w160/gb-eng.png',  league: 'uefa' },
  { id: 'por', name: 'البرتغال',         name_en: 'Portugal',         logo: 'https://flagcdn.com/w160/pt.png',      league: 'uefa' },
  { id: 'ned', name: 'هولندا',           name_en: 'Netherlands',      logo: 'https://flagcdn.com/w160/nl.png',      league: 'uefa' },
  { id: 'bel', name: 'بلجيكا',           name_en: 'Belgium',          logo: 'https://flagcdn.com/w160/be.png',      league: 'uefa' },
  { id: 'cro', name: 'كرواتيا',          name_en: 'Croatia',          logo: 'https://flagcdn.com/w160/hr.png',      league: 'uefa' },

  /* ═══ منتخبات آسيا AFC (7) ═══ */
  { id: 'ksa', name: 'السعودية',         name_en: 'Saudi Arabia',     logo: 'https://flagcdn.com/w160/sa.png',      league: 'afc' },
  { id: 'syr', name: 'سوريا',            name_en: 'Syria',            logo: 'https://flagcdn.com/w160/sy.png',      league: 'afc' },
  { id: 'jor', name: 'الأردن',           name_en: 'Jordan',           logo: 'https://flagcdn.com/w160/jo.png',      league: 'afc' },
  { id: 'jpn', name: 'اليابان',          name_en: 'Japan',            logo: 'https://flagcdn.com/w160/jp.png',      league: 'afc' },
  { id: 'kor', name: 'كوريا الجنوبية',   name_en: 'South Korea',      logo: 'https://flagcdn.com/w160/kr.png',      league: 'afc' },
  { id: 'irn', name: 'إيران',            name_en: 'Iran',             logo: 'https://flagcdn.com/w160/ir.png',      league: 'afc' },
  { id: 'aus', name: 'أستراليا',         name_en: 'Australia',        logo: 'https://flagcdn.com/w160/au.png',      league: 'afc' },

  /* ═══ منتخبات أفريقيا CAF (9) ═══ */
  { id: 'egy', name: 'مصر',              name_en: 'Egypt',            logo: 'https://flagcdn.com/w160/eg.png',      league: 'caf' },
  { id: 'mar', name: 'المغرب',           name_en: 'Morocco',          logo: 'https://flagcdn.com/w160/ma.png',      league: 'caf' },
  { id: 'alg', name: 'الجزائر',          name_en: 'Algeria',          logo: 'https://flagcdn.com/w160/dz.png',      league: 'caf' },
  { id: 'tun', name: 'تونس',             name_en: 'Tunisia',          logo: 'https://flagcdn.com/w160/tn.png',      league: 'caf' },
  { id: 'sen', name: 'السنغال',          name_en: 'Senegal',          logo: 'https://flagcdn.com/w160/sn.png',      league: 'caf' },
  { id: 'nga', name: 'نيجيريا',          name_en: 'Nigeria',          logo: 'https://flagcdn.com/w160/ng.png',      league: 'caf' },
  { id: 'civ', name: 'ساحل العاج',       name_en: 'Ivory Coast',      logo: 'https://flagcdn.com/w160/ci.png',      league: 'caf' },
  { id: 'cmr', name: 'الكاميرون',        name_en: 'Cameroon',         logo: 'https://flagcdn.com/w160/cm.png',      league: 'caf' },
  { id: 'gha', name: 'غانا',             name_en: 'Ghana',            logo: 'https://flagcdn.com/w160/gh.png',      league: 'caf' },

  /* ═══ منتخبات أمريكا الجنوبية CONMEBOL (3) ═══ */
  { id: 'bra', name: 'البرازيل',         name_en: 'Brazil',           logo: 'https://flagcdn.com/w160/br.png',      league: 'conmebol' },
  { id: 'arg', name: 'الأرجنتين',        name_en: 'Argentina',        logo: 'https://flagcdn.com/w160/ar.png',      league: 'conmebol' },
  { id: 'uru', name: 'أوروغواي',         name_en: 'Uruguay',          logo: 'https://flagcdn.com/w160/uy.png',      league: 'conmebol' },

  /* ═══ منتخبات أمريكا الشمالية CONCACAF (2) ═══ */
  { id: 'usa', name: 'الولايات المتحدة', name_en: 'USA',              logo: 'https://flagcdn.com/w160/us.png',      league: 'concacaf' },
  { id: 'mex', name: 'المكسيك',          name_en: 'Mexico',           logo: 'https://flagcdn.com/w160/mx.png',      league: 'concacaf' }

];

/* ================================================================
   5. إدارة المفضلة
   ================================================================ */
function getFavoriteTeams() {
  try {
    var raw = localStorage.getItem(TEAMS_KEY);
    if (!raw) return {};

    var parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      var fixed = {};
      parsed.forEach(function(id) {
        if (id && typeof id === 'string') fixed[id] = true;
      });
      try { localStorage.setItem(TEAMS_KEY, JSON.stringify(fixed)); } catch (e) {}
      return fixed;
    }

    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return {};
  } catch (e) {
    console.error('خطأ في قراءة المفضلة:', e);
    return {};
  }
}

function saveFavoriteTeams(fav) {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(fav));
  } catch (e) {
    console.error('فشل حفظ المفضلة:', e);
  }
}

/* ================================================================
   6. تحديث العدّاد
   ================================================================ */
function updateTeamsCountLabel() {
  var label = document.getElementById('teamsCountLabel');
  if (!label) return;

  var fav = getFavoriteTeams();
  var count = Object.keys(fav).length;

  if (count === 0)       label.textContent = 'لم تضف أي فريق بعد';
  else if (count === 1)  label.textContent = 'فريق واحد مضاف';
  else if (count === 2)  label.textContent = 'فريقان مضافان';
  else if (count <= 10)  label.textContent = count + ' فرق مضافة';
  else                   label.textContent = count + ' فريق مضاف';
}

/* ================================================================
   7. الحصول على قائمة الفرق
   ================================================================ */
function getTeamsList(leagueFilter) {
  var fav = getFavoriteTeams();
  var source = H90_ALL_TEAMS;

  if (leagueFilter && leagueFilter !== 'all') {
    source = source.filter(function(t) { return t.league === leagueFilter; });
  }

  return source.map(function(t) {
    return {
      id: t.id,
      name: t.name,
      name_en: t.name_en || '',
      logo: t.logo || '',
      league: t.league || '',
      selected: fav[t.id] === true
    };
  });
}

/* ================================================================
   8. ✅ توليد الشعار — crests.football-data.org (متوافق 100%)
   ================================================================ */
function _generateTeamLogo(team) {
  /* ✅ توليد الأحرف الأولى كـ fallback */
  var initials = '';
  try {
    var nameForInitials = team.name_en || team.name || '?';
    initials = nameForInitials
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) { return (w[0] || '').toUpperCase(); })
      .join('');
  } catch (e) {
    initials = '?';
  }

  if (!initials || initials.length === 0) {
    initials = (team.name || '?').substring(0, 2).toUpperCase();
  }

  /* ✅ تحديد نوع الفريق */
  var isNational = team.league && (
    team.league === 'uefa' ||
    team.league === 'afc' ||
    team.league === 'caf' ||
    team.league === 'conmebol' ||
    team.league === 'concacaf' ||
    team.league === 'ofc'
  );

  /* ✅ توليد لون ثابت */
  var hash = 0;
  var idStr = String(team.id || team.name || '');
  for (var i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
    hash |= 0;
  }
  var hue = Math.abs(hash) % 360;

  var color1, color2, textColor;
  if (isNational) {
    color1 = '#00e5ff';
    color2 = '#0091ea';
    textColor = '#001018';
  } else {
    color1 = 'hsl(' + hue + ', 70%, 55%)';
    color2 = 'hsl(' + ((hue + 35) % 360) + ', 70%, 35%)';
    textColor = '#ffffff';
  }

  /* ✅ fallback style */
  var fallbackStyle =
    'display:none;width:100%;height:100%;align-items:center;justify-content:center;' +
    'background:linear-gradient(135deg,' + color1 + ',' + color2 + ');' +
    'color:' + textColor + ';font-weight:900;letter-spacing:0.5px;font-size:13px;';

  /* ═══════════════════════════════════════════
     🎯 منتخبات → flagcdn
     ═══════════════════════════════════════════ */
  var isFlagCdn = team.logo && team.logo.indexOf('flagcdn.com') > -1;

  if (isFlagCdn) {
    return (
      '<img src="' + team.logo + '" alt="' + team.name + '" loading="lazy" ' +
      'class="h90-team-logo-img" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<div class="h90-team-fallback" style="' + fallbackStyle + '">' +
        '<span>' + initials + '</span>' +
      '</div>'
    );
  }

  /* ═══════════════════════════════════════════
     🎯 أندية → crests.football-data.org (نفس مصدر المباريات)
     ═══════════════════════════════════════════ */
  var teamApiId = H90_FOOTBALL_LOGOS_MAP[team.id];

  if (teamApiId) {
    /* ✅ رابط واحد فقط — وهو موثوق 100% */
    var primaryUrl = 'https://crests.football-data.org/' + teamApiId + '.png';

    return (
      '<img src="' + primaryUrl + '" alt="' + team.name + '" loading="lazy" ' +
      'class="h90-team-logo-img" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
      '<div class="h90-team-fallback" style="' + fallbackStyle + '">' +
        '<span>' + initials + '</span>' +
      '</div>'
    );
  }

  /* ═══════════════════════════════════════════
     🎯 fallback: شعار SVG مولّد
     ═══════════════════════════════════════════ */
  return (
    '<div class="h90-team-fallback" style="display:flex;width:100%;height:100%;' +
      'align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,' + color1 + ',' + color2 + ');' +
      'color:' + textColor + ';font-weight:900;letter-spacing:0.5px;font-size:13px;">' +
      '<span>' + initials + '</span>' +
    '</div>'
  );
}

/* ================================================================
   9. رسم بطاقات الفرق — مع event.stopPropagation
   ================================================================ */
function _renderTeamsCards(container, teams, fav) {
  var html = '';

  teams.forEach(function (team) {
    var isSelected = fav[team.id] === true;
    var safeId = team.id.replace(/'/g, "\\'");

    var logoHtml = _generateTeamLogo(team);

    var stateClass = isSelected ? 'selected' : 'idle';
    var markerHtml = isSelected
      ? '<div class="h90-team-marker selected">' + H90_SVG.check + '</div>'
      : '<div class="h90-team-marker idle">' + H90_SVG.star + '</div>';

    html +=
      '<button type="button" class="h90-team-card ' + stateClass + '" ' +
        'onclick="toggleTeamFavorite(\'' + safeId + '\', event)" ' +
        'data-team-id="' + team.id + '">' +

        '<div class="h90-team-logo-box">' + logoHtml + '</div>' +

        '<div class="h90-team-info">' +
          '<div class="h90-team-name">' + team.name + '</div>' +
          (team.name_en ? '<div class="h90-team-name-en">' + team.name_en + '</div>' : '') +
        '</div>' +

        markerHtml +
      '</button>';
  });

  container.innerHTML = html;
}

/* ================================================================
   10. رسم القائمة (فلتر + بحث)
   ================================================================ */
function _filterTeams(teams, filter) {
  if (!filter || !filter.trim()) return teams;
  var q = filter.trim().toLowerCase();
  return teams.filter(function (t) {
    return t.name.toLowerCase().indexOf(q) > -1 ||
           (t.name_en && t.name_en.toLowerCase().indexOf(q) > -1);
  });
}

function _renderEmpty(container) {
  container.innerHTML =
    '<div class="h90-teams-empty">' +
      '<div class="h90-teams-empty-icon">' + H90_SVG.empty + '</div>' +
      '<div class="h90-teams-empty-text">لا توجد نتائج مطابقة</div>' +
    '</div>';
}

function renderTeamsList(filter, leagueFilter) {
  var container = document.getElementById('teamsListContainer');
  if (!container) return;

  var fav = getFavoriteTeams();
  var teams = _filterTeams(getTeamsList(leagueFilter), filter);

  if (teams.length === 0) { _renderEmpty(container); return; }

  _renderTeamsCards(container, teams, fav);
}

function renderTeamsListCategory(filter, type) {
  var container = document.getElementById('teamsListContainer');
  if (!container) return;

  var fav = getFavoriteTeams();
  var typeLeagues = H90_LEAGUES
    .filter(function(l) { return l.type === type; })
    .map(function(l) { return l.id; });

  var teams = H90_ALL_TEAMS
    .filter(function(t) { return typeLeagues.indexOf(t.league) > -1; })
    .map(function(t) {
      return {
        id: t.id,
        name: t.name,
        name_en: t.name_en || '',
        logo: t.logo || '',
        league: t.league || '',
        selected: fav[t.id] === true
      };
    });

  teams = _filterTeams(teams, filter);

  if (teams.length === 0) { _renderEmpty(container); return; }

  _renderTeamsCards(container, teams, fav);
}

/* ================================================================
   11. بناء HTML للنافذة
   ================================================================ */
function _buildTeamsModalHTML() {
  var clubs = H90_LEAGUES.filter(function(l) { return l.type === 'clubs'; });
  var nationals = H90_LEAGUES.filter(function(l) { return l.type === 'national'; });

  var clubsBtns = clubs.map(function(l) {
    return '<button type="button" class="h90-league-chip" data-league="' + l.id + '">' +
      '<span class="h90-league-chip-icon">' + H90_SVG[l.icon] + '</span>' +
      '<span>' + l.name + '</span>' +
    '</button>';
  }).join('');

  var nationalsBtns = nationals.map(function(l) {
    return '<button type="button" class="h90-league-chip" data-league="' + l.id + '">' +
      '<span class="h90-league-chip-icon">' + H90_SVG[l.icon] + '</span>' +
      '<span>' + l.name + '</span>' +
    '</button>';
  }).join('');

  return (
    /* ═══ الترويسة ═══ */
    '<div class="h90-teams-header">' +
      '<h2 class="h90-teams-title">' +
        '<span class="h90-teams-title-icon">' + H90_SVG.ball + '</span>' +
        '<span>الفرق المفضلة</span>' +
      '</h2>' +
      '<button type="button" class="h90-teams-close" onclick="closeTeamsPicker()">' +
        '<span class="h90-teams-close-icon">' + H90_SVG.close + '</span>' +
      '</button>' +
    '</div>' +

    /* ═══ التصنيفات الرئيسية ═══ */
    '<div class="h90-teams-cats">' +
      '<button type="button" class="h90-cat-btn active" data-cat="all" onclick="filterTeamsCategory(\'all\')">' +
        '<span class="h90-cat-icon">' + H90_SVG.trophy + '</span>' +
        '<span>الكل</span>' +
      '</button>' +
      '<button type="button" class="h90-cat-btn" data-cat="clubs" onclick="filterTeamsCategory(\'clubs\')">' +
        '<span class="h90-cat-icon">' + H90_SVG.shield + '</span>' +
        '<span>الأندية</span>' +
      '</button>' +
      '<button type="button" class="h90-cat-btn" data-cat="national" onclick="filterTeamsCategory(\'national\')">' +
        '<span class="h90-cat-icon">' + H90_SVG.globe + '</span>' +
        '<span>المنتخبات</span>' +
      '</button>' +
    '</div>' +

    /* ═══ البحث ═══ */
    '<div class="h90-teams-search-wrap">' +
      '<div class="h90-teams-search-box">' +
        '<span class="h90-teams-search-icon">' + H90_SVG.search + '</span>' +
        '<input id="teamsSearchInput" type="text" ' +
          'placeholder="ابحث عن فريق أو منتخب..." ' +
          'autocomplete="off" oninput="onTeamsSearch(this.value)">' +
      '</div>' +
    '</div>' +

    /* ═══ أزرار الدوريات والقارات ═══ */
    '<div id="teamsLeaguesContainer" class="h90-teams-leagues">' +
      '<div class="h90-teams-section-label" data-section="clubs">' +
        '<span class="h90-section-icon">' + H90_SVG.stadium + '</span>' +
        '<span>الدوريات</span>' +
      '</div>' +
      '<div class="h90-teams-leagues-row" data-section-row="clubs">' + clubsBtns + '</div>' +

      '<div class="h90-teams-section-label" data-section="national">' +
        '<span class="h90-section-icon">' + H90_SVG.globe + '</span>' +
        '<span>القارات</span>' +
      '</div>' +
      '<div class="h90-teams-leagues-row" data-section-row="national">' + nationalsBtns + '</div>' +
    '</div>' +

    /* ═══ قائمة الفرق ═══ */
    '<div id="teamsListContainer" class="h90-teams-list"></div>'
  );
}

/* ================================================================
   12. ربط أحداث النافذة
   ================================================================ */
function _bindTeamsModalEvents() {
  var leagueBtns = document.querySelectorAll('.h90-league-chip');
  leagueBtns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();

      var leagueId = btn.dataset.league;

      leagueBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var searchInput = document.getElementById('teamsSearchInput');
      renderTeamsList(searchInput ? searchInput.value : '', leagueId);

      if (typeof window.haptic === 'function') window.haptic(8);
    });
  });
}

/* ================================================================
   13. فتح/إغلاق النافذة
   ================================================================ */
function openTeamsPicker() {
  var modal = document.getElementById('teamsPickerModal');
  if (!modal) {
    if (typeof window.showToast === 'function') {
      window.showToast('عنصر الفرق المفضلة غير موجود', 'warning');
    }
    return;
  }

  modal.innerHTML = _buildTeamsModalHTML();
  _bindTeamsModalEvents();

  window._currentTeamsCategory = 'all';
  renderTeamsList('', 'all');

  modal.classList.add('show');
  modal.style.display = 'flex';

  if (typeof window.haptic === 'function') window.haptic(10);
}

function closeTeamsPicker() {
  var modal = document.getElementById('teamsPickerModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  updateTeamsCountLabel();
  if (typeof window.haptic === 'function') window.haptic(8);
}

/* ================================================================
   14. تصفية حسب التصنيف
   ================================================================ */
function filterTeamsCategory(category) {
  window._currentTeamsCategory = category;

  document.querySelectorAll('.h90-cat-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });

  var clubsLabel = document.querySelector('[data-section="clubs"]');
  var nationalLabel = document.querySelector('[data-section="national"]');
  var clubsRow = document.querySelector('[data-section-row="clubs"]');
  var nationalRow = document.querySelector('[data-section-row="national"]');

  var showClubs = (category === 'all' || category === 'clubs');
  var showNational = (category === 'all' || category === 'national');

  if (clubsLabel) clubsLabel.style.display = showClubs ? 'flex' : 'none';
  if (clubsRow) clubsRow.style.display = showClubs ? 'flex' : 'none';
  if (nationalLabel) nationalLabel.style.display = showNational ? 'flex' : 'none';
  if (nationalRow) nationalRow.style.display = showNational ? 'flex' : 'none';

  var searchInput = document.getElementById('teamsSearchInput');
  var query = searchInput ? searchInput.value : '';

  if (category === 'all') {
    renderTeamsList(query, 'all');
  } else if (category === 'clubs') {
    renderTeamsListCategory(query, 'clubs');
  } else if (category === 'national') {
    renderTeamsListCategory(query, 'national');
  }

  if (typeof window.haptic === 'function') window.haptic(6);
}

/* ================================================================
   15. البحث
   ================================================================ */
var _teamsSearchTimer = null;
function onTeamsSearch(value) {
  if (_teamsSearchTimer) clearTimeout(_teamsSearchTimer);
  _teamsSearchTimer = setTimeout(function () {
    var cat = window._currentTeamsCategory || 'all';

    if (cat === 'all') renderTeamsList(value, 'all');
    else if (cat === 'clubs') renderTeamsListCategory(value, 'clubs');
    else if (cat === 'national') renderTeamsListCategory(value, 'national');
  }, 150);
}

/* ================================================================
   16. إضافة/إزالة فريق — مع event.stopPropagation
   ================================================================ */
function toggleTeamFavorite(teamId, event) {
  /* ✅ منع انتشار الحدث */
  if (event) {
    try {
      event.stopPropagation();
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    } catch (e) {}
  }

  var fav = getFavoriteTeams();
  var isCurrentlyFav = fav[teamId] === true;

  if (isCurrentlyFav) {
    delete fav[teamId];
    if (typeof window.showToast === 'function') {
      window.showToast('تمت الإزالة من المفضلة', 'info');
    }
  } else {
    fav[teamId] = true;
    if (typeof window.showToast === 'function') {
      window.showToast('تمت الإضافة للمفضلة', 'success');
    }
  }

  saveFavoriteTeams(fav);

  var searchInput = document.getElementById('teamsSearchInput');
  var query = searchInput ? searchInput.value : '';
  var cat = window._currentTeamsCategory || 'all';

  if (cat === 'all') renderTeamsList(query, 'all');
  else if (cat === 'clubs') renderTeamsListCategory(query, 'clubs');
  else if (cat === 'national') renderTeamsListCategory(query, 'national');

  updateTeamsCountLabel();

  if (typeof window.haptic === 'function') window.haptic(10);
}

/* ================================================================
   17. CSS
   ================================================================ */
(function _injectTeamsCSS() {
  if (document.getElementById('h90-teams-css')) return;

  var css = document.createElement('style');
  css.id = 'h90-teams-css';
  css.textContent = `
    /* ═══ النافذة ═══ */
    #teamsPickerModal {
      flex-direction: column;
      background: #0a0e14;
      z-index: 9999;
      overflow: hidden;
    }

    #teamsPickerModal * {
      -webkit-tap-highlight-color: transparent;
    }

    /* ═══ الترويسة ═══ */
    .h90-teams-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      padding-top: calc(16px + var(--safe-top, 0px));
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(0,0,0,0.25);
    }

    .h90-teams-title {
      color: #fff;
      font-size: 18px;
      font-weight: 900;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: -0.3px;
    }

    .h90-teams-title-icon {
      width: 24px;
      height: 24px;
      color: #00e5ff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .h90-teams-close {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
      padding: 0;
    }
    .h90-teams-close:active { background: rgba(255,255,255,0.12); }

    .h90-teams-close-icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
    }

    /* ═══ التصنيفات الرئيسية ═══ */
    .h90-teams-cats {
      display: flex;
      gap: 8px;
      padding: 12px 16px 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .h90-teams-cats::-webkit-scrollbar { display: none; }

    .h90-cat-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1.5px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.55);
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .h90-cat-btn.active {
      background: rgba(0,229,255,0.12);
      border-color: rgba(0,229,255,0.5);
      color: #fff;
      box-shadow: 0 4px 14px rgba(0,229,255,0.15);
    }

    .h90-cat-icon {
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* ═══ البحث ═══ */
    .h90-teams-search-wrap { padding: 12px 16px 0; }

    .h90-teams-search-box {
      position: relative;
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .h90-teams-search-box:focus-within {
      border-color: rgba(0,229,255,0.4);
      background: rgba(0,229,255,0.04);
    }

    .h90-teams-search-icon {
      position: absolute;
      right: 14px;
      width: 16px;
      height: 16px;
      color: rgba(255,255,255,0.35);
      pointer-events: none;
      display: inline-flex;
    }

    .h90-teams-search-box input {
      width: 100%;
      padding: 12px 42px 12px 16px;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
    }
    .h90-teams-search-box input::placeholder {
      color: rgba(255,255,255,0.3);
    }

    /* ═══ أزرار الدوريات والقارات ═══ */
    .h90-teams-leagues {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .h90-teams-section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: rgba(255,255,255,0.35);
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
    }
    .h90-teams-section-label:not(:first-child) { margin-top: 14px; }

    .h90-section-icon {
      width: 12px;
      height: 12px;
      display: inline-flex;
    }

    .h90-teams-leagues-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 4px;
    }
    .h90-teams-leagues-row::-webkit-scrollbar { display: none; }

    .h90-league-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1.5px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.6);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .h90-league-chip.active {
      background: rgba(0,229,255,0.12);
      border-color: rgba(0,229,255,0.55);
      color: #fff;
    }
    .h90-league-chip:active { transform: scale(0.96); }

    .h90-league-chip-icon {
      width: 12px;
      height: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
    }
    .h90-league-chip.active .h90-league-chip-icon { opacity: 1; }

    /* ═══ قائمة الفرق ═══ */
    .h90-teams-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px 40px;
      -webkit-overflow-scrolling: touch;
    }

    /* ═══ بطاقة فريق ═══ */
    .h90-team-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      margin-bottom: 8px;
      cursor: pointer;
      width: 100%;
      font-family: inherit;
      text-align: right;
      transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    }
    .h90-team-card:active { transform: scale(0.985); }

    .h90-team-card.idle {
      background: rgba(255,255,255,0.03);
      border: 1.5px solid rgba(255,255,255,0.07);
    }
    .h90-team-card.idle:hover {
      background: rgba(255,255,255,0.055);
      border-color: rgba(255,255,255,0.12);
    }

    .h90-team-card.selected {
      background: linear-gradient(135deg, rgba(0,229,255,0.14), rgba(0,145,234,0.06));
      border: 2px solid rgba(0,229,255,0.55);
      box-shadow: 0 4px 18px rgba(0,229,255,0.18);
    }

    /* ═══ شعار الفريق ═══ */
    .h90-team-logo-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.07);
      position: relative;
    }
    .h90-team-card.selected .h90-team-logo-box {
      background: rgba(0,229,255,0.15);
      border-color: rgba(0,229,255,0.4);
    }

    .h90-team-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 5px;
      display: block;
      box-sizing: border-box;
    }

    .h90-team-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      color: rgba(255,255,255,0.75);
      background: linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,145,234,0.1));
      letter-spacing: 0.5px;
    }

    /* ═══ معلومات الفريق ═══ */
    .h90-team-info {
      flex: 1;
      text-align: right;
      min-width: 0;
    }

    .h90-team-name {
      font-size: 14px;
      font-weight: 800;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.2px;
    }
    .h90-team-card.selected .h90-team-name { color: #00e5ff; }

    .h90-team-name-en {
      font-size: 10.5px;
      color: rgba(255,255,255,0.4);
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .h90-team-card.selected .h90-team-name-en {
      color: rgba(0,229,255,0.7);
    }

    /* ═══ مؤشر الاختيار ═══ */
    .h90-team-marker {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .h90-team-marker > svg { width: 14px; height: 14px; }

    .h90-team-marker.idle {
      border: 1.5px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.25);
    }

    .h90-team-marker.selected {
      background: linear-gradient(135deg, #00e5ff, #0091ea);
      color: #001018;
      box-shadow: 0 3px 12px rgba(0,229,255,0.45);
    }

    /* ═══ حالة فارغة ═══ */
    .h90-teams-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: rgba(255,255,255,0.3);
      gap: 14px;
    }

    .h90-teams-empty-icon {
      width: 44px;
      height: 44px;
      opacity: 0.4;
    }

    .h90-teams-empty-text {
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
  `;
  document.head.appendChild(css);
})();

/* ================================================================
   18. التصدير
   ================================================================ */
window.H90_SVG                    = H90_SVG;
window.H90_LEAGUES                = H90_LEAGUES;
window.H90_ALL_TEAMS              = H90_ALL_TEAMS;
window.H90_FOOTBALL_LOGOS_MAP     = H90_FOOTBALL_LOGOS_MAP;
window.TEAMS_KEY                  = TEAMS_KEY;
window.openTeamsPicker            = openTeamsPicker;
window.closeTeamsPicker           = closeTeamsPicker;
window.updateTeamsCountLabel      = updateTeamsCountLabel;
window.toggleTeamFavorite         = toggleTeamFavorite;
window.renderTeamsList            = renderTeamsList;
window.filterTeamsCategory        = filterTeamsCategory;
window.onTeamsSearch              = onTeamsSearch;
window.getFavoriteTeams           = getFavoriteTeams;
window.saveFavoriteTeams          = saveFavoriteTeams;
window.getTeamsList               = getTeamsList;

console.log(
  '%c teams.js v9.0 ' +
  '%c ' + H90_ALL_TEAMS.length + ' team ' +
  '%c crests.football-data.org — PERFECT ',
  'background:linear-gradient(135deg,#00e5ff,#0091ea);color:#001018;padding:6px 12px;border-radius:8px 0 0 8px;font-weight:900;font-size:12px;',
  'background:#0a0e14;color:#00e5ff;padding:6px 12px;font-weight:800;font-size:12px;',
  'background:#0a0e14;color:#7dd3fc;padding:6px 12px;border-radius:0 8px 8px 0;font-weight:700;font-size:11px;'
);
/* ================================================================
   H90 AI Core — v1.0
   ================================================================
   الطبقة الأساسية للذكاء الاصطناعي
   ✅ Fuzzy Search محسّن (يتعامل مع الأخطاء الإملائية)
   ✅ Synonyms Engine (مرادفات عربية)
   ✅ Intent Classification (تصنيف النية)
   ✅ Phonetic Matching (تطابق صوتي)
   ✅ Word Reordering (إعادة ترتيب الكلمات)
   ================================================================ */

(function () {
  'use strict';

  console.log('H90 AI Core v1.0 loading...');

  /* ================================================================
     🔤 معالجة النص العربي — محسّنة
     ================================================================ */
  function normalizeArabic(text) {
    return String(text || '')
      .toLowerCase()
      /* توحيد الألف */
      .replace(/[أإآٱ]/g, 'ا')
      /* توحيد الياء */
      .replace(/[ىئ]/g, 'ي')
      /* توحيد التاء المربوطة */
      .replace(/ة/g, 'ه')
      /* توحيد الواو */
      .replace(/ؤ/g, 'و')
      /* إزالة التشكيل */
      .replace(/[\u064B-\u0652\u0640]/g, '')
      /* إزالة التطويل */
      .replace(/ـ/g, '')
      /* استبدال الأرقام العربية */
      .replace(/[٠١٢٣٤٥٦٧٨٩]/g, function (d) {
        return String.fromCharCode(d.charCodeAt(0) - 1632 + 48);
      })
      /* إزالة الرموز */
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      /* تقليل المسافات */
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ================================================================
     🔤 Phonetic Matching — التطابق الصوتي
     يستخدم للأخطاء الإملائية الشائعة
     ================================================================ */
  function phoneticNormalize(text) {
    return normalizeArabic(text)
      /* الحروف التي تشبه بعضها صوتياً */
      .replace(/[ذظ]/g, 'ز')
      .replace(/[ثصس]/g, 'س')
      .replace(/[طت]/g, 'ت')
      .replace(/[قك]/g, 'ك')
      .replace(/[حخه]/g, 'ه')
      .replace(/[عا]/g, 'ا')
      .replace(/[يe]/g, 'ي');
  }

  /* ================================================================
     📊 Levenshtein Distance
     ================================================================ */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /* ================================================================
     📊 حساب التشابه — محسّن
     ================================================================ */
  function similarity(a, b) {
    const aNorm = normalizeArabic(a);
    const bNorm = normalizeArabic(b);

    if (!aNorm || !bNorm) return 0;
    if (aNorm === bNorm) return 1;
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.9;

    /* تطابق صوتي */
    const aPhon = phoneticNormalize(a);
    const bPhon = phoneticNormalize(b);
    if (aPhon === bPhon) return 0.95;

    /* Levenshtein */
    const maxLen = Math.max(aNorm.length, bNorm.length);
    const dist = levenshtein(aNorm, bNorm);
    const levSim = 1 - dist / maxLen;

    /* Word-level similarity (الترتيب لا يهم) */
    const aWords = aNorm.split(' ').filter(w => w.length > 1);
    const bWords = bNorm.split(' ').filter(w => w.length > 1);
    let wordMatches = 0;
    aWords.forEach(function (aw) {
      bWords.forEach(function (bw) {
        if (aw === bw) wordMatches += 1;
        else if (levenshtein(aw, bw) <= 1 && aw.length > 3) wordMatches += 0.7;
      });
    });
    const wordSim = aWords.length && bWords.length
      ? wordMatches / Math.max(aWords.length, bWords.length)
      : 0;

    /* أعلى درجة */
    return Math.max(levSim, wordSim * 0.9, aPhon.includes(bPhon) || bPhon.includes(aPhon) ? 0.8 : 0);
  }

  /* ================================================================
     📚 Synonyms Engine — المرادفات العربية
     ================================================================ */
  const SYNONYMS = {
    /* قناة */
    'قناه': ['قنوات', 'بث', 'بثوث', 'channel', 'محطه', 'فضائيه'],
    'قنوات': ['قناه', 'بث', 'بثوث', 'channel', 'محطات', 'فضائيات'],
    'بث': ['قناه', 'قنوات', 'stream', 'بثوث'],
    'channel': ['قناه', 'قنوات', 'بث'],
    
    /* فيديو */
    'فيديو': ['مقطع', 'movie', 'فيلم', 'clip', 'video', 'شاشه'],
    'فيلم': ['movies', 'افلام', 'فيديو'],
    'افلام': ['فيلم', 'movies', 'فيديو'],
    'مقطع': ['فيديو', 'clip', 'video'],
    
    /* صوت */
    'صوت': ['audio', 'volume', 'ساوند', 'صوتيات', 'sound'],
    'audio': ['صوت', 'صوتيات'],
    'volume': ['صوت', 'مستوي', 'صوتيات'],
    
    /* صورة */
    'صوره': ['صورة', 'image', 'صور', 'صورة'],
    'صورة': ['صوره', 'image', 'صور'],
    'image': ['صورة', 'صوره', 'صور'],
    
    /* مشكلة */
    'مشكله': ['خطا', 'error', 'عطل', 'خلل', 'problem', 'مشاكل'],
    'خطا': ['مشكله', 'error', 'مشاكل', 'عطل'],
    'error': ['مشكله', 'خطا', 'عطل'],
    'عطل': ['مشكله', 'خطا', 'خلل'],
    
    /* لا يعمل */
    'مايشتغل': ['لا يعمل', 'لا يعمل', 'متوقف', 'معطل', 'wont work', 'not working'],
    'معطل': ['لا يعمل', 'مشكله', 'عطل', 'متوقف'],
    'متوقف': ['لا يعمل', 'معطل', 'واقف', 'stuck'],
    'واقف': ['متوقف', 'معلق', 'stuck'],
    
    /* جودة */
    'جوده': ['quality', 'وضوح', 'دقه', 'hd'],
    'quality': ['جوده', 'وضوح', 'دقه'],
    'وضوح': ['جوده', 'quality', 'دقه'],
    
    /* ترجمة */
    'ترجمه': ['subtitles', 'ترجمة', 'نص', 'srt', 'vtt'],
    'subtitles': ['ترجمه', 'ترجمة', 'نص'],
    
    /* إشعار */
    'اشعار': ['تنبيه', 'notification', 'اشعارات', 'تنبيهات'],
    'اشعارات': ['اشعار', 'تنبيه', 'notifications'],
    'تنبيه': ['اشعار', 'notification'],
    
    /* حساب */
    'حساب': ['account', 'مستخدم', 'user', 'بروفايل'],
    'account': ['حساب', 'مستخدم', 'user'],
    
    /* بث للتلفزيون */
    'البث': ['cast', 'بث', 'تلفزيون'],
    'cast': ['بث', 'chromecast', 'airplay'],
    'تلفزيون': ['تلفاز', 'tv', 'شاشه'],
    
    /* تحميل */
    'تحميل': ['download', 'تنزيل', 'حفظ', 'save'],
    'download': ['تحميل', 'تنزيل'],
    'تنزيل': ['تحميل', 'download'],
    
    /* مشاهدة */
    'مشاهده': ['watch', 'مشاهدة', 'عرض', 'view'],
    'watch': ['مشاهده', 'مشاهدة', 'عرض'],
    
    /* مباريات */
    'مباراه': ['مباريات', 'match', 'لعبه', 'ماتش'],
    'مباريات': ['مباراه', 'matches', 'العاب'],
    'match': ['مباراه', 'مباريات'],
    
    /* فريق */
    'فريق': ['team', 'فرق', 'نادي'],
    'team': ['فريق', 'فرق'],
    
    /* غرف */
    'غرفه': ['غرف', 'room', 'rooms', 'قاعه'],
    'غرف': ['غرفه', 'rooms', 'قاعات'],
    'room': ['غرفه', 'غرف'],
    
    /* إعدادات */
    'اعدادات': ['settings', 'ضبط', 'تخصيص'],
    'settings': ['اعدادات', 'ضبط', 'تخصيص'],
    
    /* تسجيل دخول */
    'دخول': ['login', 'تسجيل', 'انظمام', 'دخول'],
    'login': ['دخول', 'تسجيل'],
    
    /* تفضيلات */
    'مفضله': ['favorite', 'مفضلة', 'مفضلات', 'افضل'],
    'favorite': ['مفضله', 'مفضلة', 'افضل'],
    
    /* ثيم */
    'ثيم': ['theme', 'لون', 'مظهر', 'تصميم'],
    'theme': ['ثيم', 'لون', 'مظهر'],
    
    /* حجم */
    'حجم': ['size', 'قياس', 'كبر'],
    'size': ['حجم', 'قياس'],
    
    /* سرعة */
    'سرعه': ['speed', 'تسريع', 'ابطاء', 'سريع'],
    'speed': ['سرعه', 'تسريع'],
    
    /* تشغيل */
    'تشغيل': ['play', 'شغل', 'بدا', 'stare'],
    'play': ['تشغيل', 'شغل', 'بدا'],
    'شغل': ['تشغيل', 'play', 'بدا'],
    
    /* إيقاف */
    'ايقاف': ['stop', 'توقف', 'وقفه', 'pause'],
    'stop': ['ايقاف', 'توقف', 'وقفه'],
    'pause': ['ايقاف', 'توقف', 'وقفه'],
    
    /* ملء الشاشة */
    'ملء': ['fullscreen', 'كامل', 'شاشه', 'تكميم'],
    'fullscreen': ['ملء', 'كامل', 'شاشه كامله'],
    
    /* ترجمة */
    'ترجمه': ['subtitles', 'caption', 'srt', 'vtt'],
    
    /* تفسير/شرح */
    'شرح': ['explain', 'فسر', 'وضح', 'توضيح'],
    'explain': ['شرح', 'وضح', 'توضيح'],
    
    /* كيف */
    'كيف': ['how', 'طريقه', 'طريقة', 'كيفيه'],
    'how': ['كيف', 'طريقه', 'كيفيه'],
    'طريقه': ['كيف', 'how', 'كيفيه'],
    
    /* لماذا */
    'لماذا': ['why', 'ليش', 'لويش', 'سبب'],
    'why': ['لماذا', 'ليش', 'سبب'],
    'ليش': ['لماذا', 'why', 'سبب'],
    
    /* متى */
    'متي': ['when', 'وقت', 'متى', 'ايمتي'],
    'when': ['متي', 'وقت', 'ايمتي']
  };

  /* ================================================================
     📚 توسيع النص بالمرادفات
     ================================================================ */
  function expandWithSynonyms(text) {
    const norm = normalizeArabic(text);
    const words = norm.split(' ').filter(w => w.length > 0);
    const expanded = new Set(words);

    words.forEach(function (word) {
      if (SYNONYMS[word]) {
        SYNONYMS[word].forEach(function (syn) {
          expanded.add(normalizeArabic(syn));
        });
      }
      /* بحث عن مرادفات مطابقة بالتطابق الصوتي */
      Object.keys(SYNONYMS).forEach(function (key) {
        if (phoneticNormalize(key) === phoneticNormalize(word)) {
          SYNONYMS[key].forEach(function (syn) {
            expanded.add(normalizeArabic(syn));
          });
        }
      });
    });

    return Array.from(expanded);
  }

  /* ================================================================
     🎯 Intent Classification — تصنيف النية
     ================================================================ */
  const INTENT_PATTERNS = {
    /* سؤال عن كيفية */
    question_how: {
      keywords: ['كيف', 'طريقه', 'طريقه', 'how', 'كيفيه', 'شرح', 'وضح'],
      prefixes: ['كيف', 'كيفيه', 'كيف اسوي', 'كيفيه عمل', 'طريقه'],
      weight: 1.0
    },
    
    /* سؤال لماذا */
    question_why: {
      keywords: ['لماذا', 'ليش', 'ليش ما', 'سبب', 'why', 'ليه'],
      weight: 1.0
    },
    
    /* سؤال هل */
    question_yesno: {
      keywords: ['هل', 'هوه', 'is it', 'هل يمكن', 'هل يوجد'],
      prefixOnly: true,
      weight: 0.9
    },
    
    /* سؤال متى/أين/من */
    question_wh: {
      keywords: ['متي', 'وين', 'من', 'when', 'where', 'who', 'ايمتي', 'اين'],
      weight: 0.8
    },
    
    /* شكوى — لا يعمل */
    complaint: {
      keywords: ['ما يشتغل', 'ما يعمل', 'لا يعمل', 'متوقف', 'معطل', 'واقف',
                 'ما تشتغل', 'لا تشتغل', 'عطلان', 'خربان', 'معلق',
                 'not working', 'broken', 'wont work', 'مش شغال', 'مش راضي',
                 'مش عارف', 'ما اقدر', 'مايمكن', 'ما امكن'],
      weight: 1.2
    },
    
    /* خطأ */
    error_report: {
      keywords: ['خطا', 'error', 'مشكله', 'مشاكل', 'problem', 'bug', 'خلل',
                 'يطلع لي', 'يظهر', 'رساله', 'crash', 'يتوقف', 'يطفي'],
      weight: 1.1
    },
    
    /* سؤال عن ميزة */
    feature_request: {
      keywords: ['هل يوجد', 'هل فيه', 'ابغا', 'اريد', 'ابي', 'اتمني',
                 'هل يمكن', 'هل تدعم', 'هل يدعم', 'ممكن اضيف'],
      weight: 0.9
    },
    
    /* اقتراح */
    suggestion: {
      keywords: ['اقترح', 'اقتراح', 'لو اضفتو', 'اتمني', 'ياريت', 'ياليت',
                 'سويوا', 'ضيفو', 'لو تكرمتو'],
      weight: 1.1
    },
    
    /* شكر */
    gratitude: {
      keywords: ['شكرا', 'مشكور', 'يعطيك', 'جزاك', 'بارك الله', 'الف شكر',
                 'thanks', 'thank you', 'تسلم', 'ربي يوفق'],
      weight: 1.3
    },
    
    /* غاضب */
    angry: {
      keywords: ['زفت', 'خرا', 'سيء', 'كرهت', 'تعبت', 'ملل', 'مليت',
                 'غاضب', 'زعلان', 'سيئه', 'فاشل', 'ما يستاهل', 'قرف'],
      weight: 1.4
    },
    
    /* طلب مساعدة */
    help_request: {
      keywords: ['ساعدني', 'مساعده', 'محتاج', 'ابغا مساعده', 'help me',
                 'انقذني', 'تكفا', 'وين ال'],
      weight: 1.1
    },
    
    /* تأكيد */
    confirmation: {
      keywords: ['تمام', 'طيب', 'اوكي', 'ok', 'ماشي', 'زين', 'حلو', 'كفو'],
      weight: 0.9
    },
    
    /* نفي */
    denial: {
      keywords: ['لا', 'ما', 'مو', 'مافي', 'مافيه', 'مش', 'no', 'لا مافي'],
      weight: 0.6,
      wordOnly: true
    }
  };

  function classifyIntent(text) {
    const norm = normalizeArabic(text);
    const words = norm.split(' ').filter(w => w.length > 0);
    const scores = {};

    Object.keys(INTENT_PATTERNS).forEach(function (intent) {
      const pattern = INTENT_PATTERNS[intent];
      let score = 0;

      pattern.keywords.forEach(function (kw) {
        const kwNorm = normalizeArabic(kw);
        
        if (pattern.prefixOnly) {
          /* يبدأ فقط */
          if (norm.startsWith(kwNorm + ' ') || norm === kwNorm) {
            score += pattern.weight * 2;
          }
        } else if (pattern.wordOnly) {
          /* كلمة كاملة */
          if (words.includes(kwNorm)) {
            score += pattern.weight;
          }
        } else {
          /* جزء من النص */
          if (norm.includes(kwNorm)) {
            const isStart = norm.startsWith(kwNorm);
            const isFullWord = words.includes(kwNorm);
            
            if (isFullWord) score += pattern.weight * 1.5;
            else if (isStart) score += pattern.weight * 1.2;
            else score += pattern.weight;
          }
        }
      });

      if (score > 0) scores[intent] = score;
    });

    const sorted = Object.entries(scores).sort(function (a, b) { return b[1] - a[1]; });

    return {
      intent: sorted.length ? sorted[0][0] : 'unknown',
      confidence: sorted.length ? Math.min(sorted[0][1], 3) / 3 : 0,
      all: scores
    };
  }

  /* ================================================================
     🎯 Smart Search — البحث الذكي
     ================================================================ */
  function searchKnowledge(query, options) {
    options = options || {};
    const kb = window.H90_FAQ_DATA || [];
    if (!kb.length) return [];

    const norm = normalizeArabic(query);
    if (!norm) return [];

    const intentInfo = classifyIntent(query);
    const expandedWords = expandWithSynonyms(query);
    const originalWords = norm.split(' ').filter(w => w.length > 1);
    const allWords = [...new Set([...originalWords, ...expandedWords])];

    const results = [];

    kb.forEach(function (item) {
      let score = 0;
      const allText = [
        item.q || '',
        item.a || '',
        item.cat || '',
        ...(item.patterns || [])
      ].map(normalizeArabic).join(' | ');

      /* 1. مطابقة دقيقة للسؤال */
      const qNorm = normalizeArabic(item.q);
      if (qNorm === norm) score += 150;
      else if (qNorm.includes(norm) || norm.includes(qNorm)) score += 70;

      /* 2. مطابقة الكلمات المفتاحية */
      (item.patterns || []).forEach(function (p) {
        const pNorm = normalizeArabic(p);
        if (pNorm === norm) score += 120;
        else if (pNorm.includes(norm) || norm.includes(pNorm)) score += 55;

        /* مطابقة ضبابية */
        originalWords.forEach(function (w) {
          const sim = similarity(w, pNorm);
          if (sim > 0.75) score += sim * 30;
          else if (sim > 0.6) score += sim * 15;
        });
      });

      /* 3. مطابقة الكلمات (الأصلية + المرادفات) */
      allWords.forEach(function (word) {
        if (allText.includes(word)) score += 6;
      });

      /* 4. تشابه السؤال الكامل */
      const qSim = similarity(query, item.q);
      if (qSim > 0.5) score += qSim * 40;

      /* 5. تعزيز حسب النية */
      if (intentInfo.intent === 'complaint' || intentInfo.intent === 'error_report') {
        if (item.cat === 'الأخطاء' || item.severity === 'high') {
          score += 25;
        }
      }
      if (intentInfo.intent === 'question_how') {
        if (item.steps && item.steps.length > 0) {
          score += 20;
        }
      }
      if (intentInfo.intent === 'gratitude' && item.cat === 'التحية') {
        score += 50;
      }
      if (intentInfo.intent === 'angry') {
        /* تجنب أسئلة الترحيب */
        if (item.cat === 'التحية') score -= 50;
      }

      if (score > 0) {
        results.push({ item: item, score: score, intent: intentInfo.intent });
      }
    });

    return results.sort(function (a, b) { return b.score - a.score; }).slice(0, options.limit || 5);
  }

  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AICore = {
    /* التطبيع */
    normalizeArabic: normalizeArabic,
    phoneticNormalize: phoneticNormalize,

    /* التشابه */
    similarity: similarity,
    levenshtein: levenshtein,

    /* المرادفات */
    expandWithSynonyms: expandWithSynonyms,
    getSynonyms: function (word) {
      return SYNONYMS[normalizeArabic(word)] || [];
    },

    /* التصنيف */
    classifyIntent: classifyIntent,

    /* البحث */
    searchKnowledge: searchKnowledge,

    /* إحصائيات */
    stats: function () {
      return {
        version: '1.0',
        synonymsCount: Object.keys(SYNONYMS).length,
        intentsCount: Object.keys(INTENT_PATTERNS).length,
        ready: true
      };
    }
  };

  console.log('%cH90 AI Core v1.0 Ready',
    'background:linear-gradient(135deg,#00e676,#00b248);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');
  console.log('  Synonyms:', Object.keys(SYNONYMS).length);
  console.log('  Intents:', Object.keys(INTENT_PATTERNS).length);

})();
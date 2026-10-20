/* ================================================================
   H90 AI Context — v1.0
   ================================================================
   طبقة السياق والذاكرة للذكاء الاصطناعي
   ✅ Context Memory (يحفظ آخر 5 رسائل)
   ✅ Multi-turn Dialogue (حوار متعدد الخطوات)
   ✅ Smart Suggestions (اقتراحات ذكية حسب السياق)
   ✅ Reference Resolution (فهم "هذا" و "ذاك")
   ✅ Time-aware (يعرف الوقت: صباح/مساء)
   ================================================================ */

(function () {
  'use strict';

  console.log('H90 AI Context v1.0 loading...');

  /* ================================================================
     💾 Context State
     ================================================================ */
  const CONTEXT = {
    history: [],           /* آخر 5 رسائل */
    maxHistory: 5,
    lastCategory: null,
    lastIntent: null,
    lastTopic: null,       /* موضوع المحادثة */
    pendingQuestion: null, /* سؤال في انتظار إجابة */
    pendingOptions: [],    /* خيارات في انتظار إجابة */
    sessionStart: Date.now(),
    messageCount: 0
  };

  /* ================================================================
     💾 Storage Keys
     ================================================================ */
  const CONTEXT_KEY = 'h90_ai_context_v1';
  const SESSION_KEY = 'h90_ai_session_v1';

  /* ================================================================
     💾 حفظ/استرجاع السياق
     ================================================================ */
  function saveContext() {
    try {
      /* لا نحفظ الرسائل للحفاظ على الخصوصية */
      const toSave = {
        lastCategory: CONTEXT.lastCategory,
        lastIntent: CONTEXT.lastIntent,
        lastTopic: CONTEXT.lastTopic,
        sessionStart: CONTEXT.sessionStart
      };
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(toSave));
    } catch (e) {}
  }

  function loadContext() {
    try {
      const raw = localStorage.getItem(CONTEXT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      CONTEXT.lastCategory = data.lastCategory || null;
      CONTEXT.lastIntent = data.lastIntent || null;
      CONTEXT.lastTopic = data.lastTopic || null;
    } catch (e) {}
  }

  function clearContext() {
    CONTEXT.history = [];
    CONTEXT.lastCategory = null;
    CONTEXT.lastIntent = null;
    CONTEXT.lastTopic = null;
    CONTEXT.pendingQuestion = null;
    CONTEXT.pendingOptions = [];
    CONTEXT.messageCount = 0;
    try {
      localStorage.removeItem(CONTEXT_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    console.log('[H90 Context] Cleared');
  }

  /* ================================================================
     📝 إضافة رسالة للتاريخ
     ================================================================ */
  function addMessage(role, text, meta) {
    const message = {
      role: role, /* 'user' أو 'bot' */
      text: String(text || ''),
      timestamp: Date.now(),
      meta: meta || {}
    };

    CONTEXT.history.push(message);
    if (CONTEXT.history.length > CONTEXT.maxHistory) {
      CONTEXT.history.shift();
    }

    CONTEXT.messageCount++;

    /* تحديث آخر موضوع */
    if (role === 'user') {
      CONTEXT.lastTopic = extractTopic(text);
    }

    saveContext();
    return message;
  }

  /* ================================================================
     🎯 استخراج الموضوع من النص
     ================================================================ */
  function extractTopic(text) {
    const norm = window.H90AICore ? window.H90AICore.normalizeArabic(text) : text.toLowerCase();
    const words = norm.split(' ').filter(w => w.length > 2);

    const topics = {
      'صوت': ['صوت', 'audio', 'volume', 'ساوند', 'صوتيات'],
      'صورة': ['صورة', 'صوره', 'image', 'صور'],
      'فيديو': ['فيديو', 'فيلم', 'مقطع', 'video', 'movie'],
      'قناة': ['قناة', 'قناه', 'قنوات', 'بث', 'channel'],
      'جودة': ['جودة', 'جوده', 'quality', 'وضوح', 'دقة'],
      'ترجمة': ['ترجمة', 'ترجمه', 'subtitles', 'srt', 'vtt'],
      'إشعار': ['إشعار', 'اشعار', 'تنبيه', 'notification'],
      'حساب': ['حساب', 'account', 'مستخدم', 'user'],
      'بث خارجي': ['cast', 'chromecast', 'airplay', 'تلفزيون', 'تلفاز'],
      'مباريات': ['مباراة', 'مباراه', 'مباريات', 'match', 'فريق', 'ماتش'],
      'مشكلة': ['مشكلة', 'مشكله', 'خطأ', 'خطا', 'عطل', 'error'],
      'إعدادات': ['إعدادات', 'اعدادات', 'settings', 'ضبط'],
      'مفضلة': ['مفضلة', 'مفضله', 'favorite'],
      'لغة': ['لغة', 'لغه', 'language'],
      'تحميل': ['تحميل', 'تنزيل', 'download']
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      for (const kw of keywords) {
        if (norm.includes(window.H90AICore ? window.H90AICore.normalizeArabic(kw) : kw.toLowerCase())) {
          return topic;
        }
      }
    }

    return null;
  }

  /* ================================================================
     🔗 Reference Resolution — فهم "هذا" و "ذاك"
     ================================================================ */
  function resolveReference(text) {
    const norm = window.H90AICore ? window.H90AICore.normalizeArabic(text) : text.toLowerCase();
    const words = norm.split(' ');

    /* كلمات إشارة تحتاج مرجع */
    const referenceWords = ['هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي', 'هنا',
                            'كمان', 'ايضا', 'برضه', 'مثل', 'مثله', 'نفس',
                            'again', 'same', 'also'];

    const hasReference = words.some(w => referenceWords.includes(w));

    if (!hasReference) return null;

    /* ابحث في التاريخ عن آخر موضوع */
    if (CONTEXT.lastTopic) {
      return CONTEXT.lastTopic;
    }

    /* ابحث في آخر رسالة من المستخدم */
    for (let i = CONTEXT.history.length - 1; i >= 0; i--) {
      if (CONTEXT.history[i].role === 'user') {
        const topic = extractTopic(CONTEXT.history[i].text);
        if (topic) return topic;
      }
    }

    return null;
  }

  /* ================================================================
     🕐 Time-aware Greeting — تحية حسب الوقت
     ================================================================ */
  function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function getTimeGreeting() {
    const time = getTimeOfDay();
    const greetings = {
      morning:   'صباح الخير',
      afternoon: 'مساء النور',
      evening:   'مساء الخير',
      night:     'تصبح على خير'
    };
    return greetings[time] || 'أهلاً';
  }

  /* ================================================================
     🤝 Multi-turn Dialogue
     ================================================================ */

  /* كلمات تطلب توضيحاً */
  const UNCLEAR_PATTERNS = {
    /* جملة قصيرة جداً */
    too_short: {
      minWords: 2,
      test: function (text) {
        const words = text.split(' ').filter(w => w.length > 0);
        return words.length < 2;
      },
      response: 'أخبرني أكثر عن المشكلة من فضلك 😊\nمثلاً: "الصوت ما يشتغل" أو "القناة ما تفتح"'
    },

    /* ضمير بلا مرجع */
    pronoun_no_context: {
      test: function (text) {
        const norm = window.H90AICore ? window.H90AICore.normalizeArabic(text) : text.toLowerCase();
        const pronouns = ['هذا', 'هذه', 'هو', 'هي', 'ذلك', 'تلك'];
        const words = norm.split(' ');
        const hasPronoun = words.some(w => pronouns.includes(w));
        const veryShort = words.length <= 3;
        return hasPronoun && veryShort && !CONTEXT.lastTopic;
      },
      response: 'ما الذي تقصده تحديداً؟ 🤔\nاختر أحد المواضيع:\n• المشاهدة • الصوت • الجودة • الإشعارات'
    }
  };

  function checkUnclearMessage(text) {
    for (const [key, pattern] of Object.entries(UNCLEAR_PATTERNS)) {
      if (pattern.test(text)) {
        return {
          unclear: true,
          type: key,
          response: pattern.response
        };
      }
    }
    return { unclear: false };
  }

  /* ================================================================
     ❓ أسئلة توضيحية — تأخذ إجابات محددة
     ================================================================ */
  const CLARIFYING_QUESTIONS = {
    /* مشكلة عامة */
    general_problem: {
      question: 'أي نوع من المشاكل تواجه؟',
      options: [
        { id: 'playback', label: 'الفيديو لا يعمل', icon: 'play' },
        { id: 'audio', label: 'الصوت', icon: 'volume' },
        { id: 'video', label: 'الصورة أو الجودة', icon: 'video' },
        { id: 'network', label: 'الإنترنت أو البطء', icon: 'wifi' }
      ]
    },

    /* مشكلة صوت */
    audio_problem: {
      question: 'ما نوع مشكلة الصوت؟',
      options: [
        { id: 'no_sound', label: 'لا يوجد صوت' },
        { id: 'low_volume', label: 'الصوت منخفض' },
        { id: 'distorted', label: 'الصوت مشوش' },
        { id: 'sync', label: 'الصوت غير متزامن' }
      ]
    },

    /* مشكلة فيديو */
    video_problem: {
      question: 'ما نوع مشكلة الصورة؟',
      options: [
        { id: 'black_screen', label: 'الشاشة سوداء' },
        { id: 'low_quality', label: 'الجودة سيئة' },
        { id: 'stuttering', label: 'الصورة تتقطع' },
        { id: 'frozen', label: 'الصورة ثابتة' }
      ]
    },

    /* مشكلة شبكة */
    network_problem: {
      question: 'ما نوع مشكلة الشبكة؟',
      options: [
        { id: 'slow', label: 'الإنترنت بطيء' },
        { id: 'disconnect', label: 'الاتصال ينقطع' },
        { id: 'buffering', label: 'الفيديو يحمّل باستمرار' },
        { id: 'error', label: 'رسالة خطأ' }
      ]
    }
  };

  /* إذا كانت النية "شكوى" لكن الموضوع غير واضح */
  function needsClarification(intent, topic) {
    /* شكوى بلا موضوع */
    if ((intent === 'complaint' || intent === 'error_report') && !topic) {
      return 'general_problem';
    }

    /* شكوى صوت بلا تفاصيل */
    if (intent === 'complaint' && topic === 'صوت') {
      return 'audio_problem';
    }

    /* شكوى صورة بلا تفاصيل */
    if (intent === 'complaint' && topic === 'صورة') {
      return 'video_problem';
    }

    return null;
  }

  /* ================================================================
     💡 Smart Suggestions — اقتراحات ذكية
     ================================================================ */
  function getSmartSuggestions(currentTopic) {
    const suggestions = [];

    /* 1. اقتراحات حسب الموضوع الحالي */
    if (currentTopic) {
      const topicSuggestions = {
        'صوت': ['لماذا الصوت مكتوم؟', 'كيف أرفع الصوت؟', 'الصوت متأخر عن الصورة'],
        'صورة': ['الشاشة سوداء', 'كيف أُحسّن الجودة؟', 'الصورة مضغوطة'],
        'فيديو': ['الفيديو لا يبدأ', 'الفيديو يتوقف', 'كيف أغير الجودة؟'],
        'قناة': ['كيف أشاهد القنوات؟', 'لماذا لا تعمل بعض القنوات؟', 'كيف أُضيف قناة للمفضلة؟'],
        'جودة': ['كيف أرفع الجودة؟', 'الجودة تلقائية؟', 'كيف أقلل استهلاك البيانات؟'],
        'ترجمة': ['كيف أُضيف ترجمة؟', 'الترجمة لا تظهر', 'الترجمة متأخرة'],
        'إشعار': ['كيف أُفعّل الإشعارات؟', 'لماذا لا تصلني إشعارات المباريات؟', 'كيف أغير صوت الإشعار؟'],
        'حساب': ['كيف أُسجل الدخول؟', 'نسيت كلمة المرور', 'كيف أحذف الحساب؟'],
        'بث خارجي': ['كيف أبث للتلفاز؟', 'Chromecast لا يعمل', 'AirPlay لا يظهر'],
        'مباريات': ['كيف أعرف مواعيد المباريات؟', 'كيف أُضيف تذكير؟', 'القناة الناقلة؟'],
        'مشكلة': ['التطبيق بطيء', 'التطبيق يُغلق', 'الجهاز يسخن'],
        'إعدادات': ['كيف أغير الثيم؟', 'كيف أُغيّر حجم الخط؟', 'كيف أمسح البيانات؟'],
        'مفضلة': ['كيف أُضيف للمفضلة؟', 'كيف أحذف من المفضلة؟', 'أين أجد المفضلة؟'],
        'تحميل': ['هل يمكن التحميل؟', 'كيف أحفظ الفيديو؟', 'المشاهدة بدون إنترنت']
      };

      if (topicSuggestions[currentTopic]) {
        suggestions.push(...topicSuggestions[currentTopic]);
      }
    }

    /* 2. اقتراحات حسب الوقت */
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      /* ساعات متأخرة */
      if (!suggestions.includes('مؤقت النوم')) {
        suggestions.push('كيف أستخدم مؤقت النوم؟');
      }
    }

    /* 3. اقتراحات عامة */
    const general = [
      'كيف أشاهد القنوات؟',
      'كيف أُضيف قناة للمفضلة؟',
      'كيف أبث للتلفاز؟',
      'كيف أُفعّل الإشعارات؟',
      'لماذا الفيديو يتوقف؟',
      'كيف أُغير الجودة؟'
    ];

    /* إزالة التكرار */
    general.forEach(function (s) {
      if (!suggestions.includes(s)) suggestions.push(s);
    });

    /* 4. إرجاع أفضل 4 */
    return [...new Set(suggestions)].slice(0, 4);
  }

  /* ================================================================
     🎯 Context-aware Response
     ================================================================ */
  function enhanceWithContext(userMessage, result) {
    /* إذا لم تُوجد إجابة */
    if (!result || result.type === 'no_match') {
      /* حاول حل الإشارة */
      const topic = resolveReference(userMessage);
      if (topic) {
        return {
          ...result,
          answer: 'يبدو أنك تسأل عن "' + topic + '" مرة أخرى.\n\n' + result.answer,
          contextTopic: topic
        };
      }
    }

    /* إذا كانت الشكوى واضحة */
    if (result && result.type === 'success') {
      result.contextTopic = CONTEXT.lastTopic;
      result.historyLength = CONTEXT.history.length;
    }

    return result;
  }

  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AIContext = {
    /* إدارة الرسائل */
    addMessage: addMessage,
    getHistory: function () {
      return CONTEXT.history.slice();
    },
    getHistoryLength: function () {
      return CONTEXT.history.length;
    },

    /* استخراج معلومات */
    extractTopic: extractTopic,
    resolveReference: resolveReference,

    /* الوقت */
    getTimeOfDay: getTimeOfDay,
    getTimeGreeting: getTimeGreeting,

    /* حوار متعدد */
    checkUnclearMessage: checkUnclearMessage,
    needsClarification: needsClarification,
    getClarifyingQuestion: function (type) {
      return CLARIFYING_QUESTIONS[type] || null;
    },

    /* اقتراحات */
    getSmartSuggestions: getSmartSuggestions,

    /* تحسين الإجابة */
    enhanceWithContext: enhanceWithContext,

    /* إدارة السياق */
    clearContext: clearContext,
    getState: function () {
      return {
        lastCategory: CONTEXT.lastCategory,
        lastIntent: CONTEXT.lastIntent,
        lastTopic: CONTEXT.lastTopic,
        messageCount: CONTEXT.messageCount,
        historyLength: CONTEXT.history.length,
        sessionDuration: Math.floor((Date.now() - CONTEXT.sessionStart) / 1000)
      };
    },

    /* تحديث المعلومات */
    setLastCategory: function (cat) {
      CONTEXT.lastCategory = cat;
      saveContext();
    },
    setLastIntent: function (intent) {
      CONTEXT.lastIntent = intent;
      saveContext();
    },

    /* إعدادات */
    setMaxHistory: function (n) {
      CONTEXT.maxHistory = Math.max(3, Math.min(n, 10));
    },

    /* إحصائيات */
    stats: function () {
      return {
        version: '1.0',
        maxHistory: CONTEXT.maxHistory,
        historyLength: CONTEXT.history.length,
        sessionStart: CONTEXT.sessionStart,
        ready: true
      };
    }
  };

  /* التهيئة */
  loadContext();

  console.log('%cH90 AI Context v1.0 Ready',
    'background:linear-gradient(135deg,#9c27b0,#7b1fa2);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');
  console.log('  Max History:', CONTEXT.maxHistory);
  console.log('  Time:', getTimeOfDay());

})();
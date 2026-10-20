/* ================================================================
   H90 AI Diagnosis — v1.0
   ================================================================
   طبقة التشخيص الذاتي والتعلم
   ✅ Auto-Diagnosis (يكشف المشاكل تلقائياً)
   ✅ Feedback Learning (يتعلم من 👍/👎)
   ✅ System Health Check (فحص صحة التطبيق)
   ✅ Context-aware Solutions (حلول مخصصة للحالة)
   ================================================================ */

(function () {
  'use strict';

  console.log('H90 AI Diagnosis v1.0 loading...');

  /* ================================================================
     📊 Feedback Storage
     ================================================================ */
  const FEEDBACK_KEY = 'h90_ai_feedback_v1';
  const LEARNING_KEY = 'h90_ai_learning_v1';

  function getFeedback() {
    try {
      return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function saveFeedback(data) {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getLearning() {
    try {
      return JSON.parse(localStorage.getItem(LEARNING_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function saveLearning(data) {
    try {
      /* حد أقصى 300 مدخل */
      const keys = Object.keys(data);
      if (keys.length > 300) {
        keys.slice(0, 100).forEach(function (k) { delete data[k]; });
      }
      localStorage.setItem(LEARNING_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /* ================================================================
     📊 System Health Check
     ================================================================ */
  function checkInternet() {
    return {
      available: navigator.onLine,
      effectiveType: (navigator.connection && navigator.connection.effectiveType) || 'unknown',
      downlink: (navigator.connection && navigator.connection.downlink) || 0,
      rtt: (navigator.connection && navigator.connection.rtt) || 0,
      saveData: (navigator.connection && navigator.connection.saveData) || false
    };
  }

  function checkVideoElement() {
    const video = document.getElementById('videoPlayer');
    if (!video) return { exists: false };

    return {
      exists: true,
      hasSource: !!video.src || !!video.currentSrc || !!video._hls,
      readyState: video.readyState, /* 0-4 */
      networkState: video.networkState, /* 0-3 */
      paused: video.paused,
      ended: video.ended,
      duration: video.duration || 0,
      currentTime: video.currentTime || 0,
      buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
      error: video.error ? {
        code: video.error.code,
        message: video.error.message
      } : null
    };
  }

  function checkPlayerPage() {
    const playerPage = document.getElementById('playerPage');
    const playerContainer = document.getElementById('playerContainer');
    const playerLoading = document.getElementById('playerLoading');

    return {
      pageVisible: playerPage ? playerPage.classList.contains('show') : false,
      containerExists: !!playerContainer,
      loadingVisible: playerLoading ? playerLoading.classList.contains('show') : false
    };
  }

  function checkStorage() {
    try {
      const used = JSON.stringify(localStorage).length;
      const limit = 5 * 1024 * 1024;
      return {
        available: true,
        used: used,
        usedPercent: Math.round((used / limit) * 100),
        itemCount: localStorage.length
      };
    } catch (e) {
      return { available: false };
    }
  }

  function checkPerformance() {
    if (!window.performance || !window.performance.memory) {
      return { available: false };
    }
    return {
      available: true,
      usedJSHeapSize: window.performance.memory.usedJSHeapSize,
      totalJSHeapSize: window.performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
    };
  }

  function checkEnvironment() {
    return {
      isAPK: !!window.__H90_APK_MODE__,
      hasCapacitor: !!window.Capacitor,
      hasFirebase: !!(window.H90Firebase && window.H90Firebase.isReady && window.H90Firebase.isReady()),
      notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      userAgent: navigator.userAgent,
      isOnline: navigator.onLine,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  /* ================================================================
     🩺 Full Health Check
     ================================================================ */
  function runFullDiagnosis() {
    return {
      timestamp: Date.now(),
      internet: checkInternet(),
      video: checkVideoElement(),
      player: checkPlayerPage(),
      storage: checkStorage(),
      performance: checkPerformance(),
      environment: checkEnvironment()
    };
  }

  /* ================================================================
     🎯 Auto-Diagnosis — كشف المشكلة
     ================================================================ */
  function diagnoseFromContext() {
    const diag = runFullDiagnosis();
    const problems = [];
    const solutions = [];

    /* 1. لا إنترنت */
    if (!diag.internet.available) {
      problems.push({
        id: 'no_internet',
        severity: 'high',
        title: 'لا يوجد اتصال بالإنترنت'
      });
      solutions.push({
        problem: 'no_internet',
        steps: [
          'تحقق من Wi-Fi أو بيانات الجوال',
          'أعد تشغيل الراوتر',
          'فعّل وضع الطيران وألغِه'
        ]
      });
    }

    /* 2. شبكة ضعيفة */
    if (diag.internet.available && diag.internet.downlink > 0 && diag.internet.downlink < 2) {
      problems.push({
        id: 'slow_network',
        severity: 'medium',
        title: 'شبكة الإنترنت بطيئة (' + diag.internet.downlink.toFixed(1) + ' Mbps)'
      });
      solutions.push({
        problem: 'slow_network',
        steps: [
          'قلل جودة الفيديو',
          'اقترب من الراوتر',
          'أغلق التطبيقات الأخرى'
        ]
      });
    }

    /* 3. مشغل الفيديو — لا يوجد مصدر */
    if (diag.player.pageVisible && diag.video.exists && !diag.video.hasSource) {
      problems.push({
        id: 'no_source',
        severity: 'high',
        title: 'الفيديو لم يُحمَّل بعد'
      });
      solutions.push({
        problem: 'no_source',
        steps: [
          'انتظر قليلاً',
          'أعد تحميل القناة',
          'اختر جودة أقل'
        ]
      });
    }

    /* 4. خطأ في الفيديو */
    if (diag.video.error) {
      const errorMessages = {
        1: 'تم إلغاء التحميل',
        2: 'خطأ في الشبكة',
        3: 'خطأ في فك الترميز',
        4: 'الصيغة غير مدعومة'
      };
      problems.push({
        id: 'video_error',
        severity: 'high',
        title: 'خطأ في الفيديو: ' + (errorMessages[diag.video.error.code] || 'غير معروف'),
        code: diag.video.error.code
      });
      solutions.push({
        problem: 'video_error',
        steps: [
          'أعد تحميل القناة',
          'جرّب قناة أخرى',
          'أعد تشغيل التطبيق'
        ]
      });
    }

    /* 5. عالق في التحميل */
    if (diag.player.loadingVisible && diag.video.exists && diag.video.readyState < 2) {
      problems.push({
        id: 'stuck_loading',
        severity: 'high',
        title: 'الفيديو عالق في التحميل'
      });
      solutions.push({
        problem: 'stuck_loading',
        steps: [
          'انتظر 30 ثانية',
          'اضغط زر التحديث',
          'قلل الجودة'
        ]
      });
    }

    /* 6. التخزين ممتلئ */
    if (diag.storage.available && diag.storage.usedPercent > 80) {
      problems.push({
        id: 'storage_full',
        severity: 'medium',
        title: 'مساحة التخزين ممتلئة (' + diag.storage.usedPercent + '%)'
      });
      solutions.push({
        problem: 'storage_full',
        steps: [
          'امسح البيانات من الإعدادات',
          'احذف المفضلة القديمة'
        ]
      });
    }

    /* 7. الإشعارات غير مفعلة */
    if (diag.environment.notifications === 'default') {
      problems.push({
        id: 'notif_disabled',
        severity: 'low',
        title: 'الإشعارات غير مفعلة'
      });
    }

    /* 8. وضع توفير البيانات */
    if (diag.internet.saveData) {
      problems.push({
        id: 'save_data_on',
        severity: 'low',
        title: 'وضع توفير البيانات مُفعّل'
      });
      solutions.push({
        problem: 'save_data_on',
        steps: [
          'الجودة التلقائية قد تكون منخفضة',
          'أوقف توفير البيانات للحصول على جودة أفضل'
        ]
      });
    }

    return {
      health: problems.length === 0 ? 'good' : problems.length <= 2 ? 'fair' : 'poor',
      problems: problems,
      solutions: solutions,
      details: diag
    };
  }

  /* ================================================================
     🎯 Diagnosis based on user message
     ================================================================ */
  function smartDiagnose(userMessage) {
    const diag = diagnoseFromContext();
    const norm = window.H90AICore ? window.H90AICore.normalizeArabic(userMessage) : userMessage.toLowerCase();

    /* كلمات تشير لمشاكل محتملة */
    const keywords = {
      'صوت': ['صوت', 'audio', 'volume', 'ساوند', 'سمع'],
      'صورة': ['صورة', 'صوره', 'شاشة', 'screen', 'black'],
      'فيديو': ['فيديو', 'فيلم', 'مقطع', 'video', 'movie'],
      'بطء': ['بطي', 'slow', 'ثقيل', 'lag', 'بطء'],
      'تعليق': ['معلق', 'فريز', 'frozen', 'stuck', 'عالق', 'يتوقف'],
      'إغلاق': ['يغلق', 'يخرج', 'crash', 'يسكر', 'يطفي'],
      'حرارة': ['سخن', 'حار', 'حرارة', 'hot', 'يسخن'],
      'بيانات': ['بيانات', 'data', 'استهلاك', 'جيجا', 'ميجا']
    };

    const matched = [];
    Object.keys(keywords).forEach(function (key) {
      keywords[key].forEach(function (kw) {
        if (norm.includes(window.H90AICore ? window.H90AICore.normalizeArabic(kw) : kw)) {
          if (!matched.includes(key)) matched.push(key);
        }
      });
    });

    return {
      diagnosis: diag,
      categories: matched,
      autoSolution: diag.solutions.length > 0 ? diag.solutions[0] : null
    };
  }

  /* ================================================================
     📝 صياغة رد تشخيصي
     ================================================================ */
  function formatDiagnosisResponse(diagnosis) {
    if (!diagnosis || !diagnosis.problems.length) {
      return null; /* لا مشاكل — اترك الرد الاعتيادي */
    }

    const problems = diagnosis.problems;
    const solutions = diagnosis.solutions;

    /* إذا كانت مشكلة واحدة خطيرة → رد فوري */
    if (problems.length === 1 && problems[0].severity === 'high') {
      const p = problems[0];
      const s = solutions.find(function (x) { return x.problem === p.id; });

      let response = 'لاحظت مشكلة في التطبيق:\n\n';
      response += '⚠ ' + p.title + '\n\n';
      response += 'الحل المقترح:\n';
      if (s && s.steps) {
        s.steps.forEach(function (step, i) {
          response += (i + 1) + '. ' + step + '\n';
        });
      }
      return response;
    }

    /* إذا كانت مشاكل متعددة → عرض موجز */
    if (problems.length > 1) {
      let response = 'لاحظت بعض الأمور:\n\n';
      problems.forEach(function (p, i) {
        const icon = p.severity === 'high' ? '⚠' : p.severity === 'medium' ? '●' : '○';
        response += icon + ' ' + p.title + '\n';
      });
      response += '\nهل تريد حلولاً للمشاكل أعلاه؟';
      return response;
    }

    return null;
  }

  /* ================================================================
     👍👎 Feedback System
     ================================================================ */
  function getMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  function recordFeedback(messageId, question, answer, isHelpful) {
    const feedback = getFeedback();

    feedback[messageId] = {
      question: question,
      answer: answer,
      helpful: isHelpful,
      timestamp: Date.now()
    };

    saveFeedback(feedback);

    /* إذا لم تكن الإجابة مفيدة → سجلها للتعلم */
    if (!isHelpful) {
      const learning = getLearning();
      const qKey = window.H90AICore ? window.H90AICore.normalizeArabic(question) : question.toLowerCase();

      learning[qKey] = {
        question: question,
        wrongAnswer: answer,
        count: (learning[qKey] ? learning[qKey].count : 0) + 1,
        timestamp: Date.now()
      };

      saveLearning(learning);
    }

    return { ok: true, recorded: messageId };
  }

  /* ================================================================
     📊 Feedback Stats
     ================================================================ */
  function getFeedbackStats() {
    const feedback = getFeedback();
    const entries = Object.values(feedback);

    if (!entries.length) {
      return {
        total: 0,
        helpful: 0,
        unhelpful: 0,
        helpfulRate: 0
      };
    }

    const helpful = entries.filter(function (e) { return e.helpful; }).length;
    const unhelpful = entries.length - helpful;

    return {
      total: entries.length,
      helpful: helpful,
      unhelpful: unhelpful,
      helpfulRate: Math.round((helpful / entries.length) * 100)
    };
  }

  /* ================================================================
     🧠 Learning — use feedback to improve
     ================================================================ */
  function checkIfKnownBadAnswer(question) {
    const learning = getLearning();
    const qKey = window.H90AICore ? window.H90AICore.normalizeArabic(question) : question.toLowerCase();

    /* بحث دقيق */
    if (learning[qKey]) {
      return learning[qKey];
    }

    /* بحث ضبابي */
    const keys = Object.keys(learning);
    for (let i = 0; i < keys.length; i++) {
      const sim = window.H90AICore ? window.H90AICore.similarity(keys[i], qKey) : 0;
      if (sim > 0.9) {
        return learning[keys[i]];
      }
    }

    return null;
  }

  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AIDiagnosis = {
    /* تشخيص */
    runFullDiagnosis: runFullDiagnosis,
    diagnoseFromContext: diagnoseFromContext,
    smartDiagnose: smartDiagnose,
    formatDiagnosisResponse: formatDiagnosisResponse,

    /* فحوصات فردية */
    checkInternet: checkInternet,
    checkVideoElement: checkVideoElement,
    checkPlayerPage: checkPlayerPage,
    checkStorage: checkStorage,
    checkPerformance: checkPerformance,
    checkEnvironment: checkEnvironment,

    /* Feedback */
    recordFeedback: recordFeedback,
    getFeedbackStats: getFeedbackStats,
    getMessageId: getMessageId,

    /* Learning */
    checkIfKnownBadAnswer: checkIfKnownBadAnswer,

    /* إدارة */
    clearFeedback: function () {
      try {
        localStorage.removeItem(FEEDBACK_KEY);
        localStorage.removeItem(LEARNING_KEY);
        return true;
      } catch (e) { return false; }
    },

    /* إحصائيات */
    stats: function () {
      return {
        version: '1.0',
        feedback: getFeedbackStats(),
        learningCount: Object.keys(getLearning()).length,
        ready: true
      };
    }
  };

  console.log('%cH90 AI Diagnosis v1.0 Ready',
    'background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');

  /* فحص أولي */
  setTimeout(function () {
    const diag = diagnoseFromContext();
    console.log('  Initial health:', diag.health);
    if (diag.problems.length) {
      console.log('  Problems detected:', diag.problems.length);
    }
  }, 1000);

})();
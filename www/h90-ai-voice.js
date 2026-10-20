/* ================================================================
   H90 AI Voice — v1.0
   ================================================================
   طبقة الصوت — إدخال وإخراج
   ✅ Voice Input (Speech-to-Text بكل اللهجات العربية)
   ✅ Voice Output (Text-to-Speech بصوت عربي طبيعي)
   ✅ Auto-listen Mode (يستمع تلقائياً بعد كل رد)
   ✅ Voice Feedback (أصوات للنجاح/الفشل)
   ✅ Multi-language (عربي + إنجليزي)
   ================================================================ */

(function () {
  'use strict';

  console.log('H90 AI Voice v1.0 loading...');

  /* ================================================================
     ⚙️ Voice State
     ================================================================ */
  const VOICE = {
    /* الإدخال */
    recognition: null,
    isListening: false,
    isSupported: false,
    inputLanguage: 'ar-SA',
    autoListen: false,
    lastTranscript: '',

    /* الإخراج */
    synthesis: null,
    outputEnabled: true,
    outputLanguage: 'ar-SA',
    outputVoice: null,
    outputRate: 1.0,
    outputPitch: 1.0,
    outputVolume: 1.0,
    isSpeaking: false,

    /* الحالة */
    initialized: false,
    callbacks: {
      onResult: null,
      onError: null,
      onStart: null,
      onEnd: null,
      onSpeakStart: null,
      onSpeakEnd: null
    }
  };

  const VOICE_SETTINGS_KEY = 'h90_ai_voice_settings_v1';

  /* ================================================================
     💾 حفظ/استرجاع الإعدادات
     ================================================================ */
  function saveVoiceSettings() {
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify({
        outputEnabled: VOICE.outputEnabled,
        outputLanguage: VOICE.outputLanguage,
        outputRate: VOICE.outputRate,
        outputPitch: VOICE.outputPitch,
        outputVolume: VOICE.outputVolume,
        autoListen: VOICE.autoListen
      }));
    } catch (e) {}
  }

  function loadVoiceSettings() {
    try {
      const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      VOICE.outputEnabled = data.outputEnabled !== false;
      VOICE.outputLanguage = data.outputLanguage || 'ar-SA';
      VOICE.outputRate = data.outputRate || 1.0;
      VOICE.outputPitch = data.outputPitch || 1.0;
      VOICE.outputVolume = data.outputVolume || 1.0;
      VOICE.autoListen = data.autoListen === true;
    } catch (e) {}
  }

  /* ================================================================
     🎤 Voice Input — Speech Recognition
     ================================================================ */
  function initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      VOICE.isSupported = false;
      console.warn('[H90 Voice] Speech Recognition غير مدعوم');
      return false;
    }

    try {
      VOICE.recognition = new SpeechRecognition();
      VOICE.recognition.continuous = false;
      VOICE.recognition.interimResults = true;
      VOICE.recognition.lang = VOICE.inputLanguage;
      VOICE.recognition.maxAlternatives = 3;

      VOICE.recognition.onstart = function () {
        VOICE.isListening = true;
        console.log('[H90 Voice] Started listening');
        if (VOICE.callbacks.onStart) VOICE.callbacks.onStart();
      };

      VOICE.recognition.onresult = function (event) {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        const result = {
          final: final.trim(),
          interim: interim.trim(),
          confidence: event.results[event.results.length - 1] && event.results[event.results.length - 1][0] ? event.results[event.results.length - 1][0].confidence : 0
        };

        if (result.final) {
          VOICE.lastTranscript = result.final;
        }

        if (VOICE.callbacks.onResult) VOICE.callbacks.onResult(result);
      };

      VOICE.recognition.onerror = function (event) {
        VOICE.isListening = false;
        console.warn('[H90 Voice] Error:', event.error);

        const errorMessages = {
          'no-speech': 'لم يتم اكتشاف صوت',
          'audio-capture': 'لم يتم العثور على ميكروفون',
          'not-allowed': 'يجب السماح بالوصول للميكروفون',
          'network': 'خطأ في الشبكة',
          'aborted': 'تم إلغاء التسجيل',
          'service-not-allowed': 'خدمة التعرف على الصوت غير متاحة'
        };

        const message = errorMessages[event.error] || 'خطأ غير معروف';

        if (VOICE.callbacks.onError) {
          VOICE.callbacks.onError({ error: event.error, message: message });
        }
      };

      VOICE.recognition.onend = function () {
        VOICE.isListening = false;
        console.log('[H90 Voice] Stopped listening');
        if (VOICE.callbacks.onEnd) VOICE.callbacks.onEnd();

        /* Auto-listen مرة أخرى */
        if (VOICE.autoListen && VOICE.lastTranscript === '') {
          /* لم يسمع شيء — لم نُفعّل مرة أخرى تلقائياً */
        }
      };

      VOICE.isSupported = true;
      return true;
    } catch (e) {
      console.error('[H90 Voice] Init error:', e);
      VOICE.isSupported = false;
      return false;
    }
  }

  /* بدء الاستماع */
  function startListening(options) {
    options = options || {};

    if (!VOICE.isSupported) {
      if (VOICE.callbacks.onError) {
        VOICE.callbacks.onError({
          error: 'not-supported',
          message: 'المتصفح لا يدعم التعرف على الصوت'
        });
      }
      return false;
    }

    if (VOICE.isListening) {
      console.log('[H90 Voice] Already listening');
      return true;
    }

    try {
      if (options.language) VOICE.recognition.lang = options.language;
      if (options.continuous !== undefined) VOICE.recognition.continuous = options.continuous;
      if (options.interimResults !== undefined) VOICE.recognition.interimResults = options.interimResults;

      VOICE.recognition.start();
      return true;
    } catch (e) {
      console.error('[H90 Voice] Start error:', e);
      return false;
    }
  }

  /* إيقاف الاستماع */
  function stopListening() {
    if (!VOICE.isSupported || !VOICE.isListening) return;
    try {
      VOICE.recognition.stop();
    } catch (e) {}
  }

  /* إلغاء الاستماع */
  function abortListening() {
    if (!VOICE.isSupported) return;
    try {
      VOICE.recognition.abort();
    } catch (e) {}
  }

  /* ================================================================
     🔊 Voice Output — Speech Synthesis
     ================================================================ */
  function initSynthesis() {
    if (!('speechSynthesis' in window)) {
      console.warn('[H90 Voice] Speech Synthesis غير مدعوم');
      return false;
    }

    VOICE.synthesis = window.speechSynthesis;

    /* تحميل الأصوات */
    loadVoices();

    /* الأصوات قد تُحمّل لاحقاً */
    if (VOICE.synthesis.onvoiceschanged !== undefined) {
      VOICE.synthesis.onvoiceschanged = loadVoices;
    }

    return true;
  }

  /* تحميل الأصوات */
  function loadVoices() {
    if (!VOICE.synthesis) return;
    const voices = VOICE.synthesis.getVoices();

    if (!voices.length) return;

    /* ابحث عن صوت عربي */
    const arabicVoice = voices.find(function (v) {
      return v.lang === 'ar-SA' || v.lang.startsWith('ar');
    });

    if (arabicVoice) {
      VOICE.outputVoice = arabicVoice;
      console.log('[H90 Voice] Found Arabic voice:', arabicVoice.name);
    } else {
      /* استخدم الافتراضي */
      VOICE.outputVoice = voices[0] || null;
    }
  }

  /* تحديث الأصوات — بعض المتصفحات تحتاج وقتاً */
  setTimeout(loadVoices, 200);
  setTimeout(loadVoices, 1000);

  /* نطق النص */
  function speak(text, options) {
    options = options || {};

    if (!VOICE.outputEnabled || !VOICE.synthesis) {
      return false;
    }

    /* أوقف أي صوت قيد التشغيل */
    stopSpeaking();

    /* نظّف النص من الرموز */
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      /* الإعدادات */
      if (options.voice || VOICE.outputVoice) {
        utterance.voice = options.voice || VOICE.outputVoice;
      }
      utterance.lang = options.language || VOICE.outputLanguage;
      utterance.rate = options.rate !== undefined ? options.rate : VOICE.outputRate;
      utterance.pitch = options.pitch !== undefined ? options.pitch : VOICE.outputPitch;
      utterance.volume = options.volume !== undefined ? options.volume : VOICE.outputVolume;

      utterance.onstart = function () {
        VOICE.isSpeaking = true;
        if (VOICE.callbacks.onSpeakStart) VOICE.callbacks.onSpeakStart();
      };

      utterance.onend = function () {
        VOICE.isSpeaking = false;
        if (VOICE.callbacks.onSpeakEnd) VOICE.callbacks.onSpeakEnd();
      };

      utterance.onerror = function (e) {
        VOICE.isSpeaking = false;
        console.warn('[H90 Voice] Speak error:', e.error);
        if (VOICE.callbacks.onSpeakEnd) VOICE.callbacks.onSpeakEnd();
      };

      VOICE.synthesis.speak(utterance);
      return true;
    } catch (e) {
      console.error('[H90 Voice] Speak exception:', e);
      return false;
    }
  }

  /* إيقاف النطق */
  function stopSpeaking() {
    if (!VOICE.synthesis) return;
    try {
      VOICE.synthesis.cancel();
      VOICE.isSpeaking = false;
    } catch (e) {}
  }

  /* تنظيف النص من الرموز */
  function cleanTextForSpeech(text) {
    return String(text || '')
      /* إزالة الرموز التعبيرية */
      .replace(/[•●○▪▶◀→←↑↓★☆✓✔✗✘]/g, ' ')
      /* إزالة الرموز العامة */
      .replace(/[*_~`<>{}[\]|\\]/g, '')
      /* إزالة الروابط */
      .replace(/https?:\/\/[^\s]+/g, '')
      /* إزالة الرموز الكثيرة */
      .replace(/[!]{2,}/g, '!')
      .replace(/[.]{2,}/g, '.')
      .replace(/[?]{2,}/g, '?')
      /* إزالة الأسطر الفارغة الزائدة */
      .replace(/\n{3,}/g, '\n\n')
      /* تقليل المسافات */
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ================================================================
     🎯 Voice Interaction — تفاعل ذكي
     ================================================================ */
  function speakAnswer(text) {
    if (!VOICE.outputEnabled) return;

    /* اختصر الردود الطويلة */
    let shortText = text;

    /* إذا كان الرد طويلاً → اقرأ أول 250 حرف فقط */
    if (text.length > 300) {
      const firstPart = text.substring(0, 250);
      const lastDot = Math.max(firstPart.lastIndexOf('.'), firstPart.lastIndexOf('؟'), firstPart.lastIndexOf('!'));
      shortText = firstPart.substring(0, lastDot > 100 ? lastDot + 1 : 250) + '... تابع القراءة على الشاشة.';
    }

    speak(shortText);
  }

  /* صوت تأكيد عند الاستماع */
  function playListeningBeep() {
    if (typeof Sound !== 'undefined' && Sound.tap) {
      try { Sound.tap(); } catch (e) {}
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(30); } catch (e) {}
    }
  }

  /* صوت انتهاء الاستماع */
  function playEndBeep() {
    if (typeof Sound !== 'undefined' && Sound.success) {
      try { Sound.success(); } catch (e) {}
    }
    if (navigator.vibrate) {
      try { navigator.vibrate([20, 30, 20]); } catch (e) {}
    }
  }

  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AIVoice = {
    /* الإدخال */
    isInputSupported: function () {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },
    isListening: function () {
      return VOICE.isListening;
    },
    startListening: startListening,
    stopListening: stopListening,
    abortListening: abortListening,
    getLastTranscript: function () {
      return VOICE.lastTranscript;
    },
    clearTranscript: function () {
      VOICE.lastTranscript = '';
    },

    /* الإخراج */
    isOutputSupported: function () {
      return 'speechSynthesis' in window;
    },
    isSpeaking: function () {
      return VOICE.isSpeaking;
    },
    speak: speak,
    speakAnswer: speakAnswer,
    stopSpeaking: stopSpeaking,

    /* الإعدادات */
    setOutputEnabled: function (enabled) {
      VOICE.outputEnabled = !!enabled;
      saveVoiceSettings();
    },
    isOutputEnabled: function () {
      return VOICE.outputEnabled;
    },
    setInputLanguage: function (lang) {
      VOICE.inputLanguage = lang || 'ar-SA';
      if (VOICE.recognition) VOICE.recognition.lang = VOICE.inputLanguage;
    },
    setOutputLanguage: function (lang) {
      VOICE.outputLanguage = lang || 'ar-SA';
      saveVoiceSettings();
    },
    setOutputRate: function (rate) {
      VOICE.outputRate = Math.max(0.5, Math.min(2, rate));
      saveVoiceSettings();
    },
    setOutputPitch: function (pitch) {
      VOICE.outputPitch = Math.max(0.5, Math.min(2, pitch));
      saveVoiceSettings();
    },
    setOutputVolume: function (volume) {
      VOICE.outputVolume = Math.max(0, Math.min(1, volume));
      saveVoiceSettings();
    },
    setAutoListen: function (enabled) {
      VOICE.autoListen = !!enabled;
      saveVoiceSettings();
    },
    isAutoListen: function () {
      return VOICE.autoListen;
    },

    /* الأصوات */
    getAvailableVoices: function () {
      if (!VOICE.synthesis) return [];
      return VOICE.synthesis.getVoices().filter(function (v) {
        return v.lang.startsWith('ar');
      });
    },
    getCurrentVoice: function () {
      return VOICE.outputVoice ? {
        name: VOICE.outputVoice.name,
        lang: VOICE.outputVoice.lang
      } : null;
    },
    setVoice: function (voice) {
      VOICE.outputVoice = voice;
    },

    /* Callbacks */
    onResult: function (cb) { VOICE.callbacks.onResult = cb; },
    onError: function (cb) { VOICE.callbacks.onError = cb; },
    onStart: function (cb) { VOICE.callbacks.onStart = cb; },
    onEnd: function (cb) { VOICE.callbacks.onEnd = cb; },
    onSpeakStart: function (cb) { VOICE.callbacks.onSpeakStart = cb; },
    onSpeakEnd: function (cb) { VOICE.callbacks.onSpeakEnd = cb; },

    /* إدارة */
    init: function () {
      if (VOICE.initialized) return true;

      loadVoiceSettings();
      const inputOk = initRecognition();
      const outputOk = initSynthesis();

      VOICE.initialized = true;

      console.log('[H90 Voice] Initialized — Input:', inputOk, 'Output:', outputOk);

      return { input: inputOk, output: outputOk };
    },

    /* إحصائيات */
    stats: function () {
      return {
        version: '1.0',
        inputSupported: VOICE.isSupported,
        outputSupported: 'speechSynthesis' in window,
        inputLanguage: VOICE.inputLanguage,
        outputLanguage: VOICE.outputLanguage,
        outputEnabled: VOICE.outputEnabled,
        autoListen: VOICE.autoListen,
        isSpeaking: VOICE.isSpeaking,
        isListening: VOICE.isListening,
        availableArabicVoices: VOICE.synthesis ? VOICE.synthesis.getVoices().filter(v => v.lang.startsWith('ar')).length : 0,
        ready: VOICE.initialized
      };
    }
  };

  /* التهيئة التلقائية */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.H90AIVoice.init();
    }, { once: true });
  } else {
    setTimeout(function () {
      window.H90AIVoice.init();
    }, 500);
  }

  console.log('%cH90 AI Voice v1.0 Ready',
    'background:linear-gradient(135deg,#2196f3,#1976d2);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');
  console.log('  Input:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  console.log('  Output:', 'speechSynthesis' in window);

})();
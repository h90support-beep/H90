/* ==========================================================
   H90 v25.9 — Sound Effects Engine
   ملف الأصوات الكامل — Web Audio API (بدون ملفات خارجية)
   ========================================================== */

(function() {
  'use strict';

  // ==========================================================
  // 🔧 الإعدادات الافتراضية
  // ==========================================================
  const DEFAULT_SETTINGS = {
    enabled: true,      // تفعيل كل الأصوات
    haptic: true,       // الاهتزاز
    tap: true,          // صوت الضغط
    nav: true,          // صوت التنقل
    volume: 0.5         // مستوى الصوت (0 - 1)
  };

  const STORAGE_KEY = 'h90_sounds_settings';

  // ==========================================================
  // 📦 الحالة الداخلية
  // ==========================================================
  let settings = { ...DEFAULT_SETTINGS };
  let audioCtx = null;
  let isUnlocked = false;

  // ==========================================================
  // 💾 تحميل / حفظ الإعدادات
  // ==========================================================
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('⚠️ Failed to load sound settings:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('⚠️ Failed to save sound settings:', e);
    }
  }

  // ==========================================================
  // 🎵 تهيئة سياق الصوت
  // ==========================================================
  function initAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('⚠️ Web Audio API not supported');
        return null;
      }
      audioCtx = new AudioContextClass();
      console.log('🎵 AudioContext created');
      return audioCtx;
    } catch (e) {
      console.warn('⚠️ Failed to create AudioContext:', e);
      return null;
    }
  }

  // ==========================================================
  // 🔓 فتح الصوت (يحتاج تفاعل المستخدم)
  // ==========================================================
  function unlockAudio() {
    if (isUnlocked) return;

    const ctx = initAudioContext();
    if (!ctx) return;

    // إذا كان suspended → محاولة الاستئناف
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isUnlocked = true;
        console.log('🔓 Audio unlocked');
      }).catch(() => {
        // سيتم فتحه عند أول تفاعل
      });
    } else {
      isUnlocked = true;
    }
  }

  // ==========================================================
  // 🎼 محرك الصوت الأساسي
  // type: waveform (sine, square, triangle, sawtooth)
  // notes: [{ freq, start, duration, gain }]
  // ==========================================================
  function playTone(notes, options = {}) {
    if (!settings.enabled) return;

    const ctx = initAudioContext();
    if (!ctx) return;

    // محاولة استئناف السياق إذا كان suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const baseGain = (options.volume || 1) * settings.volume;
    const waveType = options.type || 'sine';

    const now = ctx.currentTime;

    notes.forEach(note => {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = waveType;
        osc.frequency.setValueAtTime(note.freq, now + (note.start || 0));

        // Envelope لتجنب النقرات
        const startTime = now + (note.start || 0);
        const duration = note.duration || 0.1;
        const peakGain = (note.gain || 0.15) * baseGain;

        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      } catch (e) {
        // تجاهل الأخطاء الفردية
      }
    });
  }

  // ==========================================================
  // 📳 الاهتزاز
  // ==========================================================
  function vibrate(pattern) {
    if (!settings.haptic) return;
    if (!navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }

  // ==========================================================
  // 🔊 H90Sounds — الكائن الرئيسي
  // ==========================================================
  const H90Sounds = {

    /* =====================================================
       ⚙️ الإعدادات
       ===================================================== */
    getSettings() {
      return { ...settings };
    },

    toggle(key) {
      if (key in settings) {
        settings[key] = !settings[key];
        saveSettings();

        // إذا تم تفعيل الأصوات → شغّل صوت اختبار
        if (key === 'enabled' && settings.enabled) {
          setTimeout(() => H90Sounds.tap(), 100);
        }

        return settings[key];
      }
      return false;
    },

    setVolume(val) {
      const v = Math.max(0, Math.min(1, parseFloat(val) || 0));
      settings.volume = v;
      saveSettings();
      return v;
    },

    /* =====================================================
       🎵 الأصوات الأساسية
       ===================================================== */

    /**
     * صوت الضغط — نقرة قصيرة وواضحة
     */
    tap() {
      if (!settings.enabled || !settings.tap) return;
      playTone([
        { freq: 1200, start: 0, duration: 0.04, gain: 0.08 }
      ], { type: 'sine', volume: 1 });
      vibrate(8);
    },

    /**
     * صوت التنقل بين التبويبات — نغمة مزدوجة صاعدة
     */
    nav() {
      if (!settings.enabled || !settings.nav) return;
      playTone([
        { freq: 700, start: 0, duration: 0.06, gain: 0.08 },
        { freq: 1000, start: 0.05, duration: 0.07, gain: 0.08 }
      ], { type: 'sine', volume: 1 });
      vibrate(10);
    },

    /**
     * صوت فتح نافذة/قائمة — نغمة صاعدة هادئة
     */
    open() {
      if (!settings.enabled) return;
      playTone([
        { freq: 500, start: 0, duration: 0.08, gain: 0.07 },
        { freq: 800, start: 0.06, duration: 0.1, gain: 0.09 }
      ], { type: 'sine', volume: 0.9 });
      vibrate(12);
    },

    /**
     * صوت إغلاق نافذة/قائمة — نغمة هابطة هادئة
     */
    close() {
      if (!settings.enabled) return;
      playTone([
        { freq: 800, start: 0, duration: 0.08, gain: 0.07 },
        { freq: 500, start: 0.06, duration: 0.1, gain: 0.08 }
      ], { type: 'sine', volume: 0.9 });
      vibrate(10);
    },

    /**
     * صوت المفضلة — نغمة ذهبية حلوة
     */
    favorite() {
      if (!settings.enabled) return;
      playTone([
        { freq: 880, start: 0, duration: 0.06, gain: 0.09 },
        { freq: 1175, start: 0.06, duration: 0.1, gain: 0.1 }
      ], { type: 'triangle', volume: 1 });
      vibrate([15, 30, 15]);
    },

    /**
     * صوت النجاح — نغمة صاعدة ثلاثية
     */
    success() {
      if (!settings.enabled) return;
      playTone([
        { freq: 523.25, start: 0,    duration: 0.1, gain: 0.09 }, // C5
        { freq: 659.25, start: 0.08, duration: 0.1, gain: 0.09 }, // E5
        { freq: 783.99, start: 0.16, duration: 0.15, gain: 0.11 } // G5
      ], { type: 'sine', volume: 1 });
      vibrate([20, 40, 20, 40, 20]);
    },

    /**
     * صوت الخطأ — نغمة هابطة تحذيرية
     */
    error() {
      if (!settings.enabled) return;
      playTone([
        { freq: 400, start: 0, duration: 0.1, gain: 0.1 },
        { freq: 280, start: 0.1, duration: 0.15, gain: 0.1 }
      ], { type: 'square', volume: 0.7 });
      vibrate([50, 30, 50]);
    },

    /**
     * صوت التحذير — نغمة متوسطة مزدوجة
     */
    warning() {
      if (!settings.enabled) return;
      playTone([
        { freq: 600, start: 0, duration: 0.1, gain: 0.08 },
        { freq: 600, start: 0.15, duration: 0.1, gain: 0.08 }
      ], { type: 'triangle', volume: 0.9 });
      vibrate([30, 40, 30]);
    },

    /**
     * صوت إضافة إلى السلة / إجراء مهم
     */
    add() {
      if (!settings.enabled) return;
      playTone([
        { freq: 660, start: 0, duration: 0.08, gain: 0.09 },
        { freq: 990, start: 0.07, duration: 0.12, gain: 0.1 }
      ], { type: 'sine', volume: 1 });
      vibrate(15);
    },

    /**
     * صوت الحذف
     */
    remove() {
      if (!settings.enabled) return;
      playTone([
        { freq: 700, start: 0, duration: 0.08, gain: 0.09 },
        { freq: 350, start: 0.06, duration: 0.1, gain: 0.09 }
      ], { type: 'sine', volume: 0.95 });
      vibrate(15);
    },

    /**
     * صوت التبديل (toggle) — نغمة ثنائية قصيرة
     */
    toggle() {
      if (!settings.enabled) return;
      playTone([
        { freq: 900, start: 0, duration: 0.05, gain: 0.08 }
      ], { type: 'sine', volume: 1 });
      vibrate(10);
    },

    /**
     * صوت تحميل / انتظار
     */
    loading() {
      if (!settings.enabled) return;
      playTone([
        { freq: 400, start: 0, duration: 0.1, gain: 0.05 },
        { freq: 500, start: 0.12, duration: 0.1, gain: 0.05 },
        { freq: 600, start: 0.24, duration: 0.15, gain: 0.05 }
      ], { type: 'sine', volume: 0.7 });
    },

    /**
     * صوت رسالة / إشعار
     */
    message() {
      if (!settings.enabled) return;
      playTone([
        { freq: 1200, start: 0,    duration: 0.08, gain: 0.09 },
        { freq: 1600, start: 0.08, duration: 0.12, gain: 0.09 }
      ], { type: 'sine', volume: 1 });
      vibrate([20, 30, 20]);
    },

    /**
     * صوت إنجاز (achievement)
     */
    achievement() {
      if (!settings.enabled) return;
      playTone([
        { freq: 523.25, start: 0,    duration: 0.08, gain: 0.09 }, // C5
        { freq: 659.25, start: 0.08, duration: 0.08, gain: 0.09 }, // E5
        { freq: 783.99, start: 0.16, duration: 0.08, gain: 0.09 }, // G5
        { freq: 1046.5, start: 0.24, duration: 0.2,  gain: 0.11 }  // C6
      ], { type: 'sine', volume: 1 });
      vibrate([20, 30, 20, 30, 20, 30, 40]);
    },

    /**
     * 🎯 اختبار الصوت — نغمة توضيحية شاملة
     */
    test() {
      console.log('🎵 Testing sounds...');
      // تجاهل شرط enabled لأنه اختبار
      const wasEnabled = settings.enabled;
      settings.enabled = true;

      playTone([
        { freq: 523.25, start: 0,    duration: 0.1,  gain: 0.1 },  // C5
        { freq: 659.25, start: 0.12, duration: 0.1,  gain: 0.1 },  // E5
        { freq: 783.99, start: 0.24, duration: 0.1,  gain: 0.1 },  // G5
        { freq: 1046.5, start: 0.36, duration: 0.25, gain: 0.12 }  // C6
      ], { type: 'sine', volume: 1 });

      vibrate([30, 50, 30, 50, 30, 50, 60]);

      settings.enabled = wasEnabled;
    },

    /* =====================================================
       🔧 أدوات إضافية
       ===================================================== */

    /**
     * فتح السياق الصوتي (يُستدعى عند أول تفاعل)
     */
    unlock() {
      unlockAudio();
    },

    /**
     * إيقاف كل الأصوات
     */
    mute() {
      const wasEnabled = settings.enabled;
      settings.enabled = false;
      return wasEnabled;
    },

    /**
     * تفعيل كل الأصوات
     */
    unmute() {
      settings.enabled = true;
      saveSettings();
    },

    /**
     * إعادة تعيين الإعدادات
     */
    reset() {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings();
      console.log('🔄 Sound settings reset');
    },

    /**
     * تشغيل صوت مخصص (للاستخدام المتقدم)
     */
    playCustom(notes, options) {
      playTone(notes, options);
    },

    /* =====================================================
       📊 للتصحيح
       ===================================================== */
    info() {
      const info = {
        settings: { ...settings },
        audioCtxState: audioCtx ? audioCtx.state : 'not-initialized',
        isUnlocked: isUnlocked,
        supported: {
          webAudio: !!(window.AudioContext || window.webkitAudioContext),
          vibration: !!navigator.vibrate
        }
      };
      console.table(info.settings);
      console.log('🔊 Info:', info);
      return info;
    }
  };

  // ==========================================================
  // 🌐 تصدير الكائن عالمياً
  // ==========================================================
  window.H90Sounds = H90Sounds;

  // ==========================================================
  // 🚀 التهيئة الأولى
  // ==========================================================
  loadSettings();

  // ==========================================================
  // 🔓 فتح الصوت عند أول تفاعل من المستخدم
  // ==========================================================
  const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
  
  function handleFirstInteraction() {
    unlockAudio();
    // إزالة المستمعات بعد أول تفاعل
    unlockEvents.forEach(evt => {
      document.removeEventListener(evt, handleFirstInteraction, true);
    });
  }

  unlockEvents.forEach(evt => {
    document.addEventListener(evt, handleFirstInteraction, true);
  });

  // ==========================================================
  // 📢 رسالة تأكيد
  // ==========================================================
  console.log(
    '%c🎵 H90Sounds v25.9 loaded',
    'background:linear-gradient(135deg,#00e5ff,#00e676);color:#000;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px'
  );

})();
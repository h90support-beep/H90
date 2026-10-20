/* ================================================================
   H90 — VPN Detector (v2.0 — Fixed & Fast Edition)
   ================================================================
   نظام كشف VPN/Proxy بدرجات (Score-based)
   
   النتيجة:
   0-30   → مسموح
   31-60  → تحذير (متابعة مع تنبيه)
   61-100 → محظور
   ----------------------------------------------------------------
   🆕 إصلاحات v2.0:
   ✅ إزالة WebRTC (بطيء + غير دقيق على الموبايل)
   ✅ إزالة Latency check (false positives على الشبكات الضعيفة)
   ✅ إصلاح Timezone (منطق صحيح)
   ✅ إصلاح Browser Anomalies (تجاهل plugins على الموبايل)
   ✅ تنفيذ متزامن محمي (منع تكرار الفحص)
   ✅ Cache أذكى (10 دقائق)
   ✅ Timeout محسّن (Cloudflare Trace → 2 ثانية)
   ✅ فحص واحد سريع + دقيق
   ✅ حماية كاملة من الأخطاء
   ================================================================ */

'use strict';

const H90_VPN_DETECTOR = (function() {

  /* ================================================================
     [01] الإعدادات
     ================================================================ */
  const CACHE_TTL = 10 * 60 * 1000;   // 10 دقائق
  const TRACE_TIMEOUT = 2000;         // 2 ثانية

  /* ================================================================
     [02] CACHE
     ================================================================ */
  let _cachedResult = null;
  let _cacheTime = 0;
  let _inProgress = null;             // ✅ منع التنفيذ المتزامن

  /* ================================================================
     [03] CHECK 1: Cloudflare Trace (الفحص الرئيسي)
     ✅ سريع + دقيق
     ✅ يكشف WARP + VPN + Country Mismatch
     ================================================================ */
  async function checkCloudflareTrace() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TRACE_TIMEOUT);

      const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { score: 0, reason: 'trace_failed', details: {} };
      }

      const text = await res.text();
      const data = {};

      text.split('\n').forEach(function(line) {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const key = line.substring(0, idx);
          const value = line.substring(idx + 1);
          if (key && value) data[key] = value;
        }
      });

      const warp = (data.warp || 'off').toLowerCase();
      const country = (data.loc || '').toUpperCase();
      const ip = data.ip || '';

      /* ✅ WARP مفعّل → VPN */
      if (warp === 'on' || warp === 'plus') {
        return { score: 60, reason: 'cloudflare_warp', details: { warp: warp, country: country } };
      }

      /* ✅ التحقق من Country */
      const allowedCountries = [
        'SA', 'AE', 'EG', 'SY', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM',
        'YE', 'IQ', 'PS', 'MA', 'DZ', 'TN', 'LY', 'SD', 'MR', 'SO',
        'DJ', 'KM', 'TR', 'IR', 'PK', 'IN', 'ID', 'MY', 'BD', 'NG'
      ];

      /* ✅ نجيب توقّع الدولة من اللغة */
      const lang = (navigator.language || 'ar').substring(0, 2).toLowerCase();
      const arabicLangCountries = {
        'ar': ['SA', 'AE', 'EG', 'SY', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM', 'YE', 'IQ', 'PS', 'MA', 'DZ', 'TN', 'LY', 'SD', 'MR', 'SO', 'DJ', 'KM'],
        'tr': ['TR'],
        'fa': ['IR'],
        'ur': ['PK']
      };

      const expectedCountries = arabicLangCountries[lang];

      if (expectedCountries && country && expectedCountries.indexOf(country) === -1) {
        /* ✅ الدولة مش متوقعة → ممكن VPN */
        /* بس نديها نقاط قليلة عشان في ناس مسافرة */
        return { score: 25, reason: 'country_mismatch', details: { country: country, expected: expectedCountries.join(',') } };
      }

      return { score: 0, reason: 'trace_ok', details: { country: country, warp: warp } };

    } catch (e) {
      if (e.name === 'AbortError') {
        return { score: 5, reason: 'trace_timeout', details: {} };
      }
      return { score: 0, reason: 'trace_error', details: { error: e.message } };
    }
  }

  /* ================================================================
     [04] CHECK 2: Timezone (مُصلح)
     ✅ منطق صحيح
     ✅ يكشف تغيير الوقت
     ================================================================ */
  function checkTimezone() {
    try {
      /* getTimezoneOffset() بترجع دقائق سالبة للساعات الموجبة */
      const offsetMinutes = new Date().getTimezoneOffset();
      /* نحوّلها لساعات (موجبة) */
      const offsetHours = -offsetMinutes / 60;

      const lang = (navigator.language || 'ar').substring(0, 2).toLowerCase();

      /* ✅ نطاقات الوقت المتوقعة حسب اللغة */
      const expectedRanges = {
        'ar': { min: -6, max: +5 },   /* من المغرب (-6) إلى عمان (+4) */
        'tr': { min: +2, max: +4 },
        'fa': { min: +3, max: +4 },
        'ur': { min: +4, max: +6 },
        'en': { min: -12, max: +14 }  /* كل العالم */
      };

      const range = expectedRanges[lang] || expectedRanges['en'];

      if (offsetHours < range.min || offsetHours > range.max) {
        return {
          score: 15,
          reason: 'timezone_mismatch',
          details: { offsetHours: offsetHours, expected: range }
        };
      }

      return { score: 0, reason: 'timezone_ok', details: { offsetHours: offsetHours } };

    } catch (e) {
      return { score: 0, reason: 'timezone_error', details: {} };
    }
  }

  /* ================================================================
     [05] CHECK 3: Browser Anomalies (مُصلح)
     ✅ تجاهل plugins على الموبايل
     ✅ فحص دقيق للإعدادات
     ================================================================ */
  function checkBrowserAnomalies() {
    let score = 0;
    const reasons = [];
    const details = {};

    try {
      const ua = navigator.userAgent || '';
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

      /* 1. Webdriver (Bot) — مؤشر قوي */
      if (navigator.webdriver === true) {
        score += 50;
        reasons.push('webdriver');
      }

      /* 2. عدم وجود languages — مؤشر متوسط */
      if (!navigator.languages || navigator.languages.length === 0) {
        score += 10;
        reasons.push('no_languages');
      }

      /* 3. عدم وجود plugins — فقط على الكمبيوتر */
      if (!isMobile && navigator.plugins && navigator.plugins.length === 0) {
        score += 10;
        reasons.push('no_plugins');
      }

      /* 4. عدم وجود touch على الأجهزة اللمسية */
      if (isMobile && !('ontouchstart' in window)) {
        score += 15;
        reasons.push('no_touch');
      }

      /* 5. عدم تطابق UA مع Platform */
      const platform = (navigator.platform || '').toLowerCase();
      if (ua.indexOf('Windows') > -1 && platform && platform.indexOf('win') === -1) {
        score += 15;
        reasons.push('ua_platform_mismatch_win');
      }
      if (ua.indexOf('Mac') > -1 && platform && platform.indexOf('mac') === -1) {
        score += 15;
        reasons.push('ua_platform_mismatch_mac');
      }

      /* 6. عدم وجود cookies enabled */
      if (typeof navigator.cookieEnabled === 'boolean' && !navigator.cookieEnabled) {
        score += 10;
        reasons.push('no_cookies');
      }

      details.isMobile = isMobile;
      details.reasons = reasons;

      return {
        score: score,
        reason: reasons.length > 0 ? reasons.join(',') : 'browser_ok',
        details: details
      };

    } catch (e) {
      return { score: 0, reason: 'browser_error', details: {} };
    }
  }

  /* ================================================================
     [06] DETECT — التشغيل الرئيسي (سريع + دقيق)
     ================================================================ */
  async function detect() {
    const startTime = performance.now();

    try {
      /* ✅ تشغيل الفحوصات بالتوازي (أسرع) */
      const results = await Promise.all([
        checkCloudflareTrace(),                       // async
        Promise.resolve(checkTimezone()),              // sync
        Promise.resolve(checkBrowserAnomalies())      // sync
      ]);

      /* ✅ جمع النقاط */
      let totalScore = 0;
      const details = [];

      results.forEach(function(r) {
        totalScore += (r.score || 0);
        details.push({
          reason: r.reason,
          score: r.score || 0,
          details: r.details || {}
        });
      });

      /* ✅ قص عند 100 */
      const finalScore = Math.min(100, totalScore);

      /* ✅ تحديد الحالة */
      let status = 'allowed';
      if (finalScore >= 61) status = 'blocked';
      else if (finalScore >= 31) status = 'warning';

      const duration = Math.round(performance.now() - startTime);

      return {
        allowed: status !== 'blocked',
        status: status,
        score: finalScore,
        details: details,
        duration: duration
      };

    } catch (e) {
      /* ✅ في حالة الخطأ → اسمح بالمرور */
      console.warn('⚠️ [VPN] Detection error:', e.message);
      return {
        allowed: true,
        status: 'allowed',
        score: 0,
        details: [],
        error: e.message
      };
    }
  }

  /* ================================================================
     [07] DETECT CACHED — مع منع التنفيذ المتزامن
     ✅ لو فيه فحص شغال → انتظره
     ✅ لو Cache صالح → رجّعه
     ✅ لو Cache منتهي → فحص جديد
     ================================================================ */
  async function detectCached() {
    const now = Date.now();

    /* ✅ 1. Cache صالح */
    if (_cachedResult && (now - _cacheTime) < CACHE_TTL) {
      return _cachedResult;
    }

    /* ✅ 2. فيه فحص شغال → انتظره */
    if (_inProgress) {
      return await _inProgress;
    }

    /* ✅ 3. ابدأ فحص جديد */
    _inProgress = detect()
      .then(function(result) {
        _cachedResult = result;
        _cacheTime = Date.now();
        _inProgress = null;
        return result;
      })
      .catch(function(e) {
        _inProgress = null;
        throw e;
      });

    return await _inProgress;
  }

  /* ================================================================
     [08] API العام
     ================================================================ */
  return {
    /* الفحص الأساسي (مع Cache) */
    detect: detectCached,

    /* الفحص الفوري (يتجاهل Cache) */
    detectFresh: detect,

    /* مسح Cache */
    clearCache: function() {
      _cachedResult = null;
      _cacheTime = 0;
      _inProgress = null;
    },

    /* معلومات التشخيص */
    getStatus: function() {
      return {
        hasCachedResult: !!_cachedResult,
        cacheAge: _cachedResult ? Math.round((Date.now() - _cacheTime) / 1000) + 's' : 'none',
        cacheTTL: Math.round(CACHE_TTL / 1000) + 's',
        inProgress: !!_inProgress
      };
    }
  };

})();

window.H90_VPN_DETECTOR = H90_VPN_DETECTOR;
console.log('%c✅ VPN Detector v2.0 — Fixed & Fast',
  'background:linear-gradient(135deg,#00e676,#0091ea);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;font-size:12px;');
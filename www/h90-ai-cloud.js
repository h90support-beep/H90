/* ================================================================
   H90 AI Cloud — v3.2 (SECURE WORKER-ONLY)
   ================================================================
   ✅ كل الطلبات عبر Cloudflare Worker
   ✅ لا يوجد API key في الكود نهائياً
   ✅ Direct API مُلغى
   ✅ Multi-Model Fallback (في Worker)
   ✅ Image Understanding
   ✅ Timeout 90s
   ✅ Rate Limiting 15/دقيقة، 500/يوم
   ✅ تشخيص شامل
   ================================================================ */

(function () {
  'use strict';

  console.log('%cH90 AI Cloud v3.2 (Secure) loading...',
    'color:#00e5ff;font-weight:900;font-size:12px;');

  /* ================================================================
     ⚙️ Cloud State
     ================================================================ */
  const CLOUD = {
    /* Worker Proxy — الأساسي والوحيد */
    proxyUrl: 'https://iutihdjif-igdjiffjid-iudfjudd-62684.x4storebot.workers.dev/api/chat',
    useProxy: true,

    /* Direct API — مُلغى نهائياً لأسباب أمنية */
    apiKey: null,
    useDirectFallback: false,

    /* الموديلات (تُدار الآن في Worker فقط) */
    models: [],
    currentModelIndex: 0,
    lastSuccessfulModel: null,
    modelFailCounts: {},
    maxModelFails: 2,

    /* Rate Limiting */
    requests: [],
    maxRequestsPerMinute: 15,
    maxRequestsPerDay: 500,
    dailyCount: 0,
    dailyReset: Date.now(),

    /* Cache */
    cache: new Map(),
    cacheMaxAge: 24 * 60 * 60 * 1000,

    /* State */
    enabled: true,
    initialized: false,
    lastError: null,
    isOnline: navigator.onLine,

    /* Stats */
    stats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      workerCalls: 0,
      workerSuccess: 0,
      workerFailed: 0,
      directCalls: 0,
      directSuccess: 0,
      directFailed: 0,
      modelSwitches: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
  };

  const CLOUD_SETTINGS_KEY = 'h90_ai_cloud_settings_v2';

  /* ================================================================
     💾 حفظ/استرجاع الإعدادات
     ================================================================ */
  function saveCloudSettings() {
    try {
      localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify({
        enabled: CLOUD.enabled,
        dailyCount: CLOUD.dailyCount,
        dailyReset: CLOUD.dailyReset
      }));
    } catch (e) {}
  }

  function loadCloudSettings() {
    try {
      const raw = localStorage.getItem(CLOUD_SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      CLOUD.enabled = data.enabled !== false;
      CLOUD.dailyCount = data.dailyCount || 0;
      CLOUD.dailyReset = data.dailyReset || Date.now();

      if (Date.now() - CLOUD.dailyReset > 24 * 60 * 60 * 1000) {
        CLOUD.dailyCount = 0;
        CLOUD.dailyReset = Date.now();
        saveCloudSettings();
      }
    } catch (e) {}
  }

  /* ================================================================
     🚦 Rate Limiting
     ================================================================ */
  function checkRateLimit() {
    const now = Date.now();

    if (CLOUD.dailyCount >= CLOUD.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: 'daily_limit',
        message: 'تم استهلاك الحد اليومي. حاول لاحقاً.'
      };
    }

    CLOUD.requests = CLOUD.requests.filter(function (t) { return now - t < 60000; });

    if (CLOUD.requests.length >= CLOUD.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'minute_limit',
        message: 'انتظر قليلاً قبل الإرسال التالي',
        waitMs: 60000 - (now - CLOUD.requests[0])
      };
    }

    return { allowed: true };
  }

  function recordRequest() {
    CLOUD.requests.push(Date.now());
    CLOUD.dailyCount++;
    CLOUD.stats.totalCalls++;
    saveCloudSettings();
  }

  /* ================================================================
     💾 Cache
     ================================================================ */
  function getCacheKey(query, imageHash) {
    const str = (query || '') + '|' + (imageHash || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'cloud_' + Math.abs(hash).toString(36);
  }

  function getCached(key) {
    const entry = CLOUD.cache.get(key);
    if (!entry) {
      CLOUD.stats.cacheMisses++;
      return null;
    }
    if (Date.now() - entry.timestamp > CLOUD.cacheMaxAge) {
      CLOUD.cache.delete(key);
      CLOUD.stats.cacheMisses++;
      return null;
    }
    CLOUD.stats.cacheHits++;
    return entry.value;
  }

  function setCache(key, value) {
    CLOUD.cache.set(key, { value: value, timestamp: Date.now() });
    if (CLOUD.cache.size > 100) {
      const firstKey = CLOUD.cache.keys().next().value;
      CLOUD.cache.delete(firstKey);
    }
  }

  /* ================================================================
     🌐 Network Status
     ================================================================ */
  window.addEventListener('online', function () {
    CLOUD.isOnline = true;
    console.log('[H90 Cloud] Online');
  });

  window.addEventListener('offline', function () {
    CLOUD.isOnline = false;
    console.log('[H90 Cloud] Offline');
  });

  /* ================================================================
     📸 Image to Base64
     ================================================================ */
  async function imageToBase64(imageSource) {
    return new Promise(function (resolve, reject) {
      try {
        console.log('[H90 Cloud] imageToBase64 - type:', typeof imageSource);

        if (typeof imageSource === 'string') {
          if (imageSource.startsWith('data:')) {
            console.log('[H90 Cloud] Already base64 data URI');
            const parts = imageSource.split(',');
            const mimeMatch = parts[0].match(/data:([^;]+);/);
            resolve({
              data: parts[1],
              mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg'
            });
            return;
          }

          console.log('[H90 Cloud] Fetching from URL');
          fetch(imageSource)
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
              const reader = new FileReader();
              reader.onloadend = function () {
                const parts = reader.result.split(',');
                resolve({
                  data: parts[1],
                  mimeType: blob.type || 'image/jpeg'
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
            .catch(reject);
          return;
        }

        if (imageSource instanceof File || imageSource instanceof Blob) {
          console.log('[H90 Cloud] File/Blob detected, size:', imageSource.size);
          if (imageSource.size > 5 * 1024 * 1024) {
            reject(new Error('الصورة كبيرة جداً (5MB كحد أقصى)'));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = function () {
            const parts = reader.result.split(',');
            resolve({
              data: parts[1],
              mimeType: imageSource.type || 'image/jpeg'
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageSource);
          return;
        }

        reject(new Error('نوع الصورة غير مدعوم'));
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ================================================================
     🌐 Worker Call — الطريقة الوحيدة للاتصال
     ================================================================ */
  async function callViaWorker(query, imageData, options) {
    console.log('%c🌐 [H90 Cloud] Worker call start',
      'color:#00e5ff;font-weight:900;', {
      query: query ? query.substring(0, 50) : 'none',
      hasImage: !!imageData
    });

    CLOUD.stats.workerCalls++;

    const workerPayload = {};

    if (query) {
      workerPayload.query = query;
      workerPayload.text = query;
    }

    if (imageData && imageData.data) {
      workerPayload.image = {
        mimeType: imageData.mimeType || 'image/jpeg',
        data: imageData.data
      };

      if (!query) {
        workerPayload.query = 'حلل هذه الصورة وساعدني في فهم المشكلة المتعلقة بتطبيق H90.';
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(function () {
      console.log('[H90 Cloud] Worker TIMEOUT — aborting');
      controller.abort();
    }, 90000);

    try {
      const response = await fetch(CLOUD.proxyUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(workerPayload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      console.log('[H90 Cloud] Worker status:', response.status);

      if (!response.ok) {
        const errText = await response.text();
        console.error('[H90 Cloud] Worker HTTP error:', response.status,
          errText.substring(0, 200));
        CLOUD.stats.workerFailed++;
        throw new Error('Worker HTTP ' + response.status);
      }

      const data = await response.json();
      console.log('[H90 Cloud] Worker data:', JSON.stringify(data).substring(0, 150));

      if (!data.success) {
        CLOUD.stats.workerFailed++;
        throw new Error(data.error || 'Worker returned failure');
      }

      CLOUD.stats.workerSuccess++;
      CLOUD.lastSuccessfulModel = data.model || 'worker';

      return {
        success: true,
        answer: data.answer,
        model: data.model || 'worker',
        usage: data.usage || null,
        source: 'worker'
      };

    } catch (e) {
      clearTimeout(timeout);
      CLOUD.stats.workerFailed++;
      console.error('[H90 Cloud] Worker failed:', e.name, e.message);
      throw e;
    }
  }

  /* ================================================================
     ⛔ Direct Call — مُلغى نهائياً
     ================================================================ */
  async function callDirect(query, imageData, options) {
    /* ⛔ لأسباب أمنية — المفتاح لم يعد في الكود */
    throw new Error('Direct API معطل — استخدم Worker فقط');
  }

  /* ================================================================
     🎯 Main API Call — Worker فقط
     ================================================================ */
  async function callCloudAPI(query, imageData, options) {
    options = options || {};

    console.log('%c=== callCloudAPI START ===',
      'background:#2196f3;color:#fff;padding:3px 10px;border-radius:6px;font-weight:900;');
    console.log('  query:', query ? query.substring(0, 50) : 'none');
    console.log('  hasImage:', !!imageData);
    console.log('  isOnline:', CLOUD.isOnline);
    console.log('  enabled:', CLOUD.enabled);
    console.log('  worker:', CLOUD.proxyUrl);

    if (!CLOUD.isOnline) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    if (!CLOUD.enabled) {
      throw new Error('الخدمة السحابية معطلة');
    }

    if (!CLOUD.proxyUrl) {
      throw new Error('Worker URL غير مُعد');
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    console.log('✅ Initial checks passed');

    try {
      const result = await callViaWorker(query, imageData, options);
      recordRequest();
      CLOUD.stats.successfulCalls++;
      console.log('%c✅ Worker SUCCESS',
        'background:#00e676;color:#000;padding:3px 10px;border-radius:6px;font-weight:900;');
      return result;
    } catch (workerError) {
      recordRequest();
      CLOUD.stats.failedCalls++;
      CLOUD.lastError = workerError.message;
      console.error('❌ Worker failed:', workerError.message);
      throw new Error('فشل الاتصال بالخدمة. تحقق من الإنترنت أو حاول لاحقاً.');
    }
  }
    /* ================================================================
     🎯 Public API — Ask Text
     ================================================================ */
  async function askCloud(query, options) {
    options = options || {};
    
    if (!query || typeof query !== 'string') {
      throw new Error('السؤال مطلوب');
    }
    
    const cacheKey = getCacheKey(query);
    const cached = getCached(cacheKey);
    if (cached && !options.noCache) {
      console.log('%c💾 [H90 Cloud] Cache hit',
        'color:#00e676;font-weight:900;');
      return cached;
    }
    
    const result = await callCloudAPI(query.trim(), null, options);
    setCache(cacheKey, result);
    return result;
  }
  
  /* ================================================================
     🎯 Public API — Analyze Image
     ================================================================ */
  async function analyzeImage(imageSource, question, options) {
    options = options || {};
    
    console.log('%c=== analyzeImage START ===',
      'background:#9c27b0;color:#fff;padding:3px 10px;border-radius:6px;font-weight:900;');
    console.log('  imageSource type:', typeof imageSource);
    console.log('  question:', question);
    
    if (!imageSource) {
      throw new Error('الصورة مطلوبة');
    }
    
    let imageData;
    try {
      console.log('⏳ Converting image to base64...');
      imageData = await imageToBase64(imageSource);
      console.log('✅ Image converted. Data length:', imageData.data.length);
    } catch (convertError) {
      console.error('❌ Conversion failed:', convertError.message);
      throw new Error('فشل قراءة الصورة: ' + convertError.message);
    }
    
    const sizeInBytes = (imageData.data.length * 3) / 4;
    console.log('📏 Image size:', Math.round(sizeInBytes / 1024), 'KB');
    
    if (sizeInBytes > 5 * 1024 * 1024) {
      throw new Error('الصورة كبيرة جداً (5MB كحد أقصى)');
    }
    
    const finalQuery = question || 'حلل هذه الصورة ووضح المشكلة المتعلقة بتطبيق H90.';
    
    const cacheKey = getCacheKey(finalQuery, imageData.data.substring(0, 100));
    const cached = getCached(cacheKey);
    if (cached && !options.noCache) {
      console.log('%c💾 [H90 Cloud] Image cache hit',
        'color:#00e676;font-weight:900;');
      return cached;
    }
    
    console.log('🚀 Calling callCloudAPI...');
    const result = await callCloudAPI(finalQuery, imageData, options);
    console.log('%c✅ analyzeImage SUCCESS',
      'background:#00e676;color:#000;padding:3px 10px;border-radius:6px;font-weight:900;');
    
    setCache(cacheKey, result);
    return result;
  }
  
  /* ================================================================
     📸 Screenshot
     ================================================================ */
  async function captureScreen() {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: false
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise(function(r) { setTimeout(r, 300); });
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        stream.getTracks().forEach(function(track) { track.stop(); });
        
        return new Promise(function(resolve) {
          canvas.toBlob(function(blob) {
            resolve(blob);
          }, 'image/jpeg', 0.85);
        });
      } catch (e) {
        console.warn('[H90 Cloud] getDisplayMedia failed:', e);
      }
    }
    
    if (typeof html2canvas !== 'undefined') {
      try {
        const canvas = await html2canvas(document.body);
        return new Promise(function(resolve) {
          canvas.toBlob(function(blob) {
            resolve(blob);
          }, 'image/jpeg', 0.85);
        });
      } catch (e) {
        console.warn('[H90 Cloud] html2canvas failed:', e);
      }
    }
    
    throw new Error('لا يمكن التقاط الشاشة');
  }
  
  /* ================================================================
     💡 Smart Fallback
     ================================================================ */
  async function smartFallback(query, localResult) {
    if (localResult && localResult.type === 'success' && localResult.confidence > 50) {
      return localResult;
    }
    
    if (!query || query.trim().length < 4) {
      return localResult;
    }
    
    if (localResult && (localResult.type === 'greeting' || localResult.type === 'learned')) {
      return localResult;
    }
    
    try {
      const cloudResult = await askCloud(query);
      
      if (cloudResult.success && cloudResult.answer) {
        return {
          type: 'cloud',
          answer: cloudResult.answer,
          category: 'مساعد سحابي',
          source: cloudResult.source || 'cloud',
          model: cloudResult.model
        };
      }
    } catch (e) {
      console.warn('[H90 Cloud] Fallback failed:', e.message);
    }
    
    return localResult;
  }
  
  /* ================================================================
     ⚙️ Settings
     ================================================================ */
  function setProxy(url) {
    if (!url || typeof url !== 'string') return false;
    CLOUD.proxyUrl = url;
    CLOUD.useProxy = true;
    saveCloudSettings();
    return true;
  }
  
  function setEnabled(enabled) {
    CLOUD.enabled = !!enabled;
    saveCloudSettings();
  }
  
  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AICloud = {
    ask: askCloud,
    analyzeImage: analyzeImage,
    smartFallback: smartFallback,
    captureScreen: captureScreen,
    
    setProxy: setProxy,
    setEnabled: setEnabled,
    isEnabled: function() { return CLOUD.enabled; },
    isOnline: function() { return CLOUD.isOnline; },
    getWorkerUrl: function() { return CLOUD.proxyUrl; },
    
    getRateLimitInfo: function() {
      return {
        usedToday: CLOUD.dailyCount,
        maxToday: CLOUD.maxRequestsPerDay,
        usedThisMinute: CLOUD.requests.filter(function(t) {
          return Date.now() - t < 60000;
        }).length,
        maxPerMinute: CLOUD.maxRequestsPerMinute,
        resetAt: new Date(CLOUD.dailyReset + 24 * 60 * 60 * 1000)
      };
    },
    
    clearCache: function() {
      CLOUD.cache.clear();
      CLOUD.stats.cacheHits = 0;
      CLOUD.stats.cacheMisses = 0;
      console.log('[H90 Cloud] Cache cleared');
    },
    getCacheSize: function() { return CLOUD.cache.size; },
    
    resetDaily: function() {
      CLOUD.dailyCount = 0;
      CLOUD.dailyReset = Date.now();
      saveCloudSettings();
    },
    
    resetStats: function() {
      Object.keys(CLOUD.stats).forEach(function(k) {
        CLOUD.stats[k] = 0;
      });
      console.log('[H90 Cloud] Stats reset');
    },
    
    stats: function() {
      return {
        version: '3.2',
        enabled: CLOUD.enabled,
        isOnline: CLOUD.isOnline,
        workerUrl: CLOUD.proxyUrl,
        directDisabled: true,
        apiKeyInCode: false,
        cacheSize: CLOUD.cache.size,
        dailyCount: CLOUD.dailyCount,
        maxDaily: CLOUD.maxRequestsPerDay,
        lastError: CLOUD.lastError,
        stats: Object.assign({}, CLOUD.stats),
        ready: CLOUD.initialized
      };
    },
    
    testConnection: async function() {
      const result = { worker: null };
      
      try {
        const workerResult = await callViaWorker('قل مرحبا فقط', null, {});
        result.worker = {
          success: true,
          answer: workerResult.answer,
          model: workerResult.model
        };
      } catch (e) {
        result.worker = { success: false, error: e.message };
      }
      
      return result;
    },
    
    testImage: async function() {
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      try {
        const result = await analyzeImage(testImage, 'ما هذا؟');
        return {
          success: true,
          answer: result.answer,
          model: result.model,
          source: result.source
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  };
  
  /* ================================================================
     🚀 التشغيل
     ================================================================ */
  loadCloudSettings();
  
  /* فرض Worker دائماً — الرابط مع /api/chat */
  CLOUD.useProxy = true;
  CLOUD.useDirectFallback = false;
  CLOUD.apiKey = null;
  CLOUD.proxyUrl = 'https://iutihdjif-igdjiffjid-iudfjudd-62684.x4storebot.workers.dev/api/chat';
  
  CLOUD.initialized = true;
  
  console.log('%cH90 AI Cloud v3.2 (Secure) Ready',
    'background:linear-gradient(135deg,#4285f4,#34a853);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');
  console.log('%c🔒 Direct API: DISABLED',
    'color:#00e676;font-weight:900;');
  console.log('%c📡 Worker:', 'color:#00e5ff;font-weight:900;', CLOUD.proxyUrl);
  console.log('%c✅ No API key in code',
    'color:#00e676;font-weight:900;');
  console.log('  Rate limit:', CLOUD.maxRequestsPerMinute, '/min,',
    CLOUD.maxRequestsPerDay, '/day');
  console.log('  Timeout:', '90s');
  
  })();
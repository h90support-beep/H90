/* ================================================================
   H90 — Worker Bridge (h90-worker-bridge.js)
   ================================================================
   ✅ مزامنة FCM tokens مع الـ Worker
   ✅ معالجة قائمة الإشعارات المعلّقة
   ✅ فحص دوري في الخلفية
   ================================================================ */

'use strict';

(function h90WorkerBridge() {
  
  var WORKER_URL = 'https://h90-notfiy.dairalzor33.workers.dev';
  
  var state = {
    initialized: false,
    isOnline: navigator.onLine,
    lastQueueProcess: 0,
    lastTokenSync: 0,
    processedCount: 0,
    failedCount: 0,
    syncedTokens: new Set(),
    queueTimer: null,
    tokenTimer: null
  };
  
  /* ================================================================
     Sync FCM token with worker
     ================================================================ */
  async function syncTokenWithWorker(token, platform) {
    if (!token || typeof token !== 'string' || token.length < 20) {
      return { ok: false, reason: 'invalid_token' };
    }
    
    var hash = token.substring(0, 40);
    if (state.syncedTokens.has(hash)) {
      return { ok: true, cached: true };
    }
    
    try {
      var res = await fetch(WORKER_URL + '/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          platform: platform || 'web',
          timestamp: Date.now()
        })
      });
      
      if (!res.ok) {
        state.failedCount++;
        return { ok: false, status: res.status };
      }
      
      state.syncedTokens.add(hash);
      state.lastTokenSync = Date.now();
      return { ok: true };
      
    } catch (e) {
      state.failedCount++;
      return { ok: false, error: e.message };
    }
  }
  
  /* ================================================================
     Process notification queue
     ================================================================ */
  async function processQueue() {
    if (!state.isOnline || document.hidden) {
      return { ok: false, reason: 'offline_or_hidden' };
    }
    
    try {
      var res = await fetch(WORKER_URL + '/fcm/process-queue', { method: 'POST' });
      if (!res.ok) return { ok: false, status: res.status };
      
      var data = await res.json();
      state.lastQueueProcess = Date.now();
      state.processedCount += (data.processed || 0);
      
      return { ok: true, processed: data.processed || 0 };
      
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  
  /* ================================================================
     Init
     ================================================================ */
  function init() {
    if (state.initialized) return;
    state.initialized = true;
    
    // Process queue every 30 seconds
    state.queueTimer = setInterval(function() {
      processQueue().catch(function() {});
    }, 30000);
    
    // Re-sync token every 60 seconds (in case of refresh)
    state.tokenTimer = setInterval(function() {
      if (document.hidden) return;
      var token = window.H90Firebase && window.H90Firebase.getToken ?
        window.H90Firebase.getToken() :
        null;
      if (token) {
        state.syncedTokens.delete(token.substring(0, 40));
        syncTokenWithWorker(token).catch(function() {});
      }
    }, 60000);
    
    // First process after 10s
    setTimeout(function() {
      processQueue().catch(function() {});
    }, 10000);
    
    console.log('[WorkerBridge] Initialized');
  }
  
  /* ================================================================
     Listen to network changes
     ================================================================ */
  window.addEventListener('online', function() {
    state.isOnline = true;
    setTimeout(function() { processQueue().catch(function() {}); }, 2000);
  });
  
  window.addEventListener('offline', function() {
    state.isOnline = false;
  });
  
  /* ================================================================
     Public API
     ================================================================ */
  window.H90WorkerBridge = {
    syncToken: syncTokenWithWorker,
    processQueue: processQueue,
    getStatus: function() {
      return {
        initialized: state.initialized,
        isOnline: state.isOnline,
        processedCount: state.processedCount,
        failedCount: state.failedCount,
        syncedTokensCount: state.syncedTokens.size,
        lastQueueProcess: state.lastQueueProcess,
        lastTokenSync: state.lastTokenSync
      };
    }
  };
  
  /* ================================================================
     Bootstrap
     ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 1000); });
  } else {
    setTimeout(init, 1000);
  }
  
  console.log(
    '%c H90 Worker Bridge %c v1.0 ',
    'background:linear-gradient(135deg,#00e676,#00e5ff);color:#000;padding:4px 10px;border-radius:6px 0 0 6px;font-weight:900;font-size:11px;',
    'background:#007bff;color:#fff;padding:4px 10px;border-radius:0 6px 6px 0;font-weight:900;font-size:10px;'
  );
  
})();
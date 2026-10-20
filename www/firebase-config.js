/* ================================================================
   H90 — FIREBASE CONFIG (Fixed Edition)
   ================================================================
   ✅ تهيئة Firebase App
   ✅ تهيئة Realtime Database
   ✅ تهيئة Messaging
   ✅ إتاحة قاعدة البيانات عبر window.H90Database
   ----------------------------------------------------------------
   🆕 إصلاحات:
   ✅ طلب إذن الإشعارات تلقائياً عند الحاجة
   ✅ إعادة محاولة ذكية مع تأخير متزايد
   ✅ أدوات تشخيص محسّنة
   ✅ Logs أنظف
   ✅ حماية من التهيئة المكررة
   ✅ دالة requestPermission() للاستخدام الخارجي
   ================================================================ */

'use strict';

// ═══════════════════════════════════════════════════════════════
// [01] إعدادات Firebase
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
    apiKey: "AIzaSyCcSOO7ucaSokbvUUrFFNNbpbbMaXsmSUk",
    authDomain: "h90-app.firebaseapp.com",
    databaseURL: "https://h90-app-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "h90-app",
    storageBucket: "h90-app.firebasestorage.app",
    messagingSenderId: "790663609291",
    appId: "1:790663609291:web:a28a42f4b493ebdba2144e"
};

// ═══════════════════════════════════════════════════════════════
// [02] VAPID Key (للإشعارات)
// ═══════════════════════════════════════════════════════════════

const VAPID_KEY = "BPOuC2mScgOGuDf4XScd8YrbAvLHNmL9QtNxHWKSJBuink-CJ7J5qR30XnhW3hS5lFYSLDtgBl5A5f0OjXaQEYA";

// ═══════════════════════════════════════════════════════════════
// [03] المتغيرات العامة
// ═══════════════════════════════════════════════════════════════

let _firebaseApp = null;
let _messaging = null;
let _database = null;
let _currentToken = null;
let _initState = 'idle';    // idle | initializing | initialized | failed
let _foregroundSetup = false;

// ═══════════════════════════════════════════════════════════════
// [04] تهيئة Firebase
// ═══════════════════════════════════════════════════════════════

function _initFirebase() {
    /* ✅ لو متهيأ بالفعل → نرجع true */
    if (_initState === 'initialized') return true;
    if (_initState === 'initializing') return false;

    if (typeof firebase === 'undefined') {
        console.warn('⚠️ [H90] Firebase SDK غير محمّل بعد');
        return false;
    }

    _initState = 'initializing';

    try {
        /* ✅ تهيئة App (مع فحص التكرار) */
        if (!firebase.apps.length) {
            _firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log('✅ [H90] Firebase App initialized');
        } else {
            _firebaseApp = firebase.app();
        }

        /* ✅ تهيئة Realtime Database */
        if (firebase.database) {
            try {
                _database = firebase.database();
                window.H90Database = _database;

                /* ✅ فحص الاتصال الأولي */
                const connectedRef = _database.ref('.info/connected');
                connectedRef.on('value', (snap) => {
                    const isConnected = snap.val() === true;
                    if (isConnected) {
                        console.log('%c✅ [H90] Database — CONNECTED',
                            'background:#00e676;color:#000;padding:2px 8px;border-radius:4px;font-weight:900;font-size:11px;');
                    } else {
                        console.warn('⚠️ [H90] Database — Disconnected');
                    }
                });

                console.log('%c✅ [H90] Realtime Database — READY',
                    'background:#00e676;color:#000;padding:4px 10px;border-radius:4px;font-weight:900;');
            } catch (dbErr) {
                console.error('❌ [H90] Database init failed:', dbErr);
                _initState = 'failed';
                return false;
            }
        } else {
            console.warn('⚠️ [H90] firebase-database-compat.js غير محمّل');
            _initState = 'failed';
            return false;
        }

        /* ✅ تهيئة Messaging */
        if (firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported()) {
            try {
                _messaging = firebase.messaging();
                console.log('✅ [H90] Firebase Messaging initialized');
            } catch (msgErr) {
                console.warn('⚠️ [H90] Messaging init failed:', msgErr.message);
            }
        } else {
            console.warn('⚠️ [H90] Firebase Messaging غير مدعوم في هذا المتصفح');
        }

        _initState = 'initialized';
        return true;

    } catch (e) {
        console.error('❌ [H90] Firebase init failed:', e);
        _initState = 'failed';
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// [05] ✅ طلب إذن الإشعارات (جديد — يُنادى من الخارج)
// ═══════════════════════════════════════════════════════════════

async function _requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
        console.warn('⚠️ [H90] Notification API غير مدعوم');
        return null;
    }

    /* ✅ لو الإذن مرفوض → مش هنقدر نطلب تاني */
    if (Notification.permission === 'denied') {
        console.warn('⚠️ [H90] الإشعارات مرفوضة — المستخدم لازم يغيّر الإعداد يدوياً');
        return null;
    }

    /* ✅ لو الإذن موجود → نسجّل مباشرة */
    if (Notification.permission === 'granted') {
        return await _registerForNotifications();
    }

    /* ✅ نطلب الإذن */
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('ℹ️ [H90] المستخدم رفض الإذن');
            return null;
        }
        return await _registerForNotifications();
    } catch (e) {
        console.error('❌ [H90] Permission request failed:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// [06] تسجيل الإشعارات (FCM Token)
// ═══════════════════════════════════════════════════════════════

async function _registerForNotifications() {
    if (!_messaging) {
        console.warn('⚠️ [H90] Messaging not initialized');
        return null;
    }

    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ [H90] Service Worker غير مدعوم');
        return null;
    }

    try {
        /* ✅ التأكد من الإذن */
        if (Notification.permission !== 'granted') {
            console.warn('⚠️ [H90] Notification permission not granted');
            return null;
        }

        /* ✅ تسجيل Service Worker */
        let registration;
        try {
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            console.log('✅ [H90] Service Worker registered');
        } catch (swErr) {
            console.warn('⚠️ [H90] SW register failed, using ready:', swErr.message);
            registration = await navigator.serviceWorker.ready;
        }

        /* ✅ الحصول على FCM Token */
        const token = await _messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            console.warn('⚠️ [H90] Failed to get FCM token');
            return null;
        }

        _currentToken = token;
        console.log('✅ [H90] FCM Token obtained:', token.substring(0, 20) + '...');
        return token;

    } catch (e) {
        console.error('❌ [H90] Registration failed:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// [07] الإشعارات الأمامية (Foreground)
// ═══════════════════════════════════════════════════════════════

function _setupForegroundNotifications() {
    if (!_messaging) return;
    if (_foregroundSetup) return;

    try {
        _messaging.onMessage(function(payload) {
            try {
                const title = (payload.notification && payload.notification.title) || 'H90';
                const body = (payload.notification && payload.notification.body) || '';

                /* ✅ إشعار النظام */
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    try {
                        new Notification(title, {
                            body: body,
                            icon: '/H90.jpg',
                            badge: '/H90.jpg',
                            dir: 'rtl',
                            lang: 'ar',
                            tag: 'h90-fg-' + Date.now()
                        });
                    } catch (e) {
                        console.warn('⚠️ [H90] Native notification failed:', e.message);
                    }
                }

                /* ✅ Toast */
                if (typeof window.showToast === 'function') {
                    window.showToast(title + ': ' + body, 'info');
                }
            } catch (e) {
                console.error('❌ [H90] Foreground notification error:', e);
            }
        });

        _foregroundSetup = true;
        console.log('✅ [H90] Foreground notifications setup');
    } catch (e) {
        console.error('❌ [H90] Setup foreground failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
// [08] إلغاء تسجيل الإشعارات
// ═══════════════════════════════════════════════════════════════

async function _unregisterNotifications() {
    if (!_messaging) return;
    try {
        await _messaging.deleteToken();
        _currentToken = null;
        console.log('✅ [H90] Notifications unregistered');
    } catch (e) {
        console.error('❌ [H90] Unregister failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
// [09] API العام
// ═══════════════════════════════════════════════════════════════

const API = {

    /* التهيئة */
    init: _initFirebase,
    isReady: () => _initState === 'initialized',

    /* الإشعارات */
    register: _registerForNotifications,
    requestPermission: _requestNotificationPermission,
    unregister: _unregisterNotifications,
    getToken: () => _currentToken,

    /* قاعدة البيانات */
    getDatabase: () => _database,

    /* الحالة */
    getStatus: () => ({
        initState: _initState,
        hasApp: !!_firebaseApp,
        hasToken: !!_currentToken,
        hasDatabase: !!_database,
        hasMessaging: !!_messaging,
        messagingSupported: (typeof firebase !== 'undefined' && firebase.messaging && firebase.messaging.isSupported)
            ? firebase.messaging.isSupported()
            : false,
        notificationPermission: typeof Notification !== 'undefined'
            ? Notification.permission
            : 'unsupported',
        databaseURL: firebaseConfig.databaseURL,
        projectId: firebaseConfig.projectId
    }),

    /* أدوات التشخيص */
    _tools: {
        getDatabase: () => _database,
        getFirebaseApp: () => _firebaseApp,
        getConfig: () => Object.assign({}, firebaseConfig),

        testConnection: async () => {
            if (!_database) return { ok: false, error: 'Database not initialized' };
            try {
                const ref = _database.ref('.info/connected');
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        try { ref.off(); } catch (e) {}
                        resolve({ ok: false, error: 'Timeout' });
                    }, 5000);

                    ref.on('value', (snap) => {
                        clearTimeout(timeout);
                        try { ref.off(); } catch (e) {}
                        resolve({ ok: true, connected: snap.val() });
                    });
                });
            } catch (e) {
                return { ok: false, error: e.message };
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// [10] التهيئة عند تحميل الصفحة — إعادة محاولة ذكية
// ═══════════════════════════════════════════════════════════════

function _bootstrap() {
    const tryInit = () => {
        if (typeof firebase === 'undefined' || !firebase.apps) return false;
        const ok = _initFirebase();
        if (ok) {
            _setupForegroundNotifications();
            /* ✅ لو الإذن موجود، نسجّل مباشرة */
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                _registerForNotifications().catch(() => {});
            }
            return true;
        }
        return false;
    };

    /* ✅ محاولة أولى فورية */
    if (tryInit()) return;

    /* ✅ إعادة محاولة ذكية: تأخير متزايد */
    let attempts = 0;
    const maxAttempts = 12;
    let delay = 500;

    const retry = () => {
        attempts++;
        if (attempts >= maxAttempts) {
            console.error('❌ [H90] Firebase init failed after ' + maxAttempts + ' attempts');
            return;
        }
        if (tryInit()) return;

        /* تأخير متزايد: 500 → 750 → 1125 → ... → 3000 كحد أقصى */
        delay = Math.min(delay * 1.5, 3000);
        setTimeout(retry, delay);
    };

    setTimeout(retry, delay);
}

/* ✅ تشغيل التهيئة */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootstrap);
} else {
    _bootstrap();
}

// ═══════════════════════════════════════════════════════════════
// [11] التصدير
// ═══════════════════════════════════════════════════════════════

window.H90Firebase = API;

console.log(
    '%c🔥 H90 FIREBASE — Fixed Edition',
    'background:linear-gradient(135deg,#ff2d55,#e6003d);color:#fff;padding:8px 16px;border-radius:8px;font-weight:900;font-size:13px;'
);
console.log('📡 Database URL:', firebaseConfig.databaseURL);
console.log('🔑 Project ID:', firebaseConfig.projectId);
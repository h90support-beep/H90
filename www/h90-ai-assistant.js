/* ================================================================
   H90 AI Assistant — v3.1 (FIXED CONFIDENCE)
   ================================================================
   ✅ إصلاح: شرط ثقة محسّن (60 بدل 30)
   ✅ إصلاح: فحص صلة حقيقية (Relevance Check)
   ✅ إصلاح: تجاهل كلمات التوقف (كيف، ما، هل...)
   ✅ إصلاح: استدعاء Gemini عند الثقة المنخفضة
   ✅ دمج كامل مع 5 طبقات AI
   ✅ حذف تلقائي عند الإغلاق
   ✅ Voice + Image + Feedback
   ================================================================ */

(function () {
  'use strict';

  console.log('H90 AI Assistant v3.1 loading...');

  /* ================================================================
     💬 State
     ================================================================ */
  const AI = {
    chatEl: null,
    messagesEl: null,
    inputEl: null,
    suggestionsEl: null,
    voiceBtnEl: null,
    imageBtnEl: null,
    initialized: false,
    isWaiting: false,
    lastCategory: null,
    sessionId: null,
    pendingImage: null
  };

  /* ================================================================
     🎨 CSS
     ================================================================ */
  const CHAT_STYLES = `
    .h90-ai-chat {
      position: fixed; inset: 0;
      background: #0a0a0f;
      display: none; flex-direction: column;
      z-index: 999999; font-family: inherit;
    }
    .h90-ai-chat.show { display: flex; }

    @media (min-width: 768px) {
      .h90-ai-chat {
        inset: auto 24px 24px auto;
        width: 440px; height: 680px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
    }

    .h90-ai-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(135deg, #ff2d55, #e6003d);
      color: #fff; flex-shrink: 0;
    }
    @media (min-width: 768px) {
      .h90-ai-header { border-radius: 20px 20px 0 0; }
    }

    .h90-ai-avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .h90-ai-avatar svg { width: 24px; height: 24px; stroke: #fff; fill: none; stroke-width: 2; }

    .h90-ai-title-wrap { flex: 1; text-align: right; }
    .h90-ai-title { font-weight: 900; font-size: 15px; }
    .h90-ai-status { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .h90-ai-status::before {
      content: ''; display: inline-block; width: 6px; height: 6px;
      background: #00e676; border-radius: 50%;
      margin-inline-end: 5px; vertical-align: middle;
      box-shadow: 0 0 6px #00e676;
    }

    .h90-ai-header-btns { display: flex; gap: 6px; flex-shrink: 0; }

    .h90-ai-header-btn {
      background: rgba(255,255,255,0.15); border: none; color: #fff;
      width: 34px; height: 34px; border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-family: inherit;
      transition: all 0.2s;
    }
    .h90-ai-header-btn:active { transform: scale(0.9); background: rgba(255,255,255,0.3); }
    .h90-ai-header-btn.active { background: #00e676; }
    .h90-ai-header-btn svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2.5; }

    .h90-ai-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }

    .h90-ai-msg {
      max-width: 88%; padding: 12px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.65; word-wrap: break-word;
      white-space: pre-wrap; animation: h90AiFadeIn 0.15s;
      position: relative;
    }
    @keyframes h90AiFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .h90-ai-msg.bot {
      background: rgba(255,255,255,0.06);
      color: #fff; align-self: flex-start;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .h90-ai-msg.user {
      background: linear-gradient(135deg, #ff2d55, #e6003d);
      color: #fff; align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .h90-ai-msg-image {
      max-width: 100%; border-radius: 10px;
      margin-bottom: 8px; display: block;
    }

    .h90-ai-steps {
      margin-top: 10px; padding: 10px 12px;
      background: rgba(0,229,255,0.06);
      border-right: 3px solid #00e5ff;
      border-radius: 8px; font-size: 12.5px;
      counter-reset: h90step;
    }
    .h90-ai-steps-title {
      font-weight: 800; color: #00e5ff;
      margin-bottom: 6px; font-size: 11px;
    }
    .h90-ai-step {
      padding: 4px 0; color: rgba(255,255,255,0.85);
      display: flex; gap: 6px;
    }
    .h90-ai-step::before {
      content: counter(h90step) '.';
      counter-increment: h90step;
      color: #00e5ff; font-weight: 900;
    }

    .h90-ai-category-tag {
      display: inline-block; padding: 3px 10px;
      background: rgba(255,45,85,0.15);
      border: 1px solid rgba(255,45,85,0.35);
      border-radius: 8px; font-size: 10px;
      color: #ff6b81; font-weight: 700;
      margin-top: 8px;
    }

    .h90-ai-cloud-tag {
      display: inline-block; padding: 3px 10px;
      background: rgba(66,133,244,0.15);
      border: 1px solid rgba(66,133,244,0.4);
      border-radius: 8px; font-size: 10px;
      color: #6ba3f8; font-weight: 700;
      margin-top: 8px; margin-inline-start: 6px;
    }

    .h90-ai-related {
      margin-top: 10px; display: flex;
      flex-wrap: wrap; gap: 6px;
    }
    .h90-ai-related-btn {
      padding: 7px 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; color: rgba(255,255,255,0.85);
      font-size: 11px; cursor: pointer;
      font-family: inherit; text-align: right;
    }
    .h90-ai-related-btn:active { transform: scale(0.96); background: rgba(255,45,85,0.15); }

    .h90-ai-more-btn {
      margin-top: 8px;
      padding: 8px 14px;
      background: rgba(0,229,255,0.08);
      border: 1px solid rgba(0,229,255,0.25);
      border-radius: 10px;
      color: #00e5ff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      width: 100%;
    }
    .h90-ai-more-btn:active { transform: scale(0.98); background: rgba(0,229,255,0.15); }

    .h90-ai-feedback {
      display: flex; gap: 6px;
      margin-top: 10px;
      align-items: center;
    }
    .h90-ai-feedback-label {
      font-size: 10px; color: rgba(255,255,255,0.5);
      margin-inline-end: 4px;
    }
    .h90-ai-feedback-btn {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .h90-ai-feedback-btn:active { transform: scale(0.9); }
    .h90-ai-feedback-btn.good.selected {
      background: rgba(0,230,118,0.2);
      border-color: #00e676;
    }
    .h90-ai-feedback-btn.bad.selected {
      background: rgba(255,45,85,0.2);
      border-color: #ff2d55;
    }
    .h90-ai-feedback-btn svg {
      width: 16px; height: 16px;
      stroke: rgba(255,255,255,0.7);
      fill: none; stroke-width: 2;
    }
    .h90-ai-feedback-btn.good.selected svg { stroke: #00e676; }
    .h90-ai-feedback-btn.bad.selected svg { stroke: #ff2d55; }

    .h90-ai-suggestions {
      padding: 8px 16px; display: flex; gap: 6px;
      overflow-x: auto; white-space: nowrap;
      scrollbar-width: none; flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .h90-ai-suggestions::-webkit-scrollbar { display: none; }

    .h90-ai-chip {
      padding: 8px 14px; border-radius: 16px;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 12px; cursor: pointer;
      white-space: nowrap; font-family: inherit;
      flex-shrink: 0;
    }
    .h90-ai-chip:active { background: rgba(255,45,85,0.2); border-color: rgba(255,45,85,0.4); }

    .h90-ai-preview {
      padding: 10px 16px;
      background: rgba(0,0,0,0.4);
      border-top: 1px solid rgba(255,255,255,0.08);
      display: none;
      flex-shrink: 0;
      position: relative;
    }
    .h90-ai-preview.show { display: block; }
    .h90-ai-preview-img {
      max-height: 100px; max-width: 100%;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      display: block; margin: 0 auto;
    }
    .h90-ai-preview-close {
      position: absolute; top: 6px; inset-inline-end: 20px;
      width: 26px; height: 26px; border-radius: 50%;
      background: rgba(255,45,85,0.9);
      border: none; color: #fff;
      font-size: 14px; font-weight: 900;
      cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      font-family: inherit;
    }

    .h90-ai-input-wrap {
      display: flex; gap: 8px; padding: 12px 16px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.4); flex-shrink: 0;
      align-items: center;
    }
    @media (min-width: 768px) {
      .h90-ai-input-wrap { border-radius: 0 0 20px 20px; }
    }

    .h90-ai-action-btn {
      width: 42px; height: 42px; border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: inherit;
      transition: all 0.2s;
    }
    .h90-ai-action-btn:active { transform: scale(0.9); background: rgba(255,255,255,0.15); }
    .h90-ai-action-btn svg {
      width: 18px; height: 18px;
      stroke: rgba(255,255,255,0.8);
      fill: none; stroke-width: 2;
    }
    .h90-ai-action-btn.recording {
      background: #ff2d55;
      border-color: #ff2d55;
      animation: h90AiPulse 1.2s infinite;
    }
    .h90-ai-action-btn.recording svg { stroke: #fff; }
    @keyframes h90AiPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,45,85,0.5); }
      50% { box-shadow: 0 0 0 8px rgba(255,45,85,0); }
    }

    .h90-ai-input {
      flex: 1; padding: 12px 16px; border-radius: 14px;
      background: rgba(255,255,255,0.06); color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 14px; font-family: inherit;
      outline: none; text-align: right;
      min-width: 0;
    }
    .h90-ai-input:focus { border-color: #ff2d55; }
    .h90-ai-input::placeholder { color: rgba(255,255,255,0.4); }

    .h90-ai-send {
      width: 46px; height: 46px; border-radius: 50%;
      background: linear-gradient(135deg, #ff2d55, #e6003d);
      color: #fff; border: none;
      cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: inherit;
      transition: all 0.2s;
    }
    .h90-ai-send:active { transform: scale(0.92); }
    .h90-ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .h90-ai-send svg { width: 20px; height: 20px; stroke: #fff; fill: none; stroke-width: 2.5; }

    .h90-ai-typing {
      display: inline-flex; gap: 4px; padding: 4px 0;
    }
    .h90-ai-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(255,255,255,0.5);
      animation: h90AiTyping 1.4s infinite;
    }
    .h90-ai-typing span:nth-child(2) { animation-delay: 0.2s; }
    .h90-ai-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes h90AiTyping {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-5px); }
    }

    .h90-ai-listening {
      padding: 8px 16px;
      background: rgba(255,45,85,0.1);
      border-top: 1px solid rgba(255,45,85,0.3);
      color: #ff6b81;
      font-size: 12px; font-weight: 700;
      text-align: center;
      display: none;
      flex-shrink: 0;
    }
    .h90-ai-listening.show {
      display: block;
      animation: h90AiListeningPulse 1.5s infinite;
    }
    @keyframes h90AiListeningPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;

  /* ================================================================
     🚀 التهيئة
     ================================================================ */
  function buildChatHTML() {
    return [
      '<div id="h90AiChat" class="h90-ai-chat" role="dialog">',

        '<div class="h90-ai-header">',
          '<div class="h90-ai-avatar">',
            '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">',
              '<rect x="3" y="8" width="18" height="12" rx="2"/>',
              '<circle cx="9" cy="14" r="1.2" fill="#fff" stroke="none"/>',
              '<circle cx="15" cy="14" r="1.2" fill="#fff" stroke="none"/>',
              '<path d="M9 17h6"/>',
              '<line x1="12" y1="8" x2="12" y2="4"/>',
              '<circle cx="12" cy="3" r="1.5" fill="#fff" stroke="none"/>',
            '</svg>',
          '</div>',
          '<div class="h90-ai-title-wrap">',
            '<div class="h90-ai-title">مساعد H90</div>',
            '<div class="h90-ai-status">متصل — جاهز للمساعدة</div>',
          '</div>',
          '<div class="h90-ai-header-btns">',
            '<button class="h90-ai-header-btn" id="h90AiSpeakToggle" title="صوت">',
              '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" id="h90AiSpeakIcon">',
                '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none"/>',
                '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
                '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
              '</svg>',
            '</button>',
            '<button class="h90-ai-header-btn" id="h90AiClose" title="إغلاق">',
              '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">',
                '<line x1="18" y1="6" x2="6" y2="18"/>',
                '<line x1="6" y1="6" x2="18" y2="18"/>',
              '</svg>',
            '</button>',
          '</div>',
        '</div>',

        '<div class="h90-ai-messages" id="h90AiMessages"></div>',
        '<div class="h90-ai-suggestions" id="h90AiSuggestions"></div>',

        '<div class="h90-ai-listening" id="h90AiListening">يستمع... تكلم الآن</div>',

        '<div class="h90-ai-preview" id="h90AiPreview">',
          '<img id="h90AiPreviewImg" class="h90-ai-preview-img" alt="preview">',
          '<button class="h90-ai-preview-close" id="h90AiPreviewClose" title="إلغاء">',
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">',
              '<line x1="18" y1="6" x2="6" y2="18"/>',
              '<line x1="6" y1="6" x2="18" y2="18"/>',
            '</svg>',
          '</button>',
        '</div>',

        '<div class="h90-ai-input-wrap">',

          '<button class="h90-ai-action-btn" id="h90AiVoiceBtn" title="إدخال صوتي">',
            '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">',
              '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>',
              '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',
              '<line x1="12" y1="19" x2="12" y2="23"/>',
              '<line x1="8" y1="23" x2="16" y2="23"/>',
            '</svg>',
          '</button>',

          '<button class="h90-ai-action-btn" id="h90AiImageBtn" title="رفع صورة">',
            '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">',
              '<rect x="3" y="3" width="18" height="18" rx="2"/>',
              '<circle cx="8.5" cy="8.5" r="1.5"/>',
              '<polyline points="21 15 16 10 5 21"/>',
            '</svg>',
          '</button>',

          '<input type="text" id="h90AiInput" class="h90-ai-input" placeholder="اسألني..." autocomplete="off">',

          '<button class="h90-ai-send" id="h90AiSend" aria-label="إرسال">',
            '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="22" y1="2" x2="11" y2="13"/>',
              '<polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none"/>',
            '</svg>',
          '</button>',

        '</div>',

        '<input type="file" id="h90AiImageInput" accept="image/*" style="display:none">',

      '</div>'
    ].join('');
  }

  function init() {
    if (AI.initialized) return;

    const kb = window.H90_FAQ_DATA || [];
    if (!kb.length) {
      console.warn('[H90 AI] قاعدة المعرفة غير محمّلة');
      setTimeout(init, 300);
      return;
    }

    AI.initialized = true;
    AI.sessionId = 's_' + Date.now();

    if (!document.getElementById('h90AiStyles')) {
      const style = document.createElement('style');
      style.id = 'h90AiStyles';
      style.textContent = CHAT_STYLES;
      document.head.appendChild(style);
    }

    if (!document.getElementById('h90AiChat')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildChatHTML();
      while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
    }

    AI.chatEl = document.getElementById('h90AiChat');
    AI.messagesEl = document.getElementById('h90AiMessages');
    AI.inputEl = document.getElementById('h90AiInput');
    AI.suggestionsEl = document.getElementById('h90AiSuggestions');
    AI.voiceBtnEl = document.getElementById('h90AiVoiceBtn');
    AI.imageBtnEl = document.getElementById('h90AiImageBtn');

    document.getElementById('h90AiClose').addEventListener('click', closeChat);
    document.getElementById('h90AiSend').addEventListener('click', handleSend);
    document.getElementById('h90AiSpeakToggle').addEventListener('click', toggleSpeak);

    AI.inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    });

    if (AI.voiceBtnEl) AI.voiceBtnEl.addEventListener('click', toggleVoiceInput);
    if (AI.imageBtnEl) {
      AI.imageBtnEl.addEventListener('click', function () {
        document.getElementById('h90AiImageInput').click();
      });
    }

    document.getElementById('h90AiImageInput').addEventListener('change', handleImageSelect);
    document.getElementById('h90AiPreviewClose').addEventListener('click', clearPendingImage);

    if (window.H90AIVoice) {
      window.H90AIVoice.onResult(function (result) {
        if (result.final) {
          AI.inputEl.value = result.final;
          document.getElementById('h90AiListening').classList.remove('show');
          AI.voiceBtnEl.classList.remove('recording');
          setTimeout(function () { handleSend(); }, 100);
        }
      });

      window.H90AIVoice.onEnd(function () {
        document.getElementById('h90AiListening').classList.remove('show');
        AI.voiceBtnEl.classList.remove('recording');
      });

      window.H90AIVoice.onError(function (err) {
        document.getElementById('h90AiListening').classList.remove('show');
        AI.voiceBtnEl.classList.remove('recording');
        showToast(err.message || 'خطأ في التسجيل', 'error');
      });

      updateSpeakIcon();
    }

    const greeting = window.H90AIContext
      ? window.H90AIContext.getTimeGreeting()
      : 'أهلاً بك';

    addBotMessage(
      greeting + '!\n\n' +
      'أنا مساعد H90 الذكي\n\n' +
      'يمكنك:\n' +
      '• الكتابة أو التحدث\n' +
      '• رفع صورة للتحليل\n' +
      '• سماع الإجابات\n\n' +
      'كيف أساعدك اليوم؟'
    );

    renderSuggestions(getInitialSuggestions());

    console.log('%cH90 AI Assistant v3.1 Ready',
      'background:linear-gradient(135deg,#ff2d55,#e6003d);color:#fff;padding:4px 12px;border-radius:6px;font-weight:900;');
  }

  function getInitialSuggestions() {
    if (window.H90AIContext) {
      return window.H90AIContext.getSmartSuggestions(null);
    }
    return [
      'كيف أشاهد القنوات؟',
      'ما تشتغل عندي',
      'كيف أضيف للمفضلة؟',
      'إشعارات المباريات'
    ];
  }

  function openChat() {
    if (!AI.chatEl) return;
    if (AI.sessionId) resetSession();
    AI.chatEl.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (AI.inputEl) AI.inputEl.focus();
    }, 50);
  }

  function closeChat() {
    if (!AI.chatEl) return;
    if (window.H90AIVoice) {
      window.H90AIVoice.stopSpeaking();
      window.H90AIVoice.abortListening();
    }
    AI.chatEl.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(function () { resetSession(); }, 300);
  }

  function resetSession() {
    console.log('[H90 AI] Resetting session...');

    if (AI.messagesEl) AI.messagesEl.innerHTML = '';
    if (AI.suggestionsEl) AI.suggestionsEl.innerHTML = '';
    if (AI.inputEl) AI.inputEl.value = '';

    AI.pendingImage = null;
    const preview = document.getElementById('h90AiPreview');
    if (preview) preview.classList.remove('show');
    const previewImg = document.getElementById('h90AiPreviewImg');
    if (previewImg) previewImg.src = '';

    const listening = document.getElementById('h90AiListening');
    if (listening) listening.classList.remove('show');
    if (AI.voiceBtnEl) AI.voiceBtnEl.classList.remove('recording');

    if (window.H90AIContext) window.H90AIContext.clearContext();
    if (window.H90AICloud) window.H90AICloud.clearCache();

    AI.sessionId = 's_' + Date.now();
    AI.isWaiting = false;
    AI.lastCategory = null;

    const greeting = window.H90AIContext
      ? window.H90AIContext.getTimeGreeting()
      : 'أهلاً بك';

    addBotMessage(
      greeting + '!\n\n' +
      'أنا مساعد H90 الذكي\n\n' +
      'يمكنك:\n' +
      '• الكتابة أو التحدث\n' +
      '• رفع صورة للتحليل\n' +
      '• سماع الإجابات\n\n' +
      'كيف أساعدك اليوم؟'
    );

    renderSuggestions(getInitialSuggestions());
  }

  function renderSuggestions(items) {
    if (!AI.suggestionsEl) return;
    AI.suggestionsEl.innerHTML = '';
    items.slice(0, 5).forEach(function (text) {
      const chip = document.createElement('button');
      chip.className = 'h90-ai-chip';
      chip.textContent = text;
      chip.addEventListener('click', function () {
        AI.inputEl.value = text;
        handleSend();
      });
      AI.suggestionsEl.appendChild(chip);
    });
  }

  function addUserMessage(text, imageUrl) {
    const msg = document.createElement('div');
    msg.className = 'h90-ai-msg user';

    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'h90-ai-msg-image';
      img.alt = 'صورة';
      msg.appendChild(img);
    }

    if (text) {
      const textEl = document.createElement('div');
      textEl.textContent = text;
      msg.appendChild(textEl);
    }

    AI.messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function addBotMessage(text, options) {
    options = options || {};

    const msg = document.createElement('div');
    msg.className = 'h90-ai-msg bot';
    msg.dataset.messageId = window.H90AIDiagnosis
      ? window.H90AIDiagnosis.getMessageId()
      : 'msg_' + Date.now();

    const textEl = document.createElement('div');
    textEl.textContent = text;
    msg.appendChild(textEl);

    if (options.steps && options.steps.length) {
      const stepsEl = document.createElement('div');
      stepsEl.className = 'h90-ai-steps';
      const title = document.createElement('div');
      title.className = 'h90-ai-steps-title';
      title.textContent = 'الخطوات:';
      stepsEl.appendChild(title);

      options.steps.forEach(function (step) {
        const stepEl = document.createElement('div');
        stepEl.className = 'h90-ai-step';
        stepEl.textContent = step;
        stepsEl.appendChild(stepEl);
      });
      msg.appendChild(stepsEl);
    }

    if (options.category) {
      const tag = document.createElement('div');
      tag.className = 'h90-ai-category-tag';
      tag.textContent = options.category;
      msg.appendChild(tag);
      AI.lastCategory = options.category;
      if (window.H90AIContext) window.H90AIContext.setLastCategory(options.category);
    }

    if (options.source === 'cloud' || options.source === 'worker') {
      const cloudTag = document.createElement('div');
      cloudTag.className = 'h90-ai-cloud-tag';
      cloudTag.textContent = 'Gemini';
      msg.appendChild(cloudTag);
    }

    if (options.related && options.related.length) {
      const valid = options.related.filter(function (r) {
        return r && r.q && typeof r.q === 'string' && r.q.trim() !== '';
      });

      if (valid.length) {
        const relatedEl = document.createElement('div');
        relatedEl.className = 'h90-ai-related';

        valid.forEach(function (rel) {
          const btn = document.createElement('button');
          btn.className = 'h90-ai-related-btn';
          btn.textContent = '↗ ' + rel.q;
          btn.addEventListener('click', function () {
            AI.inputEl.value = rel.q;
            handleSend();
          });
          relatedEl.appendChild(btn);
        });
        msg.appendChild(relatedEl);
      }
    }

    if (options.category && options.category !== 'مساعد ذكي') {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'h90-ai-more-btn';
      moreBtn.textContent = 'المزيد عن ' + options.category;
      moreBtn.addEventListener('click', function () {
        const cat = options.category;
        const catItems = (window.H90_FAQ_DATA || [])
          .filter(function (f) { return f.cat === cat; })
          .slice(0, 6);

        let listText = 'أسئلة في "' + cat + '":\n\n';
        catItems.forEach(function (item, i) {
          listText += (i + 1) + '. ' + item.q + '\n';
        });

        addBotMessage(listText);
        const sugg = catItems.slice(0, 4).map(function (i) { return i.q; });
        if (sugg.length) renderSuggestions(sugg);
      });
      msg.appendChild(moreBtn);
    }

    if (!options.noFeedback && options.category !== 'التحية') {
      const feedbackEl = document.createElement('div');
      feedbackEl.className = 'h90-ai-feedback';

      const label = document.createElement('span');
      label.className = 'h90-ai-feedback-label';
      label.textContent = 'هل كانت مفيدة؟';
      feedbackEl.appendChild(label);

      const goodBtn = document.createElement('button');
      goodBtn.className = 'h90-ai-feedback-btn good';
      goodBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
      goodBtn.addEventListener('click', function () { handleFeedback(msg, true, text); });
      feedbackEl.appendChild(goodBtn);

      const badBtn = document.createElement('button');
      badBtn.className = 'h90-ai-feedback-btn bad';
      badBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
      badBtn.addEventListener('click', function () { handleFeedback(msg, false, text); });
      feedbackEl.appendChild(badBtn);

      msg.appendChild(feedbackEl);
    }

    if (window.H90AIVoice && window.H90AIVoice.isOutputEnabled && window.H90AIVoice.isOutputEnabled()) {
      if (!options.noSpeak && text.length > 3 && text.length < 800) {
        setTimeout(function () {
          window.H90AIVoice.speakAnswer(text);
        }, 100);
      }
    }

    if (window.H90AIContext) {
      window.H90AIContext.addMessage('bot', text, {
        category: options.category,
        source: options.source
      });
    }

    AI.messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function addSuggestionsMessage(suggestions) {
    const msg = document.createElement('div');
    msg.className = 'h90-ai-msg bot';
    msg.textContent = 'هل تقصد أحد هذه الأسئلة؟';

    const suggEl = document.createElement('div');
    suggEl.className = 'h90-ai-related';
    suggEl.style.marginTop = '10px';

    suggestions.forEach(function (s) {
      const btn = document.createElement('button');
      btn.className = 'h90-ai-related-btn';
      btn.textContent = s.q;
      btn.addEventListener('click', function () {
        AI.inputEl.value = s.q;
        handleSend();
      });
      suggEl.appendChild(btn);
    });

    msg.appendChild(suggEl);
    AI.messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'h90-ai-msg bot';
    el.id = 'h90AiTyping';
    el.innerHTML = '<div class="h90-ai-typing"><span></span><span></span><span></span></div>';
    AI.messagesEl.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('h90AiTyping');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      if (AI.messagesEl) AI.messagesEl.scrollTop = AI.messagesEl.scrollHeight;
    });
  }

  /* ================================================================
     📸 معالجة الصور
     ================================================================ */
  function handleImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('الصورة كبيرة جداً (5MB كحد أقصى)', 'error');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('يجب أن تكون الصورة بصيغة صحيحة', 'error');
      e.target.value = '';
      return;
    }

    AI.pendingImage = file;

    const reader = new FileReader();
    reader.onload = function (event) {
      const previewImg = document.getElementById('h90AiPreviewImg');
      const preview = document.getElementById('h90AiPreview');
      if (previewImg) previewImg.src = event.target.result;
      if (preview) preview.classList.add('show');
    };
    reader.readAsDataURL(file);

    e.target.value = '';
    showToast('تم إضافة الصورة', 'success');

    if (window.H90AIVoice) {
      window.H90AIVoice.speak('تم إضافة الصورة', { rate: 1.2 });
    }
  }

  function clearPendingImage() {
    AI.pendingImage = null;
    const preview = document.getElementById('h90AiPreview');
    if (preview) preview.classList.remove('show');
    const previewImg = document.getElementById('h90AiPreviewImg');
    if (previewImg) previewImg.src = '';
  }

  function toggleVoiceInput() {
    if (!window.H90AIVoice) {
      showToast('الميزة الصوتية غير متوفرة', 'warning');
      return;
    }

    if (window.H90AIVoice.isListening()) {
      window.H90AIVoice.stopListening();
      document.getElementById('h90AiListening').classList.remove('show');
      AI.voiceBtnEl.classList.remove('recording');
      return;
    }

    const started = window.H90AIVoice.startListening();

    if (started) {
      AI.voiceBtnEl.classList.add('recording');
      document.getElementById('h90AiListening').classList.add('show');
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      showToast('لا يمكن بدء التسجيل', 'error');
    }
  }

  function toggleSpeak() {
    if (!window.H90AIVoice) return;
    const isEnabled = window.H90AIVoice.isOutputEnabled();
    window.H90AIVoice.setOutputEnabled(!isEnabled);
    if (isEnabled) window.H90AIVoice.stopSpeaking();
    updateSpeakIcon();
    showToast(isEnabled ? 'تم كتم صوت المساعد' : 'تم تفعيل صوت المساعد', 'success');
  }

  function updateSpeakIcon() {
    const icon = document.getElementById('h90AiSpeakIcon');
    const btn = document.getElementById('h90AiSpeakToggle');
    if (!icon || !window.H90AIVoice) return;

    const enabled = window.H90AIVoice.isOutputEnabled();

    if (enabled) {
      icon.innerHTML =
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none"/>' +
        '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
        '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
      btn.classList.add('active');
    } else {
      icon.innerHTML =
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none"/>' +
        '<line x1="23" y1="9" x2="17" y2="15"/>' +
        '<line x1="17" y1="9" x2="23" y2="15"/>';
      btn.classList.remove('active');
    }
  }

  /* ================================================================
     ⚡ handleSend
     ================================================================ */
  async function handleSend() {
    if (AI.isWaiting) return;

    const text = AI.inputEl.value.trim();
    const hasImage = !!AI.pendingImage;

    if (!text && !hasImage) return;

    AI.isWaiting = true;

    const imageUrl = hasImage ? document.getElementById('h90AiPreviewImg').src : null;
    addUserMessage(text || 'حلل هذه الصورة', imageUrl);

    if (window.H90AIContext) {
      window.H90AIContext.addMessage('user', text || '[صورة]');
    }

    AI.inputEl.value = '';

    const imageToProcess = AI.pendingImage;
    clearPendingImage();

    showTyping();

    try {
      if (imageToProcess && window.H90AICloud) {
        await handleImageQuery(imageToProcess, text);
        return;
      }
      await handleTextQuery(text);
    } catch (e) {
      console.error('[H90 AI] Error:', e);
      hideTyping();
      addBotMessage(
        'حدث خطأ غير متوقع.\n\n' + (e.message || 'حاول مرة أخرى.'),
        { category: 'خطأ', noFeedback: true }
      );
    } finally {
      AI.isWaiting = false;
    }
  }

  /* ================================================================
     📝 معالجة نصية — مع إصلاح الثقة
     ================================================================ */
  async function handleTextQuery(text) {
    /* 1. فحص الرسائل غير الواضحة */
    if (window.H90AIContext) {
      const unclear = window.H90AIContext.checkUnclearMessage(text);
      if (unclear.unclear) {
        hideTyping();
        addBotMessage(unclear.response, { noFeedback: true });
        return;
      }
    }

    /* 2. بحث محلي */
    let result = null;
    if (window.H90AICore) {
      result = getLocalAnswer(text);
    }

    /* 3. تشخيص ذكي */
    let diagnosis = null;
    if (window.H90AIDiagnosis) {
      const diag = window.H90AIDiagnosis.smartDiagnose(text);
      if (diag.diagnosis && diag.diagnosis.problems.length > 0) {
        diagnosis = diag;
      }
    }

    /* 4. سؤال توضيحي */
    if (result && result.needsClarification) {
      hideTyping();
      renderClarifyingQuestion(result.needsClarification);
      return;
    }

    /* ✅ 5. تحديد الحاجة للـ Cloud */
    const shouldUseCloud = !result || 
                           result.type === 'no_match' || 
                           result.type === 'suggestions' || 
                           result.needsCloud === true ||
                           (result.confidence && result.confidence < 60);

    if (shouldUseCloud) {
      console.log('[H90 AI] Sending to Cloud:', text);

      /* إذا كان هناك اقتراحات محلية، اعرضها */
      if (result && result.suggestions && result.suggestions.length && result.type === 'suggestions') {
        hideTyping();
        addSuggestionsMessage(result.suggestions);
        return;
      }

      /* استدعِ Cloud */
      if (window.H90AICloud && window.H90AICloud.isEnabled()) {
        try {
          const cloudResult = await window.H90AICloud.ask(text);

          if (cloudResult.success && cloudResult.answer) {
            hideTyping();
            addBotMessage(cloudResult.answer, {
              category: 'مساعد ذكي',
              source: 'cloud',
              noSpeak: false
            });

            setTimeout(function () {
              const suggestions = window.H90AIContext
                ? window.H90AIContext.getSmartSuggestions(null)
                : getInitialSuggestions();
              renderSuggestions(suggestions);
            }, 500);
            return;
          }
        } catch (cloudErr) {
          console.warn('[H90 AI] Cloud failed:', cloudErr.message);
        }
      }

      /* Fallback */
      hideTyping();

      if (diagnosis && diagnosis.diagnosis.health !== 'good') {
        const diagResponse = window.H90AIDiagnosis.formatDiagnosisResponse(diagnosis.diagnosis);
        if (diagResponse) {
          addBotMessage(diagResponse, { category: 'تشخيص', noFeedback: false });
          return;
        }
      }

      if (result && result.answer) {
        addBotMessage(result.answer, {
          category: result.category,
          steps: result.steps,
          related: result.related
        });
        return;
      }

      addBotMessage(
        'لم أستطع الحصول على إجابة حالياً.\n\n' +
        'تحقق من اتصالك بالإنترنت أو أعد صياغة سؤالك.',
        { noFeedback: true }
      );
      return;
    }

    /* 6. ثقة عالية → إجابة محلية */
    hideTyping();
    displayResult(result);
  }

  /* ================================================================
     📸 معالجة صورة
     ================================================================ */
  async function handleImageQuery(imageFile, text) {
    if (!window.H90AICloud) {
      hideTyping();
      addBotMessage('ميزة تحليل الصور غير متوفرة.', { noFeedback: true });
      return;
    }

    if (!window.H90AICloud.isOnline()) {
      hideTyping();
      addBotMessage('يحتاج تحليل الصور اتصال إنترنت.', { noFeedback: true });
      return;
    }

    try {
      const question = text || 'حلل هذه الصورة وساعدني في فهم المشكلة المتعلقة بتطبيق H90.';
      const result = await window.H90AICloud.analyzeImage(imageFile, question);

      hideTyping();

      if (result.success && result.answer) {
        addBotMessage(result.answer, {
          category: 'تحليل صورة',
          source: 'cloud',
          noSpeak: false
        });
      } else {
        addBotMessage('لم أستطع تحليل الصورة.', { noFeedback: true });
      }

    } catch (e) {
      hideTyping();
      console.error('[H90 AI] Image analysis error:', e);
      addBotMessage('فشل تحليل الصورة: ' + e.message, { noFeedback: true });
    }
  }

  /* ================================================================
     🎯 getLocalAnswer — مع فحص صلة حقيقي
     ================================================================ */
  function getLocalAnswer(text) {
    if (!window.H90AICore) return null;

    const results = window.H90AICore.searchKnowledge(text);

    if (results.length === 0) {
      return {
        type: 'no_match',
        answer: 'لم أجد إجابة دقيقة.',
        needsCloud: true
      };
    }

    const best = results[0];

    /* فحص الحاجة للتوضيح */
    if (window.H90AIContext) {
      const intentInfo = window.H90AICore.classifyIntent(text);
      const topic = window.H90AIContext.extractTopic(text);
      const clarificationType = window.H90AIContext.needsClarification(intentInfo.intent, topic);

      if (clarificationType && best.score < 60) {
        return {
          type: 'clarification',
          needsClarification: clarificationType
        };
      }
    }

    /* ✅ فحص الصلة الحقيقية */
    const normalizedQuery = window.H90AICore.normalizeArabic(text);
    const normalizedQuestion = window.H90AICore.normalizeArabic(best.item.q);

    const queryWords = normalizedQuery.split(' ').filter(function (w) { return w.length > 2; });
    const questionWords = normalizedQuestion.split(' ').filter(function (w) { return w.length > 2; });

    const commonWords = queryWords.filter(function (w) {
      return questionWords.includes(w);
    });

    const relevance = queryWords.length > 0 ? commonWords.length / queryWords.length : 0;

    /* كلمات التوقف — لا تُحسب كصلة */
    const stopWords = [
      'كيف', 'ما', 'هل', 'لماذا', 'متى', 'وين', 'اين', 'ممكن', 'ابغا',
      'اريد', 'اقدر', 'عشان', 'على', 'في', 'من', 'الى', 'عن', 'اللي',
      'هذا', 'هذه', 'ذلك', 'تلك', 'كان', 'يكون', 'اذا', 'لكن', 'كل',
      'بعض', 'ايش', 'وش', 'شنو', 'ليه', 'ليش'
    ];

    const importantQueryWords = queryWords.filter(function (w) {
      return !stopWords.includes(w);
    });

    const importantQuestionWords = questionWords.filter(function (w) {
      return !stopWords.includes(w);
    });

    const importantCommon = importantQueryWords.filter(function (w) {
      return importantQuestionWords.includes(w);
    });

    const importantRelevance = importantQueryWords.length > 0
      ? importantCommon.length / importantQueryWords.length
      : 0;

    console.log('[H90 AI] Confidence Check:');
    console.log('  score:', best.score);
    console.log('  relevance:', relevance.toFixed(2));
    console.log('  importantRelevance:', importantRelevance.toFixed(2));
    console.log('  importantQueryWords:', importantQueryWords);

    /* ✅ شرط الثقة العالية */
    const isHighConfidence = (
      best.score >= 60 &&
      relevance >= 0.5 &&
      importantRelevance >= 0.5
    );

    if (isHighConfidence) {
      console.log('[H90 AI] HIGH confidence — using local');
      const related = (best.item.related || [])
        .map(function (id) {
          const found = (window.H90_FAQ_DATA || []).find(function (f) { return f.id === id; });
          return found ? { id: found.id, q: found.q } : null;
        })
        .filter(Boolean)
        .slice(0, 4);

      return {
        type: 'success',
        answer: best.item.a,
        category: best.item.cat,
        steps: best.item.steps,
        related: related,
        confidence: best.score
      };
    }

    /* ❌ ثقة منخفضة → Cloud */
    console.log('[H90 AI] LOW confidence — sending to Cloud');
    return {
      type: 'no_match',
      answer: 'دعني أفكر في سؤالك...',
      needsCloud: true
    };
  }

  /* ================================================================
     ❓ سؤال توضيحي
     ================================================================ */
  function renderClarifyingQuestion(type) {
    if (!window.H90AIContext) return;

    const question = window.H90AIContext.getClarifyingQuestion(type);
    if (!question) return;

    const msg = document.createElement('div');
    msg.className = 'h90-ai-msg bot';
    msg.textContent = question.question;

    const optionsEl = document.createElement('div');
    optionsEl.className = 'h90-ai-related';
    optionsEl.style.marginTop = '10px';

    question.options.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.className = 'h90-ai-related-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        AI.inputEl.value = opt.label;
        handleSend();
      });
      optionsEl.appendChild(btn);
    });

    msg.appendChild(optionsEl);
    AI.messagesEl.appendChild(msg);
    scrollToBottom();
  }

  /* ================================================================
     🎨 عرض النتيجة
     ================================================================ */
  function displayResult(result) {
    if (!result) {
      addBotMessage('لم أستطع معالجة طلبك.', { noFeedback: true });
      return;
    }

    if (result.type === 'suggestions') {
      addSuggestionsMessage(result.suggestions);
      return;
    }

    if (result.type === 'diagnosis') {
      addBotMessage(result.answer, {
        category: result.category,
        noFeedback: false
      });
      return;
    }

    if (result.type === 'greeting') {
      addBotMessage(result.answer, {
        category: result.category,
        related: result.related,
        noFeedback: true
      });
      return;
    }

    addBotMessage(result.answer, {
      category: result.category,
      steps: result.steps,
      related: result.related
    });

    setTimeout(function () {
      const suggestions = window.H90AIContext
        ? window.H90AIContext.getSmartSuggestions(result.category)
        : getInitialSuggestions();
      renderSuggestions(suggestions);
    }, 500);
  }

  /* ================================================================
     👍👎 Feedback
     ================================================================ */
  function handleFeedback(messageEl, isHelpful, answerText) {
    const container = messageEl.querySelector('.h90-ai-feedback');
    if (!container) return;

    const goodBtn = container.querySelector('.good');
    const badBtn = container.querySelector('.bad');

    if (isHelpful) {
      goodBtn.classList.add('selected');
      badBtn.classList.remove('selected');
    } else {
      badBtn.classList.add('selected');
      goodBtn.classList.remove('selected');
    }

    const messageId = messageEl.dataset.messageId;
    const history = window.H90AIContext ? window.H90AIContext.getHistory() : [];
    let lastUserMsg = '';
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        lastUserMsg = history[i].text;
        break;
      }
    }

    if (window.H90AIDiagnosis) {
      window.H90AIDiagnosis.recordFeedback(messageId, lastUserMsg, answerText, isHelpful);
    }

    if (!isHelpful) {
      setTimeout(function () {
        addBotMessage(
          'شكراً لملاحظتك!\n\n' +
          'ماذا كان ينقص في الإجابة؟\n' +
          '• كانت غير واضحة\n' +
          '• لم تحل مشكلتي\n' +
          '• غير صحيحة',
          { noFeedback: true, noSpeak: true }
        );
      }, 300);
    } else {
      showToast('شكراً لتقييمك!', 'success');
    }

    if (navigator.vibrate) navigator.vibrate(15);
  }

  function showToast(msg, type) {
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
      return window.showToast(msg, type);
    }
    if (typeof window.showToastSafe === 'function') {
      return window.showToastSafe(msg, type);
    }
    console.log('[H90 AI Toast]', type || 'info', msg);
  }

  /* ================================================================
     🌐 API عام
     ================================================================ */
  window.H90AI = {
    open: openChat,
    close: closeChat,
    ask: function (question) {
      openChat();
      setTimeout(function () {
        if (AI.inputEl) {
          AI.inputEl.value = question;
          handleSend();
        }
      }, 100);
    },
    resetSession: resetSession,
    getLocalAnswer: getLocalAnswer,
    stats: function () {
      return {
        version: '3.1',
        initialized: AI.initialized,
        sessionId: AI.sessionId,
        hasPendingImage: !!AI.pendingImage,
        lastCategory: AI.lastCategory,
        knowledge: (window.H90_FAQ_DATA || []).length,
        layers: {
          core: !!(window.H90AICore),
          context: !!(window.H90AIContext),
          diagnosis: !!(window.H90AIDiagnosis),
          voice: !!(window.H90AIVoice),
          cloud: !!(window.H90AICloud)
        },
        cloudStats: window.H90AICloud ? window.H90AICloud.stats() : null,
        voiceStats: window.H90AIVoice ? window.H90AIVoice.stats() : null,
        diagnosisStats: window.H90AIDiagnosis ? window.H90AIDiagnosis.stats() : null
      };
    }
  };

  /* ================================================================
     🚀 التشغيل
     ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    setTimeout(init, 100);
  }

  window.addEventListener('beforeunload', function () {
    if (window.H90AIVoice) window.H90AIVoice.stopSpeaking();
  });

  console.log('%cH90 AI Assistant v3.1',
    'background:linear-gradient(135deg,#ff2d55,#00e5ff);color:#fff;padding:6px 14px;border-radius:8px;font-weight:900;');

})();
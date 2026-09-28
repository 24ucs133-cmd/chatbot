/**
 * ChatGPT • n8n Intelligent Assistant Client
 * Production Webhook: https://sathya14.app.n8n.cloud/webhook/chat
 */

(() => {
  'use strict';

  // --- Configuration & Default State ---
  const DEFAULT_WEBHOOK_URL = 'https://sathya14.app.n8n.cloud/webhook/chat';
  const STORAGE_KEYS = {
    CONVERSATIONS: 'chatgpt_n8n_conversations',
    ACTIVE_ID: 'chatgpt_n8n_active_id',
    THEME: 'chatgpt_n8n_theme',
    WEBHOOK_URL: 'chatgpt_n8n_webhook_url',
    SOUND_ENABLED: 'chatgpt_n8n_sound_enabled',
    STREAMING_ENABLED: 'chatgpt_n8n_streaming_enabled',
    SELECTED_VOICE: 'chatgpt_n8n_voice_uri'
  };

  // State
  let conversations = [];
  let activeConversationId = null;
  let isGenerating = false;
  let abortController = null;
  let activeSpeechUtterance = null;
  let speechRecognition = null;
  let isRecordingVoice = false;
  let attachedFile = null; // { name, content }
  let audioContext = null;

  // DOM Elements
  const el = {
    appLayout: document.getElementById('appLayout'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatSearchInput: document.getElementById('chatSearchInput'),
    chatHistoryContainer: document.getElementById('chatHistoryContainer'),
    webhookStatusIndicator: document.getElementById('webhookStatusIndicator'),
    latencyDisplay: document.getElementById('latencyDisplay'),
    navStatusBadge: document.getElementById('navStatusBadge'),
    modelSelectorBtn: document.getElementById('modelSelectorBtn'),
    modelDropdownWrapper: document.getElementById('modelDropdownWrapper'),
    modelMenu: document.getElementById('modelMenu'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    exportBtn: document.getElementById('exportBtn'),
    exportMenu: document.getElementById('exportMenu'),
    exportDropdownWrapper: document.querySelector('.export-dropdown-wrapper'),
    exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    exportTextBtn: document.getElementById('exportTextBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    chatViewport: document.getElementById('chatViewport'),
    emptyState: document.getElementById('emptyState'),
    messagesList: document.getElementById('messagesList'),
    scrollBottomBtn: document.getElementById('scrollBottomBtn'),
    chatForm: document.getElementById('chatForm'),
    promptInput: document.getElementById('promptInput'),
    sendBtn: document.getElementById('sendBtn'),
    stopSpinner: document.getElementById('stopSpinner'),
    voiceBtn: document.getElementById('voiceBtn'),
    attachFileBtn: document.getElementById('attachFileBtn'),
    fileInput: document.getElementById('fileInput'),
    attachmentsPreviewBar: document.getElementById('attachmentsPreviewBar'),
    attachmentName: document.getElementById('attachmentName'),
    attachmentRemoveBtn: document.getElementById('attachmentRemoveBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    webhookUrlInput: document.getElementById('webhookUrlInput'),
    testWebhookBtn: document.getElementById('testWebhookBtn'),
    connectionTestResult: document.getElementById('connectionTestResult'),
    soundToggle: document.getElementById('soundToggle'),
    streamingToggle: document.getElementById('streamingToggle'),
    ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
    clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Initial Setup ---
  function init() {
    loadSettings();
    initMarkdown();
    initTheme();
    initAudioVoices();
    loadConversations();
    setupEventListeners();
    setupSpeechRecognition();
    checkWebhookHealth();

    // Responsive initial view
    if (window.innerWidth <= 768) {
      el.sidebar.classList.add('collapsed');
    }
  }

  // --- Markdown & Highlight Setup ---
  function initMarkdown() {
    if (window.marked) {
      marked.setOptions({
        gfm: true,
        breaks: true,
        highlight: (code, lang) => {
          if (window.hljs) {
            const validLanguage = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language: validLanguage }).value;
          }
          return code;
        }
      });
    }
  }

  // Render markdown safely with DOMPurify and code block wrappers
  function renderMarkdown(content) {
    if (!content) return '';
    try {
      const rawHtml = window.marked ? marked.parse(content) : escapeHtml(content);
      const cleanHtml = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;

      // Wrap pre blocks with nice header & copy button
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanHtml;

      const preElements = tempDiv.querySelectorAll('pre');
      preElements.forEach((pre) => {
        const codeEl = pre.querySelector('code');
        const codeText = codeEl ? codeEl.innerText : pre.innerText;
        let lang = 'code';
        if (codeEl) {
          const langMatch = codeEl.className.match(/language-(\w+)/);
          if (langMatch) lang = langMatch[1];
        }

        const blockWrapper = document.createElement('div');
        blockWrapper.className = 'code-block-container';
        blockWrapper.innerHTML = `
          <div class="code-block-header">
            <span>${lang}</span>
            <button class="code-copy-btn" type="button" data-code="${encodeURIComponent(codeText)}">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy code</span>
            </button>
          </div>
        `;
        pre.parentNode.insertBefore(blockWrapper, pre);
        blockWrapper.appendChild(pre);
      });

      // Target external links to open in new tab
      const links = tempDiv.querySelectorAll('a');
      links.forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });

      return tempDiv.innerHTML;
    } catch (e) {
      console.error('Error rendering markdown:', e);
      return escapeHtml(content).replace(/\n/g, '<br>');
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Sound Effects (Web Audio API) ---
  function playAcousticSound(type = 'send') {
    if (!getSoundEnabled()) return;
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      const now = audioContext.currentTime;

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'receive') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(560, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  }

  // --- Text to Speech Voices ---
  function initAudioVoices() {
    if ('speechSynthesis' in window) {
      const populateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        el.ttsVoiceSelect.innerHTML = '<option value="default">Default System Voice</option>';
        voices.forEach((voice) => {
          const option = document.createElement('option');
          option.value = voice.voiceURI;
          option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [Default]' : ''}`;
          el.ttsVoiceSelect.appendChild(option);
        });

        const savedVoice = localStorage.getItem(STORAGE_KEYS.SELECTED_VOICE);
        if (savedVoice) {
          el.ttsVoiceSelect.value = savedVoice;
        }
      };

      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    } else {
      el.ttsVoiceSelect.disabled = true;
    }
  }

  function readAloud(text, buttonElement) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported in this browser.', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (activeSpeechUtterance) {
        document.querySelectorAll('.msg-action-btn.tts-btn').forEach(btn => btn.classList.remove('active'));
      }
      if (activeSpeechUtterance && activeSpeechUtterance._btn === buttonElement) {
        activeSpeechUtterance = null;
        return;
      }
    }

    // Strip markdown formatting for cleaner speech
    const plainText = text.replace(/[*_#`~\[\]\(\)>]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance._btn = buttonElement;

    const savedVoiceURI = localStorage.getItem(STORAGE_KEYS.SELECTED_VOICE);
    if (savedVoiceURI && savedVoiceURI !== 'default') {
      const voices = window.speechSynthesis.getVoices();
      const foundVoice = voices.find(v => v.voiceURI === savedVoiceURI);
      if (foundVoice) utterance.voice = foundVoice;
    }

    utterance.onstart = () => {
      buttonElement.classList.add('active');
    };
    utterance.onend = utterance.onerror = () => {
      buttonElement.classList.remove('active');
      activeSpeechUtterance = null;
    };

    activeSpeechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  // --- Voice Input (Speech Recognition) ---
  function setupSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      el.voiceBtn.style.display = 'none';
      return;
    }

    speechRecognition = new SpeechRec();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isRecordingVoice = true;
      el.voiceBtn.classList.add('recording');
      showToast('Listening... Speak now', 'success');
    };

    speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      el.promptInput.value = transcript;
      handleInputResize();
      validateSendButton();
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopVoiceRecognition();
      if (event.error !== 'no-speech') {
        showToast('Microphone error: ' + event.error, 'error');
      }
    };

    speechRecognition.onend = () => {
      stopVoiceRecognition();
    };
  }

  function toggleVoiceRecognition() {
    if (!speechRecognition) return;
    if (isRecordingVoice) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (e) {
        speechRecognition.stop();
      }
    }
  }

  function stopVoiceRecognition() {
    isRecordingVoice = false;
    el.voiceBtn.classList.remove('recording');
  }

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);

    // Update highlight.js theme if needed
    const hljsThemeLink = document.getElementById('hljs-theme');
    if (hljsThemeLink) {
      hljsThemeLink.href = nextTheme === 'light'
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css';
    }
  }

  // --- Settings Persistence ---
  function loadSettings() {
    const webhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;
    el.webhookUrlInput.value = webhookUrl;

    const soundEnabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    el.soundToggle.checked = soundEnabled !== 'false';

    const streamingEnabled = localStorage.getItem(STORAGE_KEYS.STREAMING_ENABLED);
    el.streamingToggle.checked = streamingEnabled !== 'false';
  }

  function saveSettings() {
    const newUrl = el.webhookUrlInput.value.trim() || DEFAULT_WEBHOOK_URL;
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, newUrl);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, el.soundToggle.checked);
    localStorage.setItem(STORAGE_KEYS.STREAMING_ENABLED, el.streamingToggle.checked);

    if (el.ttsVoiceSelect.value) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE, el.ttsVoiceSelect.value);
    }

    closeSettingsModal();
    showToast('Settings saved successfully', 'success');
    checkWebhookHealth();
  }

  function getWebhookUrl() {
    return localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;
  }

  function getSoundEnabled() {
    return localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED) !== 'false';
  }

  function getStreamingEnabled() {
    return localStorage.getItem(STORAGE_KEYS.STREAMING_ENABLED) !== 'false';
  }

  // --- Webhook Health Check ---
  async function checkWebhookHealth() {
    const url = getWebhookUrl();
    try {
      const startTime = performance.now();
      // Test OPTIONS or light ping
      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: { 'Content-Type': 'application/json' }
      });
      const latency = Math.round(performance.now() - startTime);

      if (res.status < 500) {
        el.latencyDisplay.textContent = `${latency}ms`;
        el.navStatusBadge.innerHTML = '<span class="ping-dot"></span><span>n8n Active</span>';
        el.navStatusBadge.style.color = 'var(--accent-green)';
      } else {
        throw new Error('Server status ' + res.status);
      }
    } catch (e) {
      el.latencyDisplay.textContent = 'ready';
      el.navStatusBadge.innerHTML = '<span class="ping-dot" style="background:#f59e0b;"></span><span>n8n Ready</span>';
    }
  }

  async function testWebhookConnection() {
    const testBtn = el.testWebhookBtn;
    const resultBox = el.connectionTestResult;
    const url = el.webhookUrlInput.value.trim();

    if (!url) {
      showToast('Please enter a valid webhook URL', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.innerHTML = '<span>Testing...</span>';
    resultBox.style.display = 'block';
    resultBox.className = 'connection-test-result';
    resultBox.innerHTML = 'Sending test ping to n8n webhook...';

    const startTime = performance.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: 'ping', test: true })
      });

      const elapsed = Math.round(performance.now() - startTime);
      if (response.ok) {
        resultBox.className = 'connection-test-result success';
        resultBox.innerHTML = `<strong>Connected Successfully!</strong> Response received in <strong>${elapsed}ms</strong> (Status ${response.status}).`;
      } else {
        resultBox.className = 'connection-test-result error';
        resultBox.innerHTML = `<strong>Received HTTP ${response.status}</strong> (${response.statusText}). Check your n8n workflow active status.`;
      }
    } catch (err) {
      resultBox.className = 'connection-test-result error';
      resultBox.innerHTML = `<strong>Connection Failed:</strong> ${escapeHtml(err.message)}. Ensure CORS is enabled and workflow is active.`;
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<span>Test Connection</span>';
    }
  }

  // --- Conversations Management ---
  function loadConversations() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      conversations = stored ? JSON.parse(stored) : [];
    } catch (e) {
      conversations = [];
    }

    const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    if (savedActiveId && conversations.some(c => c.id === savedActiveId)) {
      activeConversationId = savedActiveId;
    } else if (conversations.length > 0) {
      activeConversationId = conversations[0].id;
    } else {
      createNewConversation(false);
    }

    renderSidebarHistory();
    renderCurrentConversation();
  }

  function saveConversations() {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeConversationId);
  }

  function getActiveConversation() {
    return conversations.find(c => c.id === activeConversationId) || null;
  }

  function createNewConversation(shouldSave = true) {
    const newId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newChat = {
      id: newId,
      title: 'New chat',
      createdAt: Date.now(),
      messages: []
    };
    conversations.unshift(newChat);
    activeConversationId = newId;

    if (shouldSave) {
      saveConversations();
      renderSidebarHistory();
      renderCurrentConversation();
    }
    el.promptInput.focus();
    return newChat;
  }

  function deleteConversation(id, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    conversations = conversations.filter(c => c.id !== id);
    if (activeConversationId === id) {
      if (conversations.length > 0) {
        activeConversationId = conversations[0].id;
      } else {
        createNewConversation(false);
      }
    }
    saveConversations();
    renderSidebarHistory();
    renderCurrentConversation();
    showToast('Conversation deleted', 'success');
  }

  function renameConversation(id, event) {
    if (event) event.stopPropagation();
    const chat = conversations.find(c => c.id === id);
    if (!chat) return;

    const newTitle = prompt('Enter a new title for this conversation:', chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      saveConversations();
      renderSidebarHistory();
    }
  }

  function clearAllConversations() {
    if (!confirm('This will delete all conversations permanently. Proceed?')) return;
    conversations = [];
    createNewConversation(false);
    saveConversations();
    renderSidebarHistory();
    renderCurrentConversation();
    closeSettingsModal();
    showToast('All chat history cleared', 'success');
  }

  // Group conversations by Today, Yesterday, Previous 7 Days, Older
  function renderSidebarHistory(filterText = '') {
    const container = el.chatHistoryContainer;
    container.innerHTML = '';

    const query = filterText.toLowerCase().trim();
    const filtered = query
      ? conversations.filter(c => c.title.toLowerCase().includes(query))
      : conversations;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No conversations found</div>`;
      return;
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: []
    };

    filtered.forEach((chat) => {
      const age = now - chat.createdAt;
      if (age < oneDay) {
        groups.Today.push(chat);
      } else if (age < 2 * oneDay) {
        groups.Yesterday.push(chat);
      } else if (age < 7 * oneDay) {
        groups['Previous 7 Days'].push(chat);
      } else {
        groups.Older.push(chat);
      }
    });

    Object.entries(groups).forEach(([title, chats]) => {
      if (chats.length === 0) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';

      const titleEl = document.createElement('div');
      titleEl.className = 'history-group-title';
      titleEl.textContent = title;
      groupEl.appendChild(titleEl);

      const listEl = document.createElement('div');
      listEl.className = 'history-list';

      chats.forEach((chat) => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === activeConversationId ? 'active' : ''}`;
        item.innerHTML = `
          <span class="history-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
          <div class="history-actions">
            <button class="action-icon-btn edit-btn" title="Rename chat">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete-btn delete" title="Delete chat">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `;

        item.addEventListener('click', () => {
          activeConversationId = chat.id;
          saveConversations();
          renderSidebarHistory(el.chatSearchInput.value);
          renderCurrentConversation();
          if (window.innerWidth <= 768) {
            closeSidebarMobile();
          }
        });

        item.querySelector('.edit-btn').addEventListener('click', (e) => renameConversation(chat.id, e));
        item.querySelector('.delete-btn').addEventListener('click', (e) => deleteConversation(chat.id, e));

        listEl.appendChild(item);
      });

      groupEl.appendChild(listEl);
      container.appendChild(groupEl);
    });
  }

  // --- Message Rendering in Viewport ---
  function renderCurrentConversation() {
    const chat = getActiveConversation();
    el.messagesList.innerHTML = '';

    if (!chat || chat.messages.length === 0) {
      el.emptyState.style.display = 'flex';
      el.scrollBottomBtn.classList.remove('visible');
      return;
    }

    el.emptyState.style.display = 'none';

    chat.messages.forEach((msg, idx) => {
      appendMessageToDOM(msg, idx);
    });

    scrollToBottom();
  }

  function appendMessageToDOM(msg, index) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;
    row.dataset.index = index;

    const avatarSrc = msg.role === 'user' ? 'assets/user_avatar.jpg' : 'assets/bot_avatar.jpg';
    const avatarAlt = msg.role === 'user' ? 'User' : 'Assistant';

    let attachmentMarkup = '';
    if (msg.role === 'user' && msg.attachment) {
      attachmentMarkup = `
        <div class="user-attached-file-badge">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>Attached: ${escapeHtml(msg.attachment.name)}</span>
        </div>
      `;
    }

    const messageHtml = msg.role === 'user'
      ? escapeHtml(msg.content)
      : renderMarkdown(msg.content);

    let actionsMarkup = '';
    if (msg.role === 'assistant') {
      const timingText = msg.latency ? `⚡ ${msg.latency}` : '';
      actionsMarkup = `
        <div class="message-actions-bar">
          <button class="msg-action-btn copy-msg-btn" title="Copy response">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <button class="msg-action-btn regen-btn" title="Regenerate answer">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
            <span>Regenerate</span>
          </button>
          <button class="msg-action-btn tts-btn" title="Read aloud">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span>Listen</span>
          </button>
          <button class="msg-action-btn thumb-btn thumb-up" title="Good response">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
          </button>
          <button class="msg-action-btn thumb-btn thumb-down" title="Poor response">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
          </button>
          ${timingText ? `<span class="response-timing-pill">${timingText}</span>` : ''}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="message-avatar-wrap">
        <img src="${avatarSrc}" alt="${avatarAlt}" class="message-avatar">
      </div>
      <div class="message-bubble-content">
        ${attachmentMarkup}
        <div class="message-body">${messageHtml}</div>
        ${actionsMarkup}
      </div>
    `;

    // Attach listeners to assistant action buttons
    if (msg.role === 'assistant') {
      const copyBtn = row.querySelector('.copy-msg-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => copyToClipboard(msg.content, copyBtn));
      }
      const regenBtn = row.querySelector('.regen-btn');
      if (regenBtn) {
        regenBtn.addEventListener('click', () => regenerateLastMessage());
      }
      const ttsBtn = row.querySelector('.tts-btn');
      if (ttsBtn) {
        ttsBtn.addEventListener('click', () => readAloud(msg.content, ttsBtn));
      }
      const thumbUp = row.querySelector('.thumb-up');
      const thumbDown = row.querySelector('.thumb-down');
      if (thumbUp && thumbDown) {
        thumbUp.addEventListener('click', () => {
          thumbUp.classList.toggle('active');
          thumbDown.classList.remove('active');
          showToast('Feedback submitted: helpful', 'success');
        });
        thumbDown.addEventListener('click', () => {
          thumbDown.classList.toggle('active');
          thumbUp.classList.remove('active');
          showToast('Feedback submitted: needs improvement', 'success');
        });
      }
    }

    el.messagesList.appendChild(row);
  }

  // --- Submitting Messages to n8n Webhook ---
  async function handleSendMessage(customPrompt = null) {
    if (isGenerating) {
      stopGeneration();
      return;
    }

    const text = (customPrompt !== null ? customPrompt : el.promptInput.value).trim();
    if (!text && !attachedFile) return;

    let chat = getActiveConversation();
    if (!chat) {
      chat = createNewConversation();
    }

    // Auto-title conversation from first prompt
    if (chat.messages.length === 0) {
      chat.title = text.length > 34 ? text.substring(0, 32) + '...' : text;
      saveConversations();
      renderSidebarHistory();
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachment: attachedFile ? { ...attachedFile } : null
    };
    chat.messages.push(userMessage);
    saveConversations();

    // Clear input & attachments
    el.promptInput.value = '';
    handleInputResize();
    removeAttachment();
    validateSendButton();

    renderCurrentConversation();
    playAcousticSound('send');

    // Prepare assistant response container with Thinking animation
    await queryWebhookAndStream(chat, text);
  }

  async function queryWebhookAndStream(chat, userPrompt) {
    isGenerating = true;
    updateGeneratingUI(true);

    const startTime = performance.now();
    abortController = new AbortController();

    // Create Assistant Row in DOM with Live Thinking Box
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant';
    assistantRow.innerHTML = `
      <div class="message-avatar-wrap">
        <img src="assets/bot_avatar.jpg" alt="Assistant" class="message-avatar">
      </div>
      <div class="message-bubble-content">
        <div class="thinking-container" id="activeThinkingBox">
          <div class="thinking-dots">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
          <span class="thinking-status-text">Connecting to n8n AI workflow...</span>
          <span class="thinking-timer" id="thinkingTimer">0.0s</span>
        </div>
        <div class="message-body" id="streamingTarget" style="display: none;"></div>
      </div>
    `;
    el.messagesList.appendChild(assistantRow);
    scrollToBottom();

    // Timer Interval
    const thinkingTimerEl = assistantRow.querySelector('#thinkingTimer');
    const timerInterval = setInterval(() => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      if (thinkingTimerEl) thinkingTimerEl.textContent = `${elapsed}s`;
    }, 100);

    const webhookUrl = getWebhookUrl();
    let responseText = '';
    let hasError = false;

    try {
      // Send payload with maximum compatibility
      const payload = {
        chatInput: userPrompt,
        message: userPrompt,
        prompt: userPrompt,
        query: userPrompt,
        sessionId: chat.id,
        context: attachedFile ? `Attached File Content (${attachedFile.name}):\n${attachedFile.content}` : undefined
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Webhook returned HTTP ${response.status}: ${response.statusText}`);
      }

      // Read response
      const rawBody = await response.text();
      try {
        // If JSON
        const parsed = JSON.parse(rawBody);
        if (typeof parsed === 'string') {
          responseText = parsed;
        } else if (parsed.text) {
          responseText = parsed.text;
        } else if (parsed.output) {
          responseText = parsed.output;
        } else if (parsed.response) {
          responseText = parsed.response;
        } else if (parsed.message) {
          responseText = parsed.message;
        } else if (Array.isArray(parsed) && parsed[0]) {
          responseText = parsed[0].text || parsed[0].output || JSON.stringify(parsed[0], null, 2);
        } else {
          responseText = JSON.stringify(parsed, null, 2);
        }
      } catch (jsonErr) {
        // Plain text / HTML / Markdown
        responseText = rawBody;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        responseText = '_Generation stopped by user._';
      } else {
        hasError = true;
        responseText = `⚠️ **Error communicating with n8n workflow:**\n\n\`${err.message}\`\n\n**Troubleshooting steps:**\n1. Ensure your n8n workflow is **Published / Active**.\n2. Confirm the webhook URL in **Settings** matches: \`${webhookUrl}\`.\n3. Verify your n8n credentials for the OpenRouter / LLM node are active.`;
      }
    } finally {
      clearInterval(timerInterval);
    }

    const elapsedTotal = ((performance.now() - startTime) / 1000).toFixed(1) + 's';

    // Remove thinking box
    const thinkingBox = assistantRow.querySelector('#activeThinkingBox');
    if (thinkingBox) thinkingBox.remove();

    const streamingTarget = assistantRow.querySelector('#streamingTarget');
    streamingTarget.style.display = 'block';

    if (getStreamingEnabled() && !hasError && responseText.length > 50) {
      // Typewriter streaming effect
      await streamTypewriter(streamingTarget, responseText);
    } else {
      streamingTarget.innerHTML = renderMarkdown(responseText);
    }

    playAcousticSound('receive');

    // Save assistant message to conversation history
    const assistantMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      latency: elapsedTotal
    };
    chat.messages.push(assistantMessage);
    saveConversations();

    // Re-render conversation to attach full action bars cleanly
    renderCurrentConversation();

    isGenerating = false;
    updateGeneratingUI(false);
  }

  // Typewriter streaming simulator for smooth ChatGPT feel
  function streamTypewriter(targetElement, fullText) {
    return new Promise((resolve) => {
      let currentIndex = 0;
      const step = Math.max(2, Math.floor(fullText.length / 140)); // Dynamic speed based on length
      const cursor = document.createElement('span');
      cursor.className = 'streaming-cursor';

      const interval = setInterval(() => {
        if (!isGenerating) {
          clearInterval(interval);
          targetElement.innerHTML = renderMarkdown(fullText);
          resolve();
          return;
        }

        currentIndex += step;
        if (currentIndex >= fullText.length) {
          clearInterval(interval);
          targetElement.innerHTML = renderMarkdown(fullText);
          resolve();
        } else {
          const slice = fullText.substring(0, currentIndex);
          targetElement.innerHTML = renderMarkdown(slice);
          targetElement.appendChild(cursor);
          scrollToBottom();
        }
      }, 16);
    });
  }

  function stopGeneration() {
    if (abortController) {
      abortController.abort();
    }
    isGenerating = false;
    updateGeneratingUI(false);
    showToast('Generation cancelled', 'success');
  }

  function regenerateLastMessage() {
    const chat = getActiveConversation();
    if (!chat || chat.messages.length === 0) return;

    // Find the last user prompt
    let lastUserIndex = -1;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const userPrompt = chat.messages[lastUserIndex].content;
    // Remove messages after that prompt
    chat.messages = chat.messages.slice(0, lastUserIndex + 1);
    saveConversations();
    renderCurrentConversation();

    queryWebhookAndStream(chat, userPrompt);
  }

  function updateGeneratingUI(generating) {
    if (generating) {
      el.sendBtn.classList.add('generating');
      el.sendBtn.title = 'Stop generating';
      el.sendBtn.querySelector('.send-icon').style.display = 'none';
      el.stopSpinner.style.display = 'inline-flex';
      el.sendBtn.disabled = false;
    } else {
      el.sendBtn.classList.remove('generating');
      el.sendBtn.title = 'Send prompt (Enter)';
      el.sendBtn.querySelector('.send-icon').style.display = 'inline-flex';
      el.stopSpinner.style.display = 'none';
      validateSendButton();
    }
  }

  // --- Attachments Handling ---
  function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('File size must be under 2MB', 'error');
      el.fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      attachedFile = {
        name: file.name,
        content: e.target.result
      };
      el.attachmentName.textContent = file.name;
      el.attachmentsPreviewBar.style.display = 'flex';
      validateSendButton();
      showToast(`Attached: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }

  function removeAttachment() {
    attachedFile = null;
    el.fileInput.value = '';
    el.attachmentsPreviewBar.style.display = 'none';
    validateSendButton();
  }

  // --- Copy to Clipboard with Visual Feedback ---
  async function copyToClipboard(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      const originalHtml = buttonEl.innerHTML;
      buttonEl.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-green);"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span style="color:var(--accent-green);">Copied!</span>
      `;
      setTimeout(() => {
        buttonEl.innerHTML = originalHtml;
      }, 2000);
    } catch (e) {
      showToast('Failed to copy to clipboard', 'error');
    }
  }

  // Delegate copy button clicks on code blocks
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.code-copy-btn');
    if (copyBtn) {
      const code = decodeURIComponent(copyBtn.dataset.code || '');
      copyToClipboard(code, copyBtn);
    }
  });

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    if (type === 'success') {
      icon = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-green);"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      icon = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--danger-color);"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s ease-in forwards';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // --- Export Chat Conversation ---
  function exportChat(format = 'markdown') {
    const chat = getActiveConversation();
    if (!chat || chat.messages.length === 0) {
      showToast('No messages to export', 'error');
      return;
    }

    let fileContent = '';
    let fileName = `${chat.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    let mimeType = 'text/plain';

    if (format === 'markdown') {
      fileName += '.md';
      mimeType = 'text/markdown';
      fileContent = `# ${chat.title}\n_Exported on ${new Date().toLocaleString()}_\n\n---\n\n`;
      chat.messages.forEach((msg) => {
        const role = msg.role === 'user' ? '### 👤 User' : '### 🤖 ChatGPT';
        fileContent += `${role}\n\n${msg.content}\n\n---\n\n`;
      });
    } else if (format === 'json') {
      fileName += '.json';
      mimeType = 'application/json';
      fileContent = JSON.stringify(chat, null, 2);
    } else if (format === 'text') {
      fileName += '.txt';
      chat.messages.forEach((msg) => {
        fileContent += `[${msg.role.toUpperCase()} - ${new Date(msg.timestamp).toLocaleTimeString()}]\n${msg.content}\n\n`;
      });
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    el.exportDropdownWrapper.classList.remove('open');
    showToast(`Exported as ${format.toUpperCase()}`, 'success');
  }

  // --- Scroll helpers ---
  function scrollToBottom() {
    el.chatViewport.scrollTo({
      top: el.chatViewport.scrollHeight,
      behavior: 'smooth'
    });
  }

  function handleViewportScroll() {
    const threshold = 180;
    const distanceToBottom = el.chatViewport.scrollHeight - el.chatViewport.scrollTop - el.chatViewport.clientHeight;
    if (distanceToBottom > threshold) {
      el.scrollBottomBtn.classList.add('visible');
    } else {
      el.scrollBottomBtn.classList.remove('visible');
    }
  }

  // --- Textarea auto-resize ---
  function handleInputResize() {
    const input = el.promptInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }

  function validateSendButton() {
    if (isGenerating) {
      el.sendBtn.disabled = false;
      return;
    }
    const hasText = el.promptInput.value.trim().length > 0;
    const hasFile = attachedFile !== null;
    el.sendBtn.disabled = !(hasText || hasFile);
  }

  // --- Mobile Sidebar Controls ---
  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      const isOpen = el.sidebar.classList.contains('mobile-open');
      if (isOpen) {
        closeSidebarMobile();
      } else {
        openSidebarMobile();
      }
    } else {
      el.sidebar.classList.toggle('collapsed');
    }
  }

  function openSidebarMobile() {
    el.sidebar.classList.add('mobile-open');
    el.sidebarBackdrop.classList.add('mobile-open');
  }

  function closeSidebarMobile() {
    el.sidebar.classList.remove('mobile-open');
    el.sidebarBackdrop.classList.remove('mobile-open');
  }

  // --- Modal Helpers ---
  function openSettingsModal() {
    el.settingsModal.style.display = 'flex';
  }

  function closeSettingsModal() {
    el.settingsModal.style.display = 'none';
    el.connectionTestResult.style.display = 'none';
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Form submission
    el.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage();
    });

    // Keyboard enter in textarea
    el.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    el.promptInput.addEventListener('input', () => {
      handleInputResize();
      validateSendButton();
    });

    // Prompt suggestion cards
    document.querySelectorAll('.prompt-card').forEach((card) => {
      card.addEventListener('click', () => {
        const promptText = card.dataset.prompt;
        if (promptText) {
          handleSendMessage(promptText);
        }
      });
    });

    // Sidebar Toggles
    el.sidebarToggleBtn.addEventListener('click', toggleSidebar);
    el.sidebarCloseBtn.addEventListener('click', toggleSidebar);
    el.sidebarBackdrop.addEventListener('click', closeSidebarMobile);

    // New Chat
    el.newChatBtn.addEventListener('click', () => {
      createNewConversation();
      if (window.innerWidth <= 768) closeSidebarMobile();
    });

    // Chat search filter
    el.chatSearchInput.addEventListener('input', (e) => {
      renderSidebarHistory(e.target.value);
    });

    // Theme Toggle
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // Export Dropdown
    el.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      el.exportDropdownWrapper.classList.toggle('open');
    });

    el.exportMarkdownBtn.addEventListener('click', () => exportChat('markdown'));
    el.exportJsonBtn.addEventListener('click', () => exportChat('json'));
    el.exportTextBtn.addEventListener('click', () => exportChat('text'));

    // Clear current chat
    el.clearChatBtn.addEventListener('click', () => {
      const chat = getActiveConversation();
      if (chat && chat.messages.length > 0) {
        if (confirm('Clear messages from this conversation?')) {
          chat.messages = [];
          saveConversations();
          renderCurrentConversation();
          showToast('Chat cleared', 'success');
        }
      }
    });

    // Scroll to bottom button
    el.scrollBottomBtn.addEventListener('click', scrollToBottom);
    el.chatViewport.addEventListener('scroll', handleViewportScroll);

    // Voice button
    el.voiceBtn.addEventListener('click', toggleVoiceRecognition);

    // File attachments
    el.attachFileBtn.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', handleFileSelected);
    el.attachmentRemoveBtn.addEventListener('click', removeAttachment);

    // Model Selector Dropdown
    el.modelSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      el.modelDropdownWrapper.classList.toggle('open');
    });

    document.querySelectorAll('.model-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const modelName = opt.querySelector('.model-opt-name').textContent.split('•')[0].trim();
        el.modelSelectorBtn.querySelector('.model-badge').textContent = modelName;
        el.modelDropdownWrapper.classList.remove('open');
      });
    });

    // Settings Modal
    el.settingsBtn.addEventListener('click', openSettingsModal);
    el.webhookStatusIndicator.addEventListener('click', openSettingsModal);
    el.closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
    el.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    el.saveSettingsBtn.addEventListener('click', saveSettings);
    el.testWebhookBtn.addEventListener('click', testWebhookConnection);
    el.clearAllHistoryBtn.addEventListener('click', clearAllConversations);

    // Global click to close popovers
    document.addEventListener('click', (e) => {
      if (!el.exportDropdownWrapper.contains(e.target)) {
        el.exportDropdownWrapper.classList.remove('open');
      }
      if (!el.modelDropdownWrapper.contains(e.target)) {
        el.modelDropdownWrapper.classList.remove('open');
      }
      if (e.target === el.settingsModal) {
        closeSettingsModal();
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        createNewConversation();
      }
      // Esc: Close Modals
      if (e.key === 'Escape') {
        closeSettingsModal();
        el.exportDropdownWrapper.classList.remove('open');
        el.modelDropdownWrapper.classList.remove('open');
      }
    });
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ============================================================
// Ashley's Salon App
// ============================================================
// Backend: Google Apps Script webhook
// ============================================================

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbz7fUcczJy8Oh9mFOt-ewwv4TfC9TKnbQ5Kcll4_YUS-1_CsC9d9SQuj3a1rTrM71Tj/exec';

// ---- Screen navigation ----
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
  renderLogs();
}

// ---- Voice Recognition ----
let recognition = null;
let currentContext = null;
let currentTranscript = '';

function startVoice(context) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice not supported on this browser — try Safari on iPhone');
    return;
  }

  currentContext = context;
  currentTranscript = '';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  const micBtn      = document.getElementById(`mic-${context}`);
  const transcriptEl = document.getElementById(`transcript-${context}`);
  const confirmBtn  = document.getElementById(`confirm-${context}`);

  micBtn.classList.add('listening');
  micBtn.querySelector('.mic-label').textContent = 'Listening...';
  transcriptEl.classList.add('visible');
  transcriptEl.textContent = '...';
  confirmBtn.classList.add('hidden');

  recognition.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    currentTranscript = (final || interim).trim();
    transcriptEl.textContent = currentTranscript;
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
    micBtn.querySelector('.mic-label').textContent = 'Tap to Speak';
    if (currentTranscript) {
      confirmBtn.classList.remove('hidden');
    }
  };

  recognition.onerror = (e) => {
    micBtn.classList.remove('listening');
    micBtn.querySelector('.mic-label').textContent = 'Tap to Speak';
    showToast('Mic error — try again');
    console.error('Speech error:', e.error);
  };

  recognition.start();
}

// ---- Confirm & log ----
function confirmLog(context) {
  if (!currentTranscript) return;

  const entry = {
    text: currentTranscript,
    time: new Date().toISOString(),
    context,
  };

  saveLocal(entry);
  sendToSheet(entry);

  document.getElementById(`transcript-${context}`).textContent = '';
  document.getElementById(`transcript-${context}`).classList.remove('visible');
  document.getElementById(`confirm-${context}`).classList.add('hidden');
  currentTranscript = '';

  showToast('Logged ✅');
  renderLogs();
}

// ---- Local Storage ----
function saveLocal(entry) {
  const key = `salon_log_${entry.context}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift(entry);
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
}

function getLogs(context) {
  return JSON.parse(localStorage.getItem(`salon_log_${context}`) || '[]');
}

// ---- Render logs ----
function renderLogs() {
  ['inventory', 'cash', 'followup'].forEach(ctx => {
    const el = document.getElementById(`log-${ctx}`);
    if (!el) return;
    const logs = getLogs(ctx);
    if (!logs.length) {
      el.innerHTML = '<div class="empty-state">Nothing logged yet.</div>';
      return;
    }
    el.innerHTML = logs.map(entry => `
      <div class="log-item">
        <span class="log-item-text">${entry.text}</span>
        <span class="log-item-time">${formatTime(entry.time)}</span>
      </div>
    `).join('');
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---- Google Sheets sync ----
// Uses GET + URL params — more reliable with Apps Script redirects
async function sendToSheet(entry) {
  if (!SHEET_URL) return;
  try {
    const params = new URLSearchParams({
      text: entry.text,
      time: entry.time,
      context: entry.context,
    });
    await fetch(`${SHEET_URL}?${params.toString()}`, { mode: 'no-cors' });
  } catch (e) {
    console.warn('Sheet sync failed — saved locally only', e);
  }
}

// ---- Toast ----
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  renderLogs();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
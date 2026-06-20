// ════════════════ AET AI CHAT MODULE ════════════════
(function() {
  const WORKER_URL = 'https://monbudget-ai.albaneloh686.workers.dev';
  const MAX_MESSAGES_PER_DAY = 10;

  function getTodayKey() {
    const d = new Date();
    return `aet_ai_count_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
  }

  function getMessageCount() {
    const key = getTodayKey();
    return parseInt(localStorage.getItem(key) || '0');
  }

  function incrementMessageCount() {
    const key = getTodayKey();
    localStorage.setItem(key, getMessageCount() + 1);
  }

  function getRemainingMessages() {
    return MAX_MESSAGES_PER_DAY - getMessageCount();
  }

  const css = `
    #aet-chat-btn {
      position: fixed; bottom: 80px; right: 20px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(102,126,234,0.5);
      font-size: 24px; color: white; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #aet-chat-btn:hover { transform: scale(1.1); }
    #aet-chat-box {
      position: fixed; bottom: 150px; right: 20px; z-index: 9999;
      width: 320px; height: 440px; border-radius: 16px;
      background: white; box-shadow: 0 8px 40px rgba(0,0,0,0.2);
      display: none; flex-direction: column; overflow: hidden;
    }
    #aet-chat-box.open { display: flex; }
    #aet-chat-header {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white; padding: 14px 16px; font-weight: bold; font-size: 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #aet-chat-quota {
      font-size: 11px; opacity: 0.85; text-align: center;
      padding: 6px 12px; background: #f8f9ff; border-bottom: 1px solid #eee;
    }
    #aet-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .aet-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
    .aet-msg.user { align-self: flex-end; background: #667eea; color: white; border-bottom-right-radius: 4px; }
    .aet-msg.ai { align-self: flex-start; background: #f0f2ff; color: #333; border-bottom-left-radius: 4px; }
    .aet-msg.loading { opacity: 0.6; font-style: italic; }
    .aet-msg.error { background: #fff0f0; color: #c00; }
    #aet-chat-input-row {
      padding: 12px; border-top: 1px solid #eee;
      display: flex; gap: 8px;
    }
    #aet-chat-input {
      flex: 1; border: 1px solid #ddd; border-radius: 20px;
      padding: 8px 14px; font-size: 13px; outline: none;
    }
    #aet-chat-input:disabled { background: #f5f5f5; }
    #aet-chat-send {
      background: #667eea; color: white; border: none;
      border-radius: 50%; width: 36px; height: 36px;
      cursor: pointer; font-size: 16px;
    }
    #aet-chat-send:disabled { background: #ccc; cursor: not-allowed; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'aet-chat-btn';
  btn.innerHTML = '🤖';
  btn.title = 'Assistant IA';

  const box = document.createElement('div');
  box.id = 'aet-chat-box';
  box.innerHTML = `
    <div id="aet-chat-header">
      <span>🤖 Assistant Budget IA</span>
      <span id="aet-chat-close" style="cursor:pointer;font-size:18px;">✕</span>
    </div>
    <div id="aet-chat-quota">💬 <span id="aet-quota-text"></span> messages restants aujourd'hui</div>
    <div id="aet-chat-messages">
      <div class="aet-msg ai">Bonjour ! Je suis votre assistant budget. Posez-moi vos questions sur vos finances 💰</div>
    </div>
    <div id="aet-chat-input-row">
      <input id="aet-chat-input" placeholder="Votre question..." />
      <button id="aet-chat-send">➤</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  function updateQuota() {
    const remaining = getRemainingMessages();
    document.getElementById('aet-quota-text').textContent = remaining;
    const input = document.getElementById('aet-chat-input');
    const send = document.getElementById('aet-chat-send');
    if (remaining <= 0) {
      input.disabled = true;
      input.placeholder = 'Limite atteinte — revenez demain';
      send.disabled = true;
    }
  }

  btn.onclick = () => { box.classList.toggle('open'); updateQuota(); };
  document.getElementById('aet-chat-close').onclick = () => box.classList.remove('open');

  async function sendMessage() {
    if (getRemainingMessages() <= 0) return;

    const input = document.getElementById('aet-chat-input');
    const messages = document.getElementById('aet-chat-messages');
    const text = input.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'aet-msg user';
    userMsg.textContent = text;
    messages.appendChild(userMsg);
    input.value = '';

    incrementMessageCount();
    updateQuota();

    const loadMsg = document.createElement('div');
    loadMsg.className = 'aet-msg ai loading';
    loadMsg.textContent = '⏳ Analyse en cours...';
    messages.appendChild(loadMsg);
    messages.scrollTop = messages.scrollHeight;

    try {
      let transactions = [];
      if (window.currentUserTransactions) {
        transactions = window.currentUserTransactions.slice(0, 20);
      }

      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, transactions })
      });

      const data = await res.json();
      loadMsg.className = 'aet-msg ai';
      loadMsg.textContent = data.reply || 'Désolé, je n\'ai pas pu répondre.';
    } catch (e) {
      loadMsg.className = 'aet-msg ai error';
      loadMsg.textContent = '❌ Erreur de connexion. Réessayez.';
    }
    messages.scrollTop = messages.scrollHeight;
  }

  document.getElementById('aet-chat-send').onclick = sendMessage;
  document.getElementById('aet-chat-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };
})();

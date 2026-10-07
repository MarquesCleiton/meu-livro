/**
 * ============================================================================
 * SCRIPT.JS - LÓGICA DO VISITANTE (BALÃO FLUTUANTE & CHAT COMPACTO)
 * ============================================================================
 */

// URL da Implantação Web App do Google Apps Script do Cleiton
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw88AuRZ23bxGzTWsvcIpVPfPcMo-xzxG4_fbTCmnyV_DrS_vvJpg9nIJym4LapNABJeA/exec";

// Chaves do LocalStorage
const STORAGE_TOKEN_KEY = "cleiton_livro_token";
const STORAGE_USER_NAME = "cleiton_livro_name";
const STORAGE_USER_PHONE = "cleiton_livro_phone";
const STORAGE_MESSAGES_KEY = "cleiton_livro_messages_cache";

// Estado da Aplicação
let currentToken = "";
let currentMessages = [];
let pollingInterval = null;
let isSubmitting = false;

// Elementos do DOM
const floatingChatBtn = document.getElementById("floatingChatBtn");
const floatingUnreadBadge = document.getElementById("floatingUnreadBadge");
const btnOpenChatFromCard = document.getElementById("btnOpenChatFromCard");
const chatDrawer = document.getElementById("chatDrawer");
const chatDrawerBackdrop = document.getElementById("chatDrawerBackdrop");
const btnCloseChatDrawer = document.getElementById("btnCloseChatDrawer");

const contactFormContainer = document.getElementById("contactFormContainer");
const chatViewContainer = document.getElementById("chatViewContainer");
const contactForm = document.getElementById("contactForm");
const inputName = document.getElementById("inputName");
const inputPhone = document.getElementById("inputPhone");
const inputMessage = document.getElementById("inputMessage");
const btnSubmitForm = document.getElementById("btnSubmitForm");

const chatMessages = document.getElementById("chatMessages");
const chatQuickForm = document.getElementById("chatQuickForm");
const chatQuickInput = document.getElementById("chatQuickInput");
const toastNotification = document.getElementById("toastNotification");

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSession();
  setupPhoneMask();
  setupEventListeners();
  pingVisitor();
});

/**
 * Inicializa ou recupera o identificador do visitante
 */
function initSession() {
  currentToken = localStorage.getItem(STORAGE_TOKEN_KEY);

  if (!currentToken) {
    currentToken = "usr_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    localStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
  }

  // Preencher nome e telefone se já foram salvos
  const savedName = localStorage.getItem(STORAGE_USER_NAME);
  const savedPhone = localStorage.getItem(STORAGE_USER_PHONE);
  if (savedName && inputName) inputName.value = savedName;
  if (savedPhone && inputPhone) inputPhone.value = savedPhone;

  // Carregar mensagens salvas no cache local
  const cached = localStorage.getItem(STORAGE_MESSAGES_KEY);
  if (cached) {
    try {
      currentMessages = JSON.parse(cached);
    } catch (e) {
      currentMessages = [];
    }
  }

  // Se já houver mensagens ou se já tiver nome cadastrado, alternar para chat
  if (currentMessages.length > 0 || (savedName && savedPhone)) {
    switchToChatView();
    renderMessages(currentMessages);
    fetchMessagesFromServer();
  }
}

/**
 * Detecta o tipo de dispositivo simplificado do visitante
 */
function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iPhone (iOS)";
  if (/ipad/i.test(ua)) return "iPad (iOS)";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Outro";
}

/**
 * Identifica a origem do acesso (parâmetro ?src= ou referrer ou padrão QR Code)
 */
function getAccessOrigin() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const src = urlParams.get("src") || urlParams.get("origem") || urlParams.get("utm_source");
    if (src) return src;
    if (document.referrer) {
      if (document.referrer.includes("instagram")) return "Instagram";
      if (document.referrer.includes("google")) return "Google";
      return "Link Externo";
    }
  } catch (e) {}
  return "QR Code Folheto";
}

/**
 * Envia um ping para registrar o acesso do visitante no Google Sheets
 */
async function pingVisitor() {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const savedName = localStorage.getItem(STORAGE_USER_NAME) || "";
    const savedPhone = localStorage.getItem(STORAGE_USER_PHONE) || "";
    const dispositivo = getDeviceInfo();
    const origem = getAccessOrigin();

    const url = `${GOOGLE_SCRIPT_URL}?action=ping&token=${encodeURIComponent(currentToken)}&nome=${encodeURIComponent(savedName)}&contato=${encodeURIComponent(savedPhone)}&dispositivo=${encodeURIComponent(dispositivo)}&origem=${encodeURIComponent(origem)}`;
    
    await fetch(url, { method: "GET", mode: "no-cors" });
  } catch (err) {
    // Falha silenciosa
  }
}

/**
 * Máscara para telefone celular
 */
function setupPhoneMask() {
  if (!inputPhone) return;

  inputPhone.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.substring(0, 11);

    if (value.length > 6) {
      value = `(${value.substring(0, 2)}) ${value.substring(2, value.length - 4)}-${value.substring(value.length - 4)}`;
    } else if (value.length > 2) {
      value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    e.target.value = value;
  });
}

/**
 * Configuração de Ouvintes de Eventos
 */
function setupEventListeners() {
  // Abrir Drawer de Chat pelo Balão Flutuante ou pelo Botão do Card
  if (floatingChatBtn) {
    floatingChatBtn.addEventListener("click", openChatDrawer);
  }
  if (btnOpenChatFromCard) {
    btnOpenChatFromCard.addEventListener("click", openChatDrawer);
  }

  // Fechar Drawer de Chat
  if (btnCloseChatDrawer) {
    btnCloseChatDrawer.addEventListener("click", closeChatDrawer);
  }
  if (chatDrawerBackdrop) {
    chatDrawerBackdrop.addEventListener("click", closeChatDrawer);
  }

  // Envio do formulário inicial
  if (contactForm) {
    contactForm.addEventListener("submit", handleInitialFormSubmit);
  }

  // Envio pelo chat rápido
  if (chatQuickForm) {
    chatQuickForm.addEventListener("submit", handleQuickMessageSubmit);
  }
}

function openChatDrawer() {
  if (floatingUnreadBadge) {
    floatingUnreadBadge.classList.add("hidden");
  }
  if (chatDrawer && chatDrawerBackdrop) {
    chatDrawerBackdrop.classList.remove("hidden");
    chatDrawer.classList.remove("hidden");

    // Focar no campo adequado
    setTimeout(() => {
      if (!contactFormContainer.classList.contains("hidden")) {
        if (!inputName.value) inputName.focus();
        else if (!inputPhone.value) inputPhone.focus();
        else inputMessage.focus();
      } else {
        chatQuickInput.focus();
      }
    }, 300);
  }
}

function closeChatDrawer() {
  if (chatDrawer && chatDrawerBackdrop) {
    chatDrawerBackdrop.classList.add("hidden");
    chatDrawer.classList.add("hidden");
  }
}

/**
 * Envio do formulário de primeiro contato
 */
async function handleInitialFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const nome = inputName.value.trim();
  const contato = inputPhone.value.trim();
  const mensagem = inputMessage.value.trim();

  if (!nome) {
    showToast("Por favor, digite seu nome.");
    inputName.focus();
    return;
  }
  if (!contato || contato.length < 10) {
    showToast("Por favor, digite um telefone válido.");
    inputPhone.focus();
    return;
  }
  if (!mensagem) {
    showToast("Por favor, digite sua mensagem.");
    inputMessage.focus();
    return;
  }

  isSubmitting = true;
  btnSubmitForm.classList.add("loading");

  localStorage.setItem(STORAGE_USER_NAME, nome);
  localStorage.setItem(STORAGE_USER_PHONE, contato);

  const payload = {
    action: "send_message",
    token: currentToken,
    nome: nome,
    contato: contato,
    mensagem: mensagem
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success && Array.isArray(result.messages)) {
      currentMessages = result.messages;
      saveMessagesCache(currentMessages);
      switchToChatView();
      renderMessages(currentMessages);
      playSendSound();
      showToast("Mensagem enviada com sucesso!");
    } else {
      switchToChatView();
    }
  } catch (err) {
    // Fallback local
    const fallbackMsg = {
      id: "local_" + Date.now(),
      data_hora: formatTimeNow(),
      token: currentToken,
      nome: nome,
      contato: contato,
      remetente: "Visitante",
      mensagem: mensagem,
      status: "novo"
    };
    currentMessages.push(fallbackMsg);
    saveMessagesCache(currentMessages);
    switchToChatView();
    renderMessages(currentMessages);
    showToast("Mensagem enviada para o Cleiton!");
  } finally {
    btnSubmitForm.classList.remove("loading");
    isSubmitting = false;
  }
}

/**
 * Envia mensagem rápida pelo chat
 */
async function handleQuickMessageSubmit(e) {
  e.preventDefault();
  const text = chatQuickInput.value.trim();
  if (!text) return;

  chatQuickInput.value = "";

  const savedName = localStorage.getItem(STORAGE_USER_NAME) || "Visitante";
  const savedPhone = localStorage.getItem(STORAGE_USER_PHONE) || "";

  const localMsg = {
    id: "msg_" + Date.now(),
    data_hora: formatTimeNow(),
    token: currentToken,
    nome: savedName,
    contato: savedPhone,
    remetente: "Visitante",
    mensagem: text,
    status: "novo"
  };

  currentMessages.push(localMsg);
  saveMessagesCache(currentMessages);
  renderMessages(currentMessages);
  playSendSound();

  try {
    const payload = {
      action: "send_message",
      token: currentToken,
      nome: savedName,
      contato: savedPhone,
      mensagem: text
    };

    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (err) {}
}

/**
 * Busca novas mensagens do servidor periodicamente
 */
async function fetchMessagesFromServer() {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=get_messages&token=${encodeURIComponent(currentToken)}&_t=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && Array.isArray(data.messages)) {
      const prevCount = currentMessages.length;
      const prevLastMsg = currentMessages[currentMessages.length - 1];

      currentMessages = data.messages;
      saveMessagesCache(currentMessages);
      renderMessages(currentMessages);

      // Notificar se Cleiton respondeu
      if (currentMessages.length > prevCount) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg.remetente === "Cleiton" && (!prevLastMsg || prevLastMsg.id !== lastMsg.id)) {
          playReceiveSound();
          showToast("Cleiton M. respondeu!");
          // Se o drawer estiver fechado, mostrar o badge vermelho com número de novas mensagens
          if (chatDrawer && chatDrawer.classList.contains("hidden")) {
            if (floatingUnreadBadge) {
              const unreadCleiton = currentMessages.filter(m => m.remetente === "Cleiton").length;
              floatingUnreadBadge.textContent = unreadCleiton || 1;
              floatingUnreadBadge.classList.remove("hidden");
            }
          }
        }
      }
    }
  } catch (err) {}
}

/**
 * Alterna visualização para o Chat
 */
function switchToChatView() {
  contactFormContainer.classList.add("hidden");
  chatViewContainer.classList.remove("hidden");

  if (!pollingInterval) {
    pollingInterval = setInterval(fetchMessagesFromServer, 7000);
  }
}

/**
 * Renderiza as mensagens na tela
 */
function renderMessages(messages) {
  if (!chatMessages) return;

  chatMessages.innerHTML = "";

  if (!messages || messages.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "chat-bubble-row cleiton";
    emptyRow.innerHTML = `
      <div class="chat-bubble">
        <div class="chat-bubble-sender">Cleiton M.</div>
        Olá! Envie seu recado que te responderei por aqui.
      </div>
    `;
    chatMessages.appendChild(emptyRow);
    return;
  }

  messages.forEach((msg) => {
    const isVisitor = msg.remetente === "Visitante";
    const row = document.createElement("div");
    row.className = `chat-bubble-row ${isVisitor ? "visitor" : "cleiton"}`;

    const senderName = isVisitor ? "Você" : "Cleiton M.";
    const timeFormatted = formatMessageTime(msg.data_hora);

    row.innerHTML = `
      <div class="chat-bubble">
        ${!isVisitor ? `<div class="chat-bubble-sender">${senderName}</div>` : ""}
        ${escapeHtml(msg.mensagem)}
      </div>
      <span class="chat-bubble-time">${timeFormatted}</span>
    `;

    chatMessages.appendChild(row);
  });

  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 50);
}

function saveMessagesCache(msgs) {
  try {
    localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(msgs));
  } catch (e) {}
}

/**
 * Efeitos Sonoros com Web Audio API
 */
function playSendSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

function playReceiveSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = "triangle";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.08);
    osc2.start(audioCtx.currentTime + 0.08);
    osc2.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

let toastTimeout;
function showToast(text) {
  if (!toastNotification) return;
  toastNotification.textContent = text;
  toastNotification.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastNotification.classList.remove("visible");
  }, 3000);
}

function formatTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMessageTime(dateTimeStr) {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (typeof dateTimeStr === "string" && dateTimeStr.includes(" ")) {
    const parts = dateTimeStr.split(" ")[1]?.split(":");
    if (parts && parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  }
  return dateTimeStr;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

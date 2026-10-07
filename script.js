/**
 * ============================================================================
 * SCRIPT.JS - LÓGICA DO CLIENTE VISITANTE (CHAT ÚNICO & SESSÃO PERSISTENTE)
 * ============================================================================
 */

// URL da Implantação Web App do Google Apps Script do Cleiton
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzf-ppjcGqHq7A3XsltUlWJZJ5hs9CXd1323N85Q9Tui5OkX-suZ3ageIOwal6UjM_X-A/exec";

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
const chatStatusText = document.getElementById("chatStatusText");
const displayTokenShort = document.getElementById("displayTokenShort");
const btnResetSession = document.getElementById("btnResetSession");
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
 * Inicializa ou recupera o token de sessão do visitante
 */
function initSession() {
  currentToken = localStorage.getItem(STORAGE_TOKEN_KEY);

  if (!currentToken) {
    // Gerar token único v4 amigável
    currentToken = "usr_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    localStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
  }

  // Atualizar indicador visual do token
  if (displayTokenShort) {
    displayTokenShort.textContent = "Sessão: " + currentToken.substring(0, 10) + "...";
  }

  // Preencher nome e telefone se já foram salvos anteriormente
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

  // Se já houver mensagens ou se já tiver nome cadastrado, verificar no servidor
  if (currentMessages.length > 0 || (savedName && savedPhone)) {
    switchToChatView();
    renderMessages(currentMessages);
    fetchMessagesFromServer();
  }
}

/**
 * Envia um ping para registrar o acesso do visitante no Google Sheets
 */
async function pingVisitor() {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const savedName = localStorage.getItem(STORAGE_USER_NAME) || "";
    const savedPhone = localStorage.getItem(STORAGE_USER_PHONE) || "";
    const url = `${GOOGLE_SCRIPT_URL}?action=ping&token=${encodeURIComponent(currentToken)}&nome=${encodeURIComponent(savedName)}&contato=${encodeURIComponent(savedPhone)}`;
    
    await fetch(url, { method: "GET", mode: "no-cors" });
  } catch (err) {
    console.warn("Aviso ao sincronizar ping:", err);
  }
}

/**
 * Máscara dinâmica para telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
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
 * Configura ouvintes de eventos da página
 */
function setupEventListeners() {
  // Envio do formulário inicial
  if (contactForm) {
    contactForm.addEventListener("submit", handleInitialFormSubmit);
  }

  // Envio de mensagens subsequentes pelo chat rápido
  if (chatQuickForm) {
    chatQuickForm.addEventListener("submit", handleQuickMessageSubmit);
  }

  // Botão de reiniciar sessão
  if (btnResetSession) {
    btnResetSession.addEventListener("click", () => {
      if (confirm("Deseja realmente limpar sua conversa e reiniciar a sessão neste navegador?")) {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_NAME);
        localStorage.removeItem(STORAGE_USER_PHONE);
        localStorage.removeItem(STORAGE_MESSAGES_KEY);
        window.location.reload();
      }
    });
  }
}

/**
 * Processa o envio do formulário de primeiro contato
 */
async function handleInitialFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const nome = inputName.value.trim();
  const contato = inputPhone.value.trim();
  const mensagem = inputMessage.value.trim();

  if (!nome) {
    showToast("Por favor, informe seu nome.");
    inputName.focus();
    return;
  }
  if (!contato || contato.length < 10) {
    showToast("Por favor, informe um WhatsApp ou telefone de contato válido.");
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

  // Salvar dados no localStorage
  localStorage.setItem(STORAGE_USER_NAME, nome);
  localStorage.setItem(STORAGE_USER_PHONE, contato);

  const payload = {
    action: "send_message",
    token: currentToken,
    nome: nome,
    contato: contato,
    mensagem: mensagem
  };

  // Se o usuário ainda não colocou o GOOGLE_SCRIPT_URL, simular envio local perfeitamente
  if (!GOOGLE_SCRIPT_URL) {
    setTimeout(() => {
      const nowStr = formatTimeNow();
      const mockMsg = {
        id: "mock_" + Date.now(),
        data_hora: nowStr,
        token: currentToken,
        nome: nome,
        contato: contato,
        remetente: "Visitante",
        mensagem: mensagem,
        status: "novo"
      };

      currentMessages.push(mockMsg);
      saveMessagesCache(currentMessages);

      switchToChatView();
      renderMessages(currentMessages);
      playSendSound();
      showToast("Mensagem enviada com sucesso!");

      btnSubmitForm.classList.remove("loading");
      isSubmitting = false;

      // Resposta automática de boas-vindas do Cleiton no modo de teste
      setTimeout(() => {
        const replyMock = {
          id: "rep_" + Date.now(),
          data_hora: formatTimeNow(),
          token: currentToken,
          nome: "Cleiton M.",
          contato: "",
          remetente: "Cleiton",
          mensagem: `Olá, ${nome}! Muito obrigado por entrar em contato sobre o livro Protocolo Bluehand. Já recebi seu recado!`,
          status: "respondido"
        };
        currentMessages.push(replyMock);
        saveMessagesCache(currentMessages);
        renderMessages(currentMessages);
        playReceiveSound();
        showToast("Cleiton M. respondeu!");
      }, 3000);
    }, 900);
    return;
  }

  // Envio real para o Google Apps Script
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
      showToast("Mensagem enviada! Sincronizando com Cleiton...");
      switchToChatView();
    }
  } catch (err) {
    console.error("Erro ao enviar:", err);
    // Fallback: guarda localmente e prossegue para não travar o visitante
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
    showToast("Mensagem salva e sincronizando...");
  } finally {
    btnSubmitForm.classList.remove("loading");
    isSubmitting = false;
  }
}

/**
 * Envia mensagem rápida pelo chat aberto
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

  if (!GOOGLE_SCRIPT_URL) return;

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
    }).catch(err => console.warn("Erro silencioso ao enviar:", err));
  } catch (err) {
    console.warn("Falha de rede:", err);
  }
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

      // Notificar se chegou mensagem nova de Cleiton
      if (currentMessages.length > prevCount) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg.remetente === "Cleiton" && (!prevLastMsg || prevLastMsg.id !== lastMsg.id)) {
          playReceiveSound();
          showToast("Cleiton M. respondeu!");
        }
      }
    }
  } catch (err) {
    // Falha silenciosa de polling
  }
}

/**
 * Transiciona a visualização do formulário para o Chat
 */
function switchToChatView() {
  contactFormContainer.classList.add("hidden");
  chatViewContainer.classList.remove("hidden");

  // Iniciar polling a cada 7 segundos
  if (!pollingInterval) {
    pollingInterval = setInterval(fetchMessagesFromServer, 7000);
  }
}

/**
 * Renderiza as mensagens na tela de chat
 */
function renderMessages(messages) {
  if (!chatMessages) return;

  chatMessages.innerHTML = `
    <div class="chat-date-divider">
      <span>Hoje</span>
    </div>
  `;

  if (!messages || messages.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "chat-bubble-row cleiton";
    emptyRow.innerHTML = `
      <div class="chat-bubble">
        <div class="chat-bubble-sender">Cleiton M.</div>
        Olá! Envie sua mensagem pelo formulário para falarmos diretamente.
      </div>
    `;
    chatMessages.appendChild(emptyRow);
    return;
  }

  messages.forEach((msg) => {
    const isVisitor = msg.remetente === "Visitante";
    const row = document.createElement("div");
    row.className = `chat-bubble-row ${isVisitor ? "visitor" : "cleiton"}`;

    const senderName = isVisitor ? (msg.nome || "Você") : "Cleiton M.";
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

  // Rolar automaticamente para o final
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 50);
}

/**
 * Salva mensagens no cache do navegador
 */
function saveMessagesCache(msgs) {
  try {
    localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(msgs));
  } catch (e) {}
}

/**
 * Efeitos Sonoros sintetizados com Web Audio API (sem dependência de arquivos externos)
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

/**
 * Toast / Pop-up de Notificação rápida
 */
let toastTimeout;
function showToast(text) {
  if (!toastNotification) return;
  toastNotification.textContent = text;
  toastNotification.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastNotification.classList.remove("visible");
  }, 3500);
}

/**
 * Formatadores e Utilitários
 */
function formatTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatMessageTime(dateTimeStr) {
  if (!dateTimeStr) return "";
  if (dateTimeStr.includes(" ")) {
    const timePart = dateTimeStr.split(" ")[1];
    if (timePart) {
      const parts = timePart.split(":");
      return `${parts[0]}:${parts[1]}`;
    }
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

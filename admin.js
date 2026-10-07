/**
 * ============================================================================
 * ADMIN.JS - LÓGICA DO PAINEL ADMINISTRATIVO (CLEITON M.)
 * ============================================================================
 */

// URL da Implantação Web App do Google Apps Script do Cleiton
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-cxADLboWj0K3ouC8qv6RyPUazl4Av99KMKVL1dYvTaaxRQnb9oTiPxEQNuBL5IuoxA/exec";

// Chave de autenticação em memória (obtida dinamicamente do campo de senha digitado pelo usuário)
let adminKey = "";

// Chave da sessão no navegador
const STORAGE_ADMIN_AUTH = "cleiton_admin_authenticated";

// Estado da Aplicação
let isAuthenticated = false;
let conversationsData = [];
let activeToken = null;
let currentFilter = "all";
let searchTerm = "";
let refreshInterval = null;

// Elementos do DOM
const loginOverlay = document.getElementById("loginOverlay");
const adminApp = document.getElementById("adminApp");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const btnAdminLogin = document.getElementById("btnAdminLogin");
const btnLogout = document.getElementById("btnLogout");
const btnManualRefresh = document.getElementById("btnManualRefresh");
const gasWarningBanner = document.getElementById("gasWarningBanner");

const kpiTotalVisitors = document.getElementById("kpiTotalVisitors");
const kpiTotalChats = document.getElementById("kpiTotalChats");
const kpiTotalMessages = document.getElementById("kpiTotalMessages");
const kpiPendingMessages = document.getElementById("kpiPendingMessages");
const kpiPendingDetail = document.getElementById("kpiPendingDetail");

const searchInput = document.getElementById("searchInput");
const filterTabs = document.querySelectorAll(".filter-tab");
const countTabAll = document.getElementById("countTabAll");
const countTabPending = document.getElementById("countTabPending");
const countTabScanned = document.getElementById("countTabScanned");
const conversationsList = document.getElementById("conversationsList");
const inboxLayoutWrapper = document.getElementById("inboxLayoutWrapper");
const btnBackToInbox = document.getElementById("btnBackToInbox");

const emptyChatState = document.getElementById("emptyChatState");
const activeChatState = document.getElementById("activeChatState");
const activeContactAvatar = document.getElementById("activeContactAvatar");
const activeContactName = document.getElementById("activeContactName");
const activeContactStatus = document.getElementById("activeContactStatus");
const activeContactPhone = document.getElementById("activeContactPhone");
const activeContactVisits = document.getElementById("activeContactVisits");
const activeContactToken = document.getElementById("activeContactToken");
const btnCallWhatsapp = document.getElementById("btnCallWhatsapp");
const activeChatMessages = document.getElementById("activeChatMessages");
const adminReplyForm = document.getElementById("adminReplyForm");
const adminReplyText = document.getElementById("adminReplyText");
const adminToast = document.getElementById("adminToast");

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkAuth();
});

async function checkAuth() {
  const savedAuth = sessionStorage.getItem(STORAGE_ADMIN_AUTH);
  if (savedAuth) {
    adminKey = savedAuth;
    await verifyAndUnlock(savedAuth, true);
  } else {
    showLoginScreen();
  }
}

function showLoginScreen(errorMsg = "") {
  sessionStorage.removeItem(STORAGE_ADMIN_AUTH);
  loginOverlay.classList.remove("hidden");
  loginOverlay.style.display = "flex";
  adminApp.classList.add("hidden");
  adminApp.style.display = "none";
  if (btnAdminLogin) {
    btnAdminLogin.disabled = false;
    btnAdminLogin.textContent = "Acessar Painel";
  }
  if (errorMsg) {
    showToast(errorMsg);
    if (adminPasswordInput) {
      adminPasswordInput.style.borderColor = "var(--admin-danger)";
      adminPasswordInput.focus();
    }
  }
}

async function verifyAndUnlock(password, isAutoLogin = false) {
  if (btnAdminLogin) {
    btnAdminLogin.disabled = true;
    btnAdminLogin.textContent = "Verificando senha...";
  }

  // Se não houver Google Script configurado, usa mock
  if (!GOOGLE_SCRIPT_URL) {
    unlockAdmin();
    loadMockData();
    return;
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=admin_overview&admin_key=${encodeURIComponent(password)}&_t=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem(STORAGE_ADMIN_AUTH, password);
      adminKey = password;
      unlockAdmin();
      updateKpis(data.stats);
      conversationsData = data.conversations || [];
      renderConversationsList();
    } else {
      showLoginScreen(data.error || "Senha de administrador incorreta.");
    }
  } catch (err) {
    console.error("Erro ao autenticar:", err);
    if (isAutoLogin) {
      showLoginScreen("Erro de conexão com o Google Sheets. Digite a senha novamente.");
    } else {
      showLoginScreen("Falha ao conectar. Verifique sua conexão e tente novamente.");
    }
  }
}

function unlockAdmin() {
  isAuthenticated = true;
  loginOverlay.classList.add("hidden");
  loginOverlay.style.display = "none";
  adminApp.classList.remove("hidden");
  adminApp.style.display = "flex";

  // Iniciar atualização periódica a cada 10s
  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      loadAdminData(true);
    }, 10000);
  }
}

function setupEventListeners() {
  // Login
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = adminPasswordInput.value.trim();
    if (!pass) {
      showToast("Por favor, digite a senha.");
      return;
    }
    await verifyAndUnlock(pass, false);
  });

  // Logout
  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE_ADMIN_AUTH);
    window.location.reload();
  });

  // Refresh manual
  btnManualRefresh.addEventListener("click", () => {
    loadAdminData();
    showToast("Atualizando dados...");
  });

  // Busca
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderConversationsList();
  });

  // Filtros de abas
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.getAttribute("data-filter");
      renderConversationsList();
    });
  });

  // Envio de resposta pelo admin
  adminReplyForm.addEventListener("submit", handleAdminReplySubmit);

  // Atalho Ctrl+Enter para enviar resposta
  adminReplyText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      adminReplyForm.requestSubmit();
    }
  });

  // Copiar token ao clicar (se existir)
  if (activeContactToken) {
    activeContactToken.addEventListener("click", () => {
      if (activeToken) {
        navigator.clipboard.writeText(activeToken);
        showToast("Identificador copiado!");
      }
    });
  }

  // Voltar para a lista no mobile
  if (btnBackToInbox) {
    btnBackToInbox.addEventListener("click", () => {
      if (inboxLayoutWrapper) {
        inboxLayoutWrapper.classList.remove("mobile-chat-open");
      }
      activeToken = null;
      renderConversationsList();
    });
  }
}

// ==========================================================================
// CARREGAMENTO DOS DADOS (API OU MOCK)
// ==========================================================================
async function loadAdminData(isBackground = false) {
  if (!GOOGLE_SCRIPT_URL) {
    loadMockData();
    return;
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=admin_overview&admin_key=${encodeURIComponent(adminKey)}&_t=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      updateKpis(data.stats);
      conversationsData = data.conversations || [];
      renderConversationsList();

      if (activeToken) {
        loadActiveChatMessages(activeToken, true);
      }
    } else {
      if (!isBackground) showToast("Erro: " + (data.error || "Falha ao autenticar"));
    }
  } catch (err) {
    console.warn("Erro ao buscar dados do Google Apps Script:", err);
  }
}

/**
 * Atualiza os cards de indicadores numéricos
 */
function updateKpis(stats) {
  if (!stats) return;

  kpiTotalVisitors.textContent = stats.total_visitantes || 0;
  kpiTotalChats.textContent = stats.total_conversas || 0;
  kpiTotalMessages.textContent = stats.total_mensagens || 0;

  const pending = stats.mensagens_pendentes || 0;
  kpiPendingMessages.textContent = pending;

  if (pending > 0) {
    kpiPendingDetail.textContent = `Atenção: ${pending} visitante(s) aguardam sua resposta!`;
    kpiPendingDetail.style.color = "#c2410c";
  } else {
    kpiPendingDetail.textContent = "Tudo em dia!";
    kpiPendingDetail.style.color = "var(--admin-text-muted)";
  }
}

/**
 * Renderiza a lista de conversas na coluna da esquerda
 */
function renderConversationsList() {
  if (!conversationsList) return;

  // Filtragem
  let filtered = conversationsData.filter((c) => {
    // Busca por texto
    const matchSearch =
      !searchTerm ||
      (c.nome && c.nome.toLowerCase().includes(searchTerm)) ||
      (c.contato && c.contato.includes(searchTerm)) ||
      (c.token && c.token.toLowerCase().includes(searchTerm)) ||
      (c.ultima_mensagem && c.ultima_mensagem.toLowerCase().includes(searchTerm));

    if (!matchSearch) return false;

    // Filtros de abas
    if (currentFilter === "pending") return c.status_pendente;
    if (currentFilter === "scanned") return c.total_mensagens === 0;
    return true;
  });

  // Atualizar contadores das abas
  if (countTabAll) countTabAll.textContent = conversationsData.length;
  if (countTabPending) countTabPending.textContent = conversationsData.filter((c) => c.status_pendente).length;
  if (countTabScanned) countTabScanned.textContent = conversationsData.filter((c) => c.total_mensagens === 0).length;

  if (filtered.length === 0) {
    conversationsList.innerHTML = `
      <div class="inbox-loading">Nenhuma conversa encontrada neste filtro.</div>
    `;
    return;
  }

  conversationsList.innerHTML = "";

  filtered.forEach((conv) => {
    const item = document.createElement("div");
    item.className = `conv-item ${conv.token === activeToken ? "active" : ""} ${conv.status_pendente ? "pending" : ""}`;

    const initials = getInitials(conv.nome);
    const hasMessages = conv.total_mensagens > 0;
    const badgeHtml = conv.status_pendente
      ? `<span class="conv-badge badge-pending">Aguardando</span>`
      : hasMessages
      ? `<span class="conv-badge badge-replied">Respondido</span>`
      : `<span class="conv-badge badge-scanned">Apenas Acesso</span>`;

    const previewText = conv.ultima_mensagem
      ? (conv.ultimo_remetente === "Cleiton" ? "Você: " : "") + conv.ultima_mensagem
      : "Escaneou o folheto, aguardando mensagem...";

    item.innerHTML = `
      <div class="conv-avatar">${initials}</div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${escapeHtml(conv.nome)}</span>
          <span class="conv-time">${formatDateShort(conv.ultima_data_msg || conv.data_ultimo_acesso)}</span>
        </div>
        <div class="conv-phone">${conv.contato ? escapeHtml(conv.contato) : "Sem telefone informado"}</div>
        <div class="conv-preview">${escapeHtml(previewText)}</div>
        <div style="margin-top: 6px;">${badgeHtml}</div>
      </div>
    `;

    item.addEventListener("click", () => {
      selectConversation(conv);
    });

    conversationsList.appendChild(item);
  });
}

/**
 * Seleciona uma conversa e abre o painel da direita
 */
function selectConversation(conv) {
  activeToken = conv.token;
  renderConversationsList();

  if (inboxLayoutWrapper) {
    inboxLayoutWrapper.classList.add("mobile-chat-open");
  }

  emptyChatState.classList.add("hidden");
  activeChatState.classList.remove("hidden");

  activeContactAvatar.textContent = getInitials(conv.nome);
  activeContactName.textContent = conv.nome || "Visitante";
  activeContactPhone.textContent = conv.contato || "Nenhum telefone registrado";
  activeContactVisits.textContent = `${conv.total_acessos || 1} acesso(s)`;
  if (activeContactToken) activeContactToken.textContent = conv.token;

  if (conv.status_pendente) {
    activeContactStatus.textContent = "Aguardando sua resposta";
    activeContactStatus.className = "status-pill";
  } else {
    activeContactStatus.textContent = conv.total_mensagens > 0 ? "Respondido" : "Apenas Acesso";
    activeContactStatus.className = "status-pill replied";
  }

  // Link do WhatsApp
  if (conv.contato && conv.contato.replace(/\D/g, "").length >= 10) {
    const rawNumber = conv.contato.replace(/\D/g, "");
    const formatted = rawNumber.startsWith("55") ? rawNumber : "55" + rawNumber;
    btnCallWhatsapp.href = `https://wa.me/${formatted}?text=${encodeURIComponent(`Olá ${conv.nome}, sou o Cleiton referente ao livro Protocolo Bluehand!`)}`;
    btnCallWhatsapp.style.display = "inline-flex";
  } else {
    btnCallWhatsapp.style.display = "none";
  }

  loadActiveChatMessages(conv.token);
  adminReplyText.focus();
}

/**
 * Carrega as mensagens da conversa ativa
 */
async function loadActiveChatMessages(token, isBackground = false) {
  if (!GOOGLE_SCRIPT_URL) {
    renderMockChatMessages(token);
    return;
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=admin_get_chat&admin_key=${encodeURIComponent(adminKey)}&token=${encodeURIComponent(token)}&_t=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && Array.isArray(data.messages)) {
      renderChatMessagesStream(data.messages);
      
      // Marcar como lido no backend
      if (!isBackground) {
        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_mark_read",
            admin_key: adminKey,
            token: token
          })
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar mensagens do chat:", err);
  }
}

/**
 * Renderiza o stream de mensagens do chat ativo
 */
function renderChatMessagesStream(messages) {
  if (!activeChatMessages) return;

  if (!messages || messages.length === 0) {
    activeChatMessages.innerHTML = `
      <div style="text-align: center; color: var(--admin-text-muted); padding: 40px 0;">
        Este visitante ainda não enviou mensagens de texto.
      </div>
    `;
    return;
  }

  activeChatMessages.innerHTML = "";

  messages.forEach((msg) => {
    const isCleiton = msg.remetente === "Cleiton";
    const row = document.createElement("div");
    row.className = `admin-msg-row ${isCleiton ? "cleiton" : "visitor"}`;

    row.innerHTML = `
      <div class="admin-msg-bubble">
        ${escapeHtml(msg.mensagem)}
      </div>
      <div class="admin-msg-meta">
        ${isCleiton ? "Você (Cleiton M.)" : escapeHtml(msg.nome || "Visitante")} • ${escapeHtml(msg.data_hora)}
      </div>
    `;

    activeChatMessages.appendChild(row);
  });

  setTimeout(() => {
    activeChatMessages.scrollTop = activeChatMessages.scrollHeight;
  }, 50);
}

/**
 * Processa a resposta enviada por Cleiton
 */
async function handleAdminReplySubmit(e) {
  e.preventDefault();
  const text = adminReplyText.value.trim();

  if (!text || !activeToken) return;

  adminReplyText.value = "";

  const nowFormatted = formatTimeNow();

  // Otimisticamente adicionar à UI imediatamente
  const row = document.createElement("div");
  row.className = "admin-msg-row cleiton";
  row.innerHTML = `
    <div class="admin-msg-bubble">${escapeHtml(text)}</div>
    <div class="admin-msg-meta">Você (Cleiton M.) • ${nowFormatted}</div>
  `;
  activeChatMessages.appendChild(row);
  activeChatMessages.scrollTop = activeChatMessages.scrollHeight;

  // Atualizar conversa localmente
  const targetConv = conversationsData.find((c) => c.token === activeToken);
  if (targetConv) {
    targetConv.status_pendente = false;
    targetConv.ultima_mensagem = text;
    targetConv.ultimo_remetente = "Cleiton";
    targetConv.ultima_data_msg = nowFormatted;
    targetConv.total_mensagens++;
    renderConversationsList();
  }

  showToast("Resposta enviada para o visitante!");

  if (!GOOGLE_SCRIPT_URL) return;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "admin_reply",
        admin_key: adminKey,
        token: activeToken,
        mensagem: text
      })
    });
  } catch (err) {
    console.error("Erro ao enviar resposta:", err);
    showToast("Erro ao sincronizar com Google Sheets.");
  }
}

// ==========================================================================
// MOCK DATA (DEMONSTRAÇÃO LOCAL ATÉ CONECTAR O GOOGLE SHEETS)
// ==========================================================================
let mockDataInitialized = false;
let mockMessagesStore = {};

function loadMockData() {
  if (!mockDataInitialized) {
    mockDataInitialized = true;
    conversationsData = [
      {
        token: "usr_a19b28c_demo1",
        nome: "Mariana Souza",
        contato: "(11) 98765-4321",
        total_acessos: 3,
        total_mensagens: 2,
        ultima_mensagem: "Oi Cleiton, meu vizinho recebeu o pacote por engano. Já estou com ele aqui!",
        ultima_data_msg: "Hoje 14:15",
        ultimo_remetente: "Visitante",
        status_pendente: true
      },
      {
        token: "usr_f7823ab_demo2",
        nome: "Roberto Carlos Almeida",
        contato: "(11) 91234-5678",
        total_acessos: 2,
        total_mensagens: 3,
        ultima_mensagem: "Combinado então, Cleiton! Até amanhã.",
        ultima_data_msg: "Hoje 11:30",
        ultimo_remetente: "Visitante",
        status_pendente: false
      },
      {
        token: "usr_99812dd_demo3",
        nome: "Visitante Anônimo",
        contato: "",
        total_acessos: 1,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "Hoje 09:20",
        ultimo_remetente: "",
        status_pendente: false
      }
    ];

    mockMessagesStore["usr_a19b28c_demo1"] = [
      {
        id: "m1",
        data_hora: "Hoje 14:10",
        nome: "Mariana Souza",
        remetente: "Visitante",
        mensagem: "Boa tarde Cleiton, tudo bem? Recebi esse folheto junto com a entrega do livro Protocolo Bluehand."
      },
      {
        id: "m2",
        data_hora: "Hoje 14:15",
        nome: "Mariana Souza",
        remetente: "Visitante",
        mensagem: "Oi Cleiton, meu vizinho recebeu o pacote por engano. Já estou com ele aqui!"
      }
    ];

    mockMessagesStore["usr_f7823ab_demo2"] = [
      {
        id: "m3",
        data_hora: "Hoje 11:20",
        nome: "Roberto Carlos Almeida",
        remetente: "Visitante",
        mensagem: "Olá, você deixou o aviso na Rua Independência?"
      },
      {
        id: "m4",
        data_hora: "Hoje 11:25",
        nome: "Cleiton M.",
        remetente: "Cleiton",
        mensagem: "Olá Roberto! Sim, deixei o aviso pois recebi a notificação de entrega concluída. Consegue me entregar amanhã?"
      },
      {
        id: "m5",
        data_hora: "Hoje 11:30",
        nome: "Roberto Carlos Almeida",
        remetente: "Visitante",
        mensagem: "Combinado então, Cleiton! Até amanhã."
      }
    ];
  }

  updateKpis({
    total_visitantes: 12,
    total_conversas: 2,
    total_mensagens: 5,
    mensagens_pendentes: 1
  });

  renderConversationsList();
}

function renderMockChatMessages(token) {
  const msgs = mockMessagesStore[token] || [];
  renderChatMessagesStream(msgs);
}

// ==========================================================================
// UTILITÁRIOS
// ==========================================================================
function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateShort(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const str = String(dateVal);
  if (str.includes(" ")) {
    return str.split(" ")[1] || str;
  }
  return str;
}

function formatTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let toastTimer;
function showToast(text) {
  if (!adminToast) return;
  adminToast.textContent = text;
  adminToast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    adminToast.classList.remove("visible");
  }, 3000);
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

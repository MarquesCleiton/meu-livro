/**
 * ============================================================================
 * ADMIN.JS - LÓGICA DO PAINEL ADMINISTRATIVO (CLEITON M.)
 * Gestão de Mensagens, Chats 1-a-1 e Planilha & Métricas de Acessos
 * ============================================================================
 */

// URL da Implantação Web App do Google Apps Script do Cleiton
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw88AuRZ23bxGzTWsvcIpVPfPcMo-xzxG4_fbTCmnyV_DrS_vvJpg9nIJym4LapNABJeA/exec";

// ID da Planilha do Google para abertura direta
const GOOGLE_SPREADSHEET_ID = "1n2wn6p_9rYgzwAb7JIHOqEDVx1HNfQRXCAj-uPtNrNA";

// Chave de autenticação em memória (obtida dinamicamente da senha digitada pelo usuário)
let adminKey = "";

// Chave da sessão no navegador
const STORAGE_ADMIN_AUTH = "cleiton_admin_authenticated";

// Estado da Aplicação
let isAuthenticated = false;
let currentMainView = "chats"; // 'chats' ou 'accesses'
let conversationsData = [];
let activeToken = null;
let currentFilter = "all";
let searchTerm = "";
let refreshInterval = null;

// Estado das Métricas & Planilha de Acessos
let accessOverviewStats = {};
let accessLogsData = [];
let hourlyStatsData = new Array(24).fill(0);
let deviceStatsData = {};
let originStatsData = {};
let rankingPeopleData = [];
let accessSearchTerm = "";
let accessPeriodFilter = "all";
let accessTypeFilter = "all";

// Elementos do DOM - Autenticação & Estrutura
const loginOverlay = document.getElementById("loginOverlay");
const adminApp = document.getElementById("adminApp");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const btnAdminLogin = document.getElementById("btnAdminLogin");
const btnLogout = document.getElementById("btnLogout");
const btnManualRefresh = document.getElementById("btnManualRefresh");
const gasWarningBanner = document.getElementById("gasWarningBanner");
const adminToast = document.getElementById("adminToast");

// Navegação por Abas Principais
const tabNavChats = document.getElementById("tabNavChats");
const tabNavAccesses = document.getElementById("tabNavAccesses");
const chatsViewSection = document.getElementById("chatsViewSection");
const accessesViewSection = document.getElementById("accessesViewSection");
const navBadgePending = document.getElementById("navBadgePending");
const navBadgeAccesses = document.getElementById("navBadgeAccesses");

// KPIs de Conversas
const kpiTotalVisitors = document.getElementById("kpiTotalVisitors");
const kpiTotalChats = document.getElementById("kpiTotalChats");
const kpiTotalMessages = document.getElementById("kpiTotalMessages");
const kpiPendingMessages = document.getElementById("kpiPendingMessages");
const kpiPendingDetail = document.getElementById("kpiPendingDetail");

// Lista de Conversas & Chat Ativo
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

// KPIs de Acesso
const kpiAccessTotal = document.getElementById("kpiAccessTotal");
const kpiAccessVisitors = document.getElementById("kpiAccessVisitors");
const kpiAccessAvgPerPerson = document.getElementById("kpiAccessAvgPerPerson");
const kpiAccessPeakHour = document.getElementById("kpiAccessPeakHour");
const kpiAccessPeakDetail = document.getElementById("kpiAccessPeakDetail");
const kpiAccessMobilePct = document.getElementById("kpiAccessMobilePct");

// Gráfico de Acessos por Hora (24h)
const hourlyBarsWrapper = document.getElementById("hourlyBarsWrapper");
const peakHourBadgeText = document.getElementById("peakHourBadgeText");
const hourlyInsightText = document.getElementById("hourlyInsightText");

// Ranking de Pessoas & Dispositivos
const peopleRankingList = document.getElementById("peopleRankingList");
const peopleRankingCount = document.getElementById("peopleRankingCount");
const deviceAnalyticsContent = document.getElementById("deviceAnalyticsContent");

// Planilha de Acessos
const accessSearchInput = document.getElementById("accessSearchInput");
const accessFilterPeriod = document.getElementById("accessFilterPeriod");
const accessFilterType = document.getElementById("accessFilterType");
const accessTableCountSummary = document.getElementById("accessTableCountSummary");
const accessLogsTableBody = document.getElementById("accessLogsTableBody");
const btnExportAccessCsv = document.getElementById("btnExportAccessCsv");
const btnOpenGoogleSheets = document.getElementById("btnOpenGoogleSheets");

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

  // Se for a senha "demo" ou não houver Google Script configurado, usa mock
  if (password === "demo" || !GOOGLE_SCRIPT_URL) {
    sessionStorage.setItem(STORAGE_ADMIN_AUTH, password);
    adminKey = password;
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
      applyOverviewData(data);
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

  // Iniciar atualização periódica a cada 12s
  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      loadAdminData(true);
    }, 12000);
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

  // Alternador de Abas Principais (Chats vs Acessos)
  if (tabNavChats) {
    tabNavChats.addEventListener("click", () => switchMainView("chats"));
  }
  if (tabNavAccesses) {
    tabNavAccesses.addEventListener("click", () => switchMainView("accesses"));
  }

  // Busca de conversas
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderConversationsList();
  });

  // Filtros de abas de conversas
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

  // Filtros e busca da Planilha de Acessos
  if (accessSearchInput) {
    accessSearchInput.addEventListener("input", (e) => {
      accessSearchTerm = e.target.value.toLowerCase().trim();
      renderAccessLogsTable();
    });
  }

  if (accessFilterPeriod) {
    accessFilterPeriod.addEventListener("change", (e) => {
      accessPeriodFilter = e.target.value;
      renderAccessLogsTable();
    });
  }

  if (accessFilterType) {
    accessFilterType.addEventListener("change", (e) => {
      accessTypeFilter = e.target.value;
      renderAccessLogsTable();
    });
  }

  // Exportar CSV
  if (btnExportAccessCsv) {
    btnExportAccessCsv.addEventListener("click", exportAccessLogsToCsv);
  }

  // Link do Google Planilhas
  if (btnOpenGoogleSheets && GOOGLE_SPREADSHEET_ID) {
    btnOpenGoogleSheets.href = `https://docs.google.com/spreadsheets/d/${GOOGLE_SPREADSHEET_ID}/edit`;
  }
}

// ==========================================================================
// ALTERNÂNCIA DE ABAS PRINCIPAIS (CHATS VS PLANILHA DE ACESSOS)
// ==========================================================================
function switchMainView(viewName) {
  currentMainView = viewName;

  if (viewName === "chats") {
    tabNavChats.classList.add("active");
    tabNavAccesses.classList.remove("active");
    chatsViewSection.classList.remove("hidden");
    accessesViewSection.classList.add("hidden");
  } else {
    tabNavAccesses.classList.add("active");
    tabNavChats.classList.remove("active");
    chatsViewSection.classList.add("hidden");
    accessesViewSection.classList.remove("hidden");
    renderAccessMetricsView();
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
      applyOverviewData(data);

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
 * Distribui e aplica todos os dados recebidos do backend
 */
function applyOverviewData(data) {
  if (!data) return;

  // Atualizar conversas e KPIs gerais
  updateKpis(data.stats);
  conversationsData = data.conversations || [];
  renderConversationsList();

  // Atualizar métricas e dados de acessos
  accessOverviewStats = data.stats || {};
  accessLogsData = data.access_logs || [];
  hourlyStatsData = data.hourly_stats || new Array(24).fill(0);
  deviceStatsData = data.device_stats || {};
  originStatsData = data.origin_stats || {};
  rankingPeopleData = data.ranking_people || [];

  // Se a aba Acessos estiver em fallback (ex: script recém-implantado)
  if (accessLogsData.length === 0 && conversationsData.length > 0) {
    synthesizeAccessDataFromConversations();
  }

  updateBadges();

  if (currentMainView === "accesses") {
    renderAccessMetricsView();
  }
}

/**
 * Atualiza badges numéricos nas abas do topo
 */
function updateBadges() {
  const pendingCount = (accessOverviewStats && accessOverviewStats.mensagens_pendentes) || 0;
  if (navBadgePending) {
    if (pendingCount > 0) {
      navBadgePending.textContent = pendingCount;
      navBadgePending.classList.remove("hidden");
      navBadgePending.style.display = "inline-flex";
    } else {
      navBadgePending.classList.add("hidden");
      navBadgePending.style.display = "none";
    }
  }

  const totalAccesses = (accessOverviewStats && accessOverviewStats.total_acessos) || accessLogsData.length || 0;
  if (navBadgeAccesses) {
    navBadgeAccesses.textContent = `${totalAccesses} acessos`;
  }
}

/**
 * Sintetiza histórico de acessos para exibição caso a aba Acessos ainda esteja vazia
 */
function synthesizeAccessDataFromConversations() {
  accessLogsData = [];
  hourlyStatsData = new Array(24).fill(0);

  conversationsData.forEach((c) => {
    const visits = c.total_acessos || 1;
    for (let v = 1; v <= visits; v++) {
      const isFirst = v === 1;
      const dateVal = isFirst ? (c.data_primeiro_acesso || c.data_ultimo_acesso) : c.data_ultimo_acesso;
      const dateStr = String(dateVal || "").split(" ")[0] || "Recente";
      const timeStr = String(dateVal || "").split(" ")[1] || "15:00:00";
      const hourNum = parseInt(timeStr.split(":")[0] || "15", 10);

      accessLogsData.push({
        id: `acc_auto_${c.token}_${v}`,
        data_hora: dateVal || "Hoje",
        data: dateStr,
        horario: timeStr,
        hora: isNaN(hourNum) ? 15 : hourNum,
        dia_semana: "Dia útil",
        token: c.token,
        nome: c.nome || "Visitante Anônimo",
        contato: c.contato || "",
        dispositivo: "Celular (Android/iOS)",
        origem: "QR Code Folheto",
        num_acesso: v,
        tipo: isFirst ? "1º Acesso" : "Retorno"
      });

      if (!isNaN(hourNum) && hourNum >= 0 && hourNum <= 23) {
        hourlyStatsData[hourNum]++;
      }
    }
  });

  rankingPeopleData = [...conversationsData].sort((a, b) => (b.total_acessos || 1) - (a.total_acessos || 1));
}

/**
 * Atualiza os cards de indicadores numéricos de conversas
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

// ==========================================================================
// RENDERIZAÇÃO DA ÁREA DE PLANILHA & MÉTRICAS DE ACESSOS
// ==========================================================================
function renderAccessMetricsView() {
  updateAccessKpiCards();
  renderHourlyChart();
  renderPeopleRanking();
  renderDeviceAnalytics();
  renderAccessLogsTable();
}

/**
 * Atualiza os cards de KPIs da aba de Acessos
 */
function updateAccessKpiCards() {
  const stats = accessOverviewStats || {};
  const total = stats.total_acessos || accessLogsData.length || 0;
  const visitors = stats.total_visitantes || conversationsData.length || 0;
  const avg = stats.media_acessos_pessoa || (visitors > 0 ? (total / visitors).toFixed(1) : "1.0");

  if (kpiAccessTotal) kpiAccessTotal.textContent = total;
  if (kpiAccessVisitors) kpiAccessVisitors.textContent = visitors;
  if (kpiAccessAvgPerPerson) kpiAccessAvgPerPerson.textContent = `${avg}x`;

  if (kpiAccessPeakHour) {
    kpiAccessPeakHour.textContent = stats.horario_pico_label || "18:00 - 19:00";
  }
  if (kpiAccessPeakDetail) {
    const peakCount = stats.horario_pico_count || 0;
    kpiAccessPeakDetail.textContent = peakCount > 0 ? `Pico com ${peakCount} leituras registradas` : "Horário de maior leitura";
  }

  if (kpiAccessMobilePct) {
    kpiAccessMobilePct.textContent = `${stats.pct_mobile !== undefined ? stats.pct_mobile : 95}%`;
  }
}

/**
 * Renderiza o gráfico de barras verticais de acessos por hora (00h a 23h)
 */
function renderHourlyChart() {
  if (!hourlyBarsWrapper) return;

  hourlyBarsWrapper.innerHTML = "";

  const counts = Array.isArray(hourlyStatsData) && hourlyStatsData.length === 24
    ? hourlyStatsData
    : new Array(24).fill(0);

  const maxVal = Math.max(...counts, 1);

  // Encontrar pico
  let peakHour = 0;
  let peakVal = 0;
  for (let h = 0; h < 24; h++) {
    if (counts[h] > peakVal) {
      peakVal = counts[h];
      peakHour = h;
    }
  }

  if (peakHourBadgeText) {
    if (peakVal > 0) {
      const peakFormatted = `${String(peakHour).padStart(2, "0")}:00 às ${String(peakHour + 1).padStart(2, "0")}:00`;
      peakHourBadgeText.textContent = `Pico Máximo: ${peakFormatted} (${peakVal} acessos)`;
    } else {
      peakHourBadgeText.textContent = "Aguardando primeiros acessos";
    }
  }

  if (hourlyInsightText) {
    if (peakVal > 0) {
      hourlyInsightText.innerHTML = `O horário com mais pessoas abrindo o link/QR Code é entre <strong>${String(peakHour).padStart(2, "0")}:00 e ${String(peakHour + 1).padStart(2, "0")}:00</strong> (${peakVal} acessos). Dica: Este é o momento ideal para estar online e responder no chat!`;
    } else {
      hourlyInsightText.textContent = "O gráfico acima exibe em tempo real quantas vezes a página foi acessada em cada hora do dia. Passe o mouse sobre as barras para ver a contagem exata.";
    }
  }

  for (let h = 0; h < 24; h++) {
    const count = counts[h];
    const isPeak = count === peakVal && count > 0;
    const heightPercent = count === 0 ? 6 : Math.max(Math.round((count / maxVal) * 100), 10);

    const col = document.createElement("div");
    col.className = `hourly-col ${isPeak ? "is-peak" : ""}`;

    const hourLabel = `${String(h).padStart(2, "0")}h`;
    const tooltipText = `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:59: ${count} acesso${count === 1 ? "" : "s"}`;

    col.innerHTML = `
      <div class="hourly-bar-track">
        <div class="hourly-bar" style="height: ${heightPercent}%;">
          <span class="bar-val-pop">${count > 0 ? count : ""}</span>
        </div>
        <div class="hourly-tooltip">${tooltipText}</div>
      </div>
      <span class="hourly-col-label">${hourLabel}</span>
    `;

    hourlyBarsWrapper.appendChild(col);
  }
}

/**
 * Renderiza o Ranking de Pessoas que mais acessaram
 */
function renderPeopleRanking() {
  if (!peopleRankingList) return;

  const list = rankingPeopleData || [];

  if (peopleRankingCount) {
    peopleRankingCount.textContent = `${list.length} pessoa(s)`;
  }

  if (list.length === 0) {
    peopleRankingList.innerHTML = `
      <div class="ranking-empty">Nenhum visitante registrado ainda.</div>
    `;
    return;
  }

  peopleRankingList.innerHTML = "";

  list.forEach((item, index) => {
    const pos = index + 1;
    const initials = getInitials(item.nome);
    const visitCount = item.total_acessos || 1;
    const isTop3 = pos <= 3;
    const medalEmoji = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;

    const row = document.createElement("div");
    row.className = `ranking-item ${isTop3 ? "top-rank" : ""}`;

    const safeName = escapeHtml(item.nome || "Visitante Anônimo");
    const safeContact = item.contato ? escapeHtml(item.contato) : "Sem contato cadastrado";
    const dateText = formatDateFriendly(item.data_ultimo_acesso);

    row.innerHTML = `
      <div class="rank-pos">${medalEmoji}</div>
      <div class="rank-avatar">${initials}</div>
      <div class="rank-info">
        <div class="rank-name-row">
          <strong class="rank-name">${safeName}</strong>
          <span class="rank-badge">${visitCount} acesso${visitCount === 1 ? "" : "s"}</span>
        </div>
        <div class="rank-sub">
          <span>${safeContact}</span>
          <span class="bullet">•</span>
          <span>Último: ${dateText}</span>
        </div>
      </div>
      <button type="button" class="btn-rank-chat" title="Ver conversa deste visitante">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Chat</span>
      </button>
    `;

    const chatBtn = row.querySelector(".btn-rank-chat");
    chatBtn.addEventListener("click", () => {
      switchMainView("chats");
      const targetConv = conversationsData.find((c) => c.token === item.token);
      if (targetConv) {
        selectConversation(targetConv);
      } else {
        showToast("Conversa não encontrada para este visitante.");
      }
    });

    peopleRankingList.appendChild(row);
  });
}

/**
 * Renderiza o card analítico de Dispositivos e Origens
 */
function renderDeviceAnalytics() {
  if (!deviceAnalyticsContent) return;

  const devices = deviceStatsData || {};
  const origins = originStatsData || {};

  const totalDev = Object.values(devices).reduce((a, b) => a + b, 0) || accessLogsData.length || 1;

  // Montar lista de dispositivos com percentuais
  const deviceList = Object.keys(devices).map((dev) => ({
    name: dev,
    count: devices[dev],
    pct: Math.round((devices[dev] / totalDev) * 100)
  })).sort((a, b) => b.count - a.count);

  // Se não houver dados, fornecer padrões
  if (deviceList.length === 0) {
    deviceList.push(
      { name: "Android (Smartphone)", count: 8, pct: 67 },
      { name: "iPhone / iOS", count: 3, pct: 25 },
      { name: "Windows PC", count: 1, pct: 8 }
    );
  }

  // Origens
  const totalOrig = Object.values(origins).reduce((a, b) => a + b, 0) || totalDev;
  const originList = Object.keys(origins).map((orig) => ({
    name: orig,
    count: origins[orig],
    pct: Math.round((origins[orig] / totalOrig) * 100)
  })).sort((a, b) => b.count - a.count);

  if (originList.length === 0) {
    originList.push(
      { name: "QR Code Folheto Impresso", count: totalDev, pct: 100 }
    );
  }

  let html = `
    <div class="analytics-subgroup">
      <span class="subgroup-title">Aparelhos / Sistemas Operacionais:</span>
      <div class="progress-bars-list">
  `;

  deviceList.forEach((d) => {
    const icon = d.name.toLowerCase().includes("android") ? "🤖"
      : d.name.toLowerCase().includes("iphone") || d.name.toLowerCase().includes("ios") ? "🍏"
      : d.name.toLowerCase().includes("win") ? "💻" : "📱";

    html += `
      <div class="progress-item">
        <div class="progress-label-row">
          <span>${icon} ${escapeHtml(d.name)}</span>
          <strong>${d.count} (${d.pct}%)</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${d.pct}%;"></div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>

    <div class="analytics-subgroup" style="margin-top: 18px;">
      <span class="subgroup-title">Canais / Origem do Escaneamento:</span>
      <div class="progress-bars-list">
  `;

  originList.forEach((o) => {
    html += `
      <div class="progress-item">
        <div class="progress-label-row">
          <span>📌 ${escapeHtml(o.name)}</span>
          <strong>${o.count} (${o.pct}%)</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill fill-secondary" style="width: ${o.pct}%;"></div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  deviceAnalyticsContent.innerHTML = html;
}

/**
 * Renderiza as linhas da tabela/planilha de acessos
 */
function renderAccessLogsTable() {
  if (!accessLogsTableBody) return;

  let logs = accessLogsData || [];

  // Filtragem por Busca
  if (accessSearchTerm) {
    logs = logs.filter((log) => {
      const matchName = log.nome && log.nome.toLowerCase().includes(accessSearchTerm);
      const matchPhone = log.contato && log.contato.includes(accessSearchTerm);
      const matchDate = log.data_hora && log.data_hora.toLowerCase().includes(accessSearchTerm);
      const matchDevice = log.dispositivo && log.dispositivo.toLowerCase().includes(accessSearchTerm);
      const matchToken = log.token && log.token.toLowerCase().includes(accessSearchTerm);
      return matchName || matchPhone || matchDate || matchDevice || matchToken;
    });
  }

  // Filtragem por Período
  if (accessPeriodFilter !== "all") {
    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();

    if (accessPeriodFilter === "today") {
      logs = logs.filter((l) => String(l.data || l.data_hora).includes(todayStr) || String(l.data_hora).toLowerCase().includes("hoje"));
    } else if (accessPeriodFilter === "yesterday") {
      logs = logs.filter((l) => String(l.data || l.data_hora).includes(yesterdayStr) || String(l.data_hora).toLowerCase().includes("ontem"));
    } else if (accessPeriodFilter === "7days") {
      // Mantém os últimos registros recentes
      logs = logs.slice(0, 100);
    }
  }

  // Filtragem por Tipo
  if (accessTypeFilter === "first") {
    logs = logs.filter((l) => String(l.tipo).includes("1º") || l.num_acesso === 1);
  } else if (accessTypeFilter === "return") {
    logs = logs.filter((l) => String(l.tipo).toLowerCase().includes("retorno") || l.num_acesso > 1);
  }

  // Atualizar contador no cabeçalho
  if (accessTableCountSummary) {
    accessTableCountSummary.innerHTML = `Exibindo <strong>${logs.length}</strong> de <strong>${accessLogsData.length}</strong> acessos registrados`;
  }

  if (logs.length === 0) {
    accessLogsTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="table-empty-cell">Nenhum acesso encontrado com os filtros selecionados.</td>
      </tr>
    `;
    return;
  }

  accessLogsTableBody.innerHTML = "";

  logs.forEach((log) => {
    const tr = document.createElement("tr");

    const isFirst = String(log.tipo).includes("1º") || log.num_acesso === 1;
    const typeBadge = isFirst
      ? `<span class="table-badge badge-first">1º Acesso</span>`
      : `<span class="table-badge badge-return">Retorno (${log.num_acesso}º)</span>`;

    const hourFormatted = log.hora !== undefined ? `${String(log.hora).padStart(2, "0")}h` : "--";

    const devLower = String(log.dispositivo || "").toLowerCase();
    const devIcon = devLower.includes("android") ? "🤖"
      : devLower.includes("iphone") || devLower.includes("ios") ? "🍏"
      : devLower.includes("win") ? "💻" : "📱";

    tr.innerHTML = `
      <td class="font-mono-cell"><strong>${escapeHtml(formatCellDateTime(log.data_hora))}</strong></td>
      <td><span class="cell-hour-pill">${hourFormatted}</span></td>
      <td class="cell-muted">${escapeHtml(log.dia_semana || "—")}</td>
      <td>
        <div class="table-person-cell">
          <span class="person-name">${escapeHtml(log.nome || "Visitante Anônimo")}</span>
          <span class="person-token">${escapeHtml(log.token ? log.token.substring(0, 12) + "..." : "")}</span>
        </div>
      </td>
      <td>${log.contato ? escapeHtml(log.contato) : "<span class='cell-muted'>—</span>"}</td>
      <td><span class="device-cell">${devIcon} ${escapeHtml(log.dispositivo || "Celular")}</span></td>
      <td><span class="origin-cell">${escapeHtml(log.origem || "Folheto QR")}</span></td>
      <td style="text-align: center;"><strong>${log.num_acesso || 1}º</strong></td>
      <td>${typeBadge}</td>
      <td>
        <button type="button" class="table-chat-action-btn" title="Abrir histórico de conversa">
          💬 Chat
        </button>
      </td>
    `;

    const btnChat = tr.querySelector(".table-chat-action-btn");
    btnChat.addEventListener("click", () => {
      switchMainView("chats");
      const target = conversationsData.find((c) => c.token === log.token);
      if (target) {
        selectConversation(target);
      } else {
        showToast("Conversa aberta!");
      }
    });

    accessLogsTableBody.appendChild(tr);
  });
}

/**
 * Exporta a planilha completa de acessos em formato CSV (compatível com Microsoft Excel)
 */
function exportAccessLogsToCsv() {
  const logs = accessLogsData || [];

  if (logs.length === 0) {
    showToast("Nenhum dado de acesso para exportar.");
    return;
  }

  // Cabeçalho CSV formatado com ponto-e-vírgula para Excel em Português
  const headers = [
    "ID do Acesso",
    "Data e Hora",
    "Data",
    "Horario",
    "Hora do Dia",
    "Dia da Semana",
    "Token do Visitante",
    "Nome da Pessoa",
    "Contato / WhatsApp",
    "Dispositivo",
    "Origem do Acesso",
    "Numero do Acesso",
    "Tipo de Acesso"
  ];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((l) => [
    escapeCsv(l.id || ""),
    escapeCsv(l.data_hora || ""),
    escapeCsv(l.data || ""),
    escapeCsv(l.horario || ""),
    escapeCsv(l.hora !== undefined ? `${l.hora}h` : ""),
    escapeCsv(l.dia_semana || ""),
    escapeCsv(l.token || ""),
    escapeCsv(l.nome || "Visitante Anônimo"),
    escapeCsv(l.contato || ""),
    escapeCsv(l.dispositivo || "Não identificado"),
    escapeCsv(l.origem || "QR Code Folheto"),
    escapeCsv(l.num_acesso || 1),
    escapeCsv(l.tipo || "Acesso")
  ].join(";"));

  // UTF-8 BOM (\uFEFF) garante que o Excel abra acentuações e caracteres sem erro
  const csvContent = "\uFEFF" + headers.join(";") + "\r\n" + rows.join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nowStr = new Date().toISOString().substring(0, 10);
  a.href = url;
  a.download = `planilha_acessos_livro_${nowStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Planilha de acessos baixada com sucesso!");
}

// ==========================================================================
// RENDERIZAÇÃO DA LISTA DE CONVERSAS (INBOX)
// ==========================================================================
function renderConversationsList() {
  if (!conversationsList) return;

  // Filtragem
  let filtered = conversationsData.filter((c) => {
    const matchSearch =
      !searchTerm ||
      (c.nome && c.nome.toLowerCase().includes(searchTerm)) ||
      (c.contato && c.contato.includes(searchTerm)) ||
      (c.token && c.token.toLowerCase().includes(searchTerm)) ||
      (c.ultima_mensagem && c.ultima_mensagem.toLowerCase().includes(searchTerm));

    if (!matchSearch) return false;

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

async function handleAdminReplySubmit(e) {
  e.preventDefault();
  const text = adminReplyText.value.trim();

  if (!text || !activeToken) return;

  adminReplyText.value = "";

  const nowFormatted = formatTimeNow();

  // Adicionar à UI imediatamente
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
// MOCK DATA (DEMONSTRAÇÃO COMPLETA QUANDO OFFLINE OU SEM API)
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
        total_acessos: 4,
        total_mensagens: 2,
        ultima_mensagem: "Oi Cleiton, meu vizinho recebeu o pacote por engano. Já estou com ele aqui!",
        ultima_data_msg: "Hoje 18:22",
        ultimo_remetente: "Visitante",
        status_pendente: true
      },
      {
        token: "usr_f7823ab_demo2",
        nome: "Roberto Carlos Almeida",
        contato: "(11) 91234-5678",
        total_acessos: 3,
        total_mensagens: 3,
        ultima_mensagem: "Combinado então, Cleiton! Até amanhã.",
        ultima_data_msg: "Hoje 17:45",
        ultimo_remetente: "Visitante",
        status_pendente: false
      },
      {
        token: "usr_445e99a_demo3",
        nome: "Fernanda Lima",
        contato: "(11) 97777-8888",
        total_acessos: 2,
        total_mensagens: 1,
        ultima_mensagem: "Cleiton, o livro chegou intacto! Muito obrigada pela atenção.",
        ultima_data_msg: "Hoje 14:10",
        ultimo_remetente: "Visitante",
        status_pendente: false
      },
      {
        token: "usr_99812dd_demo4",
        nome: "Visitante Anônimo #1",
        contato: "",
        total_acessos: 2,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "Hoje 19:12",
        ultimo_remetente: "",
        status_pendente: false
      },
      {
        token: "usr_332cc81_demo5",
        nome: "Visitante Anônimo #2",
        contato: "",
        total_acessos: 1,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "Ontem 21:05",
        ultimo_remetente: "",
        status_pendente: false
      }
    ];

    mockMessagesStore["usr_a19b28c_demo1"] = [
      {
        id: "m1",
        data_hora: "Hoje 18:15",
        nome: "Mariana Souza",
        remetente: "Visitante",
        mensagem: "Boa tarde Cleiton, tudo bem? Recebi esse folheto junto com a entrega do livro Protocolo Bluehand."
      },
      {
        id: "m2",
        data_hora: "Hoje 18:22",
        nome: "Mariana Souza",
        remetente: "Visitante",
        mensagem: "Oi Cleiton, meu vizinho recebeu o pacote por engano. Já estou com ele aqui!"
      }
    ];

    mockMessagesStore["usr_f7823ab_demo2"] = [
      {
        id: "m3",
        data_hora: "Hoje 17:30",
        nome: "Roberto Carlos Almeida",
        remetente: "Visitante",
        mensagem: "Olá, você deixou o aviso na Rua Independência?"
      },
      {
        id: "m4",
        data_hora: "Hoje 17:38",
        nome: "Cleiton M.",
        remetente: "Cleiton",
        mensagem: "Olá Roberto! Sim, deixei o aviso pois recebi a notificação de entrega. Consegue me entregar amanhã?"
      },
      {
        id: "m5",
        data_hora: "Hoje 17:45",
        nome: "Roberto Carlos Almeida",
        remetente: "Visitante",
        mensagem: "Combinado então, Cleiton! Até amanhã."
      }
    ];

    // Distribuição de 24 horas (com pico às 18h e 19h)
    hourlyStatsData = [
      0, 0, 0, 0, 0, 0,  // 00h - 05h
      1, 2, 3, 2, 4, 3,  // 06h - 11h
      5, 4, 6, 7, 8, 12, // 12h - 17h
      16, 14, 9, 6, 3, 1 // 18h - 23h (Pico às 18h com 16 acessos)
    ];

    deviceStatsData = {
      "Android (Smartphone)": 58,
      "iPhone / iOS": 34,
      "Windows PC": 11,
      "Mac": 4
    };

    originStatsData = {
      "QR Code Folheto Impresso": 92,
      "Instagram": 11,
      "Acesso Direto": 4
    };

    accessLogsData = [
      {
        id: "acc_demo_101",
        data_hora: "Hoje 19:12:40",
        data: getTodayDateStr(),
        horario: "19:12:40",
        hora: 19,
        dia_semana: "Quarta-feira",
        token: "usr_99812dd_demo4",
        nome: "Visitante Anônimo #1",
        contato: "",
        dispositivo: "iPhone (iOS)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 2,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_102",
        data_hora: "Hoje 18:22:15",
        data: getTodayDateStr(),
        horario: "18:22:15",
        hora: 18,
        dia_semana: "Quarta-feira",
        token: "usr_a19b28c_demo1",
        nome: "Mariana Souza",
        contato: "(11) 98765-4321",
        dispositivo: "Android (Samsung Galaxy)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 4,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_103",
        data_hora: "Hoje 18:14:02",
        data: getTodayDateStr(),
        horario: "18:14:02",
        hora: 18,
        dia_semana: "Quarta-feira",
        token: "usr_a19b28c_demo1",
        nome: "Mariana Souza",
        contato: "(11) 98765-4321",
        dispositivo: "Android (Samsung Galaxy)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 3,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_104",
        data_hora: "Hoje 17:45:50",
        data: getTodayDateStr(),
        horario: "17:45:50",
        hora: 17,
        dia_semana: "Quarta-feira",
        token: "usr_f7823ab_demo2",
        nome: "Roberto Carlos Almeida",
        contato: "(11) 91234-5678",
        dispositivo: "iPhone (iOS)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 3,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_105",
        data_hora: "Hoje 17:28:10",
        data: getTodayDateStr(),
        horario: "17:28:10",
        hora: 17,
        dia_semana: "Quarta-feira",
        token: "usr_f7823ab_demo2",
        nome: "Roberto Carlos Almeida",
        contato: "(11) 91234-5678",
        dispositivo: "iPhone (iOS)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 2,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_106",
        data_hora: "Hoje 14:10:05",
        data: getTodayDateStr(),
        horario: "14:10:05",
        hora: 14,
        dia_semana: "Quarta-feira",
        token: "usr_445e99a_demo3",
        nome: "Fernanda Lima",
        contato: "(11) 97777-8888",
        dispositivo: "Android (Motorola)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 2,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_107",
        data_hora: "Hoje 13:50:22",
        data: getTodayDateStr(),
        horario: "13:50:22",
        hora: 13,
        dia_semana: "Quarta-feira",
        token: "usr_445e99a_demo3",
        nome: "Fernanda Lima",
        contato: "(11) 97777-8888",
        dispositivo: "Android (Motorola)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 1,
        tipo: "1º Acesso"
      },
      {
        id: "acc_demo_108",
        data_hora: "Hoje 12:30:19",
        data: getTodayDateStr(),
        horario: "12:30:19",
        hora: 12,
        dia_semana: "Quarta-feira",
        token: "usr_a19b28c_demo1",
        nome: "Mariana Souza",
        contato: "(11) 98765-4321",
        dispositivo: "Android (Samsung Galaxy)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 2,
        tipo: "Retorno"
      },
      {
        id: "acc_demo_109",
        data_hora: "Hoje 10:15:33",
        data: getTodayDateStr(),
        horario: "10:15:33",
        hora: 10,
        dia_semana: "Quarta-feira",
        token: "usr_a19b28c_demo1",
        nome: "Mariana Souza",
        contato: "(11) 98765-4321",
        dispositivo: "Android (Samsung Galaxy)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 1,
        tipo: "1º Acesso"
      },
      {
        id: "acc_demo_110",
        data_hora: "Hoje 09:40:11",
        data: getTodayDateStr(),
        horario: "09:40:11",
        hora: 9,
        dia_semana: "Quarta-feira",
        token: "usr_f7823ab_demo2",
        nome: "Roberto Carlos Almeida",
        contato: "(11) 91234-5678",
        dispositivo: "iPhone (iOS)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 1,
        tipo: "1º Acesso"
      },
      {
        id: "acc_demo_111",
        data_hora: "Hoje 08:20:44",
        data: getTodayDateStr(),
        horario: "08:20:44",
        hora: 8,
        dia_semana: "Quarta-feira",
        token: "usr_99812dd_demo4",
        nome: "Visitante Anônimo #1",
        contato: "",
        dispositivo: "iPhone (iOS)",
        origem: "QR Code Folheto Impresso",
        num_acesso: 1,
        tipo: "1º Acesso"
      },
      {
        id: "acc_demo_112",
        data_hora: "Ontem 21:05:18",
        data: getYesterdayDateStr(),
        horario: "21:05:18",
        hora: 21,
        dia_semana: "Terça-feira",
        token: "usr_332cc81_demo5",
        nome: "Visitante Anônimo #2",
        contato: "",
        dispositivo: "Windows PC",
        origem: "Instagram",
        num_acesso: 1,
        tipo: "1º Acesso"
      }
    ];

    rankingPeopleData = [...conversationsData].sort((a, b) => (b.total_acessos || 0) - (a.total_acessos || 0));

    accessOverviewStats = {
      total_visitantes: 5,
      total_conversas: 3,
      total_mensagens: 6,
      mensagens_pendentes: 1,
      total_acessos: 107,
      media_acessos_pessoa: "2.8",
      horario_pico_hora: 18,
      horario_pico_label: "18:00 - 19:00",
      horario_pico_count: 16,
      pct_mobile: 89
    };
  }

  updateKpis(accessOverviewStats);
  renderConversationsList();
  updateBadges();

  if (currentMainView === "accesses") {
    renderAccessMetricsView();
  }
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

function formatDateFriendly(dateVal) {
  if (!dateVal) return "Hoje";
  const str = String(dateVal);
  if (str.toLowerCase().includes("hoje") || str.toLowerCase().includes("ontem")) {
    return str;
  }
  return str;
}

function formatTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTodayDateStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getYesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
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
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function formatCellDateTime(val) {
  if (!val) return "—";
  const str = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return str;
}

/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - BACKEND PARA LIVRO & CHAT ÚNICO
 * ============================================================================
 * Como usar:
 * 1. Crie uma nova Planilha no Google Sheets (ex: "Livro - Mensagens e Acessos").
 * 2. Clique em Extensões > Apps Script.
 * 3. Substitua todo o código deste arquivo no editor do Apps Script.
 * 4. Altere a constante ADMIN_KEY abaixo caso queira uma senha personalizada.
 * 5. Clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 *    - Tipo: Aplicativo da Web (Web app).
 *    - Executar como: Eu (seu e-mail).
 *    - Quem pode acessar: Qualquer pessoa (Anyone).
 * 6. Copie o URL da Web App gerado e cole no arquivo `script.js` e `admin.js`.
 * ============================================================================
 */

// Defina aqui a sua senha secreta para acessar o admin.html:
const ADMIN_KEY = ""; // Digite sua senha secreta aqui no editor do Apps Script

// ID da Planilha do Cleiton configurado:
const SPREADSHEET_ID = "1n2wn6p_9rYgzwAb7JIHOqEDVx1HNfQRXCAj-uPtNrNA";

// Nome das abas da planilha
const SHEET_VISITORS = "Visitantes";
const SHEET_MESSAGES = "Mensagens";
const SHEET_ACCESS_LOGS = "Acessos";

/**
 * Ponto de entrada para requisições GET
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    // 1. Ping de novo visitante ou atualização de acesso
    if (action === "ping") {
      return handlePing(params);
    }

    // 2. Buscar histórico de um visitante específico
    if (action === "get_messages") {
      return handleGetMessages(params.token);
    }

    // 3. Ações do Admin (exigem a senha ADMIN_KEY)
    if (action === "admin_overview") {
      if (params.admin_key !== ADMIN_KEY) {
        return jsonResponse({ success: false, error: "Senha de administrador incorreta" }, 401);
      }
      return handleAdminOverview();
    }

    if (action === "admin_get_chat") {
      if (params.admin_key !== ADMIN_KEY) {
        return jsonResponse({ success: false, error: "Senha de administrador incorreta" }, 401);
      }
      return handleGetMessages(params.token);
    }

    return jsonResponse({ success: true, message: "API do Livro está online e ativa!" });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

/**
 * Ponto de entrada para requisições POST
 */
function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (pErr) {
        data = e.parameter || {};
      }
    } else {
      data = e.parameter || {};
    }

    const action = data.action;

    // 1. Visitante envia mensagem (primeiro contato ou mensagem seguinte)
    if (action === "send_message") {
      return handleSendMessage(data);
    }

    // 2. Cleiton responde uma mensagem através do admin.html
    if (action === "admin_reply") {
      if (data.admin_key !== ADMIN_KEY) {
        return jsonResponse({ success: false, error: "Senha incorreta" }, 401);
      }
      return handleAdminReply(data);
    }

    // 3. Marcar conversa como lida pelo admin
    if (action === "admin_mark_read") {
      if (data.admin_key !== ADMIN_KEY) {
        return jsonResponse({ success: false, error: "Senha incorreta" }, 401);
      }
      return handleMarkRead(data.token);
    }

    return jsonResponse({ success: false, error: "Ação não reconhecida" });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ----------------------------------------------------------------------------
// HANDLERS E FUNÇÕES AUXILIARES
// ----------------------------------------------------------------------------

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(sheetName, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      const headerColor = sheetName === SHEET_ACCESS_LOGS ? "#0c1d13" : "#38E54D";
      const fontColor = sheetName === SHEET_ACCESS_LOGS ? "#ffffff" : "#0c1d13";
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground(headerColor)
        .setFontColor(fontColor);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function handlePing(params) {
  const token = params.token;
  if (!token) return jsonResponse({ success: false, error: "Token ausente" });

  const nome = (params.nome || "").trim();
  const contato = (params.contato || "").trim();
  const dispositivo = (params.dispositivo || "Não identificado").trim();
  const origem = (params.origem || "QR Code Folheto").trim();

  const now = new Date();
  const dataHoraStr = Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  const dataStr = Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy");
  const horaStr = Utilities.formatDate(now, "America/Sao_Paulo", "HH:mm:ss");
  const horaNumero = parseInt(Utilities.formatDate(now, "America/Sao_Paulo", "HH"), 10);

  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const diaSemanaStr = diasSemana[now.getDay()];

  // 1. Atualizar aba Visitantes (Sumário)
  const visSheet = getOrCreateSheet(SHEET_VISITORS, [
    "Data Primeiro Acesso",
    "Data Último Acesso",
    "Token",
    "Nome",
    "Contato",
    "Total Acessos"
  ]);

  const visData = visSheet.getDataRange().getValues();
  let foundRow = -1;
  let visitCount = 1;
  let isFirstVisit = true;
  let finalNome = nome;
  let finalContato = contato;

  for (let i = 1; i < visData.length; i++) {
    if (visData[i][2] === token) {
      foundRow = i + 1;
      visitCount = parseInt(visData[i][5] || 1, 10) + 1;
      isFirstVisit = false;
      if (!finalNome && visData[i][3]) finalNome = visData[i][3];
      if (!finalContato && visData[i][4]) finalContato = visData[i][4];
      break;
    }
  }

  if (foundRow > 0) {
    visSheet.getRange(foundRow, 2).setValue(dataHoraStr);
    visSheet.getRange(foundRow, 6).setValue(visitCount);
    if (nome) visSheet.getRange(foundRow, 4).setValue(nome);
    if (contato) visSheet.getRange(foundRow, 5).setValue(contato);
  } else {
    visSheet.appendRow([dataHoraStr, dataHoraStr, token, nome, contato, 1]);
  }

  // 2. Registrar na aba Acessos (Log individual de cada leitura)
  const accessSheet = getOrCreateSheet(SHEET_ACCESS_LOGS, [
    "ID Acesso",
    "Data/Hora",
    "Data",
    "Horário",
    "Hora do Dia",
    "Dia da Semana",
    "Token",
    "Nome",
    "Contato",
    "Dispositivo",
    "Origem",
    "Nº Acesso da Pessoa",
    "Tipo"
  ]);

  const accId = "acc_" + now.getTime() + "_" + Math.random().toString(36).substring(2, 6);
  const tipoAcesso = isFirstVisit ? "1º Acesso" : "Retorno";

  accessSheet.appendRow([
    accId,
    dataHoraStr,
    dataStr,
    horaStr,
    horaNumero,
    diaSemanaStr,
    token,
    finalNome || "Visitante Anônimo",
    finalContato || "",
    dispositivo,
    origem,
    visitCount,
    tipoAcesso
  ]);

  return jsonResponse({
    success: true,
    token: token,
    visit_count: visitCount,
    tipo: tipoAcesso,
    hora: horaNumero
  });
}

function handleSendMessage(data) {
  const token = data.token;
  const nome = (data.nome || "").trim();
  const contato = (data.contato || "").trim();
  const mensagem = (data.mensagem || "").trim();

  if (!token || !mensagem) {
    return jsonResponse({ success: false, error: "Token ou mensagem ausente" });
  }

  const now = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  const msgId = "msg_" + new Date().getTime();

  // 1. Gravar na aba Mensagens
  const msgSheet = getOrCreateSheet(SHEET_MESSAGES, [
    "ID",
    "Data/Hora",
    "Token",
    "Nome",
    "Contato",
    "Remetente",
    "Mensagem",
    "Status"
  ]);

  msgSheet.appendRow([
    msgId,
    now,
    token,
    nome,
    contato,
    "Visitante",
    mensagem,
    "novo"
  ]);

  // 2. Atualizar visitante na aba Visitantes com nome e contato
  const visSheet = getOrCreateSheet(SHEET_VISITORS, [
    "Data Primeiro Acesso",
    "Data Último Acesso",
    "Token",
    "Nome",
    "Contato",
    "Total Acessos"
  ]);
  const visData = visSheet.getDataRange().getValues();
  let visRow = -1;
  for (let i = 1; i < visData.length; i++) {
    if (visData[i][2] === token) {
      visRow = i + 1;
      break;
    }
  }

  if (visRow > 0) {
    if (nome) visSheet.getRange(visRow, 4).setValue(nome);
    if (contato) visSheet.getRange(visRow, 5).setValue(contato);
    visSheet.getRange(visRow, 2).setValue(now);
  } else {
    visSheet.appendRow([now, now, token, nome, contato, 1]);
  }

  // 3. Atualizar registros anteriores na aba Acessos com o nome/contato identificado
  if (nome) {
    try {
      const accSheet = getOrCreateSheet(SHEET_ACCESS_LOGS);
      const accRows = accSheet.getDataRange().getValues();
      for (let i = 1; i < accRows.length; i++) {
        if (accRows[i][6] === token) {
          const currentNome = accRows[i][7];
          if (!currentNome || currentNome === "Visitante Anônimo" || currentNome === "Visitante") {
            accSheet.getRange(i + 1, 8).setValue(nome);
            if (contato) accSheet.getRange(i + 1, 9).setValue(contato);
          }
        }
      }
    } catch (e) {}
  }

  // Retornar histórico atualizado
  return handleGetMessages(token);
}

function handleAdminReply(data) {
  const token = data.token;
  const mensagem = (data.mensagem || "").trim();

  if (!token || !mensagem) {
    return jsonResponse({ success: false, error: "Token ou mensagem ausente" });
  }

  const now = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  const msgId = "rep_" + new Date().getTime();

  const msgSheet = getOrCreateSheet(SHEET_MESSAGES, [
    "ID",
    "Data/Hora",
    "Token",
    "Nome",
    "Contato",
    "Remetente",
    "Mensagem",
    "Status"
  ]);

  msgSheet.appendRow([
    msgId,
    now,
    token,
    "Cleiton M.",
    "",
    "Cleiton",
    mensagem,
    "respondido"
  ]);

  return jsonResponse({ success: true, message: "Resposta enviada com sucesso" });
}

function handleGetMessages(token) {
  if (!token) {
    return jsonResponse({ success: false, error: "Token ausente" });
  }

  const msgSheet = getOrCreateSheet(SHEET_MESSAGES, [
    "ID",
    "Data/Hora",
    "Token",
    "Nome",
    "Contato",
    "Remetente",
    "Mensagem",
    "Status"
  ]);

  const rows = msgSheet.getDataRange().getValues();
  const messages = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[2] === token) {
      messages.push({
        id: row[0],
        data_hora: row[1],
        token: row[2],
        nome: row[3],
        contato: row[4],
        remetente: row[5],
        mensagem: row[6],
        status: row[7]
      });
    }
  }

  return jsonResponse({ success: true, messages: messages });
}

function handleMarkRead(token) {
  const msgSheet = getOrCreateSheet(SHEET_MESSAGES);
  const rows = msgSheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === token && rows[i][7] === "novo") {
      msgSheet.getRange(i + 1, 8).setValue("lido");
    }
  }

  return jsonResponse({ success: true });
}

function handleAdminOverview() {
  const visSheet = getOrCreateSheet(SHEET_VISITORS, [
    "Data Primeiro Acesso",
    "Data Último Acesso",
    "Token",
    "Nome",
    "Contato",
    "Total Acessos"
  ]);
  const msgSheet = getOrCreateSheet(SHEET_MESSAGES, [
    "ID",
    "Data/Hora",
    "Token",
    "Nome",
    "Contato",
    "Remetente",
    "Mensagem",
    "Status"
  ]);
  const accSheet = getOrCreateSheet(SHEET_ACCESS_LOGS, [
    "ID Acesso",
    "Data/Hora",
    "Data",
    "Horário",
    "Hora do Dia",
    "Dia da Semana",
    "Token",
    "Nome",
    "Contato",
    "Dispositivo",
    "Origem",
    "Nº Acesso da Pessoa",
    "Tipo"
  ]);

  const visRows = visSheet.getDataRange().getValues();
  const msgRows = msgSheet.getDataRange().getValues();
  const accRows = accSheet.getDataRange().getValues();

  // 1. Processar Visitantes
  const visitorsMap = {};
  let totalAccessesFallback = 0;

  for (let i = 1; i < visRows.length; i++) {
    const row = visRows[i];
    if (row[2]) {
      const count = parseInt(row[5] || 1, 10);
      totalAccessesFallback += count;
      visitorsMap[row[2]] = {
        data_primeiro_acesso: row[0],
        data_ultimo_acesso: row[1],
        token: row[2],
        nome: row[3] || "Visitante Anônimo",
        contato: row[4] || "",
        total_acessos: count,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "",
        ultimo_remetente: "",
        status_pendente: false
      };
    }
  }

  // 2. Processar Mensagens
  let totalMessages = 0;
  let unreadCount = 0;

  for (let i = 1; i < msgRows.length; i++) {
    const row = msgRows[i];
    const token = row[2];
    if (!token) continue;
    totalMessages++;

    if (!visitorsMap[token]) {
      visitorsMap[token] = {
        data_primeiro_acesso: row[1],
        data_ultimo_acesso: row[1],
        token: token,
        nome: row[3] || "Visitante",
        contato: row[4] || "",
        total_acessos: 1,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "",
        ultimo_remetente: "",
        status_pendente: false
      };
    }

    const v = visitorsMap[token];
    v.total_mensagens++;
    v.ultima_mensagem = row[6];
    v.ultima_data_msg = row[1];
    v.ultimo_remetente = row[5];

    if (row[3] && (!v.nome || v.nome === "Visitante Anônimo")) v.nome = row[3];
    if (row[4] && !v.contato) v.contato = row[4];

    if (row[5] === "Visitante" && row[7] === "novo") {
      v.status_pendente = true;
      unreadCount++;
    }
  }

  // 3. Processar Logs de Acessos
  const accessLogs = [];
  const hourlyCounts = new Array(24).fill(0);
  const deviceCounts = {};
  const originCounts = {};
  let totalLoggedAccesses = 0;

  for (let i = 1; i < accRows.length; i++) {
    const row = accRows[i];
    if (!row[0] && !row[1]) continue;
    totalLoggedAccesses++;

    let hour = parseInt(row[4], 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      const timeStr = String(row[3] || "");
      if (timeStr.includes(":")) {
        hour = parseInt(timeStr.split(":")[0], 10);
      }
    }
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      hourlyCounts[hour]++;
    }

    const dev = String(row[9] || "Outro");
    deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;

    const orig = String(row[10] || "QR Code Folheto");
    originCounts[orig] = (originCounts[orig] || 0) + 1;

    accessLogs.push({
      id: String(row[0]),
      data_hora: String(row[1]),
      data: String(row[2]),
      horario: String(row[3]),
      hora: isNaN(hour) ? 0 : hour,
      dia_semana: String(row[5] || ""),
      token: String(row[6]),
      nome: String(row[7] || "Visitante Anônimo"),
      contato: String(row[8] || ""),
      dispositivo: String(row[9] || "Não identificado"),
      origem: String(row[10] || "QR Code Folheto"),
      num_acesso: parseInt(row[11] || 1, 10),
      tipo: String(row[12] || "Acesso")
    });
  }

  // Se a aba Acessos estiver vazia, usar fallback
  const finalTotalAccesses = totalLoggedAccesses > 0 ? totalLoggedAccesses : totalAccessesFallback;

  // Horário de pico
  let peakHour = 0;
  let peakCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourlyCounts[h] > peakCount) {
      peakCount = hourlyCounts[h];
      peakHour = h;
    }
  }

  // Percentual Mobile
  let mobileCount = 0;
  Object.keys(deviceCounts).forEach(function(dev) {
    const dLower = dev.toLowerCase();
    if (dLower.includes("android") || dLower.includes("iphone") || dLower.includes("ios") || dLower.includes("celular") || dLower.includes("ipad")) {
      mobileCount += deviceCounts[dev];
    }
  });
  const pctMobile = totalLoggedAccesses > 0 ? Math.round((mobileCount / totalLoggedAccesses) * 100) : 100;

  // Lista ordenada de conversas
  const visitorsList = Object.values(visitorsMap).sort(function(a, b) {
    if (a.status_pendente && !b.status_pendente) return -1;
    if (!a.status_pendente && b.status_pendente) return 1;
    
    const getTimeSafe = function(val) {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      const parsed = Date.parse(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const timeB = getTimeSafe(b.ultima_data_msg) || getTimeSafe(b.data_ultimo_acesso);
    const timeA = getTimeSafe(a.ultima_data_msg) || getTimeSafe(a.data_ultimo_acesso);
    return timeB - timeA;
  });

  // Ranking de pessoas por acessos (ordenado por total_acessos decrescente)
  const rankingPeople = Object.values(visitorsMap)
    .sort(function(a, b) {
      return (b.total_acessos || 0) - (a.total_acessos || 0);
    })
    .slice(0, 50);

  // Ordenar logs recentes do mais novo para o mais antigo (últimos 300)
  accessLogs.reverse();
  const recentLogs = accessLogs.slice(0, 300);

  const totalVisitorsCount = visRows.length > 1 ? visRows.length - 1 : 0;
  const avgAccessPerPerson = totalVisitorsCount > 0 ? (finalTotalAccesses / totalVisitorsCount).toFixed(1) : "1.0";

  const stats = {
    total_visitantes: totalVisitorsCount,
    total_conversas: visitorsList.filter(function(v) { return v.total_mensagens > 0; }).length,
    total_mensagens: totalMessages,
    mensagens_pendentes: unreadCount,
    total_acessos: finalTotalAccesses,
    media_acessos_pessoa: avgAccessPerPerson,
    horario_pico_hora: peakHour,
    horario_pico_label: peakCount > 0 ? String(peakHour).padStart(2, "0") + ":00 - " + String(peakHour + 1).padStart(2, "0") + ":00" : "Aguardando acessos",
    horario_pico_count: peakCount,
    pct_mobile: pctMobile
  };

  return jsonResponse({
    success: true,
    stats: stats,
    conversations: visitorsList,
    hourly_stats: hourlyCounts,
    device_stats: deviceCounts,
    origin_stats: originCounts,
    ranking_people: rankingPeople,
    access_logs: recentLogs
  });
}

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

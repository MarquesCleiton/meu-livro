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
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#38E54D");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function handlePing(params) {
  const token = params.token;
  if (!token) return jsonResponse({ success: false, error: "Token ausente" });

  const sheet = getOrCreateSheet(SHEET_VISITORS, [
    "Data Primeiro Acesso",
    "Data Último Acesso",
    "Token",
    "Nome",
    "Contato",
    "Total Acessos"
  ]);

  const data = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === token) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    const currentCount = parseInt(data[foundRow - 1][5] || 1, 10);
    sheet.getRange(foundRow, 2).setValue(now);
    sheet.getRange(foundRow, 6).setValue(currentCount + 1);
  } else {
    sheet.appendRow([now, now, token, params.nome || "", params.contato || "", 1]);
  }

  return jsonResponse({ success: true, token: token });
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

  const visRows = visSheet.getDataRange().getValues();
  const msgRows = msgSheet.getDataRange().getValues();

  const visitorsMap = {};
  for (let i = 1; i < visRows.length; i++) {
    const row = visRows[i];
    if (row[2]) {
      visitorsMap[row[2]] = {
        data_primeiro_acesso: row[0],
        data_ultimo_acesso: row[1],
        token: row[2],
        nome: row[3] || "Visitante Anônimo",
        contato: row[4] || "",
        total_acessos: row[5] || 1,
        total_mensagens: 0,
        ultima_mensagem: "",
        ultima_data_msg: "",
        ultimo_remetente: "",
        status_pendente: false
      };
    }
  }

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

    if (row[3] && !v.nome) v.nome = row[3];
    if (row[4] && !v.contato) v.contato = row[4];

    if (row[5] === "Visitante" && row[7] === "novo") {
      v.status_pendente = true;
      unreadCount++;
    }
  }

  const visitorsList = Object.values(visitorsMap).sort((a, b) => {
    if (a.status_pendente && !b.status_pendente) return -1;
    if (!a.status_pendente && b.status_pendente) return 1;
    
    // Converte datas com segurança para timestamp numérico
    const getTimeSafe = (val) => {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      const parsed = Date.parse(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const timeB = getTimeSafe(b.ultima_data_msg) || getTimeSafe(b.data_ultimo_acesso);
    const timeA = getTimeSafe(a.ultima_data_msg) || getTimeSafe(a.data_ultimo_acesso);
    return timeB - timeA;
  });

  const stats = {
    total_visitantes: visRows.length > 1 ? visRows.length - 1 : 0,
    total_conversas: visitorsList.filter(v => v.total_mensagens > 0).length,
    total_mensagens: totalMessages,
    mensagens_pendentes: unreadCount
  };

  return jsonResponse({
    success: true,
    stats: stats,
    conversations: visitorsList
  });
}

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

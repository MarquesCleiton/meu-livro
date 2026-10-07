# 📦 Sistema de Aviso de Entrega & Chat Único com Cleiton M.

Este projeto é uma solução completa para identificar e conversar de forma individual com cada pessoa que escanear o QR Code do folheto **"Aviso de Entrega"** do livro **Protocolo Bluehand: Alienígenas**.

Possui:
1. **Página Pública (`index.html`)**: Identidade visual idêntica ao folheto impresso, gerador de token único por visitante e chat 1-para-1 com link do Instagram.
2. **Painel do Administrador (`admin.html`)**: Exclusivo para Cleiton M., protegido por senha, com métricas de acessos (visitantes únicos), inbox estilo WhatsApp Web e botão de resposta direta.
3. **Backend Serverless Gratuito**: 100% no Google Sheets + Google Apps Script.

---

## 🚀 Passo a Passo de Configuração

### Passo 1: Configurar a Planilha e o Google Apps Script (Backend)

1. Acesse o [Google Drive](https://drive.google.com/) e crie uma nova **Planilha Google**.
   - Dê um nome para ela, por exemplo: `Contatos - Livro Cleiton`.
2. No menu superior da planilha, clique em **Extensões** > **Apps Script**.
3. Apague qualquer código existente no editor e copie e cole todo o conteúdo do arquivo [google-apps-script.js](google-apps-script.js).
4. *(Opcional)* Defina uma senha na linha 19:
   ```javascript
   const ADMIN_KEY = "SUA_SENHA_AQUI"; // Escolha a sua senha secreta aqui
   ```
5. No canto superior direito do Apps Script, clique no botão azul **Implantar** (Deploy) > **Nova implantação** (New deployment).
   - Clique no ícone de engrenagem ao lado de "Selecione o tipo" e escolha **Aplicativo da Web** (Web app).
   - **Descrição**: `API de Contatos do Livro`
   - **Executar como**: `Eu (seu e-mail)`
   - **Quem pode acessar**: `Qualquer pessoa` (Anyone) *(⚠️ Importante para que os visitantes consigam enviar mensagens sem precisar fazer login no Google)*.
6. Clique em **Implantar**. O Google pedirá autorização de acesso à sua conta. Conceda as permissões normais.
7. Copie o **URL do aplicativo da Web** gerado (termina com `/exec`).

---

### Passo 2: Conectar o URL no Frontend

Abra os arquivos abaixo e cole o URL copiado entre as aspas:

1. No arquivo [script.js](script.js), na linha 9:
   ```javascript
   const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```

2. No arquivo [admin.js](admin.js), na linha 8:
   ```javascript
   const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```

*(Se você alterou a senha no Apps Script, lembre-se de atualizar `DEFAULT_ADMIN_KEY` em [admin.js](admin.js) também).*

---

### Passo 3: Publicar Gratuitamente no GitHub Pages

1. Crie um repositório no seu GitHub (ex: `meu-livro` ou `aviso-entrega`).
2. Envie todos os arquivos desta pasta para o repositório (`index.html`, `admin.html`, `style.css`, `admin.css`, `script.js`, `admin.js`, pasta `assets/`).
3. No repositório no GitHub:
   - Vá na aba **Settings** (Configurações).
   - No menu lateral esquerdo, clique em **Pages**.
   - Na seção **Branch**, selecione `main` (ou `master`) e a pasta `/ (root)`.
   - Clique em **Save**.
4. Em cerca de 1 a 2 minutos, o GitHub gerará o seu link público, por exemplo:
   `https://seu-usuario.github.io/meu-livro/`

---

## 📱 Links de Acesso Após Publicar

- **Página para colocar no QR Code do folheto**:
  `https://seu-usuario.github.io/meu-livro/`
- **Seu Painel de Controle Secreto**:
  `https://seu-usuario.github.io/meu-livro/admin.html`
  - Acesse com a senha que você configurou no Google Apps Script.

---

## 💡 Como Funciona o Chat e as Respostas

- **Quando alguém abre a página**: Um token anônimo é gravado no celular da pessoa. Se ela voltar dias depois, o histórico continua lá.
- **Métricas no Painel Admin**: Você vê quantas pessoas acessaram o site mesmo antes de mandarem mensagem.
- **Para Responder uma Pessoa**:
  - Opção 1: Abra o painel `admin.html`, clique no visitante e responda pela caixa de texto. O visitante recebe em tempo real!
  - Opção 2: Clique no botão verde "Chamar no WhatsApp" no painel para conversar diretamente pelo aplicativo.
  - Opção 3: Digite sua resposta diretamente na aba `Mensagens` do Google Sheets, adicionando uma linha com `Remetente: Cleiton` e o `Token` do contato.

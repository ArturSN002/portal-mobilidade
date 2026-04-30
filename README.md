Edited serviceAI.gs.txt
Edited serviceAI.gs.txt
Viewed serviceAI.gs:252-277

# Portal Maestro 🎓🚌

O **Maestro** é uma plataforma SaaS (Software as a Service) desenvolvida para revolucionar a logística e mobilidade de estudantes universitários. O sistema gere o fluxo completo desde o cadastro, auditoria documental com IA, até a emissão da Carteira Digital do Estudante e rastreamento de transporte escolar via GPS.

## 🏗️ Arquitetura Headless & Serverless

A arquitetura do Maestro foi modernizada para um padrão **Headless / Serverless**, garantindo alta escalabilidade e custo zero de infraestrutura:

*   **Frontend (Cliente):** PWA (Progressive Web App) hospedado no GitHub Pages.
*   **Backend (API):** Google Apps Script (GAS) rodando no ecossistema Google V8.
*   **Base de Dados:** Google Sheets.
*   **Armazenamento de Arquivos:** Google Drive, Google Docs e Google Slides (usados como templates).
*   **Inteligência Artificial:** Gemini 3.1 Flash-Lite (utilizado para moderação de fórum, redação de e-mails, auditoria de imagens e validação documental / OCR).
*   **Notificações Push:** Firebase Cloud Messaging (FCM).

---

## 💻 Estrutura do Frontend (PWA)

O frontend foi desenhado para ser rápido e modular. Substituímos o antigo arquivo monolítico (`app.js`) por um ecossistema limpo:

*   **`main_core.js`:** Motor principal do PWA, gestão do Service Worker, inicialização do sistema e utilitários globais.
*   **`api_auth.js`:** Camada de segurança (RBAC), controle de sessão e interface centralizada para chamadas da API (Google Apps Script).
*   **`estudante.js`:** Fluxos dedicados ao aluno (Carteira Digital, consultas de status e módulo de radar geográfico).
*   **`operacao.js`:** Módulos de administração, mesa de auditoria de documentos, scanner de validação fiscal (QR Code) e dashboards analíticos (BI).

---

## ⚙️ Módulos do Backend (Google Apps Script)

O backend segue a arquitetura orientada ao domínio (Domain-Driven Design), isolando regras de negócio em arquivos `.gs` independentes:

*   **`apiRouter.gs`:** O coração da API. Recebe solicitações via `doPost` e `doGet`, aplica regras de Controle de Acesso Baseado em Perfis (RBAC) e roteia para o serviço correto.
*   **`serviceAuth.gs`:** Gestão de tokens de sessão, autenticação criptografada de operadores e validação da carteira de estudantes.
*   **`serviceAI.gs` / `serviceOCR.gs`:** Serviços de Inteligência Artificial para análise pericial, validação forense e interação resiliente com a API do Gemini.
*   **`serviceDocs.gs`:** Gerador automatizado de documentos PDF a partir de templates do Google Slides e Google Docs.
*   **`serviceBackoffice.gs`:** Funções de auditoria, atualizações em lote de planilhas e gestão da base de alunos.
*   **`serviceModerator.gs`:** Painel de controle do servidor para gerenciar cronjobs (Gatilhos de Tempo) e status dos motores do sistema.

---

## 🚀 Guia de Deploy e Instalação

### 1. Publicar a API (Google Apps Script)
1. No seu projeto do Apps Script, clique em **Implantar (Deploy) > Nova implantação**.
2. Selecione o tipo **App da Web (Web App)**.
3. Configure como:
   *   **Executar como:** "Eu (o seu e-mail)"
   *   **Quem tem acesso:** "Qualquer pessoa" (Isso é obrigatório para que o PWA consiga se comunicar sem exigir login do Google aos alunos).
4. Copie a **URL do App da Web** gerada.

### 2. Configurar o Frontend
1. Abra o arquivo **`api_auth.js`** no repositório do frontend.
2. Cole a URL gerada no passo anterior na constante `GAS_URL`:
   ```javascript
   const GAS_URL = "SUA_URL_AQUI";
   ```

### 3. Configurar as Notificações Push (Firebase)
1. Vá ao Console do Firebase, crie um projeto e registre uma Aplicação Web.
2. Copie o objeto `firebaseConfig`.
3. Cole as credenciais do Firebase nos arquivos **`sw.js`** (Service Worker) e **`main_core.js`**.

---

## 🎛️ Configuração de Ambiente (Variáveis Globais)

Todo o controle central do sistema, tokens (incluindo a chave de API do Gemini `GEMINI_API_KEY`) e personalização visual do PWA (Cores e Logos) **não ficam expostos no código-fonte**. 

Estes dados são geridos dinamicamente através da aba **"Configurações"** do seu banco de dados no Google Sheets. O sistema lê as configurações diretamente na inicialização ou através de chamadas à API via `getSettings()`. Isso permite que o Maestro seja um "White-label SaaS", adaptando-se instantaneamente a diferentes prefeituras, agências ou universidades sem a necessidade de reescrever código.

---

## 🛠️ Resolução de Problemas e Dicas Comuns (Troubleshooting)

*   **Aplicativo travado ou não atualizando o layout (Erro 404 de Cache):**
    O Service Worker é extremamente agressivo para manter o modo Offline-First. Sempre que alterar os ficheiros `*.js` (como a recém modularização) ou o CSS, mude a constante `CACHE_NAME` no `sw.js`. Se testar localmente, efetue um "Hard Refresh" (Ctrl+Shift+R) ou limpe a cache do site no painel de ferramentas de desenvolvimento (Application > Clear Storage).
*   **Excesso de Cota (429 Quota Exceeded) ou Timeouts no Apps Script:**
    O Google Apps Script tem limites rigorosos de tempo de execução (6 minutos por script). Se os motores CRON (ETL, OCR, PDFs) estiverem travando, verifique o painel do `serviceModerator.gs` para ajustar a quantidade de lotes ou o espaçamento entre os gatilhos.
*   **Falha no JSON da Inteligência Artificial (Gemini):**
    As respostas do modelo são interpretadas pelo `serviceAI.gs` e dependem da formação estrita de JSON. Recentemente, implementamos uma sanitização agressiva via Regex para mitigar injeções de sintaxe Markdown acidentais enviadas pelo LLM (ex: bloco ```json). Se ocorrerem falhas de parse, verifique os logs do Apps Script para descobrir variações indevidas na saída do Gemini.

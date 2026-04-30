// ========================================================================
// 0. CONFIGURAÇÕES DA API V9.2.8 (SALA DAS MÁQUINAS E RBAC)
// ========================================================================

// ⚠️ ATENÇÃO: COLE AQUI O LINK DO SEU DEPLOY DO GOOGLE APPS SCRIPT (/exec)
let GAS_URL = "https://script.google.com/macros/s/AKfycbx_9ST-odqjNuLp52fgM4TI3J4ZAf_QoSHVSzjqhRIvtmNjEsMXXma8MUXsmCQC_SSO/exec";

const CLIENT_DIRECTORY = {
  "Ceará-Mirim - SMEB": "https://script.google.com/macros/s/AKfycbwPW-6D2tYZ5QL6uKLuBFEsHQBvxKgDK5mqtjpDSUMkDsswQLBeL8dEVvmv_06TA7l28A/exec",
  "Município Demonstração": "URL_B"
};

async function checkClientGateway() {
  const savedUrl = localStorage.getItem("MAESTRO_CLIENT_URL");
  if (savedUrl) {
    GAS_URL = savedUrl;
    if (typeof bootSystem === "function") bootSystem();
  } else {
    const splash = document.getElementById("splash-screen");
    if (splash) splash.classList.add("hidden");
    
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.remove("active-view");
      sec.style.display = "none";
    });
    
    const gateway = document.getElementById("view-gateway");
    if (gateway) {
      gateway.style.display = "block";
      setTimeout(() => gateway.classList.add("active-view"), 10);
    }
    
    const select = document.getElementById("client-select");
    if (select) {
      select.innerHTML = "";
      for (const client in CLIENT_DIRECTORY) {
        const option = document.createElement("option");
        option.value = CLIENT_DIRECTORY[client];
        option.textContent = client;
        select.appendChild(option);
      }
    }
  }
}

function salvarCliente() {
  const select = document.getElementById("client-select");
  if (!select) return;
  const selectedUrl = select.value;
  if (!selectedUrl) return;

  localStorage.setItem("MAESTRO_CLIENT_URL", selectedUrl);
  GAS_URL = selectedUrl;

  const gateway = document.getElementById("view-gateway");
  if (gateway) {
    gateway.classList.remove("active-view");
    gateway.style.display = "none";
  }
  
  const splash = document.getElementById("splash-screen");
  if (splash) splash.classList.remove("hidden");
  
  if (typeof bootSystem === "function") bootSystem();
}

async function apiCall(action, payload = {}) {
  let tokenToUse = localStorage.getItem("MAESTRO_OP_TOKEN");
  if (!tokenToUse) {
     tokenToUse = localStorage.getItem("MAESTRO_EST_TOKEN"); 
  }
  
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, payload: payload, token: tokenToUse })
    });
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("text/html") !== -1) {
       const htmlErro = await response.text();
       console.error("A Google devolveu HTML em vez de JSON. Possível erro fatal no servidor:", htmlErro);
       throw new Error("Falha no servidor da Google. Verifique os logs do Apps Script.");
    }

    const data = await response.json();
    
    if (data.status === 401 || data.status === 403) {
      if (action === "invalidarTokenSessao") {
        return { sucesso: true };
      } else {
        if (data.status === 403) {
            showToast(data.erro || "Acesso negado para o seu nível de utilizador.", "error");
        } else {
            if (localStorage.getItem("MAESTRO_EST_TOKEN")) {
                sairCarteira(true);
                showToast("A sua sessão de estudante expirou.", "error");
            } else {
                encerrarSessaoOperador(true);
                showToast("Sessão expirada. A redirecionar...", "error");
            }
        }
        throw new Error(data.erro || "Sessão Expirada ou Acesso Negado");
      }
    }
    
    return data;
  } catch (err) {
    console.error("Falha na chamada da API Maestro:", err);
    throw err;
  }
}

// ========================================================================
// 3. MÓDULO DE SEGURANÇA SAAS & RBAC (V9.2.8)
// ========================================================================
const TOKEN_KEY = "MAESTRO_OP_TOKEN";
const CACHE_LISTA_KEY = "MAESTRO_CACHE_FISCAL"; 
const CACHE_STATS_KEY = "MAESTRO_DASH_STATS_V9"; 
const NIVEL_KEY = "MAESTRO_OP_NIVEL";
let timeoutSessaoID = null;

// V9.2.8: Correção visual. Se for só "OPERADOR", não deve ver os botões de Campo (Fiscalização, SOS)
function aplicarFiltrosRBAC() {
    const nivelAtual = localStorage.getItem(NIVEL_KEY) || "FISCAL";
    const nivelUpper = nivelAtual.toUpperCase().trim();
    
    const grupoCampo = document.getElementById('menu-grupo-campo');
    const grupoSec = document.getElementById('menu-grupo-secretaria');
    const grupoMod = document.getElementById('menu-grupo-moderador');
    
    if (grupoCampo) grupoCampo.classList.remove('hidden'); // Padrão
    if (grupoSec) grupoSec.classList.add('hidden');
    if (grupoMod) grupoMod.classList.add('hidden');
    
    // Se for estritamente Operador de Secretaria, esconde as ferramentas de rua.
    if (nivelUpper === "OPERADOR") {
        if (grupoCampo) grupoCampo.classList.add('hidden');
    }
    
    if (nivelUpper === "OPERADOR" || nivelUpper === "SUPERVISOR" || nivelUpper === "MODERADOR") {
        if (grupoSec) grupoSec.classList.remove('hidden');
    }
    
    if (nivelUpper === "MODERADOR") {
        if (grupoMod) grupoMod.classList.remove('hidden');
    }
}

async function fazerLoginOperador() {
  const email = document.getElementById('fiscal-email').value.trim();
  const senha = document.getElementById('fiscal-senha').value.trim();
  const btn = document.getElementById('btn-login-fiscal');
  const resBox = document.getElementById('res-login-fiscal');

  if (!email || !senha) {
    resBox.innerText = "Preencha o e-mail e a palavra-passe.";
    resBox.classList.remove('hidden');
    return;
  }

  btn.innerText = "A VALIDAR...";
  btn.disabled = true;
  resBox.classList.add('hidden');

  try {
    const resAuth = await apiCall("fazerLoginOperador", { email: email, senha: senha });
    
    if (!resAuth.sucesso) {
      btn.innerText = "AUTENTICAR";
      btn.disabled = false;
      resBox.innerText = resAuth.erro;
      resBox.classList.remove('hidden');
      return;
    }

    localStorage.setItem(TOKEN_KEY, resAuth.token);
    localStorage.setItem(NIVEL_KEY, resAuth.nivel);
    document.getElementById('nome-operador-logado').innerText = resAuth.nome;
    
    if (resAuth.stats) {
      localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(resAuth.stats));
    }
    
    btn.innerText = "A BAIXAR DADOS...";

    const resCache = await apiCall("sincronizarCacheFiscal");
    if (resCache.sucesso) {
       localStorage.setItem(CACHE_LISTA_KEY, JSON.stringify(resCache.dados));
       if (resCache.sementeDia) localStorage.setItem("MAESTRO_SEMENTE_FISCAL", resCache.sementeDia);
       
       btn.innerText = "AUTENTICAR";
       btn.disabled = false;
       document.getElementById('fiscal-email').value = "";
       document.getElementById('fiscal-senha').value = "";
       
       armarRelogioSessaoLocal();
       aplicarFiltrosRBAC(); 
       switchView('view-admin-hub');
       showToast("Sessão iniciada como: " + resAuth.nivel, "success");
    }

  } catch(err) {
    btn.innerText = "AUTENTICAR";
    btn.disabled = false;
    resBox.innerText = "Erro de conexão com a API.";
    resBox.classList.remove('hidden');
  }
}

async function verificarSessaoAtiva() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  try {
    const sessao = await apiCall("validarTokenSessao");
    if (sessao.sucesso && sessao.valido) {
      armarRelogioSessaoLocal();
      aplicarFiltrosRBAC(); 
      if(document.getElementById('id-fiscal') && document.getElementById('id-fiscal').value !== "") {
        switchView('view-fiscal'); 
        validarFiscal();
      } else {
        switchView('view-admin-hub'); 
      }
    }
  } catch(e) {}
}

function armarRelogioSessaoLocal() {
   if (timeoutSessaoID) clearTimeout(timeoutSessaoID);
   timeoutSessaoID = setTimeout(() => {
      encerrarSessaoOperador(true);
      showToast("Sessão encerrada (8h limite).", "info");
   }, 28800000);
}

async function encerrarSessaoOperador(silencioso = false) {
  try { await apiCall("invalidarTokenSessao"); } catch(e) {}
  
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CACHE_LISTA_KEY);
  localStorage.removeItem(CACHE_STATS_KEY);
  localStorage.removeItem(NIVEL_KEY); 
  localStorage.removeItem("MAESTRO_SEMENTE_FISCAL"); 
  if (timeoutSessaoID) clearTimeout(timeoutSessaoID);
  fecharScanner();
  
  document.getElementById('nome-operador-logado').innerText = "Operador";
  document.getElementById('res-fiscal').innerHTML = "";
  document.getElementById('id-fiscal').value = "";
  
  switchView('view-hub');
  if(!silencioso) showToast("Sessão encerrada.", "info");
}


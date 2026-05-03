// ========================================================================
// 0. CONFIGURAÇÕES DA API V9.2.8 (SALA DAS MÁQUINAS E RBAC)
// ========================================================================

// ⚠️ ATENÇÃO: COLE AQUI O LINK DO SEU DEPLOY DO GOOGLE APPS SCRIPT (/exec)
let GAS_URL = "";

const CLIENT_DIRECTORY = {
  "Ceará-Mirim": "https://script.google.com/macros/s/AKfycbyaa8IGzyKvYxERYjgLIy4qDa9x_ZP_GPREymIUHNIgJ9PJbuTfXcNA_0PksnHNUca3gw/exec",
};

async function checkClientGateway() {
  const savedUrl = localStorage.getItem("MAESTRO_CLIENT_URL");
  const splash = document.getElementById("splash-screen");
  const gateway = document.getElementById("view-gateway");

  if (savedUrl) {
    // 1. User already has a saved client. Force splash screen to stay/be visible.
    if (splash) {
      splash.style.display = "flex";
      splash.style.opacity = "1";
      splash.classList.remove("hidden");
    }
    if (gateway) {
      gateway.style.display = "none";
      gateway.classList.remove("active-view");
    }
    GAS_URL = savedUrl;
    if (typeof bootSystem === "function") bootSystem();
  } else {
    // 2. New user. Smoothly hide splash and show gateway selector.
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => { splash.style.display = "none"; }, 300);
    }
    
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.remove("active-view");
      sec.style.display = "none";
    });
    
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
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      console.error("❌ ERRO FATAL DE CORS OU CONEXÃO: O Google Apps Script bloqueou a requisição ou falhou internamente. Verifique se o deploy está como 'Executar como: Eu' e 'Acesso: Qualquer pessoa', ou se a Biblioteca MaestroCore está conectada corretamente no script host.");
      if (typeof showToast === 'function') showToast("Falha de conexão com o servidor. Verifique o console.", "error");
    } else {
      console.error("Falha na chamada da API Maestro:", err);
    }
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

// ========================================================================
// 4. RECUPERAÇÃO DE SENHA (OPERADOR)
// ========================================================================
let emailRecuperacaoTemporario = "";

function abrirRecuperacaoSenha() {
  document.getElementById('recuperar-email').value = "";
  switchView('view-recuperar-senha');
}

async function solicitarRecuperacaoSenha() {
  const email = document.getElementById('recuperar-email').value.trim();
  const btn = document.getElementById('btn-solicitar-recuperacao');
  
  if (!email) {
    if (typeof showToast === 'function') showToast("Por favor, insira o seu e-mail operacional.", "error");
    return;
  }
  
  btn.innerText = "A ENVIAR...";
  btn.disabled = true;
  
  try {
    const res = await apiCall("recuperarSenhaOperador", { email: email });
    
    if (res.sucesso) {
      emailRecuperacaoTemporario = email;
      if (typeof showToast === 'function') showToast("PIN enviado para o seu e-mail com sucesso!", "success");
      
      document.getElementById('redefinir-pin').value = "";
      document.getElementById('redefinir-nova-senha').value = "";
      document.getElementById('redefinir-confirmar-senha').value = "";
      
      switchView('view-redefinir-senha');
    } else {
      if (typeof showToast === 'function') showToast(res.erro || "Erro ao solicitar recuperação.", "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("Erro de conexão ao solicitar recuperação.", "error");
  } finally {
    btn.innerText = "ENVIAR CÓDIGO PIN";
    btn.disabled = false;
  }
}

async function confirmarRedefinicaoSenha() {
  const pin = document.getElementById('redefinir-pin').value.trim();
  const novaSenha = document.getElementById('redefinir-nova-senha').value.trim();
  const confirmarSenha = document.getElementById('redefinir-confirmar-senha').value.trim();
  const btn = document.getElementById('btn-confirmar-redefinicao');
  
  if (!pin || !novaSenha || !confirmarSenha) {
    if (typeof showToast === 'function') showToast("Por favor, preencha todos os campos.", "error");
    return;
  }
  
  if (novaSenha.length < 6) {
    if (typeof showToast === 'function') showToast("A nova senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }
  
  if (novaSenha !== confirmarSenha) {
    if (typeof showToast === 'function') showToast("As senhas não coincidem.", "error");
    return;
  }
  
  btn.innerText = "A REDEFINIR...";
  btn.disabled = true;
  
  try {
    const res = await apiCall("redefinirSenhaComToken", { 
      email: emailRecuperacaoTemporario, 
      token: pin, 
      novaSenha: novaSenha 
    });
    
    if (res.sucesso) {
      if (typeof showToast === 'function') showToast("Senha redefinida com sucesso! Pode entrar.", "success");
      emailRecuperacaoTemporario = "";
      document.getElementById('redefinir-pin').value = "";
      document.getElementById('redefinir-nova-senha').value = "";
      document.getElementById('redefinir-confirmar-senha').value = "";
      switchView('view-login-fiscal');
    } else {
      if (typeof showToast === 'function') showToast(res.erro || "PIN inválido ou expirado.", "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("Erro de conexão ao redefinir a senha.", "error");
  } finally {
    btn.innerText = "REDEFINIR SENHA";
    btn.disabled = false;
  }
}


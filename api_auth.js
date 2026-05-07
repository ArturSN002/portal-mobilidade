// ========================================================================
// 0. CONFIGURAÇÕES DA API V11.1 (SALA DAS MÁQUINAS E RBAC)
// ========================================================================

let GAS_URL = "";

const CLIENT_DIRECTORY = {
  "Ceará-Mirim": "https://script.google.com/macros/s/AKfycbyG5vqWLXxU4kLQFPqzRFIwbcKsVlzY6I25wzQ1SSQ4ZYkka-iWL1T1AxzV3aW3H7krAQ/exec",
};

async function checkClientGateway() {
  const savedUrl = localStorage.getItem("MAESTRO_CLIENT_URL");
  const splash = document.getElementById("splash-screen");
  const gateway = document.getElementById("view-gateway");

  if (savedUrl) {
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
  let token = localStorage.getItem("MAESTRO_TOKEN") || localStorage.getItem("MAESTRO_EST_TOKEN");
  
  // Proteção Estrita contra corrupção de Token no LocalStorage
  if (token === "undefined" || token === "null") {
    token = null;
    localStorage.removeItem("MAESTRO_TOKEN");
  }

  const body = {
    action: action,
    token: token,
    payload: payload
  };

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await response.json();
    
    // O Intercetor corrigido para quebrar loops infinitos
    if (data.status === 401 && action !== "invalidarTokenSessao") {
      console.error("401 Unauthorized na rota:", action);
      
      // Limpa a memória para evitar que o lixo cause novos erros
      localStorage.removeItem("MAESTRO_TOKEN");
      
      showToast("Sessão encerrada. Por favor, entre novamente.", "error");
      
      // Aguarda um pouco para o usuário ler o aviso e reinicia de forma limpa
      setTimeout(() => {
          window.location.reload();
      }, 2000);
      
      return { sucesso: false, erro: "Sessão expirada" };
    }

// ========================================================================
// 1. AUTENTICAÇÃO DE OPERADORES (FISCAL / MOTORISTA / ADMIN)
// ========================================================================

async function fazerLoginOperador() {
  const email = document.getElementById('fiscal-email').value.trim();
  const senha = document.getElementById('fiscal-senha').value.trim();
  const btn = document.getElementById('btn-login-fiscal');
  const resBox = document.getElementById('res-login-fiscal');

  if (!email || !senha) {
    showToast("Preencha todos os campos.", "error");
    return;
  }

  btn.innerText = "A AUTENTICAR...";
  btn.disabled = true;
  resBox.classList.add('hidden');

  try {
    const res = await apiCall("fazerLoginOperador", { email, senha });

    if (res.sucesso) {
      // Captura inteligente do token (Cobre múltiplas versões possíveis do seu Apps Script)
      const tokenValido = res.token || res.tokenSessao || res.hashAcesso || res.sessionToken;
      
      if (!tokenValido) {
        showToast("Erro Crítico: O servidor não gerou o token.", "error");
        resBox.innerText = "Falha de comunicação com o autorizador. Token ausente.";
        resBox.classList.remove('hidden');
        btn.innerText = "AUTENTICAR";
        btn.disabled = false;
        return;
      }

      localStorage.setItem("MAESTRO_TOKEN", tokenValido);
      localStorage.setItem("MAESTRO_OP_NOME", res.nome || "Operador");
      localStorage.setItem("MAESTRO_OP_NIVEL", String(res.nivel || "OPERADOR").toUpperCase());
      localStorage.setItem("MAESTRO_OPERADOR_EMAIL", email);

      const elNome = document.getElementById('nome-operador-logado');
      if (elNome) elNome.innerText = res.nome || "Operador";
      
      configurarInterfacePorNivel(String(res.nivel || "OPERADOR").toUpperCase());
      showToast("Acesso concedido!", "success");
    } else {
      resBox.innerText = res.erro || "Login Inválido.";
      resBox.classList.remove('hidden');
    }
  } catch (e) {
    showToast("Erro de ligação.", "error");
  } finally {
    btn.innerText = "AUTENTICAR";
    btn.disabled = false;
  }
}

function configurarInterfacePorNivel(nivel) {
  const mCampo = document.getElementById('menu-grupo-campo');
  const mSecretaria = document.getElementById('menu-grupo-secretaria');
  const mModerador = document.getElementById('menu-grupo-moderador');

  if (mCampo) mCampo.classList.add('hidden');
  if (mSecretaria) mSecretaria.classList.add('hidden');
  if (mModerador) mModerador.classList.add('hidden');

  if (nivel === "MOTORISTA") {
    switchView('view-painel-motorista');
    if (typeof popularSelectFrotaMotorista === 'function') popularSelectFrotaMotorista();
  } 
  else if (nivel === "FISCAL") {
    switchView('view-admin-hub');
    if (mCampo) mCampo.classList.remove('hidden');
  } 
  else if (nivel === "OPERADOR" || nivel === "SUPERVISOR") {
    switchView('view-admin-hub');
    if (mCampo) mCampo.classList.remove('hidden');
    if (mSecretaria) mSecretaria.classList.remove('hidden');
  } 
  else if (nivel === "MODERADOR") {
    switchView('view-admin-hub');
    if (mCampo) mCampo.classList.remove('hidden');
    if (mSecretaria) mSecretaria.classList.remove('hidden');
    if (mModerador) mModerador.classList.remove('hidden');
  }
}

function verificarSessaoAtiva() {
  const token = localStorage.getItem("MAESTRO_TOKEN");
  const nivel = localStorage.getItem("MAESTRO_OP_NIVEL");
  const nome = localStorage.getItem("MAESTRO_OP_NOME");

  if (token && nivel && token !== "undefined" && token !== "null") {
    const elNome = document.getElementById('nome-operador-logado');
    if (elNome) elNome.innerText = nome || "Operador";
    configurarInterfacePorNivel(nivel);
  } else {
    // Se detetar lixo na verificação de arranque, limpa proativamente
    localStorage.removeItem("MAESTRO_TOKEN");
  }
}

function encerrarSessaoOperador() {
  localStorage.removeItem("MAESTRO_TOKEN");
  localStorage.removeItem("MAESTRO_OP_NOME");
  localStorage.removeItem("MAESTRO_OP_NIVEL");
  localStorage.removeItem("MAESTRO_OPERADOR_EMAIL");
  
  window.location.reload();
}

// ========================================================================
// 2. RECUPERAÇÃO DE SENHA
// ========================================================================

function abrirRecuperacaoSenha() {
  switchView('view-recuperar-senha');
}

async function solicitarRecuperacaoSenha() {
  const email = document.getElementById('recuperar-email').value.trim();
  const btn = document.getElementById('btn-solicitar-recuperacao');

  if (!email) { showToast("Insira o seu e-mail.", "error"); return; }

  btn.innerText = "A ENVIAR...";
  btn.disabled = true;

  try {
    const res = await apiCall("recuperarSenhaOperador", { email });
    if (res.sucesso) {
      showToast("PIN enviado para o seu e-mail!", "success");
      localStorage.setItem("MAESTRO_RESET_EMAIL", email);
      switchView('view-redefinir-senha');
    } else {
      showToast(res.erro, "error");
    }
  } catch (e) {
    showToast("Erro de ligação.", "error");
  } finally {
    btn.innerText = "ENVIAR CÓDIGO PIN";
    btn.disabled = false;
  }
}

async function confirmarRedefinicaoSenha() {
  const email = localStorage.getItem("MAESTRO_RESET_EMAIL");
  const pin = document.getElementById('redefinir-pin').value.trim();
  const novaSenha = document.getElementById('redefinir-nova-senha').value.trim();
  const confirma = document.getElementById('redefinir-confirmar-senha').value.trim();
  const btn = document.getElementById('btn-confirmar-redefinicao');

  if (!pin || !novaSenha || novaSenha !== confirma) {
    showToast("Verifique os campos e a confirmação da senha.", "error");
    return;
  }

  btn.innerText = "A PROCESSAR...";
  btn.disabled = true;

  try {
    const res = await apiCall("redefinirSenhaComToken", { email, token: pin, novaSenha });
    if (res.sucesso) {
      showToast("Senha alterada com sucesso! Faça login.", "success");
      localStorage.removeItem("MAESTRO_RESET_EMAIL");
      switchView('view-login-fiscal');
    } else {
      showToast(res.erro, "error");
    }
  } catch (e) {
    showToast("Erro de conexão.", "error");
  } finally {
    btn.innerText = "REDEFINIR SENHA";
    btn.disabled = false;
  }
}

// ========================================================================
// 3. MÓDULO DE SEGURANÇA SAAS & RBAC (V11.1)
// ========================================================================
const TOKEN_KEY = "MAESTRO_OP_TOKEN";
const CACHE_LISTA_KEY = "MAESTRO_CACHE_FISCAL";
const CACHE_STATS_KEY = "MAESTRO_DASH_STATS_V9";
const NIVEL_KEY = "MAESTRO_OP_NIVEL";
let timeoutSessaoID = null;

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

    // Grava credenciais básicas
    localStorage.setItem(TOKEN_KEY, resAuth.token);
    localStorage.setItem(NIVEL_KEY, resAuth.nivel);
    localStorage.setItem("MAESTRO_OPERADOR_EMAIL", email); // NOVO: Essencial para o GPS Mestre

    const elNomeOperador = document.getElementById('nome-operador-logado');
    if (elNomeOperador) elNomeOperador.innerText = resAuth.nome;

    if (resAuth.stats) {
      localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(resAuth.stats));
    }

    const nivel = String(resAuth.nivel).toUpperCase().trim();

    // --------------------------------------------------------
    // NOVO: REDIRECIONAMENTO POR PATENTE (MOTORISTA VS SECRETARIA)
    // --------------------------------------------------------
    if (nivel === "MOTORISTA") {
      btn.innerText = "AUTENTICAR";
      btn.disabled = false;
      document.getElementById('fiscal-email').value = "";
      document.getElementById('fiscal-senha').value = "";

      armarRelogioSessaoLocal();
      switchView('view-painel-motorista');
      popularSelectFrotaMotorista(email);
      showToast("Sessão iniciada como: MOTORISTA", "success");

    } else {
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
    }

  } catch (err) {
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

      const nivel = String(localStorage.getItem(NIVEL_KEY) || "").toUpperCase().trim();

      // NOVO: Avalia se o restauro da sessão foi de um Motorista
      if (nivel === "MOTORISTA") {
        switchView('view-painel-motorista');
        popularSelectFrotaMotorista(localStorage.getItem("MAESTRO_OPERADOR_EMAIL"));
      } else if (document.getElementById('id-fiscal') && document.getElementById('id-fiscal').value !== "") {
        switchView('view-fiscal');
        validarFiscal();
      } else {
        switchView('view-admin-hub');
      }
    }
  } catch (e) { }
}

function armarRelogioSessaoLocal() {
  if (timeoutSessaoID) clearTimeout(timeoutSessaoID);
  timeoutSessaoID = setTimeout(() => {
    encerrarSessaoOperador(true);
    showToast("Sessão encerrada (8h limite).", "info");
  }, 28800000);
}

async function encerrarSessaoOperador(silencioso = false) {
  try { await apiCall("invalidarTokenSessao"); } catch (e) { }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CACHE_LISTA_KEY);
  localStorage.removeItem(CACHE_STATS_KEY);
  localStorage.removeItem(NIVEL_KEY);
  localStorage.removeItem("MAESTRO_SEMENTE_FISCAL");
  localStorage.removeItem("MAESTRO_OPERADOR_EMAIL");
  if (timeoutSessaoID) clearTimeout(timeoutSessaoID);

  if (typeof fecharScanner === "function") fecharScanner();
  if (typeof desativarModoViagemPWA === "function") desativarModoViagemPWA(); // Garante o fim do GPS se o motorista der logout

  const elNome = document.getElementById('nome-operador-logado');
  if (elNome) elNome.innerText = "Operador";

  const elResFis = document.getElementById('res-fiscal');
  if (elResFis) elResFis.innerHTML = "";

  const elIdFis = document.getElementById('id-fiscal');
  if (elIdFis) elIdFis.value = "";

  switchView('view-hub');
  if (!silencioso) showToast("Sessão encerrada.", "info");
}

// ========================================================================
// 4. RECUPERAÇÃO DE SENHA E UTILITÁRIOS (OPERADOR)
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

/**
 * ----------------------------------------------------------------------------
 * AUXILIAR: Popula o Select de Veículos no Painel do Motorista
 * ----------------------------------------------------------------------------
 * Procura na base de dados as rotas ativas chamando "getFiltrosPush".
 * @param {string} email - E-mail do motorista logado
 */
async function popularSelectFrotaMotorista(email) {
  const select = document.getElementById("select-frota-motorista");
  if (!select) return;

  try {
    const res = await apiCall("getFiltrosPush");

    if (res.sucesso && res.filtros && res.filtros.rotas && res.filtros.rotas.length > 0) {
      select.innerHTML = '<option value="" disabled selected>Escolha o seu veículo...</option>';

      res.filtros.rotas.forEach(rota => {
        const opt = document.createElement("option");
        opt.value = rota; // Valor enviado para o back-end (Placa ou Rota)
        opt.innerText = rota;
        select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="" disabled selected>Nenhum veículo disponível</option>';
    }
  } catch (e) {
    console.error("Erro ao carregar a frota:", e);
    select.innerHTML = '<option value="" disabled selected>Erro ao carregar frota</option>';
  }
}

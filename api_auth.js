// ========================================================================
// 0. CONFIGURAÇÕES DA API V11.1 (SALA DAS MÁQUINAS E RBAC)
// ========================================================================

let GAS_URL = "";

const CLIENT_DIRECTORY = {
  "Ceará-Mirim": "https://script.google.com/macros/s/AKfycbxCyjldz81tosTxZGuFFmFCd2YxfKRohjeclqpSMk09yOa-O1iwXKc-6gVK_2x4jBA0Rg/exec",
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

    if (data.status === 401 && action !== "invalidarTokenSessao") {
      console.error("401 Unauthorized na rota:", action);
      localStorage.removeItem("MAESTRO_TOKEN");
      showToast("Sessão encerrada. Por favor, entre novamente.", "error");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return { sucesso: false, erro: "Sessão expirada" };
    }

    return data;
  } catch (error) {
    console.error("Erro na chamada API:", error);
    return { sucesso: false, erro: "Falha na ligação ao servidor." };
  }
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
    localStorage.removeItem("MAESTRO_TOKEN");
  }
}

function encerrarSessaoOperador() {
  localStorage.removeItem("MAESTRO_TOKEN");
  localStorage.removeItem("MAESTRO_OP_NOME");
  localStorage.removeItem("MAESTRO_OP_NIVEL");
  localStorage.removeItem("MAESTRO_OPERADOR_EMAIL");

  // CRITICAL FIX: Destroy the view memory to prevent the session loop
  sessionStorage.removeItem('MAESTRO_LAST_VIEW');

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

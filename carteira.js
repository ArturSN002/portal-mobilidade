// ========================================================================
// 8. FLUXO DA CARTEIRA DIGITAL (COFRE OFFLINE-FIRST)
// ========================================================================
let currentWalletId = "";
let currentWalletSenha = "";
let currentStudentName = "";
let clockInterval = null;
let timeoutSessaoEstudanteID = null;

function triggerVibration(ms) {
    if ("vibrate" in navigator) {
        navigator.vibrate(ms);
    }
}

function restaurarSessaoEstudante() {
    const token = localStorage.getItem("MAESTRO_EST_TOKEN");
    const cachedDataRaw = localStorage.getItem("MAESTRO_OFFLINE_WALLET") || localStorage.getItem("MAESTRO_WALLET_CACHE");
    const credsRaw = localStorage.getItem("MAESTRO_WALLET_CREDS");

    if (token && cachedDataRaw && credsRaw) {
        try {
            const dados = JSON.parse(cachedDataRaw);
            const creds = JSON.parse(credsRaw);
            currentWalletId = dados.idCarteira;
            currentWalletSenha = creds.senha;
            currentStudentName = dados.nome;
            armarRelogioSessaoEstudante();
            abrirTelaCofreOuEntrarDireto();
        } catch (e) {
            console.warn("Erro ao restaurar sessão de estudante na RAM.");
        }
    }
}

function abrirTelaCofreOuEntrarDireto() {
    if (currentWalletId && localStorage.getItem("MAESTRO_EST_TOKEN")) {
        const cachedDataRaw = localStorage.getItem("MAESTRO_OFFLINE_WALLET") || localStorage.getItem("MAESTRO_WALLET_CACHE");
        if (cachedDataRaw) {
            const dados = JSON.parse(cachedDataRaw);
            if (dados.themePrimary) {
                renderizarCarteiraOffline(dados);
            } else {
                renderizarCarteira(dados);
            }
            switchView('view-wallet');
            return;
        }
    }
    switchView('view-login');
}

document.addEventListener("DOMContentLoaded", () => {
    const btnCarteira = document.querySelector("button.menu-card.primary-card[onclick*='view-login']");
    if (btnCarteira) btnCarteira.onclick = abrirTelaCofreOuEntrarDireto;
});

function mostrarSkeletonWallet() {
    const container = document.getElementById('wallet-container');
    const actions = document.getElementById('wallet-actions');
    if (actions) actions.classList.add('hidden');

    container.innerHTML = `
    <div class="wallet-card">
        <div class="wallet-header skeleton-box" style="color: transparent;">IDENTIDADE UNIVERSITÁRIA</div>
        <div class="wallet-body">
            <div class="wallet-photo skeleton-box"></div>
            <div class="wallet-info" style="width: 100%;">
                <div class="skeleton-box" style="height: 15px; width: 60%; margin-bottom: 5px; border-radius: 4px;"></div>
                <div class="skeleton-box" style="height: 20px; width: 80%; margin-bottom: 15px; border-radius: 4px;"></div>
                
                <div class="skeleton-box" style="height: 15px; width: 40%; margin-bottom: 5px; border-radius: 4px;"></div>
                <div class="skeleton-box" style="height: 15px; width: 70%; margin-bottom: 15px; border-radius: 4px;"></div>
                
                <div class="skeleton-box" style="height: 15px; width: 50%; margin-bottom: 5px; border-radius: 4px;"></div>
                <div class="skeleton-box" style="height: 15px; width: 60%; border-radius: 4px;"></div>
            </div>
        </div>
        <div class="text-center" style="margin: 15px 0; padding: 15px 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border);">
            <div class="skeleton-box" style="width: 160px; height: 160px; margin: 0 auto; border-radius: 8px;"></div>
        </div>
    </div>`;
}

async function loginCarteira() {
  const id = document.getElementById('login-id').value.trim();
  const senha = document.getElementById('login-senha').value.trim();
  const btn = document.getElementById('btn-login');
  const resBox = document.getElementById('res-login');

  if (!id || !senha) {
    resBox.innerText = "Preencha o ID e a Senha.";
    resBox.classList.remove('hidden');
    return;
  }

  btn.innerText = "A AUTENTICAR...";
  btn.disabled = true;
  resBox.classList.add('hidden');

  try {
    const res = await apiCall("autenticarCarteiraDigital", { id: id, senha: senha });
    btn.innerText = "ENTRAR NO COFRE";
    btn.disabled = false;

    if (res.erro) {
      resBox.innerText = res.erro;
      resBox.classList.remove('hidden');
    } else if (res.sucesso) {
      currentWalletId = id;
      currentWalletSenha = senha;
      currentStudentName = res.nome;
      
      if (res.token) localStorage.setItem("MAESTRO_EST_TOKEN", res.token);
      localStorage.setItem("MAESTRO_WALLET_CACHE", JSON.stringify(res));
      localStorage.setItem("MAESTRO_WALLET_CREDS", JSON.stringify({id: id, senha: senha}));

      renderizarCarteira(res);
      switchView('view-wallet');
      document.getElementById('login-id').value = '';
      document.getElementById('login-senha').value = '';
      
      armarRelogioSessaoEstudante(); 
      
      // NOVO: Verifica se o aluno permitiu as notificações nas configurações
      if (localStorage.getItem('MAESTRO_PREF_PUSH') === 'true') {
          const tokenTemp = localStorage.getItem("MAESTRO_FCM_TOKEN_TEMP");
          if (tokenTemp) {
              if (typeof registrarTokenPush === 'function') registrarTokenPush(tokenTemp);
          } else {
              setTimeout(inicializarPushNotifications, 2000); 
          }
      }
    }
  } catch(err) {
    btn.innerText = "ENTRAR NO COFRE";
    btn.disabled = false;
    
    const cachedData = localStorage.getItem("MAESTRO_WALLET_CACHE");
    const cachedCreds = localStorage.getItem("MAESTRO_WALLET_CREDS");
    
    if (cachedData && cachedCreds) {
       const creds = JSON.parse(cachedCreds);
       if (creds.id.toUpperCase() === id.toUpperCase() && creds.senha === senha) {
          currentWalletId = id;
          currentWalletSenha = senha;
          const resCached = JSON.parse(cachedData);
          currentStudentName = resCached.nome;
          
          showToast("Modo Offline Ativado. Funções limitadas.", "warning");
          renderizarCarteira(resCached);
          switchView('view-wallet');
          armarRelogioSessaoEstudante();
          return;
       }
    }
    resBox.innerText = "Falha de ligação. Necessita de internet.";
    resBox.classList.remove('hidden');

  }
}
      
function armarRelogioSessaoEstudante() {
    if (timeoutSessaoEstudanteID) clearTimeout(timeoutSessaoEstudanteID);
    timeoutSessaoEstudanteID = setTimeout(() => {
        sairCarteira(true);
        showToast("Sessão expirada. Por favor, aceda novamente.", "info");
    }, 10800000);
}

function renderizarCarteira(dados) {
    const container = document.getElementById('wallet-container');
    const actions = document.getElementById('wallet-actions');
    const nomeTratado = formatarNomeProprio(dados.nome);
    const fotoHTML = dados.fotoUrl ? `<img src="${dados.fotoUrl}" class="wallet-photo">` : `<div class="wallet-photo" style="display:flex;align-items:center;justify-content:center;color:#aaa;font-size:12px;text-align:center;">Sem Foto</div>`;

    let html = `
  <div class="wallet-card">
    <div class="wallet-header">IDENTIDADE UNIVERSITÁRIA</div>
    <div class="wallet-body">
      ${fotoHTML}
      <div class="wallet-info">
        <div class="w-group"><span>Estudante</span><span class="highlight">${nomeTratado}</span></div>
        <div class="w-group"><span>CPF</span><span>${dados.cpfMascarado}</span></div>
        <div class="w-group"><span>ID da Carteira</span><span style="font-family:monospace; font-size:12px;">${dados.idCarteira}</span></div>
      </div>
    </div>
    
    <div class="text-center" style="margin: 15px 0; padding: 15px 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border);">
      <div style="background: white; padding: 10px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: pointer;" onclick="toggleFullscreenQR('wallet-qrcode')">
         <div id="wallet-qrcode"></div>
      </div>
      <div style="font-size: 11px; color: var(--primary); margin-top: 8px; font-weight: 700; letter-spacing: 1px;">VÁLIDO PARA EMBARQUE HOJE</div>
    </div>

    <div class="wallet-footer">
      <div class="w-row">
        <div class="w-group"><span>Instituição</span><span style="font-weight:700;">${dados.instituicao}</span></div>
        <div class="w-group" style="text-align:right;"><span>Turno</span><span>${dados.turno}</span></div>
      </div>
      <div class="w-row"><div class="w-group"><span>Rota de Transporte</span><span>${dados.rota}</span></div></div>
      <div class="text-center" style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
         <span style="font-size:10px; color:var(--text-sub);">Válido em ${dados.cidade} até <strong>${dados.validade}</strong></span>
      </div>
      <div class="anti-print-bar" id="wallet-clock">Relógio Seguro...</div>
    </div>
  </div>
  
  <div style="display:flex; margin-top:20px;">
      <button id="btn-dw-declaracao" class="btn-solid dark-bg" style="width:100%; margin:0;" onclick="baixarDocumento('DECLARACAO')">📄 Baixar Declaração de Vínculo</button>
  </div>`;

    container.innerHTML = html;

    if (actions) {
        actions.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom: 15px;">
           <button class="btn-solid" style="flex:1; margin:0; background: var(--primary);" onclick="verificarJanelasEmbarque()">🚐 Abrir Radar de Viagens</button>
           <button class="btn-solid dark-bg" style="flex:1; margin:0;" onclick="abrirMuralDaSemana()">🗣️ Sugestões / Fórum</button>
        </div>
        <div style="text-align:center;">
           <button class="btn-text text-danger" style="font-weight: 700; font-size: 14px;" onclick="sairCarteira()">❌ Fechar Cofre Digital</button>
        </div>
      `;
        actions.classList.remove('hidden');
    }

    iniciarRelogioAntiPrint('wallet-clock');

    const qrContainer = document.getElementById('wallet-qrcode');
    if (qrContainer) {
        qrContainer.innerHTML = "";
        const semente = dados.sementeDia || new Date().toISOString().split('T')[0];
        new QRCode(qrContainer, { text: `${dados.idCarteira}|${semente}`, width: 160, height: 160, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    }
}

function renderizarCarteiraOffline(dados) {
    const container = document.getElementById('wallet-container');
    const actions = document.getElementById('wallet-actions');
    const nomeTratado = formatarNomeProprio(dados.nome);
    const fotoHTML = dados.fotoBase64 ? `<img src="${dados.fotoBase64}" class="wallet-photo">` : `<div class="wallet-photo" style="display:flex;align-items:center;justify-content:center;color:#aaa;font-size:12px;text-align:center;">Sem Foto</div>`;

    let html = `
  <div class="wallet-card" style="border: 2px solid #f59e0b;">
    <div class="wallet-header" style="background: #f59e0b; color: #fff;">MODO OFFLINE</div>
    <div class="wallet-body">
      ${fotoHTML}
      <div class="wallet-info">
        <div class="w-group"><span>Estudante</span><span class="highlight" style="color: ${dados.themePrimary || 'var(--primary)'};">${nomeTratado}</span></div>
        <div class="w-group"><span>CPF</span><span>${dados.cpfMascarado}</span></div>
        <div class="w-group"><span>ID da Carteira</span><span style="font-family:monospace; font-size:12px;">${dados.idCarteira}</span></div>
      </div>
    </div>
    
    <div class="text-center" style="margin: 15px 0; padding: 15px 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border);">
      <div style="background: white; padding: 10px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: pointer;" onclick="toggleFullscreenQR('wallet-qrcode-offline')">
         <div id="wallet-qrcode-offline"></div>
      </div>
      <div style="font-size: 11px; color: #f59e0b; margin-top: 8px; font-weight: 700; letter-spacing: 1px;">ACESSO OFFLINE LIMITADO</div>
    </div>

    <div class="wallet-footer">
      <div class="w-row">
        <div class="w-group"><span>Instituição</span><span style="font-weight:700;">${dados.instituicao}</span></div>
        <div class="w-group" style="text-align:right;"><span>Turno</span><span>${dados.turno}</span></div>
      </div>
      <div class="w-row"><div class="w-group"><span>Rota de Transporte</span><span>${dados.rota}</span></div></div>
      <div class="text-center" style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
         <span style="font-size:10px; color:var(--text-sub);">Válido em ${dados.cidade || '...'} até <strong>${dados.validade || '...'}</strong></span>
      </div>
      <div class="anti-print-bar" id="wallet-clock" style="background: #f59e0b;">Modo Offline Ativado</div>
    </div>
  </div>
  
  <div style="display:flex; margin-top:20px;">
      <button class="btn-solid dark-bg" style="width:100%; margin:0; background: #ccc; cursor: not-allowed;" disabled>📄 Baixar Declaração de Vínculo</button>
  </div>`;

    container.innerHTML = html;

    if (actions) {
        actions.innerHTML = `
        <div style="text-align:center;">
           <button class="btn-text text-danger" style="font-weight: 700; font-size: 14px;" onclick="sairCarteira()">❌ Fechar Cofre Digital</button>
        </div>
      `;
        actions.classList.remove('hidden');
    }

    iniciarRelogioAntiPrint('wallet-clock');

    const qrContainer = document.getElementById('wallet-qrcode-offline');
    if (qrContainer) {
        qrContainer.innerHTML = "";
        const semente = new Date().toISOString().split('T')[0];
        new QRCode(qrContainer, { text: `${dados.idCarteira}|${semente}`, width: 160, height: 160, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    }
}

let wakeLock = null;
async function toggleFullscreenQR(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.toggle('qr-fullscreen');
    const isFullscreen = el.classList.contains('qr-fullscreen');

    if (isFullscreen) {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.warn("Wake Lock falhou:", err);
            }
        }
    } else {
        if (wakeLock !== null) {
            wakeLock.release().then(() => {
                wakeLock = null;
            });
        }
    }
}

function iniciarRelogioAntiPrint(elementId) {
    if (clockInterval) clearInterval(clockInterval);
    const clockDiv = document.getElementById(elementId);
    if (!clockDiv) return;
    const update = () => clockDiv.innerText = `⏳ Autenticado: ${new Date().toLocaleTimeString('pt-BR')}`;
    update();
    clockInterval = setInterval(update, 1000);
}

async function baixarDocumento(tipo, tentativa = 1) {
    const MAX_TENTATIVAS = 3;
    const btnId = tipo === 'CARTEIRA' ? 'btn-dw-carteira' : 'btn-dw-declaracao';
    const btn = document.getElementById(btnId);

    const textoOriginal = btn.getAttribute('data-original-text') || btn.innerHTML;
    if (tentativa === 1) btn.setAttribute('data-original-text', textoOriginal);

    btn.innerHTML = tentativa === 1 ? `⏳ A transferir...` : `🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS}...`;
    btn.disabled = true;

    try {
        const res = await apiCall("baixarDocumentoSeguro", { id: currentWalletId, tipo: tipo });

        if (res.erro) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            showToast(res.erro, "error");
        } else if (res.sucesso && res.arquivoBase64) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${res.arquivoBase64}`;
            link.download = res.arquivoNome || `Documento_${tipo}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast(`Download de ${tipo} concluído!`, "success");
            btn.innerHTML = `⏳ Aguarde...`;
            setTimeout(() => { btn.innerHTML = textoOriginal; btn.disabled = false; }, 10000);
        }
    } catch (err) {
        if (tentativa < MAX_TENTATIVAS) {
            showToast(`Servidor ocupado. A tentar...`, "info");
            setTimeout(() => { baixarDocumento(tipo, tentativa + 1); }, tentativa * 2000);
        } else {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            showToast("Falha de conexão com a API.", "error");
        }
    }
}

function irParaCofreComId(idAcesso) {
    if (currentWalletId && localStorage.getItem("MAESTRO_EST_TOKEN") && currentWalletId.toUpperCase() === idAcesso.toUpperCase()) {
        switchView('view-wallet');
        return;
    }

    switchView('view-login');
    const inputId = document.getElementById('login-id');
    const inputSenha = document.getElementById('login-senha');

    if (inputId && idAcesso) inputId.value = idAcesso;
    if (inputSenha) setTimeout(() => { inputSenha.focus(); }, 100);
}

async function sairCarteira(expiracaoSilenciosa = false) {
    try { await apiCall("invalidarTokenSessao"); } catch (e) { }

    localStorage.removeItem("MAESTRO_EST_TOKEN");

    if (clockInterval) clearInterval(clockInterval);
    if (timeoutSessaoEstudanteID) clearInterval(timeoutSessaoEstudanteID);

    if (typeof pararTransmissaoGpsE_Radar === 'function') {
        pararTransmissaoGpsE_Radar();
    }

    document.getElementById('wallet-container').innerHTML = '';
    const actions = document.getElementById('wallet-actions');
    if (actions) actions.classList.add('hidden');

    currentWalletId = "";
    currentWalletSenha = "";
    currentStudentName = "";

    const painelMob = document.getElementById('view-mobilidade');
    if (painelMob) painelMob.style.display = 'none';

    switchView('view-aluno-menu');
    if (!expiracaoSilenciosa) showToast("Cofre bloqueado com segurança.", "info");
}

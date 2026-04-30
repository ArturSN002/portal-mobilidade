// ========================================================================
// 6. FLUXO DE CONSULTA DO ESTUDANTE
// ========================================================================
async function consultarEstudante() {
  const alvo = document.getElementById('id-estudante').value.trim();
  if (!alvo) { showToast("Informe o CPF.", "error"); return; }

  const btn = document.getElementById('btn-estudante');
  const resBox = document.getElementById('res-estudante');
  const checkboxPush = document.getElementById('chk-notificacoes-cpf');
  
  btn.innerText = "A CONSULTAR...";
  btn.disabled = true;
  resBox.classList.add('hidden');

  try {
    const res = await apiCall("consultarStatusCPF", { cpf: alvo });
    btn.innerText = "CONSULTAR STATUS";
    btn.disabled = false;
    
    if (!res.encontrado) {
      mostrarErroEstudante("Não Encontrado", "Verifique o CPF ou submissão.");
      return;
    }
    
    if (checkboxPush && checkboxPush.checked) {
       solicitarConsentimentoPushAnonimo(alvo);
    }
    
    renderizarTimelineEstudante(res, resBox);
  } catch(err) {
    btn.innerText = "CONSULTAR STATUS";
    btn.disabled = false;
    mostrarErroEstudante("Erro na API", "Tente novamente mais tarde.");
  }
}

async function solicitarConsentimentoPushAnonimo(cpf) {
  try {
    if (typeof firebase === 'undefined' || !firebase.messaging.isSupported()) return;
    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await messaging.getToken({ vapidKey: window.FIREBASE_VAPID_KEY });
      if (token) {
        await apiCall("registrarPushToken", { idEstudante: cpf, pushToken: token });
      }
    }
  } catch (error) {
    console.log("Push anónimo falhou ou foi bloqueado.", error);
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

function renderizarTimelineEstudante(dados, container) {
  const nomeLimpo = formatarNomeProprio(dados.nome).split(' ')[0];
  let html = `<h3 style="margin:0 0 15px 0; color:var(--primary);">Olá, ${nomeLimpo}!</h3>`;
  html += `<div class="timeline">`;
  
  html += `<div class="timeline-item active-blue">
             <strong style="color: var(--primary);">1. Formulário Recebido</strong><br>
             <span style="color:var(--text-sub); font-size:11px;">Os seus dados deram entrada no sistema.</span>
           </div>`;

  const sOCR = String(dados.statusOCR || "").trim().toUpperCase();
  const sDocs = String(dados.statusDocs || "").trim().toUpperCase();
  const sAtiv = String(dados.statusAtividade || "").trim().toUpperCase();

  const buildObsBox = (obs, colorBorder, colorBg, colorText) => {
    if (!obs || obs.trim() === "") return "";
    return `
      <div style="margin-top: 12px; padding: 12px; background: ${colorBg}; border-left: 4px solid ${colorBorder}; border-radius: 4px; color: ${colorText}; font-size: 12px; line-height: 1.5; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <strong style="display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase; opacity:0.8; letter-spacing: 0.5px;">Mensagem do Setor:</strong>
        ${obs.replace(/\n/g, '<br>')}
      </div>
    `;
  };

  if (sAtiv === "CANCELADO") {
    html += `<div class="timeline-item active-red"><strong style="color:var(--danger);">2. Emissão Interrompida</strong></div>`;
    html += `<div class="timeline-item active-red">
               <strong style="color:var(--danger);">3. Inscrição Cancelada</strong><br>
               <span style="color:var(--danger); font-size:11px; font-weight:600;">O acesso ao transporte foi cancelado.</span>
               ${buildObsBox(dados.obs, "var(--danger)", "#FEF2F2", "#991B1B")}
             </div>`;
             
  } else if (sAtiv === "SUSPENSO") {
    html += `<div class="timeline-item active-orange"><strong style="color:#F97316;">2. Emissão Interrompida</strong></div>`;
    html += `<div class="timeline-item active-orange">
               <strong style="color:#F97316;">3. Inscrição Suspensa</strong><br>
               <span style="color:#F97316; font-size:11px; font-weight:600;">O acesso foi desativado temporariamente.</span>
               ${buildObsBox(dados.obs, "#F97316", "#FFF7ED", "#9A3412")}
               
               <button class="btn-solid" style="margin-top:15px; background: #9A3412; font-size:12px;" onclick="abrirPortalResgate()">CORRIGIR DOCUMENTAÇÃO</button>
             </div>`;
             
  } else {
    if (sOCR === "PENDENTE" || sOCR === "") {
      html += `<div class="timeline-item"><strong>2. Em Auditoria</strong><br><span style="color:var(--text-sub); font-size:11px;">A aguardar análise documental.</span></div>`;
      html += `<div class="timeline-item"><strong>3. Resultado</strong></div>`;
      
    } else if (sOCR === "ANALISE_HUMANA" || sOCR === "PENDENCIA") {
      html += `<div class="timeline-item active-yellow">
                 <strong style="color:#FBBF24;">2. Pendência Documental</strong><br>
                 <span style="color:#D97706; font-size:11px; font-weight:600;">Ação necessária para prosseguir.</span>
                 ${buildObsBox(dados.obs, "#F59E0B", "#FFFBEB", "#92400E")}
                 
                 <button class="btn-solid" style="margin-top:15px; background: var(--accent); font-size:12px;" onclick="abrirPortalResgate()">CORRIGIR DOCUMENTAÇÃO</button>
               </div>`;
      html += `<div class="timeline-item"><strong>3. Resultado</strong></div>`;
      
    } else {
      html += `<div class="timeline-item active-green"><strong style="color:var(--success);">2. Documentos Validados</strong></div>`;
      
      if (sDocs === "EMITIDO" || sDocs === "EMITIDO_NOTIFICADO" || sDocs === "GERADO") {
        html += `<div class="timeline-item active-green"><strong style="color:var(--success);">3. Carteira Ativa!</strong><br><span style="color:var(--text-sub); font-size:11px;">A sua identidade estudantil já pode ser utilizada.</span></div>`;
        
        if (dados.idAcesso) {
           html += `
           <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border: 1px solid var(--success); border-radius: 8px; text-align: center;">
             <span style="font-size: 11px; color: var(--success); display:block; margin-bottom:5px; text-transform: uppercase; font-weight:700;">O seu ID de Acesso é:</span>
             <strong style="font-size: 22px; color: #065F46; letter-spacing: 2px; font-family: monospace;">${dados.idAcesso}</strong>
             <p style="font-size: 11px; color: #065F46; margin: 8px 0 0 0;">Use este ID e os 4 últimos dígitos do seu CPF para abrir o cofre digital.</p>
             <button class="btn-solid" style="margin-top:15px;" onclick="irParaCofreComId('${dados.idAcesso}')">IR PARA O COFRE</button>
           </div>`;
        }
      } else {
        html += `<div class="timeline-item active-blue"><strong style="color: var(--primary);">3. A Aguardar Emissão</strong><br><span style="color:var(--text-sub); font-size:11px;">A sua carteira digital está em processamento.</span></div>`;
      }
    }
  }

  html += `</div>`; 
  container.innerHTML = html;
  container.classList.remove('hidden');
}

function mostrarErroEstudante(titulo, mensagem) {
  const resBox = document.getElementById('res-estudante');
  resBox.innerHTML = `<div class="error-box"><strong>${titulo}</strong><br>${mensagem}</div>`;
  resBox.classList.remove('hidden');
}

// ========================================================================
// 7. MÓDULO DE RESGATE DOCUMENTAL (V9.2)
// ========================================================================

let arquivosParaResgate = {};

function abrirPortalResgate() {
    switchView('view-resgate');
    arquivosParaResgate = {};
    document.querySelectorAll("input[type='checkbox'][id^='chk-resgate-']").forEach(chk => chk.checked = false);
    document.querySelectorAll("div[id^='box-resgate-']").forEach(box => box.classList.add('hidden'));
    document.querySelectorAll("input[type='file'][id^='file-resgate-']").forEach(f => f.value = "");
    document.querySelectorAll("span[id^='status-resgate-']").forEach(st => {
        st.innerText = "A aguardar seleção...";
        st.style.color = "var(--text-sub)";
    });
    verificarBotaoResgate();
}

function cancelarResgate() {
    switchView('view-consult');
}

function toggleBoxResgate(tipoDoc) {
    const isChecked = document.getElementById(`chk-resgate-${tipoDoc.toLowerCase()}`).checked;
    const box = document.getElementById(`box-resgate-${tipoDoc}`);
    const fileInput = document.getElementById(`file-resgate-${tipoDoc}`);
    const statusSpan = document.getElementById(`status-resgate-${tipoDoc}`);
    
    if (isChecked) {
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
        fileInput.value = "";
        statusSpan.innerText = "A aguardar seleção...";
        statusSpan.style.color = "var(--text-sub)";
        delete arquivosParaResgate[tipoDoc];
        verificarBotaoResgate();
    }
}

function processarArquivoResgate(inputElement, tipoDoc) {
    const file = inputElement.files[0];
    const statusSpan = document.getElementById(`status-resgate-${tipoDoc}`);
    
    if (!file) {
        delete arquivosParaResgate[tipoDoc];
        statusSpan.innerText = "A aguardar seleção...";
        statusSpan.style.color = "var(--text-sub)";
        verificarBotaoResgate();
        return;
    }

    if (file.size > 5 * 1024 * 1024) { 
        showToast("O arquivo é muito grande (Máximo 5MB).", "error");
        inputElement.value = "";
        delete arquivosParaResgate[tipoDoc];
        statusSpan.innerText = "Erro: Arquivo demasiado pesado.";
        statusSpan.style.color = "var(--danger)";
        verificarBotaoResgate();
        return;
    }

    statusSpan.innerText = "A processar... ⏳";
    statusSpan.style.color = "var(--accent)";

    const reader = new FileReader();
    reader.onload = function(e) {
        arquivosParaResgate[tipoDoc] = {
            tipo: tipoDoc,
            nome: file.name,
            base64: e.target.result
        };
        statusSpan.innerText = "✅ Anexado e pronto a enviar!";
        statusSpan.style.color = "var(--success)";
        verificarBotaoResgate();
    };
    reader.onerror = function() {
        showToast("Falha na leitura do arquivo.", "error");
        inputElement.value = "";
        delete arquivosParaResgate[tipoDoc];
        statusSpan.innerText = "Erro na leitura.";
        statusSpan.style.color = "var(--danger)";
        verificarBotaoResgate();
    };
    reader.readAsDataURL(file);
}

function verificarBotaoResgate() {
    const btn = document.getElementById('btn-enviar-resgate');
    if (Object.keys(arquivosParaResgate).length > 0) {
        btn.disabled = false;
        btn.style.opacity = "1";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }
}

async function enviarArquivosResgate() {
    const cpf = document.getElementById('id-estudante').value.trim();
    if (!cpf) {
        showToast("Falha interna: CPF não localizado.", "error");
        return;
    }

    const payloadArquivos = Object.values(arquivosParaResgate);
    if (payloadArquivos.length === 0) {
        showToast("Nenhum arquivo anexado para envio.", "error");
        return;
    }

    const btn = document.getElementById('btn-enviar-resgate');
    btn.innerHTML = "A ENVIAR PARA A SECRETARIA... ⏳";
    btn.disabled = true;

    try {
        const res = await apiCall("submeterResgateDocumental", {
            cpf: cpf,
            arquivos: payloadArquivos
        });

        if (res.sucesso) {
            showToast(res.msg || "Documentos enviados com sucesso!", "success");
            switchView('view-consult');
            consultarEstudante(); 
        } else {
            showToast(res.erro || "Falha ao enviar os documentos.", "error");
            btn.innerHTML = "TENTAR NOVAMENTE";
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Erro de ligação com a Secretaria.", "error");
        btn.innerHTML = "TENTAR NOVAMENTE";
        btn.disabled = false;
    }
}

// ========================================================================
// 8. FLUXO DA CARTEIRA DIGITAL (COFRE OFFLINE-FIRST)
// ========================================================================
let currentWalletId = "";
let currentWalletSenha = "";
let currentStudentName = "";
let clockInterval = null; 
let timeoutSessaoEstudanteID = null; 

function restaurarSessaoEstudante() {
    const token = localStorage.getItem("MAESTRO_EST_TOKEN");
    const cachedDataRaw = localStorage.getItem("MAESTRO_WALLET_CACHE");
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
        } catch(e) {
            console.log("Erro ao restaurar sessão de estudante na RAM.");
        }
    }
}

function abrirTelaCofreOuEntrarDireto() {
    if (currentWalletId && localStorage.getItem("MAESTRO_EST_TOKEN")) {
        const cachedDataRaw = localStorage.getItem("MAESTRO_WALLET_CACHE");
        if (cachedDataRaw) {
            renderizarCarteira(JSON.parse(cachedDataRaw));
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
      setTimeout(inicializarPushNotifications, 2000); 
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
      <div style="background: white; padding: 10px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
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
  
  <div style="display:flex; gap:10px; margin-top:20px;">
      <button id="btn-dw-carteira" class="btn-solid" style="flex:1; margin:0;" onclick="baixarDocumento('CARTEIRA')">🪪 Baixar ID</button>
      <button id="btn-dw-declaracao" class="btn-solid dark-bg" style="flex:1; margin:0;" onclick="baixarDocumento('DECLARACAO')">📄 Declaração</button>
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
      new QRCode(qrContainer, { text: `${dados.idCarteira}|${semente}`, width: 160, height: 160, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
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
  } catch(err) {
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

async function sairCarteira(expiracaoSilenciosa = false) {
  try { await apiCall("invalidarTokenSessao"); } catch(e) {}
  
  localStorage.removeItem("MAESTRO_EST_TOKEN");

  if (clockInterval) clearInterval(clockInterval);
  if (timeoutSessaoEstudanteID) clearInterval(timeoutSessaoEstudanteID);
  
  pararTransmissaoGpsE_Radar();
  
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

// ========================================================================
// 8.1. MOTOR DE MOBILIDADE: RADAR E ETA 
// ========================================================================

let onibusSelecionadoGPS = null;
let idIntervaloGPS = null;      
let idIntervaloRadar = null;    
let wakeLockAtivo = null;

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

function calcularETA(distanciaKm) {
    const velMediaKmH = 25; 
    const tempoHoras = distanciaKm / velMediaKmH;
    const tempoMinutos = Math.round(tempoHoras * 60);
    if (tempoMinutos <= 2) return "A chegar!";
    return `~ ${tempoMinutos} min`;
}

async function verificarJanelasEmbarque() {
   if (!currentWalletId) {
      showToast("Sessão inválida para aceder às viagens.", "error");
      return;
   }
   
   const painelMob = document.getElementById('view-mobilidade');
   const containerLista = document.getElementById('lista-viagens-container');
   const painelSucesso = document.getElementById('painel-viagem-ativa');
   
   if (painelMob) painelMob.style.display = 'block';
   if (painelSucesso) painelSucesso.innerHTML = ''; 
   
   if (containerLista) {
       containerLista.innerHTML = `<div class="loader" style="margin: 0 auto 10px auto; width: 25px; height: 25px; border-width: 3px;"></div><p style="font-size: 11px; color: var(--text-sub);">A procurar autocarros...</p>`;
       containerLista.classList.remove('hidden');
   }

   try {
       if (painelMob) painelMob.scrollIntoView({ behavior: 'smooth', block: 'start' });

       const res = await apiCall("getViagensDisponiveisPortal", { idEstudante: currentWalletId });
       
       if (!res.sucesso) {
           if (containerLista) containerLista.innerHTML = `<p style="font-size: 11px; color: var(--danger);">Erro: ${res.erro}</p>`;
           return;
       }

       if (res.emViagem) {
           if (containerLista) containerLista.classList.add('hidden');
           onibusSelecionadoGPS = res.dadosViagem.idOnibus;
           abrirPainelViagem(); 
           return;
       }

       if (!res.viagens || res.viagens.length === 0) {
           let msgEmpty = "Nenhum embarque previsto para agora.";
           if (res.statusOperacao === "FORA_DE_HORARIO") {
               msgEmpty = "<b>Fora do Horário de Embarque.</b><br>Os autocarros só aparecem aqui minutos antes da hora de partida da sua rota.";
           } else if (res.statusOperacao === "SEM_FROTA") {
               msgEmpty = "Não há autocarros ativos associados à sua rota neste momento.";
           }
           if (containerLista) containerLista.innerHTML = `<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; color: #92400e; font-size: 12px; line-height: 1.4; text-align:left;">${msgEmpty}</div>`;
           return;
       }

       let html = `<p style="font-size: 11px; color: var(--text-sub); margin-bottom: 10px;">Selecione o seu autocarro para garantir lugar:</p>`;
       res.viagens.forEach(v => {
           const labelLota = v.vagasRestantes > 0 ? `<span style="color:var(--success); font-weight:bold;">${v.vagasRestantes} vagas</span>` : `<span style="color:var(--danger); font-weight:bold;">LOTADO</span>`;
           const btnDisable = v.vagasRestantes <= 0 ? "disabled" : "";
           const btnBg = v.vagasRestantes <= 0 ? "#ccc" : "var(--primary)";
           
           html += `
           <div style="background: var(--secondary); padding: 12px; border-radius: 8px; margin-bottom: 10px; text-align: left; border: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                 <strong style="font-size: 13px;">🚌 ${v.rota}</strong>
                 <span style="font-size: 11px; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; color: #3730a3;">${v.horario}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                 <span style="font-size: 11px;">Status: ${labelLota}</span>
                 <button ${btnDisable} onclick="confirmarEmbarque('${v.id}')" style="background: ${btnBg}; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">FAZER CHECK-IN</button>
              </div>
           </div>`;
       });
       
       if (containerLista) containerLista.innerHTML = html;

   } catch (e) {
       if (containerLista) containerLista.innerHTML = `<p style="font-size: 11px; color: var(--danger);">Não foi possível atualizar a logística.</p>`;
   }
}

async function confirmarEmbarque(idOnibus) {
    showToast("A processar lugar...", "loading");
    try {
        const res = await apiCall("realizarCheckInOnibus", { idOnibus: idOnibus, idEstudante: currentWalletId });
        
        if (res.sucesso) {
            showToast("Lugar Confirmado!", "success");
            onibusSelecionadoGPS = idOnibus; 
            document.getElementById('lista-viagens-container').classList.add('hidden');
            abrirPainelViagem(); 
        } else {
            showToast(res.erro || "Lotação atingida no momento do clique.", "error");
            verificarJanelasEmbarque(); 
        }
    } catch (e) {
        showToast("Erro ao processar reserva.", "error");
    }
}

function abrirPainelViagem() {
    const painelSucesso = document.getElementById('painel-viagem-ativa');
    if (!painelSucesso) return;
    
    painelSucesso.innerHTML = `
      <div style="background: var(--secondary); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
         <h3 style="color: var(--success); margin: 0 0 10px 0; font-size: 18px;">✅ Check-in Confirmado</h3>
         <p style="font-size: 12px; color: var(--text-sub); margin-bottom: 20px;">O seu lugar está garantido. Acompanhe a viagem no radar abaixo.</p>
         <div id="radar-dinamico-conteudo" style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div class="loader" style="margin: 0 auto; width: 20px; height: 20px; border-width: 2px;"></div>
            <p style="font-size: 11px; text-align: center; margin-top: 10px; color: #666;">A sincronizar radar...</p>
         </div>
      </div>
    `;
    painelSucesso.classList.remove('hidden');
    
    atualizarRadarDinamico(); 
    if (idIntervaloRadar) clearInterval(idIntervaloRadar);
    idIntervaloRadar = setInterval(atualizarRadarDinamico, 30000);
}

async function atualizarRadarDinamico() {
    if (!onibusSelecionadoGPS) return;
    const boxRadar = document.getElementById('radar-dinamico-conteudo');
    if (!boxRadar) return;

    try {
        const res = await apiCall("statusRadarOnibus", { idOnibus: onibusSelecionadoGPS, idEstudante: currentWalletId });
        
        if (res.isGuia) {
            boxRadar.innerHTML = `
                <div style="text-align:center;">
                   <div style="font-size: 40px; margin-bottom: 10px; animation: pulse 2s infinite;">📡</div>
                   <h4 style="color: var(--success); margin: 0 0 5px 0;">Transmissão Ativa</h4>
                   <p style="font-size: 11px; color: #666; margin-bottom: 15px;">O seu GPS está a guiar os seus colegas.</p>
                   <button onclick="abdicarSerGuia()" class="btn-solid" style="background: #ef4444; margin: 0; padding: 8px; font-size: 12px;">Parar Transmissão (Abdicar)</button>
                </div>
            `;
            if (!document.getElementById('radar-pulse-css')) {
               const style = document.createElement('style');
               style.id = 'radar-pulse-css';
               style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }`;
               document.head.appendChild(style);
            }
        } 
        else if (res.guiaAtivo && res.coordenadas) {
            boxRadar.innerHTML = `<div class="loader" style="margin: 0 auto; width: 15px; height: 15px; border-width: 2px;"></div><p style="font-size: 10px; text-align: center; margin-top: 5px;">A calcular ETA...</p>`;
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(posPassageiro) {
                        const distKm = calcularDistanciaHaversine(posPassageiro.coords.latitude, posPassageiro.coords.longitude, res.coordenadas.lat, res.coordenadas.lng);
                        const tempoAtras = calcularTempoRelativo(res.coordenadas.ts);
                        
                        boxRadar.innerHTML = `
                            <div style="text-align: left;">
                               <div style="display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
                                  <strong style="color: var(--primary);"><span style="font-size: 14px;">📍</span> Radar ao Vivo</strong>
                                  <span style="font-size: 10px; background: #ecfdf5; color: #065f46; padding: 3px 6px; border-radius: 4px;">Sinal Forte</span>
                               </div>
                               <div style="display:flex; justify-content: space-between; margin-bottom: 5px;">
                                  <span style="font-size: 12px; color: #666;">Distância:</span>
                                  <strong style="font-size: 12px;">${distKm.toFixed(1)} km</strong>
                               </div>
                               <div style="display:flex; justify-content: space-between; margin-bottom: 10px;">
                                  <span style="font-size: 12px; color: #666;">Chega em:</span>
                                  <strong style="font-size: 14px; color: var(--accent);">${calcularETA(distKm)}</strong>
                               </div>
                               <div style="text-align: right;">
                                  <span style="font-size: 10px; color: #999;">Última atualização: ${tempoAtras}</span>
                               </div>
                               <button onclick="atualizarRadarDinamico()" class="btn-text" style="width: 100%; text-align: center; padding: 8px 0 0 0; margin-top: 5px; font-size: 11px;">🔄 Atualizar Agora</button>
                            </div>
                        `;
                    },
                    function(err) {
                        const tempoAtras = calcularTempoRelativo(res.coordenadas.ts);
                        boxRadar.innerHTML = `
                            <div style="text-align: center;">
                               <h4 style="color: var(--primary); margin: 0 0 5px 0;">📍 Autocarro em Movimento</h4>
                               <p style="font-size: 11px; color: #666; margin-bottom: 10px;">Ative a localização do seu dispositivo para ver a distância e o tempo estimado de chegada (ETA).</p>
                               <span style="font-size: 10px; color: #999;">Último sinal do autocarro: ${tempoAtras}</span>
                            </div>
                        `;
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            }
        } 
        else {
            boxRadar.innerHTML = `
                <div style="text-align: center;">
                   <div style="font-size: 30px; margin-bottom: 10px; filter: grayscale(100%); opacity: 0.5;">📡</div>
                   <h4 style="color: #666; margin: 0 0 5px 0;">Radar Inativo</h4>
                   <p style="font-size: 11px; color: #999; margin-bottom: 15px;">Nenhum colega está a partilhar o GPS. Quer assumir o rastreamento?</p>
                   <button onclick="solicitarSerGuia()" class="btn-solid" style="background: var(--primary); margin: 0; padding: 8px; font-size: 12px;">Seja o Guia (Ligar GPS)</button>
                </div>
            `;
        }
    } catch(e) {
        console.warn("Falha silenciosa ao ler radar.");
    }
}

async function solicitarSerGuia() {
    showToast("A solicitar permissão ao servidor...", "loading");
    const boxRadar = document.getElementById('radar-dinamico-conteudo');
    if (boxRadar) boxRadar.innerHTML = `<div class="loader" style="margin: 0 auto;"></div>`;

    try {
        const res = await apiCall("solicitarCargoGuia", { idOnibus: onibusSelecionadoGPS, idEstudante: currentWalletId });
        if (res.sucesso) {
            iniciarTransmissaoGpsComoGuia(); 
        } else {
            showToast(res.erro, "warning");
            atualizarRadarDinamico(); 
        }
    } catch(e) {
        showToast("Erro ao contactar o servidor.", "error");
        atualizarRadarDinamico();
    }
}

async function iniciarTransmissaoGpsComoGuia() {
    if (!navigator.geolocation) {
        showToast("O seu telemóvel não suporta GPS.", "error");
        abdicarSerGuia();
        return;
    }

    try {
        if ('wakeLock' in navigator) {
            wakeLockAtivo = await navigator.wakeLock.request('screen');
        }
        
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                enviarCoordenadaSegura(pos.coords.latitude, pos.coords.longitude);
                
                if (idIntervaloGPS) clearInterval(idIntervaloGPS);
                idIntervaloGPS = setInterval(() => {
                    navigator.geolocation.getCurrentPosition(
                        p => enviarCoordenadaSegura(p.coords.latitude, p.coords.longitude),
                        e => console.warn("GPS falhou a leitura.")
                    );
                }, 120000);
                
                showToast("Transmissão iniciada! Você é o Guia.", "success");
                atualizarRadarDinamico(); 
            },
            function(err) {
                showToast("Permissão de GPS negada. Abdicando...", "error");
                abdicarSerGuia();
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
    } catch (err) {
        showToast("Não foi possível aceder aos sensores do ecrã.", "error");
        abdicarSerGuia();
    }
}

function enviarCoordenadaSegura(lat, lng) {
    if (!onibusSelecionadoGPS || !currentWalletId) return;
    
    apiCall("atualizarGPSOnibus", { 
        idOnibus: onibusSelecionadoGPS, 
        idEstudante: currentWalletId, 
        lat: lat, 
        lng: lng 
    }).then(res => {
        if (res && !res.sucesso) {
            console.log("Servidor rejeitou o GPS (Timeout ou Roubo): " + res.erro);
            pararTransmissaoGpsE_Radar();
            atualizarRadarDinamico(); 
        }
    }).catch(e => console.log("Falha silenciosa no ping GPS."));
}

async function abdicarSerGuia() {
    pararTransmissaoGpsE_Radar(false); 
    showToast("A libertar GPS...", "loading");
    try {
        await apiCall("abdicarCargoGuia", { idOnibus: onibusSelecionadoGPS, idEstudante: currentWalletId });
        showToast("Transmissão encerrada com segurança.", "info");
        atualizarRadarDinamico(); 
    } catch(e) {
        atualizarRadarDinamico();
    }
}

function pararTransmissaoGpsE_Radar(matarRadarTambem = true) {
    if (idIntervaloGPS) { clearInterval(idIntervaloGPS); idIntervaloGPS = null; }
    if (matarRadarTambem && idIntervaloRadar) { clearInterval(idIntervaloRadar); idIntervaloRadar = null; }
    if (wakeLockAtivo) { wakeLockAtivo.release().then(() => wakeLockAtivo = null); }
}


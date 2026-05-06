// ========================================================================
// 4. MESA DE AUDITORIA & GESTÃO DOCUMENTAL
// ========================================================================

let arrayAlunosAuditoria = [];
let paginaAtualAuditoria = 1;     // NOVO: Guarda a página atual
const ITENS_POR_PAGINA = 10;      // NOVO: Exibe 10 alunos por bloco

function formatarNomeProprio(nome) {
  if (!nome) return "Estudante";
  const preposicoes = ["da", "de", "do", "das", "dos", "e"];
  return nome.toString().toLowerCase().split(' ').map(function(palavra) {
    if (palavra === "") return "";
    if (preposicoes.indexOf(palavra) !== -1) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ').trim();
}

function abrirMesaAuditoria() {
    switchView('view-auditoria');
    carregarFilaAuditoria();
}

async function carregarFilaAuditoria(ehPesquisa = false) {
    const container = document.getElementById('auditoria-fila-container');
    const inputPesquisa = document.getElementById('auditoria-pesquisa').value.trim();
    const termo = ehPesquisa ? inputPesquisa : "";
    
    // Sempre que carregar a lista ou pesquisar, volta à página 1
    paginaAtualAuditoria = 1;
    
    container.innerHTML = '<div class="text-center" style="padding: 30px;"><div class="loader" style="margin: 0 auto;"></div><p style="font-size: 11px; margin-top: 10px;">A puxar a fila de trabalho...</p></div>';
    
    try {
        const res = await apiCall("getListaAuditoria", { pesquisa: termo });
        if (res.sucesso) {
            arrayAlunosAuditoria = res.lista;
            renderizarListaAuditoria();
        } else {
            container.innerHTML = `<div class="error-box">Erro: ${res.erro}</div>`;
        }
    } catch(e) {
        container.innerHTML = `<div class="error-box">Falha ao ligar à base de dados.</div>`;
    }
}

function renderizarListaAuditoria() {
    const container = document.getElementById('auditoria-fila-container');
    
    if (!arrayAlunosAuditoria || arrayAlunosAuditoria.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 30px; background: #fff; border: 1px dashed #ccc; border-radius: 8px;"><h3 style="color: var(--success); margin:0;">🎉 Fila Vazia!</h3><p style="font-size: 12px; color: #666;">Todos os pedidos foram atendidos.</p></div>`;
        return;
    }
    
    // Matemática da Paginação
    const totalPaginas = Math.ceil(arrayAlunosAuditoria.length / ITENS_POR_PAGINA);
    const inicio = (paginaAtualAuditoria - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const itensPagina = arrayAlunosAuditoria.slice(inicio, fim);
    
    let html = '';
    itensPagina.forEach(aluno => {
        let corBadge = '#333'; let bgBadge = '#f0f0f0';
        if (aluno.statusAuditoria === "ANALISE_HUMANA" || aluno.statusAuditoria === "PENDENCIA") { corBadge = '#d97706'; bgBadge = '#fef3c7'; }
        else if (aluno.statusAuditoria === "ALERTA_FRAUDE" || aluno.statusAtividade === "SUSPENSO") { corBadge = '#dc2626'; bgBadge = '#fee2e2'; }
        else if (aluno.statusAuditoria === "PENDENTE") { corBadge = '#4b5563'; bgBadge = '#f3f4f6'; }
        else if (aluno.statusAtividade === "ATIVO") { corBadge = '#059669'; bgBadge = '#d1fae5'; }
        
        let d = new Date(aluno.timestamp);
        let strData = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        if (isNaN(d.getTime()) || aluno.timestamp === 0) strData = "Sem data registada";

        const nomeTratado = formatarNomeProprio(aluno.nome);

        html += `
        <div class="auditoria-linha">
            <div class="auditoria-info">
                <h4 class="auditoria-nome">${nomeTratado}</h4>
                <span class="auditoria-data">Submetido: ${strData}</span>
                <span class="auditoria-badge" style="color: ${corBadge}; background: ${bgBadge}; margin-left: 0; display: inline-block; margin-top: 4px;">${aluno.statusAuditoria}</span>
            </div>
            <button class="btn-solid" style="width: auto; margin: 0; padding: 8px 12px; font-size: 11px;" onclick="abrirModalRaioX(${aluno.linhaBase})">Detalhar 🔍</button>
        </div>`;
    });
    
    // Rodapé de Paginação
    if (totalPaginas > 1) {
        const btnPrevDisabled = paginaAtualAuditoria === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : `onclick="mudarPaginaAuditoria(-1)"`;
        const btnNextDisabled = paginaAtualAuditoria === totalPaginas ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : `onclick="mudarPaginaAuditoria(1)"`;

        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding: 10px; background: var(--secondary); border-radius: 8px; border: 1px solid var(--border);">
            <button class="btn-solid dark-bg" style="width: auto; margin: 0; padding: 8px 15px;" ${btnPrevDisabled}>⬅ Ant.</button>
            <span style="font-size: 12px; font-weight: 600; color: var(--text-main);">Pág. ${paginaAtualAuditoria} de ${totalPaginas}</span>
            <button class="btn-solid dark-bg" style="width: auto; margin: 0; padding: 8px 15px;" ${btnNextDisabled}>Próx. ➡</button>
        </div>`;
    }
    
    container.innerHTML = html;
}

// NOVA FUNÇÃO: Acionada pelas setas de paginação
function mudarPaginaAuditoria(direcao) {
    paginaAtualAuditoria += direcao;
    renderizarListaAuditoria();
    // Faz scroll suave até ao topo da lista
    document.getElementById('view-auditoria').scrollIntoView({ behavior: 'smooth' });
}

function abrirModalRaioX(linhaBase) {
    const aluno = arrayAlunosAuditoria.find(a => a.linhaBase === linhaBase);
    if (!aluno) return;
    
    const nomeTratado = formatarNomeProprio(aluno.nome);

    document.getElementById('rx-nome').innerText = nomeTratado;
    document.getElementById('rx-cpf').innerText = aluno.cpf;
    document.getElementById('rx-matricula').innerText = aluno.matricula;
    document.getElementById('rx-email').innerText = aluno.email;
    document.getElementById('rx-logistica').innerText = `${aluno.instituicao} • ${aluno.turno}`;
    document.getElementById('rx-status-badge').innerText = aluno.statusAtividade;
    
    document.getElementById('rx-novo-status').value = aluno.statusAtividade;
    document.getElementById('rx-notas').value = aluno.observacoes;
    document.getElementById('rx-linha-base').value = linhaBase;
    
    let anexoHtml = '';
    const docsMapa = {
        'FOTO': '🖼️ Foto',
        'DOCUMENTO': '🪪 Doc. ID',
        'VINCULO': '🎓 Vínculo',
        'RESIDENCIA': '🏠 Morada',
        'ESTAGIO': '💼 Estágio'
    };
    
    for (const [chave, rotulo] of Object.entries(docsMapa)) {
        anexoHtml += `<button class="btn-chip-anexo" onclick="abrirDocumentoSeguro(${linhaBase}, '${chave}')">${rotulo}</button>`;
    }
    
    document.getElementById('rx-documentos-grid').innerHTML = anexoHtml;
    
    document.getElementById('modal-raio-x-aluno').classList.remove('hidden');
}

function fecharModalRaioX() {
    document.getElementById('modal-raio-x-aluno').classList.add('hidden');
}

async function abrirDocumentoSeguro(linhaBase, tipoDoc) {
    const docViewer = document.getElementById('modal-doc-viewer');
    const contentBox = document.getElementById('doc-viewer-content');
    
    document.getElementById('doc-viewer-title').innerText = "A descarregar: " + tipoDoc;
    contentBox.innerHTML = '<div class="loader"></div>';
    docViewer.classList.remove('hidden');
    
    try {
        const res = await apiCall("verFicheiroBase64", { linhaEstudante: linhaBase, tipoDocumento: tipoDoc });
        
        if (res.sucesso && res.base64) {
            document.getElementById('doc-viewer-title').innerText = tipoDoc;
            const fullBase64 = `data:${res.mimeType};base64,${res.base64}`;
            
            if (res.mimeType.includes("image")) {
                contentBox.innerHTML = `<img src="${fullBase64}" class="zoom-hover" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            } else if (res.mimeType.includes("pdf")) {
                contentBox.innerHTML = `<embed src="${fullBase64}" width="100%" height="100%" type="application/pdf">`;
            } else {
                contentBox.innerHTML = `<div class="error-box">Formato não suportado: ${res.mimeType}</div>`;
            }
        } else {
            contentBox.innerHTML = `<div class="error-box">Erro: ${res.erro}</div>`;
        }
    } catch(e) {
        contentBox.innerHTML = `<div class="error-box">Falha de rede. Tente novamente.</div>`;
    }
}

function fecharModalDocViewer() {
    document.getElementById('modal-doc-viewer').classList.add('hidden');
    document.getElementById('doc-viewer-content').innerHTML = ''; // Limpa memória Base64
}

async function gravarDecisaoAuditoria() {
    const linhaBase = document.getElementById('rx-linha-base').value;
    const novoStatus = document.getElementById('rx-novo-status').value;
    const notas = document.getElementById('rx-notas').value;
    
    showToast("A gravar e a notificar o estudante...", "loading");
    
    try {
        const res = await apiCall("atualizarStatusAluno", { linhaEstudante: parseInt(linhaBase), novoStatus: novoStatus, notasOperador: notas });
        if (res.sucesso) {
            showToast("Alteração guardada com sucesso!", "success");
            fecharModalRaioX();
            const alunoIndex = arrayAlunosAuditoria.findIndex(a => a.linhaBase === parseInt(linhaBase));
            if (alunoIndex !== -1) {
                arrayAlunosAuditoria[alunoIndex].statusAtividade = novoStatus;
                if (novoStatus === "ATIVO") arrayAlunosAuditoria[alunoIndex].statusAuditoria = "OK";
                renderizarListaAuditoria();
            }
        } else {
            showToast(res.erro || "Falha ao gravar.", "error");
        }
    } catch (e) {
        showToast("Erro na ligação ao servidor.", "error");
    }
}

async function acionarIAParaEmail() {
    const notasTexto = document.getElementById('rx-notas').value.trim();
    if (!notasTexto) {
        showToast("Escreva o motivo da retenção nas notas primeiro.", "error");
        return;
    }
    
    const linhaBase = parseInt(document.getElementById('rx-linha-base').value);
    const btnIa = document.querySelector("button[onclick='acionarIAParaEmail()']");
    btnIa.innerText = "A Redigir... ⏳";
    btnIa.disabled = true;
    
    try {
        const res = await apiCall("enviarParecerOperador", { linhaEstudante: linhaBase, textoRevisado: notasTexto });
        if (res.sucesso) {
            showToast("E-mail disparado para o estudante!", "success");
        } else {
            showToast(res.erro, "error");
        }
    } catch(e) {
        showToast("Falha ao comunicar com motor de E-mails.", "error");
    } finally {
        btnIa.innerText = "✨ Gerar E-mail IA";
        btnIa.disabled = false;
    }
}

document.addEventListener('keydown', (e) => {
    const modalRaioX = document.getElementById('modal-raio-x-aluno');
    if (!modalRaioX || modalRaioX.classList.contains('hidden')) return;

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toUpperCase();
    if (key === 'A') {
        e.preventDefault();
        document.getElementById('rx-novo-status').value = 'ATIVO';
        gravarDecisaoAuditoria();
    } else if (key === 'R') {
        e.preventDefault();
        document.getElementById('rx-novo-status').value = 'CANCELADO';
    } else if (key === 'P') {
        e.preventDefault();
        document.getElementById('rx-novo-status').value = 'PENDENTE';
    }
});

// ========================================================================
// 5. MÓDULO DO MODERADOR (SALA DAS MÁQUINAS V9.2.8)
// ========================================================================

async function abrirPainelModerador() {
    switchView('view-moderador');
    const loader = document.getElementById('loader-sincronizacao-motores');
    
    if (loader) loader.classList.remove('hidden');
    
    try {
        const res = await apiCall("getStatusMotores");
        if (res.sucesso && res.estados) {
            const toggleETL = document.getElementById('toggle-motor-etl');
            const toggleOCR = document.getElementById('toggle-motor-ocr');
            const toggleDOCS = document.getElementById('toggle-motor-docs');
            const toggleEMAIL = document.getElementById('toggle-motor-email');
            
            if (toggleETL) toggleETL.checked = res.estados.ETL;
            if (toggleOCR) toggleOCR.checked = res.estados.OCR;
            if (toggleDOCS) toggleDOCS.checked = res.estados.DOCS;
            if (toggleEMAIL) toggleEMAIL.checked = res.estados.EMAIL;
        }
    } catch (err) {
        showToast("Não foi possível ler o estado dos motores.", "error");
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

async function forcarMotor(motorId) {
    showToast(`A enviar sinal para o motor ${motorId}...`, "loading");
    try {
        const res = await apiCall("forcarExecucaoMotor", { motorId: motorId });
        if (res.sucesso) showToast(res.msg, "success");
        else showToast(res.erro, "error");
    } catch(e) {
        showToast("Ocorreu um erro ao acionar o motor.", "error");
    }
}

async function alterarMotor(motorId, isLigado) {
    showToast(`A alterar configurações de ${motorId}...`, "loading");
    try {
        const res = await apiCall("alterarEstadoMotor", { motorId: motorId, ligado: isLigado });
        if (res.sucesso) showToast(res.msg, "success");
        else showToast(res.erro, "error");
    } catch(e) {
        showToast("Ocorreu um erro ao alterar o motor.", "error");
    }
}


// ========================================================================
// 9. MODO FISCAL E ADMINISTRAÇÃO AVANÇADA (V9.2.4)
// ========================================================================
let html5QrcodeScanner = null;

function iniciarScanner() {
  document.getElementById('leitor-qr-container').classList.remove('hidden');
  document.getElementById('btn-scanner').classList.add('hidden');
  document.getElementById('btn-scanner-nativo').classList.add('hidden'); 
  
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(() => {});
  }

  html5QrcodeScanner = new Html5QrcodeScanner("leitor-qr", { fps: 10, qrbox: {width: 250, height: 250} }, false);
  html5QrcodeScanner.render(aoLerQRCode, (e) => {});
}

function fecharScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(() => {});
    html5QrcodeScanner = null;
  }
  document.getElementById('leitor-qr-container').classList.add('hidden');
  document.getElementById('btn-scanner').classList.remove('hidden');
  document.getElementById('btn-scanner-nativo').classList.remove('hidden'); 
}

function aoLerQRCode(textoLido) {
  fecharScanner();
  
  let idLimpo = textoLido;
  let sementeLida = null;
  
  if (textoLido.indexOf('|') !== -1) {
     const partes = textoLido.split('|');
     idLimpo = partes[0];
     sementeLida = partes[1];
  } else {
     let matchId = textoLido.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
     if (matchId) idLimpo = matchId[1];
  }
  
  const sementeFiscal = localStorage.getItem("MAESTRO_SEMENTE_FISCAL");
  
  if (sementeFiscal && sementeLida !== sementeFiscal) {
     document.getElementById('res-fiscal').innerHTML = `
        <div class="wallet-card dark" style="border-color: var(--danger);">
           <div class="wallet-header" style="background: var(--danger);">❌ ALERTA DE SEGURANÇA</div>
           <div class="wallet-body text-center" style="display:block; padding: 30px 20px;">
              <span style="font-size: 40px; display:block; margin-bottom: 10px;">⚠️</span>
              <strong style="color: var(--danger); font-size: 16px; display:block;">QR CODE EXPIRADO/INVÁLIDO</strong>
              <p style="font-size: 12px; color: #ccc; margin-top: 10px;">O código lido não corresponde ao dia de hoje. Peça ao estudante para fechar a App, ligar a internet e abrir novamente a Carteira Digital.</p>
           </div>
        </div>`;
     return;
  }
  
  document.getElementById('id-fiscal').value = idLimpo;
  validarFiscal();
}

async function lerQRCodePorFoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast("A processar imagem...", "loading");
  document.getElementById('btn-scanner-nativo').innerHTML = `⏳ A LER...`;

  const html5QrCode = new Html5Qrcode("leitor-qr"); 

  try {
      const textoLido = await html5QrCode.scanFile(file, true);
      document.getElementById('btn-scanner-nativo').innerHTML = `<span style="font-size: 20px;">📱</span> USAR CÂMARA NATIVA`;
      aoLerQRCode(textoLido);
  } catch (err) {
      showToast("QR Code não detetado.", "error");
      document.getElementById('btn-scanner-nativo').innerHTML = `<span style="font-size: 20px;">📱</span> USAR CÂMARA NATIVA`;
  }
    
  event.target.value = '';
}

function fecharModoFiscalizacao() {
  fecharScanner();
  switchView('view-admin-hub');
}

async function validarFiscal() {
  const idCarteira = document.getElementById('id-fiscal').value.trim().toUpperCase();
  if (!idCarteira) return;

  const btn = document.getElementById('btn-fiscal');
  const resBox = document.getElementById('res-fiscal');
  
  btn.innerText = "A VERIFICAR...";
  btn.disabled = true;
  resBox.innerHTML = "";

  let alunoBase = null;
  const cacheListRaw = localStorage.getItem(CACHE_LISTA_KEY);
  if (cacheListRaw) {
    const cacheList = JSON.parse(cacheListRaw);
    alunoBase = cacheList.find(a => a.id === idCarteira);
  }

  if (alunoBase) {
     resBox.innerHTML = gerarHtmlFiscal(alunoBase.nome, "A carregar...", "...", "...", `<div class="wallet-photo skeleton-box"></div>`, alunoBase.status, "");
  } else {
     resBox.innerHTML = `<div class="text-center text-light" style="margin-top: 20px;">A pesquisar na base de dados online... ⏳</div>`;
  }

  try {
    const res = await apiCall("consultarEstudantePorId", { idEstudante: idCarteira });
    
    if (!res.encontrado) {
       tocarBeep('error');
       resBox.innerHTML = `<div class="error-box">❌ ID INVÁLIDO OU NÃO ENCONTRADO</div>`;
    } else {
        if (res.statusAtividade === 'ATIVO') tocarBeep('success');
        else tocarBeep('error');
        resBox.innerHTML = gerarHtmlFiscal(res.nome, res.instituicao, res.rota, res.turno, `<div class="wallet-photo skeleton-box"></div>`, res.statusAtividade, res.obsCompleta);
        
        try {
            const resFoto = await apiCall("getFotoEstudanteBase64", { idEstudante: idCarteira });
            const imgHtml = resFoto.fotoBase64 ? `<img src="${resFoto.fotoBase64}" class="wallet-photo">` : `<div class="wallet-photo" style="display:flex;align-items:center;justify-content:center;color:#666; background:#222; border-color:#333;">Sem Foto</div>`;
            resBox.innerHTML = gerarHtmlFiscal(res.nome, res.instituicao, res.rota, res.turno, imgHtml, res.statusAtividade, res.obsCompleta);
            if (res.statusAtividade === "ATIVO") iniciarRelogioAntiPrint('fiscal-clock');
        } catch (errFoto) {
            // Silencioso, falha da foto não impede a validação
        }
    }

  } catch(err) {
    showToast("Erro de conexão com o servidor.", "error");
  } finally {
    btn.innerText = "VERIFICAR ESTUDANTE";
    btn.disabled = false;
  }
}

function tocarBeep(tipo) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (tipo === 'success') {
      osc.frequency.value = 800;
      osc.type = 'sine';
    } else {
      osc.frequency.value = 300;
      osc.type = 'sawtooth';
    }
    
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn("Áudio não suportado", e);
  }
}

function extrairTextoDaTag(textoBruto, tag) {
    if (!textoBruto) return "";
    const regex = new RegExp("<" + tag + ">([\\s\\S]*?)<\\/" + tag + ">", "i");
    const match = textoBruto.match(regex);
    return match ? match[1].trim() : "";
}

function gerarHtmlFiscal(nome, inst, rota, turno, fotoComponente, statusReal, obsCompleta) {
    let statusBadge = "";
    let relogioAntiPrint = "";
    let caixaMotivo = "";
    const nomeTratado = formatarNomeProprio(nome);
    
    if (statusReal !== "ATIVO" && obsCompleta) {
        let motivoFiscal = extrairTextoDaTag(obsCompleta, "textofiscal");
        
        if (!motivoFiscal) {
            let linhas = obsCompleta.trim().split('\n');
            motivoFiscal = linhas.length > 0 ? linhas[linhas.length - 1] : "Motivo não especificado. Consulte o sistema central.";
        }
        
        let corFundo = statusReal === "SUSPENSO" || statusReal === "CANCELADO" ? "#451a1a" : "#452a0a";
        let corBorda = statusReal === "SUSPENSO" || statusReal === "CANCELADO" ? "#ef4444" : "#f59e0b";
        
        caixaMotivo = `
        <div style="background: ${corFundo}; border-left: 4px solid ${corBorda}; padding: 12px; margin-top: 15px; border-radius: 4px;">
            <strong style="color: ${corBorda}; font-size: 11px; display: block; margin-bottom: 5px; text-transform: uppercase;">ℹ️ Nota para o Fiscal:</strong>
            <p style="color: #eee; font-size: 12px; line-height: 1.4; margin: 0;">${motivoFiscal.replace(/\n/g, '<br>')}</p>
        </div>`;
    }
    
    if (statusReal === "ATIVO") {
      statusBadge = `<div style="background:var(--success); color:white; padding:10px; border-radius:6px; text-align:center; font-weight:700; letter-spacing:1px; margin-bottom:10px;">✅ LIBERADO</div>`;
      relogioAntiPrint = `<div class="anti-print-bar" id="fiscal-clock" style="margin-top:0;"></div>`;
    } else if (statusReal === "CANCELADO") {
      statusBadge = `<div style="background:var(--danger); color:white; padding:10px; border-radius:6px; text-align:center; font-weight:700; letter-spacing:1px;">❌ CANCELADO</div>`;
    } else if (statusReal === "SUSPENSO") {
      statusBadge = `<div style="background:#F97316; color:white; padding:10px; border-radius:6px; text-align:center; font-weight:700; letter-spacing:1px;">⚠️ SUSPENSO</div>`;
    } else {
      statusBadge = `<div style="background:#FBBF24; color:#333; padding:10px; border-radius:6px; text-align:center; font-weight:700; letter-spacing:1px;">⏳ PENDENTE</div>`;
    }

    return `
    <div class="wallet-card dark">
      <div class="wallet-header">FISCALIZAÇÃO DE IDENTIDADE</div>
      <div class="wallet-body">
        ${fotoComponente}
        <div class="wallet-info">
          <div class="w-group"><span>Estudante</span><span class="highlight">${nomeTratado}</span></div>
          <div class="w-group"><span>Instituição</span><span>${inst}</span></div>
          <div class="w-group"><span>Rota / Turno</span><span style="color:var(--accent); font-weight:700;">${rota} • ${turno}</span></div>
        </div>
      </div>
      ${caixaMotivo}
      <div class="wallet-footer" style="margin-top: 15px;">${statusBadge}${relogioAntiPrint}</div>
    </div>`;
}

// ------------------------------------------------------------------------
// NOVO: Funções de Encerramento Manual de Rota (V9.2.2)
// ------------------------------------------------------------------------
function abrirModalEncerrarRota() {
    document.getElementById('modal-encerrar-rota').classList.remove('hidden');
    document.getElementById('input-encerrar-onibus').value = '';
}

function fecharModalEncerrarRota() {
    document.getElementById('modal-encerrar-rota').classList.add('hidden');
    const btn = document.getElementById('btn-enviar-encerramento');
    btn.innerHTML = 'CONFIRMAR FIM DE ROTA';
    btn.disabled = false;
}

async function dispararEncerramentoRota() {
    const idBus = document.getElementById('input-encerrar-onibus').value.trim().toUpperCase();
    const btn = document.getElementById('btn-enviar-encerramento');
    
    if (!idBus) {
        showToast("Digite o identificador do autocarro.", "error");
        return;
    }
    
    btn.innerHTML = 'A PROCESSAR DESEMBARQUE... ⏳';
    btn.disabled = true;
    
    try {
        const res = await apiCall("encerrarRotaManual", { idOnibus: idBus });
        if (res.sucesso) {
            showToast(res.msg, "success");
            fecharModalEncerrarRota();
        } else {
            showToast(res.erro || "Falha ao encerrar a rota.", "error");
        }
    } catch(e) {
        showToast("Erro de ligação com a base de dados.", "error");
    } finally {
        if (!document.getElementById('modal-encerrar-rota').classList.contains('hidden')) {
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    }
}

// ========================================================================
// 10. MOTOR DE CRISES E AVISOS PUSH (V9.2.5)
// ========================================================================
function abrirModalSOS() {
    document.getElementById('modal-sos-fiscal').classList.remove('hidden');
    document.getElementById('sos-id-onibus').value = '';
    document.getElementById('sos-motivo').value = '';
}

function fecharModalSOS() {
    document.getElementById('modal-sos-fiscal').classList.add('hidden');
    const btn = document.getElementById('btn-enviar-sos');
    btn.innerHTML = 'ENVIAR ALARME E MEU GPS';
    btn.disabled = false;
}

function confirmarEmergenciaGPS() {
    const idBus = document.getElementById('sos-id-onibus').value.trim().toUpperCase();
    const motivo = document.getElementById('sos-motivo').value;
    const btn = document.getElementById('btn-enviar-sos');
    
    if (!idBus || !motivo) {
        showToast("Preencha a Placa/Rota e selecione o motivo.", "error");
        return;
    }
    
    btn.innerHTML = 'A OBTER GPS E NOTIFICAR ALUNOS... ⏳';
    btn.disabled = true;
    
    if (!navigator.geolocation) {
        enviarAlarmeCriseAPI(idBus, motivo, "GPS Indisponível no Dispositivo");
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const coord = `${pos.coords.latitude}, ${pos.coords.longitude}`;
            enviarAlarmeCriseAPI(idBus, motivo, coord);
        },
        function(err) {
            enviarAlarmeCriseAPI(idBus, motivo, "GPS Recusado ou Falhou");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

async function enviarAlarmeCriseAPI(idBus, motivo, coords) {
    const btn = document.getElementById('btn-enviar-sos');
    
    try {
        const res = await apiCall("declararEmergenciaOnibus", { idRotaPlaca: idBus, tipoAvaria: motivo, coordenadasGps: coords });
        if (res.sucesso) {
            showToast("Emergência reportada! Alunos da rota avisados via Push.", "success");
            fecharModalSOS();
        } else {
            showToast(res.erro || "Falha ao gravar emergência.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Erro de ligação com o servidor Maestro.", "error");
        btn.innerHTML = 'TENTAR NOVAMENTE';
        btn.disabled = false;
    }
}

function abrirModalMural() {
    document.getElementById('modal-nova-mensagem').classList.remove('hidden');
    document.getElementById('mural-mensagem').value = '';
}

function fecharModalMural() {
    document.getElementById('modal-nova-mensagem').classList.add('hidden');
    const btn = document.getElementById('btn-enviar-mural');
    btn.innerHTML = 'PUBLICAR NO MURAL';
    btn.disabled = false;
}

async function enviarMensagemParaMural() {
    const categoria = document.getElementById('mural-categoria').value;
    const mensagem = document.getElementById('mural-mensagem').value.trim();
    const btn = document.getElementById('btn-enviar-mural');
    
    if (mensagem.length < 10) { showToast("A mensagem é muito curta.", "error"); return; }
    
    btn.innerHTML = 'A VALIDAR QUOTA... ⏳';
    btn.disabled = true;

    try {
        setTimeout(() => { 
            if (btn.disabled) btn.innerHTML = 'A AUDITAR CONTEÚDO... 🤖'; 
        }, 1500);

        const res = await apiCall("publicarMensagemMural", { idEstudante: currentWalletId, nomeEstudante: currentStudentName, categoria: categoria, mensagem: mensagem });
        
        if (res.sucesso) {
            showToast(res.msg || "Mensagem aprovada e partilhada!", "success");
            fecharModalMural();
            abrirMuralDaSemana(); 
        } else {
            showToast(res.erro || "Falha ao submeter.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Erro de comunicação com o servidor.", "error");
        btn.innerHTML = 'TENTAR NOVAMENTE';
        btn.disabled = false;
    }
}

// ------------------------------------------------------------------------
// V9.2.5: NOVO MOTOR DE AVISOS PUSH DO FISCAL
// ------------------------------------------------------------------------
function abrirModalAvisosFiscal() {
    document.getElementById('modal-novo-aviso-fiscal').classList.remove('hidden');
    
    // Reseta os campos
    document.getElementById('aviso-titulo-mural').value = '';
    document.getElementById('aviso-msg-mural').value = '';
    document.getElementById('aviso-titulo-direto').value = '';
    document.getElementById('aviso-msg-direto').value = '';
    
    alternarTipoAviso('mural');
    carregarFiltrosParaPush();
}

function fecharModalAvisosFiscal() {
    document.getElementById('modal-novo-aviso-fiscal').classList.add('hidden');
}

function alternarTipoAviso(tipo) {
    const tabMural = document.getElementById('tab-aviso-mural');
    const tabDireto = document.getElementById('tab-aviso-direto');
    const areaMural = document.getElementById('area-aviso-mural');
    const areaDireto = document.getElementById('area-aviso-direto');
    
    if (tipo === 'mural') {
        tabMural.classList.add('active');
        tabDireto.classList.remove('active');
        areaMural.classList.remove('hidden');
        areaDireto.classList.add('hidden');
    } else {
        tabMural.classList.remove('active');
        tabDireto.classList.add('active');
        areaMural.classList.add('hidden');
        areaDireto.classList.remove('hidden');
    }
}

async function carregarFiltrosParaPush() {
    const selectRota = document.getElementById('filtro-rota-push');
    const selectTurno = document.getElementById('filtro-turno-push');
    const selectInst = document.getElementById('filtro-inst-push');
    
    try {
        const res = await apiCall("getFiltrosPush");
        if (res.sucesso && res.filtros) {
            let htmlRota = '<option value="TODAS">Qualquer Rota</option>';
            res.filtros.rotas.forEach(r => htmlRota += `<option value="${r}">${r}</option>`);
            selectRota.innerHTML = htmlRota;
            
            let htmlTurno = '<option value="TODOS">Qualquer Turno</option>';
            res.filtros.turnos.forEach(t => htmlTurno += `<option value="${t}">${t}</option>`);
            selectTurno.innerHTML = htmlTurno;
            
            let htmlInst = '<option value="TODAS">Qualquer Instituição</option>';
            res.filtros.instituicoes.forEach(i => htmlInst += `<option value="${i}">${i}</option>`);
            selectInst.innerHTML = htmlInst;
        }
    } catch(e) {
        // Silencioso
    }
}

async function dispararAvisoPublico() {
    const tipo = document.getElementById('aviso-tipo-mural').value;
    const titulo = document.getElementById('aviso-titulo-mural').value.trim();
    const mensagem = document.getElementById('aviso-msg-mural').value.trim();
    const btn = document.getElementById('btn-publicar-aviso');
    
    if (!titulo || !mensagem) {
        showToast("Preencha o título e a mensagem.", "error");
        return;
    }
    
    btn.innerHTML = 'A COMUNICAR COM FIREBASE... ⏳';
    btn.disabled = true;
    
    try {
        const res = await apiCall("publicarAvisoNotificacao", {
            tipoAviso: tipo,
            titulo: titulo,
            mensagem: mensagem
        });
        
        if (res.sucesso) {
            showToast("Aviso afixado e alunos notificados!", "success");
            fecharModalAvisosFiscal();
        } else {
            showToast(res.erro || "Falha ao publicar.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Erro na comunicação.", "error");
        btn.innerHTML = 'TENTAR NOVAMENTE';
        btn.disabled = false;
    }
}

async function dispararPushSegmentado() {
    const rota = document.getElementById('filtro-rota-push').value;
    const turno = document.getElementById('filtro-turno-push').value;
    const inst = document.getElementById('filtro-inst-push').value;
    const titulo = document.getElementById('aviso-titulo-direto').value.trim();
    const mensagem = document.getElementById('aviso-msg-direto').value.trim();
    const btn = document.getElementById('btn-disparar-direto');
    
    if (!titulo || !mensagem) {
        showToast("Preencha o título e a mensagem.", "error");
        return;
    }
    
    btn.innerHTML = 'A DISPARAR LOTE... ⏳';
    btn.disabled = true;
    
    try {
        const res = await apiCall("dispararPushLoteManual", {
            titulo: titulo,
            mensagem: mensagem,
            rota: rota,
            turno: turno,
            instituicao: inst
        });
        
        if (res.sucesso) {
            showToast(`Lote enviado para ${res.enviados} dispositivos.`, "success");
            fecharModalAvisosFiscal();
        } else {
            showToast(res.erro || "Nenhum aluno encontrado neste filtro.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Erro no disparo em lote.", "error");
        btn.innerHTML = 'TENTAR NOVAMENTE';
        btn.disabled = false;
    }
}

function calcularTempoRelativo(tsServidor) {
    const agoraLocal = new Date().getTime();
    const diffEmMinutos = Math.floor((agoraLocal - tsServidor) / 60000);
    if (diffEmMinutos <= 0) return "Agora mesmo";
    if (diffEmMinutos < 60) return diffEmMinutos + (diffEmMinutos === 1 ? " min atrás" : " mins atrás");
    const horas = Math.floor(diffEmMinutos / 60);
    if (horas < 24) return horas + (horas === 1 ? " hora atrás" : " horas atrás");
    const dias = Math.floor(horas / 24);
    return dias + (dias === 1 ? " dia atrás" : " dias atrás");
}

async function abrirMuralDaSemana() {
    switchView('view-mural');
    const container = document.getElementById('mural-feed');
    
    let btnNovoPostHTML = '';
    if (currentWalletId && localStorage.getItem("MAESTRO_EST_TOKEN")) {
        btnNovoPostHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
           <button class="btn-solid" style="background: var(--primary); display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: auto; padding: 10px 20px;" onclick="abrirModalMural()">
              <span style="font-size: 16px;">📝</span> Criar Nova Publicação
           </button>
        </div>`;
    } else {
        btnNovoPostHTML = `<div style="text-align: center; margin-bottom: 20px; font-size: 11px; color: var(--text-sub);">Apenas estudantes logados na Carteira Digital podem publicar ou votar.</div>`;
    }
    
    container.innerHTML = `${btnNovoPostHTML}<div class="loader" style="margin: 0 auto;"></div><p style="text-align: center; font-size: 12px; margin-top: 10px;">A carregar a voz da comunidade...</p>`;
    
    try {
        const res = await apiCall("getMuralDaSemana");
        if (!res.sucesso) { container.innerHTML = `${btnNovoPostHTML}<div class="error-box">${res.erro}</div>`; return; }
        if (!res.mensagens || res.mensagens.length === 0) {
            container.innerHTML = `${btnNovoPostHTML}<div class="text-center" style="padding: 30px 10px; color: var(--text-sub); border: 1px dashed var(--border); border-radius: 8px;">Ainda não há contribuições nos últimos 7 dias.<br><br><b>Seja o primeiro a partilhar uma ideia!</b></div>`;
            return;
        }
        
        let html = btnNovoPostHTML;
        res.mensagens.forEach((msg, index) => {
            const upAtivo = currentWalletId && msg.arrayUpsInfo.includes(currentWalletId) ? 'color: var(--primary); font-weight: bold;' : 'color: #999;';
            const downAtivo = currentWalletId && msg.arrayDownsInfo.includes(currentWalletId) ? 'color: var(--danger); font-weight: bold;' : 'color: #999;';
            const coroa = index === 0 && msg.pontuacao > 0 ? '👑 Top Semanal' : '';
            const tempoCorrigido = calcularTempoRelativo(msg.tsMensagem);
            
            let iconCat = '🗣️';
            if (msg.categoria.indexOf('Sugestão') !== -1) iconCat = '💡';
            if (msg.categoria.indexOf('Reclamação') !== -1) iconCat = '⚠️';
            if (msg.categoria.indexOf('Achados') !== -1) iconCat = '🎒';
            
            html += `
            <div class="form-card" style="padding: 15px; margin-bottom: 15px; border-left: 4px solid var(--primary); border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: left;">
               <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                  <div>
                     <span style="font-size: 10px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; color: var(--text-sub);">${iconCat} ${msg.categoria}</span>
                     ${coroa ? `<span style="font-size: 10px; background: #fef08a; padding: 2px 6px; border-radius: 4px; color: #854d0e; font-weight: bold; margin-left: 5px;">${coroa}</span>` : ''}
                  </div>
                  <span style="font-size: 10px; color: var(--text-sub);">${tempoCorrigido}</span>
               </div>
               <p style="font-size: 13px; color: #333; line-height: 1.5; margin-bottom: 12px; word-wrap: break-word;">"${msg.mensagem}"</p>
               <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 10px;">
                  <span style="font-size: 11px; color: var(--text-sub); font-weight: 500;">👤 Por: ${msg.autor}</span>
                  <div style="display: flex; gap: 15px; align-items: center;">
                     <button onclick="votarNoMural('${msg.id}', 'UP')" style="background: none; border: none; font-size: 16px; cursor: pointer; ${upAtivo} transition: transform 0.1s;">👍 <span id="count-up-${msg.id}" style="font-size: 12px;">${msg.votosUp}</span></button>
                     <button onclick="votarNoMural('${msg.id}', 'DOWN')" style="background: none; border: none; font-size: 16px; cursor: pointer; ${downAtivo} transition: transform 0.1s;">👎 <span id="count-down-${msg.id}" style="font-size: 12px;">${msg.votosDown}</span></button>
                  </div>
               </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<div class="error-box">Erro ao comunicar com o servidor do Mural.</div>`;
    }
}

async function votarNoMural(idMensagem, tipoVoto) {
    if (!currentWalletId || !localStorage.getItem("MAESTRO_EST_TOKEN")) {
        showToast("É necessário aceder ao Cofre Digital para votar.", "warning");
        return;
    }
    
    const btnUp = document.getElementById(`count-up-${idMensagem}`).parentNode;
    const btnDown = document.getElementById(`count-down-${idMensagem}`).parentNode;
    
    if (btnUp) { btnUp.style.pointerEvents = 'none'; btnUp.style.opacity = '0.5'; }
    if (btnDown) { btnDown.style.pointerEvents = 'none'; btnDown.style.opacity = '0.5'; }
    
    try {
        const res = await apiCall("votarMensagemMural", { idEstudante: currentWalletId, idMensagem: idMensagem, tipoVoto: tipoVoto });
        if (res.sucesso) {
            setTimeout(abrirMuralDaSemana, 1000);
        } else {
            showToast(res.erro || "O seu voto não pôde ser contabilizado.", "error");
            if (btnUp) { btnUp.style.pointerEvents = 'auto'; btnUp.style.opacity = '1'; }
            if (btnDown) { btnDown.style.pointerEvents = 'auto'; btnDown.style.opacity = '1'; }
        }
    } catch (e) {
        if (btnUp) { btnUp.style.pointerEvents = 'auto'; btnUp.style.opacity = '1'; }
        if (btnDown) { btnDown.style.pointerEvents = 'auto'; btnDown.style.opacity = '1'; }
    }
}

// ========================================================================
// 11. MOTOR DO DASHBOARD ANALÍTICO E BI
// ========================================================================
let myCharts = {}; 

function mudarAbaDashboard(aba) {
  ['logistica', 'noturno', 'inclusao', 'analise'].forEach(t => {
    document.getElementById('tab-' + t).classList.remove('active');
    document.getElementById('dash-area-' + t).classList.add('hidden');
  });
  document.getElementById('tab-' + aba).classList.add('active');
  document.getElementById('dash-area-' + aba).classList.remove('hidden');
  
  if (aba === 'analise') {
     renderizarDashboardBI(); 
  }
}

async function carregarDashboard() {
  const cachedStatsRaw = localStorage.getItem(CACHE_STATS_KEY);
  
  if (cachedStatsRaw) {
    const st = JSON.parse(cachedStatsRaw);
    window.dadosBI = st.dataMart || []; 
    renderizarDashboardUI(st);
    switchView('view-dashboard');
    gerarChipsDinamicos(); 
    
    apiCall("getDashboardStats").then(res => {
        if (res.sucesso) {
            localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(res.stats));
            window.dadosBI = res.stats.dataMart || [];
            renderizarDashboardUI(res.stats); 
            gerarChipsDinamicos(); 
            if (document.getElementById('tab-analise').classList.contains('active')) renderizarDashboardBI();
        }
    }).catch(e => {
        // Silencioso
    });
  } else {
    showToast("A extrair dados para o Dashboard...", "info");
    try {
      const res = await apiCall("getDashboardStats");
      if (!res.sucesso) return;
      localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(res.stats));
      window.dadosBI = res.stats.dataMart || [];
      renderizarDashboardUI(res.stats);
      switchView('view-dashboard');
      gerarChipsDinamicos();
    } catch(err) {
      showToast("Falha de conexão com os dados analíticos.", "error");
    }
  }
}

function renderizarDashboardUI(stats) {
  document.getElementById('kpi-ativos').innerText = stats.kpis.ativos;
  document.getElementById('kpi-pendentes').innerText = stats.kpis.pendentes;
  document.getElementById('kpi-retidos').innerText = stats.kpis.retidos;
  document.getElementById('kpi-suspensos').innerText = stats.kpis.suspensos;

  const ocrUsado = stats.consumo?.ocr?.usado || 0;
  const ocrLimite = stats.consumo?.ocr?.limite || 100;
  const pctIA = Math.round((ocrUsado / ocrLimite) * 100);
  
  const barraIA = document.getElementById('bar-ia-usage');
  if (document.getElementById('kpi-ia-text')) {
      document.getElementById('kpi-ia-text').innerText = `${ocrUsado} / ${ocrLimite}`;
      barraIA.style.width = Math.min(pctIA, 100) + "%";
      barraIA.style.background = pctIA > 80 ? "var(--danger)" : "var(--accent)";
  }

  desenharGraficos(stats.graficos);
}

const mapaDias = {
    "segunda": "Seg", "seg": "Seg",
    "terça": "Ter", "terca": "Ter", "ter": "Ter",
    "quarta": "Qua", "qua": "Qua",
    "quinta": "Qui", "qui": "Qui",
    "sexta": "Sex", "sex": "Sex",
    "sábado": "Sáb", "sabado": "Sáb", "sab": "Sáb", "sáb": "Sáb"
};

function normalizarDia(texto) {
    let t = texto.toLowerCase().trim();
    for (let chave in mapaDias) {
        if (t.includes(chave)) return mapaDias[chave];
    }
    return texto.trim(); 
}

function gerarChipsDinamicos() {
    if (!window.dadosBI || window.dadosBI.length === 0) return;

    let instituicoes = new Set();
    let turnos = new Set();
    let dias = new Set();

    window.dadosBI.forEach(aluno => {
        if(aluno.i) aluno.i.split(',').forEach(v => { if(v.trim()) instituicoes.add(v.trim()); });
        if(aluno.t) aluno.t.split(',').forEach(v => { if(v.trim()) turnos.add(v.trim()); });
        if(aluno.d) {
            aluno.d.split(',').forEach(v => {
                let diaLimpo = normalizarDia(v);
                if(diaLimpo) dias.add(diaLimpo);
            });
        }
    });

    const criarHTMLChips = (setValores, grupoNome) => {
        let html = '';
        Array.from(setValores).sort().forEach(val => {
            const chipAntigo = document.querySelector(`span.chip-filter[data-value="${val}"][data-group="${grupoNome}"]`);
            const classeAtiva = (chipAntigo && chipAntigo.classList.contains('chip-active')) ? 'chip-active' : '';
            html += `<span class="chip-filter ${classeAtiva}" data-group="${grupoNome}" data-value="${val}" onclick="toggleChip(this)">${val}</span>`;
        });
        return html;
    };

    const contInst = document.getElementById('container-chips-inst');
    if(contInst) contInst.innerHTML = criarHTMLChips(instituicoes, "bi_inst");

    const contTurno = document.getElementById('container-chips-turno');
    if(contTurno) contTurno.innerHTML = criarHTMLChips(turnos, "bi_turno");

    const contDia = document.getElementById('container-chips-dia');
    if(contDia) contDia.innerHTML = criarHTMLChips(dias, "bi_dia");
}

function toggleChip(element) {
    element.classList.toggle('chip-active');
    renderizarDashboardBI();
}

function renderizarDashboardBI() {
    if (!window.dadosBI || window.dadosBI.length === 0) return;
    
    const getActiveChips = (name) => Array.from(document.querySelectorAll(`span.chip-filter[data-group="${name}"].chip-active`)).map(el => el.getAttribute('data-value'));
    
    const fInst = getActiveChips("bi_inst");
    const fTurno = getActiveChips("bi_turno");
    const fDia = getActiveChips("bi_dia");
    const eixoX = document.getElementById("bi_eixo_x") ? document.getElementById("bi_eixo_x").value : "i";
    
    let dadosFiltrados = window.dadosBI.filter(aluno => {
        let passaInst = fInst.length === 0 || fInst.some(i => (aluno.i || "").includes(i));
        let passaTurno = fTurno.length === 0 || fTurno.some(t => (aluno.t || "").includes(t));
        
        let passaDia = fDia.length === 0;
        if (!passaDia && aluno.d) {
             let diasDoAlunoNormalizados = aluno.d.split(',').map(d => normalizarDia(d));
             passaDia = fDia.some(diaEscolhido => diasDoAlunoNormalizados.includes(diaEscolhido));
        }
        
        return passaInst && passaTurno && passaDia;
    });
    
    document.getElementById("bi_total").innerText = dadosFiltrados.length;
    
    let contagemGrafico = {};
    dadosFiltrados.forEach(aluno => {
        let stringBruta = aluno[eixoX] || "Sem Registo";
        let partes = stringBruta.split(',').map(p => p.trim()).filter(p => p !== "");
        
        if (partes.length === 0) {
             contagemGrafico["Sem Registo"] = (contagemGrafico["Sem Registo"] || 0) + 1;
        } else {
             partes.forEach(parte => {
                 let chaveFinal = (eixoX === 'd') ? normalizarDia(parte) : parte;
                 contagemGrafico[chaveFinal] = (contagemGrafico[chaveFinal] || 0) + 1;
             });
        }
    });
    
    const dadosOrdenados = extrairEOrdenar(contagemGrafico);
    renderChart('chart-bi', 'bar', dadosOrdenados.labels, dadosOrdenados.data, '#F59E0B', { indexAxis: 'x' });
}

function renderChart(canvasId, type, labels, data, colors, options = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (myCharts[canvasId]) {
      myCharts[canvasId].destroy();
  }
  
  Chart.defaults.color = '#aaaaaa';
  Chart.defaults.borderColor = '#333333';

  const defaultOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
  myCharts[canvasId] = new Chart(ctx, { type: type, data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderRadius: (type === 'bar' ? 4 : 0), borderWidth: 0 }] }, options: Object.assign(defaultOptions, options) });
}

function extrairEOrdenar(obj) {
  const arr = Object.keys(obj).map(key => ({ label: key, value: obj[key] }));
  arr.sort((a, b) => b.value - a.value);
  return { labels: arr.map(item => item.label), data: arr.map(item => item.value) };
}

function desenharGraficos(graficos) {
  const baseColor = '#3B82F6'; 
  const st = graficos.status;
  renderChart('chart-status', 'doughnut', ["Ativos", "Pendentes", "Retidos (Humana)", "Cancelados/Suspensos"], [st["Ativos"]||0, st["Pendentes"]||0, st["Retidos (Humana)"]||0, st["Cancelados/Suspensos"]||0], ['#10B981', '#FBBF24', '#F97316', '#EF4444'], { plugins: { legend: { display: true, position: 'right', labels: {color: '#ddd', boxWidth: 12} } } });
  const inst = extrairEOrdenar(graficos.instituicoes); renderChart('chart-instituicoes', 'bar', inst.labels, inst.data, baseColor, { indexAxis: 'y' });
  const dias = extrairEOrdenar(graficos.dias); renderChart('chart-dias', 'bar', dias.labels, dias.data, baseColor, { indexAxis: 'y' });
  const rotas = extrairEOrdenar(graficos.rotas); renderChart('chart-rotas', 'bar', rotas.labels, rotas.data, baseColor, { indexAxis: 'y' });
  const turnos = extrairEOrdenar(graficos.turnos); renderChart('chart-turnos', 'bar', turnos.labels, turnos.data, baseColor); 

  if(graficos.noturno) {
    const adesao = extrairEOrdenar(graficos.noturno.adesao); renderChart('chart-adesao-23h', 'doughnut', adesao.labels, adesao.data, ['#FBBF24', '#333333'], { plugins: { legend: { display: true, position: 'bottom', labels: {color: '#ddd', boxWidth: 12} } } });
    const bairros = extrairEOrdenar(graficos.noturno.bairros); renderChart('chart-bairros-23h', 'bar', bairros.labels, bairros.data, '#F97316', { indexAxis: 'y' }); 
  }

  const renderInclusao = (canvas, objData) => renderChart(canvas, 'bar', ['Sim', 'Não'], [objData['Sim'] || 0, objData['Não'] || 0], ['#10B981', '#333']);
  renderInclusao('chart-pcd', graficos.inclusao.pcd); renderInclusao('chart-menor', graficos.inclusao.menor);
  renderInclusao('chart-acompanhado', graficos.inclusao.acompanhado); renderInclusao('chart-estagio', graficos.inclusao.estagio);
}

// ========================================================================
// 12. MÓDULO DO MOTORISTA (PONTE VISUAL PWA)
// ========================================================================

// Variável global temporária para guardar a placa do veículo em condução
let veiculoConducaoAtual = "";

async function uiIniciarRota() {
    const select = document.getElementById("select-frota-motorista");
    const placa = select.value;
    
    if (!placa) {
        showToast("Selecione um veículo primeiro.", "warning");
        return;
    }
    
    veiculoConducaoAtual = placa;
    
    // 1. Chama a função central (que já criámos no main_core.js)
    // A função btnIniciarRotaMotorista já cuida de avisar a API e ativar o Wake Lock + Tela Preta
    await btnIniciarRotaMotorista(placa);
    
    // 2. Atualiza a UI para o ecrã de viagem (Tela Preta)
    document.getElementById("viagem-placa-display").innerText = placa;
    
    // 3. Esconde o painel normal e mostra o ecrã gigante do modo viagem
    document.getElementById("view-painel-motorista").style.display = "none";
    document.getElementById("painel-viagem-ativa").style.display = "flex";
    
    // Nota: ativarModoViagemPWA(placa, email) já é chamado pelo btnIniciarRotaMotorista() internamente!
}

async function uiFinalizarRota() {
    if(confirm("Tem a certeza que deseja finalizar a rota? O rastreio será interrompido e os alunos notificados.")) {
        
        // 1. Chama a função central (que envia o fim para o GAS e desliga o Wake Lock)
        await btnFinalizarRotaMotorista(veiculoConducaoAtual);
        
        // 2. Restaura a UI normal
        document.getElementById("painel-viagem-ativa").style.display = "none";
        document.getElementById("view-painel-motorista").style.display = "block";
        
        // Limpa a placa e reseta o select
        veiculoConducaoAtual = "";
        document.getElementById("select-frota-motorista").value = "";
    }
}

function uiDeclararSOS() {
    // Reutiliza o modal de SOS já existente no sistema do Fiscal
    if (typeof abrirModalSOS === "function") {
        abrirModalSOS();
        // Pré-preenche a placa se o modal tiver o input correspondente
        const inputSosOnibus = document.getElementById('sos-id-onibus');
        if (inputSosOnibus) inputSosOnibus.value = veiculoConducaoAtual;
        showToast("Por favor, selecione o motivo da avaria no painel.", "warning");
    } else {
        showToast("Função de SOS acionada para " + veiculoConducaoAtual, "info");
    }
}

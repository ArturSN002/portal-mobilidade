// ========================================================================
// 9. MODO FISCAL E ADMINISTRAÇÃO AVANÇADA (V9.2.4)
// ========================================================================
let html5QrcodeScanner = null;

function iniciarScanner() {
    document.getElementById('leitor-qr-container').classList.remove('hidden');
    document.getElementById('btn-scanner').classList.add('hidden');
    document.getElementById('btn-scanner-nativo').classList.add('hidden');

    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(() => { });
    }

    html5QrcodeScanner = new Html5QrcodeScanner("leitor-qr", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render(aoLerQRCode, (e) => { });
}

function fecharScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(() => { });
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
        showToast("Erro ao processar imagem QR Code: " + err.message, "error");
        document.getElementById('btn-scanner-nativo').innerHTML = `<span style="font-size: 20px;">📱</span> USAR CÂMARA NATIVA`;
    }

    event.target.value = '';
}

function fecharModoFiscalizacao() {
    fecharScanner();

    // Devolve o utilizador à tela correta baseada no nível guardado no login
    const nivel = localStorage.getItem("MAESTRO_OPERADOR_NIVEL") || "";

    if (nivel === "MOTORISTA") {
        switchView('view-painel-motorista');
    } else if (nivel === "MODERADOR") {
        switchView('view-moderador');
    } else {
        switchView('view-admin-hub'); // Fiscais e Supervisores
    }
}

function abrirModoFiscalizacaoGlobal() {
    // Leva qualquer operador para a tela isolada da câmara
    switchView('view-fiscal');
    iniciarScanner();
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
    const cacheListRaw = localStorage.getItem("MAESTRO_LISTA_ESTUDANTES");
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
                if (res.statusAtividade === "ATIVO" && typeof iniciarRelogioAntiPrint === "function") {
                    iniciarRelogioAntiPrint('fiscal-clock');
                }
            } catch (errFoto) {
                showToast("Erro ao carregar a foto: " + errFoto.message, "error");
            }
        }

    } catch (err) {
        showToast("Erro de conexão com o servidor: " + err.message, "error");
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
        console.warn("Áudio não suportado: " + e.message);
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
    
    const nomeTratado = typeof formatarNomeProprio === 'function' ? formatarNomeProprio(nome) : nome;

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

// Export functions to global scope
window.iniciarScanner = iniciarScanner;
window.fecharScanner = fecharScanner;
window.aoLerQRCode = aoLerQRCode;
window.lerQRCodePorFoto = lerQRCodePorFoto;
window.fecharModoFiscalizacao = fecharModoFiscalizacao;
window.abrirModoFiscalizacaoGlobal = abrirModoFiscalizacaoGlobal;
window.validarFiscal = validarFiscal;
window.tocarBeep = tocarBeep;
window.extrairTextoDaTag = extrairTextoDaTag;
window.gerarHtmlFiscal = gerarHtmlFiscal;

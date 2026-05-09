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

        if (!res.encontrado) {
            mostrarErroEstudante("Não Encontrado", "Verifique o CPF ou submissão.");
            return;
        }

        if (checkboxPush && checkboxPush.checked) {
            solicitarConsentimentoPushAnonimo(alvo);
        }

        renderizarTimelineEstudante(res, resBox);
    } catch (err) {
        mostrarErroEstudante("Erro na API", "Tente novamente mais tarde.");
    } finally {
        btn.innerText = "CONSULTAR STATUS";
        btn.disabled = false;
    }
}

async function solicitarConsentimentoPushAnonimo(cpf) {
    try {
        // Aguarda a inicialização do Firebase (promessa global definida no bootSystem)
        if (window.firebaseReady) await window.firebaseReady;

        if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) { 
            console.warn("Firebase não disponível após aguardar inicialização."); 
            return; 
        }
        if (!firebase.messaging.isSupported()) return;
        const messaging = firebase.messaging();

        // Guarda de idempotência — evita erro 'use-sw-after-get-token' em SPA
        if (!window.isSwInjected) {
            const registration = await navigator.serviceWorker.ready;
            messaging.useServiceWorker(registration);
            window.isSwInjected = true;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await messaging.getToken({ vapidKey: window.FIREBASE_VAPID_KEY });
            if (token) {
                const cpfLimpo = cpf.replace(/\D/g, '');
                await apiCall("registrarPushToken", { idEstudante: cpfLimpo, pushToken: token });
                localStorage.setItem('MAESTRO_FCM_TOKEN', token);
                localStorage.setItem('MAESTRO_PUSH_ATIVO', 'true');
                showToast("Notificações ativadas com sucesso!", "success");
            }
        } else {
            showToast("Permissão de notificações negada pelo dispositivo.", "info");
        }
    } catch (error) {
        console.warn("Push anónimo falhou ou foi bloqueado.", error);
    }
}

function renderizarTimelineEstudante(dados, container) {
    const nomeLimpo = formatarNomeProprio(dados.nome).split(' ')[0];
    let html = `<h3 style="margin:0 0 15px 0; color:var(--primary);">Olá, ${nomeLimpo}!</h3>`;
    html += `<div class="timeline" style="box-sizing: border-box; width: 100%; max-width: 100%;">`;

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
           <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border: 1px solid var(--success); border-radius: 8px; text-align: center; box-sizing: border-box; width: 100%; max-width: 100%;">
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
    container.style.cssText = 'box-sizing: border-box; width: 100%; max-width: 100%; margin: 0 auto;';
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
    reader.onload = function (e) {
        arquivosParaResgate[tipoDoc] = {
            tipo: tipoDoc,
            nome: file.name,
            base64: e.target.result
        };
        statusSpan.innerText = "✅ Anexado e pronto a enviar!";
        statusSpan.style.color = "var(--success)";
        verificarBotaoResgate();
    };
    reader.onerror = function () {
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
        }
    } catch (e) {
        showToast("Erro de ligação com a Secretaria.", "error");
    } finally {
        if (!document.getElementById('view-resgate').classList.contains('hidden')) {
            btn.innerHTML = "TENTAR NOVAMENTE";
            btn.disabled = false;
        }
    }
}

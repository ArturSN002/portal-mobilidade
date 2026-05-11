// ========================================================================
// 4. MESA DE AUDITORIA & GESTÃO DOCUMENTAL
// ========================================================================

let arrayAlunosAuditoria = [];
let paginaAtualAuditoria = 1;     // NOVO: Guarda a página atual
const ITENS_POR_PAGINA = 10;      // NOVO: Exibe 10 alunos por bloco

function formatarNomeProprio(nome) {
    if (!nome) return "Estudante";
    const preposicoes = ["da", "de", "do", "das", "dos", "e"];
    return nome.toString().toLowerCase().split(' ').map(function (palavra) {
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
    } catch (e) {
        container.innerHTML = `<div class="error-box">Falha ao ligar à base de dados: ${e.message}</div>`;
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
        let strData = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
    } catch (e) {
        contentBox.innerHTML = `<div class="error-box">Falha de rede: ${e.message}</div>`;
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
        showToast("Erro na ligação ao servidor: " + e.message, "error");
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
    } catch (e) {
        showToast("Falha ao comunicar com motor de E-mails: " + e.message, "error");
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
        showToast("Não foi possível ler o estado dos motores: " + err.message, "error");
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
    } catch (e) {
        showToast("Ocorreu um erro ao acionar o motor: " + e.message, "error");
    }
}

async function alterarMotor(motorId, isLigado) {
    showToast(`A alterar configurações de ${motorId}...`, "loading");
    try {
        const res = await apiCall("alterarEstadoMotor", { motorId: motorId, ligado: isLigado });
        if (res.sucesso) showToast(res.msg, "success");
        else showToast(res.erro, "error");
    } catch (e) {
        showToast("Ocorreu um erro ao alterar o motor: " + e.message, "error");
    }
}


// ========================================================================
// NOTA: O MODO FISCAL E ADMINISTRAÇÃO AVANÇADA foram extraídos para admin_fiscal.js
// O MÓDULO DE FROTA E SOS foram extraídos para admin_sos.js
// ========================================================================

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
    } catch (e) {
        showToast("Erro de comunicação com o servidor: " + e.message, "error");
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
    } catch (e) {
        showToast("Erro ao carregar filtros de push: " + e.message, "error");
    }
}

async function dispararAvisoPublico() {
    const tipo = document.getElementById('aviso-tipo-mural').value;
    const titulo = document.getElementById('aviso-titulo-mural').value.trim();
    const mensagem = document.getElementById('aviso-msg-mural').value.trim();
    const campoValidade = [
        document.getElementById('aviso-validade-mural'),
        document.getElementById('aviso-validade'),
        document.querySelector('#ASSUNTO_VALIDADE[type="date"]'),
        document.querySelector('[name="ASSUNTO_VALIDADE"][type="date"]'),
        document.querySelector('#area-aviso-mural input[type="date"]')
    ].find(campo => campo && campo.type === "date");
    const campoEnviarPush = [
        document.getElementById('aviso-enviar-push'),
        document.getElementById('chk-enviar-push'),
        document.getElementById('check-push-aviso'),
        document.querySelector('#area-aviso-mural input[type="checkbox"]')
    ].find(campo => campo && campo.type === "checkbox");
    const validadeAviso = campoValidade ? campoValidade.value : "";
    const enviarPush = campoEnviarPush ? campoEnviarPush.checked : true;
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
            mensagem: mensagem,
            validade: validadeAviso,
            ASSUNTO_VALIDADE: validadeAviso,
            enviarPush: enviarPush
        });

        if (res.sucesso) {
            showToast("Aviso afixado e alunos notificados!", "success");
            fecharModalAvisosFiscal();
            btn.innerHTML = 'PUBLICAR AVISO';
            btn.disabled = false;
        } else {
            showToast(res.erro || "Falha ao publicar.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch (e) {
        showToast("Erro na comunicação: " + e.message, "error");
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
            btn.innerHTML = 'DISPARAR LOTE';
            btn.disabled = false;
        } else {
            showToast(res.erro || "Nenhum aluno encontrado neste filtro.", "error");
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    } catch (e) {
        showToast("Erro no disparo em lote: " + e.message, "error");
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
    } catch (e) {
        container.innerHTML = `<div class="error-box">Erro ao comunicar com o servidor do Mural: ${e.message}</div>`;
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
        showToast("Erro ao processar o voto: " + e.message, "error");
        if (btnUp) { btnUp.style.pointerEvents = 'auto'; btnUp.style.opacity = '1'; }
        if (btnDown) { btnDown.style.pointerEvents = 'auto'; btnDown.style.opacity = '1'; }
    }
}

// ========================================================================
// 15. CAIXA DE MENSAGENS (INBOX / PERSISTÊNCIA 7 DIAS)
// ========================================================================

function abrirInbox() {
    renderizarNotificacoes();
}

function renderizarNotificacoes() {
    const containers = document.querySelectorAll('.inbox-container');
    containers.forEach(container => {
        container.innerHTML = '<div class="loader" style="margin: 0 auto;"></div>';
    });

    const dbRequest = indexedDB.open('MaestroDB', 1);
    dbRequest.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notificacoes')) {
            containers.forEach(container => {
                container.innerHTML = '<div style="text-align: center; padding: 30px; background: #fff; border: 1px dashed #ccc; border-radius: 8px;"><p style="font-size: 12px; color: #666;">Caixa de entrada vazia.</p></div>';
            });
            return;
        }
        const transaction = db.transaction('notificacoes', 'readonly');
        const store = transaction.objectStore('notificacoes');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const notificacoes = request.result.sort((a, b) => b.timestamp - a.timestamp);
            if (notificacoes.length === 0) {
                containers.forEach(container => {
                    container.innerHTML = '<div style="text-align: center; padding: 30px; background: #fff; border: 1px dashed #ccc; border-radius: 8px;"><p style="font-size: 12px; color: #666;">Caixa de entrada vazia.</p></div>';
                });
                return;
            }
            
            let html = '';
            notificacoes.forEach(n => {
                const tempo = calcularTempoRelativo(n.timestamp);
                html += `
                <div class="form-card" style="padding: 15px; margin-bottom: 10px; border-left: 4px solid var(--primary); display: flex; gap: 10px; align-items: flex-start; text-align: left;">
                    <img src="${n.icon || './icone.png'}" style="width: 40px; height: 40px; border-radius: 8px;">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="font-size: 13px; color: var(--primary);">${n.title}</strong>
                            <span style="font-size: 10px; color: var(--text-sub);">${tempo}</span>
                        </div>
                        <p style="font-size: 12px; margin: 0; color: #333; line-height: 1.4;">${n.body}</p>
                        ${(n.link && n.link !== '/') ? `<a href="${n.link}" target="_blank" style="font-size: 11px; display: inline-block; margin-top: 5px; color: var(--accent); font-weight: bold;">Ver Detalhes ➡</a>` : ''}
                    </div>
                </div>`;
            });
            containers.forEach(container => {
                container.innerHTML = html;
            });
            
            // Remove o red dot após abrir a inbox
            document.querySelectorAll('.badge-notificacao').forEach(badge => badge.style.display = 'none');
        };
    };
    dbRequest.onerror = () => {
        containers.forEach(container => {
            container.innerHTML = '<div class="error-box">Erro ao carregar notificações locais.</div>';
        });
    };
}

function limparInbox() {
    const dbRequest = indexedDB.open('MaestroDB', 1);
    dbRequest.onsuccess = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('notificacoes')) {
            const transaction = db.transaction('notificacoes', 'readwrite');
            const store = transaction.objectStore('notificacoes');
            store.clear();
            renderizarNotificacoes();
            showToast("Caixa de entrada limpa com sucesso.", "success");
        }
    };
}

// Verifica periodicamente se há notificações para acender a badge
setInterval(() => {
    try {
        const dbReq = indexedDB.open('MaestroDB', 1);
        dbReq.onsuccess = (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains('notificacoes')) {
                const tx = db.transaction('notificacoes', 'readonly');
                const countReq = tx.objectStore('notificacoes').count();
                countReq.onsuccess = () => {
                    const viewAdminAtiva = document.getElementById('view-notificacoes') && document.getElementById('view-notificacoes').classList.contains('active');
                    const sidebarRightAtiva = document.getElementById('sidebar-right') && document.getElementById('sidebar-right').classList.contains('active');
                    
                    // Mostra a badge se houver itens e a inbox não estiver aberta (em nenhum dos modos)
                    if(countReq.result > 0 && !viewAdminAtiva && !sidebarRightAtiva) {
                        document.querySelectorAll('.badge-notificacao').forEach(badge => badge.style.display = 'block');
                    }
                }
            }
        };
    } catch(err) {}
}, 10000);

// ========================================================================
// NOTA: O MOTOR DO DASHBOARD ANALÍTICO E BI foi extraído para admin_dashboard.js
// ========================================================================

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
    await btnIniciarRotaMotorista(placa);

    // 2. Atualiza a UI para o ecrã de viagem (Tela Preta)
    document.getElementById("viagem-placa-display").innerText = placa;

    // 3. Esconde o painel normal e mostra o ecrã gigante do modo viagem
    document.getElementById("view-painel-motorista").style.display = "none";
    document.getElementById("painel-viagem-ativa").style.display = "flex";
}

async function uiFinalizarRota() {
    if (confirm("Tem a certeza que deseja finalizar a rota? O rastreio será interrompido e os alunos notificados.")) {

        // 1. Chama a função central
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
        // Pré-preenche a placa
        const inputSosOnibus = document.getElementById('sos-id-onibus');
        if (inputSosOnibus) inputSosOnibus.value = veiculoConducaoAtual;
        showToast("Por favor, selecione o motivo da avaria no painel.", "warning");
    } else {
        showToast("Função de SOS acionada para " + veiculoConducaoAtual, "info");
    }
}

// ========================================================================
// CORREÇÕES DO MODAL DE ROTAS (Resolver o Botão Estático)
// ========================================================================
function abrirModalSelecaoRota() {
    const modal = document.getElementById('modal-selecao-rota');
    if (!modal) return;

    // 1. Remove o hidden para o HTML existir na tela
    modal.classList.remove('hidden');

    // 2. Força o navegador a recalcular o layout (Reflow) antes de animar
    void modal.offsetWidth;

    // 3. Aplica a classe que faz o modal subir suavemente
    modal.classList.add('active');

    popularSelectFrotaMotorista();
}

function fecharModalSelecaoRota() {
    const modal = document.getElementById('modal-selecao-rota');
    if (!modal) return;

    modal.classList.remove('active'); // Desce o modal

    // Aguarda a animação terminar para esconder completamente
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// ========================================================================
// CORREÇÃO: MODO FISCALIZAÇÃO (Redirecionamento Global)
// ========================================================================

function abrirModoFiscalizacaoGlobal() {
    // Leva qualquer operador para a tela isolada da câmara
    switchView('view-fiscal');
    iniciarScanner();
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

// ========================================================================
// CONTROLO DO MODAL DE SELEÇÃO DE ROTA (Animação Corrigida)
// ========================================================================

function abrirModalSelecaoRota() {
    const modal = document.getElementById('modal-selecao-rota');
    if (!modal) return;

    modal.classList.remove('hidden');
    void modal.offsetWidth; // Força reflow para animação CSS
    modal.classList.add('active');

    popularSelectFrotaMotorista();
}

function fecharModalSelecaoRota() {
    const modal = document.getElementById('modal-selecao-rota');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ========================================================================
// LOGÍSTICA DE ROTAS: Filtro por E-mail e Turno (Horário)
// ========================================================================

function obterTurnosAtuais() {
    const agora = new Date();
    const horaMinuto = (agora.getHours() * 60) + agora.getMinutes();
    let turnos = [];

    const dentro = (inicioH, inicioM, fimH, fimM) => {
        return horaMinuto >= (inicioH * 60 + inicioM) && horaMinuto <= (fimH * 60 + fimM);
    };

    if (dentro(4, 30, 7, 0) || dentro(12, 0, 13, 30)) turnos.push("MANHÃ");
    if (dentro(11, 0, 13, 30) || dentro(18, 0, 19, 30)) turnos.push("TARDE");
    if (dentro(17, 0, 18, 30) || dentro(22, 0, 23, 59)) turnos.push("NOITE");

    return turnos;
}

async function popularSelectFrotaMotorista() {
    const select = document.getElementById("select-frota-motorista");
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>A consultar veículos...</option>';

    const turnosValidos = obterTurnosAtuais();
    const emailMotorista = localStorage.getItem("MAESTRO_OPERADOR_EMAIL");

    try {
        // Chamada ao back-end filtrando pelo e-mail logado
        const res = await apiCall("getRotasMotorista", { usuarioLogadoId: emailMotorista });

        select.innerHTML = '<option value="" disabled selected>Escolha o seu veículo...</option>';

        if (res.sucesso && res.rotas && res.rotas.length > 0) {
            res.rotas.forEach(rota => {
                const rotaUpper = rota.toUpperCase();
                let turnoDaRota = "";

                if (rotaUpper.includes("MANHÃ") || rotaUpper.includes("MANHA")) turnoDaRota = "MANHÃ";
                else if (rotaUpper.includes("TARDE")) turnoDaRota = "TARDE";
                else if (rotaUpper.includes("NOITE")) turnoDaRota = "NOITE";

                const opt = document.createElement("option");
                opt.value = rota;

                if (turnoDaRota === "" || turnosValidos.includes(turnoDaRota)) {
                    opt.innerText = `🟢 [DISPONÍVEL] ${rota}`;
                    opt.disabled = false;
                } else {
                    opt.innerText = `🔴 [FORA DO HORÁRIO] ${rota}`;
                    opt.disabled = true;
                }
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="" disabled selected>Nenhum veículo vinculado a si.</option>';
        }
    } catch (e) {
        select.innerHTML = '<option value="" disabled selected>Erro ao carregar rotas.</option>';
        showToast("Erro ao carregar rotas: " + e.message, "error");
    }
}


// ========================================================================
// FUNÇÃO GLOBAL DE SAÍDA (LOGOUT)
// ========================================================================
function logoutOperadorGlobal() {
    if (confirm("Tem certeza que deseja encerrar a sua sessão de trabalho?")) {
        localStorage.removeItem("MAESTRO_TOKEN");
        localStorage.removeItem("MAESTRO_OPERADOR_NIVEL");
        localStorage.removeItem("MAESTRO_OPERADOR_NOME");
        localStorage.removeItem("MAESTRO_OPERADOR_EMAIL");

        // Dá refresh na página para limpar a memória por completo
        window.location.href = window.location.pathname;
    }
}

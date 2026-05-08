// ========================================================================
// 9. MÓDULO SMART STEPPER — INSCRIÇÃO NATIVA (V10.1)
// ========================================================================

const STEPPER_LABELS = {
    1: 'Triagem',
    2: 'Rota Acadêmica',
    3: 'Condicionais',
    4: 'Cofre Digital'
};

let inscricaoArquivos = {};
let inscricaoFotoBase64 = null;
let cameraStream = null;

// ----- Wrapper de Inicialização -----
function abrirNovaInscricao() {
    switchView('view-inscricao');
    carregarListasInscricao(); // Triggers the backend fetch immediately
}

// ----- Step Navigation -----

function atualizarStepperUI(stepAtual) {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        const conn = document.getElementById(`conn-${i}`);

        if (!dot) continue;

        dot.classList.remove('step-active', 'step-done');

        if (i < stepAtual) {
            dot.classList.add('step-done');
        } else if (i === stepAtual) {
            dot.classList.add('step-active');
        }

        if (conn) {
            conn.classList.remove('step-done');
            if (i < stepAtual) {
                conn.classList.add('step-done');
            }
        }
    }

    const label = document.getElementById('stepper-label');
    if (label) {
        label.innerHTML = `Etapa <strong>${stepAtual}</strong> de 4 — ${STEPPER_LABELS[stepAtual]}`;
    }
}

function stepperNext(current, next) {
    const stepCurrent = document.getElementById(`step-${current}`);
    const stepNext = document.getElementById(`step-${next}`);
    if (!stepCurrent || !stepNext) return;

    // ---- VALIDAÇÃO POR ETAPA ----
    if (current === 1) {
        const cpfRaw = document.getElementById('insc-cpf').value.replace(/\D/g, '');
        if (cpfRaw.length !== 11) {
            showToast("CPF inválido. Informe 11 dígitos.", "error");
            triggerVibration([50, 50]);
            return;
        }
    }

    if (current === 2) {
        const nome = document.getElementById('insc-nome').value.trim();
        const email = document.getElementById('insc-email').value.trim();
        const rg = document.getElementById('insc-rg').value.trim();
        const contato = document.getElementById('insc-contato').value.trim();
        const instSelect = document.getElementById('insc-instituicao').value;
        const instOutra = document.getElementById('insc-instituicao-outra').value.trim();
        const mat = document.getElementById('insc-matricula').value.trim();
        const rota = document.getElementById('insc-rota').value;
        const inicioSem = document.getElementById('insc-inicio-semestre').value;
        const fimSem = document.getElementById('insc-fim-semestre').value;

        const diasCheck = document.querySelectorAll('input[name="insc-dias"]:checked').length > 0;
        const turnosCheck = document.querySelectorAll('input[name="insc-turnos"]:checked').length > 0;

        let instOk = false;
        if (instSelect && instSelect !== "Outra (Não listada)") {
            instOk = true;
        } else if (instSelect === "Outra (Não listada)" && instOutra) {
            instOk = true;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("E-mail inválido.", "error");
            return;
        }

        if (!nome || !email || !contato || !instOk || !mat || !rota || !inicioSem || !fimSem || !diasCheck || !turnosCheck) {
            showToast("Preencha todos os campos obrigatórios da Rota Acadêmica.", "error");
            triggerVibration([50, 50]);
            return;
        }
    }

    if (current === 3) {
        if (!getRadioValue('insc-23h') || !getRadioValue('insc-estagio') || !getRadioValue('insc-pcd') || !getRadioValue('insc-menor') || !getRadioValue('insc-criancas')) { 
            showToast("Por favor, responda a todas as perguntas de Sim/Não.", "error"); 
            return; 
        }

        const condBairro = document.getElementById('cond-bairro');
        if (condBairro && condBairro.classList.contains('cond-visible')) {
            const bairro = document.getElementById('insc-bairro-23h').value;
            if (!bairro) {
                showToast("Selecione o bairro de desembarque (23h).", "error");
                return;
            }
        }

        const condEstagio = document.getElementById('cond-estagio');
        if (condEstagio && condEstagio.classList.contains('cond-visible')) {
            const parada = document.getElementById('insc-parada-estagio').value.trim();
            const turnoEst = document.getElementById('insc-turno-estagio').value;
            if (!parada || !turnoEst) {
                showToast("Preencha os dados do estágio (parada e turno).", "error");
                return;
            }
        }

        const condCid = document.getElementById('cond-cid');
        if (condCid && condCid.classList.contains('cond-visible')) {
            const cid = document.getElementById('insc-cid').value.trim();
            if (!cid) {
                showToast("Informe o CID (classificação da deficiência).", "error");
                return;
            }
        }
    }

    // ---- TRANSIÇÃO ----
    stepCurrent.classList.remove('step-visible');
    stepNext.classList.remove('step-visible');

    // Force re-trigger animation
    void stepNext.offsetWidth;

    stepNext.classList.add('step-visible');
    atualizarStepperUI(next);

    // Scroll to top of form
    const formCard = stepNext.closest('.form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stepperPrev(current, prev) {
    const stepCurrent = document.getElementById(`step-${current}`);
    const stepPrev = document.getElementById(`step-${prev}`);
    if (!stepCurrent || !stepPrev) return;

    stepCurrent.classList.remove('step-visible');
    stepPrev.classList.remove('step-visible');

    void stepPrev.offsetWidth;

    stepPrev.classList.add('step-visible');
    atualizarStepperUI(prev);

    const formCard = stepPrev.closest('.form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ----- Step 1: CPF Triagem -----

function formatarCPFInput(valor) {
    const nums = valor.replace(/\D/g, '');
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return nums.slice(0, 3) + '.' + nums.slice(3);
    if (nums.length <= 9) return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6);
    return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6, 9) + '-' + nums.slice(9, 11);
}

document.addEventListener('DOMContentLoaded', () => {
    const cpfInput = document.getElementById('insc-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function () {
            const pos = this.selectionStart;
            const oldLen = this.value.length;
            this.value = formatarCPFInput(this.value);
            const newLen = this.value.length;
            this.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
        });
    }

    const contatoInput = document.getElementById('insc-contato');
    if (contatoInput) {
        contatoInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }
});

async function verificarCPFInscricao() {
    const cpfRaw = document.getElementById('insc-cpf').value.replace(/\D/g, '');
    const btn = document.getElementById('btn-insc-verificar');

    if (cpfRaw.length !== 11) {
        showToast("CPF inválido. Informe 11 dígitos.", "error");
        triggerVibration([50, 50]);
        return;
    }

    btn.innerText = "A VERIFICAR...";
    btn.disabled = true;

    try {
        // 1. O Cão de Guarda: Verificar duplicidade via API
        const resDuplicidade = await apiCall("verificarDuplicidadeCPF", { cpf: cpfRaw });

        // Se a API não responder corretamente, tratamos como erro de rede
        if (!resDuplicidade) throw new Error("Sem resposta do Cão de Guarda");

        if (resDuplicidade.duplicado) {
            // ⛔ Cão de guarda ativado! CPF duplicado.
            const feedbackBox = document.getElementById('cpf-feedback-box');
            if (feedbackBox) {
                feedbackBox.style.background = '#fef2f2';
                feedbackBox.style.color = '#991b1b';
                feedbackBox.innerHTML = `⚠️ ${resDuplicidade.mensagem}`;
                feedbackBox.classList.remove('hidden');
            } else {
                showToast(resDuplicidade.mensagem, "error");
            }
            triggerVibration([100, 50, 100]);
            btn.innerText = "VERIFICAR CPF";
            btn.disabled = false;
            return; // Bloqueia o avanço para a Etapa 2
        }

        // ✅ Caminho livre! Prosseguir com o Histórico (Auto-fill)
        const res = await apiCall("verificarCpfRenovacao", { cpf: cpfRaw });

        if (!res.sucesso) {
            showToast(res.erro || "Erro ao verificar CPF.", "error");
            btn.innerText = "VERIFICAR CPF";
            btn.disabled = false;
            return;
        }

        if (res.isRenovacao && res.dados) {
            // Auto-fill para renovação
            const d = res.dados;
            const elNome = document.getElementById('insc-nome');
            const elEmail = document.getElementById('insc-email');
            const elRg = document.getElementById('insc-rg');
            const elContato = document.getElementById('insc-contato');
            const elInst = document.getElementById('insc-instituicao');
            const elMat = document.getElementById('insc-matricula');
            const elRota = document.getElementById('insc-rota');

            if (elNome && d.nome) elNome.value = d.nome;
            if (elEmail && d.email) elEmail.value = d.email;
            if (elRg && d.rg) elRg.value = d.rg;
            if (elContato && d.contato) elContato.value = d.contato;
            if (elMat && d.matricula) elMat.value = d.matricula;

            if (elInst && d.instituicao) {
                _selecionarOpcaoSelect(elInst, d.instituicao);
            }
            if (elRota && d.rota) {
                _selecionarOpcaoSelect(elRota, d.rota);
            }

            const feedbackBox = document.getElementById('cpf-feedback-box');
            if (feedbackBox) {
                feedbackBox.style.background = '#ecfdf5';
                feedbackBox.style.color = '#166534';
                feedbackBox.innerHTML = "✅ Inscrição anterior encontrada! Os seus dados foram importados. Verifique-os na próxima etapa.";
                feedbackBox.classList.remove('hidden');
            }
            triggerVibration(50);
            setTimeout(() => { stepperNext(1, 2); }, 2000);
        } else {
            const feedbackBox = document.getElementById('cpf-feedback-box');
            if (feedbackBox) {
                feedbackBox.style.background = '#e0f2fe';
                feedbackBox.style.color = '#0369a1';
                feedbackBox.innerHTML = "✨ Novo Cadastro! Prossiga para preencher os seus dados.";
                feedbackBox.classList.remove('hidden');
            }
            triggerVibration(50);
            setTimeout(() => { stepperNext(1, 2); }, 1500);
        }

    } catch (err) {
        console.error("Erro na verificação de CPF:", err);
        showToast("Falha de conexão ao servidor. Tente novamente.", "error");
    } finally {
        btn.innerText = "VERIFICAR CPF";
        btn.disabled = false;
    }
}

/**
 * Tenta selecionar uma opção de um <select> pelo valor.
 * Se não encontrar match exato, mantém a opção padrão.
 */
function _selecionarOpcaoSelect(selectEl, valor) {
    const valorLimpo = String(valor).trim().toLowerCase();
    for (let i = 0; i < selectEl.options.length; i++) {
        if (selectEl.options[i].value.trim().toLowerCase() === valorLimpo ||
            selectEl.options[i].text.trim().toLowerCase() === valorLimpo) {
            selectEl.selectedIndex = i;
            return;
        }
    }
    // Se não encontrou, não altera (fica em "Selecione...")
}

// ----- Step 3: Conditional Fields -----

function toggleCondField(fieldId, show) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (show) {
        field.classList.add('cond-visible');
    } else {
        field.classList.remove('cond-visible');
        // Clear sub-inputs when hidden
        field.querySelectorAll('input, select').forEach(el => {
            if (el.type === 'text' || el.type === 'tel') el.value = '';
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
        });
    }
}

// ----- Step 4: File Upload Processing -----

function processarArquivoInscricao(inputElement, tipoDoc) {
    const file = inputElement.files[0];
    const statusSpan = document.getElementById(`status-insc-${tipoDoc}`);
    const labelUpload = document.getElementById(`label-insc-${tipoDoc}`);

    if (!file) {
        delete inscricaoArquivos[tipoDoc];
        if (statusSpan) {
            statusSpan.innerText = "Nenhum arquivo selecionado";
            statusSpan.style.color = "var(--text-sub)";
        }
        if (labelUpload) {
            labelUpload.classList.remove('file-attached');
            labelUpload.innerHTML = "📎 Toque para selecionar o arquivo";
        }
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast("Arquivo muito grande (Máximo 5MB).", "error");
        inputElement.value = "";
        delete inscricaoArquivos[tipoDoc];
        if (statusSpan) {
            statusSpan.innerText = "Erro: Arquivo demasiado pesado.";
            statusSpan.style.color = "var(--danger)";
        }
        if (labelUpload) {
            labelUpload.classList.remove('file-attached');
            labelUpload.innerHTML = "📎 Toque para selecionar o arquivo";
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        inscricaoArquivos[tipoDoc] = {
            tipo: tipoDoc,
            nome: file.name,
            base64: e.target.result
        };
        if (statusSpan) {
            statusSpan.innerText = `✅ ${file.name}`;
            statusSpan.style.color = "var(--success)";
        }
        if (labelUpload) {
            labelUpload.classList.add('file-attached');
            labelUpload.innerHTML = "✅ Arquivo anexado";
        }
    };
    reader.onerror = function () {
        showToast("Falha na leitura do arquivo.", "error");
        inputElement.value = "";
        delete inscricaoArquivos[tipoDoc];
        if (statusSpan) {
            statusSpan.innerText = "Erro na leitura.";
            statusSpan.style.color = "var(--danger)";
        }
        if (labelUpload) {
            labelUpload.classList.remove('file-attached');
            labelUpload.innerHTML = "📎 Toque para selecionar o arquivo";
        }
    };
    reader.readAsDataURL(file);
}

// ----- Step 4: Hybrid Photo Toggle -----

function toggleModoFoto(modo) {
    const areaCamera = document.getElementById('camera-3x4-area');
    const areaUpload = document.getElementById('upload-3x4-area');
    const btnCamera = document.getElementById('btn-modo-camera');
    const btnUpload = document.getElementById('btn-modo-upload');

    if (modo === 'camera') {
        if (areaCamera) areaCamera.classList.remove('hidden');
        if (areaUpload) areaUpload.classList.add('hidden');
        if (btnCamera) { btnCamera.classList.add('btn-modo-ativo'); btnCamera.classList.remove('btn-modo-inativo'); }
        if (btnUpload) { btnUpload.classList.add('btn-modo-inativo'); btnUpload.classList.remove('btn-modo-ativo'); }
        iniciarCamera3x4();
    } else {
        pararCameraInscricao();
        if (areaCamera) areaCamera.classList.add('hidden');
        if (areaUpload) areaUpload.classList.remove('hidden');
        if (btnCamera) { btnCamera.classList.add('btn-modo-inativo'); btnCamera.classList.remove('btn-modo-ativo'); }
        if (btnUpload) { btnUpload.classList.add('btn-modo-ativo'); btnUpload.classList.remove('btn-modo-inativo'); }
    }
}

// ----- Step 4: Camera 3x4 -----

async function iniciarCamera3x4() {
    const viewfinder = document.getElementById('camera-viewfinder');
    const video = document.getElementById('camera-video');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const preview = document.getElementById('camera-preview');
    const btnRefazer = document.getElementById('btn-refazer-foto');

    if (!viewfinder || !video) return;

    // Hide preview, show viewfinder
    if (preview) preview.classList.add('hidden');
    if (btnRefazer) btnRefazer.classList.add('hidden');

    // Stop any existing stream
    pararCameraInscricao();

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 480 },
                height: { ideal: 640 }
            }
        });

        video.srcObject = cameraStream;
        viewfinder.classList.remove('hidden');
        if (btnCapturar) btnCapturar.classList.remove('hidden');

    } catch (err) {
        console.error("Câmara:", err);
        showToast("Não foi possível aceder à câmara. Verifique as permissões.", "error");
    }
}

function capturarFoto3x4() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const preview = document.getElementById('camera-preview');
    const viewfinder = document.getElementById('camera-viewfinder');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const btnRefazer = document.getElementById('btn-refazer-foto');

    if (!video || !canvas || !preview) return;

    // Set canvas dimensions to 3x4 aspect ratio
    const largura = 300;
    const altura = 400;
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext('2d');

    // Mirror horizontally (front camera is mirrored in CSS)
    ctx.translate(largura, 0);
    ctx.scale(-1, 1);

    // Calculate crop from video center
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const aspectTarget = largura / altura;
    const aspectVideo = vw / vh;

    let sx, sy, sw, sh;
    if (aspectVideo > aspectTarget) {
        sh = vh;
        sw = vh * aspectTarget;
        sx = (vw - sw) / 2;
        sy = 0;
    } else {
        sw = vw;
        sh = vw / aspectTarget;
        sx = 0;
        sy = (vh - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, largura, altura);

    inscricaoFotoBase64 = canvas.toDataURL('image/jpeg', 0.8);

    preview.src = inscricaoFotoBase64;
    preview.classList.remove('hidden');
    if (btnRefazer) btnRefazer.classList.remove('hidden');

    // Stop camera to save battery
    pararCameraInscricao();
    if (viewfinder) viewfinder.classList.add('hidden');
    if (btnCapturar) btnCapturar.classList.add('hidden');

    showToast("Foto capturada com sucesso!", "success");
    triggerVibration(50);
}

function pararCameraInscricao() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('camera-video');
    if (video) video.srcObject = null;
}

// ----- Form Payload Assembly -----

function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

function getCheckboxValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function prepararEnvioNativo() {
    const btn = document.getElementById('btn-submeter-inscricao');

    // Basic validation
    const cpf = document.getElementById('insc-cpf').value.replace(/\D/g, '');
    const nome = document.getElementById('insc-nome').value.trim();

    if (!cpf || cpf.length !== 11) {
        showToast("CPF inválido. Volte à etapa 1.", "error");
        return;
    }

    if (!nome) {
        showToast("Nome completo é obrigatório. Volte à etapa 2.", "error");
        return;
    }

    // Validação do Documento com Foto (RG/CNH) — obrigatório
    if (!inscricaoArquivos['documento']) {
        showToast("O Documento com Foto (RG ou CNH) é obrigatório.", "error");
        return;
    }

    // Validação de Menor Idade
    if (getRadioValue('insc-menor') === 'Sim' && !inscricaoArquivos['menorIdade']) {
        showToast("A Declaração de Responsabilidade para menores é obrigatória.", "error");
        return;
    }

    // Validação da Foto 3x4: câmera OU arquivo
    const fotoFinal = inscricaoFotoBase64 || (inscricaoArquivos['foto3x4'] ? inscricaoArquivos['foto3x4'].base64 : null);
    if (!fotoFinal) {
        showToast("A Foto 3x4 é obrigatória. Use a câmera ou anexe um arquivo.", "error");
        return;
    }

    const payloadNativo = {
        // Step 1
        cpf: cpf,

        // Step 2
        nome: nome,
        email: document.getElementById('insc-email').value.trim(),
        rg: document.getElementById('insc-rg').value.trim(),
        contato: document.getElementById('insc-contato').value.trim(),
        instituicao: document.getElementById('insc-instituicao').value.trim(),
        instituicaoOutra: document.getElementById('insc-instituicao-outra').value.trim(),
        matricula: document.getElementById('insc-matricula').value.trim(),
        rota: document.getElementById('insc-rota').value.trim(),
        diasDeUso: getCheckboxValues('insc-dias'),
        turnos: getCheckboxValues('insc-turnos'),
        inicioSemestre: document.getElementById('insc-inicio-semestre').value,
        fimSemestre: document.getElementById('insc-fim-semestre').value,

        // Step 3
        transporte23h: getRadioValue('insc-23h'),
        bairro23h: document.getElementById('insc-bairro-23h').value,
        transporteEstagio: getRadioValue('insc-estagio'),
        paradaEstagio: document.getElementById('insc-parada-estagio').value.trim(),
        turnoEstagio: document.getElementById('insc-turno-estagio').value,
        possuiDeficiencia: getRadioValue('insc-pcd'),
        cidDeficiencia: document.getElementById('insc-cid').value.trim(),
        acompanhadoCriancas: getRadioValue('insc-criancas'),
        menorIdade: getRadioValue('insc-menor'),

        // Step 4
        arquivos: inscricaoArquivos,
        fotoBase64: fotoFinal,

        // Metadata
        timestampEnvio: new Date().toISOString(),
        origemEnvio: 'PWA_NATIVA'
    };

    console.log("========== PAYLOAD INSCRIÇÃO NATIVA ==========");
    console.log(payloadNativo);
    console.log("===============================================");

    // Visual feedback
    btn.innerHTML = "📤 A ENVIAR... ⏳";
    btn.disabled = true;

    // Forcibly turn off hardware immediately
    pararCameraInscricao();
    if (typeof pararTransmissaoGpsE_Radar === 'function') { 
        pararTransmissaoGpsE_Radar(true); 
    }

    apiCall("submeterInscricaoNativa", payloadNativo)
        .then(res => {
            if (res.sucesso) {
                showToast(res.msg || "Inscrição recebida com sucesso!", "success");
                triggerVibration([50, 30, 50]);
                // Reset do formulário e volta ao menu
                setTimeout(() => {
                    switchView('view-aluno-menu');
                    _resetarFormularioInscricao();
                }, 2000);
            } else {
                showToast(res.erro || "Erro ao submeter inscrição.", "error");
                triggerVibration([100, 50, 100]);
                btn.innerHTML = "📤 SUBMETER INSCRIÇÃO";
                btn.disabled = false;
            }
        })
        .catch(err => {
            console.error("Erro de rede na inscrição:", err);
            showToast("Falha de conexão. Verifique a internet e tente novamente.", "error");
            btn.innerHTML = "📤 SUBMETER INSCRIÇÃO";
            btn.disabled = false;
        });
}

function _resetarFormularioInscricao() {
    // Limpa todos os inputs de texto do formulário
    const textIds = [
        'insc-cpf', 'insc-nome', 'insc-email', 'insc-rg', 'insc-contato', 'insc-matricula',
        'insc-inicio-semestre', 'insc-fim-semestre',
        'insc-parada-estagio', 'insc-cid'
    ];
    textIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    // Reset checkboxes e radios
    document.querySelectorAll('#view-inscricao input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#view-inscricao input[type="radio"]').forEach(rb => {
        rb.checked = rb.defaultChecked;
    });

    // Reset all selects (instituição, rota, bairro, turno estágio)
    document.querySelectorAll('#view-inscricao select').forEach(sel => sel.selectedIndex = 0);

    // Reset conditional fields
    document.querySelectorAll('.cond-field').forEach(cf => cf.classList.remove('cond-visible'));

    // Reset file inputs (inclui novos campos: documento e foto3x4)
    const fileIds = ['insc-file-documento', 'insc-file-residencia', 'insc-file-vinculo', 'insc-file-foto3x4'];
    fileIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const statusIds = ['status-insc-documento', 'status-insc-residencia', 'status-insc-vinculo', 'status-insc-foto3x4'];
    statusIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerText = 'Nenhum arquivo selecionado'; el.style.color = 'var(--text-sub)'; }
    });

    // Reset camera
    pararCameraInscricao();
    const preview = document.getElementById('camera-preview');
    if (preview) preview.classList.add('hidden');
    const btnRefazer = document.getElementById('btn-refazer-foto');
    if (btnRefazer) btnRefazer.classList.add('hidden');
    const viewfinder = document.getElementById('camera-viewfinder');
    if (viewfinder) viewfinder.classList.add('hidden');

   // Reset hybrid photo toggle com base na política de privacidade
    if (localStorage.getItem('MAESTRO_PREF_CAMERA') === 'false') {
        toggleModoFoto('upload');
        const btnCamera = document.getElementById('btn-modo-camera');
        if (btnCamera) btnCamera.classList.add('hidden'); // Esconde o botão se a câmera estiver proibida
    } else {
        const btnCamera = document.getElementById('btn-modo-camera');
        if (btnCamera) btnCamera.classList.remove('hidden');
        toggleModoFoto('camera');
    }

    // Reset state
    inscricaoArquivos = {};
    inscricaoFotoBase64 = null;

    // Reset stepper to step 1
    document.querySelectorAll('.step-container').forEach(sc => sc.classList.remove('step-visible'));
    const step1 = document.getElementById('step-1');
    if (step1) step1.classList.add('step-visible');
    atualizarStepperUI(1);

    // Carrega listas dinâmicas para dropdowns
    carregarListasInscricao();
}

// ========================================================================
// 9.1. LISTAS DINÂMICAS — POPULAÇÃO DE DROPDOWNS (V10.1 - FASE 03)
// ========================================================================

/**
 * Busca Instituições, Rotas e Bairros 23h da aba Configurações via API
 * e popula os <select> do Smart Stepper. Mantém as opções estáticas
 * ("Selecione..." e "Outra/Outro") intactas.
 */
async function carregarListasInscricao() {
    try {
        const res = await apiCall("getListsInscricao");
        if (!res || !res.sucesso) {
            console.warn("[LISTAS] Falha ao carregar listas dinâmicas:", res ? res.erro : "sem resposta");
            return;
        }

        _popularSelect('insc-instituicao', res.instituicoes || [], 'Outra (Não listada)');
        _popularSelect('insc-rota', res.rotas || [], 'Outra (Não listada)');
        _popularSelect('insc-bairro-23h', res.bairros || [], 'Outro');

        if (res.linkDeclaracaoMenor) {
            const linkMenor = document.getElementById('link-declaracao-menor');
            if (linkMenor) linkMenor.href = res.linkDeclaracaoMenor;
        }

    } catch (err) {
        console.warn("[LISTAS] Erro de rede ao carregar listas:", err);
    }
}

/**
 * Popula um <select> com opções dinâmicas, preservando a primeira opção
 * ("Selecione...") e a última opção fixa (fallback ex: "Outra").
 * @param {string} selectId - ID do elemento <select>.
 * @param {string[]} items - Array de valores a inserir.
 * @param {string} labelFallback - Texto da opção fixa final.
 */
function _popularSelect(selectId, items, labelFallback) {
    const select = document.getElementById(selectId);
    if (!select || !items || !Array.isArray(items) || items.length === 0) return;

    // Preservar a primeira opção ("Selecione...")
    const primeiraOpcao = select.options[0];

    // Limpar tudo
    select.innerHTML = '';

    // Re-inserir placeholder
    select.appendChild(primeiraOpcao);

    // Inserir opções dinâmicas
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
    });

    // Re-inserir opção fixa (fallback) no final
    const optFallback = document.createElement('option');
    optFallback.value = labelFallback;
    optFallback.textContent = labelFallback;
    select.appendChild(optFallback);

    // Garantir que "Selecione..." está ativo
    select.selectedIndex = 0;
}

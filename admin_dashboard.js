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

const CACHE_STATS_KEY = "MAESTRO_DASH_STATS";

async function carregarDashboard() {
    const cachedStatsRaw = localStorage.getItem(CACHE_STATS_KEY);

    if (cachedStatsRaw) {
        const st = JSON.parse(cachedStatsRaw);
        window.dadosBI = st.dataMart || [];
        renderizarDashboardUI(st);
        switchView('view-dashboard');
        gerarChipsDinamicos();

        apiCall("getDashboardStats").then(res => {
            console.warn("🔍 [TELEMETRIA BI] Payload bruto recebido do servidor:");
            console.dir(res);
            
            if (res && res.sucesso === false) {
                console.error("Erro BI: ", res.erro, res.stack);
                showToast("Erro ao carregar os dados analíticos: " + res.erro, "error");
                return;
            }

            // Aceita o objeto puro ou encapsulado
            const statsObj = res.stats || res;

            if (statsObj && statsObj.graficos) {
                localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(statsObj));
                window.dadosBI = statsObj.dataMart || [];
                renderizarDashboardUI(statsObj);
                gerarChipsDinamicos();
                
                const tabAnalise = document.getElementById('tab-analise');
                if (tabAnalise && tabAnalise.classList.contains('active')) {
                    if (typeof renderizarDashboardBI === "function") renderizarDashboardBI();
                }
            }
        }).catch(e => {
            console.error("Erro de Rede BI:", e);
            showToast("Erro ao carregar os dados analíticos: " + e.message, "error");
        });
    } else {
        showToast("A extrair dados para o Dashboard...", "info");
        try {
            const res = await apiCall("getDashboardStats");
            console.warn("🔍 [TELEMETRIA BI] Payload bruto recebido do servidor:");
            console.dir(res);

            if (res && res.sucesso === false) {
                console.error("Erro BI do Servidor: ", res.erro, res.stack);
                showToast("Erro no servidor: " + res.erro, "error");
                return;
            }

            // Aceita o objeto puro ou encapsulado
            const statsObj = res.stats || res;

            if (statsObj && statsObj.graficos) {
                localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(statsObj));
                window.dadosBI = statsObj.dataMart || [];
                renderizarDashboardUI(statsObj);
                switchView('view-dashboard');
                gerarChipsDinamicos();
            }
        } catch (err) {
            console.error("Erro de Rede BI:", err);
            showToast("Erro de ligação aos dados analíticos: " + err.message, "error");
        }
    }
}

/**
 * Renderiza a interface do Dashboard processando os dados e inicializando os gráficos de forma segura.
 * 
 * @param {Object} stats Objeto consolidado vindo de getDashboardStats()
 */
function renderizarDashboardUI(stats) {
    // 1. Guard Clause: Aborta a renderização caso os dados não estejam disponíveis
    if (!stats || !stats.graficos) {
        showToast("Dados do Dashboard indisponíveis.", "error");
        return;
    }

    const graficos = stats.graficos;

    // Atualização dos KPIs superiores
    document.getElementById('kpi-ativos').innerText = stats.kpis.ativos || 0;
    document.getElementById('kpi-pendentes').innerText = stats.kpis.pendentes || 0;
    document.getElementById('kpi-retidos').innerText = stats.kpis.retidos || 0;
    document.getElementById('kpi-suspensos').innerText = stats.kpis.suspensos || 0;

    // Atualização da barra de Uso de IA
    const ocrUsado = stats.consumo?.ocr?.usado || 0;
    const ocrLimite = stats.consumo?.ocr?.limite || 100;
    const pctIA = Math.round((ocrUsado / ocrLimite) * 100);

    const barraIA = document.getElementById('bar-ia-usage');
    if (document.getElementById('kpi-ia-text') && barraIA) {
        document.getElementById('kpi-ia-text').innerText = `${ocrUsado} / ${ocrLimite}`;
        barraIA.style.width = Math.min(pctIA, 100) + "%";
        barraIA.style.background = pctIA > 80 ? "var(--danger)" : "var(--accent)";
    }

    // 2. Prevenção de Memory Leaks: Destrói qualquer gráfico existente
    if (typeof myCharts !== 'undefined') {
        Object.values(myCharts).forEach(chart => {
            if (chart) chart.destroy();
        });
        myCharts = {};
    }

    // 3. Renderização Segura: Tenta renderizar gráficos evitando travamento total em caso de corrupção
    try {
        const baseColor = '#3B82F6';

        // 4. Verificações Condicionais e Renderização (Substitui desenharGraficos)
        if (graficos.status) {
            const st = graficos.status;
            renderChart('chart-status', 'doughnut',
                ["Ativos", "Pendentes", "Retidos (Humana)", "Cancelados/Suspensos"],
                [st["Ativos"] || 0, st["Pendentes"] || 0, st["Retidos (Humana)"] || 0, st["Cancelados/Suspensos"] || 0],
                ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
                { plugins: { legend: { display: true, position: 'right', labels: { color: '#ddd', boxWidth: 12 } } } }
            );
        }

        if (graficos.instituicoes) {
            const inst = extrairEOrdenar(graficos.instituicoes);
            renderChart('chart-instituicoes', 'bar', inst.labels, inst.data, baseColor, { indexAxis: 'y' });
        }

        if (graficos.dias) {
            const dias = extrairEOrdenar(graficos.dias);
            renderChart('chart-dias', 'bar', dias.labels, dias.data, baseColor, { indexAxis: 'y' });
        }

        if (graficos.rotas) {
            const rotas = extrairEOrdenar(graficos.rotas);
            renderChart('chart-rotas', 'bar', rotas.labels, rotas.data, baseColor, { indexAxis: 'y' });
        }

        if (graficos.turnos) {
            const turnos = extrairEOrdenar(graficos.turnos);
            renderChart('chart-turnos', 'bar', turnos.labels, turnos.data, baseColor);
        }

        if (graficos.noturno) {
            if (graficos.noturno.adesao) {
                const adesao = extrairEOrdenar(graficos.noturno.adesao);
                renderChart('chart-adesao-23h', 'doughnut', adesao.labels, adesao.data, ['#FBBF24', '#333333'], { plugins: { legend: { display: true, position: 'bottom', labels: { color: '#ddd', boxWidth: 12 } } } });
            }
            if (graficos.noturno.bairros) {
                const bairros = extrairEOrdenar(graficos.noturno.bairros);
                renderChart('chart-bairros-23h', 'bar', bairros.labels, bairros.data, '#F97316', { indexAxis: 'y' });
            }
        }

        if (graficos.inclusao) {
            const renderInclusao = (canvas, objData) => renderChart(canvas, 'bar', ['Sim', 'Não'], [objData['Sim'] || 0, objData['Não'] || 0], ['#10B981', '#333']);

            if (graficos.inclusao.pcd) renderInclusao('chart-pcd', graficos.inclusao.pcd);
            if (graficos.inclusao.menor) renderInclusao('chart-menor', graficos.inclusao.menor);
            if (graficos.inclusao.acompanhado) renderInclusao('chart-acompanhado', graficos.inclusao.acompanhado);
            if (graficos.inclusao.estagio) renderInclusao('chart-estagio', graficos.inclusao.estagio);
        }

    } catch (erro) {
        console.error("[Dashboard] Ocorreu um erro ao renderizar os gráficos:", erro);
        showToast("Falha parcial ao carregar os gráficos.", "warning");
    }
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
        if (aluno.i) aluno.i.split(',').forEach(v => { if (v.trim()) instituicoes.add(v.trim()); });
        if (aluno.t) aluno.t.split(',').forEach(v => { if (v.trim()) turnos.add(v.trim()); });
        if (aluno.d) {
            aluno.d.split(',').forEach(v => {
                let diaLimpo = normalizarDia(v);
                if (diaLimpo) dias.add(diaLimpo);
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
    if (contInst) contInst.innerHTML = criarHTMLChips(instituicoes, "bi_inst");

    const contTurno = document.getElementById('container-chips-turno');
    if (contTurno) contTurno.innerHTML = criarHTMLChips(turnos, "bi_turno");

    const contDia = document.getElementById('container-chips-dia');
    if (contDia) contDia.innerHTML = criarHTMLChips(dias, "bi_dia");
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

// Export functions to global scope
window.mudarAbaDashboard = mudarAbaDashboard;
window.carregarDashboard = carregarDashboard;
window.renderizarDashboardUI = renderizarDashboardUI;
window.normalizarDia = normalizarDia;
window.gerarChipsDinamicos = gerarChipsDinamicos;
window.toggleChip = toggleChip;
window.renderizarDashboardBI = renderizarDashboardBI;
window.renderChart = renderChart;
window.extrairEOrdenar = extrairEOrdenar;

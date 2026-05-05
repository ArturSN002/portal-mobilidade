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
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    if (typeof currentWalletId === 'undefined' || !currentWalletId) {
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
    showToast("A verificar localização (GPS)...", "loading");

    if (!navigator.geolocation) {
        showToast("O GPS é obrigatório e deve estar exato para embarcar.", "error");
        return;
    }

    try {
        const posicao = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 0
            });
        });

        const lat = posicao.coords.latitude;
        const lng = posicao.coords.longitude;

        showToast("GPS adquirido. A processar lugar...", "loading");

        const res = await apiCall("realizarCheckInOnibus", {
            idOnibus: idOnibus,
            idEstudante: currentWalletId,
            lat: lat,
            lng: lng
        });

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
        if (e instanceof GeolocationPositionError || (e && e.code)) {
            showToast("O GPS é obrigatório e deve estar exato para embarcar.", "error");
        } else {
            showToast("Erro ao processar reserva.", "error");
        }
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

        // --- Injetar CSS de animação ---
        if (!document.getElementById('radar-pulse-css')) {
            const style = document.createElement('style');
            style.id = 'radar-pulse-css';
            style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }`;
            document.head.appendChild(style);
        }

        // --- UI do Guia (Transmissor Ativo) ---
        if (res.isGuia) {
            boxRadar.innerHTML = `
                <div style="text-align:center;">
                   <div style="font-size: 40px; margin-bottom: 10px; animation: pulse 2s infinite;">📡</div>
                   <h4 style="color: var(--success); margin: 0 0 5px 0;">Transmissão Ativa</h4>
                   <p style="font-size: 11px; color: #666; margin-bottom: 5px;">O seu GPS está a guiar os seus colegas.</p>
                   <span style="font-size: 10px; color: var(--primary); font-weight: 600;">${res.totalGuias || 1} guia(s) conectado(s)</span>
                   <button onclick="abdicarSerGuia()" class="btn-solid" style="background: #ef4444; margin: 15px 0 0 0; padding: 8px; font-size: 12px;">Ajudando a comunidade (Parar)</button>
                </div>
            `;
        }
        // --- UI do Passageiro (com ETA Híbrido) ---
        else if (res.guiaAtivo && res.coordenadas) {
            // Silent Recruitment: auto-volunteer se < 5 guias
            if (res.totalGuias === undefined || res.totalGuias < 5) {
                solicitarSerGuia().catch(function () { });
            }

            boxRadar.innerHTML = `
                <div style="text-align: left;">
                   <div style="display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
                      <strong style="color: var(--primary);"><span style="font-size: 14px;">📍</span> Radar ao Vivo</strong>
                      <span style="font-size: 10px; background: #ecfdf5; color: #065f46; padding: 3px 6px; border-radius: 4px;">${res.totalGuias || 1} guia(s)</span>
                   </div>
                   <div id="radar-eta-slot" style="min-height: 60px; display: flex; align-items: center; justify-content: center;">
                      <div><div class="loader" style="margin: 0 auto; width: 15px; height: 15px; border-width: 2px;"></div><p style="font-size: 10px; text-align: center; margin-top: 5px; color: #666;">A calcular ETA...</p></div>
                   </div>
                   <button onclick="atualizarRadarDinamico()" class="btn-text" style="width: 100%; text-align: center; padding: 8px 0 0 0; margin-top: 5px; font-size: 11px;">🔄 Atualizar Agora</button>
                </div>
            `;

            // Fetch posição do passageiro e chamar ETA Híbrido
            _buscarETAHibrido(res.coordenadas);
        }
        // --- Radar Inativo (sem guias) ---
        else {
            // Silent Recruitment: auto-volunteer silenciosamente
            solicitarSerGuia().catch(function () { });

            boxRadar.innerHTML = `
                <div style="text-align: center;">
                   <div style="font-size: 30px; margin-bottom: 10px; filter: grayscale(100%); opacity: 0.5;">📡</div>
                   <h4 style="color: #666; margin: 0 0 5px 0;">Radar Inativo</h4>
                   <p style="font-size: 11px; color: #999; margin-bottom: 15px;">A tentar ligar ao radar comunitário...</p>
                   <button onclick="solicitarSerGuia()" class="btn-solid" style="background: var(--primary); margin: 0; padding: 8px; font-size: 12px;">Seja o Guia (Ligar GPS)</button>
                </div>
            `;
        }
    } catch (e) {
        // Silencioso
    }
}

/**
 * Busca posição do passageiro via Geolocation e chama calcularETAHibrido.
 * Renderiza o resultado no slot #radar-eta-slot com badge de método.
 */
function _buscarETAHibrido(coordenadasBus) {
    const etaSlot = document.getElementById('radar-eta-slot');
    if (!etaSlot) return;

    if (!navigator.geolocation) {
        _renderizarETAFallbackSemGPS(etaSlot, coordenadasBus);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (posPassageiro) {
            const latEst = posPassageiro.coords.latitude;
            const lngEst = posPassageiro.coords.longitude;

            apiCall("calcularETAHibrido", {
                latBus: coordenadasBus.lat,
                lngBus: coordenadasBus.lng,
                latEstudante: latEst,
                lngEstudante: lngEst
            }).then(function (resEta) {
                if (!resEta || !resEta.sucesso) {
                    // Fallback local se API falhar
                    const distLocal = calcularDistanciaHaversine(latEst, lngEst, coordenadasBus.lat, coordenadasBus.lng);
                    _renderizarETANoSlot(etaSlot, distLocal, calcularETA(distLocal), "HAVERSINE_FALLBACK", coordenadasBus.ts);
                    return;
                }
                const etaTexto = resEta.etaMinutos <= 2 ? "A chegar!" : `~ ${resEta.etaMinutos} min`;
                _renderizarETANoSlot(etaSlot, resEta.distanciaKm, etaTexto, resEta.metodo, coordenadasBus.ts);
            }).catch(function () {
                const distLocal = calcularDistanciaHaversine(latEst, lngEst, coordenadasBus.lat, coordenadasBus.lng);
                _renderizarETANoSlot(etaSlot, distLocal, calcularETA(distLocal), "HAVERSINE_FALLBACK", coordenadasBus.ts);
            });
        },
        function () {
            _renderizarETAFallbackSemGPS(etaSlot, coordenadasBus);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
}

/**
 * Renderiza ETA com badge de método no slot.
 */
function _renderizarETANoSlot(slot, distKm, etaTexto, metodo, tsBus) {
    const tempoAtras = calcularTempoRelativo(tsBus);
    let badgeHTML = '';
    if (metodo === 'MAPS_API' || metodo === 'MAPS_CACHE') {
        badgeHTML = '<span style="font-size: 9px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600;">⚡ Tempo Real (Google)</span>';
    } else {
        badgeHTML = '<span style="font-size: 9px; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 600;">📍 Estimativa Matemática</span>';
    }

    const distFormatada = typeof distKm === 'number' ? distKm.toFixed(1) : distKm;

    slot.innerHTML = `
        <div style="width: 100%;">
           <div style="display:flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-size: 12px; color: #666;">Distância:</span>
              <strong style="font-size: 12px;">${distFormatada} km</strong>
           </div>
           <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; color: #666;">Chega em:</span>
              <strong style="font-size: 14px; color: var(--accent);">${etaTexto}</strong>
           </div>
           <div style="display:flex; justify-content: space-between; align-items: center;">
              ${badgeHTML}
              <span style="font-size: 10px; color: #999;">Atualizado: ${tempoAtras}</span>
           </div>
        </div>
    `;
}

/**
 * Fallback quando GPS do passageiro não está disponível.
 */
function _renderizarETAFallbackSemGPS(slot, coordenadasBus) {
    const tempoAtras = calcularTempoRelativo(coordenadasBus.ts);
    slot.innerHTML = `
        <div style="text-align: center; width: 100%;">
           <h4 style="color: var(--primary); margin: 0 0 5px 0; font-size: 13px;">📍 Autocarro em Movimento</h4>
           <p style="font-size: 11px; color: #666; margin-bottom: 8px;">Ative a localização para ver distância e ETA.</p>
           <span style="font-size: 10px; color: #999;">Último sinal: ${tempoAtras}</span>
        </div>
    `;
}

async function solicitarSerGuia() {
    // BLOQUEIO DE PRIVACIDADE: Aborta se o aluno desligou o GPS
    if (localStorage.getItem('MAESTRO_PREF_GPS') === 'false') return;

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
        abdicarSerGuia();
        return;
    }

    // Evitar dupla inicialização
    if (idIntervaloGPS) return;

    try {
        if ('wakeLock' in navigator) {
            wakeLockAtivo = await navigator.wakeLock.request('screen');
        }

        navigator.geolocation.getCurrentPosition(
            function (pos) {
                enviarCoordenadaSegura(pos.coords.latitude, pos.coords.longitude);

                if (idIntervaloGPS) clearInterval(idIntervaloGPS);
                idIntervaloGPS = setInterval(() => {
                    navigator.geolocation.getCurrentPosition(
                        p => enviarCoordenadaSegura(p.coords.latitude, p.coords.longitude),
                        e => console.warn("GPS falhou a leitura.")
                    );
                }, 120000);

                // Silencioso: atualiza radar sem toast
                atualizarRadarDinamico();
            },
            function (err) {
                // GPS negado silenciosamente — não prejudica UX do passageiro
                abdicarSerGuia();
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
    } catch (err) {
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
            console.warn("Servidor rejeitou o GPS (Timeout ou Roubo): " + res.erro);
            pararTransmissaoGpsE_Radar();
            atualizarRadarDinamico();
        }
    }).catch(e => {
        // Silencioso
    });
}

async function abdicarSerGuia() {
    pararTransmissaoGpsE_Radar(false);
    showToast("A libertar GPS...", "loading");
    try {
        await apiCall("abdicarCargoGuia", { idOnibus: onibusSelecionadoGPS, idEstudante: currentWalletId });
        showToast("Transmissão encerrada com segurança.", "info");
        atualizarRadarDinamico();
    } catch (e) {
        atualizarRadarDinamico();
    }
}

function pararTransmissaoGpsE_Radar(matarRadarTambem = true) {
    if (idIntervaloGPS) { clearInterval(idIntervaloGPS); idIntervaloGPS = null; }
    if (matarRadarTambem && idIntervaloRadar) { clearInterval(idIntervaloRadar); idIntervaloRadar = null; }
    if (wakeLockAtivo) { wakeLockAtivo.release().then(() => wakeLockAtivo = null); }
}

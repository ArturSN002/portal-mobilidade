// ========================================================================
// MÓDULO DE FROTA E SOS (V9.2.5)
// ========================================================================

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
    } catch (e) {
        showToast("Erro ao encerrar a rota: " + e.message, "error");
    } finally {
        if (!document.getElementById('modal-encerrar-rota').classList.contains('hidden')) {
            btn.innerHTML = 'TENTAR NOVAMENTE';
            btn.disabled = false;
        }
    }
}

// ------------------------------------------------------------------------
// MOTOR DE CRISES E AVISOS PUSH - PARTE SOS
// ------------------------------------------------------------------------
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
        function (pos) {
            const coord = `${pos.coords.latitude}, ${pos.coords.longitude}`;
            enviarAlarmeCriseAPI(idBus, motivo, coord);
        },
        function (err) {
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
    } catch (e) {
        showToast("Erro ao reportar SOS: " + e.message, "error");
        btn.innerHTML = 'TENTAR NOVAMENTE';
        btn.disabled = false;
    }
}

// Export functions to global scope
window.abrirModalEncerrarRota = abrirModalEncerrarRota;
window.fecharModalEncerrarRota = fecharModalEncerrarRota;
window.dispararEncerramentoRota = dispararEncerramentoRota;
window.abrirModalSOS = abrirModalSOS;
window.fecharModalSOS = fecharModalSOS;
window.confirmarEmergenciaGPS = confirmarEmergenciaGPS;
window.enviarAlarmeCriseAPI = enviarAlarmeCriseAPI;

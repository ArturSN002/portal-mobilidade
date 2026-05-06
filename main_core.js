// ========================================================================
// 1. MOTOR PWA & ARRANQUE DINÂMICO (BOOTSTRAP)
// ========================================================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

async function bootSystem() {
  try {
    const res = await apiCall("getConfiguracoesPWA");

    if (res.sucesso) {
      window.PWA_NOME = res.pwa.NOME;
      window.PWA_ICONE = res.pwa.ICONE;

      // Temas Light/Dark
      window.THEME_LIGHT = { primary: res.ui.COR_PRIMARIA_LIGHT, secondary: res.ui.COR_SECUNDARIA_LIGHT, accent: res.ui.COR_DE_DESTAQUE_LIGHT, logo: res.ui.LOGO_LIGHT };
      window.THEME_DARK = { primary: res.ui.COR_PRIMARIA_DARK, secondary: res.ui.COR_SECUNDARIA_DARK, accent: res.ui.COR_DE_DESTAQUE_DARK, logo: res.ui.LOGO_DARK };

      // Firebase Config Dinâmico "White-Label"
      if (res.firebase) {
        window.FIREBASE_CONFIG = {
          apiKey: res.firebase.API_KEY,
          authDomain: res.firebase.AUTH_DOMAIN,
          projectId: res.firebase.PROJECT_ID,
          storageBucket: res.firebase.STORAGE_BUCKET,
          messagingSenderId: res.firebase.MESSAGING_SENDER_ID,
          appId: res.firebase.APP_ID
        };
        window.FIREBASE_VAPID_KEY = res.firebase.VAPID_KEY;
      }

      document.title = window.PWA_NOME;
      if (typeof aplicarTemaAtual === 'function') aplicarTemaAtual();

      const elNome = document.getElementById('ui-nome-sistema');
      if (elNome) elNome.innerText = window.PWA_NOME.toUpperCase();

      const elSetor = document.getElementById('ui-nome-setor');
      if (elSetor) elSetor.innerText = res.ui.NOME_SISTEMA;

      const elEnd = document.getElementById('ui-endereco');
      if (elEnd && res.contato.ENDERECO) { elEnd.innerText = res.contato.ENDERECO; elEnd.classList.remove('hidden'); }

      const elEmail = document.getElementById('ui-email');
      if (elEmail && res.contato.EMAIL) { elEmail.innerText = res.contato.EMAIL; elEmail.classList.remove('hidden'); }

      const elCnpj = document.getElementById('ui-cnpj');
      if (elCnpj && res.contato.CNPJ) { elCnpj.innerText = "CNPJ: " + res.contato.CNPJ; elCnpj.classList.remove('hidden'); }

      initPWA();
    }
  } catch (e) {
    console.warn("A arrancar em modo offline persistente.");
  }

  const lastView = sessionStorage.getItem('MAESTRO_LAST_VIEW') || 'view-hub';
  switchView(lastView);

  carregarAvisosSMEB();
  verificarSessaoAtiva();
  restaurarSessaoEstudante();

  ocultarSplashScreen();
}

function ocultarSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
}

function initPWA() {
  if (!window.PWA_NOME) return;

  if ('serviceWorker' in navigator) {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
      const swUrl = `./sw.js?apiKey=${window.FIREBASE_CONFIG.apiKey}&projectId=${window.FIREBASE_CONFIG.projectId}&senderId=${window.FIREBASE_CONFIG.messagingSenderId}&appId=${window.FIREBASE_CONFIG.appId}`;

      navigator.serviceWorker.register(swUrl)
        .then(registration => {
          console.log('SW registado com sucesso com chaves dinâmicas!', registration.scope);
        })
        .catch(err => {
          console.log('Falha ao registar SW:', err);
        });

    } else {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('SW registado em modo apenas-offline.'));
    }
  }
}

function instalarPWA() {
  if (!deferredPrompt) {
    showToast("Não é possível instalar neste dispositivo ou já está instalado.", "info");
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('hidden');
      showToast("App instalada! Procure o ícone no seu ecrã principal.", "success");
    }
    deferredPrompt = null;
  });
}

function switchView(viewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => {
    v.classList.remove('active-view');
    v.classList.remove('slide-in-right');
    v.style.display = 'none';
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    setTimeout(() => {
      target.classList.add('active-view');
      target.classList.add('slide-in-right');
    }, 10);

    sessionStorage.setItem('MAESTRO_LAST_VIEW', viewId);
  }

  const muralAvisos = document.getElementById('mural-avisos');
  const muralHeader = document.getElementById('mural-avisos-header');

  if (muralAvisos && muralAvisos.innerHTML.trim() !== '') {
    if (viewId === 'view-hub' || viewId === 'view-admin-hub' || viewId === 'view-aluno-menu') {
      muralAvisos.classList.remove('hidden');
      if (muralHeader) muralHeader.classList.remove('hidden');
    } else {
      muralAvisos.classList.add('hidden');
      if (muralHeader) muralHeader.classList.add('hidden');
    }
  }
}

async function carregarAvisosSMEB() {
  try {
    const res = await apiCall("getAvisosAtivos");
    const container = document.getElementById('mural-avisos');
    const header = document.getElementById('mural-avisos-header');

    if (!res || !res.avisos || res.avisos.length === 0) {
      if (container) container.classList.add('hidden');
      if (header) header.classList.add('hidden');
      return;
    }

    let html = '';
    res.avisos.forEach(function (aviso) {
      let classeTipo = 'aviso-geral';
      const tipoNormalizado = aviso.tipo.toLowerCase().trim();
      if (tipoNormalizado === 'urgente') classeTipo = 'aviso-urgente';
      if (tipoNormalizado === 'transporte') classeTipo = 'aviso-transporte';

      html += `<div class="aviso-card ${classeTipo}">`;
      if (aviso.imagem) html += `<img src="${aviso.imagem}" class="aviso-imagem" alt="Aviso">`;
      html += `<span class="aviso-tag">${aviso.tipo}</span>`;
      html += `<h4 class="aviso-titulo">${aviso.titulo}</h4>`;
      if (aviso.assunto) html += `<p class="aviso-texto">${aviso.assunto}</p>`;
      if (aviso.anexo) html += `<a href="${aviso.anexo}" target="_blank" class="aviso-btn-anexo">📄 Baixar Documento</a>`;
      html += `</div>`;
    });

    if (container) {
      container.innerHTML = html;
      container.classList.remove('hidden');
    }
    if (header) header.classList.remove('hidden');
  } catch (e) {
    // Silencia se offline
  }
}

// ========================================================================
// 12. UTILITÁRIOS GLOBAIS
// ========================================================================

let toastTimeout;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.style.background = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : type === 'warning' ? '#f59e0b' : '#333';
  toast.style.display = 'block';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

async function inicializarPushNotifications() {
  const desligarTogglePush = (mensagem) => {
    localStorage.setItem('MAESTRO_PREF_PUSH', 'false');
    const togglePush = document.getElementById('pref-push');
    if (togglePush) togglePush.checked = false;
    if (mensagem) showToast(mensagem, "error");
  };

  if (localStorage.getItem('MAESTRO_PREF_PUSH') === 'false') return;

  if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
    console.warn("Chaves do Firebase não configuradas na planilha.");
    desligarTogglePush("Chaves do Firebase ausentes no sistema.");
    return;
  }

  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
  } catch (e) {
    console.warn("Firebase Init falhou:", e);
    desligarTogglePush("Erro ao iniciar Firebase. Verifique as chaves.");
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof firebase === 'undefined') {
    desligarTogglePush("Notificações não suportadas neste navegador.");
    return;
  }

  try {
    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const swRegistration = await navigator.serviceWorker.ready;
      messaging.useServiceWorker(swRegistration);

      messaging.onMessage((payload) => {
        console.log('Mensagem recebida em primeiro plano:', payload);
        const notificationObj = payload.notification || payload.data || {};
        const titulo = notificationObj.title || "Novo Aviso";
        const corpo = notificationObj.body || "Você tem uma nova mensagem.";
        showToast(`🔔 ${titulo}: ${corpo}`, "info");
      });

      const opcoesToken = window.FIREBASE_VAPID_KEY ? { vapidKey: window.FIREBASE_VAPID_KEY } : {};
      const token = await messaging.getToken(opcoesToken);

      if (token) {
        localStorage.setItem("MAESTRO_FCM_TOKEN_TEMP", token);
        if (typeof currentWalletId !== 'undefined' && currentWalletId !== "") {
          if (typeof registrarTokenPush === 'function') await registrarTokenPush(token);
        }
        showToast("Notificações ativadas com sucesso!", "success");
      }
    } else {
      desligarTogglePush("Permissão negada no navegador.");
    }
  } catch (error) {
    console.warn("Falha de Push:", error);
    desligarTogglePush("Falha ao gerar Token. Verifique as configurações do Firebase.");
  }
}

async function registrarTokenPush(token) {
  if (!currentWalletId) return;
  try {
    const res = await apiCall("registrarPushToken", {
      idEstudante: currentWalletId,
      pushToken: token,
      tokenDispositivo: token
    });

    if (res.sucesso) {
      localStorage.setItem("MAESTRO_FCM_TOKEN", token);
      localStorage.setItem("FCM_SYNCED_ID", currentWalletId);
    }
  } catch (err) { console.error("Erro ao registrar token", err); }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('MAESTRO_DARK_MODE', isDark ? 'true' : 'false');
  if (typeof aplicarTemaAtual === 'function') aplicarTemaAtual();
}

function aplicarTemaAtual() {
  if (!window.THEME_LIGHT || !window.THEME_DARK) return;

  const isDark = document.body.classList.contains('dark-theme');
  const theme = isDark ? window.THEME_DARK : window.THEME_LIGHT;

  document.body.style.setProperty('--primary', theme.primary, 'important');
  document.body.style.setProperty('--secondary', theme.secondary, 'important');
  document.body.style.setProperty('--accent', theme.accent, 'important');

  window.THEME_COLOR = theme.primary;
  window.BG_COLOR = theme.secondary;

  const metaThemeColor = document.getElementById('meta-theme-color');
  if (metaThemeColor) metaThemeColor.content = theme.primary;

  if (theme.logo && theme.logo !== "") {
    const logoEl = document.getElementById('ui-logo');
    const splashLogo = document.getElementById('splash-logo');
    if (logoEl) { logoEl.src = theme.logo; logoEl.classList.remove('hidden'); }
    if (splashLogo) { splashLogo.src = theme.logo; splashLogo.classList.remove('hidden'); }
  }
}

window.onload = function () {
  if (localStorage.getItem('MAESTRO_DARK_MODE') === 'true') {
    document.body.classList.add('dark-theme');
  }

  if(typeof checkClientGateway === 'function') checkClientGateway();

  const urlParams = new URLSearchParams(window.location.search);
  const idParam = urlParams.get('id');
  const authParam = urlParams.get('auth');
  const validarParam = urlParams.get('validar');

  if (validarParam) {
    setTimeout(() => {
      switchView('view-validador');
      const inputHash = document.getElementById('input-hash-validador');
      if (inputHash) inputHash.value = validarParam.toUpperCase();
      if(typeof verificarHashPublico === 'function') verificarHashPublico();
    }, 800);
  } else if (idParam || authParam === 'login') {
    setTimeout(() => {
      switchView('view-login');
      const loginId = document.getElementById('login-id');
      if (loginId && idParam) loginId.value = idParam;
    }, 500);
  }
};

// ========================================================================
// MENU DE CONFIGURAÇÕES (BOTTOM SHEET)
// ========================================================================

function abrirMenuConfiguracoes() {
  const modal = document.getElementById('modal-configuracoes');
  if (!modal) return;
  modal.classList.remove('hidden');

  document.getElementById('pref-dark').checked = document.body.classList.contains('dark-theme');

  const pushPermitido = ('Notification' in window) && (Notification.permission === 'granted');
  document.getElementById('pref-push').checked = (localStorage.getItem('MAESTRO_PREF_PUSH') === 'true' && pushPermitido);

  document.getElementById('pref-gps').checked = localStorage.getItem('MAESTRO_PREF_GPS') === 'true';
  document.getElementById('pref-camera').checked = localStorage.getItem('MAESTRO_PREF_CAMERA') !== 'false';
  document.getElementById('pref-offline').checked = localStorage.getItem('MAESTRO_PREF_OFFLINE') === 'true';

  void modal.offsetWidth;
  modal.classList.add('active');
}

async function togglePref(tipo, elemento) {
  const isLigado = elemento.checked;

  if (tipo === 'push') {
    if (isLigado) {
      localStorage.setItem('MAESTRO_PREF_PUSH', 'true');
      showToast("A pedir permissão...", "loading");
      if (typeof inicializarPushNotifications === 'function') inicializarPushNotifications();
    } else {
      localStorage.setItem('MAESTRO_PREF_PUSH', 'false');
      showToast("Notificações silenciadas.", "info");

      const tokenLocal = localStorage.getItem("MAESTRO_FCM_TOKEN");
      if (tokenLocal && typeof currentWalletId !== 'undefined' && currentWalletId) {
        try { await apiCall("registrarPushToken", { idEstudante: currentWalletId, pushToken: "" }); } catch (e) { }
      }
      localStorage.removeItem("MAESTRO_FCM_TOKEN");
      localStorage.removeItem("FCM_SYNCED_ID");
    }
  }
  else if (tipo === 'gps') {
    localStorage.setItem('MAESTRO_PREF_GPS', isLigado ? 'true' : 'false');
    if (!isLigado && typeof abdicarSerGuia === 'function') abdicarSerGuia();
    showToast(isLigado ? "GPS permitido na viagem." : "Partilha de GPS bloqueada.", "info");
  }
  else if (tipo === 'camera') {
    localStorage.setItem('MAESTRO_PREF_CAMERA', isLigado ? 'true' : 'false');
    showToast(isLigado ? "Acesso à câmara ativo." : "Câmera desativada (Usará upload).", "info");
  }
  else if (tipo === 'offline') {
    localStorage.setItem('MAESTRO_PREF_OFFLINE', isLigado ? 'true' : 'false');
    showToast(isLigado ? "Modo Offline Forçado ativo." : "Modo Online restaurado.", "warning");
    if (isLigado && typeof abrirTelaCofreOuEntrarDireto === 'function') {
      fecharMenuConfiguracoes();
      abrirTelaCofreOuEntrarDireto();
    }
  }
}

function fecharMenuConfiguracoes() {
  const modal = document.getElementById('modal-configuracoes');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function navegarPeloMenu(viewId) {
  fecharMenuConfiguracoes();
  setTimeout(() => {
    switchView(viewId);
  }, 300);
}

/**
 * ============================================================================
 * MÓDULO LOGÍSTICA: NÓ MESTRE (MOTORISTA) - PWA ONLY (Wake Lock)
 * ============================================================================
 */

let watchIdMotorista = null;
let wakeLockMotorista = null;
let ultimaTransmissaoMestre = 0;

/**
 * Acionado quando o motorista clica em "Iniciar Rota" na interface.
 * @param {string} idOnibus - A placa do ônibus (ex: ABC-1234)
 */
async function btnIniciarRotaMotorista(idOnibus) {
    const emailMotorista = localStorage.getItem("MAESTRO_OPERADOR_EMAIL") || "motorista@desconhecido.com";

    // 1. Avisa o Back-end (Google Apps Script)
    const res = await apiCall("iniciarRotaMotorista", {
        idOnibus: idOnibus,
        usuarioLogadoId: emailMotorista
    });

    if (res.sucesso) {
        showToast("Rota iniciada! Modo Viagem ativado.", "success");

        // 2. Aciona o Modo Viagem 100% Web PWA
        await ativarModoViagemPWA(idOnibus, emailMotorista);

        // 3. Atualizar a Interface Visual do Motorista
        // renderizarEstadoPainelMotorista(true, idOnibus);
    } else {
        showToast("Erro ao iniciar rota: " + res.erro, "error");
    }
}

/**
 * Acionado quando o motorista clica em "Finalizar Rota".
 * @param {string} idOnibus - A placa do ônibus
 */
async function btnFinalizarRotaMotorista(idOnibus) {
    // 1. Avisa o Back-end para encerrar a viagem
    const res = await apiCall("encerrarRotaManual", {
        idOnibus: idOnibus
    });

    if (res.sucesso) {
        showToast("Rota encerrada com sucesso.", "info");

        // 2. Desativa o Modo Viagem Web
        desativarModoViagemPWA();

        // 3. Atualizar a Interface
        // renderizarEstadoPainelMotorista(false, null);
    } else {
        showToast("Erro ao finalizar rota: " + res.erro, "error");
    }
}

/**
 * Ativa o "Modo Viagem" no Front-end para o Motorista.
 * Mantém o ecrã ligado e transmite o GPS a cada 10 segundos.
 */
async function ativarModoViagemPWA(idOnibus, emailMotorista) {
    // 1. Aplicar a "Tela Preta" para poupar bateria e evitar burn-in
    document.body.classList.add('modo-viagem-ativo');
    
    // 2. Solicitar Wake Lock (Manter ecrã ligado)
    try {
        if ('wakeLock' in navigator) {
            wakeLockMotorista = await navigator.wakeLock.request('screen');
            console.log("Wake Lock ativado: Ecrã permanecerá ligado.");
            
            // Se o utilizador minimizar e voltar, precisamos de pedir o Wake Lock novamente
            document.addEventListener('visibilitychange', lidarComMudancaVisibilidade);
        }
    } catch (err) {
        console.warn("Wake Lock não suportado ou falhou:", err);
        showToast("Atenção: O ecrã poderá apagar-se neste dispositivo.", "warning");
    }

    // 3. Iniciar Transmissão Contínua de GPS
    if (navigator.geolocation) {
        watchIdMotorista = navigator.geolocation.watchPosition(
            (pos) => {
                const agora = Date.now();
                // Throttle: Só envia para a API a cada 10 segundos (10000 ms)
                if (agora - ultimaTransmissaoMestre > 10000) {
                    apiCall("atualizarGPSOnibus", {
                        idOnibus: idOnibus,
                        usuarioLogadoId: emailMotorista,
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                    ultimaTransmissaoMestre = agora;
                    
                    // Feedback visual discreto de que está a transmitir
                    const indicador = document.getElementById('indicador-gps-mestre');
                    if(indicador) indicador.style.opacity = (indicador.style.opacity == '1' ? '0.5' : '1');
                }
            },
            (err) => console.error("Erro no GPS do Mestre:", err),
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    } else {
        showToast("Geolocalização não suportada neste navegador.", "error");
    }
}

/**
 * Encerra o "Modo Viagem", limpa rastreios e liberta o ecrã.
 */
function desativarModoViagemPWA() {
    // Remover Tela Preta
    document.body.classList.remove('modo-viagem-ativo');
    
    // Parar GPS
    if (watchIdMotorista !== null) {
        navigator.geolocation.clearWatch(watchIdMotorista);
        watchIdMotorista = null;
    }
    
    // Libertar Wake Lock
    if (wakeLockMotorista !== null) {
        wakeLockMotorista.release().then(() => {
            wakeLockMotorista = null;
            console.log("Wake Lock libertado.");
        });
    }
    document.removeEventListener('visibilitychange', lidarComMudancaVisibilidade);
}

// Reativa o Wake Lock caso a aba fique em background e volte
async function lidarComMudancaVisibilidade() {
    if (wakeLockMotorista === null && document.visibilityState === 'visible' && document.body.classList.contains('modo-viagem-ativo')) {
        try {
            wakeLockMotorista = await navigator.wakeLock.request('screen');
            console.log("Wake Lock restaurado.");
        } catch (err) {
            console.warn("Falha ao restaurar Wake Lock:", err);
        }
    }
}

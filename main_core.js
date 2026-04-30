// ========================================================================
// 1. MOTOR PWA & ARRANQUE DINÂMICO (BOOTSTRAP)
// ========================================================================

let deferredPrompt; 

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('hidden');
});

async function bootSystem() {
  try {
    const res = await apiCall("getConfiguracoesPWA");
    
    if (res.sucesso) {
      window.PWA_NOME = res.pwa.NOME;
      window.PWA_ICONE = res.pwa.ICONE;
      window.THEME_COLOR = res.ui.COR_PRIMARIA;
      window.BG_COLOR = res.ui.COR_SECUNDARIA;
      
      document.title = window.PWA_NOME;
      
      document.documentElement.style.setProperty('--primary', res.ui.COR_PRIMARIA);
      document.documentElement.style.setProperty('--secondary', res.ui.COR_SECUNDARIA);
      document.documentElement.style.setProperty('--accent', res.ui.COR_DE_DESTAQUE);

      if (res.ui.LOGO && res.ui.LOGO !== "") {
        const logoEl = document.getElementById('ui-logo');
        const splashLogo = document.getElementById('splash-logo');
        if (logoEl) { logoEl.src = res.ui.LOGO; logoEl.classList.remove('hidden'); }
        if (splashLogo) { splashLogo.src = res.ui.LOGO; splashLogo.classList.remove('hidden'); }
      }
      
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
  } catch(e) {
    console.warn("A arrancar em modo offline persistente.");
  }
  
  ocultarSplashScreen();
  carregarAvisosSMEB(); 
  verificarSessaoAtiva();
  restaurarSessaoEstudante();
}

function ocultarSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
}

function initPWA() {
  if(!window.PWA_NOME) return; 

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registado.'))
      .catch(err => console.log('Erro no SW:', err));
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
      document.getElementById('pwa-install-banner').classList.add('hidden');
      showToast("App instalada! Procure o ícone no seu ecrã principal.", "success");
    }
    deferredPrompt = null; 
  });
}

function switchView(viewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => {
    v.classList.remove('active-view');
    v.style.display = 'none';
  });
  
  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active-view'), 10);
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
    const avisos = res.avisos;
    
    if (!avisos || avisos.length === 0) {
      container.classList.add('hidden');
      if (header) header.classList.add('hidden');
      return;
    }

    let html = '';
    avisos.forEach(function(aviso) {
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

    container.innerHTML = html;
    container.classList.remove('hidden'); 
    if (header) header.classList.remove('hidden');
  } catch(e) {
     console.log("Avisos não carregados.");
  }
}

// ========================================================================
// 12. UTILITÁRIOS GLOBAIS
// ========================================================================

let toastTimeout;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.style.background = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : type === 'warning' ? '#f59e0b' : '#333';
  toast.style.display = 'block';
  
  if(toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

async function inicializarPushNotifications() {
  const firebaseConfig = {
    apiKey: "COLE_SUA_API_KEY",
    authDomain: "COLE_SEU_PROJECT_ID.firebaseapp.com",
    projectId: "COLE_SEU_PROJECT_ID",
    storageBucket: "COLE_SEU_PROJECT_ID.appspot.com",
    messagingSenderId: "COLE_SEU_SENDER_ID",
    appId: "COLE_SEU_APP_ID"
  };

  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch(e) { console.warn("Firebase Init falhou:", e); return; }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof firebase === 'undefined') {
     console.log("Push não suportado ou Firebase não carregado.");
     return;
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone) return; 

  try {
    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await messaging.getToken({ vapidKey: window.FIREBASE_VAPID_KEY });
      if (token) {
         const tokenSalvoLocal = localStorage.getItem("MAESTRO_FCM_TOKEN");
         if (token !== tokenSalvoLocal || !localStorage.getItem("FCM_SYNCED_ID")) {
            await registrarTokenPush(token);
         }
      }
    }
  } catch (error) {
    console.warn("Permissão de Push negada ou falhou:", error);
  }
}

async function registrarTokenPush(token) {
  if (!currentWalletId) return;
  try {
     const res = await apiCall("registrarPushToken", { idEstudante: currentWalletId, pushToken: token });
     if (res.sucesso) {
        localStorage.setItem("MAESTRO_FCM_TOKEN", token);
        localStorage.setItem("FCM_SYNCED_ID", currentWalletId);
     }
  } catch (err) {}
}

window.onload = function() {
  bootSystem(); 
};

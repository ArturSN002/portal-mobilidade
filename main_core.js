// ========================================================================
// 1. MOTOR PWA & ARRANQUE DINÂMICO (BOOTSTRAP)
// ========================================================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Apenas mostramos o banner após a App ter carregado com sucesso (evita spam no boot).
  // Movido para dentro do bootSystem() na via de sucesso.
});

async function bootSystem() {
  if (!navigator.onLine) {
    const offlineWallet = localStorage.getItem("MAESTRO_OFFLINE_WALLET");
    if (offlineWallet) {
      showToast("Modo Offline Ativado. Funções limitadas.", "warning");
      ocultarSplashScreen();
      switchView('view-wallet');
      if (typeof renderizarCarteiraOffline === "function") {
        renderizarCarteiraOffline(JSON.parse(offlineWallet));
      }
      return;
    }
  }

  try {
    const res = await apiCall("getConfiguracoesPWA");

    if (res.sucesso) {
      window.PWA_NOME = res.pwa.NOME;
      window.PWA_ICONE = res.pwa.ICONE;
      
      // 1. Guardar os dois temas na memória global
      window.THEME_LIGHT = { 
        primary: res.ui.COR_PRIMARIA_LIGHT, 
        secondary: res.ui.COR_SECUNDARIA_LIGHT, 
        accent: res.ui.COR_DE_DESTAQUE_LIGHT, 
        logo: res.ui.LOGO_LIGHT 
      };
      
      window.THEME_DARK = { 
        primary: res.ui.COR_PRIMARIA_DARK, 
        secondary: res.ui.COR_SECUNDARIA_DARK, 
        accent: res.ui.COR_DE_DESTAQUE_DARK, 
        logo: res.ui.LOGO_DARK 
      };

      document.title = window.PWA_NOME;

      // 2. Aplicar o tema atual baseado na preferência do utilizador
      aplicarTemaAtual();

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
      
      // UX: Apenas sugere a instalação se tudo carregou com sucesso e o banner existe
      if (deferredPrompt) {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.remove('hidden');
      }
      
      carregarAvisosSMEB();
    }
  } catch (e) {
    // Falha silenciosa amigável, permite o uso da PWA no modo offline
  }

  ocultarSplashScreen();
  switchView('view-hub');
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
  if (!window.PWA_NOME) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => {
         // Silencia erros de SW em produção
      });
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

// Inicialização das Push Notifications foi adaptada para ser chamada após consentimento (no estudante.js)
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
  } catch (e) { return; }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof firebase === 'undefined') {
    return;
  }

  // Só permite Push se a app estiver instalada como PWA (standalone)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone) return;

  try {
    const messaging = firebase.messaging();
    
    // IMPORTANTE: Só tenta buscar token se o utilizador já tiver concedido permissão prévia
    if (Notification.permission === 'granted') {
      const token = await messaging.getToken({ vapidKey: window.FIREBASE_VAPID_KEY });
      if (token) {
        const tokenSalvoLocal = localStorage.getItem("MAESTRO_FCM_TOKEN");
        if (token !== tokenSalvoLocal || !localStorage.getItem("FCM_SYNCED_ID")) {
          await registrarTokenPush(token);
        }
      }
    }
  } catch (error) {
    // Permissão não concedida ou erro
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
  } catch (err) { }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('MAESTRO_DARK_MODE', isDark ? 'true' : 'false');
  
  // Atualiza as cores e o logótipo em tempo real
  if (typeof aplicarTemaAtual === 'function') aplicarTemaAtual();
}

// NOVA FUNÇÃO: Motor injetor de CSS e Logo
// NOVA FUNÇÃO: Motor injetor de CSS e Logo
function aplicarTemaAtual() {
  if (!window.THEME_LIGHT || !window.THEME_DARK) return;
  
  const isDark = document.body.classList.contains('dark-theme');
  const theme = isDark ? window.THEME_DARK : window.THEME_LIGHT;
  
  // Aplicar diretamente no BODY com 'important' para sobrepor o style.css
  document.body.style.setProperty('--primary', theme.primary, 'important');
  document.body.style.setProperty('--secondary', theme.secondary, 'important');
  document.body.style.setProperty('--accent', theme.accent, 'important');
  
  // Salva para o cache offline da Carteira
  window.THEME_COLOR = theme.primary;
  window.BG_COLOR = theme.secondary;
  
  // Atualiza a cor da barra de status do telemóvel
  const metaThemeColor = document.getElementById('meta-theme-color');
  if (metaThemeColor) metaThemeColor.content = theme.primary;
  
  // Alterna o Logótipo (Claro/Escuro)
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

  checkClientGateway();

  const urlParams = new URLSearchParams(window.location.search);
  const idParam = urlParams.get('id');
  const authParam = urlParams.get('auth');
  const validarParam = urlParams.get('validar');

  if (validarParam) {
    // Cartório Digital: Auto-validação via QR Code / Link direto
    setTimeout(() => {
      switchView('view-validador');
      const inputHash = document.getElementById('input-hash-validador');
      if (inputHash) inputHash.value = validarParam.toUpperCase();
      verificarHashPublico();
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
// CARTÓRIO DIGITAL — VERIFICAÇÃO PÚBLICA DE DOCUMENTOS (V10.1)
// ========================================================================

let scannerPublico = null;

function iniciarScannerPublico() {
  const container = document.getElementById('leitor-qr-publico-container');
  const btn = document.getElementById('btn-scanner-publico');
  
  if (container) container.classList.remove('hidden');
  if (btn) btn.classList.add('hidden');
  
  if (typeof Html5QrcodeScanner !== 'undefined') {
    scannerPublico = new Html5QrcodeScanner(
      "leitor-qr-publico", { fps: 10, qrbox: 250 }, false);
    
    scannerPublico.render((decodedText, decodedResult) => {
      // Sucesso na leitura
      fecharScannerPublico();
      const input = document.getElementById('input-hash-validador');
      if (input) {
        input.value = decodedText;
        verificarHashPublico();
      }
    }, (error) => {
      // Ignorar erros de scan contínuo
    });
  } else {
    showToast("Módulo de leitura QR não carregado.", "error");
    fecharScannerPublico();
  }
}

function fecharScannerPublico() {
  const container = document.getElementById('leitor-qr-publico-container');
  const btn = document.getElementById('btn-scanner-publico');
  
  if (scannerPublico) {
    scannerPublico.clear().catch(error => console.error("Falha a limpar scanner público", error));
    scannerPublico = null;
  }
  
  if (container) container.classList.add('hidden');
  if (btn) btn.classList.remove('hidden');
}

function verificarHashPublico() {
  const input = document.getElementById('input-hash-validador');
  const container = document.getElementById('res-validador');
  if (!input || !container) return;

  const hash = input.value.trim().toUpperCase();
  if (!hash) {
    showToast("Informe o código de validação.", "error");
    return;
  }

  container.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loader" style="margin: 0 auto;"></div><p style="font-size: 12px; color: var(--text-sub); margin-top: 10px;">A verificar autenticidade...</p></div>';

  apiCall("validarDocumentoPublico", { hash: hash })
    .then(res => {
      if (res.sucesso && res.tipo === "CARTEIRA") {
        if (res.valido) {
            container.innerHTML = `
              <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 42px; margin-bottom: 8px;">✅</div>
                <h3 style="color: #15803d; margin: 0 0 5px 0; font-size: 16px;">Carteira de Estudante Válida</h3>
                <div style="text-align: left; font-size: 14px; line-height: 1.8; color: #1e293b; margin-top: 15px;">
                  <div><strong>Nome:</strong> ${res.nome}</div>
                  <div><strong>Status:</strong> <span style="color: #22c55e; font-weight: 700;">● ${res.status}</span></div>
                </div>
              </div>`;
        } else {
            const corStatus = res.status === 'CANCELADO' ? '#dc2626' : '#f59e0b';
            container.innerHTML = `
              <div style="background: #fefce8; border: 2px solid ${corStatus}; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 42px; margin-bottom: 8px;">⚠️</div>
                <h3 style="color: #92400e; margin: 0 0 5px 0; font-size: 16px;">Carteira Inativa</h3>
                <div style="text-align: left; font-size: 14px; line-height: 1.8; color: #1e293b; margin-top: 15px;">
                  <div><strong>Nome:</strong> ${res.nome}</div>
                  <div><strong>Status:</strong> <span style="color: ${corStatus}; font-weight: 700;">● ${res.status}</span></div>
                </div>
              </div>`;
        }
      } else if (res.sucesso && res.tipo === "DECLARACAO") {
        if (res.valido) {
            // DOCUMENTO VÁLIDO E ATIVO
            container.innerHTML = `
              <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 42px; margin-bottom: 8px;">✅</div>
                <h3 style="color: #15803d; margin: 0 0 5px 0; font-size: 16px;">Documento Autêntico e Ativo</h3>
                <p style="font-size: 11px; color: #166534; margin-bottom: 15px;">Verificação realizada com sucesso.</p>
                <div style="text-align: left; font-size: 13px; line-height: 2; color: #1e293b;">
                  <div><strong>Nome:</strong> ${res.nome}</div>
                  <div><strong>CPF:</strong> ${res.cpfMascarado}</div>
                  <div><strong>Instituição:</strong> ${res.instituicao}</div>
                  <div><strong>Status:</strong> <span style="color: #22c55e; font-weight: 700;">● ${res.status}</span></div>
                  <div><strong>Emissão:</strong> ${res.emissao || 'N/D'}</div>
                  <div style="font-size: 11px; color: #6b7280; margin-top: 8px; padding-top: 8px; border-top: 1px solid #d1fae5;">Código: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${res.hash}</code></div>
                </div>
              </div>`;
          } else {
            // DOCUMENTO ENCONTRADO MAS INATIVO / REVOGADO
            const corStatus = res.status === 'CANCELADO' ? '#dc2626' : '#f59e0b';
            const labelStatus = res.status === 'CANCELADO' ? 'Cancelado' : res.status === 'SUSPENSO' ? 'Suspenso' : 'Inativo';
            container.innerHTML = `
              <div style="background: #fefce8; border: 2px solid ${corStatus}; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 42px; margin-bottom: 8px;">⚠️</div>
                <h3 style="color: #92400e; margin: 0 0 5px 0; font-size: 16px;">Documento Revogado</h3>
                <p style="font-size: 11px; color: #78350f; margin-bottom: 15px;">Este documento não é mais válido.</p>
                <div style="text-align: left; font-size: 13px; line-height: 2; color: #1e293b;">
                  <div><strong>Nome:</strong> ${res.nome}</div>
                  <div><strong>CPF:</strong> ${res.cpfMascarado}</div>
                  <div><strong>Instituição:</strong> ${res.instituicao}</div>
                  <div><strong>Status:</strong> <span style="color: ${corStatus}; font-weight: 700;">● ${labelStatus}</span></div>
                  <div style="font-size: 11px; color: #6b7280; margin-top: 8px; padding-top: 8px; border-top: 1px solid #fde68a;">Código: <code style="background: #fef9c3; padding: 2px 6px; border-radius: 4px;">${res.hash}</code></div>
                </div>
              </div>`;
          }
      } else {
        // HASH NÃO ENCONTRADO
        container.innerHTML = `
          <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 42px; margin-bottom: 8px;">❌</div>
            <h3 style="color: #991b1b; margin: 0 0 5px 0; font-size: 16px;">Documento Não Encontrado</h3>
            <p style="font-size: 12px; color: #7f1d1d; margin: 0;">O código informado não corresponde a nenhuma declaração válida no sistema. Verifique se digitou corretamente.</p>
          </div>`;
      }
    })
    .catch(err => {
      console.error("Erro na validação:", err);
      container.innerHTML = `
        <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 42px; margin-bottom: 8px;">⚡</div>
          <h3 style="color: #991b1b; margin: 0 0 5px 0; font-size: 16px;">Erro de Conexão</h3>
          <p style="font-size: 12px; color: #7f1d1d; margin: 0;">Não foi possível contactar o servidor. Verifique a sua ligação e tente novamente.</p>
        </div>`;
    });
}

// ========================================================================
// MENU DE CONFIGURAÇÕES (BOTTOM SHEET)
// ========================================================================

function abrirMenuConfiguracoes() {
  const modal = document.getElementById('modal-configuracoes');
  if (!modal) return;
  modal.classList.remove('hidden');
  
  // Lê as preferências do telemóvel ao abrir o menu
  document.getElementById('pref-dark').checked = document.body.classList.contains('dark-theme');
  document.getElementById('pref-push').checked = localStorage.getItem('MAESTRO_PREF_PUSH') !== 'false';
  document.getElementById('pref-gps').checked = localStorage.getItem('MAESTRO_PREF_GPS') !== 'false';
  document.getElementById('pref-camera').checked = localStorage.getItem('MAESTRO_PREF_CAMERA') !== 'false';
  document.getElementById('pref-offline').checked = localStorage.getItem('MAESTRO_PREF_OFFLINE') === 'true';
  
  void modal.offsetWidth; // force reflow
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
            
            // Apaga o token localmente e envia o comando vazio para a API apagar na planilha
            const tokenLocal = localStorage.getItem("MAESTRO_FCM_TOKEN");
            if (tokenLocal && typeof currentWalletId !== 'undefined' && currentWalletId) {
                try { await apiCall("registrarPushToken", { idEstudante: currentWalletId, pushToken: "" }); } catch(e) {}
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
            abrirTelaCofreOuEntrarDireto(); // Leva o aluno direto para a carteira salva
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

/**
 * ============================================================================
 * SERVICE WORKER - PORTAL MAESTRO (V10.3 - MODO OFFLINE & PRIVACIDADE)
 * Responsável pelo cache da aplicação, imagens dinâmicas e Notificações Push.
 * ============================================================================
 */

importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// ⚠️ ATENÇÃO: COLE AQUI AS CREDENCIAIS DO SEU FIREBASE (As mesmas do app.js)
const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY",
  authDomain: "COLE_SEU_PROJECT_ID.firebaseapp.com",
  projectId: "COLE_SEU_PROJECT_ID",
  storageBucket: "COLE_SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "COLE_SEU_SENDER_ID",
  appId: "COLE_SEU_APP_ID"
};

try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.log("Firebase SW já inicializado ou erro na configuração.");
}

// CACHES DA VERSÃO 10.3
const CACHE_NAME = 'maestro-cache-v10.3';
const DYNAMIC_CACHE = 'maestro-dynamic-v10.3'; // Novo cache para as fotos e logos

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './api_auth.js',
  './main_core.js',
  './operacao.js',
  './inscricao.js',
  './consulta.js',
  './carteira.js',
  './mobilidade.js',
  './js_global.js',
  './icone.png',
  './manifest.json'
];

// 1. Instalação: Guarda os ficheiros estáticos (HTML/CSS/JS) no Cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Ativação: Limpa caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});

// 3. Estratégias de Fetch (O cérebro do Modo Offline)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // A. Ignorar API do Apps Script e Firestore (Estes precisam obrigatoriamente de rede)
  if (url.includes('script.google.com') || url.includes('firestore') || (url.includes('googleapis') && !url.includes('fcm'))) {
    return;
  }

  // B. CACHE DINÂMICO: Imagens do Google Drive (Logos e Foto 3x4 do Estudante)
  // Estratégia: Stale-While-Revalidate (Mostra o cache rápido, atualiza em background)
  if (url.includes('drive.google.com/thumbnail') || url.includes('drive.google.com/uc')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => response); // Se falhar a rede, não quebra, usa a imagem salva
          
          return response || fetchPromise;
        });
      })
    );
    return;
  }

  // C. CACHE ESTÁTICO: Ficheiros da Aplicação PWA
  // Estratégia: Cache-First (Tenta o cache, se falhar vai à rede)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Se o utilizador estiver totalmente offline e tentar navegar, mostra o index
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 4. Receção de PUSH em BACKGROUND (App fechada ou em segundo plano)
if (firebase.messaging.isSupported()) {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title || "Novo Aviso - Maestro";
    const notificationOptions = {
      body: payload.notification.body,
      icon: payload.notification.icon || './icone.png',
      badge: './icone.png',
      vibrate: [200, 100, 200, 100, 200],
      data: payload.data || { click_action: "/" }, 
      requireInteraction: true 
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// 5. Ação ao CLICAR na Notificação (Abrir a App)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.click_action || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

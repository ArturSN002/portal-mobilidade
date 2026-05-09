/**
 * ============================================================================
 * SERVICE WORKER - PORTAL MAESTRO (V10.3 - MODO OFFLINE & PRIVACIDADE)
 * Responsável pelo cache da aplicação, imagens dinâmicas e Notificações Push.
 * ============================================================================
 */

importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// Puxa as variáveis dinamicamente da URL de registo do Service Worker
const params = new URL(location).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('projectId') + ".firebaseapp.com",
  projectId: params.get('projectId'),
  storageBucket: params.get('projectId') + ".appspot.com",
  messagingSenderId: params.get('senderId'),
  appId: params.get('appId')
};

let firebaseInicializado = false;

try {
  // Só inicializa se realmente recebeu a apiKey (evita erros no carregamento sem chaves)
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'null') {
      firebase.initializeApp(firebaseConfig);
      firebaseInicializado = true;
  }
} catch (e) {
  console.log("Firebase SW já inicializado ou erro na configuração.");
}

// CACHES DA VERSÃO 12.8
const CACHE_NAME = 'maestro-cache-v12.8';
const DYNAMIC_CACHE = 'maestro-dynamic-v12.8';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './api_auth.js',
  './main_core.js',
  './operacao.js',
  './admin_dashboard.js',
  './admin_fiscal.js',
  './admin_sos.js',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      for (let asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.error("Falha ao fazer cache de:", asset, e);
        }
      }
    })
  );
});

// 2. Ativação: Limpa caches antigos
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

// 3. Estratégias de Fetch
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (url.includes('script.google.com') || url.includes('firestore') || (url.includes('googleapis') && !url.includes('fcm'))) {
    return;
  }

  if (url.includes('drive.google.com/thumbnail') || url.includes('drive.google.com/uc')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => response); 
          
          return response || fetchPromise;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 4. Receção de PUSH em BACKGROUND (Segurança Adicionada)
try {
  if (firebaseInicializado && firebase.messaging.isSupported()) {
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification.title || "Novo Aviso - Maestro";
      const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || './icone.png',
        badge: payload.data ? payload.data.badge : './icone.png',
        vibrate: [200, 100, 200, 100, 200],
        data: payload.data || { click_action: "/" }, 
        requireInteraction: true 
      };

      // Guardar na IndexedDB (Caixa de Entrada / Inbox 7 dias)
      const salvarNotificacao = () => {
         const dbReq = indexedDB.open('MaestroDB', 1);
         dbReq.onupgradeneeded = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains('notificacoes')) {
                 const store = db.createObjectStore('notificacoes', { keyPath: 'id', autoIncrement: true });
                 store.createIndex('timestamp', 'timestamp', { unique: false });
             }
         };
         dbReq.onsuccess = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains('notificacoes')) return;
             const tx = db.transaction('notificacoes', 'readwrite');
             const store = tx.objectStore('notificacoes');
             
             // Limpeza (> 7 dias)
             const limite = Date.now() - 604800000;
             const index = store.index('timestamp');
             const range = IDBKeyRange.upperBound(limite);
             index.openCursor(range).onsuccess = (ec) => {
                 const cursor = ec.target.result;
                 if (cursor) {
                     store.delete(cursor.primaryKey);
                     cursor.continue();
                 }
             };

             // Inserir
             store.add({
                 title: notificationTitle,
                 body: notificationOptions.body,
                 timestamp: Date.now(),
                 icon: notificationOptions.icon,
                 link: notificationOptions.data.click_action,
                 status: 'unread'
             });
         };
      };
      
      try { salvarNotificacao(); } catch(err) { console.error("Erro ao guardar Inbox", err); }

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.log("Push em background ignorado:", error);
}

// 5. Ação ao CLICAR na Notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  
  if (action === 'close') return;

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

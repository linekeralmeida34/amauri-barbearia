// Teste simples para verificar se o service worker está funcionando
console.log('Service Worker Test - PWA funcionando!');

// Verificar se está em modo standalone
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('App está rodando em modo standalone (instalado)');
} else {
  console.log('App está rodando no navegador');
}

// Verificar se há beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event detected!', e);
});

// Verificar se há appinstalled
window.addEventListener('appinstalled', (e) => {
  console.log('appinstalled event detected!', e);
});

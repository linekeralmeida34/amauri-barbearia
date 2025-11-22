import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/components/ui/sonner";

/**
 * Escuta atualizações do Service Worker e exibe um toast
 * convidando o usuário a atualizar o app quando há nova versão.
 */
export function PWAUpdateListener() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  // Quando houver nova versão disponível, mostra um toast com botão de atualizar
  useEffect(() => {
    if (!needRefresh) return;

    toast("Nova versão disponível", {
      description: "Clique em atualizar para carregar as últimas melhorias.",
      action: {
        label: "Atualizar",
        onClick: () => {
          // Atualiza o service worker e recarrega a página
          updateServiceWorker(true);
        },
      },
    });

    // Evita mostrar o toast repetidamente
    setNeedRefresh(false);
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  // Não vamos exibir nada especial para "offline ready" por enquanto
  useEffect(() => {
    setOfflineReady(false);
  }, [setOfflineReady]);

  return null;
}



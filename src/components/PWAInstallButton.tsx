import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Smartphone, Share, Plus } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'client' | 'admin';
  className?: string;
  subtle?: boolean;
}

export const PWAInstallButton = ({ variant = 'client', className = '', subtle = false }: PWAInstallButtonProps) => {
  const { isInstallable, isInstalled, isIOS, installPrompt, install, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) {
    return null; // Não mostra o botão se já estiver instalado
  }

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🚀 PWA Install button clicked', { 
      isInstallable, 
      isIOS, 
      installPrompt: !!installPrompt,
      variant,
      appName,
      currentUrl: window.location.href
    });
    
    // For mobile, always show instructions first
    if (isIOS || !installPrompt) {
      console.log('📱 Mobile detected, showing instructions');
      setShowInstructions(true);
      return;
    }
    
    // For desktop with install prompt
    try {
      console.log('🖥️ Desktop detected, attempting install');
      await install();
    } catch (error) {
      console.error('❌ Install function error:', error);
      // Fallback to instructions
      setShowInstructions(true);
    }
  };

  const appName = variant === 'client' ? 'Cliente' : 'Admin';
  const buttonText = isIOS ? 'Instalar App' : 'Instalar App';

  if (subtle) {
    return (
      <>
        <button
          onClick={handleInstall}
          className={`text-xs sm:text-sm text-white/80 hover:text-white transition-colors px-3 py-2 rounded hover:bg-white/20 border border-white/20 hover:border-white/40 ${className}`}
          style={{ cursor: 'pointer' }}
        >
          📱 Instalar app {appName}
        </button>

        {/* Instruções para iOS */}
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-barbershop-gold" />
                Instalar App {appName}
              </DialogTitle>
              <DialogDescription>
                {isIOS ? 'Para instalar o app no seu iPhone/iPad:' : 'Para instalar o app no seu dispositivo móvel:'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {isIOS ? (
                <>
                  {variant === 'admin' && (
                    <div className="rounded-lg bg-blue-50 p-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Share className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Importante:</span>
                      </div>
                      <p className="mt-1 text-sm text-blue-700">
                        Certifique-se de que a URL mostra "admin/login" antes de compartilhar!
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Toque no botão Compartilhar</p>
                      <p className="text-sm text-muted-foreground">
                        <Share className="h-4 w-4 inline mr-1" />
                        Na barra inferior do Safari
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Selecione "Adicionar à Tela de Início"</p>
                      <p className="text-sm text-muted-foreground">
                        <Plus className="h-4 w-4 inline mr-1" />
                        Role para baixo se necessário
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Toque em "Adicionar"</p>
                      <p className="text-sm text-muted-foreground">
                        O app {appName} aparecerá na sua tela inicial
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Toque nos três pontos (⋮)</p>
                      <p className="text-sm text-muted-foreground">
                        No canto superior direito do navegador
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Selecione "Adicionar à tela inicial"</p>
                      <p className="text-sm text-muted-foreground">
                        <Plus className="h-4 w-4 inline mr-1" />
                        Ou "Instalar app" dependendo do navegador
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground">
                        O app {appName} aparecerá na sua tela inicial
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Benefícios do App:</span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Acesso mais rápido</li>
                  <li>• Funciona offline</li>
                  <li>• Notificações push</li>
                  <li>• Interface otimizada</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowInstructions(false)}
                className="flex-1"
              >
                Entendi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        onClick={handleInstall}
        className={`bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold ${className}`}
        style={{ cursor: 'pointer' }}
      >
        <Download className="h-4 w-4 mr-2" />
        {buttonText} {appName}
      </Button>

      {/* Instruções para iOS */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-barbershop-gold" />
              Instalar App {appName}
            </DialogTitle>
            <DialogDescription>
              {isIOS ? 'Para instalar o app no seu iPhone/iPad:' : 'Para instalar o app no seu dispositivo móvel:'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isIOS ? (
              <>
                {variant === 'admin' && (
                  <div className="rounded-lg bg-blue-50 p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Share className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Importante:</span>
                    </div>
                    <p className="mt-1 text-sm text-blue-700">
                      Certifique-se de que a URL mostra "admin/login" antes de compartilhar!
                    </p>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Toque no botão Compartilhar</p>
                    <p className="text-sm text-muted-foreground">
                      <Share className="h-4 w-4 inline mr-1" />
                      Na barra inferior do Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Selecione "Adicionar à Tela de Início"</p>
                    <p className="text-sm text-muted-foreground">
                      <Plus className="h-4 w-4 inline mr-1" />
                      Role para baixo se necessário
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Toque em "Adicionar"</p>
                    <p className="text-sm text-muted-foreground">
                      O app {appName} aparecerá na sua tela inicial
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Toque nos três pontos (⋮)</p>
                    <p className="text-sm text-muted-foreground">
                      No canto superior direito do navegador
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Selecione "Adicionar à tela inicial"</p>
                    <p className="text-sm text-muted-foreground">
                      <Plus className="h-4 w-4 inline mr-1" />
                      Ou "Instalar app" dependendo do navegador
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-barbershop-gold text-barbershop-dark rounded-full flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Confirme a instalação</p>
                    <p className="text-sm text-muted-foreground">
                      O app {appName} aparecerá na sua tela inicial
                    </p>
                  </div>
                </div>
              </>
            )}
            
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <span className="text-sm font-medium">Benefícios do App:</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Acesso mais rápido</li>
                <li>• Funciona offline</li>
                <li>• Notificações push</li>
                <li>• Interface otimizada</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowInstructions(false)}
              className="flex-1"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

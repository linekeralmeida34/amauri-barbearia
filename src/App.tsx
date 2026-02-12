// src/App.tsx
import { useEffect, useState, type ReactNode } from "react";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { supabase } from "@/lib/supabase";
import BookingsList from "@/components/admin/BookingsList";
import AdminBookingCreate from "@/components/admin/AdminBookingCreate";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BookingFlow } from "@/components/BookingFlow";
import AdminLogin from "./routes/AdminLogin";
import AdminGuard from "./routes/AdminGuard"; // ← Deve renderizar <Outlet />
import AdminBarbers from "./routes/AdminBarbers";
import AdminServices from "./routes/AdminServices";
import AdminSettings from "./routes/AdminSettings";
import BarberLogin from "./routes/BarberLogin";
import CustomerLogin from "./routes/CustomerLogin";
import CustomerBookings from "./routes/CustomerBookings";
import AdminAnalytics from "./routes/AdminAnalytics";
import AdminMarketing from "./routes/AdminMarketing";
import { Users, Scissors, Plus, Settings, BarChart3, Calendar, ArrowLeft, Search, Megaphone } from "lucide-react";
import heroImage from "@/assets/barbershop-hero.jpg";
import { useBarberAuth } from "@/hooks/useBarberAuth";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { PWAUpdateListener } from "@/components/PWAUpdateListener";
import { trackPageView } from "@/lib/analytics";


const queryClient = new QueryClient();

/** Sobe a página ao mudar de rota (/ -> /agendar, etc) */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Rastreia mudanças de rota no GA4 */
function GARouteTracker() {
  const location = useLocation();
  
  useEffect(() => {
    // Em HashRouter, o pathname já é a parte depois do #
    const path = location.pathname + location.search + location.hash;
    const title = document.title;
    
    // Pequeno delay para garantir que o título foi atualizado
    setTimeout(() => {
      trackPageView(path, title);
    }, 100);
  }, [location.pathname, location.search, location.hash]);
  
  return null;
}

/** Rola para a âncora passada via query (?a=barbeiros) */
function ScrollToAnchorFromSearch() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const anchor = params.get("a");
    if (!anchor) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname, search]);
  return null;
}

/** Manifest switcher para PWA */
function ManifestSwitcher() {
  return null;
}

/** Link "Admin (dev)" controlado por flag de ambiente */
function AdminDevLink() {
  const { pathname } = useLocation();
  const show =
    import.meta.env.VITE_SHOW_ADMIN_LINK === "true" ||
    import.meta.env.VITE_SHOW_ADMIN_LINK === "1";

  if (!show || pathname !== "/") return null;

  return (
    <a
      href="#/admin/login"
      className="fixed bottom-4 right-4 z-50 rounded-full px-3 py-2 text-sm bg-black/70 text-white hover:bg-black transition"
      title="Ir para /admin/login"
    >
      Admin (dev)
    </a>
  );
}

type AdminShellProps = {
  title: string;
  titleHighlight?: string;
  description?: string;
  backgroundImageUrl?: string;
  backgroundImageOpacity?: number;
  overlayClassName?: string;
  children: ReactNode;
};

/** 🔒 Layout do painel com topbar no tema + botão Sair */
function AdminShell({
  title,
  titleHighlight,
  description,
  backgroundImageUrl,
  backgroundImageOpacity = 0.45,
  overlayClassName,
  children
}: AdminShellProps) {
  const navigate = useNavigate();
  const { barber, isAdmin, canCreateBookings, signOut } = useBarberAuth();
  
  // Verificar se é admin via email também (para lineker.dev@gmail.com)
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  
  useEffect(() => {
    const checkEmailAdmin = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.email === "lineker.dev@gmail.com") {
          setIsEmailAdmin(true);
        }
      } catch (error) {
        console.error("Erro ao verificar email admin:", error);
      }
    };
    checkEmailAdmin();
  }, []);
  
  const finalIsAdmin = isAdmin || isEmailAdmin;

  async function onSignOut() {
    try {
      await signOut();
    } finally {
      window.location.hash = "/admin/login";
      setTimeout(() => window.location.reload(), 50);
    }
  }

  return (
    <section className="min-h-screen relative overflow-hidden">
      {backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${backgroundImageUrl})`, opacity: backgroundImageOpacity }}
        />
      )}
      {/* fundo em gradiente coerente com a paleta */}
      <div
        className={
          overlayClassName ??
          "absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black"
        }
      />
      <div className="relative z-10">
        {/* Topbar */}
        <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between text-white">
            <a href="#/" className="font-bold text-lg tracking-tight">
              <span className="text-white">Amauri</span>
              <span className="text-barbershop-gold">Barbearia</span>
            </a>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Botão de instalação PWA Admin */}
              {finalIsAdmin && (
                <PWAInstallButton variant="admin" subtle={true} className="hidden sm:flex text-xs sm:text-sm px-2 sm:px-3" />
              )}


              <Button
                type="button"
                onClick={onSignOut}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
                size="sm"
              >
                <span className="text-xs sm:text-sm">Sair</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Corpo */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 text-white">
          <div className="space-y-6">
            <div className="text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    {title}{" "}
                    {titleHighlight && (
                      <span className="text-barbershop-gold">{titleHighlight}</span>
                    )}
                  </h1>
                  {description && (
                    <p className="text-white/80 text-sm sm:text-base max-w-2xl mx-auto sm:mx-0">
                      {description}
                    </p>
                  )}
                </div>
                
              </div>
              
              {/* Botão de instalação PWA Admin para mobile */}
              {finalIsAdmin && (
                <div className="mt-4 sm:hidden text-center">
                  <PWAInstallButton variant="admin" subtle={true} />
                </div>
              )}
            </div>

            {children}
          </div>
        </main>
      </div>
    </section>
  );
}

function AdminHub() {
  const { barber, isAdmin, canCreateBookings } = useBarberAuth();
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);

  useEffect(() => {
    const checkEmailAdmin = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.email === "lineker.dev@gmail.com") {
          setIsEmailAdmin(true);
        }
      } catch (error) {
        console.error("Erro ao verificar email admin:", error);
      }
    };
    checkEmailAdmin();
  }, []);

  const finalIsAdmin = isAdmin || isEmailAdmin;
  const [hubSearch, setHubSearch] = useState("");

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const hubs = [
    {
      id: "agendados",
      title: "Agendados",
      titleMobile: "Agendados",
      description: "Visualize e gerencie os agendamentos em tempo real.",
      href: "/admin/agendados",
      icon: Calendar,
      green: false,
      show: !!(finalIsAdmin || barber || canCreateBookings),
    },
    {
      id: "novo",
      title: "Novo Agendamento",
      titleMobile: "Novo Agend.",
      description: "Crie agendamentos rapidamente para clientes.",
      href: "/admin/booking/create",
      icon: Plus,
      green: true,
      show: !!(finalIsAdmin || canCreateBookings),
    },
    {
      id: "barbeiros",
      title: "Barbeiros",
      titleMobile: "Barbeiros",
      description: "Gerencie profissionais e permissões do time.",
      href: "/admin/barbeiros",
      icon: Users,
      green: false,
      show: !!finalIsAdmin,
    },
    {
      id: "servicos",
      title: "Serviços",
      titleMobile: "Serviços",
      description: "Edite preços, duração e status dos serviços.",
      href: "/admin/servicos",
      icon: Scissors,
      green: false,
      show: !!finalIsAdmin,
    },
    {
      id: "config",
      title: "Configurações",
      titleMobile: "Configurações",
      description: "Ajuste horários, regras e preferências do sistema.",
      href: "/admin/configuracoes",
      icon: Settings,
      green: false,
      show: !!(finalIsAdmin || barber),
    },
    {
      id: "analytics",
      title: "Analytics",
      titleMobile: "Analytics",
      description: "Acompanhe desempenho e indicadores do negócio.",
      href: "/admin/analytics",
      icon: BarChart3,
      green: false,
      show: !!(finalIsAdmin || barber),
    },
    {
      id: "marketing",
      title: "Marketing",
      titleMobile: "Marketing",
      description: "Relatório N8N: diagnóstico, tráfego pago, WhatsApp e upsell.",
      href: "/admin/marketing",
      icon: Megaphone,
      green: false,
      show: !!finalIsAdmin,
    },
  ];

  const searchNorm = normalize(hubSearch);
  const filteredHubs = hubs.filter(
    (h) =>
      h.show &&
      (!searchNorm ||
        normalize(h.title).includes(searchNorm) ||
        normalize(h.titleMobile).includes(searchNorm) ||
        normalize(h.description).includes(searchNorm))
  );

  return (
    <AdminShell
      title="Bem-vindo ao"
      titleHighlight="Painel"
      description="Selecione uma opção para gerenciar."
      backgroundImageUrl={heroImage}
      backgroundImageOpacity={0.7}
      overlayClassName="absolute inset-0 bg-gradient-to-br from-black/60 via-barbershop-brown/40 to-black/70"
    >
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <Input
            type="text"
            placeholder="Pesquisar hubs..."
            value={hubSearch}
            onChange={(e) => setHubSearch(e.target.value)}
            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredHubs.map((h) => {
          const Icon = h.icon;
          return (
          <Card
            key={h.id}
            className="bg-white/10 border-white/20 rounded-2xl backdrop-blur-md shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:shadow-2xl h-full flex flex-col overflow-hidden"
          >
            <CardHeader className="pb-2 min-w-0">
              <CardTitle className="text-white text-sm sm:text-lg flex items-center gap-3 leading-snug min-h-[48px] min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className={`h-5 w-5 ${h.green ? "text-emerald-300" : "text-barbershop-gold"}`} />
                </span>
                <span className="sm:hidden truncate">{h.titleMobile}</span>
                <span className="hidden sm:inline truncate">{h.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-3">
              <p className="text-white/70 text-sm line-clamp-3 min-h-[3.5rem]">{h.description}</p>
              <Button
                asChild
                className={`w-full rounded-full mt-auto ${h.green ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"}`}
              >
                <Link to={h.href}>Acessar</Link>
              </Button>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}

function AdminAgendados() {
  return (
    <AdminShell
      title="Agendados"
      description="Abaixo estão os agendamentos em tempo real."
      backgroundImageUrl={heroImage}
      backgroundImageOpacity={0.5}
      overlayClassName="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/80"
    >
      <div className="mb-4 flex justify-start">
        <Button
          asChild
          className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-medium rounded-full"
        >
          <Link to="/admin" aria-label="Voltar para o painel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para o painel
          </Link>
        </Button>
      </div>
      <BookingsList />
    </AdminShell>
  );
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          {/* Helpers de rolagem */}
          <ScrollToTop />
          <ScrollToAnchorFromSearch />
          
          {/* Rastreamento GA4 */}
          <GARouteTracker />
          
          {/* Manifest switcher para PWA */}
          <ManifestSwitcher />
          {/* Listener para avisar sobre novas versões do PWA */}
          <PWAUpdateListener />

          {/* "Admin (dev)" apenas na home */}
          <AdminDevLink />

          <Routes>
            {/* Público */}
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<BookingFlow />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/barber/login" element={<BarberLogin />} />
            <Route path="/cliente/login" element={<CustomerLogin />} />
            <Route path="/cliente/agendamentos" element={<CustomerBookings />} />

            {/* 🔒 Tudo sob /admin protegido por AdminGuard (usa <Outlet />) */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminHub />} />
              <Route path="/admin/agendados" element={<AdminAgendados />} />
              <Route path="/admin/booking/create" element={<AdminBookingCreate />} />
              <Route path="/admin/barbeiros" element={<AdminBarbers />} />
              <Route path="/admin/servicos" element={<AdminServices />} />
              <Route path="/admin/configuracoes" element={<AdminSettings />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/marketing" element={<AdminMarketing />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

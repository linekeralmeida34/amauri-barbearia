// src/App.tsx
import { useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabase";
import BookingsList from "@/components/admin/BookingsList";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BookingFlow } from "@/components/BookingFlow";
import AdminLogin from "./routes/AdminLogin";
import AdminGuard from "./routes/AdminGuard"; // ← Deve renderizar <Outlet />
import AdminBarbers from "./routes/AdminBarbers";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";


const queryClient = new QueryClient();

/** Sobe a página ao mudar de rota (/ -> /agendar, etc) */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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

/** Link “Admin (dev)” controlado por flag de ambiente */
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

/** 🔒 Placeholder do painel com topbar no tema + botão Sair */
/** 🔒 Placeholder do painel com topbar no tema + botões e Sair */
function AdminPanelPlaceholder() {
  const navigate = useNavigate();

  async function onSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error(error);
    } finally {
      window.location.hash = "/admin/login?from=/admin";
      setTimeout(() => window.location.reload(), 50);
    }
  }

  return (
    <section className="min-h-screen relative overflow-hidden">
      {/* fundo em gradiente coerente com a paleta */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
      <div className="relative z-10">
        {/* Topbar */}
        <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between text-white">
            <a href="#/" className="font-bold text-lg tracking-tight">
              <span className="text-white">Amauri</span>
              <span className="text-barbershop-gold">Barbearia</span>
            </a>

            <div className="flex items-center gap-2">
              {/* NOVO botão: Barbeiros */}
              <Button
                asChild
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
              >
                <Link to="/admin/barbeiros" aria-label="Gerenciar barbeiros">
                  <Users className="h-4 w-4 mr-2" />
                  Barbeiros
                </Link>
              </Button>

              <span className="hidden sm:inline text-white/70 text-sm">
                Painel Administrativo
              </span>

              <Button
                type="button"
                onClick={onSignOut}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
                size="sm"
              >
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* Corpo */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 text-white">
          <div className="grid gap-6">
            <h1 className="text-3xl md:text-4xl font-bold">
              Bem-vindo ao <span className="text-barbershop-gold">Painel</span>
            </h1>
            <p className="text-white/80 max-w-2xl">
              Abaixo estão os agendamentos em tempo real.
            </p>

            {/* ✅ Lista de agendamentos (realtime) */}
            <BookingsList />
          </div>
        </main>
      </div>
    </section>
  );
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          {/* Helpers de rolagem */}
          <ScrollToTop />
          <ScrollToAnchorFromSearch />

          {/* “Admin (dev)” apenas na home */}
          <AdminDevLink />

          <Routes>
            {/* Público */}
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<BookingFlow />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* 🔒 Tudo sob /admin protegido por AdminGuard (usa <Outlet />) */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminPanelPlaceholder />} />
              <Route path="/admin/barbeiros" element={<AdminBarbers />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

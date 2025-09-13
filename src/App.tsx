// topo do App.tsx (junto dos outros imports)
import BookingsList from "@/components/admin/BookingsList";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
  useNavigate, // ⬅️ add
} from "react-router-dom";
import { useEffect } from "react";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BookingFlow } from "@/components/BookingFlow";
import AdminLogin from "./routes/AdminLogin";
import AdminGuard from "./routes/AdminGuard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

/** Sobe a página ao mudar de rota (/ -> /agendar, etc) */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Rola até a âncora quando a URL tiver hash (/#servicos, /#barbeiros, /#contato, /#hero) */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(hash) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname, hash]);
  return null;
}

/** Link “Admin (dev)” aparece só na home e somente em ambiente de desenvolvimento */
function AdminDevLink() {
  const { pathname } = useLocation();
  if (!import.meta.env.DEV || pathname !== "/") return null;
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
function AdminPanelPlaceholder() {
  const navigate = useNavigate();

  async function onSignOut() {
    try {
      // tenta encerrar a sessão
      const { error } = await supabase.auth.signOut();
      if (error) console.error(error);
    } finally {
      // redireciona mesmo que o Router não esteja pronto
      window.location.hash = "/admin/login?from=/admin";
      // como fallback extra (caso algum state fique preso), força um reload leve
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
            <div className="flex items-center gap-3">
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
            {/* cartões placeholder */}
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
          <ScrollToHash />

          {/* “Admin (dev)” só na home em DEV */}
          <AdminDevLink />

          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<BookingFlow />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* 🔒 Rota protegida por AdminGuard */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminPanelPlaceholder />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

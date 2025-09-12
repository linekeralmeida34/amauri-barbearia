import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BookingFlow } from "@/components/BookingFlow";

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
    // Aguarda o DOM montar
    requestAnimationFrame(() => {
      const el = document.querySelector(hash) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Helpers de rolagem */}
          <ScrollToTop />
          <ScrollToHash />

          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<BookingFlow />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

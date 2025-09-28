import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useBarberAuth } from "@/hooks/useBarberAuth";

/**
 * AdminGuard com "modo relax" (DEV ?relax=1) e timeout seguro:
 * - Cancela o timeout quando resolve (evita redirecionar depois de autorizado)
 * - Logs de diagnóstico no console
 */
export default function AdminGuard() {
  const loc = useLocation();
  const search = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const relax = import.meta.env.DEV && search.get("relax") === "1";
  const { barber, isAuthenticated, loading: barberLoading } = useBarberAuth();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Se ainda está carregando dados do barbeiro, aguarda
    if (barberLoading) return;

    let cancelled = false;
    let settled = false;
    let timer: NodeJS.Timeout;
    
    const settle = (ok: boolean) => {
      if (cancelled || settled) return;
      settled = true;
      setAuthorized(ok);
      setChecking(false);
      clearTimeout(timer); // ✅ cancela o timeout
    };

    async function run() {
      // Verificar se é barbeiro autenticado
      if (isAuthenticated && barber) {
        return settle(true);
      }

      // Verificar se é admin
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessErr) console.warn("[AdminGuard] getSession error:", sessErr);
      const session = sessData?.session ?? null;

      if (!session) return settle(false);

      if (relax) {
        return settle(true);
      }

      // Verificar se é o email específico do lineker.dev@gmail.com
      if (session.user.email === "lineker.dev@gmail.com") {
        return settle(true);
      }

      const userId = session.user.id;
      const { data, error } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      const isAdmin =
        !error && data && (data.role === "owner" || data.role === "admin");

      return settle(!!isAdmin);
    }

    run();

    // Timeout de segurança — agora respeita "settled"
    timer = setTimeout(() => {
      if (settled) return; // ✅ não faz nada se já resolvemos
      console.warn("[AdminGuard] timeout de segurança — assumindo não autorizado");
      settle(false);
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [relax, isAuthenticated, barber, barberLoading]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-muted-foreground">Verificando acesso…</div>
      </div>
    );
  }

  if (!authorized) {
    const from = encodeURIComponent(loc.pathname + loc.search);
    // Redirecionar para login de barbeiro se não for admin
    return <Navigate to={`/barber/login?from=${from}`} replace />;
  }

  return <Outlet />;
}

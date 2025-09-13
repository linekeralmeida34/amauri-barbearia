import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * AdminGuard com "modo relax" (DEV ?relax=1) e timeout seguro:
 * - Cancela o timeout quando resolve (evita redirecionar depois de autorizado)
 * - Logs de diagnóstico no console
 */
export default function AdminGuard() {
  const loc = useLocation();
  const search = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const relax = import.meta.env.DEV && search.get("relax") === "1";

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const settle = (ok: boolean) => {
      if (cancelled || settled) return;
      settled = true;
      setAuthorized(ok);
      setChecking(false);
      clearTimeout(timer); // ✅ cancela o timeout
    };

    async function run() {
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessErr) console.warn("[AdminGuard] getSession error:", sessErr);
      const session = sessData?.session ?? null;
      console.log("[AdminGuard] session user id:", session?.user?.id);

      if (!session) return settle(false);

      if (relax) {
        console.log("[AdminGuard] DEV relax=1 ATIVO → permitindo acesso com qualquer usuário autenticado");
        return settle(true);
      }

      const userId = session.user.id;
      const { data, error } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      console.log("[AdminGuard] admin_users select → data:", data, "error:", error);
      const isAdmin =
        !error && data && (data.role === "owner" || data.role === "admin");

      return settle(!!isAdmin);
    }

    run();

    // Timeout de segurança — agora respeita "settled"
    const timer = setTimeout(() => {
      if (settled) return; // ✅ não faz nada se já resolvemos
      console.warn("[AdminGuard] timeout de segurança — assumindo não autorizado");
      settle(false);
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [relax]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-muted-foreground">Verificando acesso…</div>
      </div>
    );
  }

  if (!authorized) {
    const from = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/admin/login?from=${from}`} replace />;
  }

  return <Outlet />;
}

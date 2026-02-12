// src/hooks/useBarberAuth.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type BarberAuthData = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  can_cancel_bookings?: boolean;
  can_create_bookings?: boolean;
};

export function useBarberAuth() {
  const [barber, setBarber] = useState<BarberAuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verificar sessão do Supabase
        const { data: session } = await supabase.auth.getSession();
        const user = session?.session?.user ?? null;

        // Se não houver sessão válida, limpar cache local para evitar acesso sem token
        if (!user) {
          localStorage.removeItem("barber_data");
          setBarber(null);
          return;
        }

        // Sempre sincroniza com a sessão atual para evitar cache de outro barbeiro
        const userEmail = (user.email ?? "").toLowerCase();
        const { data: barberData, error: barberError } = await supabase
          .from("barbers")
          .select("id, name, email, is_admin, can_cancel_bookings, can_create_bookings")
          .ilike("email", userEmail)
          .single();

        if (barberError || !barberData) {
          // Se não existe barbeiro cadastrado para este login, limpa cache para evitar falso acesso
          localStorage.removeItem("barber_data");
          setBarber(null);
          return;
        }

        const normalized = {
          id: barberData.id,
          name: barberData.name,
          email: barberData.email,
          is_admin: barberData.is_admin,
          can_cancel_bookings: barberData.can_cancel_bookings,
          can_create_bookings: barberData.can_create_bookings,
        };
        setBarber(normalized);
        localStorage.setItem("barber_data", JSON.stringify(normalized));
      } catch (error) {
        console.error("Erro na verificação de autenticação:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("barber_data");
      setBarber(null);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const isAdmin =
    barber?.is_admin ||
    barber?.email?.toLowerCase() === "amauri@barbearia.com" ||
    barber?.name?.toLowerCase() === "amauri" ||
    false;
  // Verificar permissões: admin ou permissão específica do barbeiro
  const canCancelBookings = isAdmin || barber?.can_cancel_bookings || false;
  const canCreateBookings = isAdmin || barber?.can_create_bookings || false;

  return {
    barber,
    loading,
    isAuthenticated: !!barber,
    isAdmin,
    canCancelBookings,
    canCreateBookings,
    signOut,
  };
}

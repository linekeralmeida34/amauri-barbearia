// src/hooks/useBarberAuth.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type BarberAuthData = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
};

export function useBarberAuth() {
  const [barber, setBarber] = useState<BarberAuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verificar se há dados salvos no localStorage
        const savedData = localStorage.getItem("barber_data");
        if (savedData) {
          try {
            const barberData = JSON.parse(savedData);
            setBarber(barberData);
          } catch (error) {
            console.error("Erro ao carregar dados do barbeiro:", error);
            localStorage.removeItem("barber_data");
          }
        }
        
        // Verificar sessão do Supabase
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          // Se há sessão mas não há dados do barbeiro, buscar na tabela
          if (!savedData) {
            const { data: barberData } = await supabase
              .from("barbers")
              .select("id, name, email, is_admin")
              .eq("email", session.session.user.email)
              .single();
            
            if (barberData) {
              setBarber({
                id: barberData.id,
                name: barberData.name,
                email: barberData.email,
                is_admin: barberData.is_admin
              });
            }
          }
        }
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

  const isAdmin = barber?.is_admin || barber?.name?.toLowerCase() === "amauri" || false;
  const canCancelBookings = isAdmin; // Apenas Amauri e admins podem cancelar

  return {
    barber,
    loading,
    isAuthenticated: !!barber,
    isAdmin,
    canCancelBookings,
    signOut,
  };
}

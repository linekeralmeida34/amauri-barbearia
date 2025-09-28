// src/routes/BarberLogin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Lock, AlertCircle } from "lucide-react";

type Barber = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function BarberLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Autenticação com Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!data.user) {
        throw new Error("Falha na autenticação");
      }

      // Buscar dados do barbeiro
      const { data: barberData, error: barberError } = await supabase
        .from("barbers")
        .select("id, name, is_active")
        .eq("email", email)
        .single();

      if (barberError || !barberData) {
        throw new Error("Barbeiro não encontrado");
      }

      if (!barberData.is_active) {
        throw new Error("Sua conta está inativa. Entre em contato com o administrador.");
      }

      // Salvar dados do barbeiro no localStorage
      localStorage.setItem("barber_data", JSON.stringify({
        id: barberData.id,
        name: barberData.name,
        email: data.user.email,
        is_admin: barberData.name.toLowerCase() === "amauri"
      }));

      // Redirecionar para o painel
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen relative overflow-hidden">
      {/* Fundo em gradiente coerente com a paleta */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-barbershop-gold/20 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-barbershop-gold" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Login do Barbeiro
            </CardTitle>
            <p className="text-white/70 mt-2">
              Acesse seu painel pessoal
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert className="bg-red-500/20 border-red-500/50 text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold"
              >
                {loading ? (
                  <>
                    <Lock className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm">
                Não tem acesso? Entre em contato com o administrador
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

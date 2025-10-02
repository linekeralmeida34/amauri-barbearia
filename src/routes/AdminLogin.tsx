import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { signInWithEmailPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import heroImage from "@/assets/barbershop-hero.jpg";
import { Calendar } from "lucide-react";

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailPassword(email.trim(), password);
      const from = new URLSearchParams(loc.search).get("from") || "/admin";
      nav(from, { replace: true });
    } catch (error: any) {
      setErr(error.message ?? "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="relative min-h-[100svh] sm:min-h-screen flex items-center justify-center overflow-hidden pt-safe pb-safe"
      aria-label="Login Administrativo"
    >
      {/* Fundo com mesma vibe do Hero */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-barbershop-dark/85 via-barbershop-brown/70 to-transparent" />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar com a marca */}
        <div className="flex items-center justify-between py-6 text-white/90">
          <Link to="/" className="font-bold text-xl tracking-tight">
            <span className="text-white">Amauri</span>
            <span className="text-barbershop-gold">Barbearia</span>
          </Link>
          {/* (removido link "Voltar ao site" do topo) */}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Lado esquerdo: headline no estilo do Hero */}
          <div className="hidden lg:block text-white">
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] mb-4">
              Área{" "}
              <span className="text-barbershop-gold inline">Administrativa</span>
            </h1>
            <p className="text-white/90 text-lg max-w-xl">
              Gerencie agendamentos, serviços e equipe em um só lugar.
            </p>

            <div className="mt-8 inline-flex items-center gap-3 bg-white/10 border border-white/20 backdrop-blur-md rounded-lg px-4 py-3">
              <Calendar className="h-5 w-5 text-barbershop-gold" />
              <span className="text-white/90">
                Horário de atendimento:{" "}
                <strong className="text-white">09:00–12:00</strong> e{" "}
                <strong className="text-white">13:00–18:00</strong>
              </span>
            </div>
          </div>

          {/* Card de login (glass + tema) */}
          <div className="w-full">
            <Card className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-2xl">
                  Entrar no painel
                </CardTitle>
                <CardDescription className="text-white/80">
                  Use suas credenciais de administrador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-white/90">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                      className="bg-white/80 text-neutral-900 placeholder:text-neutral-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-white/90">
                      Senha
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-white/80 text-neutral-900 placeholder:text-neutral-500"
                    />
                  </div>

                  {err && <p className="text-sm text-red-300">{err}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold"
                  >
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>

                  {/* Botão de instalação PWA Admin (centralizado) */}
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="w-full flex justify-center">
                      <PWAInstallButton variant="admin" subtle={true} />
                    </div>
                  </div>

                  <p className="text-xs text-white/80 text-center">
                    Esqueceu a senha? Fale com o proprietário para redefinição.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Indicador de rolagem removido por pedido */}

    </section>
  );
}

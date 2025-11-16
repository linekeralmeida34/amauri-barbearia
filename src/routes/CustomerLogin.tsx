// src/routes/CustomerLogin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { findCustomerByPhone } from "@/lib/api";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const digits = phone.replace(/\D/g, "");
      if (!digits || digits.length !== 11) {
        setError("Digite um WhatsApp válido com 11 dígitos (DDD + 9 + número).");
        setLoading(false);
        return;
      }

      // Busca cliente por telefone
      const customer = await findCustomerByPhone(digits);

      if (customer) {
        // Cliente encontrado: redireciona para área do cliente
        navigate(`/cliente/agendamentos?phone=${digits}`);
      } else {
        // Cliente não encontrado: mostra mensagem
        setError("Nenhum agendamento encontrado para este telefone. Verifique o número ou faça um novo agendamento.");
      }
    } catch (err: any) {
      console.error("Erro ao buscar cliente:", err);
      setError("Erro ao verificar telefone. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen relative overflow-hidden">
      {/* Fundo */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <a href="#/" className="inline-block mb-4">
              <h1 className="text-3xl font-bold">
                <span className="text-white">Amauri</span>
                <span className="text-barbershop-gold">Barbearia</span>
              </h1>
            </a>
            <p className="text-white/70 text-sm">
              Consulte seus agendamentos
            </p>
          </div>

          {/* Card de Login */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center text-barbershop-dark">
                Área do Cliente
              </CardTitle>
              <CardDescription className="text-center">
                Digite seu WhatsApp para ver seus agendamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-barbershop-dark">
                    WhatsApp
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(83) 99999-9999"
                      value={phone}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Formatação automática
                        const digits = value.replace(/\D/g, "");
                        let formatted = "";
                        if (digits.length > 0) {
                          if (digits.length <= 2) {
                            formatted = `(${digits}`;
                          } else if (digits.length <= 7) {
                            formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                          } else {
                            formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
                          }
                        }
                        setPhone(formatted);
                      }}
                      className="pl-10 text-base h-12"
                      disabled={loading}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Use o mesmo número usado no agendamento
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark h-12 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Consultar Agendamentos
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t">
                <p className="text-center text-sm text-gray-600">
                  Não tem agendamento?{" "}
                  <a
                    href="#/agendar"
                    className="text-barbershop-gold hover:underline font-medium"
                  >
                    Faça um novo agendamento
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Link para voltar */}
          <div className="mt-6 text-center">
            <a
              href="#/"
              className="text-white/70 hover:text-white text-sm transition-colors"
            >
              ← Voltar para a página inicial
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}


// src/routes/AdminSettings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBusinessHours,
  setBusinessHours as setBusinessHoursApi,
  type BusinessHours,
  type Barber,
  type BarberDayBlock,
  fetchActiveBarbers,
  fetchBarberDayBlock,
  adminSetBarberDayBlock,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Clock, Save, Loader2, Check, Settings, Scissors } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Estado usado na UI: sempre strings ("" ou "HH:MM"); conversão para null é feita na hora de salvar
type UiBusinessHours = {
  open_time: string;
  close_time: string;
  lunch_start: string; // "" => sem almoço
  lunch_end: string;   // "" => sem almoço
};

function todayLocalYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessHours, setBusinessHours] = useState<UiBusinessHours>({
    open_time: "09:00",
    close_time: "18:00",
    lunch_start: "",
    lunch_end: "",
  });

  // Estado para bloqueio global de horários por barbeiro
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [dayBlock, setDayBlock] = useState<BarberDayBlock>({
    start_time: null,
    end_time: null,
  });
  const [blockStartInput, setBlockStartInput] = useState<string>("");
  const [blockEndInput, setBlockEndInput] = useState<string>("");
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);

  const loadBusinessHours = async () => {
    setLoading(true);
    setError(null);
    try {
      const hours: BusinessHours = await getBusinessHours();
      // Converte valores vindos da API (string ou null) para sempre string na UI
      setBusinessHours({
        open_time: hours.open_time || "09:00",
        close_time: hours.close_time || "18:00",
        lunch_start: hours.lunch_start ?? "",
        lunch_end: hours.lunch_end ?? "",
      });
    } catch (err) {
      console.error("Erro ao carregar horário de funcionamento:", err);
      setError("Erro ao carregar configurações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // AdminGuard já verifica se é admin, então podemos carregar diretamente
    loadBusinessHours();
    // Carrega barbeiros para a aba de bloqueios
    (async () => {
      try {
        const list = await fetchActiveBarbers();
        setBarbers(list);
        if (list.length > 0) {
          setSelectedBarberId(list[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar barbeiros para bloqueios:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega o bloqueio global atual ao trocar o barbeiro selecionado
  useEffect(() => {
    if (!selectedBarberId) {
      setDayBlock({ start_time: null, end_time: null });
      setBlockStartInput("");
      setBlockEndInput("");
      return;
    }

    setLoadingBlock(true);
    // Usa a data de hoje apenas para consultar; a função já faz fallback para bloqueio global
    fetchBarberDayBlock(selectedBarberId, todayLocalYMD())
      .then((block) => {
        setDayBlock(block);
        setBlockStartInput(block.start_time || "");
        setBlockEndInput(block.end_time || "");
      })
      .catch((err) => {
        console.error("Erro ao carregar bloqueio global do barbeiro:", err);
        setDayBlock({ start_time: null, end_time: null });
        setBlockStartInput("");
        setBlockEndInput("");
      })
      .finally(() => setLoadingBlock(false));
  }, [selectedBarberId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Validações
    if (businessHours.open_time >= businessHours.close_time) {
      setError("O horário de abertura deve ser menor que o horário de fechamento.");
      setSaving(false);
      return;
    }

    if (
      (businessHours.lunch_start && !businessHours.lunch_end) ||
      (!businessHours.lunch_start && businessHours.lunch_end)
    ) {
      setError("Ambos os horários de almoço devem ser preenchidos ou ambos vazios.");
      setSaving(false);
      return;
    }

    if (
      businessHours.lunch_start &&
      businessHours.lunch_end &&
      businessHours.lunch_start >= businessHours.lunch_end
    ) {
      setError("O horário de início do almoço deve ser menor que o horário de fim.");
      setSaving(false);
      return;
    }

    try {
      // Chama a API para persistir no banco (função renomeada para evitar conflito com o setter de estado)
      await setBusinessHoursApi(
        businessHours.open_time,
        businessHours.close_time,
        businessHours.lunch_start || null,
        businessHours.lunch_end || null
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar horário de funcionamento:", err);
      setError(err.message || "Erro ao salvar configurações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Mostra loading enquanto dados estão carregando
  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black">
        <div className="flex items-center gap-3 text-white/80">
          <Loader2 className="h-8 w-8 animate-spin text-barbershop-gold" />
          <span className="text-sm">Carregando configurações...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen relative overflow-x-hidden w-full">
      {/* Fundo igual ao painel admin */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
      <div className="relative z-10 w-full min-w-0">
        {/* Topbar */}
        <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
            <a href="#/" className="font-bold text-base sm:text-lg tracking-tight">
              <span className="text-white">Amauri</span>
              <span className="text-barbershop-gold">Barbearia</span>
            </a>

            <div className="flex items-center gap-2">
              <Button
                asChild
                className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
              >
                <a href="#/admin">
                  <span className="hidden sm:inline">← Painel</span>
                  <span className="sm:hidden">←</span>
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo principal com abas */}
        <main className="mx-auto max-w-6xl w-full px-2 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8 min-w-0 box-border">
          <div className="mb-3 sm:mb-6">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4 sm:h-6 sm:w-6 text-barbershop-gold flex-shrink-0" />
              <span className="break-words">Configurações do Estabelecimento</span>
            </h1>
            <p className="text-white/70 text-xs sm:text-sm md:text-base">
              Ajuste o horário de funcionamento geral e os bloqueios de horários por barbeiro.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4 sm:mb-6 w-full max-w-4xl min-w-0">
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 sm:mb-6 w-full max-w-4xl min-w-0 bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-xs sm:text-sm">
                Configurações salvas com sucesso!
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="business-hours" className="w-full max-w-4xl min-w-0 box-border">
            <TabsList className="mb-2 sm:mb-4 bg-black/40 border border-white/10 w-full grid grid-cols-2 min-w-0 box-border">
              <TabsTrigger value="business-hours" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-4 min-w-0">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Horário</span>
              </TabsTrigger>
              <TabsTrigger value="barber-blocks" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-4 min-w-0">
                <Scissors className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Bloqueios</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="business-hours" className="w-full min-w-0 box-border">
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/60 text-white w-full min-w-0 box-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-white text-sm sm:text-lg">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span>Horário de Funcionamento</span>
                  </CardTitle>
                  <CardDescription className="text-white/70 text-xs sm:text-sm mt-1 sm:mt-2">
                    Defina os horários de abertura e fechamento do estabelecimento. 
                    Isso afetará diretamente os horários disponíveis para agendamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-6 p-3 sm:p-6 pt-0 min-w-0 box-border">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 min-w-0 box-border">
              <div className="min-w-0 box-border">
                <Label htmlFor="open_time" className="text-xs sm:text-base font-semibold text-white">
                  Abertura *
                </Label>
                <Input
                  id="open_time"
                  type="time"
                  value={businessHours.open_time}
                  onChange={(e) =>
                    setBusinessHours({ ...businessHours, open_time: e.target.value })
                  }
                  className="mt-1 sm:mt-2 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base w-full box-border"
                  step={900} // 15 minutos
                />
                <p className="text-xs text-white/60 mt-1">
                  Horário em que a barbearia abre
                </p>
              </div>

              <div className="min-w-0 box-border">
                <Label htmlFor="close_time" className="text-xs sm:text-base font-semibold text-white">
                  Fechamento *
                </Label>
                <Input
                  id="close_time"
                  type="time"
                  value={businessHours.close_time}
                  onChange={(e) =>
                    setBusinessHours({ ...businessHours, close_time: e.target.value })
                  }
                  className="mt-1 sm:mt-2 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base w-full box-border"
                  step={900} // 15 minutos
                />
                <p className="text-xs text-white/60 mt-1">
                  Horário em que a barbearia fecha
                </p>
              </div>
            </div>

            <div className="border-t pt-3 sm:pt-6 min-w-0 box-border">
              <h3 className="text-sm sm:text-lg font-semibold mb-2 sm:mb-4 text-white">
                Horário de Almoço (Opcional)
              </h3>

              <div className="min-w-0 box-border">
                <Label className="text-xs sm:text-base font-semibold mb-1 sm:mb-2 block text-white">
                  Intervalo de almoço
                </Label>
                <div className="flex items-center gap-1 sm:gap-2 min-w-0 box-border">
                  <Input
                    id="lunch_start"
                    type="time"
                    value={businessHours.lunch_start}
                    onChange={(e) =>
                      setBusinessHours({
                        ...businessHours,
                        lunch_start: e.target.value,
                      })
                    }
                    className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                    step={900} // 15 minutos
                    placeholder="Início"
                  />
                  <span className="text-white/60 text-xs whitespace-nowrap flex-shrink-0">até</span>
                  <Input
                    id="lunch_end"
                    type="time"
                    value={businessHours.lunch_end}
                    onChange={(e) =>
                      setBusinessHours({
                        ...businessHours,
                        lunch_end: e.target.value,
                      })
                    }
                    className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                    step={900} // 15 minutos
                    placeholder="Fim"
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Deixe ambos os campos vazios se não houver horário de almoço
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t box-border">
              <Button
                onClick={() => navigate("/admin")}
                disabled={saving}
                className="bg-transparent border border-white/40 text-white hover:bg-white/10 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto text-xs sm:text-base h-8 sm:h-10 box-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark w-full sm:w-auto text-xs sm:text-base h-8 sm:h-10 box-border"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin flex-shrink-0" />
                    <span className="hidden sm:inline">Salvando...</span>
                    <span className="sm:hidden">Salvando</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Salvar Configurações</span>
                    <span className="sm:hidden">Salvar</span>
                  </>
                )}
              </Button>
            </div>

            <div className="mt-3 sm:mt-4 pt-3 border-t border-white/20 box-border">
              <ul className="space-y-2 text-xs sm:text-sm text-white/70">
                <li>
                  • Os horários disponíveis para agendamento serão calculados automaticamente 
                  com base nestas configurações.
                </li>
                <li>
                  • O sistema garante que os serviços agendados não ultrapassem o horário de fechamento.
                </li>
                <li>
                  • Se configurar um horário de almoço, esses horários ficarão indisponíveis para agendamento.
                </li>
                <li>
                  • As alterações terão efeito imediato em novos agendamentos.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
            </TabsContent>

            <TabsContent value="barber-blocks" className="w-full min-w-0 box-border">
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/60 text-white w-full min-w-0 box-border">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-white text-sm sm:text-lg">
                    <Scissors className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span>Bloqueios de Horário por Barbeiro</span>
                  </CardTitle>
                  <CardDescription className="text-white/70 text-xs sm:text-sm mt-1 sm:mt-2">
                    Configure intervalos em que cada barbeiro não pode receber agendamentos
                    (por exemplo: pausa fixa diária).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-6 p-3 sm:p-6 pt-0 min-w-0 box-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 min-w-0 box-border">
                    <div className="min-w-0 box-border">
                      <Label className="text-xs sm:text-base font-semibold mb-1 sm:mb-2 block text-white">
                        Barbeiro
                      </Label>
                      <Select
                        value={selectedBarberId}
                        onValueChange={(value) => setSelectedBarberId(value)}
                      >
                        <SelectTrigger className="bg-white/5 border border-white/20 text-white text-base w-full box-border">
                          <SelectValue placeholder="Selecione um barbeiro" className="text-white" />
                        </SelectTrigger>
                        <SelectContent>
                          {barbers.map((b) => (
                            <SelectItem key={b.id} value={b.id} className="text-sm">
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 box-border">
                      <Label className="text-xs sm:text-base font-semibold mb-1 sm:mb-2 block text-white">
                        Intervalo de bloqueio (global)
                      </Label>
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0 box-border">
                        <Input
                          type="time"
                          value={blockStartInput}
                          onChange={(e) => setBlockStartInput(e.target.value)}
                          className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                          step={900}
                          placeholder="Início"
                        />
                        <span className="text-white/60 text-xs whitespace-nowrap flex-shrink-0">até</span>
                        <Input
                          type="time"
                          value={blockEndInput}
                          onChange={(e) => setBlockEndInput(e.target.value)}
                          className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                          step={900}
                          placeholder="Fim"
                        />
                      </div>
                      <p className="text-xs text-white/60 mt-1">
                        Este intervalo será aplicado a todos os dias em que o barbeiro estiver trabalhando.
                      </p>
                    </div>
                  </div>

                  {selectedBarberId && (
                    <div className="flex flex-col gap-2 sm:gap-3 border-t border-white/20 pt-3 sm:pt-4 mt-2 box-border">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 box-border">
                        <Button
                          disabled={savingBlock || !blockStartInput || !blockEndInput || loadingBlock}
                          onClick={async () => {
                            if (!selectedBarberId || !blockStartInput || !blockEndInput) return;
                            if (blockStartInput >= blockEndInput) {
                              setError("O horário de início deve ser menor que o horário de fim.");
                              return;
                            }
                            setError(null);
                            setSavingBlock(true);
                            try {
                              await adminSetBarberDayBlock(selectedBarberId, null, blockStartInput, blockEndInput);
                              setDayBlock({ start_time: blockStartInput, end_time: blockEndInput });
                            } catch (err) {
                              console.error("Erro ao salvar bloqueio de barbeiro:", err);
                              setError("Não foi possível salvar o bloqueio. Tente novamente.");
                            } finally {
                              setSavingBlock(false);
                            }
                          }}
                          className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark w-full sm:w-auto text-xs sm:text-base h-8 sm:h-10 box-border"
                        >
                          {savingBlock ? (
                            <>
                              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin flex-shrink-0" />
                              <span className="hidden sm:inline">Salvando...</span>
                              <span className="sm:hidden">Salvando</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Aplicar bloqueio</span>
                              <span className="sm:hidden">Aplicar</span>
                            </>
                          )}
                        </Button>

                        {dayBlock.start_time && dayBlock.end_time && (
                          <Button
                            disabled={savingBlock || loadingBlock}
                            onClick={async () => {
                              if (!selectedBarberId) return;
                              setError(null);
                              setSavingBlock(true);
                              try {
                                await adminSetBarberDayBlock(selectedBarberId, null, null, null);
                                setDayBlock({ start_time: null, end_time: null });
                                setBlockStartInput("");
                                setBlockEndInput("");
                              } catch (err) {
                                console.error("Erro ao remover bloqueio de barbeiro:", err);
                                setError("Não foi possível remover o bloqueio. Tente novamente.");
                              } finally {
                                setSavingBlock(false);
                              }
                            }}
                            className="bg-transparent border border-white/40 text-white hover:bg-white/10 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto text-xs sm:text-base h-8 sm:h-10 box-border"
                          >
                            <span className="hidden sm:inline">Reabrir horário completo</span>
                            <span className="sm:hidden">Reabrir</span>
                          </Button>
                        )}
                      </div>

                      <div className="text-xs text-white/70">
                        {loadingBlock
                          ? "Carregando bloqueio atual..."
                          : dayBlock.start_time && dayBlock.end_time
                          ? `Atualmente bloqueado de ${dayBlock.start_time} até ${dayBlock.end_time}.`
                          : "Nenhum bloqueio global cadastrado para este barbeiro."}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </section>
  );
}


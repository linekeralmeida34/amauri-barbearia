// src/routes/AdminSettings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBusinessHours,
  setBusinessHours as setBusinessHoursApi,
  type BusinessHours,
  type Barber,
  type BarberDayBlock,
  type BarberDayBlockItem,
  fetchActiveBarbers,
  fetchBarberDayBlock,
  fetchBarberDayBlocks,
  adminSetBarberDayBlock,
  adminSetBarberDayBlockRange,
  addBarberDayBlock,
  removeBarberDayBlock,
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
import { Clock, Save, Loader2, Check, Settings, Scissors, Plus, Trash2, X } from "lucide-react";
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
  const [blockNameInput, setBlockNameInput] = useState<string>("");
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [blocksList, setBlocksList] = useState<BarberDayBlockItem[]>([]);
  const [selectedDayForBlocks, setSelectedDayForBlocks] = useState<string>(todayLocalYMD());

  // Estado para bloqueio por período / dias da semana (UI)
  const [rangeStartDate, setRangeStartDate] = useState<string>("");
  const [rangeEndDate, setRangeEndDate] = useState<string>("");
  const [rangeWeekdays, setRangeWeekdays] = useState<number[]>([]); // ISO 1-7 (1=seg..7=dom)

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

  // Carrega os bloqueios ao trocar o barbeiro ou data selecionada
  useEffect(() => {
    if (!selectedBarberId) {
      setDayBlock({ start_time: null, end_time: null });
      setBlockStartInput("");
      setBlockEndInput("");
      setBlockNameInput("");
      setRangeStartDate("");
      setRangeEndDate("");
      setRangeWeekdays([]);
      setBlocksList([]);
      return;
    }

    setLoadingBlock(true);
    // Carrega bloqueio único (compatibilidade)
    fetchBarberDayBlock(selectedBarberId, selectedDayForBlocks)
      .then((block) => {
        setDayBlock(block);
        setBlockStartInput(block.start_time || "");
        setBlockEndInput(block.end_time || "");
      })
      .catch((err) => {
        console.error("Erro ao carregar bloqueio do barbeiro:", err);
        setDayBlock({ start_time: null, end_time: null });
        setBlockStartInput("");
        setBlockEndInput("");
      });
    
    // Carrega lista de TODOS os bloqueios
    fetchBarberDayBlocks(selectedBarberId, selectedDayForBlocks)
      .then((blocks) => {
        setBlocksList(blocks);
      })
      .catch((err) => {
        console.error("Erro ao carregar lista de bloqueios:", err);
        setBlocksList([]);
      })
      .finally(() => setLoadingBlock(false));
  }, [selectedBarberId, selectedDayForBlocks]);

  // Carrega preferências de período/dias salvas localmente (por barbeiro)
  useEffect(() => {
    if (!selectedBarberId) return;
    try {
      const key = `barber_block_ui:${selectedBarberId}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.rangeStartDate === "string") {
          setRangeStartDate(parsed.rangeStartDate);
        }
        if (typeof parsed.rangeEndDate === "string") {
          setRangeEndDate(parsed.rangeEndDate);
        }
        if (Array.isArray(parsed.rangeWeekdays)) {
          setRangeWeekdays(
            parsed.rangeWeekdays.filter((n: any) => Number.isInteger(n))
          );
        }
      }
    } catch (err) {
      console.warn("Não foi possível carregar preferências de período/dias:", err);
    }
  }, [selectedBarberId]);

  // Persiste no localStorage as escolhas de período/dias, por barbeiro
  useEffect(() => {
    if (!selectedBarberId) return;
    try {
      const key = `barber_block_ui:${selectedBarberId}`;
      const payload = { rangeStartDate, rangeEndDate, rangeWeekdays };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn("Não foi possível salvar preferências de período/dias:", err);
    }
  }, [selectedBarberId, rangeStartDate, rangeEndDate, rangeWeekdays]);

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
            <div className="min-w-0 box-border">
              <Label className="text-xs sm:text-base font-semibold mb-1 sm:mb-2 block text-white">
                Abertura / Fechamento *
              </Label>
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 box-border">
                <Input
                  id="open_time"
                  type="time"
                  value={businessHours.open_time}
                  onChange={(e) =>
                    setBusinessHours({ ...businessHours, open_time: e.target.value })
                  }
                  className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                  step={900} // 15 minutos
                  placeholder="Abertura"
                />
                <span className="text-white/60 text-xs whitespace-nowrap flex-shrink-0">até</span>
                <Input
                  id="close_time"
                  type="time"
                  value={businessHours.close_time}
                  onChange={(e) =>
                    setBusinessHours({ ...businessHours, close_time: e.target.value })
                  }
                  className="bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-base flex-1 min-w-0 box-border"
                  step={900} // 15 minutos
                  placeholder="Fechamento"
                />
              </div>
              <p className="text-xs text-white/60 mt-1">
                Horário em que a barbearia abre e fecha
              </p>
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
                    Configure múltiplos intervalos em que cada barbeiro não pode receber agendamentos.
                    Você pode adicionar vários fechamentos (ex: das 16h em diante, depois das 14h às 14h30).
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
                        Data para visualizar bloqueios
                      </Label>
                      <Input
                        type="date"
                        value={selectedDayForBlocks}
                        onChange={(e) => setSelectedDayForBlocks(e.target.value)}
                        className="bg-white/5 border border-white/20 text-white text-base w-full box-border"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Selecione uma data para ver os bloqueios aplicados. Bloqueios globais aparecem em todas as datas.
                      </p>
                    </div>
                  </div>

                  {/* Lista de Fechamentos Existentes */}
                  {selectedBarberId && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-xs sm:text-base font-semibold text-white">
                          Fechamentos Configurados
                        </Label>
                        {loadingBlock && (
                          <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                        )}
                      </div>
                      
                      {blocksList.length === 0 ? (
                        <p className="text-xs text-white/60 py-4 text-center">
                          Nenhum fechamento configurado para este barbeiro nesta data.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {blocksList.map((block, index) => (
                            <div
                              key={block.id}
                              className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-medium text-white">
                                    {block.name || `Fechamento ${index + 1}`}
                                  </span>
                                  {block.is_global && (
                                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                                      Global
                                    </span>
                                  )}
                                  {!block.is_global && block.day && (
                                    <span className="text-xs text-white/60">
                                      {new Date(block.day).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs sm:text-sm text-white/80 mt-1">
                                  {block.start_time} até {block.end_time}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm("Deseja remover este fechamento?")) return;
                                  setSavingBlock(true);
                                  try {
                                    await removeBarberDayBlock(block.id);
                                    // Recarrega a lista
                                    const blocks = await fetchBarberDayBlocks(selectedBarberId, selectedDayForBlocks);
                                    setBlocksList(blocks);
                                  } catch (err: any) {
                                    console.error("Erro ao remover fechamento:", err);
                                    setError(err.message || "Erro ao remover fechamento.");
                                  } finally {
                                    setSavingBlock(false);
                                  }
                                }}
                                disabled={savingBlock}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formulário para Adicionar Novo Fechamento */}
                  {selectedBarberId && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <Label className="text-xs sm:text-base font-semibold mb-3 block text-white">
                        Adicionar Novo Fechamento
                      </Label>
                      
                      <div className="space-y-3">
                        <div className="min-w-0 box-border">
                          <Label className="text-xs sm:text-sm text-white/80 mb-1 block">
                            Nome do fechamento (opcional)
                          </Label>
                          <Input
                            type="text"
                            value={blockNameInput}
                            onChange={(e) => setBlockNameInput(e.target.value)}
                            placeholder="Ex: Fechamento 1, Pausa almoço, etc."
                            className="bg-white/5 border border-white/20 text-white text-sm w-full box-border"
                          />
                        </div>

                        <div className="min-w-0 box-border">
                          <Label className="text-xs sm:text-sm text-white/80 mb-1 block">
                            Horário
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
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="isGlobalBlock"
                            checked={!rangeStartDate && !rangeEndDate && rangeWeekdays.length === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRangeStartDate("");
                                setRangeEndDate("");
                                setRangeWeekdays([]);
                              }
                            }}
                            className="w-4 h-4 text-amber-500 bg-white/5 border-white/20 rounded focus:ring-amber-500"
                          />
                          <Label htmlFor="isGlobalBlock" className="text-xs sm:text-sm text-white/80 cursor-pointer">
                            Aplicar para todos os dias (bloqueio global)
                          </Label>
                        </div>
                      </div>

                      {/* Período e dias da semana (opcional) */}
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <Label className="text-xs sm:text-base font-semibold mb-1 sm:mb-2 block text-white">
                          Período e dias da semana (opcional)
                        </Label>
                        <p className="text-xs text-white/60 mb-3">
                          Se não informar período nem dias da semana, o bloqueio será aplicado apenas no dia selecionado acima.
                          Se escolher apenas dias da semana, o bloqueio valerá para esses dias, a partir de hoje.
                          Se definir período, o bloqueio valerá apenas entre as datas informadas.
                        </p>
                        
                        <div className="min-w-0 box-border mb-3">
                          <Label className="text-xs sm:text-sm text-white/80 mb-1 block">
                            Período (opcional)
                          </Label>
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0 box-border">
                            <Input
                              type="date"
                              value={rangeStartDate}
                              onChange={(e) => setRangeStartDate(e.target.value)}
                              className="bg-white/5 border border-white/20 text-white text-sm sm:text-base flex-1 min-w-0"
                            />
                            <span className="text-white/60 text-xs whitespace-nowrap flex-shrink-0">
                              até
                            </span>
                            <Input
                              type="date"
                              value={rangeEndDate}
                              onChange={(e) => setRangeEndDate(e.target.value)}
                              className="bg-white/5 border border-white/20 text-white text-sm sm:text-base flex-1 min-w-0"
                            />
                          </div>
                          <div className="flex justify-end mt-2 box-border">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setRangeStartDate("");
                                setRangeEndDate("");
                              }}
                              className="h-7 px-3 text-[11px] sm:text-xs bg-transparent border-white/30 text-white hover:bg-white/10"
                            >
                              Limpar período
                            </Button>
                          </div>
                        </div>

                        <div className="min-w-0 box-border">
                          <Label className="text-xs sm:text-sm text-white/80 mb-1 block">
                            Dias da semana (opcional)
                          </Label>
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 sm:gap-2 text-xs sm:text-sm">
                            {[
                              { label: "Seg", iso: 1 },
                              { label: "Ter", iso: 2 },
                              { label: "Qua", iso: 3 },
                              { label: "Qui", iso: 4 },
                              { label: "Sex", iso: 5 },
                              { label: "Sáb", iso: 6 },
                              { label: "Dom", iso: 7 },
                            ].map((d) => {
                              const active = rangeWeekdays.includes(d.iso);
                              return (
                                <button
                                  key={d.iso}
                                  type="button"
                                  onClick={() => {
                                    setRangeWeekdays((prev) =>
                                      prev.includes(d.iso)
                                        ? prev.filter((x) => x !== d.iso)
                                        : [...prev, d.iso]
                                    );
                                  }}
                                  className={`px-2 py-1 rounded-md border text-xs sm:text-sm transition-colors ${
                                    active
                                      ? "bg-barbershop-gold text-barbershop-dark border-barbershop-gold"
                                      : "bg-white/5 text-white border-white/20 hover:bg-white/10"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] sm:text-xs text-white/60 mt-1">
                            Se nada for selecionado, o bloqueio será aplicado apenas no dia selecionado acima.
                          </p>
                        </div>
                      </div>

                      {/* Botão para adicionar fechamento */}
                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={async () => {
                            if (!selectedBarberId || !blockStartInput || !blockEndInput) {
                              setError("Preencha o horário de início e fim.");
                              return;
                            }

                            if (blockStartInput >= blockEndInput) {
                              setError("O horário de início deve ser menor que o horário de fim.");
                              return;
                            }

                            setError(null);
                            setSavingBlock(true);
                            try {
                              const hasDates = !!rangeStartDate && !!rangeEndDate;
                              const hasWeekdays = rangeWeekdays.length > 0;
                              const isGlobal = !hasDates && !hasWeekdays && !rangeStartDate && !rangeEndDate;

                              // Se tem período ou dias da semana, usa a função de range
                              if (hasDates || hasWeekdays) {
                                // Validações
                                if (hasDates && rangeStartDate > rangeEndDate) {
                                  setError("A data inicial deve ser menor ou igual à data final.");
                                  setSavingBlock(false);
                                  return;
                                }

                                let startDate = rangeStartDate;
                                let endDate = rangeEndDate;

                                if (!hasDates) {
                                  // Nenhum período escolhido: aplica a partir de hoje por alguns anos
                                  const today = todayLocalYMD();
                                  const end = new Date();
                                  end.setFullYear(end.getFullYear() + 5);
                                  const y = end.getFullYear();
                                  const m = String(end.getMonth() + 1).padStart(2, "0");
                                  const d = String(end.getDate() + 0).padStart(2, "0");
                                  startDate = today;
                                  endDate = `${y}-${m}-${d}`;
                                }

                                // Usa função de faixa de datas para criar bloqueios em múltiplos dias
                                await adminSetBarberDayBlockRange(
                                  selectedBarberId,
                                  startDate!,
                                  endDate!,
                                  blockStartInput,
                                  blockEndInput,
                                  hasWeekdays ? rangeWeekdays : null
                                );
                              } else {
                                // Bloqueio único: dia específico ou global
                                const dayToUse = isGlobal ? null : selectedDayForBlocks;
                                
                                await addBarberDayBlock(
                                  selectedBarberId,
                                  dayToUse,
                                  blockStartInput,
                                  blockEndInput,
                                  blockNameInput || null,
                                  isGlobal
                                );
                              }

                              // Limpa o formulário
                              setBlockStartInput("");
                              setBlockEndInput("");
                              setBlockNameInput("");
                              setRangeStartDate("");
                              setRangeEndDate("");
                              setRangeWeekdays([]);

                              // Recarrega a lista
                              const blocks = await fetchBarberDayBlocks(selectedBarberId, selectedDayForBlocks);
                              setBlocksList(blocks);
                            } catch (err: any) {
                              console.error("Erro ao adicionar fechamento:", err);
                              setError(err.message || "Erro ao adicionar fechamento.");
                            } finally {
                              setSavingBlock(false);
                            }
                          }}
                          disabled={savingBlock || !blockStartInput || !blockEndInput}
                          className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark w-full sm:w-auto"
                        >
                          {savingBlock ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adicionando...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Fechamento
                            </>
                          )}
                        </Button>
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


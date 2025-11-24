// src/routes/CustomerBookings.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Clock,
  Filter,
  User,
  Scissors,
  DollarSign,
  Phone,
  ArrowLeft,
  XCircle,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  fetchCustomerBookings,
  cancelCustomerBooking,
  canCustomerCancelBooking,
  type CustomerBooking,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackBookingCanceled, trackClick } from "@/lib/analytics";

// Mesmo link de WhatsApp usado na home (Index.tsx)
const BARBERSHOP_WHATSAPP_URL = "https://wa.me/message/FVJDVARVMA2XE1";

/** Formata data/hora para exibição */
function fmtDateTimeBR(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata preço */
function fmtPriceBR(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formata telefone */
function fmtPhoneBR(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/** Badge de status */
function StatusBadge({ status }: { status: CustomerBooking["status"] }) {
  const config = {
    pending: {
      icon: AlertTriangle,
      color: "bg-amber-100 text-amber-800 border-amber-200",
      label: "Pendente",
    },
    confirmed: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-200",
      label: "Confirmado",
    },
    canceled: {
      icon: XCircle,
      color: "bg-red-100 text-red-800 border-red-200",
      label: "Cancelado",
    },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function CustomerBookings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const phone = searchParams.get("phone");

  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<CustomerBooking | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!phone) {
      setError("Telefone não informado");
      setLoading(false);
      return;
    }

    loadBookings();
  }, [phone]);

  async function loadBookings() {
    if (!phone) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchCustomerBookings(phone);
      setBookings(data);
    } catch (err: any) {
      console.error("Erro ao carregar agendamentos:", err);
      
      // Mensagens de erro mais específicas
      if (err?.message?.includes("Telefone inválido")) {
        setError("Telefone inválido. Por favor, verifique o número.");
      } else if (err?.code === "PGRST301" || err?.code === "42501" || err?.message?.includes("permission") || err?.message?.includes("RLS") || err?.message?.includes("denied")) {
        setError(
          "Erro de permissão. Execute o script SQL 'fix_customer_bookings_rls_simple.sql' no Supabase para configurar as permissões."
        );
      } else if (err?.message?.includes("does not exist") || err?.message?.includes("function")) {
        setError(
          "Função não encontrada. Execute o script SQL 'fix_customer_bookings_rls_simple.sql' no Supabase para criar a função necessária."
        );
      } else if (err?.message) {
        setError(`Erro: ${err.message}`);
      } else {
        setError("Erro ao carregar agendamentos. Verifique o telefone e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCancelClick(booking: CustomerBooking) {
    if (!canCustomerCancelBooking(booking)) {
      setError("Este agendamento não pode ser cancelado. Entre em contato conosco.");
      return;
    }
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (!bookingToCancel || !phone) return;

    setCanceling(true);
    setError(null); // Limpa erros anteriores
    try {
      await cancelCustomerBooking(bookingToCancel.id, phone);
      
      // Rastreia cancelamento
      trackBookingCanceled(bookingToCancel.id, 'customer_cancel');
      
      // Atualiza o status localmente
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingToCancel.id ? { ...b, status: "canceled" as const } : b))
      );
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    } catch (err: any) {
      console.error("Erro ao cancelar agendamento:", err);
      // Usa a mensagem de erro específica se disponível
      const errorMessage = err?.message || "Erro ao cancelar agendamento. Tente novamente.";
      setError(errorMessage);
    } finally {
      setCanceling(false);
    }
  }

  /** --------- filtros locais (cliente) --------- */
  const [statusFilter, setStatusFilter] = useState<"" | CustomerBooking["status"]>("");
  const [barberFilter, setBarberFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  /** Lista de barbeiros disponíveis (com base nos agendamentos carregados) */
  const availableBarbers = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      if (b.barbers?.id && b.barbers.name) {
        map.set(String(b.barbers.id), b.barbers.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  /** Aplica filtros e ordena por data */
  const filteredBookings = useMemo(() => {
    let list = [...bookings];

    if (statusFilter) {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (barberFilter) {
      list = list.filter((b) => String(b.barbers?.id ?? "") === barberFilter);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      list = list.filter((b) => new Date(b.starts_at).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      list = list.filter((b) => new Date(b.starts_at).getTime() <= toTs);
    }

    list.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
    return list;
  }, [bookings, statusFilter, barberFilter, dateFrom, dateTo]);

  /** Agrupa agendamentos filtrados por status / período */
  const now = new Date();
  const upcomingBookings = filteredBookings.filter(
    (b) => b.status !== "canceled" && new Date(b.starts_at) > now
  );
  const pastBookings = filteredBookings.filter(
    (b) => b.status !== "canceled" && new Date(b.starts_at) <= now
  );
  const canceledBookings = filteredBookings.filter((b) => b.status === "canceled");

  const hasActiveFilters =
    !!statusFilter || !!barberFilter || !!dateFrom || !!dateTo;

  function clearFilters() {
    setStatusFilter("");
    setBarberFilter("");
    setDateFrom("");
    setDateTo("");
  }

  if (!phone) {
    return (
      <section className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <Card className="bg-white/95 backdrop-blur-sm max-w-md w-full">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertDescription>Telefone não informado. Por favor, acesse novamente.</AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Button asChild variant="outline">
                  <Link to="/cliente/login">Voltar para login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen relative overflow-hidden">
      {/* Fundo */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between text-white">
            <a href="#/" className="font-bold text-lg tracking-tight">
              <span className="text-white">Amauri</span>
              <span className="text-barbershop-gold">Barbearia</span>
            </a>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/cliente/login")}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
          {/* Header estilo painel */}
          <div className="bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-black/90 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  Meus{" "}
                  <span className="bg-gradient-to-r from-barbershop-gold to-amber-300 bg-clip-text text-transparent">
                    Agendamentos
                  </span>
                </h1>
                <p className="text-white/70 text-sm sm:text-base">
                  WhatsApp: {fmtPhoneBR(phone)}
                </p>
              </div>
              {hasActiveFilters && (
                <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-full self-start">
                  <Filter className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-sm font-medium">
                    Filtros Ativos
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filtros estilo painel */}
          <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Filtros
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Status */}
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex items-center gap-2">
                  <label className="text-white/80 text-sm font-medium">
                    Status
                  </label>
                  {statusFilter && (
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  )}
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as CustomerBooking["status"] | "")
                  }
                  className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                    statusFilter
                      ? "border-amber-500/50 bg-amber-500/10 text-white"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                  style={{
                    colorScheme: "dark",
                    fontSize: "16px",
                  }}
                >
                  <option value="" className="bg-gray-800 text-white">
                    Todos
                  </option>
                  <option value="pending" className="bg-gray-800 text-white">
                    Pendente
                  </option>
                  <option value="confirmed" className="bg-gray-800 text-white">
                    Confirmado
                  </option>
                  <option value="canceled" className="bg-gray-800 text-white">
                    Cancelado
                  </option>
                </select>
              </div>

              {/* Barbeiro */}
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex items-center gap-2">
                  <label className="text-white/80 text-sm font-medium">
                    Barbeiro
                  </label>
                  {barberFilter && (
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  )}
                </div>
                <select
                  value={barberFilter}
                  onChange={(e) => setBarberFilter(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                    barberFilter
                      ? "border-amber-500/50 bg-amber-500/10 text-white"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                  style={{
                    colorScheme: "dark",
                    fontSize: "16px",
                  }}
                >
                  <option value="" className="bg-gray-800 text-white">
                    Todos
                  </option>
                  {availableBarbers.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-gray-800 text-white"
                    >
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Inicial */}
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex items-center gap-2">
                  <label className="text-white/80 text-sm font-medium">
                    Data Inicial
                  </label>
                  {dateFrom && (
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  )}
                </div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                    dateFrom
                      ? "border-amber-500/50 bg-amber-500/10 text-white"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                  style={{
                    fontSize: "16px",
                  }}
                />
              </div>

              {/* Data Final */}
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex items-center gap-2">
                  <label className="text-white/80 text-sm font-medium">
                    Data Final
                  </label>
                  {dateTo && (
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  )}
                </div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                    dateTo
                      ? "border-amber-500/50 bg-amber-500/10 text-white"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                  style={{
                    fontSize: "16px",
                  }}
                />
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 col-span-1 sm:col-span-2 lg:col-span-4">
                <label className="text-white/80 text-sm font-medium">
                  Ações
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={clearFilters}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-white/10 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Limpar filtros
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadBookings}
                    disabled={loading}
                    className="flex-1 border-amber-500/60 text-amber-300 hover:bg-amber-500/10"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${
                        loading ? "animate-spin" : ""
                      }`}
                    />
                    Atualizar lista
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-barbershop-gold" />
            </div>
          ) : bookings.length === 0 ? (
            <Card className="bg-white/95 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum agendamento encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Não encontramos agendamentos para este telefone.
                </p>
                <Button asChild>
                  <Link to="/agendar">Fazer um novo agendamento</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Agendamentos Futuros */}
              {upcomingBookings.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-barbershop-gold" />
                    Próximos Agendamentos
                  </h2>
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onCancel={() => handleCancelClick(booking)}
                        canCancel={canCustomerCancelBooking(booking)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Agendamentos Passados */}
              {pastBookings.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    Histórico
                  </h2>
                  <div className="space-y-4">
                    {pastBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onCancel={() => {}}
                        canCancel={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Agendamentos Cancelados */}
              {canceledBookings.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    Cancelados
                  </h2>
                  <div className="space-y-4">
                    {canceledBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onCancel={() => {}}
                        canCancel={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Botão para novo agendamento */}
              <div className="pt-4">
                <Button asChild className="w-full sm:w-auto" size="lg">
                  <Link to="/agendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    Fazer Novo Agendamento
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Botão de atualizar */}
          {!loading && bookings.length > 0 && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={loadBookings}
                disabled={loading}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
              {bookingToCancel && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{bookingToCancel.services?.name || "Serviço"}</p>
                  <p className="text-sm text-gray-600">
                    {fmtDateTimeBR(bookingToCancel.starts_at)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Barbeiro: {bookingToCancel.barbers?.name || "—"}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel 
              disabled={canceling} 
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Não, manter
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              disabled={canceling}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 order-1 sm:order-2 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {canceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sim, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Card/Box de agendamento (estilo mobile do painel: box expansível) */
function BookingCard({
  booking,
  onCancel,
  canCancel,
}: {
  booking: CustomerBooking;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const whatsappLink = BARBERSHOP_WHATSAPP_URL;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/15 rounded-xl overflow-hidden">
      {/* Cabeçalho compacto clicável */}
      <button
        type="button"
        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={booking.status} />
          </div>
          <div className="text-white font-medium text-sm sm:text-base truncate">
            {booking.services?.name || "Serviço"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/70">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-barbershop-gold" />
              {fmtDateTimeBR(booking.starts_at)}
            </span>
            {booking.duration_min && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-white/70" />
                {booking.duration_min} min
              </span>
            )}
          </div>
        </div>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-white/70 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Detalhes expandido */}
      {expanded && (
        <div 
          className="border-t border-white/10 p-4 space-y-4 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-white/60 text-xs">Barbeiro</p>
              <p className="font-medium flex items-center gap-1 text-white">
                <User className="h-4 w-4" />
                {booking.barbers?.name || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-xs">Valor</p>
              <p className="font-semibold flex items-center gap-1 text-emerald-400">
                <DollarSign className="h-4 w-4" />
                {fmtPriceBR(booking.price)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-xs">Telefone cadastrado</p>
              <p className="font-medium flex items-center gap-1 text-white">
                <Phone className="h-4 w-4" />
                {fmtPhoneBR(booking.phone)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-xs">Status</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={booking.status} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/5">
            {canCancel && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }}
                className="w-full sm:w-auto touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Agendamento
              </Button>
            )}

            {whatsappLink && booking.status !== "canceled" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="w-full sm:w-auto border-green-500/60 text-green-400 hover:bg-green-500/10 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com a Barbearia
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


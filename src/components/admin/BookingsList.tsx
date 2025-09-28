// src/components/admin/BookingsList.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBarberAuth } from "@/hooks/useBarberAuth";
import { 
  Calendar, 
  Clock, 
  Users, 
  Filter,
  RotateCcw,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CreditCard,
  Banknote,
  Smartphone,
  DollarSign
} from "lucide-react";

/** ---------- Tipos ---------- */
type BookingStatus = "pending" | "confirmed" | "canceled";
type PaymentMethod = "credit_card" | "debit_card" | "cash" | "pix" | null;

type BookingRow = {
  id: string;
  starts_at: string; // timestamptz
  status: BookingStatus;
  customer_name: string | null;
  phone: string | null;
  price: number | null;
  payment_method: PaymentMethod;
  services?: { name: string | null } | null;
  barbers?: { name: string | null; id?: string } | null;
};

type BarberLite = { id: string; name: string };

/** ---------- Utils de formatação ---------- */
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

function fmtPriceBR(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { 
    style: "currency", 
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function fmtPhoneBR(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function fmtPaymentMethod(method: PaymentMethod): string {
  const methods = {
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito", 
    cash: "Dinheiro",
    pix: "PIX",
    null: "—"
  };
  return methods[method || "null"];
}

/** ---------- Componente de Status Badge ---------- */
function StatusBadge({ status }: { status: BookingStatus }) {
  const config = {
    pending: { 
      icon: AlertTriangle, 
      color: "bg-amber-100 text-amber-800 border-amber-200", 
      label: "Pendente" 
    },
    confirmed: { 
      icon: CheckCircle, 
      color: "bg-green-100 text-green-800 border-green-200", 
      label: "Confirmado" 
    },
    canceled: { 
      icon: XCircle, 
      color: "bg-red-100 text-red-800 border-red-200", 
      label: "Cancelado" 
    }
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/** ---------- Componente de Forma de Pagamento Badge ---------- */
function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const config = {
    credit_card: { 
      icon: CreditCard, 
      color: "bg-blue-100 text-blue-800 border-blue-200", 
      label: "Crédito" 
    },
    debit_card: { 
      icon: CreditCard, 
      color: "bg-indigo-100 text-indigo-800 border-indigo-200", 
      label: "Débito" 
    },
    cash: { 
      icon: Banknote, 
      color: "bg-green-100 text-green-800 border-green-200", 
      label: "Dinheiro" 
    },
    pix: { 
      icon: Smartphone, 
      color: "bg-purple-100 text-purple-800 border-purple-200", 
      label: "PIX" 
    },
    null: { 
      icon: X, 
      color: "bg-gray-100 text-gray-800 border-gray-200", 
      label: "—" 
    }
  };

  const { icon: Icon, color, label } = config[method || "null"];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/** ---------- Componente de Estatísticas ---------- */
function StatsCard({ icon: Icon, title, value, subtitle, color = "text-blue-600" }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl p-4 hover:from-slate-600/50 hover:to-slate-700/50 transition-all duration-200 hover:scale-105 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-300 text-sm font-medium">{title}</p>
          <p className="text-white text-2xl font-bold mt-1">{value}</p>
          <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br from-slate-600/60 to-slate-700/60 ${color} shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

/** ---------- Componente ---------- */
export default function BookingsList() {
  const { barber, isAdmin, canCancelBookings } = useBarberAuth();
  
  // Verificar se é admin via email também (para lineker.dev@gmail.com)
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  
  useEffect(() => {
    const checkEmailAdmin = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.email === "lineker.dev@gmail.com") {
          setIsEmailAdmin(true);
        }
      } catch (error) {
        console.error("Erro ao verificar email admin:", error);
      }
    };
    checkEmailAdmin();
  }, []);
  
  const finalIsAdmin = isAdmin || isEmailAdmin;
  const finalCanCancel = canCancelBookings || isEmailAdmin;
  
  /** dados crus */
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [barbers, setBarbers] = useState<BarberLite[]>([]);

  /** filtros */
  const [statusFilter, setStatusFilter] = useState<"" | BookingStatus>("");
  const [barberFilter, setBarberFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<"" | PaymentMethod>("");
  const [dateFrom, setDateFrom] = useState<string>(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>(""); // yyyy-mm-dd
  const [todayOnly, setTodayOnly] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);

  /** --------- fetch inicial (bookings + barbers) --------- */
  async function fetchAll() {
    setLoading(true);
    try {
      // Barbeiros para o filtro (apenas se for admin)
      if (finalIsAdmin) {
        try {
          // Primeiro, tentar com is_active
          let { data: barbs, error: barbsError } = await supabase
            .from("barbers")
            .select("id,name")
            .eq("is_active", true)
            .order("name", { ascending: true });
          
          // Se der erro 400, tentar sem o filtro is_active
          if (barbsError && barbsError.code === "400") {
            console.warn("[BookingsList] Coluna is_active não encontrada, buscando todos os barbeiros");
            const { data: allBarbs, error: allBarbsError } = await supabase
              .from("barbers")
              .select("id,name")
              .order("name", { ascending: true });
            
            if (allBarbsError) {
              console.error("[BookingsList] Erro ao buscar barbeiros:", allBarbsError);
              setBarbers([]);
            } else {
              setBarbers((allBarbs ?? []) as BarberLite[]);
            }
          } else if (barbsError) {
            console.error("[BookingsList] Erro ao buscar barbeiros:", barbsError);
            setBarbers([]);
          } else {
            setBarbers((barbs ?? []) as BarberLite[]);
          }
        } catch (error) {
          console.error("[BookingsList] Erro inesperado ao buscar barbeiros:", error);
          setBarbers([]);
        }
      } else {
        // Barbeiro comum só vê a si mesmo
        setBarbers([{ id: barber?.id || "", name: barber?.name || "" }]);
      }

      // Bookings - filtrar por barbeiro se não for admin
      let query = supabase
        .from("bookings")
        .select(
          `
          id,
          starts_at,
          status,
          customer_name,
          phone,
          price,
          payment_method,
          services ( name ),
          barbers ( id, name )
        `
        );

      // Se não for admin, filtrar apenas agendamentos do barbeiro logado
      if (!finalIsAdmin && barber?.id) {
        query = query.eq("barber_id", barber.id);
      }

      const { data, error } = await query.order("starts_at", { ascending: true });

      if (error) {
        console.error("[BookingsList] Erro ao buscar agendamentos:", error);
        throw error;
      }
      
      setRows((data ?? []) as BookingRow[]);
    } finally {
      setLoading(false);
    }
  }

  /** --------- update de status --------- */
  async function updateStatus(id: string, newStatus: BookingStatus) {
    // Verificar se pode cancelar (apenas admin)
    if (newStatus === "canceled" && !finalCanCancel) {
      alert("Apenas o administrador pode cancelar agendamentos.");
      return;
    }

    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    }
  }

  /** --------- update de forma de pagamento --------- */
  async function updatePaymentMethod(id: string, newMethod: PaymentMethod) {
    const { error } = await supabase.from("bookings").update({ payment_method: newMethod }).eq("id", id);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, payment_method: newMethod } : r)));
    }
  }

  /** --------- realtime --------- */
  useEffect(() => {
    // Só carrega os dados quando o barbeiro estiver definido
    if (barber) {
      fetchAll();
    }

    const channel = supabase
      .channel("bookings-admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          // Só processa eventos se for admin ou se o agendamento for do barbeiro logado
          const isRelevantBooking = finalIsAdmin || 
            (barber?.id && (payload.new as any)?.barber_id === barber.id);
          
          if (!isRelevantBooking) return;

          if (payload.eventType === "INSERT") {
            setRows((prev) => {
              const next = [...prev, payload.new as BookingRow];
              next.sort(
                (a, b) =>
                  new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
              );
              return next;
            });
          }
          if (payload.eventType === "UPDATE") {
            setRows((prev) =>
              prev.map((r) => (r.id === (payload.new as any).id ? (payload.new as any) : r))
            );
          }
          if (payload.eventType === "DELETE") {
            setRows((prev) => prev.filter((r) => r.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barber, finalIsAdmin]);

  /** --------- aplicação dos filtros + ordenação garantida --------- */
  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (barberFilter) {
      list = list.filter((r) => String(r.barbers?.id ?? "") === barberFilter);
    }
    if (paymentFilter) {
      list = list.filter((r) => r.payment_method === paymentFilter);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      list = list.filter((r) => new Date(r.starts_at).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      list = list.filter((r) => new Date(r.starts_at).getTime() <= toTs);
    }
    if (todayOnly) {
      const today = new Date().toDateString();
      list = list.filter((r) => new Date(r.starts_at).toDateString() === today);
    }

    list.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
    return list;
  }, [rows, statusFilter, barberFilter, paymentFilter, dateFrom, dateTo, todayOnly]);

  /** --------- estatísticas calculadas (dados originais) --------- */
  const originalStats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const confirmed = rows.filter(r => r.status === 'confirmed').length;
    const canceled = rows.filter(r => r.status === 'canceled').length;
    const today = new Date().toDateString();
    const todayBookings = rows.filter(r => new Date(r.starts_at).toDateString() === today).length;
    
    // Calcular receita total (apenas agendamentos confirmados)
    const totalRevenue = rows
      .filter(r => r.status === 'confirmed' && r.price)
      .reduce((sum, r) => sum + (r.price || 0), 0);
    
    return { total, pending, confirmed, canceled, todayBookings, totalRevenue };
  }, [rows]);

  /** --------- estatísticas dos dados filtrados --------- */
  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const pending = filtered.filter(r => r.status === 'pending').length;
    const confirmed = filtered.filter(r => r.status === 'confirmed').length;
    const canceled = filtered.filter(r => r.status === 'canceled').length;
    const today = new Date().toDateString();
    const todayBookings = filtered.filter(r => new Date(r.starts_at).toDateString() === today).length;
    
    // Calcular receita total dos dados filtrados (apenas agendamentos confirmados)
    const totalRevenue = filtered
      .filter(r => r.status === 'confirmed' && r.price)
      .reduce((sum, r) => sum + (r.price || 0), 0);
    
    return { total, pending, confirmed, canceled, todayBookings, totalRevenue };
  }, [filtered]);

  /** --------- verificar se há filtros ativos --------- */
  const hasActiveFilters = useMemo(() => {
    return statusFilter || barberFilter || paymentFilter || dateFrom || dateTo || todayOnly;
  }, [statusFilter, barberFilter, paymentFilter, dateFrom, dateTo, todayOnly]);

  /** --------- limpar filtros --------- */
  function clearFilters() {
    setStatusFilter("");
    setBarberFilter("");
    setPaymentFilter("");
    setDateFrom("");
    setDateTo("");
    setTodayOnly(false);
  }

  // Mostrar loading se o barbeiro ainda não foi carregado
  if (!barber) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-barbershop-gold"></div>
          <p className="text-white/70">Carregando dados do barbeiro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header com Estatísticas */}
      <div className="bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-black/90 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {finalIsAdmin ? (
                  <>Painel de <span className="bg-gradient-to-r from-barbershop-gold to-amber-300 bg-clip-text text-transparent">Agendamentos</span></>
                ) : (
                  <>Meus <span className="bg-gradient-to-r from-barbershop-gold to-amber-300 bg-clip-text text-transparent">Agendamentos</span></>
                )}
              </h1>
              {hasActiveFilters && (
                <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-full self-start">
                  <Filter className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-sm font-medium">Filtros Ativos</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/70 text-sm sm:text-base">
                {hasActiveFilters 
                  ? `Mostrando ${filteredStats.total} de ${originalStats.total} agendamentos` 
                  : `Bem-vindo, ${barber?.name}! Gerencie seus agendamentos`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-amber-500/25 text-sm sm:text-base"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? "Carregando..." : "Atualizar"}</span>
              <span className="sm:hidden">{loading ? "..." : "Atualizar"}</span>
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          <StatsCard
            icon={Calendar}
            title="Total"
            value={hasActiveFilters ? filteredStats.total : originalStats.total}
            subtitle={hasActiveFilters ? "filtrados" : "agendamentos"}
            color="text-cyan-400"
          />
          <StatsCard
            icon={AlertTriangle}
            title="Pendentes"
            value={hasActiveFilters ? filteredStats.pending : originalStats.pending}
            subtitle="aguardando"
            color="text-orange-400"
          />
          <StatsCard
            icon={CheckCircle}
            title="Confirmados"
            value={hasActiveFilters ? filteredStats.confirmed : originalStats.confirmed}
            subtitle="aprovados"
            color="text-emerald-400"
          />
          <StatsCard
            icon={XCircle}
            title="Cancelados"
            value={hasActiveFilters ? filteredStats.canceled : originalStats.canceled}
            subtitle="cancelados"
            color="text-rose-400"
          />
          <StatsCard
            icon={Clock}
            title="Hoje"
            value={hasActiveFilters ? filteredStats.todayBookings : originalStats.todayBookings}
            subtitle="agendamentos"
            color="text-purple-400"
          />
          <StatsCard
            icon={DollarSign}
            title="Receita"
            value={fmtPriceBR(hasActiveFilters ? filteredStats.totalRevenue : originalStats.totalRevenue)}
            subtitle={hasActiveFilters ? "filtrada" : "total"}
            color="text-emerald-400"
          />
        </div>
      </div>

      {/* Filtros Modernos */}
      <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Status</label>
              {statusFilter && (
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                statusFilter 
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
              style={{ 
                colorScheme: 'dark', 
                fontSize: '16px'
              }}
            >
              <option value="" className="bg-gray-800 text-white">Todos os status</option>
              <option value="pending" className="bg-gray-800 text-white">Pendente</option>
              <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
              <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
            </select>
          </div>

          {/* Barbeiro - apenas para admin */}
          {finalIsAdmin && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-white/80 text-sm font-medium">Barbeiro</label>
              {barberFilter && (
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              )}
              </div>
              <select
                value={barberFilter}
                onChange={(e) => setBarberFilter(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 ${
                  barberFilter 
                    ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                    : 'border-white/20 bg-white/5 text-white'
                }`}
                style={{ 
                  colorScheme: 'dark',
                  fontSize: '16px',
                  transform: 'scale(1)',
                  WebkitTextSizeAdjust: '100%',
                  textSizeAdjust: '100%',
                  minHeight: '44px'
                }}
              >
                <option value="" className="bg-gray-800 text-white">Todos os barbeiros</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id} className="bg-gray-800 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Pagamento</label>
              {paymentFilter && (
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              )}
            </div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base ${
                paymentFilter 
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
              style={{ 
                colorScheme: 'dark', 
                fontSize: '16px'
              }}
            >
              <option value="" className="bg-gray-800 text-white">Todas as formas</option>
              <option value="credit_card" className="bg-gray-800 text-white">Cartão de Crédito</option>
              <option value="debit_card" className="bg-gray-800 text-white">Cartão de Débito</option>
              <option value="cash" className="bg-gray-800 text-white">Dinheiro</option>
              <option value="pix" className="bg-gray-800 text-white">PIX</option>
            </select>
          </div>

          {/* Data De */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Data Inicial</label>
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
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
              style={{ 
                fontSize: '16px'
              }}
            />
          </div>

          {/* Data Até */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Data Final</label>
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
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
              style={{ 
                fontSize: '16px'
              }}
            />
          </div>

          {/* Apenas Hoje */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Apenas Hoje</label>
              {todayOnly && (
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="todayOnly"
                checked={todayOnly}
                onChange={(e) => setTodayOnly(e.target.checked)}
                className="w-4 h-4 text-amber-500 bg-white/5 border-white/20 rounded focus:ring-amber-500 focus:ring-2"
              />
              <label htmlFor="todayOnly" className="text-white/70 text-sm">
                Mostrar apenas hoje
              </label>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 col-span-1 sm:col-span-2 lg:col-span-2">
            <label className="text-white/80 text-sm font-medium">Ações</label>
            <div className="flex gap-2">
              <button
                onClick={clearFilters}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-white/10 text-sm"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Limpar Filtros</span>
                <span className="sm:hidden">Limpar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Desktop Moderna */}
      <div className="hidden md:block">
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
          {/* Contador de Resultados */}
          <div className="px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-white/80 text-sm">
                  {hasActiveFilters 
                    ? `Mostrando ${filtered.length} de ${rows.length} agendamentos`
                    : `${filtered.length} agendamentos`
                  }
                </span>
              </div>
              {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtros
                  </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-slate-800/60 to-slate-900/60">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Barbeiro
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Preço
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Pagamento
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((r, index) => (
                  <tr 
                    key={r.id} 
                    className="hover:bg-white/5 transition-all duration-200 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white font-medium">
                        {fmtDateTimeBR(r.starts_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{r.customer_name ?? "—"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white/80">{fmtPhoneBR(r.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{r.services?.name ?? "—"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-sm text-white">{r.barbers?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-amber-400">
                        {fmtPriceBR(r.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={r.payment_method || ""}
                        onChange={(e) => updatePaymentMethod(r.id, e.target.value as PaymentMethod)}
                        className="rounded-lg bg-white/5 border border-white/20 text-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                        style={{ 
                          colorScheme: 'dark',
                          fontSize: '16px'
                        }}
                      >
                        <option value="" className="bg-gray-800 text-white">Selecionar</option>
                        <option value="credit_card" className="bg-gray-800 text-white">Cartão de Crédito</option>
                        <option value="debit_card" className="bg-gray-800 text-white">Cartão de Débito</option>
                        <option value="cash" className="bg-gray-800 text-white">Dinheiro</option>
                        <option value="pix" className="bg-gray-800 text-white">PIX</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as BookingStatus)}
                        className="rounded-lg bg-white/5 border border-white/20 text-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                        style={{ 
                          colorScheme: 'dark',
                          fontSize: '16px'
                        }}
                      >
                        <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                        <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                        {finalCanCancel && (
                          <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
                        )}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Calendar className="w-12 h-12 text-white/30" />
                        <p className="text-white/60 text-lg">Nenhum agendamento encontrado</p>
                        <p className="text-white/40 text-sm">Tente ajustar os filtros para ver mais resultados</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cards Mobile Modernos */}
      <div className="md:hidden space-y-4">
        {/* Contador de Resultados Mobile */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-white/80 text-sm">
                {hasActiveFilters 
                  ? `Mostrando ${filtered.length} de ${rows.length} agendamentos`
                  : `${filtered.length} agendamentos`
                }
              </span>
            </div>
            {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Limpar
                  </button>
            )}
          </div>
        </div>
        {filtered.map((b, index) => (
          <div 
            key={b.id} 
            className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:from-slate-700/40 hover:to-slate-800/40 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-semibold text-base">
                    {fmtDateTimeBR(b.starts_at)}
                  </span>
                </div>
                <div className="text-white/60 text-sm">
                  {b.customer_name ?? "Cliente não informado"}
                </div>
              </div>
              <select
                value={b.status}
                onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                className="rounded-lg bg-white/5 border border-white/20 text-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                style={{ 
                  colorScheme: 'dark',
                  fontSize: '16px',
                  transform: 'scale(1)',
                  WebkitTextSizeAdjust: '100%',
                  textSizeAdjust: '100%',
                  minHeight: '44px'
                }}
              >
                <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                {finalCanCancel && (
                  <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-white/50" />
                  <span className="text-white/60">Barbeiro:</span>
                </div>
                <div className="text-white font-medium ml-6">
                  {b.barbers?.name ?? "—"}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Serviço:</span>
                </div>
                <div className="text-white font-medium">
                  {b.services?.name ?? "—"}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Telefone:</span>
                </div>
                <div className="text-white font-medium">
                  {fmtPhoneBR(b.phone)}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Preço:</span>
                </div>
                <div className="text-emerald-400 font-semibold">
                  {fmtPriceBR(b.price)}
                </div>
              </div>
            </div>

            {/* Forma de Pagamento Mobile */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-white/50" />
                  <span className="text-white/60 text-sm">Forma de Pagamento:</span>
                </div>
                <select
                  value={b.payment_method || ""}
                  onChange={(e) => updatePaymentMethod(b.id, e.target.value as PaymentMethod)}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  style={{ 
                    colorScheme: 'dark',
                    fontSize: '16px',
                    transform: 'scale(1)',
                    WebkitTextSizeAdjust: '100%',
                    textSizeAdjust: '100%',
                    minHeight: '44px'
                  }}
                >
                  <option value="" className="bg-gray-800 text-white">Selecionar forma de pagamento</option>
                  <option value="credit_card" className="bg-gray-800 text-white">Cartão de Crédito</option>
                  <option value="debit_card" className="bg-gray-800 text-white">Cartão de Débito</option>
                  <option value="cash" className="bg-gray-800 text-white">Dinheiro</option>
                  <option value="pix" className="bg-gray-800 text-white">PIX</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
            <Calendar className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-white/60 text-lg font-medium mb-2">
              Nenhum agendamento encontrado
            </h3>
            <p className="text-white/40 text-sm">
              Tente ajustar os filtros para ver mais resultados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
  
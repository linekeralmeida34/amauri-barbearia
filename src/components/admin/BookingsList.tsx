// src/components/admin/BookingsList.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, 
  Clock, 
  Users, 
  Filter,
  RotateCcw,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle
} from "lucide-react";

/** ---------- Tipos ---------- */
type BookingStatus = "pending" | "confirmed" | "canceled";

type BookingRow = {
  id: string;
  starts_at: string; // timestamptz
  status: BookingStatus;
  customer_name: string | null;
  phone: string | null;
  price: number | null;
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
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

/** ---------- Componente de Estatísticas ---------- */
function StatsCard({ icon: Icon, title, value, subtitle, color = "text-blue-600" }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm font-medium">{title}</p>
          <p className="text-white text-2xl font-bold mt-1">{value}</p>
          <p className="text-white/50 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg bg-white/10 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

/** ---------- Componente ---------- */
export default function BookingsList() {
  /** dados crus */
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [barbers, setBarbers] = useState<BarberLite[]>([]);

  /** filtros */
  const [statusFilter, setStatusFilter] = useState<"" | BookingStatus>("");
  const [barberFilter, setBarberFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>(""); // yyyy-mm-dd

  const [loading, setLoading] = useState(false);

  /** --------- fetch inicial (bookings + barbers) --------- */
  async function fetchAll() {
    setLoading(true);
    try {
      // Barbeiros para o filtro
      const { data: barbs } = await supabase
        .from("barbers")
        .select("id,name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setBarbers((barbs ?? []) as BarberLite[]);

      // Bookings
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          starts_at,
          status,
          customer_name,
          phone,
          price,
          services ( name ),
          barbers ( id, name )
        `
        )
        .order("starts_at", { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as BookingRow[]);
    } finally {
      setLoading(false);
    }
  }

  /** --------- update de status --------- */
  async function updateStatus(id: string, newStatus: BookingStatus) {
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    }
  }

  /** --------- realtime --------- */
  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("bookings-admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
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
  }, []);

  /** --------- aplicação dos filtros + ordenação garantida --------- */
  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (barberFilter) {
      list = list.filter((r) => String(r.barbers?.id ?? "") === barberFilter);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      list = list.filter((r) => new Date(r.starts_at).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      list = list.filter((r) => new Date(r.starts_at).getTime() <= toTs);
    }

    list.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
    return list;
  }, [rows, statusFilter, barberFilter, dateFrom, dateTo]);

  /** --------- estatísticas calculadas (dados originais) --------- */
  const originalStats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const confirmed = rows.filter(r => r.status === 'confirmed').length;
    const canceled = rows.filter(r => r.status === 'canceled').length;
    const today = new Date().toDateString();
    const todayBookings = rows.filter(r => new Date(r.starts_at).toDateString() === today).length;
    
    return { total, pending, confirmed, canceled, todayBookings };
  }, [rows]);

  /** --------- estatísticas dos dados filtrados --------- */
  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const pending = filtered.filter(r => r.status === 'pending').length;
    const confirmed = filtered.filter(r => r.status === 'confirmed').length;
    const canceled = filtered.filter(r => r.status === 'canceled').length;
    const today = new Date().toDateString();
    const todayBookings = filtered.filter(r => new Date(r.starts_at).toDateString() === today).length;
    
    return { total, pending, confirmed, canceled, todayBookings };
  }, [filtered]);

  /** --------- verificar se há filtros ativos --------- */
  const hasActiveFilters = useMemo(() => {
    return statusFilter || barberFilter || dateFrom || dateTo;
  }, [statusFilter, barberFilter, dateFrom, dateTo]);

  /** --------- limpar filtros --------- */
  function clearFilters() {
    setStatusFilter("");
    setBarberFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="w-full space-y-6">
      {/* Header com Estatísticas */}
      <div className="bg-gradient-to-r from-amber-600/20 to-amber-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                Painel de <span className="text-amber-400">Agendamentos</span>
              </h1>
              {hasActiveFilters && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full">
                  <Filter className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-sm font-medium">Filtros Ativos</span>
                </div>
              )}
            </div>
            <p className="text-white/70">
              {hasActiveFilters 
                ? `Mostrando ${filteredStats.total} de ${originalStats.total} agendamentos` 
                : "Gerencie todos os agendamentos em tempo real"
              }
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatsCard
            icon={Calendar}
            title="Total"
            value={hasActiveFilters ? filteredStats.total : originalStats.total}
            subtitle={hasActiveFilters ? "filtrados" : "agendamentos"}
            color="text-blue-500"
          />
          <StatsCard
            icon={AlertTriangle}
            title="Pendentes"
            value={hasActiveFilters ? filteredStats.pending : originalStats.pending}
            subtitle="aguardando"
            color="text-amber-500"
          />
          <StatsCard
            icon={CheckCircle}
            title="Confirmados"
            value={hasActiveFilters ? filteredStats.confirmed : originalStats.confirmed}
            subtitle="aprovados"
            color="text-green-500"
          />
          <StatsCard
            icon={XCircle}
            title="Cancelados"
            value={hasActiveFilters ? filteredStats.canceled : originalStats.canceled}
            subtitle="cancelados"
            color="text-red-500"
          />
          <StatsCard
            icon={Clock}
            title="Hoje"
            value={hasActiveFilters ? filteredStats.todayBookings : originalStats.todayBookings}
            subtitle="agendamentos"
            color="text-purple-500"
          />
        </div>
      </div>

      {/* Filtros Modernos */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-white/70" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Status</label>
              {statusFilter && (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 ${
                statusFilter 
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-gray-800 text-white">Todos os status</option>
              <option value="pending" className="bg-gray-800 text-white">Pendente</option>
              <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
              <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
            </select>
          </div>

          {/* Barbeiro */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Barbeiro</label>
              {barberFilter && (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
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
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-gray-800 text-white">Todos os barbeiros</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id} className="bg-gray-800 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Data De */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Data Inicial</label>
              {dateFrom && (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              )}
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 ${
                dateFrom 
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
            />
          </div>

          {/* Data Até */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm font-medium">Data Final</label>
              {dateTo && (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              )}
            </div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 ${
                dateTo 
                  ? 'border-amber-500/50 bg-amber-500/10 text-white' 
                  : 'border-white/20 bg-white/5 text-white'
              }`}
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <label className="text-white/80 text-sm font-medium">Ações</label>
            <div className="flex gap-2">
              <button
                onClick={fetchAll}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all duration-200"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Desktop Moderna */}
      <div className="hidden md:block">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          {/* Contador de Resultados */}
          <div className="px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/60" />
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
                  className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-white/10 to-white/5">
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
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as BookingStatus)}
                        className="rounded-lg bg-white/5 border border-white/20 text-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                        <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                        <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
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
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white/60" />
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
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
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
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all duration-200"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-amber-400" />
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
                style={{ colorScheme: 'dark' }}
              >
                <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
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
                <div className="text-amber-400 font-semibold">
                  {fmtPriceBR(b.price)}
                </div>
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
  
// src/components/admin/BookingsList.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBarberAuth } from "@/hooks/useBarberAuth";
import { 
  fetchBarberDayBlock,
  adminSetBarberDayBlock,
  type BarberDayBlock
} from "@/lib/api";
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
  DollarSign,
  Shield,
  Lock,
  Gift,
  LockKeyhole,
  Unlock
} from "lucide-react";

/** ---------- Tipos ---------- */
type BookingStatus = "pending" | "confirmed" | "canceled";
type PaymentMethod = "credit_card" | "debit_card" | "cash" | "pix" | "voucher" | null;

type BookingRow = {
  id: string;
  starts_at: string; // timestamptz
  status: BookingStatus;
  customer_name: string | null;
  phone: string | null;
  price: number | null;
  payment_method: PaymentMethod;
  canceled_by_admin: boolean;
  services?: { name: string | null; commission_percentage: number | null } | null;
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
    voucher: "Voucher",
    null: "—"
  };
  return methods[method || "null"];
}

/** ---------- Componente de Status Badge ---------- */
function StatusBadge({ status, canceledByAdmin = false }: { status: BookingStatus; canceledByAdmin?: boolean }) {
  const config = {
    pending: { 
      icon: AlertTriangle, 
      color: "bg-amber-100 text-amber-800 border-amber-200", 
      label: "Pendente",
      pulse: "animate-pulse"
    },
    confirmed: { 
      icon: CheckCircle, 
      color: "bg-green-100 text-green-800 border-green-200", 
      label: "Confirmado",
      pulse: "animate-pulse"
    },
    canceled: { 
      icon: XCircle, 
      color: canceledByAdmin 
        ? "bg-red-200 text-red-900 border-red-300 shadow-lg" 
        : "bg-red-100 text-red-800 border-red-200", 
      label: "Cancelado",
      pulse: ""
    }
  };

  const { icon: Icon, color, label, pulse } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color} ${pulse}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/** ---------- Componente de Informação de Cancelamento pelo Admin ---------- */
function AdminCancelInfo({ canceledByAdmin }: { canceledByAdmin: boolean }) {
  if (!canceledByAdmin) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded-lg">
      <Shield className="w-4 h-4 text-red-400" />
      <span className="text-red-300 text-sm font-medium">Cancelado pelo Administrador</span>
      <Lock className="w-3 h-3 text-red-400" />
    </div>
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
    voucher: { 
      icon: Gift, 
      color: "bg-orange-100 text-orange-800 border-orange-200", 
      label: "Voucher" 
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
function StatsCard({ icon: Icon, title, value, subtitle, color = "text-blue-600", valueSize = "text-2xl" }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  color?: string;
  valueSize?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl p-4 hover:from-slate-600/50 hover:to-slate-700/50 transition-all duration-200 hover:scale-105 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-300 text-sm font-medium">{title}</p>
          <p className={`text-white ${valueSize} font-bold mt-1`}>{value}</p>
          <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br from-slate-600/60 to-slate-700/60 ${color} shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

/** ---------- Componente de Lista Compacta Mobile ---------- */
function MobileListItem({ 
  booking, 
  isExpanded, 
  onToggle, 
  onStatusChange, 
  onPaymentMethodChange,
  canCancel,
  isAdmin 
}: {
  booking: BookingRow;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  onPaymentMethodChange: (id: string, method: PaymentMethod) => void;
  canCancel: boolean;
  isAdmin: boolean;
}) {
  const getStatusColor = (status: BookingStatus, canceledByAdmin: boolean) => {
    if (canceledByAdmin) return "text-red-400";
    if (status === "confirmed") return "text-green-400";
    if (status === "canceled") return "text-red-400";
    if (status === "pending") return "text-amber-400";
    return "text-gray-400";
  };

  const getStatusText = (status: BookingStatus, canceledByAdmin: boolean) => {
    if (canceledByAdmin) return "Cancelado (Admin)";
    if (status === "confirmed") return "Confirmado";
    if (status === "canceled") return "Cancelado";
    if (status === "pending") return "Pendente";
    return "—";
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
      {/* Item da lista compacta */}
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => onToggle(booking.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="text-white font-medium text-sm">
                {fmtDateTimeBR(booking.starts_at)}
              </span>
            </div>
            <div className="text-white/80 text-sm font-medium truncate">
              {booking.customer_name ?? "Cliente não informado"}
            </div>
            <div className="text-white/60 text-xs truncate">
              {booking.services?.name ?? "—"}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-2">
            <span className={`text-xs font-medium ${getStatusColor(booking.status, booking.canceled_by_admin)}`}>
              {getStatusText(booking.status, booking.canceled_by_admin)}
            </span>
            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Card expandido */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* Status e ações */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge status={booking.status} canceledByAdmin={booking.canceled_by_admin} />
              {booking.canceled_by_admin && (
                <div className="flex items-center gap-1 text-red-400 text-xs">
                  <Lock className="w-3 h-3" />
                  <span>Admin</span>
                </div>
              )}
            </div>
            
            {booking.status !== "canceled" || isAdmin ? (
              <select
                value={booking.status}
                onChange={(e) => onStatusChange(booking.id, e.target.value as BookingStatus)}
                className="rounded-lg bg-white/5 border border-white/20 text-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                style={{ 
                  colorScheme: 'dark',
                  fontSize: '16px',
                  minHeight: '44px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                {canCancel && (
                  <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
                )}
              </select>
            ) : null}
          </div>

          {/* Informações detalhadas */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/50" />
                <span className="text-white/60">Barbeiro:</span>
              </div>
              <div className="text-white font-medium ml-6">
                {booking.barbers?.name ?? "—"}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Serviço:</span>
              </div>
              <div className="text-white font-medium">
                {booking.services?.name ?? "—"}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Telefone:</span>
              </div>
              <div className="text-white font-medium">
                {fmtPhoneBR(booking.phone)}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Preço:</span>
              </div>
              <div className="text-emerald-400 font-semibold">
                {fmtPriceBR(booking.price)}
              </div>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-white/50" />
              <span className="text-white/60 text-sm">Forma de Pagamento:</span>
            </div>
            <select
              value={booking.payment_method || ""}
              onChange={(e) => onPaymentMethodChange(booking.id, e.target.value as PaymentMethod)}
              className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              style={{ 
                colorScheme: 'dark',
                fontSize: '16px',
                minHeight: '44px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="" className="bg-gray-800 text-white">Selecionar forma de pagamento</option>
              <option value="credit_card" className="bg-gray-800 text-white">Cartão de Crédito</option>
              <option value="debit_card" className="bg-gray-800 text-white">Cartão de Débito</option>
              <option value="cash" className="bg-gray-800 text-white">Dinheiro</option>
              <option value="pix" className="bg-gray-800 text-white">PIX</option>
              <option value="voucher" className="bg-gray-800 text-white">Voucher</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---------- Componente ---------- */
export default function BookingsList() {
  const { barber, isAdmin, canCancelBookings, canCreateBookings } = useBarberAuth();
  
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
  const [todayOnly, setTodayOnly] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  
  /** estado para controlar itens expandidos na visualização mobile */
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /** estado para controle de fechamento de horários (intervalo) */
  const [cutoffBarberId, setCutoffBarberId] = useState<string>("");
  const [blockStartTime, setBlockStartTime] = useState<string>("");
  const [blockEndTime, setBlockEndTime] = useState<string>("");
  const [currentBlock, setCurrentBlock] = useState<BarberDayBlock>({ start_time: null, end_time: null });
  const [loadingCutoff, setLoadingCutoff] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  
  /** toggle para expandir/colapsar item na visualização mobile */
  const toggleExpanded = (bookingId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

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
          canceled_by_admin,
          services ( name, commission_percentage ),
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
    // Buscar o agendamento atual para verificar se foi cancelado pelo admin
    const currentBooking = rows.find(r => r.id === id);
    
    // Verificar se pode cancelar (apenas admin)
    if (newStatus === "canceled" && !finalCanCancel) {
      alert("Apenas o administrador pode cancelar agendamentos.");
      return;
    }

    // Verificar se o agendamento foi cancelado pelo admin e não permitir alteração por barbeiros
    if (currentBooking?.canceled_by_admin && !finalIsAdmin) {
      alert("Este agendamento foi cancelado pelo administrador e não pode ser alterado.");
      return;
    }

    // Preparar dados para atualização
    const updateData: any = { status: newStatus };
    
    // Se for admin cancelando, marcar como cancelado pelo admin
    if (newStatus === "canceled" && finalIsAdmin) {
      updateData.canceled_by_admin = true;
    }
    // Se for admin alterando para outro status, desmarcar canceled_by_admin
    else if (finalIsAdmin && newStatus !== "canceled") {
      updateData.canceled_by_admin = false;
    }

    // Atualizar estado local imediatamente para feedback visual
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updateData } : r)));

    // Atualizar no banco
    const { error } = await supabase.from("bookings").update(updateData).eq("id", id);
    if (error) {
      // Se der erro, reverter a mudança local
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: currentBooking?.status || "pending", canceled_by_admin: currentBooking?.canceled_by_admin || false } : r)));
      console.error("Erro ao atualizar status:", error);
    }
  }

  /** --------- update de forma de pagamento --------- */
  async function updatePaymentMethod(id: string, newMethod: PaymentMethod) {
    // Buscar o agendamento atual para reverter em caso de erro
    const currentBooking = rows.find(r => r.id === id);
    
    // Atualizar estado local imediatamente para feedback visual
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, payment_method: newMethod } : r)));

    // Atualizar no banco
    const { error } = await supabase.from("bookings").update({ payment_method: newMethod }).eq("id", id);
    if (error) {
      // Se der erro, reverter a mudança local
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, payment_method: currentBooking?.payment_method || null } : r)));
      console.error("Erro ao atualizar método de pagamento:", error);
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
    
    // Calcular receita total considerando comissão (apenas agendamentos confirmados)
    const totalRevenue = rows
      .filter(r => r.status === 'confirmed' && r.price)
      .reduce((sum, r) => {
        const servicePrice = r.price || 0;
        const commissionPercentage = r.services?.commission_percentage || 100; // 100% se não tiver comissão definida
        const barberEarnings = servicePrice * (commissionPercentage / 100);
        return sum + barberEarnings;
      }, 0);
    
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
    
    // Calcular receita total dos dados filtrados considerando comissão (apenas agendamentos confirmados)
    const totalRevenue = filtered
      .filter(r => r.status === 'confirmed' && r.price)
      .reduce((sum, r) => {
        const servicePrice = r.price || 0;
        const commissionPercentage = r.services?.commission_percentage || 100; // 100% se não tiver comissão definida
        const barberEarnings = servicePrice * (commissionPercentage / 100);
        return sum + barberEarnings;
      }, 0);
    
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
    setTodayOnly(true); // Mantém marcado por padrão
  }

  /** --------- funções de fechamento de horários --------- */
  function todayYMD(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function loadCurrentBlock() {
    if (!cutoffBarberId || !finalIsAdmin) return;
    setLoadingCutoff(true);
    try {
      const block = await fetchBarberDayBlock(cutoffBarberId, todayYMD());
      setCurrentBlock(block);
      if (block.start_time && block.end_time) {
        setBlockStartTime(block.start_time);
        setBlockEndTime(block.end_time);
      } else {
        setBlockStartTime("");
        setBlockEndTime("");
      }
    } catch (error) {
      console.error("Erro ao carregar bloqueio de horários:", error);
    } finally {
      setLoadingCutoff(false);
    }
  }

  async function handleSetBlock() {
    if (!cutoffBarberId || !blockStartTime || !blockEndTime || !finalIsAdmin) return;
    
    if (blockStartTime >= blockEndTime) {
      alert("O horário de início deve ser menor que o horário de fim.");
      return;
    }
    
    setSavingCutoff(true);
    try {
      await adminSetBarberDayBlock(cutoffBarberId, todayYMD(), blockStartTime, blockEndTime);
      setCurrentBlock({ start_time: blockStartTime, end_time: blockEndTime });
      alert(`Horários fechados de ${blockStartTime} até ${blockEndTime} para o barbeiro selecionado.`);
    } catch (error: any) {
      console.error("Erro ao definir bloqueio de horários:", error);
      alert(error?.message || "Erro ao fechar horários. Verifique se as funções RPC estão configuradas no banco.");
    } finally {
      setSavingCutoff(false);
    }
  }

  async function handleRemoveBlock() {
    if (!cutoffBarberId || !finalIsAdmin) return;
    setSavingCutoff(true);
    try {
      await adminSetBarberDayBlock(cutoffBarberId, todayYMD(), null, null);
      setCurrentBlock({ start_time: null, end_time: null });
      setBlockStartTime("");
      setBlockEndTime("");
      alert("Horários reabertos para o barbeiro selecionado.");
    } catch (error) {
      console.error("Erro ao remover bloqueio de horários:", error);
      alert("Erro ao reabrir horários. Verifique se as funções RPC estão configuradas no banco.");
    } finally {
      setSavingCutoff(false);
    }
  }

  // Carrega o bloqueio de horários quando o barbeiro é selecionado
  useEffect(() => {
    if (cutoffBarberId && finalIsAdmin) {
      loadCurrentBlock();
    } else {
      setCurrentBlock({ start_time: null, end_time: null });
      setBlockStartTime("");
      setBlockEndTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoffBarberId, finalIsAdmin]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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
            icon={Clock}
            title="Hoje"
            value={hasActiveFilters ? filteredStats.todayBookings : originalStats.todayBookings}
            subtitle="agendamentos"
            color="text-purple-400"
          />
          <StatsCard
            icon={DollarSign}
            title="Receita Líquida"
            value={fmtPriceBR(hasActiveFilters ? filteredStats.totalRevenue : originalStats.totalRevenue)}
            subtitle={hasActiveFilters ? "filtrada" : "do barbeiro"}
            color="text-emerald-400"
            valueSize="text-lg"
          />
          <StatsCard
            icon={XCircle}
            title="Cancelados"
            value={hasActiveFilters ? filteredStats.canceled : originalStats.canceled}
            subtitle="cancelados"
            color="text-red-400"
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
          <div className="space-y-2 min-w-0 w-full">
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
            <div className="space-y-2 min-w-0 w-full">
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
          <div className="space-y-2 min-w-0 w-full">
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
              <option value="voucher" className="bg-gray-800 text-white">Voucher</option>
            </select>
          </div>

          {/* Data De */}
          <div className="space-y-2 min-w-0 w-full">
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
          <div className="space-y-2 min-w-0 w-full">
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
          <div className="space-y-2 min-w-0 w-full">
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

      {/* Seção de Fechamento de Horários (Apenas Admin) */}
      {finalIsAdmin && (
        <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <LockKeyhole className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Fechar Horários
            </h2>
          </div>
          <p className="text-white/70 text-sm mb-4">
            Feche um intervalo de horários de um barbeiro para hoje. Exemplo: se o barbeiro precisa se ausentar de 15h até 17h, feche os horários de 15:00 até 17:00.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            {/* Em mobile, os campos de horário ficam lado a lado */}
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 space-y-2">
              <label className="text-white/80 text-sm font-medium">Barbeiro</label>
              <select
                value={cutoffBarberId}
                onChange={(e) => setCutoffBarberId(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                style={{ 
                  colorScheme: 'dark',
                  fontSize: '16px',
                  minHeight: '44px'
                }}
              >
                <option value="" className="bg-gray-800 text-white">Selecione um barbeiro</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id} className="bg-gray-800 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Em mobile, os horários ficam em uma linha */}
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 grid grid-cols-2 gap-2 sm:gap-3">
              {/* Horário de Início */}
              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium">De (HH:MM)</label>
                <input
                  type="time"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                  disabled={!cutoffBarberId || loadingCutoff}
                  className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-2 sm:px-3 py-2 sm:py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  style={{ 
                    fontSize: '16px',
                    minHeight: '44px'
                  }}
                />
              </div>

              {/* Horário de Fim */}
              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium">Até (HH:MM)</label>
                <input
                  type="time"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                  disabled={!cutoffBarberId || loadingCutoff}
                  className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-2 sm:px-3 py-2 sm:py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  style={{ 
                    fontSize: '16px',
                    minHeight: '44px'
                  }}
                />
              </div>
            </div>

            {/* Status Atual - oculto em mobile muito pequeno */}
            <div className="hidden sm:block sm:col-span-2 lg:col-span-1 xl:col-span-1 space-y-2">
              <label className="text-white/80 text-sm font-medium">Status</label>
              <div className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center">
                {loadingCutoff ? (
                  <span className="text-white/60 text-sm">Carregando...</span>
                ) : currentBlock.start_time && currentBlock.end_time ? (
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-white text-sm truncate">Fechado {currentBlock.start_time} - {currentBlock.end_time}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-white/60 text-sm">Dia aberto</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 space-y-2">
              <label className="text-white/80 text-sm font-medium">Ações</label>
              <div className="flex gap-2">
                {currentBlock.start_time && currentBlock.end_time ? (
                  <button
                    onClick={handleRemoveBlock}
                    disabled={!cutoffBarberId || savingCutoff || loadingCutoff}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/50 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-green-500/25 text-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <Unlock className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Reabrir</span>
                    <span className="sm:hidden">Abrir</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSetBlock}
                    disabled={!cutoffBarberId || !blockStartTime || !blockEndTime || savingCutoff || loadingCutoff}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/50 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-red-500/25 text-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <LockKeyhole className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{savingCutoff ? "Fechando..." : "Fechar"}</span>
                    <span className="sm:hidden">{savingCutoff ? "..." : "Fechar"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Status mobile - mostrado apenas em telas muito pequenas */}
          <div className="sm:hidden mt-3 p-3 rounded-lg border border-white/20 bg-white/5">
            {loadingCutoff ? (
              <span className="text-white/60 text-sm">Carregando status...</span>
            ) : currentBlock.start_time && currentBlock.end_time ? (
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span className="text-white text-sm">Fechado de {currentBlock.start_time} até {currentBlock.end_time}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-green-400" />
                <span className="text-white/60 text-sm">Dia aberto - todos os horários disponíveis</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela Desktop Moderna */}
      <div className="hidden md:block">
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
          {/* Contador de Resultados */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
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
            <table className="w-full table-fixed">
              <thead className="bg-gradient-to-r from-slate-800/60 to-slate-900/60">
                <tr>
                  <th className="w-32 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="w-24 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="w-28 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider hidden sm:table-cell">
                    Contato
                  </th>
                  <th className="w-24 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="w-20 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider hidden md:table-cell">
                    Barbeiro
                  </th>
                  <th className="w-16 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Preço
                  </th>
                  <th className="w-24 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider hidden lg:table-cell">
                    Pagamento
                  </th>
                  <th className="w-20 px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((r, index) => {
                  // Definir classes baseadas no status
                  const getRowClasses = () => {
                    const baseClasses = "hover:bg-white/5 transition-all duration-200 group";
                    
                    // Se foi cancelado pelo admin, sempre mostrar como cancelado
                    if (r.canceled_by_admin) {
                      return `${baseClasses} bg-gradient-to-r from-red-900/30 to-rose-900/30 border-l-4 border-red-500 opacity-75`;
                    } else if (r.status === "confirmed") {
                      return `${baseClasses} bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-l-4 border-green-500`;
                    } else if (r.status === "canceled") {
                      return `${baseClasses} bg-gradient-to-r from-red-900/20 to-rose-900/20 border-l-4 border-red-400`;
                    } else if (r.status === "pending") {
                      return `${baseClasses} bg-gradient-to-r from-amber-900/20 to-yellow-900/20 border-l-4 border-amber-500`;
                    }
                    
                    return baseClasses;
                  };

                  return (
                    <tr 
                      key={r.id} 
                      className={getRowClasses()}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-white font-medium truncate">
                        {fmtDateTimeBR(r.starts_at)}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-white truncate">{r.customer_name ?? "—"}</div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3 hidden sm:table-cell">
                      <div className="text-xs sm:text-sm text-white/80 truncate">{fmtPhoneBR(r.phone)}</div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-white truncate">{r.services?.name ?? "—"}</div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <Users className="w-3 h-3 text-amber-400" />
                        </div>
                        <span className="text-xs sm:text-sm text-white truncate">{r.barbers?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm font-semibold text-amber-400">
                        {fmtPriceBR(r.price)}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3 hidden lg:table-cell">
                      <select
                        value={r.payment_method || ""}
                        onChange={(e) => updatePaymentMethod(r.id, e.target.value as PaymentMethod)}
                        className="rounded-lg bg-white/5 border border-white/20 text-white px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 w-full"
                        style={{ 
                          colorScheme: 'dark',
                          fontSize: '14px'
                        }}
                      >
                        <option value="" className="bg-gray-800 text-white">Selecionar</option>
                        <option value="credit_card" className="bg-gray-800 text-white">Cartão de Crédito</option>
                        <option value="debit_card" className="bg-gray-800 text-white">Cartão de Débito</option>
                        <option value="cash" className="bg-gray-800 text-white">Dinheiro</option>
                        <option value="pix" className="bg-gray-800 text-white">PIX</option>
                        <option value="voucher" className="bg-gray-800 text-white">Voucher</option>
                      </select>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      {r.status === "canceled" && !finalIsAdmin ? (
                        <div className="flex items-center gap-1">
                          <StatusBadge status="canceled" canceledByAdmin={r.canceled_by_admin} />
                        </div>
                      ) : (
                        <select
                          value={r.status}
                          onChange={(e) => updateStatus(r.id, e.target.value as BookingStatus)}
                          className="rounded-lg bg-white/5 border border-white/20 text-white px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 w-full"
                          style={{ 
                            colorScheme: 'dark',
                            fontSize: '14px'
                          }}
                        >
                          <option value="pending" className="bg-gray-800 text-white">Pendente</option>
                          <option value="confirmed" className="bg-gray-800 text-white">Confirmado</option>
                          {finalCanCancel && (
                            <option value="canceled" className="bg-gray-800 text-white">Cancelado</option>
                          )}
                        </select>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 sm:px-3 py-12 text-center">
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
          <MobileListItem
            key={b.id}
            booking={b}
            isExpanded={expandedItems.has(b.id)}
            onToggle={toggleExpanded}
            onStatusChange={updateStatus}
            onPaymentMethodChange={updatePaymentMethod}
            canCancel={finalCanCancel}
            isAdmin={finalIsAdmin}
          />
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
  
// src/routes/AdminAnalytics.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import heroImage from "@/assets/barbershop-hero.jpg";
import { useBarberAuth } from "@/hooks/useBarberAuth";
import { fetchActiveBarbers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  DollarSign,
  Filter,
  RefreshCw,
  Scissors,
  TrendingUp,
  Users,
} from "lucide-react";

type AnalyticsBooking = {
  id: string;
  starts_at: string;
  status: "pending" | "confirmed" | "canceled";
  price: number | null;
  duration_min: number | null;
  payment_method: string | null;
  services?: { name: string | null; commission_percentage: number | null } | null;
  barbers?: { id?: string; name?: string | null } | null;
};

type BarberOption = {
  id: string;
  name: string;
};

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function fmtDateYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AdminAnalytics() {
  const { barber, isAdmin } = useBarberAuth();
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  const finalIsAdmin = isAdmin || isEmailAdmin;

  useEffect(() => {
    const checkEmailAdmin = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.email === "lineker.dev@gmail.com") {
          setIsEmailAdmin(true);
        }
      } catch (error) {
        console.error("[AdminAnalytics] erro ao verificar email admin:", error);
      }
    };
    checkEmailAdmin();
  }, []);

  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() =>
    fmtDateYMD(startOfMonth(new Date()))
  );
  const [dateTo, setDateTo] = useState<string>(() => fmtDateYMD(new Date()));
  const [bookings, setBookings] = useState<AnalyticsBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configura opções de barbeiro
  useEffect(() => {
    if (finalIsAdmin) {
      (async () => {
        try {
          const barbers = await fetchActiveBarbers();
          setBarberOptions([{ id: "all", name: "Todos os barbeiros" }, ...barbers]);
        } catch (err) {
          console.error("[AdminAnalytics] erro ao carregar barbeiros:", err);
          setBarberOptions([{ id: "all", name: "Todos os barbeiros" }]);
        }
      })();
    } else if (barber?.id) {
      setBarberOptions([{ id: barber.id, name: barber.name }]);
      setSelectedBarberId(barber.id);
    }
  }, [finalIsAdmin, barber?.id, barber?.name]);

  async function loadAnalytics() {
    if (!finalIsAdmin && !barber?.id) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("bookings")
        .select(
          `
          id,
          starts_at,
          status,
          price,
          duration_min,
          payment_method,
          services ( name, commission_percentage ),
          barbers:barber_id ( id, name )
        `
        );

      if (dateFrom) {
        query = query.gte("starts_at", startOfDay(new Date(dateFrom)).toISOString());
      }
      if (dateTo) {
        query = query.lte("starts_at", endOfDay(new Date(dateTo)).toISOString());
      }

      if (finalIsAdmin) {
        if (selectedBarberId !== "all") {
          query = query.eq("barber_id", selectedBarberId);
        }
      } else if (barber?.id) {
        query = query.eq("barber_id", barber.id);
      }

      const { data, error: queryError } = await query.order("starts_at", {
        ascending: false,
      });

      if (queryError) {
        console.error("[AdminAnalytics] erro ao buscar agendamentos:", queryError);
        throw queryError;
      }

      setBookings((data ?? []) as AnalyticsBooking[]);
    } catch (err: any) {
      setError(
        err?.message ||
          "Não foi possível carregar os dados de analytics. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarberId, dateFrom, dateTo, finalIsAdmin, barber?.id]);

  const confirmedBookings = useMemo(
    () => bookings.filter((b) => b.status === "confirmed"),
    [bookings]
  );
  const canceledBookings = useMemo(
    () => bookings.filter((b) => b.status === "canceled"),
    [bookings]
  );

  const metrics = useMemo(() => {
    const gross = confirmedBookings.reduce(
      (sum, booking) => sum + (booking.price || 0),
      0
    );

    const net = confirmedBookings.reduce((sum, booking) => {
      const commission = booking.services?.commission_percentage ?? 100;
      const base = booking.price || 0;
      return sum + base * (commission / 100);
    }, 0);

    const totalDuration = confirmedBookings.reduce(
      (sum, booking) => sum + (booking.duration_min || 0),
      0
    );

    const avgTicket =
      confirmedBookings.length > 0 ? gross / confirmedBookings.length : 0;
    const avgDuration =
      confirmedBookings.length > 0 ? totalDuration / confirmedBookings.length : 0;

    const byService = bookings.reduce<Record<
      string,
      { count: number; revenue: number; service: string }
    >>((acc, booking) => {
      const key = booking.services?.name || "Serviço";
      if (!acc[key]) acc[key] = { count: 0, revenue: 0, service: key };
      acc[key].count += 1;
      if (booking.status === "confirmed") {
        acc[key].revenue += booking.price || 0;
      }
      return acc;
    }, {});

    const byBarber = bookings.reduce<Record<
      string,
      { name: string; total: number; net: number; confirmed: number }
    >>((acc, booking) => {
      const id = booking.barbers?.id || "sem-id";
      const name = booking.barbers?.name || "Sem nome";
      if (!acc[id]) acc[id] = { name, total: 0, net: 0, confirmed: 0 };
      if (booking.status === "confirmed") {
        const price = booking.price || 0;
        acc[id].total += price;
        const commission = booking.services?.commission_percentage ?? 100;
        acc[id].net += price * (commission / 100);
        acc[id].confirmed += 1;
      }
      return acc;
    }, {});

    return {
      gross,
      net,
      avgTicket,
      avgDuration,
      totalConfirmed: confirmedBookings.length,
      totalCanceled: canceledBookings.length,
      totalBookings: bookings.length,
      byService: Object.values(byService).sort((a, b) => b.count - a.count),
      byBarber: Object.entries(byBarber)
        .filter(([id]) => id !== "sem-id")
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => b.net - a.net),
    };
  }, [bookings, confirmedBookings.length, canceledBookings.length]);

  function applyPreset(days: number) {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - (days - 1));
    setDateFrom(fmtDateYMD(start));
    setDateTo(fmtDateYMD(today));
  }

  function applyCurrentMonth() {
    const today = new Date();
    setDateFrom(fmtDateYMD(startOfMonth(today)));
    setDateTo(fmtDateYMD(today));
  }

  const recentBookings = bookings.slice(0, 5);

  return (
    <section className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url(${heroImage})`, opacity: 0.5 }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/80" />
      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
          <header className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/30 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-white">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm text-white/70 uppercase tracking-wider mb-2">
                    Insights
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-8 h-8 text-barbershop-gold" />
                    Dashboard de Performance
                  </h1>
                  <p className="text-white/80 mt-2 max-w-2xl">
                    Acompanhe receita, produtividade e resultados por barbeiro ou
                    período. Ferramenta ideal para decisões rápidas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="secondary"
                    onClick={() => loadAnalytics()}
                    disabled={loading}
                    className="bg-barbershop-gold/90 hover:bg-barbershop-gold text-barbershop-dark font-semibold border-transparent w-full sm:w-auto"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                    />
                    Atualizar
                  </Button>
                  <Button
                    variant="secondary"
                    asChild
                    className="bg-white/15 hover:bg-white/25 border-white/30 text-white w-full sm:w-auto"
                  >
                    <Link to="/admin" className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Voltar para o painel
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 border-white/10 text-white"
                  onClick={() => applyPreset(7)}
                >
                  Últimos 7 dias
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 border-white/10 text-white"
                  onClick={() => applyPreset(30)}
                >
                  Últimos 30 dias
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 border-white/10 text-white"
                  onClick={applyCurrentMonth}
                >
                  Mês atual
                </Button>
              </div>
            </div>
          </header>

          <section className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/10 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {finalIsAdmin && (
                <div>
                  <label className="text-sm text-white/70 mb-2 block">
                    Barbeiro
                  </label>
                  <select
                    value={selectedBarberId}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-white focus:ring-2 focus:ring-barbershop-gold focus:border-transparent"
                    style={{ colorScheme: "dark" }}
                  >
                    {barberOptions.map((option) => (
                      <option key={option.id} value={option.id} className="bg-black">
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm text-white/70 mb-2 block">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-white focus:ring-2 focus:ring-barbershop-gold focus:border-transparent"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              <div>
                <label className="text-sm text-white/70 mb-2 block">Data final</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-white focus:ring-2 focus:ring-barbershop-gold focus:border-transparent"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-white/70">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <p>Carregando métricas...</p>
              </div>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-white/70 font-medium">
                      Receita Bruta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{fmtCurrency(metrics.gross)}</div>
                    <p className="text-xs text-white/60 mt-1">
                      Confirmados no período
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-white/70 font-medium">
                      Receita Líquida
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{fmtCurrency(metrics.net)}</div>
                    <p className="text-xs text-white/60 mt-1">
                      Considerando comissão de cada serviço
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-white/70 font-medium">
                      Ticket Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {fmtCurrency(metrics.avgTicket || 0)}
                    </div>
                    <p className="text-xs text-white/60 mt-1">Baseado em confirmados</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-white/70 font-medium">
                      Duração Média
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(metrics.avgDuration || 0)} min
                    </div>
                    <p className="text-xs text-white/60 mt-1">Serviços confirmados</p>
                  </CardContent>
                </Card>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Resumo do período</CardTitle>
                      <p className="text-sm text-white/70 mt-1">
                        {metrics.totalBookings} agendamentos no intervalo escolhido
                      </p>
                    </div>
                    <DollarSign className="w-6 h-6 text-barbershop-gold" />
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-xs text-white/60 uppercase">Confirmados</p>
                      <p className="text-2xl font-bold">{metrics.totalConfirmed}</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-xs text-white/60 uppercase">Cancelados</p>
                      <p className="text-2xl font-bold text-red-300">
                        {metrics.totalCanceled}
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-xs text-white/60 uppercase">Pendentes</p>
                      <p className="text-2xl font-bold text-amber-300">
                        {metrics.totalBookings -
                          (metrics.totalConfirmed + metrics.totalCanceled)}
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4">
                      <p className="text-xs text-white/60 uppercase">Preço médio</p>
                      <p className="text-2xl font-bold">
                        {fmtCurrency(metrics.avgTicket || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Top Serviços</CardTitle>
                      <p className="text-sm text-white/70 mt-1">
                        Serviços com maior número de agendamentos
                      </p>
                    </div>
                    <Scissors className="w-6 h-6 text-barbershop-gold" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metrics.byService.length === 0 ? (
                      <p className="text-white/60 text-sm">
                        Nenhum agendamento no período.
                      </p>
                    ) : (
                      metrics.byService.slice(0, 5).map((service) => (
                        <div
                          key={service.service}
                          className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold">{service.service}</p>
                            <p className="text-xs text-white/60">
                              {service.count} agendamentos
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white/60">Receita</p>
                            <p className="text-lg font-bold">
                              {fmtCurrency(service.revenue)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              {finalIsAdmin && metrics.byBarber.length > 0 && (
                <Card className="bg-white/10 border-white/10 text-white">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Desempenho por barbeiro</CardTitle>
                      <p className="text-sm text-white/70 mt-1">
                        Receita e confirmações por profissional
                      </p>
                    </div>
                    <Users className="w-6 h-6 text-barbershop-gold" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 text-sm text-white/60 uppercase tracking-wide">
                      <span>Barbeiro</span>
                      <span>Receita Bruta</span>
                      <span>Receita Líquida</span>
                    </div>
                    {metrics.byBarber.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-3 items-center bg-black/20 rounded-xl px-4 py-3 gap-2"
                      >
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-white/60">
                            {item.confirmed} confirmados
                          </p>
                        </div>
                        <p className="font-semibold">{fmtCurrency(item.total)}</p>
                        <p className="font-semibold text-emerald-300">
                          {fmtCurrency(item.net)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white/10 border-white/10 text-white">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Últimos agendamentos</CardTitle>
                    <p className="text-sm text-white/70 mt-1">
                      Registro mais recente do período filtrado
                    </p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-barbershop-gold" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentBookings.length === 0 ? (
                    <p className="text-white/60 text-sm">
                      Ainda não existem agendamentos para este intervalo.
                    </p>
                  ) : (
                    recentBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-black/20 rounded-xl px-4 py-3 gap-3"
                      >
                        <div>
                          <p className="font-semibold">
                            {booking.services?.name || "Serviço"}
                          </p>
                          <p className="text-xs text-white/60 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(booking.starts_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              booking.status === "confirmed"
                                ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                                : booking.status === "canceled"
                                ? "bg-red-500/20 text-red-200 border border-red-400/40"
                                : "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                            }`}
                          >
                            {booking.status === "confirmed"
                              ? "Confirmado"
                              : booking.status === "canceled"
                              ? "Cancelado"
                              : "Pendente"}
                          </span>
                          <p className="font-bold">{fmtCurrency(booking.price || 0)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}


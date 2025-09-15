// src/components/admin/BookingsList.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  /** --------- limpar filtros --------- */
  function clearFilters() {
    setStatusFilter("");
    setBarberFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="w-full">
      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        {/* Status */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/80 text-sm">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-md bg-white text-[#1A1A1A] px-3 py-2 border border-white/20"
          >
            <option value="">Todos</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        {/* Barbeiro */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/80 text-sm">Barbeiro</label>
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value)}
            className="rounded-md bg-white text-[#1A1A1A] px-3 py-2 border border-white/20"
          >
            <option value="">Todos</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* De */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/80 text-sm">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md bg-white text-[#1A1A1A] px-3 py-2 border border-white/20"
          />
        </div>

        {/* Até */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/80 text-sm">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md bg-white text-[#1A1A1A] px-3 py-2 border border-white/20"
          />
        </div>

        {/* Ações */}
        <div className="flex gap-2">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="rounded-md bg-white/10 text-white px-3 py-2 border border-white/20 hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? "Carregando…" : "Recarregar"}
          </button>
          <button
            onClick={clearFilters}
            className="rounded-md bg-white/10 text-white px-3 py-2 border border-white/20 hover:bg-white/15"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Tabela — Desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="min-w-full text-sm">
          <thead className="bg-white/10 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Data/Hora</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold">Telefone</th>
              <th className="px-4 py-3 text-left font-semibold">Serviço</th>
              <th className="px-4 py-3 text-left font-semibold">Barbeiro</th>
              <th className="px-4 py-3 text-left font-semibold">Preço</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/90">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="px-4 py-3">{fmtDateTimeBR(r.starts_at)}</td>
                <td className="px-4 py-3">{r.customer_name ?? "—"}</td>
                <td className="px-4 py-3">{fmtPhoneBR(r.phone)}</td>
                <td className="px-4 py-3">{r.services?.name ?? "—"}</td>
                <td className="px-4 py-3">{r.barbers?.name ?? "—"}</td>
                <td className="px-4 py-3">{fmtPriceBR(r.price)}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value as BookingStatus)}
                    className="rounded-md bg-white text-[#1A1A1A] px-2 py-1 border border-white/20"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lista — Mobile (cards) */}
      <div className="md:hidden space-y-3">
        {filtered.map((b) => (
          <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white font-bold text-base">{fmtDateTimeBR(b.starts_at)}</div>
              <select
                value={b.status}
                onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                className="rounded-md bg-white text-[#1A1A1A] text-xs px-2 py-1 border border-white/20"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div className="space-y-1 text-sm">
              <div className="text-white/90">
                <span className="text-white/60">Cliente: </span>
                {b.customer_name ?? "—"}
              </div>
              <div className="text-white/90">
                <span className="text-white/60">Telefone: </span>
                {fmtPhoneBR(b.phone)}
              </div>
              <div className="text-white/90">
                <span className="text-white/60">Serviço: </span>
                {b.services?.name ?? "—"}
              </div>
              <div className="text-white/90">
                <span className="text-white/60">Barbeiro: </span>
                {b.barbers?.name ?? "—"}
              </div>
              <div className="text-white/90">
                <span className="text-white/60">Preço: </span>
                {fmtPriceBR(b.price)}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            Nenhum agendamento encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

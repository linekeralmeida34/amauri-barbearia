import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

/** Tipos (simplificados) */
type Booking = {
  id: string;
  service_id: string | null;
  barber_id: string | null;
  starts_at: string;     // UTC ISO
  ends_at: string | null;
  duration_min: number | null;
  price: number | null;
  status: string;        // 'pending' | 'confirmed' | 'canceled'...
  customer_name: string | null;
  phone: string | null;
};

type IdName = { id: string; name: string };

/** Util: formata horário em America/Sao_Paulo */
function fmtSP(isoUtc: string) {
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Util: formata telefone BR de forma tolerante */
function fmtPhoneBR(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  // Celular (11 dígitos) → (11) 9####-#### ; Fixo (10) → (11) ####-#### ; outros → retorna como veio
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/** Badge por status */
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const variant =
    s === "confirmed" ? "default" :
    s === "pending"   ? "secondary" :
    s === "canceled"  ? "destructive" :
    "outline";
  return <Badge variant={variant} className="capitalize">{s}</Badge>;
}

export default function BookingsList() {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔎 dicionários id->nome
  const [serviceMap, setServiceMap] = useState<Record<string, string>>({});
  const [barberMap, setBarberMap] = useState<Record<string, string>>({});

  const ordered = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1));
  }, [rows]);

  // ✅ atualizar status (optimistic UI)
  async function updateStatus(id: string, newStatus: "confirmed" | "canceled") {
    const prev = rows;
    setRows((curr) =>
      (curr ?? []).map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("update booking error", error);
      toast.error("Erro ao atualizar agendamento");
      setRows(prev ?? null);
    } else {
      toast.success(`Agendamento ${newStatus === "confirmed" ? "confirmado" : "cancelado"}`);
    }
  }

  // 📥 carga inicial + realtime de bookings
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("id, service_id, barber_id, starts_at, ends_at, duration_min, price, status, customer_name, phone")
        .order("starts_at", { ascending: false })
        .limit(200);
      if (!cancelled) {
        if (error) {
          console.error("bookings SELECT error", error);
          setRows([]);
        } else {
          setRows((data ?? []) as Booking[]);
        }
        setLoading(false);
      }
    }

    load();

    // Realtime
    const channel = supabase
      .channel("bookings-admin-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          setRows((curr) => {
            const list = curr ? [...curr] : [];
            if (payload.eventType === "INSERT") {
              list.unshift(payload.new as unknown as Booking);
              return list;
            }
            if (payload.eventType === "UPDATE") {
              const idx = list.findIndex((r) => r.id === (payload.new as any).id);
              if (idx >= 0) list[idx] = payload.new as any as Booking;
              return list;
            }
            if (payload.eventType === "DELETE") {
              return list.filter((r) => r.id !== (payload.old as any).id);
            }
            return list;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // 📚 lookups de nomes (services / barbers)
  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      const sv = await supabase.from("services").select("id, name");
      if (!cancelled && !sv.error && sv.data) {
        const map: Record<string, string> = {};
        (sv.data as IdName[]).forEach((r) => (map[r.id] = r.name));
        setServiceMap(map);
      } else if (sv.error) {
        console.error("services SELECT error", sv.error);
      }

      const bb = await supabase.from("barbers").select("id, name");
      if (!cancelled && !bb.error && bb.data) {
        const map: Record<string, string> = {};
        (bb.data as IdName[]).forEach((r) => (map[r.id] = r.name));
        setBarberMap(map);
      } else if (bb.error) {
        console.error("barbers SELECT error", bb.error);
      }
    }

    loadLookups();

    const ch = supabase
      .channel("lookup-services-barbers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => loadLookups()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "barbers" },
        () => loadLookups()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  // helpers de exibição
  const getServiceName = (id?: string | null) =>
    id ? serviceMap[id] ?? id.slice(0, 8) : "-";
  const getBarberName  = (id?: string | null) =>
    id ? barberMap[id] ?? id.slice(0, 8) : "-";

  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Agendamentos (realtime)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => location.reload()}
            title="Recarregar"
          >
            Recarregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="py-10 text-white/80">Carregando…</div>
        ) : ordered.length === 0 ? (
          <div className="py-10 text-white/80">Nenhum agendamento.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-3">Data/Hora</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Cliente</th>
                <th className="text-left py-2 pr-3">Telefone</th>
                <th className="text-left py-2 pr-3">Serviço</th>
                <th className="text-left py-2 pr-3">Barbeiro</th>
                <th className="text-right py-2 pl-3">Preço</th>
                <th className="text-right py-2 pl-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtSP(b.starts_at)}</td>
                  <td className="py-2 pr-3"><StatusBadge status={b.status} /></td>
                  <td className="py-2 pr-3 text-white/90">{b.customer_name || "—"}</td>
                  <td className="py-2 pr-3 text-white/90">{fmtPhoneBR(b.phone)}</td>
                  <td className="py-2 pr-3 text-white/90">{getServiceName(b.service_id)}</td>
                  <td className="py-2 pr-3 text-white/90">{getBarberName(b.barber_id)}</td>
                  <td className="py-2 pl-3 text-right">
                    {b.price != null ? b.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="py-2 pl-3 text-right space-x-2">
                    {b.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500 hover:bg-green-500/20"
                          onClick={() => updateStatus(b.id, "confirmed")}
                          title="Confirmar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500 hover:bg-red-500/20"
                          onClick={() => updateStatus(b.id, "canceled")}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// src/routes/AdminBarbers.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type BarberRow = {
  id: string;
  name: string;
  photo_url: string | null;
  is_active: boolean;
};

export default function AdminBarbers() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BarberRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("barbers")
        .select("id,name,photo_url,is_active")
        .order("name", { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as BarberRow[]);
    } catch (err) {
      console.error("[AdminBarbers] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(barber: BarberRow) {
    // otimista
    const next = !barber.is_active;
    setSavingId(barber.id);
    setRows((prev) =>
      prev.map((b) => (b.id === barber.id ? { ...b, is_active: next } : b))
    );

    try {
      const { error } = await supabase
        .from("barbers")
        .update({ is_active: next })
        .eq("id", barber.id);

      if (error) {
        // rollback
        setRows((prev) =>
          prev.map((b) =>
            b.id === barber.id ? { ...b, is_active: !next } : b
          )
        );
        throw error;
      }
    } catch (err) {
      console.error("[AdminBarbers] toggleActive error:", err);
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="min-h-screen relative overflow-hidden">
      {/* Fundo com o mesmo gradiente do painel */}
      <div className="absolute inset-0 bg-gradient-to-br from-barbershop-dark via-barbershop-brown/80 to-black" />
      <div className="relative z-10">
        {/* Topbar */}
        <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="#/" className="font-bold text-lg tracking-tight">
              <span className="text-white">Amauri</span>
              <span className="text-barbershop-gold">Barbearia</span>
            </a>

            <div className="flex items-center gap-2">
              <Button
                asChild
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
              >
                <Link to="/admin">← Voltar ao Painel</Link>
              </Button>

              <Button
                onClick={load}
                disabled={loading}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
              >
                {loading ? "Carregando..." : "Recarregar"}
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Barbeiros <span className="text-barbershop-gold">/ Admin</span>
          </h1>
          <p className="text-white/80 mb-6">
            Ative ou desative barbeiros. Desativados não aparecem no site nem no
            fluxo de agendamento.
          </p>

          {/* Card / tabela */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="grid grid-cols-12 px-4 sm:px-6 py-3 bg-white/5 border-b border-white/10 text-sm font-semibold text-white/90">
              <div className="col-span-3 sm:col-span-2">Foto</div>
              <div className="col-span-5 sm:col-span-6">Nome</div>
              <div className="col-span-2 sm:col-span-2">Status</div>
              <div className="col-span-2 sm:col-span-2 text-right pr-2 sm:pr-0">
                Ação
              </div>
            </div>

            {/* Linhas */}
            <ul className="divide-y divide-white/10">
              {rows.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-12 items-center px-4 sm:px-6 py-4 text-white/90"
                >
                  {/* Foto */}
                  <div className="col-span-3 sm:col-span-2 flex items-center gap-3">
                    <img
                      src={
                        b.photo_url ||
                        "https://via.placeholder.com/64?text=Foto"
                      }
                      alt={b.name}
                      className="h-12 w-12 rounded-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://via.placeholder.com/64?text=Foto";
                      }}
                    />
                  </div>

                  {/* Nome */}
                  <div className="col-span-5 sm:col-span-6">
                    <div className="font-semibold text-white">{b.name}</div>
                  </div>

                  {/* Status (badge) */}
                  <div className="col-span-2 sm:col-span-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        b.is_active
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {b.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Toggle ação */}
                  <div className="col-span-2 sm:col-span-2 flex justify-end">
                    <button
                      disabled={savingId === b.id}
                      onClick={() => toggleActive(b)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                        b.is_active ? "bg-amber-900" : "bg-white/20"
                      } ${savingId === b.id ? "opacity-60" : ""}`}
                      aria-label="Alternar status"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          b.is_active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </li>
              ))}

              {!rows.length && (
                <li className="px-4 sm:px-6 py-8 text-white/70">
                  Nenhum barbeiro cadastrado.
                </li>
              )}
            </ul>
          </div>
        </main>
      </div>
    </section>
  );
}

// src/routes/AdminBarbers.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Edit3,
  Trash2,
  Star,
  Instagram,
  X
} from "lucide-react";

type BarberRow = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  rating: number | null;
  reviews: number | null;
  instagram: string | null;
  specialties: string[] | null;
  is_active: boolean;
};

type NewBarber = {
  name: string;
  photo_url: string;
  bio: string;
  instagram: string;
  specialties: string[];
};

export default function AdminBarbers() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BarberRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBarber, setNewBarber] = useState<NewBarber>({
    name: "",
    photo_url: "",
    bio: "",
    instagram: "",
    specialties: []
  });
  const [addingBarber, setAddingBarber] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("barbers")
        .select("id,name,photo_url,bio,rating,reviews,instagram,specialties,is_active")
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

  async function addBarber() {
    if (!newBarber.name.trim()) return;
    
    setAddingBarber(true);
    try {
      const { data, error } = await supabase
        .from("barbers")
        .insert([{
          name: newBarber.name.trim(),
          photo_url: newBarber.photo_url.trim() || null,
          bio: newBarber.bio.trim() || null,
          instagram: newBarber.instagram.trim() || null,
          specialties: newBarber.specialties.length > 0 ? newBarber.specialties : null,
          rating: 0,
          reviews: 0,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Adicionar à lista local
      setRows(prev => [...prev, data as BarberRow]);
      
      // Limpar formulário e fechar modal
      setNewBarber({
        name: "",
        photo_url: "",
        bio: "",
        instagram: "",
        specialties: []
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("[AdminBarbers] addBarber error:", err);
    } finally {
      setAddingBarber(false);
    }
  }

  // Estatísticas calculadas
  const stats = {
    total: rows.length,
    active: rows.filter(b => b.is_active).length,
    inactive: rows.filter(b => !b.is_active).length,
    averageRating: rows.length > 0 
      ? (rows.reduce((sum, b) => sum + (b.rating || 0), 0) / rows.length).toFixed(1)
      : "0.0"
  };

  useEffect(() => {
    load();
  }, []);

  // Componente de estatísticas
  function StatsCard({ icon: Icon, title, value, subtitle, color = "text-blue-500" }: {
    icon: any;
    title: string;
    value: string | number;
    subtitle: string;
    color?: string;
  }) {
    return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:from-slate-700/50 hover:to-slate-800/50 transition-all duration-200 hover:scale-105 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-300 text-sm font-medium">{title}</p>
          <p className="text-white text-2xl font-bold mt-1">{value}</p>
          <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/50 ${color} shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
    );
  }

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
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25"
              >
                <Link to="/admin">← Painel</Link>
              </Button>

              <Button
                onClick={load}
                disabled={loading}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Carregando..." : "Recarregar"}
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          {/* Header com Estatísticas */}
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Gestão de <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Barbeiros</span>
                </h1>
                <p className="text-white/70">Gerencie a equipe de barbeiros e suas informações</p>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar Barbeiro
                </Button>
              </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={Users}
                title="Total"
                value={stats.total}
                subtitle="barbeiros"
                color="text-cyan-400"
              />
              <StatsCard
                icon={CheckCircle}
                title="Ativos"
                value={stats.active}
                subtitle="trabalhando"
                color="text-emerald-400"
              />
              <StatsCard
                icon={XCircle}
                title="Inativos"
                value={stats.inactive}
                subtitle="pausados"
                color="text-rose-400"
              />
              <StatsCard
                icon={Star}
                title="Avaliação"
                value={stats.averageRating}
                subtitle="média geral"
                color="text-purple-400"
              />
            </div>
          </div>

          {/* Lista de Barbeiros - Desktop */}
          <div className="hidden md:block">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gradient-to-r from-slate-800/60 to-slate-900/60">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Barbeiro
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Informações
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Avaliação
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {rows.map((b, index) => (
                      <tr 
                        key={b.id} 
                        className="hover:bg-white/5 transition-all duration-200 group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <img
                              src={b.photo_url || "https://via.placeholder.com/64?text=Foto"}
                              alt={b.name}
                              className="h-12 w-12 rounded-full object-cover border-2 border-white/20"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/64?text=Foto";
                              }}
                            />
                            <div>
                              <div className="text-sm font-semibold text-white">{b.name}</div>
                              {b.instagram && (
                                <div className="flex items-center gap-1 text-xs text-white/60">
                                  <Instagram className="w-3 h-3" />
                                  {b.instagram}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-white/80 max-w-xs">
                            {b.bio || "Sem descrição"}
                          </div>
                          {b.specialties && b.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {b.specialties.slice(0, 2).map((specialty, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300">
                                  {specialty}
                                </span>
                              ))}
                              {b.specialties.length > 2 && (
                                <span className="text-xs text-white/50">+{b.specialties.length - 2}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-400 fill-current" />
                            <span className="text-sm font-semibold text-white">
                              {b.rating ? b.rating.toFixed(1) : "0.0"}
                            </span>
                            <span className="text-xs text-white/60">
                              ({b.reviews || 0} avaliações)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              b.is_active
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }`}
                          >
                            {b.is_active ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Inativo
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            disabled={savingId === b.id}
                            onClick={() => toggleActive(b)}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 ${
                              b.is_active ? "bg-amber-500" : "bg-white/20"
                            } ${savingId === b.id ? "opacity-60" : "hover:scale-105"}`}
                            aria-label="Alternar status"
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-200 ${
                                b.is_active ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Users className="w-12 h-12 text-white/30" />
                            <p className="text-white/60 text-lg">Nenhum barbeiro cadastrado</p>
                            <p className="text-white/40 text-sm">Clique em "Adicionar Barbeiro" para começar</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Cards Mobile */}
          <div className="md:hidden space-y-4">
            {rows.map((b, index) => (
              <div 
                key={b.id} 
                className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:from-slate-700/40 hover:to-slate-800/40 transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={b.photo_url || "https://via.placeholder.com/64?text=Foto"}
                    alt={b.name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-white/20"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/64?text=Foto";
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-semibold text-lg">{b.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          b.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {b.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {b.instagram && (
                      <div className="flex items-center gap-1 text-sm text-white/60 mb-2">
                        <Instagram className="w-4 h-4" />
                        {b.instagram}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-4 h-4 text-amber-400 fill-current" />
                      <span className="text-sm font-semibold text-white">
                        {b.rating ? b.rating.toFixed(1) : "0.0"}
                      </span>
                      <span className="text-xs text-white/60">
                        ({b.reviews || 0} avaliações)
                      </span>
                    </div>
                    {b.bio && (
                      <p className="text-sm text-white/70 mb-3">{b.bio}</p>
                    )}
                    {b.specialties && b.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {b.specialties.map((specialty, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300">
                            {specialty}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Status:</span>
                  <button
                    disabled={savingId === b.id}
                    onClick={() => toggleActive(b)}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 ${
                      b.is_active ? "bg-amber-500" : "bg-white/20"
                    } ${savingId === b.id ? "opacity-60" : ""}`}
                    aria-label="Alternar status"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-200 ${
                        b.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}

            {rows.length === 0 && (
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center shadow-xl">
                <Users className="w-16 h-16 text-cyan-400/50 mx-auto mb-4" />
                <h3 className="text-white/60 text-lg font-medium mb-2">
                  Nenhum barbeiro cadastrado
                </h3>
                <p className="text-white/40 text-sm mb-4">
                  Comece adicionando o primeiro barbeiro da equipe
                </p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar Barbeiro
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Adicionar Barbeiro */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Adicionar Barbeiro</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={newBarber.name}
                  onChange={(e) => setNewBarber(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  placeholder="Nome do barbeiro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  URL da Foto
                </label>
                <input
                  type="url"
                  value={newBarber.photo_url}
                  onChange={(e) => setNewBarber(prev => ({ ...prev, photo_url: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  placeholder="https://exemplo.com/foto.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Biografia
                </label>
                <textarea
                  value={newBarber.bio}
                  onChange={(e) => setNewBarber(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  rows={3}
                  placeholder="Descrição do barbeiro..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={newBarber.instagram}
                  onChange={(e) => setNewBarber(prev => ({ ...prev, instagram: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  placeholder="@usuario ou URL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Especialidades
                </label>
                <input
                  type="text"
                  value={newBarber.specialties.join(", ")}
                  onChange={(e) => setNewBarber(prev => ({ 
                    ...prev, 
                    specialties: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                  }))}
                  className="w-full rounded-lg bg-white/5 border border-white/20 text-white px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  placeholder="Corte masculino, Barba, Degradê (separados por vírgula)"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25 font-medium"
              >
                Cancelar
              </Button>
              <Button
                onClick={addBarber}
                disabled={!newBarber.name.trim() || addingBarber}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50"
              >
                {addingBarber ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

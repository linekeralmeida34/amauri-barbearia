import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RotateCcw,
  Plus,
  Edit,
  Save,
  X,
  Scissors,
  Sparkles,
  Star,
  DollarSign,
  Clock,
  Tag,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
} from "lucide-react";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  category: string | null;
  popular: boolean;
  is_active: boolean;
  deleted_at: string | null;
  commission_percentage: number;
};

type NewService = {
  name: string;
  description: string;
  duration_min: number;
  price: number;
  category: string;
  popular: boolean;
  commission_percentage: number;
};

const CATEGORIES = [
  "Cortes",
  "Barba", 
  "Combos",
  "Premium",
  "Tratamentos",
  "Especiais"
];

// Componente para cards de estatísticas
function StatsCard({ icon: Icon, title, value, subtitle, color }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:from-slate-700/60 hover:to-slate-800/60 transition-all duration-200 shadow-lg hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
          <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br from-slate-600/60 to-slate-700/60 ${color} shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

const ICONS = {
  "Cortes": Scissors,
  "Barba": Scissors,
  "Combos": Sparkles,
  "Premium": Star,
  "Tratamentos": Sparkles,
  "Especiais": Star,
};

export default function AdminServices() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<ServiceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceRow | null>(null);
  const [serviceToEdit, setServiceToEdit] = useState<ServiceRow | null>(null);
  const [newService, setNewService] = useState<NewService>({
    name: "",
    description: "",
    duration_min: 30,
    price: 0,
    category: "Cortes",
    popular: false,
    commission_percentage: 100,
  });
  const [addingService, setAddingService] = useState(false);
  const [editingService, setEditingService] = useState(false);
  const [deletingService, setDeletingService] = useState(false);

  // Estatísticas
  const stats = {
    total: rows.length,
    active: rows.filter(s => s.is_active).length,
    inactive: rows.filter(s => !s.is_active).length,
    popular: rows.filter(s => s.popular).length,
    averagePrice: rows.length > 0 
      ? (rows.reduce((sum, s) => sum + s.price, 0) / rows.length).toFixed(2)
      : "0.00"
  };

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at,commission_percentage")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) {
        // Se der erro por causa da coluna commission_percentage, tenta sem ela
        if (error.message?.includes("commission_percentage")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("services")
            .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at")
            .is("deleted_at", null)
            .order("name", { ascending: true });

          if (fallbackError) throw fallbackError;

          const services = (fallbackData ?? []).map((s: any) => ({
            ...s,
            commission_percentage: 100, // valor padrão
          })) as ServiceRow[];
          setRows(services);
          setFilteredRows(services);
          return;
        }
        throw error;
      }

      const services = (data ?? []) as ServiceRow[];
      setRows(services);
      setFilteredRows(services);
    } catch (err) {
      console.error("[AdminServices] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function filterServices(searchTerm: string) {
    if (!searchTerm.trim()) {
      setFilteredRows(rows);
      return;
    }

    const filtered = rows.filter((service) =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRows(filtered);
  }

  async function toggleActive(service: ServiceRow) {
    const next = !service.is_active;
    setSavingId(service.id);
    setRows((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: next } : s))
    );
    setFilteredRows((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: next } : s))
    );

    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: next })
        .eq("id", service.id);

      if (error) {
        setRows((prev) =>
          prev.map((s) =>
            s.id === service.id ? { ...s, is_active: !next } : s
          )
        );
        setFilteredRows((prev) =>
          prev.map((s) =>
            s.id === service.id ? { ...s, is_active: !next } : s
          )
        );
        throw error;
      }
    } catch (err) {
      console.error("[AdminServices] toggleActive error:", err);
    } finally {
      setSavingId(null);
    }
  }

  async function addService() {
    if (!newService.name.trim()) return;

    setAddingService(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .insert({
          name: newService.name.trim(),
          description: newService.description.trim() || null,
          duration_min: newService.duration_min,
          price: newService.price,
          category: newService.category,
          popular: newService.popular,
          commission_percentage: newService.commission_percentage,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newServiceData = data as ServiceRow;
      setRows((prev) => [...prev, newServiceData]);
      setFilteredRows((prev) => [...prev, newServiceData]);
      setNewService({
        name: "",
        description: "",
        duration_min: 30,
        price: 0,
        category: "Cortes",
        popular: false,
        commission_percentage: 100,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("[AdminServices] addService error:", err);
    } finally {
      setAddingService(false);
    }
  }

  async function updateService(service: ServiceRow) {
    setEditingService(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({
          name: service.name.trim(),
          description: service.description?.trim() || null,
          duration_min: service.duration_min,
          price: service.price,
          category: service.category,
          popular: service.popular,
          commission_percentage: service.commission_percentage,
        })
        .eq("id", service.id);

      if (error) throw error;

      // Atualiza o serviço na lista local
      setRows((prev) => prev.map((s) => (s.id === service.id ? service : s)));
      setFilteredRows((prev) => prev.map((s) => (s.id === service.id ? service : s)));
      setShowEditModal(false);
      setServiceToEdit(null);
    } catch (err) {
      console.error("[AdminServices] updateService error:", err);
    } finally {
      setEditingService(false);
    }
  }

  async function deleteService(service: ServiceRow) {
    setDeletingService(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", service.id);

      if (error) throw error;

      // Remove o serviço da lista local
      setRows((prev) => prev.filter((s) => s.id !== service.id));
      setFilteredRows((prev) => prev.filter((s) => s.id !== service.id));
      setShowDeleteModal(false);
      setServiceToDelete(null);
    } catch (err) {
      console.error("[AdminServices] deleteService error:", err);
    } finally {
      setDeletingService(false);
    }
  }

  function handleEditClick(service: ServiceRow) {
    setServiceToEdit(service);
    setShowEditModal(true);
  }

  function handleDeleteClick(service: ServiceRow) {
    setServiceToDelete(service);
    setShowDeleteModal(true);
  }

  useEffect(() => {
    load();
  }, []);

  const activeServices = filteredRows.filter((s) => s.is_active).length;
  const totalServices = filteredRows.length;
  const popularServices = filteredRows.filter((s) => s.popular).length;

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
                className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25"
              >
                <Link to="/admin">← Painel</Link>
              </Button>

              <Button
                onClick={load}
                disabled={loading}
                className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Carregando..." : "Recarregar"}
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-black/90 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Gestão de <span className="bg-gradient-to-r from-barbershop-gold to-amber-300 bg-clip-text text-transparent">Serviços</span>
                </h1>
                <p className="text-white/70">Gerencie os serviços oferecidos pela barbearia</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25 transition-all duration-200 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Adicionar Serviço</span>
                  <span className="sm:hidden">Adicionar</span>
                </Button>
              </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={Scissors}
                title="Total"
                value={stats.total}
                subtitle="serviços"
                color="text-cyan-400"
              />
              <StatsCard
                icon={CheckCircle}
                title="Ativos"
                value={stats.active}
                subtitle="disponíveis"
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
                icon={TrendingUp}
                title="Preço Médio"
                value={`R$ ${stats.averagePrice}`}
                subtitle="por serviço"
                color="text-purple-400"
              />
            </div>
          </div>

          {/* Search and Actions */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="text-white">
                <h2 className="text-xl font-semibold">Lista de Serviços</h2>
                <p className="text-white/70 text-sm">
                  {activeServices} de {totalServices} serviços ativos
                  {searchTerm && ` (${rows.length} total)`}
                </p>
              </div>

            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
              <Input
                type="text"
                placeholder="Pesquisar serviços por nome, descrição ou categoria..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  filterServices(e.target.value);
                }}
                className="pl-10 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-barbershop-gold focus:ring-barbershop-gold/20"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gradient-to-r from-slate-800/60 to-slate-900/60">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Serviço
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Detalhes
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Preço
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                        Comissão
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
                    {filteredRows.map((service, index) => {
                      const IconComponent = ICONS[service.category as keyof typeof ICONS] || Scissors;
                      return (
                        <tr 
                          key={service.id} 
                          className="hover:bg-white/5 transition-all duration-200 group cursor-pointer"
                          onClick={() => handleEditClick(service)}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-barbershop-gold/20 rounded-lg">
                                <IconComponent className="w-6 h-6 text-barbershop-gold" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{service.name}</div>
                                <div className="flex items-center gap-1 text-xs text-white/60">
                                  <Tag className="w-3 h-3" />
                                  {service.category}
                                </div>
                                {service.popular && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 mt-1">
                                    Popular
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-white/80 max-w-xs">
                              {service.description || "Sem descrição"}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-white/60 mt-1">
                              <Clock className="w-3 h-3" />
                              {service.duration_min} minutos
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">
                              R$ {service.price.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-barbershop-gold">
                              R$ {(service.price * (service.commission_percentage / 100)).toFixed(2)}
                            </div>
                            <div className="text-xs text-white/60">
                              ({service.commission_percentage}%)
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                service.is_active
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-red-100 text-red-800 border-red-200"
                              }`}
                            >
                              {service.is_active ? (
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
                            <div className="flex items-center gap-2">
                              <button
                                disabled={savingId === service.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActive(service);
                                }}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 ${
                                  service.is_active ? "bg-amber-500" : "bg-white/20"
                                } ${savingId === service.id ? "opacity-60" : "hover:scale-105"}`}
                                aria-label="Alternar status"
                              >
                                <span
                                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-200 ${
                                    service.is_active ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(service);
                                }}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-md transition-colors"
                                aria-label="Editar serviço"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(service);
                                }}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                                aria-label="Excluir serviço"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Scissors className="w-12 h-12 text-white/30" />
                            <p className="text-white/60 text-lg">
                              {searchTerm ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
                            </p>
                            <p className="text-white/40 text-sm">
                              {searchTerm ? "Tente pesquisar com outros termos" : "Clique em 'Adicionar Serviço' para começar"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredRows.map((service, index) => {
              const IconComponent = ICONS[service.category as keyof typeof ICONS] || Scissors;
              return (
                <div 
                  key={service.id} 
                  className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:from-slate-700/40 hover:to-slate-800/40 transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer"
                  onClick={() => handleEditClick(service)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-barbershop-gold/20 rounded-lg">
                      <IconComponent className="w-6 h-6 text-barbershop-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-semibold text-lg">{service.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            service.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {service.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-white/60 mb-2">
                        <Tag className="w-4 h-4" />
                        {service.category}
                      </div>
                      {service.popular && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 mb-2">
                          Popular
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-sm text-white/60 mb-2">
                        <Clock className="w-4 h-4" />
                        {service.duration_min} minutos
                      </div>
                      {service.description && (
                        <p className="text-sm text-white/70 mb-3">{service.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-white/60 mb-1">Preço Total</div>
                      <div className="text-sm font-semibold text-white">
                        R$ {service.price.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60 mb-1">Barbeiro Recebe</div>
                      <div className="text-sm font-semibold text-barbershop-gold">
                        R$ {(service.price * (service.commission_percentage / 100)).toFixed(2)}
                      </div>
                      <div className="text-xs text-white/50">
                        ({service.commission_percentage}%)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      disabled={savingId === service.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(service);
                      }}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 ${
                        service.is_active ? "bg-amber-500" : "bg-white/20"
                      } ${savingId === service.id ? "opacity-60" : "hover:scale-105"}`}
                      aria-label="Alternar status"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-200 ${
                          service.is_active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(service);
                        }}
                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-md transition-colors"
                        aria-label="Editar serviço"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(service);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                        aria-label="Excluir serviço"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredRows.length === 0 && (
              <div className="text-center py-12">
                <Scissors className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {searchTerm ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
                </h3>
                <p className="text-white/60">
                  {searchTerm ? "Tente pesquisar com outros termos" : "Clique em 'Adicionar Serviço' para começar"}
                </p>
              </div>
            )}
          </div>

          {/* Delete Service Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-red-400 text-xl font-bold">Confirmar Exclusão</h3>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="mb-6">
                  <p className="text-white/80 mb-2">
                    Tem certeza que deseja excluir o serviço <strong>"{serviceToDelete?.name}"</strong>?
                  </p>
                  <p className="text-white/60 text-sm">
                    Esta ação não pode ser desfeita. O serviço será removido da lista, mas os dados permanecerão no banco de dados.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => serviceToDelete && deleteService(serviceToDelete)}
                    disabled={deletingService}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingService ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Service Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="bg-barbershop-dark border-barbershop-gold/30 text-white">
              <DialogHeader>
                <DialogTitle className="text-barbershop-gold">
                  Editar Serviço
                </DialogTitle>
                <DialogDescription className="text-white/70">
                  Atualize as informações do serviço
                </DialogDescription>
              </DialogHeader>

              {serviceToEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateService(serviceToEdit);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="edit-name" className="text-white">
                      Nome do Serviço *
                    </Label>
                    <Input
                      id="edit-name"
                      value={serviceToEdit.name}
                      onChange={(e) =>
                        setServiceToEdit((prev) =>
                          prev ? { ...prev, name: e.target.value } : null
                        )
                      }
                      placeholder="Ex: Corte + Barba"
                      className="bg-white/10 border-white/30 text-white"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-description" className="text-white">
                      Descrição
                    </Label>
                    <Input
                      id="edit-description"
                      value={serviceToEdit.description || ""}
                      onChange={(e) =>
                        setServiceToEdit((prev) =>
                          prev ? { ...prev, description: e.target.value } : null
                        )
                      }
                      placeholder="Descreva o serviço..."
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-duration" className="text-white">
                        Duração (min) *
                      </Label>
                      <Input
                        id="edit-duration"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={serviceToEdit.duration_min || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^\d+$/.test(value)) {
                            setServiceToEdit((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    duration_min: value === "" ? 0 : parseInt(value) || 0,
                                  }
                                : null
                            );
                          }
                        }}
                        className="bg-white/10 border-white/30 text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-price" className="text-white">
                        Preço (R$) *
                      </Label>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={serviceToEdit.price || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[0-9]+([.,][0-9]+)?$/.test(value)) {
                            setServiceToEdit((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    price: value === "" ? 0 : parseFloat(value.replace(",", ".")) || 0,
                                  }
                                : null
                            );
                          }
                        }}
                        className="bg-white/10 border-white/30 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-commission" className="text-white">
                      Comissão do Barbeiro (%) *
                    </Label>
                    <Input
                      id="edit-commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={serviceToEdit.commission_percentage || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^[0-9]+([.,][0-9]+)?$/.test(value)) {
                          const numValue = value === "" ? 0 : parseFloat(value.replace(",", ".")) || 0;
                          const clampedValue = Math.min(Math.max(numValue, 0), 100);
                          setServiceToEdit((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  commission_percentage: clampedValue,
                                }
                              : null
                          );
                        }
                      }}
                      className="bg-white/10 border-white/30 text-white"
                      placeholder="Ex: 100"
                    />
                    <p className="text-white/60 text-xs mt-1">
                      Percentual que o barbeiro receberá por este serviço (0-100%)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="edit-category" className="text-white">
                      Categoria *
                    </Label>
                    <Select
                      value={serviceToEdit.category || ""}
                      onValueChange={(value) =>
                        setServiceToEdit((prev) =>
                          prev ? { ...prev, category: value } : null
                        )
                      }
                    >
                      <SelectTrigger className="bg-white/10 border-white/30 text-white">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-popular"
                      checked={serviceToEdit.popular}
                      onChange={(e) =>
                        setServiceToEdit((prev) =>
                          prev ? { ...prev, popular: e.target.checked } : null
                        )
                      }
                      className="rounded border-white/30 bg-white/10"
                    />
                    <Label htmlFor="edit-popular" className="text-white">
                      Marcar como popular
                    </Label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-800/50 text-gray-200 rounded-lg hover:bg-gray-600 hover:text-white transition-colors order-2 sm:order-1"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editingService}
                      className="flex-1 px-4 py-2 bg-barbershop-gold text-barbershop-dark rounded-lg hover:bg-barbershop-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingService ? "Salvando..." : "Salvar Alterações"}
                    </button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Service Modal */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent className="bg-barbershop-dark border-barbershop-gold/30 text-white">
              <DialogHeader>
                <DialogTitle className="text-barbershop-gold">
                  Adicionar Novo Serviço
                </DialogTitle>
                <DialogDescription className="text-white/70">
                  Preencha os dados do novo serviço
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">
                    Nome do Serviço *
                  </Label>
                  <Input
                    id="name"
                    value={newService.name}
                    onChange={(e) =>
                      setNewService((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex: Corte Tradicional"
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-white">
                    Descrição
                  </Label>
                  <Textarea
                    id="description"
                    value={newService.description}
                    onChange={(e) =>
                      setNewService((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Descreva o serviço..."
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration" className="text-white">
                      Duração (min) *
                    </Label>
                    <Input
                      id="duration"
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newService.duration_min || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permite apenas números
                        if (value === "" || /^\d+$/.test(value)) {
                          setNewService((prev) => ({
                            ...prev,
                            duration_min: value === "" ? 0 : parseInt(value) || 0,
                          }));
                        }
                      }}
                      className="bg-white/10 border-white/30 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="price" className="text-white">
                      Preço (R$) *
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={newService.price || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permite apenas números, vírgula e ponto
                        if (value === "" || /^[0-9]+([.,][0-9]+)?$/.test(value)) {
                          setNewService((prev) => ({
                            ...prev,
                            price: value === "" ? 0 : parseFloat(value.replace(",", ".")) || 0,
                          }));
                        }
                      }}
                      className="bg-white/10 border-white/30 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="commission" className="text-white">
                    Comissão do Barbeiro (%) *
                  </Label>
                  <Input
                    id="commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={newService.commission_percentage || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Permite apenas números, vírgula e ponto
                      if (value === "" || /^[0-9]+([.,][0-9]+)?$/.test(value)) {
                        const numValue = value === "" ? 0 : parseFloat(value.replace(",", ".")) || 0;
                        // Limita entre 0 e 100
                        const clampedValue = Math.min(Math.max(numValue, 0), 100);
                        setNewService((prev) => ({
                          ...prev,
                          commission_percentage: clampedValue,
                        }));
                      }
                    }}
                    className="bg-white/10 border-white/30 text-white"
                    placeholder="Ex: 100"
                  />
                  <p className="text-white/60 text-xs mt-1">
                    Percentual que o barbeiro receberá por este serviço (0-100%)
                  </p>
                </div>

                <div>
                  <Label htmlFor="category" className="text-white">
                    Categoria *
                  </Label>
                  <Select
                    value={newService.category}
                    onValueChange={(value) =>
                      setNewService((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger className="bg-white/10 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-barbershop-dark border-barbershop-gold/30">
                      {CATEGORIES.map((category) => (
                        <SelectItem
                          key={category}
                          value={category}
                          className="text-white hover:bg-white/10"
                        >
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="popular"
                    checked={newService.popular}
                    onCheckedChange={(checked) =>
                      setNewService((prev) => ({ ...prev, popular: checked }))
                    }
                    className="data-[state=checked]:bg-barbershop-gold"
                  />
                  <Label htmlFor="popular" className="text-white">
                    Marcar como popular
                  </Label>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="border-gray-400 text-gray-200 hover:bg-gray-600 hover:text-white bg-gray-800/50 w-full sm:w-auto order-2 sm:order-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={addService}
                  disabled={addingService || !newService.name.trim()}
                  className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25 w-full sm:w-auto order-1 sm:order-2"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {addingService ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </section>
  );
}


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
};

type NewService = {
  name: string;
  description: string;
  duration_min: number;
  price: number;
  category: string;
  popular: boolean;
};

const CATEGORIES = [
  "Cortes",
  "Barba", 
  "Combos",
  "Premium",
  "Tratamentos",
  "Especiais"
];

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceRow | null>(null);
  const [newService, setNewService] = useState<NewService>({
    name: "",
    description: "",
    duration_min: 30,
    price: 0,
    category: "Cortes",
    popular: false,
  });
  const [addingService, setAddingService] = useState(false);
  const [deletingService, setDeletingService] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) throw error;
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
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("[AdminServices] addService error:", err);
    } finally {
      setAddingService(false);
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
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2">Gerenciar Serviços</h1>
            <p className="text-white/70">
              Gerencie os serviços oferecidos pela barbearia
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard
              icon={Scissors}
              title="Total de Serviços"
              value={totalServices}
              subtitle="Serviços cadastrados"
              color="text-blue-400"
            />
            <StatsCard
              icon={Star}
              title="Serviços Ativos"
              value={activeServices}
              subtitle="Disponíveis para agendamento"
              color="text-green-400"
            />
            <StatsCard
              icon={Sparkles}
              title="Serviços Populares"
              value={popularServices}
              subtitle="Marcados como destaque"
              color="text-amber-400"
            />
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

              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Serviço
              </Button>
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

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRows.map((service) => {
              const IconComponent = ICONS[service.category as keyof typeof ICONS] || Scissors;
              return (
                <div
                  key={service.id}
                  className="bg-white/10 backdrop-blur rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-barbershop-gold/20 rounded-lg">
                        <IconComponent className="w-6 h-6 text-barbershop-gold" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">{service.name}</h3>
                        <Badge
                          variant="outline"
                          className="border-white/30 text-white text-xs mt-1"
                        >
                          {service.category}
                        </Badge>
                      </div>
                    </div>
                    {service.popular && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        Popular
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {service.description && (
                    <p className="text-white/70 text-sm mb-4 line-clamp-2">
                      {service.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-white/80">
                      <Clock className="w-4 h-4 text-white/60" />
                      <span className="text-sm">{service.duration_min} minutos</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <DollarSign className="w-4 h-4 text-white/60" />
                      <span className="text-sm font-medium">R$ {service.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        service.is_active
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      }
                    >
                      {service.is_active ? "Ativo" : "Inativo"}
                    </Badge>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => toggleActive(service)}
                        disabled={savingId === service.id}
                        className="data-[state=checked]:bg-barbershop-gold"
                      />
                      <button
                        onClick={() => handleDeleteClick(service)}
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
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <Scissors className="w-16 h-16 text-white/30 mb-4" />
                {searchTerm ? (
                  <>
                    <h3 className="text-white/60 text-lg font-medium mb-2">Nenhum serviço encontrado</h3>
                    <p className="text-white/40 text-sm">Tente pesquisar com outros termos</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-white/60 text-lg font-medium mb-2">Nenhum serviço cadastrado</h3>
                    <p className="text-white/40 text-sm">Clique em "Adicionar Serviço" para começar</p>
                  </>
                )}
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="border-gray-400 text-gray-200 hover:bg-gray-600 hover:text-white bg-gray-800/50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={addService}
                  disabled={addingService || !newService.name.trim()}
                  className="bg-gradient-to-r from-barbershop-gold to-amber-500 hover:from-amber-400 hover:to-barbershop-gold text-barbershop-dark shadow-lg hover:shadow-amber-500/25"
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

function StatsCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color = "text-blue-500",
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/70 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-white/60 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-full bg-white/10 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

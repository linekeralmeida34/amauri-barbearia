import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Scissors, Sparkles, Star, Search } from "lucide-react";
import { Link } from "react-router-dom"; // << novo
import { supabase } from "@/lib/supabase"; // << novo

// === helper para ícone (apenas para itens vindos do banco) ===
function pickIcon(name?: string | null, category?: string | null) {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();
  if (n.includes("barba") || c.includes("barba") || n.includes("corte") || c.includes("cabelo")) return Scissors;
  if (c.includes("premium") || c.includes("especial") || n.includes("premium")) return Star;
  return Sparkles;
}

// === SEU ARRAY ORIGINAL (inalterado) ===
const services = [
  {
    id: 1,
    name: "Corte Tradicional",
    description: "Corte clássico masculino com acabamento na navalha",
    duration: 30,
    price: 35,
    category: "Cortes",
    popular: false,
    icon: Scissors
  },
  {
    id: 2,
    name: "Corte + Barba",
    description: "Corte completo com modelagem e acabamento da barba",
    duration: 45,
    price: 55,
    category: "Combos",
    popular: true,
    icon: Sparkles
  },
  {
    id: 3,
    name: "Barba Completa",
    description: "Modelagem, corte e hidratação da barba",
    duration: 25,
    price: 25,
    category: "Barba",
    popular: false,
    icon: Scissors
  },
  {
    id: 4,
    name: "Corte Premium",
    description: "Corte premium com lavagem, massagem e acabamento",
    duration: 60,
    price: 75,
    category: "Premium",
    popular: false,
    icon: Star
  },
  {
    id: 5,
    name: "Tratamento Capilar",
    description: "Hidratação e tratamento para couro cabeludo",
    duration: 40,
    price: 45,
    category: "Tratamentos",
    popular: false,
    icon: Sparkles
  },
  {
    id: 6,
    name: "Pacote Noivo",
    description: "Corte + barba + sobrancelha + tratamento facial",
    duration: 90,
    price: 120,
    category: "Especiais",
    popular: false,
    icon: Star
  }
];

// tipagem do item local (shape do array acima)
type LocalService = typeof services[number];

export const ServicesSection = () => {
  // dados vindos do banco (se nulo, usa o array original sem mudar layout)
  const [dbServices, setDbServices] = useState<LocalService[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredServices, setFilteredServices] = useState<LocalService[]>([]);

  // carrega do Supabase e mapeia pro MESMO shape do array original
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (!error && data) {
        const mapped: LocalService[] = data.map((s: any) => ({
          id: s.id,
          name: s.name ?? "",
          description: s.description ?? "",
          duration: Number(s.duration_min ?? 0),
          price: Number(s.price ?? 0),
          category: s.category ?? "",
          popular: !!s.popular,
          icon: pickIcon(s.name, s.category) // mantém o mesmo padrão visual
        }));
        // se vier vazio, mantém seus 6; se vier banco, usa só banco
        const servicesList = mapped.length ? mapped : services;
        setDbServices(servicesList);
        setFilteredServices(servicesList);
      }
    })();
  }, []);

  // Função de filtro
  const filterServices = (term: string) => {
    if (!term.trim()) {
      setFilteredServices(dbServices ?? services);
      return;
    }

    const list = dbServices ?? services;
    const filtered = list.filter((service) =>
      service.name.toLowerCase().includes(term.toLowerCase()) ||
      service.description.toLowerCase().includes(term.toLowerCase()) ||
      service.category.toLowerCase().includes(term.toLowerCase())
    );
    setFilteredServices(filtered);
  };

  // a lista que o JSX renderiza (NÃO muda layout/markup/classes)
  const list = filteredServices;

  return (
    <section className="py-20 bg-barbershop-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-barbershop-dark mb-4">
            Nossos Serviços
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Oferecemos uma gama completa de serviços para o homem moderno, 
            sempre com a qualidade e atenção aos detalhes que você merece.
          </p>
          
          {/* Search Input */}
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-barbershop-brown/60 w-4 h-4" />
              <Input
                type="text"
                placeholder="Pesquisar serviços..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  filterServices(e.target.value);
                }}
                className="pl-10 bg-white border-barbershop-brown/20 text-barbershop-dark placeholder:text-barbershop-brown/60 focus:border-barbershop-gold focus:ring-barbershop-gold/20"
              />
            </div>
          </div>
        </div>
        
        {list.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-barbershop-brown/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-barbershop-dark mb-2">
              Nenhum serviço encontrado
            </h3>
            <p className="text-barbershop-brown/70">
              Tente pesquisar com outros termos
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {list.map((service) => {
            const IconComponent = service.icon;
            return (
              <Card
                key={service.id}
                className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-2 hover:border-barbershop-gold/50 bg-gradient-card"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="bg-barbershop-gold/20 p-3 rounded-full">
                      <IconComponent className="h-6 w-6 text-barbershop-brown" />
                    </div>
                    {service.popular && (
                      <Badge className="bg-barbershop-gold text-barbershop-dark">
                        Mais Popular
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl text-barbershop-dark group-hover:text-primary transition-colors">
                    {service.name}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{service.duration}min</span>
                    </div>
                    <div className="text-2xl font-bold text-barbershop-brown">
                      R$ {service.price}
                    </div>
                  </div>

                  <Badge variant="secondary" className="mb-4">
                    {service.category}
                  </Badge>

                  {/* Botão leva para a MESMA página do fluxo, com serviço pré-selecionado */}
                  <Button
                    asChild
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-300 hover:scale-105"
                  >
                    <Link
                      to={`/agendar?servico=${service.id}`}
                      aria-label={`Agendar ${service.name}`}
                    >
                      Agendar Serviço
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
};

// export default também para compatibilizar com import anterior
export default ServicesSection;

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Scissors, Sparkles, Star } from "lucide-react";

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

export const ServicesSection = () => {
  return (
    <section className="py-20 bg-barbershop-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-barbershop-dark mb-4">
            Nossos Serviços
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Oferecemos uma gama completa de serviços para o homem moderno, 
            sempre com a qualidade e atenção aos detalhes que você merece.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <Card key={service.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-2 hover:border-barbershop-gold/50 bg-gradient-card">
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
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-300 hover:scale-105"
                  >
                    Agendar Serviço
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
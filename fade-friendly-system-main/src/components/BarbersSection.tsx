import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Instagram, Calendar } from "lucide-react";

const barbers = [
  {
    id: 1,
    name: "Amauri",
    specialties: ["Proprietário", "Cortes Tradicionais e Modernos"],
    bio: "Proprietário da Amauri Barbearia, com mais de 10 anos de experiência",
    rating: 5.0,
    reviews: 248,
    photo: "https://i.ibb.co/fzRKKXM0/amauri.jpg",
    instagram: "@amauribarbearia"
  },
  {
    id: 2,
    name: "Carlos",
    specialties: ["Cortes Modernos", "Barbas"],
    bio: "Especialista em cortes contemporâneos e modelagem de barbas",
    rating: 4.9,
    reviews: 156,
    photo: "https://i.ibb.co/FkVP6r5d/carlos.jpg",
    instagram: "@carlos_barber83"
  },
  {
    id: 3,
    name: "Ronaldo",
    specialties: ["Degradês", "Acabamentos"],
    bio: "Expert em técnicas de degradê e acabamentos de precisão",
    rating: 4.8,
    reviews: 134,
    photo: "https://i.ibb.co/whs08JYs/ronaldojpg.jpg",
    instagram: "@ronaldo_das_nega"
  }
];

export const BarbersSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-barbershop-dark mb-4">
            Nossos Profissionais
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Conheça nossa equipe de barbeiros especializados, cada um com sua expertise 
            única para atender às suas necessidades.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {barbers.map((barber) => (
            <Card key={barber.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-2 hover:border-barbershop-gold/50 bg-gradient-card">
              <CardContent className="p-6">
                <div className="relative mb-4">
                  <img
                    src={barber.photo}
                    alt={barber.name}
                    className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-barbershop-gold/20 group-hover:border-barbershop-gold transition-colors"
                  />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-barbershop-gold text-barbershop-dark text-xs px-2 py-1">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {barber.rating}
                    </Badge>
                  </div>
                </div>
                
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-barbershop-dark mb-1">
                    {barber.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {barber.bio}
                  </p>
                  <div className="text-xs text-muted-foreground mb-3">
                    {barber.reviews} avaliações
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 justify-center mb-4">
                  {barber.specialties.map((specialty, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-300 hover:scale-105"
                    size="sm"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Agendar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full text-xs hover:bg-barbershop-gold/10"
                  >
                    <Instagram className="h-3 w-3 mr-1" />
                    {barber.instagram}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
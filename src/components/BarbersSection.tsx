import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Instagram, Calendar } from "lucide-react";

const barbers = [
  {
    id: 1,
    name: "Carlos Silva",
    specialties: ["Cortes Clássicos", "Barbas"],
    bio: "15 anos de experiência em cortes tradicionais e modernos",
    rating: 4.9,
    reviews: 127,
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    instagram: "@carlos_barber"
  },
  {
    id: 2,
    name: "Roberto Lima",
    specialties: ["Cortes Modernos", "Tratamentos"],
    bio: "Especialista em cortes contemporâneos e cuidados capilares",
    rating: 4.8,
    reviews: 89,
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    instagram: "@roberto_cuts"
  },
  {
    id: 3,
    name: "André Santos",
    specialties: ["Barbas", "Acabamentos"],
    bio: "Mestre em modelagem de barbas e acabamentos de precisão",
    rating: 4.9,
    reviews: 156,
    photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
    instagram: "@andre_beardmaster"
  },
  {
    id: 4,
    name: "Paulo Mendes",
    specialties: ["Cortes Premium", "Eventos"],
    bio: "Especializado em cortes para eventos especiais e noivos",
    rating: 5.0,
    reviews: 78,
    photo: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face",
    instagram: "@paulo_premium"
  },
  {
    id: 5,
    name: "Diego Costa",
    specialties: ["Estilos Jovens", "Degradês"],
    bio: "Expert em cortes jovens e técnicas de degradê modernas",
    rating: 4.7,
    reviews: 94,
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face",
    instagram: "@diego_fade"
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
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
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
import { Hero } from "@/components/Hero";
import { ServicesSection } from "@/components/ServicesSection";
import { BarbersSection } from "@/components/BarbersSection";
import { BookingFlow } from "@/components/BookingFlow";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock, Instagram, MessageCircle } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-barbershop-dark">
                Elite<span className="text-barbershop-gold">Barber</span>
              </h1>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#servicos" className="text-barbershop-dark hover:text-primary transition-colors">Serviços</a>
              <a href="#barbeiros" className="text-barbershop-dark hover:text-primary transition-colors">Barbeiros</a>
              <a href="#agendamento" className="text-barbershop-dark hover:text-primary transition-colors">Agendar</a>
              <a href="#contato" className="text-barbershop-dark hover:text-primary transition-colors">Contato</a>
            </div>
            <Button className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold">
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <Hero />
      
      {/* Services Section */}
      <div id="servicos">
        <ServicesSection />
      </div>
      
      {/* Barbers Section */}
      <div id="barbeiros">
        <BarbersSection />
      </div>
      
      {/* Booking Section */}
      <div id="agendamento">
        <BookingFlow />
      </div>
      
      {/* Contact/Footer Section */}
      <footer id="contato" className="bg-barbershop-dark text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className="text-3xl font-bold mb-6">
                Elite<span className="text-barbershop-gold">Barber</span>
              </h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                Tradição e excelência em cortes masculinos. Há mais de 10 anos cuidando do visual dos homens mais exigentes de São Paulo.
              </p>
              <div className="flex space-x-4">
                <Button variant="outline" size="sm" className="border-barbershop-gold text-barbershop-gold hover:bg-barbershop-gold hover:text-barbershop-dark">
                  <Instagram className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="border-barbershop-gold text-barbershop-gold hover:bg-barbershop-gold hover:text-barbershop-dark">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="text-xl font-semibold mb-6 text-barbershop-gold">Informações</h4>
              <div className="space-y-4">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-3 text-barbershop-gold" />
                  <div>
                    <p className="text-white/90">Rua Augusta, 1234</p>
                    <p className="text-white/70 text-sm">Consolação, São Paulo - SP</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3 text-barbershop-gold" />
                  <div>
                    <p className="text-white/90">(11) 99999-9999</p>
                    <p className="text-white/70 text-sm">WhatsApp e Ligações</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-xl font-semibold mb-6 text-barbershop-gold">Horário de Funcionamento</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/90">Segunda - Sexta</span>
                  <span className="text-barbershop-gold font-semibold">09:00 - 19:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/90">Sábado</span>
                  <span className="text-barbershop-gold font-semibold">08:00 - 18:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/90">Domingo</span>
                  <span className="text-white/60">Fechado</span>
                </div>
              </div>
              
              <div className="mt-8">
                <Button className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold">
                  <Clock className="h-4 w-4 mr-2" />
                  Agendar Agora
                </Button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/20 mt-12 pt-8 text-center">
            <p className="text-white/60">
              © 2024 EliteBarber. Todos os direitos reservados. | Desenvolvido com tecnologia Lovable
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
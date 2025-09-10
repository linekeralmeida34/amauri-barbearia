import { Button } from "@/components/ui/button";
import { Calendar, Clock, Scissors, Users } from "lucide-react";
import heroImage from "@/assets/barbershop-hero.jpg";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-barbershop-dark/80 via-barbershop-brown/60 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center lg:text-left">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              Cortes de
              <span className="text-barbershop-gold block">Excelência</span>
            </h1>
            <p className="text-xl lg:text-2xl mb-8 text-white/90 leading-relaxed">
              Tradição e modernidade em um só lugar. Agende seu horário e experimente o melhor em cortes masculinos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark font-semibold text-lg px-8 py-6 shadow-glow transition-all duration-300 hover:scale-105"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Agendar Horário
              </Button>
              <Button 
                size="lg" 
                className="bg-barbershop-dark text-white hover:bg-barbershop-brown border-2 border-barbershop-dark hover:border-barbershop-brown font-semibold text-lg px-8 py-6 transition-all duration-300"
              >
                <Users className="mr-2 h-5 w-5" />
                Nossos Barbeiros
              </Button>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center text-white border border-white/20">
              <Clock className="h-8 w-8 text-barbershop-gold mx-auto mb-2" />
              <div className="text-2xl font-bold">15min</div>
              <div className="text-sm opacity-90">Tempo médio</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center text-white border border-white/20">
              <Scissors className="h-8 w-8 text-barbershop-gold mx-auto mb-2" />
              <div className="text-2xl font-bold">1000+</div>
              <div className="text-sm opacity-90">Clientes felizes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center text-white border border-white/20 col-span-2">
              <Users className="h-8 w-8 text-barbershop-gold mx-auto mb-2" />
              <div className="text-2xl font-bold">3 Barbeiros</div>
              <div className="text-sm opacity-90">Especialistas experientes</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};
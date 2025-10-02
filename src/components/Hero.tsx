import { Button } from "@/components/ui/button";
import { Calendar, Clock, Scissors, Users } from "lucide-react";
import heroImage from "@/assets/barbershop-hero.jpg";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section
      id="hero"
      className="relative min-h-[90svh] sm:min-h-screen flex items-center justify-center overflow-hidden pt-safe pb-safe"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-barbershop-dark/80 via-barbershop-brown/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center lg:text-left pt-24 md:pt-0">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 leading-[1.1]">
              Cortes de
              <span className="text-barbershop-gold block">Excelência</span>
            </h1>
            <p className="text-base md:text-xl lg:text-2xl mb-6 md:mb-8 text-white/90 leading-relaxed">
              Tradição e modernidade em um só lugar. Agende seu horário e experimente o melhor em cortes masculinos.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start">
              {/* Agendar -> sempre abre a página de agendamento */}
              <Button
                asChild
                size="lg"
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark sm:text-barbershop-dark text-gray-700
                           font-semibold text-lg px-6 py-4 md:px-8 md:py-6 shadow-glow
                           transition-all duration-300 hover:scale-105"
              >
                <Link to="/agendar" aria-label="Ir para a página de agendamento">
                  <Calendar className="mr-2 h-5 w-5" />
                  Agendar Horário
                </Link>
              </Button>

              {/* Nossos Barbeiros -> ancora na home (via query ?a=barbeiros) */}
              <Button
                asChild
                size="lg"
                className="
                  bg-white text-gray-600 sm:text-neutral-900 border-0 sm:border-2 sm:border-neutral-900
                  font-semibold text-lg px-6 py-4 md:px-8 md:py-6
                  transform-gpu transition-transform duration-200 ease-out
                  hover:scale-[1.03] active:scale-[0.98] hover:bg-neutral-100
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2
                  dark:bg-white dark:text-gray-600 dark:sm:text-neutral-900 dark:hover:bg-neutral-200
                "
              >
                <Link to="/?a=barbeiros" aria-label="Ir para a seção de barbeiros">
                  <Users className="mr-2 h-5 w-5" />
                  Nossos Barbeiros
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center text-white border border-white/20">
              <Clock className="h-8 w-8 text-barbershop-gold mx-auto mb-2" />
              <div className="text-2xl font-bold">40min</div>
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

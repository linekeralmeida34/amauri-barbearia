import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Phone, Mail, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BookingStep = 'service' | 'barber' | 'datetime' | 'details' | 'confirmation';

const services = [
  { id: 1, name: "Corte Tradicional", duration: 30, price: 35 },
  { id: 2, name: "Corte + Barba", duration: 45, price: 55, popular: true },
  { id: 3, name: "Barba Completa", duration: 25, price: 25 },
  { id: 4, name: "Corte Premium", duration: 60, price: 75 }
];

const barbers = [
  { id: 1, name: "Carlos Silva", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
  { id: 2, name: "Roberto Lima", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
  { id: 3, name: "André Santos", photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face" }
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"
];

export const BookingFlow = () => {
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    email: "",
    notes: ""
  });

  const nextStep = () => {
    const steps: BookingStep[] = ['service', 'barber', 'datetime', 'details', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: BookingStep[] = ['service', 'barber', 'datetime', 'details', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'service':
        return selectedService !== null;
      case 'barber':
        return selectedBarber !== null;
      case 'datetime':
        return selectedDate && selectedTime;
      case 'details':
        return customerDetails.name && customerDetails.phone;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'service':
        return (
          <div>
            <h3 className="text-2xl font-bold text-barbershop-dark mb-6">Escolha seu serviço</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {services.map((service) => (
                <Card 
                  key={service.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedService?.id === service.id ? 'ring-2 ring-barbershop-gold border-barbershop-gold' : ''
                  }`}
                  onClick={() => setSelectedService(service)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      {service.popular && <Badge className="bg-barbershop-gold text-barbershop-dark">Popular</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-muted-foreground text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {service.duration}min
                      </div>
                      <div className="text-xl font-bold text-barbershop-brown">R$ {service.price}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'barber':
        return (
          <div>
            <h3 className="text-2xl font-bold text-barbershop-dark mb-6">Escolha seu barbeiro</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {barbers.map((barber) => (
                <Card 
                  key={barber.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedBarber?.id === barber.id ? 'ring-2 ring-barbershop-gold border-barbershop-gold' : ''
                  }`}
                  onClick={() => setSelectedBarber(barber)}
                >
                  <CardContent className="p-6 text-center">
                    <img
                      src={barber.photo}
                      alt={barber.name}
                      className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                    />
                    <h4 className="font-semibold text-barbershop-dark">{barber.name}</h4>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'datetime':
        return (
          <div>
            <h3 className="text-2xl font-bold text-barbershop-dark mb-6">Escolha data e horário</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <Label className="text-base font-semibold mb-4 block">Data</Label>
                <Input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mb-4"
                />
              </div>
              <div>
                <Label className="text-base font-semibold mb-4 block">Horário Disponível</Label>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      className={selectedTime === time ? "bg-barbershop-gold text-barbershop-dark" : ""}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div>
            <h3 className="text-2xl font-bold text-barbershop-dark mb-6">Seus dados</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={customerDetails.name}
                  onChange={(e) => setCustomerDetails({...customerDetails, name: e.target.value})}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails({...customerDetails, phone: e.target.value})}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails({...customerDetails, email: e.target.value})}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={customerDetails.notes}
                  onChange={(e) => setCustomerDetails({...customerDetails, notes: e.target.value})}
                  placeholder="Alguma preferência ou observação especial?"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-barbershop-dark mb-2">Agendamento Confirmado!</h3>
              <p className="text-muted-foreground">Seu horário foi reservado com sucesso.</p>
            </div>
            
            <Card className="bg-barbershop-cream border-barbershop-gold/20">
              <CardContent className="p-6">
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Serviço:</span>
                    <span>{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Barbeiro:</span>
                    <span>{selectedBarber?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Data/Hora:</span>
                    <span>{selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')} às {selectedTime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Duração:</span>
                    <span>{selectedService?.duration}min</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>R$ {selectedService?.price}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <p className="text-sm text-muted-foreground mt-4">
              Confirmação enviada para {customerDetails.phone}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-barbershop-dark mb-4">Agendar Horário</h2>
          <p className="text-xl text-muted-foreground">Simples, rápido e conveniente</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            {['Serviço', 'Barbeiro', 'Data/Hora', 'Dados', 'Confirmação'].map((step, index) => {
              const stepKeys: BookingStep[] = ['service', 'barber', 'datetime', 'details', 'confirmation'];
              const currentStepIndex = stepKeys.indexOf(currentStep);
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isCompleted ? 'bg-success text-white' : 
                    isActive ? 'bg-barbershop-gold text-barbershop-dark' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  {index < 4 && (
                    <div className={`w-12 h-0.5 ${
                      isCompleted ? 'bg-success' : 'bg-muted'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardContent className="p-8">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        {currentStep !== 'confirmation' && (
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 'service'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={nextStep}
              disabled={!canProceed()}
              className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
            >
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
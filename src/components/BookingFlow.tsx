// src/components/BookingFlow.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useSearchParams } from "react-router-dom";

// fonte única de serviços (compartilhada com ServicesSection)
import { services } from "@/data/services";

type BookingStep = "service" | "barber" | "datetime" | "details" | "confirmation";

const barbers = [
  { id: 1, name: "Amauri", photo: "https://i.ibb.co/fzRKKXM0/amauri.jpg" },
  { id: 2, name: "Carlos", photo: "https://i.ibb.co/FkVP6r5d/carlos.jpg" },
  { id: 3, name: "Ronaldo", photo: "https://i.ibb.co/whs08JYs/ronaldojpg.jpg" },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

export const BookingFlow = () => {
  const [currentStep, setCurrentStep] = useState<BookingStep>("service");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Pré-seleciona serviço via /agendar?servico=<id> e pula para "barber"
  useEffect(() => {
    const s = searchParams.get("servico");
    if (s && !selectedService) {
      const id = Number(s);
      const found = services.find((sv) => sv.id === id);
      if (found) {
        setSelectedService(found);
        setCurrentStep((prev) => (prev === "service" ? "barber" : prev));
      }
    }
  }, [searchParams, selectedService]);

  // Pré-seleciona barbeiro via /agendar?barbeiro=<id>
  useEffect(() => {
    const b = searchParams.get("barbeiro");
    if (b && !selectedBarber) {
      const id = Number(b);
      const found = barbers.find((bb) => bb.id === id);
      if (found) setSelectedBarber(found);
    }
  }, [searchParams, selectedBarber]);

  const handleSelectService = (service: any) => {
    setSelectedService(service);
    const sp = new URLSearchParams(searchParams);
    sp.set("servico", String(service.id));
    setSearchParams(sp, { replace: true });
  };

  const handleSelectBarber = (barber: any) => {
    setSelectedBarber(barber);
    const sp = new URLSearchParams(searchParams);
    sp.set("barbeiro", String(barber.id));
    setSearchParams(sp, { replace: true });
  };

  const nextStep = () => {
    const steps: BookingStep[] = ["service", "barber", "datetime", "details", "confirmation"];
    const currentIndex = steps.indexOf(currentStep);

    if (currentStep === "details" && canProceed()) {
      setShowConfirmationModal(true);
      return;
    }
    if (currentIndex < steps.length - 1) setCurrentStep(steps[currentIndex + 1]);
  };

  const confirmBooking = () => {
    setShowConfirmationModal(false);
    setCurrentStep("confirmation");
  };

  const editBooking = () => setShowConfirmationModal(false);

  const prevStep = () => {
    const steps: BookingStep[] = ["service", "barber", "datetime", "details", "confirmation"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) setCurrentStep(steps[currentIndex - 1]);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "service":
        return selectedService !== null;
      case "barber":
        return selectedBarber !== null;
      case "datetime":
        return !!selectedDate && !!selectedTime;
      case "details":
        return !!customerDetails.name && !!customerDetails.phone;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "service":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Escolha seu serviço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {services.map((service) => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedService?.id === service.id ? "ring-2 ring-barbershop-gold border-barbershop-gold" : ""
                  }`}
                  onClick={() => handleSelectService(service)}
                >
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base sm:text-lg md:text-xl">
                        {service.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {service.popular && (
                          <Badge className="bg-barbershop-gold text-barbershop-dark">Popular</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {service.duration}min
                      </div>
                      <div className="font-bold text-barbershop-brown text-lg sm:text-xl">
                        R$ {service.price}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case "barber":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Escolha seu barbeiro
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              {barbers.map((barber) => (
                <Card
                  key={barber.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedBarber?.id === barber.id ? "ring-2 ring-barbershop-gold border-barbershop-gold" : ""
                  }`}
                  onClick={() => handleSelectBarber(barber)}
                >
                  <CardContent className="p-5 sm:p-6 text-center">
                    <img
                      src={barber.photo}
                      alt={barber.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://via.placeholder.com/80?text=Foto";
                      }}
                    />
                    <h4 className="font-semibold text-barbershop-dark text-sm sm:text-base">
                      {barber.name}
                    </h4>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case "datetime":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Escolha data e horário
            </h3>
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              <div>
                <Label className="text-base font-semibold mb-4 block">Data</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mb-2"
                />
              </div>
              <div>
                <Label className="text-base font-semibold mb-4 block">Horário Disponível</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {timeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      className={`h-9 ${
                        selectedTime === time ? "bg-barbershop-gold text-barbershop-dark" : ""
                      }`}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "details":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">Seus dados</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={customerDetails.name}
                  onChange={(e) => {
                    const onlyLetters = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
                    setCustomerDetails({ ...customerDetails, name: onlyLetters });
                  }}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  inputMode="numeric"
                  value={customerDetails.phone}
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setCustomerDetails({ ...customerDetails, phone: onlyNumbers });
                  }}
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas números, até 11 dígitos.
                </p>
              </div>
              <div>
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) =>
                    setCustomerDetails({ ...customerDetails, email: e.target.value })
                  }
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={customerDetails.notes}
                  onChange={(e) =>
                    setCustomerDetails({ ...customerDetails, notes: e.target.value })
                  }
                  placeholder="Alguma preferência ou observação especial?"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case "confirmation":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-barbershop-dark mb-2">
                Agendamento Confirmado!
              </h3>
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
                    <span>
                      {selectedDate &&
                        new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR")}{" "}
                      às {selectedTime}
                    </span>
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
              Confirmação enviada para {customerDetails.phone} - Amauri Barbearia
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
        {/* Títulos responsivos */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="font-bold text-barbershop-dark mb-4 text-3xl sm:text-4xl md:text-5xl">
            Agendar na Amauri Barbearia
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            Simples, rápido e conveniente
          </p>
        </div>

        {/* Steps com scroll horizontal no mobile */}
        <div className="mb-10 sm:mb-12 -mx-4 px-4 overflow-x-auto">
          <div className="min-w-max flex items-center gap-3 sm:gap-4">
            {["Serviço", "Barbeiro", "Data/Hora", "Dados", "Confirmação"].map((step, index) => {
              const stepKeys: BookingStep[] = [
                "service",
                "barber",
                "datetime",
                "details",
                "confirmation",
              ];
              const currentStepIndex = stepKeys.indexOf(currentStep);
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step} className="flex items-center">
                  <div
                    className={`rounded-full flex items-center justify-center font-semibold
                                w-6 h-6 text-xs sm:w-8 sm:h-8 sm:text-sm
                                ${
                                  isCompleted
                                    ? "bg-success text-white"
                                    : isActive
                                    ? "bg-barbershop-gold text-barbershop-dark"
                                    : "bg-muted text-muted-foreground"
                                }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < 4 && (
                    <div className={`h-0.5 w-8 sm:w-12 ${isCompleted ? "bg-success" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Conteúdo do step */}
        <Card className="mb-8">
          <CardContent className="p-5 sm:p-8">{renderStepContent()}</CardContent>
        </Card>

        {/* Navegação (empilhado no mobile) */}
        {currentStep !== "confirmation" ? (
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <Button
                asChild
                className="bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl px-4 py-2.5"
              >
                <Link to="/#hero" aria-label="Voltar ao início">
                  ← Início
                </Link>
              </Button>

              <Button variant="outline" onClick={prevStep} disabled={currentStep === "service"}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>

            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark w-full md:w-auto h-11"
            >
              {currentStep === "details" ? "Revisar Agendamento" : "Continuar"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex justify-center">
            <Button
              asChild
              className="bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl px-4 py-2.5"
            >
              <Link to="/#hero" aria-label="Voltar ao início">
                ← Voltar ao início
              </Link>
            </Button>
          </div>
        )}

        {/* Modal de confirmação com respiro entre botões */}
        <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
          <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Confirmar Agendamento</DialogTitle>
              <DialogDescription>
                Revise os detalhes do seu agendamento na Amauri Barbearia
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Serviço:</Label>
                <div className="col-span-2">{selectedService?.name}</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Barbeiro:</Label>
                <div className="col-span-2">{selectedBarber?.name}</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Data/Hora:</Label>
                <div className="col-span-2">
                  {selectedDate &&
                    new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR")}{" "}
                  às {selectedTime}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Duração:</Label>
                <div className="col-span-2">{selectedService?.duration}min</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Preço:</Label>
                <div className="col-span-2 font-bold">R$ {selectedService?.price}</div>
              </div>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Política de Cancelamento:</strong> Cancelamentos devem ser feitos com
                  pelo menos 2 horas de antecedência. Cancelamentos em cima da hora podem ser
                  cobrados.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-3 sm:gap-4 pt-2 flex-col-reverse sm:flex-row">
              <Button variant="outline" onClick={editBooking}>
                Editar
              </Button>
              <Button
                onClick={confirmBooking}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
                autoFocus
              >
                <Check className="h-4 w-4 mr-2" />
                Confirmar Agendamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default BookingFlow;

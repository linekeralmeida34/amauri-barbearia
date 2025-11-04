// src/components/admin/AdminBookingCreate.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  fetchActiveServices, 
  fetchActiveBarbers, 
  createBooking,
  listAvailableTimes,
  CreateBookingInput,
  PaymentMethod,
  findCustomerByPhone,
  upsertCustomer
} from "@/lib/api";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  ArrowLeft, 
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Search,
  CreditCard,
  DollarSign,
  Smartphone,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useBarberAuth } from "@/hooks/useBarberAuth";

type BookingStep = "service" | "barber" | "datetime" | "details" | "confirmation";

type Service = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  popular?: boolean;
};

type Barber = {
  id: string;
  name: string;
  photo_url?: string | null;
};

function todayLocalYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toStartsAtISO(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  return dt.toISOString();
}

const paymentMethods: { value: PaymentMethod; label: string; icon: JSX.Element }[] = [
  { value: "cash", label: "Dinheiro", icon: <DollarSign className="w-4 h-4" /> },
  { value: "pix", label: "PIX", icon: <Smartphone className="w-4 h-4" /> },
  { value: "credit_card", label: "Cartão de Crédito", icon: <CreditCard className="w-4 h-4" /> },
  { value: "debit_card", label: "Cartão de Débito", icon: <CreditCard className="w-4 h-4" /> },
  { value: "voucher", label: "Vale", icon: <Ticket className="w-4 h-4" /> },
];

export default function AdminBookingCreate() {
  const navigate = useNavigate();
  const { barber: authenticatedBarber, isAdmin } = useBarberAuth();
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("service");
  
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [barbers, setBarbers] = useState<Barber[]>([]);
  
  // Seleções
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  
  // Dados do cliente
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  
  // Estado
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Função de filtro de serviços
  const filterServices = (term: string) => {
    if (!term.trim()) {
      setFilteredServices(services);
      return;
    }

    const filtered = services.filter((service) =>
      service.name.toLowerCase().includes(term.toLowerCase())
    );
    setFilteredServices(filtered);
  };
  
  // Carrega serviços e barbeiros
  useEffect(() => {
    (async () => {
      try {
        const [svcs, brbs] = await Promise.all([
          fetchActiveServices(),
          fetchActiveBarbers()
        ]);
        setServices(svcs);
        setFilteredServices(svcs);

        const mapped = brbs.map(b => ({ id: b.id, name: b.name, photo_url: b.photo_url }));

        if (!isAdmin && authenticatedBarber) {
          const mine = mapped.find(b => b.id === authenticatedBarber.id);
          if (mine) {
            setBarbers([mine]);
            setSelectedBarber(mine);
          } else {
            setBarbers(mapped);
          }
        } else {
          setBarbers(mapped);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    })();
  }, [isAdmin, authenticatedBarber]);

  // Garante que barbeiro não-admin só possa selecionar a si mesmo
  useEffect(() => {
    if (!isAdmin && authenticatedBarber && barbers.length > 0) {
      const mine = barbers.find(b => b.id === authenticatedBarber.id);
      if (mine) {
        if (!selectedBarber || selectedBarber.id !== mine.id) {
          setSelectedBarber(mine);
        }
        if (!(barbers.length === 1 && barbers[0].id === mine.id)) {
          setBarbers([mine]);
        }
      }
    }
  }, [isAdmin, authenticatedBarber, barbers, selectedBarber]);

  // Sincroniza filteredServices quando services mudar
  useEffect(() => {
    setFilteredServices(services);
  }, [services]);

  // Busca cliente por telefone (11 dígitos) e preenche nome/ID quando encontrado
  useEffect(() => {
    const digits = customerDetails.phone.replace(/\D/g, "");
    if (digits.length !== 11) {
      setCustomerId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const c = await findCustomerByPhone(digits);
        if (cancelled) return;
        if (c) {
          setCustomerId(c.id);
          // Se o nome estiver vazio, preenche com o cadastrado
          if (!customerDetails.name.trim() && c.name) {
            setCustomerDetails(prev => ({ ...prev, name: c.name }));
          }
        } else {
          setCustomerId(null);
        }
      } catch (_e) {
        // silencioso
      }
    })();
    return () => { cancelled = true; };
  }, [customerDetails.phone]);
  
  // Carrega horários disponíveis (admin pode agendar qualquer horário)
  useEffect(() => {
    if (!selectedBarber || !selectedService || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      return;
    }
    
    setLoadingSlots(true);
    listAvailableTimes(selectedBarber.id, selectedDate, selectedService.duration_min)
      .then((serverSlots: string[]) => {
        // Admin pode agendar qualquer horário disponível, sem filtros de tempo mínimo
        setSlots(serverSlots);
        if (selectedTime && !serverSlots.includes(selectedTime)) {
          setSelectedTime("");
        }
      })
      .catch(() => {
        setSlots([]);
        setSelectedTime("");
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedBarber, selectedService, selectedDate]);
  
  const stepsOrder: BookingStep[] = isAdmin
    ? ["service", "barber", "datetime", "details", "confirmation"]
    : ["service", "datetime", "details", "confirmation"];

  const nextStep = () => {
    const idx = stepsOrder.indexOf(currentStep);
    if (currentStep === "details" && canProceed()) {
      setCurrentStep("confirmation");
      return;
    }
    if (idx < stepsOrder.length - 1) setCurrentStep(stepsOrder[idx + 1]);
  };

  const prevStep = () => {
    const idx = stepsOrder.indexOf(currentStep);
    if (idx > 0) setCurrentStep(stepsOrder[idx - 1]);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "service":
        return selectedService !== null;
      case "barber":
        return selectedBarber !== null;
      case "datetime":
        // Admin pode agendar qualquer data/hora, sem validações de tempo mínimo
        return !!selectedDate && !!selectedTime;
      case "details":
        return !!customerDetails.name && !!customerDetails.phone;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    
    if (!customerDetails.name.trim() || !customerDetails.phone.trim()) {
      setError("Nome e telefone do cliente são obrigatórios.");
      return;
    }
    // Telefone deve ter 11 dígitos (DDD + 9 + número)
    const phoneDigits = customerDetails.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setError("Informe um WhatsApp válido com 11 dígitos (DDD + 9 + número).");
      return;
    }
    
    const starts_at_iso = toStartsAtISO(selectedDate, selectedTime);
    if (!starts_at_iso) {
      setError("Data/hora inválidas.");
      return;
    }
    
    // Segurança extra: barbeiro não-admin só pode agendar para si mesmo
    if (!isAdmin && authenticatedBarber && selectedBarber?.id !== authenticatedBarber.id) {
      setError("Você só pode criar agendamentos para você mesmo.");
      return;
    }

    // Garante cadastro/atualização do cliente e obtém customer_id
    let ensuredCustomerId: string | undefined = customerId ?? undefined;
    try {
      const saved = await upsertCustomer({
        name: customerDetails.name.trim(),
        phone: phoneDigits,
      });
      ensuredCustomerId = saved.id;
    } catch (_e) {
      // Se falhar, segue sem customer_id (RLS pode bloquear conforme políticas)
    }

    // Admin pode agendar qualquer data/hora, incluindo passadas
    const bookingInput: CreateBookingInput = {
      service_id: selectedService.id,
      barber_id: selectedBarber.id,
      customer_name: customerDetails.name.trim(),
      phone: phoneDigits,
      customer_id: ensuredCustomerId,
      email: customerDetails.email || undefined,
      notes: customerDetails.notes || undefined,
      starts_at_iso,
      duration_min: selectedService.duration_min,
      price: selectedService.price,
      payment_method: selectedPaymentMethod,
      created_by: isAdmin ? "admin" : "barber",
    };
    
    setSubmitting(true);
    const result = await createBooking(bookingInput);
    setSubmitting(false);
    
    if (result.ok) {
      setSuccess(true);
      // Redireciona ainda mais rápido para melhorar UX em mobile
      setTimeout(() => {
        navigate("/admin");
      }, 800);
    } else {
      setError(result.message || "Erro ao criar agendamento");
    }
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case "service":
  return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-4 text-xl sm:text-2xl">
              Escolha o serviço
            </h3>
            
            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-barbershop-brown/60 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Pesquisar serviços..."
                  value={serviceSearchTerm}
                  onChange={(e) => {
                    setServiceSearchTerm(e.target.value);
                    filterServices(e.target.value);
                  }}
                  className="pl-10 bg-white border-barbershop-brown/20 text-barbershop-dark placeholder:text-barbershop-brown/60 focus:border-barbershop-gold focus:ring-barbershop-gold/20"
                />
              </div>
            </div>

            {filteredServices.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-barbershop-brown/30 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-barbershop-dark mb-2">
                  Nenhum serviço encontrado
                </h4>
                <p className="text-barbershop-brown/70">
                  Tente pesquisar com outros termos
                </p>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto md:max-h-none md:overflow-visible pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                  {filteredServices.map((service) => (
                    <Card
                      key={String(service.id)}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedService?.id === service.id
                          ? "ring-2 ring-barbershop-gold border-barbershop-gold"
                          : ""
                      }`}
                      onClick={() => setSelectedService(service)}
                    >
                      <CardHeader className="p-3 sm:p-5 md:p-6">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base sm:text-lg md:text-xl">
                            {service.name}
                          </CardTitle>
                          {service.popular && (
                            <Badge className="bg-barbershop-gold text-barbershop-dark">
                              Popular
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-5 md:p-6 pt-0">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                            <Clock className="h-3 w-3 mr-1" />
                            {service.duration_min}min
                          </div>
                          <div className="font-bold text-barbershop-brown text-base sm:text-xl">
                            R$ {service.price}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "barber":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Escolha o barbeiro
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              {barbers.map((barber) => (
                <Card
                  key={String(barber.id)}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedBarber?.id === barber.id
                      ? "ring-2 ring-barbershop-gold border-barbershop-gold"
                      : ""
                  }`}
                  onClick={() => setSelectedBarber(barber)}
                >
                  <CardContent className="p-5 sm:p-6 text-center">
                    <img
                      src={barber.photo_url || "https://via.placeholder.com/80?text=Foto"}
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
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setError(null);
                  }}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">
                  Admin pode agendar qualquer data (incluindo passadas)
                </p>
              </div>
              
              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Horário Disponível
                </Label>

                {!selectedDate || !selectedBarber || !selectedService ? (
                  <div className="text-sm text-muted-foreground">
                    Escolha o serviço, barbeiro e a data.
                  </div>
                ) : loadingSlots ? (
                  <div className="text-sm text-muted-foreground">
                    Carregando horários…
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum horário disponível neste dia.
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Admin pode agendar qualquer horário disponível
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {slots.map((time) => {
                        const isSelected = selectedTime === time;
                        return (
                          <Button
                            key={time}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(time)}
                            className={`h-9 ${
                              isSelected
                                ? "bg-barbershop-gold text-barbershop-dark"
                                : ""
                            }`}
                          >
                            {time}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "details":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Dados do cliente
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={customerDetails.name}
                  onChange={(e) => {
                    const onlyLetters = e.target.value.replace(
                      /[^a-zA-ZÀ-ÿ\s]/g,
                      ""
                    );
                    setCustomerDetails({ ...customerDetails, name: onlyLetters });
                  }}
                  placeholder="Nome completo do cliente"
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
                    setCustomerDetails({
                      ...customerDetails,
                      phone: onlyNumbers,
                    });
                  }}
                  placeholder="11999999999"
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
                  placeholder="cliente@email.com"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Input
                  id="notes"
                  value={customerDetails.notes}
                  onChange={(e) =>
                    setCustomerDetails({ ...customerDetails, notes: e.target.value })
                  }
                  placeholder="Alguma observação especial?"
                />
              </div>
              
              {/* Método de pagamento */}
              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Método de Pagamento *
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {paymentMethods.map((method) => {
                    const isSelected = selectedPaymentMethod === method.value;
                    return (
                      <Button
                        key={method.value}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPaymentMethod(method.value)}
                        className={`h-12 flex flex-col items-center gap-1 ${
                          isSelected
                            ? "bg-barbershop-gold text-barbershop-dark"
                            : ""
                        }`}
                      >
                        {method.icon}
                        <span className="text-xs">{method.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case "confirmation":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-barbershop-dark mb-2">
                Confirmar Agendamento
              </h3>
              <p className="text-muted-foreground">
                Revise os detalhes antes de confirmar
              </p>
            </div>

            <Card className="bg-barbershop-cream border-barbershop-gold/20">
              <CardContent className="p-6">
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Cliente:</span>
                    <span>
                      {customerDetails.name} ({customerDetails.phone})
                    </span>
          </div>
          
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
                        new Date(
                          selectedDate + "T00:00:00"
                        ).toLocaleDateString("pt-BR")}{" "}
                      às {selectedTime}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Duração:</span>
                    <span>{selectedService?.duration_min}min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Pagamento:</span>
                    <span>{paymentMethods.find(p => p.value === selectedPaymentMethod)?.label}</span>
                </div>
                  <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>R$ {selectedService?.price}</span>
                </div>
                </div>
              </CardContent>
            </Card>
                </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="py-12 sm:py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Título */}
        <div className="text-center mb-6 sm:mb-12">
          <h2 className="font-bold text-barbershop-dark mb-4 text-3xl sm:text-4xl md:text-5xl">
            Criar Agendamento
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            Painel Administrativo - Amauri Barbearia
                  </p>
                </div>

        {/* Alerta de erro geral */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* STEPS */}
        <div className="mb-6 sm:mb-12 px-2">
          <div className="flex items-center justify-center gap-4">
            {(() => {
              const labelByStep: Record<BookingStep, string> = {
                service: "Serviço",
                barber: "Barbeiro",
                datetime: "Data/Hora",
                details: "Dados",
                confirmation: "Confirmação",
              };
              return stepsOrder.map((stepKey, index) => {
                const currentIndex = stepsOrder.indexOf(currentStep);
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                return (
                  <div key={stepKey} className="flex items-center">
                    <div
                      className={`rounded-full flex items-center justify-center font-semibold w-6 h-6 text-xs sm:w-8 sm:h-8 sm:text-sm ${
                        isCompleted
                          ? "bg-green-500 text-white"
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
                      <div
                        className={`h-0.5 w-8 sm:w-12 ${
                          isCompleted ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                    <span className="sr-only">{labelByStep[stepKey]}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Conteúdo */}
        <Card className="mb-6 sm:mb-8">
          <CardContent className="p-4 sm:p-8">{renderStepContent()}</CardContent>
        </Card>

        {/* Navegação */}
        {currentStep !== "confirmation" ? (
          <>
            {/* Desktop / tablets */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin")}
                  className="bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl px-4 py-2.5"
                >
                  ← Voltar ao Admin
                </Button>
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === "service"}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
              </div>
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark h-11"
              >
                {currentStep === "details" ? "Revisar Agendamento" : "Continuar"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
                </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark h-11"
              >
                {currentStep === "details" ? "Revisar Agendamento" : "Continuar"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === "service"}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin")}
                  className="flex-1 bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl"
                >
                  Admin →
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep("details")}
              className="bg-white hover:bg-gray-50 text-barbershop-dark"
            >
              Editar
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
              disabled={submitting}
            >
              <Check className="h-4 w-4 mr-2" />
              {submitting ? "Criando..." : "Confirmar Agendamento"}
            </Button>
          </div>
      )}
    </div>
    </section>
  );
}



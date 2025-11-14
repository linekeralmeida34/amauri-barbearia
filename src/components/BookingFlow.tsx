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
import { Clock, ArrowLeft, ArrowRight, Check, Search, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useSearchParams } from "react-router-dom";
import { services as fallbackServices } from "@/data/services";
import {
  fetchActiveServices,
  fetchActiveBarbers,
  createBooking,
  listAvailableTimes,
  findCustomerByPhone,
  upsertCustomer,
  fetchBarberDayBlock,
  type BarberDayBlock,
  type CreateBookingResult,
  Customer,
} from "@/lib/api";
import { Combobox } from "@/components/ui/combobox";
import { joaoPessoaNeighborhoods, searchNeighborhoods } from "@/data/neighborhoods";

type BookingStep = "phone" | "customerRegistration" | "service" | "barber" | "datetime" | "details" | "confirmation";

type LocalService = {
  id: string | number;
  name: string;
  duration: number;
  price: number;
  popular?: boolean;
  commission_percentage: number;
};

type LocalBarber = {
  id: string | number;
  name: string;
  photo: string;
};

// Fallback de barbeiros (se banco estiver vazio/offline)
const fallbackBarbers: LocalBarber[] = [
  { id: 1, name: "Amauri", photo: "https://i.ibb.co/fzRKKXM0/amauri.jpg" },
  { id: 2, name: "Carlos", photo: "https://i.ibb.co/FkVP6r5d/carlos.jpg" },
  { id: 3, name: "Ronaldo", photo: "https://i.ibb.co/whs08JYs/ronaldojpg.jpg" },
];

// Fallback estático (usado só se ainda estiver com IDs locais numéricos)
// Nota: Este fallback será substituído pela função SQL que usa horário de funcionamento dinâmico
const STATIC_TIME_SLOTS = [
  // Manhã (09:00 até 11:45)
  "09:00","09:15","09:30","09:45",
  "10:00","10:15","10:30","10:45",
  "11:00","11:15","11:30","11:45",
  // Pausa para almoço (12h)
  // Tarde (13:00 até 18:00)
  "13:00","13:15","13:30","13:45",
  "14:00","14:15","14:30","14:45",
  "15:00","15:15","15:30","15:45",
  "16:00","16:15","16:30","16:45",
  "17:00","17:15","17:30","17:45",
  "18:00",
];

/* ===== Helpers de data/hora em FUSO LOCAL ===== */
function todayLocalYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTodayLocal(ymd: string): boolean {
  return ymd === todayLocalYMD();
}

function nowLocalHM(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hmGte(a: string, b: string): boolean {
  // compara "HH:MM" já zero-padded
  return a >= b;
}

function toStartsAtISO(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0); // horário local do navegador
  return dt.toISOString(); // envia UTC pro Postgres (timestamptz)
}

export const BookingFlow = () => {
  const [currentStep, setCurrentStep] = useState<BookingStep>("phone");

  // Listas vindas do banco com fallback local
  const [services, setServices] = useState<LocalService[]>(
    fallbackServices as LocalService[]
  );
  const [filteredServices, setFilteredServices] = useState<LocalService[]>(
    fallbackServices as LocalService[]
  );
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [barbers, setBarbers] = useState<LocalBarber[]>(fallbackBarbers);

  // Seleções do usuário
  const [selectedServices, setSelectedServices] = useState<LocalService[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<LocalBarber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // Estado do modal e envio
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Erros
  const [timeError, setTimeError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Slots dinâmicos
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayBlock, setDayBlock] = useState<BarberDayBlock>({ start_time: null, end_time: null });

  // Dados do cliente
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    birthDate: "",
    neighborhood: "",
  });

  // Estado para telefone e cliente
  const [phoneInput, setPhoneInput] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [filteredNeighborhoods, setFilteredNeighborhoods] = useState<string[]>(joaoPessoaNeighborhoods);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  // Filtro de bairros
  useEffect(() => {
    if (neighborhoodSearch.trim()) {
      setFilteredNeighborhoods(searchNeighborhoods(neighborhoodSearch));
    } else {
      setFilteredNeighborhoods(joaoPessoaNeighborhoods);
    }
  }, [neighborhoodSearch]);

  // Função para verificar telefone do cliente
  const handlePhoneCheck = async () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (!digits || digits.length !== 11) {
      setGlobalError("Digite um WhatsApp válido com 11 dígitos (DDD + 9 + número).");
      return;
    }

    setCheckingCustomer(true);
    setGlobalError(null);

    try {
      const foundCustomer = await findCustomerByPhone(phoneInput);
      
      if (foundCustomer) {
        // Cliente encontrado: preenche dados e vai direto para barbeiro
        setCustomer(foundCustomer);
        setCustomerDetails({
          name: foundCustomer.name,
          phone: foundCustomer.phone,
          email: "",
          notes: "",
          birthDate: formatDateFromDB(foundCustomer.birth_date),
          neighborhood: foundCustomer.neighborhood || "",
        });
        setCurrentStep("barber");
      } else {
        // Cliente não encontrado: preenche telefone e vai para cadastro
        setCustomerDetails((prev) => ({
          ...prev,
          phone: phoneInput.replace(/\D/g, ""),
        }));
        setCurrentStep("customerRegistration");
      }
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      setGlobalError("Erro ao verificar telefone. Tente novamente.");
    } finally {
      setCheckingCustomer(false);
    }
  };

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

  // Carrega do Supabase
  useEffect(() => {
    (async () => {
      try {
        const dbServices = await fetchActiveServices();
        if (dbServices.length > 0) {
          const mappedServices = dbServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            duration: s.duration_min,
            price: s.price,
            popular: s.popular,
            commission_percentage: s.commission_percentage || 100,
          }));
          setServices(mappedServices);
          setFilteredServices(mappedServices);
        }
      } catch (error) {
        console.error("Erro ao carregar serviços do banco:", error);
        // fallback já está setado
      }
      
      try {
        const dbBarbers = await fetchActiveBarbers();
        if (dbBarbers.length > 0) {
          setBarbers(
            dbBarbers.map((b: any) => ({
              id: b.id,
              name: b.name,
              photo: b.photo_url ?? "https://via.placeholder.com/80?text=Foto",
            }))
          );
        }
      } catch (error) {
        console.error("Erro ao carregar barbeiros do banco:", error);
        // fallback já está setado
      }
    })();
  }, []);

  // Sincroniza filteredServices quando services mudar
  useEffect(() => {
    setFilteredServices(services);
  }, [services]);

  // Pré-seleção via query (?servico=<id>) e pular para barbeiro
  useEffect(() => {
    const s = searchParams.get("servico");
    if (s && selectedServices.length === 0) {
      const found = services.find((sv) => String(sv.id) === s);
      if (found) {
        setSelectedServices([found]);
        setCurrentStep((prev) => (prev === "service" ? "barber" : prev));
      }
    }
  }, [searchParams, selectedServices, services]);

  // Pré-seleção via query (?barbeiro=<id>)
  useEffect(() => {
    const b = searchParams.get("barbeiro");
    if (b && !selectedBarber) {
      const found = barbers.find((bb) => String(bb.id) === b);
      if (found) setSelectedBarber(found);
    }
  }, [searchParams, selectedBarber, barbers]);

  // Garantir que a data nunca fique no passado (mobile pode permitir)
  useEffect(() => {
    if (!selectedDate) return;
    const min = todayLocalYMD();
    if (selectedDate < min) {
      setSelectedDate(min);
      setSelectedTime(""); // limpa horário se a data foi corrigida
    } else if (
      isTodayLocal(selectedDate) &&
      selectedTime &&
      !hmGte(selectedTime, nowLocalHM())
    ) {
      // Se hoje, e horário selecionado ficou no passado, limpa
      setSelectedTime("");
    }
  }, [selectedDate, selectedTime]);

  // Busca o bloqueio de horário do barbeiro para o dia selecionado
  // Importante: NÃO usa mais fallback para \"hoje\", para que bloqueios por dia da semana
  // (aplicados via faixa de datas) só afetem os dias realmente configurados no banco.
  useEffect(() => {
    if (!selectedBarber || !selectedDate) {
      setDayBlock({ start_time: null, end_time: null });
      return;
    }
    (async () => {
      try {
        const block = await fetchBarberDayBlock(String(selectedBarber.id), selectedDate);
        setDayBlock(block);
      } catch (error) {
        console.warn("[BookingFlow] Erro ao carregar bloqueio:", error);
        setDayBlock({ start_time: null, end_time: null });
      }
    })();
  }, [selectedBarber, selectedDate]);

  // Calcula duração total dos serviços selecionados
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration, 0);
  
  // Carrega SLOTS DINÂMICOS quando barbeiro + serviço + data estiverem definidos
  useEffect(() => {
    const hasUUID = (id: string | number | undefined | null) =>
      !!id && String(id).length >= 10; // heurística simples: UUID do Supabase
    const onFallbackIds =
      !hasUUID(selectedBarber?.id) || selectedServices.length === 0 || !hasUUID(selectedServices[0]?.id);

    // Sem dados básicos? limpa
    if (!selectedBarber || selectedServices.length === 0 || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      return;
    }

    // Se ainda estiver com IDs locais (fallback), usamos grade estática filtrada
    if (onFallbackIds) {
      const nowHM = nowLocalHM();
      let staticFiltered = isTodayLocal(selectedDate)
        ? STATIC_TIME_SLOTS.filter((t) => hmGte(t, nowHM))
        : STATIC_TIME_SLOTS;
      // Aplica bloqueio do dia (fechar de X até Y => remove horários >= X e <= Y)
      if (dayBlock.start_time && dayBlock.end_time) {
        staticFiltered = staticFiltered.filter((t) => {
          // Remove horários que estão dentro do intervalo bloqueado (inclusive)
          // Mantém apenas horários < start_time OU > end_time
          return !(t >= dayBlock.start_time! && t <= dayBlock.end_time!);
        });
      }
      setSlots(staticFiltered);
      if (selectedTime && !staticFiltered.includes(selectedTime)) setSelectedTime("");
      return;
    }

    // Caso normal: buscar na RPC usando duração total
    setLoadingSlots(true);
    listAvailableTimes(
      String(selectedBarber.id),
      selectedDate,
      totalDuration
    )
      .then((serverSlots: string[]) => {
        const nowHM = nowLocalHM();
        let filtered = serverSlots;
        if (isTodayLocal(selectedDate)) {
          filtered = serverSlots.filter((t) => hmGte(t, nowHM));
        }
        // Aplica bloqueio do dia (fechar de X até Y => remove horários >= X e <= Y)
        if (dayBlock.start_time && dayBlock.end_time) {
          filtered = filtered.filter((t) => {
            // Remove horários que estão dentro do intervalo bloqueado (inclusive)
            // Mantém apenas horários < start_time OU > end_time
            return !(t >= dayBlock.start_time! && t <= dayBlock.end_time!);
          });
        }
        setSlots(filtered);
        if (selectedTime && !filtered.includes(selectedTime)) setSelectedTime("");
      })
      .catch(() => {
        setSlots([]);
        setSelectedTime("");
      })
      .finally(() => setLoadingSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarber, selectedServices, selectedDate, dayBlock, totalDuration]);

  const handleSelectService = (service: LocalService) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      if (isSelected) {
        // Remove o serviço se já estiver selecionado
        const newServices = prev.filter((s) => s.id !== service.id);
        // Atualiza query params com o primeiro serviço restante (para compatibilidade)
        const sp = new URLSearchParams(searchParams);
        if (newServices.length > 0) {
          sp.set("servico", String(newServices[0].id));
        } else {
          sp.delete("servico");
        }
        setSearchParams(sp, { replace: true });
        return newServices;
      } else {
        // Adiciona o serviço
        const newServices = [...prev, service];
        // Atualiza query params com o primeiro serviço (para compatibilidade)
        const sp = new URLSearchParams(searchParams);
        sp.set("servico", String(newServices[0].id));
        setSearchParams(sp, { replace: true });
        return newServices;
      }
    });
  };

  const handleSelectBarber = (barber: LocalBarber) => {
    setSelectedBarber(barber);
    const sp = new URLSearchParams(searchParams);
    sp.set("barbeiro", String(barber.id));
    setSearchParams(sp, { replace: true });
  };

  const stepsOrder: BookingStep[] = [
    "phone",
    "customerRegistration",
    "service",
    "barber",
    "datetime",
    "details",
    "confirmation",
  ];

  const nextStep = () => {
    const idx = stepsOrder.indexOf(currentStep);
    // Se o usuário entrou pelo passo de Barbeiro (fluxo quando o telefone já existe)
    // e ainda não escolheu o serviço, levamos para o passo de serviço antes da data/hora
    if (currentStep === "barber" && selectedServices.length === 0) {
      setCurrentStep("service");
      return;
    }
    // Se está no passo de serviço e já tem barbeiro selecionado, vai direto para datetime
    if (currentStep === "service" && selectedBarber) {
      setCurrentStep("datetime");
      return;
    }
    if (currentStep === "datetime" && canProceed()) {
      // Vai direto para o modal de confirmação após selecionar data/hora
      setShowConfirmationModal(true);
      return;
    }
    if (currentStep === "customerRegistration" && canProceed()) {
      // Salva o cliente antes de continuar
      handleSaveCustomer();
      return;
    }
    if (idx < stepsOrder.length - 1) setCurrentStep(stepsOrder[idx + 1]);
  };

  const prevStep = () => {
    const idx = stepsOrder.indexOf(currentStep);
    if (idx > 0) {
      // Se voltar do barbeiro para phone, limpa o cliente
      if (currentStep === "barber" && stepsOrder[idx - 1] === "phone") {
        setCustomer(null);
        setPhoneInput("");
      }
      setCurrentStep(stepsOrder[idx - 1]);
    }
  };

  // Função para formatar data DD/MM/YYYY para YYYY-MM-DD
  const formatDateForDB = (dateStr: string): string | null => {
    if (!dateStr) return null;
    // Remove tudo que não é número
    const digits = dateStr.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    
    // Valida a data
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > new Date().getFullYear()) {
      return null;
    }
    
    // Verifica se a data é válida
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
      return null;
    }
    
    // Verifica se não é data futura
    if (date > new Date()) {
      return null;
    }
    
    return `${year}-${month}-${day}`;
  };

  // Função para formatar input de data DD/MM/YYYY
  const formatDateInput = (value: string): string => {
    // Remove tudo que não é número
    const digits = value.replace(/\D/g, "").slice(0, 8);
    
    if (digits.length === 0) return "";
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  // Função para converter YYYY-MM-DD para DD/MM/YYYY
  const formatDateFromDB = (dateStr: string | null): string => {
    if (!dateStr) return "";
    // Se já está no formato DD/MM/YYYY, retorna como está
    if (dateStr.includes("/")) return dateStr;
    // Converte de YYYY-MM-DD para DD/MM/YYYY
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return "";
  };

  // Função para salvar cliente antes de continuar
  const handleSaveCustomer = async () => {
    if (!customerDetails.name.trim() || !customerDetails.phone.trim()) {
      setGlobalError("Nome e telefone são obrigatórios.");
      return;
    }
    
    if (!customerDetails.birthDate || !formatDateForDB(customerDetails.birthDate)) {
      setGlobalError("Data de nascimento é obrigatória e deve estar no formato DD/MM/YYYY.");
      return;
    }
    
    if (!customerDetails.neighborhood?.trim()) {
      setGlobalError("Bairro é obrigatório.");
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    try {
      const birthDateFormatted = formatDateForDB(customerDetails.birthDate);
      if (!birthDateFormatted) {
        setGlobalError("Data de nascimento inválida. Use o formato DD/MM/YYYY.");
        return;
      }

      const savedCustomer = await upsertCustomer({
        name: customerDetails.name,
        phone: customerDetails.phone,
        birth_date: birthDateFormatted,
        neighborhood: customerDetails.neighborhood.trim(),
      });

      setCustomer(savedCustomer);
      setCurrentStep("service");
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      setGlobalError("Erro ao salvar dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmBooking = async () => {
    setShowConfirmationModal(false);
    setTimeError(null);
    setGlobalError(null);

    if (selectedServices.length === 0 || !selectedBarber || !selectedDate || !selectedTime) {
      setGlobalError("Selecione pelo menos um serviço, barbeiro, data e horário.");
      return;
    }

    // trava extra: não deixa marcar passado (mesmo que o usuário force)
    const minDate = todayLocalYMD();
    const nowHM = nowLocalHM();
    if (selectedDate < minDate) {
      setGlobalError("Escolha uma data a partir de hoje.");
      return;
    }
    if (isTodayLocal(selectedDate) && !hmGte(selectedTime, nowHM)) {
      setGlobalError("Escolha um horário a partir do horário atual.");
      return;
    }

    const starts_at_iso = toStartsAtISO(selectedDate, selectedTime);
    if (!starts_at_iso) {
      setGlobalError("Data/hora inválidas.");
      return;
    }
    if (new Date(starts_at_iso).getTime() <= Date.now()) {
      setGlobalError("Escolha um horário no futuro.");
      return;
    }

    setSubmitting(true);
    
    // Cria um booking para cada serviço selecionado, sequencialmente
    let currentStartTime = new Date(starts_at_iso);
    let allSuccess = true;
    let lastError: CreateBookingResult | null = null;

    for (const service of selectedServices) {
      const serviceStartISO = currentStartTime.toISOString();
      
      const res = await createBooking({
        service_id: service.id,
        barber_id: selectedBarber.id,
        customer_name: customerDetails.name.trim(),
        phone: customerDetails.phone.trim(),
        customer_id: customer?.id || undefined,
        email: customerDetails.email || undefined,
        notes: customerDetails.notes || undefined,
        starts_at_iso: serviceStartISO,
        duration_min: service.duration,
        price: Number(service.price),
        created_by: "client",
      });

      if (!res.ok) {
        allSuccess = false;
        lastError = res;
        break;
      }

      // Próximo serviço começa quando o anterior termina
      currentStartTime = new Date(currentStartTime.getTime() + service.duration * 60 * 1000);
    }

    setSubmitting(false);

    if (allSuccess) {
      setCurrentStep("confirmation");
      return;
    }
    
    if (lastError?.reason === "CONFLICT") {
      setCurrentStep("datetime");
      setTimeError(lastError.message);
      return;
    }
    setGlobalError(lastError?.message || "Erro ao criar agendamento.");
  };

  const canProceed = () => {
    switch (currentStep) {
      case "phone":
        return phoneInput.replace(/\D/g, "").length === 11;
      case "customerRegistration":
        if (!customerDetails.name.trim() || !customerDetails.phone.trim()) return false;
        if (!customerDetails.birthDate || !formatDateForDB(customerDetails.birthDate)) return false;
        if (!customerDetails.neighborhood?.trim()) return false;
        return true;
      case "service":
        return selectedServices.length > 0;
      case "barber":
        return selectedBarber !== null;
      case "datetime": {
        if (!selectedDate || !selectedTime) return false;
        const minDate = todayLocalYMD();
        const nowHM = nowLocalHM();
        if (selectedDate < minDate) return false;
        if (isTodayLocal(selectedDate) && !hmGte(selectedTime, nowHM)) return false;
        return true;
      }
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "phone":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Digite seu número de telefone
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone-input">WhatsApp *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-barbershop-brown/60 w-4 h-4" />
                  <Input
                    id="phone-input"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const normalized =
                        digits.length > 11 ? digits.slice(digits.length - 11) : digits;
                      setPhoneInput(normalized);
                      setGlobalError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canProceed()) {
                        handlePhoneCheck();
                      }
                    }}
                    placeholder="83999999999"
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas números, sem espaços ou caracteres especiais.
                </p>
              </div>
              {checkingCustomer && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Verificando...</p>
                </div>
              )}
            </div>
          </div>
        );

      case "customerRegistration":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Complete seu cadastro
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
                  placeholder="Seu nome completo"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="phone-reg">WhatsApp *</Label>
                <Input
                  id="phone-reg"
                  inputMode="numeric"
                  value={customerDetails.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const normalized =
                      digits.length > 11 ? digits.slice(digits.length - 11) : digits;
                    setCustomerDetails({
                      ...customerDetails,
                      phone: normalized,
                    });
                  }}
                  placeholder="83999999999"
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este número já foi preenchido automaticamente.
                </p>
              </div>
              <div>
                <Label htmlFor="birth-date">Data de nascimento *</Label>
                <Input
                  id="birth-date"
                  inputMode="numeric"
                  value={customerDetails.birthDate}
                  onChange={(e) => {
                    const formatted = formatDateInput(e.target.value);
                    setCustomerDetails({ ...customerDetails, birthDate: formatted });
                    setGlobalError(null);
                  }}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: DD/MM/AAAA (ex: 21/04/1990)
                </p>
                {customerDetails.birthDate && !formatDateForDB(customerDetails.birthDate) && (
                  <p className="text-xs text-red-600 mt-1">
                    Data inválida. Verifique o formato e se a data não é futura.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="neighborhood">Bairro (João Pessoa) *</Label>
                <Combobox
                  options={filteredNeighborhoods}
                  value={customerDetails.neighborhood || undefined}
                  onValueChange={(value) => {
                    setCustomerDetails({ ...customerDetails, neighborhood: value });
                    setNeighborhoodSearch("");
                    setGlobalError(null);
                  }}
                  placeholder="Selecione ou pesquise seu bairro *"
                  searchPlaceholder="Pesquisar bairro..."
                  emptyMessage="Nenhum bairro encontrado."
                />
                {!customerDetails.neighborhood && (
                  <p className="text-xs text-red-600 mt-1">
                    Este campo é obrigatório
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "service":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-4 text-xl sm:text-2xl">
              Escolha seu{selectedServices.length > 0 ? "s" : ""} serviço{selectedServices.length > 0 ? "s" : ""}
            </h3>
            {selectedServices.length > 0 && (
              <div className="mb-4 p-3 bg-barbershop-gold/10 rounded-md border border-barbershop-gold/20">
                <p className="text-sm font-semibold text-barbershop-dark mb-2">
                  {selectedServices.length} serviço{selectedServices.length > 1 ? "s" : ""} selecionado{selectedServices.length > 1 ? "s" : ""}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedServices.map((service) => (
                    <Badge key={service.id} className="bg-barbershop-gold text-barbershop-dark">
                      {service.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Duração total: {totalDuration}min | Total: R$ {selectedServices.reduce((sum, s) => sum + Number(s.price), 0).toFixed(2)}
                </p>
              </div>
            )}
            
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
                  {filteredServices.map((service) => {
                  const isSelected = selectedServices.some((s) => s.id === service.id);
                  return (
                  <Card
                    key={String(service.id)}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? "ring-2 ring-barbershop-gold border-barbershop-gold"
                        : ""
                    }`}
                    onClick={() => handleSelectService(service)}
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
                          {service.duration}min
                        </div>
                        <div className="font-bold text-barbershop-brown text-base sm:text-xl">
                          R$ {service.price}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                </div>
              </div>
            )}
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
                  key={String(barber.id)}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedBarber?.id === barber.id
                      ? "ring-2 ring-barbershop-gold border-barbershop-gold"
                      : ""
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

      case "datetime": {
        const min = todayLocalYMD();
        const nowHMVal = nowLocalHM();
        const hasBasics = !!selectedDate && !!selectedBarber && selectedServices.length > 0;
        const effectiveSlots = slots; // já vem filtrado (RPC + filtro de "hoje")

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
                  min={min}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setTimeError(null);
                  }}
                  className="mb-2"
                />
                {!selectedDate && (
                  <p className="text-xs text-muted-foreground">
                    Selecione uma data para ver horários.
                  </p>
                )}
              </div>

              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Horário Disponível
                </Label>

                {!hasBasics ? (
                  <div className="text-sm text-muted-foreground">
                    Escolha o serviço, barbeiro e a data.
                  </div>
                ) : loadingSlots ? (
                  <div className="text-sm text-muted-foreground">
                    Carregando horários…
                  </div>
                ) : effectiveSlots.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum horário disponível neste dia.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {effectiveSlots.map((time) => {
                      const disabled =
                        !selectedDate ||
                        (isTodayLocal(selectedDate) && !hmGte(time, nowHMVal));
                      const isSelected = selectedTime === time;
                      return (
                        <Button
                          key={time}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => !disabled && setSelectedTime(time)}
                          disabled={disabled}
                          className={`h-9 ${
                            isSelected
                              ? "bg-barbershop-gold text-barbershop-dark"
                              : ""
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {time}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {timeError && (
                  <p className="text-sm text-red-600 mt-2">{timeError}</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case "details":
        return (
          <div>
            <h3 className="font-bold text-barbershop-dark mb-6 text-2xl">
              Seus dados
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
                    const digits = e.target.value.replace(/\D/g, "");
                    const normalized =
                      digits.length > 11 ? digits.slice(digits.length - 11) : digits;
                    setCustomerDetails({
                      ...customerDetails,
                      phone: normalized,
                    });
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
              <p className="text-muted-foreground">
                Seu horário foi reservado com sucesso.
              </p>
            </div>

            <Card className="bg-barbershop-cream border-barbershop-gold/20">
              <CardContent className="p-6">
                <div className="space-y-3 text-left">
                  {/* AJUSTE 2: Cliente na tela final de confirmação */}
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Cliente:</span>
                    <span>
                      {customerDetails.name} ({customerDetails.phone})
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="font-semibold">Serviço{selectedServices.length > 1 ? "s" : ""}:</span>
                    <div className="text-right">
                      {selectedServices.map((service, idx) => (
                        <div key={service.id}>
                          {service.name} ({service.duration}min) - R$ {service.price}
                        </div>
                      ))}
                    </div>
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
                    <span className="font-semibold">Duração Total:</span>
                    <span>{totalDuration}min</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>R$ {selectedServices.reduce((sum, s) => sum + Number(s.price), 0).toFixed(2)}</span>
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
    <section className="py-12 sm:py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Título */}
        <div className="text-center mb-6 sm:mb-12">
          <h2 className="font-bold text-barbershop-dark mb-4 text-3xl sm:text-4xl md:text-5xl">
            Amauri Barbearia
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            Simples, rápido e conveniente
          </p>
        </div>

        {/* Alerta de erro geral */}
        {globalError && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
            {globalError}
          </div>
        )}

        {/* STEPS */}
        <div className="mb-6 sm:mb-12 px-2">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {(() => {
              // Define steps visuais baseado no estado atual
              const visualSteps: { label: string; step: BookingStep }[] = [];
              
              if (currentStep === "phone" || currentStep === "customerRegistration") {
                // No início, mostra apenas "Telefone" ou "Cadastro"
                visualSteps.push(
                  { label: "Telefone", step: "phone" },
                  { label: "Cadastro", step: "customerRegistration" }
                );
              } else {
                // Após cadastro, mostra os steps principais
                visualSteps.push(
                  { label: "Serviço", step: "service" },
                  { label: "Barbeiro", step: "barber" },
                  { label: "Data/Hora", step: "datetime" },
                  { label: "Confirmação", step: "confirmation" }
                );
                // Remove "details" do fluxo visual
              }

              return visualSteps.map((visualStep, index) => {
                const currentIndex = visualSteps.findIndex(s => s.step === currentStep);
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                return (
                  <div key={visualStep.step} className="flex items-center">
                    <div
                      className={`rounded-full flex items-center justify-center font-semibold w-6 h-6 text-xs sm:w-8 sm:h-8 sm:text-sm ${
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
                    {index < visualSteps.length - 1 && (
                      <div
                        className={`h-0.5 w-8 sm:w-12 ${
                          isCompleted ? "bg-success" : "bg-muted"
                        }`}
                      />
                    )}
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
                  asChild
                  className="bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl px-4 py-2.5"
                >
                  <Link to="/#hero" aria-label="Voltar ao início">
                    ← Início
                  </Link>
                </Button>
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === "phone"}
                  >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
              </div>
              <Button
                onClick={currentStep === "phone" ? handlePhoneCheck : nextStep}
                disabled={!canProceed() || checkingCustomer || submitting}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark h-11"
              >
                {currentStep === "phone" 
                  ? (checkingCustomer ? "Verificando..." : "Verificar")
                  : currentStep === "customerRegistration"
                  ? (submitting ? "Salvando..." : "Continuar")
                  : currentStep === "datetime"
                  ? "Revisar Agendamento"
                  : "Continuar"}
                {currentStep !== "phone" && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              <Button
                onClick={currentStep === "phone" ? handlePhoneCheck : nextStep}
                disabled={!canProceed() || checkingCustomer || submitting}
                className="w-full bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark h-11"
              >
                {currentStep === "phone" 
                  ? (checkingCustomer ? "Verificando..." : "Verificar")
                  : currentStep === "customerRegistration"
                  ? (submitting ? "Salvando..." : "Continuar")
                  : currentStep === "datetime"
                  ? "Revisar Agendamento"
                  : "Continuar"}
                {currentStep !== "phone" && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === "phone"}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button
                  asChild
                  className="flex-1 bg-[#F4D06F] hover:bg-[#E9C85F] text-[#1A1A1A] font-semibold rounded-xl"
                >
                  <Link to="/#hero" aria-label="Voltar ao início">
                    Início →
                  </Link>
                </Button>
              </div>
            </div>
          </>
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

        {/* Modal de confirmação */}
        <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
          <DialogContent
            className="sm:max-w-[425px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Confirmar Agendamento</DialogTitle>
              <DialogDescription>
                Revise os detalhes do seu agendamento na Amauri Barbearia
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 items-start gap-4">
                <Label className="font-semibold text-right">Serviço{selectedServices.length > 1 ? "s" : ""}:</Label>
                <div className="col-span-2">
                  {selectedServices.map((service) => (
                    <div key={service.id} className="mb-1">
                      {service.name} ({service.duration}min) - R$ {service.price}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Barbeiro:</Label>
                <div className="col-span-2">{selectedBarber?.name}</div>
              </div>

              {/* AJUSTE 1: Cliente no Dialog de confirmação */}
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Cliente:</Label>
                <div className="col-span-2">
                  {customerDetails.name} ({customerDetails.phone})
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Data/Hora:</Label>
                <div className="col-span-2">
                  {selectedDate &&
                    new Date(
                      selectedDate + "T00:00:00"
                    ).toLocaleDateString("pt-BR")}{" "}
                  às {selectedTime}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Duração Total:</Label>
                <div className="col-span-2">{totalDuration}min</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="font-semibold text-right">Total:</Label>
                <div className="col-span-2 font-bold">
                  R$ {selectedServices.reduce((sum, s) => sum + Number(s.price), 0).toFixed(2)}
                </div>
              </div>

              <div className="mt-2 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Política de Cancelamento:</strong> Em respeito a todos os nossos clientes, 
                  atrasos serão tolerados até 10 minutos
                  após o horário marcado, orientamos aviso com no mínimo 1h de antecedência.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-3 sm:gap-4 pt-2 flex-col-reverse sm:flex-row">
              <Button variant="outline" onClick={() => setShowConfirmationModal(false)}>
                Editar
              </Button>
              <Button
                onClick={confirmBooking}
                className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark"
                autoFocus
                disabled={submitting}
              >
                <Check className="h-4 w-4 mr-2" />
                {submitting ? "Confirmando..." : "Confirmar Agendamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default BookingFlow;

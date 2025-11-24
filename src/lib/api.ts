// src/lib/api.ts
import { supabase } from "./supabase";

/* =========================
   Tipos
========================= */
export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;           // numeric -> number
  category: string | null;
  popular: boolean;
  is_active: boolean;
  deleted_at: string | null;
  commission_percentage: number;
};

export type Barber = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  rating: number | null;   // numeric -> number | null
  reviews: number | null;  // int -> number | null
  is_active: boolean;
  instagram?: string | null;
  specialties?: string[] | null;
  deleted_at: string | null;
};

export type PaymentMethod = "credit_card" | "debit_card" | "cash" | "pix" | "voucher";

/* =========================
   Customers
========================= */
export type Customer = {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  neighborhood: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerInput = {
  name: string;
  phone: string;
  birth_date?: string; // YYYY-MM-DD
  neighborhood?: string;
};

/** Busca cliente por telefone (normalizado) */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle();

  if (error) {
    // Se a tabela não existir ainda, retorna null
    if (error.message?.includes("does not exist") || error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) return null;

  return {
    id: String(data.id),
    name: data.name ?? "",
    phone: data.phone ?? "",
    birth_date: data.birth_date ?? null,
    neighborhood: data.neighborhood ?? null,
    created_at: data.created_at ?? "",
    updated_at: data.updated_at ?? "",
  };
}

/** Cria ou atualiza um cliente */
export async function upsertCustomer(input: CreateCustomerInput): Promise<Customer> {
  const normalized = normalizePhone(input.phone);
  if (!normalized) {
    throw new Error("Telefone inválido");
  }

  const payload: any = {
    name: input.name.trim(),
    phone: normalized,
    updated_at: new Date().toISOString(),
  };

  if (input.birth_date) {
    payload.birth_date = input.birth_date;
  }

  if (input.neighborhood) {
    payload.neighborhood = input.neighborhood.trim();
  }

  const { data, error } = await supabase
    .from("customers")
    .upsert(payload, {
      onConflict: "phone",
      returning: "representation",
    })
    .select()
    .single();

  if (error) {
    // Se a tabela não existir ainda, simula sucesso mas não persiste
    if (error.message?.includes("does not exist") || error.code === "PGRST116") {
      console.warn("[upsertCustomer] Tabela customers não existe ainda. Execute o script SQL.");
      return {
        id: "temp",
        name: input.name,
        phone: normalized,
        birth_date: input.birth_date || null,
        neighborhood: input.neighborhood || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw error;
  }

  return {
    id: String(data.id),
    name: data.name ?? "",
    phone: data.phone ?? "",
    birth_date: data.birth_date ?? null,
    neighborhood: data.neighborhood ?? null,
    created_at: data.created_at ?? "",
    updated_at: data.updated_at ?? "",
  };
}

/* =========================
   Services
========================= */
export async function fetchActiveServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at,commission_percentage")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    // Se der erro por causa da coluna commission_percentage, tenta sem ela
    if (error.message?.includes("commission_percentage")) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("services")
        .select("id,name,description,duration_min,price,category,popular,is_active,deleted_at")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (fallbackError) throw fallbackError;

      return (fallbackData ?? []).map((s: any) => ({
        id: String(s.id),
        name: s.name ?? "",
        description: s.description ?? null,
        duration_min: Number(s.duration_min ?? 0),
        price: Number(s.price ?? 0),
        category: s.category ?? null,
        popular: !!s.popular,
        is_active: !!s.is_active,
        deleted_at: s.deleted_at ?? null,
        commission_percentage: 100, // valor padrão
      })) as Service[];
    }
    throw error;
  }

  return (data ?? []).map((s: any) => ({
    id: String(s.id),
    name: s.name ?? "",
    description: s.description ?? null,
    duration_min: Number(s.duration_min ?? 0),
    price: Number(s.price ?? 0),
    category: s.category ?? null,
    popular: !!s.popular,
    is_active: !!s.is_active,
    deleted_at: s.deleted_at ?? null,
    commission_percentage: Number(s.commission_percentage ?? 100),
  })) as Service[];
}

/* =========================
   Barbers
========================= */
export async function fetchActiveBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select(
      "id,name,photo_url,bio,rating,reviews,is_active,instagram,specialties,deleted_at"
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((b: any) => ({
    id: String(b.id),
    name: b.name ?? "",
    photo_url: b.photo_url ?? null,
    bio: b.bio ?? null,
    rating: b.rating == null ? null : Number(b.rating),
    reviews: b.reviews == null ? null : Number(b.reviews),
    is_active: !!b.is_active,
    instagram: b.instagram ?? null,
    specialties: Array.isArray(b.specialties) ? b.specialties : null,
    deleted_at: b.deleted_at ?? null,
  })) as Barber[];
}

/* =========================
   Helpers (mapas p/ pré-seleção)
========================= */
export async function fetchServicesMap(): Promise<Map<string, Service>> {
  const list = await fetchActiveServices();
  const map = new Map<string, Service>();
  for (const s of list) map.set(String(s.id), s);
  return map;
}

export async function fetchBarbersMap(): Promise<Map<string, Barber>> {
  const list = await fetchActiveBarbers();
  const map = new Map<string, Barber>();
  for (const b of list) map.set(String(b.id), b);
  return map;
}

/* =========================
   Criação de agendamento
========================= */
export type CreateBookingInput = {
  service_id: string | number; // aceito number no fallback, mas valido abaixo
  barber_id:  string | number;

  customer_name: string;
  phone: string;               // WhatsApp do cliente -> salvo em "phone"
  customer_id?: string;        // ID do cliente na tabela customers (UUID)

  email?: string;              // (não salvo por enquanto)
  notes?: string;              // (não salvo por enquanto)

  starts_at_iso: string;       // ex.: new Date(...).toISOString()
  duration_min: number;
  price: number;
  payment_method?: PaymentMethod; // Forma de pagamento opcional
  created_by?: "client" | "barber" | "admin"; // Origem da criação do agendamento
  created_by_barber_id?: string; // ID do barbeiro que criou o agendamento (quando created_by = "barber")
};

export type CreateBookingResult =
  | { ok: true }
  | { ok: false; reason: "CONFLICT" | "VALIDATION" | "UNKNOWN"; message: string };

export type UpdateBookingInput = {
  booking_id: string;
  customer_name?: string;
  phone?: string;
  starts_at_iso?: string;
  service_id?: string;
  barber_id?: string;
  price?: number;
  payment_method?: PaymentMethod | null;
  status?: "pending" | "confirmed" | "canceled";
};

/** Normaliza telefone BR para 11 dígitos (DDD + 9 + número).
 *  - Remove tudo que não for número
 *  - Se vier com código do país (+55...), mantém apenas os ÚLTIMOS 11 dígitos
 *    (ex.: "+55 (83) 9..." -> "8399...")
 */
export function normalizePhone(brPhone: string | null | undefined) {
  if (!brPhone) return null;
  const digits = brPhone.replace(/\D/g, "");
  if (!digits.length) return null;
  // Se tiver mais de 11 dígitos (ex.: com +55 na frente), pega apenas os últimos 11
  if (digits.length > 11) {
    return digits.slice(digits.length - 11);
  }
  return digits;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  // Valida IDs (espera UUID vindo do banco). Se vier fallback numérico curto, bloqueia.
  const svcId = String(input.service_id);
  const brbId = String(input.barber_id);
  if (svcId.length < 10 || brbId.length < 10) {
    return {
      ok: false,
      reason: "VALIDATION",
      message: "Selecione um serviço e um barbeiro válidos do sistema.",
    };
  }

  // Campos mínimos
  if (!input.customer_name?.trim() || !input.phone?.trim()) {
    return { ok: false, reason: "VALIDATION", message: "Nome e WhatsApp são obrigatórios." };
  }
  // Validação de telefone BR (11 dígitos)
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone || normalizedPhone.length !== 11) {
    return { ok: false, reason: "VALIDATION", message: "Informe um WhatsApp válido com 11 dígitos (DDD + 9 + número)." };
  }
  if (!input.starts_at_iso || isNaN(Date.parse(input.starts_at_iso))) {
    return { ok: false, reason: "VALIDATION", message: "Data/hora inválidas." };
  }
  if (!input.duration_min || input.duration_min <= 0) {
    return { ok: false, reason: "VALIDATION", message: "Duração inválida." };
  }

  // Payload compatível com a tabela "bookings"
  const payload: any = {
    service_id: svcId,
    barber_id: brbId,
    starts_at: input.starts_at_iso,                    // timestamptz (UTC)
    duration_min: Math.round(input.duration_min),
    price: Number(input.price),
    status: "pending" as const,
    customer_name: input.customer_name.trim(),
    phone: normalizedPhone,
    payment_method: input.payment_method || null,      // Forma de pagamento
    created_by: (input.created_by || "client") as "client" | "barber" | "admin",
  };

  // Adiciona customer_id se fornecido (UUID válido, não "temp")
  if (input.customer_id && 
      String(input.customer_id).length >= 10 && 
      input.customer_id !== "temp") {
    payload.customer_id = String(input.customer_id);
  }

  // Adiciona created_by_barber_id se o agendamento foi criado por um barbeiro
  if (input.created_by === "barber" && input.created_by_barber_id) {
    const barberCreatorId = String(input.created_by_barber_id);
    if (barberCreatorId.length >= 10) { // Valida UUID
      payload.created_by_barber_id = barberCreatorId;
    }
  }

  // returning: "minimal" evita SELECT no retorno (útil quando RLS é mais restrita)
  const { error } = await supabase
    .from("bookings")
    .insert([payload], { returning: "minimal" });

  if (!error) return { ok: true };

  // Tratamento de conflito (constraint de overlap)
  const code = (error as any)?.code || "";
  const msg = (error as any)?.message?.toLowerCase?.() || "";
  const details = (error as any)?.details?.toLowerCase?.() || "";

  const looksLikeConflict =
    code === "23P01" ||
    msg.includes("bookings_no_overlap") ||
    details.includes("bookings_no_overlap") ||
    msg.includes("overlap") ||
    details.includes("overlap");

  if (looksLikeConflict) {
    return {
      ok: false,
      reason: "CONFLICT",
      message: "Esse horário já foi reservado para este barbeiro. Escolha outro horário.",
    };
  }

  console.error("[createBooking] insert error:", error);
  return {
    ok: false,
    reason: "UNKNOWN",
    message: "Não foi possível concluir o agendamento. Tente novamente.",
  };
}

/**
 * Atualiza um agendamento existente
 */
export async function updateBooking(input: UpdateBookingInput): Promise<CreateBookingResult> {
  if (!input.booking_id) {
    return { ok: false, reason: "VALIDATION", message: "ID do agendamento é obrigatório." };
  }

  const payload: any = {};

  // Atualiza apenas os campos fornecidos
  if (input.customer_name !== undefined) {
    payload.customer_name = input.customer_name.trim();
  }
  
  if (input.phone !== undefined) {
    const normalizedPhone = normalizePhone(input.phone);
    if (normalizedPhone && normalizedPhone.length !== 11) {
      return { ok: false, reason: "VALIDATION", message: "Informe um WhatsApp válido com 11 dígitos (DDD + 9 + número)." };
    }
    payload.phone = normalizedPhone;
  }

  if (input.starts_at_iso !== undefined) {
    if (!input.starts_at_iso || isNaN(Date.parse(input.starts_at_iso))) {
      return { ok: false, reason: "VALIDATION", message: "Data/hora inválidas." };
    }
    payload.starts_at = input.starts_at_iso;
  }

  if (input.service_id !== undefined) {
    const svcId = String(input.service_id);
    if (svcId.length < 10) {
      return { ok: false, reason: "VALIDATION", message: "Selecione um serviço válido." };
    }
    payload.service_id = svcId;
  }

  if (input.barber_id !== undefined) {
    const brbId = String(input.barber_id);
    if (brbId.length < 10) {
      return { ok: false, reason: "VALIDATION", message: "Selecione um barbeiro válido." };
    }
    payload.barber_id = brbId;
  }

  if (input.price !== undefined) {
    payload.price = Number(input.price);
  }

  if (input.payment_method !== undefined) {
    payload.payment_method = input.payment_method || null;
  }

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  // Se não há nada para atualizar
  if (Object.keys(payload).length === 0) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("id", input.booking_id);

  if (!error) return { ok: true };

  // Tratamento de conflito (constraint de overlap)
  const code = (error as any)?.code || "";
  const msg = (error as any)?.message?.toLowerCase?.() || "";
  const details = (error as any)?.details?.toLowerCase?.() || "";

  const looksLikeConflict =
    code === "23P01" ||
    msg.includes("bookings_no_overlap") ||
    details.includes("bookings_no_overlap") ||
    msg.includes("overlap") ||
    details.includes("overlap");

  if (looksLikeConflict) {
    return {
      ok: false,
      reason: "CONFLICT",
      message: "Esse horário já foi reservado para este barbeiro. Escolha outro horário.",
    };
  }

  console.error("[updateBooking] update error:", error);
  return {
    ok: false,
    reason: "UNKNOWN",
    message: "Não foi possível atualizar o agendamento. Tente novamente.",
  };
}

/* =========================
   Horários disponíveis (RPC) - COM CACHE E TIMEOUT
========================= */

// Cache simples em memória (expira após 2 minutos)
const availableTimesCache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos
const RPC_TIMEOUT = 10000; // 10 segundos

function getCacheKey(barberId: string, dayYMD: string, durationMin: number): string {
  return `${barberId}-${dayYMD}-${durationMin}`;
}

function getCachedTimes(barberId: string, dayYMD: string, durationMin: number): string[] | null {
  const key = getCacheKey(barberId, dayYMD, durationMin);
  const cached = availableTimesCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Remove entrada expirada
  if (cached) {
    availableTimesCache.delete(key);
  }
  
  return null;
}

function setCachedTimes(barberId: string, dayYMD: string, durationMin: number, data: string[]): void {
  const key = getCacheKey(barberId, dayYMD, durationMin);
  availableTimesCache.set(key, { data, timestamp: Date.now() });
}

// Limpa cache antigo periodicamente (evita vazamento de memória)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of availableTimesCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL) {
        availableTimesCache.delete(key);
      }
    }
  }, 60000); // Limpa a cada 1 minuto
}

export async function listAvailableTimes(
  barberId: string | number,
  dayYMD: string,      // "YYYY-MM-DD"
  durationMin: number
): Promise<string[]> {
  const id = String(barberId);
  if (!dayYMD || !durationMin || durationMin <= 0) return [];
  // Se ainda estiver no fallback (ex.: 1, 2, 3), não chama a RPC (ela espera UUID)
  if (id.length < 10) return [];

  // Verifica cache primeiro
  const cached = getCachedTimes(id, dayYMD, durationMin);
  if (cached !== null) {
    return cached;
  }

  // Cria promise com timeout
  const rpcPromise = supabase.rpc("list_available_times", {
    p_barber_id: id,
    p_day: dayYMD,
    p_duration_min: durationMin,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout: A requisição demorou muito para responder")), RPC_TIMEOUT);
  });

  try {
    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) throw error;

    // data = [{ slot: "HH:MM" }, ...]
    const slots = (data ?? []).map((r: any) => r.slot);
    
    // Salva no cache
    setCachedTimes(id, dayYMD, durationMin, slots);
    
    return slots;
  } catch (err: any) {
    // Se for timeout, tenta retornar cache mesmo que expirado (melhor que nada)
    const expiredCache = availableTimesCache.get(getCacheKey(id, dayYMD, durationMin));
    if (expiredCache) {
      console.warn("[listAvailableTimes] Timeout, usando cache expirado:", err.message);
      return expiredCache.data;
    }
    throw err;
  }
}

// Função para limpar cache manualmente (útil após criar/cancelar agendamento)
export function clearAvailableTimesCache(barberId?: string, dayYMD?: string): void {
  if (barberId && dayYMD) {
    // Limpa cache específico
    for (const key of availableTimesCache.keys()) {
      if (key.startsWith(`${barberId}-${dayYMD}-`)) {
        availableTimesCache.delete(key);
      }
    }
  } else {
    // Limpa todo o cache
    availableTimesCache.clear();
  }
}

/* =========================
   Fechamento de horários por dia (Admin) - Intervalo
========================= */

export type BarberDayBlock = {
  start_time: string | null; // "HH:MM" ou null
  end_time: string | null;   // "HH:MM" ou null
};

export type BarberDayBlockItem = {
  id: string;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  day: string | null;
  is_global: boolean;
  created_at: string;
};

/**
 * Obtém o intervalo de bloqueio (start_time e end_time) para um barbeiro em um dia específico.
 * Retorna { start_time: null, end_time: null } se não houver fechamento configurado.
 * Implementado via RPC 'get_barber_day_block(p_barber_id, p_day)'.
 */
export async function fetchBarberDayBlock(
  barberId: string,
  dayYMD: string
): Promise<BarberDayBlock> {
  if (!barberId || !dayYMD) return { start_time: null, end_time: null };
  try {
    const { data, error } = await supabase.rpc("get_barber_day_block", {
      p_barber_id: String(barberId),
      p_day: dayYMD,
    });
    if (error) {
      console.warn("[fetchBarberDayBlock] RPC ausente ou falhou:", error.message);
      // Fallback: tenta a RPC antiga (cutoff)
      try {
        const { data: oldData } = await supabase.rpc("get_barber_day_cutoff", {
          p_barber_id: String(barberId),
          p_day: dayYMD,
        });
        if (oldData) {
          const cutoff = typeof oldData === "string" ? oldData : (oldData?.cutoff || oldData?.cutoff_hhmm);
          if (cutoff && typeof cutoff === "string") {
            const hhmm = cutoff.slice(0, 5);
            if (/^\d{2}:\d{2}$/.test(hhmm)) {
              // Se tinha cutoff antigo, converte para intervalo (fechar após X = de X até 23:59)
              return { start_time: hhmm, end_time: "23:59" };
            }
          }
        }
      } catch {}
      return { start_time: null, end_time: null };
    }
    // A função retorna JSON ou pode retornar array (se for TABLE)
    if (!data) return { start_time: null, end_time: null };
    
    // Se for array (retorno de TABLE), pega o primeiro elemento
    let result = Array.isArray(data) ? data[0] : data;
    
    // Se ainda for null, retorna null
    if (!result) return { start_time: null, end_time: null };
    
    const start = result.start_time || result.start_hhmm || null;
    const end = result.end_time || result.end_hhmm || null;
    
    const normalize = (s: any): string | null => {
      if (!s || typeof s !== "string") return null;
      // Remove segundos se houver (HH:MM:SS -> HH:MM)
      const hhmm = s.slice(0, 5);
      return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null;
    };
    
    return {
      start_time: normalize(start),
      end_time: normalize(end),
    };
  } catch (e) {
    console.warn("[fetchBarberDayBlock] erro:", e);
    return { start_time: null, end_time: null };
  }
}

/**
 * Define (ou remove) o intervalo de bloqueio para um barbeiro em um dia.
 * - startTime: string "HH:MM" - início do bloqueio (inclusive)
 * - endTime: string "HH:MM" - fim do bloqueio (inclusive)
 * - Ambos null para remover o fechamento do dia
 * Implementado via RPC 'set_barber_day_block(p_barber_id, p_day, p_start_hhmm, p_end_hhmm)'
 */
export async function adminSetBarberDayBlock(
  barberId: string,
  dayYMD: string | null,
  startTime: string | null,
  endTime: string | null
): Promise<void> {
  if (!barberId) return;
  
  // Validação: se um está preenchido, o outro também deve estar
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new Error("Ambos os horários (início e fim) devem ser preenchidos ou ambos vazios.");
  }
  
  // Validação: startTime deve ser menor que endTime
  if (startTime && endTime && startTime >= endTime) {
    throw new Error("O horário de início deve ser menor que o horário de fim.");
  }
  
  const payload: any = {
    p_barber_id: String(barberId),
    p_day: dayYMD ?? null,
    p_start_hhmm: startTime,
    p_end_hhmm: endTime,
  };
  
  const { error } = await supabase.rpc("set_barber_day_block", payload);
  if (error) {
    // Fallback: tenta a RPC antiga (cutoff) se a nova não existir
    if (error.message?.includes("does not exist") || error.message?.includes("function") || error.code === "42883") {
      if (startTime && endTime === "23:59" && dayYMD) {
        // Compatibilidade: se for "fechar após X", usa a RPC antiga
        try {
          const { error: oldError } = await supabase.rpc("set_barber_day_cutoff", {
            p_barber_id: String(barberId),
            p_day: dayYMD,
            p_cutoff_hhmm: startTime,
          });
          if (!oldError) return;
        } catch {}
      }
    }
    throw error;
  }
}

/**
 * Aplica um bloqueio em um PERÍODO de datas, opcionalmente filtrando por dias da semana.
 *
 * - startDateYMD / endDateYMD: "YYYY-MM-DD"
 * - startTime / endTime: "HH:MM" (ambos null para remover bloqueios no período)
 * - weekdaysIso: array de números 1–7 (ISO: 1=segunda ... 7=domingo) ou null para todos os dias
 *
 * Implementado via RPC 'set_barber_day_block_range(...)'
 */
export async function adminSetBarberDayBlockRange(
  barberId: string,
  startDateYMD: string,
  endDateYMD: string,
  startTime: string | null,
  endTime: string | null,
  weekdaysIso: number[] | null
): Promise<void> {
  if (!barberId) return;

  if (!startDateYMD || !endDateYMD) {
    throw new Error("Informe a data inicial e final do período.");
  }
  if (startDateYMD > endDateYMD) {
    throw new Error("A data inicial deve ser menor ou igual à data final.");
  }

  // Reaproveita validações básicas de horário
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new Error("Ambos os horários (início e fim) devem ser preenchidos ou ambos vazios.");
  }
  if (startTime && endTime && startTime >= endTime) {
    throw new Error("O horário de início deve ser menor que o horário de fim.");
  }

  const payload: any = {
    p_barber_id: String(barberId),
    p_start_date: startDateYMD,
    p_end_date: endDateYMD,
    p_start_hhmm: startTime,
    p_end_hhmm: endTime,
    p_weekdays: weekdaysIso && weekdaysIso.length > 0 ? weekdaysIso : null,
  };

  const { error } = await supabase.rpc("set_barber_day_block_range", payload);
  if (error) {
    throw error;
  }
}

// Funções de compatibilidade (mantidas para não quebrar código existente)
export async function fetchBarberDayCutoff(
  barberId: string,
  dayYMD: string
): Promise<string | null> {
  const block = await fetchBarberDayBlock(barberId, dayYMD);
  // Se tiver start_time e end_time = 23:59, retorna start_time (compatibilidade)
  if (block.start_time && block.end_time === "23:59") {
    return block.start_time;
  }
  return null;
}

export async function adminSetBarberDayCutoff(
  barberId: string,
  dayYMD: string,
  cutoffHM: string | null
): Promise<void> {
  // Converte cutoff antigo para intervalo (de X até 23:59)
  if (cutoffHM) {
    await adminSetBarberDayBlock(barberId, dayYMD, cutoffHM, "23:59");
  } else {
    await adminSetBarberDayBlock(barberId, dayYMD, null, null);
  }
}

/**
 * Lista TODOS os bloqueios de um barbeiro em um dia (incluindo globais)
 * Implementado via RPC 'get_barber_day_blocks(p_barber_id, p_day)'
 */
export async function fetchBarberDayBlocks(
  barberId: string,
  dayYMD: string
): Promise<BarberDayBlockItem[]> {
  if (!barberId || !dayYMD) return [];
  
  try {
    const { data, error } = await supabase.rpc("get_barber_day_blocks", {
      p_barber_id: String(barberId),
      p_day: dayYMD,
    });
    
    if (error) {
      console.warn("[fetchBarberDayBlocks] RPC ausente ou falhou:", error.message);
      return [];
    }
    
    if (!data || !Array.isArray(data)) return [];
    
    return data.map((item: any) => ({
      id: String(item.id),
      name: item.name || null,
      start_time: item.start_time ? String(item.start_time).slice(0, 5) : null,
      end_time: item.end_time ? String(item.end_time).slice(0, 5) : null,
      day: item.day || null,
      is_global: Boolean(item.is_global),
      created_at: item.created_at || "",
    }));
  } catch (e) {
    console.warn("[fetchBarberDayBlocks] erro:", e);
    return [];
  }
}

/**
 * Adiciona um novo bloqueio para um barbeiro
 * Implementado via RPC 'add_barber_day_block(...)'
 */
export async function addBarberDayBlock(
  barberId: string,
  dayYMD: string | null,
  startTime: string,
  endTime: string,
  name: string | null = null,
  isGlobal: boolean = false
): Promise<string> {
  if (!barberId || !startTime || !endTime) {
    throw new Error("Barbeiro, horário de início e fim são obrigatórios.");
  }
  
  if (startTime >= endTime) {
    throw new Error("O horário de início deve ser menor que o horário de fim.");
  }
  
  const { data, error } = await supabase.rpc("add_barber_day_block", {
    p_barber_id: String(barberId),
    p_day: dayYMD || null,
    p_start_hhmm: startTime,
    p_end_hhmm: endTime,
    p_name: name || null,
    p_is_global: isGlobal,
  });
  
  if (error) {
    throw error;
  }
  
  return String(data);
}

/**
 * Remove um bloqueio específico pelo ID
 * Implementado via RPC 'remove_barber_day_block(p_block_id)'
 */
export async function removeBarberDayBlock(blockId: string): Promise<void> {
  if (!blockId) {
    throw new Error("ID do bloqueio é obrigatório.");
  }
  
  const { error } = await supabase.rpc("remove_barber_day_block", {
    p_block_id: String(blockId),
  });
  
  if (error) {
    throw error;
  }
}

/* ---------- Admin: Barbers (listar todos / ativar-desativar) ---------- */
export type AdminBarber = {
  id: string;
  name: string;
  photo_url: string | null;
  is_active: boolean;
  can_cancel_bookings?: boolean;
  can_create_bookings?: boolean;
};

export async function adminFetchAllBarbers(): Promise<AdminBarber[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select("id,name,photo_url,is_active,can_cancel_bookings,can_create_bookings")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    id: String(b.id),
    name: b.name ?? "",
    photo_url: b.photo_url ?? null,
    is_active: !!b.is_active,
    can_cancel_bookings: b.can_cancel_bookings ?? false,
    can_create_bookings: b.can_create_bookings ?? false,
  }));
}

export async function adminSetBarberActive(barberId: string, isActive: boolean) {
  const { error } = await supabase
    .from("barbers")
    .update({ is_active: isActive })
    .eq("id", barberId);

  if (error) throw error;
}

export async function adminSetBarberPermissions(
  barberId: string, 
  canCancelBookings: boolean, 
  canCreateBookings: boolean
) {
  const { error } = await supabase
    .from("barbers")
    .update({ 
      can_cancel_bookings: canCancelBookings,
      can_create_bookings: canCreateBookings 
    })
    .eq("id", barberId);

  if (error) throw error;
}

/* =========================
   Horário de Funcionamento
========================= */

export type BusinessHours = {
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  lunch_start: string | null; // "HH:MM" ou null
  lunch_end: string | null; // "HH:MM" ou null
};

/** Busca horário de funcionamento do estabelecimento */
export async function getBusinessHours(): Promise<BusinessHours> {
  const { data, error } = await supabase.rpc("get_business_hours");

  if (error) {
    // Se a função não existir, retorna valores padrão
    if (error.message?.includes("does not exist") || error.code === "42883") {
      return {
        open_time: "09:00",
        close_time: "18:00",
        // Por padrão, nenhum horário de almoço definido
        lunch_start: null,
        lunch_end: null,
      };
    }
    throw error;
  }

  if (!data) {
    return {
      open_time: "09:00",
      close_time: "18:00",
      lunch_start: null,
      lunch_end: null,
    };
  }

  return {
    open_time: data.open_time || "09:00",
    close_time: data.close_time || "18:00",
    // Se o backend retornar null, mantemos null (sem intervalo de almoço)
    lunch_start: data.lunch_start ?? null,
    lunch_end: data.lunch_end ?? null,
  };
}

/** Atualiza horário de funcionamento do estabelecimento (apenas admins) */
export async function setBusinessHours(
  openTime: string, // "HH:MM"
  closeTime: string, // "HH:MM"
  lunchStart?: string | null, // "HH:MM" ou null
  lunchEnd?: string | null // "HH:MM" ou null
): Promise<void> {
  const { error } = await supabase.rpc("set_business_hours", {
    p_open_time: openTime,
    p_close_time: closeTime,
    p_lunch_start: lunchStart || null,
    p_lunch_end: lunchEnd || null,
  });

  if (error) throw error;
}

/* =========================
   Área do Cliente
========================= */

export type CustomerBooking = {
  id: string;
  starts_at: string; // timestamptz
  status: "pending" | "confirmed" | "canceled";
  customer_name: string | null;
  phone: string | null;
  price: number | null;
  payment_method: PaymentMethod;
  duration_min: number | null;
  services?: { name: string | null } | null;
  barbers?: { name: string | null; id?: string } | null;
};

/** Busca agendamentos de um cliente por telefone */
export async function fetchCustomerBookings(phone: string): Promise<CustomerBooking[]> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 11) {
    throw new Error("Telefone inválido");
  }

  // Usa a função RPC diretamente (mais confiável, bypassa RLS)
  // Se a RPC não existir, tenta consulta direta como fallback
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_customer_bookings", {
      p_phone: normalized,
    });

    if (!rpcError && rpcData !== null) {
      console.log("[fetchCustomerBookings] Função RPC executada com sucesso, retornando", rpcData?.length || 0, "agendamentos");

      // Converte o resultado da RPC para o formato esperado
      return (rpcData ?? []).map((row: any) => ({
        id: String(row.id),
        starts_at: row.starts_at,
        status: row.status as "pending" | "confirmed" | "canceled",
        customer_name: row.customer_name,
        phone: row.phone,
        price: Number(row.price ?? 0),
        payment_method: row.payment_method as PaymentMethod,
        duration_min: row.duration_min,
        services: row.service_name ? { name: row.service_name } : null,
        barbers: row.barber_name ? { name: row.barber_name, id: String(row.barber_id) } : null,
      })) as CustomerBooking[];
    }

    // Se a RPC não existir, tenta consulta direta
    if (rpcError && (rpcError.message?.includes("does not exist") || rpcError.message?.includes("function"))) {
      console.warn("[fetchCustomerBookings] Função RPC não encontrada, tentando consulta direta...");
    } else if (rpcError) {
      throw rpcError;
    }
  } catch (rpcErr: any) {
    // Se a RPC falhar por outro motivo, tenta consulta direta
    if (!rpcErr?.message?.includes("does not exist") && !rpcErr?.message?.includes("function")) {
      throw rpcErr;
    }
    console.warn("[fetchCustomerBookings] Função RPC não disponível, tentando consulta direta...");
  }

  // Fallback: Tenta consulta direta (pode falhar se RLS estiver habilitado)
  let { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      starts_at,
      status,
      customer_name,
      phone,
      price,
      payment_method,
      duration_min,
      services ( name ),
      barbers!barber_id ( id, name )
    `
    )
    .eq("phone", normalized)
    .order("starts_at", { ascending: false }); // Mais recentes primeiro

  // Se der erro de permissão (401, 42501, ou qualquer erro), tenta usar a função RPC (SECURITY DEFINER)
  if (error) {
    const errorCode = (error as any).code;
    const errorMessage = error.message || "";
    const isPermissionError = 
      errorCode === "42501" || 
      errorCode === "PGRST301" ||
      errorMessage.toLowerCase().includes("permission") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("denied");

    if (isPermissionError) {
      console.warn("[fetchCustomerBookings] Erro de permissão detectado, tentando função RPC...", { errorCode, errorMessage });
    } else {
      // Mesmo que não seja erro de permissão explícito, tenta RPC como fallback
      console.warn("[fetchCustomerBookings] Erro na consulta direta, tentando função RPC como fallback...", { errorCode, errorMessage });
    }
    
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_customer_bookings", {
        p_phone: normalized,
      });

      if (rpcError) {
        console.error("[fetchCustomerBookings] Erro na função RPC:", rpcError);
        // Se a função RPC também falhar, lança o erro original
        const errorMessage = rpcError.message || error.message || "Erro ao buscar agendamentos";
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).code = (rpcError as any).code || errorCode;
        throw enhancedError;
      }

      console.log("[fetchCustomerBookings] Função RPC executada com sucesso, retornando", rpcData?.length || 0, "agendamentos");

      // Converte o resultado da RPC para o formato esperado
      return (rpcData ?? []).map((row: any) => ({
        id: String(row.id),
        starts_at: row.starts_at,
        status: row.status as "pending" | "confirmed" | "canceled",
        customer_name: row.customer_name,
        phone: row.phone,
        price: Number(row.price ?? 0),
        payment_method: row.payment_method as PaymentMethod,
        duration_min: row.duration_min,
        services: row.service_name ? { name: row.service_name } : null,
        barbers: row.barber_name ? { name: row.barber_name, id: String(row.barber_id) } : null,
      })) as CustomerBooking[];
    } catch (rpcErr) {
      // Se a RPC também falhar, lança o erro original
      console.error("[fetchCustomerBookings] Erro ao tentar RPC:", rpcErr);
      const errorMessage = error.message || "Erro ao buscar agendamentos";
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).code = (error as any).code;
      throw enhancedError;
    }
  }

  // Se não houve erro, retorna os dados
  return (data ?? []) as CustomerBooking[];
}

/** Cancela um agendamento (apenas pelo cliente).
 *
 * Usa exclusivamente a função RPC cancel_customer_booking criada pelo script
 * fix_customer_cancel_booking.sql. Assim garantimos a mesma regra de negócio
 * para web e mobile, sem depender de UPDATE direto sujeito a RLS.
 */
export async function cancelCustomerBooking(bookingId: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_customer_booking", {
    p_booking_id: bookingId,
    p_phone: phone,
  });

  if (!error) return;

  // Tratamento de erros mais amigável
  const message = error.message || "";

  if (message.includes("Telefone inválido")) {
    throw new Error("Telefone inválido. Verifique o número e tente novamente.");
  }
  if (message.includes("não pertence")) {
    throw new Error("Este agendamento não pertence a este telefone.");
  }
  if (message.includes("já está cancelado")) {
    throw new Error("Este agendamento já está cancelado.");
  }
  if (message.includes("cancelado pelo administrador")) {
    throw new Error("Este agendamento foi cancelado pelo administrador.");
  }
  if (message.includes("2 horas de antecedência")) {
    throw new Error("Agendamentos só podem ser cancelados com pelo menos 2 horas de antecedência.");
  }
  if (message.includes("não encontrado")) {
    throw new Error("Agendamento não encontrado.");
  }
  if (message.includes("permission") || message.includes("RLS") || error.code === "42501") {
    throw new Error("Você não tem permissão para cancelar este agendamento. Verifique as políticas RLS ou fale com a barbearia.");
  }
  if (message.includes("Could not find the function") || message.includes("does not exist")) {
    throw new Error("Função de cancelamento não encontrada no banco. Confirme se o script fix_customer_cancel_booking.sql foi aplicado no Supabase.");
  }

  // Qualquer outro erro cai aqui
  throw new Error(`Erro ao cancelar agendamento: ${message || "tente novamente mais tarde."}`);
}

/** Verifica se um agendamento pode ser cancelado pelo cliente */
export function canCustomerCancelBooking(booking: CustomerBooking): boolean {
  // Cliente só pode cancelar se:
  // 1. Status não é "canceled"
  // 2. Agendamento está no futuro (pelo menos 2 horas antes)
  if (booking.status === "canceled") return false;

  const bookingDate = new Date(booking.starts_at);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return bookingDate > twoHoursFromNow;
}
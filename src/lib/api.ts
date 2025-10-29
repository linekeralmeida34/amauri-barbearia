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

  email?: string;              // (não salvo por enquanto)
  notes?: string;              // (não salvo por enquanto)

  starts_at_iso: string;       // ex.: new Date(...).toISOString()
  duration_min: number;
  price: number;
  payment_method?: PaymentMethod; // Forma de pagamento opcional
};

export type CreateBookingResult =
  | { ok: true }
  | { ok: false; reason: "CONFLICT" | "VALIDATION" | "UNKNOWN"; message: string };

/** Normaliza telefone BR para apenas dígitos (ex.: "+55 (11) 9..." -> "55119...") */
function normalizePhone(brPhone: string | null | undefined) {
  if (!brPhone) return null;
  const digits = brPhone.replace(/\D/g, "");
  return digits.length ? digits : null;
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
  if (!input.starts_at_iso || isNaN(Date.parse(input.starts_at_iso))) {
    return { ok: false, reason: "VALIDATION", message: "Data/hora inválidas." };
  }
  if (!input.duration_min || input.duration_min <= 0) {
    return { ok: false, reason: "VALIDATION", message: "Duração inválida." };
  }

  // Payload compatível com a tabela "bookings"
  const payload = {
    service_id: svcId,
    barber_id: brbId,
    starts_at: input.starts_at_iso,                    // timestamptz (UTC)
    duration_min: Math.round(input.duration_min),
    price: Number(input.price),
    status: "pending" as const,
    customer_name: input.customer_name.trim(),
    phone: normalizePhone(input.phone),
    payment_method: input.payment_method || null,      // Forma de pagamento
  };

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

/* =========================
   Horários disponíveis (RPC)
========================= */
export async function listAvailableTimes(
  barberId: string | number,
  dayYMD: string,      // "YYYY-MM-DD"
  durationMin: number
): Promise<string[]> {
  const id = String(barberId);
  if (!dayYMD || !durationMin || durationMin <= 0) return [];
  // Se ainda estiver no fallback (ex.: 1, 2, 3), não chama a RPC (ela espera UUID)
  if (id.length < 10) return [];

  const { data, error } = await supabase.rpc("list_available_times", {
    p_barber_id: id,
    p_day: dayYMD,
    p_duration_min: durationMin,
  });

  if (error) throw error;

  // data = [{ slot: "HH:MM" }, ...]
  return (data ?? []).map((r: any) => r.slot);
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

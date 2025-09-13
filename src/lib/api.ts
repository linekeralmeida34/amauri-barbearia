import { supabase } from "./supabase";

/* ---------- Tipos ---------- */
export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;                 // numeric normalizado para number
  category: string | null;
  popular: boolean;
  is_active: boolean;
};

export type Barber = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  rating: number | null;         // numeric normalizado para number
  reviews: number | null;        // int normalizado para number
  is_active: boolean;
  instagram?: string | null;
  specialties?: string[] | null;
};

/* ---------- Services ---------- */
export async function fetchActiveServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id,name,description,duration_min,price,category,popular,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  // normaliza numeric/int para number
  return (data ?? []).map((s: any) => ({
    id: String(s.id),
    name: s.name ?? "",
    description: s.description ?? null,
    duration_min: Number(s.duration_min ?? 0),
    price: Number(s.price ?? 0),
    category: s.category ?? null,
    popular: !!s.popular,
    is_active: !!s.is_active,
  })) as Service[];
}

/* ---------- Barbers ---------- */
export async function fetchActiveBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select(
      "id,name,photo_url,bio,rating,reviews,is_active,instagram,specialties"
    )
    .eq("is_active", true)
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
  })) as Barber[];
}

/* ---------- Helpers para pré-seleção rápida no BookingFlow ---------- */
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

/* ---------- Criação de agendamento ---------- */

export type CreateBookingInput = {
  service_id: string | number;   // aceito number p/ fallback, valido abaixo
  barber_id:  string | number;

  customer_name: string;
  phone: string;                 // WhatsApp do cliente (será salvo em customer_phone)

  email?: string;                // (não salvo por enquanto)
  notes?: string;                // (não salvo por enquanto)

  starts_at_iso: string;         // ex: new Date('2025-09-12T14:30:00-03:00').toISOString()
  duration_min: number;
  price: number;                 // number já normalizado
};

export type CreateBookingResult =
  | { ok: true }
  | { ok: false; reason: "CONFLICT" | "VALIDATION" | "UNKNOWN"; message: string };

/** Normaliza telefone BR: mantém apenas dígitos (ex.: "+55 (11) 91234-5678" -> "5511912345678") */
function normalizePhone(brPhone: string | null | undefined) {
  if (!brPhone) return null;
  const digits = brPhone.replace(/\D/g, "");
  return digits.length ? digits : null;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  // Garantir que IDs vieram do banco (uuid como string). Se vierem do fallback (número), bloqueia.
  const svcId = String(input.service_id);
  const brbId = String(input.barber_id);
  if (svcId.length < 10 || brbId.length < 10) {
    return {
      ok: false,
      reason: "VALIDATION",
      message: "Selecione um serviço e um barbeiro válidos do sistema.",
    };
    }

  // Valida campos mínimos
  if (!input.customer_name?.trim() || !input.phone?.trim()) {
    return { ok: false, reason: "VALIDATION", message: "Nome e WhatsApp são obrigatórios." };
  }
  if (!input.starts_at_iso || isNaN(Date.parse(input.starts_at_iso))) {
    return { ok: false, reason: "VALIDATION", message: "Data/hora inválidas." };
  }
  if (!input.duration_min || input.duration_min <= 0) {
    return { ok: false, reason: "VALIDATION", message: "Duração inválida." };
  }

  // Monta payload para o insert
  // OBS: somente colunas existentes na sua tabela: starts_at, service_id, barber_id, duration_min, price, status,
  //      customer_name, customer_phone (adicionadas no passo anterior).
  const payload = {
    service_id: svcId,
    barber_id: brbId,
    starts_at: input.starts_at_iso,                   // timestamptz em UTC
    duration_min: Math.round(input.duration_min),
    price: Number(input.price),
    status: "pending" as const,

    // ✅ novos campos persistidos
    customer_name: input.customer_name.trim(),
    customer_phone: normalizePhone(input.phone),
  };

  const { error } = await supabase.from("bookings").insert([payload]);

  if (!error) return { ok: true };

  // Trata conflito de horário (exclusion constraint/overlap)
  const code = (error as any)?.code || "";
  const msg = (error as any)?.message || "";
  const details = (error as any)?.details || "";

  const looksLikeConflict =
    code === "23P01" ||                           // exclusion_violation
    msg.toLowerCase().includes("bookings_no_overlap") ||
    details.toLowerCase().includes("bookings_no_overlap") ||
    msg.toLowerCase().includes("overlap") ||
    details.toLowerCase().includes("overlap");

  if (looksLikeConflict) {
    return {
      ok: false,
      reason: "CONFLICT",
      message: "Esse horário já foi reservado para este barbeiro. Escolha outro horário.",
    };
  }

  return {
    ok: false,
    reason: "UNKNOWN",
    message: "Não foi possível concluir o agendamento. Tente novamente.",
  };
}

/* ---------- Horários disponíveis (RPC) ---------- */
export async function listAvailableTimes(
  barberId: string | number,
  dayYMD: string,          // formato "YYYY-MM-DD"
  durationMin: number
): Promise<string[]> {
  const id = String(barberId);
  if (!dayYMD || !durationMin || durationMin <= 0) return [];
  // Se veio de fallback (ex.: 1, 2, 3), não chamamos a RPC (espera UUID do banco)
  if (id.length < 10) return [];

  const { data, error } = await supabase.rpc("list_available_times", {
    p_barber_id: id,
    p_day: dayYMD,
    p_duration_min: durationMin,
  });

  if (error) throw error;
  // data vem como [{ slot: "HH:MM" }, ...]
  return (data ?? []).map((r: any) => r.slot);
}

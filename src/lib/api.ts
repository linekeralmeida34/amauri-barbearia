import { supabase } from "./supabase";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  category: string | null;
  popular: boolean;
  is_active: boolean;
};

export async function fetchActiveServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id,name,description,duration_min,price,category,popular,is_active"
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Service[];
}

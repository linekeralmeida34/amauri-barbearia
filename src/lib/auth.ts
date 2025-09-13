import { supabase } from "./supabase";

export type AdminSession = {
  session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>;
  isAdmin: boolean;
};

export async function signInWithEmailPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<AdminSession | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  // Verifica no admin_users se este user_id é admin (owner/admin)
  const { data: rows, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows
    console.error("admin_users check error", error);
  }

  const isAdmin = !!rows && (rows.role === "owner" || rows.role === "admin");
  return { session, isAdmin };
}

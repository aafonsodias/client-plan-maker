import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("forbidden", { status: 403 });
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const listIterations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("system_iterations")
      .select("id, code, title, summary, affected_modules, shipped_at")
      .order("shipped_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, iterations: data ?? [] };
  });

export const createIteration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(40),
        title: z.string().min(1).max(160),
        summary: z.string().min(1).max(4000),
        affected_modules: z.array(z.string().min(1).max(80)).max(20).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("system_iterations")
      .insert({ ...data, created_by: userId })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (row as any).id };
  });
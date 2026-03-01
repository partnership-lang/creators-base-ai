"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    throw new Error("Supabase is not configured in environment variables.");
  }

  return createBrowserClient(url!, anonKey!);
}

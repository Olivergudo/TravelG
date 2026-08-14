"use client";

import { supabase } from "@/lib/supabase";
import type { TicketProductAlias } from "./types";

const key = (userId: string) => `gasto-listo-ticket-aliases-v1:${userId}`;
function local(userId: string): TicketProductAlias[] {
  try { return JSON.parse(localStorage.getItem(key(userId)) || "[]") as TicketProductAlias[]; } catch { return []; }
}
function cache(userId: string, aliases: TicketProductAlias[]) { localStorage.setItem(key(userId), JSON.stringify(aliases)); }

export const ticketAliasRepository = {
  local,
  async load(userId: string) {
    if (!supabase) return local(userId);
    const { data, error } = await supabase.from("ticket_product_aliases")
      .select("raw_name_normalized,display_name,classification")
      .eq("user_id", userId).limit(500);
    if (error) return local(userId);
    const aliases = (data || []).map((row) => ({ rawNameNormalized: row.raw_name_normalized, displayName: row.display_name, classification: row.classification as "food" | "non_food" }));
    cache(userId, aliases); return aliases;
  },
  async save(userId: string, rawName: string, alias: TicketProductAlias, current: TicketProductAlias[]) {
    const next = [...current.filter((item) => item.rawNameNormalized !== alias.rawNameNormalized), alias];
    cache(userId, next);
    if (supabase) await supabase.from("ticket_product_aliases").upsert({ user_id: userId, raw_name: rawName, raw_name_normalized: alias.rawNameNormalized, display_name: alias.displayName, classification: alias.classification, updated_at: new Date().toISOString() }, { onConflict: "user_id,raw_name_normalized" });
    return next;
  },
};

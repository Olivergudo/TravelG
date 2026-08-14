import { supabase } from "@/lib/supabase";
import type { FridgeItem, FridgeItemInput } from "./types";

const cacheKey = (userId: string) => `gasto-listo-fridge-v1:${userId}`;
const uid = () => crypto.randomUUID();

function readLocal(userId: string): FridgeItem[] {
  try { return JSON.parse(localStorage.getItem(cacheKey(userId)) || "[]") as FridgeItem[]; } catch { return []; }
}

function writeLocal(userId: string, items: FridgeItem[]) {
  localStorage.setItem(cacheKey(userId), JSON.stringify(items));
}

function fromRow(row: Record<string, unknown>): FridgeItem {
  return {
    id: String(row.id), userId: String(row.user_id),
    barcode: row.barcode ? String(row.barcode) : undefined,
    name: String(row.name), quantity: row.quantity == null ? undefined : Number(row.quantity),
    unit: row.unit ? String(row.unit) : undefined,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export const fridgeRepository = {
  local(userId: string) { return readLocal(userId); },
  async load(userId: string) {
    if (!supabase) return readLocal(userId);
    const { data, error } = await supabase.from("fridge_items")
      .select("id,user_id,barcode,name,quantity,unit,created_at,updated_at")
      .eq("user_id", userId).order("created_at");
    if (error) return readLocal(userId);
    const items = (data || []).map((row) => fromRow(row));
    writeLocal(userId, items);
    return items;
  },
  async add(userId: string, input: FridgeItemInput, current: FridgeItem[]) {
    const duplicate = current.find((item) => input.barcode ? item.barcode === input.barcode : item.name.trim().toLocaleLowerCase("es-CL") === input.name.trim().toLocaleLowerCase("es-CL"));
    if (duplicate) {
      const increment = input.quantity ?? 1;
      return this.update(userId, duplicate.id, { quantity: (duplicate.quantity ?? 0) + increment }, current);
    }
    const now = new Date().toISOString();
    const item: FridgeItem = { id: uid(), userId, name: input.name.trim(), barcode: input.barcode, quantity: input.quantity, unit: input.unit?.trim() || undefined, createdAt: now, updatedAt: now };
    const next = [...current, item];
    writeLocal(userId, next);
    if (supabase) await supabase.from("fridge_items").insert({ id: item.id, user_id: userId, barcode: item.barcode ?? null, name: item.name, quantity: item.quantity ?? null, unit: item.unit ?? null, created_at: now, updated_at: now });
    return next;
  },
  async update(userId: string, id: string, patch: Partial<FridgeItemInput>, current: FridgeItem[]) {
    const updatedAt = new Date().toISOString();
    const next = current.map((item) => item.id === id ? { ...item, ...patch, updatedAt } : item);
    writeLocal(userId, next);
    const row: Record<string, string | number | null> = { updated_at: updatedAt };
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.barcode !== undefined) row.barcode = patch.barcode || null;
    if (patch.quantity !== undefined) row.quantity = patch.quantity;
    if (patch.unit !== undefined) row.unit = patch.unit || null;
    if (supabase) await supabase.from("fridge_items").update(row).eq("user_id", userId).eq("id", id);
    return next;
  },
  async remove(userId: string, id: string, current: FridgeItem[]) {
    const next = current.filter((item) => item.id !== id);
    writeLocal(userId, next);
    if (supabase) await supabase.from("fridge_items").delete().eq("user_id", userId).eq("id", id);
    return next;
  },
};

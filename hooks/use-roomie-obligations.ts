"use client";

import { useCallback, useEffect, useState } from "react";
import { loadRoomieObligations } from "@/lib/roomies/repository";
import type { RoomieObligations } from "@/lib/roomies/types";
import { supabase } from "@/lib/supabase";

const empty: RoomieObligations = { householdId: null, members: [], debts: [], groupExpenses: [] };

export function useRoomieObligations(userId?: string) {
  const [data, setData] = useState<RoomieObligations>(empty);
  const reload = useCallback(async () => {
    if (!userId || !supabase) return setData(empty);
    try { setData(await loadRoomieObligations()); } catch { setData(empty); }
  }, [userId]);
  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase.channel(`roomie-obligations:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "replacement_debts" }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_expenses" }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_expense_shares" }, () => void reload())
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [reload, userId]);
  return { data, reload };
}

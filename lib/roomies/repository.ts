import { supabase } from "@/lib/supabase";
import type { Household, HouseholdMember, ReplacementDebt, RoomieMessage } from "./types";

function configured() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

export async function loadRoomies() {
  const client = configured();
  const { data: memberships, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .order("joined_at", { ascending: true });
  if (membershipError) throw membershipError;
  const householdId = memberships?.[0]?.household_id as string | undefined;
  if (!householdId) return { household: null, members: [], messages: [], debts: [] };
  const [householdResult, membersResult, messagesResult, debtsResult] = await Promise.all([
    client.from("households").select("*").eq("id", householdId).single(),
    client.from("household_members").select("*").eq("household_id", householdId).order("joined_at"),
    client.from("household_messages").select("*").eq("household_id", householdId).order("created_at").limit(250),
    client.from("replacement_debts").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
  ]);
  const error = householdResult.error || membersResult.error || messagesResult.error || debtsResult.error;
  if (error) throw error;
  return {
    household: householdResult.data as Household,
    members: (membersResult.data || []) as HouseholdMember[],
    messages: (messagesResult.data || []) as RoomieMessage[],
    debts: (debtsResult.data || []) as ReplacementDebt[],
  };
}

export async function createHousehold(name: string) {
  const { data, error } = await configured().rpc("create_household", { household_name: name });
  if (error) throw error;
  return data as string;
}

export async function joinHousehold(code: string) {
  const { data, error } = await configured().rpc("join_household", { invitation_code: code });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(householdId: string, userId: string, message: string) {
  const { error } = await configured().from("household_messages").insert({
    household_id: householdId,
    user_id: userId,
    type: "message",
    message: message.trim(),
  });
  if (error) throw error;
}

export async function createEvent(householdId: string, eventType: string, payload: Record<string, unknown>) {
  const { data, error } = await configured().rpc("create_roomie_event", {
    target_household: householdId,
    event_type: eventType,
    payload,
  });
  if (error) throw error;
  return data as string;
}

export async function updateDebt(debtId: string, operation: "report" | "confirm" | "reject") {
  const { data, error } = await configured().rpc("update_replacement_debt", { debt_id: debtId, operation });
  if (error) throw error;
  return data as string;
}

export async function leaveHousehold(householdId: string) {
  const { error } = await configured().rpc("leave_household", { target_household: householdId });
  if (error) throw error;
}

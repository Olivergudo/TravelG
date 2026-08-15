import { supabase } from "@/lib/supabase";
import type { GroupExpense, Household, HouseholdMember, ReplacementDebt, RoomieMessage, RoomieObligations } from "./types";

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
  if (!householdId) return { household: null, members: [], messages: [], debts: [], groupExpenses: [] };
  const [householdResult, membersResult, messagesResult, debtsResult, expensesResult] = await Promise.all([
    client.from("households").select("*").eq("id", householdId).single(),
    client.from("household_members").select("*").eq("household_id", householdId).order("joined_at"),
    client.from("household_messages").select("*").eq("household_id", householdId).order("created_at").limit(250),
    client.from("replacement_debts").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
    client.from("group_expenses").select("*, group_expense_shares(*)").eq("household_id", householdId).order("created_at", { ascending: false }),
  ]);
  const error = householdResult.error || membersResult.error || messagesResult.error || debtsResult.error || expensesResult.error;
  if (error) throw error;
  return {
    household: householdResult.data as Household,
    members: (membersResult.data || []) as HouseholdMember[],
    messages: (messagesResult.data || []) as RoomieMessage[],
    debts: (debtsResult.data || []) as ReplacementDebt[],
    groupExpenses: (expensesResult.data || []) as GroupExpense[],
  };
}

export async function loadRoomieObligations(): Promise<RoomieObligations> {
  const client = configured();
  const { data: memberships, error } = await client.from("household_members").select("household_id").order("joined_at", { ascending: true }).limit(1);
  if (error) throw error;
  const householdId = memberships?.[0]?.household_id as string | undefined;
  if (!householdId) return { householdId: null, members: [], debts: [], groupExpenses: [] };
  const [members, debts, expenses] = await Promise.all([
    client.from("household_members").select("*").eq("household_id", householdId).order("joined_at"),
    client.from("replacement_debts").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
    client.from("group_expenses").select("*, group_expense_shares(*)").eq("household_id", householdId).order("created_at", { ascending: false }),
  ]);
  const queryError = members.error || debts.error || expenses.error;
  if (queryError) throw queryError;
  return { householdId, members: (members.data || []) as HouseholdMember[], debts: (debts.data || []) as ReplacementDebt[], groupExpenses: (expenses.data || []) as GroupExpense[] };
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

export async function markReplacementPurchased(debtId: string) {
  const { error } = await configured().rpc("mark_replacement_purchased", { debt_id: debtId });
  if (error) throw error;
}

export async function createGroupExpense(input: { householdId: string; concept: string; totalAmount: number; currency: "CLP" | "MXN" | "USD" | "EUR"; category?: string; notes?: string; shares: Array<{ userId: string; amount: number }> }) {
  const { data, error } = await configured().rpc("create_group_expense", {
    target_household: input.householdId,
    expense_concept: input.concept,
    expense_total: input.totalAmount,
    expense_currency: input.currency,
    expense_category: input.category || null,
    expense_notes: input.notes || null,
    participant_shares: input.shares,
  });
  if (error) throw error;
  return data as string;
}

export async function updateGroupExpensePayment(expenseId: string, participantId: string, operation: "report" | "confirm" | "reject") {
  const { data, error } = await configured().rpc("update_group_expense_payment", {
    target_expense: expenseId,
    participant_id: participantId,
    operation,
  });
  if (error) throw error;
  return data as string;
}

export async function leaveHousehold(householdId: string) {
  const { error } = await configured().rpc("leave_household", { target_household: householdId });
  if (error) throw error;
}

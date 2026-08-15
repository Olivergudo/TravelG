export type Household = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
};

export type RoomieMessageType =
  | "message"
  | "product_request"
  | "product_available"
  | "product_taken"
  | "product_purchased"
  | "replacement_reported"
  | "replacement_confirmed"
  | "replacement_rejected"
  | "group_expense_created"
  | "group_expense_payment_reported"
  | "group_expense_payment_confirmed";

export type RoomieMessage = {
  id: string;
  household_id: string;
  user_id: string;
  type: RoomieMessageType;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ReplacementDebt = {
  id: string;
  household_id: string;
  debtor_user_id: string;
  owner_user_id: string;
  product_name: string;
  status: "pending" | "awaiting_confirmation" | "resolved";
  created_at: string;
  replacement_reported_at: string | null;
  resolved_at: string | null;
  confirmed_by: string | null;
  purchased_at?: string | null;
};

export type RoomieObligations = {
  householdId: string | null;
  members: HouseholdMember[];
  debts: ReplacementDebt[];
  groupExpenses: GroupExpense[];
};

export type GroupExpenseShare = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  status: "pending" | "reported_paid" | "confirmed_paid";
  reported_at: string | null;
  confirmed_at: string | null;
};

export type GroupExpense = {
  id: string;
  household_id: string;
  creator_id: string;
  payer_id: string;
  concept: string;
  total_amount: number;
  currency: "CLP" | "MXN" | "USD" | "EUR";
  category: string | null;
  notes: string | null;
  status: "pending" | "partially_paid" | "paid" | "cancelled";
  created_at: string;
  resolved_at: string | null;
  group_expense_shares: GroupExpenseShare[];
};

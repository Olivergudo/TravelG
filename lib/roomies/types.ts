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
  | "replacement_rejected";

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
};

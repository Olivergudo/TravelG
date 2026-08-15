export function buildExpenseShares(total: number, participantIds: string[], customAmounts?: Record<string, number>) {
  if (!Number.isFinite(total) || total <= 0 || participantIds.length === 0) throw new Error("Invalid total or participants");
  if (customAmounts) {
    const shares = participantIds.map((userId) => ({ userId, amount: customAmounts[userId] || 0 }));
    if (shares.some((share) => share.amount <= 0) || shares.reduce((sum, share) => sum + share.amount, 0) - total > 0.01) throw new Error("Invalid custom split");
    return shares;
  }
  const totalCents = Math.round(total * 100);
  const peopleCount = participantIds.length + 1;
  return participantIds.map((userId) => ({
    userId,
    amount: Math.floor(totalCents / peopleCount) / 100,
  }));
}

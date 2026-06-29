// Pure helpers for conversation status + assignment transitions (V2 §2.3).
// No DB/IO so they're unit-testable; the API route applies the returned patch.

export type ConversationStatus = "OPEN" | "PENDING" | "CLOSED";
export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ["OPEN", "PENDING", "CLOSED"] as const;

/** The closedAt patch implied by a status change: stamp when closing, clear when
 *  (re)opening. `now` is injected so the caller controls the timestamp. */
export function closedAtFor(next: ConversationStatus, now: Date): Date | null {
  return next === "CLOSED" ? now : null;
}

/** Auto-assign rule: an outbound reply claims an unassigned thread for the agent.
 *  Returns the assignee id to set, or null to leave assignment unchanged. */
export function autoAssignee(currentAssigneeId: string | null, actorUserId: string | null): string | null {
  if (currentAssigneeId) return null; // already owned — never steal
  return actorUserId; // may be null (env-admin) → no change
}

/** Whether an outbound message is the conversation's first response (for the
 *  first-response SLA clock): no prior firstResponseAt and the customer has written. */
export function isFirstResponse(firstResponseAt: Date | null, lastInboundAt: Date | null): boolean {
  return !firstResponseAt && !!lastInboundAt;
}

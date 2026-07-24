import { db } from "../database";
import { AuditLog } from "../../types";

export interface AuditActor {
  userId: string;
  userName: string;
  shopId: string;
}

export async function logAction(
  actor: AuditActor,
  action: string,
  details: string
): Promise<void> {
  try {
    await db.addAuditLog(actor.shopId, actor.userName, actor.userId, action, details);
  } catch (err) {
    console.error("auditService.logAction failed:", err);
  }
}

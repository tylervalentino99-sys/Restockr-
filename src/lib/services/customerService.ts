import { db } from "../database";
import { Customer } from "../../types";
import { logAction, AuditActor } from "./auditService";

export async function findOrCreateCustomer(
  shopId: string,
  name: string,
  phone: string
): Promise<Customer> {
  const existing = await db.getCustomers(shopId);
  const normalized = phone.trim().toLowerCase();
  const found = existing.find(
    (c) => c.phoneNumber.trim().toLowerCase() === normalized
  );
  if (found) return found;

  const created = await db.saveCustomer({
    id: `cust-${Date.now()}`,
    shop_id: shopId,
    name: name || "Walk-in Customer",
    phoneNumber: phone.trim(),
    purchaseCount: 0,
    totalSpent: 0,
    notes: "",
  } as Customer);
  return created;
}

export async function saveCustomer(
  customer: Customer,
  actor: AuditActor
): Promise<Customer> {
  const saved = await db.saveCustomer(customer);
  const isNew = !customer.id || customer.id.startsWith("cust-");
  await logAction(
    actor,
    isNew ? "Customer Added" : "Customer Updated",
    `${customer.name} (${customer.phoneNumber})`
  );
  return saved;
}

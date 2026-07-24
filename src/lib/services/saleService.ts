import { db } from "../database";
import { Sale } from "../../types";
import { logAction, AuditActor } from "./auditService";

export interface RecordSaleInput {
  shop_id: string;
  productId: string;
  productName?: string;
  quantity: number;
  sellingPrice: number;
  soldBy: string;
  customerName: string;
  customerPhone: string;
  paymentMethod?: Sale["paymentMethod"];
  splitDetails?: Sale["splitDetails"];
}

export async function recordSale(
  input: RecordSaleInput,
  actor: AuditActor
): Promise<Sale> {
  const sale = await db.saveSale(input);
  await logAction(
    actor,
    "Sale Completed",
    `${input.productName || "Product"} x${input.quantity} to ${input.customerName || "Walk-in Customer"} - ${input.paymentMethod || "Transfer"}`
  );
  return sale;
}

export async function reverseSale(
  shopId: string,
  saleId: string,
  actor: AuditActor
): Promise<void> {
  await db.reverseSale(shopId, saleId);
  await logAction(actor, "Sale Reversed", `Sale ${saleId.slice(0, 8)} reversed and stock restored`);
}

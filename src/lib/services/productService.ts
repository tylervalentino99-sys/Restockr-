import { db } from "../database";
import { Product } from "../../types";
import { logAction, AuditActor } from "./auditService";

export async function createProduct(
  product: Product,
  actor: AuditActor
): Promise<Product> {
  const saved = await db.saveProduct(product);
  await logAction(actor, "Product Added", `${product.brand} ${product.model} (${product.storage})`);
  return saved;
}

export async function updateProduct(
  product: Product,
  actor: AuditActor
): Promise<Product> {
  const saved = await db.saveProduct(product);
  await logAction(actor, "Product Updated", `${product.brand} ${product.model} (${product.storage})`);
  return saved;
}

export async function deleteProduct(
  productId: string,
  productName: string,
  actor: AuditActor
): Promise<void> {
  await db.deleteProduct(actor.shopId, productId);
  await logAction(actor, "Product Deleted", productName);
}

export async function duplicateProduct(
  product: Product,
  actor: AuditActor
): Promise<Product> {
  const copy: Product = {
    ...product,
    id: `prod-${Date.now()}`,
    quantity: 0,
    status: "Out of Stock",
    createdAt: new Date().toISOString(),
  };
  const saved = await db.saveProduct(copy, actor.userName);
  await logAction(actor, "Product Duplicated", `${product.brand} ${product.model}`);
  return saved;
}

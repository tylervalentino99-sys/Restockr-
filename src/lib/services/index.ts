export { logAction } from "./auditService";
export type { AuditActor } from "./auditService";
export { canPerform, isAuthorized, DEFAULT_PERMISSIONS } from "./staffService";
export type { StaffAction } from "./staffService";
export { createProduct, updateProduct, deleteProduct, duplicateProduct } from "./productService";
export { findOrCreateCustomer, saveCustomer } from "./customerService";
export { recordSale, reverseSale } from "./saleService";
export type { RecordSaleInput } from "./saleService";

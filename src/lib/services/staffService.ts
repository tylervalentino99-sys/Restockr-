import { Staff, StaffPermission } from "../../types";

export type StaffAction =
  | "addProduct"
  | "editProduct"
  | "sellProduct"
  | "registerCustomer"
  | "receiveRepairs"
  | "updateRepairStatus"
  | "viewInventory"
  | "checkPrices"
  | "viewProductDetails"
  | "deleteProduct";

export const DEFAULT_PERMISSIONS: StaffPermission = {
  addProduct: true,
  editProduct: true,
  sellProduct: true,
  registerCustomer: true,
  receiveRepairs: true,
  updateRepairStatus: true,
  viewInventory: true,
  checkPrices: true,
  viewProductDetails: true,
  deleteProduct: false,
};

export function canPerform(
  action: StaffAction,
  staff: Staff | null
): boolean {
  if (!staff) return true;
  if (staff.status === "Suspended") return false;
  return staff.permissions[action] !== false;
}

export function isAuthorized(
  phone: string,
  shopStaff: Staff[]
): Staff | null {
  const normalized = phone.trim().toLowerCase();
  return (
    shopStaff.find(
      (s) => s.phoneNumber.trim().toLowerCase() === normalized
    ) || null
  );
}

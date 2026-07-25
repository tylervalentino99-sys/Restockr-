import { Product, Sale, AuditLog } from "../../types";

export interface WhatsAppEmulatorProps {
  shopId?: string;
  products: Product[];
  sales: Sale[];
  staffList: import("../../types").Staff[];
  auditLogsData?: AuditLog[];
  onSaveSale: (s: Sale) => void;
  onUndoLastSale: (shopId: string, saleId: string, performer: string) => Promise<{ success: boolean; message: string }>;
  isExpired: boolean;
}

export interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type?: "text" | "inventory_list" | "recent_sales" | "activity_log";
  productsData?: Product[];
  recentSalesData?: Sale[];
  auditLogsData?: AuditLog[];
}

export type FlowType =
  | "none"
  | "add_product"
  | "sell_product"
  | "find_product"
  | "update_product"
  | "recent_sales"
  | "activity_log"
  | "help";

export interface SessionState {
  currentFlow: FlowType;
  step: number;
  data: Record<string, any>;
}

export interface AssistantDraft {
  flow: FlowType;
  step: number;
  data: any;
  uploadedImages?: string[];
  uploadedVideo?: string;
  senderPhone: string;
  completed?: boolean;
}

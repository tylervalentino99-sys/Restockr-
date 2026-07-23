import { 
  Shop, 
  Product, 
  Sale, 
  Customer, 
  Staff, 
  Repair,
  AuditLog, 
  AppNotification, 
  Category 
} from "../types";
import { supabase } from "./supabase";

// Real-time listener system to notify React components of Supabase database updates immediately
type ListenerCallback = () => void;
const listeners = new Set<ListenerCallback>();

export function subscribeToDBUpdates(callback: ListenerCallback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach(callback => callback());
}

// Subscribe to live PostgreSQL database changes using Supabase Realtime Channels
if (supabase) {
  supabase
    .channel("restockr-db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public" },
      () => {
        notifyListeners();
      }
    )
    .subscribe();
}

// ----------------------------------------------------
// SUPABASE BACKEND DATA WRAPPERS
// ----------------------------------------------------

export const db = {
  // ------------------- SHOPS -------------------
  getShops: async (): Promise<Shop[]> => {
    try {
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching shops from Supabase:", error);
        return [];
      }

      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.shop_name || s.name || "Untitled Shop",
        slug: s.slug || s.id,
        ownerEmail: s.owner_id || s.owner_email || "",
        logoUrl: s.logo,
        whatsappNumber: s.whatsapp || s.phone || "",
        businessAddress: s.address || "",
        businessPhone: s.phone || "",
        subscriptionPlan: s.subscription_plan || "Free Trial",
        subscriptionStatus: s.subscription_status || "Active",
        subscriptionExpiry: s.subscription_expiry || new Date().toISOString(),
        websiteSettings: s.website_settings || {
          showSoldProducts: true,
          enableVideoDownloads: true,
          enableImageDownloads: true,
          customThemeColor: "#0d9488"
        },
        createdAt: s.created_at || new Date().toISOString()
      }));
    } catch (err) {
      console.error("Supabase getShops exception:", err);
      return [];
    }
  },

  getShopBySlug: async (slug: string): Promise<Shop | undefined> => {
    try {
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (error || !data) return undefined;

      return {
        id: data.id,
        name: data.shop_name || data.name || "Untitled Shop",
        slug: data.slug,
        ownerEmail: data.owner_id || "",
        logoUrl: data.logo,
        whatsappNumber: data.whatsapp || data.phone || "",
        businessAddress: data.address || "",
        businessPhone: data.phone || "",
        subscriptionPlan: data.subscription_plan || "Free Trial",
        subscriptionStatus: data.subscription_status || "Active",
        subscriptionExpiry: data.subscription_expiry || new Date().toISOString(),
        websiteSettings: data.website_settings || {
          showSoldProducts: true,
          enableVideoDownloads: true,
          enableImageDownloads: true,
          customThemeColor: "#0d9488"
        },
        createdAt: data.created_at
      };
    } catch (err) {
      console.error("Supabase getShopBySlug exception:", err);
      return undefined;
    }
  },

  saveShop: async (shop: Partial<Shop> & { name: string; slug: string; ownerEmail: string; whatsappNumber: string }): Promise<Shop> => {
    const payload = {
      shop_name: shop.name,
      slug: shop.slug.toLowerCase(),
      owner_id: shop.ownerEmail,
      whatsapp: shop.whatsappNumber,
      logo: shop.logoUrl || null,
      address: shop.businessAddress || null,
      phone: shop.businessPhone || shop.whatsappNumber || null,
      subscription_status: shop.subscriptionStatus || "Active",
      subscription_plan: shop.subscriptionPlan || "Free Trial",
      subscription_expiry: shop.subscriptionExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      website_settings: shop.websiteSettings || {
        showSoldProducts: true,
        enableVideoDownloads: true,
        enableImageDownloads: true,
        customThemeColor: "#0d9488"
      }
    };

    if (shop.id) {
      const { data, error } = await supabase
        .from("shops")
        .update(payload)
        .eq("id", shop.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update shop: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        name: data.shop_name,
        slug: data.slug,
        ownerEmail: data.owner_id,
        logoUrl: data.logo,
        whatsappNumber: data.whatsapp,
        businessAddress: data.address,
        businessPhone: data.phone,
        subscriptionPlan: data.subscription_plan,
        subscriptionStatus: data.subscription_status,
        subscriptionExpiry: data.subscription_expiry,
        websiteSettings: data.website_settings,
        createdAt: data.created_at
      };
    } else {
      const { data, error } = await supabase
        .from("shops")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Failed to create shop: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        name: data.shop_name,
        slug: data.slug,
        ownerEmail: data.owner_id,
        logoUrl: data.logo,
        whatsappNumber: data.whatsapp,
        businessAddress: data.address,
        businessPhone: data.phone,
        subscriptionPlan: data.subscription_plan,
        subscriptionStatus: data.subscription_status,
        subscriptionExpiry: data.subscription_expiry,
        websiteSettings: data.website_settings,
        createdAt: data.created_at
      };
    }
  },

  // ------------------- PRODUCTS -------------------
  getProducts: async (shopId: string): Promise<Product[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products from Supabase:", error);
        return [];
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        shop_id: p.shop_id,
        category: p.category as Category,
        brand: p.manufacturer || "Other",
        model: p.model,
        storage: p.storage || "N/A",
        ram: p.ram || undefined,
        colour: p.colour || undefined,
        quantity: p.quantity || 0,
        sellingPrice: Number(p.price || 0),
        batteryHealth: p.battery_health || undefined,
        warranty: p.warranty || "No Warranty",
        condition: Array.isArray(p.condition_tags) ? p.condition_tags : [],
        productVideo: p.video_url || undefined,
        productImages: Array.isArray(p.image_urls) ? p.image_urls : [],
        thumbnailUrl: p.thumbnail_url || undefined,
        status: p.quantity > 0 ? (p.status === "SOLD" ? "SOLD" : "Available") : "Out of Stock",
        createdAt: p.created_at
      }));
    } catch (err) {
      console.error("Supabase getProducts exception:", err);
      return [];
    }
  },

  getAvailableProductsBySlug: async (shopSlug: string): Promise<{ shop: Shop | null; products: Product[] }> => {
    try {
      const shop = await db.getShopBySlug(shopSlug);
      if (!shop) return { shop: null, products: [] };

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shop.id)
        .eq("status", "Available")
        .gt("quantity", 0)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching available products for reseller store:", error);
        return { shop, products: [] };
      }

      const products: Product[] = (data || []).map((p: any) => ({
        id: p.id,
        shop_id: p.shop_id,
        category: p.category as Category,
        brand: p.manufacturer || "Other",
        model: p.model,
        storage: p.storage || "N/A",
        ram: p.ram || undefined,
        colour: p.colour || undefined,
        quantity: p.quantity || 0,
        sellingPrice: Number(p.price || 0),
        batteryHealth: p.battery_health || undefined,
        warranty: p.warranty || "No Warranty",
        condition: Array.isArray(p.condition_tags) ? p.condition_tags : [],
        productVideo: p.video_url || undefined,
        productImages: Array.isArray(p.image_urls) ? p.image_urls : [],
        thumbnailUrl: p.thumbnail_url || undefined,
        status: "Available",
        createdAt: p.created_at
      }));

      return { shop, products };
    } catch (err) {
      console.error("Supabase getAvailableProductsBySlug exception:", err);
      return { shop: null, products: [] };
    }
  },

  saveProduct: async (product: Product, performer: string = "Owner"): Promise<Product> => {
    const payload = {
      shop_id: product.shop_id,
      category: product.category,
      manufacturer: product.brand,
      model: product.model,
      storage: product.storage,
      ram: product.ram || null,
      colour: product.colour || null,
      battery_health: product.batteryHealth || null,
      warranty: product.warranty,
      condition_tags: product.condition || [],
      price: product.sellingPrice,
      quantity: product.quantity,
      video_url: product.productVideo || null,
      image_urls: product.productImages || [],
      thumbnail_url: product.thumbnailUrl || null,
      status: product.quantity > 0 ? (product.status === "SOLD" ? "SOLD" : "Available") : "Out of Stock",
    };

    let resultData: any;

    if (product.id && !product.id.startsWith("prod-")) {
      // Update existing record
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select()
        .single();

      if (error) throw new Error(`Supabase saveProduct update failed: ${error.message}`);
      resultData = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from("products")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Supabase saveProduct insert failed: ${error.message}`);
      resultData = data;
    }

    notifyListeners();

    return {
      id: resultData.id,
      shop_id: resultData.shop_id,
      category: resultData.category as Category,
      brand: resultData.manufacturer || "Other",
      model: resultData.model,
      storage: resultData.storage || "N/A",
      ram: resultData.ram || undefined,
      colour: resultData.colour || undefined,
      quantity: resultData.quantity,
      sellingPrice: Number(resultData.price || 0),
      batteryHealth: resultData.battery_health || undefined,
      warranty: resultData.warranty || "No Warranty",
      condition: Array.isArray(resultData.condition_tags) ? resultData.condition_tags : [],
      productVideo: resultData.video_url || undefined,
      productImages: Array.isArray(resultData.image_urls) ? resultData.image_urls : [],
      thumbnailUrl: resultData.thumbnail_url || undefined,
      status: resultData.quantity > 0 ? (resultData.status === "SOLD" ? "SOLD" : "Available") : "Out of Stock",
      createdAt: resultData.created_at
    };
  },

  deleteProduct: async (shopId: string, id: string): Promise<void> => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      console.error("Supabase deleteProduct error:", error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }
    notifyListeners();
  },

  // ------------------- SALES -------------------
  getSales: async (shopId: string): Promise<Sale[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          products ( model, manufacturer, storage ),
          customers ( full_name, phone_number )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching sales from Supabase:", error);
        return [];
      }

      return (data || []).map((s: any) => {
        const prodName = s.products 
          ? `${s.products.manufacturer || ''} ${s.products.model || ''} (${s.products.storage || ''})`.trim()
          : "Device Item";

        const custName = s.customers?.full_name || "Walk-in Customer";
        const custPhone = s.customers?.phone_number || "";

        return {
          id: s.id,
          shop_id: s.shop_id,
          productId: s.product_id || "",
          productName: prodName,
          quantity: s.quantity || 1,
          unitPrice: Number(s.selling_price || 0),
          totalAmount: Number(s.selling_price || 0) * (s.quantity || 1),
          paymentMethod: "Transfer",
          customerName: custName,
          customerPhone: custPhone,
          soldBy: s.sold_by || "Owner",
          createdAt: s.created_at,
          status: "Completed"
        };
      });
    } catch (err) {
      console.error("Supabase getSales exception:", err);
      return [];
    }
  },

  saveSale: async (sale: {
    shop_id: string;
    productId: string;
    productName?: string;
    quantity: number;
    sellingPrice: number;
    soldBy: string;
    customerName: string;
    customerPhone: string;
  }): Promise<Sale> => {
    // 1. Check or create customer
    let customerId: string | null = null;
    if (sale.customerPhone.trim()) {
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id, total_spent")
        .eq("shop_id", sale.shop_id)
        .eq("phone_number", sale.customerPhone.trim())
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
        const newTotalSpent = Number(existingCust.total_spent || 0) + (sale.sellingPrice * sale.quantity);
        await supabase
          .from("customers")
          .update({ total_spent: newTotalSpent })
          .eq("id", customerId);
      } else {
        const { data: newCust } = await supabase
          .from("customers")
          .insert([{
            shop_id: sale.shop_id,
            full_name: sale.customerName || "Walk-in Customer",
            phone_number: sale.customerPhone.trim(),
            total_spent: sale.sellingPrice * sale.quantity,
            notes: `Bought ${sale.productName || "Product"}`
          }])
          .select()
          .single();

        if (newCust) customerId = newCust.id;
      }
    }

    // 2. Insert Sale record
    const { data: saleData, error: saleErr } = await supabase
      .from("sales")
      .insert([{
        shop_id: sale.shop_id,
        product_id: sale.productId,
        customer_id: customerId,
        quantity: sale.quantity,
        selling_price: sale.sellingPrice,
        sold_by: sale.soldBy || "Owner"
      }])
      .select()
      .single();

    if (saleErr) {
      throw new Error(`Failed to record sale in Supabase: ${saleErr.message}`);
    }

    // 3. Update Product stock quantity in Supabase
    const { data: prodData } = await supabase
      .from("products")
      .select("quantity")
      .eq("id", sale.productId)
      .single();

    if (prodData) {
      const updatedQty = Math.max(0, (prodData.quantity || 1) - sale.quantity);
      const updatedStatus = updatedQty > 0 ? "Available" : "Out of Stock";
      await supabase
        .from("products")
        .update({
          quantity: updatedQty,
          status: updatedStatus
        })
        .eq("id", sale.productId);
    }

    notifyListeners();

    return {
      id: saleData.id,
      shop_id: saleData.shop_id,
      productId: saleData.product_id,
      productName: sale.productName || "Device",
      quantity: saleData.quantity,
      unitPrice: Number(saleData.selling_price),
      totalAmount: Number(saleData.selling_price) * saleData.quantity,
      paymentMethod: "Transfer",
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      soldBy: saleData.sold_by,
      createdAt: saleData.created_at,
      status: "Completed"
    };
  },

  // ------------------- CUSTOMERS -------------------
  getCustomers: async (shopId: string): Promise<Customer[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching customers from Supabase:", error);
        return [];
      }

      return (data || []).map((c: any) => ({
        id: c.id,
        shop_id: c.shop_id,
        name: c.full_name,
        phoneNumber: c.phone_number,
        purchaseCount: 1,
        totalSpent: Number(c.total_spent || 0),
        notes: c.notes || "",
        createdAt: c.created_at
      }));
    } catch (err) {
      console.error("Supabase getCustomers exception:", err);
      return [];
    }
  },

  saveCustomer: async (customer: Customer): Promise<Customer> => {
    const payload = {
      shop_id: customer.shop_id,
      full_name: customer.name,
      phone_number: customer.phoneNumber,
      notes: customer.notes || "",
      total_spent: customer.totalSpent || 0
    };

    if (customer.id && !customer.id.startsWith("cust-")) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customer.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update customer: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        name: data.full_name,
        phoneNumber: data.phone_number,
        purchaseCount: 1,
        totalSpent: Number(data.total_spent || 0),
        notes: data.notes || "",
        createdAt: data.created_at
      };
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Failed to create customer: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        name: data.full_name,
        phoneNumber: data.phone_number,
        purchaseCount: 1,
        totalSpent: Number(data.total_spent || 0),
        notes: data.notes || "",
        createdAt: data.created_at
      };
    }
  },

  // ------------------- STAFF -------------------
  getStaff: async (shopId: string): Promise<Staff[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching staff from Supabase:", error);
        return [];
      }

      return (data || []).map((s: any) => ({
        id: s.id,
        shop_id: s.shop_id,
        fullName: s.full_name,
        phoneNumber: s.phone_number,
        role: s.role || "Sales Specialist",
        status: (s.status as "Active" | "Suspended") || "Active",
        permissions: s.permissions || {},
        createdAt: s.created_at
      }));
    } catch (err) {
      console.error("Supabase getStaff exception:", err);
      return [];
    }
  },

  saveStaff: async (member: Staff): Promise<Staff> => {
    const payload = {
      shop_id: member.shop_id,
      full_name: member.fullName,
      phone_number: member.phoneNumber,
      role: member.role || "Sales Specialist",
      status: member.status || "Active",
      permissions: member.permissions || {}
    };

    if (member.id && !member.id.startsWith("staff-")) {
      const { data, error } = await supabase
        .from("staff")
        .update(payload)
        .eq("id", member.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update staff: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        role: data.role,
        status: data.status,
        permissions: data.permissions,
        createdAt: data.created_at
      };
    } else {
      const { data, error } = await supabase
        .from("staff")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Failed to create staff: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        role: data.role,
        status: data.status,
        permissions: data.permissions,
        createdAt: data.created_at
      };
    }
  },

  deleteStaff: async (shopId: string, id: string): Promise<void> => {
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) throw new Error(`Failed to delete staff: ${error.message}`);
    notifyListeners();
  },

  // ------------------- REPAIRS -------------------
  getRepairs: async (shopId: string): Promise<Repair[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("repairs")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching repairs from Supabase:", error);
        return [];
      }

      return (data || []).map((r: any) => ({
        id: r.id,
        shop_id: r.shop_id,
        customer_id: r.customer_id,
        deviceName: r.device_name,
        issue: r.issue,
        repairStatus: r.repair_status || "Pending",
        notes: r.notes || "",
        createdAt: r.created_at
      }));
    } catch (err) {
      console.error("Supabase getRepairs exception:", err);
      return [];
    }
  },

  saveRepair: async (repair: Partial<Repair> & { shop_id: string; deviceName: string; issue: string }): Promise<Repair> => {
    const payload = {
      shop_id: repair.shop_id,
      customer_id: repair.customer_id || null,
      device_name: repair.deviceName,
      issue: repair.issue,
      repair_status: repair.repairStatus || "Pending",
      notes: repair.notes || ""
    };

    if (repair.id && !repair.id.startsWith("rep-")) {
      const { data, error } = await supabase
        .from("repairs")
        .update(payload)
        .eq("id", repair.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update repair: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        customer_id: data.customer_id,
        deviceName: data.device_name,
        issue: data.issue,
        repairStatus: data.repair_status,
        notes: data.notes,
        createdAt: data.created_at
      };
    } else {
      const { data, error } = await supabase
        .from("repairs")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Failed to create repair: ${error.message}`);
      notifyListeners();
      return {
        id: data.id,
        shop_id: data.shop_id,
        customer_id: data.customer_id,
        deviceName: data.device_name,
        issue: data.issue,
        repairStatus: data.repair_status,
        notes: data.notes,
        createdAt: data.created_at
      };
    }
  },

  // ------------------- AUDIT LOGS & NOTIFICATIONS -------------------
  getAuditLogs: async (shopId: string): Promise<AuditLog[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return [];

      return (data || []).map((l: any) => ({
        id: l.id,
        shop_id: l.shop_id,
        userId: l.user_id,
        userName: l.user_name,
        action: l.action,
        details: l.details,
        createdAt: l.created_at
      }));
    } catch (err) {
      return [];
    }
  },

  addAuditLog: async (shopId: string, userName: string, userId: string, action: string, details: string): Promise<void> => {
    await supabase.from("audit_logs").insert([{
      shop_id: shopId,
      user_id: userId,
      user_name: userName,
      action,
      details
    }]);
  },

  getNotifications: async (shopId: string): Promise<AppNotification[]> => {
    if (!shopId) return [];
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) return [];

      return (data || []).map((n: any) => ({
        id: n.id,
        shop_id: n.shop_id,
        title: n.title,
        message: n.message,
        type: n.type as any,
        read: n.read,
        createdAt: n.created_at
      }));
    } catch (err) {
      return [];
    }
  },

  addNotification: async (shopId: string, title: string, message: string, type: "info" | "success" | "warning" | "error"): Promise<void> => {
    await supabase.from("notifications").insert([{
      shop_id: shopId,
      title,
      message,
      type
    }]);
  }
};

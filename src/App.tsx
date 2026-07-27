import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, subscribeToDBUpdates } from "./lib/database";
import { supabase } from "./lib/supabase";
import { Product, Sale, Customer, Staff, Shop, AppNotification } from "./types";
import { createProduct, updateProduct, deleteProduct, recordSale, reverseSale, saveCustomer } from "./lib/services";
import DashboardOverview from "./components/DashboardOverview";

const InventoryManager = lazy(() => import("./components/InventoryManager"));
const SalesManager = lazy(() => import("./components/SalesManager"));
const CustomerManager = lazy(() => import("./components/CustomerManager"));
const ReportsManager = lazy(() => import("./components/ReportsManager"));
const StaffManager = lazy(() => import("./components/StaffManager"));
const WebsiteSettings = lazy(() => import("./components/WebsiteSettings"));
const SettingsSubscription = lazy(() => import("./components/SettingsSubscription"));
const WhatsAppEmulator = lazy(() => import("./components/WhatsAppEmulator"));
const ResellerWebsite = lazy(() => import("./components/ResellerWebsite"));

import { Package, ShoppingCart, Users, FileText, Globe, Key, Bell, Smartphone, LogOut, Check, Sparkles, LayoutDashboard, Settings, Lock, TriangleAlert as AlertTriangle, Menu, X, ArrowUpRight } from "lucide-react";

export default function App() {
  // ----------------------------------------------------
  // ROUTER STATE (Handles /#/shop/:slug or standard view)
  // ----------------------------------------------------
  const [currentPath, setCurrentPath] = useState(window.location.hash || "#/");

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash || "#/");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Parse path to check if we are visiting a public reseller storefront
  const isPublicWebsitePath = currentPath.startsWith("#/shop/");
  const publicShopSlug = isPublicWebsitePath ? currentPath.replace("#/shop/", "").split("?")[0] : "";

  // ----------------------------------------------------
  // DATABASE SUBSCRIPTIONS & SUPABASE SYNC
  // ----------------------------------------------------
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);

  // Reactive DB States
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Expiry lock state
  const [isSimulatedExpired, setIsSimulatedExpired] = useState(false);

  // Async state sync from Supabase
  const syncStates = useCallback(async () => {
    try {
      const updatedShops = await db.getShops();
      setShops(updatedShops);

      const savedShopId = localStorage.getItem("restockr_currentShopId");
      let activeShop = updatedShops.find(s => s.id === (currentShop?.id || savedShopId)) || updatedShops[0] || null;

      setCurrentShop(activeShop);

      if (activeShop) {
        const [prods, sls, custs, stff, notifs] = await Promise.all([
          db.getProducts(activeShop.id),
          db.getSales(activeShop.id),
          db.getCustomers(activeShop.id),
          db.getStaff(activeShop.id),
          db.getNotifications(activeShop.id)
        ]);

        setProducts(prods);
        setSales(sls);
        setCustomers(custs);
        setStaff(stff);
        setNotifications(notifs);
      } else {
        setProducts([]);
        setSales([]);
        setCustomers([]);
        setStaff([]);
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error syncing states from Supabase:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [currentShop?.id]);

  useEffect(() => {
    syncStates();
    const unsubscribe = subscribeToDBUpdates(() => {
      syncStates();
    });
    return () => unsubscribe();
  }, [syncStates]);

  // ----------------------------------------------------
  // OWNER AUTH STATE (Shop Username + Password)
  // ----------------------------------------------------
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("restockr_isLoggedIn") === "true");
  const [authMode, setAuthMode] = useState<"select" | "signin" | "register">("select");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("restockr_isLoggedIn", isLoggedIn ? "true" : "false");
    if (isLoggedIn && currentShop) {
      localStorage.setItem("restockr_currentShopId", currentShop.id);
    } else {
      localStorage.removeItem("restockr_currentShopId");
    }
  }, [isLoggedIn, currentShop?.id]);

  // Check for existing Supabase session on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const username = session.user.email?.replace("@restockr.shop", "") || "";
        if (username) {
          const fetchedShops = await db.getShops();
          const matchedShop = fetchedShops.find(s => s.slug === username);
          if (matchedShop) {
            setCurrentShop(matchedShop);
            setIsLoggedIn(true);
            setActiveModule("dashboard");
          }
        }
      }
    })();
  }, []);

  // Registration states
  const [regShopName, setRegShopName] = useState("");
  const [regShopSlug, setRegShopSlug] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regWhatsApp, setRegWhatsApp] = useState("");

  const handleShopNameChange = (name: string) => {
    setRegShopName(name);
    const suggestedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setRegShopSlug(suggestedSlug);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      setLoginError("Username and password cannot be left blank.");
      return;
    }

    setAuthLoading(true);
    setLoginError("");

    try {
      const sanitizedSlug = authUsername.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      const syntheticEmail = `${sanitizedSlug}@restockr.shop`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: authPassword,
      });

      if (error) {
        setLoginError(error.message === "Invalid login credentials" ? "Invalid username or password." : error.message);
        setAuthLoading(false);
        return;
      }

      const fetchedShops = await db.getShops();
      const matchedShop = fetchedShops.find(s => s.slug === sanitizedSlug);

      if (!matchedShop) {
        setLoginError("No registered shop found for this username.");
        await supabase.auth.signOut();
        setAuthLoading(false);
        return;
      }

      setCurrentShop(matchedShop);
      setIsLoggedIn(true);
      setLoginError("");
      setActiveModule("dashboard");
      await syncStates();
    } catch (err: any) {
      setLoginError(err.message || "Login failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regShopName.trim() || !regShopSlug.trim() || !regPassword.trim() || !regWhatsApp.trim()) {
      setLoginError("All fields are required to register your store.");
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    const sanitizedSlug = regShopSlug.trim().toLowerCase();
    if (!slugRegex.test(sanitizedSlug)) {
      setLoginError("Store link can only contain lowercase letters, numbers, and hyphens.");
      return;
    }

    setAuthLoading(true);
    setLoginError("");

    try {
      const fetchedShops = await db.getShops();
      if (fetchedShops.some(s => s.slug === sanitizedSlug)) {
        setLoginError("This store link / username is already taken.");
        setAuthLoading(false);
        return;
      }

      const syntheticEmail = `${sanitizedSlug}@restockr.shop`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: regPassword,
      });

      if (authError) {
        setLoginError(authError.message);
        setAuthLoading(false);
        return;
      }

      const createdShop = await db.saveShop({
        name: regShopName.trim(),
        slug: sanitizedSlug,
        ownerEmail: syntheticEmail,
        whatsappNumber: regWhatsApp.trim(),
        subscriptionPlan: "Free Trial",
        subscriptionStatus: "Active",
        websiteSettings: {
          showSoldProducts: true,
          showPrices: true,
          enableVideoDownloads: true,
          enableImageDownloads: true,
          customThemeColor: "#0d9488"
        }
      });

      await db.addAuditLog(
        createdShop.id,
        "Owner",
        "Owner",
        "Shop Setup",
        `Restockr account for ${createdShop.name} was successfully registered.`
      );

      await db.addNotification(
        createdShop.id,
        "Welcome to Restockr",
        `Welcome to Restockr, ${createdShop.name}! Your workspace is active and ready to use.`,
        "success"
      );

      setCurrentShop(createdShop);
      setIsLoggedIn(true);
      setLoginError("");
      setActiveModule("dashboard");
      await syncStates();
    } catch (err: any) {
      setLoginError(`Registration failed: ${err.message || err}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    resetQuickActions();
    setAuthUsername("");
    setAuthPassword("");
    setRegShopName("");
    setRegShopSlug("");
    setRegPassword("");
    setRegWhatsApp("");
    setAuthMode("select");
  };

  // ----------------------------------------------------
  // MODULES NAVIGATION & QUICK ACTIONS
  // ----------------------------------------------------
  const [activeModule, setActiveModule] = useState<string>(() => localStorage.getItem("restockr_activeModule") || "dashboard");

  useEffect(() => {
    localStorage.setItem("restockr_activeModule", activeModule);
  }, [activeModule]);

  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showAddProductWizard, setShowAddProductWizard] = useState(false);
  const [showSellProductWizard, setShowSellProductWizard] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const resetQuickActions = () => {
    setShowAddProductWizard(false);
    setShowSellProductWizard(false);
  };

  const handleQuickAction = (action: "add_product" | "sell_product") => {
    resetQuickActions();
    if (action === "add_product") {
      setActiveModule("inventory");
      setShowAddProductWizard(true);
    } else if (action === "sell_product") {
      setActiveModule("sales");
      setShowSellProductWizard(true);
    }
  };

  // ----------------------------------------------------
  // RENDER SELECTION: PUBLIC SITE VS. DASHBOARD
  // ----------------------------------------------------

  if (isPublicWebsitePath) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white text-sm font-mono animate-pulse">Loading storefront...</div>}>
        <ResellerWebsite 
          shopSlug={publicShopSlug} 
        />
      </Suspense>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center p-4 select-none relative overflow-hidden text-white" id="owner-login-screen">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#FFF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

        <div className="text-center mb-8 space-y-2 animate-fade-in">
          <h1 className="font-display font-black text-4xl text-white tracking-tight flex items-center justify-center gap-2 uppercase">
            RESTOCKR <span className="bg-teal-500 text-[#0A0A0A] text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded tracking-widest font-black">v2.0</span>
          </h1>
          <p className="text-sm text-[#B7BCC7] font-sans">The Operating System for Nigerian Phone & Gadget Stores</p>
        </div>

        {authMode === "select" && (
          <div className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[22px] p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-scale-up z-10 text-center" id="auth-select-container">
            <div className="space-y-3 border-b border-[#2A2A2A] pb-6">
              <div className="mx-auto w-12 h-12 bg-[#121212] border border-[#2A2A2A] rounded-2xl flex items-center justify-center text-teal-400">
                <Key className="w-6 h-6" />
              </div>
              <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Welcome to Restockr</h2>
              <p className="text-xs text-[#B7BCC7] leading-relaxed">
                Empower your business with a live production catalog, staff permissions, and integrated WhatsApp assistant.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <button
                onClick={() => {
                  setAuthMode("register");
                  setLoginError("");
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-b from-[#565656] to-[#3A3A3A] border border-[#555555] text-white hover:from-[#666666] hover:to-[#464646] rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
                id="btn-goto-register"
              >
                <Sparkles className="w-4 h-4 text-white" />
                Create Shop
              </button>

              <button
                onClick={() => {
                  setAuthMode("signin");
                  setLoginError("");
                }}
                className="w-full py-3.5 px-4 bg-[#121212] border border-[#2A2A2A] hover:bg-zinc-800 text-white rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                id="btn-goto-signin"
              >
                <Lock className="w-4 h-4 text-[#B7BCC7]" />
                Sign In
              </button>
            </div>

            <p className="text-[10px] text-[#B7BCC7]/60 leading-normal">
              Secure access to your store management workspace.
            </p>
          </div>
        )}

        {authMode === "signin" && (
          <div className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[22px] p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-scale-up z-10 text-white" id="login-form-container">
            <div className="space-y-1.5 border-b border-[#2A2A2A] pb-4 flex justify-between items-start">
              <div>
                <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Sign In</h2>
                <p className="text-xs text-[#B7BCC7]">Enter your shop username and password.</p>
              </div>
              <button
                onClick={() => {
                  setAuthMode("select");
                  setLoginError("");
                }}
                className="text-xs font-bold font-display uppercase tracking-wider text-[#B7BCC7] hover:text-white flex items-center gap-1 hover:underline"
              >
                Back
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-xl text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block">
                  Shop Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kanogadgets"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="w-full px-3 py-2.5 bg-black border border-[#2A2A2A] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-[#2A2A2A] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-mono"
                />
              </div>

              <button
                type="submit"
                id="btn-owner-login"
                disabled={authLoading}
                className="w-full py-3.5 bg-gradient-to-b from-[#565656] to-[#3A3A3A] border border-[#555555] text-white rounded-xl text-xs font-bold font-display uppercase tracking-wider hover:scale-[0.98] transition-transform cursor-pointer shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? "Signing in..." : "Enter Workspace"} {!authLoading && <ArrowUpRight className="w-4 h-4 text-white/60" />}
              </button>
            </form>
          </div>
        )}

        {authMode === "register" && (
          <div className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[22px] p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-scale-up z-10 text-white" id="register-form-container">
            <div className="space-y-1.5 border-b border-[#2A2A2A] pb-4 flex justify-between items-start">
              <div>
                <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Create New Shop</h2>
                <p className="text-xs text-[#B7BCC7]">Launch your store on Restockr.</p>
              </div>
              <button
                onClick={() => {
                  setAuthMode("select");
                  setLoginError("");
                }}
                className="text-xs font-bold font-display uppercase tracking-wider text-[#B7BCC7] hover:text-white flex items-center gap-1 hover:underline"
              >
                Back
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-xl text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block">
                  Store / Business Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kano Gadgets"
                  value={regShopName}
                  onChange={(e) => handleShopNameChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-[#2A2A2A] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block">
                  Shop Username
                </label>
                <div className="flex items-center bg-black border border-[#2A2A2A] rounded-xl overflow-hidden px-3 focus-within:ring-1 focus-within:ring-teal-500">
                  <input
                    type="text"
                    required
                    placeholder="kanogadgets"
                    value={regShopSlug}
                    onChange={(e) => setRegShopSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 py-2.5 text-sm focus:outline-none text-white font-mono bg-transparent"
                  />
                  <span className="text-xs text-[#B7BCC7] font-mono">.restockr.app</span>
                </div>
                <p className="text-[9px] text-[#B7BCC7]/60">This is your login username and store link.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block">
                  Set Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-[#2A2A2A] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[#B7BCC7] uppercase tracking-wider block flex items-center justify-between">
                  <span>WhatsApp Number</span>
                  <span className="text-[9px] text-[#B7BCC7]/60 lowercase font-normal">(with country code)</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +2348031234567"
                  value={regWhatsApp}
                  onChange={(e) => setRegWhatsApp(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-[#2A2A2A] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-mono"
                />
              </div>

              <button
                type="submit"
                id="btn-owner-register"
                disabled={authLoading}
                className="w-full py-3.5 bg-gradient-to-b from-[#565656] to-[#3A3A3A] border border-[#555555] text-white rounded-xl text-xs font-bold font-display uppercase tracking-wider hover:scale-[0.98] transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? "Creating..." : "Register & Open Shop"} {!authLoading && <Sparkles className="w-4 h-4 text-white/60" />}
              </button>
            </form>
          </div>
        )}

        <p className="text-[10px] font-mono text-[#B7BCC7]/40 mt-12 uppercase tracking-widest">
          RESTOCKR v2.0 • Store Management OS
        </p>

      </div>
    );
  }

  if (isLoadingData || !currentShop) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <p className="text-sm text-[#B7BCC7] animate-pulse font-mono">Loading your store workspace...</p>
      </div>
    );
  }

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col font-sans text-white select-none" id="owner-app-dashboard">
      
      {/* 1. APP BAR HEADER */}
      <header className="bg-[#121212]/90 backdrop-blur border-b border-[#2A2A2A] px-6 py-4 flex justify-between items-center shrink-0 z-40 sticky top-0 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="md:hidden p-1.5 hover:bg-[#1B1B1B] rounded-lg text-white cursor-pointer"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-teal-500 text-[#0A0A0A] rounded-lg flex items-center justify-center font-display font-black text-xs">
              R
            </span>
            <h1 className="font-display font-black text-lg tracking-tight text-white uppercase flex items-center gap-1.5">
              RESTOCKR <span className="text-[10px] bg-[#1B1B1B] border border-[#2A2A2A] text-teal-400 font-mono font-bold px-1.5 py-0.5 rounded uppercase">PROD</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-[#1B1B1B] border border-[#2A2A2A] rounded-xl px-3.5 py-1.5 text-xs text-white font-bold">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0 animate-pulse" />
            <span>Store: {currentShop.name}</span>
          </div>

          <div className="relative">
            <button
              onClick={async () => {
                setShowNotifDropdown(!showNotifDropdown);
                const freshNotifs = await db.getNotifications(currentShop.id);
                setNotifications(freshNotifs);
              }}
              className="p-2.5 bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-[#2A2A2A] rounded-xl text-[#B7BCC7] hover:text-white relative cursor-pointer transition-colors"
              title="Recent alerts"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
              )}
            </button>

            {showNotifDropdown && (
              <div className="fixed md:absolute left-4 right-4 md:left-auto md:right-0 mt-2 top-[72px] md:top-auto md:w-80 bg-[#1B1B1B] border border-[#2A2A2A] rounded-2xl shadow-2xl z-50 p-4 divide-y divide-[#2A2A2A] animate-fade-in text-xs max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center pb-2 mb-2">
                  <span className="font-display font-black text-white uppercase tracking-tight">Workspace Alerts</span>
                  <button
                    onClick={() => setShowNotifDropdown(false)}
                    className="text-[10px] text-[#B7BCC7] hover:text-white font-bold uppercase font-display"
                  >
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[#B7BCC7]/60">No recent alerts.</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="py-2.5 space-y-1">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          notif.type === "success" ? "bg-teal-500" : notif.type === "warning" ? "bg-amber-500" : "bg-teal-500/60"
                        }`} />
                        {notif.title}
                      </p>
                      <p className="text-[#B7BCC7] text-[11px] leading-relaxed pl-3">{notif.message}</p>
                      <p className="text-[9px] text-[#B7BCC7]/40 font-mono pl-3">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsWhatsAppOpen(!isWhatsAppOpen)}
            className={`p-2.5 rounded-xl text-xs font-bold font-display uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
              isWhatsAppOpen 
                ? "bg-[#075E54] text-white" 
                : "bg-[#075E54]/10 text-[#075E54] hover:bg-[#075E54]/20 border border-[#075E54]/30"
            }`}
            title="Toggle WhatsApp Assistant Emulator"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">WhatsApp Emulator</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2.5 bg-[#1B1B1B] border border-[#2A2A2A] hover:bg-rose-950/30 text-[#B7BCC7] hover:text-rose-400 rounded-xl cursor-pointer transition-colors"
            title="Log out of active session"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* 2. MAIN APPLICATION CONTENT WRAPPER */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SIDEBAR NAVIGATION RAIL */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 w-64 bg-[#121212] border-r border-[#2A2A2A] z-40 transition-transform duration-300 md:translate-x-0 shrink-0
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <div className="flex flex-col h-full justify-between p-4 bg-[#121212]" id="sidebar-box">
            
            <nav className="space-y-1.5" id="nav-rail">
              <button
                onClick={() => { setActiveModule("dashboard"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "dashboard" 
                    ? "bg-teal-500 text-black shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" /> Dashboard
              </button>

              <button
                onClick={() => { setActiveModule("inventory"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "inventory" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <Package className="w-4 h-4 shrink-0" /> Inventory
              </button>

              <button
                onClick={() => { setActiveModule("sales"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "sales" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <ShoppingCart className="w-4 h-4 shrink-0" /> Sales
              </button>

              <button
                onClick={() => { setActiveModule("customers"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "customers" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" /> Customers
              </button>

              <button
                onClick={() => { setActiveModule("reports"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "reports" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" /> Reports
              </button>

              <button
                onClick={() => { setActiveModule("website"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "website" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <Globe className="w-4 h-4 shrink-0" /> Website
              </button>

              <button
                onClick={() => { setActiveModule("staff"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "staff" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" /> Staff
              </button>

              <button
                onClick={() => { setActiveModule("subscription"); resetQuickActions(); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider text-left transition-all cursor-pointer ${
                  activeModule === "subscription" 
                    ? "bg-teal-500 text-[#0A0A0A] shadow-lg shadow-teal-500/10 font-black" 
                    : "text-[#B7BCC7] hover:bg-[#1B1B1B] hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" /> Settings
              </button>
            </nav>

            <div className="border-t border-[#2A2A2A] pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 p-1 text-xs">
                <span className="w-8 h-8 rounded-full bg-teal-500 text-[#0A0A0A] font-display font-black flex items-center justify-center text-xs uppercase">
                  {currentShop.name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{currentShop.name}</p>
                  <p className="text-[10px] text-[#B7BCC7]/60 font-mono truncate">{currentShop.ownerEmail}</p>
                </div>
              </div>
              <a 
                href={`/#/shop/${currentShop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center py-2 bg-[#1B1B1B] hover:bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl text-[10px] font-bold font-display uppercase tracking-wider text-white flex items-center justify-center gap-1"
              >
                <span>View Store Catalog</span> <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
              </a>
            </div>

          </div>
        </aside>

        {/* ACTIVE MODULE CONTAINER VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative bg-[#0F1115]">
          {isSimulatedExpired && (
            <div className="bg-rose-950/40 border border-rose-900 p-4 rounded-2xl mb-6 flex items-start gap-3 text-xs text-rose-300 animate-pulse">
              <Lock className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider font-mono">⚠️ RESTOCKR SYSTEM SUSPENDED (Expired Plan)</p>
                <p className="text-rose-400">
                  Your store subscription has expired. This workspace is locked in <b>read-only mode</b>.
                </p>
              </div>
            </div>
          )}

          <div className={`${isSimulatedExpired ? "pointer-events-none opacity-85" : ""}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm font-mono">Loading module...</div>}>
                {activeModule === "dashboard" && (
                  <DashboardOverview
                    products={products}
                    sales={sales}
                    staff={staff}
                    unreadNotificationsCount={unreadNotificationsCount}
                    onNavigate={(m) => setActiveModule(m)}
                    onQuickAction={handleQuickAction}
                  />
                )}

                {activeModule === "inventory" && (
                  <InventoryManager
                    shopId={currentShop.id}
                    shop={currentShop}
                    products={products}
                    onSaveProduct={async (p) => {
                      const isNew = !p.id || p.id.startsWith("prod-");
                      if (isNew) await createProduct(p, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      else await updateProduct(p, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      syncStates();
                    }}
                    onDeleteProduct={async (id) => {
                      const prod = products.find(p => p.id === id);
                      await deleteProduct(id, prod ? `${prod.brand} ${prod.model}` : "Product", { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      syncStates();
                    }}
                    onSaveSale={async (sale) => {
                      await recordSale({ ...sale, shop_id: currentShop.id, sellingPrice: sale.unitPrice }, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      syncStates();
                    }}
                    showAddFormImmediately={showAddProductWizard}
                    onCloseQuickForm={() => setShowAddProductWizard(false)}
                  />
                )}

                {activeModule === "sales" && (
                  <SalesManager
                    products={products}
                    sales={sales}
                    shop={currentShop}
                    onSaveSale={async (sale) => {
                      await recordSale({ ...sale, shop_id: currentShop.id, sellingPrice: sale.unitPrice }, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      syncStates();
                    }}
                    onUndoSale={async (id, perf) => {
                      await reverseSale(currentShop.id, id, { shopId: currentShop.id, userId: "Owner", userName: perf || "Owner" });
                      syncStates();
                    }}
                    onRequestNavigateToInventory={() => setActiveModule("inventory")}
                  />
                )}

                {activeModule === "customers" && (
                  <CustomerManager
                    customers={customers}
                    onSaveCustomer={async (c) => {
                      await saveCustomer({ ...c, shop_id: currentShop.id } as Customer, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                      syncStates();
                    }}
                  />
                )}

                {activeModule === "reports" && (
                  <ReportsManager
                    products={products}
                    sales={sales}
                  />
                )}

                {activeModule === "website" && (
                  <WebsiteSettings
                    shop={currentShop}
                    onSaveSettings={async (settings) => {
                      await db.saveShop({ ...currentShop, websiteSettings: settings });
                      syncStates();
                    }}
                    onSaveProfile={async (profile) => {
                      await db.saveShop({ ...currentShop, name: profile.name, logoUrl: profile.logoUrl, whatsappNumber: profile.whatsappNumber });
                      syncStates();
                    }}
                  />
                )}

                {activeModule === "staff" && (
                  <StaffManager
                    shopId={currentShop.id}
                    staffList={staff}
                    onSaveStaff={async (member) => {
                      await db.saveStaff(member);
                      syncStates();
                    }}
                    onDeleteStaff={async (id) => {
                      await db.deleteStaff(currentShop.id, id);
                      syncStates();
                    }}
                  />
                )}

                {activeModule === "subscription" && (
                  <SettingsSubscription
                    shop={currentShop}
                    onUpdateSubscription={async (plan, status, expiry) => {
                      await db.saveShop({ ...currentShop, subscriptionPlan: plan, subscriptionStatus: status, subscriptionExpiry: expiry });
                      syncStates();
                    }}
                    onSimulateExpiryToggle={setIsSimulatedExpired}
                    isSimulatedExpired={isSimulatedExpired}
                  />
                )}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          {isSimulatedExpired && (
            <div className="absolute inset-0 bg-slate-950/10 cursor-not-allowed z-30 select-none" />
          )}
        </main>

        {/* 3. FLOATING WHATSAPP ASSISTANT SIDE-DRAWER */}
        {isWhatsAppOpen && (
          <aside className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-scale-up" id="whatsapp-phone-sidebar">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#075E54] text-white shrink-0 pt-7">
              <span className="text-xs font-mono font-bold">WHATSAPP NATIVE ASSISTANT</span>
              <button
                onClick={() => setIsWhatsAppOpen(false)}
                className="p-1 hover:bg-emerald-800 rounded-lg text-emerald-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#E5DDD5]">
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-500 text-sm font-mono">Loading assistant...</div>}>
              <WhatsAppEmulator
                shopId={currentShop.id}
                products={products}
                sales={sales}
                staffList={staff}
                onSaveSale={async (s) => {
                  await recordSale({ ...s, shop_id: currentShop.id, sellingPrice: s.unitPrice }, { shopId: currentShop.id, userId: "Owner", userName: "Owner" });
                  syncStates();
                }}
                onUndoLastSale={async (shopId, saleId, perf) => {
                  try {
                    await reverseSale(shopId, saleId, { shopId: currentShop.id, userId: perf || "Owner", userName: perf || "Owner" });
                    syncStates();
                    return { success: true, message: "✅ Sale reversed and stock restored successfully." };
                  } catch (err) {
                    return { success: false, message: `❌ Failed to reverse sale: ${err instanceof Error ? err.message : "Unknown error"}` };
                  }
                }}
                isExpired={isSimulatedExpired}
              />
              </Suspense>
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { Product, Sale } from "../types";
import { 
  FileText, Download, Printer, Package, Search, X, TrendingUp, CircleDollarSign, AlertTriangle, Layers, Calendar, ChevronRight
} from "lucide-react";

interface ReportsManagerProps {
  products: Product[];
  sales: Sale[];
}

export default function ReportsManager({
  products,
  sales
}: ReportsManagerProps) {
  const [reportType, setReportType] = useState<"inventory" | "sales">("inventory");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input automatically when open
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Statistics calculation
  const totalStockValue = products.reduce((acc, p) => acc + (p.sellingPrice * p.quantity), 0);
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const activeSales = sales.filter(s => s.status !== "Reversed");
  const totalRevenue = activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalUnitsSold = activeSales.reduce((acc, s) => acc + s.quantity, 0);

  const handleExportCSV = () => {
    let headers = [];
    let rows = [];
    let fileName = "";

    if (reportType === "inventory") {
      headers = ["ID", "Category", "Brand", "Model", "Storage", "Quantity", "Price (NGN)", "Battery", "Warranty", "Condition"];
      rows = products.map(p => [
        p.id,
        p.category,
        p.brand,
        p.model,
        p.storage,
        p.quantity,
        p.sellingPrice,
        p.batteryHealth || "N/A",
        p.warranty,
        p.condition.join(" | ")
      ]);
      fileName = `Restockr_Inventory_Report_${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      headers = ["ID", "Product Name", "Quantity", "Price (NGN)", "Total (NGN)", "Payment Method", "Customer Name", "Customer Phone", "Cashier", "Date"];
      rows = sales.map(s => [
        s.id,
        s.productName,
        s.quantity,
        s.unitPrice,
        s.totalAmount,
        s.paymentMethod,
        s.customerName,
        s.customerPhone,
        s.soldBy,
        new Date(s.createdAt).toLocaleDateString()
      ]);
      fileName = `Restockr_Sales_Report_${new Date().toISOString().split("T")[0]}.csv`;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.model.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.storage.toLowerCase().includes(q)
    );
  });

  const filteredSales = sales.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.productName.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.customerPhone.includes(q) ||
      s.paymentMethod.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in text-white p-1" id="reports-manager-module">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-zinc-900">
        <div>
          <span className="text-xs font-mono font-black tracking-widest text-zinc-500 uppercase">Audit & Logs</span>
          <h1 className="text-4xl font-display font-black uppercase tracking-tight text-white mt-1">
            Reports
          </h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setSearchQuery("");
              setIsSearchOpen(true);
            }}
            className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer shadow-md shrink-0"
            title="Search Report Items"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-5 py-3.5 rounded-xl font-bold font-display uppercase text-xs tracking-wider cursor-pointer shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-teal-400" /> Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-black px-5 py-3.5 rounded-xl font-bold font-display uppercase text-xs tracking-wider cursor-pointer shadow-lg transition-all"
          >
            <Printer className="w-4 h-4" /> Print Ledger
          </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider">Inventory Value</span>
            <CircleDollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-white">₦{totalStockValue.toLocaleString()}</p>
          <p className="text-[9px] text-zinc-500">Asset cost across all lines</p>
        </div>

        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-white">₦{totalRevenue.toLocaleString()}</p>
          <p className="text-[9px] text-zinc-500">Accumulated gross earnings</p>
        </div>

        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider">Stock Health</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-white">{outOfStockCount}</p>
          <p className="text-[9px] text-zinc-500">Product lines out of stock</p>
        </div>

        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider">Volume Sold</span>
            <Layers className="w-4 h-4 text-[#00C896]" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-white">{totalUnitsSold}</p>
          <p className="text-[9px] text-zinc-500">Total units processed in sales</p>
        </div>
      </div>

      {/* Reports Selector Toggles */}
      <div className="grid grid-cols-2 gap-4" id="report-type-grid">
        <button
          onClick={() => {
            setReportType("inventory");
            setSearchQuery("");
          }}
          className={`p-5 border-2 rounded-2xl flex items-center gap-4 transition-all cursor-pointer text-left ${
            reportType === "inventory"
              ? "bg-[#121212] text-white border-zinc-600 shadow-xl"
              : "bg-[#09090b] border-zinc-850 text-zinc-500 hover:border-zinc-800 shadow-sm"
          }`}
        >
          <div className={`p-3 rounded-xl shrink-0 ${reportType === "inventory" ? "bg-zinc-900 text-teal-400" : "bg-zinc-900 text-zinc-600"}`}>
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-xs text-white uppercase tracking-wider">Stock Ledger</h3>
            <p className="text-[10px] mt-0.5 text-zinc-500 font-mono">
              {products.length} Items • {products.reduce((acc, p) => acc + p.quantity, 0)} Units
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            setReportType("sales");
            setSearchQuery("");
          }}
          className={`p-5 border-2 rounded-2xl flex items-center gap-4 transition-all cursor-pointer text-left ${
            reportType === "sales"
              ? "bg-[#121212] text-white border-zinc-600 shadow-xl"
              : "bg-[#09090b] border-zinc-850 text-zinc-500 hover:border-zinc-800 shadow-sm"
          }`}
        >
          <div className={`p-3 rounded-xl shrink-0 ${reportType === "sales" ? "bg-zinc-900 text-teal-400" : "bg-zinc-900 text-zinc-600"}`}>
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-xs text-white uppercase tracking-wider">Sales Ledger</h3>
            <p className="text-[10px] mt-0.5 text-zinc-500 font-mono">
              {sales.length} Sales Logs • {sales.reduce((acc, s) => acc + s.quantity, 0)} Units Sold
            </p>
          </div>
        </button>
      </div>

      {/* Directory Content */}
      <div className="space-y-4" id="report-details-container">
        <h3 className="text-xs font-display font-black text-zinc-500 uppercase tracking-widest pl-1">
          {reportType === "inventory" ? "Active Inventory Directory" : "Historical Sales Directory"}
        </h3>

        {/* Inventory Report Type */}
        {reportType === "inventory" && (
          products.length === 0 ? (
            <p className="text-center text-zinc-500 text-xs py-10">No items available in the inventory database.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(p => (
                <div 
                  key={p.id} 
                  className="bg-[#121212] border border-zinc-850 hover:border-zinc-700 rounded-2xl p-5 transition-all shadow-md flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[9px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          {p.category}
                        </span>
                        <h4 className="font-display font-black text-white text-lg tracking-tight mt-1">{p.brand} {p.model}</h4>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">Storage: <span className="text-teal-400 font-semibold">{p.storage}</span></p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-black text-white text-lg">₦{p.sellingPrice.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Warranty: {p.warranty}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {p.condition.map(c => (
                        <span key={c} className="bg-zinc-950 border border-zinc-850 text-[9px] px-2 py-0.5 rounded font-mono font-bold text-zinc-400">
                          {c}
                        </span>
                      ))}
                      {p.batteryHealth && (
                        <span className="bg-zinc-950 border border-zinc-850 text-[9px] px-2 py-0.5 rounded font-mono font-bold text-teal-400">
                          BH: {p.batteryHealth}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-600 font-mono">ID: {p.id}</span>
                    <span className={`text-xs font-mono font-bold ${p.quantity === 0 ? "text-rose-400" : "text-teal-400"}`}>
                      {p.quantity === 0 ? "SOLD OUT" : `In stock: ${p.quantity} units`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Sales Report Type */}
        {reportType === "sales" && (
          sales.length === 0 ? (
            <p className="text-center text-zinc-500 text-xs py-10">No sales transactions processed yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sales.map(s => (
                <div 
                  key={s.id} 
                  className="bg-[#121212] border border-zinc-850 hover:border-zinc-700 rounded-2xl p-5 transition-all shadow-md flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[9px] bg-zinc-900 text-teal-400 border border-zinc-850 px-2 py-0.5 rounded font-mono font-bold">
                          {s.id.slice(0, 8).toUpperCase()}
                        </span>
                        <h4 className="font-display font-black text-white text-lg tracking-tight mt-1">{s.productName}</h4>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">Quantity sold: <span className="font-bold text-white">{s.quantity}</span></p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-black text-white text-lg">₦{s.totalAmount.toLocaleString()}</p>
                        {s.status === "Reversed" ? (
                          <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold uppercase">
                            Reversed
                          </span>
                        ) : (
                          <span className="text-[9px] bg-teal-400/10 text-teal-400 border border-teal-400/20 px-2 py-0.5 rounded font-bold uppercase">
                            {s.paymentMethod}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850 text-xs">
                      <p className="text-zinc-400">Buyer: <span className="font-semibold text-white">{s.customerName}</span></p>
                      <p className="text-zinc-500 font-mono text-[10px] mt-0.5">Phone: {s.customerPhone}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-600 font-mono">Agent: {s.soldBy}</span>
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* GLOBAL SEARCH OVERLAY MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6 overflow-y-auto animate-fade-in text-white">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div className="relative flex-1 mr-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-teal-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type device specifications, model, brand, or customer info..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent pl-14 pr-4 py-4 text-xl text-white focus:outline-none placeholder-zinc-600 font-sans tracking-wide"
                />
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
                Search Results ({reportType === "inventory" ? filteredProducts.length : filteredSales.length} Matches)
              </p>

              {reportType === "inventory" && (
                filteredProducts.length === 0 ? (
                  <div className="py-20 text-center text-zinc-500">
                    <Search className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="font-display font-semibold text-zinc-400">No stock products match your search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProducts.map((p) => (
                      <div 
                        key={p.id} 
                        className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl text-white"
                      >
                        <div>
                          <span className="text-[9px] bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded font-mono font-bold uppercase">
                            {p.category}
                          </span>
                          <h4 className="font-display font-black text-white text-base mt-1">{p.brand} {p.model}</h4>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">Storage Spec: {p.storage}</p>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">Warranty: {p.warranty}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-zinc-850 pt-3">
                          <span className="font-mono font-bold text-lg text-teal-400">₦{p.sellingPrice.toLocaleString()}</span>
                          <span className="text-xs text-zinc-500 font-mono font-bold">Qty: {p.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {reportType === "sales" && (
                filteredSales.length === 0 ? (
                  <div className="py-20 text-center text-zinc-500">
                    <Search className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="font-display font-semibold text-zinc-400">No sales transactions match your search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSales.map((s) => (
                      <div 
                        key={s.id} 
                        className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl text-white"
                      >
                        <div>
                          <span className="text-[9px] bg-zinc-950 text-teal-400 px-2 py-0.5 rounded font-mono font-bold">
                            {s.id.slice(0, 8).toUpperCase()}
                          </span>
                          <h4 className="font-display font-black text-white text-base mt-1">{s.productName}</h4>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">Buyer: <span className="text-white font-semibold">{s.customerName}</span> ({s.customerPhone})</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-zinc-850 pt-3">
                          <span className="font-mono font-bold text-lg text-white">₦{s.totalAmount.toLocaleString()}</span>
                          <span className="text-xs text-zinc-500 font-mono">{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

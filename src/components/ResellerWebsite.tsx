import React, { useState, useEffect, useMemo } from "react";
import { Product, Shop, Category } from "../types";
import { db } from "../lib/database";
import { supabase } from "../lib/supabase";
import { Download, Copy, Check, Video, Image as ImageIcon, Search, Phone, TriangleAlert as AlertTriangle, Sparkles, ArrowRight, Play, RefreshCw, X, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

interface ResellerWebsiteProps {
  shop?: Shop;
  products?: Product[];
  isExpired?: boolean;
  shopSlug?: string;
}

export default function ResellerWebsite({
  shop: propShop,
  products: propProducts,
  isExpired: propIsExpired,
  shopSlug
}: ResellerWebsiteProps) {
  const [loadedShop, setLoadedShop] = useState<Shop | null>(propShop || null);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>(propProducts || []);
  const [isLoading, setIsLoading] = useState(!propShop && Boolean(shopSlug));

  useEffect(() => {
    if (shopSlug) {
      db.getAvailableProductsBySlug(shopSlug).then(({ shop: s, products: p }) => {
        setLoadedShop(s);
        setLoadedProducts(p);
        setIsLoading(false);
      });
    }
  }, [shopSlug]);

  const shop = loadedShop || propShop;
  const products = shopSlug ? loadedProducts : (propProducts || []);
  const isExpired = propIsExpired || (shop ? shop.subscriptionStatus === "Expired" : false);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Full-screen media viewer (WhatsApp Status style)
  const [fullscreenMedia, setFullscreenMedia] = useState<{ type: "image" | "video"; url: string; images?: string[]; index?: number } | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterBrand, setFilterBrand] = useState<string>("All");
  const [filterStorage, setFilterStorage] = useState<string>("All");
  const [filterRam, setFilterRam] = useState<string>("All");
  const [filterCondition, setFilterCondition] = useState<string>("All");
  const [filterPriceMin, setFilterPriceMin] = useState<string>("");
  const [filterPriceMax, setFilterPriceMax] = useState<string>("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-zinc-400 font-mono">Loading reseller store catalog...</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-zinc-300">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h1 className="text-xl font-bold text-white">404: Storefront Not Found</h1>
        <p className="text-sm text-zinc-400 mt-1">We couldn't resolve the reseller domain *{shopSlug}*.restockr.app.</p>
        <a href="#/" className="mt-6 text-xs text-teal-400 hover:underline">Return to Restockr Main Login</a>
      </div>
    );
  }

  const handleCopyDetails = (product: Product) => {
    const parts: string[] = [product.model];
    if (product.condition && product.condition.length > 0) {
      parts.push(...product.condition);
    }
    if (shop.websiteSettings.showPrices) {
      parts.push(`₦${product.sellingPrice.toLocaleString()}`);
    }
    const text = parts.join(", ");
    navigator.clipboard.writeText(text);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = async (url: string, filename: string, productId: string) => {
    setDownloadError(null);
    setDownloadingId(productId);
    try {
      const path = url.replace(/.*\/storage\/v1\/object\/public\/(product-videos|product-images|shop-assets)\//, "");
      const bucket = url.includes("product-videos") ? "product-videos" : url.includes("product-images") ? "product-images" : "shop-assets";
      const { data: blob, error } = await supabase.storage.from(bucket).download(path);
      if (error || !blob) {
        throw new Error(error?.message || "Unable to fetch file from storage.");
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setDownloadError(`Download failed: ${err.message || "Unknown error"}. Please try again or contact the store.`);
      setTimeout(() => setDownloadError(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 text-white" id="website-expired-notice">
        <div className="max-w-md w-full bg-[#1B1B1B] p-8 rounded-3xl border border-[#2A2A2A] text-center space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/25">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">{shop.name}</h1>
            <p className="font-mono text-xs text-rose-400 font-bold uppercase tracking-widest">Temporarily Offline</p>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This shop's digital catalog is temporarily unavailable. If you are the store owner, please complete subscription renewal in your Restockr billing settings dashboard to restore immediate customer access.
          </p>
        </div>
      </div>
    );
  }

  // Derive filter options from products
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.brand));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const allStorages = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.storage));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const allRams = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.ram) set.add(p.ram); });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const allConditions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.condition?.forEach(c => set.add(c)));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const isToday = (createdAt?: string) => {
    if (!createdAt) return false;
    const d = new Date(createdAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const applyFilters = (list: Product[]) => {
    return list.filter(product => {
      const matchesSoldConstraint = shop.websiteSettings.showSoldProducts || product.quantity > 0;
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesSearch =
        product.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = filterBrand === "All" || product.brand === filterBrand;
      const matchesStorage = filterStorage === "All" || product.storage === filterStorage;
      const matchesRam = filterRam === "All" || (product.ram && product.ram === filterRam);
      const matchesCondition = filterCondition === "All" || (product.condition && product.condition.includes(filterCondition));
      const minPrice = filterPriceMin ? parseFloat(filterPriceMin) : 0;
      const maxPrice = filterPriceMax ? parseFloat(filterPriceMax) : Infinity;
      const matchesPrice = product.sellingPrice >= minPrice && product.sellingPrice <= maxPrice;

      return matchesSoldConstraint && matchesCategory && matchesSearch && matchesBrand && matchesStorage && matchesRam && matchesCondition && matchesPrice;
    });
  };

  const visibleProducts = applyFilters(products);
  const todayProducts = applyFilters(products.filter(p => isToday(p.createdAt)));

  const resetFilters = () => {
    setFilterBrand("All");
    setFilterStorage("All");
    setFilterRam("All");
    setFilterCondition("All");
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  const activeFilterCount = [filterBrand, filterStorage, filterRam, filterCondition].filter(f => f !== "All").length + (filterPriceMin ? 1 : 0) + (filterPriceMax ? 1 : 0);

  // Full-screen media navigation
  const closeFullscreen = () => setFullscreenMedia(null);
  const nextMedia = () => {
    if (!fullscreenMedia || !fullscreenMedia.images) return;
    const nextIdx = ((fullscreenMedia.index || 0) + 1) % fullscreenMedia.images.length;
    setFullscreenMedia({ ...fullscreenMedia, index: nextIdx, url: fullscreenMedia.images[nextIdx] });
  };
  const prevMedia = () => {
    if (!fullscreenMedia || !fullscreenMedia.images) return;
    const prevIdx = ((fullscreenMedia.index || 0) - 1 + fullscreenMedia.images.length) % fullscreenMedia.images.length;
    setFullscreenMedia({ ...fullscreenMedia, index: prevIdx, url: fullscreenMedia.images[prevIdx] });
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
      if (e.key === "ArrowRight" && fullscreenMedia?.images) nextMedia();
      if (e.key === "ArrowLeft" && fullscreenMedia?.images) prevMedia();
    };
    if (fullscreenMedia) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [fullscreenMedia]);

  const ProductCard = ({ product }: { product: Product; key?: string }) => {
    const hasVideo = Boolean(product.productVideo);
    const hasImages = Boolean(product.productImages && product.productImages.length > 0);
    const today = isToday(product.createdAt);

    return (
      <div
        key={product.id}
        className={`bg-[#1B1B1B] border rounded-3xl overflow-hidden flex flex-col justify-between relative group shadow-lg transition-all hover:border-zinc-700 ${
          product.quantity === 0 ? "opacity-75" : ""
        } ${today ? "border-teal-500/40" : "border-[#2A2A2A]"}`}
        id={`public-card-${product.id}`}
      >
        {today && (
          <div className="absolute top-0 right-0 z-20 bg-teal-500 text-black text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-bl-xl tracking-wider">
            New Today
          </div>
        )}

        <div className="absolute top-4 left-4 z-10 flex gap-1.5">
          {product.quantity > 0 ? (
            <span className="bg-teal-500/15 border border-teal-500/35 text-teal-400 font-mono text-[9px] uppercase font-bold px-2 py-1 rounded-md backdrop-blur-sm">
              QTY: {product.quantity}
            </span>
          ) : (
            <span className="bg-rose-600/20 border border-rose-500/30 text-rose-400 font-mono text-[9px] uppercase font-extrabold px-2 py-1 rounded-md">
              SOLD OUT
            </span>
          )}
        </div>

        <div
          onClick={() => {
            if (hasVideo) {
              setFullscreenMedia({ type: "video", url: product.productVideo! });
            } else if (hasImages) {
              setFullscreenMedia({ type: "image", url: product.productImages[0], images: product.productImages, index: 0 });
            }
          }}
          className="h-56 bg-black overflow-hidden relative flex items-center justify-center border-b border-[#2A2A2A] cursor-pointer"
        >
          {(product.thumbnailUrl || (product.productImages && product.productImages[0])) ? (
            <img
              src={product.thumbnailUrl || product.productImages[0]}
              alt={product.model}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <Sparkles className="w-12 h-12 text-zinc-800" />
          )}

          {(hasVideo || hasImages) && (
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
              <div className="w-10 h-10 rounded-full bg-teal-500/90 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                {hasVideo ? <Play className="w-5 h-5 fill-black ml-0.5" /> : <ImageIcon className="w-5 h-5" />}
              </div>
              <span className="absolute bottom-3 right-3 p-1.5 bg-black/80 text-white rounded-lg text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm border border-[#2A2A2A]">
                {hasVideo ? (
                  <><Video className="w-3.5 h-3.5 text-teal-400 animate-pulse" /> Play Video</>
                ) : (
                  <><ImageIcon className="w-3.5 h-3.5 text-teal-400" /> View Photos</>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-teal-400 uppercase">
                {product.brand}
              </span>
              <h3 className="font-display font-extrabold text-xl text-white mt-1 line-clamp-1">
                {product.model}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#2A2A2A] py-3 text-zinc-400 font-sans">
              <p><b className="text-zinc-200">Storage:</b> {product.storage}</p>
              {product.ram && <p><b className="text-zinc-200">RAM:</b> {product.ram}</p>}
              <p><b className="text-zinc-200">Warranty:</b> {product.warranty}</p>
              {product.batteryHealth && (
                <p><b className="text-zinc-200">Battery:</b> {product.batteryHealth}</p>
              )}
              <p className="col-span-2 line-clamp-1">
                <b className="text-zinc-200">Condition:</b> {product.condition.join(", ")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">Reseller Price</span>
              {shop.websiteSettings.showPrices ? (
                <span className="font-mono text-2xl font-black text-white">
                  ₦{product.sellingPrice.toLocaleString()}
                </span>
              ) : (
                <span className="font-mono text-sm font-bold text-zinc-500">
                  Contact for price
                </span>
              )}
            </div>

            <div className={`grid gap-2 ${shop.websiteSettings.enableVideoDownloads ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                onClick={() => handleCopyDetails(product)}
                className="flex flex-col items-center justify-center p-2 border border-[#2A2A2A] bg-black text-zinc-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                title="Copy details for WhatsApp"
              >
                {copiedId === product.id ? (
                  <>
                    <Check className="w-4 h-4 text-teal-400 mb-1" />
                    <span className="text-teal-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-400 mb-1" />
                    <span>Copy Details</span>
                  </>
                )}
              </button>

              {shop.websiteSettings.enableVideoDownloads && (
                <button
                  disabled={!hasVideo || downloadingId === product.id}
                  onClick={() => handleDownloadFile(product.productVideo || "", `${product.model}_demo.mp4`, product.id)}
                  className="flex flex-col items-center justify-center p-2 border border-[#2A2A2A] bg-black text-zinc-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingId === product.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-teal-400 mb-1 animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-zinc-400 mb-1" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 flex flex-col font-sans" id="reseller-catalog-website">

      {/* PUBLIC HEADER */}
      <header className="bg-[#121212]/90 backdrop-blur-md sticky top-0 z-30 border-b border-[#2A2A2A] px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B1B1B] rounded-2xl border border-[#2A2A2A] flex items-center justify-center font-display font-black text-teal-400 shadow-md">
            R
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base tracking-tight text-white flex items-center gap-1.5 uppercase">
              {shop.name}
            </h1>
            <p className="text-[10px] text-teal-400 font-mono tracking-wider">● ONLINE RESELLER WEB</p>
          </div>
        </div>

        <a
          href={`https://wa.me/${shop.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-b from-[#565656] to-[#3A3A3A] hover:from-[#666666] hover:to-[#464646] border border-[#555555] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
        >
          <Phone className="w-4 h-4 text-teal-400" /> Order on WhatsApp
        </a>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        <div className="text-center max-w-2xl mx-auto py-8 space-y-3">
          <span className="text-[10px] font-mono tracking-widest text-teal-400 uppercase font-bold bg-[#1B1B1B] px-3 py-1.5 rounded-full border border-[#2A2A2A]">
            Reseller Central Catalog
          </span>
          <h2 className="font-display font-extrabold text-3xl text-white tracking-tight">
            Original Gadget Payout Catalog
          </h2>
          <p className="text-sm text-zinc-400">
            No registration needed. Browse full-screen media, download original demonstration videos/photos, and lock stock instantly.
          </p>
        </div>

        {/* SEARCH + CATEGORY RAILS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-[#1B1B1B] p-4 rounded-3xl border border-[#2A2A2A]">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search catalog models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-[#2A2A2A] pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-white"
            />
          </div>

          <div className="md:col-span-2 flex gap-1.5 overflow-x-auto pr-1 items-center">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeCategory === "All"
                  ? "bg-white text-[#0A0A0A] font-bold"
                  : "bg-[#121212] border border-[#2A2A2A] text-zinc-400 hover:text-white"
              }`}
            >
              All Products
            </button>
            {Object.values(Category).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  activeCategory === cat
                    ? "bg-white text-[#0A0A0A] font-bold"
                    : "bg-[#121212] border border-[#2A2A2A] text-zinc-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ml-1 ${
                showFilters || activeFilterCount > 0
                  ? "bg-teal-500/15 border border-teal-500/35 text-teal-400"
                  : "bg-[#121212] border border-[#2A2A2A] text-zinc-400 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-teal-500 text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* EXPANDABLE FILTER PANEL */}
        {showFilters && (
          <div className="bg-[#1B1B1B] p-5 rounded-3xl border border-[#2A2A2A] space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-white">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-[10px] text-teal-400 hover:text-teal-300 font-bold uppercase font-display cursor-pointer"
                >
                  Reset All
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Brand</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Storage</label>
                <select
                  value={filterStorage}
                  onChange={(e) => setFilterStorage(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {allStorages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">RAM</label>
                <select
                  value={filterRam}
                  onChange={(e) => setFilterRam(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {allRams.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Condition</label>
                <select
                  value={filterCondition}
                  onChange={(e) => setFilterCondition(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {allConditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Min Price (₦)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filterPriceMin}
                  onChange={(e) => setFilterPriceMin(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Max Price (₦)</label>
                <input
                  type="number"
                  placeholder="∞"
                  value={filterPriceMax}
                  onChange={(e) => setFilterPriceMax(e.target.value)}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* NEW TODAY SECTION */}
        {todayProducts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
              <h2 className="font-display font-extrabold text-xl text-white uppercase tracking-tight">New Today</h2>
              <span className="bg-teal-500/15 border border-teal-500/35 text-teal-400 font-mono text-[9px] uppercase font-bold px-2 py-1 rounded-md">
                {todayProducts.length} {todayProducts.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {todayProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
            <div className="border-b border-[#2A2A2A] pt-4" />
          </div>
        )}

        {/* ALL PRODUCTS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-zinc-600 rounded-full" />
            <h2 className="font-display font-extrabold text-xl text-white uppercase tracking-tight">
              {activeCategory === "All" ? "All Products" : activeCategory}
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono">
              {visibleProducts.length} {visibleProducts.length === 1 ? "item" : "items"}
            </span>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="text-center py-20 bg-[#1B1B1B]/40 border border-[#2A2A2A] rounded-3xl text-zinc-500">
              <AlertTriangle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="font-display font-bold text-lg">No visible models matching search</p>
              <p className="text-xs text-zinc-600 mt-1">Please explore alternative categories or contact the owner.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {visibleProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </div>
      </main>

      {downloadError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-rose-500/90 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-sm border border-rose-400/50 max-w-md text-center">
          {downloadError}
        </div>
      )}

      {/* FULL-SCREEN MEDIA VIEWER (WhatsApp Status style) */}
      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-fade-in"
          onClick={closeFullscreen}
        >
          {/* Close button */}
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 z-10 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm border border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Media content */}
          {fullscreenMedia.type === "video" ? (
            <video
              src={fullscreenMedia.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
              <img
                src={fullscreenMedia.url}
                alt="Full screen"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />

              {fullscreenMedia.images && fullscreenMedia.images.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm border border-zinc-700"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm border border-zinc-700"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Progress indicators (WhatsApp Status style) */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {fullscreenMedia.images.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 rounded-full transition-all ${idx === fullscreenMedia.index ? "w-8 bg-teal-400" : "w-4 bg-white/30"}`}
                      />
                    ))}
                  </div>

                  {/* Counter */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs font-mono bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    {(fullscreenMedia.index || 0) + 1} / {fullscreenMedia.images.length}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="bg-[#121212] border-t border-[#2A2A2A] py-8 px-6 text-center text-zinc-500 text-xs tracking-tight mt-12 shrink-0">
        <p className="font-mono text-[10px]">POWERED BY RESTOCKR v2.0 • NIGERIAN GADGET BUSINESS OPERATING SYSTEM</p>
      </footer>
    </div>
  );
}

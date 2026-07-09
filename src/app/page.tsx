"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

// Icons
const Scan = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
);
const Trash2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const Check = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
const X = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const ArrowLeft = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const Plus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);

interface Product {
  id: string;
  barcode: string;
  productName: string;
  expirationDate: string;
  createdAt: string;
}

interface OpenFoodProduct {
  name: string;
  barcode: string;
  image_url: string | null;
}

export default function Home() {
  const [scannedProduct, setScannedProduct] = useState<OpenFoodProduct | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ productName: "", expirationDate: "" });

  // Manual Add State
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualForm, setManualForm] = useState({ productName: "", expirationDate: "", barcode: "" });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      // Optionally set an empty array or handle error state
      setProducts([]); 
    }
  };

  const handleScan = async (barcode: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setIsScanning(false); // Close scanner after scan

    try {
      const response = await fetch(`/api/products/openfoodfacts/${barcode}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
           setManualForm({ productName: "", expirationDate: "", barcode });
           setIsManualAdding(true);
           setError(null);
        } else {
           setError(data.error || "Produit non trouvé");
        }
        return;
      }

      setScannedProduct(data);
      setExpirationDate("");

      improveProductName(data.name, barcode);
    } catch {
      setError("Erreur lors de la récupération du produit");
    } finally {
      setLoading(false);
    }
  };

  const improveProductName = async (originalName: string, barcode: string) => {
    try {
      const response = await fetch("/api/ai/improve-product-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: originalName }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.improvedName && data.improvedName !== originalName) {
          setScannedProduct((prev) => {
            if (prev && prev.barcode === barcode) {
              return { ...prev, name: data.improvedName };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error("Failed to improve product name", err);
    }
  };

  const handleSaveProduct = async (returnToScan: boolean = false) => {
    if (!scannedProduct || !expirationDate) {
      setError("Veuillez scanner un produit et sélectionner une date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: scannedProduct.barcode,
          productName: scannedProduct.name,
          expirationDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erreur lors de l'enregistrement");
        return;
      }

      setSuccess("Produit enregistré !");
      setScannedProduct(null);
      setExpirationDate("");
      fetchProducts();
      
      if (returnToScan) {
        setIsScanning(true);
      }
    } catch {
      setError("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.productName || !manualForm.expirationDate) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: manualForm.barcode || `MANUAL-${Date.now()}`,
          productName: manualForm.productName,
          expirationDate: manualForm.expirationDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erreur lors de l'enregistrement");
        return;
      }

      setSuccess("Produit ajouté !");
      setIsManualAdding(false);
      setManualForm({ productName: "", expirationDate: "", barcode: "" });
      fetchProducts();
    } catch {
      setError("Erreur lors de l'ajout");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDeleteProduct = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal
    if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Produit supprimé");
        fetchProducts();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error("Erreur de mise à jour");

      setSuccess("Produit mis à jour !");
      setEditingProduct(null);
      fetchProducts();
    } catch {
      setError("Erreur lors de la modification");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      productName: product.productName,
      expirationDate: format(new Date(product.expirationDate), "yyyy-MM-dd"),
    });
  };

  // Stats for the dashboard
  const expiringSoonCount = products.filter(p => {
    const diff = differenceInCalendarDays(new Date(p.expirationDate), new Date());
    return diff >= 0 && diff <= 3;
  }).length;
  


  const getExpirationStyles = (expirationDate: string) => {
    const date = new Date(expirationDate);
    const today = new Date();
    const diff = differenceInCalendarDays(date, today);

    if (diff < 0) return { bg: "bg-red-200", border: "border-black", text: "Périmé" };
    if (diff <= 3) return { bg: "bg-neo-yellow", border: "border-black", text: `J-${diff}` };
    if (diff <= 7) return { bg: "bg-neo-blue", border: "border-black", text: `J-${diff}` };
    return { bg: "bg-white", border: "border-black", text: `J-${diff}` };
  };

  return (
    <div className="min-h-screen bg-stone-50 text-black font-sans pb-20">
      <div className="max-w-md mx-auto min-h-screen bg-white border-x-2 border-black relative">
        
        {/* Header */}
        <header className="p-6 border-b-2 border-black flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
             <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Mon Frigo</p>
             <h1 className="text-3xl font-black uppercase italic tracking-tighter">ANTI-GASPI</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsManualAdding(true)}
              className="w-12 h-12 bg-white border-2 border-black shadow-neo rounded-full flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsScanning(!isScanning)}
              className="w-12 h-12 bg-neo-yellow border-2 border-black shadow-neo rounded-full flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              <Scan className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Status Messages */}
        <div className="px-6 pt-4">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border-2 border-black rounded-xl shadow-neo font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <X className="w-5 h-5"/> {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-100 border-2 border-black rounded-xl shadow-neo font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <Check className="w-5 h-5"/> {success}
            </div>
          )}
        </div>

        {/* Main Content */}
        {!isScanning && !scannedProduct && (
          <div className="p-6 space-y-8 animate-in fade-in duration-500">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4">

              <div className="bg-neo-yellow p-5 rounded-[1.5rem] border-2 border-black shadow-neo flex flex-col justify-between h-40">
                 <div className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center">
                  <span className="font-bold text-xl">⚠️</span>
                </div>
                <div>
                  <p className="font-medium text-lg">À manger rapidement</p>
                  <p className="text-4xl font-black">{expiringSoonCount}</p>
                </div>
              </div>
            </div>

            {/* Product List */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-2xl font-black uppercase italic">MES PRODUITS</h2>
              </div>
              
              <div className="space-y-3">
                {products.length === 0 ? (
                  <div className="text-center py-10 opacity-50 font-medium">
                    Aucun produit scanné.
                  </div>
                ) : (
                  products.map((product) => {
                    const style = getExpirationStyles(product.expirationDate);
                    return (
                      <div 
                        key={product.id} 
                        className="group relative cursor-pointer"
                        onClick={() => openEditModal(product)}
                      >
                        <div className="absolute inset-0 bg-black rounded-xl translate-x-1 translate-y-1 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
                        <div className="relative bg-white border-2 border-black rounded-xl p-4 flex justify-between items-center transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1">
                          
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full border-2 border-black flex items-center justify-center ${style.bg}`}>
                              {product.productName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <h3 className="font-bold text-lg leading-tight truncate w-40">{product.productName}</h3>
                               <p className="text-xs text-gray-500 font-mono">{format(new Date(product.expirationDate), "dd MMM", { locale: fr })}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 text-xs font-black border-2 border-black rounded-md ${style.bg}`}>
                              {style.text}
                            </span>
                             <button
                              onClick={(e) => handleDeleteProduct(product.id, e)}
                              className="text-black hover:bg-red-100 p-1 rounded-md transition-colors z-10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scanner Overlay */}
        {isScanning && (
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-stone-50/95 backdrop-blur-sm">
             <div className="w-full max-w-md h-full flex flex-col relative bg-white border-x-2 border-black">
               <div className="flex justify-between items-center p-6 text-black">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Scanner</h2>
                  <button 
                    onClick={() => setIsScanning(false)}
                    className="p-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  >
                    <X />
                  </button>
               </div>
               <div className="p-6 pt-0 flex-1">
                  <div className="bg-neo-purple p-4 rounded-xl border-2 border-black shadow-neo mb-6">
                    <p className="font-bold text-sm">💡 Astuce : Placez le code-barres bien au centre du cadre.</p>
                  </div>
                  <BarcodeScanner
                    onScan={handleScan}
                    onError={(err) => setError(err)}
                  />
               </div>
             </div>
          </div>
        )}

        {/* Product Form (After Scan) */}
        {scannedProduct && (
          <div className="p-4 animate-in slide-in-from-bottom-10 space-y-6">
            <button 
              onClick={() => { setScannedProduct(null); setIsScanning(false); }}
              className="flex items-center gap-2 font-bold hover:underline mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            
            <div className="bg-neo-pink border-2 border-black shadow-neo rounded-[1.5rem] p-4 text-center">
              {scannedProduct.image_url ? (
                <Image
                  src={scannedProduct.image_url}
                  alt={scannedProduct.name}
                  width={128}
                  height={128}
                  className="w-32 h-32 object-contain mx-auto border-2 border-black rounded-xl bg-white mb-4"
                />
              ) : (
                <div className="w-32 h-32 mx-auto border-2 border-black rounded-xl bg-white mb-4 flex items-center justify-center">
                   <span className="text-4xl">🍎</span>
                </div>
              )}
              <h2 className="text-2xl font-black uppercase break-words">{scannedProduct.name}</h2>
              <p className="font-mono text-sm mt-1">{scannedProduct.barcode}</p>
            </div>

            <div className="bg-white border-2 border-black shadow-neo rounded-xl p-4 space-y-4">
              <label className="block font-bold">Date de péremption</label>
              
              <input
                autoFocus
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full block box-border appearance-none border-2 border-black rounded-xl px-3 py-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-yellow/50 bg-white"
                min={format(new Date(), "yyyy-MM-dd")}
              />

              <button
                onClick={() => handleSaveProduct(true)}
                disabled={loading || !expirationDate}
                className="w-full bg-white border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 px-4 rounded-xl text-lg uppercase transition-all flex justify-center items-center gap-2 mb-3"
              >
                {loading ? "..." : (
                  <>
                  <Plus className="w-5 h-5" /> Valider et ajouter
                  </>
                )}
              </button>

              <button
                onClick={() => handleSaveProduct(false)}
                disabled={loading || !expirationDate}
                className="w-full bg-neo-yellow border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 px-4 rounded-xl text-lg uppercase transition-all flex justify-center items-center gap-2"
              >
                {loading ? "..." : (
                  <>
                  <Check className="w-5 h-5" /> Valider
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {/* Manual Add Modal */}
        {isManualAdding && (
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-stone-50/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white border-2 border-black shadow-neo rounded-[1.5rem] p-5 space-y-5 animate-in zoom-in-95 duration-200">
              
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-xl font-black uppercase italic">Ajouter un produit</h2>
                <button 
                  onClick={() => setIsManualAdding(false)}
                  className="p-2 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {manualForm.barcode && (
                  <div className="bg-gray-100 p-2 rounded-lg text-center border-2 border-black/10">
                    <p className="text-xs text-gray-500 font-bold uppercase">Code-barres associé</p>
                    <p className="font-mono text-sm">{manualForm.barcode}</p>
                  </div>
                )}
                <div>
                  <label className="block font-bold text-sm mb-2">Nom du produit</label>
                  <input
                    type="text"
                    value={manualForm.productName}
                    onChange={(e) => setManualForm(prev => ({ ...prev, productName: e.target.value }))}
                    className="w-full border-2 border-black rounded-xl px-4 py-3 font-bold text-base focus:outline-none focus:ring-4 focus:ring-neo-yellow/50"
                    placeholder="Ex: Yaourt, Lait..."
                  />
                </div>

                <div>
                   <label className="block font-bold text-sm mb-2">Date de péremption</label>
                   <input
                    type="date"
                    value={manualForm.expirationDate}
                    onChange={(e) => setManualForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                    className="w-full block border-2 border-black rounded-xl px-4 py-3 font-mono text-base focus:outline-none focus:ring-4 focus:ring-neo-yellow/50 appearance-none bg-white"
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsManualAdding(false)}
                    className="flex-1 bg-white border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] text-black font-bold py-3.5 rounded-xl uppercase text-sm transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleManualSubmit}
                    disabled={loading || !manualForm.productName || !manualForm.expirationDate}
                    className="flex-1 bg-neo-yellow border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] text-black font-bold py-3.5 rounded-xl uppercase text-sm transition-all flex justify-center gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "..." : (
                      <>
                        <Plus className="w-4 h-4" /> Ajouter
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-stone-50/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white border-2 border-black shadow-neo rounded-[1.5rem] p-5 space-y-5 animate-in zoom-in-95 duration-200">
              
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-xl font-black uppercase italic">Modifier</h2>
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="p-2 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-sm mb-2">Nom du produit</label>
                  <input
                    type="text"
                    value={editForm.productName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, productName: e.target.value }))}
                    className="w-full border-2 border-black rounded-xl px-4 py-3 font-bold text-base focus:outline-none focus:ring-4 focus:ring-neo-yellow/50"
                  />
                </div>

                <div>
                   <label className="block font-bold text-sm mb-2">Date de péremption</label>
                   <input
                    type="date"
                    value={editForm.expirationDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                    className="w-full block border-2 border-black rounded-xl px-4 py-3 font-mono text-base focus:outline-none focus:ring-4 focus:ring-neo-yellow/50 appearance-none bg-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="flex-1 bg-white border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] text-black font-bold py-3.5 rounded-xl uppercase text-sm transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpdateProduct}
                    disabled={loading}
                    className="flex-1 bg-neo-yellow border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] text-black font-bold py-3.5 rounded-xl uppercase text-sm transition-all flex justify-center gap-2 items-center"
                  >
                    {loading ? "..." : (
                      <>
                        <Check className="w-4 h-4" /> Enregistrer
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

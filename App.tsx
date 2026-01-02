
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { InpaintCanvas } from './components/InpaintCanvas';
import { ImageState, Ethnicity, BodyShape, Gender, GenerationStatus, EngineResult, FitProfile, AspectRatio, PoseStyle, Product, GeneratedArtifact, ModelPose } from './types';
import { createFitProfile, generateFashionPrompt, synthesizeFashionImage, generateDescription } from './services/geminiService';
import { parseProductCSV } from './services/csvParser';

const DB_STORAGE_KEY = 'zimbabalooba_product_db';
const EXPORT_LIST_KEY = 'zimbabalooba_export_list';
const VISIONS_STORAGE_KEY = 'zimbabalooba_visions_gallery';

const PRETRAINED_SIGNATURE_BLUEPRINT: FitProfile = {
  description: "The Zimbabalooba Signature silhouette: A high-rise, voluminous architectural trouser. Mandatory features: a heavy gathered elasticated waistband with an invisible or very thin internal drawstring, and twin oval brand labels at the lower leg hems.",
  specs: {
    silhouette: "Architectural Taper with Pooled Hems",
    waistline: "Gathered Elastic with Invisible or Very Thin Cord",
    texture: "High-density Sculptural Cotton/Canvas",
    drape: "Structural volume with signature ankle stacking"
  }
};

type SortOption = 'newest' | 'name-asc' | 'name-desc' | 'price-high' | 'price-low' | 'size' | 'collection';

const InventoryImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className={`bg-white/5 flex flex-col items-center justify-center p-4 text-center ${className}`}>
        <svg className="w-8 h-8 text-white/10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span className="text-[8px] uppercase font-bold text-white/20 tracking-tighter">Broken Asset</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} loading="lazy" />;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'studio' | 'visions' | 'inventory' | 'export'>('studio');
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);

  const [patternRef, setPatternRef] = useState<ImageState | null>(null);
  const [activeProfile] = useState<FitProfile | null>(PRETRAINED_SIGNATURE_BLUEPRINT);
  const [ethnicity, setEthnicity] = useState<Ethnicity>(Ethnicity.MIXED_RACE);
  const [gender, setGender] = useState<Gender>("Unisex");
  const [bodyShape, setBodyShape] = useState<BodyShape>("Athletic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  
  const [patternScale, setPatternScale] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(0);
  const [refinementPrompt, setRefinementPrompt] = useState<string>('');
  
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [activeMask, setActiveMask] = useState<string | null>(null);

  const [locationStyle, setLocationStyle] = useState<PoseStyle>("Shop Display");
  const [modelPose, setModelPose] = useState<ModelPose>("Relaxed Standing");
  const [status, setStatus] = useState<GenerationStatus>({ step: 'idle', message: 'Engine Ready.' });
  const [result, setResult] = useState<EngineResult | null>(null);
  const [productDb, setProductDb] = useState<Product[]>([]);
  const [exportList, setExportList] = useState<Product[]>([]);
  const [visions, setVisions] = useState<GeneratedArtifact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setIsKeySelected(hasKey);
        } else setIsKeySelected(true);
      } catch (e) { setIsKeySelected(true); }
    };
    checkKey();

    const loadData = () => {
      try {
        const savedDb = localStorage.getItem(DB_STORAGE_KEY);
        if (savedDb) setProductDb(JSON.parse(savedDb));
        const savedExport = localStorage.getItem(EXPORT_LIST_KEY);
        if (savedExport) setExportList(JSON.parse(savedExport));
        const savedVisions = localStorage.getItem(VISIONS_STORAGE_KEY);
        if (savedVisions) setVisions(JSON.parse(savedVisions));
      } catch (e) { console.error("Local storage error", e); }
    };
    loadData();
  }, []);

  useEffect(() => { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(productDb)); }, [productDb]);
  useEffect(() => { localStorage.setItem(EXPORT_LIST_KEY, JSON.stringify(exportList)); }, [exportList]);
  useEffect(() => { localStorage.setItem(VISIONS_STORAGE_KEY, JSON.stringify(visions)); }, [visions]);

  const sortedAndFilteredDb = useMemo(() => {
    const filtered = productDb.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.collection && p.collection.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return (b.dateUploaded || 0) - (a.dateUploaded || 0);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-high': {
          const valA = parseFloat(a.price.replace(/[^0-9.-]+/g, "")) || 0;
          const valB = parseFloat(b.price.replace(/[^0-9.-]+/g, "")) || 0;
          return valB - valA;
        }
        case 'price-low': {
          const valA = parseFloat(a.price.replace(/[^0-9.-]+/g, "")) || 0;
          const valB = parseFloat(b.price.replace(/[^0-9.-]+/g, "")) || 0;
          return valA - valB;
        }
        case 'size':
          return (a.size || "").localeCompare(b.size || "");
        case 'collection':
          return (a.collection || "").localeCompare(b.collection || "");
        default:
          return 0;
      }
    });
  }, [productDb, searchQuery, sortOption]);

  const startProduction = async (refinement?: string) => {
    if (!activeProfile || !patternRef) return;
    const finalRefinement = refinement || refinementPrompt;
    const isEdit = !!(result && (finalRefinement || activeMask));

    setStatus({ step: 'rendering', message: isEdit ? 'Processing Smart Refinement...' : 'Synthesizing Vision...' });
    
    try {
      const prompt = await generateFashionPrompt(
        activeProfile, 
        patternRef, 
        ethnicity,
        gender, 
        bodyShape,
        patternScale, 
        brightness, 
        locationStyle, 
        modelPose,
        finalRefinement, 
        !!activeMask
      );
      
      const imageUrl = await synthesizeFashionImage(
        prompt, 
        aspectRatio, 
        isEdit ? result?.imageUrl : undefined, 
        activeMask || undefined,
        patternRef // Pass reference to help image generator
      );

      if (!imageUrl) throw new Error("Synthesis failed: Empty image result.");

      const newArtifact: GeneratedArtifact = { id: Date.now().toString(), timestamp: Date.now(), generatedPrompt: prompt, imageUrl };
      setResult(newArtifact);
      setVisions(prev => [newArtifact, ...prev]);
      setStatus({ step: 'completed', message: 'Vision Synthesized Successfully.' });
      setRefinementPrompt('');
      setIsMaskingMode(false);
      setActiveMask(null);
    } catch (err: any) {
      console.error("Engine Error:", err);
      if (err?.message?.includes("Requested entity was not found")) {
        setIsKeySelected(false);
      }
      setStatus({ step: 'error', message: err.message || 'Synthesis Error: Check safety filters or prompt details.' });
    }
  };

  const applyQuickDirective = (directive: string) => {
    setRefinementPrompt(directive);
    startProduction(directive);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          const products = parseProductCSV(text);
          setProductDb(products);
          setStatus({ step: 'completed', message: `${products.length} items synced.` });
        } catch (err) {
          setStatus({ step: 'error', message: 'CSV Format Error.' });
        }
      };
      reader.readAsText(file);
    }
  };

  const applyPatternFromDb = async (product: Product) => {
    setStatus({ step: 'rendering', message: 'Syncing Asset...' });
    try {
      const response = await fetch(product.imageUrl, { mode: 'cors' });
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setPatternRef({ base64: (reader.result as string).split(',')[1], mimeType: blob.type, previewUrl: product.imageUrl });
        setActiveTab('studio');
        setStatus({ step: 'idle', message: 'Asset Ready.' });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setPatternRef({ base64: '', mimeType: 'image/jpeg', previewUrl: product.imageUrl });
      setActiveTab('studio');
      setStatus({ step: 'error', message: 'Manual upload required for this asset.' });
    }
  };

  if (isKeySelected === false) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-12 text-center">
        <h1 className="fashion-title text-6xl font-bold mb-8 text-white tracking-tighter">Zimbabalooba</h1>
        <p className="text-white/40 uppercase tracking-[0.4em] text-[10px] mb-12 max-w-md leading-loose">
          To access high-fidelity Vision Synthesis, a paid Google Cloud project API key is required. 
          Please select your project to continue.
        </p>
        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={async () => {
              if ((window as any).aistudio?.openSelectKey) {
                await (window as any).aistudio.openSelectKey();
                setIsKeySelected(true);
              }
            }}
            className="px-12 py-6 bg-orange-600 rounded-full text-white font-bold text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-orange-500 transition-all"
          >
            Select API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] text-white/20 hover:text-white/40 underline uppercase tracking-widest transition-all"
          >
            Billing Documentation
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-12 max-w-7xl mx-auto">
      <header className="py-16 text-center animate-in">
        <h1 className="fashion-title text-6xl md:text-8xl font-bold mb-6 text-white tracking-tighter">Zimbabalooba</h1>
        <nav className="flex justify-center flex-wrap gap-x-12 gap-y-6 mt-12 border-b border-white/5 pb-6">
          {['studio', 'visions', 'inventory', 'export'].map(id => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-all pb-2 relative ${activeTab === id ? 'text-orange-400' : 'text-white/30 hover:text-white'}`}>
              {id === 'studio' ? 'Studio' : id === 'visions' ? 'Visions' : id === 'inventory' ? 'Inventory' : 'Export List'}
              {activeTab === id && <div className="absolute bottom-0 left-0 w-full h-px bg-orange-400"></div>}
            </button>
          ))}
        </nav>
      </header>

      <main className="animate-in">
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Controls Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-card p-8 rounded-[40px] space-y-8 sticky top-8">
                <ImageUploader label="Fit Reference Architecture" description="Upload product or reference photo" selectedImage={patternRef} onImageSelect={setPatternRef} />
                
                {patternRef && !result && (
                  <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-2xl animate-in">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">Blueprint Active: Architectural Signature</span>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-6 pt-6 border-t border-indigo-500/20 bg-indigo-500/5 p-6 rounded-[32px] animate-in shadow-inner border">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Smart Refinement Directive</label>
                      <span className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Specify specific details to "FIX" or change</span>
                    </div>
                    
                    <textarea 
                      placeholder="e.g. 'Make the logos sharper', 'Change the shoes'..."
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-5 text-xs text-white placeholder:text-white/20 focus:border-indigo-500/40 outline-none resize-none h-32 leading-relaxed scrollbar-hide transition-all"
                    />

                    <div className="space-y-3">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-white/30 block">Quick Edit Actions</label>
                      <div className="flex flex-wrap gap-2">
                         <button onClick={() => applyQuickDirective("Sharpen the brand logos. Ensure the hem markers are clearly visible and precisely placed.")} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all">Fix Logos</button>
                         <button onClick={() => applyQuickDirective("Make the color significantly lighter and more vibrant, boost saturation.")} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all">Vibrancy+</button>
                         <button onClick={() => applyQuickDirective("Change the shoes to high-end minimalist fashion sneakers.")} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all">New Shoes</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => startProduction()} 
                        disabled={status.step === 'rendering'}
                        className="py-4 rounded-2xl bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        Apply Edit
                      </button>
                      <button 
                        onClick={() => { setRefinementPrompt(''); setResult(null); setActiveMask(null); }}
                        className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold text-[10px] uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
                      >
                        Clear Vision
                      </button>
                    </div>
                  </div>
                )}

                {!result && (
                  <>
                    <div className="space-y-6 pt-6 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-2">Race</label>
                          <select value={ethnicity} onChange={(e) => setEthnicity(e.target.value as Ethnicity)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white/70 appearance-none outline-none font-bold uppercase tracking-widest focus:border-orange-500/30">
                            {Object.values(Ethnicity).map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-2">Gender</label>
                          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white/70 appearance-none outline-none font-bold uppercase tracking-widest focus:border-orange-500/30">
                            {["Male", "Female", "Unisex"].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Body Archetype</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Slim", "Athletic", "Curvy", "Muscular"].map(shape => (
                          <button 
                            key={shape}
                            onClick={() => setBodyShape(shape as BodyShape)}
                            className={`py-3 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all border ${bodyShape === shape ? 'bg-white/90 border-white/20 text-black' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}
                          >
                            {shape}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Environment Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Shop Display", "Everyday", "Outdoor", "Urban"].map(style => (
                          <button 
                            key={style}
                            onClick={() => setLocationStyle(style as PoseStyle)}
                            className={`py-3 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all border flex flex-col items-center justify-center gap-1 ${locationStyle === style ? 'bg-orange-500 border-orange-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}
                          >
                            <span>{style}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Model Pose</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'Relaxed Standing', label: 'Standing' },
                          { id: 'Walking Motion', label: 'Walking' },
                          { id: 'Side Profile', label: 'Profile' }
                        ].map(pose => (
                          <button 
                            key={pose.id}
                            onClick={() => setModelPose(pose.id as ModelPose)}
                            className={`px-4 py-2 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border ${modelPose === pose.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}
                          >
                            {pose.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button onClick={() => startProduction()} disabled={!patternRef || status.step === 'rendering'} className="w-full py-6 rounded-3xl bg-orange-600 text-white font-bold text-xs uppercase tracking-[0.3em] shadow-2xl disabled:opacity-50 hover:bg-orange-500 transition-all transform active:scale-[0.98]">
                      Synthesize Vision
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-8">
              <div className="glass-card rounded-[40px] h-[800px] flex flex-col overflow-hidden bg-black/40 relative group">
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md z-20">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Neural Engine Production</span>
                    {result && <span className="text-[8px] text-orange-400 font-mono mt-1 uppercase tracking-widest">{locationStyle} // {bodyShape} // {modelPose}</span>}
                  </div>
                  {result && (
                    <div className="flex gap-4 items-center">
                      <button onClick={() => setIsMaskingMode(!isMaskingMode)} className={`text-[10px] font-bold uppercase tracking-[0.2em] px-6 py-2.5 rounded-xl border transition-all shadow-lg flex items-center gap-2 ${isMaskingMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:bg-white/10'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        {isMaskingMode ? 'Exit Mask Mode' : 'Mask Refinement Area'}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 p-4 flex items-center justify-center relative bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.01)_0%,_transparent_80%)]">
                  {result ? (
                    <InpaintCanvas imageUrl={result.imageUrl} isEditMode={isMaskingMode} brushSize={brushSize} onMaskChange={setActiveMask} />
                  ) : (
                    <div className="flex flex-col items-center space-y-8 opacity-10">
                      <div className="w-48 h-48 rounded-full border border-white/10 flex items-center justify-center relative">
                         <div className="absolute inset-0 border border-white/5 rounded-full animate-ping opacity-20"></div>
                         <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <span className="text-[12px] uppercase tracking-[0.8em] font-bold ml-[0.8em]">Dreamstate Pending</span>
                    </div>
                  )}
                </div>
                
                {status.step === 'rendering' && (
                  <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center space-y-12 z-[60] animate-in">
                    <div className="relative">
                      <div className="w-32 h-32 border-2 border-white/5 rounded-full"></div>
                      <div className="absolute inset-0 w-32 h-32 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-8 border border-indigo-500/20 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex flex-col items-center space-y-4 text-center px-16">
                      <span className="text-[14px] uppercase tracking-[0.8em] text-white font-bold ml-[0.8em]">{status.message}</span>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest max-w-[400px] leading-relaxed italic">Updating {bodyShape} architectural profile and refining physics engine constants...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 glass-card p-8 rounded-[32px]">
              <div className="flex flex-col space-y-2"><h2 className="text-xl font-bold text-white">Inventory Engine</h2><p className="text-[10px] text-white/40 uppercase tracking-widest">Manage shop manifest</p></div>
              <div className="flex flex-wrap items-center gap-4">
                <input type="text" placeholder="Filter products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-orange-500/40" />
                <button onClick={() => csvInputRef.current?.click()} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white transition-all">Import CSV</button>
                <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={handleCsvUpload} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {sortedAndFilteredDb.map(product => (
                <div key={product.handleId} className="glass-card group rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all flex flex-col relative">
                  <div className="aspect-square relative overflow-hidden bg-black/20" onClick={() => setEditingProduct(product)}>
                    <InventoryImage src={product.thumbnailUrl || product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 cursor-pointer" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 space-y-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); applyPatternFromDb(product); }}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg"
                      >
                        Generate Model
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-1 cursor-pointer" onClick={() => setEditingProduct(product)}>
                    <h3 className="text-[11px] font-bold text-white line-clamp-1">{product.name}</h3>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-white/40">{product.price}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-8 text-center py-20">
            <h2 className="text-2xl font-bold text-white tracking-tighter">Export Engine</h2>
            <p className="text-white/30 uppercase tracking-[0.4em] text-[10px] mt-2">Manage your re-import manifest</p>
          </div>
        )}

        {activeTab === 'visions' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {visions.map(v => (
              <div key={v.id} className="glass-card rounded-2xl overflow-hidden group border border-white/5 hover:border-indigo-500/30 transition-all">
                <img src={v.imageUrl} className="aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-700" alt="Vision" />
                <div className="p-4 text-center border-t border-white/5">
                   <button onClick={() => { setResult(v); setActiveTab('studio'); }} className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-indigo-400 transition-colors">Recall to Studio</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {status.step === 'error' && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 p-6 bg-red-600/30 backdrop-blur-3xl border border-red-500/40 rounded-3xl text-white text-[11px] font-bold uppercase tracking-widest z-[100] shadow-2xl flex flex-col items-center gap-4 animate-in">
          <div className="flex items-center gap-4">
            <span className="max-w-md text-center">{status.message}</span>
            <button onClick={() => setStatus({step: 'idle', message: ''})} className="px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

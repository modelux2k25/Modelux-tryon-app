import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Ruler, Sparkles, Shirt, ArrowRight, RotateCcw, X, Loader2, Info, ChevronRight, Zap, User, Download, Lock } from 'lucide-react';

// --- Types & Enums ---
enum Step {
  HOME = -1,
  CHOICE = 0,
  UPLOAD = 1,
  MEASUREMENTS = 2,
  RESULT = 3,
  SIZE_RESULT = 4,
}

export default function App() {
  // --- State Management ---
  const [step, setStep] = useState<Step>(Step.HOME);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Images
  const [userImage, setUserImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState<string>('');

  // Measurements Data
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('female');
  const [bodyType, setBodyType] = useState<string>('average');

  // Optional Measurements
  const [bust, setBust] = useState<string>('');
  const [waist, setWaist] = useState<string>('');
  const [hips, setHips] = useState<string>('');

  // Recommendations
  const [sizeRecommendation, setSizeRecommendation] = useState<string | null>(null);
  const [sizeReasoning, setSizeReasoning] = useState<string | null>(null);

  // System & Limits (WEEKLY)
  const [usageCount, setUsageCount] = useState<number>(0);
  const [siteId, setSiteId] = useState<string>('unknown_site');
  const MAX_WEEKLY_USAGE = 10;

  // Mode Check (Lite for Accessories)
  const isLiteMode = new URLSearchParams(window.location.search).get('mode') === 'lite';

  // --- Helpers ---
  const formatSize = (s: string | null) => {
    if (!s) return '--';
    const clean = s.toUpperCase().trim();
    const map: Record<string, string> = {
      'XS': 'PP', 'S': 'P', 'M': 'M', 'L': 'G', 'XL': 'GG', 'XXL': 'XG', 'XXXL': 'XGG'
    };
    return map[clean] || clean;
  };

  const getSiteId = () => {
    try {
      if (window.self !== window.top && document.referrer) {
        return new URL(document.referrer).hostname.replace(/[^a-z0-9]/gi, '_');
      }
      return 'portal_modelux';
    } catch { return 'unknown_site'; }
  };

  const getWeekIdentifier = () => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }

  const getStorageKey = (currentSiteId: string) => {
    const weekId = getWeekIdentifier();
    return `modelux_usage_${currentSiteId}_${weekId}`;
  }

  // --- Effects & Initialization ---

  useEffect(() => {
    const id = getSiteId();
    setSiteId(id);

    const storageKey = getStorageKey(id);
    const savedUsage = localStorage.getItem(storageKey);
    if (savedUsage) {
      setUsageCount(parseInt(savedUsage, 10));
    } else {
      setUsageCount(0);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PRODUCT_DETAILS') {
        const { image, description } = event.data.payload;
        if (image) setSelectedImage(image);
        if (description) setProductDescription(description);
      }
      if (event.data && event.data.type === 'PRODUCT_IMAGE') {
        setSelectedImage(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const incrementUsage = () => {
    const storageKey = getStorageKey(siteId);
    const newUsage = usageCount + 1;
    setUsageCount(newUsage);
    localStorage.setItem(storageKey, newUsage.toString());
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, { type: mime });
  };

  const triggerSelectionMode = () => {
    window.parent.postMessage('START_IMAGE_SELECTION', '*');
  };

  // --- API Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
      setStep(Step.CHOICE);
    }
  };

  const handleEstimateSize = async () => {
    if (!selectedImage) { alert('Nenhum produto detectado.'); return; }
    setIsLoading(true);
    setLoadingStep('Calculando medidas (Brasil)...');
    try {
      const payload = { height, weight, age, bodyType, gender, bust, waist, hips, product_description: productDescription, product_image_url: selectedImage };
      const response = await fetch('https://modelux-tryon-api.onrender.com/api/estimate-size', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Erro ao estimar');
      const data = await response.json();
      setSizeRecommendation(data.recommendation.size);
      setSizeReasoning(data.recommendation.details);
      setStep(Step.SIZE_RESULT);
    } catch (error) { alert('Erro ao calcular tamanho.'); }
    finally { setIsLoading(false); }
  };

  const handleGenerateAIModel = async () => {
    if (usageCount >= MAX_WEEKLY_USAGE) { alert('Limite semanal atingido nesta loja!'); return; }
    if (!height || !weight || !age) { alert('Preencha Altura, Peso e Idade.'); return; }
    setIsLoading(true);
    setLoadingStep('Criando modelo IA...');
    try {
      // Extract Store Domain
      let storeDomain = 'portal_modelux';
      try { if (document.referrer) storeDomain = new URL(document.referrer).hostname; } catch { }

      const response = await fetch('https://modelux-tryon-api.onrender.com/api/generate-avatar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ height, weight, age, bodyType, gender, bust, waist, hips, site_url: storeDomain })
      });
      if (!response.ok) throw new Error('Falha ao gerar modelo');
      const data = await response.json();
      if (data.image) {
        const file = dataURLtoFile(data.image, 'ai-model.png');
        setUserImage(file);
        setUserImagePreview(data.image);
        incrementUsage();
        setStep(Step.CHOICE);
      }
    } catch (error) { alert('Erro ao gerar modelo IA.'); }
    finally { setIsLoading(false); }
  };

  const handleCreateAvatar = async () => {
    if (usageCount >= MAX_WEEKLY_USAGE) { alert('Limite semanal atingido nesta loja!'); return; }
    if (!selectedImage || !userImage) { alert("Falta foto sua ou do produto."); return; }
    setIsLoading(true);
    setLoadingStep('Processando...');
    try {
      const formData = new FormData();
      formData.append('user_image', userImage);
      formData.append('product_image_url', selectedImage);

      // Extract Store Domain
      let storeDomain = 'portal_modelux';
      try { if (document.referrer) storeDomain = new URL(document.referrer).hostname; } catch { }
      formData.append('site_url', storeDomain);

      if (productDescription) formData.append('product_description', productDescription);

      const tryOnResponse = await fetch('https://modelux-tryon-api.onrender.com/api/generate', { method: 'POST', body: formData });
      if (!tryOnResponse.ok) throw new Error('Falha na geração');
      const data = await tryOnResponse.json();
      if (data.image) {
        setResultImage(data.image);
        incrementUsage();
        setStep(Step.RESULT);
      }
    } catch (error) { alert('Erro ao criar provador.'); }
    finally { setIsLoading(false); }
  };

  // --- Render ---

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{ colorScheme: 'light', backgroundColor: '#f8fafc' }}
      className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#c7d2fe]/40 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#e9d5ff]/40 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <header className="relative z-10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm transition-all">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 font-display">MODELUX</span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Try-ON</span>
        </div>
        {step !== Step.HOME && (
          <button onClick={() => setStep(Step.HOME)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 max-w-md h-[calc(100vh-80px)] overflow-y-auto pb-20 scrollbar-hide">

        {step === Step.HOME && (
          <div className="space-y-8 animate-fade-in pt-4">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-[#0f172a]">Olá! 👋</h1>
              <p className="text-slate-500">Escolha como deseja provar suas roupas:</p>
            </div>
            <div className="space-y-4">
              <div onClick={() => setStep(Step.CHOICE)} className="bg-white p-5 rounded-2xl shadow-lg border border-indigo-50 hover:border-indigo-200 cursor-pointer group relative overflow-hidden transition-all hover:scale-[1.02]">
                <div className="absolute top-0 right-0 p-3 opacity-10"><Zap className="w-24 h-24 text-indigo-600 rotate-[-15deg]" /></div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm"><Sparkles className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-[#1e293b]">Modo Rápido</h3>
                    <p className="text-sm text-slate-500 mt-1">Provador instantâneo.</p>
                    <span className="text-[10px] uppercase font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full mt-2 inline-block">1 Crédito</span>
                  </div>
                </div>
              </div>
              {!isLiteMode && (
                <div onClick={() => setStep(Step.MEASUREMENTS)} className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 hover:border-violet-200 cursor-pointer group relative overflow-hidden transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-3 opacity-10"><Ruler className="w-24 h-24 text-violet-600 rotate-[15deg]" /></div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="p-3 bg-violet-100 rounded-xl text-violet-600 shadow-sm"><User className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-lg font-bold text-[#1e293b]">Simulação Avançada</h3>
                      <p className="text-sm text-slate-500 mt-1">Gere modelo IA com suas medidas.</p>
                      <span className="text-[10px] uppercase font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full mt-2 inline-block">Pro</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-center pt-8">
                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium uppercase">Tokens restantes:</span>
                  <span className={`text-sm font-bold ${usageCount >= MAX_WEEKLY_USAGE ? 'text-red-500' : 'text-indigo-600'}`}>
                    {MAX_WEEKLY_USAGE - usageCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === Step.CHOICE && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setStep(Step.HOME)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors">
              <ArrowRight className="w-4 h-4 rotate-180" /><span>Voltar ao Menu</span>
            </button>
            <h1 className="text-3xl font-bold text-[#0f172a]">Visualizar</h1>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group">
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 uppercase">Produto</div>
                <div className="aspect-[3/4] rounded-xl bg-slate-100 overflow-hidden relative border border-slate-200 flex flex-col items-center justify-center">
                  {selectedImage ? (
                    <>
                      <img src={selectedImage} alt="Produto" className="w-full h-full object-cover" />
                      <button onClick={triggerSelectionMode} className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-indigo-600 rounded-full shadow-sm transition-colors group/edit">
                        <Sparkles className="w-4 h-4 text-indigo-600 group-hover/edit:text-white" />
                      </button>
                    </>
                  ) : (
                    <button onClick={triggerSelectionMode} className="flex flex-col items-center gap-2 p-4 text-center hover:bg-slate-200/50 transition-all w-full h-full justify-center group/btn">
                      <div className="p-3 bg-white rounded-full shadow-sm group-hover/btn:scale-110 transition-transform">
                        <Sparkles className="w-6 h-6 text-indigo-500" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600">Selecionar foto do produto</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group cursor-pointer" onClick={() => document.getElementById('model-upload')?.click()}>
                <div className="absolute top-2 left-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase z-10">Modelo</div>
                <div className="aspect-[3/4] rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-50 transition-colors">
                  {userImagePreview ? <img src={userImagePreview} alt="Modelo" className="w-full h-full object-cover rounded-xl" /> : <><Camera className="w-8 h-8 opacity-50" /><span className="text-xs">Carregar Foto</span></>}
                </div>
                <input type="file" id="model-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>
            </div>

            <button
              onClick={handleCreateAvatar}
              disabled={!userImage || isLoading || usageCount >= MAX_WEEKLY_USAGE}
              className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-400 transition-all hover:scale-[1.01]"
            >
              {isLoading ? (
                <><Loader2 className="w-6 h-6 animate-spin" /><span>{loadingStep}</span></>
              ) : usageCount >= MAX_WEEKLY_USAGE ? (
                <><Lock className="w-5 h-5" /><span>Limite Atingido</span></>
              ) : (
                <span>Provador Virtual (1 Token)</span>
              )}
            </button>
          </div>
        )}

        {step === Step.SIZE_RESULT && (
          <div className="space-y-6 animate-fade-in flex flex-col items-center justify-center h-full pt-10">
            <button onClick={() => setStep(Step.HOME)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-slide-up shadow-sm">
                <Ruler className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Seu Tamanho Ideal</h2>
              <p className="text-slate-500 text-sm px-8">Com base nas suas medidas:</p>
            </div>
            <div className="w-full max-w-[280px] bg-white rounded-3xl shadow-xl border border-emerald-100 p-8 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              <h1 className="text-6xl font-black text-slate-800 tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-br from-emerald-600 to-teal-800">{formatSize(sizeRecommendation)}</h1>
              <div className="h-1 w-16 bg-slate-100 mx-auto rounded-full mb-4"></div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">{sizeReasoning || "Calculado com base nas proporções padrão brasileiras."}</p>
            </div>
            <div className="w-full pt-8 space-y-3">
              <button onClick={() => setStep(Step.CHOICE)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transform transition-all active:scale-[0.98]">
                <Shirt className="w-5 h-5" /> Experimentar no Provador
              </button>
              <button onClick={() => setStep(Step.MEASUREMENTS)} className="w-full py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                <RotateCcw className="w-4 h-4" /> Recalcular Medidas
              </button>
            </div>
          </div>
        )}

        {step === Step.MEASUREMENTS && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setStep(Step.HOME)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors"><ArrowRight className="w-4 h-4 rotate-180" /><span>Voltar</span></button>
            <h2 className="text-2xl font-bold text-[#0f172a]">Simulação Avançada</h2>

            <div className="space-y-5 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500">ALTURA (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="170" /></div>
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500">PESO (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="70" /></div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500">IDADE</label><input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="25" /></div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">GÊNERO</label>
                  <div className="flex gap-2">
                    <button onClick={() => setGender('female')} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${gender === 'female' ? 'bg-pink-100 border-pink-200 text-pink-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Feminino</button>
                    <button onClick={() => setGender('male')} className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${gender === 'male' ? 'bg-blue-100 border-blue-200 text-blue-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Masculino</button>
                  </div>
                </div>
              </div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500">TIPO DE CORPO</label><div className="grid grid-cols-3 gap-2">{['slim', 'average', 'athletic', 'curvy'].map(t => <button key={t} onClick={() => setBodyType(t)} className={`p-2 rounded-lg text-xs border transition-all capitalize ${bodyType === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{t}</button>)}</div></div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-1"><Ruler className="w-3 h-3" /> Medidas Opcionais</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500">TÓRAX</label><input type="number" value={bust} onChange={e => setBust(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none" placeholder="90" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500">CINTURA</label><input type="number" value={waist} onChange={e => setWaist(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none" placeholder="80" /></div>
                  <div className="space-y-1 col-span-2"><label className="text-xs font-bold text-slate-500">QUADRIL (cm)</label><input type="number" value={hips} onChange={e => setHips(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none" placeholder="100" /></div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 pt-2">
                <button onClick={handleEstimateSize} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">Descobrir meu tamanho</button>
                <button
                  onClick={handleGenerateAIModel}
                  disabled={isLoading || usageCount >= MAX_WEEKLY_USAGE}
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 relative overflow-hidden group ${isLoading || usageCount >= MAX_WEEKLY_USAGE ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transform active:scale-[0.98] transition-all'}`}
                >
                  {!isLoading && usageCount < MAX_WEEKLY_USAGE && <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>}
                  {isLoading ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>Gerando...</span></>) : usageCount >= MAX_WEEKLY_USAGE ? (<><Lock className="w-5 h-5" /><span>Limite Atingido</span></>) : (<><User className="w-5 h-5" /><span>Gerar Modelo IA</span></>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === Step.RESULT && resultImage && (
          <div className="animate-fade-in relative flex flex-col w-full">
            {/* Botão Fechar Flutuante (Fixo no canto da imagem) */}
            <button
              onClick={() => setStep(Step.HOME)}
              className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-md hover:bg-white rounded-full text-slate-700 shadow-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Container da Imagem (GRID LARGURA TOTAL - SEM LIMITE DE ALTURA) */}
            <div className="w-full bg-slate-100 rounded-2xl overflow-hidden shadow-md border border-slate-200">
              {/* 'w-full h-auto' faz a imagem crescer verticalmente o quanto precisar */}
              <img
                src={resultImage}
                className="w-full h-auto block"
                alt="Resultado Final"
              />
            </div>

            {/* Rodapé */}
            <div className="pt-6 pb-4 space-y-3 px-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-lg font-bold text-slate-800">Resultado</h2>
                <span className="text-[10px] uppercase font-bold text-slate-400">Modelo IA Gerada</span>
              </div>

              <button onClick={() => setStep(Step.CHOICE)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98] text-base">
                <RotateCcw className="w-5 h-5" />
                Tentar Outra Peça
              </button>
              <div className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-semibold opacity-60">
                Tokens restantes: {MAX_WEEKLY_USAGE - usageCount}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

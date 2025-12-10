import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Ruler, Sparkles, Shirt, ArrowRight, RotateCcw, X, Loader2, Info, ChevronRight, Zap, User, Download } from 'lucide-react';

// --- Types & Enums ---
enum Step {
  HOME = -1,
  CHOICE = 0,
  UPLOAD = 1,
  MEASUREMENTS = 2,
  RESULT = 3,
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

  // Optional Measurements (For higher precision)
  const [bust, setBust] = useState<string>('');   // Tórax
  const [waist, setWaist] = useState<string>(''); // Cintura
  const [hips, setHips] = useState<string>('');   // Quadril

  // Recommendations
  const [sizeRecommendation, setSizeRecommendation] = useState<string | null>(null);
  const [sizeReasoning, setSizeReasoning] = useState<string | null>(null);

  // System & Limits
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const MAX_DAILY_USAGE = 10;

  // --- Effects & Initialization ---

  useEffect(() => {
    // 1. Listen for Product Data from the parent window (Widget integration)
    const handleMessage = (event: MessageEvent) => {
      // Handle Product Details (Image + Description)
      if (event.data && event.data.type === 'PRODUCT_DETAILS') {
        const { image, description } = event.data.payload;
        if (image) setSelectedImage(image);
        if (description) setProductDescription(description);
      }
      // Handle Image Selection updates
      if (event.data && event.data.type === 'PRODUCT_IMAGE') {
        setSelectedImage(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);

    // 2. Initialize Daily Usage Limit from LocalStorage
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `modelux_usage_${today}`;
    const savedUsage = localStorage.getItem(storageKey);
    if (savedUsage) {
      setDailyUsage(parseInt(savedUsage, 10));
    }

    // Cleanup listener on unmount
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Logic Helpers ---

  const incrementUsage = () => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `modelux_usage_${today}`;
    const newUsage = dailyUsage + 1;
    setDailyUsage(newUsage);
    localStorage.setItem(storageKey, newUsage.toString());
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const triggerSelectionMode = () => {
    window.parent.postMessage('START_IMAGE_SELECTION', '*');
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
      // Upon upload, we can stay in choice or go to measurements. 
      // Current flow: Stay in Choice to allow Try-On immediately.
      setStep(Step.CHOICE);
    }
  };

  // 1. Estimate Size (Calculadora de Medidas)
  const handleEstimateSize = async () => {
    if (!selectedImage) {
      alert('Nenhum produto detectado para comparar.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Calculando medidas ideais...');

    try {
      // Ensuring we send the product image URL now (Critical Fix)
      const payload = {
        height,
        weight,
        age,
        bodyType,
        gender,
        bust,
        waist,
        hips,
        product_description: productDescription,
        product_image_url: selectedImage
      };

      const response = await fetch('https://modelux-tryon-api.onrender.com/api/estimate-size', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erro ao estimar tamanho');

      const data = await response.json();

      // Update State with AI Recommendation
      setSizeRecommendation(data.recommendation.size);
      setSizeReasoning(data.recommendation.details);

      // Navigate to Main Screen to show result
      setStep(Step.CHOICE);

    } catch (error) {
      console.error("Size Estimation Error:", error);
      alert('Erro ao calcular tamanho. Verifique os dados inseridos.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Generate AI Model (New Feature for Advanced Mode)
  const handleGenerateAIModel = async () => {
    if (dailyUsage >= MAX_DAILY_USAGE) {
      alert('Limite diário atingido! Volte amanhã.');
      return;
    }
    if (!height || !weight || !age) {
      alert('Por favor, preencha Altura, Peso e Idade para gerar o modelo.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Criando humano sintético (IA)...');

    try {
      const response = await fetch('https://modelux-tryon-api.onrender.com/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height, weight, age, bodyType, gender, bust, waist, hips
        })
      });

      if (!response.ok) throw new Error('Falha ao gerar modelo de IA');

      const data = await response.json();
      if (data.image) {
        // Success: Convert Base64 result to a File object for the Try-On state
        const file = dataURLtoFile(data.image, 'ai-model-generated.png');
        setUserImage(file);
        setUserImagePreview(data.image);
        incrementUsage();
        setStep(Step.CHOICE); // Go to Provador
      } else {
        throw new Error('API não retornou imagem.');
      }
    } catch (error) {
      console.error("GenAI Model Error:", error);
      alert('Erro ao gerar modelo IA. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Virtual Try-On (Provador)
  const handleCreateAvatar = async () => {
    if (dailyUsage >= MAX_DAILY_USAGE) {
      alert('Você atingiu o limite diário de provadores.');
      return;
    }

    if (!selectedImage || !userImage) {
      alert("É necessário uma foto sua e uma foto do produto.");
      return;
    }

    setIsLoading(true);
    setLoadingStep('Analisando tecidos e medidas...');

    try {
      const formData = new FormData();
      formData.append('user_image', userImage);
      formData.append('product_image_url', selectedImage);

      if (productDescription) {
        formData.append('product_description', productDescription);
      }

      setLoadingStep('Costurando digitalmente (Alta Fidelidade)...');

      // Call the main Virtual Try-On Endpoint
      const tryOnResponse = await fetch('https://modelux-tryon-api.onrender.com/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!tryOnResponse.ok) throw new Error('Falha na geração da imagem');

      const data = await tryOnResponse.json();
      if (data.image) {
        setResultImage(data.image);
        incrementUsage();
        setStep(Step.RESULT);
      } else {
        throw new Error('Nenhuma imagem retornada pelo servidor.');
      }

    } catch (error) {
      console.error("Try-On Error:", error);
      alert('Erro ao criar avatar. Tente novamente em instantes.');
    } finally {
      setIsLoading(false);
    }
  };


  // --- Render ---

  return (
    <div
      onContextMenu={(e) => e.preventDefault()} // BLOQUEIO DE CLIQUE DIREITO
      className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative"
    >

      {/* Background Ambience (Subtle & Premium) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-white/70 border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 font-display">
            MODELUX
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Try-ON</span>
        </div>

        {step !== Step.HOME && (
          <button
            onClick={() => setStep(Step.HOME)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
            title="Sair"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 container mx-auto px-4 py-6 max-w-md h-[calc(100vh-80px)] overflow-y-auto pb-20 scrollbar-hide">

        {/* === STEP: HOME (Mode Selection) === */}
        {step === Step.HOME && (
          <div className="space-y-8 animate-fade-in pt-4">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">Olá! 👋</h1>
              <p className="text-slate-500">Escolha como deseja provar suas roupas:</p>
            </div>

            <div className="space-y-4">
              {/* Mode: Quick Try-On */}
              <div
                onClick={() => setStep(Step.CHOICE)}
                className="bg-white p-5 rounded-2xl shadow-lg border border-indigo-50 hover:border-indigo-200 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-24 h-24 text-indigo-600 rotate-[-15deg]" />
                </div>

                <div className="flex items-start gap-4 relative z-10">
                  <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Modo Rápido</h3>
                    <p className="text-sm text-slate-500 mt-1">Provador instantâneo usando apenas sua foto.</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm">
                        1 Crédito
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode: Advanced Simulation */}
              <div
                onClick={() => setStep(Step.MEASUREMENTS)}
                className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 hover:border-violet-200 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Ruler className="w-24 h-24 text-violet-600 rotate-[15deg]" />
                </div>

                <div className="flex items-start gap-4 relative z-10">
                  <div className="p-3 bg-violet-100 rounded-xl text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors shadow-sm">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-violet-600 transition-colors">Simulação Avançada</h3>
                    <p className="text-sm text-slate-500 mt-1">Gere um modelo IA com suas medidas exatas.</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full shadow-sm">
                        Alta Precisão
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Tokens */}
              <div className="text-center pt-8">
                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Tokens Diários:</span>
                  <span className={`text-sm font-bold ${dailyUsage >= MAX_DAILY_USAGE ? 'text-red-500' : 'text-indigo-600'}`}>
                    {MAX_DAILY_USAGE - dailyUsage}
                  </span>
                  <span className="text-xs text-slate-300">/</span>
                  <span className="text-xs text-slate-400">{MAX_DAILY_USAGE}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === STEP: CHOICE (Main Provador Interface) === */}
        {step === Step.CHOICE && (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={() => setStep(Step.HOME)}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors group pl-1"
            >
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar ao Menu</span>
            </button>

            <h1 className="text-3xl font-bold text-slate-800">Visualizar</h1>

            <div className="grid grid-cols-2 gap-4">
              {/* Product Card */}
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group">
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 shadow-sm uppercase tracking-wide">
                  Produto
                </div>

                <div className="aspect-[3/4] rounded-xl bg-slate-100 overflow-hidden relative border border-slate-200">
                  {selectedImage ? (
                    <img src={selectedImage} alt="Produto" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem Imagem</div>
                  )}

                  <button
                    onClick={triggerSelectionMode}
                    className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-indigo-600 rounded-full backdrop-blur-sm transition-colors shadow-sm group/btn"
                    title="Trocar Peça"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600 group-hover/btn:text-white" />
                  </button>
                </div>
              </div>

              {/* Model Card */}
              <div
                className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group cursor-pointer hover:border-indigo-300 transition-colors"
                onClick={() => document.getElementById('model-upload')?.click()}
              >
                <div className="absolute top-2 left-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm">
                  Modelo
                </div>

                <div className="aspect-[3/4] rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all overflow-hidden">
                  {userImagePreview ? (
                    <img src={userImagePreview} alt="Modelo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mb-2 opacity-50 block" />
                      <span className="text-xs font-semibold text-center px-4">Toque para Carregar Foto</span>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  id="model-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Size Recommendation Banner */}
            {sizeRecommendation && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 shadow-sm animate-pulse-slow">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Ruler className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">Tamanho Recomendado: {sizeRecommendation}</h3>
                  <p className="text-xs text-emerald-600 mt-1 leading-relaxed">{sizeReasoning}</p>
                </div>
              </div>
            )}

            {/* ACTION: Generate Button */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleCreateAvatar}
                disabled={!userImage || isLoading || dailyUsage >= MAX_DAILY_USAGE}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200/50 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden
                        ${!userImage || dailyUsage >= MAX_DAILY_USAGE
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="animate-pulse">{loadingStep}</span>
                  </>
                ) : (
                  <>
                    <Shirt className="w-5 h-5 mr-1" />
                    <span>Provador Virtual</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium tracking-wide">
                      1 crédito
                    </span>
                  </>
                )}
              </button>

              <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" />
                <span>Sua IA de estilo pessoal</span>
              </div>
            </div>
          </div>
        )}

        {/* === STEP: MEASUREMENTS (Adv Simulation) === */}
        {step === Step.MEASUREMENTS && (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={() => setStep(Step.HOME)}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors group pl-1"
            >
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar ao Menu</span>
            </button>

            <h2 className="text-2xl font-bold text-slate-800">Simulação Avançada</h2>
            <p className="text-slate-500 text-sm">Insira seus dados para gerar um modelo IA ou calcular medidas exatas.</p>

            <div className="space-y-4 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">

              {/* Basic Data */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ALTURA (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all" placeholder="170" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">PESO (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all" placeholder="70" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">IDADE</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all" placeholder="25" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">GÊNERO</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all">
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                    <option value="unisex">Unissex</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">TIPO DE CORPO</label>
                <div className="grid grid-cols-3 gap-2">
                  {['slim', 'average', 'athletic', 'curvy', 'plus'].map(t => (
                    <button
                      key={t}
                      onClick={() => setBodyType(t)}
                      className={`p-2 rounded-lg text-xs font-medium border transition-all capitalize
                         ${bodyType === t
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-[1.02]'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Measurements (Restored) */}
              <div className="pt-6 border-t border-slate-100 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Ruler className="w-3 h-3 text-slate-400" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Medidas Opcionais (Maior Precisão)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">TÓRAX (cm)</label>
                    <input type="number" value={bust} onChange={e => setBust(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Ex: 90" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">CINTURA (cm)</label>
                    <input type="number" value={waist} onChange={e => setWaist(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Ex: 80" />
                  </div>
                  {gender === 'female' && (
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">QUADRIL (cm)</label>
                      <input type="number" value={hips} onChange={e => setHips(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Ex: 100" />
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Actions */}
              <div className="grid grid-cols-1 gap-3 pt-4">
                <button
                  onClick={handleEstimateSize}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  {isLoading && loadingStep.includes('Calculando') ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Ruler className="w-4 h-4" />
                      <span>Calcular Apenas Medidas</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleGenerateAIModel}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl font-bold text-white shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 transform transition-all active:scale-[0.98]"
                >
                  {isLoading && loadingStep.includes('Criando') ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      <span>Gerar Modelo IA & Provador</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-slate-400 mt-1">
                  Gera um modelo sintético realista (1 token) baseado nas suas medidas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === STEP: RESULT === */}
        {step === Step.RESULT && resultImage && (
          <div className="space-y-4 animate-fade-in h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Resultado
              </h2>
              <button onClick={() => setStep(Step.HOME)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl overflow-hidden relative shadow-2xl border border-slate-100 group">
              {/* FIXED: object-contain displays full image without cropping */}
              <img src={resultImage} className="w-full h-full object-contain" alt="Resultado Final" />

              {/* Result Actions Overlay - DOWNLOAD REMOVED */}
              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white/90 to-transparent pt-20 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 hover:opacity-100 justify-center">
                <button
                  onClick={() => setStep(Step.CHOICE)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar Outra Peça
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 pb-4">
              Você usou <strong className="text-indigo-600">{dailyUsage}</strong> de {MAX_DAILY_USAGE} tentativas hoje.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

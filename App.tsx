import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Ruler, Sparkles, Shirt, ArrowRight, RotateCcw, X, Loader2, Info, ChevronRight, Zap } from 'lucide-react';

enum Step {
  HOME = -1,
  CHOICE = 0,
  UPLOAD = 1,
  MEASUREMENTS = 2,
  RESULT = 3,
}

export default function App() {
  const [step, setStep] = useState<Step>(Step.HOME); // Start at HOME
  const [userImage, setUserImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [productDescription, setProductDescription] = useState<string>('');

  // Measurements
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [bodyType, setBodyType] = useState('average');
  const [gender, setGender] = useState('female');
  const [bust, setBust] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [sizeRecommendation, setSizeRecommendation] = useState<string | null>(null);
  const [sizeReasoning, setSizeReasoning] = useState<string | null>(null);

  // Daily Usage Limit
  const [dailyUsage, setDailyUsage] = useState(0);
  const MAX_DAILY_USAGE = 10;

  useEffect(() => {
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

    // Check daily usage
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `modelux_usage_${today}`;
    const savedUsage = localStorage.getItem(storageKey);
    if (savedUsage) {
      setDailyUsage(parseInt(savedUsage, 10));
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const incrementUsage = () => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `modelux_usage_${today}`;
    const newUsage = dailyUsage + 1;
    setDailyUsage(newUsage);
    localStorage.setItem(storageKey, newUsage.toString());
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
      setStep(Step.MEASUREMENTS);
    }
  };

  const handleEstimateSize = async () => {
    setIsLoading(true);
    setLoadingStep('Calculando medidas ideais...');
    try {
      const response = await fetch('https://modelux-tryon-api.onrender.com/api/estimate-size', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height, weight, age, bodyType, gender, bust, waist, hips,
          product_description: productDescription
        }),
      });

      if (!response.ok) throw new Error('Erro ao estimar tamanho');

      const data = await response.json();
      setSizeRecommendation(data.size);
      setSizeReasoning(data.reasoning);
      setStep(Step.CHOICE);
    } catch (error) {
      console.error(error);
      alert('Erro ao calcular tamanho. Verifique os dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (dailyUsage >= MAX_DAILY_USAGE) {
      alert('Você atingiu o limite diário de 10 provadores. Volte amanhã para provar mais looks!');
      return;
    }

    if (!selectedImage || !userImage) return;

    setIsLoading(true);
    setLoadingStep('Analisando tecidos e medidas...');

    try {
      // 1. Upload User Image
      const userFormData = new FormData();
      userFormData.append('image', userImage);

      const userUploadRes = await fetch('https://modelux-tryon-api.onrender.com/api/upload', {
        method: 'POST',
        body: userFormData,
      });

      if (!userUploadRes.ok) throw new Error('Erro no upload da foto do usuário');
      const { url: userImageUrl, description: userDescription } = await userUploadRes.json();

      setLoadingStep('Digitalizando a peça de roupa...');

      // 2. Upload Product Image
      let productImageUrl = selectedImage;
      if (selectedImage.startsWith('blob:') || selectedImage.startsWith('data:')) {
        const productBlob = await fetch(selectedImage).then(r => r.blob());
        const prodFormData = new FormData();
        prodFormData.append('image', productBlob);
        const prodUploadRes = await fetch('https://modelux-tryon-api.onrender.com/api/upload', {
          method: 'POST',
          body: prodFormData
        });
        if (!prodUploadRes.ok) throw new Error('Erro no upload do produto');
        const prodData = await prodUploadRes.json();
        productImageUrl = prodData.url;
      }

      setLoadingStep('Costurando digitalmente (Alta Fidelidade)...');
      const tryOnResponse = await fetch('https://modelux-tryon-api.onrender.com/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_image_url: userImageUrl,
          product_image_url: productImageUrl,
          user_description: userDescription,
          product_description: productDescription
        }),
      });

      if (!tryOnResponse.ok) throw new Error('Falha na geração da imagem');

      const tryOnBlob = await tryOnResponse.blob();
      const tryOnUrl = URL.createObjectURL(tryOnBlob);

      setResultImage(tryOnUrl);
      incrementUsage();
      setStep(Step.RESULT);
    } catch (error) {
      console.error(error);
      alert('Erro ao criar avatar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSelectionMode = () => {
    window.parent.postMessage('START_IMAGE_SELECTION', '*');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative">
      {/* Background Ambience (Light Mode) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-white/70 border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
            MODELUX
          </span>
          <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">Try-ON</span>
        </div>

        {step !== Step.HOME && (
          <button onClick={() => setStep(Step.HOME)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        )}
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 max-w-md h-[calc(100vh-80px)] overflow-y-auto pb-20 scrollbar-hide">

        {/* Step -1: HOME (Mode Selection) */}
        {step === Step.HOME && (
          <div className="space-y-8 animate-fade-in pt-4">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">Olá! 👋</h1>
              <p className="text-slate-500">O que você gostaria de fazer hoje?</p>
            </div>

            <div className="space-y-4">
              {/* Mode Card 1: Quick Mode */}
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
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white bg-indigo-500 px-2 py-0.5 rounded-full">1 Crédito</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Card 2: Advanced Simulation */}
              <div
                onClick={() => setStep(Step.MEASUREMENTS)}
                className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 hover:border-violet-200 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Ruler className="w-24 h-24 text-violet-600 rotate-[15deg]" />
                </div>

                <div className="flex items-start gap-4 relative z-10">
                  <div className="p-3 bg-violet-100 rounded-xl text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors shadow-sm">
                    <Ruler className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-violet-600 transition-colors">Simulação Avançada</h3>
                    <p className="text-sm text-slate-500 mt-1">Defina suas medidas para um caimento preciso.</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Alta Precisão</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="text-center pt-8">
                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                  <span className="text-xs text-slate-400">Tokens Diários:</span>
                  <span className={`text-sm font-bold ${dailyUsage >= MAX_DAILY_USAGE ? 'text-red-500' : 'text-indigo-600'}`}>
                    {MAX_DAILY_USAGE - dailyUsage}
                  </span>
                  <span className="text-xs text-slate-400">/ {MAX_DAILY_USAGE}</span>
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-indigo-400 cursor-help" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white border border-slate-700 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center text-xs">
                      Cada provador consome 1 crédito. Medidas são grátis.
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Step 0: Choice Screen (Now accessed via Home) */}
        {step === Step.CHOICE && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setStep(Step.HOME)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors group">
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar ao Menu</span>
            </button>

            <h1 className="text-3xl font-bold text-slate-800">Visualizar</h1>

            <div className="grid grid-cols-2 gap-4">
              {/* Product Card */}
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group">
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 shadow-sm">PRODUTO</div>
                <div className="aspect-[3/4] rounded-xl bg-slate-100 overflow-hidden relative border border-slate-200">
                  {selectedImage ? (
                    <img src={selectedImage} alt="Produto" className="w-full h-full object-cover" />
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
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 relative group cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => document.getElementById('model-upload')?.click()}>
                <div className="absolute top-2 left-2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm">Modelo</div>
                <div className="aspect-[3/4] rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all">
                  {userImagePreview ? (
                    <img src={userImagePreview} alt="Modelo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-xs font-semibold">Carregar Foto</span>
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
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 shadow-sm">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Ruler className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">Tamanho Recomendado: {sizeRecommendation}</h3>
                  <p className="text-xs text-emerald-600 mt-1">{sizeReasoning}</p>
                </div>
              </div>
            )}

            {/* Generate Button with Limit Info */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleCreateAvatar}
                disabled={!userImage || isLoading || dailyUsage >= MAX_DAILY_USAGE}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden
                    ${!userImage || dailyUsage >= MAX_DAILY_USAGE
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{loadingStep}</span>
                  </>
                ) : dailyUsage >= MAX_DAILY_USAGE ? (
                  <span>Limite Diário Atingido (10/10)</span>
                ) : (
                  <>
                    <span>Provador Virtual</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium tracking-wide">
                      1 crédito
                    </span>
                  </>
                )}
              </button>

              <div className="text-center text-xs text-slate-400">
                Sua IA de estilo pessoal
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Measurements Form (Advanced Simulation) */}
        {step === Step.MEASUREMENTS && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setStep(Step.HOME)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors group">
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar ao Menu</span>
            </button>

            <h2 className="text-2xl font-bold text-slate-800">Simulação Avançada</h2>
            <p className="text-slate-500 text-sm">Preencha suas medidas para máxima precisão.</p>

            <div className="space-y-4 bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase font-bold">Altura (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="170" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase font-bold">Peso (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="70" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase font-bold">Idade</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="25" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase font-bold">Gênero</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                    <option value="unisex">Unissex</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase font-bold">Tipo de Corpo</label>
                <div className="grid grid-cols-3 gap-2">
                  {['slim', 'average', 'athletic', 'curvy', 'plus'].map(type => (
                    <button
                      key={type}
                      onClick={() => setBodyType(type)}
                      className={`p-2 rounded-lg text-xs font-medium border transition-all ${bodyType === type ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Measurements */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2 font-medium">OPCIONAL (PARA MAIOR PRECISÃO)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase">Busto/Tórax</label>
                    <input type="number" value={bust} onChange={e => setBust(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:border-indigo-500 outline-none" placeholder="cm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase">Cintura</label>
                    <input type="number" value={waist} onChange={e => setWaist(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:border-indigo-500 outline-none" placeholder="cm" />
                  </div>
                  {gender === 'female' && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase">Quadril</label>
                      <input type="number" value={hips} onChange={e => setHips(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:border-indigo-500 outline-none" placeholder="cm" />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleEstimateSize}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 mt-2 transform transition-transform active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Calcular Medidas & Ir para Provador'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === Step.RESULT && resultImage && (
          <div className="space-y-4 animate-fade-in h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Resultado</h2>
              <button onClick={() => setStep(Step.HOME)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl overflow-hidden relative shadow-2xl border border-slate-100">
              <img src={resultImage} alt="Try-On Result" className="w-full h-full object-cover" />

              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white/90 to-transparent pt-20">
                <div className="flex gap-3">
                  <button onClick={() => setStep(Step.CHOICE)} className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-sm border border-slate-200">
                    <RotateCcw className="w-4 h-4" />
                    Refazer
                  </button>
                  <a href={resultImage} download="modelux-tryon.png" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                    <Upload className="w-4 h-4" />
                    Salvar
                  </a>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 pb-4">
              Você usou {dailyUsage} de {MAX_DAILY_USAGE} tentativas hoje.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
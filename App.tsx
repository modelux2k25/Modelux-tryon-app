import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Ruler, Sparkles, Shirt, ArrowRight, RotateCcw, X, Loader2, Info } from 'lucide-react';

enum Step {
  CHOICE = 0,
  UPLOAD = 1,
  MEASUREMENTS = 2,
  RESULT = 3,
}

export default function App() {
  const [step, setStep] = useState<Step>(Step.CHOICE);
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
  const [hips, setHips] = useState(''); // Only for female
  const [sizeRecommendation, setSizeRecommendation] = useState<string | null>(null);
  const [sizeReasoning, setSizeReasoning] = useState<string | null>(null);

  // Daily Usage Limit
  const [dailyUsage, setDailyUsage] = useState(0);
  const MAX_DAILY_USAGE = 10;

  useEffect(() => {
    // Listen for product details from the widget loader
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
      setStep(Step.CHOICE); // Go to main screen after sizing
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

      // 2. Upload Product Image (if needed)
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

      // 3. Generate Try-On
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
      incrementUsage(); // Increment usage only on success
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
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-gray-900/50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            MODELUX
          </span>
          <span className="text-xs font-light tracking-widest text-indigo-400">Try-ON</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full ${step >= i - 1 ? 'bg-indigo-500' : 'bg-gray-700'}`} />
          ))}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 max-w-md h-[calc(100vh-80px)] overflow-y-auto pb-20 scrollbar-hide">

        {/* Step 0: Main Screen */}
        {step === Step.CHOICE && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <ArrowRight className="w-4 h-4" />
              <span>Início</span>
            </div>

            <h1 className="text-3xl font-bold">Visualizar</h1>

            <div className="grid grid-cols-2 gap-4">
              {/* Product Card */}
              <div className="bg-gray-800/50 p-3 rounded-2xl border border-white/10 relative group">
                <div className="absolute top-2 left-2 bg-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full z-10">PRODUTO</div>
                <div className="aspect-[3/4] rounded-xl bg-gray-700 overflow-hidden relative">
                  {selectedImage ? (
                    <img src={selectedImage} alt="Produto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-xs">Sem Imagem</div>
                  )}
                  <button
                    onClick={triggerSelectionMode}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-indigo-600 rounded-full backdrop-blur-sm transition-colors"
                    title="Trocar Peça"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Model Card */}
              <div className="bg-gray-800/50 p-3 rounded-2xl border border-white/10 relative group dashed-border hover:border-indigo-500/50 transition-colors cursor-pointer" onClick={() => document.getElementById('model-upload')?.click()}>
                <div className="absolute top-2 left-2 text-gray-400 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">Modelo</div>
                <div className="aspect-[3/4] rounded-xl bg-gray-700/30 flex flex-col items-center justify-center gap-2 text-gray-400 group-hover:text-indigo-400 transition-colors">
                  {userImagePreview ? (
                    <img src={userImagePreview} alt="Modelo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-xs font-medium">Carregar Foto</span>
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
            {sizeRecommendation ? (
              <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 p-4 rounded-xl border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Ruler className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-100">Tamanho Recomendado: {sizeRecommendation}</h3>
                  <p className="text-xs text-emerald-200/70 mt-1">{sizeReasoning}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setStep(Step.MEASUREMENTS)}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl border border-white/10 text-gray-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Ruler className="w-4 h-4" />
                Descobrir meu tamanho ideal
              </button>
            )}

            {/* Generate Button with Limit Info */}
            <div className="space-y-2">
              <button
                onClick={handleCreateAvatar}
                disabled={!userImage || isLoading || dailyUsage >= MAX_DAILY_USAGE}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden
                    ${!userImage || dailyUsage >= MAX_DAILY_USAGE
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25'
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

              {/* Counter & Tooltip */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <span>Restam {MAX_DAILY_USAGE - dailyUsage} tentativas hoje</span>
                <div className="relative group">
                  <Info className="w-3 h-3 cursor-help text-gray-400 hover:text-white transition-colors" />

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-gray-800 border border-white/10 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                    <p className="text-gray-300 leading-tight">
                      Cada geração de imagem (Provador ou Modelo IA) consome <strong className="text-white">1 crédito</strong> do seu limite diário.
                    </p>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45 border-r border-b border-white/10"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Measurements Form */}
        {step === Step.MEASUREMENTS && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-4 cursor-pointer" onClick={() => setStep(Step.CHOICE)}>
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Voltar</span>
            </div>
            <h2 className="text-2xl font-bold">Suas Medidas</h2>
            <p className="text-gray-400 text-sm">Para uma recomendação precisa.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Altura (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="170" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Peso (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="70" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Idade</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="25" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Gênero</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none">
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                    <option value="unisex">Unissex</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase">Tipo de Corpo</label>
                <div className="grid grid-cols-3 gap-2">
                  {['slim', 'average', 'athletic', 'curvy', 'plus'].map(type => (
                    <button
                      key={type}
                      onClick={() => setBodyType(type)}
                      className={`p-2 rounded-lg text-xs border ${bodyType === type ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Busto/Tórax (cm)</label>
                  <input type="number" value={bust} onChange={e => setBust(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="Opcional" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase">Cintura (cm)</label>
                  <input type="number" value={waist} onChange={e => setWaist(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="Opcional" />
                </div>
              </div>

              {/* Conditional Hips Field - Only for Female */}
              {gender === 'female' && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-xs text-gray-500 uppercase">Quadril (cm)</label>
                  <input type="number" value={hips} onChange={e => setHips(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" placeholder="Essencial para calças/saias" />
                </div>
              )}

              <button
                onClick={handleEstimateSize}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 mt-4"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Calcular Tamanho'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === Step.RESULT && resultImage && (
          <div className="space-y-4 animate-fade-in h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Resultado</h2>
              <button onClick={() => setStep(Step.CHOICE)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl overflow-hidden relative shadow-2xl border border-white/10">
              <img src={resultImage} alt="Try-On Result" className="w-full h-full object-cover" />

              <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex gap-3">
                  <button onClick={() => setStep(Step.CHOICE)} className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Testar Outro
                  </button>
                  <a href={resultImage} download="modelux-tryon.png" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    Salvar
                  </a>
                </div>
              </div>
            </div>

            {/* Usage Info on Result Screen */}
            <div className="text-center text-xs text-gray-500 pb-4">
              Você usou {dailyUsage} de {MAX_DAILY_USAGE} tentativas hoje.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
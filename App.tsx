import React, { useState, useEffect } from 'react';
import { SecureCanvas } from './components/SecureCanvas';
import { LoadingState } from './types';

const API_ENDPOINT = '/api/generate';
const AVATAR_ENDPOINT = '/api/generate-avatar';

enum Step {
  CHOICE = 0,
  UPLOAD = 1,
  CREATE_MODEL = 2,
  RESULT = 3
}

export default function App() {
  const [step, setStep] = useState<Step>(Step.CHOICE);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Avatar Params
  const [avatarParams, setAvatarParams] = useState({
    height: '',
    weight: '',
    age: '',
    bodyType: 'Hourglass',
    skinTone: 'Light',
    gender: 'Female',
    bust: '',
    waist: ''
  });

  // Optional Face Image for Avatar
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);

  // Setup communication
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productUrl = params.get('product_image');
    if (productUrl) setProductImage(productUrl);

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PRODUCT_IMAGE') {
        setProductImage(event.data.payload);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
      setResultImage(null);
    }
  };

  const handleFaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFaceImage(file);
      setFaceImagePreview(URL.createObjectURL(file));
    }
  };

  const base64ToFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleCreateAvatar = async () => {
    if (!avatarParams.height || !avatarParams.weight || !avatarParams.age) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setStatus(LoadingState.PROCESSING);
    setErrorMessage('');

    try {
      // Use FormData to send file + data
      const formData = new FormData();
      formData.append('height', avatarParams.height);
      formData.append('weight', avatarParams.weight);
      formData.append('age', avatarParams.age);
      formData.append('bodyType', avatarParams.bodyType);
      formData.append('skinTone', avatarParams.skinTone);
      formData.append('gender', avatarParams.gender);
      formData.append('bust', avatarParams.bust);
      formData.append('waist', avatarParams.waist);

      if (faceImage) {
        formData.append('face_image', faceImage);
      }

      const response = await fetch(AVATAR_ENDPOINT, {
        method: 'POST',
        body: formData, // No Content-Type header when using FormData
      });

      if (!response.ok) throw new Error('Falha ao criar o modelo.');

      const data = await response.json();
      if (data.success && data.image) {
        // Convert base64 to File
        const file = base64ToFile(data.image, 'avatar.png');
        setUserImage(file);
        setUserImagePreview(data.image);
        setStatus(LoadingState.IDLE);
        // Go to upload step (which acts as preview now)
        setStep(Step.UPLOAD);
      } else {
        throw new Error(data.error || 'Erro ao criar modelo.');
      }
    } catch (err: any) {
      setStatus(LoadingState.ERROR);
      setErrorMessage(err.message || 'Erro de comunicação');
    }
  };

  const handleGenerate = async () => {
    if (!userImage || !productImage) return;

    setStatus(LoadingState.PROCESSING);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('user_image', userImage);
      formData.append('product_image_url', productImage);

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Falha ao gerar a visualização');

      const data = await response.json();

      if (data.success && data.image) {
        setResultImage(data.image);
        setStatus(LoadingState.COMPLETE);
        setStep(Step.RESULT);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      setStatus(LoadingState.ERROR);
      setErrorMessage(err.message || 'Erro de comunicação');
    }
  };

  const resetFlow = () => {
    setStep(Step.CHOICE);
    setUserImage(null);
    setUserImagePreview(null);
    setResultImage(null);
    setStatus(LoadingState.IDLE);
    setFaceImage(null);
    setFaceImagePreview(null);
    setAvatarParams({
      height: '',
      weight: '',
      age: '',
      bodyType: 'Hourglass',
      skinTone: 'Light',
      gender: 'Female',
      bust: '',
      waist: ''
    });
  };

  // --- Render Helpers ---

  const Header = () => (
    <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-center bg-gradient-to-b from-white/90 to-transparent">
      <div className="flex items-center">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          MODELUX <span className="font-light text-indigo-600">Try-ON</span>
        </h1>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${step >= i ? 'bg-indigo-600' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white relative overflow-hidden font-sans text-slate-800 flex flex-col">
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-indigo-100 rounded-full blur-[80px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-purple-100 rounded-full blur-[80px] opacity-60 pointer-events-none" />

      <Header />

      <main className="flex-1 flex flex-col relative z-0 pt-20 px-6 pb-6 overflow-y-auto custom-scrollbar">

        {/* STEP 0: CHOICE */}
        {step === Step.CHOICE && (
          <div className="flex flex-col h-full animate-fade-in justify-center gap-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-slate-900">Como você quer provar?</h2>
              <p className="text-slate-500 text-sm mt-1">Escolha a melhor opção para você.</p>
            </div>

            <button onClick={() => setStep(Step.UPLOAD)} className="group relative p-6 bg-white border-2 border-slate-100 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Modo Rápido</h3>
                  <p className="text-xs text-slate-500">Faça upload de uma foto sua.</p>
                </div>
              </div>
            </button>

            <button onClick={() => setStep(Step.CREATE_MODEL)} className="group relative p-6 bg-white border-2 border-slate-100 hover:border-purple-500 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">Simulação Avançada</h3>
                  <p className="text-xs text-slate-500">Gere um modelo com suas medidas.</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* STEP 2: CREATE MODEL FORM */}
        {step === Step.CREATE_MODEL && (
          <div className="flex flex-col h-full animate-slide-up">
            <div className="mb-4">
              <button onClick={() => setStep(Step.CHOICE)} className="text-xs text-slate-400 hover:text-slate-600 mb-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Voltar
              </button>
              <h2 className="text-2xl font-bold text-slate-900">Seus Dados</h2>
              <p className="text-slate-500 text-sm mt-1">A IA vai criar um modelo baseado nisso.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-1 pb-20 custom-scrollbar">

              {/* Product Preview */}
              <div className="mb-2 p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
                  {productImage ? (
                    <img src={productImage} alt="Product" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-slate-100" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700">Produto</p>
                  <p className="text-[10px] text-slate-400">Base da simulação</p>
                </div>
              </div>

              {/* Gender Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gênero</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAvatarParams({ ...avatarParams, gender: 'Female' })}
                    className={`p-2 rounded-lg border text-sm font-medium transition-all ${avatarParams.gender === 'Female' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    Feminino
                  </button>
                  <button onClick={() => setAvatarParams({ ...avatarParams, gender: 'Male' })}
                    className={`p-2 rounded-lg border text-sm font-medium transition-all ${avatarParams.gender === 'Male' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    Masculino
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Altura (cm)</label>
                  <input type="number" placeholder="165" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    value={avatarParams.height} onChange={e => setAvatarParams({ ...avatarParams, height: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Peso (kg)</label>
                  <input type="number" placeholder="65" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    value={avatarParams.weight} onChange={e => setAvatarParams({ ...avatarParams, weight: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Busto/Tórax (cm)</label>
                  <input type="number" placeholder="90" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    value={avatarParams.bust} onChange={e => setAvatarParams({ ...avatarParams, bust: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cintura (cm)</label>
                  <input type="number" placeholder="70" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    value={avatarParams.waist} onChange={e => setAvatarParams({ ...avatarParams, waist: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Idade</label>
                <input type="number" placeholder="25" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  value={avatarParams.age} onChange={e => setAvatarParams({ ...avatarParams, age: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Corpo</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  value={avatarParams.bodyType} onChange={e => setAvatarParams({ ...avatarParams, bodyType: e.target.value })}>
                  <option value="Hourglass">Ampulheta (Curvilíneo)</option>
                  <option value="Rectangle">Retangular (Atlético)</option>
                  <option value="Pear">Pêra (Quadril largo)</option>
                  <option value="Apple">Oval (Mais volume no tronco)</option>
                  <option value="Inverted Triangle">Triângulo Invertido (Ombros largos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tom de Pele</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  value={avatarParams.skinTone} onChange={e => setAvatarParams({ ...avatarParams, skinTone: e.target.value })}>
                  <option value="Light">Clara</option>
                  <option value="Medium">Média / Morena</option>
                  <option value="Dark">Escura / Negra</option>
                </select>
              </div>

              {/* Optional Face Upload */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-2">Foto do Rosto (Opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                    {faceImagePreview ? (
                      <img src={faceImagePreview} alt="Face" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-full h-full text-slate-300 p-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <span className="inline-block px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      {faceImage ? 'Trocar foto' : 'Carregar Selfie'}
                    </span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFaceImageUpload} />
                  </label>
                  {faceImage && (
                    <button onClick={() => { setFaceImage(null); setFaceImagePreview(null); }} className="text-slate-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Para maior realismo, envie uma selfie clara.</p>
              </div>

              <div className="mt-6 pb-4">
                {status === LoadingState.ERROR && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">{errorMessage}</div>
                )}
                <button
                  onClick={handleCreateAvatar}
                  disabled={status === LoadingState.PROCESSING}
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                    ${status === LoadingState.PROCESSING ? 'bg-slate-300' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {status === LoadingState.PROCESSING ? 'Criando Modelo...' : 'Gerar Meu Modelo'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STEP 1 (REUSED): PREVIEW & GENERATE */}
        {step === Step.UPLOAD && (
          <div className="flex flex-col h-full animate-slide-up">
            <div className="mb-4 flex justify-between items-end">
              <div>
                <button onClick={() => setStep(Step.CHOICE)} className="text-xs text-slate-400 hover:text-slate-600 mb-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Início
                </button>
                <h2 className="text-2xl font-bold text-slate-900">Visualizar</h2>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-4 content-start">
              {/* Product */}
              <div className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="absolute top-2 left-2 z-10"><span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Produto</span></div>
                <div className="flex-1 p-2 flex items-center justify-center bg-slate-50/50">
                  {productImage && <img src={productImage} alt="Product" className="max-w-full max-h-[140px] object-contain" />}
                </div>
              </div>

              {/* User/Model */}
              <div className={`relative rounded-xl overflow-hidden flex flex-col transition-all group ${userImagePreview ? 'bg-slate-900' : 'bg-slate-50 border-2 border-dashed border-slate-200'}`}>
                <div className="absolute top-2 left-2 z-10"><span className="bg-white/20 text-white backdrop-blur-sm text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Modelo</span></div>
                {userImagePreview ? (
                  <>
                    <img src={userImagePreview} alt="User" className="w-full h-full object-cover" />
                    <button onClick={() => { setUserImage(null); setUserImagePreview(null); }} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-2">
                    <span className="text-xs font-semibold text-slate-700">Carregar Foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleUserImageUpload} />
                  </label>
                )}
              </div>
            </div>

            <div className="mt-6">
              {status === LoadingState.ERROR && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">{errorMessage}</div>}
              <button onClick={handleGenerate} disabled={!userImage || status === LoadingState.PROCESSING} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${status === LoadingState.PROCESSING ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {status === LoadingState.PROCESSING ? 'Processando...' : 'Provador Virtual'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULT */}
        {step === Step.RESULT && resultImage && (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-4 text-center">
              <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold tracking-wider uppercase rounded-full">Sucesso</span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">Ficou incrível!</h2>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="relative w-full shadow-2xl rounded-2xl overflow-hidden border border-slate-100 bg-white">
                <SecureCanvas imageSrc={resultImage} />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2 py-1 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                  <span className="text-[10px] text-white font-medium">Modelux AI</span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button onClick={resetFlow} className="w-full py-4 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Testar outra vez</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
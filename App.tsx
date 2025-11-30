import React, { useState, useEffect } from 'react';
import { SecureCanvas } from './components/SecureCanvas';
import { LoadingState } from './types';

const API_ENDPOINT = '/api/generate';

// Simple wizard steps - Removed INTRO
enum Step {
    UPLOAD = 0,
    RESULT = 1
}

export default function App() {
    const [step, setStep] = useState<Step>(Step.UPLOAD);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [userImage, setUserImage] = useState<File | null>(null);
    const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
    const [errorMessage, setErrorMessage] = useState<string>('');

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
        setStep(Step.UPLOAD);
        setUserImage(null);
        setUserImagePreview(null);
        setResultImage(null);
        setStatus(LoadingState.IDLE);
    };

    // --- Render Helpers ---

    // Header Component
    const Header = () => (
        <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-center bg-gradient-to-b from-white/90 to-transparent">
            <div className="flex items-center">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                    MODELUX <span className="font-light text-indigo-600">Try-ON</span>
                </h1>
            </div>
            <div className="flex gap-1">
                {/* Adjusted for 2 steps */}
                {[0, 1].map(i => (
                    <div key={i} className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${step >= i ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white relative overflow-hidden font-sans text-slate-800 flex flex-col">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-indigo-100 rounded-full blur-[80px] opacity-60 pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-purple-100 rounded-full blur-[80px] opacity-60 pointer-events-none" />

            <Header />

            <main className="flex-1 flex flex-col relative z-0 pt-20 px-6 pb-6 overflow-y-auto custom-scrollbar">

                {/* STEP 1: User Upload & Process (Default Entry Point) */}
                {step === Step.UPLOAD && (
                    <div className="flex flex-col h-full animate-slide-up">
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-slate-900">Prepare o Visual</h2>
                            <p className="text-slate-500 text-sm mt-1">Envie sua foto para combinar com o produto.</p>
                        </div>

                        {/* SIDE BY SIDE GRID */}
                        <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-4 content-start">

                            {/* Left: Product */}
                            <div className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col">
                                <div className="absolute top-2 left-2 z-10">
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Produto</span>
                                </div>
                                <div className="flex-1 p-2 flex items-center justify-center bg-slate-50/50">
                                    {productImage && (
                                        <img src={productImage} alt="Product" className="max-w-full max-h-[140px] sm:max-h-[200px] object-contain drop-shadow-md" />
                                    )}
                                </div>
                            </div>

                            {/* Right: User Upload */}
                            <div className={`relative rounded-xl overflow-hidden flex flex-col transition-all group ${userImagePreview ? 'bg-slate-900' : 'bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
                                <div className="absolute top-2 left-2 z-10">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${userImagePreview ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-slate-200 text-slate-600'}`}>Você</span>
                                </div>

                                {userImagePreview ? (
                                    <>
                                        <img src={userImagePreview} alt="User" className="w-full h-full object-cover" />
                                        <button
                                            onClick={(e) => { e.preventDefault(); setUserImage(null); setUserImagePreview(null); }}
                                            className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-md transition-colors"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-2">
                                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                                            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 text-center leading-tight">Carregar Foto</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleUserImageUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            {status === LoadingState.ERROR && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={!userImage || status === LoadingState.PROCESSING}
                                className={`w-full py-4 px-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                  ${status === LoadingState.PROCESSING
                                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95'}`}
                            >
                                {status === LoadingState.PROCESSING ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Processando...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                        Gerar Visualização
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Result */}
                {step === Step.RESULT && resultImage && (
                    <div className="flex flex-col h-full animate-fade-in">
                        <div className="mb-4 text-center">
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold tracking-wider uppercase rounded-full">Sucesso</span>
                            <h2 className="text-xl font-bold text-slate-900 mt-2">Ficou incrível!</h2>
                        </div>

                        <div className="flex-1 flex flex-col justify-center items-center">
                            <div className="relative w-full shadow-2xl rounded-2xl overflow-hidden border border-slate-100 bg-white">
                                <SecureCanvas imageSrc={resultImage} />
                                {/* Watermark/Badge */}
                                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2 py-1 rounded-md">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                                    <span className="text-[10px] text-white font-medium">Modelux AI</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Protegido contra download
                            </p>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={resetFlow}
                                className="w-full py-4 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                                Testar outra foto
                            </button>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
import React, { useEffect, useRef } from 'react';

interface SecureCanvasProps {
    imageSrc: string;
    className?: string;
}

export const SecureCanvas: React.FC<SecureCanvasProps> = ({ imageSrc, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !imageSrc || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            // Logic to fit image within container width while maintaining aspect ratio
            // In this specific styling, we set canvas width to container width
            // and calculate height.

            const containerWidth = container.clientWidth;
            const scale = containerWidth / img.width;

            canvas.width = img.width;
            canvas.height = img.height;

            // We rely on CSS max-width: 100% to scale it visually, 
            // but internal resolution remains high for quality.
            ctx.drawImage(img, 0, 0);
        };
        img.src = imageSrc;

        // Prevention listeners
        const preventDefault = (e: Event) => e.preventDefault();
        canvas.addEventListener('contextmenu', preventDefault);
        canvas.addEventListener('dragstart', preventDefault);

        return () => {
            canvas.removeEventListener('contextmenu', preventDefault);
            canvas.removeEventListener('dragstart', preventDefault);
        };
    }, [imageSrc]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden w-full h-auto bg-slate-50 ${className}`}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
        >
            <canvas
                ref={canvasRef}
                className="block w-full h-auto pointer-events-auto"
                style={{ pointerEvents: 'auto' }}
            />
            <div className="absolute inset-0 bg-transparent z-10" onContextMenu={(e) => e.preventDefault()} />
        </div>
    );
};
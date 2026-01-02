
import React, { useRef, useEffect, useState } from 'react';

interface InpaintCanvasProps {
  imageUrl: string;
  isEditMode: boolean;
  brushSize: number;
  onMaskChange: (maskBase64: string | null) => void;
}

export const InpaintCanvas: React.FC<InpaintCanvasProps> = ({ 
  imageUrl, 
  isEditMode, 
  brushSize, 
  onMaskChange 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize canvas dimensions with the actual rendered image
  const syncCanvasDimensions = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    // Get the displayed size of the image within its object-contain container
    const rect = img.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    // Set canvas to match the image's bounding box
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.top = `${rect.top - containerRect.top}px`;
    canvas.style.left = `${rect.left - containerRect.left}px`;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = brushSize;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      contextRef.current = ctx;
    }
  };

  useEffect(() => {
    setIsLoading(true);
    // When image changes or loads, reset canvas
    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        syncCanvasDimensions();
        setIsLoading(false);
      } else {
        img.onload = () => {
          syncCanvasDimensions();
          setIsLoading(false);
        };
      }
    }

    const handleResize = () => syncCanvasDimensions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageUrl]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    const { offsetX, offsetY } = getCoordinates(e);
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isEditMode) return;
    const { offsetX, offsetY } = getCoordinates(e);
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    
    const maskBase64 = canvasRef.current?.toDataURL('image/png').split(',')[1];
    onMaskChange(maskBase64 || null);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.clientX - rect.left;
      y = e.nativeEvent.clientY - rect.top;
    }
    return { offsetX: x, offsetY: y };
  };

  const clearMask = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ctx = contextRef.current;
    if (ctx && canvasRef.current) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onMaskChange(null);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full cursor-crosshair flex items-center justify-center overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <img 
        ref={imageRef}
        src={imageUrl} 
        className="w-full h-full object-contain pointer-events-none select-none" 
        alt="Edit Target" 
      />
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className={`absolute transition-opacity duration-300 ${isEditMode ? 'opacity-50 mix-blend-screen' : 'opacity-0 pointer-events-none'}`}
      />
      
      {isEditMode && !isLoading && (
        <div className="absolute bottom-4 left-4 flex gap-4 z-50">
          <button 
            onClick={clearMask}
            className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-xl shadow-2xl transition-all flex items-center space-x-2 backdrop-blur-md border border-red-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span className="text-[9px] font-bold uppercase tracking-widest">Clear Mask</span>
          </button>
          <div className="p-3 bg-indigo-600/80 text-white rounded-xl shadow-2xl backdrop-blur-md border border-indigo-500/20 flex items-center">
            <span className="text-[9px] font-bold uppercase tracking-widest">Draw to "FIX" area</span>
          </div>
        </div>
      )}
    </div>
  );
};

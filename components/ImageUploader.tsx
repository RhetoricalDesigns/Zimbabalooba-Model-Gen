
import React from 'react';
import { ImageState } from '../types';

interface ImageUploaderProps {
  label: string;
  description: string;
  onImageSelect: (image: ImageState | null) => void;
  selectedImage: ImageState | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  description, 
  onImageSelect, 
  selectedImage 
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        onImageSelect({
          base64: base64String,
          mimeType: file.type,
          previewUrl: URL.createObjectURL(file)
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-indigo-400">{label}</span>
      </div>
      <div 
        className={`relative h-64 w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
          ${selectedImage ? 'border-indigo-500/50' : 'border-white/10 hover:border-white/30 bg-white/5'}`}
      >
        {selectedImage ? (
          <>
            <img 
              src={selectedImage.previewUrl} 
              alt="Preview" 
              className="h-full w-full object-cover"
            />
            <button 
              onClick={() => onImageSelect(null)}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 backdrop-blur-md transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        ) : (
          <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-white/70 mb-1">Click to upload</span>
            <span className="text-xs text-white/40">{description}</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
    </div>
  );
};

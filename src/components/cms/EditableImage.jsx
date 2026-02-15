import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { firebaseStorageService } from '../../services/firebaseStorageService';

const EditableImage = ({
  enabled,
  src,
  alt,
  onChange,
  folder = 'cms/marketing',
  mode = 'img',
  className = '',
  wrapperClassName = '',
  children,
  imageUrl, // Extract this to prevent it from being passed to DOM
  ...imgProps
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const triggerPick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const result = await firebaseStorageService.uploadImage(file, folder, { compress: true });
      if (result.success && result.url) {
        onChange?.(result.url);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!enabled) {
    if (mode === 'background') {
      return <>{children}</>;
    }

    return <img src={src} alt={alt} className={className} {...imgProps} />;
  }

  const overlay = (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0 border border-dashed border-blue-400 rounded" />
      <div className="absolute top-2 right-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity" data-cms-allow-interaction="true">
        <button
          type="button"
          onClick={triggerPick}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/90 hover:bg-white text-[#160B53] border border-blue-200 rounded shadow"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {uploading ? 'Uploading...' : 'Change Image'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );

  if (mode === 'background') {
    return (
      <div className={`relative group ${wrapperClassName}`}>
        {children}
        {overlay}
      </div>
    );
  }

  return (
    <div className={`relative inline-block group ${wrapperClassName}`}>
      <img src={src} alt={alt} className={className} {...imgProps} />
      {overlay}
    </div>
  );
};

export default EditableImage;

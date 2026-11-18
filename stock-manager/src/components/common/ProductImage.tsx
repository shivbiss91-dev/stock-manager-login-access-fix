import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string | null;
  className?: string;
  containerClassName?: string;
  fallbackIconSize?: number;
}

/**
 * Normalizes relative URLs so they work across both root hosting and subpath hosting (e.g. GitHub Pages /stock-manager-login-access-fix/).
 */
export function normalizeProductImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();

  // If already absolute or base64 data URI, return as-is
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Detect base path
  let base = import.meta.env.BASE_URL || './';

  // If running in browser and on a subpath (e.g. GitHub Pages /stock-manager-login-access-fix/)
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (pathname && pathname !== '/' && !base.startsWith(pathname)) {
      base = `${pathname}/`;
    }
  }

  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

  if (trimmed.startsWith('/')) {
    return `${cleanBase}${trimmed}`;
  }

  // If relative path like 'products/foo.svg' or './products/foo.svg'
  if (trimmed.startsWith('./')) {
    return `${cleanBase}/${trimmed.slice(2)}`;
  }

  return `${cleanBase}/${trimmed}`;
}

/**
 * Returns a fallback default SVG based on product category.
 */
export function getCategoryFallbackSvg(category?: string | null): string {
  const norm = (category || '').toLowerCase().replace(/[\s-]/g, '_');
  let relPath = '';
  switch (norm) {
    case 'card_holder':
      relPath = '/products/card-holder.svg';
      break;
    case 'lanyard':
      relPath = '/products/lanyard.svg';
      break;
    case 'hook':
      relPath = '/products/hook.svg';
      break;
    case 'button_bag':
      relPath = '/products/button-bag.svg';
      break;
    default:
      return '';
  }
  return normalizeProductImageUrl(relPath);
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  category,
  className = 'w-10 h-10 rounded-lg object-cover',
  containerClassName = '',
  fallbackIconSize = 18,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    const initial = normalizeProductImageUrl(src) || getCategoryFallbackSvg(category);
    setCurrentSrc(initial);
    setFallbackAttempted(false);
    setIsFailed(!initial);
  }, [src, category]);

  const handleError = () => {
    const categoryFallback = getCategoryFallbackSvg(category);
    if (!fallbackAttempted && categoryFallback && currentSrc !== categoryFallback) {
      setFallbackAttempted(true);
      setCurrentSrc(categoryFallback);
    } else {
      setIsFailed(true);
    }
  };

  // If failed or no source available, render professional SVG placeholder
  if (isFailed || !currentSrc) {
    return (
      <div
        className={`${className} ${containerClassName} bg-slate-900/80 border border-slate-700/50 flex flex-col items-center justify-center text-slate-400 select-none flex-shrink-0 overflow-hidden relative group`}
        title={alt ? `${alt} (No Image)` : 'No Product Image'}
      >
        <Package
          style={{ width: fallbackIconSize, height: fallbackIconSize }}
          className="text-accent-orange/70 flex-shrink-0"
        />
        <span className="text-[8px] font-bold tracking-wider text-slate-500 uppercase mt-0.5 leading-none">
          No Img
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`${className} bg-slate-900/40 border border-slate-700/40 flex-shrink-0`}
      onError={handleError}
      loading="lazy"
    />
  );
};

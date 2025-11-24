// src/hooks/useTrackClick.ts
// Hook para rastrear cliques automaticamente em elementos

import { useEffect, useRef } from 'react';
import { trackClick } from '@/lib/analytics';

interface UseTrackClickOptions {
  elementName: string;
  elementType?: 'button' | 'link' | 'icon';
  enabled?: boolean;
  additionalParams?: {
    [key: string]: string | number | boolean | null | undefined;
  };
}

/**
 * Hook para rastrear cliques em um elemento
 * 
 * @example
 * const buttonRef = useTrackClick({
 *   elementName: 'Agendar Agora',
 *   elementType: 'button',
 * });
 * 
 * <button ref={buttonRef}>Agendar Agora</button>
 */
export function useTrackClick({
  elementName,
  elementType = 'button',
  enabled = true,
  additionalParams,
}: UseTrackClickOptions) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;

    const handleClick = (e: MouseEvent) => {
      trackClick(elementName, elementType, {
        ...additionalParams,
        page_path: window.location.pathname + window.location.search + window.location.hash,
      });
    };

    element.addEventListener('click', handleClick);

    return () => {
      element.removeEventListener('click', handleClick);
    };
  }, [elementName, elementType, enabled, additionalParams]);

  return ref;
}


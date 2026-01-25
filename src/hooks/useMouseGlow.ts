import { useRef, useCallback, type CSSProperties } from 'react';

interface MouseGlowResult {
  /** Callback ref to attach to the element */
  setRef: (node: HTMLDivElement | null) => void;
  /** Initial styles with CSS custom properties */
  style: CSSProperties;
  /** Mouse move handler */
  onMouseMove: (e: React.MouseEvent) => void;
  /** Mouse leave handler */
  onMouseLeave: () => void;
}

/**
 * Hook that tracks mouse position relative to an element and provides
 * CSS custom properties for creating cursor-following glow effects.
 * 
 * Uses a callback ref pattern to avoid React Compiler warnings about
 * accessing refs during render.
 * 
 * @returns Object with setRef callback, style, and event handlers
 */
export function useMouseGlow(): MouseGlowResult {
  // Store the DOM node in state-like ref that doesn't trigger re-renders
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // Initial glow styles - constant since we manipulate DOM directly for performance
  const glowStyle: CSSProperties = {
    '--glow-x': '50%',
    '--glow-y': '50%',
    '--glow-opacity': '0',
  } as CSSProperties;

  // Callback ref - safe to use during render
  const setRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const node = nodeRef.current;
    if (!node) return;
    
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const currentNode = nodeRef.current;
      if (!currentNode) return;
      
      const rect = currentNode.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // Update DOM directly for performance (avoid React re-renders)
      currentNode.style.setProperty('--glow-x', `${x}%`);
      currentNode.style.setProperty('--glow-y', `${y}%`);
      currentNode.style.setProperty('--glow-opacity', '1');
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    const node = nodeRef.current;
    if (node) {
      node.style.setProperty('--glow-opacity', '0');
    }
  }, []);

  return {
    setRef,
    style: glowStyle,
    onMouseMove,
    onMouseLeave,
  };
}

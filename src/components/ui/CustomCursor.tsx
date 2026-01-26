import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue } from 'framer-motion';

export const CustomCursor: React.FC = () => {
    // We use motion values for high performance updates
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);
    
    // Smooth spring animation for the cursor movement
    // Direct tracking for zero latency
    // No springs, just raw values

    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
            setIsVisible(true);
        };

        const handleMouseLeave = () => setIsVisible(false);
        const handleMouseEnter = () => setIsVisible(true);

        window.addEventListener('mousemove', moveCursor);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);

        return () => {
             window.removeEventListener('mousemove', moveCursor);
             document.removeEventListener('mouseleave', handleMouseLeave);
             document.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [cursorX, cursorY]);

    if (!isVisible) return null;

    return createPortal(
        <motion.div
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                x: cursorX,
                y: cursorY,
                translateX: '-50%',
                translateY: '-50%',
                pointerEvents: 'none',
                zIndex: 2147483647,
                mixBlendMode: 'screen' 
            }}
            transition={{ duration: 0 }} // Ensure no React/Motion transition delay
        >
            <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Crosshair Center */}
                <circle cx="12" cy="12" r="2" fill="var(--color-primary)" />
                
                {/* Crosshair Lines */}
                <path 
                    d="M12 4V8 M12 16V20 M4 12H8 M16 12H20" 
                    stroke="var(--color-primary)" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                />
                
                {/* Outer Ring (Accent) */}
                <circle 
                    cx="12" 
                    cy="12" 
                    r="8" 
                    stroke="var(--color-accent)" 
                    strokeWidth="1.5" 
                    opacity="0.5"
                />
            </svg>
        </motion.div>,
        document.body
    );
};

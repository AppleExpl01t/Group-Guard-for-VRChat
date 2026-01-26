import React from 'react';
import { motion, type HTMLMotionProps, type Easing } from 'framer-motion';

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  /** Direction of the transition */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Type of transition */
  variant?: 'default' | 'slide' | 'zoom' | 'fade';
}

const customEase: Easing = [0.2, 0.8, 0.2, 1];

// Enhanced page variants with more dramatic effects
const createPageVariants = (direction: string, variant: string) => {
  const slideOffset = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: -30 },
    down: { x: 0, y: 30 },
  }[direction] || { x: 0, y: 30 };

  const exitOffset = {
    left: { x: 50, y: 0 },
    right: { x: -50, y: 0 },
    up: { x: 0, y: 30 },
    down: { x: 0, y: -30 },
  }[direction] || { x: 0, y: -20 };

  if (variant === 'fade') {
    return {
      initial: { opacity: 0 },
      animate: { 
        opacity: 1,
        transition: { duration: 0.3, ease: customEase }
      },
      exit: { 
        opacity: 0,
        transition: { duration: 0.2 }
      }
    };
  }

  if (variant === 'zoom') {
    return {
      initial: { 
        opacity: 0, 
        scale: 0.85,
        filter: 'blur(10px)',
      },
      animate: { 
        opacity: 1, 
        scale: 1,
        filter: 'blur(0px)',
        transition: {
          type: 'spring' as const,
          stiffness: 300,
          damping: 25,
          filter: { duration: 0.25 }
        }
      },
      exit: { 
        opacity: 0, 
        scale: 1.1,
        filter: 'blur(10px)',
        transition: { duration: 0.25, ease: 'easeIn' as const }
      }
    };
  }

  if (variant === 'slide') {
    return {
      initial: { 
        opacity: 0, 
        x: slideOffset.x,
        y: slideOffset.y,
      },
      animate: { 
        opacity: 1, 
        x: 0,
        y: 0,
        transition: {
          type: 'spring' as const,
          stiffness: 350,
          damping: 30,
        }
      },
      exit: { 
        opacity: 0, 
        x: exitOffset.x,
        y: exitOffset.y,
        transition: { duration: 0.2, ease: 'easeIn' as const }
      }
    };
  }

  // Default: Combined slide + scale + fade with blur
  return {
    initial: { 
      opacity: 0, 
      scale: 0.96, 
      filter: 'blur(8px)',
      y: slideOffset.y,
      x: slideOffset.x * 0.5,
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      filter: 'blur(0px)',
      y: 0,
      x: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 28,
        mass: 0.8,
        filter: { duration: 0.25 },
        opacity: { duration: 0.25 },
      }
    },
    exit: { 
      opacity: 0, 
      scale: 1.03, 
      filter: 'blur(6px)',
      y: exitOffset.y * 0.5,
      transition: {
        duration: 0.25,
        ease: 'easeIn' as const,
      }
    }
  };
};

export const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  className, 
  direction = 'up',
  variant = 'default',
  ...props 
}) => {
  const variants = createPageVariants(direction, variant);
  
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...props.style
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

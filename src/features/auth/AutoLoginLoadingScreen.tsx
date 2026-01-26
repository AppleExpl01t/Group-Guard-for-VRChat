import React from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { motion } from 'framer-motion';

export const AutoLoginLoadingScreen: React.FC = () => (
  <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_center,hsla(var(--primary-hue),50%,10%,0.4)_0%,var(--color-bg-app)_100%)]">
    <GlassPanel className="flex w-[400px] flex-col items-center gap-6 p-12">
      <div className="text-center">
        <div className="mb-[-0.3rem] text-base font-semibold tracking-[0.2em] text-primary">VRCHAT</div>
        <h1 className="text-gradient m-0 text-3xl font-extrabold">
          GROUP GUARD
        </h1>
      </div>
      
      {/* Animated loading spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className="h-12 w-12 rounded-full border-[3px] border-solid border-border border-t-primary"
      />
      
      <p className="text-center text-text-dim">
        Signing you in automatically...
      </p>
    </GlassPanel>
  </div>
);

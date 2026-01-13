import React, { useEffect, memo, useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useInstanceMonitorStore } from '../../stores/instanceMonitorStore';
import { NeonButton } from '../../components/ui/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './GroupSelectionView.module.css';

// Memoized animation variants (stable references)
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export const GroupSelectionView: React.FC = memo(() => {
  const { myGroups, fetchMyGroups, selectGroup, enterRoamingMode, isLoading, error } = useGroupStore();
  const { currentWorldId, currentWorldName, instanceImageUrl, currentGroupId } = useInstanceMonitorStore();
  const [isLarge, setIsLarge] = useState(window.innerWidth > 1100);

  // Responsive Check
  useEffect(() => {
    const handleResize = () => setIsLarge(window.innerWidth > 1100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <motion.h2 
            className="text-gradient"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
            Scanning Group Frequencies...
        </motion.h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2 style={{ color: '#ef4444' }}>Connection Error</h2>
        <div style={{ 
            textAlign: 'left', 
            background: 'rgba(225, 29, 72, 0.1)', 
            padding: '1rem', 
            borderRadius: '8px',
            border: '1px solid rgba(225, 29, 72, 0.2)',
            margin: '1rem auto',
            maxWidth: '600px',
            overflow: 'auto',
            maxHeight: '300px'
        }}>
            <pre style={{ margin: 0, overflow: 'visible', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {error}
            </pre>
        </div>
        <NeonButton onClick={() => fetchMyGroups()} style={{ marginTop: '1rem' }}>Retry</NeonButton>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={`${styles.title} text-gradient`}>SELECT GROUP</h1>
        <p className={styles.subtitle}>Identify target for moderation protocols.</p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={`${styles.grid} ${isLarge ? styles.gridLarge : styles.gridCompact}`}
        layout // Animate grid column changes
      >
        {/* Roaming/Live Card - Show if in world but not in a managed group instance */}
        {currentWorldId && (!currentGroupId || !myGroups.some(g => g.id === currentGroupId)) && (
             <motion.div 
                key="roaming-card" 
                variants={itemVariants} 
                initial="hidden"
                animate="show"
                layout
             >
              <div 
                 className={`${styles.cardPanel} ${isLarge ? styles.cardLarge : styles.cardCompact}`}
                 onClick={() => enterRoamingMode()}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      enterRoamingMode();
                   }
                 }}
                 role="button"
                 tabIndex={0}
                 style={{ outline: 'none', borderColor: 'var(--color-primary)' }}
              >
                  {/* Background Banner */}
                  <AnimatePresence>
                    {isLarge && instanceImageUrl && (
                        <motion.div 
                            className={styles.banner} 
                            style={{ backgroundImage: `url(${instanceImageUrl})` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }} 
                        />
                    )}
                    {isLarge && !instanceImageUrl && (
                        <motion.div 
                            className={styles.bannerFallback}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.2 }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                  </AnimatePresence>

                  {/* Roaming Badge - Simulating a "LIVE" state for roaming */}
                  <motion.div
                      layoutId="roaming-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={styles.liveBadge}
                      style={{ background: '#22c55e', color: 'black', fontWeight: 900 }}
                  >
                      ROAMING
                  </motion.div>

                  {/* Green Glowing Live Indicator (Icon Placeholder) */}
                  <motion.div 
                    layoutId="icon-roaming"
                    className={styles.groupIconPlaceholder}
                    style={{ 
                        border: '2px solid #22c55e',
                        boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)',
                        color: '#22c55e',
                        background: 'rgba(34, 197, 94, 0.1)'
                    }}
                  >
                      <div style={{ width: 12, height: 12, background: 'currentColor', borderRadius: '50%', boxShadow: '0 0 10px currentColor' }} />
                  </motion.div>

                  {/* Content Container */}
                  {isLarge ? (
                      <motion.div 
                        className={styles.overlayContent}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                      >
                           <motion.div className={styles.groupName} layoutId="name-roaming">
                              {currentWorldName || 'Unknown World'}
                           </motion.div>
                           
                           <div className={styles.metaRow}>
                             <span className={styles.shortCode} style={{ color: '#22c55e', borderColor: '#22c55e' }}>LIVE</span>
                             <span className={styles.memberCount} style={{ color: '#86efac' }}>
                               Viewing Live Data
                             </span>
                           </div>
                      </motion.div>
                  ) : (
                      <motion.div className={styles.groupName} layoutId="name-roaming">
                          {currentWorldName || 'Unknown World'}
                      </motion.div>
                  )}

              </div>
            </motion.div>
        )}

        {myGroups.map((group) => {
          const isLive = group.id === currentGroupId;
          
          return (
            <motion.div key={group.id} variants={itemVariants} layout>
              <div 
                 className={`${styles.cardPanel} ${isLarge ? styles.cardLarge : styles.cardCompact} ${isLive ? styles.cardLive : ''}`}
                 onClick={() => selectGroup(group)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectGroup(group);
                   }
                 }}
                 role="button"
                 tabIndex={0}
                 style={{ outline: 'none' }}
              >
                  {/* Background Banner (Large Mode Only) */}
                  <AnimatePresence>
                    {isLarge && group.bannerUrl && (
                        <motion.div 
                            className={styles.banner} 
                            style={{ backgroundImage: `url(${group.bannerUrl})` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }} 
                        />
                    )}
                    {isLarge && !group.bannerUrl && (
                        <motion.div 
                            className={styles.bannerFallback}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.2 }} // Fallback opacity is managed in CSS usually, but explicit here helps fade
                            exit={{ opacity: 0 }}
                        />
                    )}
                  </AnimatePresence>

                  {/* Live Badge - Shared Layout Id for smooth position swap */}
                  {isLive ? (
                      <motion.div
                          layoutId={`live-${group.id}`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={styles.liveBadge}
                      >
                          LIVE
                      </motion.div>
                  ) : group.activeInstanceCount && group.activeInstanceCount > 0 ? (
                      <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={styles.liveBadge}
                          style={{
                              background: 'var(--color-secondary)',
                              color: 'white',
                              width: 'auto',
                              padding: '0 8px'
                          }}
                      >
                          {group.activeInstanceCount} active instance{group.activeInstanceCount !== 1 ? 's' : ''}
                      </motion.div>
                  ) : null}

                  {/* Group Icon - Shared Element */}
                  {group.iconUrl ? (
                      <motion.img 
                        layoutId={`icon-${group.id}`}
                        src={group.iconUrl} 
                        className={styles.groupIcon} 
                        alt="" 
                      />
                  ) : (
                      <motion.div 
                        layoutId={`icon-${group.id}`}
                        className={styles.groupIconPlaceholder}
                      >
                          {group.shortCode || group.name.substring(0, 2).toUpperCase()}
                      </motion.div>
                  )}

                  {/* Content Container (Name + Meta) */}
                  {/* In Large Mode, we wrap text in an overlay div. In Compact, just text. 
                      To make this smooth, we can render the overlay div conditionally but keep the name shared? 
                      Actually, simpler to just have different structures since the parent layout handles the morph.
                  */}
                  
                  {isLarge ? (
                      <motion.div 
                        className={styles.overlayContent}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                      >
                           <motion.div className={styles.groupName} layoutId={`name-${group.id}`} title={group.name}>
                              {group.name}
                           </motion.div>
                           
                           <div className={styles.metaRow}>
                             <span className={styles.shortCode}>{group.shortCode}</span>
                             <span className={styles.memberCount}>
                               {group.memberCount} Members
                             </span>
                           </div>
                      </motion.div>
                  ) : (
                      <motion.div className={styles.groupName} layoutId={`name-${group.id}`} title={group.name}>
                          {group.name}
                      </motion.div>
                  )}

              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
});

GroupSelectionView.displayName = 'GroupSelectionView';

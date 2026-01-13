import React, { memo, useState } from 'react';
import styles from './NeonDock.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  LayoutDashboard, 
  Activity, 
  Shield, 
  List, 
  ClipboardList, 
  Database 
} from 'lucide-react';
import { DockItem } from './DockItem';

export type DockView = 'main' | 'moderation' | 'audit' | 'database' | 'settings' | 'live' | 'watchlist';

interface NeonDockProps {
  currentView: DockView;
  onViewChange: (view: DockView) => void;
  selectedGroup?: { name: string } | null;
  onGroupClick?: () => void;
  isLiveMode?: boolean;
}

export const NeonDock: React.FC<NeonDockProps> = memo(({ 
  currentView, 
  onViewChange, 
  selectedGroup,
  onGroupClick,
  isLiveMode = false
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <>
      {/* Visual indicator pill when dock is hidden */}
      <motion.div 
        className={styles.dockIndicator}
        onMouseEnter={() => setIsVisible(true)}
        animate={{ 
          opacity: isVisible ? 0 : 1,
          scale: isVisible ? 0.8 : 1
        }}
        transition={{ duration: 0.2 }}
      >
        <div className={styles.dockIndicatorPill} />
      </motion.div>
      
      {/* Dock with auto-hide animation */}
      <motion.div 
        className={styles.dockContainer}
        initial={{ y: 150 }}
        animate={{ 
          y: isVisible ? 0 : 150
        }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30 
        }}
        onMouseLeave={() => setIsVisible(false)}
      >
        <motion.div className={styles.dock} layout>
          <DockItem 
            label={selectedGroup ? "Group" : "Home"}
            isActive={!selectedGroup}
            onClick={onGroupClick || (() => {})}
            color="var(--color-primary)"
            icon={Home}
          />

          {/* Group-specific items */}
          <AnimatePresence>
              {(selectedGroup || isLiveMode) && (
                  <motion.div 
                      className={styles.groupSection}
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingRight: '0.25rem' }}>
                      <div className={styles.separator} />

                      {selectedGroup && (
                      <>
                          <DockItem 
                            label="Dashboard"
                            isActive={currentView === 'main' && !!selectedGroup}
                            onClick={() => onViewChange('main')}
                            color="var(--color-accent)"
                            icon={LayoutDashboard}
                          />
                      </>
                      )}

                      {/* LIVE OPS TAB - Only visible when actually in live mode */}
                      <AnimatePresence>
                          {isLiveMode && (
                              <motion.div 
                                  className={styles.liveOpsSection}
                                  initial={{ width: 0, opacity: 0, scale: 0.8 }}
                                  animate={{ width: "auto", opacity: 1, scale: 1 }}
                                  exit={{ width: 0, opacity: 0, scale: 0.8 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                  style={{ overflow: 'hidden' }}
                              >
                                  <div style={{ padding: '0 12px' }}>
                                      <DockItem 
                                          label="LIVE OPS"
                                          isActive={currentView === 'live'}
                                          onClick={() => onViewChange('live')}
                                          color="#ef4444" // Always red when visible (since it only shows in live mode)
                                          icon={Activity}
                                      />
                                  </div>
                              </motion.div>
                          )}
                      </AnimatePresence>

                      {selectedGroup && (
                      <>
                          <DockItem 
                            label="Auto-Mod"
                            isActive={currentView === 'moderation'}
                            onClick={() => onViewChange('moderation')}
                            color="var(--color-primary)"
                            icon={Shield}
                          />

                          <DockItem
                            label="Watchlist"
                            isActive={currentView === 'watchlist'}
                            onClick={() => onViewChange('watchlist')}
                            color="var(--color-accent)"
                            icon={List}
                          />

                          <DockItem 
                            label="Audit Logs"
                            isActive={currentView === 'audit'}
                            onClick={() => onViewChange('audit')}
                            color="var(--color-accent)"
                            icon={ClipboardList}
                          />

                          <DockItem 
                            label="Database"
                            isActive={currentView === 'database'}
                            onClick={() => onViewChange('database')}
                            color="var(--color-primary)"
                            icon={Database}
                          />
                      </>
                      )}
                    </div>
                  </motion.div>
              )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    </>
  );
});

NeonDock.displayName = 'NeonDock';



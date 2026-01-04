import React, { useEffect, memo } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { NeonButton } from '../../components/ui/NeonButton';
import { motion } from 'framer-motion';

// Memoized animation variants (stable references)
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08 // Faster stagger
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } } // Faster animation
};

export const GroupSelectionView: React.FC = memo(() => {
  const { myGroups, fetchMyGroups, selectGroup, isLoading, error } = useGroupStore();
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(null);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  // Subscribe to live instance presence
  useEffect(() => {
      const fetchCurrent = async () => {
          const current = await window.electron.instance.getCurrentGroup();
          setActiveGroupId(current);
      };
      fetchCurrent();

      // Listen for updates
      const cleanup = window.electron.instance.onGroupChanged((groupId) => {
          setActiveGroupId(groupId);
      });
      return cleanup;
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <h2 className="text-gradient">Scanning Group Frequencies...</h2>
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
    <div style={{ padding: '0 2rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800 }}>SELECT GROUP</h1>
        <p style={{ color: 'var(--color-text-dim)' }}>Identify target for moderation protocols.</p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '2rem' 
        }}
      >
        {myGroups.map((group) => {
          // Check if user is currently in this group's instance
          const isLive = group.id === activeGroupId;
          
          return (
            <motion.div key={group.id} variants={itemVariants}>
            <motion.div 
               whileHover={{ 
                 y: -8, 
                 boxShadow: isLive 
                    ? '0 15px 30px rgba(0, 255, 100, 0.3), 0 0 20px rgba(0, 255, 100, 0.2) inset' // Green glow for live
                    : '0 15px 30px rgba(var(--primary-hue), 0.3), 0 0 20px rgba(var(--primary-hue), 0.2) inset' 
               }}
               transition={{ type: 'spring', stiffness: 300, damping: 20 }}
               onClick={() => selectGroup(group)} 
               style={{ cursor: 'pointer', height: '100%' }}
            >
               <GlassPanel className="group-card" style={{ 
                 position: 'relative', 
                 height: '200px', 
                 display: 'flex', 
                 flexDirection: 'column', 
                 justifyContent: 'flex-end',
                 overflow: 'hidden',
                 padding: 0,
                 border: isLive ? '1px solid #22c55e' : '1px solid var(--border-color)', // Green border for live
                 // Removed standard transition as framer handling hover now
               }}>
                 {/* Live Badge */}
                 {isLive && (
                     <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: '#22c55e',
                            color: 'black',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            zIndex: 10,
                            boxShadow: '0 0 10px #22c55e'
                        }}
                     >
                        LIVE
                     </motion.div>
                 )}

                 {/* Background Banner */}
                 {group.bannerUrl ? (
                   <div style={{
                     position: 'absolute',
                     top: 0, left: 0, right: 0, bottom: 0,
                     backgroundImage: `url(${group.bannerUrl})`,
                     backgroundSize: 'cover',
                     backgroundPosition: 'center',
                     filter: 'brightness(0.6)',
                     zIndex: 0
                   }} />
                 ) : (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(45deg, var(--color-primary), var(--color-accent))',
                        opacity: 0.2,
                        zIndex: 0
                    }} />
                 )}

                 {/* Content Overlay */}
                 <div style={{ 
                   position: 'relative', 
                   zIndex: 1, 
                   padding: '1.5rem',
                   background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)'
                 }}>
                   {group.iconUrl && (
                     <img src={group.iconUrl} style={{ 
                       width: 50, height: 50, borderRadius: '12px', marginBottom: '0.5rem',
                       border: '2px solid white' 
                     }} />
                   )}
                   <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{group.name}</h3>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                     <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{group.shortCode}</span>
                     <span style={{ 
                       fontSize: '0.7rem', 
                       background: 'linear-gradient(90deg, hsla(var(--primary-hue), 100%, 60%, 0.2), hsla(var(--primary-hue), 100%, 40%, 0.2))',
                       border: '1px solid hsla(var(--primary-hue), 100%, 60%, 0.3)',
                       color: 'white',
                       padding: '2px 8px', 
                       borderRadius: '4px',
                       backdropFilter: 'blur(4px)'
                     }}>
                       {group.memberCount} Members
                     </span>
                   </div>
                 </div>
               </GlassPanel>
            </motion.div>
          </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
});

GroupSelectionView.displayName = 'GroupSelectionView';

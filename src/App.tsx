import React, { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './features/auth/LoginView';
import { UserProfileWidget } from './features/auth/UserProfileWidget';
import { useAuthStore } from './stores/authStore';
import { useGroupStore } from './stores/groupStore';
import { GlassPanel } from './components/ui/GlassPanel';
import { Modal } from './components/ui/Modal';
import { NeonButton } from './components/ui/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonDock, type DockView } from './components/layout/NeonDock';
import { UserProfileDialog } from './features/dashboard/dialogs/UserProfileDialog';
import { usePipelineInit } from './hooks/usePipelineInit';
import { useInstanceMonitorInit } from './hooks/useInstanceMonitorInit';
import { SetupView } from './features/setup/SetupView';

// Lazy load heavy views for better performance
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const GroupSelectionView = lazy(() => import('./features/groups/GroupSelectionView').then(m => ({ default: m.GroupSelectionView })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const DatabaseView = lazy(() => import('./features/database/DatabaseView').then(m => ({ default: m.DatabaseView })));

// Simple loading fallback
const ViewLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '200px' }}>
    <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Loading screen component for auto-login
const AutoLoginLoadingScreen: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    background: 'radial-gradient(circle at center, hsla(var(--primary-hue), 50%, 10%, 0.4) 0%, var(--color-bg-app) 100%)'
  }}>
    <GlassPanel style={{ 
      width: '400px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.5rem',
      alignItems: 'center',
      padding: '3rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', color: 'var(--color-primary)', letterSpacing: '0.2em', fontWeight: 600, marginBottom: '-0.3rem' }}>VRCHAT</div>
        <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>
          GROUP GUARD
        </h1>
      </div>
      
      {/* Animated loading spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--color-primary)',
        }}
      />
      
      <p style={{ color: 'var(--color-text-dim)', textAlign: 'center' }}>
        Signing you in automatically...
      </p>
    </GlassPanel>
  </div>
);

function App() {
  const { isAuthenticated, autoLogin, status, user, logout } = useAuthStore();
  const { selectedGroup, selectGroup } = useGroupStore();
  const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(true);
  const [isStorageConfigured, setIsStorageConfigured] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<DockView>('main');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Initialize Pipeline WebSocket connection and event subscriptions
  usePipelineInit();
  
  // Initialize Live Log Watcher
  useInstanceMonitorInit(isAuthenticated);

  const [isUpdateReady, setIsUpdateReady] = useState(false);

  // Listen for updates
  useEffect(() => {
    // Return unsubscribe function
    return window.electron.updater.onUpdateDownloaded(() => {
        setIsUpdateReady(true);
    });
  }, []);

  // Check storage configuration first
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const status = await window.electron.storage.getStatus();
        setIsStorageConfigured(status.configured);
      } catch (err) {
        console.error('Failed to check storage status:', err);
        // Fallback to true to avoid blocking app if something weird happens, 
        // though this ideally shouldn't happen with the new service.
        setIsStorageConfigured(true); 
      }
    };
    checkStorage();
  }, []);

  // Attempt auto-login only after storage is confirmed
  useEffect(() => {
    if (isStorageConfigured === false || isStorageConfigured === null) {
        return;
    }

    const attemptAutoLogin = async () => {
      setIsCheckingAutoLogin(true);
      try {
        // Check if we have saved credentials and attempt auto-login
        const hasSaved = await window.electron.hasSavedCredentials();
        if (hasSaved) {
          console.log('Found saved credentials, attempting auto-login...');
          const result = await autoLogin();
          if (result.success) {
            console.log('Auto-login successful!');
          } else if (result.requires2FA) {
            console.log('Auto-login requires 2FA verification');
            // User will need to enter 2FA code - this is expected behavior
          } else {
            console.log('Auto-login failed, showing login screen');
          }
        } else {
          console.log('No saved credentials found');
        }
      } catch (err) {
        console.error('Auto-login error:', err);
      }
      setIsCheckingAutoLogin(false);
    };
    
    attemptAutoLogin();
  }, [autoLogin, isStorageConfigured]);

  // Handle View Switching - memoized to prevent re-renders
  const handleViewChange = useCallback((view: DockView) => {
    if ((view === 'moderation' || view === 'audit' || view === 'database') && !selectedGroup) {
      // If trying to access group features without a group, go to group selection
      selectGroup(null);
      setCurrentView('main');
      return;
    }
    setCurrentView(view);
  }, [selectedGroup, selectGroup]);

  // Memoize content to prevent re-renders during transitions
  const content = useMemo(() => {
    switch (currentView) {
      case 'settings':
        return <SettingsView />;
      case 'moderation':
        return (
            <GlassPanel style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Moderation Module</h2>
                <p style={{ color: 'var(--color-text-dim)' }}>Coming Soon</p>
            </GlassPanel>
        );
      case 'audit':
        return (
            <GlassPanel style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Audit Logs</h2>
                <p style={{ color: 'var(--color-text-dim)' }}>Coming Soon</p>
            </GlassPanel>
        );
      case 'database':
        return <DatabaseView />;
      case 'main':
      default:
        return selectedGroup ? <DashboardView /> : <GroupSelectionView />;
    }
  }, [currentView, selectedGroup]);

  // Show loading while checking storage configuration
  if (isStorageConfigured === null) {
      return <AutoLoginLoadingScreen />;
  }

  // Show Setup View if storage is not configured
  if (isStorageConfigured === false) {
      return <SetupView onComplete={() => setIsStorageConfigured(true)} />;
  }

  // Show loading screen while checking for auto-login
  if (isCheckingAutoLogin && status === 'logging-in') {
    return <AutoLoginLoadingScreen />;
  }

  // Show login view if not authenticated
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <AppLayout>
      {/* Top Header Area */}
      <header style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: '60px', 
        padding: '0 2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 50,
        pointerEvents: 'none', // Let clicks pass through/handled by children
        WebkitAppRegion: 'drag' // Make the header draggable
      } as React.CSSProperties}>
        {/* User Profile & Logout (Left Side) */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Profile Dropdown Trigger */}
            <div style={{ position: 'relative' }}>
                <motion.button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '30px',
                        padding: '4px 12px 4px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        outline: 'none',
                    }}
                >
                    <img 
                      src={user?.userIcon || user?.currentAvatarThumbnailImageUrl} 
                      alt="Avatar"
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user?.displayName}</span>
                </motion.button>

                {/* Dropdown Profile Widget */}
                <AnimatePresence>
                    {isProfileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                position: 'absolute',
                                top: '110%',
                                left: 0, // Align left since it's on left side now
                                width: '300px',
                                zIndex: 60
                            }}
                        >
                             <div style={{ marginBottom: '0.8rem' }}>
                                <UserProfileWidget />
                             </div>

                             {/* Settings Button moved from Dock */}
                             <motion.button
                               whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                               whileTap={{ scale: 0.98 }}
                               onClick={() => {
                                 setCurrentView('settings');
                                 setIsProfileOpen(false);
                               }}
                               style={{
                                 width: '100%',
                                 padding: '12px',
                                 background: 'rgba(255, 255, 255, 0.03)',
                                 border: '1px solid rgba(255, 255, 255, 0.08)',
                                 borderRadius: '16px',
                                 color: 'var(--color-text-primary)',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 gap: '10px',
                                 cursor: 'pointer',
                                 fontSize: '0.9rem',
                                 fontWeight: 500,
                                 backdropFilter: 'blur(10px)',
                                 boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                               }}
                             >
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                                  <circle cx="12" cy="12" r="3"></circle>
                                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                               </svg>
                               App Settings
                             </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Logout Button */}
            <motion.button
                onClick={() => setIsLogoutConfirmOpen(true)}
                whileHover={{ scale: 1.1, color: '#ef4444' }}
                whileTap={{ scale: 0.95 }}
                title="Logout"
                style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text-dim)',
                    backdropFilter: 'blur(10px)',
                    transition: 'color 0.2s'
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
            </motion.button>
        </div>

        {/* Window Controls (Right Side - Aesthetic) */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px', WebkitAppRegion: 'no-drag', zIndex: 5000, position: 'relative' } as React.CSSProperties}>
             <button
                onClick={() => {
                    try { window.electron.minimize(); } catch(e) { console.error('Minimize error:', e); }
                }}
                style={{
                    width: '32px', height: '32px', 
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.0)', 
                    border: '1px solid rgba(255,255,255,0.0)',
                    cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                    color: 'rgba(255,255,255,0.7)', 
                    transition: 'all 0.2s',
                    WebkitAppRegion: 'no-drag'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.0)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.0)';
                }}
             >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
             </button>
             <button
                onClick={() => {
                    try { window.electron.maximize(); } catch(e) { console.error('Maximize error:', e); }
                }}
                style={{
                    width: '32px', height: '32px', 
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.0)', 
                    border: '1px solid rgba(255,255,255,0.0)',
                    cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                    color: 'rgba(255,255,255,0.7)', 
                    transition: 'all 0.2s',
                    WebkitAppRegion: 'no-drag'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.0)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.0)';
                }}
             >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
             </button>
             <button
                onClick={() => {
                    try { window.electron.close(); } catch(e) { console.error('Close error:', e); }
                }}
                style={{
                    width: '32px', height: '32px', 
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.0)', 
                    border: '1px solid rgba(255,255,255,0.0)',
                    cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                    color: 'rgba(255,255,255,0.7)', 
                    transition: 'all 0.2s',
                    WebkitAppRegion: 'no-drag'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ef4444';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.0)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.0)';
                }}
             >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
        </div>
      </header>


      {/* Main Content Render - instant switch with subtle fade-in */}
      <div
        key={currentView + (selectedGroup ? 'group' : 'home')}
        style={{ 
          width: '100%', 
          height: '100%',
          animation: 'fadeIn 0.1s ease-out',
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0.7; }
            to { opacity: 1; }
          }
        `}</style>
        <Suspense fallback={<ViewLoader />}>
          {content}
        </Suspense>
      </div>

      {/* Neon Dock Navigation */}
      <NeonDock 
        currentView={currentView}
        onViewChange={handleViewChange}
        selectedGroup={selectedGroup}
        onGroupClick={() => {
            selectGroup(null);
            setCurrentView('main');
        }}
      />
      
      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        title="Confirm Logout"
        width="400px"
        footer={
            <>
                <NeonButton 
                    variant="ghost" 
                    onClick={() => setIsLogoutConfirmOpen(false)}
                >
                    Cancel
                </NeonButton>
                <NeonButton 
                    variant="danger" 
                    onClick={() => {
                        logout(false);
                        setIsLogoutConfirmOpen(false);
                    }}
                >
                    Logout
                </NeonButton>
            </>
        }
      >
        <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
            Are you sure you want to log out?
            <br />
            You can receive a quick login (without 2FA) next time if you don't clear your credentials.
        </div>
      </Modal>

      {/* Global User Profile Dialog */}
      <UserProfileDialog />

      {/* Update Available Modal (Non-escapable) */}
      <Modal
          isOpen={isUpdateReady}
          onClose={() => {}} // No-op, not closable
          closable={false}
          title="Update Ready"
          width="450px"
          footer={
              <NeonButton 
                  onClick={() => window.electron.updater.quitAndInstall()}
                  style={{ width: '100%' }}
                  glow
              >
                  Restart & Install Update
              </NeonButton>
          }
      >
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ 
                  background: 'rgba(var(--primary-hue), 100%, 50%, 0.1)', 
                  color: 'var(--color-primary)',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto'
              }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>
                  New Version Downloaded
              </p>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  A critical update has been downloaded automatically. 
                  <br />
                  Please restart the application to apply the latest security patches and features.
              </p>
          </div>
      </Modal>

    </AppLayout>
  );
}

export default App;

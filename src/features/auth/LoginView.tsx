import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { NeonButton } from '../../components/ui/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';

export const LoginView: React.FC = () => {
  const { login, verify2FA, requires2FA, isLoading, error, rememberMe, setRememberMe, loadSavedCredentials } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  
  // Load saved credentials on mount to pre-fill the form
  React.useEffect(() => {
    const loadCreds = async () => {
        const creds = await loadSavedCredentials();
        if (creds && creds.username) {
            setUsername(creds.username);
            setPassword(creds.password);
            setRememberMe(true);
        }
    };
    loadCreds();
  }, [loadSavedCredentials, setRememberMe]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requires2FA) {
      if (code) verify2FA(code);
    } else {
      if (username && password) login(username, password, rememberMe);
    }
  };

  // Particle interface for type safety
  interface Particle {
    id: number;
    left: number;
    width: number;
    height: number;
    isPrimary: boolean;
    duration: number;
    delay: number;
  }

  // Generate stable random values for particles (useState initializer runs once)
  const [particles] = useState<Particle[]>(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      width: Math.random() * 3 + 1,
      height: Math.random() * 3 + 1,
      isPrimary: Math.random() > 0.5,
      duration: Math.random() * 5 + 5,
      delay: Math.random() * 5
    }));
  });

  // Particle animation variants
  const particleVariants = {
    animate: (custom: Particle) => ({
      y: [0, -1000],
      opacity: [0, 0.5, 0],
      transition: {
        duration: custom.duration,
        repeat: Infinity,
        delay: custom.delay,
        ease: "linear" as const,
      },
    }),
  };

  return (
    <div style={{ 
      position: 'relative',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#030014', // Deep dark blue/black
      color: 'white'
    }}>
      {/* Dynamic Background Effects */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, hsla(var(--primary-hue), 100%, 20%, 0.2) 0%, rgba(0, 0, 0, 0) 50%)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        top: '-20%', left: '-10%',
        width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, hsla(var(--primary-hue), 100%, 60%, 0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(60px)',
        zIndex: 0,
        opacity: 0.6
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%', right: '-10%',
        width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, hsla(var(--accent-hue), 100%, 60%, 0.1) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(80px)',
        zIndex: 0,
        opacity: 0.5
      }} />

      {/* Floating Particles / Data Stream */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          custom={particle}
          variants={particleVariants}
          animate="animate"
          style={{
            position: 'absolute',
            left: `${particle.left}%`,
            bottom: '-10%',
            width: `${particle.width}px`,
            height: `${particle.height}px`,
            borderRadius: '50%',
            background: particle.isPrimary ? 'var(--color-primary)' : 'cyan',
            boxShadow: `0 0 10px ${particle.isPrimary ? 'var(--color-primary)' : 'cyan'}`,
          }}
        />
      ))}

      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ 
          position: 'relative',
          width: '420px', 
          maxWidth: '90%',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '2rem',
          padding: '3rem',
          borderRadius: '24px',
          background: 'rgba(10, 10, 15, 0.6)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.2), 0 20px 60px -10px rgba(0,0,0,0.6), inset 0 0 30px hsla(var(--primary-hue), 80%, 60%, 0.05)',
          zIndex: 10
        }}
      >
        {/* Glow behind card */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', height: '100%',
          borderRadius: '24px',
          boxShadow: '0 0 80px -20px hsla(var(--primary-hue), 80%, 60%, 0.15)',
          zIndex: -1,
          pointerEvents: 'none'
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div style={{ 
              display: 'inline-block',
              padding: '0.5rem',
              background: 'hsla(var(--primary-hue), 80%, 60%, 0.1)',
              borderRadius: '12px',
              marginBottom: '1rem',
              border: '1px solid hsla(var(--primary-hue), 80%, 60%, 0.2)'
            }}>
               <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ marginBottom: '1rem' }}
          >
            <h2 style={{ 
              fontSize: '1.2rem', 
              fontWeight: 600, 
              color: 'var(--color-primary)', 
              letterSpacing: '0.2em',
              marginBottom: '-0.2rem',
              textTransform: 'uppercase'
            }}>
              VRChat
            </h2>
            <h1 
              className="text-gradient" 
              style={{ 
                fontSize: '2.5rem', 
                fontWeight: 800,
                letterSpacing: '-0.02em',
                textShadow: '0 0 40px hsla(var(--primary-hue), 80%, 60%, 0.3)',
                margin: 0
              }}
            >
              GROUP GUARD
            </h1>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}
          >
            {requires2FA ? 'Security Verification' : 'Command Center Access'}
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <AnimatePresence mode='wait'>
            {!requires2FA ? (
              <motion.div
                key="login-fields"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                {/* Username Input */}
                <div style={{ position: 'relative' }}>
                  <label 
                    style={{ 
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem',
                      ...(focusedInput === 'username' || username ? {
                        top: '0',
                        fontSize: '0.75rem',
                        color: 'var(--color-primary)',
                        background: '#0a0a0f',
                        padding: '0 0.5rem',
                        transform: 'translateY(-50%)'
                      } : {})
                    }}
                  >
                    Username
                  </label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedInput('username')}
                    onBlur={() => setFocusedInput(null)}
                    style={{ 
                      width: '100%',
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: `1px solid ${focusedInput === 'username' ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      fontSize: '1rem',
                      boxShadow: focusedInput === 'username' ? '0 0 0 2px hsla(var(--primary-hue), 80%, 60%, 0.2)' : 'none'
                    }}
                  />
                </div>

                {/* Password Input */}
                <div style={{ position: 'relative' }}>
                  <label 
                    style={{ 
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem',
                      ...(focusedInput === 'password' || password ? {
                        top: '0',
                        fontSize: '0.75rem',
                        color: 'var(--color-primary)',
                        background: '#0a0a0f',
                        padding: '0 0.5rem',
                        transform: 'translateY(-50%)' // Move slightly higher to clear border
                      } : {})
                    }}
                  >
                    Password
                  </label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    style={{ 
                      width: '100%',
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: `1px solid ${focusedInput === 'password' ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      fontSize: '1rem',
                      boxShadow: focusedInput === 'password' ? '0 0 0 2px hsla(var(--primary-hue), 80%, 60%, 0.2)' : 'none'
                    }}
                  />
                </div>
                
                {/* Remember Me Checkbox */}
                <motion.label 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.25rem 0',
                    width: 'fit-content'
                  }}
                >
                  <div 
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      border: `2px solid ${rememberMe ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)'}`,
                      background: rememberMe ? 'var(--color-primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                      boxShadow: rememberMe ? '0 0 10px hsla(var(--primary-hue), 80%, 60%, 0.4)' : 'none'
                    }}
                  >
                    {rememberMe && (
                      <motion.svg 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        width="12" 
                        height="12" 
                        viewBox="0 0 12 12" 
                        fill="none"
                      >
                        <path 
                          d="M2 6L5 9L10 3" 
                          stroke="white" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </motion.svg>
                    )}
                  </div>
                  <span 
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{ 
                      color: rememberMe ? 'white' : 'var(--color-text-dim)', 
                      fontSize: '0.9rem',
                      transition: 'color 0.2s'
                    }}
                  >
                    Remember me & auto-login
                  </span>
                </motion.label>
              </motion.div>
            ) : (
              <motion.div
                key="2fa-field"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}
              >
                <div style={{
                  padding: '1rem',
                  background: 'hsla(var(--primary-hue), 80%, 60%, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid hsla(var(--primary-hue), 80%, 60%, 0.2)',
                  color: 'var(--color-primary)',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  width: '100%'
                }}>
                  Enter the code from your authenticator app
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="text" 
                    value={code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setCode(val);
                      if (val.length === 6) {
                        verify2FA(val);
                      }
                    }}
                    style={{ 
                      width: '100%',
                      padding: '1.2rem', 
                      borderRadius: '16px', 
                      border: '2px solid var(--color-primary)',
                      background: 'rgba(0,0,0,0.3)',
                      color: 'white',
                      outline: 'none',
                      textAlign: 'center',
                      letterSpacing: '0.8em',
                      fontSize: '1.8rem',
                      fontWeight: 'bold',
                      boxShadow: '0 0 30px -5px hsla(var(--primary-hue), 80%, 60%, 0.3)'
                    }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                  <small style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                    Type your 6-digit code
                  </small>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ 
                  color: '#fb7185', 
                  fontSize: '0.9rem', 
                  textAlign: 'center', 
                  background: 'rgba(225, 29, 72, 0.1)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(225, 29, 72, 0.2)'
                }}
              >
                <pre style={{ 
                  margin: 0,
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  textAlign: 'left'
                }}>
                  {error}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          <NeonButton 
            type="submit" 
            variant="secondary"
            disabled={isLoading}
            style={{ 
              width: '100%', 
              marginTop: '0.5rem',
              height: '3.5rem',
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(90deg, hsla(var(--primary-hue), 100%, 50%, 0.15), hsla(var(--accent-hue), 100%, 50%, 0.15))',
              border: '1px solid hsla(var(--primary-hue), 100%, 70%, 0.3)',
              boxShadow: '0 0 20px hsla(var(--primary-hue), 100%, 50%, 0.15)',
              color: 'white',
              textShadow: '0 0 10px hsla(var(--primary-hue), 100%, 70%, 0.5)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {isLoading ? (
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                 style={{ 
                   width: '20px', 
                   height: '20px', 
                   border: '2px solid white', 
                   borderTopColor: 'transparent',
                   borderRadius: '50%'
                 }} 
               />
            ) : (requires2FA ? 'VERIFY IDENTITY' : 'Login with VRC')}
          </NeonButton>
        </form>
        
        {/* Security Footer */}
        <div style={{ marginTop: '0.5rem' }}>
          <motion.div 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            onClick={() => setShowSecurityModal(true)}
            style={{  
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              cursor: 'help',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}
          >
             <div style={{ 
               fontSize: '1.2rem',
               filter: 'drop-shadow(0 0 5px hsla(var(--primary-hue), 100%, 60%, 0.5))'
             }}>
               🔒
             </div>
             <div style={{ textAlign: 'left' }}>
               <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, letterSpacing: '0.02em' }}>
                 Double-Encrypted Vault
               </div>
               <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                 Stored logins are kept secure with{' '}
                 <a 
                   href="https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197-upd1.pdf"
                   target="_blank"
                   rel="noopener noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   title="Click to learn more about AES-256 encryption"
                   style={{ 
                     color: 'inherit', 
                     textDecoration: 'underline', 
                     textDecorationStyle: 'dotted',
                     cursor: 'pointer'
                   }}
                 >
                   AES-256
                 </a>
                 {' + '}
                 <a 
                   href="https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata"
                   target="_blank"
                   rel="noopener noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   title="Click to learn more about Windows DPAPI encryption"
                   style={{ 
                     color: 'inherit', 
                     textDecoration: 'underline', 
                     textDecorationStyle: 'dotted',
                     cursor: 'pointer'
                   }}
                 >
                   Windows DPAPI
                 </a>
               </div>
             </div>
          </motion.div>
        </div>

        {/* Security Info Modal */}
        <AnimatePresence>
          {showSecurityModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSecurityModal(false)}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                padding: '1rem'
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'rgba(20, 20, 30, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '24px',
                  padding: '2.5rem',
                  maxWidth: '500px',
                  width: '100%',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decorative background glow */}
                <div style={{
                  position: 'absolute',
                  top: '-50%', left: '-50%',
                  width: '200%', height: '200%',
                  background: 'radial-gradient(circle at 50% 50%, hsla(var(--primary-hue), 100%, 60%, 0.1) 0%, transparent 60%)',
                  pointerEvents: 'none',
                  zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '2rem' }}>🔒</div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'white' }}>
                        Maximum Security
                      </h2>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                        Your data never leaves your device unencrypted.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'rgba(255,255,255,0.8)' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '8px', 
                        padding: '0.5rem', 
                        height: 'fit-content' 
                      }}>💻</div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>
                          Local Only Storage
                        </h3>
                        <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                          Your credentials are stored <strong>locally on this computer</strong>. They are never sent to our servers or any third-party cloud.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '8px', 
                        padding: '0.5rem', 
                        height: 'fit-content' 
                      }}>🛡️</div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>
                          Double Encryption Barrier
                        </h3>
                        <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                          We use professional-grade <strong>AES-256</strong> encryption wrapped in <strong>Windows Hardware Security</strong> (DPAPI). 
                          Even if a hacker steals your files, they cannot read them without your specific Windows login session.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <NeonButton onClick={() => setShowSecurityModal(false)} style={{ minWidth: '120px' }}>
                      Understood
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Window Controls (Top Right) */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 100,
        WebkitAppRegion: 'no-drag'
      } as React.CSSProperties}>
        <button
          onClick={() => {
            try { window.electron.minimize(); } catch(e) { console.error('Minimize error:', e); }
          }}
          style={{
            width: '32px', height: '32px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            color: 'rgba(255,255,255,0.7)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
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
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            color: 'rgba(255,255,255,0.7)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
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
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            color: 'rgba(255,255,255,0.7)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>


    </div>
  );
};

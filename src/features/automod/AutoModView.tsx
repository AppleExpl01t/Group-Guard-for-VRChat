import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useAuditStore } from '../../stores/auditStore';
import { useGroupStore } from '../../stores/groupStore';
import { motion } from 'framer-motion';
import styles from './AutoModView.module.css';

// Extracted components
import { KeywordConfigModal } from './dialogs/KeywordConfigModal';
import { UserActionModal } from './dialogs/UserActionModal';
import { RuleCard } from './components/RuleCard';
import { InterceptionLog, type LogEntry } from './components/InterceptionLog';
import { StatTile } from '../dashboard/components/StatTile';
import type { AutoModRule } from '../../types/electron';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

export const AutoModView: React.FC = () => {
    const [rules, setRules] = useState<AutoModRule[]>([]);
    
    // Dialog State
    const [showKeywordConfig, setShowKeywordConfig] = useState(false);
    const [interceptionLog, setInterceptionLog] = useState<LogEntry[]>([]);
    const [selectedLogEntry, setSelectedLogEntry] = useState<LogEntry | null>(null);

    // Initial Data Fetch
    const loadHistory = async () => {
        try {
            const history = await window.electron.automod.getHistory();
            setInterceptionLog(history as LogEntry[] || []);
        } catch (e) {
            console.error("Failed to load AutoMod history", e);
        }
    };

    const loadRules = async () => {
        try {
            const fetched = await window.electron.automod.getRules();
            setRules(fetched || []);
        } catch (e) {
            console.error("Failed to load AutoMod rules", e);
        }
    };
    
    React.useEffect(() => {
        loadRules();
        loadHistory();
        
        // Listen for AutoMod Logs (real-time)
        const handleLog = (_: unknown, log: unknown) => {
            setInterceptionLog(prev => [log as LogEntry, ...prev].slice(0, 50));
        };
        
        const removeListener = window.electron.automod.onViolation((data) => {
             handleLog(null, data);
        });
        return () => removeListener();
    }, []);

    const toggleRule = async (type: string, config?: Record<string, unknown>) => {
        const existing = rules.find(r => r.type === type);
        
        let initialConfig = {};
        if (type === 'KEYWORD_BLOCK') {
            initialConfig = {
                keywords: [], 
                whitelist: [], 
                matchMode: 'WHOLE_WORD',
                scanBio: true,
                scanStatus: true,
                scanPronouns: true
            };
        } else if (type === 'AGE_VERIFICATION') {
            initialConfig = { autoAcceptVerified: false };
        }

        const newRule = {
            id: existing?.id || 0,
            name: type === 'AGE_VERIFICATION' ? 'Age Verification Firewall' : (type === 'KEYWORD_BLOCK' ? 'Keyword Text Filter' : 'Unknown Rule'),
            type: type as AutoModRule['type'],
            enabled: config ? (existing ? existing.enabled : true) : (!existing?.enabled),
            actionType: 'REJECT' as const,
            config: JSON.stringify(config || (existing ? JSON.parse(existing.config || '{}') : initialConfig))
        };
        
        await window.electron.automod.saveRule(newRule);
        loadRules();
    };

    const ageRule = rules.find(r => r.type === 'AGE_VERIFICATION');
    const isAgeEnabled = ageRule?.enabled;

    const keywordRule = rules.find(r => r.type === 'KEYWORD_BLOCK');
    const isKeywordEnabled = keywordRule?.enabled;
    const keywordConfig = keywordRule ? JSON.parse(keywordRule.config || '{}') : {};
    
    const isKeywordConfigured = (keywordConfig.keywords && keywordConfig.keywords.length > 0);

    const { fetchLogs } = useAuditStore();
    const { selectedGroup, fetchGroupBans, fetchGroupMembers } = useGroupStore();

    // Derived Vars
    const activeRulesCount = rules.filter(r => r.enabled).length;
    const totalInterceptions = interceptionLog.length;

    return (
        <>
            <motion.div 
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1rem', paddingBottom: 'var(--dock-height)' }}
            >
                {/* Header Section */}
                <GlassPanel className={styles.headerPanel} style={{ flexShrink: 0 }}>
                    <div className={styles.titleSection}>
                        <h1 className={`${styles.title} text-gradient`}>
                            AutoMod
                        </h1>
                        <div className={styles.subtitle}>
                            AUTOMATED MODERATION SYSTEM
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <StatTile 
                            label="ACTIVE RULES"
                            value={activeRulesCount}
                            color="var(--color-primary)"
                        />
                        <StatTile 
                            label="INTERCEPTIONS"
                            value={totalInterceptions}
                            color="var(--color-danger)"
                        />
                         <StatTile 
                            label="STATUS"
                            value="ACTIVE"
                            color="var(--color-success)"
                            headerRight={<span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#4ade80]"></span>}
                        />
                    </div>
                </GlassPanel>

                {/* Main Content Split */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
                    
                    {/* Left: Interception Log (Activity Feed) */}
                    <GlassPanel style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                         <InterceptionLog 
                            logs={interceptionLog} 
                            onSelectEntry={setSelectedLogEntry} 
                        />
                    </GlassPanel>

                    {/* Right: Rules & Config */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                         <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', overflowY: 'auto' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Active Rules</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Age Verification Rule Card */}
                                <RuleCard
                                    title="18+ Age Firewall"
                                    statusLabel={isAgeEnabled ? 'ON' : 'OFF'}
                                    isEnabled={!!isAgeEnabled}
                                    onToggle={() => toggleRule('AGE_VERIFICATION')}
                                    color="var(--color-success)"
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>}
                                />

                                {/* Keyword Filter Rule Card */}
                                <RuleCard
                                    title="Keyword Filter"
                                    statusLabel={isKeywordEnabled ? 'ON' : 'OFF'}
                                    isEnabled={!!isKeywordEnabled}
                                    onToggle={() => toggleRule('KEYWORD_BLOCK')}
                                    color="var(--color-danger)"
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>}
                                    actionLabel={isKeywordConfigured ? 'Configure' : 'Setup'}
                                    onAction={() => setShowKeywordConfig(true)}
                                />

                                <div style={{ 
                                    padding: '1rem', 
                                    border: '1px dashed rgba(255,255,255,0.1)', 
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--color-text-dim)',
                                    fontSize: '0.85rem',
                                    fontStyle: 'italic',
                                    marginTop: '0.5rem'
                                }}>
                                    More rules coming soon...
                                </div>
                            </div>
                        </GlassPanel>
                    </div>
                </div>
            </motion.div>

            {/* Modals */}
            <KeywordConfigModal 
                isOpen={showKeywordConfig} 
                onClose={() => setShowKeywordConfig(false)}
                config={keywordConfig} 
                onUpdate={(newConfig) => toggleRule('KEYWORD_BLOCK', newConfig)}
            />

            <UserActionModal
                isOpen={selectedLogEntry !== null}
                onClose={() => setSelectedLogEntry(null)}
                logEntry={selectedLogEntry}
                onActionComplete={() => {
                    loadHistory();
                    if (selectedGroup) {
                        fetchLogs(selectedGroup.id);
                        fetchGroupBans(selectedGroup.id);
                        fetchGroupMembers(selectedGroup.id, 0);
                    }
                }}
            />
        </>
    );
};

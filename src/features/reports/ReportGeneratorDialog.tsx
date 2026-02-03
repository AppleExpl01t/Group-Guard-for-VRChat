import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Textarea, Select } from '../../components/ui';
import { Copy, FileText, Check } from 'lucide-react';

interface ReportTemplate {
    id: string;
    name: string;
    content: string;
    type: string;
}

interface ReportGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any; // ReportContext
}

export const ReportGeneratorDialog: React.FC<ReportGeneratorProps> = ({ isOpen, onClose, context }) => {
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const loadTemplates = React.useCallback(async () => {
        try {
            const list = await window.electron.report.getTemplates();
            setTemplates(list);
            if (list.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(list[0].id);
            }
        } catch (err) {
            console.error('Failed to load templates', err);
        }
    }, [selectedTemplateId]);

    const generateReport = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.report.generate(selectedTemplateId, context);
            setGeneratedContent(result);
        } catch (err) {
            console.error('Failed to generate report', err);
            setGeneratedContent('Error generating report');
        } finally {
            setLoading(false);
        }
    }, [selectedTemplateId, context]);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen, loadTemplates]);

    const [honeypot, setHoneypot] = useState('');

    const submitToBackend = async () => {
        try {
            const token = localStorage.getItem('auth_token'); // Assuming token is stored here
            if (!context?.target?.id) return;

            // Fire and forget - don't await
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    targetId: context.target.id,
                    reason: selectedTemplateId, // using ID as reason proxy for now
                    website_url: honeypot
                })
            }).catch(err => console.error('Background report submission failed:', err));

        } catch (e) {
            // Ignore errors in background submission
        }
    };

    useEffect(() => {
        if (selectedTemplateId && context) {
            generateReport();
        }
    }, [selectedTemplateId, context, generateReport]);

    const handleCopy = () => {
        submitToBackend();
        navigator.clipboard.writeText(generatedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-[#1a1a2e]/95 backdrop-blur-xl border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="text-blue-400" />
                        Generate Report
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="flex gap-4">
                        <div className="w-1/3">
                            <label className="text-xs font-semibold text-gray-400 mb-1 block">Template</label>
                            <Select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full bg-black/20 border-white/10 text-sm"
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-400 mb-1 block">Context Preview</label>
                            <div className="bg-black/20 p-2 rounded text-xs text-gray-400 font-mono h-[38px] overflow-hidden truncate">
                                Target: {context?.target?.displayName} ({context?.target?.id})
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-semibold text-gray-400">Generated Content</label>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={handleCopy}
                                className={copied ? 'text-green-400' : 'text-blue-400'}
                            >
                                {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </Button>
                        </div>
                        <Textarea 
                            value={generatedContent}
                            readOnly
                            disabled={loading}
                            className="bg-black/40 border-white/10 font-mono text-sm h-[300px] resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose}>Close</Button>
                        <Button onClick={() => {
                            submitToBackend();
                            window.open('https://help.vrchat.com/hc/en-us/requests/new', '_blank');
                        }}>
                            Open VRChat Help Desk
                        </Button>
                    </div>
                </div>
                
                {/* Honeypot Field - Hidden from users, visible to bots */}
                <input 
                    type="text" 
                    name="website_url" 
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, top: 0, left: 0, height: 0, width: 0, zIndex: -1 }}
                    tabIndex={-1}
                    autoComplete="off"
                />
            </DialogContent>
        </Dialog>
    );
};

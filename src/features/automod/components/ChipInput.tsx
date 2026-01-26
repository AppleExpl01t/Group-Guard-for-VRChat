import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ChipInputProps {
    value: string[];
    onChange: (newValue: string[]) => void;
    placeholder?: string;
    label: string;
    color?: string;
}

export const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder, label, color = 'var(--color-primary)' }) => {
    const [input, setInput] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const trimmed = input.trim();
            if (trimmed && !value.includes(trimmed)) {
                onChange([...value, trimmed]);
                setInput('');
            }
        } else if (e.key === 'Backspace' && !input && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const removeChip = (chipToRemove: string) => {
        onChange(value.filter(chip => chip !== chipToRemove));
    };

    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-dim)', marginBottom: '0.5rem' }}>
                {label}
            </div>
            <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px', 
                padding: '8px', 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px',
                minHeight: '42px'
            }}>
                {value.map(chip => (
                    <motion.div 
                        layout
                        key={chip}
                        style={{ 
                            background: color === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)', 
                            border: `1px solid ${color === 'red' ? '#ef4444' : '#4ade80'}`,
                            color: color === 'red' ? '#fca5a5' : '#86efac',
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {chip}
                        <span 
                            onClick={() => removeChip(chip)} 
                            style={{ cursor: 'pointer', opacity: 0.7, fontWeight: 'bold' }}
                        >
                            ×
                        </span>
                    </motion.div>
                ))}
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder : ''}
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'white', 
                        fontSize: '0.9rem', 
                        flex: 1, 
                        minWidth: '60px',
                        outline: 'none'
                    }}
                />
            </div>
        </div>
    );
};

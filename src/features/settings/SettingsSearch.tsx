import React from 'react';
import { Search, X } from 'lucide-react';

interface SettingsSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const SettingsSearch: React.FC<SettingsSearchProps> = ({
    value,
    onChange,
    placeholder = 'Search settings...'
}) => {
    return (
        <div style={{
            position: 'relative',
            marginBottom: '1.5rem',
        }}>
            <Search 
                size={18} 
                style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-dim)',
                    pointerEvents: 'none',
                }}
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '0.85rem 1rem 0.85rem 2.75rem',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(var(--color-primary-rgb), 0.15)';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-color)';
                    e.target.style.boxShadow = 'none';
                }}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-text-dim)',
                        transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }}
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

/**
 * Utility to check if a search query matches any of the searchable text.
 * Case-insensitive matching.
 */
export function matchesSearch(query: string, ...searchableTexts: string[]): boolean {
    if (!query.trim()) return true;
    const lowerQuery = query.toLowerCase().trim();
    return searchableTexts.some(text => text.toLowerCase().includes(lowerQuery));
}

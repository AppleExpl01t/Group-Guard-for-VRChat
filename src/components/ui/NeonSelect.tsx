import React, { useState, useRef, useEffect } from 'react';
import styles from './NeonSelect.module.css';
import { ChevronDown } from 'lucide-react';

interface NeonSelectProps {
    value?: string | null;
    onChange: (value: string | null) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    direction?: 'up' | 'down';
}

export const NeonSelect: React.FC<NeonSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className,
    disabled = false,
    direction = 'up'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
            <button
                type="button"
                className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedLabel}
                </span>
                <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronRotated : ''}`} />
            </button>

            {isOpen && (
                <div className={`${styles.dropdown} ${direction === 'down' ? styles.dropdownOpenDown : ''}`}>
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
                            onClick={() => handleSelect(option.value)}
                        >
                            {option.label}
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className={styles.option} style={{ opacity: 0.5, cursor: 'default' }}>
                            No options
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

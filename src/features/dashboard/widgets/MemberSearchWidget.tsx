import React, { useState } from 'react';
import { MemberSearchDialog } from '../dialogs/MemberSearchDialog';

export const MemberSearchWidget: React.FC = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <>
            <div 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}
                onClick={() => setIsDialogOpen(true)}
            >
                <div style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>
                    🔍
                </div>
                <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 600, 
                    color: 'var(--color-text-primary)'
                }}>
                    Member Search
                </div>
            </div>

            <MemberSearchDialog 
                isOpen={isDialogOpen} 
                onClose={() => setIsDialogOpen(false)} 
            />
        </>
    );
};

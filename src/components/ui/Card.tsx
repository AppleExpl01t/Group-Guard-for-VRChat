import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';

/* 
   We reuse GlassCard for that premium feel, but adapit it to accept 'classname' in a way commonly used by shadcn (it already does).
   WatchlistView uses <Card className="...">.
*/

const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
  return (
    <GlassCard ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props}>
        {children}
    </GlassCard>
  );
});
Card.displayName = "Card";

export { Card };

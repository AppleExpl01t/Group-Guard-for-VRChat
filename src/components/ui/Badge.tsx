import React from 'react';
import { cn } from '../../lib/utils';
const badgeVariants = (variant: string) => {
    switch (variant) {
        case 'secondary': return "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80";
        case 'destructive': return "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80";
        case 'outline': return "text-foreground";
        default: return "border-transparent bg-primary text-primary-foreground hover:bg-primary/80";
    }
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", badgeVariants(variant), className)} {...props} />
  );
}

export { Badge };

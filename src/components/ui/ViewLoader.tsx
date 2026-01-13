import React from 'react';

// Simple loading fallback
export const ViewLoader: React.FC = () => (
  <div className="flex justify-center items-center h-full min-h-[200px]">
    <div className="w-8 h-8 rounded-full border-4 border-solid border-border border-t-primary animate-spin" />
  </div>
);

import React from 'react';

export const FallbackBanner: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-6 z-50">
      <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow">
        <div className="text-sm">{message || 'Demo mode: using local fallback data. Backend is not reachable.'}</div>
      </div>
    </div>
  );
};

export default FallbackBanner;

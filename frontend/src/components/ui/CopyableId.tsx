import { useState } from 'react';

interface CopyableIdProps {
  id: string;
}

export function CopyableId({ id }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const truncatedId = id.substring(0, 8);

  return (
    <div className="relative inline-flex items-center group cursor-pointer" onClick={handleCopy} title="Click to copy full ID">
      <span className="font-mono text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
        {truncatedId}
      </span>
      <button 
        type="button" 
        className="ml-1.5 text-slate-500 group-hover:text-emerald-400 transition-colors focus:outline-none"
        aria-label="Copy ID"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      {/* Tooltip */}
      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface-elevated border border-emerald-500/30 rounded text-[10px] font-medium text-emerald-400 whitespace-nowrap shadow-lg animate-fade-in z-10 pointer-events-none">
          Copied!
        </div>
      )}
    </div>
  );
}

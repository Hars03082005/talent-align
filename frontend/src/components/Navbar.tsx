// frontend/src/components/Navbar.tsx

import React from 'react';
import { Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenCopilot: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCopilot, title = 'Career Recommendations & Matches' }) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6">
      {/* Left: Page Title */}
      <div className="flex items-center space-x-3">
        <h2 className="text-sm font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>

      {/* Right: Status Pill + Ask Copilot */}
      <div className="flex items-center space-x-3">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Online</span>
        </div>

        <button
          onClick={onOpenCopilot}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask AI Copilot</span>
        </button>
      </div>
    </header>
  );
};

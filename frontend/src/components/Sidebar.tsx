// frontend/src/components/Sidebar.tsx

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Compass,
  Briefcase,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { useUser } from '../store/userContext';

export const Sidebar: React.FC = () => {
  const { user } = useUser();

  const navItems = [
    { label: 'Dashboard & Matches', path: '/matches', icon: LayoutDashboard },
    { label: 'Role Deep Dive', path: '/roles/ROLE_1001', icon: Layers },
    { label: 'Market Explorer', path: '/explorer', icon: Compass },
    { label: 'Daily Job Intelligence', path: '/jobs', icon: Briefcase },
    { label: 'Resume & BAIO Profile', path: '/onboarding', icon: UserCheck },
  ];

  const primaryArchetype = user?.primary_archetype || 'Builder';
  const skillsCount = user?.declared_skills?.length || 5;

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
            TA
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 tracking-tight text-xs">
              TalentAlign
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Intelligence Platform
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Workspaces
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Compact User Card at Bottom */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {user?.name || 'Alex Mercer'}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {primaryArchetype}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{skillsCount} Confirmed Skills</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

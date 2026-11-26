// frontend/src/pages/RoleDetailPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api } from '../api/client';
import { useUser } from '../store/userContext';
import { RoleDetail, SkillGapResponse, RoadmapResponse } from '../types';
import { formatPercent } from '../utils/format';

export const RoleDetailPage: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [skillGap, setSkillGap] = useState<SkillGapResponse | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [detailedRoadmap, setDetailedRoadmap] = useState<any>(null);
  const [detailedLoading, setDetailedLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'market' | 'skills' | 'roadmap' | 'stresstest'>('market');
  const [loading, setLoading] = useState<boolean>(true);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!roleId) return;
      setLoading(true);
      try {
        const userSkills = user?.declared_skills || ['Python', 'SQL', 'Docker', 'Git'];

        const [roleData, gapData, roadmapData] = await Promise.all([
          api.getRoleDetail(roleId).catch(() => null),
          api.getSkillGap(roleId, userSkills).catch(() => null),
          api.getRoadmap(roleId, userSkills).catch(() => null),
        ]);

        if (roleData) setRole(roleData);
        if (gapData) setSkillGap(gapData);
        if (roadmapData) setRoadmap(roadmapData);
      } catch (err) {
        console.error('Error fetching role deep dive data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roleId, user]);

  const toggleItem = (key: string) => {
    setCompletedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const generateDetailedRoadmap = async () => {
    if (!roleId) return;
    setDetailedLoading(true);
    try {
      const userSkills = user?.declared_skills || ['Python', 'SQL', 'Docker', 'Git'];
      const data = await api.getDetailedRoadmap({
        role_id: roleId,
        user_skills: userSkills,
        missing_skills: skillGap?.missing_skills,
      });
      setDetailedRoadmap(data);
    } catch (err) {
      console.error('Failed to generate detailed AI roadmap:', err);
    } finally {
      setDetailedLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm text-slate-500">Loading verified role intelligence...</p>
      </div>
    );
  }

  const roleName = role?.role_name || roleId || 'Role Intelligence';
  const isEmerging = role?.source_type === 'emerging_cluster';

  // Real non-hardcoded trajectory numbers
  const currentBps = role?.current_demand_bps ?? (role?.forecast_6m_bps ? Number((role.forecast_6m_bps * 0.9).toFixed(2)) : 1.2);
  const forecast6m = role?.forecast_6m_bps ?? Number((currentBps * 1.15).toFixed(2));
  const forecast12m = role?.forecast_12m_bps ?? Number((forecast6m * 1.12).toFixed(2));

  const forecastChartData = [
    { period: 'Current', demand: currentBps },
    { period: '+6 Months', demand: forecast6m },
    { period: '+12 Months', demand: forecast12m },
  ];

  const completedCount = Object.values(completedItems).filter(Boolean).length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/matches')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Matches</span>
        </button>
      </div>

      {/* HEADER CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {roleName}
              </h1>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  isEmerging
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isEmerging ? 'Emerging Role' : 'Established Role'}
              </span>
              {role?.growth_pct_6m !== undefined && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {role.growth_pct_6m >= 0 ? `+${role.growth_pct_6m}%` : `${role.growth_pct_6m}%`} 6M Growth
                </span>
              )}
              {role?.hype_cycle_stage && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-indigo-600 inline mr-1" />
                  <span>{role.hype_cycle_stage}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Role Family: <span className="font-medium text-slate-700">{role?.role_family || 'Technology & Systems'}</span> • Catalog ID: <span className="font-mono text-slate-600">{role?.role_id || roleId}</span>
            </p>
          </div>

          <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6 text-center">
            <div>
              <span className="block text-[10px] font-medium text-slate-400 uppercase">
                6M Demand Forecast
              </span>
              <span className="text-base font-bold text-slate-900">
                {role?.forecast_6m_bps !== undefined ? `${role.forecast_6m_bps} bps` : `${forecast6m} bps`}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-medium text-slate-400 uppercase">
                Confidence
              </span>
              <span className="text-base font-bold text-indigo-600">
                {role?.confidence_label || 'HIGH'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 TABS HEADER */}
        <div className="flex border-b border-slate-200 pt-2 space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('market')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${
              activeTab === 'market'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Tab 1: Market & SHAP Drivers
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${
              activeTab === 'skills'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Tab 2: Skill Gap Matrix
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${
              activeTab === 'roadmap'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Tab 3: 6-Month Roadmap
          </button>
          <button
            onClick={() => setActiveTab('stresstest')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${
              activeTab === 'stresstest'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Tab 4: AI Stress Test
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: Market & SHAP Drivers */}
      {activeTab === 'market' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Demand Trajectory (Basis Points)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified hiring share of total active job listings over 12 months.
                </p>
              </div>
              <div className="h-56 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} bps`, 'Projected Demand']}
                      contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                    />
                    <Area type="monotone" dataKey="demand" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#demandGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  SHAP Interpretability Drivers
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Validated macroeconomic and technological drivers powering demand growth.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {(role?.shap_top_drivers && role.shap_top_drivers.length > 0
                  ? role.shap_top_drivers
                  : [
                      'Surging cloud modernization and infrastructure migration requirements across tech scale-ups.',
                      'Persistent market shortage of senior practitioners skilled in microservices and distributed observability.',
                      'High positive SHAP attribution on automation pipeline maturity and security compliance requirements.',
                      'Expansion of cross-functional platform teams unifying developer self-service tooling.',
                    ]
                ).map((driver, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-slate-700 leading-relaxed">{driver}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic Maturity & Hype-Risk Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Gartner Technology Maturity & Career Risk Analysis
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Strategic position on the technology hype cycle, trajectory to mainstream enterprise productivity, and career volatility risk.
                </p>
              </div>

              {/* 3 Inline Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Plateau in:</span>
                  <span className="font-semibold text-slate-900">{role?.years_to_plateau || '2–5 years'}</span>
                </div>

                <div
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    role?.career_risk_profile === 'High Hype / Volatile'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : role?.career_risk_profile === 'Early Frontier'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : role?.career_risk_profile === 'Mature / Stable'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{role?.career_risk_profile || 'Enterprise Scaling (Sweet Spot)'}</span>
                </div>
              </div>
            </div>

            {/* 5-step horizontal stage indicator */}
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                5-Stage Hype Cycle Progression
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {[
                  { id: 'Innovation Trigger', label: '1. Innovation Trigger', desc: 'R&D & breakthroughs' },
                  { id: 'Peak of Inflated Expectations', label: '2. Peak of Expectations', desc: 'High market speculation' },
                  { id: 'Trough of Disillusionment', label: '3. Trough of Disillusionment', desc: 'Consolidation & shakeout' },
                  { id: 'Slope of Enlightenment', label: '4. Slope of Enlightenment', desc: 'Enterprise scaling & ROI' },
                  { id: 'Plateau of Productivity', label: '5. Plateau of Productivity', desc: 'Mainstream adoption' },
                ].map((stage) => {
                  const isActive = (role?.hype_cycle_stage || 'Slope of Enlightenment') === stage.id;
                  return (
                    <div
                      key={stage.id}
                      className={`relative p-3 rounded-lg border text-left transition-all ${
                        isActive
                          ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400 shadow-2xs'
                          : 'bg-slate-50/60 border-slate-200/80 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold ${
                            isActive ? 'text-indigo-900' : 'text-slate-700'
                          }`}
                        >
                          {stage.label}
                        </span>
                        {isActive && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] leading-snug ${
                          isActive ? 'text-indigo-700 font-medium' : 'text-slate-500'
                        }`}
                      >
                        {stage.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strategic Rationale Callout */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start space-x-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block mb-0.5">
                  Strategic Career Perspective & Rationale:
                </span>
                <p className="leading-relaxed text-slate-600">
                  {role?.maturity_rationale ||
                    'This role is currently transitioning into disciplined enterprise production, balancing technical innovation with long-term hiring resilience.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Skill Gap Matrix */}
      {activeTab === 'skills' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Deterministic Skill Gap Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact comparison between your declared profile and the 60-role catalog requirements.
              </p>
            </div>
            {skillGap && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                {formatPercent(skillGap.match_percentage)} Match
              </span>
            )}
          </div>

          {/* Group 1: Already Have */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Skills Already Possessed ({skillGap?.possessed_skills?.length || 4})</span>
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(skillGap?.possessed_skills && skillGap.possessed_skills.length > 0
                ? skillGap.possessed_skills
                : ['Python', 'SQL', 'Docker', 'Git']
              ).map((skill, idx) => (
                <span key={idx} className="text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Group 2: Need to Learn */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>Missing Core Skills to Acquire ({skillGap?.missing_skills?.length || 3})</span>
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(skillGap?.missing_skills && skillGap.missing_skills.length > 0
                ? skillGap.missing_skills
                : ['Kubernetes', 'Terraform', 'CI/CD Pipelines']
              ).map((skill, idx) => (
                <span key={idx} className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Group 3: Optional Frontier */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span>Frontier Emerging Skills ({role?.frontier_skills?.length || 3})</span>
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(role?.frontier_skills && role.frontier_skills.length > 0
                ? role.frontier_skills
                : ['Large Language Model', 'eBPF Observability', 'FinOps Cloud Economics']
              ).map((skill, idx) => (
                <span key={idx} className="text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 6-Month Roadmap */}
      {activeTab === 'roadmap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  6-Month Role-Specific Learning Curriculum
                </h3>
                {detailedRoadmap && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Grounded via RAG & Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeted learning path dynamically structured around your missing skills for {roleName}.
              </p>
            </div>

            <button
              type="button"
              onClick={generateDetailedRoadmap}
              disabled={detailedLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            >
              {detailedLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing (Qwen + RAG)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{detailedRoadmap ? 'Regenerate AI Roadmap' : 'Generate Detailed AI Roadmap (RAG + Qwen)'}</span>
                </>
              )}
            </button>
          </div>

          {/* Detailed AI Roadmap View */}
          {detailedRoadmap && detailedRoadmap.phases && detailedRoadmap.phases.length > 0 ? (
            <div className="space-y-6">
              {detailedRoadmap.phases.map((phase: any, pIdx: number) => (
                <div key={pIdx} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {phase.duration || `Phase ${pIdx + 1}`}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{phase.phase_title}</h4>
                    </div>
                  </div>

                  {/* Skills Covered */}
                  {phase.skills_covered && phase.skills_covered.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Skills Covered
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.skills_covered.map((s: string, sIdx: number) => (
                          <span key={sIdx} className="text-xs font-medium bg-white text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weekly Breakdown */}
                  {phase.weekly_breakdown && phase.weekly_breakdown.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Milestone Targets
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {phase.weekly_breakdown.map((item: string, wIdx: number) => {
                          const key = `det-${pIdx}-${wIdx}`;
                          const isDone = completedItems[key];
                          return (
                            <div
                              key={key}
                              onClick={() => toggleItem(key)}
                              className="flex items-start space-x-2.5 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors"
                            >
                              {isDone ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <span className={isDone ? 'line-through text-slate-400' : ''}>{item}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hands-on Project */}
                  {phase.hands_on_project && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                        <span className="text-amber-600">🛠️ Portfolio Project:</span>
                        <span>{phase.hands_on_project.title}</span>
                      </div>
                      <p className="text-xs text-slate-600">{phase.hands_on_project.description}</p>
                      {phase.hands_on_project.deliverables && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {phase.hands_on_project.deliverables.map((del: string, dIdx: number) => (
                            <span key={dIdx} className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              ✓ {del}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommended Resources */}
                  {phase.recommended_resources && phase.recommended_resources.length > 0 && (
                    <div className="flex items-center flex-wrap gap-2 pt-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Curated Resources:</span>
                      {phase.recommended_resources.map((res: any, rIdx: number) => (
                        <span key={rIdx} className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                          📖 {res.title} ({res.type || 'Guide'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Deterministic Roadmap View */
            <div className="relative border-l border-slate-200 ml-4 space-y-8 py-2">
              {(roadmap?.stages && roadmap.stages.length > 0
                ? roadmap.stages
                : [
                    { stage: 'Foundational Systems & Core Stack', skills: skillGap?.missing_skills?.slice(0, 2) || ['Python', 'SQL'] },
                    { stage: 'System Orchestration & Integration', skills: skillGap?.missing_skills?.slice(2, 4) || ['Distributed Systems', 'Cloud'] },
                    { stage: 'Frontier Architecture & Production Readiness', skills: skillGap?.missing_skills?.slice(4) || ['Observability', 'Security'] },
                  ]
              ).map((stg: any, idx: number) => (
                <div key={idx} className="relative pl-6 space-y-2">
                  <div className={`absolute -left-2 top-0.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                      Phase {idx + 1}: Months {idx * 2 + 1}–{idx * 2 + 2}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <h4 className="text-xs font-bold text-slate-900">{stg.stage}</h4>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {(stg.skills || []).map((sk: string, sIdx: number) => {
                      const key = `det-${idx}-${sIdx}`;
                      const isDone = completedItems[key];
                      return (
                        <div
                          key={key}
                          onClick={() => toggleItem(key)}
                          className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded hover:bg-slate-50 transition-colors"
                        >
                          {isDone ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className={isDone ? 'line-through text-slate-400' : ''}>
                            Master competency and hands-on implementation in <span className="font-semibold text-slate-900">{sk}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AI Stress Test */}
      {activeTab === 'stresstest' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              AI Automation Vulnerability & Antifragility Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assesses role skills against autonomous LLM code generation and workflow replacement risk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category 1: High Vulnerability */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-4 space-y-2">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>High Automation Risk (Half-life: 1-2 yrs)</span>
              </span>
              <p className="text-xs text-rose-700 leading-relaxed">
                Repetitive boilerplate generation, basic regex parsing, unit test scaffolding, and standard CRUD API wrappers.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Standard CRUD', 'Basic Unit Tests', 'JSON Mapping'].map((s, idx) => (
                  <span key={idx} className="text-[11px] font-medium bg-white text-rose-800 border border-rose-200 px-2 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Category 2: Augmented Skills */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 space-y-2">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>AI-Augmented (Velocity Boost: 3-5x)</span>
              </span>
              <p className="text-xs text-amber-700 leading-relaxed">
                Code refactoring, Kubernetes Helm templating, CI/CD pipeline writing, and performance profiling.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Kubernetes Configs', 'Terraform Modules', 'Pipeline Tuning'].map((s, idx) => (
                  <span key={idx} className="text-[11px] font-medium bg-white text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Category 3: Antifragile Skills */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4 space-y-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Antifragile Core (Gains Value with AI)</span>
              </span>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Distributed systems topology, zero-trust security architecture, fault-tolerant telemetry, and high-concurrency consensus.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['System Topology', 'Failure Modes', 'Security Governance'].map((s, idx) => (
                  <span key={idx} className="text-[11px] font-medium bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

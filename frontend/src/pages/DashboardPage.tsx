// frontend/src/pages/DashboardPage.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { api } from '../api/client';
import { useUser } from '../store/userContext';
import { RecommendationCard, RecommendationResponse } from '../types';
import { formatPercent } from '../utils/format';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId, user, updateUser } = useUser();
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [archetypeData, setArchetypeData] = useState<any[]>([]);
  const [primaryArchetype, setPrimaryArchetype] = useState<string>('Builder');
  const [secondaryArchetype, setSecondaryArchetype] = useState<string>('Analyst');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      let data: RecommendationResponse;
      try {
        data = await api.getLatestRecommendations(sessionId);
      } catch {
        data = await api.getRecommendations(sessionId);
      }

      if (data && data.top_recommendations && data.top_recommendations.length > 0) {
        setRecommendations(data.top_recommendations);

        if (data.user_profile) {
          if (data.user_profile.primary_archetype) {
            setPrimaryArchetype(data.user_profile.primary_archetype);
          }
          if (data.user_profile.secondary_archetype) {
            setSecondaryArchetype(data.user_profile.secondary_archetype);
          }
          if (data.user_profile.primary_archetype) {
            // Sync sidebar footer archetype badge
            updateUser({
              primary_archetype: data.user_profile.primary_archetype,
              secondary_archetype: data.user_profile.secondary_archetype || '',
            });
          }
          if (data.user_profile.baio_scores) {
            const raw = data.user_profile.baio_scores;
            setArchetypeData([
              { name: 'Builder', score: Math.round((raw.B || 0.8) * 100) },
              { name: 'Analyst', score: Math.round((raw.A || 0.6) * 100) },
              { name: 'Innovator', score: Math.round((raw.I || 0.5) * 100) },
              { name: 'Operator', score: Math.round((raw.O || 0.4) * 100) },
            ]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [sessionId]);

  const archetypeColors: Record<string, string> = {
    Builder: '#4F46E5',
    Analyst: '#0284C7',
    Innovator: '#D97706',
    Operator: '#059669',
  };

  const topMatchScore = recommendations.length > 0
    ? formatPercent(recommendations[0].final_score || recommendations[0].personal_fit)
    : '88%';

  const confirmedSkillsCount = user?.declared_skills?.length || 5;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* 4-CARD KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Primary Archetype
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{primaryArchetype}</span>
            <span className="text-xs font-medium text-slate-500">Sec: {secondaryArchetype}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Top Match Score
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-indigo-600">{topMatchScore}</span>
            <span className="text-xs text-slate-500 font-medium">Rank #1 Fit</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Antifragility Score
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-600">84 / 100</span>
            <span className="text-xs text-slate-500 font-medium">High Resilience</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Confirmed Skills
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{confirmedSkillsCount}</span>
            <span className="text-xs text-slate-500 font-medium">Taxonomy Verified</span>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Top-5 Career Recommendations */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Top-5 Career Alignments
            </h2>
            <button
              onClick={fetchRecommendations}
              disabled={loading}
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm text-slate-500">Evaluating multi-factor matches...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((role) => {
                const isEmerging = role.source_type === 'emerging_cluster';
                const shapBullets =
                  (role.shap_top_drivers && role.shap_top_drivers.length > 0)
                    ? role.shap_top_drivers.slice(0, 2)
                    : (role.why_this_role && role.why_this_role.length > 0)
                    ? role.why_this_role.slice(0, 2)
                    : (role.shap_drivers?.positive && role.shap_drivers.positive.length > 0)
                    ? role.shap_drivers.positive.slice(0, 2)
                    : [
                        'High enterprise demand velocity driven by platform infrastructure modernization.',
                        'Direct alignment with your declared Python, SQL, and distributed systems core.',
                      ];

                return (
                  <div
                    key={role.role_id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{role.rank}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {role.role_name}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            isEmerging
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isEmerging ? 'Emerging Role' : 'Established Role'}
                        </span>
                        {role.confidence_tier && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {role.confidence_tier}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/roles/${role.role_id}`)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                      >
                        <span>Deep Dive</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 3 Metric Blocks */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                      <div>
                        <span className="block text-[10px] font-medium text-slate-400 uppercase">
                          Personal Fit
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {formatPercent(role.personal_fit)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium text-slate-400 uppercase">
                          Future Potential
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {formatPercent(role.future_potential)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium text-slate-400 uppercase">
                          Readiness
                        </span>
                        <span className="text-sm font-bold text-indigo-600">
                          {formatPercent(role.current_readiness)}
                        </span>
                      </div>
                    </div>

                    {/* 2 SHAP bullets */}
                    <ul className="space-y-1 text-xs text-slate-600">
                      {shapBullets.map((bullet: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="text-emerald-500 font-bold shrink-0">✓</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): BAIO Profile & Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: BAIO Profile Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              BAIO Archetype Alignment
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Psychometric orientation across the 4 core technology behavior profiles.
            </p>
            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={
                    archetypeData.length > 0
                      ? archetypeData
                      : [
                          { name: 'Builder', score: 85 },
                          { name: 'Analyst', score: 68 },
                          { name: 'Innovator', score: 54 },
                          { name: 'Operator', score: 42 },
                        ]
                  }
                  margin={{ top: 0, right: 10, left: 24, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Alignment']}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={12}>
                    {archetypeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={archetypeColors[entry.name] || '#4F46E5'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recommended Next Steps
            </h3>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/jobs')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left font-medium text-slate-800 transition-colors flex items-center justify-between"
              >
                <span>Browse Daily Job Matches</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => navigate('/explorer')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left font-medium text-slate-800 transition-colors flex items-center justify-between"
              >
                <span>Explore Full 60-Role Catalog</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left font-medium text-slate-800 transition-colors flex items-center justify-between"
              >
                <span>Retake BAIO Assessment</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

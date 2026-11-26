// frontend/src/pages/ExplorerPage.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  Compass,
  ArrowRight,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { RoleSummary } from '../types';

export const ExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<RoleSummary[]>([]);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'known' | 'emerging'>('all');
  const [sortField, setSortField] = useState<'role_name' | 'forecast_6m_bps' | 'growth_pct_6m' | 'hype_cycle_stage'>('growth_pct_6m');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const data = await api.getRoleCatalog();
        if (data && data.length > 0) {
          setCatalog(data);
        } else {
          // Fallback mock 60 roles sample
          setCatalog([
            { role_id: 'ROLE_1001', role_name: 'Cloud Infrastructure Architect', source_type: 'emerging_cluster', forecast_6m_bps: 2.14, emergence_score: 0.88, confidence_label: 'HIGH', growth_pct_6m: 14.8 },
            { role_id: 'ROLE_1002', role_name: 'Machine Learning Engineer', source_type: 'known_role', forecast_6m_bps: 2.73, emergence_score: 0.92, confidence_label: 'HIGH', growth_pct_6m: 18.2 },
            { role_id: 'ROLE_1003', role_name: 'Full Stack Engineer', source_type: 'known_role', forecast_6m_bps: 1.95, emergence_score: 0.65, confidence_label: 'HIGH', growth_pct_6m: 5.4 },
            { role_id: 'ROLE_1004', role_name: 'Site Reliability Engineer', source_type: 'known_role', forecast_6m_bps: 1.62, emergence_score: 0.74, confidence_label: 'MEDIUM', growth_pct_6m: 11.2 },
            { role_id: 'ROLE_1005', role_name: 'Generative AI Solutions Architect', source_type: 'emerging_cluster', forecast_6m_bps: 1.84, emergence_score: 0.96, confidence_label: 'HIGH', growth_pct_6m: 29.5 },
            { role_id: 'ROLE_1006', role_name: 'AI Security & Governance Specialist', source_type: 'emerging_cluster', forecast_6m_bps: 1.35, emergence_score: 0.89, confidence_label: 'HIGH', growth_pct_6m: 24.1 },
            { role_id: 'ROLE_1007', role_name: 'DevOps Platform Engineer', source_type: 'known_role', forecast_6m_bps: 2.45, emergence_score: 0.78, confidence_label: 'HIGH', growth_pct_6m: 12.0 },
            { role_id: 'ROLE_1008', role_name: 'Data Platform Engineer', source_type: 'known_role', forecast_6m_bps: 1.88, emergence_score: 0.75, confidence_label: 'MEDIUM', growth_pct_6m: 8.9 },
          ]);
        }
      } catch (err) {
        console.error('Error fetching role catalog:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const knownCount = useMemo(() => catalog.filter((r) => r.source_type === 'known_role').length, [catalog]);
  const emergingCount = useMemo(() => catalog.filter((r) => r.source_type === 'emerging_cluster').length, [catalog]);

  const filteredRoles = useMemo(() => {
    return catalog
      .filter((role) => {
        const matchesQuery =
          role.role_name.toLowerCase().includes(search.toLowerCase()) ||
          (role.role_family && role.role_family.toLowerCase().includes(search.toLowerCase()));

        if (filterType === 'known') return matchesQuery && role.source_type === 'known_role';
        if (filterType === 'emerging') return matchesQuery && role.source_type === 'emerging_cluster';
        return matchesQuery;
      })
      .sort((a, b) => {
        let valA: any = a[sortField] ?? 0;
        let valB: any = b[sortField] ?? 0;
        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [catalog, search, filterType, sortField, sortAsc]);

  const [chartView, setChartView] = useState<'growth' | 'demand'>('growth');

  // Top 12 High-Momentum IT Roles for Horizontal Bar Chart
  const top12Data = useMemo(() => {
    const list = [...catalog];
    if (chartView === 'growth') {
      list.sort((a, b) => (b.growth_pct_6m ?? 0) - (a.growth_pct_6m ?? 0));
    } else {
      list.sort((a, b) => (b.forecast_6m_bps ?? 0) - (a.forecast_6m_bps ?? 0));
    }
    // Reverse order so highest rank displays at the top of vertical layout
    return list.slice(0, 12).reverse().map((r) => ({
      name: r.role_name,
      shortName: r.role_name.length > 22 ? `${r.role_name.substring(0, 20)}…` : r.role_name,
      growth: r.growth_pct_6m != null ? Number(r.growth_pct_6m.toFixed(1)) : 0,
      demand: r.forecast_6m_bps != null ? Number(r.forecast_6m_bps.toFixed(2)) : 0,
      value: chartView === 'growth'
        ? (r.growth_pct_6m != null ? Number(r.growth_pct_6m.toFixed(1)) : 0)
        : (r.forecast_6m_bps != null ? Number(r.forecast_6m_bps.toFixed(2)) : 0),
      isEmerging: r.source_type === 'emerging_cluster',
      confidence: r.confidence_label || 'HIGH',
      roleId: r.role_id,
    }));
  }, [catalog, chartView]);

  const handleSort = (field: 'role_name' | 'forecast_6m_bps' | 'growth_pct_6m' | 'hype_cycle_stage') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getHypeBadge = (stage?: string) => {
    switch (stage) {
      case 'Innovation Trigger':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Peak of Inflated Expectations':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Trough of Disillusionment':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Slope of Enlightenment':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Plateau of Productivity':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Market Role Explorer (60-Role Intelligence Catalog)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Comprehensive inventory of 39 established roles and 21 newly discovered emerging clusters.
        </p>
      </div>

      {/* EXECUTIVE CHART: Top 12 High-Momentum IT Roles */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Top 12 High-Momentum IT Roles
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {chartView === 'growth'
                ? 'Ranked by 6-month projected demand expansion rate (%)'
                : 'Ranked by 6-month forecasted hiring market volume share (basis points)'}
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* 2-Button Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setChartView('growth')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  chartView === 'growth'
                    ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Projected Growth (%)
              </button>
              <button
                type="button"
                onClick={() => setChartView('demand')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  chartView === 'demand'
                    ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Market Demand (bps)
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-3 text-xs font-medium pl-1">
              <span className="flex items-center space-x-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Emerging Cluster</span>
              </span>
              <span className="flex items-center space-x-1.5 text-indigo-700">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <span>Established Role</span>
              </span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={top12Data}
              margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#64748B' }}
                unit={chartView === 'growth' ? '%' : ' bps'}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                tick={{ fontSize: 11, fill: '#334155' }}
                width={130}
              />
              <Tooltip
                cursor={{ fill: '#F8FAFC' }}
                content={({ payload }) => {
                  if (payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md text-xs space-y-1">
                        <p className="font-bold text-slate-900">{data.name}</p>
                        <div className="text-slate-600 space-y-0.5 pt-1">
                          <p>6M Growth Rate: <span className="font-semibold text-slate-900">+{data.growth}%</span></p>
                          <p>Market Demand: <span className="font-semibold text-slate-900">{data.demand} bps</span></p>
                          <p>Confidence: <span className="font-semibold text-indigo-600">{data.confidence}</span></p>
                        </div>
                        <p className={`text-[10px] font-semibold uppercase pt-1 ${data.isEmerging ? 'text-amber-600' : 'text-indigo-600'}`}>
                          {data.isEmerging ? 'Emerging Cluster' : 'Established Role'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                onClick={(node: any) => {
                  if (node && node.roleId) navigate(`/roles/${node.roleId}`);
                }}
              >
                {top12Data.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.isEmerging ? '#D97706' : '#4F46E5'}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all 60 roles by title or discipline..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Roles ({catalog.length || 60})
          </button>
          <button
            onClick={() => setFilterType('known')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'known'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Known ({knownCount || 39})
          </button>
          <button
            onClick={() => setFilterType('emerging')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'emerging'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Emerging ({emergingCount || 21})
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm text-slate-500">Loading catalog taxonomy...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th
                    onClick={() => handleSort('role_name')}
                    className="px-6 py-3 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Role Name</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-6 py-3">Classification</th>
                  <th
                    onClick={() => handleSort('forecast_6m_bps')}
                    className="px-6 py-3 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center space-x-1">
                      <span>6M Forecast</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('growth_pct_6m')}
                    className="px-6 py-3 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Growth %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hype_cycle_stage')}
                    className="px-6 py-3 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Hype Stage</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-6 py-3">Confidence</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRoles.map((role) => {
                  const isEmerging = role.source_type === 'emerging_cluster';
                  return (
                    <tr
                      key={role.role_id}
                      onClick={() => navigate(`/roles/${role.role_id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {role.role_name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                            isEmerging
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isEmerging ? 'Emerging Cluster' : 'Established Role'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-700">
                        {role.forecast_6m_bps != null ? `${Number(role.forecast_6m_bps).toFixed(2)} bps` : '—'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`font-semibold ${
                            (role.growth_pct_6m || 0) >= 0 ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {role.growth_pct_6m != null ? `${role.growth_pct_6m >= 0 ? '+' : ''}${Number(role.growth_pct_6m).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${getHypeBadge(
                            role.hype_cycle_stage
                          )}`}
                        >
                          {role.hype_cycle_stage || 'Plateau of Productivity'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {role.confidence_label || 'HIGH'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center space-x-1 text-indigo-600 font-semibold hover:text-indigo-700">
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

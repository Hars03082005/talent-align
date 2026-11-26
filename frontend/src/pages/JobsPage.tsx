// frontend/src/pages/JobsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, MapPin, Clock, RefreshCw, Bookmark, BookmarkCheck,
  ExternalLink, ChevronDown, Search, Wifi, WifiOff, CheckCircle2,
  AlertCircle, TrendingUp, Building2, Filter
} from 'lucide-react';
import { api } from '../api/client';
import { useUser } from '../store/userContext';

// ─── Types ──────────────────────────────────────────────────────────────────
interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  work_mode: string;
  experience_level: string;
  source_url: string;
  posted_at: string;
  required_skills: string[];
  preferred_skills: string[];
  match_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  canonical_role_id?: string;
}

interface CollectionRun {
  id: string;
  source: string;
  jobs_fetched: number;
  jobs_inserted: number;
  status: string;
  run_at: string;
}

type TabKey = 'discover' | 'saved';
type WorkMode = 'Any' | 'Remote' | 'Hybrid' | 'On-site';
type ExperienceFilter = 'Any' | 'Fresher 0-1 yr' | '1-3 yrs' | '3+ yrs';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const scoreColor = (score: number) => {
  if (score >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 40) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
};

const workModeBadge: Record<string, string> = {
  Remote: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Hybrid: 'bg-violet-50 text-violet-700 border-violet-200',
  'On-site': 'bg-slate-100 text-slate-600 border-slate-200',
};

const relativeDate = (iso: string) => {
  if (!iso) return 'Recently';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// ─── JobCard ─────────────────────────────────────────────────────────────────
const JobCard: React.FC<{
  job: JobListing;
  saved: boolean;
  onSave: (jobId: string, status: string) => void;
  saving: boolean;
}> = ({ job, saved, onSave, saving }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const score = Math.round((job.match_score ?? 0) * 100);
  const matchedSkills = job.matched_skills ?? [];
  const missingSkills = (job.missing_skills ?? []).slice(0, 5);
  const wm = job.work_mode ?? 'On-site';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${workModeBadge[wm] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {wm}
            </span>
            {score > 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${scoreColor(score)}`}>
                <TrendingUp className="w-3 h-3" />
                {score}% Match
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900 truncate">{job.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {job.location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {relativeDate(job.posted_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="mb-4 space-y-2">
        {matchedSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {matchedSkills.slice(0, 6).map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" /> {s}
              </span>
            ))}
          </div>
        )}
        {missingSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {missingSkills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                <AlertCircle className="w-3 h-3" /> {s}
              </span>
            ))}
          </div>
        )}
        {matchedSkills.length === 0 && missingSkills.length === 0 && job.required_skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.required_skills.slice(0, 5).map((s) => (
              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        {/* Save/Track dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${saved
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save / Track'}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 text-sm">
              {(['saved', 'applied', 'shortlisted', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { onSave(job.id, s); setDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 capitalize"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Apply externally */}
        {job.source_url && (
          <a
            href={job.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Apply on Company Site
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};

// ─── JobsPage ─────────────────────────────────────────────────────────────────
export const JobsPage: React.FC = () => {
  const { userId, toggleSaveJob, savedJobIds } = useUser();
  const [activeTab, setActiveTab] = useState<TabKey>('discover');

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>('Any');
  const [workModeFilter, setWorkModeFilter] = useState<WorkMode>('Any');

  // Data
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load roles catalog for filter dropdown
  useEffect(() => {
    api.getRoleCatalog().then((catalog) => {
      setRoles(catalog.map((r) => ({ id: r.role_id ?? '', name: r.role_name ?? '' })));
    }).catch(() => {});
  }, []);

  // Load collection runs
  useEffect(() => {
    api.getJobCollectionRuns().then(setRuns).catch(() => {});
  }, []);

  // Search jobs
  const searchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.searchJobs({
        role_id: roleFilter !== 'all' ? roleFilter : undefined,
        location: locationFilter || undefined,
        experience: experienceFilter !== 'Any' ? experienceFilter : undefined,
        work_mode: workModeFilter !== 'Any' ? workModeFilter : undefined,
        user_id: userId,
        limit: 50,
      });
      setJobs(result.jobs ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, locationFilter, experienceFilter, workModeFilter, userId]);

  // Load saved jobs
  const loadSavedJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await api.getSavedJobs(userId);
      setSavedJobs(result);
    } catch {
      setSavedJobs([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'discover') searchJobs();
    else loadSavedJobs();
  }, [activeTab, searchJobs, loadSavedJobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshJobs();
      await Promise.all([searchJobs(), api.getJobCollectionRuns().then(setRuns)]);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveJob = async (jobId: string, status: string) => {
    setSavingJobId(jobId);
    try {
      await api.saveJobApplication(userId, jobId, status);
      await toggleSaveJob(jobId);
      if (activeTab === 'saved') await loadSavedJobs();
    } catch {
      // ignore
    } finally {
      setSavingJobId(null);
    }
  };

  const lastRun = runs[0];
  const workModes: WorkMode[] = ['Any', 'Remote', 'Hybrid', 'On-site'];
  const experiences: ExperienceFilter[] = ['Any', 'Fresher 0-1 yr', '1-3 yrs', '3+ yrs'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Intelligence</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {total > 0 ? `${total} roles matched` : 'Real-time job market data matched to your profile'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {lastRun.status === 'success' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              )}
              Synced {relativeDate(lastRun.run_at)}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing…' : 'Refresh Jobs'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {(['discover', 'saved'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab === 'discover' ? (
              <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Discover Jobs</span>
            ) : (
              <span className="flex items-center gap-2"><BookmarkCheck className="w-4 h-4" /> Saved & Applied</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters (only on discover tab) */}
      {activeTab === 'discover' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4" /> Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Role Filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Bangalore, Remote…"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Experience Filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Experience</label>
              <select
                value={experienceFilter}
                onChange={(e) => setExperienceFilter(e.target.value as ExperienceFilter)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {experiences.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Work Mode Pills */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Work Mode</label>
              <div className="flex gap-1.5 flex-wrap">
                {workModes.map((m) => (
                  <button
                    key={m}
                    onClick={() => setWorkModeFilter(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${workModeFilter === m
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              onClick={searchJobs}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Search className="w-4 h-4" /> Search Jobs
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : activeTab === 'discover' ? (
        jobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No jobs found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting filters or click "Refresh Jobs"</p>
            <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Refresh Jobs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                saved={savedJobIds.has(job.id)}
                onSave={handleSaveJob}
                saving={savingJobId === job.id}
              />
            ))}
          </div>
        )
      ) : (
        // Saved tab
        savedJobs.length === 0 ? (
          <div className="text-center py-16">
            <BookmarkCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No saved jobs yet</p>
            <p className="text-slate-400 text-sm mt-1">Save jobs from the Discover tab to track your applications</p>
            <button onClick={() => setActiveTab('discover')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {savedJobs.map((item: any) => {
              const job = item.job ?? item;
              const appStatus = item.status;
              const statusColors: Record<string, string> = {
                saved: 'bg-slate-100 text-slate-600',
                applied: 'bg-indigo-100 text-indigo-700',
                shortlisted: 'bg-emerald-100 text-emerald-700',
                rejected: 'bg-rose-100 text-rose-700',
              };
              return (
                <div key={item.id ?? job.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">{job.title}</h3>
                      {appStatus && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[appStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                          {appStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{job.company} · {job.location}</p>
                  </div>
                  {job.source_url && (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors whitespace-nowrap"
                    >
                      View <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Collection Runs Footer */}
      {runs.length > 0 && (
        <div className="mt-8 border-t border-slate-100 pt-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Recent Data Sync Runs</p>
          <div className="flex flex-wrap gap-2">
            {runs.slice(0, 5).map((run) => (
              <div key={run.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
                <span className={`w-1.5 h-1.5 rounded-full ${run.status === 'success' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {run.source} · +{run.jobs_inserted} · {relativeDate(run.run_at)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsPage;

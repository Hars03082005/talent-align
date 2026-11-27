import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, Bookmark, BriefcaseBusiness, BarChart3, Brain, ChevronRight, CircleUserRound, Compass, Crosshair, ListChecks, Map, Menu, Target, X } from 'lucide-react';
import snapshot from './jobs.snapshot.json';
import { Jobs } from './Jobs';
import { PlanPage, ProfilePage, RolePage, RoleMatchesPage, RolesPage, SavedPage } from './Pages';
import { CareerRoadmap } from './CareerRoadmap';
import { AssessmentPage } from './AssessmentPage';
import { applyAssessment, previousAssessment } from './assessmentResult';
import { blankCandidate } from './profile';
import { useSavedAssessment } from './useSavedAssessment';
import type { Candidate, Feed, Job, Tracked, TrackerStatus } from './model';

function readState<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem('talentalign.workspace.' + key) ?? 'null') as T ?? fallback; }
  catch { return fallback; }
}

function useStored<T>(key: string, fallback: T) {
  const [value, set] = useState(() => readState(key, fallback));
  useEffect(() => {
    try { localStorage.setItem('talentalign.workspace.' + key, JSON.stringify(value)); } catch { /* Browser storage may be unavailable. */ }
  }, [key, value]);
  return [value, set] as const;
}

const navigation = [
  { path: '/jobs', title: 'Job explorer', icon: BriefcaseBusiness },
  { path: '/profile', title: 'Resume & profile', icon: CircleUserRound },
  { path: '/assessment', title: 'Archetype assessment', icon: Brain },
  { path: '/matches', title: 'Role matches', icon: Target },
  { path: '/roadmap', title: 'Career roadmap', icon: Map },
  { path: '/roles', title: 'Career roles', icon: BarChart3 },
  { path: '/plan', title: 'Job action plan', icon: ListChecks },
  { path: '/saved', title: 'Saved jobs', icon: Bookmark },
];

const builtForSites = import.meta.env.MODE === 'site';

function Shell() {
  const location = useLocation();
  const [candidate, setProfile] = useStored<Candidate | null>('profile', null);
  const assessment = useSavedAssessment(previousAssessment(candidate));
  const profile = assessment.result ? applyAssessment(candidate ?? blankCandidate, assessment.result) : candidate;
  const [saved, setSaved] = useStored<Tracked[]>('saved', []);
  const [progress, setProgress] = useStored<string[]>('progress', []);
  const [planPath, rememberPlan] = useStored('plan', '/plan');
  const [feed, setFeed] = useState<Feed>(snapshot as Feed);
  const [loading, setLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const title = navigation.find(item => location.pathname.startsWith(item.path))?.title ?? 'Job explorer';

  const load = useCallback(async (force = false, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/workspace/jobs' + (force ? '?refresh=1' : ''), { signal });
      if (!response.ok) throw new Error('Employer feed unavailable');
      const result = await response.json() as Feed;
      if (!Array.isArray(result.jobs)) throw new Error('Invalid employer feed');
      if (result.jobs.length) setFeed(result);
    } catch {
      if (!signal?.aborted) setFeed(previous => ({ ...previous, status: 'snapshot' }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenu(false);
    if (location.pathname === '/plan' && location.search) rememberPlan(location.pathname + location.search);
  }, [location.pathname, location.search, rememberPlan]);

  function toggleSave(job: Job) {
    setSaved(items => items.some(item => item.job.id === job.id) ? items.filter(item => item.job.id !== job.id) : [...items, { job, status: 'Saved' }]);
  }

  function updateStatus(id: string, status: TrackerStatus) {
    setSaved(items => items.map(item => item.job.id === id ? { ...item, status } : item));
  }

  function toggleProgress(key: string) {
    setProgress(items => items.includes(key) ? items.filter(value => value !== key) : [...items, key]);
  }

  return <div className="workspace">
    <a href="#workspace-content" className="skip">Skip to content</a>
    {mobileMenu && <button type="button" className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
    <aside className={'workspace-sidebar ' + (mobileMenu ? 'open' : '')}>
      <Link className="brand" to="/jobs"><span className="brand-symbol"><Crosshair size={24} strokeWidth={2.25} /></span><span><strong>Talent<span>Align</span></strong><small>Career intelligence</small></span></Link>
      <button className="bare-icon sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={22}/></button>
      <nav aria-label="Workspace navigation"><p>WORKSPACE</p>
        {navigation.map(({ path, title: label, icon: Icon }) => <NavLink key={path} to={path === '/plan' ? planPath : path} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={20} strokeWidth={1.8}/><span>{label}</span>{path === '/saved' && saved.length > 0 && <small>{saved.length}</small>}</NavLink>)}
      </nav>
      <div className="sidebar-foot">
        {!builtForSites && <a href="/legacy/matches" className="sidebar-legacy">Open full Python workspace <ArrowUpRight size={14}/></a>}
        <div className="sidebar-project"><Compass size={17}/><span>Proactive Talent Alignment for Sustainable Employment</span></div>
        <Link className="sidebar-profile" to="/profile"><span className="avatar">{profile?.name ? profile.name.charAt(0).toUpperCase() : <CircleUserRound size={21}/>}</span><span><strong>{profile?.name || 'Candidate profile'}</strong><small>{profile ? profile.skills.length + ' skills added' : 'Add your skills'}</small></span><ChevronRight size={16}/></Link>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumbs"><button type="button" aria-label="Open navigation" aria-expanded={mobileMenu} className="icon-button mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={15}/><strong>{title}</strong></div><div className="top-actions"><Link className="button outline top-profile" to="/profile"><CircleUserRound size={17}/>{profile ? 'Edit profile' : 'Set up profile'}</Link></div></header>
      <main id="workspace-content" className="workspace-content">
        <Routes>
          <Route path="/jobs" element={<Jobs feed={feed} candidate={profile?.skills.length ? profile : null} tracked={saved} toggleSave={toggleSave} loading={loading} refresh={() => void load(true)} />} />
          <Route path="/profile" element={<ProfilePage candidate={candidate} hasAssessment={Boolean(assessment.result)} save={setProfile} />} />
          <Route path="/assessment" element={<AssessmentPage {...assessment} />} />
          <Route path="/matches" element={<RoleMatchesPage candidate={profile} />} />
          <Route path="/roadmap" element={<CareerRoadmap candidate={profile} progress={progress} toggle={toggleProgress} />} />
          <Route path="/roles" element={<RolesPage candidate={profile} />} />
          <Route path="/roles/:id" element={<RolePage candidate={profile} />} />
          <Route path="/plan" element={new URLSearchParams(location.search).has("role") ? <Navigate replace to={"/roadmap" + location.search}/> : <PlanPage feed={feed} candidate={profile} tracked={saved} progress={progress} toggle={toggleProgress} />} />
          <Route path="/saved" element={<SavedPage tracked={saved} current={Object.fromEntries(feed.jobs.map(job => [job.id, job]))} onStatus={updateStatus} remove={id => setSaved(items => items.filter(item => item.job.id !== id))} />} />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </main>
    </div>
  </div>;
}

export function Workspace() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}

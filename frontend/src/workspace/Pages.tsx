import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, ChevronRight, Compass, ExternalLink, ListChecks, MapPin, Search, SlidersHorizontal, Target, Trash2, TrendingUp } from 'lucide-react';
import catalog from './catalog.generated.json';
import { MaturityStages, maturityStages } from './Maturity';
export { ProfilePage } from './ProfilePage';
import { jobFit, normalize, rankRoles, skillGap } from './engine';
import { practiceFor } from './actions';
import { CompanyMark, SkillTags } from './Jobs';
import type { Candidate, Feed, Role, Tracked, TrackerStatus } from './model';

const roles = catalog.roles as unknown as Role[];
const rolePolicy = catalog.policy as unknown as Parameters<typeof rankRoles>[2];
function roleFamily(role: Role) {
  return role.role_family ?? role.role_category ?? 'Emerging role cluster';
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-heading"><h1>{title}</h1><p>{subtitle}</p></div>;
}

function Empty({ title, body, path, action }: { title: string; body: string; path: string; action: string }) {
  return <div className="panel empty"><Compass size={28}/><h3>{title}</h3><p>{body}</p><Link className="button primary" to={path}>{action}</Link></div>;
}

export function RolesPage({ candidate }: { candidate: Candidate | null }) {
  const [query, search] = useState('');
  const [type, filter] = useState('All roles');
  const [maturity, filterMaturity] = useState('All maturity stages');
  const [limit, show] = useState(12);
  const ranked = useMemo(() => candidate ? rankRoles(roles, candidate, rolePolicy) : roles.map(role => ({ ...role, score: 0, overlap: 0 })), [candidate]);
  const results = ranked.filter(role => (type === 'All roles' || (type === 'Established roles') === (role.source_type === 'known_role')) &&
    (maturity === 'All maturity stages' || role.hype_cycle_stage === maturity) &&
    (role.role_name + ' ' + roleFamily(role)).toLowerCase().includes(normalize(query)));
  return <>
    <Heading title="Career roles" subtitle="Explore the project’s 39 known roles and 21 emerging clusters. Role forecasts use the research dataset and sit alongside the current employer listings." />
    {candidate && !candidate.assessment && <div className="panel info-panel"><Target size={20}/><p>Your ranking uses declared interests and skills. Add your work-style signal with the 20-question assessment.</p><Link className="button outline" to="/assessment">Take assessment</Link></div>}
    <div className="filters panel role-filters"><label className="search-control"><Search size={20}/><span className="sr-only">Search career roles</span><input placeholder="Search career roles" value={query} onChange={event => { search(event.target.value); show(12); }}/></label><label className="select-wrap"><span className="sr-only">Role type</span><select value={type} onChange={event => { filter(event.target.value); show(12); }}>{['All roles', 'Established roles', 'Emerging clusters'].map(value => <option key={value}>{value}</option>)}</select></label><label className="select-wrap"><span className="sr-only">Technology maturity</span><select value={maturity} onChange={event => { filterMaturity(event.target.value); show(12); }}>{['All maturity stages', ...maturityStages].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <p className="role-count">{results.length} {results.length === 1 ? 'role' : 'roles'}{candidate && ' · ranked for your profile'}</p>
    <div className="role-grid">{results.slice(0, limit).map(role => <Link className="panel role-card" key={role.role_id} to={'/roles/' + role.role_id}><div className="role-card-top"><span className="feature-icon"><TrendingUp size={20}/></span><span className="tag">{role.source_type === 'known_role' ? 'Known role' : 'Emerging cluster'}</span></div><h2>{role.role_name}</h2><p>{roleFamily(role)}</p><p className="maturity-caption">{role.hype_cycle_stage}</p><SkillTags list={[...new Set((role.required_skills ?? []).slice(0, 3))]}/><div className="role-card-foot"><span>{candidate ? Math.round(role.score * 100) + '% role alignment' : 'View role evidence'}</span><ChevronRight size={18}/></div></Link>)}</div>
    {results.length === 0 && <Empty title="No matching roles" body="Search for a broader term or choose All roles." path="/jobs" action="Browse open jobs" />}
    {results.length > limit && <button type="button" className="button outline more-button" onClick={() => show(limit + 12)}>Show more roles</button>}
  </>;
}

const factorNames: Record<string, string> = {
  baio_fit: 'Archetype fit',
  interest_alignment: 'Interest alignment',
  work_style_alignment: 'Work-style preferences',
  skill_alignment: 'Skill alignment',
  future_opportunity: 'Forecasted opportunity',
  emergence_signal: 'Emergence signal',
};

export function RoleMatchesPage({ candidate }: { candidate: Candidate | null }) {
  if (!candidate) return <>
    <Heading title="Role matches" subtitle="Find roles that align with your skills, interests, and BAIO work preferences." />
    <Empty title="Add a profile to see your matches" body="Import skills from your resume or take the archetype assessment to get started." path="/profile" action="Open resume & profile" />
  </>;
  const ranked = rankRoles(roles.filter(role => role.required_skills?.length), candidate, rolePolicy)
    .filter(role => role.personalFit >= rolePolicy.recommendation.min_personal_fit_threshold)
    .slice(0, rolePolicy.recommendation.top_n);
  return <>
    <Heading title="Role matches" subtitle="Your top five roles with usable skill evidence, ranked using your profile and labor-market data." />
    {(!candidate.assessment || !candidate.skills.length) && <div className="panel info-panel"><Target size={20}/><p>{!candidate.assessment ? 'Add your BAIO results to personalize the archetype component.' : 'Add your resume skills so the ranking can account for your current readiness.'}</p><Link className="button outline" to={!candidate.assessment ? '/assessment' : '/profile'}>{!candidate.assessment ? 'Take the assessment' : 'Add resume skills'}</Link></div>}
    <div className="matches-list">{ranked.map(role => {
      const gap = skillGap(role.required_skills ?? [], candidate.skills);
      return <article className="panel match-card" key={role.role_id}>
        <div className="match-head"><span className="feature-icon"><TrendingUp size={23}/></span><div><h2><Link to={'/roles/' + role.role_id}>{role.role_name}</Link></h2><p>{roleFamily(role)}</p></div><span className="match-tag">{Math.round(role.score * 100)}% alignment</span></div>
        <dl className="match-metrics">
          <div><dt>Personal fit</dt><dd>{Math.round(role.personalFit * 100)}%</dd></div>
          <div><dt>Market potential</dt><dd>{Math.round(role.futurePotential * 100)}%</dd></div>
          <div><dt>Current readiness</dt><dd>{Math.round(role.readiness * 100)}%</dd></div>
        </dl>
        <div className="match-evidence"><div><strong>{gap.matched.length} matched skills</strong>{gap.matched.length > 0 && <SkillTags list={gap.matched.slice(0, 5)} variant="success"/>}</div><div><strong>{role.hype_cycle_stage}</strong><p>{role.career_risk_profile}</p></div></div>
        <div className="form-actions"><Link className="button primary" to={'/roadmap?role=' + role.role_id}>Generate roadmap</Link><Link className="button outline" to={'/roles/' + role.role_id}>View score and evidence</Link></div>
      </article>;
    })}</div>
  </>;
}

export function RolePage({ candidate }: { candidate: Candidate | null }) {
  const { id } = useParams();
  const role = roles.find(item => item.role_id === id);
  if (!role) return <Empty title="Role unavailable" body="Choose a role from the research catalog." path="/roles" action="Explore roles" />;
  const gap = skillGap(role.required_skills ?? [], candidate?.skills ?? []);
  const match = candidate ? rankRoles([role], candidate, rolePolicy)[0] : null;
  const known = role.source_type === 'known_role';
  const values = known ? [
    ['Observed baseline', role.current_demand_bps],
    ['6-month forecast', role.forecast_6m_bps],
    ['12-month forecast', role.forecast_12m_bps],
  ] as const : [['Next-quarter forecast', role.forecast_next_quarter_postings], ['Forecast growth', role.forecast_growth_pct_cluster]] as const;
  return <>
    <Link className="breadcrumb-back" to="/roles">Career roles <ChevronRight size={16}/></Link>
    <Heading title={role.role_name} subtitle={roleFamily(role)} />
    <div className="evidence-grid">
      <section className="panel page-card"><div className="card-title"><TrendingUp size={21}/><h2>Research forecast</h2></div><p>{known ? 'LightGBM demand-share model' : 'Semantic job-title cluster and Holt-Damped forecast'}. Data window {known ? catalog.referencePeriod : 'Q4 2022 – Q3 2025'}.</p>
        <div className="evidence-numbers">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}{typeof value === 'number' && <small>{known ? ' bps' : label === 'Forecast growth' ? '%' : ' postings'}</small>}</strong></div>)}</div>
        {role.shap_top_drivers?.length > 0 && <><h3>Model drivers</h3><ul className="qualifications">{role.shap_top_drivers.map(driver => <li key={driver}>{driver}</li>)}</ul></>}
        {typeof role.evidence === 'string' && role.evidence && <p className="source-note">Evidence · {role.evidence}</p>}
      </section>
      <section className="panel page-card"><div className="card-title"><SlidersHorizontal size={21}/><h2>Gartner Hype Cycle</h2></div><p>The project maps a role’s technologies to a maturity stage and career risk.</p><MaturityStages stage={role.hype_cycle_stage}/><dl className="maturity"><div><dt>Stage</dt><dd>{role.hype_cycle_stage}</dd></div><div><dt>Estimated time to plateau</dt><dd>{role.years_to_plateau}</dd></div><div><dt>Career risk</dt><dd>{role.career_risk_profile}</dd></div></dl>{role.maturity_rationale && <p>{role.maturity_rationale}</p>}<a className="text-link" href="https://www.gartner.com/en/research/methodologies/gartner-hype-cycle" target="_blank" rel="noreferrer">Gartner’s methodology</a></section>
      {match && <section className="panel page-card"><div className="card-title"><Target size={21}/><h2>Role alignment · {Math.round(match.score * 100)}%</h2></div><p>Weighted inputs used by the role matcher.</p><div className="factors role-factors">{Object.entries(rolePolicy.weights).map(([key, weight]) => {
        const points = match.components[key] * weight * 100;
        return <div key={key}><span>{factorNames[key]}</span><meter min={0} max={weight * 100} value={points}/><strong>{points.toFixed(1)}/{Math.round(weight * 100)}</strong></div>;
      })}</div>{!candidate?.assessment && <Link className="text-link" to="/assessment">Take the assessment to personalize archetype fit</Link>}</section>}
      <section className="panel page-card"><div className="card-title"><Target size={21}/><h2>Role skill gap</h2></div>
        {!gap.matched.length && !gap.missing.length && <p>Skill evidence is unavailable for this role.</p>}
        {candidate && gap.matched.length > 0 && <div className="detail-section"><h3>Skills you have</h3><SkillTags list={gap.matched} variant="success"/></div>}
        {gap.missing.length > 0 && <div className="detail-section"><h3>{candidate ? 'Skills to build' : 'Skills in the catalog'}</h3><SkillTags list={gap.missing} variant={candidate ? 'gap' : ''}/></div>}
        <div className="form-actions"><Link className="button primary" to={'/roadmap?role=' + role.role_id}>Generate career roadmap</Link></div>
      </section>
    </div>
  </>;
}

export function PlanPage({ feed, candidate, tracked, progress, toggle }: { feed: Feed; candidate: Candidate | null; tracked: Tracked[]; progress: string[]; toggle: (key: string) => void }) {
  const [params] = useSearchParams();
  const job = [...feed.jobs, ...tracked.map(item => item.job)].find(item => item.id === params.get('job'));
  const role = roles.find(item => item.role_id === params.get('role'));
  if (!candidate) return <Empty title="Set up your profile" body="Add your current skills so the plan can focus on gaps supported by a listing or the role catalog." path="/profile" action="Create profile" />;
  if (!job && !role) return <><Heading title="Action plan" subtitle="Turn missing skills into portfolio-ready evidence." /><Empty title="Choose a target" body="Open a job or career role and select Build action plan to start a checklist." path="/jobs" action="Explore jobs" /></>;
  const title = job?.title ?? role!.role_name;
  const id = job?.id ?? role!.role_id;
  const gap = skillGap(job?.skills ?? role?.required_skills ?? [], candidate.skills);
  const steps = gap.missing.slice(0, 5);
  const done = steps.filter(skill => progress.includes(id + ':' + normalize(skill))).length;
  const initialFit = job?.skills.length ? jobFit(job, candidate).score : null;
  return <>
    <Heading title="Action plan" subtitle={title + (job ? ' · ' + job.company : ' · Role catalog')} />
    <section className="panel plan-summary"><span className="feature-icon"><ListChecks size={23}/></span><div><h2>Build evidence for your target</h2><p>{job ? 'Priorities come from the requirements extracted from this employer’s posting.' : 'Priorities come from skill evidence in the project’s role catalog.'} {gap.missing.length > steps.length && 'Showing the first ' + steps.length + ' skills from the evidence.'}</p></div>{steps.length > 0 && <span className="tag success">{done} / {steps.length} complete</span>}</section>
    {steps.length > 0 ? <div className="plan-list">{steps.map(skill => {
      const practice = practiceFor(skill);
      const key = id + ':' + normalize(skill);
      const selected = progress.includes(key);
      const projected = initialFit !== null && job ? Math.round(jobFit(job, { ...candidate, skills: [...candidate.skills, skill] }).score) - Math.round(initialFit) : 0;
      return <article className={'panel plan-item ' + (selected ? 'done' : '')} key={key}><label className="check-control"><input type="checkbox" checked={selected} onChange={() => toggle(key)} aria-label={'Mark ' + skill + ' complete'}/><Check size={15}/></label><div><h3>{skill}</h3><p>{practice.task}</p><p className="proof"><strong>Portfolio evidence</strong> {practice.proof}</p>{practice.url && <a className="text-link" target="_blank" rel="noreferrer" href={practice.url}><BookOpen size={15}/>{practice.label}<ExternalLink size={13}/></a>}</div>{projected > 0 && <span className="tag fit-impact" title="Projected increase if this skill were added to your profile">+{projected} fit points</span>}</article>;
    })}</div> : <section className="panel page-card"><h2>{gap.matched.length ? 'Extracted skills covered' : 'Skill evidence unavailable'}</h2><p>{gap.matched.length ? 'Review the original qualifications and prepare examples from your projects.' : 'Choose another listing or role with explicit technical requirements.'}</p></section>}
    {job && <a className="button outline more-button" href={job.url} target="_blank" rel="noreferrer">Review employer requirements <ExternalLink size={15}/></a>}
  </>;
}

export function SavedPage({ tracked, current, onStatus, remove }: { tracked: Tracked[]; current: JobFeedMap; onStatus: (id: string, status: TrackerStatus) => void; remove: (id: string) => void }) {
  return <>
    <Heading title="Saved jobs" subtitle="Track the openings you want to revisit and record where you are in the application process." />
    {!tracked.length ? <Empty title="Your shortlist is empty" body="Bookmark a job in the explorer to start tracking it." path="/jobs" action="Explore jobs" /> : <div className="plan-list">{tracked.map(item => {
      const job = current[item.job.id] ?? item.job;
      return <article className="panel saved-row" key={job.id}><CompanyMark company={job.company}/><div><h2>{job.title}</h2><p>{job.company} <span>·</span> <MapPin size={14}/> {job.location}</p></div><label className="select-wrap"><span className="sr-only">Application status for {job.title}</span><select value={item.status} onChange={event => onStatus(job.id, event.target.value as TrackerStatus)}>{['Saved', 'Applied', 'Interview'].map(value => <option key={value}>{value}</option>)}</select></label><a className="icon-button" href={job.url} target="_blank" rel="noreferrer" title="Open employer listing" aria-label={'Open ' + job.title}><ExternalLink size={17}/></a><button className="icon-button" onClick={() => remove(job.id)} title="Remove saved job" aria-label={'Remove ' + job.title}><Trash2 size={17}/></button></article>;
    })}</div>}
  </>;
}

type JobFeedMap = Record<string, Feed['jobs'][number]>;

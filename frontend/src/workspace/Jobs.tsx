import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, ExternalLink, Filter, Globe2, ListFilter, MapPin, Search, Target, X } from 'lucide-react';
import type { Candidate, Feed, Job, Tracked } from './model';
import { jobFit } from './engine';

export const formatDate = (value: string | null, time = false) => {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}), timeZone: 'Asia/Kolkata' }).format(new Date(value));
};
export const inIndia = (location: string) => /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|gurugram|gurgaon|chennai|noida|new delhi|kolkata|ahmedabad)\b/i.test(location);
const brandColors: Record<string, string> = { Databricks: 'red', GitLab: 'violet', MongoDB: 'green', Rubrik: 'blue', Okta: 'blue', Twilio: 'red', Stripe: 'violet', Coinbase: 'blue' };

export function CompanyMark({ company }: { company: string }) {
  return <span className={'company-mark ' + (brandColors[company] ?? 'blue')} aria-hidden="true">{company.charAt(0).toUpperCase()}</span>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="select-wrap"><span className="sr-only">{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label>;
}

export function SkillTags({ list, variant = '', marker = false }: { list: string[]; variant?: string; marker?: boolean }) {
  return <div className="tags">{list.map(item => <span key={item} className={'tag ' + variant}>{marker && (variant === 'success' ? <Check size={13} /> : <span aria-hidden="true" className="tag-dot" />)}{item}</span>)}</div>;
}

export function JobDetail({ job, candidate, saved, toggle }: { job: Job; candidate: Candidate | null; saved: boolean; toggle: () => void }) {
  const evidence = job.skills.length > 0;
  const fit = candidate && evidence ? jobFit(job, candidate) : null;
  const eligibleLevel = candidate && job.level !== 'Unspecified' && job.level !== candidate.level;
  const date = job.published || job.updated;
  return <article className="panel job-detail" aria-label="Selected job">
    <div className="detail-heading">
      <div className="detail-overline"><CompanyMark company={job.company} /><div><strong>{job.company}</strong><span>Employer career board</span></div><button className={'icon-button bookmark ' + (saved ? 'selected' : '')} aria-pressed={saved} aria-label={saved ? 'Remove saved job' : 'Save job'} onClick={toggle}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button></div>
      <h3>{job.title}</h3>
      <div className="detail-meta"><span><MapPin size={15} />{job.location}</span>{job.mode !== 'Unspecified' && <span><Globe2 size={15} />{job.mode}</span>}</div>
      <div className="detail-meta">{job.level !== 'Unspecified' && <span><BriefcaseBusiness size={15} />{job.level}</span>}{date && <span><CalendarDays size={15} />{job.published ? 'Posted ' : 'Updated '}{formatDate(date)}</span>}</div>
    </div>
    <div className="detail-body">
      {job.summary && <p className="job-summary">{job.summary}</p>}
      <section className="fit-box" aria-label="Job fit">
        {fit ? <>
          <div className="fit-top"><div className="score-ring" style={{ '--score': fit.score + '%' } as React.CSSProperties}><strong>{Math.round(fit.score)}<small>%</small></strong></div><div><h4>Your job fit</h4><p>{fit.required.matched.length} of {job.skills.length} extracted required skills match.</p></div></div>
          <details className="breakdown"><summary><CircleHelp size={15} /> How this score is calculated <ChevronDown size={15} /></summary>
            <div className="factors">{fit.factors.map(factor => <div key={factor.label}><span>{factor.label}</span><meter min={0} max={factor.max} value={factor.points}>{factor.points}</meter><strong>{factor.points}/{factor.max}</strong></div>)}</div>
            <p>The score uses your declared skills, target role, experience level and work preference. Confirm location eligibility and qualifications in the full listing.</p>
          </details>
        </> : <>
          <div className="fit-top"><span className="feature-icon"><Target size={22} /></span><div><h4>{evidence ? 'See your fit' : 'Limited skill evidence'}</h4><p>{evidence ? job.skills.length + ' required skills found in this posting.' : 'No required technical skills could be reliably extracted.'}</p></div></div>
          {!candidate && <Link to="/profile" className="text-link">Set up your profile <ChevronRight size={15} /></Link>}
        </>}
      </section>
      {fit ? <>
        {fit.required.matched.length > 0 && <section className="detail-section"><h4><span className="section-dot green-dot" />Matching required skills</h4><SkillTags list={fit.required.matched} variant="success" marker /></section>}
        <section className="detail-section"><h4><span className="section-dot amber-dot" />{fit.required.missing.length ? 'Skills to build' : 'Required skills covered'}</h4>{fit.required.missing.length ? <SkillTags list={fit.required.missing} variant="gap" marker /> : <p>Your profile covers the required skills extracted from this listing.</p>}</section>
      </> : evidence && <section className="detail-section"><h4>Required skills in the posting</h4><SkillTags list={job.skills} /></section>}
      {job.preferred.length > 0 && <section className="detail-section"><h4>Preferred skills</h4><SkillTags list={job.preferred} /></section>}
      {(job.qualifications.length > 0 || eligibleLevel) && <section className="detail-section"><h4>Qualifications to check</h4>
        {eligibleLevel && <p>Your profile says {candidate.level.toLowerCase()}. The job title suggests {job.level.toLowerCase()}.</p>}
        {job.qualifications.length > 0 && <ul className="qualifications">{job.qualifications.map(item => <li key={item}>{item}</li>)}</ul>}
      </section>}
      <div className="detail-actions">
        <a href={job.url} target="_blank" rel="noreferrer" className="button primary">Open employer listing <ExternalLink size={16} /></a>
        {fit?.required.missing.length ? <Link className="button outline" to={'/plan?job=' + encodeURIComponent(job.id)}>Build action plan</Link> : null}
      </div>
    </div>
  </article>;
}

export function Jobs({ feed, candidate, tracked, toggleSave, loading, refresh }: { feed: Feed; candidate: Candidate | null; tracked: Tracked[]; toggleSave: (job: Job) => void; loading: boolean; refresh: () => void }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('India');
  const [mode, setMode] = useState('All work modes');
  const [level, setLevel] = useState('All levels');
  const [sort, setSort] = useState('Recommended');
  const [limit, setLimit] = useState(8);
  const [selected, setSelected] = useState('');
  const detail = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return feed.jobs.filter(job => (
      (region !== 'India' || inIndia(job.location)) &&
      (mode === 'All work modes' || job.mode === mode) &&
      (level === 'All levels' || job.level === level) &&
      terms.every(term => [job.title, job.company, job.location, ...job.skills, ...job.preferred].join(' ').toLowerCase().includes(term))
    )).sort((a, b) => {
      if (candidate && sort === 'Recommended') {
        const left = a.skills.length ? jobFit(a, candidate).score : -1;
        const right = b.skills.length ? jobFit(b, candidate).score : -1;
        if (left !== right) return right - left;
      }
      const dateA = a.published || a.updated || '';
      const dateB = b.published || b.updated || '';
      const date = dateB.localeCompare(dateA);
      if (sort === 'Newest' || sort === 'Recommended') return date;
      return a.company.localeCompare(b.company) || date;
    });
  }, [feed.jobs, candidate, query, region, mode, level, sort]);
  const job = results.find(item => item.id === selected) ?? results[0];
  const filters = region !== 'India' || mode !== 'All work modes' || level !== 'All levels' || query !== '';
  const recentCount = feed.jobs.filter(item => item.updated && Date.now() - Date.parse(item.updated) < 7 * 86400000).length;

  function clear() {
    setQuery(''); setRegion('All locations'); setMode('All work modes'); setLevel('All levels'); setLimit(8);
  }

  return <>
    <section className="hero">
      <div className="hero-content">
        <div className="hero-status"><span />{feed.status === 'live' ? 'Employer feeds connected' : 'Employer-sourced listings'}</div>
        <h1>Explore your next move.</h1>
        <p>Find real openings, see how your skills line up, and know what to work on next.</p>
        <div className="hero-meta"><span><BriefcaseBusiness size={16} /><strong>{feed.jobs.length}</strong> openings</span><span><Building2 size={16} /><strong>{feed.sources.length}</strong> employers</span><span><CalendarDays size={16} /><strong>{recentCount}</strong> updated in the past 7 days</span></div>
      </div>
      <div className="orbit-art" aria-hidden="true"><div className="orbit o1" /><div className="orbit o2" /><div className="orbit o3" /><div className="orbit o4" /><div className="orbit-core"><Target size={52} strokeWidth={1.3} /></div><div className="orbit-node n1"><BriefcaseBusiness size={18}/></div><div className="orbit-node n2"><ListFilter size={17}/></div><div className="orbit-node n3"><Check size={18}/></div><i className="orb-pixel p1" /><i className="orb-pixel p2" /><i className="orb-pixel p3" /></div>
    </section>

    <section className="search-area" aria-label="Filter job listings">
      <div className="section-heading"><div><h2>Open positions</h2><p>{feed.checked ? (feed.status === 'live' ? 'Boards checked ' : 'Snapshot checked ') + formatDate(feed.checked, true) + ' IST' : 'Waiting for employer boards'}{feed.unavailable.length > 0 && ' · ' + feed.unavailable.length + ' boards unavailable'}</p></div>
        <button type="button" className="button subtle refresh-button" onClick={refresh} disabled={loading}>{loading ? 'Checking boards…' : 'Refresh listings'}</button>
      </div>
      <div className="filters panel">
        <label className="search-control"><Search size={20} /><span className="sr-only">Search jobs</span><input value={query} onChange={event => { setQuery(event.target.value); setLimit(8); }} placeholder="Search title, company, or skill" />{query && <button aria-label="Clear job search" className="bare-icon" onClick={() => setQuery('')}><X size={17}/></button>}</label>
        <div className="filter-chips"><Filter size={17} className="filter-icon" />
          <Select label="Location filter" value={region} options={['India', 'All locations']} onChange={value => { setRegion(value); setLimit(8); }} />
          <Select label="Work mode filter" value={mode} options={['All work modes', 'Remote', 'Hybrid', 'On-site', 'Unspecified']} onChange={value => { setMode(value); setLimit(8); }} />
          <Select label="Experience filter" value={level} options={['All levels', 'Entry Level', 'Mid Level', 'Senior Level', 'Lead / Principal', 'Unspecified']} onChange={value => { setLevel(value); setLimit(8); }} />
        </div>
      </div>
    </section>

    {results.length ? <section className="jobs-grid" aria-label="Job explorer results">
      <div>
        <div className="results-bar"><span><strong>{results.length}</strong> {results.length === 1 ? 'result' : 'results'}</span><Select label="Sort job listings" value={sort} options={['Recommended', 'Newest', 'Company']} onChange={setSort} /></div>
        <div className="job-list">
          {results.slice(0, limit).map(item => {
            const score = candidate && item.skills.length ? Math.round(jobFit(item, candidate).score) : null;
            const current = item.id === job?.id;
            return <button type="button" className={'job-card panel ' + (current ? 'active' : '')} aria-pressed={current} key={item.id} onClick={() => {
              setSelected(item.id);
              if (window.matchMedia('(max-width: 850px)').matches) requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start' }));
            }}>
              <div className="job-row"><CompanyMark company={item.company} /><div className="job-row-title"><strong>{item.title}</strong><span>{item.company}</span></div>{score !== null ? <span className="match-tag">{score}% fit</span> : <ChevronRight size={18} className="row-chevron" />}</div>
              <div className="card-meta"><span><MapPin size={14} />{item.location}</span>{item.mode !== 'Unspecified' && <span><Globe2 size={14} />{item.mode}</span>}</div>
              {item.skills.length > 0 && <div className="tags compact">{item.skills.slice(0, 3).map(skill => <span className="tag" key={skill}>{skill}</span>)}{item.skills.length > 3 && <span className="more-tags">+{item.skills.length - 3}</span>}</div>}
            </button>;
          })}
        </div>
        {limit < results.length && <button className="button outline more-button" onClick={() => setLimit(value => value + 8)}>Show more jobs <ChevronDown size={16}/></button>}
      </div>
      <div ref={detail} className="detail-column">{job && <JobDetail key={job.id} job={job} candidate={candidate} saved={tracked.some(saved => saved.job.id === job.id)} toggle={() => toggleSave(job)} />}</div>
    </section> : <div className="panel empty"><Search size={28}/><h3>{loading && !feed.jobs.length ? 'Checking employer boards' : 'No matching jobs'}</h3><p>{feed.jobs.length ? 'Try a broader search or change the location and experience filters.' : 'Employer listings will appear here when data is available.'}</p>{filters || feed.jobs.length > 0 ? <button type="button" onClick={clear} className="button outline">Clear filters</button> : null}</div>}
  </>;
}

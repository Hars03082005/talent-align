import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, ExternalLink, FolderGit2, ListChecks, Map, Target } from 'lucide-react';
import catalog from './catalog.generated.json';
import { practiceFor } from './actions';
import { normalize, skillGap } from './engine';
import type { Candidate, Role } from './model';

const roles = catalog.roles as unknown as Role[];
const projectsByFamily: Record<string, string[]> = catalog.roadmap.projects;

export function buildRoleRoadmap(role: Role, skills: string[]) {
  const required = role.required_skills ?? [];
  const { matched, missing } = skillGap(required, skills);
  const advanced = skillGap(role.frontier_skills ?? [], [...skills, ...required]).missing.slice(0, 8);
  const stageDefs = catalog.roadmap.stages;
  const skillsByStage = stageDefs.map(() => [] as { name: string; optional: boolean }[]);
  for (const skill of missing) {
    const found = stageDefs.findIndex(stage => stage.keywords.some(keyword => normalize(skill).includes(keyword)));
    skillsByStage[found < 0 ? Math.floor(stageDefs.length / 2) : found].push({ name: skill, optional: false });
  }
  skillsByStage[skillsByStage.length - 1]?.push(...advanced.map(name => ({ name, optional: true })));
  return {
    matched,
    missing,
    stages: stageDefs.map((stage, index) => ({ name: stage.name, skills: skillsByStage[index] })).filter(stage => stage.skills.length),
    projects: (projectsByFamily[role.role_family ?? ''] ?? catalog.roadmap.defaultProjects).slice(0, 4),
  };
}

export function CareerRoadmap({ candidate, progress, toggle }: { candidate: Candidate | null; progress: string[]; toggle: (key: string) => void }) {
  const [params, setParams] = useSearchParams();
  const role = roles.find(item => item.role_id === params.get('role'));
  const byName = [...roles].sort((a, b) => a.role_name.localeCompare(b.role_name));
  const roadmap = role ? buildRoleRoadmap(role, candidate?.skills ?? []) : null;
  const total = roadmap?.stages.reduce((count, stage) => count + stage.skills.length, 0) ?? 0;
  const keyFor = (skill: string) => role?.role_id + ':' + normalize(skill);
  const completed = roadmap?.stages.flatMap(stage => stage.skills).filter(skill => progress.includes(keyFor(skill.name))).length ?? 0;

  return <>
    <div className="page-heading"><h1>Career roadmap</h1><p>Choose a role to turn its skill gaps into an ordered learning path and portfolio projects.</p></div>
    <section className="panel roadmap-picker"><span className="feature-icon"><Map size={22}/></span><label><strong>Target role</strong><select value={role?.role_id ?? ''} onChange={event => setParams(event.target.value ? { role: event.target.value } : {})}><option value="">Select a career role</option>{byName.map(item => <option key={item.role_id} value={item.role_id}>{item.role_name}{item.source_type === 'emerging_cluster' ? ' · Emerging' : ''}</option>)}</select></label>{candidate?.skills.length ? <Link className="button outline" to="/matches">View my role matches</Link> : <Link className="button outline" to="/profile">Add skills to tailor the roadmap</Link>}</section>
    {role && roadmap ? <>
      <section className="panel plan-summary"><span className="feature-icon"><ListChecks size={23}/></span><div><h2>{role.role_name}</h2><p>{roadmap.matched.length} skills already covered · {roadmap.missing.length} remaining core skills · {roadmap.stages.length} stages</p></div><span className="tag success">{completed} / {total} complete</span></section>
      {roadmap.stages.length === 0 && <p className="panel page-card">{roadmap.matched.length ? 'Your profile covers the current skill list. Use a portfolio project to demonstrate what you know.' : 'The role catalog has limited skill evidence for this role.'}</p>}
      <div className="roadmap-stages">{roadmap.stages.map((stage, index) => <section key={stage.name} className="panel roadmap-stage"><div className="roadmap-stage-head"><span className="feature-icon"><Target size={21}/></span><div><p>Stage {index + 1}</p><h2>{stage.name}</h2></div></div>
        <div className="roadmap-steps">{stage.skills.map(skill => {
          const key = keyFor(skill.name);
          const task = practiceFor(skill.name);
          return <div className="roadmap-task" key={key}><label className="check-control"><input type="checkbox" checked={progress.includes(key)} onChange={() => toggle(key)} aria-label={'Mark ' + skill.name + ' complete'}/><Check size={15}/></label><div><h3>{skill.name} {skill.optional && <span className="tag">Optional</span>}</h3><p>{task.task}</p><p className="proof"><strong>Portfolio evidence</strong> {task.proof}</p>{task.url && <a className="text-link" target="_blank" rel="noreferrer" href={task.url}><BookOpen size={15}/>{task.label}<ExternalLink size={13}/></a>}</div></div>;
        })}</div>
      </section>)}</div>
      <section className="panel page-card roadmap-projects"><div className="card-title"><FolderGit2 size={22}/><h2>Portfolio projects for this role</h2></div><ul className="qualifications">{roadmap.projects.map(project => <li key={project}>{project}</li>)}</ul></section>
    </> : <div className="panel empty"><Map size={28}/><h3>Choose a role to generate your roadmap</h3><p>You can start with a role from the catalog or pick one from your personalized matches.</p></div>}
  </>;
}

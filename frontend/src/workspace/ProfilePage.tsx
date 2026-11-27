import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import catalog from './catalog.generated.json';
import { normalize } from './engine';
import { blankCandidate, educationLevels, experienceBand, experienceBands, setExperienceBand, workModes } from './profile';
import { ResumeUpload } from './ResumeUpload';
import type { Candidate } from './model';
import type { ResumeDraft } from './resumeProfile';

const interests = Object.keys(catalog.policy.interest_category_map);
const workStyles = Object.keys(catalog.policy.work_style_map);
const titles = [...new Set(catalog.roles.filter(role => role.source_type === 'known_role').map(role => role.role_name))].sort();
const aliases: Record<string, string> = catalog.aliases;
const skillSuggestions = ['Python', 'SQL', 'Java', 'JavaScript', 'TypeScript', 'React', 'Git', 'Docker', 'Machine Learning', 'AWS', 'Linux', 'PostgreSQL'];

function mergeSkills(existing: string[], added: string[]) {
  const combined = [...existing, ...added].map(item => item.trim()).filter(Boolean).map(item => aliases[normalize(item)] ?? item);
  return [...new Map(combined.map(item => [normalize(item), item])).values()].slice(0, 100);
}

function pluralSelect(items: string[], item: string) {
  return items.includes(item) ? items.filter(value => value !== item) : [...items, item];
}

export function ProfilePage({ candidate, hasAssessment, save }: { candidate: Candidate | null; hasAssessment: boolean; save: (value: Candidate) => void }) {
  const [draft, edit] = useState<Candidate>(candidate ?? blankCandidate);
  const [skillInput, setSkill] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function addSkills(items: string[]) {
    edit(current => ({ ...current, skills: mergeSkills(current.skills, items) }));
    setError('');
  }

  function addTypedSkills() {
    addSkills(skillInput.split(/[,;\n]/));
    setSkill('');
  }

  function applyResume({ details, skills }: ResumeDraft) {
    edit(previous => {
      const updated = {
        ...previous,
        ...(details.name ? { name: details.name } : {}),
        ...(details.education ? { education: details.education } : {}),
        ...(details.degreeStream ? { degreeStream: details.degreeStream } : {}),
        skills: mergeSkills(previous.skills, skills),
      };
      return details.experience ? setExperienceBand(updated, details.experience.band) : updated;
    });
    setError('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const skills = mergeSkills(draft.skills, skillInput.split(/[,;\n]/));
    if (!skills.length) {
      setError('Add at least one skill to calculate your job fit.');
      return;
    }
    save({ ...draft, name: draft.name.trim(), target: draft.target.trim(), degreeStream: draft.degreeStream?.trim(), skills });
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    navigate(submitter?.value === 'assessment' ? '/assessment' : '/matches');
  }

  return <>
    <div className="page-heading">
      <h1>Resume & profile</h1>
      <p>Review resume details, add your skills, and tell us what kind of work you’re looking for.</p>
    </div>
    <form onSubmit={submit} className="panel form-panel">
      <ResumeUpload apply={applyResume} />
      <section>
        <h2>About you</h2>
        <p>Share the career background you want to include in your profile.</p>
        <div className="form-grid">
          <label>What should we call you?<input maxLength={60} value={draft.name} onChange={event => edit({ ...draft, name: event.target.value })} placeholder="Your name" /></label>
          <label>What’s your highest qualification?<select value={draft.education ?? ''} onChange={event => edit({ ...draft, education: event.target.value })}>
            <option value="">Select education</option>
            {educationLevels.map(item => <option key={item}>{item}</option>)}
          </select></label>
          <label>What did you study?<input maxLength={75} value={draft.degreeStream ?? ''} onChange={event => edit({ ...draft, degreeStream: event.target.value })} placeholder="e.g., Computer Science" /></label>
          <label>How much relevant experience do you have?<select value={draft.experienceBand ?? (candidate ? experienceBand(candidate) : '')} onChange={event => edit(setExperienceBand(draft, event.target.value))}>
            <option value="">Select experience</option>
            {Object.entries(experienceBands).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
        </div>
      </section>
      <section>
        <h2>Career preferences</h2>
        <div className="form-grid">
          <label>What role are you aiming for?<input maxLength={100} value={draft.target} list="role-options" onChange={event => edit({ ...draft, target: event.target.value })} placeholder="e.g., Software Engineer" />
            <datalist id="role-options">{titles.map(title => <option key={title} value={title}/>)}</datalist>
          </label>
          <label>How would you like to work?<select value={draft.mode} onChange={event => edit({ ...draft, mode: event.target.value })}>{workModes.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Which work do you most enjoy?<select value={draft.preferredWorkStyle ?? ''} onChange={event => edit({ ...draft, preferredWorkStyle: event.target.value })}>
            <option value="">Select a work preference</option>
            {workStyles.map(style => <option key={style}>{style}</option>)}
          </select></label>
        </div>
        <fieldset className="profile-interests">
          <legend>Which areas interest you?</legend>
          <div className="tags profile-tags">{interests.map(item => <button type="button" key={item} aria-pressed={draft.interests.includes(item)} className={'tag suggested ' + (draft.interests.includes(item) ? 'choice-active' : '')} onClick={() => edit({ ...draft, interests: pluralSelect(draft.interests, item) })}>{item}</button>)}</div>
        </fieldset>
      </section>
      <section>
        <h2>Your skills</h2>
        <p>Add skills you can demonstrate in an interview or project.</p>
        <label className="sr-only" htmlFor="new-skills">Enter your skills</label>
        <div className="inline-field">
          <input id="new-skills" value={skillInput} maxLength={280} placeholder="e.g., Python, SQL, React" onChange={event => setSkill(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); addTypedSkills(); }
          }}/>
          <button type="button" className="button outline" onClick={addTypedSkills}>Add skills</button>
        </div>
        {draft.skills.length > 0 && <div className="tags profile-tags">{draft.skills.map(skill => <button type="button" className="tag success" aria-label={'Remove ' + skill} key={skill} onClick={() => edit({ ...draft, skills: draft.skills.filter(item => item !== skill) })}>{skill}<X size={14}/></button>)}</div>}
        <div className="tags profile-tags">{skillSuggestions.filter(skill => !draft.skills.some(item => normalize(item) === normalize(skill))).map(skill => <button type="button" className="tag suggested" key={skill} onClick={() => addSkills([skill])}>+ {skill}</button>)}</div>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {hasAssessment ? <>
          <button className="button primary" type="submit">Save profile</button>
          <Link className="button outline" to="/assessment">View saved assessment</Link>
        </> : <>
          <button className="button primary" type="submit" value="assessment">Save and take assessment</button>
          <button className="button outline" type="submit">Save profile</button>
        </>}
      </div>
    </form>
  </>;
}

import { useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { extractResumeProfile } from './resumeProfile';
import type { ResumeDetails, ResumeDraft } from './resumeProfile';

const fieldLabels: Record<keyof ResumeDetails, string> = {
  name: 'Name',
  education: 'Education',
  degreeStream: 'Field of study',
  experience: 'Experience',
};

export function ResumeUpload({ apply }: { apply: (draft: ResumeDraft) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const inProgress = useRef(false);
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [fields, setFields] = useState<(keyof ResumeDetails)[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  function clear() {
    setFileName('');
    setDraft(null);
    setFields([]);
    setSkills([]);
    setMessage('');
    setError(false);
  }

  async function read(file: File) {
    if (inProgress.current) return;
    inProgress.current = true;
    clear();
    setFileName(file.name);
    setBusy(true);
    try {
      const { readResume } = await import('./readResume');
      const extracted = extractResumeProfile(await readResume(file));
      const keys = Object.keys(extracted.details) as (keyof ResumeDetails)[];
      if (keys.length || extracted.skills.length) {
        setDraft(extracted);
        setFields(keys);
        setSkills(extracted.skills);
        setMessage('Review the profile details and skills before importing them.');
      } else {
        setMessage('No profile details or recognized technical skills were found. You can enter them below.');
      }
    } catch (failure) {
      setError(true);
      setMessage((failure as Error).message);
    } finally {
      inProgress.current = false;
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function importSelection() {
    if (!draft || !(fields.length || skills.length)) return;
    const details = Object.fromEntries(fields.map(key => [key, draft.details[key]])) as ResumeDetails;
    apply({ details, skills });
    setMessage('Selected resume details and skills added. Review and save your profile below.');
    setDraft(null);
  }

  return <section className="resume-section" aria-labelledby="resume-heading">
    <h2 id="resume-heading">Upload your resume</h2>
    <p>Find skills and basic career details in a PDF. Your document is processed in this browser.</p>
    <div className="resume-upload" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      if (event.dataTransfer.files[0]) void read(event.dataTransfer.files[0]);
    }}>
      <span className="feature-icon">{fileName ? <FileText size={22}/> : <UploadCloud size={22}/>}</span>
      <div><strong>{fileName || 'Drop a PDF here'}</strong><small>{busy ? 'Reading your resume…' : 'Text-based PDF · up to 10 MB'}</small></div>
      {fileName && !busy && <button className="bare-icon" type="button" aria-label="Clear selected resume" onClick={clear}><X size={18}/></button>}
      <input className="sr-only" type="file" tabIndex={-1} aria-label="Upload resume PDF" ref={input} accept=".pdf,application/pdf" onChange={event => {
        const file = event.target.files?.[0];
        if (file) void read(file);
      }}/>
      <button className="button outline" type="button" disabled={busy} onClick={() => input.current?.click()}>{fileName ? 'Choose another PDF' : 'Choose PDF'}</button>
    </div>
    {message && <p className={error ? 'form-error' : undefined} role={error ? 'alert' : 'status'}>{message}</p>}
    {draft && <div className="resume-results">
      {Object.keys(draft.details).length > 0 && <fieldset className="resume-fields">
        <legend>Suggested profile details</legend>
        {(Object.keys(draft.details) as (keyof ResumeDetails)[]).map(key => {
          const value = draft.details[key];
          return <label key={key}>
            <input type="checkbox" checked={fields.includes(key)} onChange={() => {
              setFields(current => current.includes(key) ? current.filter(field => field !== key) : [...current, key]);
            }}/>
            <span><small>{fieldLabels[key]}</small><strong>{typeof value === 'object' ? value.display : value}</strong></span>
          </label>;
        })}
      </fieldset>}
      {draft.skills.length > 0 && <fieldset className="resume-skill-fields">
        <legend>Extracted skills</legend>
        <div className="tags">{draft.skills.map(skill => <button type="button" key={skill} className={'tag ' + (skills.includes(skill) ? 'choice-active' : '')} aria-pressed={skills.includes(skill)} onClick={() => {
          setSkills(current => current.includes(skill) ? current.filter(value => value !== skill) : [...current, skill]);
        }}>{skill}</button>)}</div>
      </fieldset>}
      <button className="button primary" type="button" disabled={!fields.length && !skills.length} onClick={importSelection}>Import selected details</button>
    </div>}
  </section>;
}

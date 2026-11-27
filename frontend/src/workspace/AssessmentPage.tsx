import { useState } from 'react';
import { Link } from 'react-router-dom';
import { archetypes, archetypeDescriptions, answerAssessment, beginAssessment, buildAssessmentProfile, questionTypes, TOTAL_QUESTIONS } from './assessment';
import type { AssessmentResult } from './assessmentResult';
import type { useSavedAssessment } from './useSavedAssessment';

function AssessmentSummary({ result }: { result: AssessmentResult }) {
  const total = result.vector.reduce((sum, score) => sum + score, 0);
  const [primary, secondary] = [0, 1, 2, 3].sort((a, b) => result.vector[b] - result.vector[a] || a - b);
  return <>
    <div><h2>{archetypes[primary]} is your primary archetype</h2><p>{archetypeDescriptions[archetypes[primary]]}</p></div>
    <div><h3>Secondary archetype · {archetypes[secondary]}</h3><p>{archetypeDescriptions[archetypes[secondary]]}</p></div>
    <div className="assessment-results">{archetypes.map((name, index) => {
      const share = Math.round(result.vector[index] / total * 100);
      return <div key={name}><span>{name}</span><meter min={0} max={100} value={share} aria-label={name + ' preference share'} /><strong>{share}%</strong></div>;
    })}</div>
  </>;
}

type AssessmentProps = ReturnType<typeof useSavedAssessment>;

export function AssessmentPage({ result, status, saveAssessment }: AssessmentProps) {
  const [attempt, setAttempt] = useState<ReturnType<typeof beginAssessment> | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const checking = status === 'checking';
  const state = attempt ?? (result || checking ? null : beginAssessment());
  const question = state?.pending[0];
  const answered = state?.answers.length ?? 0;

  function advance() {
    if (!state || selected === null) return;
    const next = answerAssessment(state, selected);
    setSelected(null);
    if (next.answers.length === TOTAL_QUESTIONS) {
      void saveAssessment({ ...buildAssessmentProfile(next), completedAt: Date.now() });
      setAttempt(null);
    } else {
      setAttempt(next);
    }
  }

  return <>
    <div className="page-heading">
      <h1>Archetype assessment</h1>
      <p>{result && !attempt ? 'Your BAIO results are ready to use in role matches.' : 'Answer 20 adaptive questions about how you approach work. Your first six answers guide the questions that follow.'}</p>
    </div>
    <section className="panel form-panel assessment-panel">
      {checking && !result ? <p role="status">Checking for a saved assessment…</p> : result && !attempt ? <>
        <AssessmentSummary result={result} />
        <p role="status">{status === 'saving' ? 'Saved in this browser. Syncing to your account…' :
          status === 'account' ? 'Saved to your account.' :
          status === 'memory' ? 'Available on this page. Browser storage is unavailable.' : 'Saved in this browser.'}
          {result.completedAt && ' Completed ' + new Date(result.completedAt).toLocaleDateString() + '.'}
        </p>
        <div className="form-actions">
          <Link className="button primary" to="/matches">View role matches</Link>
          <button type="button" className="button outline" disabled={checking || status === 'saving'} onClick={() => {
            setAttempt(beginAssessment());
            setSelected(null);
          }}>Retake assessment</button>
        </div>
      </> : question && <>
        <div className="quiz-progress"><span>Question {answered + 1} of {TOTAL_QUESTIONS}</span><progress max={TOTAL_QUESTIONS} value={answered}/></div>
        <span className="tag quiz-type">{questionTypes[question.type]}</span>
        <h2>{question.text}</h2>
        <fieldset className="quiz-options"><legend className="sr-only">Choose one response</legend>{question.options.map((option, index) => <label className={index === selected ? 'option active' : 'option'} key={option.text}><input type="radio" name="assessment-response" checked={selected === index} onChange={() => setSelected(index)}/>{option.text}</label>)}</fieldset>
        <div className="form-actions">
          <button type="button" className="button primary" disabled={selected === null} onClick={advance}>{answered === TOTAL_QUESTIONS - 1 ? 'Save and see results' : 'Continue'}</button>
          {result && attempt && <button type="button" className="button outline" onClick={() => { setAttempt(null); setSelected(null); }}>Cancel retake</button>}
        </div>
      </>}
    </section>
  </>;
}

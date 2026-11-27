import { build } from '../frontend/node_modules/esbuild/lib/main.js';
import { readFile } from 'node:fs/promises';

const pythonFixtures = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : [];
const { outputFiles } = await build({
  stdin: {
    contents: [
      "import assert from 'node:assert/strict';",
      "import bank from './backend/questionnaire.json';",
      "import { beginAssessment, answerAssessment, buildAssessmentProfile, TOTAL_QUESTIONS } from './frontend/src/workspace/assessment';",
      "import { extractResumeProfile } from './frontend/src/workspace/resumeProfile';",
      "import { buildRoleRoadmap } from './frontend/src/workspace/CareerRoadmap';",
      "import { rankRoles } from './frontend/src/workspace/engine';",
      "import catalog from './frontend/src/workspace/catalog.generated.json';",
      "assert.equal(TOTAL_QUESTIONS,20); assert.equal(bank.length,48);",
      "const phases = new Map(bank.map(q=>[q.id,q.phase]));",
      "const branches=new Set();",
      "for(let seed=0;seed<100;seed++){let state=beginAssessment(); let choices=seed+1;",
      "while(state.answers.length<TOTAL_QUESTIONS){assert.ok(state.pending[0]); choices=(choices*48271)%2147483647;",
      "state=answerAssessment(state, choices%state.pending[0].options.length);}",
      "const ids=state.answers.map(a=>a.id); assert.equal(new Set(ids).size,20); assert.equal(state.pending.length,0);",
      "assert.deepEqual(ids.map(id=>phases.get(id)),[...Array(6).fill(1),...Array(9).fill(2),...Array(5).fill(3)]);",
      "const profile=buildAssessmentProfile(state); assert.ok(Math.abs(profile.vector.reduce((a,b)=>a+b,0)-1)<.0003);",
      "branches.add(ids.slice(6).join(',')); }",
      "assert.ok(branches.size>1);",
      "const resume=extractResumeProfile('Diya Rao\\nSoftware Engineer\\ndiya@example.test | +91 0000000000\\nSUMMARY\\n3+ years of professional experience\\nEDUCATION\\nB.Tech in Computer Science and Engineering\\nSKILLS: Python, C++, React.js, Docker, JavaScript, AWS, Go\\nExperience: used Docker.');",
      "assert.deepEqual(resume.details,{name:'Diya Rao',education:'Bachelor’s',degreeStream:'Computer Science & Engineering',experience:{display:'3+ years',band:'3-5 years'}});",
      "for(const skill of ['Python','C++','React','Docker','JavaScript','AWS','Go']) assert.ok(resume.skills.includes(skill),skill);",
      "assert.ok(!resume.skills.includes('B.Tech')); assert.equal(resume.skills.filter(skill=>skill==='Docker').length,1);",
      "assert.equal(extractResumeProfile('Diya Rao\\nEDUCATION\\nB.Tech in Computer Science\\nM.S. Ramaiah Institute of Technology').details.education,'Bachelor’s');",
      "assert.deepEqual(extractResumeProfile('EXPERIENCE\\nSoftware Engineer\\nResearch at Example Institution\\nPython').details,{});",
      "const role=catalog.roles.find(role=>role.role_id==='ROLE_1001');",
      "const path=buildRoleRoadmap(role,['Python']); assert.ok(path.matched.includes('Python'));",
      "assert.ok(path.stages.length>=2); assert.ok(!path.stages.some(stage=>stage.skills.some(skill=>skill.name==='Python')));",
      "const pythonFixtures=" + JSON.stringify(pythonFixtures) + ";",
      "for(const fixture of pythonFixtures){const state=fixture.answers.reduce(answerAssessment,beginAssessment());",
      "assert.deepEqual(state.answers.map(a=>a.id),fixture.ids);",
      "const profile=buildAssessmentProfile(state); const expected=fixture.profile;",
      "assert.deepEqual(profile.vector,expected.raw_vector); assert.deepEqual(profile.workStyles,expected.work_style);",
      "assert.equal(profile.primary,expected.primary_archetype); assert.equal(profile.secondary,expected.secondary_archetype);",
      "const candidate={skills:expected.declared_skills,assessment:profile.vector,assessmentWorkStyles:profile.workStyles,interests:expected.interests,level:'Entry Level',experienceBand:expected.experience_level};",
      "const matches=rankRoles(catalog.roles,candidate,catalog.policy);",
      "for(const match of matches){const score=fixture.ranks[match.role_id]; if(!score)continue;",
      "for(const [actual, expected] of [[match.score,score.final_score],[match.personalFit,score.personal_fit],[match.futurePotential,score.future_potential],[match.readiness,score.current_readiness]]) assert.ok(Math.abs(actual-expected)<.000051,match.role_id);}}",
      "console.log('100 adaptive sessions, resume profile, taxonomy, and roadmap checks passed. Python comparison sessions: '+pythonFixtures.length+'.');",
    ].join('\n'),
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
try {
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

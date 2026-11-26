// frontend/src/pages/OnboardingPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  X,
  Plus,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  Award,
} from 'lucide-react';
import { api } from '../api/client';
import { useUser } from '../store/userContext';
import { ResumeParseResponse } from '../types';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, setSessionId, refreshProfile, user } = useUser();

  // Multi-step state: 1 = Profile & Resume, 2 = 20-Question BAIO Assessment
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1: Profile & Resume State
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [name, setName] = useState<string>(user?.name || 'Alex Mercer');
  const [education, setEducation] = useState<string>(user?.education || 'Bachelor of Technology');
  const [degreeStream, setDegreeStream] = useState<string>(user?.degree_stream || 'Computer Science & Engineering');
  const [experienceLevel, setExperienceLevel] = useState<string>(user?.experience_level || 'Entry Level');
  const [skills, setSkills] = useState<string[]>(
    user?.declared_skills && user.declared_skills.length > 0
      ? user.declared_skills
      : ['Python', 'SQL', 'React', 'Docker', 'Git']
  );
  const [newSkill, setNewSkill] = useState<string>('');
  const [confirming, setConfirming] = useState<boolean>(false);

  // Pre-populate with saved user profile if available
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.education) setEducation(user.education);
      if (user.degree_stream) setDegreeStream(user.degree_stream);
      if (user.experience_level) setExperienceLevel(user.experience_level);
      if (user.declared_skills && user.declared_skills.length > 0) {
        setSkills(user.declared_skills);
      }
    }
  }, [user]);

  // Step 2: Assessment State
  const [sessionIdLocal, setSessionIdLocal] = useState<string>('');
  const [question, setQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState<number>(1);
  const [totalQuestions] = useState<number>(20);
  const [phase, setPhase] = useState<string>('Foundation');
  const [submittingAnswer, setSubmittingAnswer] = useState<boolean>(false);
  const [assessmentStarting, setAssessmentStarting] = useState<boolean>(false);

  // Resume Upload Handler
  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file.');
      return;
    }
    setFile(uploadedFile);
    setIsParsing(true);
    try {
      const parsed: ResumeParseResponse = await api.parseResume(uploadedFile);
      if (parsed.extracted_name) setName(parsed.extracted_name);
      if (parsed.education) setEducation(parsed.education);
      if (parsed.degree_stream) setDegreeStream(parsed.degree_stream);
      if (parsed.experience_level) setExperienceLevel(parsed.experience_level);
      if (parsed.extracted_skills && parsed.extracted_skills.length > 0) {
        setSkills(parsed.extracted_skills);
      }
    } catch (err: any) {
      console.error('Resume parse error:', err);
      alert('Could not extract skills automatically. You can review and edit skills manually below.');
    } finally {
      setIsParsing(false);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill('');
    }
  };

  // Confirm Profile and Proceed to Step 2
  const handleConfirmProfile = async () => {
    setConfirming(true);
    try {
      await api.confirmResume({
        user_id: userId,
        name,
        education,
        degree_stream: degreeStream,
        experience_level: experienceLevel,
        skills,
      });
      await refreshProfile();

      // Start Assessment
      setAssessmentStarting(true);
      const startRes = await api.startAssessment(userId);
      setSessionIdLocal(startRes.session_id);
      setSessionId(startRes.session_id);
      setQuestion(startRes.question);
      setPhase(startRes.question.stage || 'Foundation');
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Failed to confirm profile or start assessment:', err);
      alert('Profile saved. Starting assessment directly...');
      setCurrentStep(2);
    } finally {
      setConfirming(false);
      setAssessmentStarting(false);
    }
  };

  // Submit Answer in Assessment Stepper
  const handleSelectOption = async (optionIndex: number) => {
    if (submittingAnswer || !sessionIdLocal) return;
    setSubmittingAnswer(true);

    try {
      const nextRes = await api.submitAssessmentAnswer(sessionIdLocal, optionIndex);

      if (nextRes.completed || !nextRes.question) {
        // Assessment Complete
        await api.completeAssessment(sessionIdLocal);
        // Pre-fetch recommendations and navigate
        await api.getRecommendations(sessionIdLocal);
        navigate('/matches');
      } else {
        setQuestion(nextRes.question);
        setQuestionIndex((prev) => prev + 1);
        if (nextRes.question.stage) {
          setPhase(nextRes.question.stage);
        }
      }
    } catch (err: any) {
      console.error('Error submitting answer:', err);
      // If error or already completed, navigate to matches
      navigate('/matches');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Talent Alignment Engine</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {currentStep === 1 ? 'Build Your Verified Profile' : 'BAIO Psychometric Profiling'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {currentStep === 1
            ? 'Upload your resume for skill extraction or customize your technical stack.'
            : 'Evaluate your Builder, Analyst, Innovator, and Operator archetype alignments.'}
        </p>
      </div>

      {/* Main Container Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {/* STEP 1: RESUME & SKILLS */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Drag-and-drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 rounded-xl p-6 text-center cursor-pointer transition-colors"
                onClick={() => document.getElementById('resume-file-input')?.click()}
              >
                <input
                  id="resume-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                    {isParsing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {file ? file.name : 'Upload PDF Resume for AI Parsing'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isParsing
                      ? 'Extracting and normalizing skills against canonical taxonomy...'
                      : 'Drag and drop your file here, or click to browse'}
                  </p>
                </div>
              </div>

              {/* Editable Profile Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Entry Level">Entry Level (0-2 yrs)</option>
                    <option value="Mid Level">Mid Level (3-5 yrs)</option>
                    <option value="Senior Level">Senior Level (5+ yrs)</option>
                  </select>
                </div>
              </div>

              {/* Extracted / Declared Skills */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">
                    Confirmed Skills ({skills.length})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Click cross to remove or add below
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center space-x-1 text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md shadow-2xs font-medium"
                    >
                      <span>{skill}</span>
                      <button
                        onClick={() => removeSkill(skill)}
                        className="text-slate-400 hover:text-slate-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new skill inline */}
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add additional skill (e.g., Kubernetes, PyTorch)..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addSkill}
                    type="button"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Confirm Profile Button */}
              <button
                onClick={handleConfirmProfile}
                disabled={confirming || assessmentStarting}
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {confirming || assessmentStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Assessment...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Profile & Start Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: BAIO 20-QUESTION STEPPER */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Stepper Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-indigo-600 uppercase tracking-wider text-[11px] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                    Phase: {phase}
                  </span>
                  <span>
                    Question {questionIndex} of {totalQuestions}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (questionIndex / totalQuestions) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question Text */}
              {question ? (
                <div>
                  <h3 className="text-base font-semibold text-slate-900 leading-snug mb-5">
                    {question.question_text || question.text}
                  </h3>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {question.options &&
                      question.options.map((opt: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(idx)}
                          disabled={submittingAnswer}
                          className="w-full text-left p-3.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-sm font-medium text-slate-800 transition-all flex items-center justify-between group disabled:opacity-50"
                        >
                          <span className="pr-4">{opt.text || opt}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                  <p className="text-sm text-slate-500">Loading next question...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

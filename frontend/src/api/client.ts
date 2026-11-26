// frontend/src/api/client.ts

import {
  ExtendedUserProfile,
  RoleSummary,
  RoleDetail,
  RecommendationResponse,
  SkillGapResponse,
  RoadmapResponse,
  AIChatInput,
  AIChatOutput,
  ResumeParseResponse,
  ResumeConfirmInput,
  ResumeConfirmResponse,
} from '../types';

const API_BASE = '/api';

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const errorBody = await resp.text();
    throw new Error(`API Error ${resp.status} on ${endpoint}: ${errorBody}`);
  }
  return resp.json();
}

export const api = {
  // Candidate Profile
  async getProfile(userId: string): Promise<ExtendedUserProfile> {
    return fetchJSON<ExtendedUserProfile>(`/profile/${userId}`);
  },

  async updateProfile(userId: string, data: Partial<ExtendedUserProfile>): Promise<ExtendedUserProfile> {
    return fetchJSON<ExtendedUserProfile>(`/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Resume Intelligence Agent
  async parseResume(file: File): Promise<ResumeParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API_BASE}/ai/resume/parse`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed to parse resume (${resp.status}): ${err}`);
    }
    return resp.json();
  },

  async confirmResume(payload: ResumeConfirmInput): Promise<ResumeConfirmResponse> {
    return fetchJSON<ResumeConfirmResponse>('/ai/resume/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Assessment Flow
  async startAssessment(userId?: string): Promise<{ session_id: string; question: any }> {
    return fetchJSON<{ session_id: string; question: any }>('/assessment/start', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async submitAssessmentAnswer(sessionId: string, optionIndex: number): Promise<any> {
    return fetchJSON<any>('/assessment/next', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, answer_index: optionIndex }),
    });
  },

  async completeAssessment(sessionId: string): Promise<any> {
    return fetchJSON<any>('/assessment/complete', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  // Multi-factor Recommendations
  async getRecommendations(sessionId: string): Promise<RecommendationResponse> {
    return fetchJSON<RecommendationResponse>('/recommendations', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  async getLatestRecommendations(sessionId: string): Promise<RecommendationResponse> {
    return fetchJSON<RecommendationResponse>(`/recommendations/${sessionId}`);
  },

  // Role Catalog Intelligence
  async getRoleCatalog(): Promise<RoleSummary[]> {
    return fetchJSON<RoleSummary[]>('/roles/catalog');
  },

  async getRoleDetail(roleId: string): Promise<RoleDetail> {
    return fetchJSON<RoleDetail>(`/roles/${roleId}`);
  },

  // Skill Gap & Roadmap Analysis
  async getSkillGap(roleId: string, userSkills: string[]): Promise<SkillGapResponse> {
    return fetchJSON<SkillGapResponse>('/skill-gap', {
      method: 'POST',
      body: JSON.stringify({ role_id: roleId, user_skills: userSkills }),
    });
  },

  async getRoadmap(roleId: string, userSkills: string[]): Promise<RoadmapResponse> {
    return fetchJSON<RoadmapResponse>('/roadmap', {
      method: 'POST',
      body: JSON.stringify({ role_id: roleId, user_skills: userSkills }),
    });
  },

  async getDetailedRoadmap(payload: {
    role_id: string;
    user_skills?: string[];
    missing_skills?: string[];
  }): Promise<any> {
    return fetchJSON<any>('/ai/roadmap/detailed', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // AI Career Copilot
  async sendAIChat(payload: AIChatInput): Promise<AIChatOutput> {
    return fetchJSON<AIChatOutput>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Daily Job Intelligence
  async searchJobs(params: {
    role_id?: string;
    location?: string;
    experience?: string;
    work_mode?: string;
    user_id?: string;
    limit?: number;
  }): Promise<{ total: number; jobs: any[] }> {
    const q = new URLSearchParams();
    if (params.role_id && params.role_id !== 'all') q.append('role_id', params.role_id);
    if (params.location && params.location.trim()) q.append('location', params.location.trim());
    if (params.experience && params.experience !== 'Any' && params.experience !== 'all') q.append('experience', params.experience);
    if (params.work_mode && params.work_mode !== 'Any' && params.work_mode !== 'all') q.append('work_mode', params.work_mode);
    if (params.user_id) q.append('user_id', params.user_id);
    if (params.limit) q.append('limit', params.limit.toString());
    return fetchJSON<{ total: number; jobs: any[] }>(`/jobs/search?${q.toString()}`);
  },

  async refreshJobs(): Promise<{ status: string; summary: any }> {
    return fetchJSON<{ status: string; summary: any }>('/jobs/refresh', {
      method: 'POST',
    });
  },

  async saveJobApplication(userId: string, jobId: string, status = 'saved'): Promise<{ status: string; application: any }> {
    return fetchJSON<{ status: string; application: any }>('/jobs/save', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, job_id: jobId, status }),
    });
  },

  async getSavedJobs(userId: string): Promise<any[]> {
    return fetchJSON<any[]>(`/jobs/saved/${userId}`);
  },

  async getJobCollectionRuns(): Promise<any[]> {
    return fetchJSON<any[]>('/jobs/runs');
  },
};

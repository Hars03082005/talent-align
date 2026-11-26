// frontend/src/types/index.ts

export interface JobListingSummary {
  id: string;
  external_id?: string;
  title: string;
  normalized_title: string;
  company: string;
  location: string;
  location_type: 'remote' | 'hybrid' | 'onsite';
  salary_min?: number;
  salary_max?: number;
  currency: string;
  experience_level: string;
  employment_type: string;
  source: string;
  required_skills: string[];
  preferred_skills: string[];
  application_url: string;
  posted_at?: string;
  last_verified_at?: string;
  compatibility_score?: number;
  matching_skills?: string[];
  missing_skills?: string[];
}

export interface CompatibilityBreakdown {
  overall_score: number;
  skill_match_score: number;
  experience_score: number;
  education_score: number;
  role_alignment_score: number;
  location_score: number;
  matching_skills: string[];
  missing_mandatory_skills: string[];
  missing_preferred_skills: string[];
  why_matched: string[];
  how_to_improve: string[];
}

export interface JobListingDetail extends JobListingSummary {
  description: string;
  experience_min?: number;
  experience_max?: number;
  category: string;
  salary_is_predicted: boolean;
  compatibility_breakdown?: CompatibilityBreakdown;
}

export interface JobListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  jobs: JobListingSummary[];
}

export interface ExtendedUserProfile {
  id: string;
  name: string;
  email?: string;
  education: string;
  degree_stream: string;
  experience_level: string;
  experience_years: number;
  work_mode_preference: string;
  declared_skills: string[];
  declared_interests: string[];
  target_roles: string[];
  preferred_locations: string[];
  projects: Array<{ title: string; description: string; skills_used: string[]; url?: string }>;
  work_experience: Array<{ role: string; company: string; duration: string; description: string }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
  resume_filename?: string;
  resume_text?: string;
  primary_archetype?: string;
  secondary_archetype?: string;
  baio_scores?: { B: number; A: number; I: number; O: number };
  profile_confidence?: number;
  primary_archetype_description?: string;
  created_at: string;
  updated_at: string;
}

export interface MissingSkillItem {
  skill: string;
  frequency_in_jobs: number;
  frequency_pct: number;
  importance: 'Critical' | 'High' | 'Moderate';
  sample_jobs: string[];
}

export interface SkillGapMarketResponse {
  possessed_skills: string[];
  needs_improvement_skills: string[];
  missing_skills: MissingSkillItem[];
  total_target_jobs_analyzed: number;
  target_roles: string[];
}

export interface ActionPlanItemDTO {
  id?: number;
  stage: 'Foundation' | 'Core' | 'Applied' | 'Capstone';
  priority: number;
  title: string;
  description: string;
  target_skill?: string;
  why_needed?: string;
  learning_objectives: string[];
  practice_project?: string;
  estimated_hours: number;
  status: 'not_started' | 'in_progress' | 'completed';
  resources: Array<{ name: string; url: string }>;
}

export interface CareerActionPlanResponse {
  id: string;
  user_id: string;
  target_role: string;
  title: string;
  summary: string;
  total_estimated_hours: number;
  items: ActionPlanItemDTO[];
  created_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  grounded_facts?: string[];
  suggested_followups?: string[];
  cited_jobs?: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    salary_min?: number;
    salary_max?: number;
    url: string;
  }>;
  cited_skills?: string[];
}

export interface MarketOverviewResponse {
  total_active_listings: number;
  new_this_week: number;
  top_demand_skills: Array<{ skill: string; demand_count: number }>;
  top_hiring_roles: Array<{ company: string; count: number }>;
  location_distribution: Array<{ location: string; count: number }>;
  work_mode_distribution: Record<string, number>;
  experience_distribution: Record<string, number>;
  salary_insights: {
    average_salary_min: number;
    average_salary_max: number;
    highest_salary: number;
    currency: string;
  };
  emerging_roles_count: number;
  forecasted_roles_count: number;
}

export interface RoleSummary {
  role_id?: string;
  role_name: string;
  source_type: 'known_role' | 'emerging_cluster';
  role_family?: string;
  role_category?: string;
  emergence_tier?: string;
  confidence_label?: string;
  emergence_score?: number;
  forecast_6m_bps?: number;
  forecast_12m_bps?: number;
  growth_pct_6m?: number;
  growth_pct_12m?: number;
  growth_tier?: string;
  hype_cycle_stage?: string;
  years_to_plateau?: string;
  career_risk_profile?: string;
  maturity_rationale?: string;
}

export interface RoleDetail extends RoleSummary {
  classification?: string;
  forecast_method?: string;
  confidence?: number;
  current_demand_bps?: number;
  li_posting_count?: number;
  li_unique_companies?: number;
  required_skills: string[];
  frontier_skills: string[];
  first_seen?: string;
  last_seen?: string;
  persistence_quarters?: number;
  market_breadth_score?: number;
  representative_titles?: string[];
  closest_known_role?: string;
  shap_top_drivers: string[];
  evidence?: string;
}

export interface RecommendationCard {
  rank: number;
  role_id: string;
  role_name: string;
  classification: string;
  source_type: 'known_role' | 'emerging_cluster';
  personal_fit: number;
  future_potential: number;
  current_readiness: number;
  final_score: number;
  confidence_tier?: string;
  confidence_label?: string;
  forecast_6m_bps?: number;
  growth_pct_6m?: number;
  shap_drivers?: {
    positive?: string[];
    negative?: string[];
    [key: string]: any;
  };
  required_skills?: string[];
  frontier_skills?: string[];
  why_this_role?: string[];
  shap_top_drivers?: string[];
  hype_cycle_stage?: string;
  years_to_plateau?: string;
  career_risk_profile?: string;
  maturity_rationale?: string;
}

export interface RecommendationResponse {
  session_id: string;
  user_profile: {
    user_id: string;
    primary_archetype: string;
    secondary_archetype: string;
    baio_scores: { B: number; A: number; I: number; O: number };
    declared_skills: string[];
    declared_interests: string[];
    experience_level: string;
  };
  top_recommendations: RecommendationCard[];
  secondary_recommendations: RecommendationCard[];
  model_version: string;
  pipeline_version: string;
}

export interface SkillGapResponse {
  role_name: string;
  match_percentage: number;
  possessed_skills: string[];
  missing_skills: string[];
  frontier_skills: string[];
  total_required: number;
}

export interface RoadmapStage {
  stage: string;
  skills: string[];
  resources: Array<{ title: string; url: string }>;
}

export interface RoadmapResponse {
  role_name: string;
  method_note: string;
  already_have: string[];
  stages: RoadmapStage[];
  projects: Array<{
    title: string;
    description: string;
    skills_covered: string[];
    difficulty: string;
  }>;
}

// AI Layer Types
export interface AIChatInput {
  message: string;
  user_id?: string;
  session_id?: string;
  role_id?: string;
}

export interface AIChatOutput {
  answer: string;
  tools_used: string[];
  citations: string[];
  validation_passed: boolean;
  intent?: string;
  active_agent?: string;
  violations?: string[];
  reply?: string;
  grounded_facts?: string[];
  suggested_followups?: string[];
}

export interface ResumeParseResponse {
  filename: string;
  extracted_name?: string;
  email?: string;
  education?: string;
  degree_stream?: string;
  experience_level?: string;
  experience_years?: number;
  extracted_skills: string[];
  skills_count: number;
  projects?: Array<{
    title: string;
    description: string;
    skills_used: string[];
    url?: string;
  }>;
  resume_preview?: string;
}

export interface ResumeConfirmInput {
  user_id: string;
  skills: string[];
  name?: string;
  education?: string;
  degree_stream?: string;
  experience_level?: string;
  experience_years?: number;
  projects?: Array<{
    title: string;
    description: string;
    skills_used: string[];
    url?: string;
  }>;
}

export interface ResumeConfirmResponse {
  status: string;
  user_id: string;
  name: string;
  declared_skills: string[];
  skills_count: number;
}

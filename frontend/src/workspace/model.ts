export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: string;
  level: string;
  source: string;
  url: string;
  published: string | null;
  updated: string | null;
  skills: string[];
  preferred: string[];
  qualifications: string[];
  summary: string;
}

export interface Feed {
  jobs: Job[];
  checked: string;
  sources: string[];
  unavailable: string[];
  status: 'live' | 'snapshot';
}

export interface Candidate {
  name: string;
  skills: string[];
  level: string;
  mode: string;
  target: string;
  interests: string[];
  education?: string;
  degreeStream?: string;
  experienceBand?: string;
  preferredWorkStyle?: string;
  assessment?: number[];
  assessmentInterests?: string[];
  assessmentWorkStyles?: string[];
}

export interface Role {
  role_id: string;
  role_name: string;
  role_category: string | null;
  role_family: string | null;
  source_type: string;
  role_description: string | null;
  required_skills: string[];
  frontier_skills: string[];
  forecast_6m_bps: number | null;
  forecast_12m_bps: number | null;
  current_demand_bps: number | null;
  forecast_next_quarter_postings: number | null;
  forecast_growth_pct_cluster: number | null;
  confidence_label: string | null;
  shap_top_drivers: string[];
  evidence: string | object | null;
  hype_cycle_stage: string;
  years_to_plateau: string;
  career_risk_profile: string;
  maturity_rationale: string;
  signals: { baio_fit: number; baio_vector: number[]; future_opportunity: number; emergence_signal: number };
}

export type TrackerStatus = 'Saved' | 'Applied' | 'Interview';
export interface Tracked { job: Job; status: TrackerStatus }

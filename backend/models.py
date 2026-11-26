"""
backend/models.py
==================
Pydantic request/response schemas for the upgraded FastAPI backend.

Extends the original initial-implementation models with:
- User Management schemas (UserCreate, UserResponse, UserUpdate)
- Assessment Lifecycle & Result schemas (AssessmentStartRequest, AssessmentSummary, AssessmentResultResponse)
- Recommendation Snapshot schemas (RecommendationSnapshotItem)
- Feedback schemas (FeedbackCreate, FeedbackResponse)
- Rich UserProfile
- RoleCard (recommendation result per role)
- RecommendationResult (full top-5 response)
- SkillGap schema
- LearningRoadmap schema
- Role catalog schemas

All original models preserved for backward compatibility.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# ── Original models (preserved from initial implementation) ───────────────────

QuestionType = Literal["mcq", "likert", "binary"]


class QuestionOption(BaseModel):
    text: str


class QuestionPayload(BaseModel):
    id: str
    text: str
    type: QuestionType
    stage: Literal["common", "builder", "analyst", "innovator", "operator"]
    options: List[QuestionOption]
    question_number: int
    total_questions: int


class StartResponse(BaseModel):
    session_id: str
    question: QuestionPayload
    user_id: Optional[str] = None


class NextRequest(BaseModel):
    session_id: str
    answer_index: int = Field(ge=0)


class NextResponse(BaseModel):
    completed: bool
    answered_count: int
    total_questions: int
    phase: Literal["initial", "adaptive", "reconfirmation", "completed"]
    question: Optional[QuestionPayload] = None


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = "Anonymous"
    email: Optional[str] = None
    education: Optional[str] = ""
    degree_stream: Optional[str] = ""
    experience_level: Optional[str] = "1-3 years"
    declared_skills: List[str] = Field(default_factory=list)
    declared_interests: List[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    education: Optional[str] = None
    degree_stream: Optional[str] = None
    experience_level: Optional[str] = None
    declared_skills: Optional[List[str]] = None
    declared_interests: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    education: Optional[str] = ""
    degree_stream: Optional[str] = ""
    experience_level: Optional[str] = ""
    declared_skills: List[str] = Field(default_factory=list)
    declared_interests: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ── Assessment Start & Profile Schemas ────────────────────────────────────────

class AssessmentStartRequest(BaseModel):
    """Optional payload when starting an assessment."""
    user_id: Optional[str] = None
    name: Optional[str] = "Anonymous"
    email: Optional[str] = None
    education: Optional[str] = ""
    degree_stream: Optional[str] = ""
    experience_level: Optional[str] = "1-3 years"
    declared_skills: List[str] = Field(default_factory=list)
    declared_interests: List[str] = Field(default_factory=list)


class UserProfileInput(BaseModel):
    """Submitted from the Profile / Basic Info page before questionnaire."""
    session_id: str
    education: str = ""
    degree_stream: str = ""
    experience_level: str = "1-3 years"
    declared_skills: List[str] = Field(default_factory=list)
    declared_interests: List[str] = Field(default_factory=list)


# ── Rich User Profile Schemas ─────────────────────────────────────────────────

class BAIOScores(BaseModel):
    Builder: float
    Analyst: float
    Innovator: float
    Operator: float


class UserProfile(BaseModel):
    """Rich multi-dimensional user profile, output after questionnaire."""
    BAIO: BAIOScores
    primary_archetype: str
    secondary_archetype: str
    primary_archetype_description: str
    secondary_archetype_description: str
    raw_vector: List[float]
    archetype_confidence: float
    interests: List[str]
    work_style: List[str]
    technology_interest: List[str]
    experience_level: str
    education: str
    degree_stream: str
    declared_skills: List[str]
    profile_confidence: float
    n_answers: int
    total_questions: int


class AssessmentCompleteRequest(BaseModel):
    session_id: str
    profile_input: Optional[UserProfileInput] = None


class AssessmentSummary(BaseModel):
    """Compact summary of a historical assessment session."""
    session_id: str
    user_id: str
    started_at: str
    completed_at: Optional[str] = None
    status: str
    primary_archetype: Optional[str] = None
    secondary_archetype: Optional[str] = None
    archetype_confidence: Optional[float] = 0.0
    profile_confidence: Optional[float] = 0.0
    B_score: Optional[float] = 0.0
    A_score: Optional[float] = 0.0
    I_score: Optional[float] = 0.0
    O_score: Optional[float] = 0.0
    answered_count: int
    total_questions: int


class AssessmentResultResponse(BaseModel):
    """Full detail of an assessment session result."""
    session_id: str
    user_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    user_profile: Optional[UserProfile] = None
    answers_count: int
    recommendations_count: int


# ── Recommendation Schemas ───────────────────────────────────────────────────

class ComponentScores(BaseModel):
    baio_fit: float
    interest_alignment: float
    work_style_alignment: float
    skill_alignment: float
    future_opportunity: float
    emergence_signal: float


class RoleCard(BaseModel):
    """One recommended role in the top-5 result."""
    rank: int
    role_id: Optional[str] = None
    role_name: str
    source_type: Optional[str] = None
    role_family: Optional[str] = None
    role_category: Optional[str] = None
    confidence_label: Optional[str] = None

    # The three user-facing output scores (shown as percentages in UI)
    personal_fit: float        # 0.0–1.0 → shown as X%
    future_potential: float    # 0.0–1.0 → shown as X%
    current_readiness: float   # 0.0–1.0 → shown as X%
    final_score: float         # internal ranking score

    # Component transparency
    component_scores: ComponentScores

    # Explanations
    why_this_role: List[str]
    challenges: List[str]

    # Skills
    required_skills: List[str]
    frontier_skills: List[str]

    # Growth data (may be None if unavailable)
    growth_pct_6m: Optional[float] = None
    growth_pct_12m: Optional[float] = None
    growth_tier: Optional[str] = None
    hype_cycle_stage: Optional[str] = None
    years_to_plateau: Optional[str] = None
    career_risk_profile: Optional[str] = None
    maturity_rationale: Optional[str] = None
    emergence_score: Optional[float] = None
    shap_top_drivers: List[str] = Field(default_factory=list)

    # Gartner Hype Cycle & Career Risk Profile
    hype_cycle_stage: Optional[str] = None
    years_to_plateau: Optional[str] = None
    career_risk_profile: Optional[str] = None
    maturity_rationale: Optional[str] = None


class RecommendationRequest(BaseModel):
    session_id: str


class RecommendationResponse(BaseModel):
    session_id: str
    user_profile: UserProfile
    top_recommendations: List[RoleCard]
    secondary_recommendations: List[RoleCard]
    model_version: Optional[str] = "v2.0.0"
    pipeline_version: Optional[str] = "v2.0.0"


class RecommendationSnapshotItem(BaseModel):
    """Frozen snapshot of a historical recommendation."""
    id: int
    session_id: str
    role_id: Optional[str] = None
    role_name: str
    rank: int
    recommendation_type: str
    personal_fit: float
    future_potential: float
    current_readiness: float
    final_score: float
    emergence_score: Optional[float] = None
    growth_pct_6m: Optional[float] = None
    growth_pct_12m: Optional[float] = None
    growth_tier: Optional[str] = None
    hype_cycle_stage: Optional[str] = None
    years_to_plateau: Optional[str] = None
    career_risk_profile: Optional[str] = None
    maturity_rationale: Optional[str] = None
    source_type: Optional[str] = None
    role_family: Optional[str] = None
    role_category: Optional[str] = None
    confidence_label: Optional[str] = None
    description: Optional[str] = None
    why_this_role: List[str] = Field(default_factory=list)
    challenges: List[str] = Field(default_factory=list)
    required_skills: List[str] = Field(default_factory=list)
    frontier_skills: List[str] = Field(default_factory=list)
    component_scores: Dict[str, Any] = Field(default_factory=dict)
    shap_top_drivers: List[str] = Field(default_factory=list)
    model_version: str
    pipeline_version: str
    generated_at: Optional[str] = None


# ── Feedback Schemas ──────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    recommendation_id: Optional[int] = None
    rating: int = Field(ge=1, le=5)
    feedback_text: Optional[str] = ""
    category: Optional[str] = "general"


class FeedbackResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    recommendation_id: Optional[int] = None
    rating: int
    feedback_text: Optional[str] = ""
    category: Optional[str] = "general"
    created_at: Optional[str] = None


# ── Skill Gap schemas ─────────────────────────────────────────────────────────

class SkillGapRequest(BaseModel):
    role_id: str
    user_skills: List[str] = Field(default_factory=list)


class SkillGapResponse(BaseModel):
    role_name: str
    role_id: Optional[str] = None
    already_have: List[str]
    need_to_learn: List[str]
    optional_advanced: List[str]
    skill_overlap_pct: Optional[float] = None
    data_available: bool
    message: Optional[str] = None


# ── Roadmap schemas ───────────────────────────────────────────────────────────

class RoadmapStage(BaseModel):
    stage_number: int
    stage_name: str
    skills: List[str]
    is_foundation: bool
    is_advanced: bool


class RoadmapRequest(BaseModel):
    role_id: str
    user_skills: List[str] = Field(default_factory=list)


class RoadmapResponse(BaseModel):
    role_name: str
    method_note: str   # Always documents that this is rule-based, not ML
    already_have: List[str]
    stages: List[RoadmapStage]
    projects: List[str]
    total_stages: int
    data_available: bool
    role_family: Optional[str] = None


# ── Role Catalog schemas ──────────────────────────────────────────────────────

class RoleSummary(BaseModel):
    """Lightweight role summary for listings."""
    role_id: Optional[str] = None
    role_name: str
    source_type: str
    role_family: Optional[str] = None
    role_category: Optional[str] = None
    emergence_tier: Optional[str] = None
    confidence_label: Optional[str] = None
    emergence_score: Optional[float] = None
    forecast_6m_bps: Optional[float] = None
    forecast_12m_bps: Optional[float] = None
    growth_pct_6m: Optional[float] = None
    growth_pct_12m: Optional[float] = None
    growth_tier: Optional[str] = None
    hype_cycle_stage: Optional[str] = None
    years_to_plateau: Optional[str] = None
    career_risk_profile: Optional[str] = None
    maturity_rationale: Optional[str] = None


class RoleDetail(BaseModel):
    """Full role details for the Role Details page."""
    role_id: Optional[str] = None
    role_name: str
    classification: Optional[str] = None
    source_type: str
    forecast_method: Optional[str] = None
    role_family: Optional[str] = None
    role_category: Optional[str] = None
    emergence_tier: Optional[str] = None
    emergence_score: Optional[float] = None
    confidence: Optional[float] = None
    confidence_label: Optional[str] = None
    current_demand_bps: Optional[float] = None
    forecast_6m_bps: Optional[float] = None
    forecast_12m_bps: Optional[float] = None
    growth_pct_6m: Optional[float] = None
    growth_pct_12m: Optional[float] = None
    growth_tier: Optional[str] = None
    hype_cycle_stage: Optional[str] = None
    years_to_plateau: Optional[str] = None
    career_risk_profile: Optional[str] = None
    maturity_rationale: Optional[str] = None
    li_posting_count: Optional[int] = None
    li_unique_companies: Optional[int] = None
    required_skills: List[str] = Field(default_factory=list)
    frontier_skills: List[str] = Field(default_factory=list)
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    persistence_quarters: Optional[int] = None
    market_breadth_score: Optional[float] = None
    representative_titles: Optional[List[str]] = None
    closest_known_role: Optional[str] = None
    shap_top_drivers: List[str] = Field(default_factory=list)
    evidence: Optional[str] = None


# ── Legacy models (kept for backward compatibility) ────────────────────────────

class CareerMatch(BaseModel):
    role: str
    title: str
    score: float


class ResultRequest(BaseModel):
    session_id: str


class ResultResponse(BaseModel):
    primary_archetype: str
    secondary_archetype: str
    baio_scores: List[float]
    confidence: float
    top_career_matches: List[CareerMatch]
    secondary_suggestions: List[str]


# ── Job Market Intelligence & Recommendation Schemas ──────────────────────────

class JobListingSummary(BaseModel):
    id: str
    external_id: Optional[str] = None
    title: str
    normalized_title: str
    company: str
    location: str
    location_type: str = "remote"  # remote, hybrid, onsite
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: str = "USD"
    experience_level: str = "Entry Level"
    employment_type: str = "Full-time"
    source: str = "Adzuna"
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    application_url: str
    posted_at: Optional[str] = None
    last_verified_at: Optional[str] = None
    compatibility_score: Optional[float] = None
    matching_skills: Optional[List[str]] = None
    missing_skills: Optional[List[str]] = None


class CompatibilityBreakdown(BaseModel):
    overall_score: float  # 0 to 100
    skill_match_score: float
    experience_score: float
    education_score: float
    role_alignment_score: float
    location_score: float
    matching_skills: List[str] = Field(default_factory=list)
    missing_mandatory_skills: List[str] = Field(default_factory=list)
    missing_preferred_skills: List[str] = Field(default_factory=list)
    why_matched: List[str] = Field(default_factory=list)
    how_to_improve: List[str] = Field(default_factory=list)


class JobListingDetail(JobListingSummary):
    description: str
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    category: str = "IT Jobs"
    salary_is_predicted: bool = False
    compatibility_breakdown: Optional[CompatibilityBreakdown] = None


class JobSearchQuery(BaseModel):
    query: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None  # remote, hybrid, onsite
    experience_level: Optional[str] = None
    min_salary: Optional[float] = None
    skills: Optional[List[str]] = None
    sort_by: str = "date"  # date, relevance, salary, compatibility
    page: int = 1
    page_size: int = 20


class JobListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    jobs: List[JobListingSummary]


class ExtendedUserProfileInput(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    education: Optional[str] = None
    degree_stream: Optional[str] = None
    experience_level: Optional[str] = None
    experience_years: Optional[float] = None
    work_mode_preference: Optional[str] = None
    declared_skills: Optional[List[str]] = None
    declared_interests: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    preferred_locations: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    work_experience: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[Dict[str, Any]]] = None


class ExtendedUserProfileResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    education: str
    degree_stream: str
    experience_level: str
    experience_years: float
    work_mode_preference: str
    declared_skills: List[str]
    declared_interests: List[str]
    target_roles: List[str]
    preferred_locations: List[str]
    projects: List[Dict[str, Any]]
    work_experience: List[Dict[str, Any]]
    certifications: List[Dict[str, Any]]
    resume_filename: Optional[str] = None
    created_at: str
    updated_at: str


class ResumeUploadResponse(BaseModel):
    success: bool
    filename: str
    extracted_name: Optional[str] = None
    extracted_email: Optional[str] = None
    extracted_skills: List[str] = Field(default_factory=list)
    extracted_education: Optional[str] = None
    extracted_experience_years: Optional[float] = None
    extracted_projects: List[Dict[str, Any]] = Field(default_factory=list)
    raw_text_preview: str = ""


class MissingSkillItem(BaseModel):
    skill: str
    frequency_in_jobs: int
    frequency_pct: float
    importance: str  # Critical, High, Moderate
    sample_jobs: List[str] = Field(default_factory=list)


class SkillGapMarketResponse(BaseModel):
    possessed_skills: List[str] = Field(default_factory=list)
    needs_improvement_skills: List[str] = Field(default_factory=list)
    missing_skills: List[MissingSkillItem] = Field(default_factory=list)
    total_target_jobs_analyzed: int
    target_roles: List[str] = Field(default_factory=list)


class ActionPlanItemDTO(BaseModel):
    id: Optional[int] = None
    stage: str  # Foundation, Core, Applied, Capstone
    priority: int
    title: str
    description: str
    target_skill: Optional[str] = None
    why_needed: Optional[str] = None
    learning_objectives: List[str] = Field(default_factory=list)
    practice_project: Optional[str] = None
    estimated_hours: int = 10
    status: str = "not_started"
    resources: List[Dict[str, str]] = Field(default_factory=list)


class ActionPlanGenerateRequest(BaseModel):
    user_id: str
    target_role: str
    target_job_id: Optional[str] = None


class CareerActionPlanResponse(BaseModel):
    id: str
    user_id: str
    target_role: str
    title: str
    summary: str
    total_estimated_hours: int
    items: List[ActionPlanItemDTO]
    created_at: str
    updated_at: str


class ActionPlanItemUpdate(BaseModel):
    status: str  # not_started, in_progress, completed


class AIChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    job_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class AIChatResponse(BaseModel):
    reply: str
    grounded_facts: List[str] = Field(default_factory=list)
    suggested_followups: List[str] = Field(default_factory=list)
    cited_jobs: List[Dict[str, Any]] = Field(default_factory=list)
    cited_skills: List[str] = Field(default_factory=list)


class MarketOverviewResponse(BaseModel):
    total_active_listings: int
    new_this_week: int
    top_demand_skills: List[Dict[str, Any]]
    top_hiring_roles: List[Dict[str, Any]]
    location_distribution: List[Dict[str, Any]]
    work_mode_distribution: Dict[str, int]
    experience_distribution: Dict[str, int]
    salary_insights: Dict[str, Any]
    emerging_roles_count: int
    forecasted_roles_count: int

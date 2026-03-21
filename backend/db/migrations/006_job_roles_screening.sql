-- 006: Add jd_text and screening_params to job_roles
ALTER TABLE job_roles
  ADD COLUMN IF NOT EXISTS jd_text         TEXT,
  ADD COLUMN IF NOT EXISTS screening_params JSONB DEFAULT '{}'::jsonb;

-- Seed UI Developer role screening params (Juspay-specific)
UPDATE job_roles
SET
  jd_text = 'We are looking for a UI Developer / Design Engineer with 1-2 years of frontend experience. You will build pixel-perfect, high-performance UIs for Juspay''s payment products. Strong grasp of React, Redux, JavaScript, Figma workflows, micro-interactions, typography, and color theory is essential. Experience with SaaS dashboards and design systems is a plus.',
  screening_params = '{
    "keywords": ["React", "Redux", "JavaScript", "Figma", "pixel-perfect", "micro-interactions", "SaaS", "TypeScript", "CSS", "design system"],
    "design_keywords": ["design principles", "typography", "color theory", "figma", "pixel-perfect", "micro-interactions", "accessibility"],
    "ideal_exp_min": 1,
    "ideal_exp_max": 2,
    "exp_bonus_threshold": 3,
    "keyword_weight": 0.4,
    "design_weight": 0.2,
    "exp_weight": 0.2,
    "ai_weight": 0.2
  }'::jsonb
WHERE LOWER(title) LIKE '%ui%'
   OR LOWER(title) LIKE '%frontend%'
   OR LOWER(title) LIKE '%design engineer%';

-- ════════════════════════════════════════════════════
-- Migration 001: Initial Schema
-- MarkQuiz — Quiz Constructor for Lead Generation
-- ════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search on titles

-- ─── QUIZZES ─────────────────────────────────────────
CREATE TABLE public.quizzes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  -- Уникальный slug для embed URL: /q/{slug}
  slug          TEXT UNIQUE NOT NULL,
  settings      JSONB NOT NULL DEFAULT '{
    "accentColor": "#6366f1",
    "showProgressBar": true,
    "showQuestionCount": true,
    "transition": "slide",
    "requireLeadBeforeResult": false
  }',
  is_published  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX idx_quizzes_slug    ON public.quizzes(slug);

-- ─── QUESTIONS ───────────────────────────────────────
-- Типы: single | multiple | text | slider | rating | date | lead_form
CREATE TABLE public.questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'single', 'multiple', 'text', 'slider', 'rating', 'date', 'lead_form'
  )),
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  -- Порядок отображения; 0-based, изменяется drag-and-drop
  position    INTEGER NOT NULL DEFAULT 0,
  settings    JSONB NOT NULL DEFAULT '{}',
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_quiz_id  ON public.questions(quiz_id);
CREATE INDEX idx_questions_position ON public.questions(quiz_id, position);

-- ─── OPTIONS ─────────────────────────────────────────
-- Варианты ответов для типов single и multiple
CREATE TABLE public.options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  image_url   TEXT,
  score       INTEGER DEFAULT 0,  -- для квизов-тестов с баллами
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_options_question_id ON public.options(question_id);

-- ─── LOGIC RULES ─────────────────────────────────────
-- Граф ветвления: если на source_question выбран option → перейти на target_question
-- target_question_id IS NULL означает "завершить квиз / показать результат"
CREATE TABLE public.logic_rules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id              UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  source_question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_id            UUID REFERENCES public.options(id) ON DELETE CASCADE,
  target_question_id   UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  condition_type       TEXT NOT NULL DEFAULT 'equals' CHECK (condition_type IN (
    'equals', 'not_equals', 'contains', 'greater_than', 'less_than'
  )),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logic_rules_quiz_id    ON public.logic_rules(quiz_id);
CREATE INDEX idx_logic_rules_source_q   ON public.logic_rules(source_question_id);

-- ─── QUIZ SESSIONS ───────────────────────────────────
-- Каждое открытие виджета = новая сессия
CREATE TABLE public.quiz_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- UTM-метки для аналитики источников
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  referrer     TEXT,
  user_agent   TEXT,
  -- Хранится хэш IP (не сам IP) для соответствия GDPR
  ip_hash      TEXT
);

CREATE INDEX idx_sessions_quiz_id    ON public.quiz_sessions(quiz_id);
CREATE INDEX idx_sessions_started_at ON public.quiz_sessions(quiz_id, started_at DESC);

-- ─── ANSWERS ─────────────────────────────────────────
CREATE TABLE public.answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  -- Для single/multiple: выбранные option_id
  option_ids  UUID[] NOT NULL DEFAULT '{}',
  -- Для text/slider/rating: строковое значение
  text_value  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_session_id  ON public.answers(session_id);
CREATE INDEX idx_answers_question_id ON public.answers(question_id);

-- ─── LEADS ───────────────────────────────────────────
CREATE TABLE public.leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  quiz_id       UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  -- Данные из кастомных полей lead_form
  custom_fields JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_quiz_id    ON public.leads(quiz_id);
CREATE INDEX idx_leads_created_at ON public.leads(quiz_id, created_at DESC);
CREATE INDEX idx_leads_email      ON public.leads(email) WHERE email IS NOT NULL;

-- ─── INTEGRATIONS ────────────────────────────────────
CREATE TABLE public.integrations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id    UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'webhook', 'email_notify', 'amocrm', 'bitrix24', 'telegram_bot', 'google_sheets'
  )),
  name       TEXT NOT NULL,
  -- Конфигурация специфична для типа интеграции
  -- webhook: { url, headers, method }
  -- amocrm:  { subdomain, access_token, pipeline_id }
  -- telegram: { bot_token, chat_id }
  config     JSONB NOT NULL DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrations_quiz_id ON public.integrations(quiz_id);

-- ─── HELPER: auto-update updated_at ──────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── VIEW: Quiz Stats ─────────────────────────────────
-- Используется в дашборде; пересчитывается при каждом запросе
CREATE OR REPLACE VIEW public.quiz_stats AS
SELECT
  q.id                                                    AS quiz_id,
  q.user_id,
  COUNT(DISTINCT s.id)                                    AS views,
  COUNT(DISTINCT a.session_id)                            AS starts,
  COUNT(DISTINCT s.id) FILTER (WHERE s.completed_at IS NOT NULL) AS completions,
  COUNT(DISTINCT l.id)                                    AS leads,
  ROUND(
    COUNT(DISTINCT s.id) FILTER (WHERE s.completed_at IS NOT NULL)::NUMERIC
    / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
  )                                                       AS completion_rate,
  ROUND(
    COUNT(DISTINCT l.id)::NUMERIC
    / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
  )                                                       AS conversion_rate
FROM public.quizzes q
LEFT JOIN public.quiz_sessions s ON s.quiz_id = q.id
LEFT JOIN public.answers a       ON a.session_id = s.id
LEFT JOIN public.leads l         ON l.quiz_id = q.id
GROUP BY q.id, q.user_id;
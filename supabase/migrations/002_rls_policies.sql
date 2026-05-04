-- ════════════════════════════════════════════════════
-- Migration 002: Row Level Security Policies
-- Принцип: каждый видит только свои данные
-- ════════════════════════════════════════════════════

-- Включаем RLS на всех таблицах
ALTER TABLE public.quizzes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logic_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- ─── QUIZZES ─────────────────────────────────────────
CREATE POLICY "Users manage own quizzes"
  ON public.quizzes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Публичный read-only доступ для виджета по slug
CREATE POLICY "Public can read published quizzes by slug"
  ON public.quizzes FOR SELECT
  USING (is_published = true);

-- ─── QUESTIONS ───────────────────────────────────────
CREATE POLICY "Users manage questions of own quizzes"
  ON public.questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

-- Виджет читает вопросы опубликованного квиза
CREATE POLICY "Public can read questions of published quizzes"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND is_published = true
    )
  );

-- ─── OPTIONS ─────────────────────────────────────────
CREATE POLICY "Users manage options of own questions"
  ON public.options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.quizzes z ON z.id = q.quiz_id
      WHERE q.id = question_id AND z.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can read options of published quizzes"
  ON public.options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.quizzes z ON z.id = q.quiz_id
      WHERE q.id = question_id AND z.is_published = true
    )
  );

-- ─── LOGIC RULES ─────────────────────────────────────
CREATE POLICY "Users manage logic of own quizzes"
  ON public.logic_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Public can read logic of published quizzes"
  ON public.logic_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND is_published = true
    )
  );

-- ─── SESSIONS ────────────────────────────────────────
-- Владелец квиза видит все сессии
CREATE POLICY "Quiz owners can view sessions"
  ON public.quiz_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

-- Анонимный пользователь (виджет) может создавать сессии
CREATE POLICY "Widget can insert sessions"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND is_published = true
    )
  );

-- Виджет может завершить свою сессию (UPDATE completed_at)
-- Используем service_role через Edge Function
CREATE POLICY "Widget can update own session"
  ON public.quiz_sessions FOR UPDATE
  USING (true) WITH CHECK (true);

-- ─── ANSWERS ─────────────────────────────────────────
CREATE POLICY "Quiz owners can view answers"
  ON public.answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions s
      JOIN public.quizzes q ON q.id = s.quiz_id
      WHERE s.id = session_id AND q.user_id = auth.uid()
    )
  );

CREATE POLICY "Widget can insert answers"
  ON public.answers FOR INSERT
  WITH CHECK (true);  -- Валидация на уровне Edge Function

-- ─── LEADS ───────────────────────────────────────────
CREATE POLICY "Quiz owners can view leads"
  ON public.leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Widget can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (true);  -- Валидация на уровне Edge Function

-- ─── INTEGRATIONS ────────────────────────────────────
CREATE POLICY "Users manage own integrations"
  ON public.integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

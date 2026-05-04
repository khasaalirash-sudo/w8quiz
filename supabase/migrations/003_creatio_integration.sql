-- ════════════════════════════════════════════════════
-- Migration 003: Creatio integration + webhook delivery logs
-- ════════════════════════════════════════════════════

-- Расширяем check constraint integrations.type для поддержки Creatio
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN (
    'webhook', 'email_notify', 'amocrm', 'bitrix24', 'telegram_bot',
    'google_sheets', 'creatio'
  ));

-- updated_at для integrations (триггера ещё нет на этой таблице)
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── WEBHOOK LOGS ────────────────────────────────────
-- Журнал попыток доставки лидов во внешние системы (Creatio, webhook).
-- Используется для дебага и отображения в UI клиенту.
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  -- HTTP статус последней попытки (200, 401, 500…). NULL = не дошло до запроса
  status          INT,
  -- Какая попытка из retry-цепочки (1..3)
  attempt         INT NOT NULL DEFAULT 1,
  request_body    JSONB,
  response_body   JSONB,
  error           TEXT,
  -- success | failed | retrying
  delivery_state  TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_state IN ('pending', 'success', 'failed', 'retrying')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_lead_id        ON public.webhook_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_integration_id ON public.webhook_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at     ON public.webhook_logs(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Владелец квиза видит логи своих интеграций
CREATE POLICY "Quiz owners can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.integrations i
      JOIN public.quizzes q ON q.id = i.quiz_id
      WHERE i.id = integration_id AND q.user_id = auth.uid()
    )
  );

-- Insert/update только через service_role (Edge Function)
-- — анонимные клиенты не должны писать в логи напрямую.

-- ─── Trigger: вызвать Edge Function при новом лиде ───
-- Используем pg_net для асинхронного http_post.
-- Edge Function URL и service role key передаются через app settings,
-- которые надо выставить в Supabase Cloud:
--   ALTER DATABASE postgres SET app.settings.edge_url       = 'https://<project>.supabase.co/functions/v1/creatio-deliver';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_key>';

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_lead_webhook()
RETURNS TRIGGER AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
BEGIN
  -- В dev/локально настройки могут быть пустыми — тогда триггер просто не вызывает функцию.
  edge_url    := current_setting('app.settings.edge_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('lead_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_webhook();

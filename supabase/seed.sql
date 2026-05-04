-- Seed data для локальной разработки
-- Создаёт тестового пользователя и один демо-квиз

-- ВАЖНО: этот файл использует service_role, поэтому обходит RLS.
-- Запуск: supabase db reset (автоматически запускает seed.sql после миграций)

DO $$
DECLARE
  demo_user_id  UUID := '00000000-0000-0000-0000-000000000001';
  quiz_id       UUID := gen_random_uuid();
  q1_id         UUID := gen_random_uuid();
  q2_id         UUID := gen_random_uuid();
  q3_id         UUID := gen_random_uuid();
  q_lead_id     UUID := gen_random_uuid();
  opt1_id       UUID := gen_random_uuid();
  opt2_id       UUID := gen_random_uuid();
  opt3_id       UUID := gen_random_uuid();
  opt4_id       UUID := gen_random_uuid();
  opt5_id       UUID := gen_random_uuid();
  opt6_id       UUID := gen_random_uuid();
BEGIN

-- Вставляем тестового пользователя в auth.users
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  demo_user_id,
  'demo@markquiz.io',
  NOW(), NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- Квиз: подбор кухонного гарнитура
INSERT INTO public.quizzes (id, user_id, title, description, slug, is_published)
VALUES (
  quiz_id,
  demo_user_id,
  'Подбор кухонного гарнитура',
  'Ответьте на 3 вопроса и получите персональный расчет стоимости',
  'kitchen-demo',
  true
);

-- Вопрос 1: тип кухни
INSERT INTO public.questions (id, quiz_id, type, title, position, is_required)
VALUES (q1_id, quiz_id, 'single', 'Какой стиль кухни вам ближе?', 0, true);

INSERT INTO public.options (id, question_id, text, position) VALUES
  (opt1_id, q1_id, 'Современный / минимализм', 0),
  (opt2_id, q1_id, 'Классика / прованс',        1),
  (opt3_id, q1_id, 'Скандинавский',              2);

-- Вопрос 2: бюджет (slider)
INSERT INTO public.questions (id, quiz_id, type, title, position, settings, is_required)
VALUES (q2_id, quiz_id, 'slider', 'Ваш бюджет на кухню?', 1,
  '{"slider": {"min": 100000, "max": 2000000, "step": 50000, "unit": "₸", "showValue": true}}',
  true
);

-- Вопрос 3: срок
INSERT INTO public.questions (id, quiz_id, type, title, position, is_required)
VALUES (q3_id, quiz_id, 'single', 'Когда планируете установку?', 2, true);

INSERT INTO public.options (id, question_id, text, position) VALUES
  (opt4_id, q3_id, 'В течение месяца', 0),
  (opt5_id, q3_id, 'От 1 до 3 месяцев', 1),
  (opt6_id, q3_id, 'Пока выбираю',      2);

-- Финальный шаг: лид-форма
INSERT INTO public.questions (id, quiz_id, type, title, position, settings, is_required)
VALUES (q_lead_id, quiz_id, 'lead_form', 'Получите расчёт на WhatsApp', 3,
  '{
    "leadForm": {
      "title": "Расчёт готов!",
      "subtitle": "Оставьте контакт — пришлём смету в течение 10 минут",
      "buttonText": "Получить расчёт",
      "fields": [
        {"id": "name", "type": "name",  "label": "Ваше имя",  "placeholder": "Алим", "required": true},
        {"id": "phone","type": "phone", "label": "Телефон",   "placeholder": "+7 (___) ___-__-__", "required": true}
      ],
      "privacyText": "Нажимая кнопку, вы соглашаетесь с обработкой персональных данных",
      "privacyUrl": "/privacy"
    }
  }',
  true
);

END $$;

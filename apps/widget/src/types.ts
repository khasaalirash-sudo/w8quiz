// Re-export shared types for use within the widget
// (without importing the full workspace package to keep bundle small)

export type {
  Quiz,
  Question,
  Option,
  LogicRule,
  QuizPayload,
  QuizSettings,
  LeadFormSettings,
  LeadFormField,
  SliderSettings,
  RatingSettings,
} from '@markquiz/shared'

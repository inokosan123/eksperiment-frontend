import { defaultPlanThemeId, type DayPlan, type PlanThemeId } from './dayPlanStore';

export type PlanVisual = {
  id: PlanThemeId;
  label: string;
  gradient: readonly [string, string, string];
  border: string;
  accent: string;
  accentSoft: string;
  ink: string;
  body: string;
  bloom: string;
  track: string;
};

export const PLAN_VISUALS: readonly PlanVisual[] = [
  { id: 'gold', label: 'Amber', gradient: ['#F2DEAA', '#FFF6DF', '#FFFDF8'], border: '#DFC177', accent: '#98691B', accentSoft: 'rgba(197,160,89,0.17)', ink: '#59400F', body: '#796333', bloom: 'rgba(197,160,89,0.22)', track: '#E9D29B' },
  { id: 'teal', label: 'Sage', gradient: ['#CEE7DD', '#EFF8F4', '#FCFEFD'], border: '#A7CDBE', accent: '#2D7162', accentSoft: 'rgba(61,130,115,0.15)', ink: '#1D4A41', body: '#4E746A', bloom: 'rgba(61,130,115,0.20)', track: '#BDDCCF' },
  { id: 'plum', label: 'Violet', gradient: ['#E4DAF3', '#F5F0FC', '#FDFBFF'], border: '#C9B9E5', accent: '#664E9F', accentSoft: 'rgba(103,80,164,0.14)', ink: '#3D2D6C', body: '#6C5E8C', bloom: 'rgba(103,80,164,0.19)', track: '#D6C9EA' },
  { id: 'blue', label: 'Sky', gradient: ['#D6E7F5', '#F0F7FC', '#FCFEFF'], border: '#B2CEE6', accent: '#376C9D', accentSoft: 'rgba(62,111,158,0.14)', ink: '#21486C', body: '#57738D', bloom: 'rgba(62,111,158,0.19)', track: '#C4DBED' },
  { id: 'rose', label: 'Rose', gradient: ['#F1D8DF', '#FFF1F4', '#FFFCFD'], border: '#E5B4C0', accent: '#A33E57', accentSoft: 'rgba(167,68,91,0.14)', ink: '#6A2637', body: '#885663', bloom: 'rgba(167,68,91,0.19)', track: '#ECC9D1' },
  { id: 'clay', label: 'Clay', gradient: ['#F2D9C3', '#FFF3E9', '#FFFCF9'], border: '#E3B995', accent: '#A45625', accentSoft: 'rgba(168,93,43,0.14)', ink: '#683211', body: '#866047', bloom: 'rgba(168,93,43,0.19)', track: '#EACBB0' },
] as const;

export function planVisualForTheme(themeId: PlanThemeId): PlanVisual {
  return PLAN_VISUALS.find(visual => visual.id === themeId) ?? PLAN_VISUALS[0];
}

export function planVisualFor(plan: Pick<DayPlan, 'id' | 'themeId'>): PlanVisual {
  return planVisualForTheme(plan.themeId ?? defaultPlanThemeId(plan.id));
}

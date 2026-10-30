import { RESEARCH_DESIGN } from './TownDesign';
export interface ResearchState {
  version: 1; points: number; timer: number; towerBuilt: boolean; outputBonus: number;
  lastRound: number; wildWaves: string[]; settlementSupportPaid: boolean;
  periodReduction?: number;
}
export const RESEARCH_RULES = RESEARCH_DESIGN;
export function newResearchState(lastRound = 0): ResearchState {
  return { version: 1, points: 0, timer: 0, towerBuilt: false, outputBonus: 0, lastRound, wildWaves: [], settlementSupportPaid: false };
}
export function validResearchState(value: ResearchState): boolean {
  return !!value && value.version === 1 && Number.isSafeInteger(value.points) && value.points >= 0 &&
    Number.isFinite(value.timer) && value.timer >= 0 && value.timer < researchPeriod(value) && typeof value.towerBuilt === 'boolean' &&
    (value.periodReduction === undefined || (Number.isFinite(value.periodReduction) && value.periodReduction >= 0 && value.periodReduction <= 29)) &&
    Number.isSafeInteger(value.outputBonus) && value.outputBonus >= 0 && Number.isSafeInteger(value.lastRound) && value.lastRound >= 0 &&
    Array.isArray(value.wildWaves) && value.wildWaves.length <= 50000 && value.wildWaves.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128) &&
    new Set(value.wildWaves).size === value.wildWaves.length && typeof value.settlementSupportPaid === 'boolean';
}
export function researchYield(state: ResearchState, base: number): number { return base + state.outputBonus; }
export function researchPeriod(state: ResearchState): number { return Math.max(1, RESEARCH_RULES.seconds - (state.periodReduction ?? 0)); }
export function tickResearch(state: ResearchState, dt: number): number {
  if (!state.towerBuilt || !Number.isFinite(dt) || dt <= 0) return 0;
  state.timer += dt;
  const period = researchPeriod(state);
  const cycles = Math.floor((state.timer + 1e-8) / period);
  if (!cycles) return 0;
  state.timer = Math.max(0, state.timer - cycles * period);
  const amount = cycles * researchYield(state, RESEARCH_RULES.passive); state.points += amount; return amount;
}
export function researchRound(state: ResearchState, round: number): number {
  if (!Number.isSafeInteger(round) || round !== state.lastRound + 1) return 0;
  state.lastRound = round;
  const amount = researchYield(state, RESEARCH_RULES.round); state.points += amount; return amount;
}
export function researchWildWave(state: ResearchState, waveId: string): number {
  if (!waveId || waveId.length > 128 || state.wildWaves.includes(waveId)) return 0;
  state.wildWaves.push(waveId);
  const amount = researchYield(state, RESEARCH_RULES.wildWave); state.points += amount; return amount;
}
export function researchSettlementSupport(state: ResearchState): number {
  if (state.settlementSupportPaid) return 0;
  state.settlementSupportPaid = true;
  const amount = researchYield(state, RESEARCH_RULES.settlementSupport); state.points += amount; return amount;
}

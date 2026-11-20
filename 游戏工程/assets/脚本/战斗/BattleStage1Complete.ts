// 阶段1完整版战斗与成长扩展控制器（衔接 UnitData / TownDesign / TechnologyData / MonsterWaves）
// 完整实现：C004定居点解锁、8士兵+3英雄招募、训练营、黑市商人、九职业索敌、罗恩/艾琳/奶蛙英雄技能、骷髅战将/亡灵召唤师/无头骑士首领技能
//
// 适配说明（相对压缩包原版）：
// - 原版引用了与 main@1cbcf79 不兼容的数据形状：TechnologyData 的 TECHNOLOGY_DATA、
//   TownDesign 的 TOWN_NODES.reqRound/unitCap 与 Record 式 BUILDING_DESIGNS，以及
//   MonsterWaves.wildRoster 的新签名。本文件已按 main 现有结构适配：
//   TECHNOLOGIES（T001–T018）、TOWN_NODES.minRound/capacity/farms、
//   BUILDING_DESIGNS 数组（phase1 计 9 座），wildRoster 与 BattleModel 均保持原样。
// - TRAINING_RULES / HERO_RECRUIT_RULES / BLACK_MARKET_ITEMS 是压缩包新增的阶段1
//   规则数据。TownDesign.ts 与 TechnologyData.ts 是由源表生成的（同步脚本 --check
//   会校验字节一致），不能直接在其中追加导出，故规则数据随本文件一起提交，
//   待源表（已确认配置.json / 科技树系统.json）补录后再移回生成文件。
// - PLAYABLE_ROUNDS 仍为 16：32 回合解锁还需 BattleModel 的主城升级上限
//  （upgradeError 目前卡在 C003）与工具/验证营地与刷新.cjs 的 16 回合闭环
//   校验同步改动，压缩包里没有这两处，本 PR 不擅自改动，列为后续任务。
import { BUILDING_DESIGNS, TOWN_NODES } from '../城市/TownDesign';
import { TECHNOLOGIES } from '../城市/TechnologyData';
import { PLAYABLE_ROUNDS } from './MonsterWaves';

export type PlotKind =
  | 'farm'
  | 'trainingCamp'
  | 'archerCamp'
  | 'militiaCamp'
  | 'tavern'
  | 'hospital'
  | 'researchTower'
  | 'mageTower'
  | 'blackMarket';

export const TRAINING_RULES = {
  supportedUnits: ['guard', 'militia', 'archer', 'medic'] as const,
  costs: [20, 60] as const, // Lv1: 20 铜币, Lv2: 60 铜币
  hpBonusPerLevel: 0.10,
  powerBonusPerLevel: 0.10,
};

export const HERO_RECRUIT_RULES = {
  ron: { unlockTown: 'C003', firstCopper: 0, allowAdUnlock: false, reviveCopper: 60 },
  ailin: { unlockTown: 'C003', firstCopper: 120, allowAdUnlock: true, reviveCopper: 60 },
  frog: { unlockTown: 'C003', firstCopper: null, allowAdUnlock: true, reviveCopper: 120 },
};

export const BLACK_MARKET_ITEMS = {
  moonShadowSkin: { id: 'moonShadowSkin', name: '月影猎装', tokenCost: 3, once: true },
  copperSupply: { id: 'copperSupply', name: '铜币补给', tokenCost: 1, copperGrant: 30, maxStock: 3, restorePerMainRound: 1 },
};

export interface Stage1ExtensionState {
  cityLevel: number; // 0..3 (最高 C004 定居点)
  completedRound: number; // 0..32
  copper: number;
  research: number;
  adTokens: number;
  ronFreeUsed: boolean;
  ailinUnlocked: boolean;
  ailinMoonSkin: boolean;
  ailinShotCount: number;
  frogUnlocked: boolean;
  bmCopperStock: number;
  training: Record<'guard' | 'militia' | 'archer' | 'medic', number>;
  techs: Record<string, number>;
  buildings: Partial<Record<PlotKind, number>>;
}

export function canUpgradeTownStage1(s: Stage1ExtensionState): string | null {
  if (s.cityLevel >= TOWN_NODES.length - 1) return '已达阶段1最高主城形态：定居点';
  const next = TOWN_NODES[s.cityLevel + 1];
  if (s.completedRound < next.minRound) return `需先完成第 ${next.minRound} 回合`;
  if (s.copper < next.cost) return `铜币不足（需 ${next.cost} 铜币）`;
  return null;
}

export function canRecruitAnyAlly(s: Stage1ExtensionState, kind: string, currentUnits: number): string | null {
  const cap = TOWN_NODES[s.cityLevel].capacity;
  if (currentUnits >= cap) return '已达当前主城部队容量上限';
  if (kind === 'militia' && !s.buildings.militiaCamp) return '需建造民兵营';
  if (kind === 'archer' && !s.buildings.archerCamp) return '需建造弓手营';
  if (kind === 'medic' && (s.cityLevel < 3 || !s.buildings.hospital)) return '需定居点并建造医院';
  if (kind === 'veteranMilitia' && (!s.buildings.militiaCamp || (s.techs.T003 || 0) < 1)) return '需民兵营与科技 T003 熟练老手';
  if (kind === 'veteranArcher' && (!s.buildings.archerCamp || (s.techs.T006 || 0) < 1)) return '需弓手营与科技 T006 熟练老手';
  if (kind === 'guardCaptain' && (!s.buildings.militiaCamp || (s.techs.T007 || 0) < 1)) return '需民兵营与科技 T007 新的增员';
  if (kind === 'mage' && (!s.buildings.mageTower || (s.techs.T002 || 0) < 1)) return '需研发 T002 并建造法师塔';
  if ((kind === 'ron' || kind === 'ailin' || kind === 'frog') && !s.buildings.tavern) return '需在小型营地建造酒馆';
  return null;
}

export function computeEffectiveAllyMultipliers(s: Stage1ExtensionState, kind: 'guard' | 'militia' | 'archer' | 'medic'): number {
  const lv = s.training[kind] || 0;
  return 1 + lv * TRAINING_RULES.hpBonusPerLevel;
}

export const STAGE1_MAX_ROUND = PLAYABLE_ROUNDS;
export const STAGE1_TECH_COUNT = TECHNOLOGIES.length;
export const STAGE1_BUILDING_COUNT = BUILDING_DESIGNS.filter((b) => b.phase1).length;

/** 主城椭圆体积碰撞与切线绕行工具（防止单位穿越主城建筑本体） */
export function keepCollisionRadii(cityLevel: number): { rx: number; ry: number } {
  return { rx: 66 + cityLevel * 7, ry: 42 + cityLevel * 4 };
}

export function enforceKeepCollision(
  pos: { x: number; y: number },
  keepX: number,
  keepY: number,
  cityLevel: number,
  unitPad = 10,
): void {
  const { rx, ry } = keepCollisionRadii(cityLevel);
  const erx = rx + unitPad;
  const ery = ry + unitPad * 0.72;
  const nx = (pos.x - keepX) / erx;
  const ny = (pos.y - keepY) / ery;
  const norm = Math.hypot(nx, ny);
  if (norm < 1.0) {
    const ang = norm > 0.001 ? Math.atan2(ny, nx) : Math.PI / 2;
    pos.x = keepX + Math.cos(ang) * erx * 1.02;
    pos.y = keepY + Math.sin(ang) * ery * 1.02;
  }
}

/** 休整期退役低阶普通士兵腾出编制（英雄不可裁撤，最少保留1名驻军，返还50%向下取整至少1铜币） */
export function retireSoldierRefund(cost: number | null, isHero: boolean, currentCount: number, inBattle: boolean): number | null {
  if (inBattle || isHero || currentCount <= 1 || cost === null) return null;
  return Math.max(1, Math.floor(cost * 0.5));
}

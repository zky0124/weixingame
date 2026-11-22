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
// - PLAYABLE_ROUNDS 已为 32（v5.1 后续）：主城升级上限已放开到 C004，
//   工具/验证营地与刷新.cjs 已改为 32 回合闭环，农田可随主城升至 3 级。
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
// v5.1 新增（来自 weixingame_cocos388_stage1_v5.1.zip，v3.8-v5.1 累计）：
// 敌情威胁标签与一键集火、浮动文字防重叠、英雄被动蓄力指示、Tab 集火循环、
// 驻军三态阵型、战后 MVP 战报、战前一键整备、光环受惠角标、原位晋升报价、
// 放射科技树推荐、换防、图鉴动作合图、战力评估、任意回合演练、集火情报卡、
// 农田升级、满编替补、地面贴花、边缘雷达、经济简报、训练营进阶、镜头跳转、
// 路口调防、补建推荐、训练星级、手机端适配。
// 以上均为纯函数，不引用本文件头部的数据导入（TECHNOLOGIES / TOWN_NODES /
// BUILDING_DESIGNS）与 main 的数据结构，原样沿用，无需改动。

/** v3.8 波次敌情威胁标签与克制建议（用于战前提示及战中快捷点选集火同种敌军） */
export interface WaveEnemyThreatTag {
  kind: string;
  count: number;
  tag: string;
  counterTip: string;
}

export function analyzeWaveThreatTags(groups: Array<[string, number]>): WaveEnemyThreatTag[] {
  const tipMap: Record<string, { tag: string; tip: string }> = {
    wolf: { tag: '刺客突袭', tip: '高速切后排，建议配置【护卫/护卫队长】分摊并反制(+30%伤害)' },
    ghost: { tag: '高甲幽灵', tip: '物甲5但魔抗-5，建议用【魔法师】或【奶蛙】魔法重击并由护卫拦截' },
    shieldGoblin: { tag: '重甲前排', tip: '重甲吸收弓手火力，优先集火后方远程或用魔法破甲' },
    zombie: { tag: '重甲尸潮', tip: '高血高物甲魔抗0，【魔法师】会自动优先狙击重甲目标' },
    healerGoblin: { tag: '战地治疗', tip: '持续恢复哥布林同伴，建议开战后点击标签或单位下达【集火】' },
    mageGoblin: { tag: '魔法打击', tip: '无视护甲打击重甲前排，建议用弓箭手或艾琳远程点杀' },
    siegeGoblin: { tag: '远程攻城', tip: '对主城造成150%巨额伤害，务必第一时间点击下达【集火】摧毁' },
    goblinBoss: { tag: '首领号令', tip: '周围4格哥布林护甲+1，自身魔抗-3，极其惧怕魔法与集火' },
    necromancer: { tag: '召唤核心', tip: '超远距治疗且每5秒召唤骷髅，出现蓄力紫圈时务必第一时间【集火】斩首' },
    skeletonGeneral: { tag: '亡者转化', tip: '阵亡友军1秒后化为骷髅，需保持医院满血与高阶魔法师压制' },
    headlessKnight: { tag: '终局首领', tip: '恐惧光环降甲3+定期召亡灵大军+暗影箭，注意脚下蓄力预警圈并集火' },
  };
  return groups.map(([kind, count]) => {
    const info = tipMap[kind] || { tag: '常规敌军', tip: '保持前排护卫/战士抗线，后排弓手稳定输出' };
    return { kind, count, tag: info.tag, counterTip: info.tip };
  });
}

/** v3.8 浮动战斗文字空间防重叠偏移计算（防止多段伤害/分摊/治疗同帧重叠） */
export function computeFloatTextPosition(
  existing: Array<{ x: number; y: number; life: number; maxLife: number }>,
  x: number,
  y: number,
): { x: number; y: number } {
  let nearby = 0;
  for (const ft of existing) {
    if (ft.life > ft.maxLife * 0.45 && Math.hypot(ft.x - x, ft.y - y) < 28) {
      nearby++;
    }
  }
  if (nearby === 0) return { x, y };
  const sideShift = (nearby % 2 === 1 ? 1 : -1) * Math.min(20, 7 * Math.ceil(nearby / 2));
  return { x: x + sideShift, y: y - Math.min(42, nearby * 12) };
}

/** v3.9 英雄被动技能蓄力层数指示器计算（艾琳每3箭追射、奶蛙每2击附带10点魔伤） */
export interface HeroPassiveChargeInfo {
  maxPips: number;
  filledPips: number;
  readyNextStrike: boolean;
  label: string;
}

export function computeHeroChargePips(
  heroKind: string,
  ailinShotCount: number,
  frogStrikeCount: number,
  frogLaughUsed: boolean,
): HeroPassiveChargeInfo | null {
  if (heroKind === 'ailin') {
    const filled = ((ailinShotCount || 0) % 3);
    return {
      maxPips: 3,
      filledPips: filled,
      readyNextStrike: filled === 2,
      label: filled === 2 ? '⚡下一箭触发追猎连射' : `追猎蓄力 ${filled}/3`,
    };
  }
  if (heroKind === 'frog') {
    const filled = ((frogStrikeCount || 0) % 2);
    return {
      maxPips: 2,
      filledPips: filled,
      readyNextStrike: filled === 1,
      label: `${filled === 1 ? '🐸下一击+10魔伤' : '武术蓄力 0/2'}${frogLaughUsed ? ' · 护盾已触发' : ' · 狂笑护盾待命'}`,
    };
  }
  return null;
}

/** v3.9 战术快捷键 Tab 循环切换高威胁集火敌军（优先首领/召唤师/攻城车/治疗师，再按距主城距离排序） */
export function selectNextCycleFocusEnemy(
  enemies: Array<{ uid: string; kind: string; hp: number; x: number; y: number }>,
  currentFocusUid: string | null,
  keepX: number,
  keepY: number,
): string | null {
  const living = enemies.filter(e => e.hp > 0);
  if (living.length === 0) return null;
  const priorityWeight: Record<string, number> = {
    headlessKnight: 100,
    goblinBoss: 95,
    necromancer: 90,
    skeletonGeneral: 85,
    siegeGoblin: 80,
    healerGoblin: 75,
    mageGoblin: 70,
    skeletonMage: 68,
    ghost: 65,
    wolf: 62,
  };
  living.sort((a, b) => {
    const pa = priorityWeight[a.kind] || 10;
    const pb = priorityWeight[b.kind] || 10;
    if (pb !== pa) return pb - pa;
    return Math.hypot(a.x - keepX, a.y - keepY) - Math.hypot(b.x - keepX, b.y - keepY);
  });
  if (!currentFocusUid) return living[0].uid;
  const idx = living.findIndex(e => e.uid === currentFocusUid);
  return living[(idx + 1) % living.length].uid;
}

/** v4.0 驻军三态战术阵型坐标计算（standard 标准迎击 / compact 紧缩护城防刺客 / expanded 外扩压制攻城车） */
export type FormationStanceMode = 'standard' | 'compact' | 'expanded';

export function computeFormationSlotPosition(
  idx: number,
  total: number,
  range: number,
  keepX: number,
  keepY: number,
  mode: FormationStanceMode = 'standard',
): { x: number; y: number } {
  const isRanged = range > 1.5;
  const scaleMult = mode === 'compact' ? 0.86 : mode === 'expanded' ? 1.16 : 1.0;
  const rx = (isRanged ? 112 : 148) * scaleMult;
  const ry = (isRanged ? 76 : 102) * scaleMult;
  const angle = -Math.PI / 2 + (idx / Math.max(1, total)) * Math.PI * 2;
  return {
    x: keepX + Math.cos(angle) * rx,
    y: keepY + Math.sin(angle) * ry,
  };
}

/** v4.0 单波战斗伤害/治疗/承伤统计与 MVP 评选计算 */
export interface WaveCombatStatsMap {
  dmgDealt: Record<string, number>;
  healDone: Record<string, number>;
  dmgTaken: Record<string, number>;
}

export interface WaveMvpSummary {
  mvpKind: string | null;
  mvpScore: number;
  mvpDmg: number;
  mvpHeal: number;
  mvpTaken: number;
  totalDmg: number;
  totalHeal: number;
  totalTaken: number;
}

export function computeWaveMvpSummary(stats: WaveCombatStatsMap): WaveMvpSummary {
  const kinds = new Set<string>([
    ...Object.keys(stats.dmgDealt || {}),
    ...Object.keys(stats.healDone || {}),
    ...Object.keys(stats.dmgTaken || {}),
  ]);
  let mvpKind: string | null = null;
  let mvpScore = -1;
  let totalDmg = 0;
  let totalHeal = 0;
  let totalTaken = 0;

  for (const k of kinds) {
    const d = Math.round(stats.dmgDealt[k] || 0);
    const h = Math.round(stats.healDone[k] || 0);
    const t = Math.round(stats.dmgTaken[k] || 0);
    totalDmg += d;
    totalHeal += h;
    totalTaken += t;
    const score = d + h * 1.2 + t * 0.8;
    if (score > mvpScore) {
      mvpScore = score;
      mvpKind = k;
    }
  }
  return {
    mvpKind,
    mvpScore: Math.max(0, Math.round(mvpScore)),
    mvpDmg: mvpKind ? Math.round(stats.dmgDealt[mvpKind] || 0) : 0,
    mvpHeal: mvpKind ? Math.round(stats.healDone[mvpKind] || 0) : 0,
    mvpTaken: mvpKind ? Math.round(stats.dmgTaken[mvpKind] || 0) : 0,
    totalDmg,
    totalHeal,
    totalTaken,
  };
}

/** v4.1 战前智能战术备战诊断与一键整备评估（自动计算医院疗伤、修补城防与针对敌情推荐阵型） */
export interface PreWaveReadinessPlan {
  healCost: number;
  repairCost: number;
  totalCost: number;
  recommendedFormation: FormationStanceMode;
  reasonText: string;
}

export function evaluatePreWaveReadiness(
  castleHp: number,
  maxCastleHpVal: number,
  injuredMissingHp: number,
  hasHospital: boolean,
  nextWaveGroups: Array<[string, number]>,
): PreWaveReadinessPlan {
  const healCost = hasHospital && injuredMissingHp > 0 ? Math.max(1, Math.ceil(injuredMissingHp / 20)) : 0;
  const missingCastle = Math.max(0, Math.ceil(maxCastleHpVal - castleHp));
  const repairCost = missingCastle > 0 ? Math.max(1, Math.ceil(missingCastle / 5)) : 0;
  const hasAssassin = nextWaveGroups.some(([k]) => k === 'wolf' || k === 'ghost');
  const hasSiege = nextWaveGroups.some(([k]) => k === 'siegeGoblin');
  let recommendedFormation: FormationStanceMode = 'standard';
  let reasonText = '均衡迎击阵型';
  if (hasAssassin) {
    recommendedFormation = 'compact';
    reasonText = '检测到刺客（狼/游魂），推荐【紧缩护城】享护卫100%分摊';
  } else if (hasSiege) {
    recommendedFormation = 'expanded';
    reasonText = '检测到攻城战车，推荐【外扩压制】提前拦截';
  }
  return {
    healCost,
    repairCost,
    totalCost: healCost + repairCost,
    recommendedFormation,
    reasonText,
  };
}

/** v4.1 单位头顶光环受惠/减益状态角标判定（罗恩坚守+1双抗 / 哥布林头领号令+1甲 / 无头骑士恐惧-3甲） */
export function computeActiveAuraBadges(
  unitSide: 'ally' | 'enemy',
  unitKind: string,
  ronAlive: boolean,
  inHeadlessFearAura: boolean,
  inGoblinBossAura: boolean,
): string[] {
  const badges: string[] = [];
  if (unitSide === 'ally') {
    if (ronAlive) badges.push('🛡️+1');
    if (inHeadlessFearAura) badges.push('💜-3');
  } else if (unitKind !== 'goblinBoss' && inGoblinBossAura) {
    badges.push('👑+1');
  }
  return badges;
}

/** v4.2 休整期低阶士兵原位补差晋升精锐报价计算（护卫->护卫队长，民兵->熟练民兵，弓箭手->熟练弓箭手） */
export interface SoldierPromotionQuote {
  fromKind: string;
  toKind: string;
  toName: string;
  netCost: number;
  canPromote: boolean;
  reason: string;
}

export function computeSoldierPromotionQuote(
  fromKind: string,
  hasMilitiaCamp: boolean,
  hasArcherCamp: boolean,
  techs: Record<string, number>,
  copper: number,
  inBattle: boolean,
): SoldierPromotionQuote | null {
  const map: Record<string, { toKind: string; toName: string; baseCost: number; toCost: number; reqTech: string; reqCamp: 'militia' | 'archer' }> = {
    guard: { toKind: 'guardCaptain', toName: '护卫队长', baseCost: 1, toCost: 45, reqTech: 'T007', reqCamp: 'militia' },
    militia: { toKind: 'veteranMilitia', toName: '熟练民兵', baseCost: 8, toCost: 25, reqTech: 'T003', reqCamp: 'militia' },
    archer: { toKind: 'veteranArcher', toName: '熟练弓箭手', baseCost: 10, toCost: 35, reqTech: 'T006', reqCamp: 'archer' },
  };
  const cfg = map[fromKind];
  if (!cfg) return null;
  const refund = Math.max(1, Math.floor(cfg.baseCost * 0.5));
  const netCost = Math.max(1, cfg.toCost - refund);
  if (inBattle) {
    return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: false, reason: '交战中不可晋升' };
  }
  if (cfg.reqCamp === 'militia' && !hasMilitiaCamp) {
    return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: false, reason: '需建造民兵营' };
  }
  if (cfg.reqCamp === 'archer' && !hasArcherCamp) {
    return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: false, reason: '需建造弓手营' };
  }
  if ((techs[cfg.reqTech] || 0) < 1) {
    return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: false, reason: `需科技${cfg.reqTech}` };
  }
  if (copper < netCost) {
    return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: false, reason: `需补差${netCost}铜币` };
  }
  return { fromKind, toKind: cfg.toKind, toName: cfg.toName, netCost, canPromote: true, reason: `补差${netCost}铜币直升` };
}

/** v4.2 放射科技树下一优先推荐研发节点判定（指引定居点阶段最优破甲与精锐解锁路线） */
export function recommendNextStage1Tech(
  techs: Record<string, number>,
  hasHospital: boolean,
  farmCount: number,
): string | null {
  const priorityOrder = [
    'T002', // 法师塔学识（克制第20-32回合重甲僵尸/骷髅战将/游魂）
    'T007', // 新的增员（解锁护卫队长）
    'T012', // 加固城防（主城+50HP）
    'T014', // 招募学徒（研究周期30s->20s）
    'T004', // 见习法师（法师攻击+2/级）
    'T008', // 护甲强化（护卫护甲+1/级）
    'T005', // 弓术强化
    'T006', // 熟练弓箭手
    'T001', // 攻击强化
    'T003', // 熟练民兵
    'T017', // 医疗救援队（全体回血）
    'T018', // 高效医疗设施
    'T009', // 荒地开垦
    'T010', // 改良种植
    'T013', // 修复工匠
  ];
  const maxLvMap: Record<string, number> = {
    T001: 5, T002: 1, T003: 1, T004: 5, T005: 5, T006: 1,
    T007: 1, T008: 5, T009: 1, T010: 1, T011: 3, T012: 1,
    T013: 3, T014: 1, T015: 3, T016: 1, T017: 1, T018: 1,
  };
  for (const tid of priorityOrder) {
    const cur = techs[tid] || 0;
    if (cur >= (maxLvMap[tid] || 1)) continue;
    if (tid === 'T017' && !hasHospital) continue;
    if (tid === 'T011' && farmCount < 3) continue;
    return tid;
  }
  return null;
}

/** v4.3 休整期驻军防线槽位自由换位与顺时针轮换（便于将罗恩/奶蛙/护卫队长调往首领或攻城车来袭路口） */
export function swapAllyFormationSlots<T extends { uid: string; x: number; y: number; homeX: number; homeY: number }>(
  units: T[],
  uidA: string,
  uidB?: string | null,
): boolean {
  const idxA = units.findIndex(u => u.uid === uidA);
  if (idxA < 0 || units.length < 2) return false;
  const idxB = uidB ? units.findIndex(u => u.uid === uidB) : (idxA + 1) % units.length;
  if (idxB < 0 || idxA === idxB) return false;
  const a = units[idxA];
  const b = units[idxB];
  const tmpHX = a.homeX, tmpHY = a.homeY;
  a.homeX = b.homeX; a.homeY = b.homeY;
  b.homeX = tmpHX; b.homeY = tmpHY;
  a.x = a.homeX; a.y = a.homeY;
  b.x = b.homeX; b.y = b.homeY;
  units[idxA] = b;
  units[idxB] = a;
  return true;
}

/** v4.3 图鉴 28 单位三态动作图集（9x6 动作合图）行列坐标查询 */
export function getUnitActionAtlasCoords(
  unitIndex: number,
  mode: 'idle' | 'walk' | 'attack',
): { col: number; row: number } | null {
  if (mode === 'idle' || unitIndex < 0 || unitIndex > 26) return null;
  const col = unitIndex % 9;
  const row = Math.floor(unitIndex / 9) * 2 + (mode === 'attack' ? 0 : 1);
  return { col, row };
}

/** v4.4 战前敌我战力对比与破甲/防刺客克制就绪度评估 */
export interface WavePowerEvaluation {
  allyScore: number;
  enemyScore: number;
  ratio: number;
  statusTag: string;
  counterNote: string;
}

export function evaluateWavePowerMatchup(
  allyScore: number,
  enemyScore: number,
  hasHeavyOrHighArmorEnemy: boolean,
  hasMageAlly: boolean,
  hasAssassinEnemy: boolean,
  hasGuardAlly: boolean,
): WavePowerEvaluation {
  const safeEnemy = Math.max(1, enemyScore);
  const ratio = Math.round((allyScore / safeEnemy) * 100) / 100;
  let statusTag = '🟢 战力占优';
  if (ratio < 0.85) statusTag = '🔴 强敌预警';
  else if (ratio < 1.15) statusTag = '🟡 势均力敌';

  const notes: string[] = [];
  if (hasHeavyOrHighArmorEnemy) {
    notes.push(hasMageAlly ? '🔮破甲就绪' : '⚠️建议募魔法师破甲');
  }
  if (hasAssassinEnemy) {
    notes.push(hasGuardAlly ? '🛡️反刺客就绪' : '⚠️建议配护卫防刺客');
  }
  if (notes.length === 0) notes.push('⚔️阵容均衡');

  return {
    allyScore: Math.round(allyScore),
    enemyScore: Math.round(enemyScore),
    ratio,
    statusTag,
    counterNote: notes.join(' · '),
  };
}

/** v4.4 波次总表任意回合（1-32）一键实战演练标准配置生成器 */
export function buildRoundSkirmishTier(targetRound: number): {
  cityLevel: number;
  completedRound: number;
  copper: number;
  research: number;
} {
  const r = Math.max(1, Math.min(32, Math.floor(targetRound)));
  if (r <= 1) return { cityLevel: 0, completedRound: 0, copper: 0, research: 0 };
  if (r <= 8) return { cityLevel: 1, completedRound: r - 1, copper: 45 + r * 8, research: 0 };
  if (r <= 20) return { cityLevel: 2, completedRound: r - 1, copper: 90 + r * 10, research: 0 };
  return { cityLevel: 3, completedRound: r - 1, copper: 260 + (r - 20) * 18, research: 65 + (r - 20) * 6 };
}

/** v4.5 集火敌军实时有效双抗、召唤倒计时与弱点诊断格式化 */
export function formatFocusedEnemyTacticalReadout(
  attack: number,
  heal: number,
  effectiveArmor: number,
  effectiveRes: number,
  speed: number,
  drop: number,
  summonCountdown?: number | null,
): string {
  const parts: string[] = [];
  parts.push(heal > 0 ? `💚治疗${heal}` : `⚔️攻${attack}`);
  parts.push(`🛡️甲${effectiveArmor}${effectiveArmor >= 3 ? '(重甲)' : effectiveArmor < 0 ? '(脆甲!)' : ''}`);
  parts.push(`✨抗${effectiveRes}${effectiveRes < 0 ? '(弱魔!)' : ''}`);
  parts.push(`👟速${speed}`);
  if (typeof summonCountdown === 'number' && summonCountdown > 0) {
    parts.push(`⏳召唤${summonCountdown.toFixed(1)}s`);
  } else if (drop > 0) {
    parts.push(`💰掉${drop}🪙`);
  }
  return parts.join(' ｜ ');
}

/** v4.5 检索城内下一块可升级的最低等级农田地块及所需铜币 */
export function findNextUpgradableFarmPlot(
  plots: Array<{ idx: number; building: string | null; level: number }>,
  cityLevel: number,
  copper: number,
): { plotIdx: number; targetLevel: number; cost: number; canAfford: boolean } | null {
  const maxAllowedLv = cityLevel >= 3 ? 3 : cityLevel >= 2 ? 2 : 1;
  const candidates = plots
    .filter(p => p.building === 'farm' && (p.level || 1) < maxAllowedLv)
    .sort((a, b) => (a.level || 1) - (b.level || 1));
  if (candidates.length === 0) return null;
  const pick = candidates[0];
  const nextLv = (pick.level || 1) + 1;
  const cost = nextLv === 2 ? 30 : 120;
  return {
    plotIdx: pick.idx,
    targetLevel: nextLv,
    cost,
    canAfford: copper >= cost,
  };
}

/** v4.6 满编状态下底部招募栏一键替补晋升匹配计算（直接用高阶精锐或魔法师补差替换场上低阶同系/基础兵） */
export interface FullCapReplacementOption {
  replaceUid: string;
  replaceFromKind: string;
  targetKind: string;
  netCost: number;
  canAfford: boolean;
}

export function findFullCapReplacementCandidate(
  units: Array<{ uid: string; kind: string; hp: number }>,
  targetKind: string,
  targetCost: number,
  copper: number,
  inBattle: boolean,
): FullCapReplacementOption | null {
  if (inBattle) return null;
  const preferredPredecessors: Record<string, string[]> = {
    guardCaptain: ['guard'],
    veteranMilitia: ['militia', 'guard'],
    veteranArcher: ['archer'],
    mage: ['militia', 'guard', 'archer'],
    medic: ['guard', 'militia'],
  };
  const prefs = preferredPredecessors[targetKind];
  if (!prefs) return null;
  const baseCostMap: Record<string, number> = { guard: 1, militia: 8, archer: 10 };
  for (const fk of prefs) {
    const found = units.find(u => u.hp > 0 && u.kind === fk);
    if (found) {
      const refund = Math.max(1, Math.floor((baseCostMap[fk] || 1) * 0.5));
      const netCost = Math.max(1, targetCost - refund);
      return {
        replaceUid: found.uid,
        replaceFromKind: fk,
        targetKind,
        netCost,
        canAfford: copper >= netCost,
      };
    }
  }
  return null;
}

/** v4.6 战场地面受击贴花对象池（攻城弹坑 crater / 奥术焦痕 scorch / 翠绿治愈符文 healRune，上限 28） */
export interface GroundDecalRecord {
  kind: 'crater' | 'scorch' | 'healRune';
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export function pushGroundDecalRecord(
  pool: GroundDecalRecord[],
  kind: 'crater' | 'scorch' | 'healRune',
  x: number,
  y: number,
  maxCap = 28,
): void {
  if (pool.length >= maxCap) pool.shift();
  const dur = kind === 'crater' ? 4.2 : kind === 'scorch' ? 3.0 : 2.2;
  pool.push({ kind, x, y, life: dur, maxLife: dur });
}

/** v4.7 视野外敌军屏幕边缘雷达指示坐标夹取计算（放大或平移地图时定位视野外敌军与首领） */
export function computeOffScreenRadarClampedPos(
  screenX: number,
  screenY: number,
  viewportW: number,
  viewportH: number,
  margin = 22,
): { clampedX: number; clampedY: number; angle: number; isOffScreen: boolean } {
  const isOff =
    screenX < margin ||
    screenX > viewportW - margin ||
    screenY < margin ||
    screenY > viewportH - margin;
  const cx = viewportW * 0.5;
  const cy = viewportH * 0.5;
  const angle = Math.atan2(screenY - cy, screenX - cx);
  const clampedX = Math.max(margin, Math.min(viewportW - margin, screenX));
  const clampedY = Math.max(margin, Math.min(viewportH - margin, screenY));
  return { clampedX, clampedY, angle, isOffScreen: isOff };
}

/** v4.7 主城双通道经济产出（农田挂机+迎敌军粮+研究塔科研速率）简报格式化 */
export function summarizeTownEconomyRates(
  farmCount: number,
  maxFarms: number,
  farmPassiveTotal: number,
  farmRoundTotal: number,
  farmCycleSec: number,
  hasResearchTower: boolean,
  researchYieldPerTick: number,
  researchCycleSec: number,
): string {
  const farmStr =
    farmCount > 0
      ? `农田 ${farmCount}/${maxFarms}（挂机+${farmPassiveTotal}🪙/${farmCycleSec}s · 迎敌+${farmRoundTotal}🪙/波）`
      : `农田 0/${maxFarms}`;
  const resStr = hasResearchTower
    ? `科研 +${researchYieldPerTick}📘/${researchCycleSec}s`
    : '科研未激活';
  return `${farmStr} ｜ ${resStr}`;
}

/** v4.8 定居点训练营【🎯 一键进阶训练】智能推荐计算（优先升级当前在阵人数较多且等级最低的基础兵系） */
export interface NextTrainingUpgradeQuote {
  unitKind: 'guard' | 'militia' | 'archer' | 'medic';
  currentLevel: number;
  targetLevel: number;
  cost: number;
  deployedCount: number;
  canAfford: boolean;
}

export function selectNextTrainingLineage(
  trainingLevels: Record<string, number>,
  deployedUnitKinds: string[],
  copper: number,
): NextTrainingUpgradeQuote | null {
  const lineages: Array<'guard' | 'militia' | 'archer' | 'medic'> = ['guard', 'militia', 'archer', 'medic'];
  const countLineage = (uk: 'guard' | 'militia' | 'archer' | 'medic'): number =>
    deployedUnitKinds.filter(k => {
      if (uk === 'guard') return k === 'guard' || k === 'guardCaptain';
      if (uk === 'militia') return k === 'militia' || k === 'veteranMilitia';
      if (uk === 'archer') return k === 'archer' || k === 'veteranArcher';
      return k === uk;
    }).length;

  const list: NextTrainingUpgradeQuote[] = lineages
    .filter(uk => (trainingLevels[uk] || 0) < 2)
    .map(uk => {
      const cur = trainingLevels[uk] || 0;
      const cost = cur === 0 ? 20 : 60;
      return {
        unitKind: uk,
        currentLevel: cur,
        targetLevel: cur + 1,
        cost,
        deployedCount: countLineage(uk),
        canAfford: copper >= cost,
      };
    })
    .sort((a, b) => {
      if (a.currentLevel !== b.currentLevel) return a.currentLevel - b.currentLevel;
      return b.deployedCount - a.deployedCount;
    });

  return list.length > 0 ? list[0] : null;
}

/** v4.8 屏幕边缘雷达徽章与首领横幅点击镜头跳转偏移计算 */
export function computeCameraPanToTarget(
  targetWorldX: number,
  targetWorldY: number,
  keepX: number,
  keepY: number,
  maxPanX = 320,
  maxPanY = 190,
): { panX: number; panY: number } {
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, keepX - targetWorldX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, keepY - targetWorldY)),
  };
}

/** v4.9 点击进攻路口骷髅预警路标：计算距离该进攻路口最近的驻防槽位与主力前排调防对象 */
export function selectClosestGarrisonSlotToLane(
  units: Array<{ uid: string; kind: string; homeX: number; homeY: number; maxHp: number }>,
  laneWorldX: number,
  laneWorldY: number,
  selectedAllyUid: string | null,
): { moverUid: string; targetSlotUid: string } | null {
  if (units.length < 2) return null;
  const frontWeight: Record<string, number> = {
    ron: 100,
    frog: 95,
    guardCaptain: 90,
    guard: 85,
    veteranMilitia: 75,
    militia: 70,
  };
  let mover = selectedAllyUid ? units.find(u => u.uid === selectedAllyUid) : undefined;
  if (!mover) {
    mover = [...units].sort(
      (a, b) => (frontWeight[b.kind] || 10) - (frontWeight[a.kind] || 10) || b.maxHp - a.maxHp,
    )[0];
  }
  let closest = units[0];
  let bestD = Infinity;
  for (const u of units) {
    const d = Math.hypot(u.homeX - laneWorldX, u.homeY - laneWorldY);
    if (d < bestD) {
      bestD = d;
      closest = u;
    }
  }
  if (!mover || !closest) return null;
  return { moverUid: mover.uid, targetSlotUid: closest.uid };
}

/** v4.9 主城建设【🏗️ 一键补建推荐建筑】智能优先级检索 */
export function selectNextRecommendedCityBuilding(
  cityLevel: number,
  builtCounts: Record<string, number>,
  maxFarmSlotsForCity: number,
  copper: number,
): { kind: string; cost: number; canAfford: boolean } | null {
  const order: Array<{ kind: string; reqTown: number; limit: number; cost: number }> = [
    { kind: 'farm', reqTown: 1, limit: maxFarmSlotsForCity, cost: 5 },
    { kind: 'hospital', reqTown: 1, limit: 1, cost: 15 },
    { kind: 'militiaCamp', reqTown: 2, limit: 1, cost: 15 },
    { kind: 'archerCamp', reqTown: 2, limit: 1, cost: 20 },
    { kind: 'tavern', reqTown: 2, limit: 1, cost: 30 },
    { kind: 'researchTower', reqTown: 3, limit: 1, cost: 80 },
    { kind: 'mageTower', reqTown: 3, limit: 1, cost: 60 },
    { kind: 'trainingCamp', reqTown: 3, limit: 1, cost: 15 },
    { kind: 'blackMarket', reqTown: 3, limit: 1, cost: 0 },
  ];
  for (const item of order) {
    if (cityLevel < item.reqTown) continue;
    if ((builtCounts[item.kind] || 0) >= item.limit) continue;
    return { kind: item.kind, cost: item.cost, canAfford: copper >= item.cost };
  }
  return null;
}

/** v5.0 战场单位头顶训练营强化星级角标（★ / ★★）与奶蛙全体金光护盾球罩显示判定 */
export function resolveUnitTrainingStarBadge(
  unitKind: string,
  trainingLevels: Record<string, number>,
): { stars: string; level: number } | null {
  const baseLineage =
    unitKind === 'guard' || unitKind === 'guardCaptain'
      ? 'guard'
      : unitKind === 'militia' || unitKind === 'veteranMilitia'
      ? 'militia'
      : unitKind === 'archer' || unitKind === 'veteranArcher'
      ? 'archer'
      : unitKind === 'medic'
      ? 'medic'
      : null;
  if (!baseLineage) return null;
  const lv = Math.max(0, Math.min(2, trainingLevels[baseLineage] || 0));
  if (lv <= 0) return null;
  return { stars: '★'.repeat(lv), level: lv };
}

/** v5.1 手机端全屏清爽适配策略（横竖屏自动折叠冗余说明浮层、跳过开屏弹窗并自适应视口缩放） */
export interface MobileLayoutPolicy {
  isMobile: boolean;
  isPortrait: boolean;
  collapseWaveOverlayByDefault: boolean;
  autoSkipSplashModal: boolean;
  hideKeyboardTicker: boolean;
  fitScaleMultiplier: number;
}

export function computeResponsiveMobileLayoutPolicy(
  viewportW: number,
  viewportH: number,
): MobileLayoutPolicy {
  const isMobile = viewportW <= 768 || viewportH <= 520;
  const isPortrait = viewportW < viewportH;
  return {
    isMobile,
    isPortrait,
    collapseWaveOverlayByDefault: isMobile,
    autoSkipSplashModal: isMobile,
    hideKeyboardTicker: isMobile,
    fitScaleMultiplier: isPortrait ? 1.42 : 0.96,
  };
}

/** v5.2 手机端触控热区放大（+35% 防误触容差）与双击空白地面复位镜头策略 */
export interface MobileTouchInteractionPolicy {
  enemyFocusRadius: number;
  allySelectRadius: number;
  laneSignRadius: number;
  radarBadgePadding: number;
  doubleTapResetThresholdMs: number;
  autoDismissInspectorOnBlankTap: boolean;
  autoScrollCityMapOnCatalogSelect: boolean;
}

export function computeMobileTouchInteractionPolicy(
  isMobile: boolean,
): MobileTouchInteractionPolicy {
  const scale = isMobile ? 1.35 : 1.0;
  return {
    enemyFocusRadius: Math.round(34 * scale),
    allySelectRadius: Math.round(32 * scale),
    laneSignRadius: Math.round(28 * scale),
    radarBadgePadding: isMobile ? 12 : 6,
    doubleTapResetThresholdMs: 320,
    autoDismissInspectorOnBlankTap: true,
    autoScrollCityMapOnCatalogSelect: isMobile,
  };
}

/** v5.3 商业级手机全屏横屏配置（适配微信/抖音小游戏 deviceOrientation: 'landscape' 与双栏紧凑布局） */
export interface CommercialLandscapeConfig {
  deviceOrientation: 'landscape';
  designResolution: { width: number; height: number };
  fitHeight: boolean;
  fitWidth: boolean;
  useSideBySideTownAndTech: boolean;
  stripInternalDevCodes: boolean;
}

export function computeCommercialLandscapeConfig(
  viewportW: number,
  viewportH: number,
): CommercialLandscapeConfig {
  const isLandscape = viewportW >= viewportH;
  return {
    deviceOrientation: 'landscape',
    designResolution: { width: 1280, height: 720 },
    fitHeight: true,
    fitWidth: !isLandscape,
    useSideBySideTownAndTech: isLandscape,
    stripInternalDevCodes: true,
  };
}

/** v5.4 放射状科技树触控拖拽/捏合缩放视口变换与主城功能建筑单页签切换策略 */
export type TownHubTabMode = 'tavern' | 'hospital' | 'training' | 'market' | 'all';

export interface TechTreeViewBox {
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  viewBoxAttr: string;
}

export function computeTechTreeViewBox(
  zoom: number,
  panX: number,
  panY: number,
): TechTreeViewBox {
  const z = Math.max(0.85, Math.min(2.2, zoom || 1.0));
  const vw = Number((760 / z).toFixed(2));
  const vh = Number((560 / z).toFixed(2));
  const cx = Math.max(120, Math.min(640, 380 - (panX || 0)));
  const cy = Math.max(90, Math.min(470, 280 - (panY || 0)));
  const vx = Number((cx - vw / 2).toFixed(2));
  const vy = Number((cy - vh / 2).toFixed(2));
  return { vx, vy, vw, vh, viewBoxAttr: `${vx} ${vy} ${vw} ${vh}` };
}

/** v5.5 手机默认自动横屏舞台旋转（即使开启系统竖屏锁定也直接以横屏进入）与旋转坐标逆映射 */
export function mapAutoLandscapePoint(
  rotated: boolean,
  rect: { left: number; right: number; top: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (rotated) {
    return { x: clientY - rect.top, y: rect.right - clientX };
  }
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** v5.6 手机横屏弹窗防溢出高度约束、底部兵牌抽屉折叠与双指中心锚点捏合缩放算法 */
export function computeMidpointAnchoredPinchPan(
  prevZoom: number,
  nextZoom: number,
  panX: number,
  panY: number,
  midLocalX: number,
  midLocalY: number,
  viewportW: number,
  viewportH: number,
  maxPanX = 360,
  maxPanY = 220,
): { zoom: number; panX: number; panY: number } {
  const ratio = nextZoom / Math.max(0.5, prevZoom);
  const nx = Math.max(-maxPanX, Math.min(maxPanX, (midLocalX - viewportW * 0.5) * (1 - ratio) + panX * ratio));
  const ny = Math.max(-maxPanY, Math.min(maxPanY, (midLocalY - viewportH * 0.5) * (1 - ratio) + panY * ratio));
  return { zoom: nextZoom, panX: nx, panY: ny };
}

/** v5.7 战场视野边界防拖出空黑区算法（根据当前缩放倍数动态约束相机平移，杜绝地图边缘漏底） */
export function clampBattlePanToMapBounds(
  worldW: number,
  worldH: number,
  viewportW: number,
  viewportH: number,
  fitScale: number,
  panX: number,
  panY: number,
): { panX: number; panY: number; maxX: number; maxY: number } {
  const visW = viewportW / Math.max(0.1, fitScale);
  const visH = viewportH / Math.max(0.1, fitScale);
  const maxX = Math.max(0, (worldW - visW) * 0.5);
  const maxY = Math.max(0, (worldH - visH) * 0.5);
  return {
    panX: Math.max(-maxX, Math.min(maxX, panX)),
    panY: Math.max(-maxY, Math.min(maxY, panY)),
    maxX,
    maxY,
  };
}

/** v5.8 手机横屏 28px 超窄单行顶栏合并策略（将资源栏与四页签合为一条窄边，释放最大战场视野） */
export interface UltraSlimTopRailMetrics {
  mergedSingleRow: boolean;
  topBarHeightPx: number;
  battlefieldVerticalRatio: number;
}

export function computeUltraSlimTopRailMetrics(
  viewportW: number,
  viewportH: number,
): UltraSlimTopRailMetrics {
  const isMobileLandscape = Math.min(viewportW, viewportH) <= 540;
  const topBarHeightPx = isMobileLandscape ? 28 : 72;
  const effectiveH = Math.min(viewportW, viewportH);
  return {
    mergedSingleRow: isMobileLandscape,
    topBarHeightPx,
    battlefieldVerticalRatio: Number(((effectiveH - topBarHeightPx - 36) / Math.max(1, effectiveH)).toFixed(2)),
  };
}

/** v5.9 底部兵牌单行 24px 微缩窄边化、一键全屏沉浸战场（96%+ 画幅占比）与 GPU 合成层硬件隔离策略 */
export interface ImmersiveBattlefieldConfig {
  immersiveMode: boolean;
  singleLineRecruitPills: boolean;
  gpuLayerIsolation: boolean;
  opaqueCityCanvas: boolean;
  visibleCanvasRatio: number;
}

export function computeImmersiveBattlefieldConfig(
  viewportW: number,
  viewportH: number,
  immersiveActive: boolean,
  recruitDrawerCollapsed: boolean,
): ImmersiveBattlefieldConfig {
  const effectiveH = Math.max(240, Math.min(viewportW, viewportH));
  const chromeH = immersiveActive ? 0 : (28 + (recruitDrawerCollapsed ? 24 : 44));
  return {
    immersiveMode: immersiveActive,
    singleLineRecruitPills: effectiveH <= 540,
    gpuLayerIsolation: true,
    opaqueCityCanvas: true,
    visibleCanvasRatio: Number(((effectiveH - chromeH) / effectiveH).toFixed(2)),
  };
}

/** v6.0 单指拖拽指数阻尼惯性滑行（Inertia Momentum）与全屏沉浸右下角迷你战术胶囊 */
export function stepExponentialCameraInertia(
  panX: number,
  panY: number,
  vx: number,
  vy: number,
  zoom: number,
  dt: number,
  friction = 8.5,
): { panX: number; panY: number; vx: number; vy: number } {
  if (dt <= 0 || (Math.abs(vx) <= 2 && Math.abs(vy) <= 2)) {
    return { panX, panY, vx: 0, vy: 0 };
  }
  const decay = Math.exp(-friction * dt);
  const z = Math.max(0.75, zoom || 1.0);
  const nx = panX + (vx * dt) / z;
  const ny = panY + (vy * dt) / z;
  let nvx = vx * decay;
  let nvy = vy * decay;
  if (Math.hypot(nvx, nvy) < 3) {
    nvx = 0;
    nvy = 0;
  }
  return { panX: nx, panY: ny, vx: nvx, vy: nvy };
}

/** v6.1 城内 2x2 建造绿框单指滑动吸附与休整期驻军单指拖拽直接换防判定 */
export function snapCityCandidateTile(
  col: number,
  row: number,
  cityRadius: number,
): { col: number; row: number } {
  return {
    col: Math.max(-cityRadius, Math.min(cityRadius - 1, Math.round(col))),
    row: Math.max(-cityRadius, Math.min(cityRadius - 1, Math.round(row))),
  };
}

/** v6.2 Boss 出场字幕防重叠位置计算与主城横屏一屏免滚布局规范 */
export function computeBossAlertBannerRect(
  canvasW: number,
  canvasH: number,
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(canvasW - 24, 420);
  const height = 38;
  return {
    x: (canvasW - width) / 2,
    y: Math.max(52, canvasH - height - 12),
    width,
    height,
  };
}

/** v6.3 城内等距菱形网格随主城等级（C001–C004）自适应全览缩放比计算（确保全地块一屏完整可见） */
export function computeCityIsometricAutoFitScale(
  viewportW: number,
  viewportH: number,
  cityLevel: number,
  isoTileW = 28,
  isoTileH = 15,
): number {
  const rad = (cityLevel <= 0 ? 3 : cityLevel === 1 ? 4 : cityLevel === 2 ? 5 : 6) + 1;
  const spanW = rad * 4 * isoTileW + 36;
  const spanH = rad * 4 * isoTileH + 56;
  const usableH = Math.max(110, viewportH - 30);
  return Math.min(1.12, Math.max(0.42, Math.min(viewportW / spanW, usableH / spanH) * 0.96));
}

/** v6.4 战场浮字矩形包围盒垂直排队防重叠算法（消除 Boss 长技能浮字与伤害数字交叉重叠） */
export function resolveNonOverlappingFloatTextY(
  existingTexts: Array<{ x: number; y: number; text: string; size?: number; life: number }>,
  x: number,
  y: number,
  text: string,
  size = 13,
): number {
  let curY = y;
  const halfW = Math.max(42, String(text || '').length * (size * 0.48));
  const rowH = Math.max(15, size + 3);
  for (let pass = 0; pass < 6; pass++) {
    let collided = false;
    for (const ft of existingTexts) {
      if (ft.life <= 0.15) continue;
      const ftHalfW = Math.max(42, String(ft.text || '').length * ((ft.size || 13) * 0.48));
      if (Math.abs(ft.x - x) < (halfW + ftHalfW) * 0.65 && Math.abs(ft.y - curY) < rowH) {
        curY = Math.min(curY, ft.y) - rowH;
        collided = true;
        break;
      }
    }
    if (!collided) break;
  }
  return Math.max(24, curY);
}

/** v6.5 城内等距地块点击与右侧五合一功能抽屉页签自动联动映射 */
export function resolveTownDrawerTabForBuilding(
  buildingKind: string,
  currentTab: TownHubTabMode,
): TownHubTabMode {
  if (currentTab === 'all') return 'all';
  switch (buildingKind) {
    case 'tavern':
      return 'tavern';
    case 'hospital':
      return 'hospital';
    case 'trainingCamp':
      return 'training';
    case 'blackMarket':
      return 'market';
    default:
      return 'build';
  }
}

/** v6.6 战场左上角多浮层智能互斥（防止敌情卡片、敌军集火检视与友军检视在手机横屏下同时展开纵向溢出） */
export interface LeftOverlayMutexState {
  waveCardCollapsed: boolean;
  selectedAllyUid: number | null;
  focusEnemyId: number | null;
}

export function resolveMobileLeftOverlayMutex(
  action: 'select_ally' | 'focus_enemy' | 'expand_wave_card',
  state: LeftOverlayMutexState,
  isMobile: boolean,
): LeftOverlayMutexState {
  if (!isMobile) return state;
  if (action === 'select_ally') {
    return { ...state, waveCardCollapsed: true };
  }
  if (action === 'focus_enemy') {
    return { ...state, waveCardCollapsed: true, selectedAllyUid: null };
  }
  if (action === 'expand_wave_card') {
    return { ...state, waveCardCollapsed: false, selectedAllyUid: null };
  }
  return state;
}

/** v6.7 城内底部悬浮条按需显隐判定与放射科技树节点移动端大热区常量 */
export const TECH_NODE_TOUCH_HIT_RADIUS = 34;

export function shouldShowCityActionFloatBar(
  selectedBuildKind: string | null,
  movingPlotIdx: number,
  selectedCityPlotIdx: number,
): boolean {
  return Boolean(selectedBuildKind) || movingPlotIdx >= 0 || selectedCityPlotIdx >= 0;
}

/** v6.8 城内等距地图 2×2 选址/移位绿框原地点选确认判定 */
export function isTileInCandidate2x2(
  cand: { col: number; row: number } | null | undefined,
  col: number,
  row: number,
): boolean {
  if (!cand || typeof cand.col !== "number" || typeof cand.row !== "number") return false;
  return col >= cand.col && col <= cand.col + 1 && row >= cand.row && row <= cand.row + 1;
}

/** v6.9 90°自动横屏滚动容器触控位移映射（将竖屏物理触摸 delta 映射至横屏 scrollLeft / scrollTop） */
export function computeRotatedScrollTarget(
  scrollLeft: number,
  scrollTop: number,
  rawDx: number,
  rawDy: number,
  rotated90: boolean,
  axis: "x" | "y" | "both" = "both",
): { scrollLeft: number; scrollTop: number; dx: number; dy: number } {
  const dx = rotated90 ? rawDy : rawDx;
  const dy = rotated90 ? -rawDx : rawDy;
  return {
    scrollLeft: axis === "x" || axis === "both" ? Math.max(0, scrollLeft - dx) : scrollLeft,
    scrollTop: axis === "y" || axis === "both" ? Math.max(0, scrollTop - dy) : scrollTop,
    dx,
    dy,
  };
}

/** v7.0 城内五合一功能抽屉未建建筑一键选址映射（酒馆/医院/训练营/黑市/研究塔） */
export const TOWN_DRAWER_QUICK_BUILD_MAP: Record<string, string> = {
  tavern: "tavern",
  hospital: "hospital",
  training: "trainingCamp",
  market: "blackMarket",
  tech: "researchTower",
};

/** v7.1 城内等距地图已建功能建筑二次点击快捷动作路由 */
export type InCitySecondTapAction =
  | "upgrade_farm"
  | "heal_all"
  | "quick_train"
  | "open_tech_tree"
  | "deploy_free_ron"
  | "none";

export function resolveInCityBuildingSecondTapAction(buildingKind: string): InCitySecondTapAction {
  switch (buildingKind) {
    case "farm":
      return "upgrade_farm";
    case "hospital":
      return "heal_all";
    case "trainingCamp":
      return "quick_train";
    case "researchTower":
      return "open_tech_tree";
    case "tavern":
      return "deploy_free_ron";
    default:
      return "none";
  }
}

/** v7.2 城内兵营/靶场/法师塔二次点击直接招募最高阶已解锁兵种判定 */
export function resolveBestCampUnitKindForCocos(
  buildingKind: string,
  techs: Record<string, number>,
): string | null {
  if (buildingKind === "militiaCamp") {
    if ((techs.T009 || 0) >= 1) return "guardCaptain";
    if ((techs.T003 || 0) >= 1) return "veteranMilitia";
    return "militia";
  }
  if (buildingKind === "archerCamp") {
    if ((techs.T006 || 0) >= 1) return "veteranArcher";
    return "archer";
  }
  if (buildingKind === "mageTower") {
    if ((techs.T012 || 0) >= 1) return "fireMage";
    return "mage";
  }
  return null;
}

/** v7.3 战场底部征兵栏/晋升按钮未解锁项智能跳转目标判定 */
export type UnlockRedirectTarget =
  | { type: "upgrade_town"; reqTown: number }
  | { type: "build_in_city"; buildingKind: string }
  | { type: "research_tech"; techId: string }
  | null;

export function resolveUnlockRedirectTarget(
  cityLevel: number,
  builtBuildings: string[],
  techs: Record<string, number>,
  reqTown = 0,
  reqBuilding: string | null = null,
  reqTech: string | null = null,
): UnlockRedirectTarget {
  if (reqTown && cityLevel < reqTown) {
    return { type: "upgrade_town", reqTown };
  }
  if (reqBuilding && !builtBuildings.includes(reqBuilding)) {
    return { type: "build_in_city", buildingKind: reqBuilding };
  }
  if (reqTech && (techs[reqTech] || 0) < 1) {
    if (!builtBuildings.includes("researchTower")) {
      return { type: "build_in_city", buildingKind: "researchTower" };
    }
    return { type: "research_tech", techId: reqTech };
  }
  return null;
}

/** v7.4 顶部状态栏五大资源胶囊单指点击快捷路由与九宫格已建满建筑智能复用 */
export type TopHudPillKind = "copper" | "research" | "tokens" | "pop" | "round";

export function resolveTopHudPillTargetTab(
  pill: TopHudPillKind,
  hasResearchTower: boolean,
): "battle" | "town" | "tech" | "codex" {
  switch (pill) {
    case "copper":
    case "tokens":
      return "town";
    case "research":
      return hasResearchTower ? "tech" : "town";
    case "pop":
      return "battle";
    case "round":
      return "codex";
  }
}

/** v7.5 图鉴 28 单位卡片底部快捷动作判定（友军一键招募/去解锁，敌军定位首现主线回合演练） */
export const ENEMY_DEBUT_ROUND_MAP: Record<string, number> = {
  goblinScout: 1,
  goblinClub: 2,
  goblinBow: 3,
  goblinWolf: 5,
  goblinShaman: 6,
  goblinBrute: 7,
  goblinCatapult: 10,
  goblinBoss: 16,
  skeleton: 17,
  zombie: 17,
  skeletonArcher: 18,
  ghostAssassin: 19,
  necromancer: 21,
  deathKnight: 23,
  boneCatapult: 24,
  skeletonGeneral: 25,
  headlessKnight: 32,
};

/** v7.6 全屏沉浸悬浮舱一键倍速循环（1x -> 2x -> 4x -> 1x）与检视卡追焦镜头偏移计算 */
export function computeNextBattleSpeedCycle(
  currentSpeed: 1 | 2 | 4,
  isPaused: boolean,
): { speed: 1 | 2 | 4; paused: boolean } {
  if (isPaused) return { speed: currentSpeed, paused: false };
  const nextSpeed: 1 | 2 | 4 = currentSpeed === 1 ? 2 : currentSpeed === 2 ? 4 : 1;
  return { speed: nextSpeed, paused: false };
}

/** v7.7 顶栏城防耐久条一键快修/升阶分流判定与波次卡野怪/农田/战力胶囊快捷路由 */
export type CastleHpBarTapResult = "repair_castle" | "upgrade_town" | "inspect_town";

export function resolveCastleHpBarTapAction(
  castleHp: number,
  maxCastleHp: number,
  cityLevel: number,
  completedRound: number,
  copper: number,
  nextReqRound = 99,
  nextCost = 99999,
): CastleHpBarTapResult {
  if (castleHp < maxCastleHp) return "repair_castle";
  if (cityLevel < 3 && completedRound >= nextReqRound && copper >= nextCost) {
    return "upgrade_town";
  }
  return "inspect_town";
}

/** v7.8 城内等距地图外圈绿色虚线扩建预览区点击判定（点击外圈虚线预览/连点升阶主城） */
export function isOuterExpansionPreviewTile(
  cityLevel: number,
  col: number,
  row: number,
  curRad: number,
  nextRad: number,
): boolean {
  if (cityLevel >= 3) return false;
  const cheb = Math.max(Math.abs(col), Math.abs(row));
  return cheb > curRad && cheb <= nextRad;
}

/** v7.9 科技树主按钮与酒馆/黑市整卡智能前置动作解析 */
export function resolveTechPrimaryCtaAction(
  hasResearchTower: boolean,
  reqTechOk: boolean,
  reqTechId: string | null,
  reqBuildingOk: boolean,
  reqBuildingKind: string | null,
  reqFarmsOk: boolean,
): { mode: 'build' | 'focus_tech' | 'research'; target: string | null } {
  if (!hasResearchTower) return { mode: 'build', target: 'researchTower' };
  if (!reqTechOk && reqTechId) return { mode: 'focus_tech', target: reqTechId };
  if (!reqBuildingOk && reqBuildingKind) return { mode: 'build', target: reqBuildingKind };
  if (!reqFarmsOk) return { mode: 'build', target: 'farm' };
  return { mode: 'research', target: null };
}

/** v8.0 城内底部浮动操作栏全建筑一键动作标签与可用性解析 */
export function resolveCityFloatBarBuildingCta(
  buildingKind: string,
  injuredCount: number,
  researchPoints: number,
  ronAlive: boolean,
  ronFreeUsed: boolean,
  campUnitName: string | null,
  campUnitCost: number,
  canExchangeBmCopper: boolean,
): { label: string; enabled: boolean } {
  if (buildingKind === 'hospital') {
    return { label: injuredCount > 0 ? `💊 一键全疗 (${injuredCount}人)` : '✨ 全员满血', enabled: injuredCount > 0 };
  }
  if (buildingKind === 'researchTower') {
    return { label: `🔮 打开科技树 (${Math.floor(researchPoints)}📘)`, enabled: true };
  }
  if (buildingKind === 'tavern') {
    return { label: ronAlive ? '🛡️ 战场看罗恩' : (ronFreeUsed ? '🛡️ 重招罗恩 (60🪙)' : '🛡️ 免费派罗恩'), enabled: true };
  }
  if (campUnitName) {
    return { label: `⚔️ 招${campUnitName} (${campUnitCost}🪙)`, enabled: true };
  }
  if (buildingKind === 'blackMarket') {
    return { label: canExchangeBmCopper ? '🪙 1🎟️兑+30铜币' : '🕵️ 需1🎟️兑铜币', enabled: canExchangeBmCopper };
  }
  return { label: '⚡ 快捷操作', enabled: true };
}

/** v8.1 科技树顶栏研究点胶囊与产出速率条快捷动作解析 */
export function resolveTechTopBannerPillAction(
  mode: 'rp' | 'rate',
  hasResearchTower: boolean,
  t016Level: number,
  t017Level: number,
  canAffordRecommended: boolean,
  recommendedTechId: string | null,
  battleActive: boolean,
): { action: 'build_tower' | 'focus_tech' | 'wild_patrol' | 'toast'; targetTechId: string | null } {
  if (!hasResearchTower) return { action: 'build_tower', targetTechId: null };
  if (mode === 'rate') {
    if (t016Level < 1) return { action: 'focus_tech', targetTechId: 'T016' };
    if (t017Level < 1) return { action: 'focus_tech', targetTechId: 'T017' };
  }
  if (canAffordRecommended && recommendedTechId) {
    return { action: 'focus_tech', targetTechId: recommendedTechId };
  }
  if (!battleActive) return { action: 'wild_patrol', targetTechId: null };
  return { action: 'toast', targetTechId: null };
}

/** v8.2 主战场已选友军二次点按动作与波次敌军标签反制阵型解析 */
export function resolveSecondTapAllyBattleAction(
  isInjured: boolean,
  hasHospital: boolean,
  hasPromotionPath: boolean,
  isTrainableBelowMax: boolean,
  hasTrainingCamp: boolean,
): 'heal' | 'promote' | 'train' | 'center_camera' {
  if (isInjured && hasHospital) return 'heal';
  if (hasPromotionPath) return 'promote';
  if (isTrainableBelowMax && hasTrainingCamp) return 'train';
  return 'center_camera';
}

export function resolveWaveThreatCounterFormation(
  enemyKind: string,
  enemyJob: string,
): 'compact' | 'expanded' | null {
  if (enemyJob === '刺客' || enemyKind === 'goblinAssassin') return 'compact';
  if (
    enemyJob === '攻城' ||
    enemyKind === 'goblinChariot' ||
    enemyKind === 'necromancer' ||
    enemyKind === 'skeletonMage' ||
    enemyKind === 'goblinShaman'
  ) {
    return 'expanded';
  }
  return null;
}

/** v8.3 科技树同分支节点循环切换与城内浮动栏信息区点击解析 */
export function resolveNextBranchTechNodeId(
  branchNodes: Array<{ id: string; maxLevel: number }>,
  currentTechId: string,
  techLevels: Record<string, number>,
): string {
  if (branchNodes.length === 0) return currentTechId;
  const curIdx = Math.max(0, branchNodes.findIndex(n => n.id === currentTechId));
  for (let step = 1; step <= branchNodes.length; step++) {
    const cand = branchNodes[(curIdx + step) % branchNodes.length];
    if ((techLevels[cand.id] || 0) < cand.maxLevel) return cand.id;
  }
  return branchNodes[(curIdx + 1) % branchNodes.length].id;
}

/** v8.4 城内已建建筑横向芯片条实时行动状态微徽章解析 */
export function resolveBuiltPlotQuickChipBadge(
  buildingKind: string,
  farmCanUpgrade: boolean,
  hasInjuredAllies: boolean,
  canAffordTraining: boolean,
  hasReadyTech: boolean,
  ronFreeAvailable: boolean,
  canExchangeBmCopper: boolean,
  canRecruitFromCamp: boolean,
): string | null {
  if (buildingKind === 'farm') return farmCanUpgrade ? '⬆️可升' : null;
  if (buildingKind === 'hospital') return hasInjuredAllies ? '💊可疗' : null;
  if (buildingKind === 'trainingCamp') return canAffordTraining ? '🎯可训' : null;
  if (buildingKind === 'researchTower') return hasReadyTech ? '📘可研' : null;
  if (buildingKind === 'tavern') return ronFreeAvailable ? '👑免费' : null;
  if (buildingKind === 'blackMarket') return canExchangeBmCopper ? '🪙可兑' : null;
  if (
    buildingKind === 'militiaCamp' ||
    buildingKind === 'archerCamp' ||
    buildingKind === 'mageTower'
  ) {
    return canRecruitFromCamp ? '⚔️可招' : null;
  }
  return null;
}

/** v8.5 顶部主导航栏与城内 5 抽屉标签栏已激活页签二次点击快捷动作解析 */
export function resolveActiveMainNavSecondTapAction(
  activeTab: 'battle' | 'town' | 'tech' | 'codex',
): 'reset_battle_cam_and_toggle_recruit' | 'reset_town_cam_and_build_tab' | 'focus_recommended_tech' | 'cycle_codex_category' {
  if (activeTab === 'battle') return 'reset_battle_cam_and_toggle_recruit';
  if (activeTab === 'town') return 'reset_town_cam_and_build_tab';
  if (activeTab === 'tech') return 'focus_recommended_tech';
  return 'cycle_codex_category';
}

export function resolveActiveTownDrawerTabSecondTapAction(
  drawerTab: 'build' | 'tavern' | 'hospital' | 'training' | 'market',
  hasBuildingForTab: boolean,
): 'select_build_preview' | 'quick_build_or_confirm' | 'deploy_or_locate_hero' | 'heal_all' | 'train_next' | 'exchange_bm_copper' {
  if (drawerTab === 'build') return 'quick_build_or_confirm';
  if (!hasBuildingForTab) return 'select_build_preview';
  if (drawerTab === 'tavern') return 'deploy_or_locate_hero';
  if (drawerTab === 'hospital') return 'heal_all';
  if (drawerTab === 'training') return 'train_next';
  return 'exchange_bm_copper';
}

/** v8.6 全屏沉浸迷你浮岛战前/战中双模按钮动作与文案解析 */
export function resolveImmersiveMiniDockButtonState(
  fighting: boolean,
  enemyCount: number,
  nextRound: number,
  completedAllRounds: boolean,
  formationMode: 'standard' | 'compact' | 'expanded',
): {
  primaryLabel: string;
  primaryAction: 'focus_fire' | 'start_wave';
  secondaryLabel: string;
  secondaryAction: 'cycle_stance' | 'quick_prep';
} {
  if (fighting) {
    const stanceLbl =
      formationMode === 'compact'
        ? '🛡️ 紧缩阵'
        : formationMode === 'expanded'
          ? '🏹 外扩阵'
          : '⚔️ 变阵';
    return {
      primaryLabel: `🎯 集火(${enemyCount})`,
      primaryAction: 'focus_fire',
      secondaryLabel: stanceLbl,
      secondaryAction: 'cycle_stance',
    };
  }
  return {
    primaryLabel: completedAllRounds ? '🏆 已通关' : `⚔️ 迎战 R${nextRound}`,
    primaryAction: 'start_wave',
    secondaryLabel: '✨ 整备',
    secondaryAction: 'quick_prep',
  };
}

/** v8.7 主战场底栏双主按钮（#btnStartWave / #btnQuickPrep）战前与战中双模状态解析 */
export function resolveBattleBottomPrimaryButtonsState(
  fighting: boolean,
  enemyCount: number,
  nextRound: number,
  completedAllRounds: boolean,
  castleMissingHp: number,
  copper: number,
  gameSpeed: number,
): {
  startBtnLabel: string;
  startBtnAction: 'focus_fire' | 'start_wave';
  prepBtnLabel: string;
  prepBtnAction: 'emergency_repair' | 'cycle_speed' | 'quick_prep';
} {
  if (fighting) {
    const canRepair = castleMissingHp > 0 && copper > 0;
    return {
      startBtnLabel: `🎯 集火敌军 (${enemyCount})`,
      startBtnAction: 'focus_fire',
      prepBtnLabel: canRepair
        ? `🔨 紧急修城 (${Math.ceil(castleMissingHp / 5)}🪙)`
        : `⚡ 倍速 ${gameSpeed}x (点此加速)`,
      prepBtnAction: canRepair ? 'emergency_repair' : 'cycle_speed',
    };
  }
  return {
    startBtnLabel: completedAllRounds ? '🏆 32回合已通关' : `⚔️ 迎击第 ${nextRound} 回合`,
    startBtnAction: 'start_wave',
    prepBtnLabel: '✨ 一键整备',
    prepBtnAction: 'quick_prep',
  };
}

/** v8.8 城内顶栏农田按钮与主城升阶按钮智能状态解析 */
export function resolveSmartFarmHeaderButtonState(
  cityLevel: number,
  farmCount: number,
  maxFarms: number,
  nextUpgradableLevel: number | null,
  nextUpgradeCost: number,
): { mode: 'upgrade_town_first' | 'build_first_farm' | 'upgrade_farm' | 'expand_farm' | 'maxed'; label: string } {
  if (farmCount === 0) {
    return cityLevel < 1
      ? { mode: 'upgrade_town_first', label: '🌾 需升简易房屋建田' }
      : { mode: 'build_first_farm', label: '🌾 点此选址建农田 (5🪙)' };
  }
  if (nextUpgradableLevel !== null) {
    return { mode: 'upgrade_farm', label: `🌾 升农田Lv.${nextUpgradableLevel} (${nextUpgradeCost}🪙)` };
  }
  if (farmCount < maxFarms) {
    return { mode: 'expand_farm', label: `🌾 扩建新农田 (${farmCount}/${maxFarms}·5🪙)` };
  }
  return { mode: 'maxed', label: cityLevel >= 3 ? '🌾 农田全部Lv.3满级' : `🌾 农田已达Lv.${cityLevel}上限` };
}

/** v8.9 城内顶栏全周期智能城政总管按钮（#btnQuickBuildRec）与讨伐野怪按钮实时状态解析 */
export function resolveCityStewardButtonState(
  recBuildingName: string | null,
  recBuildingCost: number,
  canUpgradeFarm: boolean,
  farmTargetLevel: number,
  farmCost: number,
  canUpgradeTraining: boolean,
  trainingUnitName: string,
  trainingTargetLevel: number,
  trainingCost: number,
  injuredCount: number,
  canUpgradeTown: boolean,
  nextTownName: string,
  nextTownCost: number,
  nextRound: number,
): { mode: 'build' | 'farm' | 'train' | 'heal' | 'upgrade_town' | 'return_battle'; label: string } {
  if (recBuildingName) {
    return { mode: 'build', label: `🏗️ 补建${recBuildingName} (${recBuildingCost}🪙)` };
  }
  if (canUpgradeFarm) {
    return { mode: 'farm', label: `🌾 升农田Lv.${farmTargetLevel} (${farmCost}🪙)` };
  }
  if (canUpgradeTraining) {
    return { mode: 'train', label: `🎯 训${trainingUnitName}Lv.${trainingTargetLevel} (${trainingCost}🪙)` };
  }
  if (injuredCount > 0) {
    return { mode: 'heal', label: `💊 一键全疗(${injuredCount}人)` };
  }
  if (canUpgradeTown) {
    return { mode: 'upgrade_town', label: `🏰 升至${nextTownName} (${nextTownCost}🪙)` };
  }
  return { mode: 'return_battle', label: `⚔️ 返战迎击 R${nextRound}` };
}

/** v9.0 商业化上线平衡系数（中后期波次强度曲线与首领二阶段狂暴护盾） */
export function computeStage1WaveBalanceCurve(
  roundNum: number,
  isBossUnit: boolean,
  isWildPatrol: boolean,
): { hpMul: number; atkMul: number; phase2ShieldRatio: number; phase2RateMul: number } {
  if (isWildPatrol || roundNum < 9) {
    return { hpMul: 1.0, atkMul: 1.0, phase2ShieldRatio: 0.16, phase2RateMul: 1.22 };
  }
  const rSpan = Math.max(0, roundNum - 8);
  const hpMul = isBossUnit
    ? +(1.35 + Math.min(0.65, rSpan * 0.028)).toFixed(3)
    : +(1.08 + Math.min(0.52, rSpan * 0.022)).toFixed(3);
  const atkMul = isBossUnit
    ? +(1.15 + Math.min(0.30, rSpan * 0.012)).toFixed(3)
    : +(1.05 + Math.min(0.25, rSpan * 0.010)).toFixed(3);
  return { hpMul, atkMul, phase2ShieldRatio: 0.16, phase2RateMul: 1.22 };
}

/** v9.1 中后期双波峰主力增援配置与宽屏椭圆科技树坐标投影 */
export function resolveMidWaveClimaxReinforcements(roundNum: number): string[] {
  if (roundNum < 9 || roundNum >= 32 || roundNum === 16) return [];
  if (roundNum <= 12) return ['shieldGoblin', 'stoneGoblin', 'goblin'];
  if (roundNum <= 15) return ['shieldGoblin', 'mageGoblin', 'wolf'];
  if (roundNum <= 20) return ['skeletonWarrior', 'skeletonArcher', 'skeleton'];
  if (roundNum <= 24) return ['skeletonWarrior', 'ghost', 'skeletonMage'];
  return ['skeletonWarrior', 'skeletonMage', 'zombie'];
}

export function projectEllipticalTechNodeCoord(
  cx: number,
  cy: number,
  angleDeg: number,
  ringRadius: number,
  rxScale = 1.28,
  ryScale = 0.86,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: +(cx + Math.cos(rad) * ringRadius * rxScale).toFixed(1),
    y: +(cy + Math.sin(rad) * ringRadius * ryScale).toFixed(1),
  };
}


// ============================================================================
// v9.2 四时代全32波次平衡曲线、法师反游魂/高甲智能索敌、守军绝境士气觉醒与 1280x660 全景科技星盘
// ============================================================================
export const V92_PANORAMIC_TECH_CONFIG = {
  viewBoxWidth: 1280,
  viewBoxHeight: 660,
  centerX: 640,
  centerY: 330,
  ellipseRx: 1.38,
  ellipseRy: 0.90,
  ringRadii: [0, 138, 242, 336],
  capsuleWidth: 112,
  capsuleHeight: 46,
  selectedCapsuleWidth: 120,
  selectedCapsuleHeight: 50
};

export function computeV92EraWaveBalanceMultipliers(
  roundNum: number,
  isBossUnit: boolean,
  isWild: boolean
): { hpMul: number; atkMul: number } {
  if (isWild || !roundNum || roundNum < 9) return { hpMul: 1.0, atkMul: 1.0 };
  if (roundNum <= 15) {
    const s2 = roundNum - 9;
    return {
      hpMul: +(1.26 + s2 * 0.045).toFixed(3),
      atkMul: +(1.14 + s2 * 0.025).toFixed(3)
    };
  }
  if (roundNum === 16) {
    return isBossUnit ? { hpMul: 1.50, atkMul: 1.20 } : { hpMul: 1.32, atkMul: 1.15 };
  }
  if (roundNum <= 20) {
    const s3 = roundNum - 17;
    return {
      hpMul: 1.0,
      atkMul: +(1.04 + s3 * 0.025).toFixed(3)
    };
  }
  const rSpan = Math.max(0, roundNum - 20);
  if (isBossUnit) {
    if (roundNum === 28 || roundNum === 31) {
      return { hpMul: 1.22, atkMul: 1.12 };
    }
    return {
      hpMul: +(1.46 + Math.min(0.38, rSpan * 0.030)).toFixed(3),
      atkMul: +(1.18 + Math.min(0.16, rSpan * 0.013)).toFixed(3)
    };
  }
  return {
    hpMul: +(1.25 + Math.min(0.44, rSpan * 0.033)).toFixed(3),
    atkMul: +(1.12 + Math.min(0.22, rSpan * 0.016)).toFixed(3)
  };
}


// ============================================================================
// v9.3 后期亡灵战役与双首领（R25 亡者将军 / R32 无头骑士）破阵波峰配置 + 科技星盘全屏悬浮速研底栏
// ============================================================================
export const V93_LATEGAME_BOSS_CLIMAX = {
  r25BossMultiplier: { hpMul: 1.88, atkMul: 1.38 },
  r25SurgeRoster: ["skeletonWarrior", "skeletonMage", "zombie", "skeletonMage", "ghost"],
  r32BossMultiplier: { hpMul: 1.86, atkMul: 1.33 },
  r32SurgeRoster: ["skeletonMage", "ghost"],
  techBranchOrder: ["战争之路", "魔力之路", "远距离打击", "守护之路", "繁荣之路", "建设之路", "科技之路", "救赎之路"]
};


// ============================================================================
// v9.4 连续生涯经济与科研产出曲线（R8/R16/R20 皇家资助与 R21-R32 亡灵讨伐嘉奖）+ 1360x740 零重叠全景科技星盘
// ============================================================================
export const V94_CONTINUOUS_CAMPAIGN_ECONOMY = {
  r8CampSubsidyCopper: 60,
  r16GoblinBossBountyCopper: 160,
  r20SettlementCharterCopper: 520,
  r20RoyalAcademyEndowmentRp: 45,
  r21To32UndeadWarChestCopper: 85,
  r25UndeadGeneralWarChestCopper: 140,
  r21To32AcademyWaveRp: 29,
  r25AcademyBossWaveRp: 41,
  techViewBox: { width: 1360, height: 740, cx: 680, cy: 370, rx: 1.40, ry: 0.82, ringRadii: [0, 136, 236, 332] }
};


// ============================================================================
// v9.5 前期满编动态侦察增援（R2-R6）、终局无头骑士恐惧震城（R32）与全 18 项（40 级）科技完整推荐链
// ============================================================================
export const V95_FULL_TECH_REC_PRIORITY = [
  "T002", "T007", "T012", "T014", "T004", "T008",
  "T005", "T006", "T001", "T003", "T017", "T018",
  "T009", "T010", "T013", "T015", "T011", "T016"
];


// ============================================================================
// v9.6 三大章节首领（R16/R25/R32）二阶段与绝境反扑专属轰城技 + 战前真实时代波峰战力评估与科技星盘中心环形进度
// ============================================================================
export const V96_BOSS_KEEP_SIEGE_STRIKES = {
  phase2At55Pct: {
    goblinBoss: { dmg: 24, text: "🪨头领投石轰城 -24", color: "#fb923c" },
    skeletonGeneral: { dmg: 30, text: "💀亡者骨矛轰城 -30", color: "#f87171" },
    headlessKnight: { dmg: 36, text: "🐎恐惧震城 -36", color: "#c084fc" }
  },
  finalStandAt24Pct: {
    goblinBoss: { dmg: 16, text: "💥狂暴砸城 -16", color: "#fbbf24" },
    skeletonGeneral: { dmg: 20, text: "⚡冥火震城 -20", color: "#fb7185" },
    headlessKnight: { dmg: 28, text: "⚡暗影震击 -28", color: "#fb7185" }
  }
};


// ============================================================================
// v9.7 T009【荒地开垦】第5农田自动开垦闭环 + R7+远程/法系敌军流矢袭城 + 科技胶囊单级收益简标
// ============================================================================
export const V97_TECH_SHORT_EFFECTS: Record<string, string> = {
  T001: "战士攻+1", T002: "解锁法师塔", T003: "民兵晋升", T004: "法师攻+2",
  T005: "弓手攻+1", T006: "弓手晋升",   T007: "护卫晋升", T008: "护卫甲+1",
  T009: "农田+1块", T010: "产粮-2s",    T011: "产粮+1🪙", T012: "城防+50",
  T013: "城防+1/s", T014: "科研-10s",   T015: "科研+1📘", T016: "研究塔晋升",
  T017: "全体+1/s", T018: "治疗+1💚"
};


// ============================================================================
// v9.8 1->32 连续零广告生涯 40/40 全科技满级毕业闭环（含 T016 二级研究塔）+ 攻城/重装破城震波与前期飞斧袭城 + 8大星盘分支实时满级徽章
// ============================================================================
export const V98_SETTLEMENT_ARCANE_TOME_CURVE = {
  r20EndowmentRp: 100,
  r21To24WaveRp: 95,
  r25BossTomeRp: 260,
  r26To31WaveRp: 150,
  r32FinalTomeRp: 220,
  siegeShockwaveChip: 7,
  heavyShockwaveChip: 5,
  earlyRaiderAxeChip: 4
};


// ============================================================================
// v9.9 R25【亡者将军】首领二阶段骨火亲卫与骨矛轰城张力升级 + 21-32 回合三阶演练平滑梯度 + 科技树满级节点一键链式跳研
// ============================================================================
export const V99_R25_BOSS_CLIMAX_SPEC = {
  r25BossHpMul: 1.72,
  r25BossAtkMul: 1.24,
  r25Phase2Escorts: ["skeletonWarrior", "skeletonArcher", "skeletonMage"],
  r25Phase2KeepStrike: 28,
  r25FinalStandKeepStrike: 18
};


// ============================================================================
// v10.0 商业化正式版里程碑：酒馆三英雄满编自动替补与全英雄激励重招闭环 + 科技树18节点“当前->下一级”实时数值预览 + R15/R28/R30精英波次半血特技
// ============================================================================
export const V100_ELITE_MIDWAVE_CLIMAX = {
  siegeGoblin50Pct: { shield: 18, duration: 4.0, keepStrike: 10, label: "⚙️装甲冲锋！" },
  subCommanderGen50Pct: { shield: 20, duration: 4.0, label: "👹白骨壁垒！" },
  necromancer50Pct: { shield: 16, duration: 3.5, bonusSummon: "skeleton", label: "🧙死灵秘仪！" }
};


// ============================================================================
// v10.1 黑市差券一键看激励视频自动补券并直兑闭环 + 科技星盘“可研”角标与分支可研点 + R08/R20章节守门关半血反扑特技
// ============================================================================
export const V101_GATEKEEPER_CLIMAX = {
  r08AxeGoblin50Pct: { shield: 12, duration: 3.5, keepStrike: 6, label: "📯反扑号角！" },
  r20SkeletonWarrior50Pct: { shield: 15, duration: 3.5, keepStrike: 8, label: "⚰️墓园阴风！" }
};


// ============================================================================
// v10.2 第32回合通关后【🏆 巅峰重演 R32】自由挑战闭环 + 科技星盘中心研究塔一键研发与三环阶位导览 + 顶部导航栏 可研·N 实时计数
// ============================================================================
export const V102_TRIUMPH_REPLAY_AND_RING_TIERS = {
  triumphReplayRound: 32,
  triumphReplayBonusRp: 30,
  ringTierLabels: { 136: "Ⅰ阶基础环", 236: "Ⅱ阶进阶环", 332: "Ⅲ阶终极环" }
};


// ============================================================================
// v10.3 科技星盘8大外圈分支内嵌进度条与可研点同步 + 第32回合通关实时战果勋章与终局★N巅峰凯旋星级递进 + 顶部资源胶囊智能二段动作
// ============================================================================
export const V103_TRIUMPH_PRESTIGE_SCALING = {
  hpPerTriumphStar: 0.04,
  maxTriumphBonusTier: 4,
  outerBranchBarWidth: 82,
  outerBranchBarHeight: 2.4
};


// ============================================================================
// v10.4 晋升精锐兵种（护卫队长/熟练民兵/熟练弓手）完整继承同系训练营加成与战场详情卡一键训兵 + 科技树分支徽章二段直研 + 终局巅峰重演波次卡同步
// ============================================================================
export function resolveLineageTrainingKeyV104(kind: string): string | null {
  if (kind === "guard" || kind === "guardCaptain") return "guard";
  if (kind === "militia" || kind === "veteranMilitia") return "militia";
  if (kind === "archer" || kind === "veteranArcher") return "archer";
  if (kind === "medic") return "medic";
  return null;
}

/** v10.5: Get ordered branch progression chain (Ring I -> Ring II -> Ring III) & Triumph Star pre-wave power multiplier */
export function getTechBranchChain(branchName: string, allTechs: Array<{ id: string; name: string; branch: string; ring: number; maxLevel: number }>): Array<{ id: string; name: string; ring: number; maxLevel: number }> {
  return allTechs.filter(t => t.branch === branchName).sort((a, b) => a.ring - b.ring);
}
export function getTriumphPowerMultipliers(roundNum: number, completedRound: number, triumphClearCount: number): { hpMul: number; atkMul: number } {
  if (roundNum === 32 && completedRound >= 32) {
    const tier = Math.min(5, Math.max(1, triumphClearCount || 1));
    return { hpMul: 1 + tier * 0.04, atkMul: 1 + tier * 0.03 };
  }
  return { hpMul: 1.0, atkMul: 1.0 };
}


/** v10.6: Era-scaled late-campaign (R21-R32) siege volley & heavy melee Keep-shockwave damage calculator */
export function getEraScaledKeepSiegeChip(roundNum: number, isRangedVolley: boolean, isMagic: boolean, isSiegeJob: boolean): { dmg: number; maxWaveMeleeChips: number } {
  const isEra4 = roundNum >= 21;
  if (isRangedVolley) {
    return { dmg: isEra4 ? (isMagic ? 10 : 7) : (isMagic ? 6 : 4), maxWaveMeleeChips: isEra4 ? 4 : 2 };
  }
  return {
    dmg: isEra4 ? (isSiegeJob ? 12 : 9) : (isSiegeJob ? 7 : 5),
    maxWaveMeleeChips: isEra4 ? 4 : 2
  };
}


/** v11.0: Epic Boss Colossal Scale, Phase-2 Growth & Dedicated Skill Cooldown Configs */
export function getBossOverhaulProfile(kind: string, isPhase2: boolean): { spriteSize: number; radius: number; bgmStepMs: number; title: string } {
  const mul = isPhase2 ? 1.10 : 1.0;
  if (kind === "headlessKnight") {
    return { spriteSize: Math.round(152 * mul), radius: 38, bgmStepMs: 175, title: "终局骑主·无头骑士" };
  }
  if (kind === "goblinBoss") {
    return { spriteSize: Math.round(128 * mul), radius: 33, bgmStepMs: 188, title: "部落战王·哥布林头领" };
  }
  return { spriteSize: Math.round(124 * mul), radius: 32, bgmStepMs: 192, title: "死灵统帅·亡者将军" };
}


/** v11.5: Get 3-Phase Boss Dossier & Phase Threshold Ratios (55% Phase-2 Enrage, 24% Phase-3 Final Stand) */
export function getBossPhaseThresholds(): { phase2Ratio: number; phase3Ratio: number } {
  return { phase2Ratio: 0.55, phase3Ratio: 0.24 };
}

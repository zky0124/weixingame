import { UNIT_DATA } from '../数据/UnitData';

export type Kind = 'guard' | 'goblin';
export type Phase = 'ready' | 'battle' | 'victory' | 'defeat' | 'complete';
export interface Unit {
  id: number; kind: Kind; x: number; y: number; hp: number; cooldown: number;
  flash: number; swing: number; target: number;
  /** 固定驻守槽位；旧存档由加载时补齐，敌人不使用此字段。 */
  post?: number;
}
export interface Snapshot {
  version: 1; phase: Phase; round: number; coins: number; cityLevel: number;
  cityHp: number; farm: boolean; farmTime: number; kingPaid: boolean;
  units: Unit[]; nextId: number; focus: number; elapsed: number;
}
export interface SaveData { state: Snapshot; checkpoint: Snapshot | null }
export const RULES = { cityHp: 100, upgradeCost: 30, farmCost: 5, recruitCost: 1, armyCap: 8, farmSeconds: 10, totalRounds: 4, cityRadius: 1.5 } as const;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export function damage(attack: number, defense: number): number { return Math.max(0, attack - defense); }
export function guardPost(post: number): { x: number; y: number } {
  const angle = post * 2.399;
  return { x: Math.cos(angle) * 2.7, y: Math.sin(angle) * 2.7 };
}

/** 与渲染、平台和存储无关；游戏和自动验证共用此战斗逻辑。 */
export class BattleModel {
  state: Snapshot;
  checkpoint: Snapshot | null = null;
  message = '国王派你来到蛮荒平原。三名护卫已就位，准备迎敌。';
  constructor() {
    this.state = { version: 1, phase: 'ready', round: 0, coins: 0, cityLevel: 0, cityHp: RULES.cityHp, farm: false, farmTime: 0, kingPaid: false, units: [], nextId: 1, focus: 0, elapsed: 0 };
    for (let i = 0; i < 3; i++) this.addGuard();
  }
  get guards(): Unit[] { return this.state.units.filter(u => u.kind === 'guard' && u.hp > 0); }
  get enemies(): Unit[] { return this.state.units.filter(u => u.kind === 'goblin' && u.hp > 0); }
  private addGuard(): void {
    const occupied = new Set(this.guards.map(u => u.post));
    let post = 0;
    while (occupied.has(post)) post++;
    const home = guardPost(post);
    this.state.units.push({ id: this.state.nextId++, kind: 'guard', ...home, post, hp: UNIT_DATA.guard.hp, cooldown: 0, flash: 0, swing: 0, target: 0 });
  }
  recruit(): boolean {
    if (this.state.phase === 'defeat' || this.state.coins < RULES.recruitCost || this.guards.length >= RULES.armyCap) return false;
    this.state.coins -= RULES.recruitCost;
    this.addGuard(); this.message = '新护卫加入！护卫可直接花1铜币招募。'; return true;
  }
  upgrade(): boolean {
    if (this.state.cityLevel !== 0 || !this.state.kingPaid || this.state.coins < RULES.upgradeCost || this.state.phase === 'defeat') return false;
    this.state.coins -= RULES.upgradeCost; this.state.cityLevel = 1;
    this.message = '简易房屋建成，解锁第一块农田。'; return true;
  }
  buildFarm(): boolean {
    if (!this.state.cityLevel || this.state.farm || this.state.coins < RULES.farmCost || this.state.phase === 'defeat') return false;
    this.state.coins -= RULES.farmCost; this.state.farm = true; this.state.farmTime = 0;
    this.message = '农田开始生产：在线每10秒＋1铜币，每次迎敌另＋1铜币。'; return true;
  }
  startRound(): boolean {
    const s = this.state;
    if (!['ready', 'victory'].includes(s.phase) || s.round >= RULES.totalRounds) return false;
    if (s.round === 1 && (!s.cityLevel || !s.farm)) { this.message = '先进入主城，升级房屋并修建农田，再继续迎敌。'; return false; }
    this.checkpoint = clone(s);
    s.round++; s.phase = 'battle'; s.focus = 0;
    if (s.farm) s.coins++;
    for (let i = 0; i < s.round + 2; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      s.units.push({ id: s.nextId++, kind: 'goblin', x: side * (10.5 + (i % 3) * 0.6), y: -3.7 + ((i * 2.7 + s.round) % 7.4), hp: UNIT_DATA.goblin.hp, cooldown: 0.5, flash: 0, swing: 0, target: 0 });
    }
    this.message = `第${s.round}回合：哥布林从平原两侧袭来！双击敌人可全军集火。`;
    return true;
  }
  setFocus(id: number): boolean {
    if (!this.enemies.some(u => u.id === id)) return false;
    this.state.focus = id; this.message = '已下达集火命令，护卫优先追击标记目标。'; return true;
  }
  retry(): boolean {
    if (this.state.phase !== 'defeat' || !this.checkpoint) return false;
    this.state = clone(this.checkpoint); this.checkpoint = null;
    this.message = '已回到战前，整次尝试的掉落、消耗和建设一并回滚。可补员再迎敌。'; return true;
  }
  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const s = this.state;
    if (s.phase === 'defeat') return;
    s.elapsed += dt;
    if (s.farm) {
      s.farmTime += dt;
      const count = Math.floor((s.farmTime + 1e-8) / RULES.farmSeconds);
      if (count) { s.coins += count; s.farmTime = Math.max(0, s.farmTime - count * RULES.farmSeconds); }
    }
    // 清场只结束交战，世界时钟不停止；存活士兵走回自己的固定驻守点。
    if (s.phase !== 'battle') {
      for (const unit of this.guards) {
        unit.target = 0; unit.flash = Math.max(0, unit.flash - dt); unit.swing = Math.max(0, unit.swing - dt);
        unit.cooldown = Math.max(0, unit.cooldown - dt);
        const home = guardPost(unit.post!);
        const dx = home.x - unit.x, dy = home.y - unit.y, distance = Math.hypot(dx, dy);
        const step = UNIT_DATA.guard.speed * dt;
        if (distance <= step) { unit.x = home.x; unit.y = home.y; }
        else { unit.x += dx / distance * step; unit.y += dy / distance * step; }
      }
      return;
    }
    const strikes: { from: number; to: number; amount: number }[] = [];
    const living = s.units.filter(u => u.hp > 0);
    for (const unit of living) {
      unit.cooldown = Math.max(0, unit.cooldown - dt); unit.flash = Math.max(0, unit.flash - dt); unit.swing = Math.max(0, unit.swing - dt);
      const data = UNIT_DATA[unit.kind];
      const opponents = living.filter(u => u.kind !== unit.kind);
      let target = unit.kind === 'guard' ? opponents.find(u => u.id === s.focus) : undefined;
      if (!target) target = opponents.sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y) || a.id - b.id)[0];
      let tx = target?.x ?? 0, ty = target?.y ?? 0, distance = target ? Math.hypot(tx - unit.x, ty - unit.y) : Infinity;
      let targetId = target?.id ?? 0;
      let range: number = data.range;
      if (unit.kind === 'goblin') {
        const cityDistance = Math.hypot(unit.x, unit.y);
        if (cityDistance - RULES.cityRadius < distance) { tx = 0; ty = 0; distance = cityDistance; range += RULES.cityRadius; targetId = -1; }
      }
      if (targetId === 0) continue;
      unit.target = targetId;
      if (distance > range) {
        const move = Math.min(data.speed * dt, distance - range + 0.001);
        unit.x += (tx - unit.x) / distance * move; unit.y += (ty - unit.y) / distance * move;
      } else if (unit.cooldown <= 0) {
        const defense = targetId === -1 ? 0 : UNIT_DATA[target!.kind].armor;
        strikes.push({ from: unit.id, to: targetId, amount: damage(data.attack, defense) });
        unit.cooldown = 1 / data.rate; unit.swing = 0.18;
      }
    }
    // 友方单位轻微分离，保持身体可辨认；不改射程和数值。
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const a = living[i], b = living[j];
      if (a.kind !== b.kind) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len > 0.001 && len < 0.6) {
        const push = Math.min((0.6 - len) / 2, dt * 0.7);
        a.x -= dx / len * push; a.y -= dy / len * push; b.x += dx / len * push; b.y += dy / len * push;
      }
    }
    for (const hit of strikes) {
      if (hit.to === -1) s.cityHp = Math.max(0, s.cityHp - hit.amount);
      else {
        const victim = s.units.find(u => u.id === hit.to)!;
        if (victim.hp <= 0) continue;
        victim.hp = Math.max(0, victim.hp - hit.amount); victim.flash = 0.15;
        if (victim.hp === 0 && victim.kind === 'goblin') s.coins++;
      }
    }
    s.units = s.units.filter(u => u.hp > 0);
    if (!this.enemies.some(u => u.id === s.focus)) s.focus = 0;
    if (s.cityHp === 0) { s.phase = 'defeat'; this.message = '庇护所被攻破。可免费回到战前检查点，再调整部队。'; }
    else if (!this.enemies.length) {
      s.phase = s.round === RULES.totalRounds ? 'complete' : 'victory';
      s.focus = 0;
      for (const unit of this.guards) { unit.target = 0; unit.swing = 0; }
      if (!s.kingPaid) { s.kingPaid = true; s.coins += 50; this.message = '首战告捷！击杀获得3铜币，国王另送50铜币。进入主城升级。'; }
      else this.message = s.phase === 'complete' ? '前4回合验证完成！这只是玩法原型，后续将继续建设营地与定居点。' : '守住了！可自由建设和补员，准备好后再迎敌。';
    }
  }
  save(): SaveData { return { state: clone(this.state), checkpoint: clone(this.checkpoint) }; }
  static load(raw: unknown): BattleModel | null {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as SaveData;
    const valid = (s: Snapshot): boolean => {
      if (!s || s.version !== 1 || !['ready', 'battle', 'victory', 'defeat', 'complete'].includes(s.phase)) return false;
      if (!Number.isInteger(s.round) || s.round < 0 || s.round > 4 || !Number.isInteger(s.coins) || s.coins < 0 || s.coins > 1e12) return false;
      if (![0, 1].includes(s.cityLevel) || !Number.isFinite(s.cityHp) || s.cityHp < 0 || s.cityHp > RULES.cityHp || typeof s.farm !== 'boolean' || typeof s.kingPaid !== 'boolean') return false;
      if (!Number.isFinite(s.farmTime) || s.farmTime < 0 || s.farmTime >= 10 || !Number.isFinite(s.elapsed) || s.elapsed < 0 || !Number.isInteger(s.nextId) || !Number.isInteger(s.focus)) return false;
      if (!Array.isArray(s.units) || s.units.length > 32 || s.units.some(u => !u || typeof u !== 'object') || new Set(s.units.map(u => u.id)).size !== s.units.length) return false;
      const posts = s.units.filter(u => u.kind === 'guard' && u.post !== undefined).map(u => u.post);
      if (posts.some(p => !Number.isInteger(p) || p! < 0 || p! >= RULES.armyCap) || new Set(posts).size !== posts.length) return false;
      if (s.units.filter(u => u.kind === 'guard').length > RULES.armyCap) return false;
      return s.units.every(u => u && ['guard', 'goblin'].includes(u.kind) && Number.isInteger(u.id) && u.id > 0 && u.id < s.nextId && Number.isFinite(u.x) && Math.abs(u.x) < 30 && Number.isFinite(u.y) && Math.abs(u.y) < 20 && Number.isFinite(u.hp) && u.hp > 0 && u.hp <= UNIT_DATA[u.kind].hp && [u.cooldown, u.flash, u.swing].every(v => Number.isFinite(v) && v >= 0) && Number.isInteger(u.target));
    };
    if (!valid(data.state) || (data.checkpoint !== null && (!valid(data.checkpoint) || !['ready', 'victory'].includes(data.checkpoint.phase)))) return null;
    if (['battle', 'defeat'].includes(data.state.phase) && !data.checkpoint) return null;
    const model = new BattleModel(); model.state = clone(data.state); model.checkpoint = clone(data.checkpoint);
    // 保留v0.1.0的金钱、血量和回合；只给旧护卫补充缺失的驻守编号。
    for (const snapshot of [model.state, model.checkpoint]) {
      if (!snapshot) continue;
      const occupied = new Set(snapshot.units.filter(u => u.kind === 'guard' && u.post !== undefined).map(u => u.post));
      for (const unit of snapshot.units.filter(u => u.kind === 'guard' && u.post === undefined)) {
        let post = 0; while (occupied.has(post)) post++;
        unit.post = post; occupied.add(post);
      }
    }
    model.message = '已恢复本地进度；关闭期间不结算离线收益。'; return model;
  }
}

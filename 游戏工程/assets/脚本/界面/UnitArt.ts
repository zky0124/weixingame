import { Color, Layers, Node, resources, Sprite, SpriteFrame, UITransform, isValid } from 'cc';
import { UnitKind } from '../数据/UnitData';

export type UnitVisualKey = UnitKind | 'frog_kungfu' | 'frog_laugh';
export type UnitAnimState = 'idle' | 'walk' | 'attack';

const ALL_UNIT_KEYS: UnitVisualKey[] = [
  'guard', 'militia', 'archer', 'medic', 'veteranMilitia', 'veteranArcher', 'guardCaptain', 'mage',
  'ron', 'ailin', 'frog', 'frog_kungfu', 'frog_laugh',
  'goblin', 'stoneGoblin', 'wolf', 'shieldGoblin', 'healerGoblin', 'mageGoblin', 'siegeGoblin', 'goblinBoss',
  'skeleton', 'skeletonArcher', 'skeletonWarrior', 'zombie', 'ghost', 'skeletonMage', 'skeletonGeneral', 'necromancer', 'headlessKnight',
];

const ACTION_UNITS: UnitKind[] = [
  'guard', 'archer', 'mage', 'ron',
  'goblin', 'goblinBoss', 'skeletonGeneral', 'headlessKnight',
  'militia', 'medic', 'guardCaptain', 'ailin',
  'wolf', 'skeletonWarrior', 'necromancer', 'zombie',
  'veteranMilitia', 'veteranArcher', 'stoneGoblin', 'shieldGoblin',
  'healerGoblin', 'mageGoblin', 'skeleton', 'skeletonArcher',
  'siegeGoblin', 'ghost', 'skeletonMage',
];

/** 28个单位 + 奶蛙双态 + 核心兵种与三大Boss的 idle/walk/attack 多帧关键姿态加载器。 */
export class UnitArt {
  private frames: Partial<Record<string, SpriteFrame>> = {};
  private alive = true;

  constructor(private changed: () => void) {
    for (const key of ALL_UNIT_KEYS) {
      resources.load(`王国保卫战风格素材/${key}/spriteFrame`, SpriteFrame, (err, frame) => {
        if (!this.alive) return;
        if (!err && frame) this.frames[key] = frame;
        this.changed();
      });
    }
    for (const u of ACTION_UNITS) {
      for (const act of ['walk', 'attack'] as const) {
        const k = `${u}_${act}`;
        resources.load(`王国保卫战风格素材/动作帧/${k}/spriteFrame`, SpriteFrame, (err, frame) => {
          if (!this.alive) return;
          if (!err && frame) this.frames[k] = frame;
          this.changed();
        });
      }
    }
  }

  has(key: UnitVisualKey): boolean { return !!this.frames[key]; }
  dispose(): void { this.alive = false; }

  static createNode(parent: Node, name: string): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = true;
    return node;
  }

  static widthFor(kind: UnitKind, isPhase2 = false, isSubCommander = false): number {
    const pMul = isPhase2 ? 1.10 : 1.0;
    if (kind === 'headlessKnight') return Math.round(152 * pMul);
    if (kind === 'goblinBoss') return Math.round(128 * pMul);
    if (kind === 'skeletonGeneral') return isSubCommander ? 92 : Math.round(124 * pMul);
    if (kind === 'siegeGoblin') return 68;
    if (kind === 'frog') return 60;
    if (kind === 'ron' || kind === 'ailin') return 54;
    return 46;
  }

  show(
    node: Node,
    key: UnitVisualKey,
    x: number,
    y: number,
    facingLeft = false,
    flash = false,
    animState: UnitAnimState = 'idle',
  ): void {
    if (!isValid(node)) return;
    const actionKey = animState !== 'idle' ? `${key}_${animState}` : key;
    const frame = this.frames[actionKey] || this.frames[key];
    node.active = !!frame;
    if (!frame) return;
    const sprite = node.getComponent(Sprite)!;
    if (sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
    sprite.color = flash ? new Color(255, 220, 220, 255) : Color.WHITE;
    const baseKind: UnitKind = (key === 'frog_kungfu' || key === 'frog_laugh') ? 'frog' : key;
    const width = UnitArt.widthFor(baseKind) * (animState === 'attack' ? 1.06 : 1.0);
    const tf = node.getComponent(UITransform)!;
    tf.setAnchorPoint(0.5, 0.14);
    tf.setContentSize(width, width * frame.rect.height / frame.rect.width);
    node.setScale(facingLeft ? -1 : 1, 1, 1);
    node.setPosition(x, y);
  }
}

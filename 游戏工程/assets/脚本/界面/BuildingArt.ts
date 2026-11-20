import { Color, Layers, Node, resources, Sprite, SpriteFrame, UITransform, isValid } from 'cc';

export type BuildingKind =
  | 'shelter' | 'house' | 'camp' | 'settlement'
  | 'farm' | 'hospital' | 'militiaCamp' | 'archerCamp'
  | 'tavern' | 'trainingCamp' | 'researchTower' | 'mageTower' | 'blackMarket';

const SOURCES: Record<BuildingKind, string> = {
  shelter: '王国保卫战风格素材/keep_0/spriteFrame',
  house: '王国保卫战风格素材/keep_1/spriteFrame',
  camp: '王国保卫战风格素材/keep_2/spriteFrame',
  settlement: '王国保卫战风格素材/keep_3/spriteFrame',
  farm: '王国保卫战风格素材/b_farm/spriteFrame',
  hospital: '王国保卫战风格素材/b_hospital/spriteFrame',
  militiaCamp: '王国保卫战风格素材/b_militiaCamp/spriteFrame',
  archerCamp: '王国保卫战风格素材/b_archerCamp/spriteFrame',
  tavern: '王国保卫战风格素材/b_tavern/spriteFrame',
  trainingCamp: '王国保卫战风格素材/b_trainingCamp/spriteFrame',
  researchTower: '王国保卫战风格素材/b_researchTower/spriteFrame',
  mageTower: '王国保卫战风格素材/b_mageTower/spriteFrame',
  blackMarket: '王国保卫战风格素材/b_blackMarket/spriteFrame',
};

/** 升级自原工程 BuildingArt.ts：100% 兼容原有接口，扩展支持阶段1全部四阶主城与9座城内建筑。 */
export class BuildingArt {
  private frames: Partial<Record<BuildingKind, SpriteFrame>> = {};
  private failed = new Set<BuildingKind>();
  private alive = true;

  constructor(private changed: () => void) {
    for (const kind of Object.keys(SOURCES) as BuildingKind[]) {
      resources.load(SOURCES[kind], SpriteFrame, (error, frame) => {
        if (!this.alive) return;
        if (error || !frame) {
          this.failed.add(kind);
          console.warn(`建筑素材载入失败：${SOURCES[kind]}`);
        } else {
          this.frames[kind] = frame;
        }
        this.changed();
      });
    }
  }

  get loadedCount(): number { return Object.keys(this.frames).length; }
  get hasFailures(): boolean { return this.failed.size > 0; }
  has(kind: BuildingKind): boolean { return !!this.frames[kind]; }
  dispose(): void { this.alive = false; }

  static createNode(parent: Node, name: string): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = true;
    node.active = false;
    return node;
  }

  show(node: Node, kind: BuildingKind, x: number, y: number, width: number, visible = true): void {
    if (!isValid(node)) return;
    const frame = this.frames[kind];
    node.active = visible && !!frame;
    if (!frame || !visible) return;
    const sprite = node.getComponent(Sprite)!;
    if (sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
    sprite.color = Color.WHITE;
    const transform = node.getComponent(UITransform)!;
    const anchorY = kind === 'farm' ? 0.43 : (kind === 'shelter' ? 0.25 : 0.23);
    transform.setAnchorPoint(0.5, anchorY);
    transform.setContentSize(width, width * frame.rect.height / frame.rect.width * (kind === 'farm' ? 0.9 : 1));
    node.setPosition(x, y);
  }
}

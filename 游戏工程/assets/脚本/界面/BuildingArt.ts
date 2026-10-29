import { Color, Layers, Node, resources, Sprite, SpriteFrame, UITransform, isValid } from 'cc';

export type BuildingKind = 'shelter' | 'house' | 'farm';
const SOURCES: Record<BuildingKind, string> = {
  shelter: '建筑/临时庇护所/spriteFrame',
  house: '建筑/简易房屋/spriteFrame',
  farm: '建筑/农田/spriteFrame',
};

/** 图片只负责外观，建筑占地、收入、血量和存档仍由逻辑模型管理。 */
export class BuildingArt {
  private frames: Partial<Record<BuildingKind, SpriteFrame>> = {};
  private failed = new Set<BuildingKind>();
  private alive = true;
  constructor(private changed: () => void) {
    for (const kind of Object.keys(SOURCES) as BuildingKind[]) {
      resources.load(SOURCES[kind], SpriteFrame, (error, frame) => {
        if (!this.alive) return;
        if (error || !frame) { this.failed.add(kind); console.warn(`建筑素材载入失败：${SOURCES[kind]}`); }
        else this.frames[kind] = frame;
        this.changed();
      });
    }
  }
  get loadedCount(): number { return Object.keys(this.frames).length; }
  get hasFailures(): boolean { return this.failed.size > 0; }
  has(kind: BuildingKind): boolean { return !!this.frames[kind]; }
  dispose(): void { this.alive = false; }
  static createNode(parent: Node, name: string): Node {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; parent.addChild(node);
    node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = true;
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
    // 锚点对齐地基中心；农田保留作物高度并让2×2地面贴合网格。
    transform.setAnchorPoint(0.5, kind === 'farm' ? 0.43 : kind === 'shelter' ? 0.25 : 0.23);
    transform.setContentSize(width, width * frame.rect.height / frame.rect.width * (kind === 'farm' ? 0.9 : 1));
    node.setPosition(x, y);
  }
}

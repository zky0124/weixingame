export interface MapPoint { x: number; y: number }

/** 仅改变显示坐标；地图逻辑、射程和建筑占地不随镜头变化。 */
export class MapViewport {
  zoom = 1;
  x = 0;
  y = 0;
  private touches = new Map<number, MapPoint>();
  private start: MapPoint = { x: 0, y: 0 };
  private consumed = false;
  constructor(private bounds: MapPoint, readonly minZoom = 0.65, readonly maxZoom = 2.5) {}
  get active(): boolean { return this.touches.size > 0; }
  toWorld(p: MapPoint): MapPoint { return { x: (p.x - this.x) / this.zoom, y: (p.y - this.y) / this.zoom }; }
  reset(): void { this.zoom = 1; this.x = this.y = 0; this.cancel(); }
  cancel(): void { this.touches.clear(); this.consumed = false; }
  private clamp(): void {
    this.x = Math.max(-this.bounds.x * this.zoom, Math.min(this.bounds.x * this.zoom, this.x));
    this.y = Math.max(-this.bounds.y * this.zoom, Math.min(this.bounds.y * this.zoom, this.y));
  }
  zoomAt(p: MapPoint, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const world = this.toWorld(p);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.x = p.x - world.x * this.zoom; this.y = p.y - world.y * this.zoom;
    this.clamp();
  }
  begin(id: number, p: MapPoint): void {
    if (!this.active) { this.start = { ...p }; this.consumed = false; }
    this.touches.set(id, { ...p });
    if (this.touches.size > 1) this.consumed = true;
  }
  move(id: number, p: MapPoint): void {
    const previous = this.touches.get(id);
    if (!previous) return;
    // Cocos的宽松转译把迭代器展开视为数组拼接，显式Array.from保证真机包一致。
    const before = Array.from(this.touches.values()).slice(0, 2);
    this.touches.set(id, { ...p });
    if (before.length > 1) {
      const after = Array.from(this.touches.values()).slice(0, 2);
      const center = (a: MapPoint[]) => ({ x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 });
      const oldCenter = center(before), newCenter = center(after);
      const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
      const distance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
      // 先平移双指中心，再围绕新中心缩放，两个手指一起移动也能拖动视角。
      this.x += newCenter.x - oldCenter.x; this.y += newCenter.y - oldCenter.y;
      if (oldDistance > 1 && distance > 1) this.zoomAt(newCenter, distance / oldDistance);
      this.consumed = true;
    } else {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 8) this.consumed = true;
      if (this.consumed) { this.x += p.x - previous.x; this.y += p.y - previous.y; }
    }
    this.clamp();
  }
  end(id: number, cancelled = false): boolean {
    if (!this.touches.has(id)) return false;
    const tap = !cancelled && !this.consumed && this.touches.size === 1;
    this.touches.delete(id);
    // 双指松开一指后继续拖动；直到所有手指抬起都不能触发点选。
    if (cancelled) this.consumed = true;
    return tap;
  }
}

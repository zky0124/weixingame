import { _decorator, Component, Node, UITransform, Canvas, Camera, Color, Graphics, Label, Mask, view, screen, profiler, ResolutionPolicy, Layers, EventTouch, EventMouse, Vec3, sys, game, Game, BlockInputEvents } from 'cc';
import { BattleModel, RULES, guardPost } from '../战斗/BattleModel';
import { UNIT_DATA } from '../数据/UnitData';
import { CityCell, DEFAULT_FARM, project, unproject, farmPlacementError, isHall, isRoad, inFarm } from '../城市/CityLayout';
import { BuildingArt, BuildingKind } from './BuildingArt';
import { MapViewport, MapPoint } from './MapViewport';

const { ccclass } = _decorator;
const SAVE_KEY = 'frontier-prototype-save-v1';
const C = { ink: '#27392d', parchment: '#f0dfb6', gold: '#efc66a', forest: '#193d32', green: '#466e48', muted: '#b7c8a5', white: '#fff5da' };

@ccclass('BattleView')
export class BattleView extends Component {
  private model = new BattleModel();
  private canvas!: Node;
  private safeUi!: Node;
  private art!: Graphics;
  private units!: Graphics;
  private hud!: Label;
  private hint!: Label;
  private roundButton!: Label;
  private cityPanel!: Node;
  private cityArt!: Graphics;
  private buildingArt!: BuildingArt;
  private cityHallImage!: Node;
  private cityFarmImage!: Node;
  private battleHallImage!: Node;
  private artStatus!: Label;
  private battleBar!: Node;
  private battleTitle!: Node;
  private battlefield!: Node;
  private cityInfo!: Label;
  private cityFeedback!: Label;
  private upgradeLabel!: Label;
  private farmChoice!: Label;
  private buildLabel!: Label;
  private cityTool!: Label;
  private portrait!: Node;
  private modal!: Node;
  private selected = 0;
  private lastTap = 0;
  private cityOpen = false;
  private farmSelected = false;
  private citySelection: 'hall' | 'farm' | 'ground' = 'hall';
  private farmCandidate: CityCell = { ...DEFAULT_FARM };
  private cityView = new MapViewport({ x: 450, y: 200 });
  private battleView = new MapViewport({ x: 600, y: 280 });
  private cityWorld!: Node;
  private battleWorld!: Node;
  private battleReset!: Label;
  private accumulator = 0;
  private saveClock = 0;
  private hidden = false;
  private storageFailed = false;
  private lastHud = '';

  onLoad(): void {
    profiler.hideStats();
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
    try {
      const raw = sys.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const loaded = BattleModel.load(JSON.parse(raw));
        if (loaded) this.model = loaded;
        else this.model.message = '旧存档无效，已开启新旅程；不会读取不完整的战斗状态。';
      }
    } catch { this.storageFailed = true; }
    this.createScene();
    this.buildingArt = new BuildingArt(() => { if (this.isValid) this.refresh(); });
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.refresh();
  }
  onDestroy(): void {
    this.buildingArt?.dispose();
    this.persist();
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
  }
  private onHide(): void { this.hidden = true; this.cityView.cancel(); this.battleView.cancel(); this.persist(); }
  private onShow(): void { this.hidden = false; this.accumulator = 0; }
  private node2D(name: string, parent: Node, x = 0, y = 0, w = 0, h = 0): Node {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; parent.addChild(n);
    n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); return n;
  }
  private graphics(name: string, parent: Node): Graphics { return this.node2D(name, parent).addComponent(Graphics); }
  private text(parent: Node, value: string, x: number, y: number, w: number, h: number, size = 32, color = C.white): Label {
    const n = this.node2D('文字', parent, x, y, w, h); const label = n.addComponent(Label);
    label.string = value; label.fontSize = size; label.lineHeight = size + 9; label.color = new Color(color);
    label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true; return label;
  }
  private rect(g: Graphics, x: number, y: number, w: number, h: number, fill: string, r = 12): void {
    g.fillColor = new Color(fill); g.roundRect(x, y, w, h, r); g.fill();
  }
  private ellipse(g: Graphics, x: number, y: number, rx: number, ry: number, fill: string): void {
    g.fillColor = new Color(fill); g.ellipse(x, y, rx, ry); g.fill();
  }
  private line(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: string, width = 3): void {
    g.strokeColor = new Color(color); g.lineWidth = width; g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  private button(parent: Node, title: string, x: number, y: number, w: number, action: () => void, primary = false): Label {
    const n = this.node2D(title, parent, x, y, w, 88);
    const g = n.addComponent(Graphics);
    this.rect(g, -w / 2, -44, w, 88, C.ink, 15);
    this.rect(g, -w / 2 + 3, -38, w - 6, 79, primary ? C.gold : C.parchment, 12);
    const label = this.text(n, title, 0, 2, w - 18, 72, 32, C.ink);
    let blocked = false;
    n.on(Node.EventType.TOUCH_START, (e: EventTouch) => { blocked = this.cityView.active || this.battleView.active || e.getAllTouches().length > 1; });
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; if (blocked || e.getAllTouches().length > 1) return; this.cityView.cancel(); this.battleView.cancel(); action(); this.refresh(); this.persist(); });
    return label;
  }
  private createScene(): void {
    this.canvas = this.node2D('游戏界面', this.node, 0, 0, 1280, 720);
    const cameraNode = this.node2D('界面相机', this.node);
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO; camera.orthoHeight = 360;
    camera.near = 0.1; camera.far = 2000; camera.visibility = Layers.Enum.UI_2D;
    camera.clearColor = new Color(C.forest);
    const canvas = this.canvas.addComponent(Canvas); canvas.cameraComponent = camera;
    const battleViewport = this.node2D('战场地图视口', this.canvas, 0, 0, 1280, 450);
    battleViewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    this.battleWorld = this.node2D('战场镜头内容', battleViewport);
    this.art = this.graphics('草原与城市占位', this.battleWorld);
    this.drawLandscape();
    this.battleHallImage = BuildingArt.createNode(this.battleWorld, '战场主城美术');
    this.units = this.graphics('战斗单位占位', this.battleWorld);
    this.battlefield = this.node2D('战场触控', this.canvas, 0, 0, 1200, 450);
    this.bindMapInput(this.battlefield, this.battleWorld, this.battleView, p => this.tapBattlefield(p));
    this.safeUi = this.node2D('安全区界面', this.canvas, 0, 0, 1280, 720);
    const header = this.graphics('顶部信息底板', this.safeUi);
    this.rect(header, -616, 244, 1232, 92, C.forest);
    this.hud = this.text(this.safeUi, '', 0, 294, 1160, 70, 32);
    this.battleTitle = this.node2D('战场标题', this.safeUi);
    this.text(this.battleTitle, '蛮荒开拓 · 首战原型', -390, 218, 440, 40, 28, C.parchment);
    this.artStatus = this.text(this.battleTitle, '建筑美术加载中', 390, 218, 440, 40, 26, C.muted);
    const reset = this.node2D('战场视角归中', this.battleTitle, 0, 211, 210, 56);
    this.rect(reset.addComponent(Graphics), -105, -28, 210, 56, C.parchment);
    this.battleReset = this.text(reset, '归中 · 100%', 0, 0, 200, 50, 26, C.ink);
    reset.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; if (this.battleView.active) return; this.battleView.reset(); this.applyMapViews(); });
    this.hint = this.text(this.safeUi, '', 0, -211, 1150, 76, 29, C.white);
    this.battleBar = this.node2D('战场操作栏', this.safeUi);
    this.button(this.battleBar, '进入主城', -463, -292, 260, () => { this.cityOpen = true; });
    this.button(this.battleBar, '招募护卫 · 1铜', -170, -292, 290, () => {
      if (!this.model.recruit()) this.model.message = '招募未完成：需要1铜币、空余名额，且城池尚未失守。';
    });
    this.button(this.battleBar, '设置', 123, -292, 180, () => { this.modal.active = true; });
    this.roundButton = this.button(this.battleBar, '迎敌', 443, -292, 300, () => {
      if (this.model.state.phase === 'defeat') this.model.retry(); else this.model.startRound();
    }, true);
    this.createCity(); this.createSettings();
    this.portrait = this.node2D('请横屏', this.canvas, 0, 0, 1280, 720);
    const pg = this.portrait.addComponent(Graphics); this.rect(pg, -640, -360, 1280, 720, C.forest, 0);
    this.portrait.addComponent(BlockInputEvents);
    this.text(this.portrait, '请将手机横过来\n\n战斗已暂停，恢复横屏后继续', 0, 0, 1060, 280, 42);
    this.portrait.active = false;
  }
  private createCity(): void {
    this.cityPanel = this.node2D('城镇建设地图', this.safeUi, 0, -50, 1280, 580);
    this.cityPanel.addComponent(BlockInputEvents);
    const bg = this.cityPanel.addComponent(Graphics);
    this.rect(bg, -640, -300, 1280, 590, '#647b50', 0);
    const mapViewport = this.node2D('城镇地图视口', this.cityPanel, 0, 35, 1280, 370);
    mapViewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    this.cityWorld = this.node2D('城镇镜头内容', mapViewport);
    this.cityArt = this.graphics('倾斜俯视城镇', this.cityWorld);
    this.cityArt.node.setPosition(0, -35);
    const buildingLayer = this.node2D('城内建筑美术', this.cityWorld, 0, -35);
    this.cityHallImage = BuildingArt.createNode(buildingLayer, '城内主城美术');
    this.cityFarmImage = BuildingArt.createNode(buildingLayer, '城内农田美术');
    const mapInput = this.node2D('城内地图触控', this.cityPanel, 0, 35, 1280, 370);
    this.bindMapInput(mapInput, this.cityWorld, this.cityView, p => {
      // 图片和地块在镜头内容中有-35的布局偏移，点击还原到同一绘制坐标。
      const local = { x: p.x, y: p.y + 35 };
      const tile = unproject(local.x, local.y - 30);
      const hall = this.cityPoint(0, 0);
      const hitHall = Math.abs(local.x - hall.x) < 88 && local.y > hall.y - 42 && local.y < hall.y + 145;
      if (this.farmSelected) {
        this.farmCandidate = tile;
        this.model.message = farmPlacementError(tile) || '位置可用，点击“确认建造”后扣除5铜币。';
      } else if (hitHall || isHall(tile.col, tile.row)) this.citySelection = 'hall';
      else if (this.model.state.farm && inFarm(tile.col, tile.row, this.model.state.farmPlot!)) this.citySelection = 'farm';
      else this.citySelection = 'ground';
      this.refresh();
    });
    this.text(this.cityPanel, '开拓领地 · 城镇建设', -425, 246, 410, 58, 34);
    this.cityTool = this.button(this.cityPanel, '视角归中', 165, 246, 260, () => {
      if (this.farmSelected) { this.farmSelected = false; this.model.message = '已取消选址，没有扣除铜币。'; }
      else { this.cityView.reset(); this.applyMapViews(); }
    });
    this.button(this.cityPanel, '返回战场', 475, 246, 280, () => { this.cityOpen = false; this.farmSelected = false; });
    const dock = this.graphics('底部建设栏', this.cityPanel);
    this.rect(dock, -620, -260, 1240, 126, '#243b30', 12);
    this.cityInfo = this.text(this.cityPanel, '', -430, -197, 340, 114, 29);
    this.upgradeLabel = this.button(this.cityPanel, '主城升级 · 30铜', -83, -198, 290, () => {
      if (!this.model.upgrade()) this.model.message = '升级需首战胜利和30铜币；当前原型最高为简易房屋。';
      this.citySelection = 'hall';
    }, true);
    this.farmChoice = this.button(this.cityPanel, '生产 · 农田5铜', 220, -198, 280, () => {
      if (!this.model.state.cityLevel) this.model.message = '先升级简易房屋，解锁城内建设。';
      else if (this.model.state.farm) {
        this.citySelection = 'farm'; this.farmSelected = false;
        this.model.message = '当前已建一块农田，更多产业随主城成长解锁。';
      } else {
        this.farmSelected = true; this.farmCandidate = { ...DEFAULT_FARM };
        this.model.message = '点按网格预览位置，绿色可建，红色受阻；确认后才扣钱。';
      }
    });
    this.buildLabel = this.button(this.cityPanel, '城池概况', 500, -198, 240, () => {
      if (!this.farmSelected) { this.citySelection = 'hall'; return; }
      const error = farmPlacementError(this.farmCandidate);
      if (error) this.model.message = error + '，请重新选择位置。';
      else if (this.model.buildFarm(this.farmCandidate)) { this.farmSelected = false; this.citySelection = 'farm'; }
      else this.model.message = '建造需5铜币、解锁土地且城池尚未失守。';
    }, true);
    this.cityFeedback = this.text(this.cityPanel, '', 0, -278, 1200, 42, 28);
    this.cityPanel.active = false;
  }
  private cityPoint(col: number, row: number): { x: number; y: number } {
    const p = project(col, row);
    return { x: p.x, y: p.y + 30 };
  }
  private cityPoly(points: { x: number; y: number }[], color: string, stroke = ''): void {
    const g = this.cityArt;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.close(); g.fillColor = new Color(color); g.fill();
    if (stroke) { g.strokeColor = new Color(stroke); g.lineWidth = 2; g.stroke(); }
  }
  private cityTile(col: number, row: number, fill: string, border = ''): void {
    this.cityPoly([this.cityPoint(col, row), this.cityPoint(col + 1, row), this.cityPoint(col + 1, row + 1), this.cityPoint(col, row + 1)], fill, border);
  }
  private drawCityFarm(cell: CityCell, ghost = false): void {
    if (!ghost && this.buildingArt?.has('farm')) return;
    const g = this.cityArt;
    const corners = [this.cityPoint(cell.col, cell.row), this.cityPoint(cell.col + 2, cell.row), this.cityPoint(cell.col + 2, cell.row + 2), this.cityPoint(cell.col, cell.row + 2)];
    this.cityPoly(corners, ghost ? '#8da55d' : '#80603e', ghost ? '#d4ed9b' : '#c5ab73');
    for (let i = 1; i < 8; i++) {
      const a = this.cityPoint(cell.col + i / 4, cell.row + 0.12), b = this.cityPoint(cell.col + i / 4, cell.row + 1.88);
      this.line(g, a.x, a.y, b.x, b.y, ghost ? '#b6d383' : '#b69b60', 3);
      for (let j = 1; j < 5; j++) {
        const p = this.cityPoint(cell.col + i / 4, cell.row + j * 0.36);
        this.line(g, p.x, p.y, p.x - 2, p.y + 7, '#cad875', 3);
      }
    }
    for (const p of corners) this.line(g, p.x, p.y, p.x, p.y + 14, '#cbb48a', 4);
  }
  private drawCityHall(): void {
    const g = this.cityArt, s = this.model.state;
    const p = this.cityPoint(0, 0), h = s.cityLevel ? 58 : 39;
    const local = (x: number, y: number) => ({ x: p.x + x, y: p.y + y });
    if (this.buildingArt?.has(s.cityLevel ? 'house' : 'shelter')) {
      this.ellipse(g, p.x + 4, p.y - 4, 84, 29, '#587143');
      if (this.citySelection === 'hall' && !this.farmSelected) this.cityPoly([local(0, -44), local(88, 0), local(0, 44), local(-88, 0)], '#ffffff00', '#eed396');
      return;
    }
    this.ellipse(g, p.x + 6, p.y - 24, 97, 39, '#516d42');
    this.cityPoly([local(-80, 0), local(0, -40), local(0, h - 40), local(-80, h)], '#a68a60');
    this.cityPoly([local(0, -40), local(80, 0), local(80, h), local(0, h - 40)], s.cityLevel ? '#d0ba87' : '#bda16c');
    this.cityPoly([local(-88, h), local(0, h - 44), local(0, h + 54)], s.cityLevel ? '#745344' : '#b9975d');
    this.cityPoly([local(0, h - 44), local(88, h), local(0, h + 54)], s.cityLevel ? '#95694d' : '#ddbd76');
    this.cityPoly([local(-50, -15), local(-26, -27), local(-26, 8), local(-50, 20)], '#4e4230');
    this.cityPoly([local(29, -3), local(49, 7), local(49, 25), local(29, 15)], '#e7d09b');
    this.line(g, p.x, p.y + h + 54, p.x, p.y + h + 82, '#5d5137', 3);
    this.cityPoly([local(1, h + 81), local(30, h + 73 + Math.sin(s.elapsed * 3) * 3), local(1, h + 65)], C.gold);
    if (this.citySelection === 'hall' && !this.farmSelected) {
      this.cityPoly([local(0, -44), local(88, 0), local(0, 44), local(-88, 0)], '#ffffff00', '#eed396');
    }
  }
  private drawCity(): void {
    const g = this.cityArt; g.clear(); const s = this.model.state;
    // 所有地物采用同一投影，地图与建筑一体；界面栏独立于地图拖动。
    const terrain = ['#7f925b', '#82965e', '#7b8e56', '#84965f'];
    for (let col = -4; col <= 4; col++) for (let row = -4; row <= 4; row++) {
      const color = isRoad(col, row) ? '#b1a578' : terrain[((col * 11 + row * 7) % 4 + 4) % 4];
      this.cityTile(col, row, color, this.farmSelected ? '#a7b38a' : '');
    }
    const perimeter = [this.cityPoint(-4, -4), this.cityPoint(5, -4), this.cityPoint(5, 5), this.cityPoint(-4, 5)];
    for (let i = 0; i < 4; i++) this.line(g, perimeter[i].x, perimeter[i].y, perimeter[(i + 1) % 4].x, perimeter[(i + 1) % 4].y, '#aab47a', 3);
    for (let i = 0; i < 24; i++) {
      const side = i % 4, v = -4 + Math.floor(i / 4) * 1.7;
      const p = this.cityPoint(side < 2 ? (side ? 5.7 : -5.3) : v, side >= 2 ? (side === 2 ? -5.2 : 5.6) : v);
      this.ellipse(g, p.x, p.y - 4, 26, 12, '#4d673f');
      this.line(g, p.x, p.y, p.x, p.y + 31, '#70553d', 8);
      this.ellipse(g, p.x - 10, p.y + 30, 23, 21, '#426640');
      this.ellipse(g, p.x + 9, p.y + 44, 25, 30, '#4c7447');
    }
    const farmBehind = s.farm && s.farmPlot!.col + s.farmPlot!.row + 2 > 0;
    if (farmBehind) this.drawCityFarm(s.farmPlot!);
    this.drawCityHall();
    if (s.farm && !farmBehind) this.drawCityFarm(s.farmPlot!);
    if (this.farmSelected) {
      const invalid = !!farmPlacementError(this.farmCandidate);
      for (let col = this.farmCandidate.col; col < this.farmCandidate.col + 2; col++) for (let row = this.farmCandidate.row; row < this.farmCandidate.row + 2; row++) {
        this.cityTile(col, row, invalid ? '#b96d63' : '#a4c47b', invalid ? '#ffb6a4' : '#e0f2a5');
      }
      if (!invalid) this.drawCityFarm(this.farmCandidate, true);
    }
    if (this.buildingArt) {
      const hall = this.cityPoint(0, 0);
      this.buildingArt.show(this.cityHallImage, s.cityLevel ? 'house' : 'shelter', hall.x, hall.y, 184);
      const farm = this.cityPoint((s.farmPlot?.col ?? 0) + 1, (s.farmPlot?.row ?? 0) + 1);
      this.buildingArt.show(this.cityFarmImage, 'farm', farm.x, farm.y, 160, s.farm);
      const hallOrder = farmBehind ? 1 : 0, farmOrder = farmBehind ? 0 : 1;
      if (this.cityHallImage.getSiblingIndex() !== hallOrder) this.cityHallImage.setSiblingIndex(hallOrder);
      if (this.cityFarmImage.getSiblingIndex() !== farmOrder) this.cityFarmImage.setSiblingIndex(farmOrder);
    }
  }

  private createSettings(): void {
    this.modal = this.node2D('设置与重开确认', this.safeUi, 0, 0, 1200, 480);
    this.modal.addComponent(BlockInputEvents);
    const g = this.modal.addComponent(Graphics); this.rect(g, -600, -240, 1200, 480, C.forest, 20);
    this.text(this.modal, '本地原型设置', 0, 170, 900, 60, 40);
    this.text(this.modal, '进度自动保存在当前设备/浏览器。关闭期间不产生离线收益。\n设置打开时战斗继续，清空重开会删除本地试玩进度。', 0, 45, 1060, 150, 32);
    this.button(this.modal, '保存并返回', -270, -135, 380, () => { this.modal.active = false; });
    this.button(this.modal, '确认清空并重开', 270, -135, 420, () => {
      this.model = new BattleModel(); this.cityOpen = false; this.modal.active = false; this.selected = 0;
    });
    this.modal.active = false;
  }
  private bindMapInput(input: Node, world: Node, camera: MapViewport, tap: (p: MapPoint) => void): void {
    const local = (event: EventTouch | EventMouse): MapPoint => {
      const p = event.getUILocation();
      return input.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x - 640, p.y - 360));
    };
    input.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      if (this.modal?.active || this.portrait?.active) return;
      e.propagationStopped = true;
      camera.begin(e.getID() ?? 0, local(e));
    });
    input.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      e.propagationStopped = true;
      camera.move(e.getID() ?? 0, local(e)); this.applyMapViews();
    });
    const end = (e: EventTouch, cancelled: boolean) => {
      e.propagationStopped = true;
      if (camera.end(e.getID() ?? 0, cancelled)) {
        const p = e.getUILocation();
        const point = world.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x - 640, p.y - 360));
        tap(point);
      } else { this.selected = 0; this.lastTap = 0; }
      this.applyMapViews();
    };
    input.on(Node.EventType.TOUCH_END, (e: EventTouch) => end(e, false));
    input.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => end(e, true));
    input.on(Node.EventType.MOUSE_WHEEL, (e: EventMouse) => {
      if (this.modal?.active || this.portrait?.active) return;
      e.propagationStopped = true;
      camera.zoomAt(local(e), Math.exp(Math.max(-0.25, Math.min(0.25, e.getScrollY() / 2400))));
      this.selected = 0; this.lastTap = 0; this.applyMapViews();
    });
  }
  private applyMapViews(): void {
    for (const [node, camera] of [[this.battleWorld, this.battleView], [this.cityWorld, this.cityView]] as const) {
      node.setPosition(camera.x, camera.y); node.setScale(camera.zoom, camera.zoom, 1);
    }
    this.battleReset.string = `归中 · ${Math.round(this.battleView.zoom * 100)}%`;
    this.cityTool.string = this.farmSelected ? '取消选址' : `归中 · ${Math.round(this.cityView.zoom * 100)}%`;
  }
  private tapBattlefield(local: MapPoint): void {
    if (this.cityOpen || this.modal.active) return;
    const hitRadius = Math.max(22, 22 * screen.devicePixelRatio / view.getScaleX() / this.battleView.zoom);
    const enemy = this.model.enemies.map(u => ({ u, d: Math.hypot(u.x * 40 - local.x, u.y * 33 - local.y) })).filter(v => v.d < hitRadius).sort((a, b) => a.d - b.d)[0]?.u;
    if (!enemy) {
      this.selected = 0; this.lastTap = 0;
      if (Math.abs(local.x) < 90 && local.y > -50 && local.y < 145) { this.cityOpen = true; this.refresh(); }
      return;
    }
    const now = Date.now();
    if (this.selected === enemy.id && now - this.lastTap < 300) this.model.setFocus(enemy.id);
    else this.model.message = `${UNIT_DATA.goblin.name}：血量${Math.ceil(enemy.hp)}/10，攻击1；再次点按可集火。`;
    this.selected = enemy.id; this.lastTap = now; this.refresh();
  }
  private drawLandscape(): void {
    const g = this.art; g.clear();
    this.rect(g, -2400, -1400, 4800, 2800, '#6a8050', 0);
    this.ellipse(g, -240, -20, 550, 240, '#718954'); this.ellipse(g, 350, 20, 410, 210, '#7b9059');
    this.line(g, -620, -100, 630, 95, '#9b9d6c', 63);
    this.line(g, -620, -100, 630, 95, '#aaa879', 38);
    for (let i = 0; i < 150; i++) {
      const x = ((i * 193 + 31) % 1230) - 615, y = ((i * 127) % 420) - 190;
      if (Math.hypot(x, y) < 100) continue;
      this.line(g, x, y, x - 4, y + 7, i % 3 ? '#597746' : '#94a16a', 2);
      this.line(g, x, y, x + 6, y + 5, '#597746', 2);
    }
    for (const [x, y] of [[-560, 140], [-530, -140], [540, 145], [575, -150]]) {
      this.ellipse(g, x, y - 8, 37, 16, '#52683c');
      this.rect(g, x - 6, y - 5, 12, 45, '#6c5438', 3);
      this.ellipse(g, x - 14, y + 34, 28, 25, '#3b6340'); this.ellipse(g, x + 13, y + 40, 27, 32, '#456f44');
    }
  }
  private drawActors(): void {
    const g = this.units; g.clear(); const s = this.model.state;
    const building: BuildingKind = s.cityLevel ? 'house' : 'shelter';
    this.buildingArt?.show(this.battleHallImage, building, 0, 0, 150, !this.cityOpen);
    if (!this.buildingArt?.has(building)) {
      this.ellipse(g, 0, -24, 86, 41, '#53653e');
      this.rect(g, -62, -22, 124, 88, s.cityLevel ? '#b8a879' : '#91774d', 3);
      this.rect(g, -22, -22, 35, 49, '#3c392a', 2);
      g.fillColor = new Color(s.cityLevel ? '#694f40' : '#c0a868');
      g.moveTo(-78, 56); g.lineTo(0, 105); g.lineTo(78, 56); g.close(); g.fill();
      this.line(g, 0, 104, 0, 139, '#594d34', 4);
      const flutter = Math.sin(s.elapsed * 3) * 4;
      g.fillColor = new Color(C.gold); g.moveTo(2, 139); g.lineTo(34, 130 + flutter); g.lineTo(2, 119); g.close(); g.fill();
    }
    this.rect(g, -65, -42, 130, 10, C.ink, 3);
    this.rect(g, -63, -40, 126 * s.cityHp / RULES.cityHp, 6, '#a5cb72', 2);
    for (const u of [...s.units].sort((a, b) => b.y - a.y)) {
      const ally = u.kind === 'guard';
      const home = ally ? guardPost(u.post!) : { x: u.x, y: u.y };
      const returning = ally && s.phase !== 'battle' && Math.hypot(u.x - home.x, u.y - home.y) > 0.01;
      const waiting = ally && s.phase !== 'battle' && !returning;
      const idle = waiting ? Math.sin(s.elapsed * 2.6 + u.id * 1.4) * 1.5 : 0;
      const stride = returning ? Math.sin(s.elapsed * 12 + u.id) * 3 : 0;
      const x = u.x * 40, ground = u.y * 33, y = ground + idle;
      this.ellipse(g, x, ground - 9, 17, 8, '#4e6541');
      if (s.focus === u.id || this.selected === u.id) {
        g.strokeColor = new Color(s.focus === u.id ? '#ffdb73' : C.white); g.lineWidth = 3;
        g.ellipse(x, y - 4, 24, 14); g.stroke();
      }
      const bob = u.swing > 0 ? 4 : 0;
      this.line(g, x - 5, y, x - 8 + stride, ground - 7, '#352f29', 6); this.line(g, x + 4, y, x + 7 - stride, ground - 7, '#352f29', 6);
      this.rect(g, x - 11, y - 2, 22, 24, u.flash > 0 ? '#fff0bb' : ally ? '#3b6178' : '#67543b', 5);
      this.ellipse(g, x, y + 26, 12, 12, ally ? '#d4b48a' : '#a8bd65');
      if (ally) {
        this.rect(g, x - 13, y + 31, 26, 8, '#aeb7b1', 3);
        this.rect(g, x - 18, y + 1, 13, 21, '#b49658', 5);
      } else {
        g.fillColor = new Color('#a8bd65'); g.moveTo(x - 10, y + 28); g.lineTo(x - 22, y + 35); g.lineTo(x - 12, y + 20); g.close(); g.fill();
      }
      this.line(g, x + 12, y + 6, x + 18 + bob, y + 29 + bob, '#d6d1ad', 4);
      this.rect(g, x - 18, y + 45, 36, 6, C.ink, 2);
      this.rect(g, x - 17, y + 46, 34 * u.hp / UNIT_DATA[u.kind].hp, 4, ally ? '#a6d58b' : '#e69c72', 1);
      if (u.swing > 0) this.line(g, x + 15, y + 16, x + 30, y + 28, '#ffe9a4', 4);
    }
  }
  private refresh(): void {
    const s = this.model.state;
    const status = { ready: '整备', battle: '交战', victory: '已守住', defeat: '城池失守', complete: '原型完成' }[s.phase];
    const value = `城池 ${Math.ceil(s.cityHp)}/${RULES.cityHp}     铜币 ${s.coins}     第 ${s.round}/4 回合 · ${status}     护卫 ${this.model.guards.length}/${RULES.armyCap}`;
    if (value !== this.lastHud) { this.hud.string = value; this.lastHud = value; }
    this.hint.string = this.storageFailed ? '当前无法保存，请勿依赖重开恢复。' : this.model.message;
    this.artStatus.string = this.buildingArt?.hasFailures ? '建筑加载失败 · 暂用占位图' : this.buildingArt?.loadedCount === 3 ? '建筑首批美术 · 角色/地形占位' : '建筑美术加载中';
    this.roundButton.string = s.phase === 'battle' ? `交战中 · 敌人${this.model.enemies.length}` : s.phase === 'defeat' ? '免费回到战前' : s.phase === 'complete' ? '前4回合已完成' : s.round === 0 ? '开始首战' : '迎敌 · 下一回合';
    this.cityPanel.active = this.cityOpen;
    this.art.node.active = !this.cityOpen; this.units.node.active = !this.cityOpen;
    this.battlefield.active = !this.cityOpen; this.battleTitle.active = !this.cityOpen;
    this.battleBar.active = !this.cityOpen; this.hint.node.active = !this.cityOpen;
    this.cityInfo.string = this.farmSelected ? `农田 · 占地2×2\n位置 ${this.farmCandidate.col},${this.farmCandidate.row} · 5铜\n${farmPlacementError(this.farmCandidate) || '位置可用，等待确认'}` : this.citySelection === 'farm' && s.farm ? `农田 · 占地2×2\n每10秒＋1铜 · 下次${Math.ceil(10 - s.farmTime)}秒\n迎敌另＋1铜` : this.citySelection === 'ground' ? '空地 · 可规划建设\n选农田后点按地图选址\n拖动空白处浏览城镇' : `${s.cityLevel ? '简易房屋' : '临时庇护所'}\n耐久 ${Math.ceil(s.cityHp)}/100\n驻军 ${this.model.guards.length}/${RULES.armyCap} · 产业 ${s.farm ? 1 : 0}/1`;
    this.upgradeLabel.string = s.cityLevel ? '主城已升级' : '升级主城 · 30铜';
    this.farmChoice.string = s.farm ? '生产 · 查看农田' : this.farmSelected ? '农田 · 选址中' : '生产 · 农田5铜';
    this.buildLabel.string = this.farmSelected ? '确认建造 · 5铜' : '城池概况';
    this.applyMapViews();
    this.cityFeedback.string = s.phase === 'battle' ? `城外正在交战！耐久 ${Math.ceil(s.cityHp)}/100，可随时返回。` : this.storageFailed ? '当前无法保存，请勿依赖重开恢复。' : this.model.message;
    if (s.phase === 'defeat') this.cityFeedback.string = '城池已失守！返回战场可免费回到战前。';
    if (this.cityOpen) this.drawCity();
  }
  private persist(): void {
    try { sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.model.save())); this.storageFailed = false; }
    catch { this.storageFailed = true; }
  }
  update(dt: number): void {
    const frame = screen.windowSize; const rotated = frame.height > frame.width;
    const safe = sys.getSafeAreaRect();
    const left = Math.max(0, safe.x), bottom = Math.max(0, safe.y);
    const right = Math.min(1280, safe.x + safe.width), top = Math.min(720, safe.y + safe.height);
    const uiScale = Math.min(1, Math.max(0.1, right - left) / 1280, Math.max(0.1, top - bottom) / 720);
    this.safeUi.setScale(uiScale, uiScale, 1);
    this.safeUi.setPosition((left + right) / 2 - 640, (bottom + top) / 2 - 360);
    this.portrait.active = rotated;
    if (rotated) { this.cityView.cancel(); this.battleView.cancel(); }
    if (this.hidden) return;
    if (!rotated) {
      this.accumulator += Math.min(dt, 0.25);
      while (this.accumulator >= 1 / 30) { this.model.tick(1 / 30); this.accumulator -= 1 / 30; }
    } else if (this.model.state.phase !== 'defeat' && this.model.state.farm) {
      // 旋转提示只暂停交战；在线产业仍累计，避免偷偷推进战斗。
      const s = this.model.state; s.farmTime += Math.min(dt, 0.25);
      if (s.farmTime >= 10) { s.coins += Math.floor(s.farmTime / 10); s.farmTime %= 10; }
    }
    this.saveClock += dt;
    if (this.saveClock >= 0.5) { this.refresh(); this.saveClock = 0; this.persist(); }
    this.drawActors();
    if (this.cityOpen) this.drawCity();
  }
}

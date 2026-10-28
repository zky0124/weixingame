import { _decorator, Component, Node, UITransform, Canvas, Camera, Color, Graphics, Label, view, screen, profiler, ResolutionPolicy, Layers, EventTouch, sys, game, Game, BlockInputEvents } from 'cc';
import { BattleModel, RULES, guardPost } from '../战斗/BattleModel';
import { UNIT_DATA } from '../数据/UnitData';

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
  private battleBar!: Node;
  private battleTitle!: Node;
  private battlefield!: Node;
  private cityInfo!: Label;
  private cityFeedback!: Label;
  private upgradeLabel!: Label;
  private farmLabel!: Label;
  private farmChoice!: Label;
  private buildLabel!: Label;
  private portrait!: Node;
  private modal!: Node;
  private selected = 0;
  private lastTap = 0;
  private cityOpen = false;
  private plotSelected = false;
  private farmSelected = false;
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
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.refresh();
  }
  onDestroy(): void {
    this.persist();
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
  }
  private onHide(): void { this.hidden = true; this.persist(); }
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
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; action(); this.refresh(); this.persist(); });
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
    this.art = this.graphics('草原与城市占位', this.canvas);
    this.drawLandscape();
    this.units = this.graphics('战斗单位占位', this.canvas);
    this.battlefield = this.node2D('战场触控', this.canvas, 0, 0, 1200, 450);
    this.battlefield.on(Node.EventType.TOUCH_END, this.tapBattlefield, this);
    this.safeUi = this.node2D('安全区界面', this.canvas, 0, 0, 1280, 720);
    const header = this.graphics('顶部信息底板', this.safeUi);
    this.rect(header, -616, 244, 1232, 92, C.forest);
    this.hud = this.text(this.safeUi, '', 0, 294, 1160, 70, 32);
    this.battleTitle = this.node2D('战场标题', this.safeUi);
    this.text(this.battleTitle, '蛮荒开拓 · 首战原型', -390, 218, 440, 40, 28, C.parchment);
    this.text(this.battleTitle, '程序占位画面 / 非正式美术', 390, 218, 440, 40, 26, C.muted);
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
    this.cityPanel = this.node2D('城内经营地图', this.safeUi, 0, -50, 1280, 580);
    this.cityPanel.addComponent(BlockInputEvents);
    const g = this.cityPanel.addComponent(Graphics);
    this.rect(g, -640, -300, 1280, 590, C.forest, 0);
    this.rect(g, -610, -140, 780, 340, '#839260', 18);
    this.rect(g, 190, -200, 420, 400, C.parchment, 18);
    this.text(this.cityPanel, '城内建设 · 经营地图', -280, 246, 650, 64, 36);
    this.cityArt = this.graphics('城内建筑占位', this.cityPanel);
    this.text(this.cityPanel, '城镇大厅', -435, -110, 260, 48, 30);
    this.cityInfo = this.text(this.cityPanel, '', 400, 112, 380, 154, 29, C.ink);
    this.upgradeLabel = this.button(this.cityPanel, '升级主城 · 30铜', -423, -213, 360, () => {
      if (!this.model.upgrade()) this.model.message = '升级未完成：需首战获胜、30铜币，且尚未升级房屋。';
    }, true);
    const plot = this.node2D('选择建设空地', this.cityPanel, -90, -20, 260, 170);
    plot.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      e.propagationStopped = true;
      if (!this.model.state.cityLevel) this.model.message = '先升级简易房屋，才能解锁城内建设用地。';
      else { this.plotSelected = true; this.farmSelected = false; this.model.message = this.model.state.farm ? '农田：在线每10秒＋1铜，每次迎敌另＋1铜。' : '已选空地，在右侧选择要建造的建筑。'; }
      this.refresh();
    });
    this.farmLabel = this.text(this.cityPanel, '', -90, 45, 260, 48, 30, C.ink);
    this.farmChoice = this.button(this.cityPanel, '建筑目录 · 农田', 400, -18, 360, () => {
      if (!this.plotSelected) this.model.message = '先点击城内地图中的空地，再选择建筑。';
      else if (this.model.state.farm) this.model.message = '这块地已有农田，暂无第二块可建设用地。';
      else { this.farmSelected = true; this.model.message = '农田造价5铜币；确认后在选中的空地建成。'; }
    });
    this.buildLabel = this.button(this.cityPanel, '确认建造 · 5铜', 400, -130, 360, () => {
      if (!this.plotSelected || !this.farmSelected) this.model.message = '建造顺序：点击空地 → 选择农田 → 确认建造。';
      else if (!this.model.buildFarm()) this.model.message = '未能建造：需要5铜币、解锁的空地，且城池尚未失守。';
    }, true);
    this.text(this.cityPanel, '点击空地\n选择建筑后确认', -67, -213, 360, 90, 29);
    this.button(this.cityPanel, '返回战场', 400, 246, 360, () => { this.cityOpen = false; });
    this.cityFeedback = this.text(this.cityPanel, '', 0, -278, 1200, 42, 28);
    this.cityPanel.active = false;
  }
  private drawCity(): void {
    const g = this.cityArt; g.clear(); const s = this.model.state;
    // 城内地图有自己的建筑坐标，不把产业画回外部战斗地图。
    this.line(g, -570, -10, 120, -10, '#b3ac78', 38);
    this.ellipse(g, -435, -43, 90, 28, '#647c4b');
    this.rect(g, -497, -42, 124, 108, s.cityLevel ? '#c3b288' : '#96794e', 4);
    this.rect(g, -455, -42, 32, 52, '#413d30', 2);
    g.fillColor = new Color(s.cityLevel ? '#715043' : '#c4aa70');
    g.moveTo(-515, 60); g.lineTo(-435, 112); g.lineTo(-355, 60); g.close(); g.fill();
    this.rect(g, -220, -105, 260, 170, this.plotSelected ? '#ecd394' : '#c7be89', 14);
    this.rect(g, -212, -97, 244, 154, s.farm ? '#765635' : '#a7ab76', 10);
    if (s.farm) {
      for (let i = 0; i < 4; i++) {
        this.line(g, -190, -79 + i * 27, 12, -79 + i * 27, '#a1844e', 8);
        for (let j = 0; j < 7; j++) {
          const x = -180 + j * 30, y = -79 + i * 27;
          this.line(g, x, y, x + 5, y + 16, '#b6ca67', 5);
          this.line(g, x, y + 2, x - 6, y + 12, '#90ae58', 4);
        }
      }
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
  private tapBattlefield(e: EventTouch): void {
    if (this.cityOpen || this.modal.active) return;
    const p = e.getUILocation();
    // 此场景相机/画布中心在世界原点；触点UI坐标以设计画布左下角为原点。
    const local = { x: p.x - 640, y: p.y - 360 };
    const hitRadius = Math.max(22, 22 * screen.devicePixelRatio / view.getScaleX());
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
    this.rect(g, -640, -360, 1280, 720, '#6a8050', 0);
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
    this.ellipse(g, 0, -24, 86, 41, '#53653e');
    this.rect(g, -62, -22, 124, 88, s.cityLevel ? '#b8a879' : '#91774d', 3);
    this.rect(g, -22, -22, 35, 49, '#3c392a', 2);
    g.fillColor = new Color(s.cityLevel ? '#694f40' : '#c0a868');
    g.moveTo(-78, 56); g.lineTo(0, 105); g.lineTo(78, 56); g.close(); g.fill();
    this.line(g, 0, 104, 0, 139, '#594d34', 4);
    const flutter = Math.sin(s.elapsed * 3) * 4;
    g.fillColor = new Color(C.gold); g.moveTo(2, 139); g.lineTo(34, 130 + flutter); g.lineTo(2, 119); g.close(); g.fill();
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
    this.roundButton.string = s.phase === 'battle' ? `交战中 · 敌人${this.model.enemies.length}` : s.phase === 'defeat' ? '免费回到战前' : s.phase === 'complete' ? '前4回合已完成' : s.round === 0 ? '开始首战' : '迎敌 · 下一回合';
    this.cityPanel.active = this.cityOpen;
    this.art.node.active = !this.cityOpen; this.units.node.active = !this.cityOpen;
    this.battlefield.active = !this.cityOpen; this.battleTitle.active = !this.cityOpen;
    this.battleBar.active = !this.cityOpen; this.hint.node.active = !this.cityOpen;
    this.cityInfo.string = `${s.cityLevel ? '简易房屋' : '临时庇护所'}\n耐久 ${Math.ceil(s.cityHp)}/100 · 驻军 ${this.model.guards.length}/${RULES.armyCap}\n${s.farm ? `农田：每10秒＋1铜\n迎敌另＋1铜 · 下次${Math.ceil(10 - s.farmTime)}秒` : `产业 0/1 · ${s.cityLevel ? '空地已解锁' : '升级后解锁空地'}`}`;
    this.upgradeLabel.string = s.cityLevel ? '主城已升级' : '升级主城 · 30铜';
    this.farmLabel.string = s.farm ? '农田' : s.cityLevel ? '空地 · 点击选择' : '土地尚未解锁';
    this.farmLabel.color = new Color(s.farm ? C.white : C.ink);
    this.farmChoice.string = s.farm ? '农田 · 已建成' : this.farmSelected ? '已选农田 · 5铜' : '建筑目录 · 农田';
    this.buildLabel.string = s.farm ? '农田正在生产' : '确认建造 · 5铜';
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
  }
}

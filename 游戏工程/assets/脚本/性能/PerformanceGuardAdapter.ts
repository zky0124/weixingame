// 微信(wx) / 抖音(tt) / TapTap 低端机对象池内存上限、掉帧自动降级与系统内存告警 GC 适配器 (v16.2)
import { RELEASE_CONFIG } from '../配置/ReleaseConfig';

declare const wx: any;
declare const tt: any;

export interface ObjectPoolCaps {
  maxHitParticles: number;
  maxFloatTexts: number;
  maxShockwaves: number;
  maxGroundDecals: number;
  maxCityFloats: number;
  maxProjectiles: number;
}

export class PerformanceGuardAdapter {
  private static lowEndMode = false;
  private static slowFrameStreak = 0;
  private static memoryWarningCount = 0;
  private static lastMemoryWarningLevel = 0;

  private static readonly STANDARD_CAPS: ObjectPoolCaps = {
    maxHitParticles: 90,
    maxFloatTexts: 45,
    maxShockwaves: 24,
    maxGroundDecals: 36,
    maxCityFloats: 20,
    maxProjectiles: 72,
  };

  private static readonly LOW_END_CAPS: ObjectPoolCaps = {
    maxHitParticles: 36,
    maxFloatTexts: 22,
    maxShockwaves: 12,
    maxGroundDecals: 16,
    maxCityFloats: 10,
    maxProjectiles: 48,
  };

  /** 获取当前生效的对象池容量上限 */
  public static getActivePoolCaps(): ObjectPoolCaps {
    return this.lowEndMode ? { ...this.LOW_END_CAPS } : { ...this.STANDARD_CAPS };
  }

  public static isLowEndMode(): boolean {
    return this.lowEndMode;
  }

  public static setLowEndMode(enabled: boolean, stateObj?: any): boolean {
    this.lowEndMode = Boolean(enabled);
    if (stateObj) {
      this.enforcePoolCaps(stateObj);
    }
    return this.lowEndMode;
  }

  /** 注册微信/抖音小游戏底层 onMemoryWarning 内存告警监听与主动 GC 回收 */
  public static registerMemoryWarningHooks(getState?: () => any): void {
    const onWarn = (res?: { level?: number }) => {
      this.handleMemoryWarning(res?.level || 10, getState ? getState() : undefined);
    };
    if (typeof wx !== 'undefined' && wx && typeof wx.onMemoryWarning === 'function') {
      try {
        wx.onMemoryWarning(onWarn);
      } catch {
        // Ignore hook error
      }
    }
    if (typeof tt !== 'undefined' && tt && typeof tt.onMemoryWarning === 'function') {
      try {
        tt.onMemoryWarning(onWarn);
      } catch {
        // Ignore hook error
      }
    }
  }

  /** 响应系统内存告警或手动触发内存紧缩（零 PRNG 消耗，不改变任何战斗判定） */
  public static handleMemoryWarning(level = 10, stateObj?: any): {
    lowEndMode: boolean;
    memoryWarningCount: number;
    trimmedTotal: number;
  } {
    this.memoryWarningCount += 1;
    this.lastMemoryWarningLevel = Number(level || 10);
    this.lowEndMode = true;
    const trimmedTotal = stateObj ? this.enforcePoolCaps(stateObj) : 0;

    if (typeof wx !== 'undefined' && wx && typeof wx.triggerGC === 'function') {
      try {
        wx.triggerGC();
      } catch {
        // Ignore GC call error
      }
    }
    if (typeof tt !== 'undefined' && tt && typeof tt.triggerGC === 'function') {
      try {
        tt.triggerGC();
      } catch {
        // Ignore GC call error
      }
    }
    return {
      lowEndMode: this.lowEndMode,
      memoryWarningCount: this.memoryWarningCount,
      trimmedTotal,
    };
  }

  /** 监测帧间隔耗时：连续 12 帧超过 42ms（低于 24 FPS）时自动切换至低端机流畅省电模式 */
  public static observeFrameDelta(rawDtSeconds: number, stateObj?: any): boolean {
    if (rawDtSeconds > 0.042) {
      this.slowFrameStreak += 1;
      if (!this.lowEndMode && this.slowFrameStreak >= 12) {
        this.lowEndMode = true;
        if (stateObj) this.enforcePoolCaps(stateObj);
      }
    } else if (rawDtSeconds > 0 && rawDtSeconds < 0.025) {
      this.slowFrameStreak = Math.max(0, this.slowFrameStreak - 1);
    }
    return this.lowEndMode;
  }

  /** 裁剪战场与城内瞬态特效对象池上限（100% 不调用 Math.random，严格保持战斗确定性） */
  public static enforcePoolCaps(stateObj: any): number {
    if (!stateObj || typeof stateObj !== 'object') return 0;
    const caps = this.getActivePoolCaps();
    let trimmed = 0;

    const trimArray = (arr: any[] | undefined, limit: number) => {
      if (Array.isArray(arr) && arr.length > limit) {
        const excess = arr.length - limit;
        arr.splice(0, excess);
        trimmed += excess;
      }
    };

    trimArray(stateObj.hitParticles, caps.maxHitParticles);
    trimArray(stateObj.floatTexts, caps.maxFloatTexts);
    trimArray(stateObj.shockwaves, caps.maxShockwaves);
    trimArray(stateObj.groundDecals, caps.maxGroundDecals);
    trimArray(stateObj.cityFloats, caps.maxCityFloats);
    return trimmed;
  }

  public static getDiagnostics(): {
    lowEndMode: boolean;
    slowFrameStreak: number;
    memoryWarningCount: number;
    lastMemoryWarningLevel: number;
    caps: ObjectPoolCaps;
    mainPackageLimitMB: number;
  } {
    return {
      lowEndMode: this.lowEndMode,
      slowFrameStreak: this.slowFrameStreak,
      memoryWarningCount: this.memoryWarningCount,
      lastMemoryWarningLevel: this.lastMemoryWarningLevel,
      caps: this.getActivePoolCaps(),
      mainPackageLimitMB: RELEASE_CONFIG.packagePolicy?.mainPackageLimitMB || 4,
    };
  }
}

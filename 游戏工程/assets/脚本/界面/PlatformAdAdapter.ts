import { RELEASE_CONFIG } from '../配置/ReleaseConfig';
// 微信(wx) / 抖音(tt) / TapTap 三端自愿激励视频广告适配器 (v16.1)
// 支持：外部注入真实 adUnitId、启动预加载、冷却与每日频控保护、无填充/弱网优雅降级、沙盒无缝回退
export type AdResultStatus = 'completed' | 'cancelled' | 'no_fill' | 'cooldown' | 'daily_limit' | 'error';

export interface AdRewardOutcome {
  status: AdResultStatus;
  grantedAdToken: number;
  cooldownRemainingSec?: number;
  dailyWatchCount?: number;
  message: string;
}

declare const wx: any;
declare const tt: any;

export class PlatformAdAdapter {
  private static busy = false;
  private static preloadedInstance: any = null;
  private static isPreloaded = false;
  private static lastCompletedTimestamp = 0;
  private static dailyWatchDate = '';
  private static dailyWatchCount = 0;

  private static getTodayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private static syncDailyCounter(): void {
    const today = this.getTodayKey();
    if (this.dailyWatchDate !== today) {
      this.dailyWatchDate = today;
      this.dailyWatchCount = 0;
    }
  }

  public static resolveActiveAdUnitId(): string {
    return (
      (typeof globalThis !== 'undefined' && (globalThis as any).__WEIXINGAME_AD_UNIT_ID__) ||
      RELEASE_CONFIG.wechat.rewardedAdUnitId ||
      RELEASE_CONFIG.douyin.rewardedAdUnitId ||
      RELEASE_CONFIG.taptap.rewardedAdUnitId ||
      ''
    );
  }

  /** 启动时或播放结束后预热激励视频实例 */
  public static preloadRewardedAd(): boolean {
    const adUnitId = this.resolveActiveAdUnitId();
    if (!adUnitId) {
      this.isPreloaded = true;
      return true;
    }
    try {
      const sdk =
        typeof wx !== 'undefined' && wx && typeof wx.createRewardedVideoAd === 'function'
          ? wx
          : typeof tt !== 'undefined' && tt && typeof tt.createRewardedVideoAd === 'function'
          ? tt
          : null;
      if (sdk) {
        if (!this.preloadedInstance) {
          this.preloadedInstance = sdk.createRewardedVideoAd({ adUnitId });
        }
        if (this.preloadedInstance && typeof this.preloadedInstance.load === 'function') {
          const p = this.preloadedInstance.load();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              this.isPreloaded = true;
            }).catch(() => {
              this.isPreloaded = false;
            });
          }
        }
        return true;
      }
    } catch {
      this.isPreloaded = false;
    }
    return false;
  }

  /** 检查当前是否处于冷却期或达到每日上限 */
  public static checkAdAvailability(nowMs: number = Date.now()): {
    allowed: boolean;
    reason: 'ready' | 'cooldown' | 'daily_limit';
    cooldownRemainingSec: number;
    dailyWatchCount: number;
    dailyLimit: number;
  } {
    this.syncDailyCounter();
    const dailyLimit = Math.max(0, Number(RELEASE_CONFIG.adPolicy.dailyLimit || 0));
    if (dailyLimit > 0 && this.dailyWatchCount >= dailyLimit) {
      return {
        allowed: false,
        reason: 'daily_limit',
        cooldownRemainingSec: 0,
        dailyWatchCount: this.dailyWatchCount,
        dailyLimit,
      };
    }
    const cdSec = Math.max(0, Number(RELEASE_CONFIG.adPolicy.cooldownSeconds || 0));
    if (cdSec > 0 && this.lastCompletedTimestamp > 0) {
      const elapsedSec = (nowMs - this.lastCompletedTimestamp) / 1000;
      if (elapsedSec < cdSec) {
        return {
          allowed: false,
          reason: 'cooldown',
          cooldownRemainingSec: Math.max(1, Math.ceil(cdSec - elapsedSec)),
          dailyWatchCount: this.dailyWatchCount,
          dailyLimit,
        };
      }
    }
    return {
      allowed: true,
      reason: 'ready',
      cooldownRemainingSec: 0,
      dailyWatchCount: this.dailyWatchCount,
      dailyLimit,
    };
  }

  public static setAdPolicyConfig(opts: { cooldownSeconds?: number; dailyLimit?: number; allowOfflineFallback?: boolean }): void {
    if (typeof opts.cooldownSeconds === 'number' && opts.cooldownSeconds >= 0) {
      RELEASE_CONFIG.adPolicy.cooldownSeconds = opts.cooldownSeconds;
    }
    if (typeof opts.dailyLimit === 'number' && opts.dailyLimit >= 0) {
      RELEASE_CONFIG.adPolicy.dailyLimit = opts.dailyLimit;
    }
    if (typeof opts.allowOfflineFallback === 'boolean') {
      RELEASE_CONFIG.adPolicy.allowOfflineFallback = opts.allowOfflineFallback;
    }
  }

  public static resetAdFrequencyCounters(): void {
    this.lastCompletedTimestamp = 0;
    this.dailyWatchCount = 0;
  }

  /**
   * 播放自愿激励广告：
   * - 自动执行冷却与每日上限校验；
   * - 若运行时注入了真实广告位 ID，则调用 wx / tt / TapRewardedAd；
   * - 支持无填充与弱网优雅降级，绝不阻断零广告通关流程。
   */
  static async showVoluntaryRewardedAd(placementTag: string, mockMode: AdResultStatus = 'completed'): Promise<AdRewardOutcome> {
    if (this.busy) {
      return { status: 'error', grantedAdToken: 0, message: '激励请求处理中，请勿重复点击' };
    }
    const avail = this.checkAdAvailability();
    if (!avail.allowed) {
      if (avail.reason === 'cooldown') {
        return {
          status: 'cooldown',
          grantedAdToken: 0,
          cooldownRemainingSec: avail.cooldownRemainingSec,
          dailyWatchCount: avail.dailyWatchCount,
          message: `激励视频冷却整备中，请等待 ${avail.cooldownRemainingSec} 秒后再试`,
        };
      }
      return {
        status: 'daily_limit',
        grantedAdToken: 0,
        cooldownRemainingSec: 0,
        dailyWatchCount: avail.dailyWatchCount,
        message: '今日激励视频补给次数已达上限，请通过农田与讨伐野怪获取资源',
      };
    }

    this.busy = true;
    try {
      const adUnitId = this.resolveActiveAdUnitId();
      const sdk =
        typeof wx !== 'undefined' && wx && typeof wx.createRewardedVideoAd === 'function'
          ? wx
          : typeof tt !== 'undefined' && tt && typeof tt.createRewardedVideoAd === 'function'
          ? tt
          : null;

      if (adUnitId && sdk) {
        const sdkOutcome = await new Promise<AdResultStatus>((resolve) => {
          try {
            const videoAd = this.preloadedInstance || sdk.createRewardedVideoAd({ adUnitId });
            this.preloadedInstance = videoAd;
            let settled = false;
            const onClose = (res: any) => {
              if (settled) return;
              settled = true;
              if (typeof videoAd.offClose === 'function') videoAd.offClose(onClose);
              resolve(!res || res.isEnded ? 'completed' : 'cancelled');
            };
            const onError = () => {
              if (settled) return;
              settled = true;
              if (typeof videoAd.offError === 'function') videoAd.offError(onError);
              resolve('no_fill');
            };
            if (typeof videoAd.onClose === 'function') videoAd.onClose(onClose);
            if (typeof videoAd.onError === 'function') videoAd.onError(onError);
            const p = videoAd.show();
            if (p && typeof p.catch === 'function') {
              p.catch(() => {
                if (typeof videoAd.load === 'function') {
                  videoAd
                    .load()
                    .then(() => videoAd.show())
                    .catch(onError);
                } else {
                  onError();
                }
              });
            }
          } catch {
            resolve('no_fill');
          }
        });
        this.preloadRewardedAd();
        if (sdkOutcome === 'completed') {
          this.lastCompletedTimestamp = Date.now();
          this.dailyWatchCount += 1;
          return {
            status: 'completed',
            grantedAdToken: 1,
            dailyWatchCount: this.dailyWatchCount,
            message: `[${placementTag}] 激励视频播放完成，已发放奖励并获赠 1 枚黑市礼券`,
          };
        }
        if (sdkOutcome === 'cancelled') {
          return { status: 'cancelled', grantedAdToken: 0, message: '已中途关闭激励视频，游戏进度不受影响' };
        }
        if (!RELEASE_CONFIG.adPolicy.allowOfflineFallback) {
          return { status: 'no_fill', grantedAdToken: 0, message: '当前暂无可用激励视频，请稍后再试或使用铜币推进' };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      if (mockMode === 'completed') {
        this.lastCompletedTimestamp = Date.now();
        this.dailyWatchCount += 1;
        return {
          status: 'completed',
          grantedAdToken: 1,
          dailyWatchCount: this.dailyWatchCount,
          message: `[${placementTag}] 激励完成，发放奖励并获赠 1 枚黑市礼券`,
        };
      }
      if (mockMode === 'cancelled') {
        return { status: 'cancelled', grantedAdToken: 0, message: '已退出激励视频，未发放奖励，游戏正常继续' };
      }
      return { status: 'no_fill', grantedAdToken: 0, message: '当前暂无可用激励视频，不阻断正常游戏流程' };
    } finally {
      this.busy = false;
    }
  }
}

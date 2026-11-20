// Issue #6 微信/抖音/TapTap 三端自愿激励广告测试适配器（零真实 AppID 硬编码）
export type AdResultStatus = 'completed' | 'cancelled' | 'no_fill' | 'error';

export interface AdRewardOutcome {
  status: AdResultStatus;
  grantedAdToken: number;
  message: string;
}

declare const wx: any;
declare const tt: any;

export class PlatformAdAdapter {
  private static busy = false;

  /**
   * 播放自愿激励广告（测试模式优先，不阻断正常无广告通关流程）
   * 有效看完时固定额外返回 1 枚黑市永久广告代币，防止重复并发触发。
   */
  static async showVoluntaryRewardedAd(placementTag: string, mockMode: AdResultStatus = 'completed'): Promise<AdRewardOutcome> {
    if (this.busy) {
      return { status: 'error', grantedAdToken: 0, message: '广告请求处理中，请勿重复点击' };
    }
    this.busy = true;
    try {
      // 本地与测试环境走可验证的沙盒回调，不写入任何真实平台 AppID 或密钥
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (typeof wx !== 'undefined' && wx.__USE_TEST_SANDBOX__ === false) {
        // 预留正式过审后的平台 SDK 注入点（通过外部构建环境变量注入，严禁入库硬编码）
      }
      if (typeof tt !== 'undefined' && tt.__USE_TEST_SANDBOX__ === false) {
        // 抖音端预留点
      }
      if (mockMode === 'completed') {
        return { status: 'completed', grantedAdToken: 1, message: `[${placementTag}] 测试广告完成，发放奖励并获赠 1 枚广告代币` };
      }
      if (mockMode === 'cancelled') {
        return { status: 'cancelled', grantedAdToken: 0, message: '已中途关闭广告，未发放奖励，游戏正常继续' };
      }
      return { status: 'no_fill', grantedAdToken: 0, message: '当前暂无广告库存，不阻断正常游戏流程' };
    } finally {
      this.busy = false;
    }
  }
}

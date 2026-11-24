// 微信小游戏 / 抖音小游戏 / TapTap 三端商业化提审发布配置中心 (v16.2)
export interface PlatformReleaseEndpoints {
  version: string;
  /** 生产提审开关：设为 true 时自动隐藏所有选关调试入口，设为 false 时保留选关入口供内部回归 */
  releaseMode: boolean;
  wechat: {
    appId: string;
    rewardedAdUnitId: string;
    shareTitle: string;
    shareImageUrl: string;
  };
  douyin: {
    appId: string;
    rewardedAdUnitId: string;
    minRecordSeconds: number;
    maxRecordSeconds: number;
    videoTopics: string[];
  };
  taptap: {
    clientId: string;
    rewardedAdUnitId: string;
  };
  adPolicy: {
    cooldownSeconds: number;
    dailyLimit: number;
    preloadOnBoot: boolean;
    allowOfflineFallback: boolean;
  };
  storagePolicy: {
    schemaVersion: number;
    enableDualSlotBackup: boolean;
    enableChecksumVerify: boolean;
  };
  packagePolicy: {
    mainPackageLimitMB: number;
    subpackages: Array<{ name: string; root: string }>;
    autoLowEndGuardOnMemoryWarning: boolean;
  };
}

export const RELEASE_CONFIG: PlatformReleaseEndpoints = {
  version: '16.2.0',
  releaseMode: false,
  wechat: {
    appId: '',
    rewardedAdUnitId: '',
    shareTitle: '开拓守城 · 王国边境防线：率领护卫与传奇英雄抵御32波大军！',
    shareImageUrl: '',
  },
  douyin: {
    appId: '',
    rewardedAdUnitId: '',
    minRecordSeconds: 3,
    maxRecordSeconds: 120,
    videoTopics: ['开拓守城', '塔防小游戏', '策略守城'],
  },
  taptap: {
    clientId: '',
    rewardedAdUnitId: '',
  },
  adPolicy: {
    cooldownSeconds: 0,
    dailyLimit: 30,
    preloadOnBoot: true,
    allowOfflineFallback: true,
  },
  storagePolicy: {
    schemaVersion: 162,
    enableDualSlotBackup: true,
    enableChecksumVerify: true,
  },
  packagePolicy: {
    mainPackageLimitMB: 4,
    subpackages: [
      {
        name: 'stage1_action_frames',
        root: 'subpackages/stage1_action_frames/',
      },
    ],
    autoLowEndGuardOnMemoryWarning: true,
  },
};

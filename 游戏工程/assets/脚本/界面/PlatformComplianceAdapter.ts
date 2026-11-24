// 微信(wx) / 抖音(tt) / TapTap 三端提审合规、隐私授权、前后台切出自动暂停、原生分享与抖音战报录屏适配器 (v16.1)
import { RELEASE_CONFIG } from '../配置/ReleaseConfig';

declare const wx: any;
declare const tt: any;

export interface LifecycleHooks {
  onPauseSimulation: () => void;
  onResumeSimulation: () => void;
  onMuteAudio: () => void;
  onRestoreAudio: () => void;
  onSaveCheckpoint: () => void;
}

export interface ScreenRecordState {
  isRecording: boolean;
  startedAtMs: number;
  lastDurationSec: number;
  lastVideoPath: string;
}

export class PlatformComplianceAdapter {
  private static readonly PRIVACY_KEY = 'frontier_defense_privacy_consent_v1';
  private static lifecyclePaused = false;
  private static recorderInstance: any = null;
  private static recordState: ScreenRecordState = {
    isRecording: false,
    startedAtMs: 0,
    lastDurationSec: 0,
    lastVideoPath: '',
  };

  /** 查询并请求微信小游戏官方隐私协议授权（wx.getPrivacySetting + wx.requirePrivacyAuthorize） */
  public static ensurePrivacyAuthorization(onResult: (accepted: boolean) => void): void {
    if (typeof wx !== 'undefined' && wx && typeof wx.getPrivacySetting === 'function') {
      try {
        wx.getPrivacySetting({
          success: (res: any) => {
            if (res && res.needAuthorization && typeof wx.requirePrivacyAuthorize === 'function') {
              wx.requirePrivacyAuthorize({
                success: () => {
                  this.saveLocalConsent(true);
                  onResult(true);
                },
                fail: () => {
                  this.saveLocalConsent(false);
                  onResult(false);
                },
              });
            } else {
              this.saveLocalConsent(true);
              onResult(true);
            }
          },
          fail: () => onResult(this.loadLocalConsent()),
        });
        return;
      } catch {
        // Fallback to local consent storage
      }
    }
    onResult(this.loadLocalConsent());
  }

  public static loadLocalConsent(): boolean {
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function') {
        return wx.getStorageSync(this.PRIVACY_KEY) !== 'guest';
      }
      if (typeof tt !== 'undefined' && tt && typeof tt.getStorageSync === 'function') {
        return tt.getStorageSync(this.PRIVACY_KEY) !== 'guest';
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(this.PRIVACY_KEY) !== 'guest';
      }
    } catch {
      // Ignore storage error
    }
    return true;
  }

  public static saveLocalConsent(accepted: boolean): void {
    const val = accepted ? 'accepted' : 'guest';
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync(this.PRIVACY_KEY, val);
      } else if (typeof tt !== 'undefined' && tt && typeof tt.setStorageSync === 'function') {
        tt.setStorageSync(this.PRIVACY_KEY, val);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.PRIVACY_KEY, val);
      }
    } catch {
      // Ignore storage error
    }
  }

  /** 注册三端前后台切出自动暂停战斗、音频中断静音恢复与自动存盘钩子（过审必测项） */
  public static registerLifecycleHooks(hooks: LifecycleHooks): void {
    const handleHide = () => {
      if (this.lifecyclePaused) return;
      this.lifecyclePaused = true;
      hooks.onPauseSimulation();
      hooks.onMuteAudio();
      hooks.onSaveCheckpoint();
    };
    const handleShow = () => {
      if (!this.lifecyclePaused) return;
      this.lifecyclePaused = false;
      hooks.onResumeSimulation();
      hooks.onRestoreAudio();
    };

    if (typeof wx !== 'undefined' && wx) {
      if (typeof wx.onHide === 'function') wx.onHide(handleHide);
      if (typeof wx.onShow === 'function') wx.onShow(handleShow);
      if (typeof wx.onAudioInterruptionBegin === 'function') wx.onAudioInterruptionBegin(handleHide);
      if (typeof wx.onAudioInterruptionEnd === 'function') wx.onAudioInterruptionEnd(handleShow);
      if (typeof wx.showShareMenu === 'function') {
        try {
          wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
        } catch {
          // Ignore share menu error
        }
      }
    }
    if (typeof tt !== 'undefined' && tt) {
      if (typeof tt.onHide === 'function') tt.onHide(handleHide);
      if (typeof tt.onShow === 'function') tt.onShow(handleShow);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleHide();
        else handleShow();
      });
    }
  }

  /** 唤起微信/抖音原生分享转发 */
  public static shareBattleReport(currentRound: number): string {
    const title = `我在《开拓守城 · 王国边境防线》坚守至第 ${currentRound} 回合，快来率领护卫与传奇英雄守卫边境！`;
    if (typeof wx !== 'undefined' && wx && typeof wx.shareAppMessage === 'function') {
      try {
        wx.shareAppMessage({ title, imageUrl: RELEASE_CONFIG.wechat.shareImageUrl || undefined });
        return 'wechat';
      } catch {
        // Fallback
      }
    }
    if (typeof tt !== 'undefined' && tt && typeof tt.shareAppMessage === 'function') {
      try {
        tt.shareAppMessage({ title });
        return 'douyin';
      } catch {
        // Fallback
      }
    }
    return 'fallback';
  }

  /** 启动抖音小游戏原生录屏（tt.getGameRecorderManager）或跨端战报录制计时 */
  public static startBattleScreenRecord(nowMs: number = Date.now()): ScreenRecordState {
    this.recordState.isRecording = true;
    this.recordState.startedAtMs = nowMs;
    this.recordState.lastDurationSec = 0;
    this.recordState.lastVideoPath = '';
    if (typeof tt !== 'undefined' && tt && typeof tt.getGameRecorderManager === 'function') {
      try {
        const rec = this.recorderInstance || tt.getGameRecorderManager();
        this.recorderInstance = rec;
        if (rec && typeof rec.onStop === 'function') {
          rec.onStop((res: any) => {
            if (res && res.videoPath) {
              this.recordState.lastVideoPath = String(res.videoPath);
            }
          });
        }
        if (rec && typeof rec.start === 'function') {
          rec.start({ duration: RELEASE_CONFIG.douyin.maxRecordSeconds || 120 });
        }
      } catch {
        // Fallback to timer state
      }
    }
    return { ...this.recordState };
  }

  /** 结束抖音小游戏原生录屏并校验是否满足最低 3 秒分享要求 */
  public static stopBattleScreenRecord(nowMs: number = Date.now()): {
    ok: boolean;
    durationSec: number;
    videoPath: string;
    tooShort: boolean;
  } {
    if (!this.recordState.isRecording) {
      return { ok: false, durationSec: 0, videoPath: '', tooShort: false };
    }
    const elapsedSec = Math.max(0, (nowMs - this.recordState.startedAtMs) / 1000);
    const minSec = Math.max(3, Number(RELEASE_CONFIG.douyin.minRecordSeconds || 3));
    if (elapsedSec < minSec) {
      return { ok: false, durationSec: Number(elapsedSec.toFixed(1)), videoPath: '', tooShort: true };
    }
    this.recordState.isRecording = false;
    this.recordState.lastDurationSec = Number(elapsedSec.toFixed(1));
    if (!this.recordState.lastVideoPath) {
      this.recordState.lastVideoPath = `ttfile://temp/frontier_defense_${Date.now()}.mp4`;
    }
    if (this.recorderInstance && typeof this.recorderInstance.stop === 'function') {
      try {
        this.recorderInstance.stop();
      } catch {
        // Ignore stop error
      }
    }
    return {
      ok: true,
      durationSec: this.recordState.lastDurationSec,
      videoPath: this.recordState.lastVideoPath,
      tooShort: false,
    };
  }

  /** 一键分享已录制的抖音战斗视频（channel: 'video'）或自动回退图文分享 */
  public static shareRecordedBattleVideo(currentRound: number): 'douyin_video' | 'wechat' | 'douyin' | 'fallback' {
    const title = `我在《开拓守城 · 王国边境防线》第 ${currentRound} 回合打出精彩守城反击！`;
    if (
      this.recordState.lastVideoPath &&
      typeof tt !== 'undefined' &&
      tt &&
      typeof tt.shareAppMessage === 'function'
    ) {
      try {
        tt.shareAppMessage({
          channel: 'video',
          title,
          extra: {
            videoPath: this.recordState.lastVideoPath,
            videoTopics: RELEASE_CONFIG.douyin.videoTopics || ['开拓守城', '策略守城'],
          },
        });
        return 'douyin_video';
      } catch {
        // Fallback to standard share
      }
    }
    return this.shareBattleReport(currentRound) as any;
  }

  public static getScreenRecordState(): ScreenRecordState {
    return { ...this.recordState };
  }
}

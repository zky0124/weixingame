// 微信(wx) / 抖音(tt) / TapTap 三端跨平台存档容灾与防丢档适配器 (v16.1)
// 支持：wx.setStorageSync / tt.setStorageSync / localStorage 自动路由、FNV-1a 32位校验和防坏档、主备双槽位原子回滚恢复、旧版存档无损迁移
import { RELEASE_CONFIG } from '../配置/ReleaseConfig';

declare const wx: any;
declare const tt: any;

export interface SaveEnvelopeV161 {
  schemaVersion: number;
  savedAt: number;
  round: number;
  cityLevel: number;
  checksum: string;
  payloadJson: string;
}

export interface LoadSaveResult<T = any> {
  ok: boolean;
  slot: 'primary' | 'backup' | 'legacy_migrated' | 'none';
  recoveredFromBackup: boolean;
  migratedFromLegacy: boolean;
  checksum: string;
  schemaVersion: number;
  state: T | null;
  checkpointJson: string | null;
}

export class PlatformStorageAdapter {
  public static readonly PRIMARY_KEY = 'frontier_defense_save_envelope_v1';
  public static readonly BACKUP_KEY = 'frontier_defense_save_envelope_v1_bak';
  public static readonly LEGACY_STATE_KEY = 'weixingame_stage1_save_v1';
  public static readonly CKPT_PRIMARY_KEY = 'weixingame_stage1_ckpt_v1';
  public static readonly CKPT_BACKUP_KEY = 'weixingame_stage1_ckpt_v1_bak';

  private static memoryFallback = new Map<string, string>();
  private static lastRecoveryFromBackup = false;
  private static lastMigratedFromLegacy = false;
  private static recoveryCount = 0;

  /** 计算 FNV-1a 32位确定性校验和，防止存储截断或脏数据坏档 */
  public static computeChecksum(payload: string): string {
    let hash = 0x811c9dc5;
    const str = String(payload || '');
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return 'fnv1a_' + (hash >>> 0).toString(16).padStart(8, '0');
  }

  /** 底层跨端读取（优先 wx -> tt -> localStorage -> 内存兜底） */
  public static getRawItem(key: string): string | null {
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function') {
        const v = wx.getStorageSync(key);
        if (typeof v === 'string' && v.length > 0) return v;
      }
      if (typeof tt !== 'undefined' && tt && typeof tt.getStorageSync === 'function') {
        const v = tt.getStorageSync(key);
        if (typeof v === 'string' && v.length > 0) return v;
      }
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem(key);
        if (typeof v === 'string' && v.length > 0) return v;
      }
    } catch {
      // Fallback to in-memory map
    }
    return this.memoryFallback.get(key) || null;
  }

  /** 底层跨端写入（同步写入可用端与内存兜底） */
  public static setRawItem(key: string, value: string): boolean {
    const strVal = String(value ?? '');
    this.memoryFallback.set(key, strVal);
    let saved = false;
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync(key, strVal);
        saved = true;
      }
      if (typeof tt !== 'undefined' && tt && typeof tt.setStorageSync === 'function') {
        tt.setStorageSync(key, strVal);
        saved = true;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, strVal);
        saved = true;
      }
    } catch {
      // Kept in memoryFallback
    }
    return saved;
  }

  /** 校验存档核心字段结构合法性 */
  public static isValidStateStructure(obj: any): boolean {
    return Boolean(
      obj &&
      typeof obj === 'object' &&
      typeof obj.cityLevel === 'number' &&
      obj.cityLevel >= 0 &&
      obj.cityLevel <= 3 &&
      Array.isArray(obj.plots) &&
      obj.plots.length > 0
    );
  }

  /** 将旧版存档结构无损迁移补齐至最新 schemaVersion */
  public static migrateStatePayload<T extends Record<string, any>>(rawState: T, defaultFactory?: () => T): T {
    const base = typeof defaultFactory === 'function' ? defaultFactory() : ({} as T);
    const merged: any = Object.assign({}, base, rawState);
    if (typeof merged.copper !== 'number' || Number.isNaN(merged.copper)) merged.copper = 30;
    if (typeof merged.researchPoints !== 'number' || Number.isNaN(merged.researchPoints)) merged.researchPoints = 0;
    if (typeof merged.completedRound !== 'number' || Number.isNaN(merged.completedRound)) merged.completedRound = 0;
    if (!merged.techs || typeof merged.techs !== 'object') merged.techs = {};
    if (!merged.training || typeof merged.training !== 'object') {
      merged.training = { militia: 0, archer: 0, medic: 0, guard: 0 };
    }
    if (!Array.isArray(merged.units)) merged.units = [];
    merged._schemaVersion = RELEASE_CONFIG.storagePolicy.schemaVersion;
    return merged as T;
  }

  /** 解析并验证单个信封或原始存档字符串 */
  public static verifyAndExtractRaw(rawStr: string | null, defaultFactory?: () => any): { ok: boolean; state: any; checksum: string; schemaVersion: number; isEnvelope: boolean } {
    if (!rawStr || typeof rawStr !== 'string') {
      return { ok: false, state: null, checksum: '', schemaVersion: 0, isEnvelope: false };
    }
    try {
      const parsed = JSON.parse(rawStr);
      if (parsed && typeof parsed === 'object' && typeof parsed.payloadJson === 'string' && typeof parsed.checksum === 'string') {
        const expected = this.computeChecksum(parsed.payloadJson);
        if (RELEASE_CONFIG.storagePolicy.enableChecksumVerify && expected !== parsed.checksum) {
          return { ok: false, state: null, checksum: parsed.checksum, schemaVersion: parsed.schemaVersion || 0, isEnvelope: true };
        }
        const inner = JSON.parse(parsed.payloadJson);
        if (!this.isValidStateStructure(inner)) {
          return { ok: false, state: null, checksum: expected, schemaVersion: parsed.schemaVersion || 0, isEnvelope: true };
        }
        return {
          ok: true,
          state: this.migrateStatePayload(inner, defaultFactory),
          checksum: expected,
          schemaVersion: parsed.schemaVersion || RELEASE_CONFIG.storagePolicy.schemaVersion,
          isEnvelope: true,
        };
      }
      if (this.isValidStateStructure(parsed)) {
        const canonical = JSON.stringify(parsed);
        return {
          ok: true,
          state: this.migrateStatePayload(parsed, defaultFactory),
          checksum: this.computeChecksum(canonical),
          schemaVersion: parsed._schemaVersion || 160,
          isEnvelope: false,
        };
      }
    } catch {
      // Parse or checksum failure
    }
    return { ok: false, state: null, checksum: '', schemaVersion: 0, isEnvelope: false };
  }

  /** 双槽位原子保存：先将已校验通过的主槽轮转至备份槽，再写入新主槽与兼容键 */
  public static saveGameState(stateObj: any, checkpointJson?: string | null): { ok: boolean; checksum: string } {
    if (!this.isValidStateStructure(stateObj)) {
      return { ok: false, checksum: '' };
    }
    const existingPrimary = this.getRawItem(this.PRIMARY_KEY);
    if (existingPrimary && RELEASE_CONFIG.storagePolicy.enableDualSlotBackup) {
      const checkOld = this.verifyAndExtractRaw(existingPrimary);
      if (checkOld.ok) {
        this.setRawItem(this.BACKUP_KEY, existingPrimary);
      }
    }

    const payloadJson = JSON.stringify(stateObj);
    const checksum = this.computeChecksum(payloadJson);
    const envelope: SaveEnvelopeV161 = {
      schemaVersion: RELEASE_CONFIG.storagePolicy.schemaVersion,
      savedAt: Date.now(),
      round: Number(stateObj.round || (stateObj.completedRound || 0) + 1),
      cityLevel: Number(stateObj.cityLevel || 0),
      checksum,
      payloadJson,
    };
    const envelopeStr = JSON.stringify(envelope);
    this.setRawItem(this.PRIMARY_KEY, envelopeStr);
    this.setRawItem(this.LEGACY_STATE_KEY, payloadJson);

    if (RELEASE_CONFIG.storagePolicy.enableDualSlotBackup && !this.getRawItem(this.BACKUP_KEY)) {
      this.setRawItem(this.BACKUP_KEY, envelopeStr);
    }

    if (typeof checkpointJson === 'string' && checkpointJson.length > 0) {
      const oldCkpt = this.getRawItem(this.CKPT_PRIMARY_KEY);
      if (oldCkpt && this.verifyAndExtractRaw(oldCkpt).ok) {
        this.setRawItem(this.CKPT_BACKUP_KEY, oldCkpt);
      }
      this.setRawItem(this.CKPT_PRIMARY_KEY, checkpointJson);
      if (!this.getRawItem(this.CKPT_BACKUP_KEY)) {
        this.setRawItem(this.CKPT_BACKUP_KEY, checkpointJson);
      }
    }
    return { ok: true, checksum };
  }

  /** 双槽位容灾读取：主槽正常读主槽；主槽损坏自动回滚备份槽并自愈主槽；旧版裸存档自动迁移升格为双槽位信封 */
  public static loadGameState<T = any>(defaultFactory?: () => T): LoadSaveResult<T> {
    this.lastRecoveryFromBackup = false;
    this.lastMigratedFromLegacy = false;

    let ckpt = this.getRawItem(this.CKPT_PRIMARY_KEY);
    if (!ckpt || !this.verifyAndExtractRaw(ckpt, defaultFactory).ok) {
      const bakCkpt = this.getRawItem(this.CKPT_BACKUP_KEY);
      if (bakCkpt && this.verifyAndExtractRaw(bakCkpt, defaultFactory).ok) {
        ckpt = bakCkpt;
        this.setRawItem(this.CKPT_PRIMARY_KEY, bakCkpt);
      }
    }

    const primaryRaw = this.getRawItem(this.PRIMARY_KEY);
    const primaryRes = this.verifyAndExtractRaw(primaryRaw, defaultFactory);
    const legacyRaw = this.getRawItem(this.LEGACY_STATE_KEY);

    // 若外部直接修改或损坏了旧版兼容键（或主槽尚未创建），同步检查
    if (primaryRes.ok) {
      if (legacyRaw) {
        const legacyRes = this.verifyAndExtractRaw(legacyRaw, defaultFactory);
        if (!legacyRes.ok) {
          // 兼容键损坏而主槽或备份槽完好：视作一次坏档自愈
          this.lastRecoveryFromBackup = true;
          this.recoveryCount += 1;
          this.setRawItem(this.LEGACY_STATE_KEY, JSON.stringify(primaryRes.state));
          return {
            ok: true,
            slot: 'backup',
            recoveredFromBackup: true,
            migratedFromLegacy: false,
            checksum: primaryRes.checksum,
            schemaVersion: primaryRes.schemaVersion,
            state: primaryRes.state,
            checkpointJson: ckpt,
          };
        }
      }
      return {
        ok: true,
        slot: 'primary',
        recoveredFromBackup: false,
        migratedFromLegacy: false,
        checksum: primaryRes.checksum,
        schemaVersion: primaryRes.schemaVersion,
        state: primaryRes.state,
        checkpointJson: ckpt,
      };
    }

    // 主槽损坏或缺失时，尝试从备份槽恢复
    const backupRaw = this.getRawItem(this.BACKUP_KEY);
    const backupRes = this.verifyAndExtractRaw(backupRaw, defaultFactory);
    if (backupRes.ok) {
      this.lastRecoveryFromBackup = true;
      this.recoveryCount += 1;
      if (backupRaw) {
        this.setRawItem(this.PRIMARY_KEY, backupRaw);
      }
      this.setRawItem(this.LEGACY_STATE_KEY, JSON.stringify(backupRes.state));
      return {
        ok: true,
        slot: 'backup',
        recoveredFromBackup: true,
        migratedFromLegacy: false,
        checksum: backupRes.checksum,
        schemaVersion: backupRes.schemaVersion,
        state: backupRes.state,
        checkpointJson: ckpt,
      };
    }

    // 若主备信封均不存在，检查旧版 v1.0-v16.0 裸存档并无损迁移
    const legacyRes = this.verifyAndExtractRaw(legacyRaw, defaultFactory);
    if (legacyRes.ok) {
      this.lastMigratedFromLegacy = true;
      const saved = this.saveGameState(legacyRes.state, ckpt);
      return {
        ok: true,
        slot: 'legacy_migrated',
        recoveredFromBackup: false,
        migratedFromLegacy: true,
        checksum: saved.checksum,
        schemaVersion: RELEASE_CONFIG.storagePolicy.schemaVersion,
        state: legacyRes.state,
        checkpointJson: ckpt,
      };
    }

    return {
      ok: false,
      slot: 'none',
      recoveredFromBackup: false,
      migratedFromLegacy: false,
      checksum: '',
      schemaVersion: RELEASE_CONFIG.storagePolicy.schemaVersion,
      state: null,
      checkpointJson: ckpt,
    };
  }

  /** 导出带校验和信封的存档字符串，支持玩家跨设备备份 */
  public static exportVerifiedSave(stateObj: any): string {
    const payloadJson = JSON.stringify(stateObj);
    const checksum = this.computeChecksum(payloadJson);
    const envelope: SaveEnvelopeV161 = {
      schemaVersion: RELEASE_CONFIG.storagePolicy.schemaVersion,
      savedAt: Date.now(),
      round: Number(stateObj?.round || (stateObj?.completedRound || 0) + 1),
      cityLevel: Number(stateObj?.cityLevel || 0),
      checksum,
      payloadJson,
    };
    return JSON.stringify(envelope);
  }

  public static getStorageDiagnostics(): {
    hasPrimary: boolean;
    hasBackup: boolean;
    lastRecoveryFromBackup: boolean;
    lastMigratedFromLegacy: boolean;
    recoveryCount: number;
    schemaVersion: number;
  } {
    return {
      hasPrimary: Boolean(this.getRawItem(this.PRIMARY_KEY)),
      hasBackup: Boolean(this.getRawItem(this.BACKUP_KEY)),
      lastRecoveryFromBackup: this.lastRecoveryFromBackup,
      lastMigratedFromLegacy: this.lastMigratedFromLegacy,
      recoveryCount: this.recoveryCount,
      schemaVersion: RELEASE_CONFIG.storagePolicy.schemaVersion,
    };
  }
}

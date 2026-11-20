import { UnitKind } from '../数据/UnitData';
export interface Encounter { round:number; title:string; faction:'goblin'|'undead'; groups:readonly (readonly [UnitKind,number])[]; reward:number; city:number; boss?:boolean }
// 固定组合调整数量与出场顺序，不按挂机时间给单位叠属性。后半段亡灵主线随定居点（C004）开放。
export const ENCOUNTERS:readonly Encounter[] = [
 {round:1,title:'平原初遇',faction:'goblin',groups:[['goblin',3]],reward:0,city:0},
 {round:2,title:'侦察小队',faction:'goblin',groups:[['goblin',4]],reward:10,city:1},
 {round:3,title:'第二次试探',faction:'goblin',groups:[['goblin',5]],reward:15,city:1},
 {round:4,title:'守住落脚点',faction:'goblin',groups:[['goblin',6]],reward:20,city:1},
 {round:5,title:'投石骚扰',faction:'goblin',groups:[['goblin',3],['stoneGoblin',1]],reward:25,city:1},
 {round:6,title:'狼影',faction:'goblin',groups:[['goblin',3],['wolf',1]],reward:30,city:1},
 {round:7,title:'两侧包抄',faction:'goblin',groups:[['goblin',5],['stoneGoblin',1]],reward:35,city:1},
 {round:8,title:'营地立足战',faction:'goblin',groups:[['goblin',6],['wolf',1]],reward:80,city:1},
 {round:9,title:'木盾阵列',faction:'goblin',groups:[['shieldGoblin',1],['goblin',3]],reward:35,city:2},
 {round:10,title:'盾后投石',faction:'goblin',groups:[['shieldGoblin',1],['stoneGoblin',2],['goblin',2]],reward:40,city:2},
 {round:11,title:'巫术来袭',faction:'goblin',groups:[['shieldGoblin',1],['mageGoblin',1],['goblin',3]],reward:45,city:2},
 {round:12,title:'截击狼群',faction:'goblin',groups:[['wolf',3],['stoneGoblin',2],['goblin',2]],reward:50,city:2},
 {round:13,title:'医师护队',faction:'goblin',groups:[['shieldGoblin',2],['healerGoblin',1],['goblin',3]],reward:55,city:2},
 {round:14,title:'拆散混编阵',faction:'goblin',groups:[['shieldGoblin',2],['mageGoblin',1],['wolf',1]],reward:60,city:2},
 {round:15,title:'破坏战车',faction:'goblin',groups:[['siegeGoblin',1],['goblin',3]],reward:70,city:2},
 {round:16,title:'哥布林头领',faction:'goblin',groups:[['goblinBoss',1],['goblin',3],['stoneGoblin',1]],reward:100,city:2,boss:true},
 {round:17,title:'白骨从何而来',faction:'undead',groups:[['skeleton',6]],reward:70,city:2},
 {round:18,title:'骨弓齐射',faction:'undead',groups:[['skeleton',4],['skeletonArcher',2]],reward:75,city:2},
 {round:19,title:'不死盾阵',faction:'undead',groups:[['skeletonWarrior',3],['skeletonArcher',2]],reward:80,city:2},
 {round:20,title:'定居点保卫战',faction:'undead',groups:[['zombie',3],['skeleton',4]],reward:100,city:2},
 {round:21,title:'幽魂穿阵',faction:'undead',groups:[['ghost',2],['skeletonArcher',3]],reward:90,city:3},
 {round:22,title:'骨火',faction:'undead',groups:[['skeletonWarrior',3],['skeletonMage',2]],reward:95,city:3},
 {round:23,title:'召唤仪式',faction:'undead',groups:[['necromancer',1],['skeletonWarrior',3]],reward:100,city:3},
 {round:24,title:'尸潮前锋',faction:'undead',groups:[['zombie',4],['skeletonArcher',3]],reward:110,city:3},
 {round:25,title:'亡者将军',faction:'undead',groups:[['skeletonGeneral',1],['skeletonWarrior',3]],reward:120,city:3},
 {round:26,title:'幽魂与骨火',faction:'undead',groups:[['ghost',3],['skeletonMage',2]],reward:120,city:3},
 {round:27,title:'截断增援',faction:'undead',groups:[['necromancer',1],['zombie',3],['skeletonArcher',2]],reward:130,city:3},
 {round:28,title:'白骨方阵',faction:'undead',groups:[['skeletonGeneral',1],['skeletonWarrior',4],['skeletonMage',2]],reward:140,city:3},
 {round:29,title:'亡灵合围',faction:'undead',groups:[['zombie',4],['ghost',2],['skeletonArcher',3]],reward:150,city:3},
 {round:30,title:'召唤者之战',faction:'undead',groups:[['necromancer',2],['skeletonWarrior',4]],reward:160,city:3},
 {round:31,title:'骑士前夜',faction:'undead',groups:[['skeletonGeneral',1],['skeletonMage',3],['ghost',2]],reward:180,city:3},
 {round:32,title:'无头骑士',faction:'undead',groups:[['headlessKnight',1],['zombie',2]],reward:250,city:3,boss:true},
];
export const PLAYABLE_ROUNDS=32;
export const WILD_RULES={unlockAfter:2,interval:45,firstInterval:60,maxActiveWaves:1,maxEnemies:40} as const;
export function wildTier(completed:number):number { return completed>=16?3:completed>=8?2:1; }
export function wildRoster(completed:number,serial:number):UnitKind[] {
 const pool:readonly (readonly UnitKind[])[]=completed>=16?[['skeleton','skeleton'],['skeleton','skeletonArcher'],['zombie']]:completed>=8?[['goblin','goblin','stoneGoblin'],['shieldGoblin','goblin'],['wolf','goblin']]:[['goblin','goblin'],['goblin'],['wolf']];
 return [...pool[serial%pool.length]];
}

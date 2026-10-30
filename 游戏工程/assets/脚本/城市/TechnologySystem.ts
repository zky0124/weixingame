import { TECHNOLOGIES } from './TechnologyData';
export type TechnologyLevels = Record<string, number>;
export interface TechnologyContext { hasTower: boolean; town: number; farmLevel: number; buildings: readonly string[] }
export interface TechnologyWallet { points: number; coins: number }
export function validTechnologyLevels(levels: TechnologyLevels): boolean {
  return !!levels && typeof levels === 'object' && !Array.isArray(levels) && Object.entries(levels).every(([id,level]) => {
    const definition=TECHNOLOGIES.find(n=>n.id===id);
    return !!definition && Number.isInteger(level) && level>=0 && level<=definition.maxLevel;
  });
}
export function technologyError(levels: TechnologyLevels, id: string, wallet: TechnologyWallet, context: TechnologyContext): string {
  if(!validTechnologyLevels(levels)||!Number.isSafeInteger(wallet.points)||!Number.isSafeInteger(wallet.coins)||wallet.points<0||wallet.coins<0)return '研究账户无效';
  const node=TECHNOLOGIES.find(n=>n.id===id);if(!node)return '科技尚未配置';
  if(!context.hasTower)return '需要先建成研究塔';
  if((levels[id]??0)>=node.maxLevel)return '科技已满级';
  if(node.pointCost===null)return '这项科技的研究点费用尚未填写';
  if(context.town<node.minTown)return '主城等级不足';
  if(context.farmLevel<node.minFarm)return '需要一块三级农田';
  if(node.buildings.some(b=>!context.buildings.includes(b)))return '缺少前置建筑';
  const results=node.prerequisites.map(p=>(levels[p.id]??0)>=p.level);
  if(results.length&&!(String(node.mode)==='any'?results.some(Boolean):results.every(Boolean)))return '前置科技尚未达到要求等级';
  if(wallet.points<node.pointCost)return '研究点不足';if(wallet.coins<node.coinCost)return '铜币不足';return '';
}
export function purchaseTechnology(levels: TechnologyLevels, id: string, wallet: TechnologyWallet, context: TechnologyContext): string {
  const error=technologyError(levels,id,wallet,context);if(error)return error;
  const node=TECHNOLOGIES.find(n=>n.id===id)!;wallet.points-=node.pointCost!;wallet.coins-=node.coinCost;levels[id]=(levels[id]??0)+1;return '';
}
export function technologyModifiers(levels: TechnologyLevels) {
  const result={attack:{} as Record<string,number>,armor:{} as Record<string,number>,healing:{} as Record<string,number>,unlockedUnits:[] as string[],farmCapacity:0,farmPeriod:0,farmIncome:0,cityHp:0,cityRegen:0,researchPeriod:0,researchOutput:0,researchTier:1,unitRegen:0};
  for(const node of TECHNOLOGIES){
    const level=levels[node.id]??0;if(!level)continue;const effect=node.effect,amount=level*effect.value;
    switch(effect.kind){
      case 'attack':result.attack[effect.target]=(result.attack[effect.target]??0)+amount;break;
      case 'armor':result.armor[effect.target]=(result.armor[effect.target]??0)+amount;break;
      case 'healing':result.healing[effect.target]=(result.healing[effect.target]??0)+amount;break;
      case 'unlockUnit':result.unlockedUnits.push(effect.target);break;
      case 'farmCapacity':result.farmCapacity+=amount;break;case 'farmPeriod':result.farmPeriod+=amount;break;case 'farmIncome':result.farmIncome+=amount;break;
      case 'cityHp':result.cityHp+=amount;break;case 'cityRegen':result.cityRegen+=amount;break;case 'unitRegen':result.unitRegen+=amount;break;
      case 'researchPeriod':result.researchPeriod+=amount;break;case 'researchOutput':result.researchOutput+=amount;break;
      case 'researchTier':result.researchTier=Math.max(result.researchTier,effect.value);break;
    }
  }
  return result;
}

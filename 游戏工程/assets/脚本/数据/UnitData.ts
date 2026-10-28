// 从单位属性卡生成，请修改单位卡后运行 node 工具/同步首战单位.cjs。
export const UNIT_DATA = {
  "guard": {
    "name": "护卫",
    "hp": 15,
    "attack": 2,
    "armor": 0,
    "resistance": 0,
    "rate": 1,
    "range": 1,
    "speed": 2,
    "source": "游戏策划/单位资料/士兵单位/护卫/属性设定.md"
  },
  "goblin": {
    "name": "哥布林散兵",
    "hp": 10,
    "attack": 1,
    "armor": 0,
    "resistance": 0,
    "rate": 0.7,
    "range": 1,
    "speed": 2,
    "source": "游戏策划/单位资料/敌人单位/哥布林部族/哥布林散兵/属性设定.md"
  }
} as const;

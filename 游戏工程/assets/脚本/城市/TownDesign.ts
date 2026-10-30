// 从已确认配置.json生成，修改原资料并运行工具/同步城镇设定.cjs。
export const TOWN_NODES = [
  {
    "id": "C001",
    "name": "临时庇护所",
    "cost": 0,
    "minRound": 0,
    "hp": 100,
    "capacity": 3,
    "farms": 0
  },
  {
    "id": "C002",
    "name": "简易房屋",
    "cost": 30,
    "minRound": 1,
    "hp": 150,
    "capacity": 5,
    "farms": 1
  },
  {
    "id": "C003",
    "name": "小型营地",
    "cost": 180,
    "minRound": 8,
    "hp": 200,
    "capacity": 8,
    "farms": 3
  },
  {
    "id": "C004",
    "name": "定居点",
    "cost": 900,
    "minRound": 20,
    "hp": 250,
    "capacity": 10,
    "farms": 4
  }
] as const;
export const FARM_LEVELS = [
  {
    "level": 1,
    "cost": 5,
    "requiredTown": 1,
    "seconds": 10,
    "passive": 1,
    "round": 1
  },
  {
    "level": 2,
    "cost": 30,
    "requiredTown": 2,
    "seconds": 10,
    "passive": 2,
    "round": 2
  },
  {
    "level": 3,
    "cost": 120,
    "requiredTown": 3,
    "seconds": 10,
    "passive": 3,
    "round": 3
  }
] as const;
export const RESEARCH_DESIGN = {
  "seconds": 30,
  "passive": 1,
  "wildWave": 1,
  "round": 5,
  "settlementSupport": 20
} as const;
export const BUILDING_DESIGNS = [
  {
    "id": "B001",
    "name": "农田",
    "unlockTown": "C002",
    "cost": 5,
    "width": 2,
    "height": 2,
    "maxCount": null,
    "maxLevel": 20,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "获得铜币",
    "pendingFields": []
  },
  {
    "id": "B002",
    "name": "训练营",
    "unlockTown": "C004",
    "cost": 15,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 20,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "兵种训练与属性强化",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B003",
    "name": "弓手营",
    "unlockTown": "C003",
    "cost": 25,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 10,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "招募弓箭手",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B004",
    "name": "民兵营",
    "unlockTown": "C003",
    "cost": 25,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 10,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "招募民兵",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B005",
    "name": "酒馆",
    "unlockTown": "C003",
    "cost": 30,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 5,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "招募英雄",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B006",
    "name": "医院",
    "unlockTown": "C003",
    "cost": null,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 10,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "建成后可招募医疗队；其他医疗作用待填",
    "pendingFields": [
      "cost",
      "width",
      "height"
    ]
  },
  {
    "id": "B007",
    "name": "研究塔",
    "unlockTown": "C004",
    "cost": 80,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": null,
    "upgradeable": false,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "研究科技、解锁兵种成长与新内容",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B008",
    "name": "法师塔",
    "unlockTown": "C004",
    "cost": 300,
    "width": null,
    "height": null,
    "maxCount": 1,
    "maxLevel": 10,
    "upgradeable": true,
    "phase1": true,
    "requiredTechnology": "T002 法师塔（魔力之路分支）",
    "purpose": "建成并完成前置科技后招募魔法师",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B009",
    "name": "黑市商人",
    "unlockTown": "C004",
    "cost": 0,
    "width": null,
    "height": null,
    "maxCount": null,
    "maxLevel": null,
    "upgradeable": null,
    "phase1": true,
    "requiredTechnology": null,
    "purpose": "广告代币兑换商品",
    "pendingFields": [
      "width",
      "height"
    ]
  },
  {
    "id": "B010",
    "name": "银行",
    "unlockTown": null,
    "cost": null,
    "width": null,
    "height": null,
    "maxCount": null,
    "maxLevel": null,
    "upgradeable": null,
    "phase1": false,
    "requiredTechnology": null,
    "purpose": "自动按100铜=1银、100银=1金、100金=1铂金显示与支付",
    "pendingFields": [
      "cost",
      "width",
      "height"
    ]
  },
  {
    "id": "B011",
    "name": "弓箭塔",
    "unlockTown": null,
    "cost": null,
    "width": null,
    "height": null,
    "maxCount": null,
    "maxLevel": null,
    "upgradeable": null,
    "phase1": false,
    "requiredTechnology": null,
    "purpose": "向外射箭协助守军战斗",
    "pendingFields": [
      "cost",
      "width",
      "height"
    ]
  },
  {
    "id": "B012",
    "name": "城墙",
    "unlockTown": null,
    "cost": null,
    "width": null,
    "height": null,
    "maxCount": null,
    "maxLevel": null,
    "upgradeable": null,
    "phase1": false,
    "requiredTechnology": null,
    "purpose": "保护城堡",
    "pendingFields": [
      "cost",
      "width",
      "height"
    ]
  },
  {
    "id": "B013",
    "name": "神殿",
    "unlockTown": null,
    "cost": null,
    "width": null,
    "height": null,
    "maxCount": null,
    "maxLevel": null,
    "upgradeable": null,
    "phase1": false,
    "requiredTechnology": null,
    "purpose": "复活符合条件的高级英雄；低级英雄不可复活",
    "pendingFields": [
      "cost",
      "width",
      "height"
    ]
  }
] as const;

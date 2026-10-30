// 从科技树系统.json核对生成；文字效果通过显式映射执行，不动态执行用户文本。
export const TECHNOLOGIES = [
  {
    "id": "T002",
    "name": "法师塔",
    "branch": "魔力之路",
    "maxLevel": 1,
    "pointCost": 10,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "unlockUnit",
      "target": "魔法师",
      "value": 1
    },
    "description": "完成研究并建造法师塔后，可以招募魔法师"
  },
  {
    "id": "T001",
    "name": "攻击强化",
    "branch": "战争之路",
    "maxLevel": 5,
    "pointCost": 10,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "attack",
      "target": "战士",
      "value": 1
    },
    "description": "每一个等级所有战士单位攻击力增加1"
  },
  {
    "id": "T003",
    "name": "熟练老手",
    "branch": "战争之路",
    "maxLevel": 1,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T001",
        "level": 5
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "unlockUnit",
      "target": "熟练民兵",
      "value": 1
    },
    "description": "解锁熟练民兵"
  },
  {
    "id": "T004",
    "name": "见习法师",
    "branch": "法师塔",
    "maxLevel": 5,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T002",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "attack",
      "target": "魔法师",
      "value": 2
    },
    "description": "每一级增加所有法师单位2点攻击力"
  },
  {
    "id": "T005",
    "name": "攻击强化",
    "branch": "远距离打击",
    "maxLevel": 5,
    "pointCost": 10,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "attack",
      "target": "弓箭手",
      "value": 1
    },
    "description": "每一个等级所有弓箭手单位攻击力增加1"
  },
  {
    "id": "T006",
    "name": "熟练老手",
    "branch": "远距离打击",
    "maxLevel": 1,
    "pointCost": null,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T005",
        "level": 5
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "unlockUnit",
      "target": "熟练弓箭手",
      "value": 1
    },
    "description": "解锁熟练弓箭手"
  },
  {
    "id": "T007",
    "name": "新的增员",
    "branch": "守护之路",
    "maxLevel": 1,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "unlockUnit",
      "target": "护卫队长",
      "value": 1
    },
    "description": "解锁护卫队长的招募"
  },
  {
    "id": "T008",
    "name": "护甲强化",
    "branch": "守护之路",
    "maxLevel": 5,
    "pointCost": 10,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T007",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "armor",
      "target": "护卫",
      "value": 1
    },
    "description": "每一个等级所有护卫单位护甲力增加1"
  },
  {
    "id": "T009",
    "name": "开垦",
    "branch": "繁荣之路",
    "maxLevel": 1,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "farmCapacity",
      "target": "",
      "value": 1
    },
    "description": "增加可建造农田数量1"
  },
  {
    "id": "T010",
    "name": "改良种植",
    "branch": "繁荣之路",
    "maxLevel": 1,
    "pointCost": 30,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T009",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "farmPeriod",
      "target": "",
      "value": 2
    },
    "description": "农田的产出减少2秒"
  },
  {
    "id": "T011",
    "name": "改良种植+",
    "branch": "繁荣之路",
    "maxLevel": 3,
    "pointCost": 70,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T010",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 3,
    "minFarm": 3,
    "buildings": [],
    "effect": {
      "kind": "farmIncome",
      "target": "",
      "value": 1
    },
    "description": "每一级增加农田产出1铜币"
  },
  {
    "id": "T012",
    "name": "加固城防",
    "branch": "建设之路",
    "maxLevel": 1,
    "pointCost": 10,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "cityHp",
      "target": "",
      "value": 50
    },
    "description": "增加城市血量50"
  },
  {
    "id": "T013",
    "name": "修复工匠",
    "branch": "建设之路",
    "maxLevel": 3,
    "pointCost": 50,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T012",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "cityRegen",
      "target": "",
      "value": 1
    },
    "description": "每一个等级城市获得1每秒的回血"
  },
  {
    "id": "T014",
    "name": "招募学徒",
    "branch": "科技之路",
    "maxLevel": 1,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "researchPeriod",
      "target": "",
      "value": 10
    },
    "description": "缩短研究塔生产研究点10秒的时间"
  },
  {
    "id": "T015",
    "name": "高效研究",
    "branch": "科技之路",
    "maxLevel": 3,
    "pointCost": 100,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T014",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "researchOutput",
      "target": "",
      "value": 1
    },
    "description": "增加研究点产出1"
  },
  {
    "id": "T016",
    "name": "研究塔升级",
    "branch": "科技之路",
    "maxLevel": 1,
    "pointCost": 500,
    "coinCost": 1000,
    "prerequisites": [
      {
        "id": "T015",
        "level": 3
      }
    ],
    "mode": "all",
    "minTown": 3,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "researchTier",
      "target": "",
      "value": 2
    },
    "description": "解锁二级研究塔"
  },
  {
    "id": "T017",
    "name": "医疗救援队",
    "branch": "救赎之路",
    "maxLevel": 1,
    "pointCost": 70,
    "coinCost": 0,
    "prerequisites": [],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [
      "B006"
    ],
    "effect": {
      "kind": "unitRegen",
      "target": "",
      "value": 1
    },
    "description": "每秒钟回复所有友军单位1点生命值"
  },
  {
    "id": "T018",
    "name": "高效医疗设施",
    "branch": "救赎之路",
    "maxLevel": 1,
    "pointCost": 20,
    "coinCost": 0,
    "prerequisites": [
      {
        "id": "T017",
        "level": 1
      }
    ],
    "mode": "all",
    "minTown": 0,
    "minFarm": 0,
    "buildings": [],
    "effect": {
      "kind": "healing",
      "target": "辅助",
      "value": 1
    },
    "description": "每一个等级所有辅助单位治疗量增加1"
  }
] as const;

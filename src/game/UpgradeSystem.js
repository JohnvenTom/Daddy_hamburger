/**
 * @file UpgradeSystem.js
 * @description 升级商店系统：定义所有可购买的升级项，提供购买与应用逻辑。
 */

/** 升级项定义 */
export const UPGRADE_DEFS = [
  {
    id: 'heatLamp',
    name: '加热灯',
    desc: '让肉饼保温更久，每级提升保温时长 +10s',
    maxLevel: 3,
    basePrice: 30,
    priceGrowth: 1.5,
    effect: (lvl) => ({ warmerBonusSec: lvl * 10 })
  },
  {
    id: 'timer',
    name: '翻面计时器',
    desc: '在肉饼需要翻面时显示提示标记',
    maxLevel: 1,
    basePrice: 25,
    priceGrowth: 1,
    effect: (lvl) => ({ showFlipHint: lvl > 0 })
  },
  {
    id: 'doorbell',
    name: '门铃',
    desc: '新顾客进店时弹出提示',
    maxLevel: 1,
    basePrice: 20,
    priceGrowth: 1,
    effect: (lvl) => ({ doorbellAlert: lvl > 0 })
  },
  {
    id: 'decorations',
    name: '餐厅装饰',
    desc: '提高顾客耐心，每级 +15% 耐心时长',
    maxLevel: 3,
    basePrice: 40,
    priceGrowth: 1.6,
    effect: (lvl) => ({ patienceBonus: lvl * 0.15 })
  },
  {
    id: 'grillSlot',
    name: '扩展烤位',
    desc: '解锁额外烤位（最多 +2）',
    maxLevel: 2,
    basePrice: 50,
    priceGrowth: 2,
    effect: (lvl) => ({ extraSlots: lvl })
  }
];

/**
 * 获取某升级项的当前价格
 * @param {object} def - 升级定义
 * @param {number} currentLevel - 当前等级
 * @returns {number}
 */
export function getUpgradePrice(def, currentLevel) {
  return Math.round(def.basePrice * Math.pow(def.priceGrowth, currentLevel));
}

/**
 * 计算升级系统提供的所有效果
 * @param {object} upgrades - 玩家升级状态
 * @returns {object} 合并后的效果对象
 */
export function computeUpgradeEffects(upgrades) {
  const result = {
    warmerBonusSec: 0,
    showFlipHint: false,
    doorbellAlert: false,
    patienceBonus: 0,
    extraSlots: 0
  };
  for (const def of UPGRADE_DEFS) {
    const lvl = upgrades[def.id] || 0;
    if (lvl <= 0) continue;
    const eff = def.effect(lvl);
    Object.assign(result, eff);
  }
  return result;
}

/**
 * 尝试购买升级
 * @param {object} state - 游戏状态
 * @param {string} upgradeId - 升级项 ID
 * @returns {{success: boolean, reason?: string, newPrice?: number}}
 */
export function purchaseUpgrade(state, upgradeId) {
  const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
  if (!def) return { success: false, reason: '未知升级项' };

  const currentLevel = state.upgrades[upgradeId] || 0;
  if (currentLevel >= def.maxLevel) return { success: false, reason: '已满级' };

  const price = getUpgradePrice(def, currentLevel);
  if (state.tips < price) return { success: false, reason: '小费不足' };

  state.tips -= price;
  state.upgrades[upgradeId] = currentLevel + 1;
  return { success: true, newPrice: price };
}

/**
 * @file gameState.js
 * @description 全局游戏状态对象与持久化。
 *  采用单一中央状态对象，所有系统共享此状态，便于调试与存档。
 */

const STORAGE_KEY = 'daddy_hamburger_3d_save';

/**
 * 创建初始游戏状态
 * @returns {object}
 */
export function createInitialState() {
  return {
    // === 进度 ===
    level: 1,
    score: 0,
    tips: 0,
    combo: 0,
    bestCombo: 0,

    // === 当日状态 ===
    dayCustomersTotal: 0,
    dayCustomersServed: 0,
    dayPerfectCount: 0,
    dayTipsEarned: 0,
    isGameOver: false,
    isPaused: true,

    // === 当前工作台 ===
    currentStation: 'order', // 'order' | 'grill' | 'build'

    // === 顾客与订单 ===
    customers: [],          // 当前在店的顾客
    orders: [],             // 活跃订单列表

    // === 烧烤台状态 ===
    patties: [],            // 烤架上的肉饼
    warmerPatties: [],      // 保温区的肉饼

    // === 组装台状态 ===
    burgerParts: [],        // 当前正在构建的汉堡部件
    activeBuildOrderId: null, // 当前为哪个订单构建汉堡

    // === 升级 ===
    upgrades: {
      heatLamp: 0,          // 保温灯等级（0-3）
      timer: 0,             // 翻面计时器等级
      doorbell: 0,          // 门铃等级
      decorations: 0,       // 装饰等级（提升顾客耐心）
      grillSlot: 0          // 额外烤位等级
    },

    // === 统计 ===
    stats: {
      totalServed: 0,
      totalPerfect: 0,
      totalTips: 0
    }
  };
}

/**
 * 从 localStorage 加载存档
 * @returns {object|null}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
  } catch (e) {
    console.warn('[Save] 加载存档失败', e);
    return null;
  }
}

/**
 * 保存进度到 localStorage（只保存持久化字段）
 * @param {object} state
 */
export function saveState(state) {
  try {
    const data = {
      level: state.level,
      score: state.score,
      tips: state.tips,
      bestCombo: state.bestCombo,
      upgrades: { ...state.upgrades },
      stats: { ...state.stats }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Save] 保存存档失败', e);
  }
}

/**
 * 清除存档
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

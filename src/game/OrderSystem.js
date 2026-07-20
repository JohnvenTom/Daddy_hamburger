/**
 * @file OrderSystem.js
 * @description 订单生成与管理。
 *  - 根据等级生成订单（配料列表 + 熟度要求）
 *  - 维护订单生命周期：创建 -> 烹饪/组装 -> 交付/超时
 */

import { DONENESS, DONENESS_LABEL, INGREDIENTS, pick, randInt, clamp } from '../utils/helpers.js';

/** 标准汉堡模板：底面包 -> ... -> 顶面包 */
const BUN_BOTTOM = INGREDIENTS.find((i) => i.id === 'bun_bottom');
const BUN_TOP = INGREDIENTS.find((i) => i.id === 'bun_top');
const PATTY = INGREDIENTS.find((i) => i.id === 'patty');

/** 可选夹层配料（不含面包和肉饼） */
const FILLINGS = INGREDIENTS.filter((i) => !['bun_bottom', 'bun_top', 'patty'].includes(i.id));

/**
 * 生成一个新订单
 * @param {number} level - 当前等级
 * @param {number} customerId - 关联顾客 ID
 * @returns {object} 订单对象
 */
export function generateOrder(level, customerId) {
  // 配料数量随等级递增：1 级 2-3 个夹层，5 级 4-5 个
  const fillingCount = clamp(2 + Math.floor(level / 2) + randInt(0, 1), 2, 5);
  const fillings = [];
  const pool = [...FILLINGS];
  for (let i = 0; i < fillingCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    fillings.push(pool[idx]);
    pool.splice(idx, 1);
  }

  // 肉饼数量：1-2 块（高等级更可能 2 块）
  const pattyCount = level >= 3 && Math.random() < 0.3 ? 2 : 1;

  // 熟度要求：低等级只要求 medium，高等级会要求 rare/welldone
  const donenessPool = level < 2 ? [DONENESS.MEDIUM]
    : level < 4 ? [DONENESS.RARE, DONENESS.MEDIUM]
    : [DONENESS.RARE, DONENESS.MEDIUM, DONENESS.WELLDONE];
  const doneness = pick(donenessPool);

  // 构建完整配料顺序：底面包 -> 肉饼(夹层) -> 夹层配料 -> 顶面包
  // 为了让玩家有"按顺序堆叠"的体验，把肉饼也放进去
  const ingredients = [BUN_BOTTOM];
  // 肉饼放在中间位置
  if (pattyCount === 2) {
    const mid = Math.floor(fillings.length / 2);
    for (let i = 0; i < fillings.length; i++) {
      if (i === mid) ingredients.push(PATTY);
      ingredients.push(fillings[i]);
    }
    if (fillings.length === 0) ingredients.push(PATTY);
    // 第二块肉饼放在最上层夹层
    ingredients.push(PATTY);
  } else {
    const mid = Math.floor(fillings.length / 2);
    for (let i = 0; i < fillings.length; i++) {
      if (i === mid) ingredients.push(PATTY);
      ingredients.push(fillings[i]);
    }
    if (fillings.length === 0) ingredients.push(PATTY);
  }
  ingredients.push(BUN_TOP);

  return {
    id: 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    customerId,
    ingredients,         // 期望的配料顺序（数组）
    doneness,            // 期望的肉饼熟度
    pattyCount,
    createdAt: performance.now(),
    servedAt: null,
    patience: 1.0,       // 0-1，1 表示满
    patienceDuration: 60000 + Math.max(0, 30000 - level * 3000), // 毫秒
    status: 'pending'    // 'pending' | 'building' | 'served' | 'expired'
  };
}

/**
 * 获取熟度的中文标签
 * @param {string} doneness
 * @returns {string}
 */
export function getDonenessLabel(doneness) {
  return DONENESS_LABEL[doneness] || '未知';
}

/**
 * 生成顾客名字（随机）
 * @returns {string}
 */
const NAMES = ['Alex', 'Bob', 'Cathy', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
  'Kara', 'Leo', 'Mia', 'Nora', 'Oscar', 'Penny', 'Quinn', 'Ruby', 'Sam', 'Tina',
  '老王', '小李', '阿强', '丽丽', '阿杰'];
let nameIdx = 0;

/**
 * 取一个顾客名字（循环避免重复）
 * @returns {string}
 */
export function nextCustomerName() {
  const n = NAMES[nameIdx % NAMES.length];
  nameIdx++;
  return n;
}

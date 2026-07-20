/**
 * @file ScoreSystem.js
 * @description 评分系统：根据速度、配料准确性、肉饼熟度计算最终分数与小费。
 *  支持连击（Combo）奖励。
 */

import { DONENESS } from '../utils/helpers.js';

/** 熟度与对应的烹饪时间窗口（秒） */
export const COOK_TIMES = {
  [DONENESS.RARE]:    { min: 8,  max: 12, ideal: 10 },
  [DONENESS.MEDIUM]:  { min: 14, max: 18, ideal: 16 },
  [DONENESS.WELLDONE]:{ min: 20, max: 26, ideal: 23 }
};

/**
 * 计算肉饼熟度评分
 * @param {number} cookedTime - 实际烹饪总时间（秒），需翻面后半段也算
 * @param {boolean} flipped - 是否翻过面
 * @param {string} expectedDoneness - 期望熟度
 * @returns {{score: number, doneness: string, burnt: boolean}}
 *   score: 0-1
 *   doneness: 实际熟度
 *   burnt: 是否烧焦
 */
export function evaluatePatty(cookedTime, flipped, expectedDoneness) {
  // 没翻面直接扣分
  if (!flipped) {
    return { score: 0.2, doneness: DONENESS.RAW, burnt: false };
  }

  // 烧焦判定
  if (cookedTime > 32) {
    return { score: 0.0, doneness: DONENESS.BURNT, burnt: true };
  }

  // 确定实际熟度
  let actualDoneness;
  if (cookedTime < 6) actualDoneness = DONENESS.RAW;
  else if (cookedTime < 13) actualDoneness = DONENESS.RARE;
  else if (cookedTime < 19) actualDoneness = DONENESS.MEDIUM;
  else actualDoneness = DONENESS.WELLDONE;

  // 与期望对比
  const expected = COOK_TIMES[expectedDoneness];
  if (!expected) return { score: 0.5, doneness: actualDoneness, burnt: false };

  const diff = Math.abs(cookedTime - expected.ideal);
  let score;
  if (diff <= 1) score = 1.0;
  else if (diff <= 3) score = 0.85;
  else if (diff <= 5) score = 0.6;
  else if (actualDoneness === expectedDoneness) score = 0.5;
  else score = 0.2;

  return { score, doneness: actualDoneness, burnt: false };
}

/**
 * 计算配料准确性评分
 * @param {Array} expected - 期望的配料数组 [{id, ...}]
 * @param {Array} actual - 实际放置的配料数组 [{id, accuracy: 0-1}]
 * @returns {{score: number, matched: number, total: number}}
 */
export function evaluateIngredients(expected, actual) {
  if (expected.length === 0) return { score: 1.0, matched: 0, total: 0 };

  // 顺序完全匹配为满分；错位/缺料/多料扣分
  let matched = 0;
  const maxLen = Math.max(expected.length, actual.length);
  for (let i = 0; i < maxLen; i++) {
    const e = expected[i];
    const a = actual[i];
    if (e && a && e.id === a.id) {
      // 位置准确性（放歪了扣分）。注意 typeof NaN === 'number'，
      // 因此必须用 Number.isFinite 过滤掉 NaN/Infinity，避免污染求和结果
      const acc = Number.isFinite(a.accuracy) ? a.accuracy : 1.0;
      matched += acc;
    }
  }
  const score = matched / expected.length;
  return { score: Math.max(0, Math.min(1, score)), matched, total: expected.length };
}

/**
 * 计算速度评分
 * @param {number} elapsedSec - 从下单到交付经过的秒数
 * @param {number} patienceDurationMs - 顾客耐心总时长（毫秒）
 * @returns {number} 0-1
 */
export function evaluateSpeed(elapsedSec, patienceDurationMs) {
  const ratio = elapsedSec * 1000 / patienceDurationMs;
  if (ratio <= 0.3) return 1.0;
  if (ratio <= 0.6) return 0.85;
  if (ratio <= 0.85) return 0.6;
  if (ratio <= 1.0) return 0.3;
  return 0.1;
}

/**
 * 计算最终订单评分与小费
 * @param {object} params
 * @param {number} params.speedScore
 * @param {number} params.ingredientScore
 * @param {number} params.pattyScore
 * @param {number} combo - 当前连击数
 * @param {number} level - 当前等级
 * @returns {{total: number, tips: number, rating: string, isPerfect: boolean, breakdown: object}}
 */
export function computeFinalScore({ speedScore, ingredientScore, pattyScore }, combo, level) {
  // 防御 NaN：若任一输入不是有限数，按 0 处理，避免评分链路整体被污染
  const sSpeed = Number.isFinite(speedScore) ? speedScore : 0;
  const sIng = Number.isFinite(ingredientScore) ? ingredientScore : 0;
  const sPatty = Number.isFinite(pattyScore) ? pattyScore : 0;
  // 加权：配料 50%，肉饼 30%，速度 20%
  const weighted = sIng * 0.5 + sPatty * 0.3 + sSpeed * 0.2;

  // 评分等级
  let rating;
  if (weighted >= 0.95) rating = 'gold';
  else if (weighted >= 0.8) rating = 'silver';
  else if (weighted >= 0.6) rating = 'bronze';
  else if (weighted >= 0.3) rating = 'ok';
  else rating = 'bad';

  // 基础分数
  const baseScore = Math.round(weighted * 100);
  // 连击奖励：每连击 +10%，最多 +100%
  const comboBonus = 1 + Math.min(combo, 10) * 0.1;
  const total = Math.round(baseScore * comboBonus);

  // 小费：等级越高，小费越多
  const baseTip = 5 + level * 2;
  let tipMultiplier;
  switch (rating) {
    case 'gold':   tipMultiplier = 3.0; break;
    case 'silver': tipMultiplier = 2.0; break;
    case 'bronze': tipMultiplier = 1.3; break;
    case 'ok':     tipMultiplier = 0.8; break;
    default:       tipMultiplier = 0.2;
  }
  const tips = Math.round(baseTip * tipMultiplier * (1 + Math.min(combo, 5) * 0.05));

  const isPerfect = rating === 'gold';

  return {
    total,
    tips,
    rating,
    isPerfect,
    breakdown: { speed: speedScore, ingredient: ingredientScore, patty: pattyScore, weighted, comboBonus }
  };
}

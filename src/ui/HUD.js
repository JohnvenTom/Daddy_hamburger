/**
 * @file HUD.js
 * @description 顶部状态栏（HUD）控制：分数、等级、小费、连击、当日进度。
 */

import { formatMoney } from '../utils/helpers.js';

/**
 * 创建 HUD 控制器
 * @returns {object}
 */
export function createHUD() {
  const elLevel = document.getElementById('hud-level');
  const elScore = document.getElementById('hud-score');
  const elTips = document.getElementById('hud-tips');
  const elCombo = document.getElementById('hud-combo');
  const elDayFill = document.getElementById('day-bar-fill');
  const elCustomersLeft = document.getElementById('hud-customers-left');

  /**
   * 更新 HUD 显示
   * @param {object} state - 游戏状态
   */
  function update(state) {
    elLevel.textContent = state.level;
    elScore.textContent = state.score;
    elTips.textContent = formatMoney(state.tips);
    elCombo.textContent = 'x' + state.combo;

    const total = state.dayCustomersTotal || 1;
    const served = state.dayCustomersServed;
    const pct = (served / total) * 100;
    elDayFill.style.width = pct + '%';
    elCustomersLeft.textContent = served + '/' + total;
  }

  return { update };
}

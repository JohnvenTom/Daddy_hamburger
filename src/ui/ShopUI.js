/**
 * @file ShopUI.js
 * @description 商店界面：显示升级项、价格，处理购买。
 */

import { UPGRADE_DEFS, getUpgradePrice, purchaseUpgrade } from '../game/UpgradeSystem.js';
import { formatMoney } from '../utils/helpers.js';

/**
 * 创建商店 UI 控制器
 * @param {object} opts
 * @param {() => object} opts.getState - 获取最新游戏状态
 * @param {(state:object)=>void} opts.onUpdated - 状态更新后回调
 * @param {(msg:string, type?:string)=>void} opts.onToast
 * @returns {object}
 */
export function createShopUI({ getState, onUpdated, onToast }) {
  const modal = document.getElementById('shop-modal');
  const itemsContainer = document.getElementById('shop-items');
  const balanceEl = document.getElementById('shop-tips-balance');
  const btnClose = document.getElementById('btn-close-shop');

  btnClose.addEventListener('click', close);

  /**
   * 打开商店
   */
  function open() {
    render();
    modal.classList.remove('hidden');
  }

  /** 关闭商店 */
  function close() {
    modal.classList.add('hidden');
  }

  /** 渲染商店内容 */
  function render() {
    const state = getState();
    balanceEl.textContent = formatMoney(state.tips);
    itemsContainer.innerHTML = '';

    for (const def of UPGRADE_DEFS) {
      const currentLevel = state.upgrades[def.id] || 0;
      const isMax = currentLevel >= def.maxLevel;
      const price = getUpgradePrice(def, currentLevel);
      const canAfford = state.tips >= price;

      const item = document.createElement('div');
      item.className = 'shop-item' + (isMax ? ' owned' : '');
      item.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${def.name}
            <span style="font-size:11px;color:#aaa"> Lv.${currentLevel}/${def.maxLevel}</span>
          </div>
          <div class="shop-item-desc">${def.desc}</div>
        </div>
        <button class="shop-item-price" ${isMax || !canAfford ? 'disabled' : ''}>
          ${isMax ? '已满级' : formatMoney(price)}
        </button>
      `;
      const btn = item.querySelector('.shop-item-price');
      if (!isMax && canAfford) {
        btn.addEventListener('click', () => {
          const result = purchaseUpgrade(state, def.id);
          if (result.success) {
            onToast && onToast(`已购买 ${def.name}！`, 'success');
            onUpdated(state);
            render();
          } else {
            onToast && onToast(result.reason || '购买失败', 'danger');
          }
        });
      }
      itemsContainer.appendChild(item);
    }
  }

  return { open, close, render };
}

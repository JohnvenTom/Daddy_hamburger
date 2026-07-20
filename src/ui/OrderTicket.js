/**
 * @file OrderTicket.js
 * @description 订单票 UI：在屏幕上显示活跃订单（配料列表、熟度、耐心条）。
 */

import { INGREDIENTS } from '../utils/helpers.js';
import { getDonenessLabel } from '../game/OrderSystem.js';

const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

const DONENESS_COLOR = {
  rare: '#ec407a',
  medium: '#ffca28',
  welldone: '#6d4c41'
};

const INGREDIENT_EMOJI = {
  bun_bottom: '🍞',
  patty: '🍖',
  cheese: '🧀',
  lettuce: '🥬',
  tomato: '🍅',
  onion: '🧅',
  sauce: '🥫',
  bun_top: '🍞'
};

/**
 * 创建订单票控制器
 * @param {object} opts
 * @param {(orderId:string)=>void} opts.onSelect - 点击订单票回调
 * @returns {object}
 */
export function createOrderTicket({ onSelect }) {
  const container = document.getElementById('order-tickets');
  const list = document.getElementById('tickets-list');

  /** 订单 ID -> DOM 元素的映射 */
  const ticketEls = new Map();

  /**
   * 渲染订单票
   * @param {Array} orders - 活跃订单列表
   */
  function render(orders) {
    container.classList.toggle('hidden', orders.length === 0);

    // 移除已完成的订单票
    for (const [id, el] of ticketEls.entries()) {
      if (!orders.find((o) => o.id === id)) {
        el.remove();
        ticketEls.delete(id);
      }
    }

    for (const order of orders) {
      let el = ticketEls.get(order.id);
      if (!el) {
        el = createTicketElement(order);
        list.appendChild(el);
        ticketEls.set(order.id, el);
        el.addEventListener('click', () => onSelect(order.id));
      }
      updateTicketElement(el, order);
    }
  }

  /**
   * 创建订单票 DOM
   * @param {object} order
   * @returns {HTMLDivElement}
   */
  function createTicketElement(order) {
    const div = document.createElement('div');
    div.className = 'order-ticket';
    div.dataset.orderId = order.id;
    div.innerHTML = `
      <div class="ticket-header">
        <span class="customer-name"></span>
        <span class="doneness-tag"></span>
      </div>
      <div class="patience-bar"><div class="patience-fill"></div></div>
      <div class="ingredients-list"></div>
    `;
    return div;
  }

  /**
   * 更新订单票 DOM 内容
   * @param {HTMLDivElement} el
   * @param {object} order
   */
  function updateTicketElement(el, order) {
    el.querySelector('.customer-name').textContent = order.customerName || '顾客';
    const tag = el.querySelector('.doneness-tag');
    tag.textContent = getDonenessLabel(order.doneness);
    tag.style.background = DONENESS_COLOR[order.doneness] || '#888';

    const fill = el.querySelector('.patience-fill');
    const pct = Math.max(0, order.patience) * 100;
    fill.style.width = pct + '%';
    fill.style.background = pct > 60 ? '#66bb6a' : pct > 30 ? '#ffca28' : '#ef5350';

    const list = el.querySelector('.ingredients-list');
    list.innerHTML = '';
    for (const ing of order.ingredients) {
      const chip = document.createElement('span');
      chip.className = 'ingredient-chip';
      const def = INGREDIENT_MAP[ing.id];
      chip.textContent = (INGREDIENT_EMOJI[ing.id] || '·') + ' ' + (def ? def.name : ing.id);
      list.appendChild(chip);
    }
  }

  /**
   * 标记某订单为活跃（高亮）
   * @param {string|null} orderId
   */
  function setActive(orderId) {
    for (const [id, el] of ticketEls.entries()) {
      el.classList.toggle('active', id === orderId);
    }
  }

  /**
   * 清空所有订单票
   */
  function clearAll() {
    list.innerHTML = '';
    ticketEls.clear();
  }

  return { render, setActive, clearAll };
}

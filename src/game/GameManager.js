/**
 * @file GameManager.js
 * @description 游戏主控制器：协调场景、UI、各子系统。
 *  - 主游戏循环
 *  - 工作台切换
 *  - 鼠标交互
 *  - 订单交付流程
 *  - 每日结算
 */

import * as THREE from 'three';
import { createSceneCore } from '../core/scene.js';
import { setupLights } from '../core/lights.js';
import { buildRestaurant } from '../components/Restaurant.js';
import { createGrill } from '../components/Grill.js';
import { createBurgerBuilder } from '../components/BurgerBuilder.js';
import { createCustomerAI } from './CustomerAI.js';
import { createInitialState, loadState, saveState } from './gameState.js';
import { computeUpgradeEffects } from './UpgradeSystem.js';
import {
  evaluatePatty, evaluateIngredients, evaluateSpeed, computeFinalScore
} from './ScoreSystem.js';
import { INGREDIENTS } from '../utils/helpers.js';
import { createHUD } from '../ui/HUD.js';
import { createOrderTicket } from '../ui/OrderTicket.js';
import { createShopUI } from '../ui/ShopUI.js';

/** 工作台面板元素 ID 映射 */
const STATION_PANEL_IDS = {
  order: 'order-panel',
  grill: 'grill-panel',
  build: 'build-panel'
};

/**
 * 创建游戏主控制器
 * @param {HTMLElement} container - 画布容器
 * @returns {object} GameManager
 */
export function createGameManager(container) {
  const state = createInitialState();
  // 从存档恢复部分字段
  const saved = loadState();
  if (saved) {
    state.level = saved.level || 1;
    state.score = saved.score || 0;
    state.tips = saved.tips || 0;
    state.bestCombo = saved.bestCombo || 0;
    state.upgrades = { ...state.upgrades, ...(saved.upgrades || {}) };
    state.stats = { ...state.stats, ...(saved.stats || {}) };
  }

  // === 场景核心 ===
  const core = createSceneCore(container);
  const { scene, camera, renderer } = core;
  setupLights(scene);

  // === 餐厅 ===
  const restaurant = buildRestaurant(scene);
  const stations = restaurant.stations;

  // === 升级效果 ===
  let upgradeEffects = computeUpgradeEffects(state.upgrades);
  state.upgradeDecorationsPatienceBonus = upgradeEffects.patienceBonus;

  // === 通过位置 + userData 标记查找三个工作台的 Group ===
  // 必须同时满足位置接近 + userData 含对应字段，避免误匹配到地板等 mesh
  function findStationGroup(targetPos, userDataKey) {
    let best = null;
    let bestDist = Infinity;
    for (const child of restaurant.group.children) {
      if (!child.userData || !(userDataKey in child.userData)) continue;
      const d = child.position.distanceTo(targetPos);
      if (d < bestDist) {
        bestDist = d;
        best = child;
      }
    }
    return best;
  }
  const grillGroup = findStationGroup(stations.grill.pos, 'grillSlots');
  const buildGroup = findStationGroup(stations.build.pos, 'burgerAnchor');
  if (!grillGroup) console.error('[GameManager] 未找到烧烤台 Group');
  if (!buildGroup) console.error('[GameManager] 未找到组装台 Group');

  // === 烧烤台 ===
  const grill = createGrill({
    stationGroup: grillGroup,
    upgradeEffects,
    onToast: showToast
  });

  // === 组装台 ===
  const burgerBuilder = createBurgerBuilder({
    anchor: buildGroup.userData.burgerAnchor,
    stationGroup: buildGroup,
    onToast: showToast
  });

  // === 顾客 AI ===
  const customerAI = createCustomerAI({
    scene,
    state,
    onToast: showToast
  });

  // === UI ===
  const hud = createHUD();
  const orderTicket = createOrderTicket({
    onSelect: (orderId) => {
      state.activeBuildOrderId = orderId;
      orderTicket.setActive(orderId);
    }
  });
  const shopUI = createShopUI({
    getState: () => state,
    onUpdated: (s) => {
      upgradeEffects = computeUpgradeEffects(s.upgrades);
      s.upgradeDecorationsPatienceBonus = upgradeEffects.patienceBonus;
      saveState(s);
      hud.update(s);
    },
    onToast: showToast
  });

  // === 鼠标交互 ===
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  /** 当前选中的肉饼（烧烤台） */
  let selectedPatty = null;

  /**
   * 处理画布点击
   * @param {MouseEvent} e
   */
  function onCanvasClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    if (state.currentStation === 'order') {
      // 点单台：点击顾客接单
      const customer = customerAI.pickCustomer(raycaster);
      if (customer) {
        const order = customerAI.takeOrder(customer);
        if (order) {
          state.activeBuildOrderId = order.id;
          orderTicket.render(state.orders);
          orderTicket.setActive(order.id);
        }
      }
    } else if (state.currentStation === 'grill') {
      // 烧烤台：点击肉饼翻面 / 移到保温
      handleGrillClick();
    } else if (state.currentStation === 'build') {
      // 组装台：暂不通过画布点击处理（用按钮）
    }
  }

  /**
   * 处理烧烤台点击交互
   */
  function handleGrillClick() {
    const patties = grill.getPatties();
    const warmerPatties = grill.getWarmerPatties();
    const targets = [
      ...patties.map((p) => ({ mesh: p.mesh, type: 'grill', data: p })),
      ...warmerPatties.map((p) => ({ mesh: p.mesh, type: 'warmer', data: p }))
    ];
    const meshes = targets.map((t) => t.mesh);
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length === 0) {
      selectedPatty = null;
      return;
    }
    const hit = hits[0].object;
    const target = targets.find((t) => t.mesh === hit);
    if (!target) return;

    if (target.type === 'grill') {
      // 烤架上的肉饼：第一次点击=翻面，已翻面=移到保温
      if (!target.data.flipped) {
        grill.flipPatty(target.data);
      } else {
        grill.moveToWarmer(target.data);
      }
    } else if (target.type === 'warmer') {
      // 保温区肉饼：暂不直接交互（通过组装台按钮使用）
      selectedPatty = target.data;
      showToast('已选中保温区肉饼', 'info');
    }
  }

  renderer.domElement.addEventListener('click', onCanvasClick);

  // === 工作台切换 ===
  /**
   * 切换工作台
   * @param {string} station
   */
  function switchStation(station) {
    state.currentStation = station;
    core.setStationCamera(station);
    // 更新底部按钮高亮
    document.querySelectorAll('.station-btn[data-station]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.station === station);
    });
    // 显示对应面板
    for (const [key, id] of Object.entries(STATION_PANEL_IDS)) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', key !== station);
    }
    if (station === 'build') {
      renderIngredientButtons();
      // 若没有选中的订单，自动选中第一个活跃订单
      const activeExists = state.orders.find((o) => o.id === state.activeBuildOrderId);
      if (!activeExists && state.orders.length > 0) {
        state.activeBuildOrderId = state.orders[0].id;
      }
      orderTicket.setActive(state.activeBuildOrderId);
    }
  }

  /**
   * 渲染组装台配料按钮
   */
  function renderIngredientButtons() {
    const container = document.getElementById('ingredient-buttons');
    container.innerHTML = '';
    // 排除肉饼和底面包/顶面包（底面包自动放置，肉饼单独按钮）
    const available = INGREDIENTS.filter((i) =>
      !['bun_bottom', 'patty'].includes(i.id));
    for (const ing of available) {
      const btn = document.createElement('button');
      btn.className = 'ingredient-btn';
      btn.textContent = ing.name;
      btn.style.background = '#' + ing.color.toString(16).padStart(6, '0');
      btn.addEventListener('click', () => {
        // 底面包未放时自动先放
        if (burgerBuilder.isEmpty()) {
          burgerBuilder.addIngredient('bun_bottom');
        }
        burgerBuilder.addIngredient(ing.id, {
          offsetX: (Math.random() - 0.5) * 0.1,
          offsetZ: (Math.random() - 0.5) * 0.1
        });
      });
      container.appendChild(btn);
    }
  }

  /**
   * 显示提示气泡
   * @param {string} msg
   * @param {string} [type='info']
   */
  function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = '';
    if (type === 'success') el.classList.add('success');
    else if (type === 'danger') el.classList.add('danger');
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.classList.remove('show');
    }, 1800);
  }

  // === 绑定底部导航按钮 ===
  document.querySelectorAll('.station-btn[data-station]').forEach((btn) => {
    btn.addEventListener('click', () => switchStation(btn.dataset.station));
  });

  // 绑定烧烤台按钮
  document.getElementById('btn-raw-patty').addEventListener('click', () => {
    grill.putRawPatty();
  });

  // 绑定组装台按钮
  document.getElementById('btn-add-patty').addEventListener('click', () => {
    // 从保温区取一块肉饼放到汉堡上
    const patty = grill.takeFromWarmer();
    if (!patty) {
      showToast('保温区没有肉饼！', 'danger');
      return;
    }
    if (burgerBuilder.isEmpty()) {
      burgerBuilder.addIngredient('bun_bottom');
    }
    burgerBuilder.addPatty(patty.doneness || 'welldone', {
      offsetX: (Math.random() - 0.5) * 0.1,
      offsetZ: (Math.random() - 0.5) * 0.1
    });
  });

  document.getElementById('btn-serve').addEventListener('click', () => {
    serveOrder();
  });

  document.getElementById('btn-trash').addEventListener('click', () => {
    burgerBuilder.clear();
    showToast('已丢弃当前汉堡', 'danger');
    state.combo = 0;
  });

  document.getElementById('btn-open-shop').addEventListener('click', () => {
    shopUI.open();
  });

  // === 订单交付流程 ===
  /**
   * 交付当前汉堡给活跃订单
   * 若 activeBuildOrderId 已失效（顾客离开等），自动切换到第一个活跃订单
   */
  function serveOrder() {
    // 查找当前选中的订单；若失效则自动选择第一个活跃订单
    let order = state.orders.find((o) => o.id === state.activeBuildOrderId);
    if (!order) {
      order = state.orders[0];
      if (order) {
        state.activeBuildOrderId = order.id;
        orderTicket.setActive(order.id);
      }
    }
    if (!order) {
      showToast('没有活跃订单！', 'danger');
      return;
    }
    if (burgerBuilder.isEmpty()) {
      showToast('汉堡是空的！', 'danger');
      return;
    }

    // 评估配料准确性
    const actualParts = burgerBuilder.getParts();
    const ingredientResult = evaluateIngredients(order.ingredients, actualParts);

    // 评估肉饼熟度（基于实际熟度与期望熟度的匹配度）
    const pattyParts = actualParts.filter((p) => p.id === 'patty');
    let pattyScore = 0.5;
    if (pattyParts.length === order.pattyCount) {
      // 用 doneness 字段对比期望熟度
      const matchCount = pattyParts.filter((p) => (p.doneness || 'welldone') === order.doneness).length;
      pattyScore = matchCount / order.pattyCount;
      // 数量正确但熟度全错：至少给 0.1
      if (pattyScore === 0) pattyScore = 0.1;
    } else {
      pattyScore = 0.2; // 肉饼数量不对
    }

    // 评估速度
    const elapsedSec = (performance.now() - order.createdAt) / 1000;
    const speedScore = evaluateSpeed(elapsedSec, order.patienceDuration);

    // 计算最终评分
    const result = computeFinalScore({
      speedScore,
      ingredientScore: ingredientResult.score,
      pattyScore
    }, state.combo, state.level);

    state.score += result.total;
    state.tips += result.tips;
    state.dayTipsEarned += result.tips;
    state.stats.totalServed++;
    // 注意：dayCustomersServed 已在 CustomerAI.dismissCustomer 中递增
    if (result.isPerfect) {
      state.stats.totalPerfect++;
      state.dayPerfectCount++;
      state.combo++;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    } else {
      state.combo = 0;
    }
    state.stats.totalTips += result.tips;

    // 显示评分
    const ratingText = {
      gold: '完美！🥇', silver: '优秀！🥈', bronze: '不错！🥉',
      ok: '及格', bad: '糟糕'
    }[result.rating] || '完成';
    showToast(`${ratingText} +${result.total}分 +$${result.tips}小费`, result.isPerfect ? 'success' : 'info');

    // 标记订单完成
    order.status = 'served';
    order.servedAt = performance.now();

    // 让顾客满意离开
    const customer = customerAI.getCustomers().find((c) => c.id === order.customerId);
    if (customer) {
      customerAI.dismissCustomer(customer, result.rating !== 'bad');
    }

    // 从订单列表移除
    const oIdx = state.orders.findIndex((o) => o.id === order.id);
    if (oIdx >= 0) state.orders.splice(oIdx, 1);
    state.activeBuildOrderId = state.orders.length > 0 ? state.orders[0].id : null;
    orderTicket.setActive(state.activeBuildOrderId);

    // 清空汉堡
    burgerBuilder.popAnimation().then(() => {
      burgerBuilder.clear();
    });

    saveState(state);
    hud.update(state);
    // 日完成检测已移至主循环（兼容顾客耐心耗尽离开的情况）
  }

  /**
   * 结束当日并显示结算
   */
  function endDay() {
    state.isPaused = true;
    const modal = document.getElementById('day-end-modal');
    document.getElementById('day-end-level').textContent = state.level;
    const stats = document.getElementById('day-end-stats');
    stats.innerHTML = `
      <div class="stat-row"><span>服务顾客</span><span class="value">${state.dayCustomersServed}/${customerAI.getTotal()}</span></div>
      <div class="stat-row"><span>完美评价</span><span class="value">${state.dayPerfectCount}</span></div>
      <div class="stat-row"><span>当日小费</span><span class="value">$${state.dayTipsEarned}</span></div>
      <div class="stat-row"><span>累计分数</span><span class="value">${state.score}</span></div>
      <div class="stat-row"><span>最高连击</span><span class="value">x${state.bestCombo}</span></div>
    `;
    modal.classList.remove('hidden');
    saveState(state);
  }

  /**
   * 进入下一天
   */
  function nextDay() {
    state.level++;
    state.combo = 0;
    state.isPaused = false;
    state.dayEndingShown = false;
    document.getElementById('day-end-modal').classList.add('hidden');
    customerAI.startDay();
    state.dayCustomersTotal = customerAI.getTotal();
    hud.update(state);
    orderTicket.clearAll();
    saveState(state);
    showToast(`第 ${state.level} 天开始！`, 'success');
  }

  // 绑定日结算按钮
  document.getElementById('btn-next-day').addEventListener('click', nextDay);
  document.getElementById('btn-go-shop').addEventListener('click', () => {
    document.getElementById('day-end-modal').classList.add('hidden');
    shopUI.open();
  });

  /**
   * 开始游戏
   */
  function startGame() {
    document.getElementById('start-modal').classList.add('hidden');
    state.isPaused = false;
    state.dayEndingShown = false;
    state.dayCustomersTotal = customerAI.getTotal();
    customerAI.startDay();
    switchStation('order');
    hud.update(state);
  }

  document.getElementById('btn-start-game').addEventListener('click', startGame);

  // === 主游戏循环 ===
  let lastTime = performance.now();
  let running = true;

  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (!state.isPaused) {
      customerAI.update(dt);
      grill.update(dt);
      orderTicket.render(state.orders);
      hud.update(state);

      // 检查当日是否结束（无论顾客是满意离开还是耐心耗尽）
      if (customerAI.isDayComplete() && !state.dayEndingShown) {
        state.dayEndingShown = true;
        setTimeout(endDay, 800);
      }
    }

    core.onTick(dt);
    requestAnimationFrame(loop);
  }

  // 处理窗口大小变化
  window.addEventListener('resize', core.onResize);

  // 启动循环
  loop();

  /** 销毁游戏 */
  function dispose() {
    running = false;
    renderer.domElement.removeEventListener('click', onCanvasClick);
    window.removeEventListener('resize', core.onResize);
    customerAI.dispose();
    grill.dispose();
    burgerBuilder.dispose();
    restaurant.dispose();
    core.dispose();
  }

  return {
    state,
    switchStation,
    startGame,
    dispose,
    // 暴露内部系统供调试与扩展使用
    _internal: {
      core,
      restaurant,
      grill,
      burgerBuilder,
      customerAI,
      hud,
      orderTicket,
      shopUI,
      showToast,
      serveOrder,
      endDay,
      nextDay
    }
  };
}

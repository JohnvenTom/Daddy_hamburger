/**
 * @file CustomerAI.js
 * @description 顾客 AI：负责生成顾客、安排排队位置、调度顾客在餐厅内的移动。
 *  与 Customer.js（3D 实体）协同工作。
 */

import * as THREE from 'three';
import { createCustomer, CustomerState } from '../components/Customer.js';
import { generateOrder, nextCustomerName } from './OrderSystem.js';
import { randFloat, randInt, clamp } from '../utils/helpers.js';

/** 排队位置（点单台前方，沿着 z 轴排列） */
const QUEUE_POSITIONS = [
  { x: -3.5, z: 4.0 },
  { x: -4.5, z: 4.5 },
  { x: -2.5, z: 4.5 },
  { x: -4.0, z: 5.5 },
  { x: -3.0, z: 5.5 }
];

/** 入口位置（餐厅前门） */
const ENTRY_POSITION = { x: 0, z: 8.0 };

/** 满意离开位置 */
const EXIT_POSITION = { x: -7, z: 8.0 };

/** 愤怒离开位置 */
const ANGRY_EXIT = { x: 7, z: 8.0 };

/**
 * 创建顾客 AI 控制器
 * @param {object} opts
 * @param {THREE.Scene} opts.scene - Three.js 场景
 * @param {object} opts.state - 游戏状态
 * @param {(msg:string, type?:string)=>void} [opts.onToast]
 * @returns {object}
 */
export function createCustomerAI({ scene, state, onToast }) {
  /** 已生成的顾客列表 */
  const customers = [];

  /** 入场计数器 */
  let spawnCounter = 0;
  let nextSpawnTime = 0;

  /**
   * 重置/开始新一天的顾客生成
   */
  function startDay() {
    // 清空残留顾客
    customers.forEach((c) => c.dispose());
    customers.length = 0;
    state.customers.length = 0;
    state.orders.length = 0;
    state.dayCustomersServed = 0;
    state.dayPerfectCount = 0;
    state.dayTipsEarned = 0;
    spawnCounter = 0;
    nextSpawnTime = performance.now() + 1500;
  }

  /**
   * 当日顾客总数
   */
  function getDayTotal() {
    return 5 + Math.floor(state.level * 1.5);
  }

  /**
   * 安排下一位顾客入场
   */
  function spawnNext() {
    if (spawnCounter >= getDayTotal()) return;

    const customerId = 'cust_' + Date.now() + '_' + spawnCounter;
    const order = generateOrder(state.level, customerId);
    const customer = createCustomer({
      id: customerId,
      name: nextCustomerName(),
      order,
      queueIndex: customers.length
    });
    customer.order.customerName = customer.name;

    // 从入口进入
    customer.setPosition(ENTRY_POSITION.x, ENTRY_POSITION.z);
    // 走到对应排队位置
    const queueIdx = customers.length % QUEUE_POSITIONS.length;
    const target = QUEUE_POSITIONS[queueIdx];
    customer.walkTo(target.x, target.z, randFloat(1.2, 1.8));
    customer.setPatience(1.0);
    customer.setState(CustomerState.QUEUING);

    scene.add(customer.group);
    customers.push(customer);
    state.customers.push({
      id: customerId,
      name: customer.name,
      state: CustomerState.QUEUING
    });
    state.orders.push(order);

    spawnCounter++;

    // 升级：门铃提示
    onToast && onToast(`新顾客进店：${customer.name}`, 'info');

    // 安排下一位
    const interval = clamp(8000 - state.level * 400, 3500, 9000);
    nextSpawnTime = performance.now() + interval;
  }

  /**
   * 获取队列中第一个未下单的顾客
   * @returns {object|null}
   */
  function getFirstQueuingCustomer() {
    return customers.find((c) => c.getState() === CustomerState.QUEUING);
  }

  /**
   * 接受顾客的订单
   * @param {object} customer
   * @returns {object|null} 订单对象
   */
  function takeOrder(customer) {
    if (!customer) return null;
    if (customer.getState() !== CustomerState.QUEUING) return null;
    customer.setState(CustomerState.ORDERED);
    customer.order.status = 'building';
    onToast && onToast(`已接单：${customer.name}`, 'success');
    return customer.order;
  }

  /**
   * 让顾客离开（满意或愤怒），同时统计当日已处理顾客数
   * @param {object} customer
   * @param {boolean} happy
   */
  function dismissCustomer(customer, happy) {
    customer.setState(happy ? CustomerState.LEAVING_HAPPY : CustomerState.LEAVING_ANGRY);
    const exit = happy ? EXIT_POSITION : ANGRY_EXIT;
    customer.walkTo(exit.x, exit.z, 2.0);
    state.dayCustomersServed++; // 无论满意与否都算"已处理"
  }

  /**
   * 每帧更新：生成新顾客、更新耐心、清理离开的顾客
   * @param {number} dt - 秒
   */
  function update(dt) {
    // 生成新顾客
    if (spawnCounter < getDayTotal() && performance.now() >= nextSpawnTime) {
      spawnNext();
    }

    // 更新每位顾客
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      c.update(dt);

      // 排队 / 等餐：耐心递减
      if (c.getState() === CustomerState.QUEUING || c.getState() === CustomerState.ORDERED) {
        const patienceDuration = c.order.patienceDuration *
          (1 + (state.upgradeDecorationsPatienceBonus || 0));
        const elapsed = performance.now() - c.order.createdAt;
        const p = clamp(1 - elapsed / patienceDuration, 0, 1);
        c.order.patience = p;
        c.setPatience(p);

        // 耐心耗尽：愤怒离开
        if (p <= 0) {
          onToast && onToast(`${c.name} 等太久离开了！`, 'danger');
          c.order.status = 'expired';
          state.combo = 0;
          dismissCustomer(c, false);
          // 从订单列表移除
          const oIdx = state.orders.findIndex((o) => o.id === c.order.id);
          if (oIdx >= 0) state.orders.splice(oIdx, 1);
        }
      }

      // 已离开且走出场景：销毁
      if ((c.getState() === CustomerState.LEAVING_HAPPY ||
           c.getState() === CustomerState.LEAVING_ANGRY) &&
          c.hasArrived() &&
          Math.hypot(c.group.position.x - (c.getState() === CustomerState.LEAVING_HAPPY ? EXIT_POSITION.x : ANGRY_EXIT.x),
                     c.group.position.z - (c.getState() === CustomerState.LEAVING_HAPPY ? EXIT_POSITION.z : ANGRY_EXIT.z)) < 0.5) {
        // 从状态移除
        const sIdx = state.customers.findIndex((cu) => cu.id === c.id);
        if (sIdx >= 0) state.customers.splice(sIdx, 1);
        c.dispose();
        customers.splice(i, 1);
      }
    }
  }

  /**
   * 当日是否所有顾客都已处理完（生成完毕 + 队列清空）
   * @returns {boolean}
   */
  function isDayComplete() {
    return spawnCounter >= getDayTotal() && customers.length === 0;
  }

  /** 获取当日总顾客数 */
  function getTotal() { return getDayTotal(); }

  /** 获取所有顾客控制器 */
  function getCustomers() { return customers; }

  /**
   * 通过点击位置拾取顾客
   * @param {THREE.Raycaster} raycaster
   * @returns {object|null}
   */
  function pickCustomer(raycaster) {
    const meshes = customers
      .filter((c) => c.getState() === CustomerState.QUEUING)
      .map((c) => c.group);
    if (meshes.length === 0) return null;
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    // 找到对应的 customer
    let target = hits[0].object;
    while (target && !target.userData.isCustomer) target = target.parent;
    if (!target) return null;
    return customers.find((c) => c.group === target);
  }

  /** 销毁所有顾客 */
  function dispose() {
    customers.forEach((c) => c.dispose());
    customers.length = 0;
  }

  return {
    startDay,
    update,
    takeOrder,
    dismissCustomer,
    getFirstQueuingCustomer,
    isDayComplete,
    getTotal,
    getCustomers,
    pickCustomer,
    dispose
  };
}

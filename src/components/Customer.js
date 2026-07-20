/**
 * @file Customer.js
 * @description 3D 顾客实体：低多边形角色 + 状态机（排队/等待/满意/愤怒）。
 *  提供 mesh、耐心更新、状态切换与简单动画。
 */

import * as THREE from 'three';
import { makeBox, makeSphere, makeCylinder, THEME_COLORS, pick } from '../utils/helpers.js';

/** 顾客状态枚举 */
export const CustomerState = {
  QUEUING: 'queuing',     // 排队等点单
  ORDERED: 'ordered',     // 已下单，等餐
  EATING: 'eating',       // 用餐中
  LEAVING_HAPPY: 'leaving_happy',
  LEAVING_ANGRY: 'leaving_angry'
};

/**
 * 创建一个 3D 顾客
 * @param {object} opts
 * @param {string} opts.id - 顾客 ID
 * @param {string} opts.name - 名字
 * @param {object} opts.order - 关联订单
 * @param {number} opts.queueIndex - 排队序号
 * @returns {object} 顾客控制器
 */
export function createCustomer({ id, name, order, queueIndex }) {
  const group = new THREE.Group();
  group.userData.isCustomer = true;
  group.userData.customerId = id;

  const skinColor = pick([0xffcc80, 0xffab91, 0xa1887f, 0x8d6e63, 0xffd54f]);
  const shirtColor = pick(THEME_COLORS.customer);
  const pantsColor = pick([0x37474f, 0x5d4037, 0x616161, 0x455a64]);
  const hairColor = pick([0x3e2723, 0x4e342e, 0x212121, 0x6d4c41, 0xffca28]);

  // 身体（衬衫）
  const body = makeBox(0.5, 0.7, 0.3, shirtColor);
  body.position.set(0, 0.95, 0);
  group.add(body);

  // 头
  const head = makeSphere(0.22, 8, skinColor);
  head.position.set(0, 1.5, 0);
  group.add(head);

  // 头发
  const hair = makeSphere(0.23, 8, hairColor);
  hair.position.set(0, 1.55, -0.05);
  hair.scale.y = 0.5;
  group.add(hair);

  // 眼睛（两个小黑球）
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5 });
  for (const dx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeMat);
    eye.position.set(dx, 1.5, 0.19);
    group.add(eye);
  }

  // 手臂
  for (const dx of [-0.32, 0.32]) {
    const arm = makeBox(0.12, 0.55, 0.12, shirtColor);
    arm.position.set(dx, 0.95, 0);
    group.add(arm);
  }

  // 腿
  for (const dx of [-0.13, 0.13]) {
    const leg = makeBox(0.16, 0.55, 0.16, pantsColor);
    leg.position.set(dx, 0.3, 0);
    group.add(leg);
  }

  // 耐心条（悬浮在头顶，BillBoard）
  const patienceBarGroup = new THREE.Group();
  const barBg = makeBox(0.6, 0.08, 0.02, 0x424242, { castShadow: false, flat: false });
  patienceBarGroup.add(barBg);
  const barFill = makeBox(0.58, 0.06, 0.03, 0x66bb6a, { castShadow: false, flat: false });
  barFill.position.set(0, 0, 0.02);
  barFill.geometry.translate(0.29, 0, 0); // 让 fill 从左侧开始
  patienceBarGroup.add(barFill);
  patienceBarGroup.position.set(0, 1.95, 0);
  group.add(patienceBarGroup);
  group.userData.patienceBar = barFill;
  group.userData.patienceGroup = patienceBarGroup;

  // 订单提示气泡（接单后显示一个小汉堡图标）
  const bubble = makeBox(0.3, 0.3, 0.05, 0xffffff, { castShadow: false, flat: false });
  bubble.position.set(0.35, 1.85, 0);
  bubble.visible = false;
  group.add(bubble);
  group.userData.bubble = bubble;

  // 排队位置（由外部设置）
  let state = CustomerState.QUEUING;
  let patience = 1.0;
  let walkTarget = null;
  let walkSpeed = 1.5;
  let bobPhase = Math.random() * Math.PI * 2;

  /** 设置顾客位置 */
  function setPosition(x, z) {
    group.position.set(x, 0, z);
  }

  /** 让顾客朝向某个目标点 */
  function lookAt(x, z) {
    const angle = Math.atan2(x - group.position.x, z - group.position.z);
    group.rotation.y = angle;
  }

  /**
   * 设置状态
   * @param {string} newState
   */
  function setState(newState) {
    state = newState;
    if (newState === CustomerState.ORDERED) {
      bubble.visible = true;
    } else if (newState === CustomerState.EATING ||
               newState === CustomerState.LEAVING_HAPPY ||
               newState === CustomerState.LEAVING_ANGRY) {
      bubble.visible = false;
    }
  }

  /**
   * 更新耐心条
   * @param {number} p 0-1
   */
  function setPatience(p) {
    patience = p;
    const fill = group.userData.patienceBar;
    fill.scale.x = Math.max(0.001, p);
    const color = p > 0.6 ? 0x66bb6a : p > 0.3 ? 0xffca28 : 0xef5350;
    fill.material.color.setHex(color);
    // 仅在排队/等餐状态显示耐心条
    const show = (state === CustomerState.QUEUING || state === CustomerState.ORDERED) && p < 0.99;
    group.userData.patienceGroup.visible = show;
  }

  /** 每帧更新动画 */
  function update(dt) {
    // 行走
    if (walkTarget) {
      const dx = walkTarget.x - group.position.x;
      const dz = walkTarget.z - group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const step = Math.min(dist, walkSpeed * dt);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
        lookAt(walkTarget.x, walkTarget.z);
        // 走路上下颠簸
        bobPhase += dt * 8;
        group.position.y = Math.abs(Math.sin(bobPhase)) * 0.05;
      } else {
        group.position.y = 0;
        walkTarget = null;
      }
    } else {
      // 待机呼吸动画
      if (state === CustomerState.QUEUING || state === CustomerState.ORDERED) {
        bobPhase += dt * 2;
        group.position.y = Math.sin(bobPhase) * 0.02;
        // 不耐烦：跺脚
        if (patience < 0.3 && state === CustomerState.QUEUING) {
          const stomp = Math.abs(Math.sin(bobPhase * 4)) * 0.06;
          group.position.y = stomp;
        }
      }
    }

    // 订单气泡始终面向相机
    if (bubble.visible) {
      bubble.lookAt(group.position.x, bubble.position.y, group.position.z + 10);
    }

    // 耐心条面向相机
    group.userData.patienceGroup.lookAt(
      group.userData.patienceGroup.position.x + 0,
      group.userData.patienceGroup.position.y,
      group.userData.patienceGroup.position.z + 10
    );
  }

  /** 设置行走目标 */
  function walkTo(x, z, speed = 1.5) {
    walkTarget = new THREE.Vector3(x, 0, z);
    walkSpeed = speed;
  }

  /** 是否到达目标 */
  function hasArrived() {
    return walkTarget === null;
  }

  /** 销毁 */
  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (group.parent) group.parent.remove(group);
  }

  return {
    id,
    name,
    order,
    group,
    setState,
    setPatience,
    setPosition,
    lookAt,
    walkTo,
    hasArrived,
    update,
    dispose,
    getState: () => state,
    getPatience: () => patience,
    getStateName: () => state
  };
}

/**
 * @file Grill.js
 * @description 烧烤台逻辑与 3D 表示。
 *  - 维护烤架上的肉饼列表与状态（生 -> 翻面 -> 熟 -> 焦）
 *  - 维护保温区的肉饼列表
 *  - 每帧推进烹饪计时，更新肉饼颜色
 *  - 提供交互接口：putRawPatty / flipPatty / moveToWarmer / takeFromWarmer
 */

import * as THREE from 'three';
import {
  makeCylinder, DONENESS, DONENESS_COLOR, clamp
} from '../utils/helpers.js';

/** 烤位与保温位数量上限 */
const MAX_GRILL_SLOTS = 4;
const MAX_WARMER_SLOTS = 4;

/**
 * 创建烧烤台控制器
 * @param {object} opts
 * @param {THREE.Group} opts.stationGroup - Restaurant.js 中的烧烤台 Group（含 grillSlots / warmerSlots / grillGlow）
 * @param {object} opts.upgradeEffects - 升级效果
 * @param {(msg:string, type?:string)=>void} opts.onToast - 提示回调
 * @returns {object} 烧烤台控制器
 */
export function createGrill({ stationGroup, upgradeEffects, onToast }) {
  const grillSlots = stationGroup.userData.grillSlots;
  const warmerSlots = stationGroup.userData.warmerSlots;
  const grillGlow = stationGroup.userData.grillGlow;

  /** 烤架肉饼数组：{ id, mesh, slot, cookedTime, flipped, flippedAt, status, createdAt } */
  const patties = [];
  /** 保温区肉饼数组：{ id, mesh, slot, cookedTime, doneness, warmthSec, warmthMax } */
  const warmer = [];

  let pattyIdCounter = 0;

  /** 是否还有空烤位 */
  function hasFreeGrillSlot() {
    return patties.length < MAX_GRILL_SLOTS;
  }

  /** 是否还有空保温位 */
  function hasFreeWarmerSlot() {
    return warmer.length < MAX_WARMER_SLOTS;
  }

  /**
   * 放一个生肉饼到烤架上
   * @returns {object|null} 创建的肉饼对象
   */
  function putRawPatty() {
    if (!hasFreeGrillSlot()) {
      onToast && onToast('烤架已满！', 'danger');
      return null;
    }
    const slot = patties.length;
    const pos = grillSlots[slot];

    const mesh = makeCylinder(0.32, 0.32, 0.12, 12, DONENESS_COLOR.raw, { flat: false });
    mesh.position.copy(pos);
    mesh.position.y = 1.62; // 略高于烤架
    stationGroup.add(mesh);

    const patty = {
      id: 'patty_' + (++pattyIdCounter),
      mesh,
      slot,
      cookedTime: 0,        // 已烹饪总秒数
      sideACooked: 0,       // A 面烹饪秒数
      sideBCooked: 0,       // B 面烹饪秒数
      flipped: false,
      flippedAt: null,
      status: 'cooking',    // 'cooking' | 'ready' | 'burnt'
      createdAt: performance.now()
    };
    patties.push(patty);
    onToast && onToast('生肉饼已上烤架', 'success');
    return patty;
  }

  /**
   * 翻面指定肉饼
   * @param {object} patty
   * @returns {boolean}
   */
  function flipPatty(patty) {
    if (!patty || patty.flipped) return false;
    patty.flipped = true;
    patty.flippedAt = performance.now();
    // 翻面动画：略微弹起
    patty.mesh.position.y = 1.75;
    setTimeout(() => { if (patty.mesh) patty.mesh.position.y = 1.62; }, 200);
    onToast && onToast('已翻面！', 'success');
    return true;
  }

  /**
   * 把烤架上的肉饼移到保温区
   * @param {object} patty
   * @returns {boolean}
   */
  function moveToWarmer(patty) {
    if (!patty) return false;
    if (!hasFreeWarmerSlot()) {
      onToast && onToast('保温区已满！', 'danger');
      return false;
    }
    // 从烤架移除
    const idx = patties.indexOf(patty);
    if (idx < 0) return false;
    patties.splice(idx, 1);
    // 重新计算烤位（让后面的肉饼自动往前移）
    patties.forEach((p, i) => {
      p.slot = i;
      p.mesh.position.copy(grillSlots[i]);
      p.mesh.position.y = 1.62;
    });

    // 加到保温区
    const warmerSlot = warmer.length;
    const pos = warmerSlots[warmerSlot];
    patty.mesh.position.copy(pos);
    patty.mesh.position.y = 1.66;

    const doneness = computeDoneness(patty.cookedTime, patty.flipped);
    const warmthMax = 20 + (upgradeEffects.warmerBonusSec || 0);
    patty.warmerSlot = warmerSlot;
    patty.warmerSec = 0;
    patty.warmerMax = warmthMax;
    patty.doneness = doneness;
    warmer.push(patty);
    onToast && onToast('已放入保温区', 'success');
    return true;
  }

  /**
   * 从保温区取一个肉饼（用于组装）
   * @param {number} [index] - 指定索引，默认取最近的一个
   * @returns {object|null}
   */
  function takeFromWarmer(index = -1) {
    if (warmer.length === 0) {
      onToast && onToast('保温区无肉饼', 'danger');
      return null;
    }
    let patty;
    if (index >= 0 && index < warmer.length) {
      patty = warmer.splice(index, 1)[0];
    } else {
      patty = warmer.shift();
    }
    // 重新整理保温区
    warmer.forEach((p, i) => {
      p.warmerSlot = i;
      p.mesh.position.copy(warmerSlots[i]);
      p.mesh.position.y = 1.66;
    });
    // 从场景移除 mesh（肉饼将作为汉堡的一部分重新创建）
    stationGroup.remove(patty.mesh);
    patty.mesh.geometry.dispose();
    patty.mesh.material.dispose();
    patty.mesh = null;
    return patty;
  }

  /**
   * 获取所有烤架肉饼
   * @returns {Array}
   */
  function getPatties() { return patties; }

  /**
   * 获取所有保温区肉饼
   * @returns {Array}
   */
  function getWarmerPatties() { return warmer; }

  /**
   * 每帧更新烹饪状态
   * @param {number} dt - 秒
   */
  function update(dt) {
    // 烤架发光强度（随是否在烤调节）
    const grilling = patties.length > 0;
    if (grillGlow) {
      const target = grilling ? 0.6 : 0.0;
      grillGlow.material.opacity += (target - grillGlow.material.opacity) * Math.min(1, dt * 4);
    }

    // 更新每个肉饼
    for (let i = patties.length - 1; i >= 0; i--) {
      const p = patties[i];
      if (p.status === 'burnt') continue;
      p.cookedTime += dt;
      if (!p.flipped) {
        p.sideACooked += dt;
        // 烤到一半提示翻面（仅 A 面）
        if (p.sideACooked > 6 && !p.flipped) {
          // 标记需要翻面
          p.needFlip = true;
        }
      } else {
        p.sideBCooked += dt;
      }

      // 计算当前熟度并更新颜色
      const doneness = computeDoneness(p.cookedTime, p.flipped);
      const color = DONENESS_COLOR[doneness] || DONENESS_COLOR.raw;
      p.mesh.material.color.setHex(color);
      // 烤架上下沉一点表示熟透
      p.mesh.position.y = 1.62 - Math.min(0.05, p.cookedTime * 0.002);

      // 烧焦判定
      if (p.cookedTime > 32) {
        p.status = 'burnt';
        p.mesh.material.color.setHex(DONENESS_COLOR.burnt);
        onToast && onToast('有肉饼烧焦了！', 'danger');
      }
    }

    // 更新保温区肉饼（逐渐变冷）
    for (let i = warmer.length - 1; i >= 0; i--) {
      const p = warmer[i];
      p.warmerSec += dt;
      // 超过保温时间，肉饼变冷并丢弃
      if (p.warmerSec > p.warmerMax) {
        onToast && onToast('一块肉饼凉了，已丢弃', 'danger');
        if (p.mesh) {
          stationGroup.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
        }
        warmer.splice(i, 1);
        // 重新整理
        warmer.forEach((pp, j) => {
          pp.warmerSlot = j;
          pp.mesh.position.copy(warmerSlots[j]);
          pp.mesh.position.y = 1.66;
        });
      }
    }
  }

  /**
   * 获取烤架可用槽位数
   * @returns {number}
   */
  function getGrillCapacity() { return MAX_GRILL_SLOTS; }

  /**
   * 获取保温区可用槽位数
   * @returns {number}
   */
  function getWarmerCapacity() { return MAX_WARMER_SLOTS; }

  /** 销毁所有肉饼与场景对象 */
  function dispose() {
    patties.forEach((p) => {
      if (p.mesh) {
        stationGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
    });
    warmer.forEach((p) => {
      if (p.mesh) {
        stationGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
    });
    patties.length = 0;
    warmer.length = 0;
  }

  return {
    putRawPatty,
    flipPatty,
    moveToWarmer,
    takeFromWarmer,
    getPatties,
    getWarmerPatties,
    hasFreeGrillSlot,
    hasFreeWarmerSlot,
    getGrillCapacity,
    getWarmerCapacity,
    update,
    dispose
  };
}

/**
 * 根据烹饪时间计算肉饼熟度
 * @param {number} cookedTime - 总烹饪秒数
 * @param {boolean} flipped - 是否已翻面
 * @returns {string} DONENESS 中的值
 */
function computeDoneness(cookedTime, flipped) {
  if (!flipped) {
    // 未翻面：仅一面烤，颜色仍是生色
    if (cookedTime < 4) return DONENESS.RAW;
    return DONENESS.RARE;
  }
  if (cookedTime < 6) return DONENESS.RAW;
  if (cookedTime < 13) return DONENESS.RARE;
  if (cookedTime < 19) return DONENESS.MEDIUM;
  if (cookedTime < 32) return DONENESS.WELLDONE;
  return DONENESS.BURNT;
}

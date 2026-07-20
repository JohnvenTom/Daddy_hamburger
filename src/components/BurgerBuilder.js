/**
 * @file BurgerBuilder.js
 * @description 组装台逻辑：在 3D 场景中分层堆叠配料构建汉堡。
 *  - 维护当前已放置的配料列表
 *  - 每加一层，根据配料高度堆叠到汉堡上
 *  - 计算配料放置准确性（中心偏移）
 *  - 提供交付与丢弃接口
 */

import * as THREE from 'three';
import {
  INGREDIENTS, THEME_COLORS, makeCylinder, makeBox, makeSphere, clamp
} from '../utils/helpers.js';

/** 配料 ID -> 配料定义查找表 */
const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

/**
 * 创建汉堡构建器
 * @param {object} opts
 * @param {THREE.Vector3} opts.anchor - 汉堡放置中心点（工作台台面位置）
 * @param {THREE.Group} opts.stationGroup - 组装台 Group（用于挂载汉堡 mesh）
 * @param {(msg:string, type?:string)=>void} [opts.onToast] - 提示回调
 * @returns {object} 汉堡构建器控制器
 */
export function createBurgerBuilder({ anchor, stationGroup, onToast }) {
  const burgerGroup = new THREE.Group();
  burgerGroup.position.copy(anchor);
  stationGroup.add(burgerGroup);

  /** 已放置的配料列表：{ id, def, mesh, accuracy, height } */
  const parts = [];
  let currentHeight = 0;

  /**
   * 创建配料的 3D mesh
   * @param {string} ingredientId
   * @param {string} [pattyDoneness] - 若是肉饼，使用实际熟度颜色
   * @returns {THREE.Mesh}
   */
  function createIngredientMesh(ingredientId, pattyDoneness) {
    const def = INGREDIENT_MAP[ingredientId];
    if (!def) throw new Error('未知配料: ' + ingredientId);

    let color = def.color;
    // 肉饼颜色由熟度决定
    if (ingredientId === 'patty' && pattyDoneness) {
      const donenessColors = {
        raw: THEME_COLORS.pattyRaw,
        rare: 0xec407a,
        medium: THEME_COLORS.pattyMedium,
        welldone: THEME_COLORS.pattyWellDone,
        burnt: THEME_COLORS.pattyBurnt
      };
      color = donenessColors[pattyDoneness] || THEME_COLORS.pattyWellDone;
    }

    let mesh;
    switch (ingredientId) {
      case 'bun_bottom':
        // 底面包：扁平圆柱
        mesh = makeCylinder(0.55, 0.5, def.height, 16, color, { flat: false });
        break;
      case 'bun_top':
        // 顶面包：上半球
        mesh = makeSphere(0.55, 16, color, { flat: false });
        mesh.scale.y = 0.7;
        // 加几粒芝麻
        for (let i = 0; i < 6; i++) {
          const seed = makeSphere(0.03, 6, 0xfafafa, { castShadow: false, flat: false });
          const angle = (i / 6) * Math.PI * 2;
          seed.position.set(Math.cos(angle) * 0.3, 0.25, Math.sin(angle) * 0.3);
          mesh.add(seed);
        }
        break;
      case 'patty':
        // 肉饼：稍扁圆柱
        mesh = makeCylinder(0.5, 0.5, def.height, 14, color, { flat: false });
        break;
      case 'cheese':
        // 奶酪：方形薄片
        mesh = makeBox(0.95, def.height, 0.95, color, { flat: false });
        // 让四角略微下垂
        mesh.geometry.translate(0, 0, 0);
        break;
      case 'lettuce':
        // 生菜：褶皱的扁圆环
        mesh = makeCylinder(0.6, 0.55, def.height, 12, color);
        break;
      case 'tomato':
        // 番茄：红色扁圆片
        mesh = makeCylinder(0.45, 0.45, def.height, 12, color, { flat: false });
        break;
      case 'onion':
        // 洋葱：白色圆环
        mesh = makeCylinder(0.5, 0.5, def.height, 10, color, { flat: false });
        break;
      case 'sauce':
        // 酱料：扁平圆盘
        mesh = makeCylinder(0.5, 0.5, def.height, 12, color, { castShadow: false, flat: false });
        mesh.material.transparent = true;
        mesh.material.opacity = 0.85;
        break;
      default:
        mesh = makeCylinder(0.4, 0.4, def.height, 10, color);
    }
    return mesh;
  }

  /**
   * 添加一层配料
   * @param {string} ingredientId
   * @param {object} [opts]
   * @param {number} [opts.offsetX=0] - 玩家放置偏移（用于计算准确性）
   * @param {number} [opts.offsetZ=0]
   * @param {string} [opts.pattyDoneness] - 肉饼熟度
   * @returns {object} 已放置的配料对象
   */
  function addIngredient(ingredientId, opts = {}) {
    const { offsetX = 0, offsetZ = 0, pattyDoneness } = opts;
    const def = INGREDIENT_MAP[ingredientId];
    if (!def) {
      onToast && onToast('未知配料: ' + ingredientId, 'danger');
      return null;
    }

    const mesh = createIngredientMesh(ingredientId, pattyDoneness);
    // 计算 y 位置（基于已堆叠高度）
    const y = currentHeight + def.height / 2;
    mesh.position.set(offsetX, y, offsetZ);
    burgerGroup.add(mesh);

    // 计算放置准确性（中心偏移越小越好）
    const offsetDist = Math.hypot(offsetX, offsetZ);
    const accuracy = clamp(1 - offsetDist / 0.4, 0, 1);

    const part = {
      id: ingredientId,
      def,
      mesh,
      accuracy,
      offsetX,
      offsetZ,
      height: def.height
    };
    parts.push(part);
    currentHeight += def.height;

    return part;
  }

  /**
   * 添加肉饼（来自保温区）
   * @param {string} doneness - 熟度
   * @param {number} [offsetX=0]
   * @param {number} [offsetZ=0]
   * @returns {object}
   */
  function addPatty(doneness, offsetX = 0, offsetZ = 0) {
    const part = addIngredient('patty', { pattyDoneness: doneness, offsetX, offsetZ });
    if (part) part.doneness = doneness;
    return part;
  }

  /** 获取当前配料列表（用于评分） */
  function getParts() {
    return parts.map((p) => ({
      id: p.id,
      accuracy: p.accuracy,
      doneness: p.doneness || null
    }));
  }

  /** 获取当前汉堡高度 */
  function getCurrentHeight() { return currentHeight; }

  /** 当前是否为空 */
  function isEmpty() { return parts.length === 0; }

  /**
   * 清空汉堡（交付或丢弃时调用）
   */
  function clear() {
    parts.forEach((p) => {
      burgerGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      // 递归清理子 mesh（如芝麻）
      p.mesh.traverse((child) => {
        if (child !== p.mesh && child.geometry) child.geometry.dispose();
        if (child !== p.mesh && child.material) child.material.dispose();
      });
    });
    parts.length = 0;
    currentHeight = 0;
  }

  /**
   * 弹跳动画（交付成功时调用）
   * @returns {Promise<void>}
   */
  function popAnimation() {
    return new Promise((resolve) => {
      const startY = burgerGroup.position.y;
      const t0 = performance.now();
      const dur = 600;
      function step() {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const e = Math.sin(k * Math.PI);
        burgerGroup.position.y = startY + e * 0.5;
        if (k < 1) requestAnimationFrame(step);
        else {
          burgerGroup.position.y = startY;
          resolve();
        }
      }
      step();
    });
  }

  /** 销毁 */
  function dispose() {
    clear();
    if (burgerGroup.parent) burgerGroup.parent.remove(burgerGroup);
  }

  return {
    addIngredient,
    addPatty,
    getParts,
    getCurrentHeight,
    isEmpty,
    clear,
    popAnimation,
    dispose
  };
}

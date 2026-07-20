/**
 * @file helpers.js
 * @description 通用工具函数：配色、随机数、计时器、Three.js 几何工厂。
 */

import * as THREE from 'three';

/** 主题配色（暖橙系卡通） */
export const THEME_COLORS = {
  floor: 0x8d6e63,
  floorAccent: 0x6d4c41,
  wall: 0xffab91,
  wallTrim: 0xd84315,
  counter: 0xbcaaa4,
  counterTop: 0xefebe9,
  grill: 0x212121,
  grillTop: 0x424242,
  grillGlow: 0xff5722,
  bunBottom: 0xd4a157,
  bunTop: 0xe0b068,
  pattyRaw: 0xc2185b,
  pattyMedium: 0xffca28,
  pattyWellDone: 0x6d4c41,
  pattyBurnt: 0x3e2723,
  cheese: 0xffc107,
  lettuce: 0x66bb6a,
  tomato: 0xef5350,
  onion: 0xf8bbd0,
  sauce: 0xe53935,
  customer: [0xec407a, 0x42a5f5, 0x66bb6a, 0xab47bc, 0xffa726, 0x26c6da],
  decoration: 0xffca28
};

/** 肉饼熟度阶段常量 */
export const DONENESS = {
  RAW: 'raw',
  RARE: 'rare',       // 三分熟（粉红）
  MEDIUM: 'medium',   // 五分熟（金黄）
  WELLDONE: 'welldone', // 全熟（深棕）
  BURNT: 'burnt'      // 焦黑
};

/** 熟度对应颜色 */
export const DONENESS_COLOR = {
  raw: 0xc2185b,
  rare: 0xec407a,
  medium: 0xffca28,
  welldone: 0x6d4c41,
  burnt: 0x3e2723
};

/** 熟度对应中文标签 */
export const DONENESS_LABEL = {
  rare: '三分熟',
  medium: '五分熟',
  welldone: '全熟'
};

/** 所有可用配料 */
export const INGREDIENTS = [
  { id: 'bun_bottom', name: '底面包', color: THEME_COLORS.bunBottom, height: 0.3 },
  { id: 'patty',      name: '肉饼',   color: THEME_COLORS.pattyWellDone, height: 0.35 },
  { id: 'cheese',     name: '奶酪',   color: THEME_COLORS.cheese, height: 0.08 },
  { id: 'lettuce',    name: '生菜',   color: THEME_COLORS.lettuce, height: 0.12 },
  { id: 'tomato',     name: '番茄',   color: THEME_COLORS.tomato, height: 0.1 },
  { id: 'onion',      name: '洋葱',   color: THEME_COLORS.onion, height: 0.08 },
  { id: 'sauce',      name: '酱料',   color: THEME_COLORS.sauce, height: 0.05 },
  { id: 'bun_top',    name: '顶面包', color: THEME_COLORS.bunTop, height: 0.4 }
];

/**
 * 在 [min, max) 范围内生成随机浮点数
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * 在 [min, max] 范围内生成随机整数
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(min, max) {
  return Math.floor(randFloat(min, max + 1));
}

/**
 * 从数组中随机选取一个元素
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 钳制数值到 [min, max] 区间
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 线性插值
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 创建一个简单的低多边形盒子 mesh
 * @param {number} w 宽
 * @param {number} h 高
 * @param {number} d 深
 * @param {number} color 颜色 hex
 * @param {object} [opts] { castShadow=true, receiveShadow=true, flat=true }
 * @returns {THREE.Mesh}
 */
export function makeBox(w, h, d, color, opts = {}) {
  const { castShadow = true, receiveShadow = true, flat = true } = opts;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: flat
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * 创建一个低多边形圆柱 mesh
 * @param {number} rTop 顶部半径
 * @param {number} rBot 底部半径
 * @param {number} h 高度
 * @param {number} segments 分段数（低多边形用 6~12）
 * @param {number} color 颜色 hex
 * @param {object} [opts]
 * @returns {THREE.Mesh}
 */
export function makeCylinder(rTop, rBot, h, segments, color, opts = {}) {
  const { castShadow = true, receiveShadow = true, flat = true } = opts;
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segments);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.0,
    flatShading: flat
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * 创建一个低多边形球体 mesh
 * @param {number} r 半径
 * @param {number} segments 分段
 * @param {number} color 颜色
 * @param {object} [opts]
 * @returns {THREE.Mesh}
 */
export function makeSphere(r, segments, color, opts = {}) {
  const { castShadow = true, receiveShadow = true, flat = true } = opts;
  const geo = new THREE.SphereGeometry(r, segments, Math.max(4, Math.floor(segments / 2)));
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.0,
    flatShading: flat
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * 在场景中以 (x, y, z) 为底中心放置一个 mesh
 * @param {THREE.Mesh} mesh
 * @param {number} x
 * @param {number} y 底部 y
 * @param {number} z
 * @returns {THREE.Mesh}
 */
export function placeAtBottom(mesh, x, y, z) {
  mesh.position.set(x, y + mesh.geometry.parameters.height / 2, z);
  return mesh;
}

/**
 * 简单延时器
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 格式化金额
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  return '$' + Math.floor(n);
}

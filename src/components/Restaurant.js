/**
 * @file Restaurant.js
 * @description 3D 餐厅场景构建：地板、墙面、三个工作台、用餐区、装饰物。
 *  全部使用 Three.js 程序化几何体（低多边形风格）生成，无需外部模型资源。
 */

import * as THREE from 'three';
import {
  THEME_COLORS, makeBox, makeCylinder, makeSphere
} from '../utils/helpers.js';

/**
 * 构建完整 3D 餐厅场景
 * @param {THREE.Scene} scene
 * @returns {{group: THREE.Group, stations: object, dispose: ()=>void}}
 */
export function buildRestaurant(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // 三个工作台的世界坐标，供相机/交互使用
  const stations = {
    order: { pos: new THREE.Vector3(-3.5, 0, -1.0), name: '点单台' },
    grill: { pos: new THREE.Vector3(0, 0, 0.0),      name: '烧烤台' },
    build: { pos: new THREE.Vector3(3.5, 0, -1.0),  name: '组装台' }
  };

  buildFloor(group);
  buildWalls(group);
  buildOrderStation(group, stations.order.pos);
  buildGrillStation(group, stations.grill.pos);
  buildBuildStation(group, stations.build.pos);
  buildDiningArea(group);
  buildDecorations(group);

  /** 释放场景资源 */
  function dispose() {
    scene.remove(group);
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  return { group, stations, dispose };
}

/**
 * 构建地板：棋盘格地砖
 * @param {THREE.Group} group
 */
function buildFloor(group) {
  // 主地板
  const floor = makeBox(20, 0.2, 16, THEME_COLORS.floor, { castShadow: false, receiveShadow: true });
  floor.position.set(0, -0.1, 0);
  group.add(floor);

  // 棋盘格装饰（用细薄方块叠加）
  for (let i = -4; i <= 4; i++) {
    for (let j = -3; j <= 3; j++) {
      if ((i + j) % 2 !== 0) continue;
      const tile = makeBox(1.6, 0.02, 1.6, THEME_COLORS.floorAccent,
        { castShadow: false, receiveShadow: true, flat: true });
      tile.position.set(i * 1.8, 0.01, j * 1.8);
      group.add(tile);
    }
  }
}

/**
 * 构建墙面：后墙 + 侧墙
 * @param {THREE.Group} group
 */
function buildWalls(group) {
  // 后墙
  const backWall = makeBox(20, 4, 0.3, THEME_COLORS.wall, { castShadow: false, receiveShadow: true });
  backWall.position.set(0, 2, -8);
  group.add(backWall);

  // 后墙踢脚线
  const backTrim = makeBox(20, 0.4, 0.35, THEME_COLORS.wallTrim, { castShadow: false });
  backTrim.position.set(0, 0.2, -7.95);
  group.add(backTrim);

  // 左墙
  const leftWall = makeBox(0.3, 4, 16, THEME_COLORS.wall, { castShadow: false, receiveShadow: true });
  leftWall.position.set(-10, 2, 0);
  group.add(leftWall);

  // 右墙
  const rightWall = makeBox(0.3, 4, 16, THEME_COLORS.wall, { castShadow: false, receiveShadow: true });
  rightWall.position.set(10, 2, 0);
  group.add(rightWall);

  // 前墙（留出入口）
  const frontWallL = makeBox(7, 4, 0.3, THEME_COLORS.wall, { castShadow: false });
  frontWallL.position.set(-6.5, 2, 8);
  group.add(frontWallL);
  const frontWallR = makeBox(7, 4, 0.3, THEME_COLORS.wall, { castShadow: false });
  frontWallR.position.set(6.5, 2, 8);
  group.add(frontWallR);

  // 窗户（半透明蓝色板，模拟玻璃）
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x81d4fa, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.3
  });
  for (const x of [-6, 6]) {
    for (const z of [-8, 8]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.1), winMat);
      win.position.set(x * 0.6, 2.4, z);
      if (z === -8) {
        win.position.x = x;
        win.position.z = -7.85;
      } else {
        win.position.x = x > 0 ? 9.85 : -9.85;
        win.position.z = z;
      }
      group.add(win);
    }
  }
}

/**
 * 构建点单台：收银台 + 菜单板
 * @param {THREE.Group} group
 * @param {THREE.Vector3} pos
 */
function buildOrderStation(group, pos) {
  const stationGroup = new THREE.Group();
  stationGroup.position.copy(pos);
  group.add(stationGroup);

  // 柜台主体
  const counter = makeBox(3, 1.1, 1.4, THEME_COLORS.counter);
  counter.position.set(0, 0.55, 0);
  stationGroup.add(counter);

  // 柜台台面（浅色大理石感）
  const top = makeBox(3.2, 0.1, 1.6, THEME_COLORS.counterTop, { flat: false });
  top.position.set(0, 1.15, 0);
  stationGroup.add(top);

  // 收银机
  const register = makeBox(0.5, 0.5, 0.5, 0xec407a);
  register.position.set(-0.8, 1.45, -0.1);
  stationGroup.add(register);

  const registerTop = makeBox(0.45, 0.1, 0.3, 0x37474f, { flat: false });
  registerTop.position.set(-0.8, 1.75, -0.1);
  stationGroup.add(registerTop);

  // 菜单板（背后的立板）
  const menuBoard = makeBox(2.8, 1.6, 0.1, 0x4e342e, { castShadow: false });
  menuBoard.position.set(0, 2.6, -0.8);
  stationGroup.add(menuBoard);

  // 菜单项贴片（彩色小方块代表菜品图）
  const menuColors = [0xffca28, 0xef5350, 0x66bb6a, 0x42a5f5];
  for (let i = 0; i < 4; i++) {
    const item = makeBox(0.55, 0.45, 0.05, menuColors[i], { castShadow: false });
    item.position.set(-1.05 + (i % 2) * 1.2, 2.85 - Math.floor(i / 2) * 0.7, -0.74);
    stationGroup.add(item);
  }

  // 标签
  const label = makeBox(0.6, 0.2, 0.05, THEME_COLORS.wallTrim, { castShadow: false });
  label.position.set(0, 1.4, 0.71);
  stationGroup.add(label);
}

/**
 * 构建烧烤台：工作台 + 烤架 + 保温灯 + 铲子
 * @param {THREE.Group} group
 * @param {THREE.Vector3} pos
 */
function buildGrillStation(group, pos) {
  const stationGroup = new THREE.Group();
  stationGroup.position.copy(pos);
  group.add(stationGroup);

  // 工作台
  const counter = makeBox(4, 1.1, 1.6, THEME_COLORS.counter);
  counter.position.set(0, 0.55, 0);
  stationGroup.add(counter);

  const top = makeBox(4.2, 0.1, 1.8, THEME_COLORS.counterTop, { flat: false });
  top.position.set(0, 1.15, 0);
  stationGroup.add(top);

  // 烤架本体（黑色金属）
  const grillBody = makeBox(2.4, 0.25, 1.0, THEME_COLORS.grill);
  grillBody.position.set(-0.4, 1.32, 0);
  stationGroup.add(grillBody);

  // 烤架顶面（深灰带网格纹理用细线代替）
  const grillTop = makeBox(2.3, 0.05, 0.9, THEME_COLORS.grillTop, { flat: false });
  grillTop.position.set(-0.4, 1.47, 0);
  stationGroup.add(grillTop);

  // 烤架网格（多条细条）
  for (let i = 0; i < 6; i++) {
    const bar = makeBox(2.2, 0.04, 0.06, 0x9e9e9e, { castShadow: false });
    bar.position.set(-0.4, 1.5, -0.35 + i * 0.14);
    stationGroup.add(bar);
  }

  // 烤架下方的热辐射（半透明红色发光板，烹饪时显示）
  const glowGeo = new THREE.PlaneGeometry(2.3, 0.9);
  const glowMat = new THREE.MeshBasicMaterial({
    color: THEME_COLORS.grillGlow, transparent: true, opacity: 0.0
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(-0.4, 1.49, 0);
  stationGroup.add(glow);
  stationGroup.userData.grillGlow = glow;

  // 4 个烤位坐标（在烤架上）
  stationGroup.userData.grillSlots = [
    new THREE.Vector3(-1.3, 1.55, -0.2),
    new THREE.Vector3(-0.7, 1.55, -0.2),
    new THREE.Vector3(-0.1, 1.55, -0.2),
    new THREE.Vector3(0.5, 1.55, -0.2)
  ];

  // 保温区（烤架右侧）
  const warmer = makeBox(1.0, 0.1, 0.9, 0x37474f, { flat: false });
  warmer.position.set(1.4, 1.5, 0);
  stationGroup.add(warmer);

  // 保温灯支架（两个，位于保温区上方）
  for (let i = 0; i < 2; i++) {
    const lampArm = makeBox(0.06, 0.8, 0.06, 0x9e9e9e);
    lampArm.position.set(1.1 + i * 0.6, 2.0, 0);
    stationGroup.add(lampArm);

    const lampHead = makeSphere(0.18, 8, THEME_COLORS.wallTrim, { flat: false });
    lampHead.position.set(1.1 + i * 0.6, 2.5, 0);
    lampHead.material.emissive = new THREE.Color(0xff5722);
    lampHead.material.emissiveIntensity = 0.3;
    stationGroup.add(lampHead);
  }

  // 4 个保温位坐标
  stationGroup.userData.warmerSlots = [
    new THREE.Vector3(1.1, 1.58, -0.2),
    new THREE.Vector3(1.4, 1.58, -0.2),
    new THREE.Vector3(1.7, 1.58, -0.2),
    new THREE.Vector3(2.0, 1.58, -0.2)
  ];

  // 铲子（装饰）
  const spatulaHandle = makeBox(0.05, 0.05, 1.2, 0x5d4037);
  spatulaHandle.position.set(0, 1.25, 1.1);
  spatulaHandle.rotation.x = 0.3;
  stationGroup.add(spatulaHandle);

  const spatulaHead = makeBox(0.4, 0.03, 0.3, 0xb0bec5, { flat: false });
  spatulaHead.position.set(0, 1.18, 0.55);
  stationGroup.add(spatulaHead);
}

/**
 * 构建组装台：工作台 + 配料架 + 包装纸 + 汉堡胚底座
 * @param {THREE.Group} group
 * @param {THREE.Vector3} pos
 */
function buildBuildStation(group, pos) {
  const stationGroup = new THREE.Group();
  stationGroup.position.copy(pos);
  group.add(stationGroup);

  // 工作台
  const counter = makeBox(3, 1.1, 1.4, THEME_COLORS.counter);
  counter.position.set(0, 0.55, 0);
  stationGroup.add(counter);

  const top = makeBox(3.2, 0.1, 1.6, THEME_COLORS.counterTop, { flat: false });
  top.position.set(0, 1.15, 0);
  stationGroup.add(top);

  // 包装纸（白色板放在台面上）
  const wrap = makeBox(1.0, 0.02, 1.0, 0xfafafa, { castShadow: false, flat: false });
  wrap.position.set(0, 1.21, 0.1);
  stationGroup.add(wrap);

  // 汉堡放置点（用于堆叠汉堡的中心坐标）
  stationGroup.userData.burgerAnchor = new THREE.Vector3(0, 1.22, 0.1);

  // 配料架（背后立式架子，3 层）
  const rackFrame = makeBox(2.6, 1.8, 0.1, 0x4e342e, { castShadow: false });
  rackFrame.position.set(0, 2.2, -0.6);
  stationGroup.add(rackFrame);

  // 6 个配料罐子（用彩色小球+圆柱模拟）
  const ingredientColors = [
    THEME_COLORS.lettuce, THEME_COLORS.tomato, THEME_COLORS.cheese,
    THEME_COLORS.onion, THEME_COLORS.sauce, THEME_COLORS.bunTop
  ];
  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const jar = makeCylinder(0.18, 0.18, 0.4, 8, 0xfafafa, { flat: false });
    jar.position.set(-0.9 + col * 0.9, 1.7 + row * 0.5, -0.5);
    stationGroup.add(jar);

    const lid = makeCylinder(0.2, 0.2, 0.06, 8, ingredientColors[i], { flat: false });
    lid.position.set(-0.9 + col * 0.9, 1.93 + row * 0.5, -0.5);
    stationGroup.add(lid);

    // 罐内顶部颜色提示
    const inner = makeSphere(0.16, 8, ingredientColors[i]);
    inner.position.set(-0.9 + col * 0.9, 1.86 + row * 0.5, -0.5);
    inner.scale.y = 0.4;
    stationGroup.add(inner);
  }
}

/**
 * 构建用餐区：餐桌 + 椅子
 * @param {THREE.Group} group
 */
function buildDiningArea(group) {
  // 在餐厅前方放置 3 张桌子和椅子
  for (let i = 0; i < 3; i++) {
    const x = -5 + i * 5;
    const z = 5.5;

    // 桌子
    const tableTop = makeBox(1.8, 0.1, 1.2, THEME_COLORS.counterTop, { flat: false });
    tableTop.position.set(x, 0.85, z);
    group.add(tableTop);

    // 桌腿
    for (const [dx, dz] of [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]]) {
      const leg = makeBox(0.1, 0.85, 0.1, 0x5d4037);
      leg.position.set(x + dx, 0.42, z + dz);
      group.add(leg);
    }

    // 椅子（前后各一把）
    for (const dz of [-0.95, 0.95]) {
      const seat = makeBox(0.7, 0.08, 0.7, 0x8d6e63);
      seat.position.set(x, 0.45, z + dz);
      group.add(seat);

      const back = makeBox(0.7, 0.6, 0.08, 0x8d6e63);
      back.position.set(x, 0.78, z + dz + (dz > 0 ? 0.32 : -0.32));
      group.add(back);
    }
  }
}

/**
 * 构建装饰物：海报、吊灯、植物
 * @param {THREE.Group} group
 */
function buildDecorations(group) {
  // 后墙海报
  for (const x of [-4, 4]) {
    const poster = makeBox(1.4, 1.0, 0.04, 0xffca28, { castShadow: false });
    poster.position.set(x, 2.6, -7.93);
    group.add(poster);

    const posterInner = makeBox(1.2, 0.8, 0.05, 0xec407a, { castShadow: false });
    posterInner.position.set(x, 2.6, -7.91);
    group.add(posterInner);
  }

  // 天花板吊灯（3 盏）
  for (const x of [-3, 0, 3]) {
    const cord = makeBox(0.03, 1.5, 0.03, 0x424242, { castShadow: false });
    cord.position.set(x, 3.4, 1.5);
    group.add(cord);

    const lampShade = makeCylinder(0.3, 0.4, 0.3, 8, 0xff7043, { flat: false });
    lampShade.position.set(x, 2.65, 1.5);
    lampShade.material.emissive = new THREE.Color(0xff7043);
    lampShade.material.emissiveIntensity = 0.4;
    group.add(lampShade);
  }

  // 角落植物
  for (const [x, z] of [[-9, 7], [9, 7]]) {
    const pot = makeCylinder(0.4, 0.3, 0.6, 8, 0x6d4c41);
    pot.position.set(x, 0.3, z);
    group.add(pot);

    const leaves = makeSphere(0.6, 8, 0x66bb6a);
    leaves.position.set(x, 1.0, z);
    leaves.scale.y = 1.3;
    group.add(leaves);
  }

  // 等待区地垫（点单台前方）
  const mat = makeBox(3, 0.02, 2, 0x8d6e63, { castShadow: false });
  mat.position.set(-3.5, 0.02, 2.5);
  group.add(mat);
}

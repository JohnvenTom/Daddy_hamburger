/**
 * @file lights.js
 * @description 餐厅场景的光照设置：环境光 + 暖色半球光 + 主方向光（带阴影） + 几个点光源补光。
 */

import * as THREE from 'three';

/**
 * 在场景中添加完整光照
 * @param {THREE.Scene} scene - 目标场景
 * @returns {{directional: THREE.DirectionalLight, dispose: ()=>void}}
 */
export function setupLights(scene) {
  // 半球光：天空暖橙 / 地面棕色，营造室内氛围
  const hemi = new THREE.HemisphereLight(0xffe0b2, 0x5d4037, 0.65);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  // 环境光：补一点整体亮度，避免阴影过黑
  const ambient = new THREE.AmbientLight(0xfff3e0, 0.25);
  scene.add(ambient);

  // 主方向光：模拟天花板大吊灯，投射阴影
  const directional = new THREE.DirectionalLight(0xfff8e1, 0.9);
  directional.position.set(6, 14, 6);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.left = -15;
  directional.shadow.camera.right = 15;
  directional.shadow.camera.top = 15;
  directional.shadow.camera.bottom = -15;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 50;
  directional.shadow.bias = -0.0005;
  directional.shadow.normalBias = 0.02;
  scene.add(directional);
  scene.add(directional.target);

  // 三个工作台上方的点光源，强化局部照明
  const orderLight = new THREE.PointLight(0xffcc80, 0.4, 8, 2);
  orderLight.position.set(-3.5, 4, -1);
  scene.add(orderLight);

  const grillLight = new THREE.PointLight(0xff7043, 0.5, 8, 2);
  grillLight.position.set(0, 4, 0);
  scene.add(grillLight);

  const buildLight = new THREE.PointLight(0xffcc80, 0.4, 8, 2);
  buildLight.position.set(3.5, 4, -1);
  scene.add(buildLight);

  /** 释放光照资源 */
  function dispose() {
    scene.remove(hemi, ambient, directional, directional.target, orderLight, grillLight, buildLight);
  }

  return { directional, dispose };
}

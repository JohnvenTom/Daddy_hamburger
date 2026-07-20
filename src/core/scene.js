/**
 * @file scene.js
 * @description Three.js 场景、相机、渲染器的初始化与生命周期管理。
 *  - 创建 WebScene 与背景/雾效
 *  - 创建 PerspectiveCamera，提供等距风格视角与三个工作台的相机预设
 *  - 创建 WebGLRenderer，处理像素比、resize 与上下文丢失
 *  - 提供逐帧渲染入口 onTick(dt)
 */

import * as THREE from 'three';

/**
 * 创建并配置 Three.js 场景核心对象
 * @param {HTMLElement} container - 画布挂载的 DOM 容器
 * @returns {{scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer,
 *           onTick: (dt:number)=>void, onResize: ()=>void,
 *           setStationCamera:(station:'order'|'grill'|'build'|'overview', immediate?:boolean)=>void,
 *           dispose: ()=>void}}
 */
export function createSceneCore(container) {
  // === 场景 ===
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffe0b2'); // 暖色背景，营造餐厅氛围
  scene.fog = new THREE.Fog('#ffe0b2', 22, 60);

  // === 相机 ===
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
  // 默认等距视角，俯视整个餐厅
  camera.position.set(12, 12, 12);
  camera.lookAt(0, 1, 0);

  // === 渲染器 ===
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // === 各工作台的相机预设（位置 + 目标点） ===
  const CAMERA_PRESETS = {
    overview: { pos: new THREE.Vector3(12, 12, 12), target: new THREE.Vector3(0, 1, 0) },
    order:    { pos: new THREE.Vector3(-3.5, 5.5, 7.5), target: new THREE.Vector3(-2.5, 1.2, -1.0) },
    grill:    { pos: new THREE.Vector3(0, 6.5, 8.5),  target: new THREE.Vector3(0, 1.0, 0.0) },
    build:    { pos: new THREE.Vector3(3.5, 5.5, 7.5), target: new THREE.Vector3(2.5, 1.2, -1.0) }
  };

  let currentPreset = 'overview';
  let cameraTween = null; // { fromPos, toPos, fromTarget, toTarget, t, duration }

  /**
   * 切换到指定工作台的相机视角
   * @param {string} station - 'order' | 'grill' | 'build' | 'overview'
   * @param {boolean} [immediate=false] - 是否立即跳转（无补间）
   */
  function setStationCamera(station, immediate = false) {
    const preset = CAMERA_PRESETS[station] || CAMERA_PRESETS.overview;
    currentPreset = station;
    if (immediate) {
      camera.position.copy(preset.pos);
      camera.lookAt(preset.target);
      cameraTween = null;
      return;
    }
    cameraTween = {
      fromPos: camera.position.clone(),
      toPos: preset.pos.clone(),
      fromTarget: preset.target.clone(),
      toTarget: preset.target.clone(),
      t: 0,
      duration: 0.6
    };
  }

  /**
   * 逐帧更新：推进相机补间并渲染
   * @param {number} dt - 距上一帧的秒数
   */
  function onTick(dt) {
    if (cameraTween) {
      cameraTween.t += dt / cameraTween.duration;
      const k = Math.min(1, cameraTween.t);
      // 缓动函数：easeInOutCubic
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
      const target = new THREE.Vector3().lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
      camera.lookAt(target);
      if (k >= 1) cameraTween = null;
    }
    renderer.render(scene, camera);
  }

  /** 处理窗口尺寸变化 */
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // 监听 WebGL 上下文丢失
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[Scene] WebGL context lost');
  }, false);

  /** 销毁释放资源 */
  function dispose() {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return {
    scene,
    camera,
    renderer,
    onTick,
    onResize,
    setStationCamera,
    dispose
  };
}

/**
 * @file scene.js
 * @description Three.js 场景、相机、渲染器的初始化与生命周期管理。
 *  - 创建 WebScene 与背景/雾效
 *  - 创建 PerspectiveCamera，提供等距风格视角与三个工作台的相机预设
 *  - 创建 WebGLRenderer，处理像素比、resize 与上下文丢失
 *  - 提供逐帧渲染入口 onTick(dt)
 *  - 鼠标视差：镜头随鼠标移动微微偏移，增强沉浸感
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
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  // 默认等距视角，俯视整个餐厅（拉近后的总览）
  camera.position.set(9, 8, 9);
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
  // 拉近：减小 y（更低视角，更有透视感）、减小 z（更靠近工作台）、target 聚焦在工作台台面
  const CAMERA_PRESETS = {
    overview: { pos: new THREE.Vector3(9, 8, 9),     target: new THREE.Vector3(0, 1.0, 0) },
    order:    { pos: new THREE.Vector3(-2.5, 3.8, 4.5), target: new THREE.Vector3(-3.0, 1.1, -0.5) },
    grill:    { pos: new THREE.Vector3(0, 4.0, 5.0),   target: new THREE.Vector3(0, 1.1, 0.0) },
    build:    { pos: new THREE.Vector3(2.5, 3.8, 4.5), target: new THREE.Vector3(3.0, 1.1, -0.5) }
  };

  let currentPreset = 'overview';

  // 相机基础位置/目标（补间终点 + 视差基准）
  let basePos = camera.position.clone();
  let baseTarget = new THREE.Vector3(0, 1, 0);

  // 当前补间状态
  let cameraTween = null; // { fromPos, toPos, fromTarget, toTarget, t, duration }

  // === 鼠标视差状态 ===
  // 鼠标在画布中的归一化坐标 (-1 ~ 1)
  const mouseNDC = new THREE.Vector2(0, 0);
  // 平滑后的鼠标坐标（用于缓动）
  const mouseSmooth = new THREE.Vector2(0, 0);
  // 视差强度：位置偏移（单位：世界坐标）
  const PARALLAX_POS = 0.6;
  // 视差强度：目标点偏移
  const PARALLAX_TARGET = 0.25;

  /**
   * 处理鼠标移动事件：记录归一化坐标
   * @param {MouseEvent} e
   */
  function onMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseNDC.set(x, y);
  }
  renderer.domElement.addEventListener('mousemove', onMouseMove);

  // 鼠标离开画布时缓慢回正
  renderer.domElement.addEventListener('mouseleave', () => {
    mouseNDC.set(0, 0);
  });

  /**
   * 切换到指定工作台的相机视角
   * @param {string} station - 'order' | 'grill' | 'build' | 'overview'
   * @param {boolean} [immediate=false] - 是否立即跳转（无补间）
   */
  function setStationCamera(station, immediate = false) {
    const preset = CAMERA_PRESETS[station] || CAMERA_PRESETS.overview;
    currentPreset = station;
    if (immediate) {
      basePos.copy(preset.pos);
      baseTarget.copy(preset.target);
      cameraTween = null;
      return;
    }
    cameraTween = {
      fromPos: basePos.clone(),
      toPos: preset.pos.clone(),
      fromTarget: baseTarget.clone(),
      toTarget: preset.target.clone(),
      t: 0,
      duration: 0.6
    };
  }

  /**
   * 逐帧更新：推进相机补间、应用鼠标视差、渲染
   * @param {number} dt - 距上一帧的秒数
   */
  function onTick(dt) {
    // 1) 推进补间，更新 basePos / baseTarget
    if (cameraTween) {
      cameraTween.t += dt / cameraTween.duration;
      const k = Math.min(1, cameraTween.t);
      // 缓动函数：easeInOutCubic
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      basePos.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
      baseTarget.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
      if (k >= 1) cameraTween = null;
    }

    // 2) 鼠标视差：平滑跟随鼠标
    // 用指数平滑减少抖动
    const smoothK = Math.min(1, dt * 6);
    mouseSmooth.x += (mouseNDC.x - mouseSmooth.x) * smoothK;
    mouseSmooth.y += (mouseNDC.y - mouseSmooth.y) * smoothK;

    // 3) 计算视差偏移
    // 相机沿其本地右轴和上轴做轻微偏移，让画面随鼠标"探视"
    // 右轴：相机右方（世界 X-Z 平面投影）
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.crossVectors(right, camera.up).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const posOffset = new THREE.Vector3()
      .addScaledVector(right, mouseSmooth.x * PARALLAX_POS)
      .addScaledVector(up, mouseSmooth.y * PARALLAX_POS);

    const targetOffset = new THREE.Vector3()
      .addScaledVector(right, mouseSmooth.x * PARALLAX_TARGET)
      .addScaledVector(up, mouseSmooth.y * PARALLAX_TARGET);

    // 4) 应用最终相机位置与朝向
    camera.position.copy(basePos).add(posOffset);
    camera.lookAt(baseTarget.clone().add(targetOffset));

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
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
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

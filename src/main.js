/**
 * @file main.js
 * @description 游戏入口：等待 DOM 就绪后创建 GameManager 并启动。
 */

import { createGameManager } from './game/GameManager.js';

/**
 * 应用启动入口
 * @returns {void}
 */
function bootstrap() {
  const container = document.getElementById('game-canvas-container');
  if (!container) {
    console.error('[Main] 未找到 #game-canvas-container 容器');
    return;
  }
  const game = createGameManager(container);
  // 暴露到 window 便于调试
  window.__game = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// ============================================================
// GAME MODE — AR.js barcode marker scavenger hunt
// ============================================================
// Flow:
//   1. User picks "Game Mode" → enter() mounts AR.js scene
//   2. User scans ID 0 (START) → gameState.started = true,
//      flower 3D content unlocked, mission "FIND 4 AZALEAS"
//   3. User scans IDs 1/2/3/4 (each species GLB) → +1, idempotent
//   4. 4/4 collected → mission "RETURN TO START"
//   5. User scans ID 0 again → reward modal
//
// Markers: AR.js barcode, 3x3 matrix code.
// Coord: marker plane = XZ, Y = up out of marker. 1 unit = marker size.

(function () {
  const App = window.App;
  if (!App) { console.error('[game] common.js not loaded'); return; }

  // ----------------------------------------------------------
  // SPECIES TABLE (game mode) — ID = barcode value
  // ----------------------------------------------------------
  // To add a species: push a new entry + print matching barcode.
  // ID 0 reserved for START.
  //
  // ⚠️ ASSET TODO: ID 4 cần GLB riêng. Hiện tạm dùng purple-azalea.glb
  //    làm placeholder. Khi có file thật, đổi `glb` field bên dưới.
  const SPECIES = [
    {
      id: 1,
      name: '紫杜鵑 · Purple Azalea',
      name_zh: '紫杜鵑',
      name_en: 'Purple Azalea',
      scientific: 'Rhododendron phoeniceum',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 中國南部 / 東亞',
      origin_en: 'Origin: Southern China / East Asia',
      glb: './gamemode/purple-azalea.glb',
      scale: 3
    },
    {
      id: 2,
      name: '白杜鵑 · White Azalea',
      name_zh: '白杜鵑',
      name_en: 'White Azalea',
      scientific: 'Rhododendron mucronatum',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 日本 / 東亞',
      origin_en: 'Origin: Japan / East Asia',
      glb: './gamemode/white-azalea.glb',
      scale: 3
    },
    {
      id: 3,
      name: '花期縮時 · Time-lapse',
      name_zh: '唐杜鵑 (花期縮時)',
      name_en: 'Tang Azalea (Time-lapse)',
      scientific: 'Rhododendron simsii',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 東亞地區',
      origin_en: 'Origin: East Asia',
      glb: './gamemode/default_timelapse.glb',
      scale: 3
    },
    {
      id: 4,
      name: '杜鵑 04 · Azalea 04',
      name_zh: '皋月杜鵑',
      name_en: 'Satsuki Azalea',
      scientific: 'Rhododendron indicum',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 日本',
      origin_en: 'Origin: Japan',
      glb: './gamemode/purple-azalea.glb',
      scale: 3
    }
  ];
  const TOTAL_FLOWERS = SPECIES.length;
  const LS_BEST = 'azalea_game_best';
  const LS_RUNS = 'azalea_game_runs';

  const gameState = {
    started: false,
    finished: false,
    collected: new Set(),
  };
  const resetGameState = () => {
    gameState.started = false;
    gameState.finished = false;
    gameState.collected = new Set();
  };

  const getBest = () => parseInt(localStorage.getItem(LS_BEST) || '0', 10);
  const getRuns = () => parseInt(localStorage.getItem(LS_RUNS) || '0', 10);
  const setBest = (n) => localStorage.setItem(LS_BEST, String(n));
  const incRuns = () => localStorage.setItem(LS_RUNS, String(getRuns() + 1));

  // ----------------------------------------------------------
  // HUD + MISSION + TOAST
  // ----------------------------------------------------------
  const dom = App.dom;

  function refreshHUD() {
    if (!dom.hudCurrent) return;
    dom.hudCurrent.textContent = gameState.collected.size;
    dom.hudTotal.textContent = TOTAL_FLOWERS;
    const best = Math.min(getBest(), TOTAL_FLOWERS);
    dom.hudBest.textContent = best > 0 ? `${best}/${TOTAL_FLOWERS}` : '—';
  }

  function setMission(textKey, glow) {
    if (!dom.missionText) return;
    dom.missionText.setAttribute('data-i18n', textKey);
    dom.missionText.textContent = App.i18n[App.currentLang][textKey] || dom.missionText.textContent;
    dom.gameMission.classList.toggle('glow', !!glow);
  }

  let gameToastTimer;
  function showGameToast(text, durationMs) {
    if (!dom.gameToast) return;
    dom.toastText.textContent = text;
    dom.gameToast.classList.add('show');
    clearTimeout(gameToastTimer);
    gameToastTimer = setTimeout(() => dom.gameToast.classList.remove('show'), durationMs || 1200);
  }

  function showMapModal() {
    document.getElementById('modal-map')?.classList.add('show');
  }

  // ----------------------------------------------------------
  // SCAN HANDLERS
  // ----------------------------------------------------------
  function onStartScanned() {
    if (!gameState.started) {
      gameState.started = true;
      setMission('mission_find', false);
      showGameToast(App.i18n[App.currentLang].toast_started || 'GO!', 1500);
      setFlowerContentVisible(true);
      return;
    }
    if (gameState.collected.size >= TOTAL_FLOWERS && !gameState.finished) {
      gameState.finished = true;
      completeRun();
    }
  }

  function onFlowerScanned(flowerIdx) {
    if (gameState.finished) return;
    if (!gameState.started) {
      showGameToast(App.i18n[App.currentLang].toast_scan_start_first || 'Scan START first', 1500);
      return;
    }
    if (gameState.collected.has(flowerIdx)) return;

    gameState.collected.add(flowerIdx);
    refreshHUD();
    const sp = SPECIES.find(s => s.id === flowerIdx);
    showGameToast(`${sp ? sp.name : '+1'} · ${gameState.collected.size}/${TOTAL_FLOWERS}`, 1500);

    setMission(gameState.collected.size >= TOTAL_FLOWERS ? 'mission_return' : 'mission_find',
               gameState.collected.size >= TOTAL_FLOWERS);
  }

  function completeRun() {
    const score = gameState.collected.size;
    incRuns();
    if (score > getBest()) setBest(score);
    dom.rewardScore.textContent = score;
    const total = document.getElementById('reward-score-total');
    if (total) total.textContent = TOTAL_FLOWERS;
    dom.rewardBest.textContent = Math.min(getBest(), TOTAL_FLOWERS);
    dom.rewardRuns.textContent = getRuns();
    dom.rewardMessage.textContent = App.i18n[App.currentLang].reward_message_perfect || '';
    dom.rewardModal.classList.add('active');
    App.spawnConfetti();
  }

  // ----------------------------------------------------------
  // VISIBILITY HELPERS
  // ----------------------------------------------------------
  // Toggle 3D children INSIDE markers, not the <a-marker> itself —
  // setting visible=false on a-marker makes AR.js skip detection
  // entirely (markerFound never fires).
  function setFlowerContentVisible(visible) {
    document.querySelectorAll('.flower-target a-gltf-model, .flower-target a-text').forEach(el => {
      el.setAttribute('visible', visible ? 'true' : 'false');
      if (el.object3D) el.object3D.visible = visible;
    });
  }

  // ----------------------------------------------------------
  // SCENE MOUNT / UNMOUNT
  // ----------------------------------------------------------
  let sceneEl = null;
  let videoReadyListener = null;
  let resizeListener = null;

  function buildScene() {
    const scene = document.createElement('a-scene');
    scene.id = 'ar-scene-game';
    scene.setAttribute('embedded', '');
    scene.setAttribute('arjs', 'sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 3x3; debugUIEnabled: false; trackingMethod: best;');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true; logarithmicDepthBuffer: true; preserveDrawingBuffer: true;');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');

    // Camera entity
    const cam = document.createElement('a-entity');
    cam.setAttribute('camera', '');
    scene.appendChild(cam);

    // Lighting (attached to scene so it stays lit regardless of marker)
    const lAmb = document.createElement('a-entity');
    lAmb.setAttribute('light', 'type: ambient; color: #ffffff; intensity: 1.4');
    scene.appendChild(lAmb);
    const lDir1 = document.createElement('a-entity');
    lDir1.setAttribute('light', 'type: directional; color: #ffffff; intensity: 0.8');
    lDir1.setAttribute('position', '1 1 1');
    scene.appendChild(lDir1);
    const lDir2 = document.createElement('a-entity');
    lDir2.setAttribute('light', 'type: directional; color: #ffd9e6; intensity: 0.4');
    lDir2.setAttribute('position', '-1 0.5 -1');
    scene.appendChild(lDir2);

    // ID 0 START marker — no 3D content in game mode (just used to trigger started)
    const startMarker = document.createElement('a-marker');
    startMarker.setAttribute('type', 'barcode');
    startMarker.setAttribute('value', '0');
    startMarker.setAttribute('smooth', 'true');
    startMarker.setAttribute('smoothCount', '5');
    startMarker.setAttribute('smoothTolerance', '0.01');
    startMarker.setAttribute('smoothThreshold', '2');
    startMarker.id = 'marker-start';
    scene.appendChild(startMarker);

    // Flower markers — one per SPECIES, GLB hidden until START scanned
    SPECIES.forEach(sp => {
      const m = document.createElement('a-marker');
      m.setAttribute('type', 'barcode');
      m.setAttribute('value', String(sp.id));
      m.setAttribute('smooth', 'true');
      m.setAttribute('smoothCount', '5');
      m.setAttribute('smoothTolerance', '0.01');
      m.setAttribute('smoothThreshold', '2');
      m.classList.add('flower-target');
      m.dataset.flower = String(sp.id);

      const model = document.createElement('a-gltf-model');
      model.setAttribute('src', sp.glb);
      model.setAttribute('position', '0 0.2 0');
      model.setAttribute('scale', `${sp.scale} ${sp.scale} ${sp.scale}`);
      model.setAttribute('visible', 'false');
      m.appendChild(model);

      const label = document.createElement('a-text');
      label.setAttribute('value', String(sp.id).padStart(2, '0'));
      label.setAttribute('color', '#6d1b3e');
      label.setAttribute('align', 'center');
      label.setAttribute('width', '2');
      label.setAttribute('position', '0 0.6 0');
      label.setAttribute('rotation', '-90 0 0');
      label.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
      label.setAttribute('visible', 'false');
      m.appendChild(label);

      scene.appendChild(m);
    });

    return scene;
  }

  function wireMarkerEvents() {
    const markers = sceneEl.querySelectorAll('a-marker');
    markers.forEach(marker => {
      const idx = parseInt(marker.getAttribute('value') || '0', 10);
      const isStart = (idx === 0);

      marker.addEventListener('markerFound', () => {
        console.log('[game] markerFound value=' + idx);
        dom.scanHint?.classList.add('hide');
        if (isStart) {
          onStartScanned();
        } else {
          // Update active specimen metadata so capture shows the correct species card
          const sp = SPECIES.find(s => s.id === idx);
          if (sp && App.activeSpecimen) {
            App.activeSpecimen.name_zh = sp.name_zh;
            App.activeSpecimen.name_en = sp.name_en;
            App.activeSpecimen.scientific = sp.scientific;
            App.activeSpecimen.family_zh = sp.family_zh;
            App.activeSpecimen.family_en = sp.family_en;
            App.activeSpecimen.origin_zh = sp.origin_zh;
            App.activeSpecimen.origin_en = sp.origin_en;
          }
          onFlowerScanned(idx);
        }
      });
      marker.addEventListener('markerLost', () => {
        console.log('[game] markerLost value=' + idx);
      });
    });
  }

  // ----------------------------------------------------------
  // LIFECYCLE: enter / exit
  // ----------------------------------------------------------
  async function enter() {
    resetGameState();
    refreshHUD();
    setMission('mission_start', true);
    dom.gameHud?.classList.add('active');
    dom.gameMission?.classList.add('active');
    dom.scanHint?.classList.remove('hide');

    // Defensive: silence any leftover video from previous mode
    document.getElementById('bloomVideo')?.pause();
    document.getElementById('floating-video-el')?.pause();
    dom.floatingMode?.classList.remove('active');

    sceneEl = buildScene();
    dom.sceneHost.appendChild(sceneEl);
    sceneEl.classList.add('active');

    await new Promise(resolve => {
      const ready = () => {
        videoReadyListener = null;
        resolve();
      };
      if (sceneEl.hasLoaded) ready();
      else sceneEl.addEventListener('loaded', ready, { once: true });
    });

    wireMarkerEvents();

    videoReadyListener = () => {
      dom.loading.classList.remove('active');
      dom.arUI.classList.add('active');
      App.enforceCameraSize();
      resizeListener = () => App.enforceCameraSize();
      window.addEventListener('resize', resizeListener);
      // Show map intro after a small delay so user sees scene first
      setTimeout(showMapModal, 400);
      window.dispatchEvent(new Event('resize'));
    };

    if (document.querySelector('video')?.readyState >= 2) {
      videoReadyListener();
    } else {
      window.addEventListener('arjs-video-loaded', videoReadyListener, { once: true });
      setTimeout(() => {
        if (dom.loading.classList.contains('active')) videoReadyListener?.();
      }, 3000);
    }
  }

  async function exit() {
    if (resizeListener) {
      window.removeEventListener('resize', resizeListener);
      resizeListener = null;
    }
    if (videoReadyListener) {
      window.removeEventListener('arjs-video-loaded', videoReadyListener);
      videoReadyListener = null;
    }
    if (sceneEl) {
      // Stop AR.js video stream by removing scene from DOM
      sceneEl.parentNode?.removeChild(sceneEl);
      sceneEl = null;
    }
    // Also stop any leftover video tracks AR.js attached to body
    document.querySelectorAll('video#arjs-video').forEach(v => {
      try { v.srcObject?.getTracks().forEach(t => t.stop()); } catch (e) {}
      v.parentNode?.removeChild(v);
    });
    resetGameState();
  }

  // ----------------------------------------------------------
  // REWARD MODAL HANDLERS
  // ----------------------------------------------------------
  document.getElementById('reward-close')?.addEventListener('click', () => {
    dom.rewardModal.classList.remove('active');
    App.stopConfetti();
  });
  document.getElementById('reward-replay')?.addEventListener('click', () => {
    dom.rewardModal.classList.remove('active');
    App.stopConfetti();
    resetGameState();
    refreshHUD();
    setMission('mission_start', true);
    setFlowerContentVisible(false);
  });
  document.getElementById('map-btn')?.addEventListener('click', showMapModal);

  // ----------------------------------------------------------
  // WIRE INTRO BUTTON + REGISTER WITH App
  // ----------------------------------------------------------
  App.registerMode({ name: 'game', enter, exit });
  document.getElementById('game-btn')?.addEventListener('click', () => App.enterMode('game'));

})();

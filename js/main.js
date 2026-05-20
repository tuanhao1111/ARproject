// ============================================================
// CAMERA FALLBACK PATCH (cho desktop)
// ============================================================
(function patchGetUserMedia() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    try {
      return await original(constraints);
    } catch (err) {
      if (['OverconstrainedError', 'NotFoundError', 'NotReadableError'].includes(err.name)
          && constraints?.video && typeof constraints.video === 'object') {
        console.warn('Falling back to default camera:', err.name);
        return await original({ ...constraints, video: true });
      }
      throw err;
    }
  };
})();

// ============================================================
// DOM REFS — cache 1 lần để không lookup lặp lại
// ============================================================
const dom = {
  intro:         document.getElementById('intro'),
  loading:       document.getElementById('loading'),
  loadingText:   document.getElementById('loading-text'),
  errorScreen:   document.getElementById('error-screen'),
  errorTitle:    document.getElementById('error-title'),
  errorMsg:      document.getElementById('error-msg'),
  errDetail:     document.getElementById('err-detail'),
  arUI:          document.getElementById('ar-ui'),
  arScene:       document.getElementById('ar-scene'),
  scanHint:      document.getElementById('scan-hint'),
  fabs:          document.getElementById('fabs'),
  floatingMode:  document.getElementById('floating-mode'),
  // Game
  gameHud:       document.getElementById('game-hud'),
  gameMission:   document.getElementById('game-mission'),
  missionText:   document.getElementById('mission-text'),
  gameToast:     document.getElementById('game-toast'),
  toastText:     document.getElementById('toast-text'),
  hudCurrent:    document.getElementById('hud-score-current'),
  hudTotal:      document.getElementById('hud-score-total'),
  hudBest:       document.getElementById('hud-best-value'),
  rewardModal:   document.getElementById('reward-modal'),
  rewardScore:   document.getElementById('reward-score'),
  rewardBest:    document.getElementById('reward-best'),
  rewardRuns:    document.getElementById('reward-runs'),
  rewardMessage: document.getElementById('reward-message'),
  // i18n
  langBtn:       document.getElementById('lang-btn'),
};

function showError(title, msg, detail) {
  dom.errorTitle.textContent = title;
  dom.errorMsg.textContent = msg;
  dom.errDetail.textContent = detail || '';
  dom.errDetail.style.display = detail ? 'block' : 'none';
  dom.loading.classList.remove('active');
  dom.errorScreen.classList.add('active');
}

document.getElementById('error-retry')?.addEventListener('click', () => {
  dom.errorScreen.classList.remove('active');
  dom.intro.classList.remove('fade-out');
  dom.intro.style.display = 'flex';
});

// ============================================================
// GAME MODE — state, persistence, target counting, reward
// ============================================================
// Flow:
//   1. User picks "Game Mode" trên intro  → currentMode = 'game'
//   2. HUD hiển thị 0/8, mission = "Scan START"
//   3. User scan START                     → game bắt đầu
//   4. User scan từng flower               → +1, idempotent
//   5. 8/8 xong, mission = "Return to START"
//   6. User scan START lần nữa             → reward modal

let currentMode = 'explore'; // 'explore' | 'game'

// ============================================================
// SPECIES TABLE (game mode)
// ============================================================
// Mỗi marker ID = 1 loài hoa với GLB riêng. Thêm loài mới =
// push vào array, KHÔNG đụng code khác. ID phải match barcode
// đã in. ID 0 reserved cho START/hero (xem index.html).
const SPECIES = [
  { id: 1, name: '紫杜鵑 · Purple Azalea', glb: './gamemode/purple-azalea.glb', scale: 3 },
  { id: 2, name: '白杜鵑 · White Azalea',  glb: './gamemode/white-azalea.glb',  scale: 3 },
  { id: 3, name: '花期縮時 · Time-lapse',  glb: './gamemode/default_timelapse.glb', scale: 3 },
];
const TOTAL_FLOWERS = SPECIES.length;
const LS_BEST = 'azalea_game_best';
const LS_RUNS = 'azalea_game_runs';

const gameState = {
  started: false,
  finished: false,
  collected: new Set(),
};

function resetGameState() {
  gameState.started = false;
  gameState.finished = false;
  gameState.collected = new Set();
}

// Toggle visibility CHỈ trên 3D children bên trong marker, KHÔNG trên a-marker
// itself. Lý do: setting `visible=false` trên <a-marker> làm AR.js skip
// detection hoàn toàn (markerFound không fire) → user quét QR mà không có gì
// xảy ra. Hide từng gltf-model/a-text/a-video con thì marker vẫn track,
// event vẫn fire, ta vẫn gate được logic ở handler level.

function setHeroContentVisible(visible) {
  // ID 0 hero content: bloom video + azalea GLB (chỉ hiện trong explore mode).
  // Set cả attribute và object3D.visible — A-Frame's visible component
  // sometimes lag if entity init timing chưa xong.
  document.querySelectorAll('#ar-video, #azalea-flower').forEach(el => {
    el.setAttribute('visible', visible ? 'true' : 'false');
    if (el.object3D) el.object3D.visible = visible;
  });
}

function setFlowerContentVisible(visible) {
  // ID 1/2/3 flower content: gltf-model + label text (chỉ hiện game mode
  // SAU khi user scan START).
  document.querySelectorAll('.flower-target a-gltf-model, .flower-target a-text').forEach(el => {
    el.setAttribute('visible', visible ? 'true' : 'false');
    if (el.object3D) el.object3D.visible = visible;
  });
}

const getBest  = () => parseInt(localStorage.getItem(LS_BEST) || '0', 10);
const getRuns  = () => parseInt(localStorage.getItem(LS_RUNS) || '0', 10);
const setBest  = (n) => localStorage.setItem(LS_BEST, String(n));
const incRuns  = () => localStorage.setItem(LS_RUNS, String(getRuns() + 1));

function initGameUI() {
  dom.gameHud.classList.add('active');
  dom.gameMission.classList.add('active');
  refreshHUD();
  // Map sẽ auto-show từ startARjs() onVideoReady, không phải tại đây (tránh
  // overlap loading screen).
}

function showMapModal() {
  const mapModal = document.getElementById('modal-map');
  if (mapModal) mapModal.classList.add('show');
}

function refreshHUD() {
  dom.hudCurrent.textContent = gameState.collected.size;
  dom.hudTotal.textContent   = TOTAL_FLOWERS;
  // Clamp old saved best in case TOTAL_FLOWERS shrank (e.g. 8 → 3 migration)
  const best = Math.min(getBest(), TOTAL_FLOWERS);
  dom.hudBest.textContent = best > 0 ? `${best}/${TOTAL_FLOWERS}` : '—';
}

function setMission(textKey, glow) {
  dom.missionText.setAttribute('data-i18n', textKey);
  dom.missionText.textContent = i18n[currentLang][textKey] || dom.missionText.textContent;
  dom.gameMission.classList.toggle('glow', !!glow);
}

// Game toast (giữa màn hình, dùng cho +1 collected)
let gameToastTimer;
function showGameToast(text, durationMs) {
  dom.toastText.textContent = text;
  dom.gameToast.classList.add('show');
  clearTimeout(gameToastTimer);
  gameToastTimer = setTimeout(() => dom.gameToast.classList.remove('show'), durationMs || 1200);
}

function onFlowerScanned(flowerIdx) {
  if (currentMode !== 'game') return;
  if (gameState.finished) return;
  // Gate: phải scan START trước. Hiện toast nhắc nếu user thử scan flower
  // sớm — đỡ confusion "sao tôi scan rồi mà không cộng điểm".
  if (!gameState.started) {
    showGameToast(i18n[currentLang].toast_scan_start_first || 'Scan START first', 1500);
    return;
  }
  if (gameState.collected.has(flowerIdx)) return;

  gameState.collected.add(flowerIdx);
  refreshHUD();
  const sp = SPECIES.find(s => s.id === flowerIdx);
  const label = sp ? sp.name : `+1`;
  showGameToast(`${label} · ${gameState.collected.size}/${TOTAL_FLOWERS}`, 1500);

  if (gameState.collected.size >= TOTAL_FLOWERS) {
    setMission('mission_return', true);
  } else {
    setMission('mission_find', false);
  }
}

function onStartScanned() {
  if (currentMode !== 'game') return;

  if (!gameState.started) {
    gameState.started = true;
    setMission('mission_find', false);
    showGameToast(i18n[currentLang].toast_started || 'GO!', 1500);
    // Unlock flower content — chỉ render 3D model sau khi user đã scan START.
    setFlowerContentVisible(true);
    return;
  }

  if (gameState.collected.size >= TOTAL_FLOWERS && !gameState.finished) {
    gameState.finished = true;
    completeRun();
  }
}

function completeRun() {
  const score = gameState.collected.size;
  incRuns();
  if (score > getBest()) setBest(score);

  dom.rewardScore.textContent = score;
  const rewardTotal = document.getElementById('reward-score-total');
  if (rewardTotal) rewardTotal.textContent = TOTAL_FLOWERS;
  dom.rewardBest.textContent  = Math.min(getBest(), TOTAL_FLOWERS);
  dom.rewardRuns.textContent  = getRuns();
  dom.rewardMessage.textContent = i18n[currentLang].reward_message_perfect || '';

  dom.rewardModal.classList.add('active');
}

document.getElementById('reward-close').addEventListener('click', () => {
  dom.rewardModal.classList.remove('active');
});
document.getElementById('reward-replay').addEventListener('click', () => {
  dom.rewardModal.classList.remove('active');
  resetGameState();
  refreshHUD();
  setMission('mission_start', true);
  // Re-hide flowers cho lượt chơi mới — đợi user scan START lại.
  setFlowerContentVisible(false);
});

// ============================================================
// GENERATE FLOWER MARKERS (game mode, 1 marker / species)
// ============================================================
// AR.js barcode marker: type="barcode" + value=<ID>.
// Coordinate: marker plane = XZ, Y = out (up). Khác MindAR (XY, Z out).
// Mỗi species load GLB riêng (src trực tiếp, browser cache sau lần đầu).
function generateFlowerTargets() {
  const scene = dom.arScene;
  SPECIES.forEach(sp => {
    const marker = document.createElement('a-marker');
    marker.setAttribute('type', 'barcode');
    marker.setAttribute('value', String(sp.id));
    marker.setAttribute('smooth', 'true');
    marker.setAttribute('smoothCount', '5');
    marker.setAttribute('smoothTolerance', '0.01');
    marker.setAttribute('smoothThreshold', '2');
    marker.classList.add('flower-target');
    marker.dataset.flower = String(sp.id);
    marker.dataset.name = sp.name;

    const model = document.createElement('a-gltf-model');
    model.setAttribute('src', sp.glb);
    // Y = up out of marker plane
    model.setAttribute('position', '0 0.2 0');
    model.setAttribute('scale', `${sp.scale} ${sp.scale} ${sp.scale}`);
    marker.appendChild(model);

    const label = document.createElement('a-text');
    label.setAttribute('value', String(sp.id).padStart(2, '0'));
    label.setAttribute('color', '#6d1b3e');
    label.setAttribute('align', 'center');
    label.setAttribute('width', '2');
    label.setAttribute('position', '0 0.6 0');
    label.setAttribute('rotation', '-90 0 0');
    label.setAttribute('font', 'https://cdn.aframe.io/fonts/Roboto-msdf.json');
    marker.appendChild(label);

    scene.appendChild(marker);
  });
}
// Generate ngay trước khi a-scene 'loaded' fires (sync trong cùng tick)
generateFlowerTargets();

// ============================================================
// START AR
// ============================================================
async function enterAR(mode) {
  currentMode = mode;

  // Set body class để CSS .game-only / .explore-only biết hide/show
  document.body.classList.toggle('game-mode',    mode === 'game');
  document.body.classList.toggle('explore-mode', mode === 'explore');

  // Visibility theo mode:
  //   - explore: hero ON (FABs + video + GLB azalea hero), flowers OFF (chưa support content)
  //   - game:    hero OFF (chỉ cần trigger started, không show 3D), flowers OFF
  //              (mở khoá sau khi scan START — onStartScanned)
  setHeroContentVisible(mode === 'explore');
  setFlowerContentVisible(false);

  // Game mode defensive: pause cả bloom video (asset) lẫn floating-video-el
  // ngay từ enterAR, đề phòng autoplay attribute kick in trước khi mình
  // ngắt qua onVideoReady.
  if (mode === 'game') {
    document.getElementById('bloomVideo')?.pause();
    document.getElementById('floating-video-el')?.pause();
    dom.floatingMode.classList.remove('active');
  }

  const isSecure = window.isSecureContext ||
                   ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isSecure) {
    showError('Insecure Context',
      'Web AR requires HTTPS or localhost.',
      'Current URL: ' + location.href);
    return;
  }

  dom.intro.classList.add('fade-out');
  setTimeout(() => dom.intro.style.display = 'none', 600);
  dom.loading.classList.add('active');
  dom.loadingText.textContent = 'Requesting camera...';

  try {
    const test = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    test.getTracks().forEach(t => t.stop());
  } catch (err) {
    showError('Camera Permission Denied',
      'Please allow camera access and try again.',
      err.name + ': ' + err.message);
    return;
  }

  dom.loadingText.textContent = 'Loading AR engine...';
  dom.arScene.classList.add('active');

  if (mode === 'game') initGameUI();

  if (dom.arScene.hasLoaded) startARjs();
  else dom.arScene.addEventListener('loaded', startARjs, { once: true });
}

document.getElementById('start-btn').addEventListener('click', () => enterAR('explore'));
document.getElementById('game-btn').addEventListener('click', () => enterAR('game'));

// Force camera video full-viewport. CHỈ target #arjs-video — không dùng
// selector rộng, A-Frame có thể move asset video ra body → biến chúng
// thành fullscreen overlay che camera (đã xảy ra một lần).
function enforceCameraSize() {
  const v = document.getElementById('arjs-video');
  if (!v) return;
  v.style.setProperty('position', 'fixed', 'important');
  v.style.setProperty('top', '0', 'important');
  v.style.setProperty('left', '0', 'important');
  v.style.setProperty('width', '100vw', 'important');
  v.style.setProperty('height', '100vh', 'important');
  v.style.setProperty('min-width', '100vw', 'important');
  v.style.setProperty('min-height', '100vh', 'important');
  v.style.setProperty('object-fit', 'cover', 'important');
  v.style.setProperty('transform', 'none', 'important');
  v.style.setProperty('margin', '0', 'important');
  v.style.setProperty('z-index', '1', 'important');
}

// AR.js tự khởi động camera khi scene loaded — không cần gọi start() như MindAR.
// Ta chỉ cần chờ camera ready rồi unhide UI.
function startARjs() {
  try {
    dom.loadingText.textContent = 'Starting camera...';

    // AR.js dispatches 'arjs-video-loaded' khi video stream sẵn sàng
    const onVideoReady = () => {
      dom.loading.classList.remove('active');
      dom.arUI.classList.add('active');

      // Enforce camera video size ngay khi ready, và lặp lại mỗi resize.
      // AR.js có thể inject inline style="width:Xpx; height:Ypx; transform:..."
      // sau load — ta dùng setProperty với 'important' để chắc chắn override.
      enforceCameraSize();
      window.addEventListener('resize', enforceCameraSize);

      // Game mode: auto-show map sau khi camera ready (delay nhỏ để
      // user thấy AR scene 1 nhịp trước khi modal phủ lên).
      if (currentMode === 'game') {
        setTimeout(showMapModal, 400);
      }

      // Force play hero video CHỈ ở explore mode (unlock autoplay). Game mode
      // không cần video — phải pause để CSS asset video không leak content
      // ra a-video texture ngay cả khi #ar-video hidden.
      const video = document.getElementById('bloomVideo');
      if (currentMode === 'explore') {
        video?.play().catch(e => console.warn('Video autoplay blocked:', e));
      } else {
        video?.pause();
      }

      // Resize trigger để wake A-Frame render loop trên một số mobile browsers
      window.dispatchEvent(new Event('resize'));

      // needsUpdate cho materials (fix bug refresh không hiện)
      setTimeout(() => {
        document.querySelectorAll('a-marker').forEach(marker => {
          marker.object3D?.traverse(child => {
            if (!child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => { if (m) m.needsUpdate = true; });
          });
        });
      }, 200);
    };

    // Nếu AR.js video đã load rồi (scene reload) → fire ngay; else đợi event
    if (document.querySelector('video')?.readyState >= 2) {
      onVideoReady();
    } else {
      window.addEventListener('arjs-video-loaded', onVideoReady, { once: true });
      // Fallback timeout 3s phòng event không fire
      setTimeout(() => {
        if (dom.loading.classList.contains('active')) onVideoReady();
      }, 3000);
    }
  } catch (err) {
    console.error('AR.js start error:', err);
    showError('AR Start Failed', 'Could not start AR.js.',
      err.message || String(err));
  }
}

// ============================================================
// MARKER FOUND / LOST (AR.js barcode events)
// ============================================================
// AR.js dispatches 'markerFound' / 'markerLost' trên <a-marker>.
// Đọc barcode ID qua attribute 'value' thay vì targetIndex.
dom.arScene.addEventListener('loaded', () => {
  const markers = document.querySelectorAll('a-marker');
  if (!markers.length) return;

  markers.forEach((marker) => {
    const idx = parseInt(marker.getAttribute('value') || '0', 10);
    const isStart = (idx === 0);

    marker.addEventListener('markerFound', () => {
      console.log('[AR] markerFound value=' + idx + ' mode=' + currentMode);

      // Flower marker (1-3): chỉ react trong game mode.
      // Inner GLB/text đã visible=false (cả explore và game-chưa-start) → user
      // không thấy 3D xuất hiện, nhưng markerFound vẫn fire để ta gate ở handler.
      if (!isStart) {
        if (currentMode === 'game') onFlowerScanned(idx);
        return;
      }

      // ID 0 (START / hero)
      dom.scanHint.classList.add('hide');
      dom.floatingMode.classList.remove('active');

      if (currentMode === 'explore') {
        // Explore: play hero video + show 3D azalea + bật FABs
        userScale = 1;
        userPosOffset = { x: 0, y: 0 };
        userRotation = { x: 0, y: 0 };
        applyUserTransform();
        applyFlowerRotation();
        const video = document.getElementById('bloomVideo');
        if (video?.paused) {
          video.play().catch(e => console.warn('Video play failed:', e));
        }
        setTimeout(() => dom.fabs.classList.add('show'), 500);
      } else {
        // Game: chỉ trigger started state — không play video, không hiện 3D
        // (hero content đã visible=false từ enterAR).
        onStartScanned();
      }
    });

    marker.addEventListener('markerLost', () => {
      console.log('[AR] markerLost value=' + idx);
      // Floating-mode (panel azalea-bloom.mp4 hiện khi camera lia khỏi marker)
      // CHỈ enable trong explore mode. Game mode: không có floating UI, user
      // tập trung scan QR khác.
      if (isStart && currentMode === 'explore') {
        if (!dom.floatingMode.classList.contains('active')) {
          dom.floatingMode.classList.add('active');
        }
      }
    });
  });
});

// ============================================================
// BACK
// ============================================================
document.getElementById('back-btn').addEventListener('click', async () => {
  // AR.js không có sys.stop() như MindAR, và stop video tracks rồi thì
  // không restart dễ dàng được. Giữ camera chạy nền, chỉ hide scene/UI.
  // (Nếu cần tắt camera hẳn → user đóng tab.)
  closeAllModals();
  dom.arUI.classList.remove('active');
  dom.arScene.classList.remove('active');
  dom.fabs.classList.remove('show');

  dom.gameHud.classList.remove('active');
  dom.gameMission.classList.remove('active');
  dom.rewardModal.classList.remove('active');
  resetGameState();
  setHeroContentVisible(false);
  setFlowerContentVisible(false);

  // Stop enforce camera resize loop khi rời AR view
  window.removeEventListener('resize', enforceCameraSize);

  // Clear mode classes để CSS .game-only/.explore-only ẩn lại
  document.body.classList.remove('game-mode', 'explore-mode');

  dom.intro.style.display = 'flex';
  dom.intro.classList.remove('fade-out');
});

// Map button (top-bar, game mode) — re-open map sau khi user đã dismiss
document.getElementById('map-btn')?.addEventListener('click', showMapModal);

// ============================================================
// PINCH / DRAG / ROTATE
// ============================================================
// 1 ngón vuốt  = XOAY hoa
// 2 ngón pinch = ZOOM
// 2 ngón pan   = DI CHUYỂN
// Wrapper: zoom + position. Hoa: rotation.

let userScale = 1;
const USER_SCALE_MIN = 0.3;
const USER_SCALE_MAX = 3.0;
let userPosOffset = { x: 0, y: 0 };
let userRotation = { x: 0, y: 0 };

let pinchStartDist = null;
let pinchStartUserScale = null;
let twoFingerStartCenter = null;
let twoFingerStartOffset = null;
let oneFingerStartTouch = null;
let oneFingerStartRotation = null;

const DRAG_FACTOR = 5;
const ROTATE_FACTOR = 360;
const GESTURE_IGNORE_SELECTOR = '.fab, .modal, .top-bar, button, .audio-player, .lc-stage, .lang-btn';

function getTouchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

function applyUserTransform() {
  const wrapper = document.getElementById('pinch-wrapper');
  if (!wrapper?.object3D) return;
  wrapper.object3D.scale.set(userScale, userScale, userScale);
  wrapper.object3D.position.x = userPosOffset.x;
  wrapper.object3D.position.y = userPosOffset.y;
}

function applyFlowerRotation() {
  const flower = document.getElementById('azalea-flower');
  if (!flower?.object3D) return;
  flower.object3D.rotation.x = userRotation.x * Math.PI / 180;
  flower.object3D.rotation.y = userRotation.y * Math.PI / 180;
}

document.addEventListener('touchstart', (e) => {
  if (e.target.closest(GESTURE_IGNORE_SELECTOR)) return;

  if (e.touches.length === 2) {
    pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
    pinchStartUserScale = userScale;
    twoFingerStartCenter = getTouchCenter(e.touches[0], e.touches[1]);
    twoFingerStartOffset = { ...userPosOffset };
    oneFingerStartTouch = null;
    e.preventDefault();
  } else if (e.touches.length === 1) {
    oneFingerStartTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    oneFingerStartRotation = { ...userRotation };
  }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (e.target.closest(GESTURE_IGNORE_SELECTOR)) return;

  if (e.touches.length === 2 && pinchStartDist !== null) {
    const currentDist = getTouchDist(e.touches[0], e.touches[1]);
    const ratio = currentDist / pinchStartDist;
    userScale = Math.max(USER_SCALE_MIN, Math.min(USER_SCALE_MAX, pinchStartUserScale * ratio));

    const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);
    const dx = (currentCenter.x - twoFingerStartCenter.x) / window.innerWidth;
    const dy = (currentCenter.y - twoFingerStartCenter.y) / window.innerHeight;
    userPosOffset.x = twoFingerStartOffset.x + dx * DRAG_FACTOR;
    userPosOffset.y = twoFingerStartOffset.y - dy * DRAG_FACTOR;

    applyUserTransform();
    e.preventDefault();
  } else if (e.touches.length === 1 && oneFingerStartTouch !== null) {
    const dx = (e.touches[0].clientX - oneFingerStartTouch.x) / window.innerWidth;
    const dy = (e.touches[0].clientY - oneFingerStartTouch.y) / window.innerHeight;

    userRotation.y = oneFingerStartRotation.y + dx * ROTATE_FACTOR;
    userRotation.x = oneFingerStartRotation.x + dy * ROTATE_FACTOR;
    userRotation.x = Math.max(-80, Math.min(80, userRotation.x));

    applyFlowerRotation();
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  // Khi user nhả từ 2 ngón xuống 1 ngón, re-anchor rotation start
  // để không bị snap đột ngột.
  if (e.touches.length === 1) {
    pinchStartDist = null;
    twoFingerStartCenter = null;
    oneFingerStartTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    oneFingerStartRotation = { ...userRotation };
  } else if (e.touches.length === 0) {
    pinchStartDist = null;
    twoFingerStartCenter = null;
    oneFingerStartTouch = null;
  }
});

// Mouse handlers (desktop)
let mouseDragging = false;
let mouseDragStart = null;
let mouseDragStartRotation = null;
let mouseDragStartOffset = null;
let mouseShiftDragging = false;

document.addEventListener('wheel', (e) => {
  if (e.target.closest('.modal, .info-card, .audio-player, .lang-btn')) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.92 : 1.08;
  userScale = Math.max(USER_SCALE_MIN, Math.min(USER_SCALE_MAX, userScale * delta));
  applyUserTransform();
}, { passive: false });

document.addEventListener('mousedown', (e) => {
  if (e.target.closest('.fab, .modal, .top-bar, button, .lang-btn')) return;
  mouseDragging = true;
  mouseShiftDragging = e.shiftKey;
  mouseDragStart = { x: e.clientX, y: e.clientY };
  mouseDragStartRotation = { ...userRotation };
  mouseDragStartOffset = { ...userPosOffset };
});

document.addEventListener('mousemove', (e) => {
  if (!mouseDragging) return;
  const dx = (e.clientX - mouseDragStart.x) / window.innerWidth;
  const dy = (e.clientY - mouseDragStart.y) / window.innerHeight;

  if (mouseShiftDragging || e.shiftKey) {
    userPosOffset.x = mouseDragStartOffset.x + dx * DRAG_FACTOR;
    userPosOffset.y = mouseDragStartOffset.y - dy * DRAG_FACTOR;
    applyUserTransform();
  } else {
    userRotation.y = mouseDragStartRotation.y + dx * ROTATE_FACTOR;
    userRotation.x = mouseDragStartRotation.x + dy * ROTATE_FACTOR;
    userRotation.x = Math.max(-80, Math.min(80, userRotation.x));
    applyFlowerRotation();
  }
});

document.addEventListener('mouseup', () => {
  mouseDragging = false;
  mouseShiftDragging = false;
});

// ============================================================
// FAB → MODAL
// ============================================================
document.querySelectorAll('.fab').forEach(fab => {
  fab.addEventListener('click', () => {
    closeAllModals();
    const action = fab.dataset.action;
    const modal = document.getElementById('modal-' + action);
    if (modal) modal.classList.add('show');
  });
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
});

function closeModal(modal) {
  modal.classList.remove('show');
  // Stop YouTube playback
  modal.querySelectorAll('iframe').forEach(i => {
    const src = i.src; i.src = ''; i.src = src;
  });
  // Stop speech
  if (window.speechSynthesis) speechSynthesis.cancel();
  document.querySelectorAll('.audio-btn.playing').forEach(b => b.classList.remove('playing'));
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => closeModal(m));
}

// ============================================================
// LIFECYCLE STAGES
// ============================================================
const lifecycleData = [
  { title: '芽期 · Bud Stage', desc: '冬末春初，杜鵑於枝端形成花芽。芽鱗片緊閉，包覆著未來的花朵。低溫累積對花芽分化十分關鍵。' },
  { title: '蕾期 · Pre-bloom', desc: '花苞膨大，外層鱗片裂開，露出粉紅色花瓣。此時需要充足光照與適度濕度，溫度回升加速綻放。' },
  { title: '花期 · Bloom',     desc: '3–5 月盛放，五瓣對稱，雄蕊外露。花色由純白、淡粉至深桃紅，吸引蝴蝶與蜜蜂授粉。' },
  { title: '果期 · Fruit',     desc: '花後結蒴果，6 月成熟裂開，散播微小種子。一個蒴果可含數百枚種子，藉風力傳播。' }
];
const lcTitle = document.getElementById('lc-title');
const lcDesc  = document.getElementById('lc-desc');
document.querySelectorAll('.lc-stage').forEach(stage => {
  stage.addEventListener('click', () => {
    document.querySelectorAll('.lc-stage').forEach(s => s.classList.remove('active'));
    stage.classList.add('active');
    const idx = parseInt(stage.dataset.stage, 10);
    const data = lifecycleData[idx];
    if (!data) return;
    lcTitle.textContent = data.title;
    lcDesc.textContent  = data.desc;
  });
});

// ============================================================
// AUDIO (Web Speech API)
// ============================================================
const narrationText = {
  'zh-TW': '杜鵑花，學名 Rhododendron pulchrum，原產於東亞地區。是常綠灌木，喜酸性土壤與半遮蔭環境。每年三月至五月盛開，花色從純白到深粉紅，象徵春日的回歸與校園的青春記憶。',
  'en-US': 'The Hirado azalea, scientific name Rhododendron pulchrum, is native to East Asia. It is an evergreen shrub that thrives in acidic soil and semi-shaded conditions. Blooming from March to May, its flowers range from pure white to deep pink, symbolizing the return of spring and the memory of campus youth.'
};

document.querySelectorAll('.audio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    const text = narrationText[lang];

    if (!window.speechSynthesis) {
      showLangToast('Browser không hỗ trợ Speech Synthesis · Speech API unavailable');
      return;
    }

    if (btn.classList.contains('playing')) {
      speechSynthesis.cancel();
      btn.classList.remove('playing');
      return;
    }

    speechSynthesis.cancel();
    document.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('playing'));

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.onend = () => btn.classList.remove('playing');
    utter.onerror = () => btn.classList.remove('playing');

    btn.classList.add('playing');
    speechSynthesis.speak(utter);
  });
});

// ============================================================
// LANGUAGE TOAST (generic, dùng cho language switch, errors)
// Khác với showGameToast — dùng element riêng .toast trong #ar-ui
// ============================================================
let langToastTimer;
function showLangToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    dom.arUI.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(langToastTimer);
  langToastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================================
// I18N
// ============================================================
let currentLang = 'zh';

const i18n = {
  zh: {
    back: '← 返回',
    specimen: '標本',
    specimen_en: '',
    scan_hint: '將鏡頭對準 QR 標記 · POINT AT THE QR MARKER',
    floating_status: '自由模式 · FREE MODE',
    explore_btn: '開始尋花 · EXPLORE',
    game_btn: '遊戲模式 · GAME MODE',
    modal_bio_title: '生態說明',
    modal_bio_subtitle: 'Ecological Profile',
    modal_video_title: '時序紀錄',
    modal_video_subtitle: 'Time-lapse Recording',
    modal_life_title: '生命週期',
    modal_life_subtitle: 'Life Cycle',
    modal_audio_title: '聲音導覽',
    modal_audio_subtitle: 'Audio Guide',
    hud_collected: '收集 · COLLECTED',
    hud_best: '最佳 · BEST',
    mission_start:  '掃描 START QR 開始 · SCAN START QR',
    mission_find:   '尋找 3 種杜鵑 · FIND 3 AZALEAS',
    mission_return: '返回 START 領取獎勵 · RETURN TO START',
    toast_started:  '遊戲開始 · GO!',
    toast_scan_start_first: '請先掃描 START QR · SCAN START FIRST',
    reward_stamp:    '尋花已成 · QUEST COMPLETE',
    reward_title:    '恭喜！',
    reward_subtitle: 'You found every azalea',
    reward_message_perfect: '你已完成校園杜鵑尋花地圖，請至植物學社攤位出示此畫面，領取限量明信片一張。',
    reward_best:    '最佳 · BEST',
    reward_runs:    '完成次數 · RUNS',
    reward_close:   '關閉 · CLOSE',
    reward_replay:  '再玩一次 · PLAY AGAIN',
    map_title:      '校園尋花地圖',
    map_subtitle:   'Campus quest map',
    map_intro:      '沿校園尋找 3 個 QR 標記點，掃描收集杜鵑。集齊後返回 START 領取獎勵。',
    map_foot:       '⚫ 黑色標記 = QR 位置 · Black pins = QR locations',
  },
  en: {
    back: '← BACK',
    specimen: 'SPECIMEN',
    specimen_en: '',
    scan_hint: 'POINT AT THE QR MARKER · 將鏡頭對準 QR 標記',
    floating_status: 'FREE MODE · 自由模式',
    explore_btn: 'EXPLORE · 開始尋花',
    game_btn:    'GAME MODE · 遊戲模式',
    modal_bio_title: 'Ecological Profile',
    modal_bio_subtitle: '生態說明',
    modal_video_title: 'Time-lapse',
    modal_video_subtitle: '時序紀錄',
    modal_life_title: 'Life Cycle',
    modal_life_subtitle: '生命週期',
    modal_audio_title: 'Audio Guide',
    modal_audio_subtitle: '聲音導覽',
    hud_collected: 'COLLECTED · 收集',
    hud_best:      'BEST · 最佳',
    mission_start:  'SCAN START QR · 掃描 START QR 開始',
    mission_find:   'FIND 3 AZALEAS · 尋找 3 種杜鵑',
    mission_return: 'RETURN TO START · 返回 START 領取獎勵',
    toast_started:  'GO! · 遊戲開始',
    toast_scan_start_first: 'SCAN START FIRST · 請先掃描 START QR',
    reward_stamp:    'QUEST COMPLETE · 尋花已成',
    reward_title:    'Congratulations!',
    reward_subtitle: '你找齊全部杜鵑了',
    reward_message_perfect: 'You completed the campus azalea map. Show this screen at the Botany Club booth to claim a limited postcard.',
    reward_best:    'BEST · 最佳',
    reward_runs:    'RUNS · 完成次數',
    reward_close:   'CLOSE · 關閉',
    reward_replay:  'PLAY AGAIN · 再玩一次',
    map_title:      'Campus Quest Map',
    map_subtitle:   '校園尋花地圖',
    map_intro:      'Find 3 QR pins around the campus, scan to collect azaleas. Return to START for your reward.',
    map_foot:       '⚫ Black pins = QR locations · 黑色標記 = QR 位置',
  }
};

function applyLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang]?.[key] !== undefined) {
      el.textContent = i18n[lang][key];
    }
  });
  dom.langBtn?.classList.toggle('en', lang === 'en');
  document.body.classList.toggle('lang-zh', lang === 'zh');
  document.body.classList.toggle('lang-en', lang === 'en');
}

dom.langBtn?.addEventListener('click', () => {
  const newLang = currentLang === 'zh' ? 'en' : 'zh';
  applyLanguage(newLang);
  showLangToast(newLang === 'zh' ? '已切換為中文' : 'Switched to English');
});

applyLanguage('zh');

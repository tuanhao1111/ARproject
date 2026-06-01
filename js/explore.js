// ============================================================
// EXPLORE MODE — MindAR image-target plant guide
// ============================================================
// Flow:
//   1. User picks "Explore" → enter() mounts MindAR scene
//   2. User points camera at plant image (printed leaflet, signage, ...)
//   3. MindAR fires targetFound → show flower GLB + info card with
//      species name + scientific + brief description
//   4. User can tap info card to open full BIO modal
//
// Coord (MindAR): marker plane = XY, Z = OUT of marker. Different from AR.js.
//   - Y up = away from camera surface
//   - Use position "0 0 0" to anchor on the image plane
//   - Use rotation "0 0 0" — model stands up out of the image
//
// ⚠️ ASSET TODO: cần file ./Explore/targets.mind. Compile từ ảnh target
//    bằng tool: https://hiukim.github.io/mind-ar-js-doc/tools/compile
//    Mỗi ảnh = 1 targetIndex (0, 1, 2, ...). Thứ tự ảnh khi compile
//    PHẢI MATCH thứ tự SPECIES_EXPLORE bên dưới.

(function () {
  const App = window.App;
  if (!App) { console.error('[explore] common.js not loaded'); return; }

  // ----------------------------------------------------------
  // SPECIES TABLE — targetIndex matches order in targets.mind
  // ----------------------------------------------------------
  // To add: compile a new .mind including new target image, push
  // a matching entry below. targetIndex auto-derived from array order.
  const SPECIES_EXPLORE = [
    {
      name_zh: '平戶杜鵑',
      name_en: 'Hirado Azalea',
      scientific: 'Rhododendron × pulchrum',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 東亞地區 / 日本平戶',
      origin_en: 'Origin: East Asia / Hirado, Japan',
      desc_zh: '常綠灌木，喜酸性土壤與半遮蔭環境。3-5月盛放，五瓣對稱，花色極具觀賞價值。',
      desc_en: 'Evergreen shrub; thrives in acidic soil and semi-shade. Blooms March-May.',
      glb: './Explore/azalea.glb',
      scale: 0.5,
      position: '0 0 0.1',
      growth_zh: '常綠灌木，適生於酸性土壤（pH 4.5–5.5）與排水良好之半遮蔭環境。台灣校園常見種，亦為日本平戶起源之大型雜交種。',
      growth_en: 'An evergreen shrub thriving in acidic soil (pH 4.5–5.5) and well-drained, semi-shaded environments. A common species on Taiwan campuses, originating as a large hybrid from Hirado, Japan.',
      ph_text: 'pH 4.5 - 5.5',
      ph_left: '33%',
      light_pills_zh: ['半遮蔭', '避免強光'],
      light_pills_en: ['Semi-shaded', 'Avoid Intense Light'],
      tags_zh: ['酸性土', '半遮蔭', '春季'],
      tags_en: ['Acidic Soil', 'Semi-shaded', 'Spring'],
      form_zh: '株高 1–3 公尺，葉橢圓形革質。花色由純白至深桃紅，五瓣對稱，雄蕊 5–10 枚。',
      form_en: 'Shrub height 1–3 meters, leaves elliptical and leathery. Flower color ranges from pure white to deep pink, with 5 symmetrical petals and 5–10 stamens.',
      caution_zh: '全株含 <strong>grayanotoxin</strong> 毒素，誤食可致中毒。賞花無虞，請勿採食。',
      caution_en: 'The entire plant contains <strong>grayanotoxin</strong>, which is toxic if ingested. Admire the flowers, but do not consume them.'
    },
    {
      // ⚠️ TODO: targetIndex 1 — sửa name/scientific/desc cho khớp ẢNH target thứ 2
      //    đã compile trong Explore/targets.mind. Thay glb bằng model riêng khi có.
      name_zh: '久留米杜鵑',
      name_en: 'Kurume Azalea',
      scientific: 'Rhododendron × obtusum',
      family_zh: '杜鵑花科 Ericaceae',
      family_en: 'Ericaceae Family',
      origin_zh: '原產地: 日本九州久留米',
      origin_en: 'Origin: Kurume, Kyushu, Japan',
      desc_zh: '小葉常綠杜鵑，株型緊密，花朵密集成簇。耐修剪，校園綠籬常見。',
      desc_en: 'Small-leaved evergreen azalea with a compact habit and densely clustered blooms. Tolerates pruning; common as campus hedging.',
      glb: './Explore/kurume-azalea.glb', // ⚠️ PLACEHOLDER — đặt file GLB riêng vào Explore/
      scale: 0.5,
      position: '0 0 0.1',
      growth_zh: '小型常綠灌木，喜酸性土壤（pH 4.5–5.5）與半遮蔭。生長緩慢、分枝細密，適合作為矮籬與盆植。',
      growth_en: 'A small evergreen shrub favouring acidic soil (pH 4.5–5.5) and semi-shade. Slow-growing with fine, dense branching — well suited to low hedging and container planting.',
      ph_text: 'pH 4.5 - 5.5',
      ph_left: '33%',
      light_pills_zh: ['半遮蔭', '避免強光'],
      light_pills_en: ['Semi-shaded', 'Avoid Intense Light'],
      tags_zh: ['酸性土', '半遮蔭', '春季'],
      tags_en: ['Acidic Soil', 'Semi-shaded', 'Spring'],
      form_zh: '株高 0.5–1.5 公尺，葉小而密。花朵漏斗狀，色彩鮮明，盛花期幾乎覆滿全株。',
      form_en: 'Shrub height 0.5–1.5 meters, with small dense leaves. Funnel-shaped, vividly coloured flowers that almost cover the whole plant at peak bloom.',
      caution_zh: '全株含 <strong>grayanotoxin</strong> 毒素，誤食可致中毒。賞花無虞，請勿採食。',
      caution_en: 'The entire plant contains <strong>grayanotoxin</strong>, which is toxic if ingested. Admire the flowers, but do not consume them.'
    }
  ];

  const dom = App.dom;
  let currentSpeciesIdx = -1;
  let gestureHintShown = false;
  let gestureHintTimer = null;

  function updateActiveSpecimen(sp) {
    App.updateActiveSpecimen(sp);
  }

  function showGestureHint() {
    if (gestureHintShown) return;
    const panel = document.getElementById('gesture-hint');
    if (!panel) return;
    panel.classList.add('show');
    gestureHintShown = true;
    clearTimeout(gestureHintTimer);
    gestureHintTimer = setTimeout(dismissGestureHint, 6000);
  }

  function dismissGestureHint() {
    const panel = document.getElementById('gesture-hint');
    if (panel && panel.classList.contains('show')) {
      panel.classList.remove('show');
    }
    clearTimeout(gestureHintTimer);
  }

  // Dismiss on screen tap
  document.addEventListener('touchstart', dismissGestureHint, { passive: true });
  document.addEventListener('mousedown', dismissGestureHint);

  // ----------------------------------------------------------
  // INFO CARD — show species info when target detected
  // ----------------------------------------------------------
  function showInfoCard(idx) {
    const sp = SPECIES_EXPLORE[idx];
    if (!sp || !dom.exploreInfo) return;
    currentSpeciesIdx = idx;
    updateActiveSpecimen(sp);
    const lang = App.currentLang;
    const name  = lang === 'zh' ? sp.name_zh : sp.name_en;
    const brief = lang === 'zh' ? (sp.brief_zh || sp.desc_zh) : (sp.brief_en || sp.desc_en);
    dom.exploreInfo.querySelector('.ei-name').textContent = name;
    dom.exploreInfo.querySelector('.ei-latin').textContent = sp.scientific;
    dom.exploreInfo.querySelector('.ei-brief').textContent = brief;
    dom.exploreInfo.classList.add('show');
  }
  function hideInfoCard() {
    dom.exploreInfo?.classList.remove('show');
  }

  // ----------------------------------------------------------
  // SCENE MOUNT / UNMOUNT
  // ----------------------------------------------------------
  let sceneEl = null;
  let mindarSystem = null;
  let arReadyListener = null;
  let resizeListener = null;

  function buildScene() {
    const scene = document.createElement('a-scene');
    scene.id = 'ar-scene-explore';
    scene.setAttribute('embedded', '');
    scene.setAttribute('mindar-image', 'imageTargetSrc: ./Explore/targets.mind; autoStart: true; uiLoading: no; uiError: no; uiScanning: no;');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true; logarithmicDepthBuffer: true; preserveDrawingBuffer: true;');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');

    // MindAR camera — must specify look-controls disabled
    const cam = document.createElement('a-camera');
    cam.setAttribute('position', '0 0 0');
    cam.setAttribute('look-controls', 'enabled: false');
    scene.appendChild(cam);

    // Lighting
    const lAmb = document.createElement('a-entity');
    lAmb.setAttribute('light', 'type: ambient; color: #ffffff; intensity: 1.2');
    scene.appendChild(lAmb);
    const lDir = document.createElement('a-entity');
    lDir.setAttribute('light', 'type: directional; color: #ffffff; intensity: 0.7');
    lDir.setAttribute('position', '0 1 1');
    scene.appendChild(lDir);

    // One <a-entity mindar-image-target> per species
    SPECIES_EXPLORE.forEach((sp, i) => {
      const tgt = document.createElement('a-entity');
      tgt.setAttribute('mindar-image-target', `targetIndex: ${i}`);
      tgt.dataset.targetIndex = String(i);
      tgt.classList.add('mind-target');

      // Wrapper so user gestures (rotate/scale) don't fight the target anchor
      const wrap = document.createElement('a-entity');
      wrap.classList.add('mind-wrap');

      const model = document.createElement('a-gltf-model');
      model.setAttribute('src', sp.glb);
      model.setAttribute('position', sp.position || '0 0 0');
      model.setAttribute('scale', `${sp.scale} ${sp.scale} ${sp.scale}`);
      model.setAttribute('rotation', sp.rotation || '0 0 0');
      wrap.appendChild(model);

      tgt.appendChild(wrap);
      scene.appendChild(tgt);
    });

    return scene;
  }

  function wireTargetEvents() {
    sceneEl.querySelectorAll('[mindar-image-target]').forEach(tgt => {
      const idx = parseInt(tgt.dataset.targetIndex, 10);
      tgt.addEventListener('targetFound', () => {
        console.log('[explore] targetFound idx=' + idx);
        dom.scanHint?.classList.add('hide');
        showInfoCard(idx);
        // Show FABs after a small delay so user notices the flower first
        setTimeout(() => dom.fabs?.classList.add('show'), 400);
        // Show onboarding interactive gesture guide
        showGestureHint();
      });
      tgt.addEventListener('targetLost', () => {
        console.log('[explore] targetLost idx=' + idx);
        hideInfoCard();
        dom.fabs?.classList.remove('show');
        dismissGestureHint();
      });
    });
  }

  // ----------------------------------------------------------
  // LIFECYCLE
  // ----------------------------------------------------------
  // Swap scan-hint text to the explore-specific i18n key ("point at plant
  // image" instead of "point at QR marker"). Re-applies on language change.
  function setScanHintExplore(on) {
    const label = dom.scanHint?.querySelector('.label');
    if (!label) return;
    label.dataset.i18n = on ? 'scan_hint_explore' : 'scan_hint';
    App.applyLanguage(App.currentLang);
  }

  async function enter() {
    if (!window.AFRAME?.components['mindar-image']) {
      console.warn('[explore] mind-ar-js component missing — has the lib loaded?');
    }

    setScanHintExplore(true);
    dom.scanHint?.classList.remove('hide');
    hideInfoCard();

    sceneEl = buildScene();
    dom.sceneHost.appendChild(sceneEl);
    sceneEl.classList.add('active');

    await new Promise(resolve => {
      if (sceneEl.hasLoaded) resolve();
      else sceneEl.addEventListener('loaded', resolve, { once: true });
    });

    wireTargetEvents();

    // MindAR fires 'arReady' on the scene when image tracker is initialized
    arReadyListener = () => {
      dom.loading.classList.remove('active');
      dom.arUI.classList.add('active');
      App.enforceCameraSize();
      resizeListener = () => App.enforceCameraSize();
      window.addEventListener('resize', resizeListener);
      window.dispatchEvent(new Event('resize'));
    };
    sceneEl.addEventListener('arReady', arReadyListener, { once: true });
    // Fallback: in case arReady doesn't fire (e.g. no .mind file yet)
    setTimeout(() => {
      if (dom.loading.classList.contains('active')) arReadyListener?.();
    }, 4000);

    // MindAR error event
    sceneEl.addEventListener('arError', (e) => {
      console.error('[explore] arError', e);
      App.showError('MindAR Failed',
        'Could not load image targets. Check that ./Explore/targets.mind exists.',
        e.detail?.error?.message || '');
    });
  }

  async function exit() {
    setScanHintExplore(false);
    dismissGestureHint();
    gestureHintShown = false;
    if (resizeListener) {
      window.removeEventListener('resize', resizeListener);
      resizeListener = null;
    }
    hideInfoCard();
    if (sceneEl) {
      // MindAR system has stop() — call before DOM removal to release camera
      try {
        const sys = sceneEl.systems?.['mindar-image-system'];
        sys?.stop?.();
      } catch (e) { /* noop */ }
      sceneEl.parentNode?.removeChild(sceneEl);
      sceneEl = null;
    }
    // Also clean up any camera videos MindAR may have left on body
    document.querySelectorAll('body > video').forEach(v => {
      if (v.id === 'arjs-video' || v.srcObject) {
        try { v.srcObject?.getTracks().forEach(t => t.stop()); } catch (e) {}
        if (v.parentNode === document.body) v.parentNode.removeChild(v);
      }
    });
  }

  // ----------------------------------------------------------
  // GESTURES — rotate flower on swipe, scale on pinch
  // ----------------------------------------------------------
  // Only active while explore scene is mounted. Targets the .mind-wrap
  // of the currently-found species.
  const USER_SCALE_MIN = 0.3;
  const USER_SCALE_MAX = 3.0;
  let userScale = 1, userRot = { x: 0, y: 0 };
  let pinchStart = null, pinchStartScale = null;
  let oneStart = null, oneStartRot = null;

  function currentWrap() {
    if (currentSpeciesIdx < 0 || !sceneEl) return null;
    return sceneEl.querySelector(`[data-target-index="${currentSpeciesIdx}"] .mind-wrap`);
  }
  function applyTransform() {
    const w = currentWrap();
    if (!w?.object3D) return;
    w.object3D.scale.set(userScale, userScale, userScale);
    w.object3D.rotation.x = userRot.x * Math.PI / 180;
    w.object3D.rotation.y = userRot.y * Math.PI / 180;
  }

  const IGNORE = '.fab, .modal, .top-bar, button, .audio-player, .lc-stage, .lang-btn, #explore-info';
  function touchDist(a, b) {
    const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  document.addEventListener('touchstart', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;
    if (e.touches.length === 2) {
      pinchStart = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = userScale;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      oneStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      oneStartRot = { ...userRot };
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;
    if (e.touches.length === 2 && pinchStart) {
      const ratio = touchDist(e.touches[0], e.touches[1]) / pinchStart;
      userScale = Math.max(USER_SCALE_MIN, Math.min(USER_SCALE_MAX, pinchStartScale * ratio));
      applyTransform();
      e.preventDefault();
    } else if (e.touches.length === 1 && oneStart) {
      const dx = (e.touches[0].clientX - oneStart.x) / window.innerWidth;
      const dy = (e.touches[0].clientY - oneStart.y) / window.innerHeight;
      userRot.y = oneStartRot.y + dx * 360;
      userRot.x = Math.max(-80, Math.min(80, oneStartRot.x + dy * 360));
      applyTransform();
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) { pinchStart = null; oneStart = null; }
    else if (e.touches.length === 1) {
      pinchStart = null;
      oneStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      oneStartRot = { ...userRot };
    }
  });

  // Desktop: mouse drag = rotate, wheel = scale
  let mDragging = false, mStart = null, mStartRot = null;
  document.addEventListener('mousedown', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;
    mDragging = true;
    mStart = { x: e.clientX, y: e.clientY };
    mStartRot = { ...userRot };
  });
  document.addEventListener('mousemove', (e) => {
    if (!mDragging) return;
    const dx = (e.clientX - mStart.x) / window.innerWidth;
    const dy = (e.clientY - mStart.y) / window.innerHeight;
    userRot.y = mStartRot.y + dx * 360;
    userRot.x = Math.max(-80, Math.min(80, mStartRot.x + dy * 360));
    applyTransform();
  });
  document.addEventListener('mouseup', () => { mDragging = false; });
  document.addEventListener('wheel', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest('.modal, .info-card, .audio-player, .lang-btn, #explore-info')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    userScale = Math.max(USER_SCALE_MIN, Math.min(USER_SCALE_MAX, userScale * delta));
    applyTransform();
  }, { passive: false });

  // ----------------------------------------------------------
  // INFO CARD CLICK → open BIO modal for current species
  // ----------------------------------------------------------
  dom.exploreInfo?.addEventListener('click', () => {
    App.openModal(document.getElementById('modal-bio'));
  });

  // ----------------------------------------------------------
  // REGISTER + WIRE INTRO BUTTON
  // ----------------------------------------------------------
  App.registerMode({ name: 'explore', enter, exit });
  document.getElementById('start-btn')?.addEventListener('click', () => App.enterMode('explore'));

})();

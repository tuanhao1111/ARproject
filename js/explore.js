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
      glb: './Explore/flower-twigs.glb',
      scale: 0.5,
      position: '0.75 0 0',          // model đứng CẠNH PHẢI tấm thẻ (marker width=1, span x:-0.5..0.5)
      // Video timelapse nằm ĐÚNG vị trí tấm thẻ (marker plane). Tỉ lệ marker 1063×650 → h≈0.61.
      video: './Explore/azalea-bloom.mp4',
      videoWidth: 1,
      videoHeight: 0.61,
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
    }
  ];

  const dom = App.dom;
  let currentSpeciesIdx = -1;
  let gestureHintShown = false;
  let gestureHintTimer = null;

  const USER_SCALE_MIN = 0.3;
  const USER_SCALE_MAX = 3.0;
  let userScale = 1, userRot = { x: 0, y: 0 }, userPos = { x: 0, y: 0, z: 0 };
  let pinchStart = null, pinchStartScale = null, pinchMidStart = null, pinchStartPos = null;
  let oneStart = null, oneStartRot = null;

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
    // flower-twigs.glb nén Draco (31MB→1MB) → cần Draco decoder, nếu thiếu model-error.
    scene.setAttribute('gltf-model', 'dracoDecoderPath: https://www.gstatic.com/draco/v1/decoders/');
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

    // Asset pool — video textures must be registered here for reliable playback
    const assets = document.createElement('a-assets');
    SPECIES_EXPLORE.forEach((sp, i) => {
      if (!sp.video) return;
      const v = document.createElement('video');
      v.id = `explore-vid-${i}`;
      v.setAttribute('src', sp.video);
      v.setAttribute('loop', '');
      v.muted = true; v.setAttribute('muted', '');     // muted → autoplay allowed on mobile
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('crossorigin', 'anonymous');
      v.setAttribute('preload', 'auto');
      assets.appendChild(v);
    });
    scene.appendChild(assets);

    // One <a-entity mindar-image-target> per species
    SPECIES_EXPLORE.forEach((sp, i) => {
      const tgt = document.createElement('a-entity');
      tgt.setAttribute('mindar-image-target', `targetIndex: ${i}`);
      tgt.dataset.targetIndex = String(i);
      tgt.classList.add('mind-target');

      // Timelapse video — flat on the marker plane (the "card"). Direct child of
      // the target (NOT inside .mind-wrap) so it stays anchored while the user
      // rotates/scales the 3D model beside it.
      if (sp.video) {
        const vid = document.createElement('a-video');
        vid.classList.add('mind-video');
        vid.setAttribute('src', `#explore-vid-${i}`);
        vid.setAttribute('position', '0 0 0.01');   // tiny z so it sits just above the printed card
        vid.setAttribute('rotation', '0 0 0');
        vid.setAttribute('width', String(sp.videoWidth || 1));
        vid.setAttribute('height', String(sp.videoHeight || 0.61));
        tgt.appendChild(vid);
      }

      // Wrapper so user gestures (rotate/scale) don't fight the target anchor
      const wrap = document.createElement('a-entity');
      wrap.classList.add('mind-wrap');

      const model = document.createElement('a-gltf-model');
      model.setAttribute('src', sp.glb);
      model.setAttribute('position', sp.position || '0 0 0');
      model.setAttribute('scale', `${sp.scale} ${sp.scale} ${sp.scale}`);
      model.setAttribute('rotation', sp.rotation || '0 0 0');
      // Diagnostics: 31MB GLB có thể load chậm/fail trên mobile. Log để xác nhận.
      model.addEventListener('model-loaded', () => console.log('[explore] model-loaded idx=' + i));
      model.addEventListener('model-error', (e) => console.error('[explore] model-error idx=' + i, e.detail));
      wrap.appendChild(model);

      tgt.appendChild(wrap);
      scene.appendChild(tgt);
    });

    return scene;
  }

  // Play/stop the marker's timelapse video on found/lost.
  function setVideoPlaying(idx, on) {
    const v = document.getElementById(`explore-vid-${idx}`);
    if (!v) { console.warn('[explore] video el missing idx=' + idx); return; }
    if (on) {
      console.log('[explore] play video idx=' + idx + ' readyState=' + v.readyState);
      // Không reset currentTime=0: trên mobile, seek mỗi lần found gây giật/chập chờn.
      v.play()
        .then(() => console.log('[explore] video playing idx=' + idx))
        .catch(e => console.warn('[explore] video play failed idx=' + idx, e));
    } else { v.pause(); }
  }

  function wireTargetEvents() {
    sceneEl.querySelectorAll('[mindar-image-target]').forEach(tgt => {
      const idx = parseInt(tgt.dataset.targetIndex, 10);
      tgt.addEventListener('targetFound', () => {
        console.log('[explore] targetFound idx=' + idx);
        // DIAGNOSTIC: đọc SAU khi MindAR áp ma trận pose (nó set visible/matrix
        // NGAY SAU khi emit targetFound, nên phải đợi 1 frame mới đọc đúng).
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const m = tgt.querySelector('a-gltf-model');
          const camEl = sceneEl.querySelector('a-camera') || sceneEl.querySelector('[camera]');
          const cam = camEl && camEl.getObject3D('camera');
          const wp = new THREE.Vector3(), ws = new THREE.Vector3();
          if (m && m.object3D) { m.object3D.getWorldPosition(wp); m.object3D.getWorldScale(ws); }
          // Đếm Mesh thực sự trong GLB đã load
          let meshCount = 0;
          if (m && m.object3D) m.object3D.traverse(o => { if (o.isMesh) meshCount++; });
          // Chiếu vào NDC: nếu ndc.z > 1 → vượt far plane (bị clip xa); < -1 → trước near
          let ndcStr = 'n/a';
          if (cam) {
            const ndc = wp.clone().project(cam);
            ndcStr = ndc.x.toFixed(2) + ',' + ndc.y.toFixed(2) + ',' + ndc.z.toFixed(3);
          }
          console.log('[explore][diag] modelWorldPos=' + wp.x.toFixed(1) + ',' + wp.y.toFixed(1) + ',' + wp.z.toFixed(1) +
            ' worldScale=' + ws.x.toFixed(2) + ' meshes=' + meshCount +
            ' | cam far=' + (cam && cam.far) + ' near=' + (cam && cam.near) + ' fov=' + (cam && cam.fov) +
            ' | NDC=' + ndcStr + ' (|z|>1 => clipped)');
        }));
        
        // If there was a previously decoupled flower, re-dock it first!
        if (currentSpeciesIdx >= 0 && currentSpeciesIdx !== idx) {
          reDockFlower();
        }

        dom.scanHint?.classList.add('hide');
        dom.floatingMode?.classList.remove('active'); // Hide free mode overlay
        setVideoPlaying(idx, true);
        showInfoCard(idx);
        // Show FABs after a small delay so user notices the flower first
        setTimeout(() => dom.fabs?.classList.add('show'), 400);
        // Show onboarding interactive gesture guide
        showGestureHint();
      });
      tgt.addEventListener('targetLost', () => {
        console.log('[explore] targetLost idx=' + idx);
        setVideoPlaying(idx, false);
        const w = tgt.querySelector('.mind-wrap');
        if (w && w.dataset.decoupled === 'true') {
          // If decoupled, show free mode overlay and keep card/FABs active!
          dom.floatingMode?.classList.add('active');
          return;
        }
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

    // Reset gesture states
    userScale = 1;
    userRot = { x: 0, y: 0 };
    userPos = { x: 0, y: 0, z: 0 };

    document.getElementById('detach-controls')?.classList.remove('show');
    dom.floatingMode?.classList.remove('active');
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
    document.getElementById('detach-controls')?.classList.remove('show');
    dom.floatingMode?.classList.remove('active');
    if (resizeListener) {
      window.removeEventListener('resize', resizeListener);
      resizeListener = null;
    }
    hideInfoCard();
    if (sceneEl) {
      // Restore any decoupled wrappers to their original markers before removing the scene
      sceneEl.querySelectorAll('.mind-wrap').forEach(w => {
        if (w.dataset.decoupled === 'true') {
          const markerEl = w.closest('[mindar-image-target]');
          if (markerEl && markerEl.object3D && w.object3D) {
            markerEl.object3D.attach(w.object3D);
          }
          delete w.dataset.decoupled;
        }
      });

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
  // GESTURES — 1-finger: rotate | 2-finger pinch: scale | 2-finger pan: translate
  // Desktop: left-drag: rotate | right-drag: translate | wheel: scale
  // ----------------------------------------------------------
  // Only active while explore scene is mounted. Targets the .mind-wrap
  // of the currently-found species.

  function currentWrap() {
    if (currentSpeciesIdx < 0 || !sceneEl) return null;
    return sceneEl.querySelector(`[data-target-index="${currentSpeciesIdx}"] .mind-wrap`);
  }
  function applyTransform() {
    const w = currentWrap();
    if (!w) return;
    w.setAttribute('scale', `${userScale} ${userScale} ${userScale}`);
    w.setAttribute('rotation', `${userRot.x} ${userRot.y} 0`);
    w.setAttribute('position', `${userPos.x} ${userPos.y} ${userPos.z}`);
  }

  function decoupleFlower(w) {
    if (!w || !w.object3D) return;
    const cameraEl = sceneEl.querySelector('[camera]') || sceneEl.querySelector('a-camera');
    if (!cameraEl || !cameraEl.object3D) return;

    // Decouple by attaching in Three.js to the camera
    cameraEl.object3D.attach(w.object3D);

    // Update user coordinates in camera space
    userPos.x = w.object3D.position.x;
    userPos.y = w.object3D.position.y;
    userPos.z = w.object3D.position.z;

    // Extract euler rotation
    const euler = new THREE.Euler().setFromQuaternion(w.object3D.quaternion, 'YXZ');
    userRot.x = THREE.MathUtils.radToDeg(euler.x);
    userRot.y = THREE.MathUtils.radToDeg(euler.y);

    // Update user scale
    userScale = w.object3D.scale.x;

    w.dataset.decoupled = 'true';

    // Update touch/mouse starting states so the transition is perfectly smooth!
    if (pinchStart !== null) {
      pinchStartScale = userScale;
      pinchStartPos = { ...userPos };
    }
    if (oneStart) {
      oneStartRot = { ...userRot };
    }
    if (mDragging) {
      mStartPos = { ...userPos };
      mStartRot = { ...userRot };
    }

    // Show detach UI
    document.getElementById('detach-controls')?.classList.add('show');
    
    console.log('[decouple] Explore flower decoupled to camera space!', userPos, userRot, userScale);
  }

  function reDockFlower() {
    const w = currentWrap();
    if (!w || w.dataset.decoupled !== 'true') return;
    
    const markerEl = w.closest('[mindar-image-target]');
    if (markerEl && markerEl.object3D && w.object3D) {
      markerEl.object3D.attach(w.object3D);
    }
    
    // Reset to defaults
    const sp = SPECIES_EXPLORE[currentSpeciesIdx];
    userScale = 1;
    userRot = { x: 0, y: 0 };
    userPos = { x: 0, y: 0, z: 0.1 };
    
    w.setAttribute('scale', `${sp.scale} ${sp.scale} ${sp.scale}`);
    w.setAttribute('rotation', sp.rotation || '0 0 0');
    w.setAttribute('position', sp.position || '0 0 0.1');
    
    delete w.dataset.decoupled;
    
    // Hide UI
    document.getElementById('detach-controls')?.classList.remove('show');
    dom.floatingMode?.classList.remove('active');
    
    console.log('[decouple] Explore flower re-docked!');
  }

  const IGNORE = '.fab, .modal, .top-bar, button, .audio-player, .lc-stage, .lang-btn, #explore-info';
  function touchDist(a, b) {
    const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function touchMid(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  document.addEventListener('touchstart', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;
    if (e.touches.length === 2) {
      pinchStart = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = userScale;
      pinchMidStart = touchMid(e.touches[0], e.touches[1]);
      pinchStartPos = { ...userPos };
      oneStart = null;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      oneStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      oneStartRot = { ...userRot };
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;

    if (e.touches.length === 2 && pinchStart !== null) {
      const w = currentWrap();
      if (w && !w.dataset.decoupled) {
        decoupleFlower(w);
      }

      const currentDist = touchDist(e.touches[0], e.touches[1]);
      const currentMid = touchMid(e.touches[0], e.touches[1]);

      // 1. Zoom (pinch)
      const ratio = currentDist / pinchStart;
      userScale = Math.max(USER_SCALE_MIN, Math.min(USER_SCALE_MAX, pinchStartScale * ratio));

      // 2. Translate (pan) - Dragging two fingers translates the flower
      const panDx = currentMid.x - pinchMidStart.x;
      const panDy = currentMid.y - pinchMidStart.y;
      
      const sensitivity = 0.008;
      userPos.x = pinchStartPos.x + panDx * sensitivity;
      userPos.y = pinchStartPos.y - panDy * sensitivity; // drag up = move up

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
    if (e.touches.length === 0) {
      pinchStart = null; pinchMidStart = null; pinchStartPos = null;
      oneStart = null;
    } else if (e.touches.length === 1) {
      pinchStart = null; pinchMidStart = null; pinchStartPos = null;
      oneStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      oneStartRot = { ...userRot };
    }
  });

  // Desktop: left-drag = rotate, right-drag = translate, wheel = scale
  let mDragging = false, mButton = 0, mStart = null, mStartRot = null, mStartPos = null;
  document.addEventListener('mousedown', (e) => {
    if (!sceneEl || !document.body.classList.contains('explore-mode')) return;
    if (e.target.closest(IGNORE)) return;
    mDragging = true;
    mButton = e.button;
    mStart = { x: e.clientX, y: e.clientY };
    mStartRot = { ...userRot };
    mStartPos = { ...userPos };
    if (e.button === 2) e.preventDefault(); // suppress context menu
  });
  document.addEventListener('contextmenu', (e) => {
    if (sceneEl && document.body.classList.contains('explore-mode')) e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!mDragging || !mStart) return;
    const rawDx = e.clientX - mStart.x;
    const rawDy = e.clientY - mStart.y;
    if (mButton === 2) {
      // Right-drag: translate
      const w = currentWrap();
      if (w && !w.dataset.decoupled) {
        decoupleFlower(w);
      }
      const sensitivity = 0.015 * userScale;
      userPos.x = mStartPos.x + rawDx * sensitivity;
      userPos.y = mStartPos.y - rawDy * sensitivity;
    } else {
      // Left-drag: rotate
      const dx = rawDx / window.innerWidth;
      const dy = rawDy / window.innerHeight;
      userRot.y = mStartRot.y + dx * 360;
      userRot.x = Math.max(-80, Math.min(80, mStartRot.x + dy * 360));
    }
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
  // REGISTER + WIRE INTRO BUTTON AND RE-DOCK BUTTON
  // ----------------------------------------------------------
  App.registerMode({ name: 'explore', enter, exit });
  document.getElementById('start-btn')?.addEventListener('click', () => App.enterMode('explore'));
  document.getElementById('btn-reset-flower')?.addEventListener('click', () => {
    if (document.body.classList.contains('explore-mode')) {
      reDockFlower();
    }
  });

})();

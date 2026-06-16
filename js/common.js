// ============================================================
// COMMON — shared across Explore + Game modes
// ============================================================
// Exports: window.App = { dom, i18n, applyLanguage, showError,
//   showLangToast, closeAllModals, closeModal, registerMode,
//   setActiveMode, enterMode, exitActiveMode, ... }
//
// Both game.js and explore.js register themselves via App.registerMode
// and are activated via App.enterMode('game' | 'explore').

(function () {

  // ----------------------------------------------------------
  // CAMERA FALLBACK PATCH (desktop / restrictive constraints)
  // ----------------------------------------------------------
  if (navigator.mediaDevices?.getUserMedia) {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      try {
        return await original(constraints);
      } catch (err) {
        if (['OverconstrainedError', 'NotFoundError', 'NotReadableError'].includes(err.name)
            && constraints?.video && typeof constraints.video === 'object') {
          console.warn('[common] camera fallback to default:', err.name);
          return await original({ ...constraints, video: true });
        }
        throw err;
      }
    };
  }

  // ----------------------------------------------------------
  // DOM CACHE
  // ----------------------------------------------------------
  const dom = {
    intro:        document.getElementById('intro'),
    loading:      document.getElementById('loading'),
    loadingText:  document.getElementById('loading-text'),
    errorScreen:  document.getElementById('error-screen'),
    errorTitle:   document.getElementById('error-title'),
    errorMsg:     document.getElementById('error-msg'),
    errDetail:    document.getElementById('err-detail'),
    arUI:         document.getElementById('ar-ui'),
    sceneHost:    document.getElementById('scene-host'),
    scanHint:     document.getElementById('scan-hint'),
    fabs:         document.getElementById('fabs'),
    floatingMode: document.getElementById('floating-mode'),
    // Game-only refs (will be null if HTML elements missing)
    gameHud:      document.getElementById('game-hud'),
    gameMission:  document.getElementById('game-mission'),
    missionText:  document.getElementById('mission-text'),
    gameToast:    document.getElementById('game-toast'),
    toastText:    document.getElementById('toast-text'),
    hudCurrent:   document.getElementById('hud-score-current'),
    hudTotal:     document.getElementById('hud-score-total'),
    hudBest:      document.getElementById('hud-best-value'),
    rewardModal:  document.getElementById('reward-modal'),
    rewardScore:  document.getElementById('reward-score'),
    rewardBest:   document.getElementById('reward-best'),
    rewardRuns:   document.getElementById('reward-runs'),
    rewardMessage:document.getElementById('reward-message'),
    // i18n
    langBtn:      document.getElementById('lang-btn'),
    introLangToggle: document.getElementById('intro-lang-toggle'),
  };

  // ----------------------------------------------------------
  // I18N
  // ----------------------------------------------------------
  let currentLang = 'zh';
  let wasSoundOnBeforeAR = false;
  let isSoundOn = false;
  let audioCtx = null;
  let masterGain = null;

  const i18n = {
    zh: {
      back: '← 返回',
      specimen: '標本', specimen_en: '',
      scan_hint: '將鏡頭對準 QR 標記 · POINT AT THE QR MARKER',
      scan_hint_explore: '將鏡頭對準植物標記 · POINT AT THE PLANT IMAGE',
      floating_status: '自由模式 · FREE MODE',
      explore_btn: '開始尋花 · EXPLORE',
      game_btn: '遊戲模式 · GAME MODE',
      hud_collected: '收集 · COLLECTED',
      hud_best: '最佳 · BEST',
      mission_start:  '掃描 START QR 開始 · SCAN START QR',
      mission_find:   '尋找 4 種杜鵑 · FIND 4 AZALEAS',
      mission_return: '返回 START 領取獎勵 · RETURN TO START',
      toast_started:  '遊戲開始 · GO!',
      toast_scan_start_first: '請先掃描 START QR · SCAN START FIRST',
      reward_stamp:   '尋花已成 · QUEST COMPLETE',
      reward_title:   '恭喜！',
      reward_subtitle:'You found every azalea',
      reward_message_perfect: '你已完成校園杜鵑尋花地圖，請至植物學社攤位出示此畫面，領取限量明信片一張。',
      reward_best: '最佳 · BEST',
      reward_runs: '完成次數 · RUNS',
      reward_close: '關閉 · CLOSE',
      reward_replay:'再玩一次 · PLAY AGAIN',
      map_title:    '校園尋花地圖',
      map_subtitle: 'Campus quest map',
      map_intro:    '沿校園尋找 4 個 QR 標記點，掃描收集杜鵑。集齊後返回 START 領取獎勵。',
      map_foot:     '⚫ 黑色標記 = QR 位置 · Black pins = QR locations',
      capture_tooltip: '📸 拍照生成黃金標本',
      // New translations for intro screen
      intro_badge: '校園生態 · AR 導覽',
      intro_meta_sub: '生物學專題報告',
      intro_title_zh: '尋見<span class="accent">杜鵑</span>',
      intro_title_en: 'A bloom that lives by conditions',
      intro_desc: '杜鵑花以柔美姿態盛放，卻只在<em>酸性土壤、清涼氣候</em>下方能成形。將鏡頭對準 QR 標記，杜鵑將綻放於眼前，並開啟生態、影像、生命週期、聲音四個面向。',
      intro_card_badge: '🔍 生態空間分析標本 No. 001',
      intro_card_header: '粉紅杜鵑 (Rhododendron pulchrum)',
      intro_card_meta: '被子植物門 • 杜鵑花科',
      intro_credits: '校園植物學社',
      intro_active_botanists: 'ACTIVE BOTANISTS',
      // New translations for modals
      bio_growth_title: '生長條件 · Growth Conditions',
      bio_soil_ph: '土壤酸鹼度 · Soil pH',
      bio_ph_acidic: 'Acidic (pH 4)',
      bio_ph_neutral: 'Neutral (pH 7)',
      bio_ph_alkaline: 'Alkaline (pH 10)',
      bio_sunlight: '日照環境 · Light Requirement',
      bio_form_title: '形態 · Form',
      bio_caution_title: '注意 · Caution',
      video_title: '花開時序',
      video_subtitle: 'Time-lapse footage',
      video_desc: '陽明山國家公園杜鵑花盛開縮時影像（4K）。從花苞至盛開的瞬間，記錄春日清晨的綻放過程。',
      video_note: '※ 替換 iframe 中的 YouTube ID 即可換成你的影片。',
      life_title: '生命週期',
      life_subtitle: 'Annual lifecycle',
      life_intro: '點選各階段以查看詳細說明 · Tap a stage to see details',
      life_stage_1: '芽',
      life_stage_2: '蕾',
      life_stage_3: '花',
      life_stage_4: '果',
      audio_title: '聲音導覽',
      audio_subtitle: 'Audio Guide',
      audio_chinese_nav: '中文導覽',
      audio_english_nav: 'English Narration',
      audio_sec_zh: '~ 30 秒',
      audio_sec_en: '~ 30 sec',
      audio_note: '※ 使用瀏覽器 Web Speech API 即時生成。如需自錄音檔，可替換為 &lt;audio src="azalea.mp3"&gt;。',
      detach_status: '自由飛翔 · FREE FLIGHT',
      detach_hint: '雙指移動，單指旋轉',
      btn_reset_flower: '重設位置 · RE-DOCK'
    },
    en: {
      back: '← BACK',
      specimen: 'SPECIMEN', specimen_en: '',
      scan_hint: 'POINT AT THE QR MARKER · 將鏡頭對準 QR 標記',
      scan_hint_explore: 'POINT AT THE PLANT IMAGE · 將鏡頭對準植物標記',
      floating_status: 'FREE MODE · 自由模式',
      explore_btn: 'EXPLORE · 開始尋花',
      game_btn:    'GAME MODE · 遊戲模式',
      hud_collected: 'COLLECTED · 收集',
      hud_best:      'BEST · 最佳',
      mission_start:  'SCAN START QR · 掃描 START QR 開始',
      mission_find:   'FIND 4 AZALEAS · 尋找 4 種杜鵑',
      mission_return: 'RETURN TO START · 返回 START 領取獎勵',
      toast_started:  'GO! · 遊戲開始',
      toast_scan_start_first: 'SCAN START FIRST · 請先掃描 START QR',
      reward_stamp:    'QUEST COMPLETE · 尋花已成',
      reward_title:    'Congratulations!',
      reward_subtitle: '你找齊全部杜鵑了',
      reward_message_perfect: 'You completed the campus azalea map. Show this screen at the Botany Club booth to claim a limited postcard.',
      reward_best: 'BEST · 最佳',
      reward_runs: 'RUNS · 完成次數',
      reward_close: 'CLOSE · 關閉',
      reward_replay:'PLAY AGAIN · 再玩一次',
      map_title:    'Campus Quest Map',
      map_subtitle: '校園尋花地圖',
      map_intro:    'Find 4 QR pins around the campus, scan to collect azaleas. Return to START for your reward.',
      map_foot:     '⚫ Black pins = QR locations · 黑色標記 = QR 位置',
      capture_tooltip: '📸 Capture Golden Specimen',
      // New translations for intro screen
      intro_badge: 'Campus Ecology · AR Tour',
      intro_meta_sub: 'Biology Special Report',
      intro_title_zh: 'Finding <span class="accent">Azaleas</span>',
      intro_title_en: 'A bloom that lives by conditions',
      intro_desc: 'Azaleas bloom with gentle grace, yet they only thrive in <em>acidic soil and cool climates</em>. Point your camera at the QR marker to watch the azalea bloom and unlock four dimensions: ecology, video, lifecycle, and audio.',
      intro_card_badge: '🔍 Spatially Analyzed Specimen No. 001',
      intro_card_header: 'Rhododendron pulchrum',
      intro_card_meta: 'Division: Angiosperms • Family: Ericaceae',
      intro_credits: 'Campus Botany Club',
      intro_active_botanists: 'ACTIVE BOTANISTS',
      // New translations for modals
      bio_growth_title: 'Growth Conditions · 生長條件',
      bio_soil_ph: 'Soil pH · 土壤酸鹼度',
      bio_ph_acidic: 'Acidic (pH 4)',
      bio_ph_neutral: 'Neutral (pH 7)',
      bio_ph_alkaline: 'Alkaline (pH 10)',
      bio_sunlight: 'Light Requirement · 日照環境',
      bio_form_title: 'Form · 形態',
      bio_caution_title: 'Caution · 注意',
      video_title: 'Time-lapse',
      video_subtitle: '花開時序縮時',
      video_desc: 'Time-lapse footage of blooming azaleas in Yangmingshan National Park (4K). Capture the precise moment from bud to full blossom during a fresh spring morning.',
      video_note: '* Replace the YouTube ID in the iframe to use your own video.',
      life_title: 'Life Cycle',
      life_subtitle: '生命週期',
      life_intro: 'Tap a stage to see details · 點選各階段以查看詳細說明',
      life_stage_1: 'Bud',
      life_stage_2: 'Pre-bloom',
      life_stage_3: 'Bloom',
      life_stage_4: 'Fruit',
      audio_title: 'Audio Guide',
      audio_subtitle: '聲音導覽口述',
      audio_chinese_nav: 'Chinese Narration',
      audio_english_nav: 'English Narration',
      audio_sec_zh: '~ 30 sec',
      audio_sec_en: '~ 30 秒',
      audio_note: '* Generated in real-time using browser Web Speech API. For custom audio files, replace with &lt;audio src="azalea.mp3"&gt;.',
      detach_status: 'FREE FLIGHT · 自由飛翔',
      detach_hint: 'Drag 2 fingers to move, 1 to rotate',
      btn_reset_flower: 'RE-DOCK · 重設位置'
    }
  };

  function applyLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (i18n[lang]?.[key] !== undefined) {
        const val = i18n[lang][key];
        if (val.includes('<') && val.includes('>')) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });
    dom.langBtn?.classList.toggle('en', lang === 'en');
    document.body.classList.toggle('lang-zh', lang === 'zh');
    document.body.classList.toggle('lang-en', lang === 'en');

    // Update dynamic BIO modal content on language change
    updateBioModalContent();
  }

  // ----------------------------------------------------------
  // ERROR + TOAST
  // ----------------------------------------------------------
  function showError(title, msg, detail) {
    dom.errorTitle.textContent = title;
    dom.errorMsg.textContent = msg;
    dom.errDetail.textContent = detail || '';
    dom.errDetail.style.display = detail ? 'block' : 'none';
    dom.loading.classList.remove('active');
    dom.errorScreen.classList.add('active');
  }

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

  // ----------------------------------------------------------
  // MODE REGISTRY
  // ----------------------------------------------------------
  // Each mode registers an object: { name, enter(), exit() }
  // enter() is async — should resolve when AR scene is ready.
  // exit() should unmount its scene and clean up listeners.
  const modes = {};
  let activeMode = null;

  function registerMode(modeObj) {
    if (!modeObj?.name) throw new Error('mode missing name');
    modes[modeObj.name] = modeObj;
  }

  async function enterMode(name) {
    const mode = modes[name];
    if (!mode) { console.error('[common] unknown mode:', name); return; }
    if (activeMode) await exitActiveMode();
    activeMode = mode;

    // Preserve and temporarily suspend sound during AR mode to avoid interference
    if (isSoundOn) {
      wasSoundOnBeforeAR = true;
      isSoundOn = false;
      const soundToggle = document.getElementById('intro-sound-toggle');
      if (soundToggle) {
        soundToggle.classList.remove('active');
        soundToggle.innerHTML = svgSoundOff;
      }
      stopAmbientSynth();
    } else {
      wasSoundOnBeforeAR = false;
    }

    // Set body class — CSS uses .game-mode / .explore-mode for visibility
    document.body.classList.toggle('game-mode',    name === 'game');
    document.body.classList.toggle('explore-mode', name === 'explore');

    const isSecure = window.isSecureContext ||
                     ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!isSecure) {
      showError('Insecure Context', 'Web AR requires HTTPS or localhost.',
        'Current URL: ' + location.href);
      activeMode = null;
      return;
    }

    dom.intro.classList.add('fade-out');
    if (botanistInterval) { clearInterval(botanistInterval); botanistInterval = null; }
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
      activeMode = null;
      return;
    }

    dom.loadingText.textContent = 'Loading AR engine...';
    try {
      await mode.enter();
    } catch (err) {
      console.error('[common] mode enter failed:', err);
      showError('AR Start Failed', 'Could not start ' + name + ' mode.',
        err.message || String(err));
      activeMode = null;
    }

    // Lazy-load floating video for explore mode
    if (name === 'explore') {
      const fv = document.getElementById('floating-video-el');
      if (fv && !fv.src) fv.src = './Explore/azalea-bloom.mp4';
    }
  }

  async function exitActiveMode() {
    if (!activeMode) return;
    try { await activeMode.exit(); }
    catch (err) { console.error('[common] mode exit failed:', err); }
    activeMode = null;
    document.body.classList.remove('game-mode', 'explore-mode');
  }

  document.getElementById('back-btn')?.addEventListener('click', async () => {
    closeAllModals();
    await exitActiveMode();
    stopConfetti();
    dom.arUI.classList.remove('active');
    dom.fabs?.classList.remove('show');
    dom.gameHud?.classList.remove('active');
    dom.gameMission?.classList.remove('active');
    dom.rewardModal?.classList.remove('active');
    dom.intro.style.display = 'flex';
    dom.intro.classList.remove('fade-out');
    
    // Re-trigger the stunning cinematic entry sequence
    triggerCinematicIntro();
    startBotanistHud();

    // Restore acoustic garden state if active before entering AR
    if (wasSoundOnBeforeAR) {
      isSoundOn = true;
      const soundToggle = document.getElementById('intro-sound-toggle');
      if (soundToggle) {
        soundToggle.classList.add('active');
        soundToggle.innerHTML = svgSoundOn;
      }
      await startAmbientSynth();
      wasSoundOnBeforeAR = false;
    }
  });

  document.getElementById('error-retry')?.addEventListener('click', () => {
    dom.errorScreen.classList.remove('active');
    dom.intro.classList.remove('fade-out');
    dom.intro.style.display = 'flex';
  });

  // ----------------------------------------------------------
  // MODALS — generic open/close (BIO/VIDEO/LIFE/AUDIO/MAP)
  // ----------------------------------------------------------
  let lastFocusBeforeModal = null;
  function openModal(modal) {
    if (!modal) return;
    closeAllModals();
    lastFocusBeforeModal = document.activeElement;
    modal.classList.add('show');
    const first = modal.querySelector('.modal-close, button, [tabindex]');
    if (first) first.focus();
  }
  function closeModal(modal) {
    modal.classList.remove('show');
    modal.querySelectorAll('iframe').forEach(i => { const s = i.src; i.src = ''; i.src = s; });
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.querySelectorAll('.audio-btn.playing').forEach(b => b.classList.remove('playing'));
    if (lastFocusBeforeModal) { lastFocusBeforeModal.focus(); lastFocusBeforeModal = null; }
  }
  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => closeModal(m));
  }
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });

  // FAB → open corresponding modal (data-action="bio" → #modal-bio)
  document.querySelectorAll('.fab').forEach(fab => {
    fab.addEventListener('click', () => {
      const action = fab.dataset.action;
      if (action === 'capture') {
        if (typeof window.App.captureSpecimen === 'function') {
          window.App.captureSpecimen();
        }
        return;
      }
      const modal = document.getElementById('modal-' + action);
      openModal(modal);
    });
  });

  // ----------------------------------------------------------
  // LIFECYCLE STAGES (modal-life)
  // ----------------------------------------------------------
  const lifecycleData = {
    zh: [
      { title: '芽期 · Bud Stage',  desc: '冬末春初，杜鵑於枝端形成花芽。芽鱗片緊閉，包覆著未來的花朵。低溫累積對花芽分化十分關鍵。' },
      { title: '蕾期 · Pre-bloom', desc: '花苞膨大，外層鱗片裂開，露出粉紅色花瓣。此時需要充足光照與適度濕度，溫度回升加速綻放。' },
      { title: '花期 · Bloom',     desc: '3–5 月盛放，五瓣對稱，雄蕊外露。花色由純白、淡粉至深桃紅，吸引蝴蝶與蜜蜂授粉。' },
      { title: '果期 · Fruit',     desc: '花後結蒴果，6 月成熟裂開，散播微小種子。一個蒴果可含數百枚種子，藉風力傳播。' }
    ],
    en: [
      { title: 'Bud Stage · 芽期',  desc: 'In late winter and early spring, azaleas form flower buds at branch tips. The tightly closed scales protect the future blossoms. Accumulated cold is vital for bud differentiation.' },
      { title: 'Pre-bloom · 蕾期', desc: 'The buds swell, and the outer scales split open to reveal pinkish petals. This phase requires ample light and moderate humidity, with rising temperatures accelerating bloom.' },
      { title: 'Bloom · 花期',     desc: 'Blooming from March to May, with five symmetrical petals and prominent stamens. Colors range from pure white and light pink to deep rose, attracting butterflies and bees for pollination.' },
      { title: 'Fruit · 果期',     desc: 'Capsules form after flowering and mature in June, splitting open to disperse tiny seeds. A single capsule can contain hundreds of seeds, which are spread by the wind.' }
    ]
  };
  const lcTitle = document.getElementById('lc-title');
  const lcDesc  = document.getElementById('lc-desc');
  document.querySelectorAll('.lc-stage').forEach(stage => {
    stage.addEventListener('click', () => {
      document.querySelectorAll('.lc-stage').forEach(s => s.classList.remove('active'));
      stage.classList.add('active');
      const data = lifecycleData[currentLang][parseInt(stage.dataset.stage, 10)];
      if (data && lcTitle && lcDesc) { lcTitle.textContent = data.title; lcDesc.textContent = data.desc; }
    });
  });

  // ----------------------------------------------------------
  // AUDIO (Web Speech API)
  // ----------------------------------------------------------
  const narrationText = {
    'zh-TW': '杜鵑花，學名 Rhododendron pulchrum，原產於東亞地區。是常綠灌木，喜酸性土壤與半遮蔭環境。每年三月至五月盛開，花色從純白到深粉紅，象徵春日的回歸與校園的青春記憶。',
    'en-US': 'The Hirado azalea, scientific name Rhododendron pulchrum, is native to East Asia. It is an evergreen shrub that thrives in acidic soil and semi-shaded conditions. Blooming from March to May, its flowers range from pure white to deep pink, symbolizing the return of spring and the memory of campus youth.'
  };
  document.querySelectorAll('.audio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (!window.speechSynthesis) { showLangToast('Speech API unavailable'); return; }
      if (btn.classList.contains('playing')) {
        speechSynthesis.cancel(); btn.classList.remove('playing'); return;
      }
      speechSynthesis.cancel();
      document.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('playing'));
      const utter = new SpeechSynthesisUtterance(narrationText[lang]);
      utter.lang = lang; utter.rate = 0.95; utter.pitch = 1.0;
      utter.onend = () => btn.classList.remove('playing');
      utter.onerror = () => btn.classList.remove('playing');
      btn.classList.add('playing');
      speechSynthesis.speak(utter);
    });
  });

  // ----------------------------------------------------------
  // LANGUAGE TOGGLE
  // ----------------------------------------------------------
  const toggleLanguage = () => {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    applyLanguage(newLang);
    showLangToast(newLang === 'zh' ? '已切換為中文' : 'Switched to English');
  };

  dom.langBtn?.addEventListener('click', toggleLanguage);
  dom.introLangToggle?.addEventListener('click', toggleLanguage);

  // ----------------------------------------------------------
  // CAMERA VIDEO SIZE — both libs inject <video> on body level
  // ----------------------------------------------------------
  // AR.js → id="arjs-video", MindAR → element with class .a-canvas sibling.
  // Force fullscreen so 3D canvas overlays correctly.
  function enforceCameraSize() {
    const v = document.getElementById('arjs-video') || document.querySelector('video[autoplay][playsinline]');
    if (!v) return;
    ['position','top','left'].forEach(p => v.style.setProperty(p, p === 'position' ? 'fixed' : '0', 'important'));
    ['width','min-width'].forEach(p => v.style.setProperty(p, '100vw', 'important'));
    ['height','min-height'].forEach(p => v.style.setProperty(p, '100vh', 'important'));
    v.style.setProperty('object-fit', 'cover', 'important');
    v.style.setProperty('transform', 'none', 'important');
    v.style.setProperty('margin', '0', 'important');
    v.style.setProperty('z-index', '1', 'important');
  }

  // ----------------------------------------------------------
  // SPECIMEN CAMERA CAPTURE MODE
  // ----------------------------------------------------------
  const activeSpecimen = {
    name_zh: '粉紅杜鵑',
    name_en: 'Hirado Azalea',
    scientific: 'Rhododendron × pulchrum',
    family_zh: '杜鵑花科 Ericaceae',
    family_en: 'Ericaceae Family',
    origin_zh: '原產地: 東亞地區',
    origin_en: 'Origin: East Asia',
    desc_zh: '常綠灌木，喜酸性土壤與半遮蔭環境。3-5月盛放。',
    desc_en: 'Evergreen shrub; thrives in acidic soil and semi-shade. Blooms March-May.',
    // Detailed fields for BIO modal:
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
  };

  function updateActiveSpecimen(sp) {
    if (!activeSpecimen || !sp) return;
    Object.assign(activeSpecimen, {
      name_zh: sp.name_zh || activeSpecimen.name_zh,
      name_en: sp.name_en || activeSpecimen.name_en,
      scientific: sp.scientific || activeSpecimen.scientific,
      family_zh: sp.family_zh || activeSpecimen.family_zh,
      family_en: sp.family_en || activeSpecimen.family_en,
      origin_zh: sp.origin_zh || activeSpecimen.origin_zh,
      origin_en: sp.origin_en || activeSpecimen.origin_en,
      desc_zh: sp.desc_zh || activeSpecimen.desc_zh,
      desc_en: sp.desc_en || activeSpecimen.desc_en,
      growth_zh: sp.growth_zh,
      growth_en: sp.growth_en,
      ph_text: sp.ph_text,
      ph_left: sp.ph_left,
      light_pills_zh: sp.light_pills_zh,
      light_pills_en: sp.light_pills_en,
      tags_zh: sp.tags_zh,
      tags_en: sp.tags_en,
      form_zh: sp.form_zh,
      form_en: sp.form_en,
      caution_zh: sp.caution_zh,
      caution_en: sp.caution_en,
    });
    updateBioModalContent();
  }

  function updateBioModalContent() {
    const titleEl = document.getElementById('bio-modal-title');
    const growthDescEl = document.getElementById('bio-growth-desc');
    const phMarkerEl = document.getElementById('bio-ph-marker');
    const lightPill1 = document.getElementById('bio-light-pill-1');
    const lightPill2 = document.getElementById('bio-light-pill-2');
    const tagsWrap = document.getElementById('bio-tags-wrap');
    const formDescEl = document.getElementById('bio-form-desc');
    const cautionDescEl = document.getElementById('bio-caution-desc');

    const sp = activeSpecimen;
    const lang = currentLang;

    if (!sp) return;

    if (titleEl) {
      const name = lang === 'zh' ? (sp.name_zh || sp.name) : (sp.name_en || sp.name);
      titleEl.innerHTML = `${name} <span class="latin">${sp.scientific || ''}</span>`;
    }
    if (growthDescEl) {
      growthDescEl.textContent = lang === 'zh' ? (sp.growth_zh || sp.desc_zh) : (sp.growth_en || sp.desc_en);
    }
    if (phMarkerEl) {
      phMarkerEl.textContent = sp.ph_text || 'pH 4.5 - 5.5';
      phMarkerEl.style.left = sp.ph_left || '33%';
    }
    if (lightPill1 && sp.light_pills_zh && sp.light_pills_en) {
      lightPill1.textContent = lang === 'zh' ? sp.light_pills_zh[0] : sp.light_pills_en[0];
    }
    if (lightPill2 && sp.light_pills_zh && sp.light_pills_en) {
      lightPill2.textContent = lang === 'zh' ? sp.light_pills_zh[1] : sp.light_pills_en[1];
    }
    if (tagsWrap && sp.tags_zh && sp.tags_en) {
      tagsWrap.innerHTML = '';
      const tags = lang === 'zh' ? sp.tags_zh : sp.tags_en;
      tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        tagsWrap.appendChild(span);
      });
    }
    if (formDescEl) {
      formDescEl.textContent = lang === 'zh' ? sp.form_zh : sp.form_en;
    }
    if (cautionDescEl) {
      cautionDescEl.innerHTML = lang === 'zh' ? sp.caution_zh : sp.caution_en;
    }
  }

  function drawImageCover(ctx, img, w, h) {
    const imgW = img.videoWidth || img.width || w;
    const imgH = img.videoHeight || img.height || h;
    const imgAspect = imgW / imgH;
    const canvasAspect = w / h;
    let sx = 0, sy = 0, sWidth = imgW, sHeight = imgH;
    if (imgAspect > canvasAspect) {
      sWidth = imgH * canvasAspect;
      sx = (imgW - sWidth) / 2;
    } else {
      sHeight = imgW / canvasAspect;
      sy = (imgH - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, w, h);
  }

  async function captureSpecimen() {
    // 1. Shutter Sound / Flash
    const flash = document.getElementById('screen-flash');
    if (flash) {
      flash.classList.add('fire');
      setTimeout(() => flash.classList.remove('fire'), 450);
    }

    // 2. Hide all overlays
    document.body.classList.add('capturing');

    // 3. Small delay to let DOM lay out and renderer finish
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      const webglCanvas = document.querySelector('.a-canvas');
      if (!webglCanvas) {
        console.error('[capture] WebGL canvas not found');
        showLangToast(currentLang === 'zh' ? '拍照失敗：場景未就緒' : 'Capture failed: Scene not ready');
        document.body.classList.remove('capturing');
        return;
      }

      // Find the camera background video
      const video = document.getElementById('arjs-video') || 
                    document.querySelector('video[autoplay]') || 
                    document.querySelector('video');

      if (!video) {
        console.error('[capture] Camera video element not found');
        showLangToast(currentLang === 'zh' ? '拍照失敗：未找到相機畫面' : 'Capture failed: Camera stream not found');
        document.body.classList.remove('capturing');
        return;
      }

      // Create high-DPI offscreen canvas matching WebGL resolution
      const w = webglCanvas.width;
      const h = webglCanvas.height;
      
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');

      // A. Draw video cover
      drawImageCover(ctx, video, w, h);

      // B. Draw WebGL canvas (A-Frame content)
      ctx.drawImage(webglCanvas, 0, 0, w, h);

      // C. Draw premium double gold border frame
      const padding = Math.round(w * 0.04);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = Math.max(2, Math.round(w * 0.005));
      ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);

      const innerPadding = padding + Math.round(w * 0.01);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
      ctx.lineWidth = Math.max(1, Math.round(w * 0.002));
      ctx.strokeRect(innerPadding, innerPadding, w - innerPadding * 2, h - innerPadding * 2);

      // Draw classy corner accents
      const cornerLen = Math.round(w * 0.03);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = Math.max(3, Math.round(w * 0.007));

      // TL
      ctx.beginPath(); ctx.moveTo(padding, padding + cornerLen); ctx.lineTo(padding, padding); ctx.lineTo(padding + cornerLen, padding); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(w - padding, padding + cornerLen); ctx.lineTo(w - padding, padding); ctx.lineTo(w - padding - cornerLen, padding); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(padding, h - padding - cornerLen); ctx.lineTo(padding, h - padding); ctx.lineTo(padding + cornerLen, h - padding); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(w - padding, h - padding - cornerLen); ctx.lineTo(w - padding, h - padding); ctx.lineTo(w - padding - cornerLen, h - padding); ctx.stroke();

      // D. Draw bottom taxonomy card
      const cardW = Math.round(w * 0.84);
      const cardH = Math.round(h * 0.22);
      const cardX = (w - cardW) / 2;
      const cardY = h - cardH - Math.round(h * 0.06);
      const radius = Math.round(w * 0.03);

      ctx.fillStyle = 'rgba(26, 14, 20, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = Math.max(1, Math.round(w * 0.002));
      ctx.stroke();

      // E. Draw Text inside card
      const fSizeTitle = Math.max(12, Math.round(w * 0.024));
      const fSizeName = Math.max(16, Math.round(w * 0.036));
      const fSizeLatin = Math.max(12, Math.round(w * 0.026));
      const fSizeMeta = Math.max(10, Math.round(w * 0.020));

      const paddingX = Math.round(cardW * 0.05);
      const paddingY = Math.round(cardH * 0.08);

      // Title
      ctx.fillStyle = '#d4af37';
      ctx.font = `600 ${fSizeTitle}px 'Noto Serif TC', serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('AZALEA SPECIMEN JOURNAL · 杜鵑花標本誌', cardX + paddingX, cardY + paddingY);

      // Line
      const lineY = cardY + paddingY + fSizeTitle + Math.round(cardH * 0.05);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + paddingX, lineY);
      ctx.lineTo(cardX + cardW - paddingX, lineY);
      ctx.stroke();

      // Left-side Species Name (Chinese + English)
      const contentY = lineY + Math.round(cardH * 0.08);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${fSizeName}px 'Noto Serif TC', serif`;
      const nameZH = activeSpecimen.name_zh || '粉紅杜鵑';
      const nameEN = activeSpecimen.name_en || 'Hirado Azalea';
      ctx.fillText(`${nameZH} (${nameEN})`, cardX + paddingX, contentY);

      // Left-side Latin
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = `italic 400 ${fSizeLatin}px 'Cormorant Garamond', serif`;
      ctx.fillText(activeSpecimen.scientific || 'Rhododendron × pulchrum', cardX + paddingX, contentY + fSizeName + Math.round(cardH * 0.04));

      // Right-side Meta
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = `400 ${fSizeMeta}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = 'right';

      const metaX = cardX + cardW - paddingX;
      const metaY1 = contentY;
      const metaY2 = contentY + fSizeMeta + Math.max(4, Math.round(cardH * 0.03));
      const metaY3 = metaY2 + fSizeMeta + Math.max(4, Math.round(cardH * 0.03));

      ctx.fillText(activeSpecimen.family_zh || '杜鵑花科 Ericaceae', metaX, metaY1);
      ctx.fillText(activeSpecimen.origin_zh || '原產地: 東亞地區', metaX, metaY2);

      const dateStr = new Date().toLocaleDateString(currentLang === 'zh' ? 'zh-TW' : 'en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      ctx.fillText(`CAPTURE: ${dateStr}`, metaX, metaY3);

      // Save image
      const dataUrl = offscreen.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanName = (activeSpecimen.name_en || 'Specimen').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `${cleanName}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      showLangToast(currentLang === 'zh' ? '標本拍照已儲存！' : 'Specimen capture saved!');

    } catch (err) {
      console.error('[capture] composite failed:', err);
      showLangToast('Capture error: ' + err.message);
    } finally {
      document.body.classList.remove('capturing');
    }
  }

  // ----------------------------------------------------------
  // CAPTURE TOOLTIP AUTO-HIDE
  // ----------------------------------------------------------
  let tooltipTimeout = null;
  function triggerCaptureTooltip() {
    const tooltip = document.getElementById('capture-tooltip');
    if (!tooltip) return;
    
    // Clear any existing timeout
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
    }
    
    // Show tooltip
    tooltip.classList.add('show');
    
    // Hide after 4 seconds
    tooltipTimeout = setTimeout(() => {
      tooltip.classList.remove('show');
    }, 4000);
  }

  // Observe when FABs are shown to automatically trigger tooltip
  if (dom.fabs) {
    let lastShown = false;
    const observer = new MutationObserver(() => {
      const isShown = dom.fabs.classList.contains('show');
      if (isShown && !lastShown) {
        triggerCaptureTooltip();
      }
      lastShown = isShown;
    });
    observer.observe(dom.fabs, { attributes: true, attributeFilter: ['class'] });
  }

  // ----------------------------------------------------------
  // CONFETTI CELEBRATION (GOLDEN RAIN)
  // ----------------------------------------------------------
  function spawnConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    
    // Clear existing
    container.innerHTML = '';
    
    const colors = [
      '#c9a961', // Gold
      '#ffeaa7', // Pale Gold
      '#d4af37', // Metallic Gold
      '#faf6f1', // Cotton Cream
      '#e8a5c0'  // Azalea Blush
    ];
    
    const count = 80;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.classList.add('confetti-piece');
      
      // Random positioning and styling
      const left = Math.random() * 100; // 0% to 100% width
      const size = Math.random() * 6 + 6; // 6px to 12px
      const color = colors[Math.floor(Math.random() * colors.length)];
      const delay = Math.random() * 3; // 0s to 3s delay
      const duration = Math.random() * 2 + 2; // 2s to 4s fall duration
      const shape = Math.random() > 0.5 ? '50%' : '2px'; // round or square
      
      piece.style.left = `${left}%`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size}px`;
      piece.style.background = color;
      piece.style.borderRadius = shape;
      piece.style.animation = `fallConfetti ${duration}s linear ${delay}s infinite`;
      
      container.appendChild(piece);
    }
  }

  function stopConfetti() {
    const container = document.getElementById('confetti-container');
    if (container) container.innerHTML = '';
  }

  // ==========================================================
  // STAGE 5: ROYAL MUSEUM INTRO, SPOTLIGHT, LIVE HUD, NIGHT THEME, & WEBAUDIO SYNTH
  // ==========================================================

  // 1. Cinematic sequence trigger
  function triggerCinematicIntro() {
    if (!dom.intro) return;
    const items = dom.intro.querySelectorAll('.reveal-item');
    items.forEach(el => {
      el.style.animation = 'none';
      void el.offsetHeight; // trigger browser reflow
      el.style.animation = '';
    });
  }

  // 2. Depth Spotlight Tracker (Interactive mouse / touch spotlight)
  const spotlight = document.getElementById('intro-spotlight');
  if (dom.intro && spotlight) {
    const updateSpotlight = (clientX, clientY) => {
      const rect = dom.intro.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      spotlight.style.setProperty('--mouse-x', `${x}px`);
      spotlight.style.setProperty('--mouse-y', `${y}px`);
    };

    dom.intro.addEventListener('pointermove', (e) => {
      updateSpotlight(e.clientX, e.clientY);
    });

    dom.intro.addEventListener('pointerleave', () => {
      spotlight.style.setProperty('--mouse-x', `-1000px`);
      spotlight.style.setProperty('--mouse-y', `-1000px`);
    });
  }

  // 3. Midnight Royal Velvet Theme toggling with LocalStorage
  const themeToggle = document.getElementById('intro-theme-toggle');
  if (themeToggle) {
    const savedTheme = localStorage.getItem('intro-theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      themeToggle.classList.add('active');
    }
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      themeToggle.classList.toggle('active', isDark);
      localStorage.setItem('intro-theme', isDark ? 'dark' : 'light');
      playBellSFX(true); // play royal bell click chimes
    });
  }

  // 4. Live Museum HUD updates with simulated botanists activity
  let botanistInterval = null;
  const botanistCountEl = document.getElementById('live-botanist-count');

  function startBotanistHud() {
    if (botanistInterval) return;
    if (!botanistCountEl) return;
    botanistInterval = setInterval(() => {
      let count = parseInt(botanistCountEl.textContent, 10) || 12;
      // Slight elegant fluctuation
      const change = Math.random() > 0.65 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      count = Math.max(8, Math.min(22, count + change));
      botanistCountEl.textContent = count;
    }, 4500);
  }

  startBotanistHud();

  // 5. Acoustic Atmosphere: Synthesized Web Audio API Meditative Soundscape
  let ambientOscs = [];
  let ambientLfos = [];
  let windSource = null;
  let windFilter = null;
  let windLfo = null;

  const svgSoundOn = `<svg class="sound-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
  const svgSoundOff = `<svg class="sound-icon" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.5 9v6H8l4.5 4.5V4.5L8 9H4.5z"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  async function startAmbientSynth() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Master audio output
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 1.8); // 1.8s fade-in

      // Wind Synthesizer - Generates high-fidelity organic rustling noise
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const channelData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        channelData[i] = Math.random() * 2 - 1;
      }
      
      windSource = audioCtx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      windFilter = audioCtx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(320, audioCtx.currentTime);
      windFilter.Q.setValueAtTime(1.0, audioCtx.currentTime);

      const windGain = audioCtx.createGain();
      windGain.gain.setValueAtTime(0.03, audioCtx.currentTime);

      // Low Frequency Oscillator for realistic gusting/wind wave dynamics
      windLfo = audioCtx.createOscillator();
      windLfo.frequency.setValueAtTime(0.07, audioCtx.currentTime); // Slow 14-second wave
      
      const windLfoGain = audioCtx.createGain();
      windLfoGain.gain.setValueAtTime(100, audioCtx.currentTime); // Fluctuate filter frequency between 220Hz and 420Hz

      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);
      
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      windSource.start();
      windLfo.start();

      // Royal Zen Garden Soundscape (Harmonious combination of rich ambient tones)
      const chord = [
        { freq: 98.00, type: 'triangle', volume: 0.08 },  // G2 (Warm bass fundamental)
        { freq: 146.83, type: 'sine', volume: 0.09 },     // D3 (Smooth, rich resonance)
        { freq: 196.00, type: 'sine', volume: 0.11 },     // G3 (Bright middle register)
        { freq: 246.94, type: 'triangle', volume: 0.05 }, // B3 (Delicate overtone color)
        { freq: 293.66, type: 'sine', volume: 0.07 }      // D4 (Airy high sheen)
      ];

      chord.forEach((note, index) => {
        const osc = audioCtx.createOscillator();
        osc.type = note.type;
        osc.frequency.setValueAtTime(note.freq, audioCtx.currentTime);

        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(note.volume, audioCtx.currentTime);

        // Breathing volume LFOs mimicking dynamic biological systems
        const lfo = audioCtx.createOscillator();
        lfo.frequency.setValueAtTime(0.025 + index * 0.01, audioCtx.currentTime);

        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(note.volume * 0.4, audioCtx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start();
        lfo.start();

        ambientOscs.push(osc);
        ambientLfos.push(lfo);
      });

    } catch (e) {
      console.warn('[audio] ambient synth initialization failed:', e);
    }
  }

  function stopAmbientSynth() {
    if (!audioCtx) return;
    try {
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6); // Smooth 0.6s fade-out
      }
      
      setTimeout(() => {
        try {
          if (windSource) { windSource.stop(); windSource.disconnect(); }
          if (windLfo) { windLfo.stop(); windLfo.disconnect(); }
          ambientOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch(_) {} });
          ambientLfos.forEach(l => { try { l.stop(); l.disconnect(); } catch(_) {} });
        } catch(_) {}
        
        ambientOscs = [];
        ambientLfos = [];
        windSource = null;
        windLfo = null;
        
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().then(() => {
            audioCtx = null;
            masterGain = null;
          });
        }
      }, 750);
    } catch (e) {
      console.warn('[audio] ambient synth stop failed:', e);
    }
  }

  // Crystalline Royal Gold Bell Chime Synthesizer for high-fidelity interactive clicks
  function playBellSFX(isClick) {
    if (!isSoundOn) return;
    try {
      const tempCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (tempCtx.state === 'suspended') {
        tempCtx.resume();
      }
      
      const now = tempCtx.currentTime;
      const sfxGain = tempCtx.createGain();
      sfxGain.connect(masterGain || tempCtx.destination);
      
      const baseFreq = isClick ? 1800 : 2200;
      const duration = isClick ? 0.75 : 0.35;
      const maxVol = isClick ? 0.16 : 0.07;
      
      const osc1 = tempCtx.createOscillator();
      const osc2 = tempCtx.createOscillator();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, now);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // Sweet metallic perfect fifth resonance
      
      sfxGain.gain.setValueAtTime(0, now);
      sfxGain.gain.linearRampToValueAtTime(maxVol, now + 0.005);
      sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      osc1.connect(sfxGain);
      osc2.connect(sfxGain);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {
      console.warn('[audio] sfx play failed:', e);
    }
  }

  // Bind Sound Control Toggle
  const soundToggle = document.getElementById('intro-sound-toggle');
  if (soundToggle) {
    soundToggle.innerHTML = svgSoundOff;
    
    soundToggle.addEventListener('click', async () => {
      isSoundOn = !isSoundOn;
      soundToggle.classList.toggle('active', isSoundOn);
      soundToggle.innerHTML = isSoundOn ? svgSoundOn : svgSoundOff;
      
      if (isSoundOn) {
        await startAmbientSynth();
        playBellSFX(true);
      } else {
        stopAmbientSynth();
      }
    });
  }

  // Add micro-interaction audio feedback and chimes to interactive controls
  const interactiveButtons = [
    document.getElementById('start-btn'),
    document.getElementById('game-btn'),
    document.getElementById('intro-theme-toggle'),
    document.getElementById('lang-btn')
  ];

  interactiveButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('mouseenter', () => {
        playBellSFX(false); // Play soft chime hover FX
      });
      btn.addEventListener('click', () => {
        playBellSFX(true); // Play distinct chime click FX
      });
    }
  });

  // Call on initial load to run the cinematic sequence
  triggerCinematicIntro();

  // ----------------------------------------------------------
  // EXPORTS
  // ----------------------------------------------------------
  window.App = {
    dom,
    i18n,
    get currentLang() { return currentLang; },
    applyLanguage,
    showError,
    showLangToast,
    openModal,
    closeModal,
    closeAllModals,
    registerMode,
    enterMode,
    exitActiveMode,
    enforceCameraSize,
    activeSpecimen,
    updateActiveSpecimen,
    captureSpecimen,
    updateBioModalContent,
    triggerCaptureTooltip,
    spawnConfetti,
    stopConfetti,
  };

  applyLanguage('zh');

})();

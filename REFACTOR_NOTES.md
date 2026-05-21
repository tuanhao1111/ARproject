# Refactor — tách Explore / Game thành 2 file (Done)

Đã tách monolithic `js/main.js` thành 3 file. `main.js` **không còn được load**
trong `index.html` — có thể xoá file đó khi mọi thứ chạy ổn (giữ lại để git
history còn diff cho dễ).

## Kiến trúc mới

```
index.html              ← chỉ chứa UI/markup, không còn <a-scene> inline
  ↓ load
  ├─ aframe.min.js
  ├─ aframe-ar.js          (AR.js — dùng bởi Game mode)
  ├─ mindar-image-aframe   (MindAR — dùng bởi Explore mode)
  ├─ js/common.js          ← exports window.App; i18n, modals, gestures-base, lifecycle
  ├─ js/game.js            ← AR.js scene + barcode markers 0..4 + reward
  └─ js/explore.js         ← MindAR scene + image targets + info card

<div id="scene-host"></div>   ← scene mount dynamically vào đây
```

**Quan trọng:** chỉ 1 scene tồn tại trong DOM tại 1 thời điểm.
Khi user bấm BACK → JS unmount scene → camera được giải phóng. Tránh
xung đột giữa AR.js và MindAR (cả 2 đều grab camera).

## ⚠️ TODO ASSETS bạn cần cung cấp

### 1. GLB cho ID 4 (Game mode, hoa thứ 4)
- File: `gamemode/<tên-file>.glb`
- Hiện đang dùng `purple-azalea.glb` làm placeholder
- Sửa: mở `js/game.js`, dòng SPECIES, đổi `glb:` của entry `id: 4`
- Cũng cần in barcode marker ID 4 từ
  https://au.gmented.com/app/marker/marker.php (type 3x3, value 4)

### 2. File `.mind` cho Explore mode
- File: `Explore/targets.mind`
- Compile từ ảnh target (lá cây, banner, poster…) tại
  https://hiukim.github.io/mind-ar-js-doc/tools/compile
- Mỗi ảnh = 1 `targetIndex` (0, 1, 2, …)
- Thứ tự ảnh khi compile **phải match** thứ tự `SPECIES_EXPLORE` trong
  `js/explore.js`
- Hiện chưa có file → Explore mode sẽ báo lỗi "Could not load image targets"
  cho đến khi bạn drop file vào

### 3. (Tùy chọn) Thêm species vào Explore mode
- Sau khi có .mind nhiều target, push thêm entry vào `SPECIES_EXPLORE`
- Mỗi entry cần: `name_zh`, `name_en`, `scientific`, `brief_zh`, `brief_en`,
  `glb`, `scale`, `position`

## Test flow

### Game mode (kỳ vọng):
1. Bấm **Game Mode** → modal map auto-hiện
2. Đóng map → scan ID 0 → toast "GO!", mission đổi sang "FIND 4 AZALEAS"
3. Scan ID 1/2/3/4 → mỗi cái +1, hoa 3D hiện trên marker
4. Đủ 4/4 → mission "RETURN TO START"
5. Scan lại ID 0 → reward modal

### Explore mode (kỳ vọng — sau khi có .mind):
1. Bấm **Start Exploring** → camera mở
2. Lia camera vào ảnh target → hoa GLB hiện trên ảnh, info card slide từ
   bottom với tên loài + brief
3. Tap info card → mở modal BIO chi tiết
4. Lia camera ra khỏi target → hoa biến, info card ẩn

## UI/UX với Antigravity (sau)

JS không phụ thuộc cứng vào DOM structure — chỉ cần giữ các ID/class sau:
- `#intro`, `#loading`, `#error-screen`, `#ar-ui`, `#scene-host`
- `#scan-hint`, `#fabs`, `#floating-mode`, `#explore-info`
- `#game-hud`, `#game-mission`, `#game-toast`, `#reward-modal`, `#modal-*`
- `#back-btn`, `#game-btn`, `#start-btn`, `#lang-btn`, `#map-btn`
- `#hud-score-current/total/best`, `#mission-text`, `#toast-text`
- `#reward-score/best/runs/message`, `#reward-close/replay`
- `#audio-btn-zh/en`, `.lc-stage[data-stage]`, `.fab[data-action]`
- `data-i18n` attribute để i18n auto-translate
- `data-close` để modal close button work

Phần còn lại (layout, animation, style) có thể swap thoải mái.

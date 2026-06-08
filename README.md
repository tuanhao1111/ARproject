# AR Azalea Project · 杜鵑花 AR

Đồ án sinh học Web AR về hoa Azalea (杜鵑花) — quét business card → hiện hoa 3D + video time-lapse + nội dung sinh thái.

## Stack
- **MindAR.js v1.2.5** (image tracking) + **A-Frame v1.5.0** (3D rendering)
- **Vercel + GitHub** auto-deploy
- Bilingual 中文 phồn thể + English
- 100% open source, không phụ thuộc dịch vụ thương mại

## Files
```
ARproject/
├── index.html              # Markup UI (không còn <a-scene> inline)
├── css/style.css           # Toàn bộ style
├── js/
│   ├── common.js           # window.App: i18n, modals, capture, audio
│   ├── explore.js          # MindAR image-target mode
│   └── game.js             # AR.js barcode mode + scavenger hunt
├── Explore/
│   ├── flower-twigs.glb    # 3D model (Draco nén ~1MB)
│   ├── targets.mind        # MindAR compiled image target
│   └── azalea-bloom.mp4    # Video time-lapse 8s, 577KB
└── gamemode/               # GLB + assets cho game mode
```

## Deploy
```bash
git add .
git commit -m "Update"
git push
```
Vercel auto-deploy ~30s.

## Kiến trúc

**3D Scene**:
```
mindar-image-target
└── pinch-wrapper (nhận user gesture)
    ├── 🌸 hoa GLB
    ├── 🏷️ Latin label
    └── 📺 video frame (clean, không viền)
```

**Wrapper pattern**: MindAR control target matrix, JS control wrapper transform — 2 tầng độc lập, không xung đột → không rung giật.

## Gesture System

**Mobile**:
- 1 ngón vuốt → xoay hoa (X/Y axis, giới hạn ±80°)
- 2 ngón pinch → zoom (0.3× - 3×)
- 2 ngón pan → di chuyển

**Desktop**:
- Drag chuột → xoay hoa
- Wheel → zoom
- Shift + drag → di chuyển

## Features

- **4 FAB buttons** (đáy màn hình): BIO / VIDEO / LIFECYCLE / AUDIO mở modals
- **Floating UI mode**: khi target lost, hoa + video chuyển sang HTML overlay 2D ở giữa màn hình
- **Switch ngôn ngữ 中/EN**: nút trên top-bar, đổi ngay lập tức
- **Cache-Control meta tags**: force reload assets

## Modal Content
- **BIO**: thông tin sinh thái + cảnh báo grayanotoxin
- **VIDEO**: YouTube embed time-lapse Yangmingshan
- **LIFECYCLE**: 4 stages tương tác (芽→蕾→花→果) với SVG inline
- **AUDIO**: Web Speech API zh-TW + en-US

## Yếu điểm để biết khi defend
- GLB 17MB load chậm lần đầu (có thể giảm bằng Draco compression)
- Web Speech API giọng máy (có thể thay bằng MP3 ghi âm)
- Chỉ 1 marker - UI hint "001/03" implying có thể mở rộng 3 species
- Cần internet để load A-Frame, MindAR, Google Fonts từ CDN

## Điểm mạnh để nhấn mạnh
- Cross-platform (mobile + desktop)
- No-install (chỉ cần URL)
- Bilingual song ngữ
- Multi-modal content (text + video + interactive timeline + audio)
- Modular code dễ nhân bản cho species khác

## Credits
- 3D model: Nestaeric (Sketchfab), CC-BY-4.0
- Video time-lapse: Yangmingshan National Park 4K footage
- Stack: MindAR.js by HiuKim, A-Frame by Mozilla, Three.js

# AR.js Barcode Markers — Print Assets

Folder này chứa **PNG markers** cần in ra giấy cho user scan bằng camera.
**KHÔNG load vào browser** — khác với MindAR `.mind` file. AR.js barcode
markers là pattern toán học cố định, project chỉ cần biết `value` (ID).

## Generator

https://au.gmented.com/app/marker/marker.php

Section: **"Barcode Marker Generator"** (KHÔNG phải Pattern Marker).

## Config bắt buộc — phải khớp `index.html`

| Field            | Value                  | Lý do                                         |
| ---------------- | ---------------------- | --------------------------------------------- |
| Type             | `3x3`                  | Match `matrixCodeType: '3x3'` trong a-scene   |
| Value (ID)       | `0`, `1`, `2`, `3`     | Match `<a-marker value="N">` trong index.html |

Nếu chọn sai Type (vd `3x3_HAMMING63` hay `4x4`), AR.js sẽ KHÔNG decode được.

## Marker map

| File          | Value | Purpose                                  | GLB content                          |
| ------------- | ----- | ---------------------------------------- | ------------------------------------ |
| `marker-0.png`| 0     | START / hero — chung 2 mode              | `Explore/azalea.glb` (explore only)  |
| `marker-1.png`| 1     | 紫杜鵑 · Purple Azalea (game mode)        | `gamemode/purple-azalea.glb`         |
| `marker-2.png`| 2     | 白杜鵑 · White Azalea (game mode)         | `gamemode/white-azalea.glb`          |
| `marker-3.png`| 3     | 花期縮時 · Time-lapse (game mode)         | `gamemode/default_timelapse.glb`     |

## Cách in & dùng

1. Tải 4 PNG từ generator (mỗi marker là PNG riêng).
2. Đặt vào folder này với tên `marker-0.png` ... `marker-3.png`.
3. In ra **A4**, mỗi marker khoảng **8–15 cm vuông**.
   - Quá nhỏ → camera không decode.
   - Quá lớn → camera phải lùi xa mới fit vào frame.
4. **GIỮ NGUYÊN viền đen** quanh marker — đó là quiet zone AR.js cần.
5. Dán/đặt ở 4 vị trí khác nhau trên campus tương ứng 4 pin trên `gamemode/campus-map.png`.

## Lighting & quality

- Ánh sáng đều, không ngược nắng, không phản chiếu.
- Giấy phẳng, không gấp, không cong.
- Tương phản đen/trắng rõ — tránh in trên giấy màu hoặc giấy mỏng lộ mặt sau.

## Thêm marker mới (tương lai)

Nếu muốn thêm loài hoa thứ 4 (đã có pin trên campus map):
1. Generate marker với value `4` từ link trên.
2. Save `marker-4.png` vào folder này.
3. Push entry mới vào `SPECIES` array trong [js/main.js](../js/main.js#L89).
4. Drop GLB tương ứng vào `gamemode/`.

Không cần đụng marker code khác — `generateFlowerTargets()` auto-append.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// ============================================================================
// 1. FENG SHUI SVG EMBLEMS (Phương án A, B, C) & MASTER SVG FILES
// ============================================================================
// Meaning:
// - Vòng tròn tuần hoàn khép kín hướng lên: Thủy - Mộc tương sinh, luân chuyển tài lộc bền vững
// - Bánh răng công nghiệp 8 đỉnh (Bát quái / Phát đạt): Vận hành vững chãi, chuẩn xác
// - Chữ DƯ / DN ở tâm: Trụ cột trung tâm, chữ D vững chãi kết hợp đường nét đi lên
// - 3 Hạt nhựa tái chế (Tam Tài: Thiên - Địa - Nhân) nâng đỡ phía dưới: Nguồn nguyên liệu dồi dào, sinh sôi
// Colors:
// - Xanh dương đậm (#0F2942): Thủy – trí tuệ, uy tín, chiều sâu, nền tảng vững chắc
// - Xanh lá tái chế (#15803D): Mộc – sinh trưởng, tái sinh, môi trường bền vững
// - Vàng kim phong thủy (#D4A72C): Kim – tài lộc, thịnh vượng, điểm nhấn vượng khí

export const EMBLEM_OPTION_A_INNER = `
  <defs>
    <linearGradient id="dnBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2942" />
      <stop offset="62%" stop-color="#133859" />
      <stop offset="100%" stop-color="#0A1D30" />
    </linearGradient>
    <linearGradient id="dnGreenGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#15803D" />
      <stop offset="100%" stop-color="#22C55E" />
    </linearGradient>
    <linearGradient id="dnGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="50%" stop-color="#D4A72C" />
      <stop offset="100%" stop-color="#B48218" />
    </linearGradient>
  </defs>

  <!-- Outer Circular Shield (Vòng tròn viên mãn & bảo hộ) -->
  <circle cx="256" cy="256" r="240" fill="url(#dnBgGrad)" />
  <circle cx="256" cy="256" r="226" fill="none" stroke="url(#dnGoldGrad)" stroke-width="5" stroke-opacity="0.7" />

  <!-- Industrial Shredder Gear (Bánh răng 8 đỉnh - Bát phương hội tụ) -->
  <g fill="#163E63" stroke="#1E4E79" stroke-width="2">
    <rect x="236" y="42" width="40" height="32" rx="6" />
    <rect x="236" y="438" width="40" height="32" rx="6" />
    <rect x="42" y="236" width="32" height="40" rx="6" />
    <rect x="438" y="236" width="32" height="40" rx="6" />
    <rect x="236" y="42" width="40" height="32" rx="6" transform="rotate(45 256 256)" />
    <rect x="236" y="438" width="40" height="32" rx="6" transform="rotate(45 256 256)" />
    <rect x="236" y="42" width="40" height="32" rx="6" transform="rotate(-45 256 256)" />
    <rect x="236" y="438" width="40" height="32" rx="6" transform="rotate(-45 256 256)" />
  </g>

  <!-- Circular Recycling Upward Arrows (Vòng tuần hoàn tái chế hướng lên) -->
  <!-- Left-to-Top Green Rising Arc -->
  <path d="M 92 285 A 168 168 0 0 1 352 118" fill="none" stroke="url(#dnGreenGrad)" stroke-width="26" stroke-linecap="round" />
  <polygon points="378,136 338,84 328,144" fill="#22C55E" />

  <!-- Right-to-Bottom Gold & Green Prosperity Arc -->
  <path d="M 420 227 A 168 168 0 0 1 160 394" fill="none" stroke="url(#dnGoldGrad)" stroke-width="22" stroke-linecap="round" />
  <polygon points="134,376 174,428 184,368" fill="#D4A72C" />

  <!-- Inner Core Circle (Tâm điểm vững chãi) -->
  <circle cx="256" cy="256" r="126" fill="#0B2136" stroke="#1E4E79" stroke-width="4" />

  <!-- Center Monogram "DN" / "DƯ" (Chữ D vững chắc kết hợp mũi tên N vươn lên) -->
  <!-- Stylized D -->
  <path d="M 156 178 H 212 C 250 178 274 202 274 242 C 274 282 250 306 212 306 H 156 Z" fill="#FFFFFF" />
  <path d="M 186 204 V 280 H 210 C 232 280 244 266 244 242 C 244 218 232 204 210 204 Z" fill="#0B2136" />

  <!-- Stylized N / Upward Prosperity Stroke -->
  <path d="M 262 306 V 178 H 290 L 332 252 V 178 H 360 V 306 H 332 L 290 232 V 306 Z" fill="url(#dnGoldGrad)" />

  <!-- Three Recycled Plastic Pellets at Base (Tam tài hạt nhựa tái sinh nâng đỡ) -->
  <circle cx="212" cy="346" r="12" fill="#22C55E" />
  <circle cx="256" cy="354" r="15" fill="url(#dnGoldGrad)" />
  <circle cx="300" cy="346" r="12" fill="#22C55E" />
`;

// Square SVG (512x512)
const squareSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Dư-Nhựa phế liệu Logo">
  <title>Dư-Nhựa phế liệu – Xưởng phân loại &amp; băm nhựa</title>
  ${EMBLEM_OPTION_A_INNER}
</svg>
`;

// Horizontal SVG (Transparent background)
const horizontalTransparentSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320" role="img" aria-label="Dư-Nhựa phế liệu Logo Ngang">
  <title>Dư-Nhựa phế liệu – Hệ thống quản lý xưởng phân loại, băm nhựa phế liệu</title>
  <g transform="translate(24, 8) scale(0.59375)">
    ${EMBLEM_OPTION_A_INNER}
  </g>
  <g transform="translate(360, 0)">
    <text x="0" y="138" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="82" font-weight="800" fill="#0F2942" letter-spacing="-1">
      Dư-Nhựa <tspan fill="#15803D">phế liệu</tspan>
    </text>
    <rect x="2" y="164" width="140" height="6" rx="3" fill="#D4A72C" />
    <rect x="154" y="164" width="420" height="6" rx="3" fill="#15803D" fill-opacity="0.35" />
    <text x="2" y="222" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="36" font-weight="700" fill="#334155" letter-spacing="1.5">
      XƯỞNG PHÂN LOẠI &amp; BĂM NHỰA
    </text>
    <text x="2" y="266" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="#15803D">
      TÀI LỘC VỮNG BỀN • TUẦN HOÀN PHÁT TRIỂN
    </text>
  </g>
</svg>
`;

// Light Background SVG
const lightSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320" role="img" aria-label="Dư-Nhựa phế liệu Logo Nền Sáng">
  <title>Dư-Nhựa phế liệu – Phiên bản nền sáng</title>
  <rect width="1200" height="320" rx="32" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4" />
  <g transform="translate(24, 8) scale(0.59375)">
    ${EMBLEM_OPTION_A_INNER}
  </g>
  <g transform="translate(360, 0)">
    <text x="0" y="138" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="82" font-weight="800" fill="#0F2942" letter-spacing="-1">
      Dư-Nhựa <tspan fill="#15803D">phế liệu</tspan>
    </text>
    <rect x="2" y="164" width="140" height="6" rx="3" fill="#D4A72C" />
    <rect x="154" y="164" width="420" height="6" rx="3" fill="#15803D" fill-opacity="0.35" />
    <text x="2" y="222" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="36" font-weight="700" fill="#334155" letter-spacing="1.5">
      XƯỞNG PHÂN LOẠI &amp; BĂM NHỰA
    </text>
    <text x="2" y="266" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="#15803D">
      TÀI LỘC VỮNG BỀN • TUẦN HOÀN PHÁT TRIỂN
    </text>
  </g>
</svg>
`;

// Dark Background SVG
const darkSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320" role="img" aria-label="Dư-Nhựa phế liệu Logo Nền Tối">
  <title>Dư-Nhựa phế liệu – Phiên bản nền tối</title>
  <rect width="1200" height="320" rx="32" fill="#0F2942" />
  <g transform="translate(24, 8) scale(0.59375)">
    ${EMBLEM_OPTION_A_INNER}
  </g>
  <g transform="translate(360, 0)">
    <text x="0" y="138" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="82" font-weight="800" fill="#FFFFFF" letter-spacing="-1">
      Dư-Nhựa <tspan fill="#4ADE80">phế liệu</tspan>
    </text>
    <rect x="2" y="164" width="140" height="6" rx="3" fill="#D4A72C" />
    <rect x="154" y="164" width="420" height="6" rx="3" fill="#4ADE80" fill-opacity="0.4" />
    <text x="2" y="222" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="36" font-weight="700" fill="#E2E8F0" letter-spacing="1.5">
      XƯỞNG PHÂN LOẠI &amp; BĂM NHỰA
    </text>
    <text x="2" y="266" font-family="'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="#D4A72C">
      TÀI LỘC VỮNG BỀN • TUẦN HOÀN PHÁT TRIỂN
    </text>
  </g>
</svg>
`;

// Monochrome SVG (Single-color stamp/invoice printing)
const monoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Dư-Nhựa phế liệu Logo Đơn Sắc">
  <title>Dư-Nhựa phế liệu – Phiên bản đơn sắc in phiếu</title>
  <circle cx="256" cy="256" r="236" fill="none" stroke="#0F2942" stroke-width="16" />
  <circle cx="256" cy="256" r="196" fill="none" stroke="#0F2942" stroke-width="18" stroke-dasharray="240 60" />
  <circle cx="256" cy="256" r="134" fill="#0F2942" />
  <path d="M 156 178 H 212 C 250 178 274 202 274 242 C 274 282 250 306 212 306 H 156 Z" fill="#FFFFFF" />
  <path d="M 186 204 V 280 H 210 C 232 280 244 266 244 242 C 244 218 232 204 210 204 Z" fill="#0F2942" />
  <path d="M 262 306 V 178 H 290 L 332 252 V 178 H 360 V 306 H 332 L 290 232 V 306 Z" fill="#FFFFFF" />
  <circle cx="212" cy="346" r="12" fill="#FFFFFF" />
  <circle cx="256" cy="354" r="15" fill="#FFFFFF" />
  <circle cx="300" cy="346" r="12" fill="#FFFFFF" />
</svg>
`;

// Write SVG assets
fs.writeFileSync(path.join(publicDir, 'icon.svg'), squareSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'logo-square.svg'), squareSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'logo-horizontal.svg'), horizontalTransparentSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'logo-light.svg'), lightSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'logo-dark.svg'), darkSvg, 'utf8');
fs.writeFileSync(path.join(publicDir, 'logo-mono.svg'), monoSvg, 'utf8');

// ============================================================================
// 2. HIGH-PRECISION RASTER PNG & ICO GENERATOR (PURE NODE, ZERO EXTERNAL DEPS)
// ============================================================================
// Creates crisp anti-aliased RGBA buffers for the Dư-Nhựa phế liệu Feng Shui emblem
// at any resolution (16, 32, 180, 192, 512, 1024) and encodes valid PNG & ICO files.

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function blendPixel(buf, idx, r, g, b, a) {
  if (a <= 0) return;
  if (a >= 255 || buf[idx + 3] === 0) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
    return;
  }
  const srcA = a / 255;
  const dstA = buf[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
  buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
  buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

/**
 * Renders the Feng Shui Dư-Nhựa phế liệu emblem into an RGBA buffer.
 * mode: 'standard' | 'maskable' | 'light' | 'dark' | 'mono'
 */
function renderEmblemRGBA(size, mode = 'standard') {
  const buf = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const scale = mode === 'maskable' ? 0.78 : 0.92;
  const maxR = (size / 2) * scale;

  // Colors
  const cNavy = [15, 41, 66];       // #0F2942
  const cDeepNavy = [11, 33, 54];   // #0B2136
  const cGreen = [21, 128, 61];     // #15803D
  const cBrightGreen = [34, 197, 94]; // #22C55E
  const cGold = [212, 167, 44];     // #D4A72C
  const cWhite = [255, 255, 255];   // #FFFFFF
  const cLightBg = [245, 247, 250]; // #F5F7FA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Background fill based on mode
      if (mode === 'maskable' || mode === 'dark') {
        buf[idx] = cNavy[0];
        buf[idx + 1] = cNavy[1];
        buf[idx + 2] = cNavy[2];
        buf[idx + 3] = 255;
      } else if (mode === 'light') {
        buf[idx] = cLightBg[0];
        buf[idx + 1] = cLightBg[1];
        buf[idx + 2] = cLightBg[2];
        buf[idx + 3] = 255;
      }

      // Normalized coordinates [-1, 1] inside emblem circle
      const nx = (x - cx) / maxR;
      const ny = (y - cy) / maxR;
      const dist = Math.hypot(nx, ny);

      if (dist <= 1.005) {
        const edgeAlpha = dist > 0.985 ? Math.max(0, Math.min(255, Math.round((1.005 - dist) / 0.02 * 255))) : 255;

        if (mode === 'mono') {
          // Single color #0F2942 stamp
          if (dist > 0.90 || (dist > 0.72 && dist < 0.80) || dist < 0.56) {
            blendPixel(buf, idx, cNavy[0], cNavy[1], cNavy[2], edgeAlpha);
          }
        } else {
          // Outer navy shield
          blendPixel(buf, idx, cNavy[0], cNavy[1], cNavy[2], edgeAlpha);

          // Gold outer trim ring (0.91 - 0.94)
          if (dist >= 0.90 && dist <= 0.94) {
            blendPixel(buf, idx, cGold[0], cGold[1], cGold[2], 210);
          }

          // Circular Recycling Arcs (0.62 - 0.78)
          if (dist >= 0.62 && dist <= 0.78) {
            const angle = Math.atan2(ny, nx); // -PI to PI
            // Top-left to top-right arc: green upward flow
            if (angle >= -2.8 && angle <= -0.25) {
              blendPixel(buf, idx, cBrightGreen[0], cBrightGreen[1], cBrightGreen[2], 255);
            } else if (angle >= 0.35 && angle <= 2.9) {
              // Bottom-right to bottom-left arc: gold prosperity flow
              blendPixel(buf, idx, cGold[0], cGold[1], cGold[2], 255);
            }
          }

          // Inner core circle
          if (dist < 0.55) {
            blendPixel(buf, idx, cDeepNavy[0], cDeepNavy[1], cDeepNavy[2], 255);
          }
        }

        // Stylized "D" on left side of core (nx in [-0.42, 0.02], ny in [-0.32, 0.24])
        if (ny >= -0.32 && ny <= 0.24 && nx >= -0.42 && nx <= 0.04) {
          const dCy = -0.04;
          const dR = Math.hypot(Math.max(0, nx - (-0.20)), ny - dCy);
          const inOuterD = (nx <= -0.20 && nx >= -0.42) || (nx > -0.20 && dR <= 0.28);
          const inInnerD = (nx >= -0.30 && nx <= -0.20 && Math.abs(ny - dCy) <= 0.16) || (nx > -0.20 && dR <= 0.16);
          if (inOuterD && !inInnerD) {
            blendPixel(buf, idx, cWhite[0], cWhite[1], cWhite[2], 255);
          }
        }

        // Stylized "N" on right side of core (nx in [0.06, 0.44], ny in [-0.32, 0.24])
        if (ny >= -0.32 && ny <= 0.24 && nx >= 0.06 && nx <= 0.44) {
          const leftBar = nx >= 0.06 && nx <= 0.16;
          const rightBar = nx >= 0.34 && nx <= 0.44;
          const diagX = 0.12 + ((ny - (-0.32)) / 0.56) * 0.24;
          const diagBar = Math.abs(nx - diagX) <= 0.055;
          if (leftBar || rightBar || diagBar) {
            const col = mode === 'mono' ? cWhite : cGold;
            blendPixel(buf, idx, col[0], col[1], col[2], 255);
          }
        }

        // Three Recycled Plastic Pellets at Base (Tam tài)
        const p1 = Math.hypot(nx - (-0.18), ny - 0.38) <= 0.055;
        const p2 = Math.hypot(nx - 0.0, ny - 0.41) <= 0.065;
        const p3 = Math.hypot(nx - 0.18, ny - 0.38) <= 0.055;
        if (p1 || p3) {
          const col = mode === 'mono' ? cWhite : cBrightGreen;
          blendPixel(buf, idx, col[0], col[1], col[2], 255);
        } else if (p2) {
          const col = mode === 'mono' ? cWhite : cGold;
          blendPixel(buf, idx, col[0], col[1], col[2], 255);
        }
      }
    }
  }

  return encodePNG(size, size, buf);
}

function encodeICO(png16, png32) {
  // ICONDIR (6 bytes) + 2 * ICONDIRENTRY (16 bytes each = 32 bytes) = 38 bytes header
  const header = Buffer.alloc(6 + 32);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(2, 4); // 2 images (16x16 and 32x32)

  const offset1 = 38;
  const offset2 = offset1 + png16.length;

  // Entry 1: 16x16
  header[6] = 16;
  header[7] = 16;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);  // Color planes
  header.writeUInt16LE(32, 12); // Bits per pixel
  header.writeUInt32LE(png16.length, 14);
  header.writeUInt32LE(offset1, 18);

  // Entry 2: 32x32
  header[22] = 32;
  header[23] = 32;
  header[24] = 0;
  header[25] = 0;
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28);
  header.writeUInt32LE(png32.length, 30);
  header.writeUInt32LE(offset2, 34);

  return Buffer.concat([header, png16, png32]);
}

const png16 = renderEmblemRGBA(16, 'standard');
const png32 = renderEmblemRGBA(32, 'standard');
const png180 = renderEmblemRGBA(180, 'standard');
const png192 = renderEmblemRGBA(192, 'standard');
const png512 = renderEmblemRGBA(512, 'standard');
const pngMaskable512 = renderEmblemRGBA(512, 'maskable');
const png1024 = renderEmblemRGBA(1024, 'standard');
const pngLight512 = renderEmblemRGBA(512, 'light');
const pngDark512 = renderEmblemRGBA(512, 'dark');
const pngMono512 = renderEmblemRGBA(512, 'mono');
const icoBuf = encodeICO(png16, png32);

fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable512);
fs.writeFileSync(path.join(publicDir, 'icon-1024x1024.png'), png1024);
fs.writeFileSync(path.join(publicDir, 'logo-transparent.png'), png512);
fs.writeFileSync(path.join(publicDir, 'logo-light.png'), pngLight512);
fs.writeFileSync(path.join(publicDir, 'logo-dark.png'), pngDark512);
fs.writeFileSync(path.join(publicDir, 'logo-mono.png'), pngMono512);

console.log('Successfully generated all 14+ Feng Shui brand, favicon, and PWA assets in /public');

import React, { useState } from 'react';
import { Download, CheckCircle2, Sparkles, ShieldCheck, Layers, Eye } from 'lucide-react';

interface BrandLogoProps {
  variant?: 'dark-bg' | 'light-bg' | 'mono' | 'gold-accent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  showText?: boolean;
  option?: 'A' | 'B' | 'C';
  className?: string;
}

/**
 * Bộ nhận diện thương hiệu Phong Thủy Á Đông: DƯ-NHỰA PHẾ LIỆU
 * Triết lý: Tài lộc (#D4A72C) - Phát triển & Tái sinh (#15803D) - Vững bền & Uy tín (#0F2942)
 * Cấu trúc: Vòng tròn tuần hoàn hướng lên + Chữ DƯ/DN trung tâm + Bánh răng công nghiệp + Tam Tài hạt nhựa tái chế
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'dark-bg',
  size = 'md',
  showTagline = true,
  showText = true,
  option = 'A',
  className = '',
}) => {
  const dimensions = {
    sm: { icon: 34, title: 'text-sm', sub: 'text-[10px]' },
    md: { icon: 42, title: 'text-base', sub: 'text-[11px]' },
    lg: { icon: 54, title: 'text-xl', sub: 'text-xs' },
    xl: { icon: 72, title: 'text-2xl', sub: 'text-sm' },
  }[size];

  const isDarkBg = variant === 'dark-bg' || variant === 'gold-accent';
  const isMono = variant === 'mono';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`} data-testid="brand-logo">
      {/* Biểu tượng Phong Thủy (Phương án A mặc định, hỗ trợ so sánh B & C) */}
      <div className="relative shrink-0 flex items-center justify-center">
        {option === 'A' && (
          <svg
            width={dimensions.icon}
            height={dimensions.icon}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-sm transition-transform duration-300 hover:scale-105"
            role="img"
            aria-label="Logo Dư-Nhựa phế liệu - Phương án A"
          >
            <defs>
              <linearGradient id="dnLogoBgA" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isMono ? '#0F2942' : '#0F2942'} />
                <stop offset="65%" stopColor={isMono ? '#0F2942' : '#133859'} />
                <stop offset="100%" stopColor={isMono ? '#0F2942' : '#0A1D30'} />
              </linearGradient>
              <linearGradient id="dnLogoGreenA" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isMono ? '#FFFFFF' : '#15803D'} />
                <stop offset="100%" stopColor={isMono ? '#FFFFFF' : '#22C55E'} />
              </linearGradient>
              <linearGradient id="dnLogoGoldA" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isMono ? '#FFFFFF' : '#F59E0B'} />
                <stop offset="50%" stopColor={isMono ? '#FFFFFF' : '#D4A72C'} />
                <stop offset="100%" stopColor={isMono ? '#FFFFFF' : '#B48218'} />
              </linearGradient>
            </defs>

            {/* Vòng khiên tròn viên mãn */}
            <circle cx="256" cy="256" r="244" fill="url(#dnLogoBgA)" stroke={isDarkBg ? '#D4A72C' : '#0F2942'} strokeWidth="8" strokeOpacity={isMono ? '1' : '0.65'} />

            {/* Bánh răng công nghiệp 8 đỉnh (Bát phương vững chắc) */}
            <g fill={isMono ? '#FFFFFF' : '#18436B'} fillOpacity={isMono ? '0.2' : '0.85'}>
              <rect x="236" y="38" width="40" height="32" rx="6" />
              <rect x="236" y="442" width="40" height="32" rx="6" />
              <rect x="38" y="236" width="32" height="40" rx="6" />
              <rect x="442" y="236" width="32" height="40" rx="6" />
              <rect x="236" y="38" width="40" height="32" rx="6" transform="rotate(45 256 256)" />
              <rect x="236" y="442" width="40" height="32" rx="6" transform="rotate(45 256 256)" />
              <rect x="236" y="38" width="40" height="32" rx="6" transform="rotate(-45 256 256)" />
              <rect x="236" y="442" width="40" height="32" rx="6" transform="rotate(-45 256 256)" />
            </g>

            {/* Vòng tuần hoàn tái chế hướng lên (Thủy sinh Mộc) */}
            <path d="M 92 285 A 168 168 0 0 1 352 118" fill="none" stroke="url(#dnLogoGreenA)" strokeWidth="28" strokeLinecap="round" />
            <polygon points="380,136 338,82 326,144" fill={isMono ? '#FFFFFF' : '#22C55E'} />

            {/* Cung tài lộc vàng kim luân chuyển */}
            <path d="M 420 227 A 168 168 0 0 1 160 394" fill="none" stroke="url(#dnLogoGoldA)" strokeWidth="24" strokeLinecap="round" />
            <polygon points="132,376 174,430 186,368" fill={isMono ? '#FFFFFF' : '#D4A72C'} />

            {/* Tâm tròn hội tụ */}
            <circle cx="256" cy="256" r="128" fill="#0B2136" stroke={isMono ? '#FFFFFF' : '#1E4E79'} strokeWidth="5" />

            {/* Chữ D vững chãi kết hợp chữ N hướng lên ở trung tâm */}
            <path d="M 152 176 H 210 C 248 176 272 200 272 240 C 272 280 248 304 210 304 H 152 Z" fill="#FFFFFF" />
            <path d="M 182 202 V 278 H 208 C 230 278 242 264 242 240 C 242 216 230 202 208 202 Z" fill="#0B2136" />
            <path d="M 262 304 V 176 H 290 L 332 250 V 176 H 360 V 304 H 332 L 290 230 V 304 Z" fill="url(#dnLogoGoldA)" />

            {/* 3 Hạt nhựa tái chế (Tam Tài: Thiên - Địa - Nhân) */}
            <circle cx="212" cy="346" r="13" fill={isMono ? '#FFFFFF' : '#22C55E'} />
            <circle cx="256" cy="354" r="16" fill={isMono ? '#FFFFFF' : '#D4A72C'} />
            <circle cx="300" cy="346" r="13" fill={isMono ? '#FFFFFF' : '#22C55E'} />
          </svg>
        )}

        {option === 'B' && (
          <svg
            width={dimensions.icon}
            height={dimensions.icon}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Logo Dư-Nhựa phế liệu - Phương án B"
          >
            {/* Phương án B: Chữ D cách điệu kết hợp bánh răng công nghiệp và sắc vàng kim */}
            <rect x="24" y="24" width="464" height="464" rx="112" fill="#0F2942" stroke="#D4A72C" strokeWidth="12" />
            <circle cx="256" cy="256" r="176" fill="none" stroke="#D4A72C" strokeWidth="26" strokeDasharray="52 28" />
            <circle cx="256" cy="256" r="144" fill="#133859" stroke="#22C55E" strokeWidth="8" />
            <path d="M 176 156 H 256 C 316 156 356 196 356 256 C 356 316 316 356 256 356 H 176 Z" fill="#D4A72C" />
            <path d="M 218 196 V 316 H 252 C 288 316 312 292 312 256 C 312 220 288 196 252 196 Z" fill="#0F2942" />
            <circle cx="256" cy="256" r="26" fill="#22C55E" />
          </svg>
        )}

        {option === 'C' && (
          <svg
            width={dimensions.icon}
            height={dimensions.icon}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Logo Dư-Nhựa phế liệu - Phương án C"
          >
            {/* Phương án C: Vòng tái chế kết hợp hạt nhựa và mũi tên hướng lên */}
            <circle cx="256" cy="256" r="240" fill="#0F2942" stroke="#22C55E" strokeWidth="10" />
            <path d="M 110 310 C 90 200 170 100 280 100" fill="none" stroke="#22C55E" strokeWidth="32" strokeLinecap="round" />
            <path d="M 402 202 C 422 312 342 412 232 412" fill="none" stroke="#D4A72C" strokeWidth="32" strokeLinecap="round" />
            <polygon points="256,145 336,245 286,245 286,355 226,355 226,245 176,245" fill="#FFFFFF" />
            <circle cx="196" cy="390" r="16" fill="#22C55E" />
            <circle cx="256" cy="404" r="20" fill="#D4A72C" />
            <circle cx="316" cy="390" r="16" fill="#22C55E" />
          </svg>
        )}
      </div>

      {/* Phần chữ thương hiệu */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-extrabold tracking-tight ${dimensions.title} ${
                isMono
                  ? 'text-[#0F2942]'
                  : isDarkBg
                  ? 'text-white'
                  : 'text-[#0F2942]'
              }`}
            >
              Dư-Nhựa{' '}
              <span
                className={
                  isMono
                    ? 'text-[#0F2942]'
                    : isDarkBg
                    ? 'text-[#4ADE80]'
                    : 'text-[#15803D]'
                }
              >
                phế liệu
              </span>
            </span>
          </div>
          {showTagline && (
            <span
              className={`font-semibold tracking-wide mt-0.5 ${dimensions.sub} ${
                isMono
                  ? 'text-slate-600'
                  : isDarkBg
                  ? 'text-amber-300/95'
                  : 'text-slate-600'
              }`}
            >
              Xưởng phân loại &amp; băm nhựa
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export interface BrandAssetItem {
  id: number;
  name: string;
  filename: string;
  url: string;
  spec: string;
  usage: string;
  bgPreview: 'dark' | 'light' | 'checker';
}

export const BRAND_ASSET_FILES: BrandAssetItem[] = [
  { id: 1, name: '1. Logo ngang SVG nền trong suốt', filename: 'logo-horizontal.svg', url: '/logo-horizontal.svg', spec: 'Vector SVG • 1200×320', usage: 'Header, bảng hiệu, banner ngang', bgPreview: 'light' },
  { id: 2, name: '2. Logo vuông SVG chuẩn', filename: 'icon.svg', url: '/icon.svg', spec: 'Vector SVG • 512×512', usage: 'Sidebar, biểu tượng ứng dụng, avatar', bgPreview: 'checker' },
  { id: 3, name: '3. Logo PNG nền trong suốt', filename: 'logo-transparent.png', url: '/logo-transparent.png', spec: 'PNG RGBA • 512×512', usage: 'Chèn văn bản, báo giá, hợp đồng', bgPreview: 'checker' },
  { id: 4, name: '4. Logo phiên bản nền sáng', filename: 'logo-light.svg', url: '/logo-light.svg', spec: 'SVG/PNG • 1200×320', usage: 'Trang in, hóa đơn, nền trắng/xám sáng', bgPreview: 'light' },
  { id: 5, name: '5. Logo phiên bản nền tối', filename: 'logo-dark.svg', url: '/logo-dark.svg', spec: 'SVG/PNG • 1200×320', usage: 'Sidebar #0F2942, màn hình đăng nhập tối', bgPreview: 'dark' },
  { id: 6, name: '6. Logo phiên bản đơn sắc', filename: 'logo-mono.svg', url: '/logo-mono.svg', spec: 'Vector SVG • 512×512', usage: 'In nhiệt đen trắng, khắc dấu, in phiếu cân', bgPreview: 'light' },
  { id: 7, name: '7. Favicon 16×16', filename: 'favicon-16x16.png', url: '/favicon-16x16.png', spec: 'PNG • 16×16 px', usage: 'Tab trình duyệt máy tính cỡ nhỏ', bgPreview: 'checker' },
  { id: 8, name: '8. Favicon 32×32', filename: 'favicon-32x32.png', url: '/favicon-32x32.png', spec: 'PNG • 32×32 px', usage: 'Tab trình duyệt màn hình Retina', bgPreview: 'checker' },
  { id: 9, name: '9. Favicon ICO đa kích thước', filename: 'favicon.ico', url: '/favicon.ico', spec: 'ICO • 16×16 & 32×32', usage: 'Chuẩn trình duyệt truyền thống & bookmark', bgPreview: 'checker' },
  { id: 10, name: '10. Icon PWA 192×192', filename: 'pwa-192x192.png', url: '/pwa-192x192.png', spec: 'PNG • 192×192 px', usage: 'Màn hình chính điện thoại Android', bgPreview: 'checker' },
  { id: 11, name: '11. Icon PWA 512×512', filename: 'pwa-512x512.png', url: '/pwa-512x512.png', spec: 'PNG • 512×512 px', usage: 'Splash screen khi mở ứng dụng PWA', bgPreview: 'checker' },
  { id: 12, name: '12. Icon Maskable 512×512', filename: 'pwa-maskable-512x512.png', url: '/pwa-maskable-512x512.png', spec: 'PNG • 512×512 Safe Zone', usage: 'Adaptive Icon cắt tròn/bo góc trên Android', bgPreview: 'dark' },
  { id: 13, name: '13. Apple Touch Icon 180×180', filename: 'apple-touch-icon.png', url: '/apple-touch-icon.png', spec: 'PNG • 180×180 px', usage: 'Màn hình chính iPhone & iPad (iOS)', bgPreview: 'checker' },
  { id: 14, name: '14. Icon nguồn chuẩn 1024×1024', filename: 'icon-1024x1024.png', url: '/icon-1024x1024.png', spec: 'PNG Master • 1024×1024 px', usage: 'File gốc độ phân giải cao in ấn & kho ứng dụng', bgPreview: 'checker' },
];

/**
 * Bảng trưng bày & tải xuống trọn bộ Nhận diện Thương hiệu Phong Thủy Dư-Nhựa phế liệu (3 Phương án + 14 File)
 */
export const BrandIdentityShowcase: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C'>('A');

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden" data-testid="brand-identity-showcase">
      <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-[#0F2942] to-[#163B5C] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> BỘ NHẬN DIỆN THƯƠNG HIỆU PHONG THỦY Á ĐÔNG
          </div>
          <h3 className="text-lg font-bold">Dư-Nhựa phế liệu – Xưởng phân loại &amp; băm nhựa</h3>
          <p className="text-xs text-slate-200 mt-0.5">
            Thiết kế theo nguyên lý Ngũ Hành Tương Sinh: Thủy (#0F2942) dưỡng Mộc (#15803D) tụ Kim Tài Lộc (#D4A72C)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/logo-horizontal.svg"
            download="logo-du-nhua-phe-lieu-ngang.svg"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" /> Tải Logo Ngang SVG
          </a>
          <a
            href="/icon-1024x1024.png"
            download="icon-du-nhua-1024x1024.png"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-colors"
          >
            <Download className="w-4 h-4" /> Tải Icon Gốc 1024px
          </a>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 1. Giải thích ý nghĩa Phong Thủy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-sm text-[#0F2942] mb-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#0F2942] inline-block" />
              Hành Thủy (#0F2942) – Vững Bền
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Màu xanh dương đậm tượng trưng cho nền tảng quản trị sâu sắc, uy tín thương trường và dòng chảy tài chính thông suốt, giữ tiền chặt chẽ.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="flex items-center gap-2 font-bold text-sm text-[#15803D] mb-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#15803D] inline-block" />
              Hành Mộc (#15803D) – Sinh Trưởng
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Màu xanh lá tái chế kết hợp mũi tên tuần hoàn hướng lên thể hiện nhựa phế liệu được phân loại, băm nhỏ và tái sinh thành nguồn nguyên liệu giá trị cao.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800 mb-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#D4A72C] inline-block" />
              Hành Kim (#D4A72C) – Tài Lộc
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sắc vàng kim tại chữ N vươn lên và hạt nhựa trung tâm cùng bộ 3 hạt nhựa (Tam Tài: Thiên - Địa - Nhân) mang ý nghĩa thu hút vượng khí, tích lũy của cải.
            </p>
          </div>
        </div>

        {/* 2. So sánh 3 phương án thiết kế A, B, C */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0F2942]" />
              So sánh 3 Phương Án Logo Phong Thủy (Đã chọn Phương án A làm chuẩn)
            </h4>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              Loại bỏ 100% chi tiết mủ cao su cũ
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Phương án A */}
            <div
              onClick={() => setSelectedOption('A')}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedOption === 'A'
                  ? 'border-[#15803D] bg-emerald-50/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid="logo-option-a"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2942]">
                  Phương án A (Khuyên dùng)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Đang áp dụng
                </span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F2942] flex items-center justify-center mb-3">
                <BrandLogo variant="dark-bg" size="lg" option="A" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Cấu trúc:</strong> Vòng tròn tuần hoàn khép kín hướng lên + Bánh răng 8 đỉnh + Chữ DN trung tâm + 3 hạt nhựa Tam Tài nâng đỡ. Cân đối hoàn hảo ở mọi kích thước từ 16px đến bảng hiệu lớn.
              </p>
            </div>

            {/* Phương án B */}
            <div
              onClick={() => setSelectedOption('B')}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedOption === 'B'
                  ? 'border-[#15803D] bg-emerald-50/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid="logo-option-b"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Phương án B (Cơ khí Kim-Thủy)
                </span>
                <span className="text-[11px] font-medium text-slate-500">Phương án đối chiếu</span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F2942] flex items-center justify-center mb-3">
                <BrandLogo variant="dark-bg" size="lg" option="B" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Cấu trúc:</strong> Khối vuông bo góc kết hợp chữ D vàng kim lồng trong bánh răng máy băm. Mạnh mẽ về cơ khí nhưng tính tuần hoàn tái chế nhẹ hơn Phương án A.
              </p>
            </div>

            {/* Phương án C */}
            <div
              onClick={() => setSelectedOption('C')}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedOption === 'C'
                  ? 'border-[#15803D] bg-emerald-50/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid="logo-option-c"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Phương án C (Mũi tên tăng trưởng)
                </span>
                <span className="text-[11px] font-medium text-slate-500">Phương án đối chiếu</span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F2942] flex items-center justify-center mb-3">
                <BrandLogo variant="dark-bg" size="lg" option="C" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Cấu trúc:</strong> Vòng tái chế ôm mũi tên đi lên và 3 hạt nhựa phía dưới. Trực quan về môi trường nhưng thiếu chữ viết tắt thương hiệu Dư-Nhựa ở tâm khi thu nhỏ làm favicon.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Danh mục 14 File Asset Thực Tế trong /public */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Trọn bộ 14 File Logo, Favicon &amp; Icon PWA xuất chuẩn (Sẵn sàng tải về &amp; sử dụng)
            </h4>
            <span className="text-xs text-slate-500 font-mono">Thư mục: /public/*</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {BRAND_ASSET_FILES.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 p-3 flex flex-col justify-between bg-white hover:border-slate-300 transition-all"
                data-testid={`brand-asset-${asset.id}`}
              >
                <div>
                  <div
                    className={`h-20 rounded-lg mb-2.5 flex items-center justify-center p-2 border ${
                      asset.bgPreview === 'dark'
                        ? 'bg-[#0F2942] border-slate-800'
                        : asset.bgPreview === 'light'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] bg-slate-100 border-slate-200'
                    }`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="max-h-14 max-w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-800 line-clamp-1">{asset.name}</div>
                  <div className="text-[11px] font-mono text-emerald-700 mt-0.5">{asset.spec}</div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{asset.usage}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[130px]">
                    /{asset.filename}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Xem file gốc"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={asset.url}
                      download={asset.filename}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-[#0F2942] hover:text-white text-slate-700 text-[11px] font-semibold transition-colors"
                    >
                      <Download className="w-3 h-3" /> Tải
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BrandAssetShowcase = BrandIdentityShowcase;


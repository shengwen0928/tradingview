/**
 * 精確的浮點數運算或邊界限制
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * 線性映射：將值從一個區間映射到另一個區間
 */
export const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  if (inMax === inMin) return outMin;
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

/**
 * 格式化時間 (HH:mm 或 YYYY-MM-DD)
 */
export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * 格式化完整時間 (YYYY/MM/DD HH:mm:ss) - 用於十字線標籤
 */
export const formatFullTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 格式化價格
 */
export const formatPrice = (price: number, precision: number = 2): string => {
  return price.toFixed(precision);
};

/**
 * 🚀 顏色轉換工具：HSV 轉 Hex
 */
export const hsvToHex = (h: number, s: number, v: number): string => {
  s /= 100; v /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const rgb = [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0'));
  return `#${rgb.join('')}`;
};

/**
 * 🚀 顏色轉換工具：Hex 轉 HSV
 */
export const hexToHsv = (hex: string): { h: number, s: number, v: number } => {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
      switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

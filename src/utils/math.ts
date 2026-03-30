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

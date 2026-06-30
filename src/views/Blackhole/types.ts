/** 黑洞效果配置 */
export interface BlackholeConfig {
  // 黑洞与引力透镜
  holeRadius: number;      // 黑洞视界半径 (屏幕高度比例)
  lensDepth: number;       // 透镜深度 (r_s 单位)
  starGain: number;        // 星空亮度

  // 吸积盘几何
  diskInner: number;       // 内边缘 (r_s)
  diskOuter: number;       // 外边缘 (r_s)
  diskIncl: number;        // 倾角 (弧度)
  diskRoll: number;        // 系统旋转 (弧度)

  // 吸积盘物质与光
  diskGain: number;        // 盘发射亮度
  diskOpacity: number;     // 盘不透明度
  diskTemp: number;        // 最热环温度 (K)
  dopplerMix: number;      // 多普勒混合 (0-1)
  diskBeam: number;        // 光束指数
  diskSpeed: number;       // 条纹速度
  diskWind: number;        // 螺旋缠绕
  diskContrast: number;    // 条纹对比度

  // 光照与屏幕
  exposure: number;        // 色调映射曝光
  driftSpeed: number;      // 漂移速度

  // 整体强度 (简化控制)
  intensity: number;       // 主强度 (0-1)，影响所有视觉效果

  // 自定义背景
  background: {
    imageUrl: string;      // 背景图片 DataURL
    fitMode: "cover" | "stretch" | "center" | "tile";
    opacity: number;       // 背景不透明度 (0-1)
  };
}

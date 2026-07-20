// Port from RipplerX Limiter.h
// 立体声限制器，移植自 FairlyChildish limiter for Reaper
// Original copyright 2006, Thomas Scott Stillwell

export class Limiter {
  private log2db = 8.6858896380650365530225783783321; // 20 / ln(10)
  private db2log = 0.11512925464970228420089957273422;

  private rundb = 0.0;
  private runave = 0.0;
  private threshv = 0.0;
  private ratio = 0;
  private bias = 0.0;
  private makeupv = 0.0;
  private capsc = 0.0;
  private attime = 0.0002;
  private reltime = 0.3;
  private atcoef = 0.0;
  private relcoef = 0.0;
  private rmstime = 0.0;
  private rmscoef = 0.0;

  /** 初始化限制器
   * @param srate - 采样率
   * @param thresh - 阈值 (dB)
   * @param bias - 偏置 (%)
   * @param rms_win - RMS 窗口大小
   * @param makeup - Makeup gain (dB)
   */
  init(srate: number, thresh = 0.0, bias = 70.0, rms_win = 100.0, makeup = 0.0): void {
    this.threshv = Math.exp(thresh * this.db2log);
    this.ratio = 20.0;
    this.bias = 80.0 * bias / 100.0;
    this.makeupv = Math.exp(makeup * this.db2log);
    this.capsc = this.log2db;
    this.attime = 0.0002;
    this.reltime = 0.3;
    this.atcoef = Math.exp(-1.0 / (this.attime * srate));
    this.relcoef = Math.exp(-1.0 / (this.reltime * srate));
    this.rmscoef = Math.exp(-1.0 / (this.rmstime * srate));
    this.rmstime = rms_win / 1000000.0;
    this.runave = 0.0;
  }

  /** 处理立体声采样点，返回 [left, right] */
  process(spl0: number, spl1: number): [left: number, right: number] {
    let maxspl = Math.max(Math.abs(spl0), Math.abs(spl1));
    maxspl = maxspl * maxspl;

    this.runave = maxspl + this.rmscoef * (this.runave - maxspl);
    const det = Math.sqrt(Math.max(0.0, this.runave));
    let overdb = Math.max(0.0, this.capsc * Math.log(det / this.threshv));

    if (overdb > this.rundb)
      this.rundb = overdb + this.atcoef * (this.rundb - overdb);
    else
      this.rundb = overdb + this.relcoef * (this.rundb - overdb);
    overdb = Math.max(0.0, this.rundb);

    const cratio = this.bias === 0.0
      ? this.ratio
      : 1.0 + (this.ratio - 1.0) * Math.sqrt(overdb / this.bias);

    const gr = -overdb * (cratio - 1.0) / cratio;
    const grv = Math.exp(gr * this.db2log);

    return [
      spl0 * grv * this.makeupv,
      spl1 * grv * this.makeupv,
    ];
  }
}

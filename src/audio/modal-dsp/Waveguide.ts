// Port from RipplerX Waveguide.h/cpp
// 用于 OpenTube / ClosedTube 模型的延迟线（waveguide）
// 使用 Float64Array(20000) 作为管缓冲区

export class Waveguide {
  base_freq = 1000.0;
  is_closed = false;
  srate = 0.0;
  decay = 0.0;
  radius = 0.0;
  rel = 0.0;
  vel_decay = 0.0;

  f_k = 0.0;

  private read_ptr_frac = 0.0;
  private write_ptr = 0;
  private tube_decay = 0.0;
  /** 管缓冲区，20000 允许 200kHz 采样率下 10Hz 最低频率 */
  private tube: Float64Array = new Float64Array(20000);
  private tube_len = 20000;
  private y = 0.0;
  private y1 = 0.0;

  /** 更新 waveguide 参数
   * @param f_0 - 基频
   * @param vel - 力度
   * @param pitch_bend - pitch bend 因子
   * @param isRelease - 是否在 release 阶段
   */
  update(f_0: number, vel: number, pitch_bend: number, isRelease: boolean): void {
    this.base_freq = f_0;
    this.f_k = this.base_freq * pitch_bend;
    let tlen = this.srate / this.f_k;
    if (this.is_closed) tlen *= 0.5; // closed tube 低一个八度
    this.read_ptr_frac = this.write_ptr - tlen;
    if (this.read_ptr_frac < 0) this.read_ptr_frac += this.tube_len;

    const decay_k = Math.min(100.0, Math.exp(Math.log(this.decay) + vel * this.vel_decay * (Math.log(100) - Math.log(0.01))));
    const effectiveDecay = isRelease ? decay_k * this.rel : decay_k;
    this.tube_decay = effectiveDecay
      ? Math.exp(-Math.PI / this.base_freq / (this.srate * effectiveDecay / 125000))
      : 0.0;
  }

  /** 应用 pitch bend */
  applyPitchBend(pitch_bend: number): void {
    this.f_k = this.base_freq * pitch_bend;
    let tlen = this.srate / this.f_k;
    if (this.is_closed) tlen *= 0.5;
    this.read_ptr_frac = this.write_ptr - tlen;
    if (this.read_ptr_frac < 0) this.read_ptr_frac += this.tube_len;
  }

  /** 处理一个采样点 */
  process(input: number): number {
    const i0 = Math.floor(this.read_ptr_frac);
    const i1 = (i0 + 1) % this.tube_len;
    const frac = this.read_ptr_frac - i0;
    const sample = this.tube[i0] * (1.0 - frac) + this.tube[i1] * frac;

    // 低通滤波用于频率阻尼（管半径）
    this.y = this.radius * sample + (1.0 - this.radius) * this.y1;
    this.y1 = this.y;

    // 施加衰减
    let dsample = this.y * this.tube_decay;
    if (this.is_closed) dsample *= -1.0; // closed tube: 只有奇次谐波
    this.tube[this.write_ptr] = input + dsample;

    // 递增指针
    this.write_ptr = (this.write_ptr + 1) % this.tube_len;
    this.read_ptr_frac += 1.0;
    if (this.read_ptr_frac >= this.tube_len) this.read_ptr_frac -= this.tube_len;

    return dsample;
  }

  /** 清除内部状态 */
  clear(): void {
    this.y = this.y1 = 0;
    this.write_ptr = 0;
    this.read_ptr_frac = 0.0;
    this.tube.fill(0.0);
  }
}

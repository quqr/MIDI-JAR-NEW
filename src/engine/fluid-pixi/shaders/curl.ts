// 旋度计算着色器：计算速度场的旋度（涡量）
// 输入: uTexture (速度场)
// 无额外纹理资源
// Uniforms: texelSize
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   L = vy at left,  R = vy at right
//   T = vx at top,   B = vx at bottom
//   vorticity = R - L - T + B
// 注意：无 0.5 因子（原版也没有）

export const curlShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    float L = texture(uTexture, vL).y;
    float R = texture(uTexture, vR).y;
    float T = texture(uTexture, vT).x;
    float B = texture(uTexture, vB).x;

    float vorticity = R - L - T + B;
    finalColor = vec4(vorticity, 0.0, 0.0, 1.0);
}
`;

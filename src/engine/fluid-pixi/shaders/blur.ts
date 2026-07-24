// 高斯模糊着色器：3抽头高斯模糊
// 输入: uTexture
// Uniforms: texelSize
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   center * 0.29411764 + left * 0.35294117 + right * 0.35294117
// 用于 sunrays 双向模糊（texelSize 为完整偏移量：水平时 x=1/w,y=0；垂直时 x=0,y=1/h）

export const blurShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    vec2 vL = vTextureCoord - texelSize;
    vec2 vR = vTextureCoord + texelSize;

    vec4 sum = texture(uTexture, vTextureCoord) * 0.29411764;
    sum += texture(uTexture, vL) * 0.35294117;
    sum += texture(uTexture, vR) * 0.35294117;

    finalColor = sum;
}
`;

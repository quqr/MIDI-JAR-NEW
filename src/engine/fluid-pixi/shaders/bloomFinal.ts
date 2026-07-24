// Bloom 最终合成着色器：4邻域平均 × intensity
// 输入: uTexture
// Uniforms: texelSize, intensity
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   sum = vL + vR + vT + vB，sum *= 0.25，sum *= intensity
// 注意：不含中心像素，权重 0.25（非 0.2）

export const bloomFinalShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform float intensity;

out vec4 finalColor;

void main () {
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    vec4 sum = vec4(0.0);
    sum += texture(uTexture, vL);
    sum += texture(uTexture, vR);
    sum += texture(uTexture, vT);
    sum += texture(uTexture, vB);
    sum *= 0.25;

    finalColor = sum * intensity;
}
`;

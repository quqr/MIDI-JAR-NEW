// 散度计算着色器：计算速度场的散度
// 输入: uTexture (速度场)
// 无额外纹理资源
// Uniforms: texelSize
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   含边界条件（vL.x<0 / vR.x>1 / vT.y>1 / vB.y<0 时反射速度）
//   div = 0.5 * (R - L + T - B)

export const divergenceShader = `\
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

    float L = texture(uTexture, vL).x;
    float R = texture(uTexture, vR).x;
    float T = texture(uTexture, vT).y;
    float B = texture(uTexture, vB).y;

    vec2 C = texture(uTexture, vTextureCoord).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }

    float div = 0.5 * (R - L + T - B);
    finalColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

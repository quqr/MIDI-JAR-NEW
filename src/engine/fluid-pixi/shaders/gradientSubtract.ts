// 梯度减法着色器：从速度场减去压力梯度，使速度场无散度
// 输入: uTexture (速度场)
// 额外纹理: uPressure (压力场)
// Uniforms: texelSize
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   velocity.xy -= vec2(R - L, T - B)
// 注意：无 0.5 因子（原版也没有）

export const gradientSubtractShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uPressure;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    float L = texture(uPressure, vL).x;
    float R = texture(uPressure, vR).x;
    float T = texture(uPressure, vT).x;
    float B = texture(uPressure, vB).x;

    vec2 velocity = texture(uTexture, vTextureCoord).xy;
    velocity.xy -= vec2(R - L, T - B);
    finalColor = vec4(velocity, 0.0, 1.0);
}
`;

// 梯度减法着色器：从速度场减去压力梯度，使速度场无散度
// 输入: uTexture (速度场)
// 额外纹理: uPressure (压力场)
// Uniforms: texelSize

export const gradientSubtractShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uPressure;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    // 计算相邻纹素的UV坐标
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    // 采样相邻压力
    float pL = texture(uPressure, vL).x;
    float pR = texture(uPressure, vR).x;
    float pT = texture(uPressure, vT).x;
    float pB = texture(uPressure, vB).x;

    // 采样当前速度
    vec2 velocity = texture(uTexture, vTextureCoord).xy;

    // 减去压力梯度: v = v - grad(p)
    velocity -= vec2(pR - pL, pT - pB) * 0.5;

    finalColor = vec4(velocity, 0.0, 1.0);
}
`;

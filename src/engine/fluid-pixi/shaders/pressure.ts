// 压力雅可比迭代着色器：求解压力泊松方程
// 输入: uTexture (压力场)
// 额外纹理: uDivergence (散度场)
// Uniforms: texelSize

export const pressureShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uDivergence;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    // 计算相邻纹素的UV坐标
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    // 采样相邻压力和当前散度
    float pL = texture(uTexture, vL).x;
    float pR = texture(uTexture, vR).x;
    float pT = texture(uTexture, vT).x;
    float pB = texture(uTexture, vB).x;
    float div = texture(uDivergence, vTextureCoord).x;

    // 雅可比迭代: p = (pL + pR + pT + pB - div) / 4
    float pressure = (pL + pR + pT + pB - div) * 0.25;

    finalColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

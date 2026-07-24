// 散度计算着色器：计算速度场的散度
// 输入: uTexture (速度场)
// 无额外纹理资源
// Uniforms: texelSize

export const divergenceShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    // 计算相邻纹素的UV坐标
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    // 采样相邻速度分量
    float vL_x = texture(uTexture, vL).x;
    float vR_x = texture(uTexture, vR).x;
    float vT_y = texture(uTexture, vT).y;
    float vB_y = texture(uTexture, vB).y;

    // 散度 = dvx/dx + dvy/dy
    float div = 0.5 * (vR_x - vL_x + vT_y - vB_y);

    finalColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

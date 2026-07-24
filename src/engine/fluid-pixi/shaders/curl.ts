// 旋度计算着色器：计算速度场的旋度（涡量）
// 输入: uTexture (速度场)
// 无额外纹理资源
// Uniforms: texelSize

export const curlShader = `\
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

    // 采样相邻速度
    float vL_y = texture(uTexture, vL).y;
    float vR_y = texture(uTexture, vR).y;
    float vT_x = texture(uTexture, vT).x;
    float vB_x = texture(uTexture, vB).x;

    // 2D旋度 = dvx/dy - dvy/dx
    float vorticity = 0.5 * (vT_x - vB_x - vR_y + vL_y);

    finalColor = vec4(vorticity, 0.0, 0.0, 1.0);
}
`;

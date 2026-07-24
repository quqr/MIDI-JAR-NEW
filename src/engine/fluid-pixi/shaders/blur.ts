// 高斯模糊着色器：3采样点模糊
// 输入: uTexture
// Uniforms: texelSize

export const blurShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec2 texelSize;

out vec4 finalColor;

void main () {
    // 3采样点高斯模糊：中心权重0.5，两侧各0.25
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);

    vec3 c = texture(uTexture, vTextureCoord).rgb * 0.5;
    c += texture(uTexture, vL).rgb * 0.25;
    c += texture(uTexture, vR).rgb * 0.25;

    finalColor = vec4(c, 1.0);
}
`;

// 泛光模糊着色器：4邻域平均
// 输入: uTexture
// Uniforms: texelSize

export const bloomBlurShader = `\
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

    // 4邻域平均
    vec3 c = texture(uTexture, vTextureCoord).rgb;
    c += texture(uTexture, vL).rgb;
    c += texture(uTexture, vR).rgb;
    c += texture(uTexture, vT).rgb;
    c += texture(uTexture, vB).rgb;
    c *= 0.2;

    finalColor = vec4(c, 1.0);
}
`;

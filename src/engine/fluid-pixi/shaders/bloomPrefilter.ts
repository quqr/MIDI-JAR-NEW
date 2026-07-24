// 泛光预过滤着色器：提取亮度超过阈值的部分
// 输入: uTexture (染料场)
// Uniforms: curve (vec3), threshold

export const bloomPrefilterShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec3 curve;
uniform float threshold;

out vec4 finalColor;

void main () {
    vec3 c = texture(uTexture, vTextureCoord).rgb;
    // 计算亮度
    float br = max(c.r, max(c.g, c.b));
    // 应用曲线和阈值过滤
    float contribution = max(0.0, br - threshold) / max(br, curve);
    finalColor = vec4(c * contribution, 1.0);
}
`;

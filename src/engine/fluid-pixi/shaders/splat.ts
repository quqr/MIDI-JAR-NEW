// 流体注入着色器：高斯衰减叠加到目标场上
// 输入: uTexture (速度场或染料场)
// 无额外纹理资源
// Uniforms: aspectRatio, color (vec3), point (vec2), radius

export const splatShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;

out vec4 finalColor;

void main () {
    vec2 p = vTextureCoord - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture(uTexture, vTextureCoord).xyz;
    finalColor = vec4(base + splat, 1.0);
}
`;

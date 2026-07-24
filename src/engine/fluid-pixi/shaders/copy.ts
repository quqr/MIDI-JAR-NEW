// 纹理复制着色器：直接输出输入纹理
// 输入: uTexture

export const copyShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;

out vec4 finalColor;

void main () {
    vec3 c = texture(uTexture, vTextureCoord).rgb;
    finalColor = vec4(c, 1.0);
}
`;

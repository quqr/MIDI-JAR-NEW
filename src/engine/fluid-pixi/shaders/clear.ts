// 压力衰减着色器：将压力场乘以衰减值
// 输入: uTexture (压力场)
// 无额外纹理资源
// Uniforms: value

export const clearShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float value;

out vec4 finalColor;

void main () {
    finalColor = value * texture(uTexture, vTextureCoord);
}
`;

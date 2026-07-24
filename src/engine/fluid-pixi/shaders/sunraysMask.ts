// 日光射线遮罩着色器：将亮度转换为alpha
// 输入: uTexture (染料场)

export const sunraysMaskShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;

out vec4 finalColor;

void main () {
    vec4 c = texture(uTexture, vTextureCoord);
    // 亮度作为alpha通道
    float br = max(c.r, max(c.g, c.b));
    finalColor = vec4(c.rgb, br);
}
`;

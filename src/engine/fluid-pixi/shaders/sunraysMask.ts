// Sunrays 遮罩着色器：根据亮度生成 alpha 通道
// 输入: uTexture (染料场)
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   br = max(r, max(g, b))
//   alpha = 1.0 - min(max(br * 20.0, 0.0), 0.8)
// 即：亮区域 alpha 小（光线穿透），暗区域 alpha 大（遮挡）
// 注意：alpha 不能直接用 br，必须用 1 - clamp(br*20, 0, 0.8)

export const sunraysMaskShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;

out vec4 finalColor;

void main () {
    vec4 c = texture(uTexture, vTextureCoord);
    float br = max(c.r, max(c.g, c.b));
    c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
    finalColor = c;
}
`;

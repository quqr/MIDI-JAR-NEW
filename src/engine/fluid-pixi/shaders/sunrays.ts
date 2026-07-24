// 日光射线着色器：从中心径向扩散的光线效果
// 输入: uTexture (遮罩纹理)
// Uniforms: weight

export const sunraysShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float weight;

out vec4 finalColor;

const float GOLDEN_ANGLE = 2.39996;

void main () {
    vec4 color = vec4(0.0);
    // 从屏幕中心向当前像素方向采样
    vec2 center = vec2(0.5);
    vec2 dir = vTextureCoord - center;
    float dist = length(dir);
    dir = normalize(dir);

    // 黄金角螺旋采样，生成径向光线
    for (int i = 0; i < 60; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / 60.0;
        float angle = fi * GOLDEN_ANGLE;
        float r = 1.0 - t;
        float x = center.x + cos(angle) * r;
        float y = center.y + sin(angle) * r;
        // 手动检查是否在纹理范围内
        if (x >= 0.0 && x <= 1.0 && y >= 0.0 && y <= 1.0) {
            float sampleAlpha = texture(uTexture, vec2(x, y)).a;
            color.rgb += sampleAlpha * weight;
        }
    }

    // 根据到中心的距离衰减
    float decay = 1.0 - dist;
    color.rgb *= decay * decay;

    finalColor = vec4(color.rgb, 1.0);
}
`;

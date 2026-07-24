// 最终显示合成着色器：将染料场 + bloom + sunrays 合成到输出纹理
// 输入: uTexture (染料场)
// 额外纹理: uBloom, uSunrays, uDithering (条件性)
// Uniforms: texelSize, ditherScale (vec2), uShading, uBloomEnabled, uSunraysEnabled
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation 的 HDR 管线：
// - 无色调映射，HDR 亮值自然裁剪到白
// - 着色使用法线漫反射，clamp(dot(n,l)+0.7, 0.7, 1.0)
// - Sunrays 乘法（暗化非光照区）
// - Bloom 加 linearToGamma 后再叠加
// 使用 int (i32) 替代 bool，PixiJS UniformGroup 不支持 bool 类型

export const displayShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform sampler2D uDithering;
uniform vec2 texelSize;
uniform vec2 ditherScale;
uniform int uShading;
uniform int uBloomEnabled;
uniform int uSunraysEnabled;

out vec4 finalColor;

vec3 linearToGamma (vec3 color) {
    color = max(color, vec3(0.0));
    return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0.0));
}

void main () {
    vec3 c = texture(uTexture, vTextureCoord).rgb;

    // 着色效果：法线漫反射
    if (uShading != 0) {
        vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
        vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
        vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
        vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

        vec3 lc = texture(uTexture, vL).rgb;
        vec3 rc = texture(uTexture, vR).rgb;
        vec3 tc = texture(uTexture, vT).rgb;
        vec3 bc = texture(uTexture, vB).rgb;

        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);

        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);

        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
        c *= diffuse;
    }

    // Bloom 变量（在 sunrays 之前声明，因 sunrays 会同时影响 c 和 bloom）
    vec3 bloom = vec3(0.0);
    if (uBloomEnabled != 0) {
        bloom = texture(uBloom, vTextureCoord).rgb;
    }

    // 日光射线效果：乘法（暗化非光照区，同时影响 bloom）
    if (uSunraysEnabled != 0) {
        float sunrays = texture(uSunrays, vTextureCoord).r;
        c *= sunrays;
        bloom *= sunrays;
    }

    // 泛光效果：加抖动噪声 → gamma 编码 → 叠加
    if (uBloomEnabled != 0) {
        float noise = texture(uDithering, vTextureCoord * ditherScale).r;
        noise = noise * 2.0 - 1.0;
        bloom += noise / 255.0;
        bloom = linearToGamma(bloom);
        c += bloom;
    }

    // alpha 基于颜色亮度
    float a = max(c.r, max(c.g, c.b));
    finalColor = vec4(c, a);
}
`;

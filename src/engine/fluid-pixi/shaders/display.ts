// 最终显示合成着色器：将染料场渲染到屏幕
// 输入: uTexture (染料场)
// 额外纹理: uBloom, uSunrays, uDithering (条件性)
// Uniforms: texelSize, ditherScale, uShading, uBloomEnabled, uSunraysEnabled
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
uniform float ditherScale;
uniform int uShading;
uniform int uBloomEnabled;
uniform int uSunraysEnabled;

out vec4 finalColor;

vec3 acdTonemap (vec3 color) {
    color = max(vec3(0.0), color);
    color = color / (1.0 + color);
    return pow(color, vec3(1.0 / 2.2));
}

void main () {
    vec3 c = texture(uTexture, vTextureCoord).rgb;

    // 着色效果
    if (uShading != 0) {
        vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
        vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
        vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
        vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

        float vl = texture(uTexture, vL).x;
        float vr = texture(uTexture, vR).x;
        float vt = texture(uTexture, vT).x;
        float vb = texture(uTexture, vB).x;

        float grad = length(vec2(vr - vl, vt - vb));
        c = clamp(c + grad * 0.3, 0.0, 1.0);
    }

    // 泛光效果
    if (uBloomEnabled != 0) {
        vec3 bloom = texture(uBloom, vTextureCoord).rgb;
        c += bloom;
    }

    // 日光射线效果
    if (uSunraysEnabled != 0) {
        float sunrays = texture(uSunrays, vTextureCoord).r;
        c += sunrays;
    }

    // 色调映射
    c = acdTonemap(c);

    // 抖动消除色带
    if (uShading != 0) {
        vec2 uv = vTextureCoord * ditherScale;
        vec3 dither = texture(uDithering, uv).rgb;
        c += dither * 0.01;
    }

    finalColor = vec4(c, 1.0);
}
`;

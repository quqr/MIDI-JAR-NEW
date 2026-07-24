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

const int ITERATIONS = 16;

void main () {
    float Density = 0.3;
    float Decay = 0.95;
    float Exposure = 0.7;

    vec2 coord = vTextureCoord;
    vec2 dir = vTextureCoord - 0.5;
    dir *= 1.0 / float(ITERATIONS) * Density;
    float illuminationDecay = 1.0;

    float color = texture(uTexture, vTextureCoord).a;

    for (int i = 0; i < ITERATIONS; i++) {
        coord -= dir;
        float col = texture(uTexture, coord).a;
        color += col * illuminationDecay * weight;
        illuminationDecay *= Decay;
    }

    finalColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
}
`;

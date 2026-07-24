// 涡量约束着色器：增强涡旋效果
// 输入: uTexture (速度场)
// 额外纹理: uCurl (旋度场)
// Uniforms: texelSize, curl, dt
//
// 完全对齐原版 PavelDoGreat WebGL-Fluid-Simulation:
//   force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L))
//   force /= length(force) + 0.0001
//   force *= curl * C
//   force.y *= -1.0
//   velocity += force * dt
//   velocity = min(max(velocity, -1000.0), 1000.0)  ← 数值稳定性 clamp

export const vorticityShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curl;
uniform float dt;

out vec4 finalColor;

void main () {
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    float L = texture(uCurl, vL).x;
    float R = texture(uCurl, vR).x;
    float T = texture(uCurl, vT).x;
    float B = texture(uCurl, vB).x;
    float C = texture(uCurl, vTextureCoord).x;

    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;

    vec2 velocity = texture(uTexture, vTextureCoord).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    finalColor = vec4(velocity, 0.0, 1.0);
}
`;

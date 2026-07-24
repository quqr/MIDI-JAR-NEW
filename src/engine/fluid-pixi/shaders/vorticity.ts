// 涡量约束着色器：增强涡旋效果
// 输入: uTexture (速度场)
// 额外纹理: uCurl (旋度场)
// Uniforms: texelSize, curl, dt

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
    // 计算相邻纹素的UV坐标
    vec2 vL = vTextureCoord - vec2(texelSize.x, 0.0);
    vec2 vR = vTextureCoord + vec2(texelSize.x, 0.0);
    vec2 vT = vTextureCoord + vec2(0.0, texelSize.y);
    vec2 vB = vTextureCoord - vec2(0.0, texelSize.y);

    // 采样相邻旋度
    float L = texture(uCurl, vL).x;
    float R = texture(uCurl, vR).x;
    float T = texture(uCurl, vT).x;
    float B = texture(uCurl, vB).x;
    float C = texture(uCurl, vTextureCoord).x;

    // 计算旋度梯度方向
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    // 将力方向旋转90度（垂直于梯度方向）
    force.y *= -1.0;

    // 采样当前速度并施加涡量约束力
    vec2 velocity = texture(uTexture, vTextureCoord).xy;
    velocity += force * dt;

    finalColor = vec4(velocity, 0.0, 1.0);
}
`;

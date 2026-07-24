// 平流着色器：沿速度场推动量场
// 输入: uTexture (源场 - 速度或染料)
// 额外纹理: uVelocity (染料平流时的速度场，作为资源传入)
//   速度平流时 uVelocity == uTexture，无需额外资源
// Uniforms: texelSize, dyeTexelSize, dt, dissipation

export const advectionShader = `\
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;

out vec4 finalColor;

void main () {
    // 从速度场采样当前速度，回溯到上一帧位置
    vec2 vel = texture(uVelocity, vTextureCoord).xy;
    vec2 coord = vTextureCoord - dt * vel * texelSize;

    // 使用硬件双线性滤波（WebGL2 保证支持）
    vec4 result = dissipation * texture(uTexture, coord);
    finalColor = vec4(result.rgb, 1.0);
}
`;

// 纯色填充片元着色器
export const colorShader = `
    precision mediump float;

    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`;

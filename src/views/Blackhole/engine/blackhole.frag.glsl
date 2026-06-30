// blackhole.frag.glsl — Ported from ghostty-blackhole to PixiJS 8 Filter
// Geodesic-traced Schwarzschild black hole with accretion disk, photon ring,
// gravitational lensing, and procedural starfield.
//
// Original: https://github.com/.../blackhole.glsl
// After Eric Bruneton's "Real-time High-Quality Rendering of Non-Rotating Black Holes"

in vec2 vTextureCoord;
out vec4 finalColor;

// PixiJS uniforms
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;

// Blackhole parameters
uniform float uHoleRadius;
uniform float uLensDepth;
uniform float uStarGain;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskIncl;
uniform float uDiskRoll;
uniform float uDiskGain;
uniform float uDiskOpacity;
uniform float uDiskTemp;
uniform float uDopplerMix;
uniform float uDiskBeam;
uniform float uDiskSpeed;
uniform float uDiskWind;
uniform float uDiskContrast;
uniform float uExposure;
uniform float uDriftSpeed;
uniform float uIntensity;

#define N_STEPS 48
#define B_CRIT 2.5980762
#define PI 3.1415927

// ─── Utility ───

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float perY) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float y0 = mod(i.y, perY), y1 = mod(i.y + 1.0, perY);
    return mix(mix(hash21(vec2(i.x, y0)),       hash21(vec2(i.x + 1.0, y0)), f.x),
               mix(hash21(vec2(i.x, y1)),       hash21(vec2(i.x + 1.0, y1)), f.x),
               f.y);
}

vec2 rot(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec2 lissa(float t) {
    return vec2(0.75 * sin(t * 0.37) + 0.25 * sin(t * 0.83 + 1.0),
                0.70 * sin(t * 0.54 + 2.1) + 0.30 * sin(t * 1.07));
}

vec3 blackbody(float T) {
    float t = clamp(T, 1500.0, 40000.0) / 100.0;
    float r = t <= 66.0 ? 1.0
                        : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                        : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    float b = t >= 66.0 ? 1.0
                        : (t <= 19.0 ? 0.0
                                     : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
    return vec3(r, g, b);
}

vec3 stars(vec3 d, float time) {
    vec2 sph = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0)));
    vec2 g   = sph * 40.0;
    vec2 id  = floor(g);
    float h  = hash21(id);
    if (h < 0.92) return vec3(0.0);
    vec2 f   = fract(g) - 0.5;
    vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.7;
    float spark = smoothstep(0.10, 0.0, length(f - off));
    float tw    = 0.7 + 0.3 * sin(time * (0.5 + 2.0 * hash21(id + 5.1)) + 40.0 * h);
    vec3 tint   = mix(vec3(1.0, 0.82, 0.60), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
    return tint * spark * tw * ((h - 0.92) / 0.08);
}

void main() {
    vec2  res    = uResolution;
    vec2  uv     = vTextureCoord;
    float aspect = res.x / res.y;

    // PixiJS UV: y runs top-down; work in height-from-bottom
    float yUp = 1.0 - uv.y;

    float t = uTime * uDriftSpeed;

    // Sanitized disk radii
    float rin  = max(uDiskInner, 1.6);
    float rout = max(uDiskOuter, rin + 0.5);

    // Intensity drives all visual effects
    float I = uIntensity;
    float vis = smoothstep(0.0, 0.10, I);
    if (vis <= 0.0) {
        // Show dark background with faint stars when intensity is zero
        vec3 bg = vec3(0.0);
        vec3 d = normalize(vec3((uv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
        bg += stars(d, uTime) * 0.5;
        finalColor = vec4(bg, 1.0);
        return;
    }

    float sz = mix(0.22, 1.0, I);
    float rh = uHoleRadius * sz;

    // Lissajous drift center
    vec2 center = vec2(
        0.5 + (0.24 * sin(t * 0.21) + 0.05 * sin(t * 0.083)),
        0.5 + (0.42 * sin(t * 0.157 + 2.0) + 0.08 * sin(t * 0.117)));
    center += I * vec2(0.040 * sin(t * 0.83) + 0.020 * sin(t * 1.31),
                       0.030 * sin(t * 1.03 + 1.0));

    // Gravitational time dilation
    float dil = mix(1.0, 0.2, I);

    // Aspect-corrected frame centered on the hole
    vec2  p    = (uv - center) * vec2(aspect, 1.0);
    float plen = length(p);

    // Screen <-> world mapping
    float W  = B_CRIT / max(rh, 1e-4);
    vec2  pr = rot(vec2(p.x, -p.y), uDiskRoll) * W;
    float b  = length(pr);

    // Distance window: lensing fades away from hole
    float window = exp(-pow(plen / (7.0 * rh), 2.0));

    float bmax = rout + 3.0;
    float Z0   = max(14.0, rout + 5.0);

    // ================= far field: analytic weak deflection ==================
    if (b >= bmax) {
        float u    = Z0 * inversesqrt(Z0 * Z0 + b * b);
        float defl = (2.0 / (W * W)) / max(plen, 1e-4)
                   * (1.29 * u + 0.07) * max(uLensDepth - 2.14 * u + 0.75, 0.0)
                   * window * vis;
        vec2  dir  = p / max(plen, 1e-5);

        // Chromatic aberration on stars
        float ab = 0.035 * smoothstep(1.0, 2.0, b / bmax);
        vec3 term = vec3(0.0);
        for (int i = 0; i < 3; i++) {
            float k   = 1.0 + (float(i) - 1.0) * ab;
            vec2  sp  = p - dir * defl * k;
            vec2  suv = 1.0 - abs(1.0 - mod(center + sp / vec2(aspect, 1.0), 2.0));
            // Replace iChannel0 with starfield
            vec3 rd = normalize(vec3((suv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
            term[i] = stars(rd, uTime)[i] * uStarGain * 2.0;
        }

        vec3 d = normalize(vec3(-(pr / b) * (2.0 / b), -1.0));
        finalColor = vec4(term + stars(d, uTime) * uStarGain * window * vis, 1.0);
        return;
    }

    // ====================== near field: trace the geodesic ==================
    vec3  x  = vec3(pr, Z0);
    vec3  v  = vec3(0.0, 0.0, -1.0);
    float h2 = dot(pr, pr);

    // Disk plane
    float ci = cos(uDiskIncl), si = sin(uDiskIncl);
    vec3  n  = vec3(0.0, si, ci);
    vec3  e2 = vec3(0.0, ci, -si);
    float sdir = uDiskSpeed < 0.0 ? -1.0 : 1.0;
    float spd  = abs(uDiskSpeed);

    vec3  emitc = vec3(0.0);
    float trans = 1.0;
    bool  captured = false;
    float sPrev = dot(x, n);
    vec3  xPrev = x;

    for (int i = 0; i < N_STEPS; i++) {
        float r2 = dot(x, x);
        if (r2 < 1.0) { captured = true; break; }
        if (x.z < -Z0 && v.z < 0.0) break;
        if (r2 > 4.0 * Z0 * Z0) break;
        float r  = sqrt(r2);
        float dt = clamp(0.16 * r, 0.03, 1.5);

        // Leapfrog integration
        vec3 a = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);
        x += v * dt;
        r2 = dot(x, x);
        r  = sqrt(r2);
        a  = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);

        // Thin-disk crossing
        float s = dot(x, n);
        if (s * sPrev < 0.0 && trans > 0.02) {
            float tc = sPrev / (sPrev - s);
            vec3  xc = mix(xPrev, x, tc);
            float rc = length(xc);
            if (rc > rin && rc < rout) {
                float band = smoothstep(rin, rin * 1.25, rc)
                           * (1.0 - smoothstep(rout * 0.70, rout, rc));

                float phi   = atan(dot(xc, e2), xc.x);
                float turns = phi / 6.2831853;
                float kep   = pow(rin / rc, 1.5);
                float gloc  = sqrt(max(1.0 - 1.5 / rc, 0.02));
                float swirl = rc * uDiskWind * 0.12 - t * kep * spd * gloc * dil * sdir;
                float streaks = vnoiseWrapY(vec2(rc * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65 +
                                vnoiseWrapY(vec2(rc * 1.0, turns * 9.0  + swirl * 1.5 + 7.0), 9.0) * 0.35;
                streaks = 0.35 + uDiskContrast * streaks * streaks;

                vec3  gasdir = normalize(cross(n, xc)) * sdir;
                float beta   = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
                float g      = gloc / max(1.0 + beta * dot(gasdir, normalize(v)), 0.05);
                g = mix(1.0, g, uDopplerMix);

                float xpr   = max(1.0 - sqrt(rin / rc), 0.0);
                float tprof = pow(rin / rc, 0.75) * pow(xpr, 0.25) / 0.488;
                vec3  cbb   = blackbody(uDiskTemp * tprof * g);
                float boost = pow(g, uDiskBeam);

                float density = band * streaks;
                emitc += trans * cbb * (uDiskGain * 2.2 * density * tprof * tprof * boost);
                trans *= 1.0 - clamp(uDiskOpacity * density, 0.0, 1.0);
            }
        }
        sPrev = s;
        xPrev = x;
    }
    if (!captured && dot(x, x) < 4.0) captured = true;

    // ---- background: escaped ray mapped to starfield sky ----
    vec3 bg = vec3(0.0);
    if (!captured) {
        vec3 d = normalize(v);
        bg += stars(d, uTime) * uStarGain * window * vis;
        if (d.z < -0.05) {
            float tpl = (-uLensDepth - x.z) / d.z;
            vec3  hp  = x + d * tpl;
            vec2  q   = rot(hp.xy, -uDiskRoll) / W;
            vec2  sp  = vec2(q.x, -q.y);
            vec2  suv = 1.0 - abs(1.0 - mod(center + (p + (sp - p) * window * vis) / vec2(aspect, 1.0), 2.0));
            float toward = smoothstep(0.05, 0.35, -d.z);
            // Replace iChannel0 with starfield
            vec3 rd = normalize(vec3((suv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
            bg += stars(rd, uTime) * uStarGain * 2.0 * toward;
        }
    }

    // Tonemap disk light on top of background
    vec3 col = bg * trans + (vec3(1.0) - exp(-emitc * uExposure));
    finalColor = vec4(col, 1.0);
}

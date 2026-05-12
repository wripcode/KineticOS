#version 300 es
precision highp float;

uniform vec3  u_color;
uniform vec2  u_resolution;
uniform vec2  u_offset;
uniform float u_time;
uniform float u_hover_time;    // Seconds since hover started; 1e6 = always revealed
uniform vec2  u_mouse_pos;     // Cursor in element-relative physical px (y-up); (-1,-1) = inactive
uniform float u_mouse_radius;  // Physical-pixel repulsion radius
uniform float u_mouse_strength; // Feed subtraction at cursor center
uniform float u_pixel_size;
uniform float u_scale;
uniform float u_density;
uniform float u_pixel_jitter;
uniform float u_edge_fade;
uniform float u_opacity_mul;
uniform float u_corner_radius;
uniform int   u_shape_type;
uniform int   u_enable_ripples;
uniform float u_ripple_speed;
uniform float u_ripple_thickness;
uniform float u_ripple_intensity;

const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;
uniform vec2  u_click_pos[MAX_CLICKS];
uniform float u_click_times[MAX_CLICKS];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
#define Bayer4(a) (Bayer2(0.5 * (a)) * 0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5 * (a)) * 0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n) {
  return fract(sin(n) * 43758.5453);
}

float vnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t) {
  vec3 p = vec3(uv * u_scale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i) {
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov) {
  float r = sqrt(cov) * 0.25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov) {
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r * (1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d / aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov) {
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main() {
  // Element-relative coordinates — u_offset is the physical-pixel bottom-left of the element
  // in canvas space. Subtracting it makes (0,0) the element's bottom-left corner.
  vec2 elemCoord = gl_FragCoord.xy - u_offset;
  // Centered within the element, matching the click-position coordinate system.
  vec2 fragCoord = elemCoord - u_resolution * 0.5;

  float pixelSize = u_pixel_size;
  float aspectRatio = u_resolution.x / u_resolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / u_resolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, u_time * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (u_density - 0.5) * 0.3;

  // Cursor repulsion — erases pixels in a smooth radius around the mouse
  if (u_mouse_pos.x >= 0.0) {
    vec2 mCenter = u_mouse_pos - u_resolution * 0.5;
    float mDist  = length(fragCoord - mCenter);
    feed -= u_mouse_strength * smoothstep(u_mouse_radius, 0.0, mDist);
  }

  if (u_enable_ripples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i) {
      vec2 pos = u_click_pos[i];
      if (pos.x < 0.0) continue;
      vec2 cuv = ((pos - u_resolution * 0.5 - cellPixelSize * 0.5) / u_resolution) * vec2(aspectRatio, 1.0);
      float t = max(u_time - u_click_times[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = u_ripple_speed * t;
      float ring  = exp(-pow((r - waveR) / u_ripple_thickness, 2.0));
      float atten = exp(-1.0 * t) * exp(-10.0 * r);
      feed = max(feed, ring * atten * u_ripple_intensity);
    }
  }

  float bayer = Bayer8(fragCoord / u_pixel_size) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / u_pixel_size), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * u_pixel_jitter;
  float coverage = bw * jitterScale;
  float M;
  if      (u_shape_type == SHAPE_CIRCLE)   M = maskCircle(pixelUV, coverage);
  else if (u_shape_type == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (u_shape_type == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                     M = coverage;

  if (u_edge_fade > 0.0) {
    vec2 norm = elemCoord / u_resolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, u_edge_fade, edge);
    M *= fade;
  }

  // SDF rounded-rect clipping — use element-relative centered coords
  vec2 halfSize = u_resolution * 0.5;
  vec2 centerPos = elemCoord - halfSize;
  vec2 Q = abs(centerPos) - halfSize + vec2(u_corner_radius);
  float dist = min(max(Q.x, Q.y), 0.0) + length(max(Q, 0.0)) - u_corner_radius;
  if (dist > 0.0) discard;

  M *= u_opacity_mul;

  // Radial reveal — pixels expand from center based on hover_time (mirrors dots-shader intro wave)
  float halfDiag = length(u_resolution * 0.5);
  float revealDist = halfDiag > 0.0 ? length(fragCoord) / halfDiag : 0.0;
  M *= step(revealDist * 0.6, u_hover_time);

  vec3 srgbColor = mix(
    u_color * 12.92,
    1.055 * pow(u_color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, u_color)
  );

  fragColor = vec4(srgbColor, M);
  fragColor.rgb *= fragColor.a;
}

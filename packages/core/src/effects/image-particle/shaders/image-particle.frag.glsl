#version 300 es
precision mediump float;

in float v_color_index;
in vec2 v_center_pos;

uniform vec3 u_colors[6];
uniform float u_dot_size;
uniform vec2 u_resolution;
uniform float u_opacity_mul;
uniform float u_corner_radius;

out vec4 fragColor;

void main() {
  // SDF clipping — pixel-perfect rounded rectangle mask (same math as dots-shader)
  vec2 pixel_pos = v_center_pos + (gl_PointCoord - 0.5) * u_dot_size;
  vec2 halfSize = u_resolution * 0.5;
  vec2 centerPos = pixel_pos - halfSize;
  vec2 Q = abs(centerPos) - halfSize + vec2(u_corner_radius);
  float dist = min(max(Q.x, Q.y), 0.0) + length(max(Q, 0.0)) - u_corner_radius;

  if (dist > 0.0) {
    discard;
  }

  vec3 color = u_colors[int(v_color_index)];
  float opacity = u_opacity_mul;

  // Premultiplied alpha for correct additive blending
  fragColor = vec4(color, opacity);
  fragColor.rgb *= fragColor.a;
}

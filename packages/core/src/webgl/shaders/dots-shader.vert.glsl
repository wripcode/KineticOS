#version 300 es
precision mediump float;

// CSS pixel position of this dot (base + physics offset, updated per frame)
in vec2 a_position;
// Stable grid cell ID — used by fragment shader for random seed
in vec2 a_st2;

uniform vec2 u_resolution;  // Canvas size in CSS pixels
uniform float u_dot_size;   // Dot diameter in CSS pixels
uniform float u_dpr;        // Device pixel ratio (for gl_PointSize)
uniform float u_corner_radius; // Element's CSS border-radius in px

out vec2 v_st2;

void main() {
  // Map CSS pixel coords → NDC [-1, 1]
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  // WebGL Y is flipped relative to CSS: top-left origin vs bottom-left
  clip.y = -clip.y;

  gl_Position = vec4(clip, 0.0, 1.0);
  
  // Calculate signed distance from the rounded rectangle container
  vec2 halfSize = u_resolution * 0.5;
  vec2 centerPos = a_position - halfSize;
  vec2 Q = abs(centerPos) - halfSize + vec2(u_corner_radius);
  float dist = min(max(Q.x, Q.y), 0.0) + length(max(Q, 0.0)) - u_corner_radius;

  // Render point normally, or discard by setting PointSize to 0 if outside rounded bounds
  gl_PointSize = dist > 0.1 ? 0.0 : u_dot_size * u_dpr;
  v_st2 = a_st2;
}

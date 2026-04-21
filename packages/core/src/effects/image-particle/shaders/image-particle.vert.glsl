#version 300 es
precision mediump float;

in vec2 a_position;
in float a_color_index;

uniform vec2 u_resolution;
uniform float u_dot_size;
uniform float u_dpr;

out float v_color_index;
out vec2 v_center_pos;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;

  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = u_dot_size * u_dpr;
  v_color_index = a_color_index;
  v_center_pos = a_position;
}

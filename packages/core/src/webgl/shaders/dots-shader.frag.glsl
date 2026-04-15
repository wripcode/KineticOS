#version 300 es
precision mediump float;

in vec2 v_st2;  // Grid cell ID from vertex shader
in vec2 v_center_pos; // Canvas CSS position from vertex shader

uniform float u_time;          // Accumulated time in seconds (never resets on tab-switch)
uniform float u_opacities[10]; // Opacity distribution — 10 bucket weights
uniform vec3 u_colors[6];      // 6 color slots (expanded from 1–6 user colors)
uniform float u_total_size;    // Grid cell size (same as dotSize spacing)
uniform float u_dot_size;      // Dot diameter in CSS pixels
uniform vec2 u_resolution;     // Canvas size in CSS pixels
uniform float u_opacity_mul;   // Per-node opacity multiplier — drives ko-hover="container" fade (default 1.0)
uniform float u_corner_radius; // Container CSS border-radius

out vec4 fragColor;

// Golden ratio — creates well-distributed pseudo-random values from 2D coords
float PHI = 1.61803398874989484820459;

float random(vec2 xy) {
  return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
}

void main() {
  // 1. Pixel-perfect curved clipping (respects CSS border-radius)
  // gl_PointCoord goes 0 to 1 across the dot. We calculate the exact CSS pixel coordinate.
  vec2 pixel_pos = v_center_pos + (gl_PointCoord - 0.5) * u_dot_size;
  vec2 halfSize = u_resolution * 0.5;
  vec2 centerPos = pixel_pos - halfSize;
  vec2 Q = abs(centerPos) - halfSize + vec2(u_corner_radius);
  float dist = min(max(Q.x, Q.y), 0.0) + length(max(Q, 0.0)) - u_corner_radius;
  
  if (dist > 0.0) {
    discard;
  }

  float opacity = 1.0;
  vec2 st2 = v_st2;

  // Per-dot stable random seed from its grid position
  float show_offset = random(st2);

  // Random opacity flicker — changes every `frequency` seconds using time-quantized seed
  float frequency = 5.0;
  float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency) + 1.0);
  opacity *= u_opacities[int(rand * 10.0)];

  // Color assignment — each dot is locked to one of the 6 palette slots
  vec3 color = u_colors[int(show_offset * 6.0)];

  // Intro wave — dots appear in a radial wave from the center, with slight randomness
  float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);
  opacity *= step(intro_offset, u_time);
  // Brief brightness flash as each dot appears (the Webflow-style flash)
  opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time)) * 1.25, 1.0, 1.25);

  // Per-node fade: default 1.0, driven by container hover pointer events
  opacity *= u_opacity_mul;

  // Premultiplied alpha — required for correct additive blending
  fragColor = vec4(color, opacity);
  fragColor.rgb *= fragColor.a;
}

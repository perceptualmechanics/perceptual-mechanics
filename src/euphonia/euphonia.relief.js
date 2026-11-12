// The sea's depths and the land's relief, drawn per pixel by WebGL2 from the
// vendored ETOPO5 grid (euphonia.relief.json). Each pixel runs the globe's
// orthographic projection backwards to its point on the sphere, as
// euphonia.projection.js's orthoUnproject does, and reads the grid there. Drawing per pixel in script would
// cost far more than a frame; the GPU does it for each view.
//
// Two passes: the sea, in depth bands; the land, hillshaded. The page lays
// the sea under everything and the land only inside Natural Earth's coasts,
// so the grid's own coast, a quarter degree coarse, never shows.
import layout from './euphonia.relief.json';

// Natural Earth's bathymetry bands, in metres: the shelf's edge at 200, then
// 1,000 and every 1,000 below.
const DEPTHS = [200, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
// The cartographers' light: from the northwest (azimuth 315°), 45° up.
const LIGHT_AZIMUTH = 315, LIGHT_ALTITUDE = 45;
const RAD = Math.PI / 180;
const METRES_PER_DEGREE = 6371000 * RAD;

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D grid;
uniform vec2 gridSize;          // columns, rows
uniform vec3 gridOrigin;        // lat0, lon0, step (degrees)
uniform float extreme, scale;
uniform float height, cx, cy, k, roll, lon0, lat0;
uniform int mode;               // 0 sea, 1 land
uniform float depths[${DEPTHS.length}];
uniform vec3 shelf, abyss, land, lit, shade;
uniform vec3 light;
uniform float exaggeration, metresPerDegree;
out vec4 colour;
const float RAD = ${RAD};

vec2 cell(float lat, float lon) {
  return vec2((lon - gridOrigin.y) / gridOrigin.z + 0.5, (gridOrigin.x - lat) / gridOrigin.z + 0.5) / gridSize;
}
float elevation(vec2 uv) {
  float b = texture(grid, uv).r * scale;
  return b * abs(b) * extreme / (scale * scale);
}

void main() {
  // The canvas pixel's unit-disc point, as euphonia.draw.js's fromScreen:
  // about the globe's centre, the roll turned back.
  vec2 px = vec2(gl_FragCoord.x, height - gl_FragCoord.y);
  vec2 R = vec2(px.x - cx, cy - px.y) / k;
  float cr = cos(roll * RAD), sr = sin(roll * RAD);
  vec2 X = vec2(R.x * cr - R.y * sr, R.x * sr + R.y * cr);
  float q = dot(X, X);
  if (q > 1.0) discard;
  // Back to the sphere, as orthoUnproject: the facing point, turned back
  // from the view's frame.
  float Z = sqrt(1.0 - q), c0 = cos(lat0 * RAD), s0 = sin(lat0 * RAD);
  float lat = asin(clamp(X.y * c0 + Z * s0, -1.0, 1.0)) / RAD;
  float lon = lon0 + atan(X.x, Z * c0 - X.y * s0) / RAD;
  vec2 uv = cell(lat, lon);
  float e = elevation(uv);
  if (mode == 0) {
    // Depth bands, the shelf lightest; above sea level, the shelf's colour.
    float band = 0.0;
    for (int i = 0; i < ${DEPTHS.length}; i++) band += step(depths[i], -e);
    colour = vec4(mix(shelf, abyss, band / ${DEPTHS.length}.0), 1.0);
  } else {
    // Hillshading: the slope from the neighbouring cells, steepened by the
    // grid's own exaggeration, lit from the northwest.
    vec2 d = vec2(1.0) / gridSize;
    float dx = 2.0 * gridOrigin.z * metresPerDegree * max(cos(lat * RAD), 0.01);
    float dy = 2.0 * gridOrigin.z * metresPerDegree;
    float east = (elevation(uv + vec2(d.x, 0.0)) - elevation(uv - vec2(d.x, 0.0))) / dx;
    float north = (elevation(uv - vec2(0.0, d.y)) - elevation(uv + vec2(0.0, d.y))) / dy;
    vec3 n = normalize(vec3(-east * exaggeration, -north * exaggeration, 1.0));
    // Flat ground keeps the land's colour; facing the light lifts it toward
    // lit, facing away lowers it toward shade.
    float k = dot(n, light) - light.z;
    colour = vec4(k >= 0.0 ? mix(land, lit, min(k / (1.0 - light.z), 1.0)) : mix(land, shade, min(-k / light.z, 1.0)), 1.0);
  }
}`;

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

// A renderer for one canvas size at a time, or null where WebGL2 isn't
// available: the map then keeps its flat sea and land.
export function createRelief(bytes, colors) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const { rows, cols, step, lat0, lon0, scale, extreme } = layout.layout;
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8_SNORM, cols, rows, 0, gl.RED, gl.BYTE, new Int8Array(bytes));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Longitude wraps round the globe; latitude stops at the poles.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const u = name => gl.getUniformLocation(program, name);
  gl.uniform2f(u('gridSize'), cols, rows);
  gl.uniform3f(u('gridOrigin'), lat0, lon0, step);
  gl.uniform1f(u('extreme'), extreme);
  gl.uniform1f(u('scale'), scale);
  gl.uniform1fv(u('depths'), DEPTHS);
  // Its colours, set now and again when the theme changes; nothing else is redone.
  const recolor = palette => { for (const name of ['shelf', 'abyss', 'land', 'lit', 'shade']) gl.uniform3fv(u(name), rgb(palette[`relief-${name}`])); };
  recolor(colors);
  const az = LIGHT_AZIMUTH * RAD, alt = LIGHT_ALTITUDE * RAD;
  gl.uniform3f(u('light'), Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt));
  gl.uniform1f(u('exaggeration'), layout.shading.exaggeration);
  gl.uniform1f(u('metresPerDegree'), METRES_PER_DEGREE);

  // The view's sea or land, on this renderer's canvas, for the caller to draw
  // from before the next pass; and how to give it new colours.
  return Object.assign(function render(view, mode) {
    if (canvas.width !== view.width || canvas.height !== view.height) { canvas.width = view.width; canvas.height = view.height; }
    gl.viewport(0, 0, view.width, view.height);
    gl.uniform1f(u('height'), view.height);
    gl.uniform1f(u('cx'), view.cx);
    gl.uniform1f(u('cy'), view.cy);
    gl.uniform1f(u('k'), view.k);
    gl.uniform1f(u('roll'), view.roll);
    gl.uniform1f(u('lon0'), view.lon0);
    gl.uniform1f(u('lat0'), view.lat0);
    gl.uniform1i(u('mode'), mode === 'land' ? 1 : 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }, { recolor });
}

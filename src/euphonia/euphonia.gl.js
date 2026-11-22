// The globe drawn by WebGL2, every layer of it in one canvas the page shows as
// it is: the sea's depths and the land's relief from the vendored ETOPO5 grid
// (euphonia.relief.bin, laid out by euphonia.relief.json), the water-lining, the lakes, the lines, the roses,
// the regions' glows and the marks. The 2D canvas drew the same (and still
// does where WebGL2 isn't there: euphonia.draw.js), but stroked and filled
// every coast each frame; in Firefox a turn of the globe cost 600 ms. Here
// the GPU projects the static geometry itself, and only the land and lakes,
// which must be clipped to the visible hemisphere, are projected in script.
//
// The projection is euphonia.projection.js's orthographic, north up, the
// point (lon0, lat0) at the centre; the relief runs it backwards for each
// pixel, the lines forwards for each point.
import layout from './euphonia.relief.json';
import { geoPath } from 'd3-geo';
import { projectionFor, ellipseOf } from './euphonia.globe.js';
import { LAMP, ROOM } from './euphonia.mount.js';
import { GLOBE_LINES, CIRCLES_LINE, MARKS, WATERLINING, circlesOf } from './euphonia.draw.js';

// Natural Earth's bathymetry bands, in metres: the shelf's edge at 200, then
// 1,000 and every 1,000 below.
const DEPTHS = [200, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
const RAD = Math.PI / 180;
const METRES_PER_DEGREE = 6371000 * RAD;
// The lines' points no further apart than this, in degrees: a chord of 0.5°
// strays R(1 − cos 0.25°), 1e-5 of the globe's radius, from its arc, under a
// pixel on a globe 100,000 pixels across, past any zoom the page allows.
const STEP_DEG = 0.5;
// Antialiasing samples for the land and lakes' mask.
const MASK_SAMPLES = 4;

// The projection, in GLSL: a point (lon, lat) on the canvas in pixels (y
// down), and how far it faces the eye (its z; behind the limb below zero).
const PROJECTION = `
uniform float lon0, lat0, k, cx, cy;
uniform vec2 size;
vec3 project(vec2 at) {
  float l = radians(at.x - lon0), p = radians(at.y), c0 = cos(radians(lat0)), s0 = sin(radians(lat0));
  float x = cos(p) * sin(l), y = cos(p) * cos(l), z = sin(p);
  return vec3(cx + k * x, cy - k * (z * c0 - y * s0), z * s0 + y * c0);
}
vec4 toClip(vec2 px) { return vec4(px.x / size.x * 2.0 - 1.0, 1.0 - px.y / size.y * 2.0, 0.0, 1.0); }
// A pixel's point on the sphere, as orthoUnproject: lat and lon, or false
// beyond the limb. px in canvas pixels, y down.
bool unproject(vec2 px, out vec2 at, out float facing) {
  vec2 X = vec2(px.x - cx, cy - px.y) / k;
  float q = dot(X, X);
  if (q > 1.0) return false;
  float Z = sqrt(1.0 - q), c0 = cos(radians(lat0)), s0 = sin(radians(lat0));
  at = vec2(lon0 + degrees(atan(X.x, Z * c0 - X.y * s0)), degrees(asin(clamp(X.y * c0 + Z * s0, -1.0, 1.0))));
  facing = Z;
  return true;
}`;

// The square over the whole canvas, its corners at attribute 0.
const SQUARE = `#version 300 es
layout(location = 0) in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

// A pixel's coordinates in an RGBA8 texel, 16 bits each, exact; all ones is
// none found.
const PACKING = `
const float NONE = 65535.0;
vec4 pack(vec2 p) { return vec4(floor(p.x / 256.0), mod(p.x, 256.0), floor(p.y / 256.0), mod(p.y, 256.0)) / 255.0; }
vec2 unpack(vec4 v) { v = floor(v * 255.0 + 0.5); return vec2(v.r * 256.0 + v.g, v.b * 256.0 + v.a); }`;

// The land and lakes' mask: their rings, already projected and clipped to the
// visible hemisphere, as fans of triangles that toggle the stencil, so any
// ring fills as its outline encloses (even-odd); then a square where the
// stencil is set paints the mask's channel.
const FAN = `#version 300 es
layout(location = 0) in vec2 px;
uniform vec2 size;
void main() { gl_Position = vec4(px.x / size.x * 2.0 - 1.0, 1.0 - px.y / size.y * 2.0, 0.0, 1.0); }`;
const PAINT = `#version 300 es
precision highp float;
out vec4 colour;
void main() { colour = vec4(1.0); }`;

// The water-lining's distances: a jump flood from the land (Rong and Tan,
// "Jump Flooding in GPU", 2006) finds each pixel's nearest land pixel in a
// few passes; its distance is the distance a round-joined stroke of the
// coast would reach. First each land pixel is its own nearest.
const SEED = `#version 300 es
precision highp float;
uniform sampler2D mask;
out vec4 found;
${PACKING}
void main() { found = texelFetch(mask, ivec2(gl_FragCoord.xy), 0).r > 0.5 ? pack(floor(gl_FragCoord.xy)) : vec4(1.0); }`;
// Then of the nearest land pixels this pixel and the eight `jump` away from
// it know, the nearest.
const FLOOD = `#version 300 es
precision highp float;
uniform sampler2D known;
uniform float jump;
out vec4 found;
${PACKING}
void main() {
  vec2 px = floor(gl_FragCoord.xy), size = vec2(textureSize(known, 0)), best = vec2(NONE);
  float nearest = 1e30;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 q = px + vec2(i, j) * jump;
    if (any(lessThan(q, vec2(0.0))) || any(greaterThanEqual(q, size))) continue;
    vec2 s = unpack(texelFetch(known, ivec2(q), 0));
    if (s.x >= NONE) continue;
    float d = dot(s - px, s - px);
    if (d < nearest) { nearest = d; best = s; }
  }
  found = best.x >= NONE ? vec4(1.0) : pack(best);
}`;

// The sea and the land: the sea in depth bands and water-lined, the land
// hillshaded inside the mask's coasts, so the grid's own coast, a quarter
// degree coarse, never shows; the sphere in the lamp; the lakes in the sea's
// colour over it, as the 2D drawing fills them.
const RELIEF = `#version 300 es
precision highp float;
uniform sampler2D grid, mask, found;
uniform bool relief;            // the grid has arrived
uniform vec2 gridSize;          // columns, rows
uniform vec3 gridOrigin;        // lat0, lon0, step (degrees)
uniform float extreme, scale, exaggeration, metresPerDegree;
uniform float depths[${DEPTHS.length}];
uniform vec3 shelf, abyss, land, lit, shade, sea, flatLand, waterline;
uniform vec4 held;              // the held polity's wash, straight alpha
uniform vec3 light;
uniform float ringGap, ringWidth;
uniform int rings;
out vec4 colour;
const float ROOM = ${ROOM};
${PROJECTION}
${PACKING}
vec3 linear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec2 cell(vec2 at) { return vec2((at.x - gridOrigin.y) / gridOrigin.z + 0.5, (gridOrigin.x - at.y) / gridOrigin.z + 0.5) / gridSize; }
float elevation(vec2 uv) { float b = texture(grid, uv).r * scale; return b * abs(b) * extreme / (scale * scale); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y), at;
  float facing;
  if (!unproject(px, at, facing)) discard;
  vec2 uv = cell(at);
  float e = relief ? elevation(uv) : 0.0;
  // The sea: depth bands, the shelf lightest; then each water-lining ring,
  // the band between its distance less the line's width and its distance
  // from the coast (a land pixel's centre lies half a pixel inside it),
  // fainter ring by ring.
  float band = 0.0;
  for (int i = 0; i < ${DEPTHS.length}; i++) band += step(depths[i], -e);
  vec3 water = relief ? mix(shelf, abyss, band / ${DEPTHS.length}.0) : sea;
  vec2 near = unpack(texelFetch(found, ivec2(gl_FragCoord.xy), 0));
  if (near.x < NONE) {
    float d = length(near - floor(gl_FragCoord.xy)) - 0.5;
    for (int r = 1; r <= rings; r++) {
      float outer = ringGap * float(r * (r + 1)) / 2.0, inner = outer - ringWidth;
      water = mix(water, waterline, clamp(min(d - inner, outer - d) + 0.5, 0.0, 1.0) * (1.0 - float(r - 1) / float(rings)));
    }
  }
  // The land: hillshading, the slope from the neighbouring cells, steepened
  // by the grid's own exaggeration, lit from the northwest; flat ground
  // keeps the land's colour, facing the light lifts it toward lit, facing
  // away lowers it toward shade.
  vec3 ground = flatLand;
  if (relief) {
    vec2 g = vec2(1.0) / gridSize;
    float dx = 2.0 * gridOrigin.z * metresPerDegree * max(cos(radians(at.y)), 0.01), dy = 2.0 * gridOrigin.z * metresPerDegree;
    float east = (elevation(uv + vec2(g.x, 0.0)) - elevation(uv - vec2(g.x, 0.0))) / dx;
    float north = (elevation(uv - vec2(0.0, g.y)) - elevation(uv + vec2(0.0, g.y))) / dy;
    vec3 n = normalize(vec3(-east * exaggeration, -north * exaggeration, 1.0));
    float s = dot(n, light) - light.z;
    ground = s >= 0.0 ? mix(land, lit, min(s / (1.0 - light.z), 1.0)) : mix(land, shade, min(-s / light.z, 1.0));
  }
  vec4 m = texelFetch(mask, ivec2(gl_FragCoord.xy), 0);
  vec3 c = mix(water, ground, m.r);
  // The polity held under the pointer, washed over its land (the mask's
  // blue), and lit with the rest of the paint.
  c = mix(c, held.rgb, held.a * m.b * m.r);
  // The sphere in the lamp, in the eye's frame, the water-lining with it,
  // since it's inked on the globe: whole where it faces the lamp, the
  // room's share where it turns away, darkened in linear light as paint in
  // shadow is. Then the lakes, flat in the sea's colour.
  c = srgb(linear(c) * (ROOM + (1.0 - ROOM) * max(dot(vec3((px.x - cx) / k, (cy - px.y) / k, facing), light), 0.0)));
  colour = vec4(mix(c, sea, m.g), 1.0);
}`;

// A line's segments, each a band about it with round ends (so the joins are
// round, as a stroke's are), a pixel wider for its antialiased edge; only
// its part on the near side of the limb and on the disc. Each layer's
// coverage goes to a channel of its own at the greatest it reaches, so a
// layer is one shape however its segments overlap, as a stroke is, and is
// coloured once, in order, after.
const LINE = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 segment;
layout(location = 2) in float start;
uniform float reach;
out vec2 frag;
flat out vec2 a, b;
flat out float za, zb, from;
${PROJECTION}
void main() {
  vec3 pa = project(segment.xy), pb = project(segment.zw);
  a = pa.xy; b = pb.xy; za = pa.z; zb = pb.z; from = start;
  if (pa.z < 0.0 && pb.z < 0.0) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
  vec2 d = pb.xy - pa.xy;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0), n = vec2(-dir.y, dir.x);
  frag = pa.xy + dir * (corner.x * (len + 2.0 * reach) - reach) + n * corner.y * reach;
  gl_Position = toClip(frag);
}`;
const LINE_FRAGMENT = `#version 300 es
precision highp float;
uniform float width, k, cx, cy;
uniform vec2 dash;              // on and off, in pixels; off 0 for a solid line
uniform vec4 channel;
uniform bool wash;              // a band on the inside, fading over its width
in vec2 frag;
flat in vec2 a, b;
flat in float za, zb, from;
out vec4 coverage;
void main() {
  if (distance(frag, vec2(cx, cy)) > k) discard;
  vec2 ab = b - a;
  float t = clamp(dot(frag - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
  if (mix(za, zb, t) < 0.0) discard;
  if (dash.y > 0.0 && mod(from + t * length(ab), dash.x + dash.y) >= dash.x) discard;
  float d = distance(frag, a + ab * t);
  // A wash lies on the segment's left on the globe, the polity's inside,
  // which on the canvas, its y down, is where the cross product is negative.
  if (wash) { if (ab.x * (frag.y - a.y) - ab.y * (frag.x - a.x) > 0.0) discard; coverage = channel * clamp(1.0 - d / width, 0.0, 1.0); }
  else coverage = channel * clamp(width / 2.0 + 0.5 - d, 0.0, 1.0);
}`;
// The layers' colours over the canvas, each in order over those before it.
const COLOUR = `#version 300 es
precision highp float;
uniform sampler2D first, second, third;
uniform vec4 colours[12];       // premultiplied
uniform int from, to;
out vec4 colour;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  vec4 c0 = texelFetch(first, at, 0), c1 = texelFetch(second, at, 0), c2 = texelFetch(third, at, 0);
  float cover[12] = float[12](c0.r, c0.g, c0.b, c0.a, c1.r, c1.g, c1.b, c1.a, c2.r, c2.g, c2.b, c2.a);
  colour = vec4(0.0);
  for (int i = from; i <= to; i++) colour = colours[i] * cover[i] + colour * (1.0 - colours[i].a * cover[i]);
}`;

// The marks, each a square about a point: a rose's eight-pointed star, its
// north point to the globe's north; a dot; a ring; an open cross. Only those
// on the near side of the limb.
const MARK = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec2 at;
uniform float reach;
out vec2 offset;
${PROJECTION}
void main() {
  vec3 p = project(at);
  if (p.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
  offset = corner * reach;
  gl_Position = toClip(p.xy + offset);
}`;
const MARK_FRAGMENT = `#version 300 es
precision highp float;
uniform int shape;              // 0 star, 1 dot, 2 ring, 3 cross
uniform float extent, line, half_, short_, gap;  // the mark's size (a star's long point, a dot's or ring's radius, a cross's arm), its line
uniform vec4 tint;              // premultiplied
in vec2 offset;
out vec4 colour;
float segmentDistance(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; return distance(p, a + ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)); }
void main() {
  float c;
  vec2 p = vec2(offset.x, -offset.y);
  if (shape == 0) {
    // The star's sixteen points, every 22.5° clockwise from north, long,
    // short, half, short, long…: inside where it lies to the right of its
    // sector's edge, the distance past it its antialiased edge.
    float step_ = 0.39269908, sector = floor(mod(atan(p.x, p.y), 6.2831853) / step_);
    float k0 = mod(sector, 16.0), k1 = mod(sector + 1.0, 16.0);
    float r0 = mod(k0, 4.0) == 0.0 ? extent : mod(k0, 2.0) == 0.0 ? extent * half_ : extent * short_;
    float r1 = mod(k1, 4.0) == 0.0 ? extent : mod(k1, 2.0) == 0.0 ? extent * half_ : extent * short_;
    vec2 v0 = r0 * vec2(sin(k0 * step_), cos(k0 * step_)), v1 = r1 * vec2(sin(k1 * step_), cos(k1 * step_));
    vec2 e = normalize(v1 - v0);
    c = clamp(0.5 - (e.x * (p.y - v0.y) - e.y * (p.x - v0.x)), 0.0, 1.0);
  } else if (shape == 1) {
    c = clamp(extent + 0.5 - length(p), 0.0, 1.0);
  } else if (shape == 2) {
    c = clamp(line / 2.0 + 0.5 - abs(length(p) - extent), 0.0, 1.0);
  } else {
    float d = min(min(segmentDistance(p, vec2(gap, 0.0), vec2(extent, 0.0)), segmentDistance(p, vec2(-gap, 0.0), vec2(-extent, 0.0))),
                  min(segmentDistance(p, vec2(0.0, gap), vec2(0.0, extent)), segmentDistance(p, vec2(0.0, -gap), vec2(0.0, -extent))));
    c = clamp(line / 2.0 + 0.5 - d, 0.0, 1.0);
  }
  if (c <= 0.0) discard;
  colour = tint * c;
}`;

// A region's glow round each of its places: the gradient the 2D drawing
// lays in the ellipse the place's circle makes on the page, from the glow's
// colour at its centre to nothing at its edge, and only on the circle's
// facing part.
const GLOW = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 ellipse;   // centre x, y, major, minor, unit-disc units, Y up
layout(location = 2) in vec4 place;     // along, lon, lat, rho
layout(location = 3) in vec4 tint;      // premultiplied
out vec2 frag;
flat out vec4 e, pl, colour;
${PROJECTION}
void main() {
  e = ellipse; pl = place; colour = tint;
  vec2 centre = vec2(cx + k * ellipse.x, cy - k * ellipse.y);
  frag = centre + corner * ellipse.z * k;
  gl_Position = toClip(frag);
}`;
const GLOW_FRAGMENT = `#version 300 es
precision highp float;
in vec2 frag;
flat in vec4 e, pl, colour;
out vec4 glow;
${PROJECTION}
void main() {
  vec2 at;
  float facing;
  if (!unproject(frag, at, facing)) discard;
  vec2 p = radians(at), q = radians(pl.yz);
  float cosine = sin(p.y) * sin(q.y) + cos(p.y) * cos(q.y) * cos(p.x - q.x);
  if (cosine < cos(radians(pl.w))) discard;
  // Into the ellipse's frame, as the 2D drawing rotates by -along and
  // squeezes its minor axis (canvas y down).
  vec2 d = frag - vec2(cx + k * e.x, cy - k * e.y);
  float ca = cos(pl.x), sa = sin(pl.x);
  vec2 l = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  l.x /= max(e.w / e.z, 1e-3);
  float r = length(l) / (e.z * k);
  if (r >= 1.0) discard;
  glow = colour * (1.0 - r);
}`;

// The limb, a ring at the globe's edge.
const LIMB = `#version 300 es
precision highp float;
uniform float k, cx, cy, line;
uniform vec2 size;
uniform vec4 tint;
out vec4 colour;
void main() {
  vec2 px = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  float c = clamp(line / 2.0 + 0.5 - abs(distance(px, vec2(cx, cy)) - k), 0.0, 1.0);
  if (c <= 0.0) discard;
  colour = tint * c;
}`;

// A CSS colour as the theme writes it (#rgb, #rrggbb, rgb(), rgba()), in
// 0 to 1.
const rgba = css => {
  const hex = css.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) { const h = hex.length === 3 ? [...hex].map(x => x + x).join('') : hex; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(1); }
  const m = css.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
  if (!m) throw new Error(`a colour the globe can't read: "${css}"`);
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : +m[4]];
};
const premultiplied = css => { const [r, g, b, a] = rgba(css); return [r * a, g * a, b * a, a]; };

// A line's points, none further apart than STEP_DEG: the great circle
// between each two, interpolated on the sphere.
function densified(line) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const [l0, p0] = line[i - 1].map(x => x * RAD), [l1, p1] = line[i].map(x => x * RAD);
    const a = [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)], b = [Math.cos(p1) * Math.cos(l1), Math.cos(p1) * Math.sin(l1), Math.sin(p1)];
    const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const n = Math.ceil(angle / (STEP_DEG * RAD));
    for (let s = 1; s < n; s++) {
      const t = s / n, wa = Math.sin((1 - t) * angle) / Math.sin(angle), wb = Math.sin(t * angle) / Math.sin(angle);
      const v = a.map((x, j) => wa * x + wb * b[j]);
      out.push([Math.atan2(v[1], v[0]) / RAD, Math.asin(v[2]) / RAD]);
    }
    out.push(line[i]);
  }
  return out;
}
// A float array kept from frame to frame, grown when it must be, so drawing a
// frame allocates nothing.
function scratch() {
  let a = new Float32Array(0);
  return need => { if (a.length < need) a = new Float32Array(Math.max(need, a.length * 2)); return a; };
}
// A layer's polylines: a line layer's lines, or a polygon layer's rings.
const polylines = geo => (geo.type === 'MultiPolygon' ? geo.coordinates.flat() : geo.type === 'Polygon' ? geo.coordinates : geo.type === 'LineString' ? [geo.coordinates] : geo.coordinates);
// A layer's segments, four floats each (lon, lat, lon, lat), and each
// polyline's first segment and length, for a dashed one's offsets.
function segmentsOf(geo) {
  const lines = polylines(geo).map(densified), out = [], runs = [];
  for (const line of lines) {
    runs.push({ first: out.length / 4, line });
    for (let i = 1; i < line.length; i++) out.push(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
  }
  return { data: new Float32Array(out), count: out.length / 4, runs };
}

// The renderer for one canvas, or null without WebGL2 (the 2D drawing then
// stands). `world` is euphonia.globe.js's globeWorld. The relief's grid
// arrives later, by grid().
export function createGlobe(canvas, world, colors, obliquity) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const link = (vertex, fragment) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const at = new Map();
    return { p, u: name => (at.has(name) ? at.get(name) : at.set(name, gl.getUniformLocation(p, name)).get(name)) };
  };
  const programs = {
    fan: link(FAN, PAINT), paint: link(SQUARE, PAINT), seed: link(SQUARE, SEED), flood: link(SQUARE, FLOOD),
    relief: link(SQUARE, RELIEF), line: link(LINE, LINE_FRAGMENT), colour: link(SQUARE, COLOUR),
    mark: link(MARK, MARK_FRAGMENT), glow: link(GLOW, GLOW_FRAGMENT), limb: link(SQUARE, LIMB),
  };

  // Vertex arrays: the canvas's square; a band's corners (along 0 to 1,
  // across −1 to 1), shared by every instanced shape.
  const buffer = (data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
  const squareVao = gl.createVertexArray();
  gl.bindVertexArray(squareVao);
  buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const bandCorners = buffer(new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]));
  const quadCorners = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  // An instanced vertex array: the corners at 0, then each instance's
  // attributes, (location, size, stride in floats, offset).
  const instanced = (corners, data, attributes, usage) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const b = buffer(data, usage);
    for (const [loc, n, stride, offset] of attributes) {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, offset * 4); gl.vertexAttribDivisor(loc, 1);
    }
    return { vao, b };
  };

  // The lines: each layer's segments, built once; a dashed layer's offsets
  // measured on the page each frame.
  const lineLayers = [...GLOBE_LINES.map(l => ({ ...l, geo: world[l.layer] })), { layer: 'circles', ...CIRCLES_LINE, geo: circlesOf(obliquity) }].map((l, channel) => {
    const seg = segmentsOf(l.geo);
    const v = instanced(bandCorners, seg.data, [[1, 4, 4, 0]]);
    const starts = new Float32Array(seg.count);
    const s = buffer(starts, l.dash ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
    return { ...l, channel, count: seg.count, runs: seg.runs, vao: v.vao, starts, startBuffer: s };
  });
  if (lineLayers.length > 12) throw new Error('more line layers than the three coverage textures hold');
  const roses = instanced(quadCorners, new Float32Array(world.roseCentres.flatMap(c => [c.lon, c.lat])), [[1, 2, 2, 0]]);
  const marks = instanced(quadCorners, new Float32Array(2), [[1, 2, 2, 0]], gl.DYNAMIC_DRAW);
  const glows = instanced(quadCorners, new Float32Array(12), [[1, 4, 12, 0], [2, 4, 12, 4], [3, 4, 12, 8]], gl.DYNAMIC_DRAW);
  const fanVao = gl.createVertexArray();
  gl.bindVertexArray(fanVao);
  const fanBuffer = buffer(new Float32Array(0), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Textures and framebuffers, sized to the canvas: the mask (resolved from
  // its multisampled drawing), the flood's two, the lines' two coverages.
  const texture = (unit, filter = gl.NEAREST) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
    return t;
  };
  // Units: 0 the grid, 1 the mask, 2 the flood's read, 3, 4 and 6 the
  // lines' coverages, 5 for making.
  const gridTexture = texture(0, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  const sized = Array.from({ length: 6 }, () => ({ t: texture(5), fb: gl.createFramebuffer() }));
  const [maskTarget, floodA, floodB, ...covers] = sized;
  const msFramebuffer = gl.createFramebuffer(), msColour = gl.createRenderbuffer(), msStencil = gl.createRenderbuffer();
  let sizeKey = '';
  const resize = (w, h) => {
    if (sizeKey === `${w}x${h}`) return;
    sizeKey = `${w}x${h}`;
    gl.activeTexture(gl.TEXTURE5);
    for (const s of sized) {
      gl.bindTexture(gl.TEXTURE_2D, s.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.t, 0);
    }
    gl.bindRenderbuffer(gl.RENDERBUFFER, msColour);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, MASK_SAMPLES, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, msStencil);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, MASK_SAMPLES, gl.DEPTH24_STENCIL8, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFramebuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColour);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, msStencil);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  // The relief's grid and fixed uniforms.
  const { relief } = programs;
  gl.useProgram(relief.p);
  gl.uniform1i(relief.u('grid'), 0); gl.uniform1i(relief.u('mask'), 1); gl.uniform1i(relief.u('found'), 2);
  gl.uniform1fv(relief.u('depths'), DEPTHS);
  gl.uniform3f(relief.u('light'), ...LAMP);
  gl.uniform1f(relief.u('metresPerDegree'), METRES_PER_DEGREE);
  gl.uniform1i(relief.u('relief'), 0);
  let lineColours = null, glowPlain = null, glowLit = null, tints = null;
  const glowPoints = scratch(), markPoints = scratch();
  const recolor = colors => {
    lineColours = new Float32Array(48);
    lineLayers.forEach((l, i) => lineColours.set(premultiplied(colors[l.color]).map(c => c * (l.alpha ?? 1)), 4 * i));
    gl.useProgram(relief.p);
    for (const name of ['shelf', 'abyss', 'land', 'lit', 'shade']) gl.uniform3fv(relief.u(name), rgba(colors[`relief-${name}`]).slice(0, 3));
    gl.uniform3fv(relief.u('sea'), rgba(colors.sea).slice(0, 3));
    gl.uniform3fv(relief.u('flatLand'), rgba(colors.land).slice(0, 3));
    gl.uniform3fv(relief.u('waterline'), rgba(colors.waterline).slice(0, 3));
    gl.uniform4fv(relief.u('held'), rgba(colors.glow));
    glowPlain = premultiplied(colors.glow); glowLit = premultiplied(colors['glow-lit']);
    tints = { rose: premultiplied(colors.rose), sun: premultiplied(colors.sun), rim: premultiplied(colors.rim) };
  };
  recolor(colors);
  const grid = bytes => {
    const { rows, cols, step, lat0, lon0, scale, extreme } = layout.layout;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gridTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8_SNORM, cols, rows, 0, gl.RED, gl.BYTE, new Int8Array(bytes));
    gl.useProgram(relief.p);
    gl.uniform2f(relief.u('gridSize'), cols, rows);
    gl.uniform3f(relief.u('gridOrigin'), lat0, lon0, step);
    gl.uniform1f(relief.u('extreme'), extreme);
    gl.uniform1f(relief.u('scale'), scale);
    gl.uniform1f(relief.u('exaggeration'), layout.shading.exaggeration);
    gl.uniform1i(relief.u('relief'), 1);
  };

  // The view's uniforms, for every program that projects.
  const viewUniforms = (prog, v) => {
    for (const [name, value] of [['lon0', v.lon0], ['lat0', v.lat0], ['k', v.k], ['cx', v.cx], ['cy', v.cy]]) gl.uniform1f(prog.u(name), value);
    gl.uniform2f(prog.u('size'), v.width, v.height);
  };
  const square = () => { gl.bindVertexArray(squareVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };

  // The land's and the lakes' rings on the page, clipped to the near side,
  // as fans of triangles from each ring's first point, written into arrays
  // kept between frames: the ring's points, then the fans.
  const ringPoints = scratch(), fanPoints = scratch();
  const fansOf = (v, geo) => {
    let n = 0, at = 0, out = fanPoints(0);
    const close = () => {
      if (at >= 6) {
        out = fanPoints(n + (at / 2 - 2) * 6);
        const r = ringPoints(0);
        for (let i = 2; i + 2 < at; i += 2) { out[n++] = r[0]; out[n++] = r[1]; out[n++] = r[i]; out[n++] = r[i + 1]; out[n++] = r[i + 2]; out[n++] = r[i + 3]; }
      }
      at = 0;
    };
    const add = (x, y) => { const r = ringPoints(at + 2); r[at++] = x; r[at++] = y; };
    geoPath(projectionFor(v), { moveTo: (x, y) => { close(); add(x, y); }, lineTo: add, closePath: close, arc() {} })(geo);
    close();
    return { data: out, count: n / 2 };
  };
  const fill = (v, geo, channel) => {
    const fans = fansOf(v, geo);
    if (!fans.count) return;
    gl.useProgram(programs.fan.p);
    gl.uniform2f(programs.fan.u('size'), v.width, v.height);
    gl.bindVertexArray(fanVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, fanBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fans.data, gl.DYNAMIC_DRAW, 0, fans.count * 2);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    gl.drawArrays(gl.TRIANGLES, 0, fans.count);
    gl.colorMask(...channel);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.useProgram(programs.paint.p);
    square();
  };

  return Object.assign(function render(v, { regions, hoverPlace, pick, polity, scale }) {
    const { width: w, height: h } = v;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    resize(w, h);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);

    // The mask: the land in red, the lakes (and the lakes as they were) in
    // green, antialiased, resolved to its texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFramebuffer);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.STENCIL_TEST);
    fill(v, world.land, [true, false, false, false]);
    fill(v, { type: 'GeometryCollection', geometries: [world.lakes, world.historic] }, [false, true, false, false]);
    if (polity) fill(v, polity.shape, [false, false, true, false]);
    gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, maskTarget.fb);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTarget.t);

    // The flood, only as far as the outermost ring: from the first jump of a
    // power of two past it, halving to one, and one more of one, which mends
    // the rare pixel the halving misses.
    const gap = WATERLINING.gap * scale, reach = gap * WATERLINING.count * (WATERLINING.count + 1) / 2;
    const jumps = [];
    for (let j = 2 ** Math.ceil(Math.log2(reach + 1)); j >= 1; j /= 2) jumps.push(j);
    jumps.push(1);
    let read = floodA, write = floodB;
    gl.bindFramebuffer(gl.FRAMEBUFFER, read.fb);
    gl.useProgram(programs.seed.p); gl.uniform1i(programs.seed.u('mask'), 1); square();
    gl.useProgram(programs.flood.p); gl.uniform1i(programs.flood.u('known'), 2);
    for (const jump of jumps) {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, read.t);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
      gl.uniform1f(programs.flood.u('jump'), jump);
      square();
      [read, write] = [write, read];
    }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, read.t);

    // The sea and the land, onto the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(relief.p);
    viewUniforms(relief, v);
    gl.uniform1i(relief.u('rings'), WATERLINING.count);
    gl.uniform1f(relief.u('ringGap'), gap);
    gl.uniform1f(relief.u('ringWidth'), WATERLINING.width * scale);
    square();

    // The lines' coverage, each layer to its channel at its greatest.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    for (const target of covers) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.clear(gl.COLOR_BUFFER_BIT); }
    const line = programs.line;
    gl.useProgram(line.p);
    viewUniforms(line, v);
    const project = projectionFor(v);
    for (const l of lineLayers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, covers[Math.floor(l.channel / 4)].fb);
      gl.uniform4f(line.u('channel'), ...[0, 1, 2, 3].map(c => (c === l.channel % 4 ? 1 : 0)));
      gl.uniform1f(line.u('width'), l.width * scale);
      gl.uniform1i(line.u('wash'), l.wash ? 1 : 0);
      // A wash reaches its whole width to one side; a stroke half to each.
      gl.uniform1f(line.u('reach'), (l.wash ? l.width : l.width / 2) * scale + 1);
      gl.uniform2f(line.u('dash'), ...(l.dash ? l.dash.map(d => d * scale) : [0, 0]));
      if (l.dash) {
        // Each segment's distance along its line on the page, as a stroke's
        // dashes run.
        for (const { first, line: pts } of l.runs) {
          let along = 0, prev = project(pts[0]);
          for (let i = 1; i < pts.length; i++) { l.starts[first + i - 1] = along; const p = project(pts[i]); along += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, l.startBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, l.starts);
      }
      gl.bindVertexArray(l.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, l.count);
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const colour = programs.colour;
    gl.useProgram(colour.p);
    [3, 4, 6].forEach((unit, i) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, covers[i].t); });
    gl.uniform1i(colour.u('first'), 3); gl.uniform1i(colour.u('second'), 4); gl.uniform1i(colour.u('third'), 6);
    gl.uniform4fv(colour.u('colours'), lineColours);
    const circles = lineLayers.length - 1;
    gl.uniform1i(colour.u('from'), 0); gl.uniform1i(colour.u('to'), circles - 1);
    square();

    // The roses, over the lines and under the circles, as the 2D drawing
    // has them.
    const mark = programs.mark;
    gl.useProgram(mark.p);
    viewUniforms(mark, v);
    const shape = (kind, size, reach, tint, extra = {}) => {
      gl.uniform1i(mark.u('shape'), kind);
      gl.uniform1f(mark.u('extent'), size);
      gl.uniform1f(mark.u('reach'), reach);
      gl.uniform4fv(mark.u('tint'), tint);
      for (const [name, value] of Object.entries(extra)) gl.uniform1f(mark.u(name), value);
    };
    shape(0, MARKS.rose * scale, MARKS.rose * scale + 1, tints.rose, { half_: MARKS.roseHalf, short_: MARKS.roseShort });
    gl.bindVertexArray(roses.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, world.roseCentres.length);
    gl.useProgram(colour.p);
    gl.uniform1i(colour.u('from'), circles); gl.uniform1i(colour.u('to'), circles);
    square();

    // The regions' glows.
    let shown = 0;
    const glowData = glowPoints(12 * regions.reduce((n, r) => n + r.glows.length, 0));
    for (const r of regions) {
      const tint = r.lit ? glowLit : glowPlain;
      for (const p of r.glows) {
        const e = ellipseOf(p, p.rho, v);
        if (!e) continue;
        const o = 12 * shown;
        glowData[o] = e.cx; glowData[o + 1] = e.cy; glowData[o + 2] = e.major; glowData[o + 3] = e.minor;
        glowData[o + 4] = e.along; glowData[o + 5] = p.lon; glowData[o + 6] = p.lat; glowData[o + 7] = p.rho;
        glowData.set(tint, o + 8);
        shown++;
      }
    }
    if (shown) {
      const glow = programs.glow;
      gl.useProgram(glow.p);
      viewUniforms(glow, v);
      gl.bindBuffer(gl.ARRAY_BUFFER, glows.b);
      gl.bufferData(gl.ARRAY_BUFFER, glowData, gl.DYNAMIC_DRAW, 0, 12 * shown);
      gl.bindVertexArray(glows.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, shown);
    }

    // A lit region's places, each a dot; the place under the pointer, a
    // ring; the picked place, an open cross.
    gl.useProgram(mark.p);
    const points = (list, kind, size, reach, extra) => {
      if (!list.length) return;
      const at = markPoints(2 * list.length);
      list.forEach((p, i) => { at[2 * i] = p.lon; at[2 * i + 1] = p.lat; });
      gl.bindBuffer(gl.ARRAY_BUFFER, marks.b);
      gl.bufferData(gl.ARRAY_BUFFER, at, gl.DYNAMIC_DRAW, 0, 2 * list.length);
      shape(kind, size, reach, tints.sun, extra);
      gl.bindVertexArray(marks.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, list.length);
    };
    for (const r of regions) if (r.lit) points(r.glows, 1, MARKS.dot * scale, MARKS.dot * scale + 1);
    if (hoverPlace) points([hoverPlace], 2, MARKS.ring * scale, (MARKS.ring + MARKS.ringWidth) * scale + 1, { line: MARKS.ringWidth * scale });
    if (pick) points([pick], 3, MARKS.cross[1] * scale, (MARKS.cross[1] + MARKS.crossWidth) * scale + 1, { line: MARKS.crossWidth * scale, gap: MARKS.cross[0] * scale });

    // The limb.
    const limb = programs.limb;
    gl.useProgram(limb.p);
    for (const [name, value] of [['k', v.k], ['cx', v.cx], ['cy', v.cy], ['line', MARKS.limbWidth * scale]]) gl.uniform1f(limb.u(name), value);
    gl.uniform2f(limb.u('size'), w, h);
    gl.uniform4fv(limb.u('tint'), tints.rim);
    square();
    gl.disable(gl.BLEND);
    return canvas;
  }, { recolor, grid });
}

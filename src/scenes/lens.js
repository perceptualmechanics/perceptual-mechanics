import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose } from '../utils/sceneKit.js';

// ─── Lens: one cut gem, four colored sides ─────────────────────────────────
// First full rebuild, 2026-07-17, replacing the old five-element YouTube-
// livestream version entirely (see git history — the old ELEMENTS/
// FIRE_LITANY roster and its dead-stream problems are gone, not fixed).
// Scott's schema, verbatim, for that first pass:
//
//   "The gem with four faces is the crystal focusing the laser light of
//    EIN SOPH. Nature is the cut of the overall gem. MALKUTH/SHEKINAH. Each
//    elemental facet is cut with other polytheistic gods that would loosely
//    fit in with that particular element. and then you incorporate my
//    writing."
//
// That first pass built four separate gem meshes arranged in a ring around
// a small internal glow standing in for Ein Soph. Scott's redo, same day,
// after seeing the rename to Lens land:
//
//   "Yes. but redo it. the laser light comes from 'Maestro, if you please'.
//    It hits one cut gem, with four different colored sides. make the gem
//    translucent."
//
// Two changes, both structural, not cosmetic:
//   1. One gem, not four. A single four-sided cut stone (a bipyramid — the
//      kite/diamond silhouette this scene's own nav icon already uses),
//      built by hand so each of its four vertical sides can carry its own
//      color and material, rather than four independent stones standing
//      near each other.
//   2. The light is no longer generic "Ein Soph, glowing at the center." It
//      now has a name and a source: "Prologue," the shortest complete poem
//      in Scott Jason Cohen's Assembled Verse.doc — four lines that are
//      really a stage direction ("Maestro, if you please: / A single
//      spotlight, / Illuminating / Me from head to toe.") cueing a light on
//      before anything else in the poem happens. Staged here literally: an
//      external spotlight rig, not an internal glow, aimed at the gem from
//      outside — the same relationship a stage light has to whatever it's
//      picking out of the dark.
//
// Ein Soph (Kabbalah: the infinite, the divine before or beyond any
// attribute) is still the concept the light stands for; Prologue is the
// concrete, in-scene image and text Scott already had on hand for it — the
// same relationship every elemental facet has between its archangel/element
// label and its actual grounding writing below.
//
// Third pass, same day, right after Lens went live:
//
//   "make the spotlight completely vertical. lose the stone or whatever is
//    holding the gem."
//
// Two more simplifications: the spotlight fixture now sits directly above
// the gem on the vertical axis, beam pointing straight down, rather than
// the earlier angled stage-light placement. And the rough stone cradle —
// built for Malkuth/Shekinah, per the original schema's "Nature is the cut
// of the overall gem" — is gone; the gem floats free under the light now,
// nothing visibly holding it up. Malkuth/Shekinah's writing (thirty-six,
// section 13) isn't deleted from the archive, just no longer surfaced
// anywhere on the site as a result — see git history around 1.0.14-1.0.18
// if it wants a home again later.
//
// Each facet also carries 2-3 "other faces" — other pantheons' gods who fit
// that element loosely, per Scott's instruction — named and given one plain
// epithet each, not full myths (this site draws comparative mythology
// freely elsewhere, most substantially in the unwired Boston Scion campaign
// material, which is where the specific pantheon spread here is pulled
// from: Hindu, Norse, Egyptian, Greek, Japanese, Aztec). Scott's own writing
// is the actual text of each facet, per his explicit instruction — the
// other gods are context, not content.
//
// Content sourcing:
//   Gabriel (Fire) — Fire.doc's word-association litany (2003), the piece
//     already reserved for exactly this back when the scroll was built.
//   Michael (Light/Air) — Purpose.doc in full (748 words, complete, 2000s):
//     a personal manifesto ending in the "Song of Fire and Light... Solistrato"
//     passage — also the origin document for "Solistrato," a name recurring
//     across Scott's work for two decades.
//   Raphael (Earth) and Emmanuel (Water) — one real find: `thirty-six`, an
//     unpublished 13-section, three-movement poem, discovered to be the
//     source of "Moon Song" (already live in the egg scene — its ninth
//     section, verbatim). Section 8 is a five-person ritual scene invoking
//     each element in turn; split here into its two halves along the poem's
//     own natural pause, not cut arbitrarily — Raphael gets the setup and
//     the earth invocation, Emmanuel gets the water, air, and the fire/light
//     climax that closes the scene. Full text, unedited, both halves.
//   Ein Soph / the light (Prologue) — "Scott Jason Cohen's Assembled
//     Verse.doc," the same curated collection eleven of poems.js's other
//     entries come from. Four lines, in full.
//   (Malkuth/Shekinah — thirty-six, section 13, "there's quite a storm
//     brewing out there... she's angry, we no longer come to her with arms
//     outstretched in love" — was part of this scene through 1.0.17,
//     grounding the rough stone cradle. Retired along with the cradle in
//     the pass described above; the text is still in git history.)
//
// Fourth pass, same day, after Scott asked whether the refraction was
// actually being computed (it is — THREE.MeshPhysicalMaterial's
// `transmission` is a real per-frame GPU technique, not a faked texture):
//
//   "Okay, so let's focus the spotlight into a tighter beam. Make the gem
//    multifaceted, like a princess-cut diamond. Behind the gem, I feel
//    like we should do something with the chakras and the tree of life...
//    i'd love to see the refracted light getting all the way through the
//    bottom facets of the gem if possible."
//
// Three changes: the spot's angle and penumbra are both pulled in tight
// (a narrow, defined shaft instead of a broad wash), and the gem itself is
// rebuilt as a multi-band, princess-cut-inspired cut — a pointed crown,
// a full girdle, and a tapering pavilion, four columns of facets going
// around, 24 facets total instead of 8 — still cleanly divided into the
// same four colored/clickable sides. And a stationary backdrop plane now
// sits behind the gem: the Kabbalistic Tree of Life (this scene's own
// framework already, just never drawn) and the seven chakras, overlaid on
// one shared vertical axis, since both systems run top-to-bottom along a
// spine/middle-pillar in their own traditions. It's built generously tall
// — well above the crown and well below the culet — and given real
// content and color, specifically so there's something for the gem's
// transmission material to actually refract all the way through every
// facet, pavilion included, not just tinted darkness. The backdrop is a
// sibling of the gem in `scene`, not a child of the rotating `root` group
// — a backdrop doesn't spin with the sculpture in front of it, and a flat
// plane that did rotate would vanish edge-on twice per revolution.

const FACETS = {
  gabriel: {
    key: 'gabriel',
    archangel: 'Gabriel',
    element: 'Fire · Death',
    gem: 'Ruby',
    color: 0xb01f2e,
    hex: '#b01f2e',
    otherFaces: [
      { name: 'Agni', tradition: 'Vedic', epithet: 'the sacrificial fire itself, mouth of the gods' },
      { name: 'Surtr', tradition: 'Norse', epithet: 'the fire giant who ends the world at Ragnarök' },
      { name: 'Sekhmet', tradition: 'Egyptian', epithet: 'the lioness of plague and healing both' },
    ],
    source: 'Fire.doc (2003)',
    sourceNote: `A word-association litany — short standalone phrases, one per line as originally written. Set aside for exactly this use since the day it was found; the longer two-part dialogue scene from the same document lives elsewhere on this site (the scroll, as fireVigil/fireCalamity) and isn't repeated here.`,
    writing: [
      'Fire.', 'Burn.', 'Sun.', 'Light.', 'Everything is illuminated.', 'Stars and bars.',
      'Firewater.', 'Apocalypse.', 'Genocide.', "I've never given it any thought.",
      'Seemingly uncaring.', 'The ash.', 'Ash Wednesday.', 'Eating ashes.',
      'The ashes in the alchemical work.', 'Satori, plucked from the fireplace.',
      'Fireplace. Place for fire.', 'Fahrenheit 451.', 'Under God.', 'Flag burning.',
      'Tearing up from the smoke.', 'Blanking out the sun.', 'Stellar fusion.',
      'The heart of the reactor.', 'The heart.', 'Blood.', 'Red blood cells.',
      'Energy production.', 'ATP, ADP.', 'Chemistry.', 'Ignition.', 'Without a thought.',
      'The Fire of the Lord.', 'A pure and noble flame.', 'Firefight.',
      'Keep the home fires burning.', 'Waiting for the soldiers to come home.',
      'Candlelight in the window.', 'Pushing back the darkness.',
      'The smell of a fire. The smell of chemistry.', 'Bunsen burner.', 'Bonfire.',
      'Gathering.', 'Beach bonfire.', 'Burning Man.', 'Set your creations afire.',
      'Sexual passion.', 'A motivating force.',
      'Wordless. Beyond words. Beyond thought. Not a thought. No time to think.',
    ],
    crossLink: null,
  },
  emmanuel: {
    key: 'emmanuel',
    archangel: 'Emmanuel',
    element: 'Water',
    gem: 'Sapphire',
    color: 0x2255a8,
    hex: '#2255a8',
    otherFaces: [
      { name: 'Poseidon', tradition: 'Greek', epithet: 'the sea itself, tempest and depth' },
      { name: 'Susanoo', tradition: 'Japanese', epithet: 'storm and sea, Amaterasu’s brother' },
      { name: 'Sobek', tradition: 'Egyptian', epithet: 'the Nile’s crocodile-god, water as danger and harvest both' },
    ],
    source: '"thirty-six," section 8 (second half)',
    sourceNote: `From an unpublished 13-section poem — the same document "Moon Song" (already live in the egg scene) was pulled from, section 9. Section 8 is a five-person ritual invoking each element in turn; this is its second half, picking up right where Raphael's excerpt ends. Full text, unedited.`,
    writing: [
      `Angela took her loving cup,
And water flew, drenching
Everything.  The clouds
Relented.  The power roiled
Beneath our feet.  Air`,
      `Drew his sword, a dervish
Dance, fluid motion slicing,
Cutting cobwebs – Mercurius
As subtle as the wind
Itself.  Josiah drove his staff`,
      `Into the ground, and the sun
Broke through, watching
Us and watching brother
Phoenix remove his mask
And all was flame and`,
      `Light and storm and quake.
They never found us.`,
    ],
    crossLink: 'raphael',
  },
  raphael: {
    key: 'raphael',
    archangel: 'Raphael',
    element: 'Earth',
    gem: 'Emerald',
    color: 0x1f8a4d,
    hex: '#1f8a4d',
    otherFaces: [
      { name: 'Demeter', tradition: 'Greek', epithet: 'harvest, growth, and grief together' },
      { name: 'Jörð', tradition: 'Norse', epithet: 'the earth itself, personified, Thor’s mother' },
      { name: 'Tlaltecuhtli', tradition: 'Aztec', epithet: 'the earth, devourer and giver in one body' },
    ],
    source: '"thirty-six," section 8 (first half)',
    sourceNote: `From an unpublished 13-section poem — the same document "Moon Song" (already live in the egg scene) was pulled from, section 9. Section 8 is a five-person ritual invoking each element in turn — Mercurius, Josiah, Angela, the narrator, and someone called Phoenix, "cloaked in white." This is its first half, ending where Emmanuel's excerpt picks up. Full text, unedited.`,
    writing: [
      `We
Who shall ever be named
Heretic,
Warlock,
Sorcerer,
We who call the storms
Are marching up the moor.`,
      `They
Who were named as
Pagan,
Sinner,
Demon,
They left a monument
Radiating with power.`,
      `The circle, long since abandoned,
Purged by cross and steel,
Waits patiently under clouds
For new denizens to take up
Residence in its shadow.`,
      `Mercurius reached it first,
Racing up the hill shouting
With glee.  Josiah was second,
Harnessing the power within
Himself.  Angela and I`,
      `Followed respectfully.  And
Dear Phoenix, cloaked in white,
Was the last to arrive.
We took our stations,
Surveyed the monument.`,
      `I drew the pentagram,
Linking five in one in
Fallow earth.  The aspect
Wavers – for a moment,
The stones are towers,`,
      `Reflecting infinity
Within each other.  A shiny
Iron disc, a glowing
Red light – then nothing.
Surely fae were about.`,
    ],
    crossLink: 'emmanuel',
  },
  michael: {
    key: 'michael',
    archangel: 'Michael',
    element: 'Light · Air',
    gem: 'Yellow sapphire',
    color: 0xd8b21f,
    hex: '#d8b21f',
    otherFaces: [
      { name: 'Ra', tradition: 'Egyptian', epithet: 'the sun’s daily journey through the underworld and back' },
      { name: 'Amaterasu', tradition: 'Japanese', epithet: 'the sun withdrawn, and restored' },
      { name: 'Vayu', tradition: 'Vedic', epithet: 'wind, breath, the moving air itself' },
    ],
    source: 'Purpose.doc',
    sourceNote: `A complete personal manifesto (2000s), 748 words, in full. Also the origin document for "Solistrato" — a coined name recurring across Scott's work for two decades: an old radio-station name, a Spoonfed site subsection, and a D&D character.`,
    writing: [
      'This is my worldview.',
      `The long slog of human history – painful, built on the preceding generation, a deliberate, purposeful evolution even during its darkest hours and aimless epics – has led us to the point where we have created another world, an imaginary world, of our own devising.  Our modern civilization and all its attendant banes and boons is a result of that intrinsic need to survive, yes, but also to succeed, to make sense of it, to evolve ourselves not just in physical ways but also in psychological ways as well.  Our ideas, our forms of expression, our science, our driving force has now brought us to this moment, this era where we can all finally shift upwards into the next quantum phase of human evolution.`,
      `It is a story of of so many disparate and sifficult forces – nations, ideas, agruclutures, thoughts, works of art, kingdoms, political forces, and the simple yearning for something more than our immediate surroundings – that it is nearly impossible to recap in one small tome.  However, I am the direct result of this, as everyone else is.  And I would venture to think that many people see themselves as the inheritors of a grand tradition of ennui – the human psyche has not completely absorbed all the myriad possibilities of existence, when brute survival has been such an overriding concern.  Now, at the moment in our history when we finally have the tools to shift upwards into a new awareness regarding the world, those forces which have profited the most off retarting human evolution are fighting fiercely to hold onto what is theirs, to choke innovation and human freedom so that they might drain yet more of our energy.  They are indeed vampires, leeching off the masses and the living, keeping the spoils for themselves.`,
      `It is time for a revolution.  Not a political one, although this revolution will certainly have its political component, but a cultural one, an imaginative one wherein crumbling, dead ideas such as control, suffering, poverty will fall by the wayside.  In order to create this, though, the leaders of the current world empire will have to be knocked out of power.  Considering the scope of their influence, this could almost assuredly be a global catastrophe.  However, it is my goal – and, hopefully, the goal of others – to make sure that the shifting upwards is not cataclysmic, that instead of the end of an era, we click upwards and see with new, fresh eyes.`,
      `I can only do my part, and that is to write what I see, what I perceive, what I sense is going on, and to guide others to start dropping old beliefs that are no longer suitable to survival and find new ones.  Then those ideas have to be put into action, by me or by others.`,
      `We are at the cusp of something amazing, and what it is I'm not too sure of yet.  But I have an unbridled sense of optimism, even if at this moment I am small and powerless.  But rest assured, I am not, and this is just a pose, a moment, and soon I will stand upright, along with everyone else, and inform those in charge that they are no longer, and that there is a new world to be had – and won.`,
      `This is, for better or for worse, where my life has brought me, where my choices and versimilitudes have culminated in.`,
      `Now, then, the weapon: the written word.  The written word.  This is when I grow a bit uneasy, for it seems obvious to me that there must also be a force behind these words, a personality unlike the dull dreary voices thrown out into the void, unlike mere letters on a page.  That these words must be infused with the will of Heaven (read: our own innate selves) or they are meaningless.  I say Heaven, but what I really mean is the will to power that Nietsche spoke of, that power within everyone of us (hopefully), that these words must be spoken aloud.  I have to risk speaking.`,
      `Song of Fire and Light.  Song because it vibrates in the hearts and minds of everyone.  Fire to cleanse away the dead things.  Light because that is what we are made of, what we reflect and refract.`,
      `Solistrato.  The layer of life closest to the sun.  The realm of the mind, the divine (beautiful and truthful, wedded together).  Let's go.`,
    ],
    crossLink: null,
  },
};

// The light itself, staged as a single spotlight rather than an internal
// glow — see the file header for why. "Prologue" is the shortest complete
// poem in Scott Jason Cohen's Assembled Verse.doc: four lines, a stage
// direction more than a description, cueing a beam of light on before
// anything else in the poem happens. That's exactly the relationship this
// scene's actual spotlight rig has to the gem.
const LIGHT = {
  name: 'Ein Soph',
  subtitle: 'The laser light — focused, not created',
  note: `Ein Soph — Kabbalah's name for the infinite, the divine before or beyond any attribute, without shape or color of its own until something focuses it. What's staged here is the concrete, theatrical image Scott's own writing already had on hand for exactly that: a single beam, picking one thing out of the dark.`,
  source: '"Prologue" (Scott Jason Cohen\'s Assembled Verse.doc)',
  sourceNote: `The shortest complete poem in the collection — four lines, a single stage direction, in full.`,
  writing: [
    `Maestro, if you please:
A single spotlight,
Illuminating
Me from head to toe.`,
  ],
};

const FACET_ORDER = ['gabriel', 'emmanuel', 'raphael', 'michael'];

// ─── Backdrop texture — the Tree of Life and the seven chakras, overlaid
// on one shared vertical axis. Canvas-drawn, not an image asset, same
// rule as every other texture on this site. Per Scott: "Behind the gem,
// I feel like we should do something with the chakras and the tree of
// life." The two systems already share a structure worth leaning into —
// both run top to bottom along a single central spine (the Tree's own
// "Middle Pillar" — Kether, Da'at, Tiphareth, Yesod, Malkuth — is exactly
// the same axis a chakra column runs down) — so they're drawn overlaid on
// that one axis rather than as two separate, competing diagrams.
//
// The Tree of Life here is the standard ten sephirot plus Da'at (the
// "hidden," non-sephirah eleventh point, traditionally drawn fainter or
// dotted — kept that way here, unconnected to the 22 paths), joined by
// the traditional 22 paths. Sephirot aren't individually labeled — this
// is a backdrop glimpsed through refracted glass, not a reference
// diagram — but the structure itself is the real, standard one, not
// invented for this scene.
function makeTreeOfLifeChakraTexture() {
  const w = 768, h = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Soft dark vignette, fading to fully transparent — no hard rectangle
  // edge once this is mapped onto a plane in the scene.
  const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.62);
  vignette.addColorStop(0, 'rgba(30,20,44,0.85)');
  vignette.addColorStop(0.7, 'rgba(14,9,22,0.5)');
  vignette.addColorStop(1, 'rgba(5,3,8,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // The seven chakras — drawn first, as a soft glow underneath the Tree's
  // more precise geometry, evenly spaced down the same central axis the
  // Tree's Middle Pillar runs along. Root to crown, bottom to top.
  const midX = w * 0.5;
  const chakraColors = [
    '210,70,70',    // Muladhara, root — red
    '230,140,70',   // Svadhisthana, sacral — orange
    '225,205,90',   // Manipura, solar plexus — yellow
    '90,190,120',   // Anahata, heart — green
    '80,140,230',   // Vishuddha, throat — blue
    '110,90,220',   // Ajna, third eye — indigo
    '168,120,255',  // Sahasrara, crown — violet
  ];
  const chakraTopY = h * 0.108, chakraBotY = h * 0.75;
  chakraColors.forEach((color, i) => {
    // i=0 (root) at the bottom, working up to crown at the top.
    const frac = 1 - i / (chakraColors.length - 1);
    const y = chakraTopY + frac * (chakraBotY - chakraTopY);
    const r = 50;
    const grad = ctx.createRadialGradient(midX, y, 0, midX, y, r);
    grad.addColorStop(0, `rgba(${color},0.55)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(midX, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // The Tree of Life — ten sephirot plus Da'at, joined by the standard 22
  // paths (the 22 Hebrew letters / tarot Major Arcana, traditionally).
  const leftX = w * 0.333, rightX = w * 0.667;
  const S = {
    kether:    { x: midX,   y: h * 0.092 },
    chokmah:   { x: rightX, y: h * 0.192 },
    binah:     { x: leftX,  y: h * 0.192 },
    daat:      { x: midX,   y: h * 0.258 },
    chesed:    { x: rightX, y: h * 0.342 },
    geburah:   { x: leftX,  y: h * 0.342 },
    tiphareth: { x: midX,   y: h * 0.442 },
    netzach:   { x: rightX, y: h * 0.542 },
    hod:       { x: leftX,  y: h * 0.542 },
    yesod:     { x: midX,   y: h * 0.633 },
    malkuth:   { x: midX,   y: h * 0.767 },
  };
  const paths = [
    ['kether', 'chokmah'], ['kether', 'binah'], ['kether', 'tiphareth'],
    ['chokmah', 'binah'], ['chokmah', 'tiphareth'], ['chokmah', 'chesed'],
    ['binah', 'tiphareth'], ['binah', 'geburah'],
    ['chesed', 'geburah'], ['chesed', 'tiphareth'], ['chesed', 'netzach'],
    ['geburah', 'tiphareth'], ['geburah', 'hod'],
    ['tiphareth', 'netzach'], ['tiphareth', 'yesod'], ['tiphareth', 'hod'],
    ['netzach', 'hod'], ['netzach', 'yesod'], ['netzach', 'malkuth'],
    ['hod', 'yesod'], ['hod', 'malkuth'],
    ['yesod', 'malkuth'],
  ]; // the 22 traditional paths

  ctx.strokeStyle = 'rgba(225,220,240,0.3)';
  ctx.lineWidth = 1.4;
  paths.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(S[a].x, S[a].y);
    ctx.lineTo(S[b].x, S[b].y);
    ctx.stroke();
  });

  // Da'at — the "hidden" non-sephirah: a faint dotted ring, no fill, no
  // paths of its own, per how it's traditionally drawn.
  ctx.save();
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = 'rgba(225,220,240,0.25)';
  ctx.beginPath();
  ctx.arc(S.daat.x, S.daat.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  Object.entries(S).forEach(([key, p]) => {
    if (key === 'daat') return;
    const r = 22;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, 'rgba(255,250,235,0.95)');
    grad.addColorStop(0.6, 'rgba(240,225,190,0.55)');
    grad.addColorStop(1, 'rgba(240,225,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

// The gem: a princess-cut-inspired multi-faceted stone — a pointed crown,
// a full girdle, and a tapering pavilion, four columns of facets going
// around (still one column per element: Gabriel, Emmanuel, Raphael,
// Michael). A plain bipyramid (the original cut, one wedge per side, top
// and bottom) reads as a simple kite shape; a real princess cut has many
// small facets catching light at different angles, which is what "make
// the gem multifaceted" asked for. Built by hand, vertex by vertex, same
// reason as before: stock geometries have no per-side grouping to hang
// four different materials on. Non-indexed on purpose, same reason as
// before too — a clean flat facet normal per triangle, no shared-vertex
// smoothing, which is exactly the faceted look a cut gem needs.
//
// The vertical profile, top to bottom: a crown tip, a narrow crown ring,
// the girdle (full radius, where the four colors' facets meet edge to
// edge), a narrower pavilion ring, and a culet tip. Four bands between
// those five profile points, each split into the four columns — a crown
// wedge, two ring-to-girdle facets, two girdle-to-pavilion facets, and a
// pavilion wedge, six triangles per column, 24 facets total (up from 8).
//
// Every band's winding was worked out by hand for outward-facing normals
// before writing this (see the cross-product checks in NOTES.md, 1.0.20)
// — both wedge cases (a single apex point above or below a four-point
// ring) and both ring-to-ring cases (widening or narrowing going down)
// turned out to reduce to just two winding rules, reused across all four
// bands rather than four separate ad-hoc ones.
//
// `triangleColumn` is a parallel lookup — triangleColumn[faceIndex] is
// which of the four columns that triangle belongs to — built alongside
// the position buffer so the raycaster's hit-testing (see createLens
// below) doesn't need to assume a fixed triangle-count-per-column; it
// just reads the array.
//
// "Make the gem translucent," per Scott (from the previous pass):
// transmission is still pushed hard here (0.9), with a tight, near-zero-
// roughness clearcoat shell and an attenuation color/distance tuned to
// each facet's own hue, so the four colors read as colored glass with
// real depth to look into, not flat colored plastic.
function buildFacetedGem(radius) {
  const cols = FACET_ORDER.length;
  const angleOf = k => (k / cols) * Math.PI * 2;
  const ringAt = (y, r) => Array.from({ length: cols }, (_, k) =>
    new THREE.Vector3(Math.cos(angleOf(k)) * r, y, Math.sin(angleOf(k)) * r));

  const crownTip  = new THREE.Vector3(0, radius, 0);
  const crownRing = ringAt(radius * 0.55, radius * 0.34);
  const girdle    = ringAt(0, radius);
  const pavRing   = ringAt(radius * -0.5, radius * 0.38);
  const culet     = new THREE.Vector3(0, -radius, 0);

  const positions = [];
  const triangleColumn = [];
  function tri(a, b, c, col) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    triangleColumn.push(col);
  }

  for (let k = 0; k < cols; k++) {
    const kn = (k + 1) % cols;
    // Crown wedge — apex above the ring: (apex, ring[kn], ring[k]).
    tri(crownTip, crownRing[kn], crownRing[k], k);
    // Crown ring down to girdle — ring-to-ring, widening: (top[k], bot[kn],
    // bot[k]) then (top[k], top[kn], bot[kn]).
    tri(crownRing[k], girdle[kn], girdle[k], k);
    tri(crownRing[k], crownRing[kn], girdle[kn], k);
    // Girdle down to pavilion ring — same ring-to-ring rule, narrowing.
    tri(girdle[k], pavRing[kn], pavRing[k], k);
    tri(girdle[k], girdle[kn], pavRing[kn], k);
    // Pavilion wedge — apex below the ring: (apex, ring[k], ring[kn]).
    tri(culet, pavRing[k], pavRing[kn], k);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  // Six triangles (18 vertices) per column, columns in FACET_ORDER order,
  // contiguous in the buffer — matches the geometry groups below.
  for (let k = 0; k < cols; k++) geo.addGroup(k * 18, 18, k);

  const materials = FACET_ORDER.map(key => {
    const c = FACETS[key].color;
    return new THREE.MeshPhysicalMaterial({
      color: c,
      metalness: 0,
      roughness: 0.04,
      transmission: 0.9,
      thickness: radius * 1.8,
      ior: 1.9,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      attenuationColor: new THREE.Color(c),
      attenuationDistance: radius * 1.4,
      emissive: c,
      emissiveIntensity: 0.1,
    });
  });

  const mesh = new THREE.Mesh(geo, materials);
  mesh.userData.triangleColumn = triangleColumn;
  return mesh;
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById('lens-styles')) { stylesInjected = true; return; }
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'lens-styles';
  style.textContent = `
    .lens-preview { width: 100%; height: 100%; }
    .lens-preview canvas { width: 100% !important; height: 100% !important; display: block; }

    #lens-title, #lens-hint, #lens-caption {
      /* Same z-index-escaping trick as every other full scene's own body-
         level title/hint — see orrery.js for the fullest explanation. Must
         clear #pm-nav (z-index 500, fixed) and #experience-overlay
         (z-index 300, fixed, fades to opaque over 0.6s). */
      position: fixed; color: rgba(255,255,255,0.82);
      text-align: center; pointer-events: none; z-index: 310;
      font-family: 'Times New Roman', serif;
    }
    #lens-title {
      top: 4.4rem; left: 50%; transform: translateX(-50%);
      text-shadow: 0 0 18px rgba(0,0,0,0.85), 0 1px 0 rgba(0,0,0,0.6);
    }
    #lens-title-main {
      display: block; font-size: clamp(1rem, 3vw, 1.7rem);
      letter-spacing: 0.32em; text-transform: uppercase;
    }
    #lens-title-sub {
      display: block; margin-top: 0.55rem; font-size: clamp(0.62rem, 1.3vw, 0.8rem);
      font-style: italic; color: rgba(225,225,235,0.5);
    }
    #lens-hint {
      top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
      line-height: 1.8; text-align: right; text-transform: uppercase;
      color: rgba(255,255,255,0.3);
    }
    #lens-caption {
      bottom: 3rem; left: 50%; transform: translateX(-50%);
      font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
      white-space: nowrap; font-style: italic; color: rgba(255,255,255,0.4);
    }
    @media (max-width: 600px) {
      #lens-title { top: 3.9rem; width: 90vw; }
      #lens-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
    }
    @media (max-width: 600px) {
      #lens-hint {
        top: 7.6rem; right: 6vw; left: 6vw;
        font-size: 0.5rem; letter-spacing: 0.14em; line-height: 1.6; text-align: center;
      }
    }
    #lens-title.panel-open, #lens-hint.panel-open, #lens-caption.panel-open { opacity: 0; transition: opacity 0.3s ease; }

    #lens-panel {
      position: absolute; top: 0; right: 0; width: 38%; height: 100%;
      background: radial-gradient(ellipse at 30% 0%, rgba(40,36,60,0.25), transparent 60%), #0a0910;
      border-left: 1px solid rgba(200,190,220,0.15);
      padding: 3rem 2rem; transform: translateX(100%);
      transition: transform .5s cubic-bezier(.16,1,.3,1);
      overflow-y: scroll; z-index: 10;
      scrollbar-color: rgba(200,190,220,0.3) #0a0910; scrollbar-width: thin;
      font-family: 'Times New Roman', serif;
    }
    #lens-panel.open { transform: translateX(0); }
    #lens-panel-eyebrow {
      font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--fc, rgba(220,210,240,0.6)); margin-bottom: 0.3rem;
    }
    #lens-panel-title {
      font-size: 1.15rem; letter-spacing: 0.22em; text-transform: uppercase;
      color: rgba(230,225,245,0.85); margin-bottom: 0.9rem;
    }
    #lens-panel-faces {
      list-style: none; margin: 0 0 1.4rem; padding: 0;
      border-bottom: 1px solid rgba(200,190,220,0.15); padding-bottom: 1.2rem;
      font-size: 0.82rem; color: rgba(220,215,235,0.6); line-height: 1.7;
    }
    #lens-panel-faces li { margin-bottom: 0.3rem; }
    #lens-panel-faces b { color: rgba(230,225,245,0.85); font-weight: normal; font-style: italic; }
    #lens-panel-source {
      font-size: 0.72rem; letter-spacing: 0.03em; color: rgba(220,215,235,0.4);
      margin-bottom: 1.4rem; font-style: italic; line-height: 1.6;
    }
    #lens-panel-body {
      font-size: 0.96rem; line-height: 1.85; color: rgba(228,225,238,0.72);
      white-space: pre-line;
    }
    #lens-panel-body p { margin: 0 0 1.1rem; }
    #lens-panel-crosslink {
      display: inline-block; margin-top: 1rem; font-size: 0.78rem; font-style: italic;
      color: var(--fc, rgba(220,190,255,0.7)); cursor: pointer; text-decoration: underline;
      text-underline-offset: 3px;
    }
    #lens-panel-crosslink:hover { color: rgba(255,255,255,0.9); }
    #lens-panel-close {
      position: absolute; top: 1.5rem; right: 1.5rem; background: none;
      border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
      cursor: pointer; padding: .5rem; z-index: 2;
    }
    #lens-panel-close:hover { color: rgba(255,255,255,0.9); }
    @media (max-width: 700px) {
      #lens-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      #lens-panel { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function createLens(container, { preview = false } = {}) {
  injectStyles();

  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(preview ? 0.6 : 0.9, preview ? 0.3 : 0.4, preview ? 3.2 : 4.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x050308, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  scene.fog = new THREE.Fog(0x050308, preview ? 3 : 4, preview ? 9 : 13);

  // ─── Ambient lighting — dim and violet-leaning fill, so the gem's own
  // transmitted color and the spotlight rig below do almost all the work.
  scene.add(new THREE.HemisphereLight(0x554466, 0x0a0710, 0.5));
  const keyLight = new THREE.DirectionalLight(0xd8ccff, 0.35);
  keyLight.position.set(1.5, 2.5, 2);
  scene.add(keyLight);

  const root = new THREE.Group();
  scene.add(root);

  // ─── The gem — one stone, four colored translucent sides. ─────────────
  const gemRadius = preview ? 0.68 : 0.85;
  const gem = buildFacetedGem(gemRadius);
  root.add(gem);

  // ─── Ein Soph, staged as "Prologue" — a spotlight fixture (the clickable
  // stand-in for both the poem and "the Maestro" cueing it), a real
  // THREE.SpotLight doing the actual illumination, and — full scene only —
  // a translucent additive cone faking a visible beam. No post-processing
  // pipeline exists on this site, so the beam and the fixture's glow are
  // faked with layered transparent geometry, same rule as the bulb in
  // orrery.js and the aurorae shimmer in egg.js. ──────────────────────────
  // Completely vertical, per Scott — the fixture sits directly above the
  // gem on the Y axis, so the beam falls straight down onto it rather than
  // arriving at an angle.
  const lightDistance = gemRadius * 3.6;
  const lightDir = new THREE.Vector3(0, 1, 0);
  const fixturePos = lightDir.clone().multiplyScalar(lightDistance);

  const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfffdf0 });
  const lightFixture = new THREE.Mesh(new THREE.SphereGeometry(gemRadius * 0.13, 16, 16), fixtureMat);
  lightFixture.position.copy(fixturePos);
  root.add(lightFixture);

  // "Focus the spotlight into a tighter beam," per Scott: angle pulled in
  // from 0.15π (~27°) to 0.07π (~12.6°), penumbra tightened from 0.55 to
  // 0.3 for a more defined edge — a narrow, deliberate shaft rather than a
  // broad wash of light.
  const spot = new THREE.SpotLight(0xfff6dd, preview ? 3.2 : 5.5, lightDistance * 2.5, Math.PI * 0.07, 0.3, 1.1);
  spot.position.copy(fixturePos);
  const spotTarget = new THREE.Object3D();
  root.add(spotTarget);
  spot.target = spotTarget;
  root.add(spot);

  const glowSprites = [];
  let beamMesh = null;
  if (!preview) {
    // Beam: a hollow cone, apex at the fixture, opening toward the gem —
    // narrowed to match the tighter spotlight angle above (was 0.9).
    const beamHeight = lightDistance * 0.92;
    const beamGeo = new THREE.ConeGeometry(gemRadius * 0.4, beamHeight, 24, 1, true);
    beamGeo.translate(0, -beamHeight / 2, 0); // shift so the apex sits at local origin
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dd, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false,
    });
    beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.copy(fixturePos);
    const coneAxis = new THREE.Vector3(0, -1, 0); // the cone opens along its local -Y
    const towardGem = new THREE.Vector3(0, 0, 0).sub(fixturePos).normalize();
    beamMesh.quaternion.setFromUnitVectors(coneAxis, towardGem);
    root.add(beamMesh);

    // Small additive halo around the fixture itself, same layered-sprite
    // bloom trick used everywhere else on this site.
    [0.4, 0.8].forEach((scale, i) => {
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 128;
      const gctx = glowCanvas.getContext('2d');
      const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,253,245,0.85)');
      grad.addColorStop(1, 'rgba(255,253,245,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(glowCanvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 - i * 0.15 });
      const sprite = new THREE.Sprite(mat);
      const s = gemRadius * (0.5 + scale);
      sprite.scale.set(s, s, 1);
      sprite.position.copy(fixturePos);
      root.add(sprite);
      glowSprites.push({ sprite, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.4 });
    });
  }

  // Sparse dust motes, drifting slowly.
  const moteCount = preview ? 30 : 90;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const r = 1.5 + Math.random() * (preview ? 2 : 4);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    motePositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    motePositions[i * 3 + 1] = r * Math.cos(phi) * 0.5;
    motePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xd8ccff, size: 0.012, transparent: true, opacity: 0.35, sizeAttenuation: true });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  // ─── Backdrop — the Tree of Life and the seven chakras (see
  // makeTreeOfLifeChakraTexture above). A sibling of the gem in `scene`,
  // not a child of the rotating `root` group: a real backdrop doesn't
  // spin with the sculpture in front of it, and a flat plane that did
  // rotate would vanish edge-on twice per revolution. Skipped in preview
  // — eight simultaneous WebGL previews on the landing page is enough
  // load without a texture-mapped plane in each. Sized and positioned
  // generously above and below the gem, and exempted from fog, so there's
  // real, vivid content for the gem's transmission material to refract
  // all the way through every facet, pavilion included — not just tinted
  // darkness like before.
  let backdrop = null;
  if (!preview) {
    const backdropTex = makeTreeOfLifeChakraTexture();
    const backdropMat = new THREE.MeshBasicMaterial({
      map: backdropTex, transparent: true, depthWrite: false, fog: false,
    });
    const backdropH = gemRadius * 9;
    const backdropW = backdropH * (768 / 1200);
    backdrop = new THREE.Mesh(new THREE.PlaneGeometry(backdropW, backdropH), backdropMat);
    backdrop.position.set(0, 0, -gemRadius * 3.4);
    scene.add(backdrop);
  }

  if (preview) {
    const wrap = document.createElement('div');
    wrap.className = 'lens-preview';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(renderer.domElement);
    container.appendChild(wrap);

    const reduceMotionPreview = prefersReducedMotion();
    let animId;
    let t = 0;
    function animatePreview() {
      animId = requestAnimationFrame(animatePreview);
      t += 0.006;
      if (!reduceMotionPreview) root.rotation.y = t * 0.3;
      spot.intensity = 3.2 * (0.85 + Math.abs(Math.sin(t * 3)) * 0.3);
      renderer.render(scene, camera);
    }
    animatePreview();

    const resize = bindGuardedResize(container, (nw, nh) => {
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    });

    return {
      dispose() {
        cancelAnimationFrame(animId);
        resize.dispose();
        renderer.dispose();
        gem.geometry.dispose(); gem.material.forEach(m => m.dispose());
        lightFixture.geometry.dispose(); lightFixture.material.dispose();
        moteGeo.dispose(); moteMat.dispose();
        wrap.remove();
      },
    };
  }

  container.appendChild(renderer.domElement);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  // Programmatically focusable so closing the panel (✕, outside click, or
  // Escape) has somewhere real to send focus back to, rather than leaving
  // it on a now-hidden close button or nowhere at all.
  container.tabIndex = -1;

  // ─── Title, hint, caption — body-level, matching orrery/egg/butterfly's
  // own fixed labels. ──────────────────────────────────────────────────────
  const title = document.createElement('div');
  title.id = 'lens-title';
  title.innerHTML = `
    <span id="lens-title-main">The Lens</span>
    <span id="lens-title-sub">Four facets, one light.</span>
  `;
  title.setAttribute('aria-hidden', 'true');
  document.body.appendChild(title);

  const hint = document.createElement('p');
  hint.id = 'lens-hint';
  hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a facet or the light to read';
  hint.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hint);

  const caption = document.createElement('p');
  caption.id = 'lens-caption';
  caption.textContent = 'Ein Soph — "a single spotlight," unnamed';
  caption.setAttribute('aria-hidden', 'true');
  document.body.appendChild(caption);

  // ─── Panel ──────────────────────────────────────────────────────────────
  const panel = document.createElement('aside');
  panel.id = 'lens-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'lens-panel-title');
  panel.innerHTML = `
    <button type="button" id="lens-panel-close" aria-label="Close panel">✕</button>
    <div id="lens-panel-eyebrow"></div>
    <div id="lens-panel-title" tabindex="-1"></div>
    <ul id="lens-panel-faces"></ul>
    <div id="lens-panel-source"></div>
    <div id="lens-panel-body"></div>
  `;
  container.appendChild(panel);
  const panelEyebrow = panel.querySelector('#lens-panel-eyebrow');
  const panelTitle   = panel.querySelector('#lens-panel-title');
  const panelFaces   = panel.querySelector('#lens-panel-faces');
  const panelSource  = panel.querySelector('#lens-panel-source');
  const panelBody    = panel.querySelector('#lens-panel-body');

  function hideAmbient(hidden) {
    title.classList.toggle('panel-open', hidden);
    hint.classList.toggle('panel-open', hidden);
    caption.classList.toggle('panel-open', hidden);
  }

  function renderWriting(paragraphs) {
    return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  function openFacetPanel(key) {
    const f = FACETS[key];
    panel.style.setProperty('--fc', f.hex);
    panelEyebrow.textContent = `${f.archangel} · ${f.element}`;
    panelTitle.textContent = f.gem.toUpperCase();
    panelFaces.innerHTML = f.otherFaces.map(g =>
      `<li><b>${g.name}</b> — ${g.tradition}: ${g.epithet}</li>`
    ).join('');
    panelSource.textContent = `${f.source} — ${f.sourceNote}`;
    panelBody.innerHTML = renderWriting(f.writing) +
      (f.crossLink ? `<span id="lens-panel-crosslink" data-target="${f.crossLink}">Continues in ${FACETS[f.crossLink].archangel}'s facet →</span>` : '');
    const cross = panelBody.querySelector('#lens-panel-crosslink');
    if (cross) cross.addEventListener('click', () => openFacetPanel(cross.dataset.target));
    panel.classList.add('open');
    hideAmbient(true);
    setTimeout(() => panelTitle.focus(), 50);
  }

  function openLightPanel() {
    panel.style.setProperty('--fc', 'rgba(255,246,221,0.85)');
    panelEyebrow.textContent = LIGHT.subtitle;
    panelTitle.textContent = LIGHT.name.toUpperCase();
    panelFaces.innerHTML = `<li>${LIGHT.note}</li>`;
    panelSource.textContent = `${LIGHT.source} — ${LIGHT.sourceNote}`;
    panelBody.innerHTML = renderWriting(LIGHT.writing);
    panel.classList.add('open');
    hideAmbient(true);
    setTimeout(() => panelTitle.focus(), 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    hideAmbient(false);
    selected = false;
    setEmphasis(hoveredObject === gem ? hoveredSide : null);
    container.focus();
  }

  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelector('#lens-panel-close').addEventListener('click', e => {
    e.stopPropagation();
    closePanel();
  });

  // ─── Interaction ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredObject = null, hoveredSide = null, selected = false;

  // Bumps just the hovered/selected side's own material — the gem's
  // material is an array (one per side, from buildFacetedGem's groups),
  // so each side dims or brightens independently.
  function setEmphasis(sideIndex) {
    gem.material.forEach((m, idx) => {
      m.emissiveIntensity = (sideIndex !== null && idx === sideIndex) ? 0.5 : 0.1;
    });
  }

  const pickables = [gem, lightFixture];

  const onContainerMouseMove = e => {
    const rect = container.getBoundingClientRect();
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pickables);
    const hit = hits.length ? hits[0] : null;
    const hitObject = hit ? hit.object : null;
    // gem.userData.triangleColumn[faceIndex] is which of the four columns
    // that triangle belongs to (see buildFacetedGem) — a lookup rather
    // than a fixed divisor, since the princess-cut gem has a different
    // triangle count per band, not a uniform two-per-side like the
    // original bipyramid.
    const sideIdx = hitObject === gem ? gem.userData.triangleColumn[hit.faceIndex] : null;
    if (hitObject !== hoveredObject || sideIdx !== hoveredSide) {
      hoveredObject = hitObject;
      hoveredSide = sideIdx;
      if (!selected) setEmphasis(hoveredObject === gem ? hoveredSide : null);
    }
    container.style.cursor = hoveredObject ? 'pointer' : 'default';
  };
  container.addEventListener('mousemove', onContainerMouseMove);

  let touchMoved = false;
  const onContainerTouchMove = () => { touchMoved = true; };
  container.addEventListener('touchmove', onContainerTouchMove, { passive: true });
  const onContainerTouchStart = () => { touchMoved = false; };
  container.addEventListener('touchstart', onContainerTouchStart, { passive: true });
  const onContainerClick = e => {
    if (touchMoved) { touchMoved = false; return; }
    // Was `panel.classList.contains('open') && !panel.contains(e.target)`
    // — closed the panel on any canvas click while open, even one that
    // hit a different facet or the light fixture (hoveredObject is
    // tracked live by mousemove above regardless of panel state). Fixed
    // 2026-07-23, same root cause as library.js's identical bug: only
    // close on an actual empty-space click.
    if (panel.classList.contains('open') && !hoveredObject) {
      closePanel();
      return;
    }
    if (!hoveredObject) return;
    selected = true;
    if (hoveredObject === gem) {
      setEmphasis(hoveredSide);
      openFacetPanel(FACET_ORDER[hoveredSide]);
    } else if (hoveredObject === lightFixture) {
      openLightPanel();
    }
  };
  container.addEventListener('click', onContainerClick);

  // ─── Drag to orbit ───────────────────────────────────────────────────────
  let targetRotationY = root.rotation.y;
  const orbitDrag = bindOrbitDrag(container, {
    onDrag: dx => { targetRotationY += dx; },
  });
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: e => panel && panel.contains(e.target),
    onZoom: deltaY => {
      camera.position.z = Math.max(2.0, Math.min(8, camera.position.z + deltaY * 0.008));
    },
  });

  const reduceMotion = prefersReducedMotion();

  const escapeClose = bindEscapeClose(() => {
    if (panel.classList.contains('open')) closePanel();
  });

  // ─── Animate ────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.008;

    if (reduceMotion) {
      root.rotation.y = targetRotationY;
    } else {
      root.rotation.y += (targetRotationY - root.rotation.y) * 0.07;
    }

    if (!reduceMotion) {
      // The spotlight pulses gently; a slow, steady heartbeat, not a strobe.
      const pulse = 0.85 + Math.sin(t * 1.6) * 0.15;
      spot.intensity = 5.5 * pulse;
      glowSprites.forEach(g => {
        const s = gemRadius * (0.45 + Math.sin(t * g.speed + g.phase) * 0.08);
        g.sprite.scale.set(s, s, 1);
      });
      motes.rotation.y += 0.0006;
    }

    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom.dispose();
      resize.dispose();
      escapeClose.dispose();
      container.removeEventListener('mousemove', onContainerMouseMove);
      container.removeEventListener('touchmove', onContainerTouchMove);
      container.removeEventListener('touchstart', onContainerTouchStart);
      container.removeEventListener('click', onContainerClick);
      renderer.dispose();
      gem.geometry.dispose(); gem.material.forEach(m => m.dispose());
      lightFixture.geometry.dispose(); lightFixture.material.dispose();
      beamMesh?.geometry.dispose(); beamMesh?.material.dispose();
      glowSprites.forEach(g => { g.sprite.material.map?.dispose(); g.sprite.material.dispose(); });
      backdrop?.geometry.dispose(); backdrop?.material.map?.dispose(); backdrop?.material.dispose();
      moteGeo.dispose(); moteMat.dispose();
      title.remove();
      hint.remove();
      caption.remove();
      panel.remove();
      renderer.domElement.remove();
    },
  };
}

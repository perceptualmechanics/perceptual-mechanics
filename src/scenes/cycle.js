import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose } from '../utils/sceneKit.js';

// ─── Cycle: the four-faceted gem ───────────────────────────────────────────
// Full rebuild, 2026-07-17, replacing the old five-element YouTube-livestream
// version entirely (see git history — the old ELEMENTS/FIRE_LITANY roster and
// its dead-stream problems are gone, not fixed). Scott's schema, verbatim:
//
//   "The gem with four faces is the crystal focusing the laser light of
//    EIN SOPH. Nature is the cut of the overall gem. MALKUTH/SHEKINAH. Each
//    elemental facet is cut with other polytheistic gods that would loosely
//    fit in with that particular element. and then you incorporate my
//    writing."
//
// Ein Soph (Kabbalah: the infinite, the divine before/beyond any attribute)
// is the light at the center. It's focused, not created, by the crystal —
// four archangel/element facets around a shared point: Gabriel (Fire/Death,
// ruby), Emmanuel (Water, sapphire), Raphael (Earth, emerald), Michael
// (Light/Air, yellow sapphire). Malkuth/Shekinah — the tenth sephirah, the
// physical world, the indwelling feminine presence of the divine — isn't a
// fifth facet standing next to the other four; per Scott's own framing she's
// the CUT of the whole gem, the vessel/setting that holds and shapes the
// light rather than one more color competing with the others. Built here as
// the rough, unpolished stone the four polished facets are still embedded
// in and rising out of — nature as what contains revelation, not one more
// piece of it.
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
//   Malkuth/Shekinah (Nature) — the same poem's final section (13), which
//     closes on an explicit, angry Mother Nature: "there's quite a storm
//     brewing out there... she's angry, we no longer come to her with arms
//     outstretched in love." Full text, unedited.

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

const NATURE = {
  name: 'Malkuth · Shekinah',
  subtitle: 'The cut of the gem',
  note: `Malkuth, the tenth sephirah — the physical world, the kingdom, the only sephirah with no light of its own, only what the nine above it pass down. Shekinah, its companion name in the same tradition: the divine presence as it actually dwells inside the world, not above it. Neither is a fifth facet standing next to Gabriel, Emmanuel, Raphael, and Michael — she's the shape that holds them: the rough, unpolished stone the four polished facets are still embedded in, still growing out of.`,
  source: '"thirty-six," section 13 (closing)',
  sourceNote: `The final section of the same 13-part poem Raphael and Emmanuel are drawn from. Full text, unedited.`,
  writing: [
    `Everyone is tired, did you notice that?  No one
Has enough energy anymore.  Even with our
Low-fat lifestyle and body obsessions that drive
Us into the gym, no one seems to have that
"Oomph" unless it's to sell Volkswagens.  There
Are too many distractions, there are too many
Predators that are catching our reflexive eye,
There's too much to keep track of, and it's
Wearing our minds down, exhausting our
Imaginations.  We have bulimic souls, and
Their linings are burning away under gluttony.`,
    `But if I starve to spite my face,
Then surely we'll have lost the race.`,
    `I may be tired, but Mother Nature certainly
Isn't – there's quite a storm brewing out there.
And every day disasters pile up – earthquake,
Hurricane, and volcano raging against the
Dying of the light.  The more we settle into our
Static narcosis, the more Nature waves her hands
And tries to get our attention.  More and more
She goes unheard, like wealthy yupsters ignoring
Their crazy mom.  She's angry, we no longer come
To her with arms outstretched in love, but
Taking what we want and wondering why
She just can't keep her fucking mouth shut.`,
    `What we need is a miracle.`,
  ],
};

const FACET_ORDER = ['gabriel', 'emmanuel', 'raphael', 'michael'];

// ─── Rough-stone texture — canvas, not an image asset, same rule as every
// other texture on this site. Malkuth/Shekinah's own material: dark,
// matte, mineral, nothing polished about it — the opposite of the gems
// it holds.
function makeStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1612';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 2.4 + 0.3;
    const shade = Math.random() * 40 - 20;
    const base = 26 + shade;
    ctx.fillStyle = `rgba(${base + 12},${base + 8},${base},${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few darker veins/cracks.
  ctx.strokeStyle = 'rgba(8,6,4,0.5)';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    let x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// One gem: an octahedron (the classic faceted-crystal silhouette) in a
// transmissive physical material. `pointOut` is the direction (already
// normalized) the gem's culet points, away from the shared Ein Soph center —
// each gem sits with its point toward the light and its broad end toward
// the visitor, the way a real four-stone setting converges on one mount.
function buildGem(facet, pointOut, radius) {
  const geo = new THREE.OctahedronGeometry(radius, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: facet.color,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.72,
    thickness: radius * 1.6,
    ior: 1.77,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: facet.color,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pointOut).multiplyScalar(radius * 1.05);
  mesh.lookAt(0, 0, 0);
  mesh.rotateX(Math.PI / 2); // octahedron's own point is +Y; align it toward center
  mesh.userData.facetKey = facet.key;
  return mesh;
}

function buildRockCradle(radius) {
  // A bowl (restricted phi/theta range), not a full sphere — Malkuth as an
  // open setting the gems rise out of, not a closed shell around them.
  const geo = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.62);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const bump = (Math.sin(v.x * 3.1) + Math.sin(v.y * 2.7 + 1.3) + Math.sin(v.z * 3.6 + 2.1)) * 0.045
      + (Math.random() - 0.5) * 0.03;
    v.addScaledVector(n, bump * radius);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: makeStoneTexture(), roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI; // open side faces up/toward camera by default
  return mesh;
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById('cycle-styles')) { stylesInjected = true; return; }
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'cycle-styles';
  style.textContent = `
    .cyc-preview { width: 100%; height: 100%; }
    .cyc-preview canvas { width: 100% !important; height: 100% !important; display: block; }

    #cycle-title, #cycle-hint, #cycle-caption {
      /* Same z-index-escaping trick as every other full scene's own body-
         level title/hint — see orrery.js for the fullest explanation. Must
         clear #pm-nav (z-index 500, fixed) and #experience-overlay
         (z-index 300, fixed, fades to opaque over 0.6s). */
      position: fixed; color: rgba(255,255,255,0.82);
      text-align: center; pointer-events: none; z-index: 310;
      font-family: 'Times New Roman', serif;
    }
    #cycle-title {
      top: 4.4rem; left: 50%; transform: translateX(-50%);
      text-shadow: 0 0 18px rgba(0,0,0,0.85), 0 1px 0 rgba(0,0,0,0.6);
    }
    #cycle-title-main {
      display: block; font-size: clamp(1rem, 3vw, 1.7rem);
      letter-spacing: 0.32em; text-transform: uppercase;
    }
    #cycle-title-sub {
      display: block; margin-top: 0.55rem; font-size: clamp(0.62rem, 1.3vw, 0.8rem);
      font-style: italic; color: rgba(225,225,235,0.5);
    }
    #cycle-hint {
      top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
      line-height: 1.8; text-align: right; text-transform: uppercase;
      color: rgba(255,255,255,0.3);
    }
    #cycle-caption {
      bottom: 2.5rem; left: 50%; transform: translateX(-50%);
      font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
      white-space: nowrap; font-style: italic; color: rgba(255,255,255,0.4);
    }
    @media (max-width: 600px) {
      #cycle-title { top: 3.9rem; width: 90vw; }
      #cycle-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
    }
    @media (max-width: 600px) {
      #cycle-hint {
        top: 7.6rem; right: 6vw; left: 6vw;
        font-size: 0.5rem; letter-spacing: 0.14em; line-height: 1.6; text-align: center;
      }
    }
    #cycle-title.panel-open, #cycle-hint.panel-open, #cycle-caption.panel-open { opacity: 0; transition: opacity 0.3s ease; }

    #cycle-panel {
      position: absolute; top: 0; right: 0; width: 38%; height: 100%;
      background: radial-gradient(ellipse at 30% 0%, rgba(40,36,60,0.25), transparent 60%), #0a0910;
      border-left: 1px solid rgba(200,190,220,0.15);
      padding: 3rem 2rem; transform: translateX(100%);
      transition: transform .5s cubic-bezier(.16,1,.3,1);
      overflow-y: scroll; z-index: 10;
      scrollbar-color: rgba(200,190,220,0.3) #0a0910; scrollbar-width: thin;
      font-family: 'Times New Roman', serif;
    }
    #cycle-panel.open { transform: translateX(0); }
    #cycle-panel-eyebrow {
      font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--fc, rgba(220,210,240,0.6)); margin-bottom: 0.3rem;
    }
    #cycle-panel-title {
      font-size: 1.15rem; letter-spacing: 0.22em; text-transform: uppercase;
      color: rgba(230,225,245,0.85); margin-bottom: 0.9rem;
    }
    #cycle-panel-faces {
      list-style: none; margin: 0 0 1.4rem; padding: 0;
      border-bottom: 1px solid rgba(200,190,220,0.15); padding-bottom: 1.2rem;
      font-size: 0.82rem; color: rgba(220,215,235,0.6); line-height: 1.7;
    }
    #cycle-panel-faces li { margin-bottom: 0.3rem; }
    #cycle-panel-faces b { color: rgba(230,225,245,0.85); font-weight: normal; font-style: italic; }
    #cycle-panel-source {
      font-size: 0.72rem; letter-spacing: 0.03em; color: rgba(220,215,235,0.4);
      margin-bottom: 1.4rem; font-style: italic; line-height: 1.6;
    }
    #cycle-panel-body {
      font-size: 0.96rem; line-height: 1.85; color: rgba(228,225,238,0.72);
      white-space: pre-line;
    }
    #cycle-panel-body p { margin: 0 0 1.1rem; }
    #cycle-panel-crosslink {
      display: inline-block; margin-top: 1rem; font-size: 0.78rem; font-style: italic;
      color: var(--fc, rgba(220,190,255,0.7)); cursor: pointer; text-decoration: underline;
      text-underline-offset: 3px;
    }
    #cycle-panel-crosslink:hover { color: rgba(255,255,255,0.9); }
    #cycle-panel-close {
      position: absolute; top: 1.5rem; right: 1.5rem; background: none;
      border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
      cursor: pointer; padding: .5rem; z-index: 2;
    }
    #cycle-panel-close:hover { color: rgba(255,255,255,0.9); }
    @media (max-width: 700px) {
      #cycle-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      #cycle-panel { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function createCycle(container, { preview = false } = {}) {
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

  // ─── Lighting — dim and violet-leaning, so the gems' own transmitted
  // color and Ein Soph's white core do almost all the work. ─────────────
  scene.add(new THREE.HemisphereLight(0x554466, 0x0a0710, 0.5));
  const keyLight = new THREE.DirectionalLight(0xd8ccff, 0.5);
  keyLight.position.set(1.5, 2.5, 2);
  scene.add(keyLight);

  const root = new THREE.Group();
  scene.add(root);

  // ─── The four gems, arranged in a ring, culets converging on the shared
  // center where Ein Soph's light sits. ───────────────────────────────────
  const gemRadius = preview ? 0.5 : 0.62;
  const gemMeshes = [];
  FACET_ORDER.forEach((key, i) => {
    const angle = (i / FACET_ORDER.length) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(angle), 0.18, Math.sin(angle)).normalize();
    const mesh = buildGem(FACETS[key], dir, gemRadius);
    root.add(mesh);
    gemMeshes.push(mesh);
  });

  // ─── Ein Soph — a bright core plus a couple of soft additive halos
  // standing in for real bloom, same trick as the bulb in orrery.js and
  // the aurorae shimmer in egg.js: this project has no post-processing
  // pipeline, so glow gets faked with layered transparent sprites instead
  // of reached for with an extra dependency. ──────────────────────────────
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfffdf5 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(gemRadius * 0.16, 16, 16), coreMat);
  root.add(core);
  const einSophLight = new THREE.PointLight(0xfff6dd, preview ? 1.6 : 2.4, preview ? 4 : 6);
  root.add(einSophLight);

  const glowSprites = [];
  if (!preview) {
    [0.5, 1.0, 1.7].forEach((scale, i) => {
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 128;
      const gctx = glowCanvas.getContext('2d');
      const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,253,245,0.9)');
      grad.addColorStop(1, 'rgba(255,253,245,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(glowCanvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 - i * 0.12 });
      const sprite = new THREE.Sprite(mat);
      const s = gemRadius * (0.6 + scale);
      sprite.scale.set(s, s, 1);
      root.add(sprite);
      glowSprites.push({ sprite, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.4 });
    });
  }

  // ─── Malkuth/Shekinah — the rough stone cradle the gems rise out of. ───
  const cradle = buildRockCradle(gemRadius * (preview ? 2.1 : 2.4));
  cradle.position.y = -gemRadius * 1.5;
  cradle.userData.isNature = true;
  root.add(cradle);

  // Sparse dust motes, drifting slowly — the only ambient motion besides
  // Ein Soph's own pulse, and gated with everything else below.
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

  if (preview) {
    const wrap = document.createElement('div');
    wrap.className = 'cyc-preview';
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
      core.material.color.setScalar(1);
      einSophLight.intensity = 1.4 + Math.abs(Math.sin(t * 3)) * 0.4;
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
        gemMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
        cradle.geometry.dispose(); cradle.material.map?.dispose(); cradle.material.dispose();
        core.geometry.dispose(); core.material.dispose();
        moteGeo.dispose(); moteMat.dispose();
        wrap.remove();
      },
    };
  }

  container.appendChild(renderer.domElement);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  // ─── Title, hint, caption — body-level, matching orrery/egg/butterfly's
  // own fixed labels. ──────────────────────────────────────────────────────
  const title = document.createElement('div');
  title.id = 'cycle-title';
  title.innerHTML = `
    <span id="cycle-title-main">The Cycle</span>
    <span id="cycle-title-sub">Four facets, one light, one stone.</span>
  `;
  title.setAttribute('aria-hidden', 'true');
  document.body.appendChild(title);

  const hint = document.createElement('p');
  hint.id = 'cycle-hint';
  hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a facet to read &nbsp;·&nbsp; click the stone for Malkuth';
  hint.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hint);

  const caption = document.createElement('p');
  caption.id = 'cycle-caption';
  caption.textContent = 'Ein Soph, unattributed, still at the center';
  caption.setAttribute('aria-hidden', 'true');
  document.body.appendChild(caption);

  // ─── Panel ──────────────────────────────────────────────────────────────
  const panel = document.createElement('aside');
  panel.id = 'cycle-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'cycle-panel-title');
  panel.innerHTML = `
    <button id="cycle-panel-close" aria-label="Close panel">✕</button>
    <div id="cycle-panel-eyebrow"></div>
    <div id="cycle-panel-title" tabindex="-1"></div>
    <ul id="cycle-panel-faces"></ul>
    <div id="cycle-panel-source"></div>
    <div id="cycle-panel-body"></div>
  `;
  container.appendChild(panel);
  const panelEyebrow = panel.querySelector('#cycle-panel-eyebrow');
  const panelTitle   = panel.querySelector('#cycle-panel-title');
  const panelFaces   = panel.querySelector('#cycle-panel-faces');
  const panelSource  = panel.querySelector('#cycle-panel-source');
  const panelBody    = panel.querySelector('#cycle-panel-body');

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
      (f.crossLink ? `<span id="cycle-panel-crosslink" data-target="${f.crossLink}">Continues in ${FACETS[f.crossLink].archangel}'s facet →</span>` : '');
    const cross = panelBody.querySelector('#cycle-panel-crosslink');
    if (cross) cross.addEventListener('click', () => openFacetPanel(cross.dataset.target));
    panel.classList.add('open');
    hideAmbient(true);
    setTimeout(() => panelTitle.focus(), 50);
  }

  function openNaturePanel() {
    panel.style.setProperty('--fc', 'rgba(210,205,225,0.8)');
    panelEyebrow.textContent = NATURE.subtitle;
    panelTitle.textContent = NATURE.name.toUpperCase();
    panelFaces.innerHTML = `<li>${NATURE.note}</li>`;
    panelSource.textContent = `${NATURE.source} — ${NATURE.sourceNote}`;
    panelBody.innerHTML = renderWriting(NATURE.writing);
    panel.classList.add('open');
    hideAmbient(true);
    setTimeout(() => panelTitle.focus(), 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    hideAmbient(false);
    selected = false;
    setEmphasis(hovered);
  }

  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelector('#cycle-panel-close').addEventListener('click', e => {
    e.stopPropagation();
    closePanel();
  });

  // ─── Interaction ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = false;

  function setEmphasis(hit) {
    gemMeshes.forEach(m => {
      m.material.emissiveIntensity = (hit && m === hit) ? 0.5 : 0.12;
    });
  }

  const onContainerMouseMove = e => {
    const rect = container.getBoundingClientRect();
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...gemMeshes, cradle]);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      hovered = hit;
      if (!selected) setEmphasis(gemMeshes.includes(hovered) ? hovered : null);
    }
    container.style.cursor = hovered ? 'pointer' : 'default';
  };
  container.addEventListener('mousemove', onContainerMouseMove);

  let touchMoved = false;
  const onContainerTouchMove = () => { touchMoved = true; };
  container.addEventListener('touchmove', onContainerTouchMove, { passive: true });
  const onContainerTouchStart = () => { touchMoved = false; };
  container.addEventListener('touchstart', onContainerTouchStart, { passive: true });
  const onContainerClick = e => {
    if (touchMoved) { touchMoved = false; return; }
    if (panel.classList.contains('open') && !panel.contains(e.target)) {
      closePanel();
      return;
    }
    if (!hovered) return;
    selected = true;
    if (gemMeshes.includes(hovered)) {
      setEmphasis(hovered);
      openFacetPanel(hovered.userData.facetKey);
    } else if (hovered.userData.isNature) {
      openNaturePanel();
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
      // Ein Soph pulses gently; a slow, steady heartbeat, not a strobe.
      const pulse = 0.85 + Math.sin(t * 1.6) * 0.15;
      einSophLight.intensity = 2.0 * pulse;
      glowSprites.forEach(g => {
        const s = gemRadius * (0.9 + Math.sin(t * g.speed + g.phase) * 0.12);
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
      gemMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      cradle.geometry.dispose(); cradle.material.map?.dispose(); cradle.material.dispose();
      core.geometry.dispose(); core.material.dispose();
      glowSprites.forEach(g => { g.sprite.material.map?.dispose(); g.sprite.material.dispose(); });
      moteGeo.dispose(); moteMat.dispose();
      title.remove();
      hint.remove();
      caption.remove();
      panel.remove();
      renderer.domElement.remove();
    },
  };
}


export const TONES = {
  iron: 0, flying: 1, death: 1, pygmalion: 1,
  selfmutilation: 2, cartography: 2, firevigil: 2, firecalamity: 2, identity: 2,
  holography: 3, projection: 4, crocodile: 5,
};

export const RUBRICS = [
  { patch: 'iron',           para: 0,  phrase: 'absolute lie' },
  { patch: 'flying',         para: 8,  phrase: "I'm flying. Finally." },
  { patch: 'death',          para: 2,  phrase: 'Thoughts of death abound' },
  { patch: 'selfmutilation', para: 16, phrase: 'Fuck them.' },
  { patch: 'identity',       para: 18, phrase: 'Something detached.' },
  { patch: 'projection',     para: 7,  phrase: 'Los Angeles is an otherworld' },
];

export const INTENSITIES = [
  { patch: 'iron',           para: 10, phrase: 'the men with the cold smiles and the iron eyes smile with satisfaction, and they turn off the stars.', mode: 'wide' },
  { patch: 'flying',         para: 6,  phrase: 'Tied down shackled chained to the ground wrapped in iron and thrown in a river', mode: 'tight' },
  { patch: 'death',          para: 11, phrase: 'Sometimes, you must be ready to lose everything before you grasp what you need.', mode: 'wide' },
  { patch: 'selfmutilation', para: 9,  phrase: 'my entire body torn apart by horses', mode: 'tight' },
  { patch: 'holography',     para: 29, phrase: 'he has no idea where on Earth he is', mode: 'wide' },
  { patch: 'projection',     para: 18, phrase: 'the earth fissuring and swallowing me whole', mode: 'tight' },
  { patch: 'projection',     para: 38, phrase: 'swirling upwards and out, like smoke over hills refracting the endless yellow light', mode: 'wide' },
];

export const OGHAM_LINES = {
  iron: 1, flying: 2, death: 1, pygmalion: 1, selfmutilation: 2, cartography: 1,
  firevigil: 1, firecalamity: 1, identity: 1, holography: 1, projection: 2,
  crocodile: 1,
};

export const OPENING_GROUP = {
  flying: 3, death: 2, pygmalion: 3, selfmutilation: 2, cartography: 6,
  firevigil: 3, identity: 2, holography: 2, projection: 2, crocodile: 4,
};

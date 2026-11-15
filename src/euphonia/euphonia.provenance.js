// Where the books' items come from, for the builder's gear: authored for
// this site, not the books' own structure, and each claim tied to the
// books' words. Every quote in `because` stands in the item's name or text,
// or in one of its homelands' chapters; verify-euphonia-builder holds them
// there, and fails on an item the books call a living tradition that has no
// entry here.
//
// Homelands are the State of the World's regions, the builder's Homeland
// choice.

// A living tradition (Scott, 15 November) is handled with care about who it
// goes to: the builder gives one only to a character of its homeland.
export const LIVING = [
  { item: 'Khipu of Record', homelands: ['The Americas'], because: ['Khipu are a real Andean way of keeping records'] },
  { item: 'Talisman Papers (fu)', homelands: ['East and Southeast Asia'], because: ['*Fu* are a real part of Daoist practice'] },
  { item: 'Talismanic Shirt', homelands: ['The Ottomans, Persia and the Horn'], because: ['Ottoman princes and generals wore them into battle'] },
];

// Where an item is at home, so a character from there finds it first.
export const FROM = [
  { item: "Court Astrologer's Astrolabe", homelands: ['The Ottomans, Persia and the Horn'], because: ['The Safavid shah was crowned a second time'] },
  { item: 'Inoculation Lancet', homelands: ['East and Southeast Asia', 'India'], because: ['Healers in China and India already do this'] },
  { item: 'Mutapan Curiosities', homelands: ['Mutapa and the Indian Ocean'], because: ["Prices are for Mutapa's capital"] },
  { item: 'Shewstones', homelands: ['Mutapa and the Indian Ocean'], because: ["Mutapa's are platinum ore"] },
  { item: 'Lahore Astrolabe', homelands: ['India'], because: ['Lahore'] },
  { item: 'Basalt of Nan Madol', homelands: ['Oceania'], because: ['Nan Madol'] },
];

// What an item costs where it's bought, where the books price it by
// distance: the price as written (the price in `home`), times so many in each
// place they name. A place with no number (`times: null`) is the buyer's
// price, in the books' `words`. `homelands` are the regions a place lies in:
// a character buys in its homeland's one place by default, chooses where a
// homeland holds several (East and Southeast Asia: a Road port, China,
// Japan), and finds no price where the books name none. Mutapa's own Swahili
// ports are Road ports by the books' logic, but they name only the capital.
export const PRICES = [
  {
    item: 'Mutapan Curiosities',
    home: "Mutapa's capital",
    places: [
      { place: "Mutapa's capital", homelands: ['Mutapa and the Indian Ocean'], times: 1, because: ["Prices are for Mutapa's capital"] },
      { place: 'a Monsoon Road port, such as Surat, Malacca or Aceh', homelands: ['India', 'East and Southeast Asia'], times: 5, because: ['five times as much in a Monsoon Road port', 'Malacca and Aceh are on the Road in all but name', 'reach Surat on the Monsoon Road'] },
      { place: 'Europe', homelands: ['Europe'], times: 10, because: ['ten times as much in Europe, China or the Americas'] },
      { place: 'China', homelands: ['East and Southeast Asia'], times: 10, because: ['ten times as much in Europe, China or the Americas'] },
      { place: 'the Americas', homelands: ['The Americas'], times: 10, because: ['ten times as much in Europe, China or the Americas'] },
      { place: 'Japan, at Nagasaki', homelands: ['East and Southeast Asia'], times: null, words: 'whatever the buyer will bear', because: ['whatever the buyer will bear at a court, or in Japan', 'the only ships let in are the Dutch and Chinese at Nagasaki'] },
      { place: 'a court', homelands: [], times: null, words: 'whatever the buyer will bear', because: ['whatever the buyer will bear at a court'] },
    ],
  },
];

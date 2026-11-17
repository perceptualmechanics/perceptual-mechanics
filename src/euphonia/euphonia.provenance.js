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
  { item: 'Talismanic Shirt', homelands: ['The Ottomans, Persia and the Horn', 'India'], because: ['Ottoman princes and generals wore them into battle, and so did the Mughal and Deccan courts'] },
];

// Where an item is at home, so a character from there finds it first.
export const FROM = [
  { item: "Court Astrologer's Astrolabe", homelands: ['The Ottomans, Persia and the Horn'], because: ['Court astrologers from Istanbul to Isfahan'] },
  { item: 'Inoculation Lancet', homelands: ['India', 'The Ottomans, Persia and the Horn', 'West and Central Africa', 'East and Southeast Asia'], because: ['Healers in Bengal, the Caucasus and North and West Africa already do this', 'Chinese physicians give the same protection'] },
  { item: 'Mutapan Curiosities', homelands: ['Mutapa and the Indian Ocean'], because: ["Prices are for Sofala, where they're made"] },
  { item: 'Shewstones', homelands: ['Mutapa and the Indian Ocean'], because: ["it arrives as a gift from Mutapa's king"] },
  { item: 'Lahore Astrolabe', homelands: ['India'], because: ['Lahore'] },
  { item: "Keeper's Basalt", homelands: ['Oceania'], because: ['Nan Madol'] },
];

// What an item costs where it's bought, where the books price it by
// distance: the price as written (the price in `home`), times so many in each
// place they name. A place with no number (`times: null`) is the buyer's
// price, in the books' `words`. `homelands` are the regions a place lies in:
// a character buys in its homeland's one place by default, chooses where a
// homeland holds several (Mutapa and the Indian Ocean: Sofala and the
// Swahili coast; East and Southeast Asia: Malacca or Aceh, China, Japan), and
// finds no price where the books name none.
const ROAD = 'five times as much in a Monsoon Road port';
const FAR = 'ten times as much in Europe, China or the Americas';
const BUYER = 'whatever the buyer will bear at a court, or in Japan';
export const PRICES = [
  {
    item: 'Mutapan Curiosities',
    home: 'Sofala',
    places: [
      { place: 'Sofala', homelands: ['Mutapa and the Indian Ocean'], times: 1, because: ["Prices are for Sofala, where they're made"] },
      { place: 'the Swahili coast', homelands: ['Mutapa and the Indian Ocean'], times: 5, because: [ROAD, 'the Swahili coast'] },
      { place: 'Surat', homelands: ['India'], times: 5, because: [ROAD, 'Surat'] },
      { place: 'the Red Sea and Gulf ports', homelands: ['The Ottomans, Persia and the Horn'], times: 5, because: [ROAD, "the Red Sea and Gulf ports where Surat's ships call"] },
      { place: 'Malacca or Aceh', homelands: ['East and Southeast Asia'], times: 5, because: [ROAD, 'Malacca and Aceh, which are on the Road in all but name'] },
      { place: 'Europe', homelands: ['Europe'], times: 10, because: [FAR] },
      { place: 'China', homelands: ['East and Southeast Asia'], times: 10, because: [FAR] },
      { place: 'the Americas', homelands: ['The Americas'], times: 10, because: [FAR] },
      { place: 'Japan, at Nagasaki', homelands: ['East and Southeast Asia'], times: null, words: 'whatever the buyer will bear', because: [BUYER, 'the only ships let in are the Dutch and Chinese at Nagasaki'] },
      { place: 'a court', homelands: [], times: null, words: 'whatever the buyer will bear', because: [BUYER] },
    ],
  },
];

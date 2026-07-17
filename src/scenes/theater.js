// ─── The Theater ───────────────────────────────────────────────────────────
// A little rep cinema playing scenes from three of Scott's scripts: Truth
// and Beauty (2001), Paul Revere (c. 2009), and now You've Got a Friend in
// Satan (1996) — Scott's first play, not a screenplay, but it slots into
// this same movie-theater conceit without much friction. All dialogue is
// verbatim. The Truth and Beauty scenes were checked line-by-line against
// the authoritative script PDF Scott provided directly (no discrepancies
// found — the earlier extraction was already accurate). The Paul Revere
// scenes come from a scanned/image-only PDF with no text layer, OCR'd page
// by page; the two scenes below were spot-checked and cleaned of OCR noise,
// but Paul Revere hasn't been cross-checked against a second authoritative
// source the way Truth and Beauty has. You've Got a Friend in Satan is the
// same situation as Paul Revere — scanned, OCR'd, spot-checked (title page,
// cast page, and closing page all confirmed word-for-word against the
// source images) — but not cross-checked against a second source. The eight
// scenes below are a curated selection, not the whole play; the complete,
// unabridged script (all ~40 pages) lives as its own Word document.
//
// The reel is reshuffled every time you walk in — a different program each
// visit, like a real repertory house — and it starts playing immediately,
// no title card, as if you'd slipped into your seat just after the credits.
//
// No canvas, no WebGL, no images — everything is monospace text: a cowsay-
// style speech bubble, tiny 3-line stick figures, and a theater built out of
// curtain glyphs and CSS for the parts (the audience silhouette overlaying
// the bottom of the screen, MST3K-style, the marquee-bulb frame) where
// actual pixels are more honest than trying to fake them in text.

const CHARACTERS = {
  // Truth and Beauty
  brian:     { name: 'Brian',     color: '#1d4e89' },
  paul:      { name: 'Paul',      color: '#1f7a4d' },
  sarah:     { name: 'Sarah',     color: '#6b3fa0' },
  kirstin:   { name: 'Kirstin',   color: '#b8341f', tag: 'cello' },
  emma:      { name: 'Emma',      color: '#0f8a7a' },
  bjorn:     { name: 'Bjorn',     color: '#4f7a8c', tag: 'violin' },
  sadler:    { name: 'Sadler',    color: '#c2650f', tag: 'wheelchair' },
  gregg:     { name: 'Gregg',     color: '#946b2d' },
  amber:     { name: 'Amber',     color: '#c23b7a' },
  messenger: { name: 'Messenger', color: '#7a6a4f', tag: 'winged sneakers' },
  // Paul Revere
  tourpaul:  { name: 'Paul',      color: '#8a5a2e', tag: 'tri-corner hat' },
  alex:      { name: 'Alex',      color: '#3d6fa5' },
  john:      { name: 'John',      color: '#3fa66e' },
  heather:   { name: 'Heather',   color: '#d1637a' },
  rebecca:   { name: 'Rebecca',   color: '#8a4fae' },
  jeff:      { name: 'Jeff',      color: '#4a4a4a', tag: 'goth' },
  susan:     { name: 'Susan',     color: '#7a2f4a', tag: 'goth' },
  // You've Got a Friend in Satan
  horace:      { name: 'Horace',      color: '#9c4a2e', tag: 'wrinkled tie' },
  art:         { name: 'Art',         color: '#b8923a', tag: 'chicken salad' },
  satanvoice:  { name: 'Voice of Satan', color: '#5c1a1a', tag: 'unseen, booming' },
  satan:       { name: 'Satan',       color: '#c9a227', tag: 'briefcase' },
  katie:       { name: 'Katie',       color: '#5c7a3a' },
  todd:        { name: 'Todd',        color: '#c26b5c' },
  aaron:       { name: 'Aaron',       color: '#3a5a7a' },
  traci:       { name: 'Traci',       color: '#a377b0' },
  thewoman:    { name: 'The Woman',   color: '#8a1a5c', tag: 'negligee' },
};

const POSES = {
  idle:     ['  O  ', ' /|\\ ', ' / \\ '],
  wave:     ['  O\\ ', ' /|  ', ' / \\ '],
  point:    ['  O  ', ' /|_ ', ' / \\ '],
  shrug:    [' \\O/ ', '  |  ', ' / \\ '],
  openarms: [' \\O/ ', '  |  ', ' / \\ '],
  facepalm: ['  O) ', ' /|  ', ' / \\ '],
  sheepish: ['  o  ', ' /|\\ ', ' / \\ '],
  heart:    [' O<3 ', ' /|\\ ', ' / \\ '],
  lean:     ['   O ', '  /|\\', '  / \\'],
};

// ─── The reel ──────────────────────────────────────────────────────────────
const SCENES = [
  {
    slug: 'INT. MERCURY BAR. NIGHT.',
    order: ['brian', 'paul'],
    beats: [
      { a: 'Brian and Paul nurse pints of beer at the bar.' },
      { c: 'brian', t: 'Ingrid Bergman.' },
      { c: 'paul', t: 'Rita Hayworth.' },
      { c: 'brian', t: 'Greta Garbo.' },
      { c: 'paul', t: 'Marlene Dietrich.' },
      { c: 'brian', t: 'Not so much.', g: 'shrug' },
      { c: 'paul', t: 'Oh, come on — The Blue Angel? All the von Sternberg films? You’ve gotta be kidding.', g: 'point' },
      { c: 'brian', t: 'Strange German women don’t sit well with me.' },
      { c: 'paul', t: '“Strange German” is redundant. I think it’s because you’re afraid of being dominated by a strong woman.' },
      { c: 'brian', t: 'Whatever. I just don’t like naked will-to-power types.' },
      { c: 'paul', t: 'Oh, for God’s sake.' },
      { c: 'brian', t: 'It’s true, though. Joan Crawford? No. Bette Davis? Nope. You give me Audrey Hepburn, then we’ll talk.' },
      { c: 'paul', t: 'No way. Audrey Hepburn with those big empty doe eyes and her Givenchy dresses? No fucking way.', g: 'point' },
      { c: 'brian', t: 'Breakfast at Tiffany’s!', g: 'openarms' },
      { c: 'paul', t: 'Fuck Breakfast at Tiffany’s! Oh, look at me! I’m Audrey Hepburn! I’m a Mob whore! Aren’t I CUTE? ...She sucks, she sucks, she sucks. There’s only one Hepburn in Hollywood and her first name is Katherine.', g: 'point' },
      { c: 'brian', t: 'Wow, a gay man who likes Katherine Hepburn. I’m shocked you haven’t busted out with Judy Garland yet.', g: 'lean' },
      { c: 'paul', t: 'Kiss my ass.' },
      { c: 'brian', t: 'Katherine Hepburn is sexless. Which is why you like her, because she doesn’t act like a woman.' },
      { c: 'paul', t: 'Like a woman is supposed to. And you have a lot of nerve to talk about Katherine being sexless when you bring up Audrey “Meat Puppet” Hepburn. And where the fuck is Marilyn Monroe?' },
      { c: 'brian', t: 'Too campy. Too exaggerated. I want a woman, not a cartoon. Maybe like Barbara Stanwyck.' },
      { c: 'paul', t: 'You want the impossible is what you want.' },
      { c: 'brian', t: 'There’s gotta be one woman we both agree on. We can bridge this gap.' },
      { c: 'paul', t: 'Always the optimist.' },
      { c: 'brian', t: 'Louise Brooks.', g: 'lean' },
      { c: 'paul', t: 'Damnit.', g: 'facepalm' },
      { a: 'Brian spots someone across the bar — Sarah, fending off a semi-drunk guy. Paul notices he’s lost Brian’s attention.' },
      { c: 'paul', t: 'What?' },
      { c: 'brian', t: 'I must save her.', g: 'point' },
      { c: 'paul', t: 'Save her? Save who?' },
      { c: 'brian', t: 'Her. She’s being attacked by a nimrod.' },
      { a: 'Paul looks. He sees. He sighs.' },
      { c: 'paul', t: 'Breeder-meter on overload.', g: 'shrug' },
      { c: 'brian', t: 'I’ll be back.', g: 'lean' },
      { c: 'paul', t: 'No, you won’t.', g: 'shrug' },
      { a: 'He does. (Sort of.)' },
    ],
  },
  {
    slug: 'INT. SYMPHONY HALL / BACKSTAGE / DRESSING ROOM. NIGHT.',
    order: ['brian', 'emma', 'bjorn'],
    beats: [
      { a: 'Brian and Emma — his ex, still close — take their seats at the symphony. Her boyfriend Bjorn plays violin in the orchestra.' },
      { c: 'emma', t: 'Oh! “Eroica.”' },
      { c: 'brian', t: 'Huh. Beethoven’s 3rd symphony.' },
      { c: 'emma', t: 'It’s one of my favorites.' },
      { c: 'brian', t: 'Is it the one with the chorus?' },
      { c: 'emma', t: 'No, that’s the Ninth. Come on. I played it all the time in the apartment!' },
      { c: 'brian', t: 'Wait — oh yeah! Okay. I remember now. Yeah, that’s cool. I like that one.' },
      { c: 'emma', t: 'I swear, you have the worst memory for things like that.' },
      { c: 'brian', t: 'Well, that’s why I keep you around. To be my music library.', g: 'lean' },
      { c: 'emma', t: 'I’m not talking about music.' },
      { c: 'brian', t: 'Then what are you —' },
      { a: 'The lights go down. A flash of red hair catches Brian’s eye — a cellist near the front of the stage.' },
      { a: 'Backstage after the performance, Emma and Bjorn chat happily. Brian’s attention wanders.' },
      { c: 'emma', t: 'That was such a nice surprise!' },
      { c: 'bjorn', t: 'I knew how much you liked it.' },
      { c: 'brian', t: 'Yeah, it was cool. I liked the part in the middle the best. With the horns and stuff.', g: 'shrug' },
      { c: 'bjorn', t: 'I’m sorry, which part is that?' },
      { c: 'emma', t: 'Stop that.' },
      { a: 'Brian sees the cellist carrying her cello into a dressing room. He wanders off, allegedly for water, and knocks on her door.' },
      { c: 'kirstin', t: 'Just a minute!', voice: true, showOnly: ['brian'] },
      { a: 'He walks in anyway.', showOnly: ['brian', 'kirstin'] },
      { c: 'kirstin', t: 'Hey!', g: 'openarms' },
      { c: 'brian', t: 'Excuse — — me...', g: 'facepalm' },
      { a: '(She is, notably, wearing nothing but a cello.)' },
      { c: 'kirstin', t: 'Didn’t you hear what I said?' },
      { c: 'brian', t: 'I thought you said “Come in.”', g: 'sheepish' },
      { c: 'kirstin', t: 'No. I said, “Just a minute.”' },
      { c: 'brian', t: 'Oh. My bad.', g: 'sheepish' },
      { a: 'The door clicks shut. He doesn’t move for about fifteen seconds.' },
      { c: 'brian', t: 'Oh, to be a cello.', g: 'heart' },
      { a: 'Later, properly dressed, she reappears.' },
      { c: 'kirstin', t: 'You’ve seen quite a bit.', g: 'lean' },
      { c: 'brian', t: 'And yet so little.', g: 'lean' },
      { c: 'kirstin', t: 'How the tide has turned! A moment ago you were ready to throw yourself at my feet.' },
      { c: 'brian', t: 'I still might, if you’re into that.' },
      { c: 'kirstin', t: 'Are you always this —' },
      { c: 'brian', t: 'Forward?' },
      { c: 'kirstin', t: 'Obnoxious.' },
      { c: 'brian', t: 'I’m sorry. I didn’t mean to offend.', g: 'sheepish' },
      { c: 'kirstin', t: 'You shouldn’t give up so easily.' },
      { c: 'brian', t: 'Most women find persistence annoying.' },
      { c: 'kirstin', t: 'Only if it’s overbearing. And if the woman’s not interested.' },
      { c: 'brian', t: 'Are you always this —' },
      { c: 'kirstin', t: 'Forward?' },
      { c: 'brian', t: 'Intriguing.' },
      { c: 'kirstin', t: 'That’s not what you were going to say.' },
      { c: 'brian', t: 'Yes it was.' },
      { c: 'kirstin', t: 'Why don’t I believe you?' },
      { c: 'brian', t: 'Honestly, I meant to say “intriguing.”' },
      { c: 'kirstin', t: 'Honestly? Now I definitely don’t believe you.' },
      { c: 'brian', t: 'That’s my story and I’m sticking by it.' },
      { c: 'kirstin', t: 'We’ll get the truth out of you yet.' },
      { c: 'brian', t: 'I’m Brian.' },
      { c: 'kirstin', t: 'Hello, Brian.' },
      { c: 'brian', t: 'And you are?' },
      { c: 'kirstin', t: 'Waiting for you to ask me what my name is.' },
      { c: 'brian', t: 'What is your name?' },
      { c: 'kirstin', t: 'Kirstin.' },
      { c: 'brian', t: 'Kristin?' },
      { c: 'kirstin', t: 'No, Kirstin.' },
      { c: 'brian', t: 'Sorry.' },
      { c: 'kirstin', t: 'I get it all the time.' },
      { c: 'brian', t: '(in the gutter) Really. ...(recovering) I can see that.', g: 'lean' },
      { c: 'kirstin', t: 'Well, we know where your mind is.' },
      { c: 'brian', t: 'I’m sorry.', g: 'sheepish' },
      { c: 'kirstin', t: 'You’re sorry that you saw me wearing nothing but a cello?' },
      { c: 'brian', t: 'Oh boy.', g: 'facepalm' },
      { c: 'kirstin', t: 'It’s okay. Someday we’ll sit back and laugh about it.' },
      { c: 'brian', t: 'I hope so.' },
      { c: 'brian', t: 'So. Um.' },
      { c: 'kirstin', t: 'Time to go.' },
      { c: 'brian', t: 'It was lovely meeting you.' },
      { c: 'kirstin', t: 'I bet.' },
      { c: 'brian', t: 'Oooookay.' },
      { a: 'Neither of them moves.' },
      { c: 'kirstin', t: 'I’m waiting.' },
      { c: 'brian', t: 'For what?' },
      { c: 'kirstin', t: 'For the inevitable.' },
      { c: 'brian', t: 'What’s that?' },
      { c: 'kirstin', t: 'You were about to do it.' },
      { c: 'brian', t: 'What? What am I about to do?' },
      { a: 'Kirstin just smiles and waits.' },
      { c: 'brian', t: 'Would you like to get together sometime?', g: 'heart' },
      { c: 'kirstin', t: 'What did you have in mind?' },
      { c: 'brian', t: 'Oh, I don’t know. Grab some coffee, talk, discuss your cello. MUSIC. Discuss your music, not your — okay, why don’t I walk away, and we’ll forget this ever happened, and then someday we’ll run into each other on the street and we’ll try again?', g: 'sheepish' },
      { a: 'She smiles, pulls out a pen and paper, writes something down, and hands it to him.' },
      { c: 'brian', t: 'What’s this?' },
      { c: 'kirstin', t: 'My phone number.' },
      { c: 'brian', t: 'Cool. Very cool.' },
      { c: 'kirstin', t: 'And now it’s time to go.' },
      { c: 'brian', t: 'I’ll give you a call.' },
      { c: 'kirstin', t: 'We’ll see. Good night.' },
      { c: 'brian', t: 'Good night.' },
      { a: 'Kirstin walks off. Brian finally relaxes.' },
      { c: 'brian', t: 'Holy shit.', g: 'wave' },
    ],
  },
  {
    slug: 'EXT. COFFEEHOUSE. NIGHT.',
    order: ['brian', 'kirstin'],
    beats: [
      { a: 'A coffeehouse table, outdoors. A waiter brings them coffee and departs.' },
      { c: 'kirstin', t: 'Thank god it’s not folk music. I couldn’t stand the thought of some tank-top clad dyke harpy wailing about her labia.' },
      { c: 'brian', t: 'Holy shit.', g: 'facepalm' },
      { c: 'kirstin', t: 'Am I wrong? It’s totally true. It’s why I hate going for coffee.' },
      { c: 'brian', t: 'You hate going for coffee? Why didn’t you say something?' },
      { c: 'kirstin', t: 'I was going to, but this coffeehouse turned out nice. See, there are only two types of coffeehouses. The first is your Starbucks big chain place that’s sterile and minimum wage and reeks of banality, and then there’s the grungy, hippyesque small time place with dyke harpies and the overwhelming stench of patchouli and hoi polloi soi-disant grade school political bullshit. And yet, you’ve managed to find a third type, neither sterile nor stinky.' },
      { c: 'brian', t: 'I’m all about the middle path.', g: 'lean' },
      { c: 'kirstin', t: 'Funny.' },
      { c: 'brian', t: 'Thanks. I try.', g: 'sheepish' },
      { c: 'kirstin', t: 'No, really, it’s cute. Chicks dig that. Cosmo wasn’t lying, you know.' },
      { c: 'brian', t: 'Oh, good. I thought it was a conspiracy to give us funny guys false hope.', g: 'shrug' },
      { c: 'kirstin', t: 'Ever do comedy?' },
      { c: 'brian', t: 'Every day of my life.' },
      { c: 'kirstin', t: 'Why aren’t you acting full-time?' },
      { c: 'brian', t: 'Isn’t that a little direct?' },
      { c: 'kirstin', t: 'Yes. ...You don’t have to answer.' },
      { c: 'brian', t: 'No, it’s all right.' },
      { c: 'kirstin', t: 'No, I mean that I already know.' },
      { c: 'brian', t: 'Oh, really?' },
      { c: 'kirstin', t: 'Yes. It’s scary to embrace something you love. Because love is lack of control, being at the mercy of something else. It’s very disconcerting.' },
      { c: 'brian', t: 'You speak from experience.' },
      { c: 'kirstin', t: 'I do what I love every day of my life. Sometimes it’s totally brilliant and I know I could conquer the world. Other times the music slaps me around like I’m Tina Turner.' },
      { c: 'brian', t: '(in an Ike Turner voice) Baby, why you gotta make me hit you?', g: 'point' },
      { c: 'kirstin', t: '(laughing) Exactly!' },
      { c: 'brian', t: 'I’m glad you appreciate domestic violence humor.', g: 'shrug' },
      { c: 'kirstin', t: 'See? You’re funny! Wife beating equals funny!' },
      { c: 'brian', t: 'That’s my theory.', g: 'lean' },
      { c: 'kirstin', t: 'Nice. So tell me something interesting about yourself.' },
      { c: 'brian', t: 'Something interesting about myself...hmmm...how interesting do you mean?' },
      { c: 'kirstin', t: 'No skeletons, please. Appropriate first date revelations.' },
      { c: 'brian', t: 'Damn.' },
      { c: 'brian', t: 'I can tie a cherry stem in a knot with my tongue.', g: 'lean' },
      { c: 'kirstin', t: 'No you can’t. You’re lying. You’re a fucking liar. No guy on this planet has ever been able to do that.', g: 'point' },
      { c: 'brian', t: 'I can! It’s true. I’m the Cherry Master.', g: 'openarms' },
      { c: 'kirstin', t: 'I don’t believe it.' },
      { c: 'brian', t: 'Do you have a cherry?' },
      { c: 'kirstin', t: 'Yes, I keep a cherry on me at all times.' },
      { c: 'brian', t: 'Fine, then, you’ll just have to believe me.', g: 'shrug' },
      { c: 'kirstin', t: 'We’ll see. Liar.' },
      { c: 'brian', t: 'So?' },
      { c: 'kirstin', t: 'Yes?' },
      { c: 'brian', t: 'Something interesting about you?' },
      { c: 'kirstin', t: 'Are you sure?' },
      { c: 'brian', t: 'As long as it’s not disgusting.' },
      { c: 'kirstin', t: 'Hmmm.' },
      { a: 'Brian sips his coffee.' },
      { c: 'kirstin', t: 'I’m celibate.' },
      { a: 'Brian nearly kills himself with the coffee.' },
      { c: 'kirstin', t: 'Are you okay?' },
      { c: 'brian', t: '(sputtering) Wh — ow, god...', g: 'facepalm' },
      { c: 'kirstin', t: 'Do you need some help or something?' },
      { c: 'brian', t: 'No, just fine! Yes. Yes. Just a bit surprised, that’s all.', g: 'sheepish' },
      { c: 'kirstin', t: 'As long as you’re not burnt or anything.' },
      { c: 'brian', t: 'Oh, no, I’m fine. Fine. Yes. Hmmm. Very interesting revelation.', g: 'sheepish' },
      { c: 'brian', t: 'So when you say...“celibate,” just...just what, exactly...what do you...what does that mean?' },
      { c: 'kirstin', t: 'It means no sexual contact of any kind.' },
      { c: 'brian', t: 'Ah. Yes. Of course. That’s — that’s very interesting.', g: 'sheepish' },
      { c: 'kirstin', t: 'Not really.' },
      { c: 'brian', t: 'None at all?' },
      { c: 'kirstin', t: 'None.' },
      { c: 'brian', t: 'So, what defines sexual contact?' },
      { c: 'kirstin', t: 'Kissing, on down the line.' },
      { c: 'brian', t: 'Kissing’s not sexual.' },
      { c: 'kirstin', t: 'Excuse me? How do you kiss someone?' },
      { c: 'brian', t: 'No — I mean, it’s — it’s — it’s sensual.' },
      { c: 'kirstin', t: 'That’s the same thing.' },
      { c: 'brian', t: 'No, there’s a subtle difference.' },
      { c: 'kirstin', t: 'Semantics. Splitting hairs. Grasping at straws.' },
      { c: 'brian', t: 'No kissing?' },
      { c: 'kirstin', t: 'None whatsoever.' },
      { c: 'brian', t: 'Okay.' },
      { c: 'kirstin', t: 'Do you want to leave?' },
      { c: 'brian', t: 'What?' },
      { c: 'kirstin', t: 'I’m giving you an out, no hard feelings, no strings attached. Do you want to leave?' },
      { c: 'brian', t: 'No! No, of course not.', g: 'openarms' },
      { c: 'kirstin', t: 'A lot of guys would want to leave.' },
      { c: 'brian', t: 'Well, I’m not a guy.', g: 'shrug' },
      { a: 'Kirstin raises an eyebrow.' },
      { c: 'brian', t: 'I mean, I’m not like most guys! Not like! Yes...uh...no. No, I do not want to leave.', g: 'sheepish' },
      { c: 'kirstin', t: 'Really?' },
      { c: 'brian', t: 'Yes, really.' },
      { c: 'kirstin', t: 'Okay, then.' },
      { c: 'brian', t: 'Okay.' },
      { c: 'kirstin', t: 'We’ll have to talk about something other than my celibacy.' },
      { c: 'brian', t: 'We’ll get there. Eventually.', g: 'lean' },
      { a: 'Kirstin smirks.' },
    ],
  },
  {
    slug: 'INT. CANDY FACTORY. DAY. (A MOVIE SET.)',
    order: ['brian', 'sadler', 'gregg', 'amber'],
    beats: [
      { a: 'On the set of Sadler’s ultra-low-budget epic, “Fluff You Up.” Brian, in Edwardian costume and a fake moustache, sits between two vats. Sadler, Zen and scruffy, holds court from a chrome wheelchair.' },
      { c: 'gregg', t: 'We’re going to have problems with his glasses.', g: 'shrug' },
      { c: 'sadler', t: 'What...sort of problem?' },
      { c: 'gregg', t: 'The lights are going to glare off them too much. We won’t see his eyes.' },
      { c: 'sadler', t: 'Get some water. Take the lenses out of the glasses. We’ll just use those for close-ups. How is my star doing?' },
      { c: 'brian', t: 'The moustache tickles.', g: 'shrug' },
      { c: 'sadler', t: 'Well, what can I tell you? Archibald Query was a mustachioed gentleman. Some say that it was his moustache that granted him not only his insatiable lust, but also the exact recipe for marshmallow fluff.' },
      { c: 'brian', t: 'Do they say that the inventor of marshmallow fluff was a gigolo?', g: 'lean' },
      { c: 'sadler', t: 'A gigolo? A GIGOLO?', g: 'point' },
      { a: 'Sadler bolts up out of the wheelchair.' },
      { c: 'sadler', t: 'Only an unenlightened mind would claim that Archibald Query’s legendary prowess with the ladies was motivated by money! He was fucking AMAZING at amazingly fucking! You cannot separate the fluff from the muff! THIS is who you are portraying, Brian — this Titan, this STUD in the purest sense.', g: 'openarms' },
      { c: 'brian', t: 'How do you all know this?' },
      { c: 'sadler', t: 'Ouija board.', g: 'shrug' },
      { c: 'brian', t: 'Right.' },
      { a: 'Amber arrives on set — bleached blonde, and, per the screenplay, “quite frankly, stunning.”' },
      { c: 'sadler', t: 'And THERE SHE IS! Mrs. Archibald Query!', g: 'openarms' },
      { c: 'amber', t: 'Hi, Sadler!' },
      { c: 'sadler', t: 'Hello, mamasita. Amber, I want you to meet Brian. He’s your co-star.' },
      { c: 'amber', t: 'Archibald Query?' },
      { c: 'brian', t: 'The same. A pleasure to meet you, Amber.', g: 'lean' },
      { c: 'amber', t: 'Nice to meet you too!' },
      { c: 'sadler', t: 'Get acquaintanted, I have to pee.', g: 'shrug' },
      { a: 'He ambles off.' },
      { c: 'brian', t: 'So, what other work have you done?' },
      { c: 'amber', t: 'Oh, this is only my second movie.' },
      { c: 'brian', t: 'What else were you in?' },
      { c: 'amber', t: 'It was Sadler’s first movie. Boston Sex Party.' },
      { c: 'brian', t: 'Holy shit. You were in Boston Sex Party?', g: 'facepalm' },
      { c: 'amber', t: 'Yeah! It was sooo crazy.' },
      { c: 'brian', t: 'How’d you end up in that?' },
      { c: 'amber', t: 'I mentioned that I danced at the Foxy Lady, and he starts telling me about this crazy movie he’s doing, and it sounded wild, so I said, Sure! I played the part of Amber.' },
      { c: 'brian', t: 'Must have been easy to stay in character, then.', g: 'lean' },
      { c: 'amber', t: 'What? ...Oh! Because her name was Amber, and my name — right. I can be such a blonde sometimes, I swear!' },
      { c: 'brian', t: 'And it’s self-inflicted, too.', g: 'shrug' },
      { a: 'His cellphone rings. He answers without looking.' },
      { c: 'brian', t: 'Hello?' },
      { c: 'sarah', t: 'Hello, someone just called me from this number.', voice: true },
      { c: 'brian', t: 'Sarah?' },
      { c: 'sarah', t: 'Yes?', voice: true },
      { a: 'Brian quickly moves away from Amber.' },
      { c: 'brian', t: 'Sarah, it’s Brian. Brian Sharp.', g: 'sheepish' },
      { c: 'sarah', t: 'Oh, Brian! Hi! How are you?', voice: true },
      { c: 'brian', t: 'Fine! Fine! I’m sorry, I — I’m so sorry, but I’m on set right now and I meant to dial another actor, but I called your number instead. I’m sorry.', g: 'sheepish' },
      { c: 'sarah', t: 'That’s okay. Call me back later?', voice: true },
      { c: 'brian', t: 'Sure. Hey, do you have AIM?' },
      { c: 'sarah', t: 'Yeah.', voice: true },
      { c: 'brian', t: 'Look for me on there. My name’s “bsharp.” I’m online a lot.' },
      { c: 'sarah', t: 'Boring day job, huh?', voice: true },
      { c: 'brian', t: 'Something like that.', g: 'shrug' },
      { c: 'sadler', t: 'Places, people! Places!' },
      { c: 'brian', t: 'I gotta go. Call you later?' },
      { c: 'sarah', t: 'Sure!', voice: true },
      { c: 'brian', t: 'Okay. Bye.' },
      { a: 'He hangs up, looking relieved.' },
      { c: 'amber', t: 'Who was that?' },
      { c: 'brian', t: 'Oh, just a friend.', g: 'sheepish' },
      { a: 'A production assistant hands Sadler a jar of fluff with a large plastic spoon.' },
      { c: 'sadler', t: 'All right! Let’s shoot this fucker!', g: 'openarms' },
      { c: 'brian', t: 'What are you doing?' },
      { c: 'sadler', t: 'Channeling.' },
      { a: 'He swallows a huge spoonful of fluff.' },
      { c: 'brian', t: 'Oh God!', g: 'facepalm' },
      { c: 'sadler', t: 'Yyyyyyyyyyyyyyyyyyeah.' },
      { c: 'brian', t: 'That’s disgusting!', g: 'facepalm' },
      { c: 'sadler', t: 'I started last night. I am going to eat nothing but fluff until this movie is completed. To honor our subject, the very brilliant and very sexy Archibald Query.', g: 'point' },
      { c: 'brian', t: 'You’re gonna go into a sugar coma.' },
      { c: 'sadler', t: 'Who’s the director here, talent? Don’t make me go Herzog on your ass! Roll camera! Roll sound!', g: 'point' },
      { a: '“Fluff You Up, scene 5, take 1.” ...And — ACTION!' },
      { c: 'brian', t: 'Ahh, yes, you must be the new assistant. Welcome to my laboratory. I am the head scientist here, Archibald Query. And what might your name be?', g: 'lean' },
      { c: 'amber', t: 'Amber, sir.' },
      { c: 'brian', t: 'Amber, is it? Excellent. I hear tell you are an up-and-coming food scientist yourself.', g: 'lean' },
      { c: 'amber', t: 'Oh, thank you, sir. But it’s such an honor to be working with you. Your reputation is legendary, and not just in Lynn!' },
      { c: 'brian', t: 'Notorious, you mean. I know how they disapprove of my methods. They think me a madman, wild, sinful. Don’t they know that the basis of both candy and lust is the same? Passion?', g: 'heart' },
      { c: 'amber', t: 'I know, sir. I know what kind of passion drives a man like you to create such wonderful treats. You just want to share that passion with the rest of the world. But they don’t want people to know that kind of joy. They want to restrain it. But you can’t restrain yourself, sir.' },
      { c: 'brian', t: 'How right you are.', g: 'heart' },
    ],
  },
  {
    slug: 'INT. MERCURY BAR. NIGHT. (LATER.)',
    order: ['brian', 'paul', 'sarah'],
    beats: [
      { a: 'Weeks later, same bar. Paul and Brian, mid-conversation.' },
      { c: 'paul', t: 'So are you going to tell me what happened?' },
      { c: 'brian', t: 'Nope.' },
      { c: 'paul', t: 'Why not?' },
      { c: 'brian', t: 'You’d never believe it.' },
      { c: 'paul', t: 'Oh, come on —' },
      { c: 'brian', t: 'Besides, I don’t think I can explain it.' },
      { c: 'paul', t: 'Oh, fine. I know anyway.' },
      { c: 'brian', t: 'What? No, you don’t.' },
      { c: 'paul', t: 'I do.' },
      { c: 'brian', t: 'How?' },
      { c: 'paul', t: 'Gay men have a particular insight into this sort of thing.' },
      { c: 'brian', t: 'You can’t use your homosexuality as a reason for universal knowledge.', g: 'shrug' },
      { c: 'paul', t: 'Why not? We’re much smarter than you straight boys. Deal with it.' },
      { c: 'brian', t: 'I’ve known plenty of dumb fags in my lifetime.' },
      { c: 'paul', t: 'Yeah, but they’re smart where it counts.' },
      { a: 'Sarah has just entered the bar. She sees Brian and stiffens.' },
      { c: 'paul', t: 'Hey, don’t you know her?' },
      { a: 'Brian puts out his cigarette and walks over.' },
      { c: 'brian', t: 'Hi.' },
      { c: 'sarah', t: 'Hello.', g: 'point' },
      { c: 'brian', t: 'How are you?' },
      { c: 'sarah', t: 'Fine. You?' },
      { c: 'brian', t: 'Fine.' },
      { c: 'brian', t: 'Sarah, I’m sorry.' },
      { c: 'sarah', t: '(simultaneously) You’re an asshole.', g: 'point' },
      { c: 'brian', t: 'As long as we’re both agreed.', g: 'shrug' },
      { c: 'sarah', t: 'I don’t just sleep with anyone, you know. It was my choice to go to your place. And I wasn’t looking for a one night stand, but the least you could have done was be honest with me instead of stringing me along. I’m a big girl. I don’t have time for these kinds of games.', g: 'point' },
      { c: 'brian', t: 'You’re right. You’re absolutely right. It was unfair. But I didn’t know what I wanted. Or needed, for that matter.', g: 'heart' },
      { c: 'sarah', t: 'You could have told me that.' },
      { c: 'brian', t: 'I didn’t know that until very recently. But I’m still sorry, and you didn’t deserve that.', g: 'heart' },
      { c: 'brian', t: 'How’s the painting?' },
      { c: 'sarah', t: 'Fine, it’s going fine — hey, how did you know I was painting again?' },
      { c: 'brian', t: 'When did you start?' },
      { c: 'sarah', t: 'The day after we hooked up.' },
      { a: 'Brian can’t help but laugh to himself.' },
      { c: 'brian', t: 'Would you like to go on a date?', g: 'heart' },
      { c: 'sarah', t: 'Are you serious?' },
      { c: 'brian', t: 'Yes. An honest-to-God, let’s-get-to-know-one-another no-expectations date. Because we might work well together, and I’d be stupid not to see.', g: 'openarms' },
      { c: 'sarah', t: 'I don’t know. I’ll have to think about it. You burned me once before.' },
      { c: 'brian', t: 'This time I won’t.' },
      { c: 'sarah', t: 'Maybe.' },
      { c: 'brian', t: 'Maybe?' },
      { c: 'sarah', t: 'Maybe.', g: 'lean' },
    ],
  },
  {
    slug: 'INT. MOVIE THEATER, THEN RESTAURANT. NIGHT.',
    order: ['brian', 'sadler', 'emma', 'paul', 'sarah', 'amber'],
    beats: [
      { a: 'Archibald Query premieres. “THE END” hits the screen. On screen, Brian’s Archibald Query finishes his closing monologue:' },
      { c: 'brian', t: 'And here we are, at the end of this, our long struggle. How often have our vexed endeavors ended in nothing but foulness, wasted ingredients poured down the drain. But every once in a while, it all falls together perfectly. They say that genius is 1% inspiration, 99% perspiration. Well, I don’t know about their math...but there’s a whole lot of sweat in this jar.', g: 'openarms' },
      { a: 'The house comes down. Sadler, in a powder-blue tuxedo, takes a bow and waves Brian up. Thunderous applause. Later, a crowded restaurant table.' },
      { c: 'sadler', t: 'Oh god. Protein. Fucking protein. Waiter! Waiter! Bring me a carafe of orange juice! Oh my god, sweet meat. Vegetables! Holy crap.', g: 'openarms' },
      { a: '“Would you like to see the dessert menu?”' },
      { c: 'sadler', t: 'Fuck you. Bring me some lamb. Oh my God.', g: 'point' },
      { c: 'paul', t: 'I can’t believe I just saw that on screen. That was fucked up beyond belief. Sadler’s either a genius or he should be locked up.', g: 'shrug' },
      { c: 'emma', t: 'And you — you were fucking incredible.', g: 'heart' },
      { c: 'brian', t: 'Oh, stop.', g: 'sheepish' },
      { c: 'amber', t: 'No, you were.' },
      { c: 'brian', t: 'No, what about you? What about —' },
      { c: 'amber', t: 'Oh, please. I was all right, but you stole the show.' },
      { c: 'brian', t: 'Now I’m embarrassed.', g: 'sheepish' },
      { c: 'sarah', t: 'Why?' },
      { c: 'brian', t: 'Because I’m supposed to be.', g: 'lean' },
      { c: 'emma', t: 'Hey. I’m really proud of you. About everything.', g: 'heart' },
      { c: 'brian', t: 'I couldn’t have done it without you.', g: 'heart' },
      { a: 'A hostess approaches: “There’s a messenger at the front for you.”' },
      { c: 'brian', t: 'If you all got me a strip-o-gram, I’ll kill you.', g: 'point' },
      { a: 'At the door, a bicycle messenger waits, impatient.', showOnly: ['brian', 'messenger'] },
      { c: 'brian', t: 'Hi, I’m Brian Sharp.' },
      { c: 'messenger', t: 'Yep. Got a letter for you, special delivery. Sign here, please.' },
      { a: 'Brian signs. The envelope slips out of his fingers.' },
      { c: 'brian', t: 'Whoops!', g: 'sheepish' },
      { a: 'As he picks it up, he notices the messenger’s sneakers have wings painted on the heels.' },
      { c: 'messenger', t: 'Have a good night.' },
      { a: 'The messenger runs out. The envelope is cream-colored, Brian’s name in script, a treble staff on the back flap.' },
      { a: 'Inside, in delicate script: “Brian — My older sister told me that there’s a new production of A Midsummer Night’s Dream getting ready. I think you’d make the perfect Lysander. — K. P.S. Congratulations!”' },
      { c: 'brian', t: '(smiles)', g: 'heart', silent: true },
      { a: 'He watches a blinking taillight disappear around a corner, then turns back toward the table.' },
    ],
  },
  {
    slug: 'EXT. DUCK TOUR VEHICLE. DAY.',
    order: ['tourpaul'],
    beats: [
      { a: 'Tourists, self-conscious and embarrassed, sit in an amphibious Day-Glo pink tour boat. Paul, 64, grizzled, in a tri-corner hat and a Santa jacket, has the mike and a very thick Boston accent.' },
      { c: 'tourpaul', t: 'Welcome to Boston Duck Tours. My name is Paul, and I’m your tour guide. Just so you know something about me, I wasn’t always in the tour guide business. I was born and raised in Worcester, was in the Navy for six years, served honorably, fought in Korea, I was decorated, but then I got laid up, with the clap, and it was a wicked painful thing, but I learned a lot about myself, so it all turned out good. So after my discharge, I came back home to Boston, and I started the Duck Tours. A lotta people ask me why I still drive on ’em, and that’s because Boston is the greatest city in the world.', g: 'openarms' },
      { a: 'The tourists are more than a bit uncomfortable by Paul’s biography.' },
      { c: 'tourpaul', t: 'So don’t you worry, folks, I’m the best tour guide in town. I know this city better than I know my own navel. Every nook, every cranny, every lint-filled part, I got it down pat. I love everything about this city, except the Celtics, who went to hell the instant Bird left, so don’t get me started. A few rules. First off, if we start sinking, there are life vests above you. And don’t panic — I’m a very experienced seaman. Second rule is, we’re an institution here, and people sometimes shout “Quack quack” whenever they see us. So if anyone says “Quack quack,” you guys gotta shout “Quack quack.” Okay? Let’s give it a try. Quack quack!', g: 'point' },
      { a: 'The tourists say “Quack quack” like a bunch of embarrassed tourists.' },
      { c: 'tourpaul', t: 'Oh, I know we can do better than that. Let’s try it again. Quack quack!', g: 'lean' },
      { a: 'The tourists say “Quack quack” with more enthusiasm but plenty of embarrassment.' },
      { c: 'tourpaul', t: 'All right, that’s better. Is everyone ready for an adventure?', g: 'shrug' },
      { a: 'The tourists respond, “Yes.”' },
      { c: 'tourpaul', t: 'Wicked. All right!', g: 'wave' },
    ],
  },
  {
    slug: 'INT. THE DEN, HALLWAY & LIVING ROOM. NIGHT.',
    order: ['alex', 'john', 'heather', 'rebecca', 'jeff', 'susan'],
    beats: [
      { a: 'Alex and Rebecca, wrapped in sheets, head for the kitchen for water. John’s door opens — John and Heather, also sheet-wrapped, nearly collide with them.' },
      { c: 'john', t: 'Whoa!' },
      { c: 'alex', t: 'Jesus!', g: 'facepalm' },
      { c: 'heather', t: 'Oh my!' },
      { c: 'rebecca', t: 'Well, this is different.', g: 'lean' },
      { c: 'alex', t: 'What are you doing?' },
      { c: 'john', t: 'Getting water. What are you doing?' },
      { c: 'alex', t: 'Getting water.' },
      { c: 'john', t: 'Well. Well. We can get water together.', g: 'shrug' },
      { c: 'alex', t: 'Sure.' },
      { a: 'The four of them head into the living room — and find Jeff and Susan asleep on the pull-out couch, sharing one sheet.' },
      { c: 'john', t: 'Whoa!' },
      { c: 'alex', t: 'Jesus!', g: 'facepalm' },
      { c: 'heather', t: 'Oh my!' },
      { c: 'rebecca', t: 'Yeah, this is different.' },
      { a: 'Jeff and Susan start to wake up.' },
      { c: 'alex', t: 'Why is there a naked Goth couple on our couch bed?' },
      { c: 'john', t: 'Well, they had a bit too much to drink, so I told them to make themselves at home.', g: 'shrug' },
      { c: 'heather', t: 'And they took you at your word.' },
      { c: 'jeff', t: 'Huh...hey. Hey, guys. Honey, look. It’s Heather and John and Alex and Rebecca.' },
      { c: 'susan', t: 'Why are they all wearing sheets?' },
      { c: 'rebecca', t: 'We’re getting water.' },
      { c: 'jeff', t: 'Water! Great idea.', g: 'openarms' },
      { c: 'alex', t: 'I’ll get it. You stay in bed, dear.', g: 'lean' },
      { a: 'Alex returns with a pitcher and six cups, pours for everyone, and sits next to Rebecca.' },
      { c: 'jeff', t: 'Hey. Is everybody naked?' },
      { c: 'john', t: 'It certainly appears that way.', g: 'shrug' },
      { c: 'susan', t: 'Ooh! Orgy!' },
      { c: 'heather', t: 'I don’t think so! I mean, I love you guys, but...' },
      { c: 'john', t: 'Wait one cotton-picking minute. Why the hell are you two naked?', g: 'point' },
      { c: 'alex', t: 'Well, you see, John, when a man loves a woman, they lie down naked next to each other —', g: 'lean' },
      { c: 'susan', t: 'You...?' },
      { c: 'alex', t: '(a bit embarrassed) Yes.', g: 'sheepish' },
      { c: 'jeff', t: 'Guh...gu-gu-gu...', g: 'facepalm' },
      { c: 'heather', t: 'So I guess...I guess it’s official.' },
      { c: 'susan', t: 'Oh my god.' },
      { c: 'jeff', t: 'Gu-gu-gu...' },
      { c: 'john', t: 'This is weird.' },
      { c: 'alex', t: 'I know. Freaky, isn’t it?', g: 'shrug' },
      { c: 'jeff', t: 'Gu-gu-gu...' },
      { c: 'rebecca', t: 'Get a pencil under his tongue.' },
      { c: 'heather', t: 'Freaky doesn’t even begin to describe it.' },
      { c: 'rebecca', t: 'What do you mean?' },
      { c: 'jeff', t: 'You and her. Having sex. Hello???', g: 'point' },
      { c: 'alex', t: 'Stranger things have happened.' },
      { c: 'jeff', t: 'Like what?' },
      { c: 'alex', t: 'Um...Cannonball Run.', g: 'sheepish' },
      { c: 'john', t: 'He’s got a point, Jeff.' },
      { c: 'heather', t: 'Okay, listen — are you two happy?' },
      { c: 'rebecca', t: 'Yes. Very.' },
      { c: 'heather', t: 'Fine. End of discussion.' },
      { a: 'Pause. There’s a lack of anything to be said.' },
      { c: 'john', t: 'You ever brush your dog’s teeth?' },
      { a: 'Everyone looks at John.' },
      { c: 'alex', t: 'Where the hell did that come from?', g: 'shrug' },
      { c: 'john', t: 'I dunno. It just popped in my head.' },
      { c: 'heather', t: 'I never had a dog. Dogs are stupid. Cats rule.' },
      { c: 'jeff', t: 'I had a dog. We called him Satan. I loved that dog. Pain in my ass, and he shit all over the place, but I loved him.' },
      { c: 'alex', t: 'What happened?' },
      { c: 'jeff', t: 'My little brother attached jumper cables to him. I loved that dog.' },
      { a: 'Everyone tries to process this.' },
      { c: 'susan', t: 'What are we going to do with the rest of our lives?' },
      { c: 'heather', t: 'What do you mean?' },
      { c: 'susan', t: 'I mean, what’s going to happen now? After this?' },
      { c: 'jeff', t: 'After what? The orgy?' },
      { c: 'alex', t: 'I plan on going to sleep sometime.', g: 'shrug' },
      { c: 'rebecca', t: 'Who knows? I mean, we make the best of what comes our way. If a bad day comes, you deal. If a good day comes, you live it for all it’s worth.' },
      { c: 'susan', t: 'I don’t think I could face any bad days. Lord knows I’ve had enough of them.' },
      { c: 'alex', t: 'We’ll all become rich and own the world.', g: 'openarms' },
      { c: 'jeff', t: 'I want to be God Emperor of the planet.', g: 'point' },
      { c: 'susan', t: 'And what does that make me?' },
      { c: 'jeff', t: 'Goddess Empress.' },
      { c: 'alex', t: 'I call Towel Boy.', g: 'wave' },
      { c: 'rebecca', t: 'I’ll be the Dominatrix.' },
      { c: 'alex', t: 'Oh, no comment. No comment at all. I bite my fucking tongue.', g: 'sheepish' },
      { c: 'rebecca', t: 'Watch it.' },
      { c: 'john', t: 'Can I be the Bard? You know, tell heroic tales and sing ballads and wear a leather armor and shit. And a codpiece, I’ll need a spectacular codpiece.' },
      { c: 'heather', t: 'What would I be? Oh, I know. Sorceress. Casting love spells on people.', g: 'heart' },
      { c: 'jeff', t: 'That’s fine. As long as I decide who lives and who dies.' },
      { c: 'susan', t: 'Oh, I don’t know...' },
      { c: 'jeff', t: 'Come on! I’d load a leaf blower full of broken razor blades and dispense instant justice on the streets.', g: 'point' },
      { c: 'susan', t: 'My future husband, everybody.' },
      { c: 'john', t: 'You make Sadler look normal.' },
      { c: 'rebecca', t: 'Listen — you have no idea what’s gonna happen tomorrow, so just live in the Now. Eat, drink, schtupp, and have a good time, right?' },
      { c: 'john', t: 'Preach on, sister.' },
      { a: 'Pause.' },
      { c: 'susan', t: 'I wish I could believe that.' },
      { a: 'Everyone laughs, although Susan’s is a tad nervous.' },
    ],
  },
  // ── You've Got a Friend in Satan (1996) ──────────────────────────────────
  {
    slug: 'INT. HELL. HORACE’S DESK.',
    order: ['horace', 'art'],
    beats: [
      { a: 'HORACE, the Assistant Subdaemon in Charge of Soul Collection for the United States, sits at a desk, writing on a huge scroll with a quill. He is a once-handsome man who has had all his attractiveness sucked out of him by his circumstances — wrinkled jacket, an ugly brown-striped tie, slacks too short for him. ART enters, wearing an even uglier tie. He gives off the air of someone you would love to hit.' },
      { c: 'art', t: 'Horace! Pal, buddy, compadre!', g: 'openarms' },
      { c: 'horace', t: 'Hello, Arthur.' },
      { c: 'art', t: 'Say, Horace, is it hot enough for ya?' },
      { a: 'He laughs as if that’s the funniest thing he’s ever heard.' },
      { c: 'art', t: 'Get it? Hot enough! Cause we’re in...', g: 'lean' },
      { a: 'He doubles over laughing.' },
      { c: 'art', t: 'Hot!' },
      { c: 'horace', t: 'Arthur...', g: 'shrug' },
      { c: 'art', t: 'HOT! Cause it’s HOT! Oh, man, turn up the A.C., ’cause it’s HOT!', g: 'openarms' },
      { c: 'horace', t: 'Arthur...', g: 'facepalm' },
      { c: 'art', t: 'Oh boy, but you know, it’s not the heat — it’s the HUMIDITY!', g: 'wave' },
      { c: 'horace', t: 'Arthur, there’s something I’ve been meaning to say.' },
      { c: 'art', t: 'What? Horace! Buddy! Call me Art!', g: 'sheepish' },
      { a: 'He playfully punches HORACE in the shoulder. Pause.' },
      { c: 'horace', t: 'Art. I have known you for five years now. And on every day of those five years, you walk in here with the same shit-eating grin, lean on my desk at exactly the same place, and say “Hot enough for ya?” Can’t you come up with something even marginally original?', g: 'point' },
      { c: 'art', t: 'Man, Horace...you are one funny cat. Hey, I was walking on the 173rd floor and I see this DYNAMITE broad! I mean, you wanna talk about tits? Hell-OOOO!!! Car 54, Where Are You? I mean, this chick could have breast-fed Africa for twenty years!', g: 'openarms' },
      { c: 'horace', t: 'I’m going to feed your balls to wolves.', g: 'point' },
      { c: 'art', t: 'Horace, my favorite of all favorite chums, this is exactly your problem! No sense of humor. I mean, look at it! We’re in Hell! I’ve had bad jobs, but this is ridiculous!' },
      { a: 'Goes into spasms of laughter.' },
      { c: 'art', t: 'The only way you’re gonna keep a happy face is if you learn to laugh! I mean, take David Letterman! Now, there is one FUNNY GUY...' },
      { c: 'horace', t: 'Shut up, Art.' },
      { c: 'art', t: '...like, last night, Teri Garr is on, and he just blatantly slides his chair right up to hers...' },
      { c: 'horace', t: 'Shut up!' },
      { c: 'art', t: 'But who could blame him? For an old lady, she’s got quite a set of melons, huh?' },
      { c: 'horace', t: 'You idiot!', g: 'point' },
      { a: 'He grabs a folder and starts slapping ART on the head with it.' },
      { c: 'horace', t: 'SHUT UP!' },
      { a: 'He shoves ART away. Pause. ART is unfazed.' },
      { c: 'art', t: 'You gonna finish that sandwich?' },
      { a: 'He nonchalantly takes HORACE’s sandwich and starts eating it.' },
      { c: 'horace', t: 'What are you doing??', g: 'facepalm' },
      { c: 'art', t: 'Chicken salad! Not half bad. You get this from the vending machine?' },
      { c: 'horace', t: 'Give me...my sandwich, and...GET OUT OF HERE!', g: 'point' },
      { a: 'He pushes ART offstage.' },
      { c: 'art', t: 'Oh...by the way...this...', g: 'wave' },
      { a: 'He walks back onstage with two armloads of paperwork and dumps it on HORACE’s desk, scattering files.' },
      { c: 'art', t: '...is for you. Looks like you’re busy for a while? Welp, see ya at lunch! Hey, they’re serving boiled cabbage and potatoes today! Can’t wait!', g: 'wave' },
      { a: 'He walks out, whistling. HORACE watches him leave, and shakes his head.' },
    ],
  },
  {
    slug: 'INT. HELL. CONTINUOUS.',
    order: ['horace', 'satanvoice'],
    beats: [
      { a: 'HORACE tries to clean up the mess, then gives up. He pulls out a cigarette, lights it, takes a huge drag, and angrily exhales.' },
      { c: 'horace', t: 'You wanna know something? This job sucks. Oh, sure, your jobs suck too, right? Go fuck yourselves. Your jobs are cake. You get up at 8, go to work, suffer for a little while, go home, bitch about your job, have some beers, and fall asleep watching the Ricki Lake Show. Well, look at me. Look at what I’m wearing. I wouldn’t wish this tie on my worst enemy.', g: 'openarms' },
      { a: 'Pause.' },
      { c: 'horace', t: 'I didn’t want this job. I was trained as an artist. Modern sculpture. I was good — the state government even bought one of my pieces. It was “Diving in Hamburg.” They put it in a bus station. And then the Citizens for Decency got all riled up and filed a protest and they took it down. People shouldn’t have problems with dead squirrels arranged in a crucifix, okay? Am I wrong on this? Then, one day, I step out into the street and get smacked by a dump truck. And here I am.' },
      { a: 'Pause.' },
      { c: 'horace', t: 'Just look at this place. Hades would be so much better if I ran it. The boss — he’s so traditional. Whipping, drowned in acid, being devoured by vultures — passé. I know people in Times Square who would make him blush. I have some truly great ideas for eternal punishments. One of them involves a bottle of vinegar, Pop Rocks, and the business end of a Weed Wacker. You see, you take the vinegar —', g: 'lean' },
      { a: 'Thunder crashes. Lights suddenly change to a very hellish red.' },
      { c: 'satanvoice', t: 'HORACE!', voice: true, showOnly: ['horace'] },
      { a: 'HORACE is knocked off his stool.', showOnly: ['horace'] },
      { c: 'horace', t: 'S...sir! Oh, sir! Good evening, sir! I was just...doing that...thing...that I do to...serve you!', g: 'sheepish' },
      { c: 'satanvoice', t: 'Don’t even try to lie, Horace, you were talking to the audience.', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'Well, they were there, and I felt it best to explain the circumstances of my afterlife to them, O Mighty and Gracious Tyrant!', g: 'sheepish' },
      { c: 'satanvoice', t: 'Gracious? Did you describe me as GRACIOUS?', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'I meant it in the most evil way possible, Your Malevolence!', g: 'facepalm' },
    ],
  },
  {
    slug: 'INT. HELL. CONTINUOUS. (THE ASSIGNMENT.)',
    order: ['horace', 'satanvoice'],
    beats: [
      { c: 'satanvoice', t: 'What arrogance! Do you realize how good you have it here? You could be knee-deep in shit while Rastafarians use your head as a steel drum. But you’re not doing me any good wasting precious office resources here. Perhaps I should give you a new assignment.', voice: true },
      { c: 'horace', t: 'You...mean it? A new assignment? Oh, Mighty Satan, whose name inspires fear in all men, oh, thank you, thank you, thank you!', g: 'openarms' },
      { c: 'satanvoice', t: 'Shut up! I can still change my mind.', voice: true },
      { a: 'Pause.' },
      { c: 'satanvoice', t: 'Perhaps some field work would do some good. Are you good with people, Horace?', voice: true },
      { c: 'horace', t: 'Yes, sir.' },
      { c: 'satanvoice', t: 'That’s a bald-faced lie. But I’m going to give you an opportunity to prove your lowly words. Have you ever done any sales?', voice: true },
      { c: 'horace', t: 'Well, sir, I worked as a telemarketer for a while.' },
      { c: 'satanvoice', t: 'Ah yes, telemarketing...that was brilliant of me, wasn’t it? Oh, very well. Here’s your chance, Horace. There are four young people I’ve had my eye on for some time. They’re young, they’re stupid, and right now they’re playing drinking games. If you get them to sell their souls, I’ll bump you up on the hierarchy. Get their souls, Horace. Get them. Close the deal. Always be closing. ALWAYS...be closing.', voice: true, g: 'point' },
      { a: 'Pause.' },
      { c: 'satanvoice', t: 'What are you waiting for, Horace? Go! I don’t have all day!', voice: true },
      { c: 'horace', t: 'You can count on me...sir.' },
      { a: 'Lights fade. Noise subsides.' },
      { c: 'horace', t: 'Jackass.' },
      { a: 'Red lights up full. Thunder peal.' },
      { c: 'satanvoice', t: 'WHAT?', voice: true },
      { c: 'horace', t: 'On my way!' },
      { a: 'HORACE runs off.' },
    ],
  },
  {
    slug: 'INT. THE LIVING ROOM. NIGHT.',
    order: ['todd', 'traci', 'aaron', 'katie'],
    beats: [
      { a: 'TODD, TRACI, AARON, and KATIE sit around an apartment living room, drinking beer and playing Never Have I Ever. They are all slightly drunk.' },
      { c: 'traci', t: 'Okay...I’m going.' },
      { c: 'todd', t: 'Go. C’mon.' },
      { c: 'katie', t: 'Don’t rush the poor girl.' },
      { c: 'aaron', t: 'Go go go go go...' },
      { c: 'traci', t: 'Shut up! I can’t think!' },
      { c: 'traci', t: 'I never had sex in a swimming pool.' },
      { a: 'Everyone drinks.' },
      { c: 'katie', t: 'Hey...there could be some people in the world that have never had sex in a swimming pool. Don’t force your moral standards on other people.', g: 'shrug' },
      { c: 'aaron', t: 'That’s great. Who let her in here?' },
      { c: 'katie', t: 'Okay, shut up. It’s my turn. I never...had sex while I was driving.' },
      { c: 'todd', t: 'Oh, fuck you, Katie. Don’t even talk to me.' },
      { a: 'He drinks.' },
      { c: 'traci', t: 'You had sex in a car while you were driving?' },
      { c: 'todd', t: 'Hey, the trip to Disney World can get very boring.', g: 'lean' },
      { c: 'aaron', t: 'I never had sex with a person twenty years older than me.' },
      { a: 'TODD stares at AARON, and then drinks.' },
      { c: 'todd', t: 'Bite me. I never...had sex in my dorm room while my roommate was there.' },
      { a: 'TODD drinks, then stops when he realizes that everyone else is staring at him.' },
      { c: 'traci', t: 'I never masturbated while my roommate was in the room.' },
      { a: 'TODD takes another drink.' },
      { c: 'katie', t: 'I never used Spam as a sexual toy.' },
      { a: 'He stands up.' },
      { c: 'todd', t: 'Okay, we’re stopping NOW.', g: 'point' },
      { c: 'katie', t: 'Sick. You’re truly sick.' },
      { c: 'todd', t: 'Spam can be very erotic.' },
      { c: 'traci', t: 'Spam?' },
      { c: 'todd', t: 'Oh, don’t act so shocked, Traci. You could use some Spam in your life.', g: 'lean' },
      { c: 'aaron', t: 'Traci, how’s the play coming?' },
      { c: 'traci', t: 'Spam?' },
      { c: 'todd', t: 'Would you forget about the fucking Spam?' },
      { c: 'aaron', t: 'Traci. Play. Acting. How is it going?' },
      { c: 'traci', t: 'Uh...fine. Fine.' },
      { c: 'katie', t: 'Oh, what part do you have?' },
      { a: 'Pause.' },
      { c: 'traci', t: 'I am a Gentlewoman.' },
      { c: 'todd', t: 'Yes, you are.' },
      { c: 'katie', t: 'Ooh, Traci, I think he likes you! And you’re old enough to drive!', g: 'lean' },
      { c: 'aaron', t: 'So...do you...have any lines?' },
      { c: 'traci', t: 'No.' },
      { c: 'aaron', t: 'Ow.' },
      { c: 'traci', t: 'It’s my first play. I wouldn’t expect to get a big part the first time.', g: 'shrug' },
      { c: 'todd', t: 'But still, no lines?' },
      { c: 'traci', t: 'Could we please change the subject?' },
      { a: 'KATIE gives TRACI a little hug.' },
      { c: 'katie', t: 'We’re just giving you shit.', g: 'heart' },
      { c: 'traci', t: 'It’s just depressing, because there’s this one girl who’s amazing. I can’t compete with that.', g: 'sheepish' },
      { c: 'katie', t: 'Forget about it. Theater people suck.' },
      { a: 'Long pause. There is a knock on the door.' },
      { c: 'aaron', t: 'Who the hell is that?' },
      { c: 'katie', t: 'You expecting anyone?' },
      { c: 'aaron', t: 'No, you guys are it.', g: 'shrug' },
    ],
  },
  {
    slug: 'INT. THE LIVING ROOM. NIGHT. (THE PITCH.)',
    order: ['horace', 'todd', 'traci', 'aaron', 'katie', 'thewoman'],
    beats: [
      { a: 'AARON opens the door. HORACE is standing there. Lights go to hell red and evil music plays.' },
      { c: 'horace', t: 'Greetings.', g: 'point' },
      { c: 'aaron', t: 'No thanks, we’re not interested.' },
      { a: 'AARON slams the door. Lights return to normal. The door flies open again. Red light and music as before. HORACE enters.' },
      { c: 'aaron', t: 'Listen, we already get Details. And we’re all pretty much strapped for cash...' },
      { c: 'horace', t: 'I’m not here to sell you magazines, you pompous twit.' },
      { c: 'katie', t: 'What the fuck?' },
      { a: 'HORACE makes a gesture and AARON goes flying backwards, crashing on the ground. Pause.' },
      { c: 'todd', t: 'Oh wow! It’s a Jedi Knight!', g: 'openarms' },
      { c: 'traci', t: 'Did you know Mark Hamill is the voice of the Joker on Batman: The Animated Series?' },
      { c: 'horace', t: 'EXCUSE ME!!! Thank you. Now then, allow me to introduce myself. My name is Horace, and I am here...to make you the offer of a lifetime.', g: 'openarms' },
      { c: 'aaron', t: 'A set of encyclopedias?' },
      { c: 'katie', t: 'A membership in Greenpeace?' },
      { c: 'traci', t: 'You’re selling M&M’s to support your Little League team?' },
      { c: 'todd', t: 'A small Asian child?' },
      { c: 'horace', t: 'No, no, no, and hell no. Those are passing things — material goods that bring little or no long-term fulfillment.' },
      { c: 'horace', t: 'STOP IT! Now listen to me, you shit-for-brains do-nothing slacker toads!!! I’ve been sent here to ask you kindly for your souls, for which, in return, you will get ANYTHING you want! ANYTHING! Cars, jewelry, women, men, fame, fortune, ANYTHING!', g: 'point' },
      { a: 'Pause.' },
      { c: 'todd', t: 'Did you say women?' },
      { c: 'horace', t: 'Yes, I did say women. Any woman. Many women. Strong women, weak women, blondes, brunettes, redheads, any sort of women you desire.', g: 'lean' },
      { a: 'Pause.' },
      { c: 'todd', t: 'And what do I have to give up for this?' },
      { c: 'horace', t: 'Your soul.' },
      { c: 'traci', t: 'Wait a minute...our souls? What are you, Satan or something?' },
      { c: 'horace', t: 'Well, not yet. I’m Satan’s right hand man.' },
      { c: 'aaron', t: 'Holy shit. Holy shit. You’re not kidding, are you?' },
      { c: 'katie', t: 'Wait one goddamn minute. You expect us to believe that you’re a demon from Hell?' },
      { c: 'horace', t: 'Why not?' },
      { c: 'katie', t: 'Well, for one thing, I’d think you’d be dressed better. I mean, you dress like my dad.' },
      { c: 'horace', t: 'Everyone in Hell gets a standard outfit. Quite frankly, I wouldn’t be caught dead in these clothes if I had a choice. But I don’t.' },
      { c: 'horace', t: 'Your friend over there — wants power and money. Traci — wants to be a famous actress. The Progressive Nightmare sulking on the couch doesn’t even know what she wants. But you, my lonely friend...you want a woman.', g: 'point' },
      { a: 'Shift in lighting.' },
      { c: 'horace', t: 'Not just any woman, either. You want your dream woman. You’ve been searching for so very long, haven’t you? Always worrying about commitment, emotional ties, what it means...just wishing for a woman like you’ve been promised all throughout life. A woman that loves you and cares about you and only has thoughts for you. Because that’s what it all boils down to, isn’t it, Todd? You’ve always had this fear, locked inside your heart, that if you ever found the right woman, she’d betray you. That’s why you’ve been going through women like toilet paper. Because they’ll hurt you in the end. They always will.' },
      { a: 'Pause.' },
      { c: 'horace', t: 'Except...for this one.' },
      { a: 'THE WOMAN enters, in a negligee that does a fine job of showing off her body. She slinks over to TODD, who is dumbfounded, and starts stroking his hair.' },
      { c: 'thewoman', t: 'Hello, Todd.', g: 'lean' },
    ],
  },
  {
    slug: 'INT. THE LIVING ROOM. NIGHT. (BACKUP.)',
    order: ['horace', 'art', 'aaron', 'katie'],
    beats: [
      { a: 'Later. Having caught Horace in a lie about his tenure, KATIE has grown suspicious. A beeper goes off; HORACE is summoned, chewed out, and told backup is on the way. He returns to the apartment, dreading who it might be.' },
      { c: 'horace', t: 'Who is he sending here? Who could he possibly be sending?', g: 'shrug' },
      { a: 'Suddenly realizing.' },
      { c: 'horace', t: 'Oh, NO...', g: 'facepalm' },
      { a: 'ART walks through the front door, briefcase in hand.' },
      { c: 'art', t: 'Hi, guys! How ya doing?', g: 'wave' },
      { c: 'horace', t: 'FUCK YOU, SATAN!', g: 'point' },
      { c: 'aaron', t: 'Who’s this guy?' },
      { c: 'art', t: 'Art’s my name, and selling’s my game! Wow! Isn’t this great? A little fresh air, meeting new people, getting out of that stuffy office...', g: 'openarms' },
      { a: 'HORACE drags ART downstage.' },
      { c: 'horace', t: 'Listen, you schmuck! This is MY sale! Mine, do you hear me? This is my ticket to a better afterlife! Now, if I get in a bind, you help me out. Other than that, you shut up. Capisce?', g: 'point' },
      { c: 'art', t: 'Hey, Horatio, no problemo! I’m a master of sales! Did some back when I was — you know, not dead! See, when I was in college, I was selling magazines door to door —', g: 'shrug' },
      { c: 'horace', t: 'Oh, fucking shit. Okay okay okay!!! Just — just shut up and let me do the talking.', g: 'facepalm' },
      { a: 'They go back to the living room.' },
      { c: 'horace', t: 'Ladies and gentlemen, I am pleased to introduce my partner, Art.' },
      { c: 'katie', t: 'Are you a devil, too?' },
      { c: 'art', t: 'You betcha! Assistant Adjunct Clerk to the Department of Soul Collections. Yessiree, I’m the Numero Uno Diablo!', g: 'openarms' },
      { c: 'aaron', t: 'This guy’s a tool.' },
      { c: 'art', t: 'Oh, come on, Todd —' },
      { c: 'aaron', t: 'Aaron.' },
      { c: 'art', t: 'Aaron? Well, I’ll be damned. Wait, I already am! ...Cause I’m in...HA!' },
      { a: 'He is once again in breathless hysterics.' },
      { c: 'art', t: 'Man, that’s comedy! So, wanna sell your souls?', g: 'lean' },
      { c: 'horace', t: 'ART!' },
      { c: 'art', t: 'Horace, relax! Let a pro handle this! Now, don’t think of it as selling your soul. Think of it as a lifetime investment.', g: 'openarms' },
      { c: 'katie', t: 'We’ll be dead.' },
      { c: 'art', t: 'Well, it’s a long lifetime.' },
      { c: 'horace', t: 'Art...' },
      { c: 'art', t: 'Kinda like forever.' },
      { c: 'horace', t: 'ART...' },
      { c: 'art', t: 'But look at the cool clothes they give you!' },
      { c: 'horace', t: 'ART!', g: 'point' },
      { c: 'katie', t: 'You two deserve each other.' },
      { c: 'horace', t: 'SHUT UP! Just SHUT UP! I am getting DAMN tired of this petty abuse! I’m here to make your lives wonderful, and you just spit in my face! That’s gratitude for you!', g: 'point' },
      { c: 'katie', t: 'I didn’t ask you to make my life wonderful! You bargein here, make a complete ass of yourself, and you say you’re going to answer my dreams? I don’t think so. Did you know that Todd is a fabulous writer? He’s brilliant. But you’re gonna tie him down to that idiot slut, totally destroy him. You want to turn Aaron into another cheater, another liar, another pawn. You want to destroy me. You want to make me a broken wretch who can’t rely on myself. Well, fuck you! I will not break! I will prevail against you and anyone else who wants to get in my face! So back off!', g: 'point' },
      { c: 'art', t: 'That was BEAUTIFUL! Oh, geez, in all my life I have never been more moved by the English language! Touching! Heartwrenching! Gorgeous! Can I get your phone number?', g: 'heart' },
      { c: 'katie', t: 'So, how ‘bout it, Horace? You gonna give it up? You can’t turn any of us.' },
    ],
  },
  {
    slug: 'INT. THE LIVING ROOM. NIGHT. (THE SIGNATURE.)',
    order: ['horace', 'art', 'todd', 'katie', 'aaron', 'traci'],
    beats: [
      { a: 'TODD stumbles onstage, clothes and hair a mess.' },
      { c: 'todd', t: 'Praise Satan!', g: 'openarms' },
      { c: 'horace', t: 'Well? How was she?' },
      { c: 'todd', t: 'Can’t talk. Must replenish fluids.' },
      { a: 'TODD goes to the fridge and chugs water.' },
      { c: 'todd', t: 'Wow...she is not a woman. She is a goddess. Oh, yes. Where do I sign?', g: 'heart' },
      { c: 'traci', t: 'Todd, don’t!' },
      { c: 'aaron', t: 'Todd, you can’t do this, man. You’re talking about your soul. Nothing is worth that.' },
      { c: 'todd', t: 'Well, I’m an atheist.' },
      { c: 'horace', t: 'Atheist! Hoo boy...nothing. I mean, if you’re an atheist, then you don’t believe in Hell, so this means nothing.', g: 'shrug' },
      { c: 'todd', t: 'Yeah...I guess...all right, gimme the contract.' },
      { a: 'HORACE pulls a contract out of his briefcase, along with a quill. He jabs TODD in the arm, causing him to bleed.' },
      { c: 'todd', t: 'Ow! Whadja do that for?' },
      { c: 'horace', t: 'We need ink. Let’s go to work.' },
      { a: 'He hesitates for one moment, then signs his name. HORACE and ART are immensely relieved.' },
      { c: 'art', t: 'Congratulations!', g: 'openarms' },
      { c: 'horace', t: 'You are now the proud owner of Your Perfect Woman. Let’s bring her out!' },
      { a: 'THE WOMAN comes out — hair mussed up, a fire in her eyes.' },
      { c: 'aaron', t: 'What? Are you fucking nuts? You just screwed over Todd and now you expect the rest of us to fall for it? Get the fuck out, you deranged psychopath!', g: 'point' },
      { c: 'traci', t: 'Give us that contract!' },
      { c: 'horace', t: 'No way! This contract has been signed! And once it’s official, nothing on Earth can destroy it! Todd is locked in!', g: 'point' },
      { c: 'aaron', t: 'No he’s not! It’s not notarized!' },
      { c: 'horace', t: 'What?' },
      { c: 'aaron', t: 'The contract isn’t notarized. It’s not official.' },
      { a: 'He starts laughing.' },
      { c: 'horace', t: 'Notarized??? Gimme a fucking break! You think Satan is an accountant? Notarized!' },
      { c: 'katie', t: 'That is ENOUGH! I don’t care what I have to do, but we are getting that contract! You are screwed, Horace! You are meat on a stick!', g: 'point' },
      { c: 'horace', t: 'Just shut up, okay? You’ve got a big ugly mouth and it grates on my ears and — now you’re making me insult you and I really really really NEED you to sign a contract because if you don’t I’m deader than dog shit so I’m sorry for losing my cool but you’re really pushing me and I’m on edge so would you please relax and sign the contract?', g: 'facepalm' },
      { c: 'katie', t: 'No! You think you can get away with this? Not a chance in Hell!' },
      { c: 'horace', t: 'Not a chance in —! What do you know about Hell? Hell is the worst thing imaginable! It’s FOREVER! I sit at a desk and write names into a scroll! I have no idea why I’m doing it! And you know what’s gonna happen now that I only have one signature? I’m going straight back to that desk! FOREVER! You people have fucked me over good!', g: 'openarms' },
      { a: 'Pause. Suddenly, the sound of thunder starts rumbling throughout the stage. Lights go to red.' },
      { c: 'art', t: 'Oh no! It’s the BOSS!', g: 'facepalm' },
      { a: 'With a loud thunderclap, the door swings open. SATAN, immaculately attired, is standing there, smiling, holding a briefcase.' },
    ],
  },
  {
    slug: 'INT. THE LIVING ROOM, THEN HELL. NIGHT. (THE TWIST.)',
    order: ['satan', 'horace', 'art', 'todd', 'katie', 'aaron', 'satanvoice'],
    beats: [
      { c: 'satan', t: 'Greetings.', g: 'wave' },
      { c: 'aaron', t: 'That’s Satan, isn’t it?' },
      { c: 'satan', t: 'Yes. A pleasure to finally meet all of you. Please, please, PLEASE watch your language around me. I have virgin ears.', g: 'lean' },
      { a: 'SATAN sits down on the couch. HORACE and ART keep their distance.' },
      { c: 'satan', t: 'I’ve been monitoring the progress of my two...salesmen there, and I can see they have botched things up good.' },
      { c: 'katie', t: 'Well, Art’s just a weirdo. It’s Horace that’s the asshole.' },
      { c: 'horace', t: 'Katie!' },
      { c: 'satan', t: 'Silence, fool! Yes, I do apologize for Horace. He isn’t a very good worker. You see, what we at HellCo really do is help the living achieve their goals in life. Don’t think of it as damnation — think of it as your Final Promotion.', g: 'openarms' },
      { c: 'todd', t: 'Wait, Satan...I’m...not completely satisfied with what I got.' },
      { c: 'satan', t: 'Oh? Well, we can change that, I’ll just amend the contract. Horace, the contract.', g: 'shrug' },
      { a: 'HORACE scurries and gives the contract to SATAN. He sees something on it.' },
      { c: 'satan', t: 'Art. The notary stamp.', g: 'point' },
      { c: 'art', t: 'The what?' },
      { c: 'satan', t: 'The notary stamp! Horace forgot to notarize the contract!' },
      { c: 'art', t: 'I don’t have a notary stamp.' },
      { c: 'art', t: 'Oh! The stamp thingy! Here it is!' },
      { a: 'He searches his pockets.' },
      { c: 'art', t: 'Hmmm...knew I had it somewhere...', g: 'shrug' },
      { c: 'katie', t: 'Wait! If the contract isn’t notarized, it isn’t official, is it?' },
      { c: 'satan', t: 'Well, technically, no, but —' },
      { a: 'KATIE grabs the contract and tears it in half.' },
      { c: 'satan', t: 'NO!' },
      { c: 'katie', t: 'Haha!', g: 'openarms' },
      { c: 'todd', t: 'Yes! Free! Oh, Katie, I love you!', g: 'heart' },
      { a: 'Big group hug.' },
      { c: 'satan', t: 'You’re a resourceful, clever bunch. It’s a shame you can’t work for me. Actually, I do have someone to blame.', g: 'shrug' },
      { a: 'Turns to HORACE and ART.' },
      { c: 'horace', t: 'Sir, I swear, I knew nothing about notarizing the contracts!', g: 'sheepish' },
      { c: 'satan', t: 'You two are in a world of shit.', g: 'point' },
      { a: 'Thunder clap. HORACE and ART scream. Lights go to red, then blackout. Pause. Red light slowly fades up on HORACE, downstage, in a fetal position, whimpering.', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'Oh, Horace...', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'Wh...what happened?', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'You’re back in Hell, Horace. No more punishment by boredom. I’m getting medieval on your ass.', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'No, not that...Sir, I swear, I tried my best! And I knew nothing about notarizing the contracts!', g: 'facepalm', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'I know. That’s because I never told you.', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'Well, how was I supposed to get their souls if the contracts weren’t notarized?', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'You weren’t.', voice: true, showOnly: ['horace'] },
      { a: 'Pause.', showOnly: ['horace'] },
      { c: 'horace', t: 'This whole thing was a setup?!?', g: 'facepalm', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'Congratulations! You win the prize! You get to spend the rest of eternity knee-deep in shit while Rastafarians use your head as a steel drum! You’re in a world of shit!', voice: true, showOnly: ['horace'] },
      { c: 'horace', t: 'But why? WHY????', g: 'openarms', showOnly: ['horace'] },
      { c: 'satanvoice', t: 'Because, Horace...I’m the boss.', voice: true, showOnly: ['horace'] },
      { a: '“Stand Up For Your Right” by Bob Marley starts playing. VOICE OF SATAN turns to laughter. HORACE is reduced to wailing and howling in despair. BLACKOUT.', showOnly: ['horace'] },
    ],
  },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── cowsay-style ASCII speech bubble ──────────────────────────────────────
function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

function asciiBubble(text, voice, width = 40) {
  const lines = wrapText(text, width);
  const maxLen = Math.max(...lines.map(l => l.length), voice ? 9 : 0);
  const top = ' ' + '_'.repeat(maxLen + 2);
  const bottom = ' ' + '-'.repeat(maxLen + 2);
  const rows = [];
  if (voice) rows.push(`| ${'(voice)'.padEnd(maxLen)} |`);
  lines.forEach(l => rows.push(`| ${l.padEnd(maxLen)} |`));
  return [top, ...rows, bottom].join('\n');
}

function buildStyles() {
  if (document.getElementById('tab-styles')) return;
  const style = document.createElement('style');
  style.id = 'tab-styles';
  style.textContent = `
    .tab-root {
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background: radial-gradient(ellipse at 50% 15%, #241a12 0%, #0b0705 65%, #050302 100%);
      color: #d8cdb8;
      font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1.6rem 1rem 0.6rem;
    }

    /* ── curtain, ASCII swags ── */
    .tab-curtain {
      width: 100%; max-width: 900px; text-align: center;
      color: #6b1f1f; font-size: clamp(0.6rem, 1.6vw, 1rem);
      letter-spacing: 0.05em; line-height: 1; white-space: pre; overflow: hidden;
      opacity: 0.85; margin-bottom: 0.3rem;
    }

    /* ── the screen ── */
    .tab-screen-frame {
      position: relative; width: 100%; max-width: 900px; flex: 0 0 auto;
      margin: 0.3rem 0 0.5rem;
      border-radius: 6px;
      padding: 10px;
      background: #1a120b;
      box-shadow: 0 0 0 1px #3a2a18, 0 10px 40px rgba(0,0,0,0.6);
    }
    .tab-screen-frame::before {
      content: ''; position: absolute; inset: 2px; border-radius: 4px;
      background-image: radial-gradient(circle, #e8b84b 1.5px, transparent 1.8px);
      background-size: 16px 16px;
      background-position: center;
      -webkit-mask: linear-gradient(#000 0 0);
      opacity: 0.35; pointer-events: none;
      padding: 8px; box-sizing: border-box;
    }
    .tab-screen {
      position: relative; width: 100%;
      aspect-ratio: 2 / 1; /* a proper widescreen picture, not a tower of headspace */
      min-height: 200px; max-height: 62vh;
      background:
        repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 3px),
        radial-gradient(ellipse at 50% 40%, #f2ede0 0%, #ddd6c2 75%, #c9c1a8 100%);
      border-radius: 3px; overflow: visible; /* dialogue floats over the screen rather than being clipped by it */
      display: flex; flex-direction: column;
      padding-bottom: 54px; /* clear room for the audience silhouette overlay */
      animation: screen-flicker 4s steps(2) infinite;
    }
    @keyframes screen-flicker {
      0%, 96%, 100% { filter: brightness(1); }
      97% { filter: brightness(0.97); }
      98% { filter: brightness(1.02); }
    }
    .tab-slug {
      flex: 0 0 auto; text-align: center; padding: 0.7rem 0.6rem 0.2rem;
      font-size: clamp(0.62rem, 1.6vw, 0.85rem); letter-spacing: 0.08em;
      color: #4a4030; opacity: 0.8; white-space: pre-wrap;
    }
    .tab-stage {
      flex: 1 1 auto; position: relative; min-height: 0;
      display: flex; align-items: flex-end; justify-content: space-evenly;
      padding: 0 0.6rem 0.6rem;
    }
    .tab-actor {
      flex: 0 1 auto; display: flex; flex-direction: column; align-items: center;
      opacity: 0; transition: opacity 0.35s ease;
      color: #221c14; position: relative;
    }
    .tab-actor.on { opacity: 1; }
    .tab-actor pre.sf {
      margin: 0; font-size: clamp(0.7rem, 1.9vw, 1.05rem); line-height: 1.05;
      font-weight: bold; animation: sf-bob 2.8s ease-in-out infinite;
    }
    .tab-actor.talking pre.sf { animation: sf-bob 2.8s ease-in-out infinite, sf-talk 0.45s ease-in-out 2; }
    @keyframes sf-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @keyframes sf-talk { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    .tab-actor .sf-name { font-size: 0.72em; margin-top: 0.1em; font-weight: bold; }
    .tab-actor .sf-tag { font-size: 0.6em; opacity: 0.65; font-style: italic; }

    .tab-bubble {
      position: absolute; left: 50%; bottom: 100%; margin-bottom: 6px;
      transform: translateX(-50%);
      white-space: pre; font-size: clamp(0.58rem, 1.5vw, 0.82rem); line-height: 1.25;
      color: #221c14; background: #f4efe0; /* fully opaque — it floats over dark backgrounds too */
      box-shadow: 0 2px 8px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.15);
      padding: 2px 4px; border-radius: 3px;
      opacity: 0; transition: opacity 0.25s ease;
      pointer-events: none; max-width: min(72vw, 380px); overflow-x: auto;
      z-index: 4; /* always float above the house overlay and frame texture */
    }
    .tab-bubble.on { opacity: 1; }
    .tab-bubble .bubble-name { display: block; font-weight: bold; opacity: 0.6; font-size: 0.85em; margin-bottom: 0.1em; }

    .tab-caption {
      flex: 0 0 auto; text-align: center; padding: 0.3rem 0.8rem 0.7rem;
      font-style: italic; font-size: clamp(0.66rem, 1.7vw, 0.88rem);
      color: #4a4030; opacity: 0; transition: opacity 0.3s ease; min-height: 1.4em;
    }
    .tab-caption.on { opacity: 0.85; }

    /* ── theater house: seat blocks split by aisles, a few occupied by
       patrons — overlaying the bottom of the screen itself, MST3K-style. ── */
    .tab-house {
      position: absolute; left: 10px; right: 10px; bottom: 10px; height: 46px;
      display: flex; align-items: flex-end; justify-content: center;
      gap: clamp(14px, 5vw, 34px); /* the aisles */
      padding: 0 0.6rem;
      pointer-events: none; z-index: 3;
    }
    .tab-house-section {
      display: flex; align-items: flex-end;
      gap: clamp(3px, 1.2vw, 10px);
    }
    .tab-seat {
      width: clamp(16px, 3vw, 26px); height: clamp(18px, 3.6vw, 30px);
      background: #100c08; border-radius: 6px 6px 1px 1px;
      opacity: 0.92;
      position: relative; flex: 0 0 auto;
    }
    .tab-seat.occupied::before {
      content: ''; position: absolute; left: 50%; bottom: 55%; transform: translateX(-50%);
      width: 46%; aspect-ratio: 1; background: #030201; border-radius: 50%;
    }
    .tab-seat.occupied::after {
      content: ''; position: absolute; left: 50%; bottom: -2px; transform: translateX(-50%);
      width: 78%; height: 60%; background: #030201; border-radius: 50% 50% 8% 8%;
    }
    /* the two silhouettes down front who won't stop talking through the movie */
    .tab-seat.host {
      opacity: 1;
      filter: drop-shadow(0 0 5px rgba(232,184,75,0.4));
    }
    .tab-seat.host::before {
      width: 54%; bottom: 62%;
    }
    .tab-seat.host::after {
      width: 86%; height: 66%;
    }
    .tab-seat-nub {
      position: absolute; left: 50%; bottom: 108%; transform: translateX(-50%);
      width: 18%; aspect-ratio: 1; background: #030201; border-radius: 50%;
    }

    /* ── end card ── */
    .tab-card {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
      background: #ddd6c2; z-index: 5; cursor: pointer; padding: 1rem;
      color: #221c14;
    }
    .tab-card h1 {
      font-family: 'Courier New', monospace; font-weight: bold;
      font-size: clamp(1.4rem, 6vw, 2.6rem); margin: 0 0 0.3em; letter-spacing: 0.04em;
    }
    .tab-card pre.tab-ascii-title { font-size: clamp(0.5rem, 1.6vw, 0.85rem); line-height: 1.15; margin: 0 0 0.6em; opacity: 0.75; }
    .tab-card p { font-size: clamp(0.85rem, 2.2vw, 1.05rem); margin: 0.2em 0; opacity: 0.75; max-width: 480px; }
    .tab-card .tab-tap { margin-top: 1.2em; font-size: 0.85rem; opacity: 0.5; }

    /* ── interstitial: a between-scenes theater bumper slide ── */
    .tab-interstitial {
      position: absolute; inset: 0; z-index: 6;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 1rem;
      background: radial-gradient(ellipse at 50% 40%, #1a120b 0%, #0b0705 80%);
      color: #e8b84b;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .tab-interstitial.on { opacity: 1; }
    .tab-inter-eyebrow {
      font-size: clamp(0.55rem, 1.6vw, 0.75rem); letter-spacing: 0.14em;
      opacity: 0.75; margin-bottom: 0.5em; text-transform: uppercase;
    }
    .tab-inter-main {
      font-weight: bold; font-size: clamp(1rem, 3.4vw, 1.6rem);
      max-width: 32ch; line-height: 1.3; margin-bottom: 0.4em;
    }
    .tab-inter-sub {
      font-size: clamp(0.62rem, 1.6vw, 0.8rem); opacity: 0.6; font-style: italic; max-width: 34ch;
    }

    /* ── transport controls ── */
    .tab-controls {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 0.5rem 1rem; font-size: 0.88rem;
    }
    .tab-btn {
      font-family: 'Courier New', monospace; font-size: 0.88rem;
      background: #1a120b; border: 1px solid #6b5638; border-radius: 3px;
      padding: 0.3rem 0.7rem; cursor: pointer; color: #d8cdb8;
    }
    .tab-btn:hover, .tab-btn:focus-visible { background: #2a2018; border-color: #e8b84b; color: #e8b84b; }
    .tab-btn:active { transform: translateY(1px); }
    .tab-progress { opacity: 0.55; min-width: 5.5em; text-align: center; }

    /* Screen-reader-only live narration — visually hidden, announces each
       beat (scene changes, actions, and dialogue) as the reel plays. */
    .tab-sr-live {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      pre.sf, .tab-screen, .film-reel, .tab-preview::before { animation: none !important; }
    }
    @media (max-width: 640px) {
      .tab-house { height: 32px; bottom: 6px; }
      .tab-screen { padding-bottom: 40px; }
    }

    /* ── vertical phones: narrow width, held in portrait ── */
    @media (max-width: 480px), (max-width: 700px) and (orientation: portrait) {
      .tab-root { padding: 0.9rem 0.4rem 0.4rem; }
      .tab-curtain { font-size: 0.42rem; margin-bottom: 0.15rem; }
      .tab-screen-frame { padding: 6px; margin: 0.2rem 0 0.4rem; }
      .tab-screen { aspect-ratio: 4 / 3; min-height: 240px; padding-bottom: 42px; }
      /* Design pass, 2026-07-17 (Scott: mobile readability check) — .tab-slug
         and .tab-caption were both being set here to a smaller font-size
         than their OWN desktop clamp() floor (0.62rem/0.66rem respectively)
         — backwards, since mobile is exactly where shrinking further hurts
         most. .tab-caption in particular is the italic per-beat description
         line, the thing most likely to actually be read start to finish, so
         it gets the larger bump of the two. Neither shrinks below its
         desktop floor anymore. */
      .tab-slug { font-size: 0.68rem; padding: 0.5rem 0.35rem 0.15rem; letter-spacing: 0.04em; }
      .tab-stage {
        flex-wrap: wrap; row-gap: 0.5rem; column-gap: 0.4rem;
        padding: 0 0.3rem 0.4rem; align-content: flex-end;
      }
      .tab-actor pre.sf { font-size: 0.6rem; }
      .tab-actor .sf-name { font-size: 0.58em; }
      .tab-actor .sf-tag { font-size: 0.5em; }
      .tab-bubble { max-width: 88vw; font-size: 0.54rem; }
      .tab-caption { font-size: 0.74rem; line-height: 1.35; padding: 0.2rem 0.4rem 0.5rem; min-height: 1.2em; }
      .tab-house { height: 24px; bottom: 4px; gap: 9px; }
      .tab-house-section { gap: 1.5px; }
      .tab-seat { width: 10px; height: 12px; }
      .tab-controls { gap: 0.3rem; padding: 0.4rem 0.4rem; flex-wrap: wrap; }
      .tab-btn { font-size: 0.74rem; padding: 0.26rem 0.5rem; }
      .tab-progress { min-width: auto; font-size: 0.7rem; }
      .tab-card h1 { font-size: 1.5rem; }
      .tab-card pre.tab-ascii-title { font-size: 0.42rem; }
      .tab-card p { font-size: 0.8rem; }
      /* The interstitial's own italic sub-line (.tab-inter-sub) had no
         mobile override at all — just the desktop clamp() floor (0.62rem)
         at opacity:0.6 on a near-black background. Same category of
         problem as .tab-caption above, same fix: a firmer floor and a
         touch more opacity so it holds up on a phone screen, not just a
         desktop monitor at a comfortable distance. */
      .tab-inter-sub { font-size: 0.78rem; line-height: 1.4; opacity: 0.75; }
    }
    @media (max-width: 480px) and (orientation: portrait) {
      /* portrait phones have height to spare — let the screen breathe a bit */
      .tab-screen { aspect-ratio: 1 / 1; min-height: 300px; }
    }

    /* ── preview: a rotating black & white film reel ── */
    .tab-preview {
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background: radial-gradient(ellipse at 50% 35%, #2a2a2a 0%, #0d0d0d 70%, #020202 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .tab-preview::before {
      /* faint scratched-film-stock grain */
      content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
      background-image:
        repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 38px),
        repeating-linear-gradient(68deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 53px);
      mix-blend-mode: screen;
      animation: reel-flicker 1.8s steps(4) infinite;
    }
    .reel-glow {
      position: absolute; left: 50%; top: 50%; width: 72%; aspect-ratio: 1;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%);
      filter: blur(6px); pointer-events: none;
    }
    .film-reel {
      position: relative; z-index: 1;
      width: min(58%, 150px); aspect-ratio: 1;
      border-radius: 49% 51% 50% 50% / 51% 49% 51% 49%; /* a hair off true-round — well-worn, not machined */
      background: #161616;
      border: clamp(3px, 2.4%, 7px) solid #5c5c5c;
      box-shadow: 0 0 16px rgba(255,255,255,0.14), inset 0 0 14px rgba(0,0,0,0.7);
      animation: reel-spin 3.4s linear infinite;
    }
    .film-reel::after {
      content: ''; position: absolute; left: 50%; top: 50%;
      width: 20%; height: 20%; transform: translate(-50%, -50%);
      border-radius: 50%; background: #0a0a0a; border: 2px solid #5c5c5c;
    }
    .reel-hole {
      position: absolute; left: 50%; top: 50%;
      width: 20%; height: 20%; margin: -10% 0 0 -10%;
      border-radius: 50%;
      background: radial-gradient(circle, #eee 0%, #b0b0b0 55%, #4a4a4a 100%);
      box-shadow: 0 0 6px rgba(255,255,255,0.4);
      transform: rotate(var(--a, 0deg)) translateY(-170%);
    }
    @keyframes reel-spin { to { transform: rotate(360deg); } }
    @keyframes reel-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.9; } }
  `;
  document.head.appendChild(style);
}

const CURTAIN_ROW = '╭⌒╮'.repeat(40);
// Three seat blocks with aisles between them, like a real house. Flat seat
// indices run left block, then center block, then right block.
const SEAT_SECTIONS = [4, 8, 4];
// A sparse scatter of occupied seats among the empty ones — a few other patrons.
const OCCUPIED_SEATS = new Set([1, 2, 4, 7, 8, 11, 13, 14]);
// Front and center: a couple of silhouettes who talk through the whole movie.
const HOST_SEATS = new Set([7, 8]);

function buildHouseRow() {
  const house = document.createElement('div');
  house.className = 'tab-house';
  house.setAttribute('aria-hidden', 'true');
  let i = 0;
  SEAT_SECTIONS.forEach(sectionSize => {
    const section = document.createElement('div');
    section.className = 'tab-house-section';
    for (let s = 0; s < sectionSize; s++, i++) {
      const seat = document.createElement('div');
      const isHost = HOST_SEATS.has(i);
      seat.className = 'tab-seat' + (OCCUPIED_SEATS.has(i) || isHost ? ' occupied' : '') + (isHost ? ' host' : '');
      if (isHost) {
        const nub = document.createElement('div');
        nub.className = 'tab-seat-nub';
        seat.appendChild(nub);
      }
      section.appendChild(seat);
    }
    house.appendChild(section);
  });
  return house;
}

function buildActorEl(key) {
  const ch = CHARACTERS[key];
  const el = document.createElement('div');
  el.className = 'tab-actor';
  el.dataset.char = key;
  el.style.color = ch.color;
  el.innerHTML = `
    <pre class="sf">${POSES.idle.join('\n')}</pre>
    <div class="sf-name">${ch.name}</div>
    ${ch.tag ? `<div class="sf-tag">(${ch.tag})</div>` : ''}
  `;
  return el;
}

// Between-scenes bumper slides — classic repertory-house filler, plus a bit
// of in-universe trivia about the two screenplays.
const INTERSTITIALS = [
  { eyebrow: 'Now is a good time to', main: 'HIT THE REFRESHMENT COUNTER', sub: 'popcorn, candy, and beverages are available in the lobby (there is no lobby)' },
  { eyebrow: 'A gentle reminder', main: 'PLEASE SILENCE YOUR PAGER', sub: 'why on earth do you still have a pager' },
  { eyebrow: 'Movie trivia', main: 'Archibald Query was the actual, real inventor of Marshmallow Fluff.', sub: 'his romantic biography, as depicted here, remains unconfirmed.' },
  { eyebrow: 'Movie trivia', main: 'Paul Revere may or may not have actually shouted “The British are coming.”', sub: 'historians remain divided. the Duck Tour guide is not one of them.' },
  { eyebrow: 'Please note', main: 'THIS THEATER IS NOT RESPONSIBLE FOR LOST ASCII', sub: 'please check under your seat before leaving' },
  { eyebrow: '◆ Intermission ◆', main: 'STRETCH YOUR LEGS', sub: 'the show will resume in a moment' },
  { eyebrow: 'Movie trivia', main: 'This production used zero (0) real cellos.', sub: 'all string instruments performed by consenting ASCII glyphs.' },
  { eyebrow: 'A gentle reminder', main: 'NO FLASH PHOTOGRAPHY', sub: 'the screen is doing its best' },
];

function buildTimeline(order) {
  const timeline = [];
  order.forEach((scene, sceneIdx) => {
    if (sceneIdx > 0) timeline.push({ interstitial: true });
    scene.beats.forEach(beat => timeline.push({ sceneIdx, beat }));
  });
  return timeline;
}

export function createTheater(container, { preview = false } = {}) {
  buildStyles();

  if (preview) {
    const root = document.createElement('div');
    root.className = 'tab-preview';
    root.setAttribute('aria-hidden', 'true');
    const holes = [0, 60, 120, 180, 240, 300]
      .map(deg => `<div class="reel-hole" style="--a: ${deg}deg"></div>`)
      .join('');
    root.innerHTML = `
      <div class="reel-glow"></div>
      <div class="film-reel">${holes}</div>
    `;
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = document.createElement('div');
  root.className = 'tab-root';

  const curtain = document.createElement('div');
  curtain.className = 'tab-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.textContent = CURTAIN_ROW;

  const screenFrame = document.createElement('div');
  screenFrame.className = 'tab-screen-frame';

  const screen = document.createElement('div');
  screen.className = 'tab-screen';
  screen.setAttribute('tabindex', '-1');
  screen.setAttribute('role', 'region');
  screen.setAttribute('aria-label', 'The Theater — scenes from Truth and Beauty and Paul Revere, performed by ASCII actors. Click to advance, or use the controls below.');

  const slugEl = document.createElement('div');
  slugEl.className = 'tab-slug';
  slugEl.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'tab-stage';
  // The ASCII figures and their speech bubbles are a visual performance —
  // the sr-live region below carries the same content as real text, so the
  // raw glyphs are hidden from assistive tech rather than read character by
  // character.
  stage.setAttribute('aria-hidden', 'true');

  const captionEl = document.createElement('div');
  captionEl.className = 'tab-caption';

  const interstitialEl = document.createElement('div');
  interstitialEl.className = 'tab-interstitial';
  interstitialEl.setAttribute('aria-hidden', 'true'); // narrated via sr-live instead

  screen.appendChild(slugEl);
  screen.appendChild(stage);
  screen.appendChild(captionEl);
  screen.appendChild(interstitialEl);
  screenFrame.appendChild(screen);
  screenFrame.appendChild(buildHouseRow()); // overlays the bottom of the screen, MST3K-style

  const srLive = document.createElement('div');
  srLive.className = 'tab-sr-live';
  srLive.setAttribute('aria-live', 'polite');
  srLive.setAttribute('aria-atomic', 'true');

  const controls = document.createElement('div');
  controls.className = 'tab-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Theater playback controls');
  controls.innerHTML = `
    <button type="button" class="tab-btn" data-act="prev" aria-label="Previous line">&lt; prev</button>
    <button type="button" class="tab-btn" data-act="play" aria-label="Pause">&gt; play</button>
    <button type="button" class="tab-btn" data-act="next" aria-label="Next line">next &gt;</button>
    <span class="tab-progress"></span>
  `;

  root.appendChild(curtain);
  root.appendChild(screenFrame);
  root.appendChild(controls);
  root.appendChild(srLive);
  container.appendChild(root);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  let playOrder = shuffle(SCENES);
  let timeline = buildTimeline(playOrder);
  const actors = {};
  let curSceneIdx = -1;
  let idx = -1;
  let playing = false;
  let timer = null;
  let endCard = null;

  function clearActors() {
    Object.values(actors).forEach(a => a.remove());
    for (const k in actors) delete actors[k];
  }

  function ensureActor(key) {
    if (actors[key]) return actors[key];
    const el = buildActorEl(key);
    stage.appendChild(el);
    actors[key] = el;
    requestAnimationFrame(() => el.classList.add('on'));
    return el;
  }

  function setupScene(sceneIdx) {
    if (sceneIdx === curSceneIdx) return;
    curSceneIdx = sceneIdx;
    clearActors();
    const scene = playOrder[sceneIdx];
    slugEl.textContent = '[ ' + scene.slug + ' ]';
    scene.order.forEach(key => ensureActor(key));
  }

  function clearBubbles() {
    stage.querySelectorAll('.tab-bubble').forEach(b => b.remove());
    Object.values(actors).forEach(a => a.classList.remove('talking'));
    captionEl.classList.remove('on');
  }

  function applyVisibility(showOnly) {
    if (!showOnly) return;
    Object.keys(actors).forEach(k => actors[k].classList.toggle('on', showOnly.includes(k)));
    showOnly.forEach(k => { if (!actors[k]) ensureActor(k); else actors[k].classList.add('on'); });
  }

  function showInterstitialCard() {
    clearBubbles();
    captionEl.textContent = '';
    const card = INTERSTITIALS[Math.floor(Math.random() * INTERSTITIALS.length)];
    interstitialEl.innerHTML = `
      <div class="tab-inter-eyebrow">${escapeHtml(card.eyebrow)}</div>
      <div class="tab-inter-main">${escapeHtml(card.main)}</div>
      ${card.sub ? `<div class="tab-inter-sub">${escapeHtml(card.sub)}</div>` : ''}
    `;
    interstitialEl.classList.add('on');
    srLive.textContent = [card.eyebrow, card.main, card.sub].filter(Boolean).join('. ');
  }

  function showBeat(entry) {
    if (entry.interstitial) {
      showInterstitialCard();
      return;
    }
    interstitialEl.classList.remove('on');

    const { sceneIdx, beat } = entry;
    const sceneChanged = sceneIdx !== curSceneIdx;
    setupScene(sceneIdx);
    clearBubbles();

    if (beat.c && !actors[beat.c]) ensureActor(beat.c);
    if (beat.showOnly) applyVisibility(beat.showOnly);

    let announce = sceneChanged ? `Scene: ${playOrder[sceneIdx].slug}. ` : '';

    if (beat.a) {
      captionEl.textContent = beat.a;
      captionEl.classList.add('on');
      announce += beat.a;
    }

    if (beat.c) {
      const ch = CHARACTERS[beat.c];
      const el = actors[beat.c];
      if (el) {
        const pre = el.querySelector('pre.sf');
        pre.textContent = (POSES[beat.g] || POSES.idle).join('\n');
      }
      const speakerLine = `${ch.name}${beat.voice ? ' (voice)' : ''}: ${beat.t}`;
      if (!beat.silent) {
        if (el) {
          el.classList.add('talking');
          setTimeout(() => el?.classList.remove('talking'), 900);
        }
        // Narrower cowsay box on small phones so the fixed-width ASCII
        // bubble never forces horizontal scrolling.
        const bubbleWidth = (typeof window !== 'undefined' && window.innerWidth < 480) ? 24 : 40;
        const bubble = document.createElement('div');
        bubble.className = 'tab-bubble';
        bubble.innerHTML = `<span class="bubble-name">${ch.name}${beat.voice ? ' (voice)' : ''}</span>${escapeHtml(asciiBubble(beat.t, false, bubbleWidth))}`;
        // Anchored to the speaking actor's own element (position: relative),
        // so the bubble is always centered directly above them.
        (el || stage).appendChild(bubble);
        requestAnimationFrame(() => bubble.classList.add('on'));
        announce += speakerLine;
      } else {
        // Silent reaction beats (e.g. a wordless smile) still carry meaning —
        // read the stage direction even though no bubble is shown.
        announce += speakerLine;
      }
    }

    srLive.textContent = announce.trim();
  }

  function updateProgress() {
    controls.querySelector('.tab-progress').textContent = idx < 0 ? 'start' : `${idx + 1} / ${timeline.length}`;
  }

  function setPlayLabel() {
    const btn = controls.querySelector('[data-act="play"]');
    btn.textContent = playing ? '|| pause' : '> play';
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function scheduleAutoplay() {
    clearTimeout(timer);
    if (!playing) return;
    if (idx >= timeline.length - 1) { playing = false; setPlayLabel(); return; }
    const entry = timeline[idx];
    let dur;
    if (entry?.interstitial) {
      dur = 4400; // a proper beat to read the bumper slide before the next scene starts
    } else {
      const beat = entry?.beat;
      const text = beat?.t || beat?.a || '';
      // Paced for human reading speed, not AI reading speed.
      dur = Math.min(10000, Math.max(1900, text.length * 55));
    }
    timer = setTimeout(() => goTo(idx + 1), dur);
  }

  function showEndCard() {
    if (idx !== timeline.length - 1) return;
    endCard = document.createElement('div');
    endCard.className = 'tab-card';
    endCard.setAttribute('role', 'button');
    endCard.setAttribute('tabindex', '0');
    endCard.setAttribute('aria-label', 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.');
    endCard.innerHTML = `
      <pre class="tab-ascii-title" aria-hidden="true">-------------------------\n     F A D E   T O   B L A C K\n-------------------------</pre>
      <h1>THE END</h1>
      <p class="tab-tap">click for tonight’s next showing</p>
    `;
    endCard.addEventListener('click', restart);
    endCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restart(); }
    });
    screen.appendChild(endCard);
    playing = false;
    setPlayLabel();
    srLive.textContent = 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.';
    setTimeout(() => endCard?.focus(), 50);
  }

  function goTo(newIdx) {
    clearTimeout(timer);
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= timeline.length) newIdx = timeline.length - 1;
    idx = newIdx;
    endCard?.remove();
    showBeat(timeline[idx]);
    if (idx === timeline.length - 1) setTimeout(showEndCard, 2000);
    updateProgress();
    scheduleAutoplay();
  }

  // Reshuffle the reel and start again — a different program each showing.
  function restart() {
    endCard?.remove();
    curSceneIdx = -1;
    clearActors();
    playOrder = shuffle(SCENES);
    timeline = buildTimeline(playOrder);
    idx = -1;
    playing = true;
    setPlayLabel();
    goTo(0);
  }

  controls.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'prev') goTo(Math.max(0, idx - 1));
    else if (act === 'next') goTo(Math.min(timeline.length - 1, idx + 1));
    else if (act === 'play') {
      playing = !playing;
      setPlayLabel();
      if (playing) scheduleAutoplay();
      else clearTimeout(timer);
    }
  });

  screen.addEventListener('click', e => {
    if (e.target.closest('.tab-btn') || e.target.closest('.tab-card')) return;
    if (idx < timeline.length - 1) goTo(idx + 1);
  });

  // Start immediately, mid-program — no title card, as if you'd just found your seat.
  playing = true;
  setPlayLabel();
  goTo(0);
  setTimeout(() => screen.focus(), 100);

  return {
    dispose() {
      clearTimeout(timer);
      root.remove();
    }
  };
}

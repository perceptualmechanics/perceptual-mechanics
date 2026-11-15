"""Cuts Euphonia's type from its sources: EB Garamond, roman and italic, for
the page and the globe, and a face for each other script the page sets, each
holding only the characters the page inks.

What the page inks comes from verify-euphonia-tongues (`--inventory`): the
page's text as the build makes it, the data it loads and the ribbons' words
in capitals. A character goes to the first family in the type stack that has
it, as the browser would look for it, and the gate holds every one to a
shipped face.

  python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
  /tmp/fontenv/bin/python scripts/euphonia-fonts.py <folder of source fonts>

The sources are the Google Fonts repository's files (github.com/google/fonts,
ofl/), all under the SIL Open Font License 1.1, checked by SHA-256 so a cut
can be repeated exactly.
"""
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/fonts/euphonia'

# Each face, by the file euphonia.css declares: its source, the source's
# digest, and the weights it keeps. The page's text is set at 400 and its
# headings at 600, so each theme's Latin face keeps that span of its weight
# axis; the other faces set only the ribbons' words and the panel's lists, at
# 400.
BODY = (400, 600)
FACES = {
    'eb-garamond.woff2': ('EBGaramond[wght].ttf', 'ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027', BODY),
    'eb-garamond-italic.woff2': ('EBGaramond-Italic[wght].ttf', 'bba2c4499c93c9612b90b9825d32b07da52fce2fe57562a1eb6b833553f93c4e', BODY),
    'alegreya.woff2': ('Alegreya[wght].ttf', 'ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12', BODY),
    'alegreya-italic.woff2': ('Alegreya-Italic[wght].ttf', 'fa915eec76227935dc5fb678953c94b71287c360928013cfdb441dfe52f5a391', BODY),
    'amiri-text.woff2': ('Amiri-Regular.ttf', 'ab391c4147d054c48976e98322ad0eefe1427aa0e0502a12a4c75d80a70cfcd7', 400),
    'amiri-text-bold.woff2': ('Amiri-Bold.ttf', 'cfccb794268e7d573d857e6d6a67f89cf8a053e8ffd85dfa0c8ec1bb36fc4827', 700),
    'amiri-text-italic.woff2': ('Amiri-Italic.ttf', '770e4da44d0459c0ddd6484483d475b95f2d088dd27ce472427624081eb68c70', 400),
    'noto-serif.woff2': ('NotoSerif[wdth,wght].ttf', '4d8e6761424656867019081a1a01336f3cb086982682698714054fc33f782713', BODY),
    'noto-serif-italic.woff2': ('NotoSerif-Italic[wdth,wght].ttf', 'e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1', BODY),
    'source-serif.woff2': ('SourceSerif4[opsz,wght].ttf', '97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b', BODY),
    'source-serif-italic.woff2': ('SourceSerif4-Italic[opsz,wght].ttf', '15fbc7e4679489a501998c3669272637a6646388ef7e4bd77eebb5bf967a1f42', BODY),
    'gentium.woff2': ('GentiumBookPlus-Regular.ttf', 'fe7b64eeacc430fcf46836a6f0dfe00d2c5a15483ed36692a2a185cb23ec2a5c', 400),
    'gentium-bold.woff2': ('GentiumBookPlus-Bold.ttf', 'b39c3fb12e2e15e2336f2ec6d051c778618ec25f7360bc4765bfe755b408c011', 700),
    'gentium-italic.woff2': ('GentiumBookPlus-Italic.ttf', '7a0ab4bd78701fa46d325e362654c41a47e2a0a5cb4a3eebc94dce89c2ee7df1', 400),
    'noto-nastaliq-400.woff2': ('NotoNastaliqUrdu[wght].ttf', '98a4787f34eb6fde57fb9a1121a8f216301196ab0da98ea110cad581be8abbcd', 400),
    'amiri-400.woff2': ('Amiri-Regular.ttf', 'ab391c4147d054c48976e98322ad0eefe1427aa0e0502a12a4c75d80a70cfcd7', 400),
    'noto-serif-armenian-400.woff2': ('NotoSerifArmenian[wdth,wght].ttf', '9354b74384d093d59f9a4ad958e188808d58b6f15debeaab18e07bc432f8ce0c', 400),
    'noto-serif-georgian-400.woff2': ('NotoSerifGeorgian[wdth,wght].ttf', 'a13a90c44a612ab80f79032d3edbbc7f6757f0c6b1613dba1a92f38077cccc57', 400),
    'noto-serif-hebrew-400.woff2': ('NotoSerifHebrew[wdth,wght].ttf', '93caef921360788dc3b0e32136bb26f16bc57717ec482d48fc7fd43820617165', 400),
    'noto-serif-devanagari-400.woff2': ('NotoSerifDevanagari[wdth,wght].ttf', '1191e07bfeb062d80e252eb85b0eafdfbda1e350707a2a60628668e8f677dbbb', 400),
    'noto-serif-bengali-400.woff2': ('NotoSerifBengali[wdth,wght].ttf', '083180a7b47cf3b101ed55a8724aa1b38869daa9baf23b7cf198f9d225365aba', 400),
    'noto-serif-tamil-400.woff2': ('NotoSerifTamil[wdth,wght].ttf', '4b10fe56ee22907a80136c16dbe386ee20f3bf116332b35128bb35eeb775d91e', 400),
    'noto-serif-sinhala-400.woff2': ('NotoSerifSinhala[wdth,wght].ttf', '2b0df6b8bde56d3b934ba89fada82486b1ec50ee06842c81be36496f8c9b5ac9', 400),
    'noto-serif-tc-400.woff2': ('NotoSerifTC[wght].ttf', '0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6', 400),
    'noto-serif-kr-400.woff2': ('NotoSerifKR[wght].ttf', '11f8d5de6f1b79195efba3828aaa2ec95c1178f5ae976fb23c8d53250a9938f3', 400),
    'noto-serif-jp-400.woff2': ('NotoSerifJP[wght].ttf', '2fd527ba12b6a44ec30d796d633360da0aeba6c5d4af1304ce12bb4dc15a7dfc', 400),
    'noto-serif-khmer-400.woff2': ('NotoSerifKhmer[wdth,wght].ttf', '50ad032042491e98b440e41490d26b716d8d43886eebfafa9735f6284c1980e2', 400),
    'noto-serif-lao-400.woff2': ('NotoSerifLao[wdth,wght].ttf', 'c35bb3fbbdbd88c0d8ce5ee13e4854cb51471d9b809108570876b48c8f970df6', 400),
    'noto-serif-myanmar-400.woff2': ('NotoSerifMyanmar-Regular.ttf', 'f88d1da5a75a8e09ff0b073fe3c861d095a72e94fea3235f09f80e6c5b2c9933', 400),
    'noto-serif-ethiopic-400.woff2': ('NotoSerifEthiopic[wdth,wght].ttf', '49d5daa6c3477a427f5d4f8a5ae9ea7f0a04ea7f865fc21f7e08fc4aed70d92a', 400),
    'noto-serif-tibetan-400.woff2': ('NotoSerifTibetan[wght].ttf', '060ec022b04c306de3f58d051fb0e1cf81a5b610c5910fbfc43bba154c057cda', 400),
    'noto-serif-thai-400.woff2': ('NotoSerifThai[wdth,wght].ttf', '34a7ad11647c845303aabdde639059806c56b84719e5d2ceb28eb038711bdf53', 400),
    # The marks no text face has, last in every stack: the ✦ that marks where
    # Euphonia departs from our history.
    'noto-sans-symbols-400.woff2': ('NotoSansSymbols2-Regular.ttf', '7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21', 400),
}

# The faces whose small capitals the page sets: the Wheel's planes, in each
# theme's roman.
SMALL_CAPS = {'eb-garamond.woff2', 'alegreya.woff2', 'noto-serif.woff2', 'source-serif.woff2', 'gentium.woff2'}

# Each theme's Latin face also sets the page's interface, whose words are in
# its scripts rather than its data, so it keeps the whole of Basic Latin,
# Latin-1, Latin Extended-A and the page's punctuation whatever the inventory
# holds.
LATIN_TEXT = ''.join(map(chr, [*range(0x20, 0x7F), *range(0xA0, 0x180)])) + '‘’“”–—…·°′″×−'


def source(src, face):
    file, digest, _ = FACES[face]
    path = Path(src) / file
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise SystemExit(f'{file}: not the source this cut was made from')
    return TTFont(path)


def weighed(font, face):
    """Every axis at its default but weight, which is held at the face's weight
    or kept across its span. Done after the subset: fontTools' subsetter loses
    glyphs that features reach (EB Garamond's small capitals) in a font whose
    weights have already been narrowed."""
    if 'fvar' not in font:
        return font
    axes = {a.axisTag: a.defaultValue for a in font['fvar'].axes}
    axes['wght'] = FACES[face][2]
    return instantiateVariableFont(font, axes)


def main(src):
    inventory = json.loads(subprocess.run(['node', str(ROOT / 'scripts/verify-euphonia-tongues.mjs'), '--inventory'],
                                          check=True, capture_output=True, text=True).stdout)
    declared = {f for theme in inventory['themes'] for family in theme['families'] for f in family}
    if declared != set(FACES):
        raise SystemExit(f'the themes and FACES disagree: {sorted(declared ^ set(FACES))}')
    fonts = {face: source(src, face) for face in FACES}
    cmaps = {face: font.getBestCmap() for face, font in fonts.items()}
    # A theme that sets small capitals must have them in its Latin face.
    for theme in inventory['themes']:
        roman = theme['families'][0][0]
        has = 'GSUB' in fonts[roman] and any(r.FeatureTag == 'smcp' for r in fonts[roman]['GSUB'].table.FeatureList.FeatureRecord)
        if theme['smallCaps'] and not has:
            raise SystemExit(f"{theme['id']}: claims small capitals its face ({roman}) lacks")
        if theme['smallCaps'] != (roman in SMALL_CAPS):
            raise SystemExit(f"{theme['id']}: SMALL_CAPS and the theme disagree about {roman}")
    # In each theme, each character to the first family whose faces all have
    # it; a face keeps what any theme sends it.
    wanted = {face: set() for face in FACES}
    for theme in inventory['themes']:
        for c in inventory['chars']:
            family = next((fam for fam in theme['families'] if all(ord(c) in cmaps[f] for f in fam)), None)
            if family is None:
                raise SystemExit(f"{theme['id']}: no face has U+{ord(c):04X} ({c})")
            for f in family:
                wanted[f].add(c)
        for f in theme['families'][0]:
            wanted[f].update(LATIN_TEXT)
    OUT.mkdir(parents=True, exist_ok=True)
    # Only the faces declared live here. The folder is in iCloud Drive, which
    # keeps a rewritten file's rival as "name 2.woff2", so anything else goes,
    # and a face is written only when its bytes change.
    for stray in OUT.iterdir():
        if stray.name not in FACES:
            stray.unlink()
    for face, chars in wanted.items():
        font = fonts[face]
        options = Options()
        # fontTools' default features are the shaping each script needs (Arabic
        # joining, Indic reordering, marks, kerning); the rest only adds weight,
        # but for the roman's small capitals, which set the Wheel's planes.
        options.notdef_outline = True
        if face in SMALL_CAPS:
            options.layout_features = [*options.layout_features, 'smcp']
        subsetter = Subsetter(options)
        subsetter.populate(text=''.join(sorted(chars)))
        subsetter.subset(font)
        font = weighed(font, face)
        font.flavor = 'woff2'
        # The source's date, not today's, so the same cut gives the same bytes.
        font.recalcTimestamp = False
        cut = io.BytesIO()
        font.save(cut)
        path = OUT / face
        if not path.exists() or path.read_bytes() != cut.getvalue():
            path.write_bytes(cut.getvalue())
        print(f'{face}: {len(chars)} characters, {path.stat().st_size} bytes')


if __name__ == '__main__':
    main(sys.argv[1])

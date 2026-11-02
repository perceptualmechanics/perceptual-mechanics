// Prints every word of a PDF with where it sits and how it's set, one per
// line: page, x, y (from the page's top), width, size, font, word,
// tab-separated.
// The SRD's tables and two columns come back from the positions, and its
// headings and trait names from the fonts; a table's stacked headers find
// their columns by the words' widths. macOS only (PDFKit), and only for
// refreshing the vendored SRD export:
//   swift scripts/srd-words.swift SRD_CC_v5.2.1.pdf > srd-words.tsv
import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count == 2, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
  FileHandle.standardError.write("usage: swift srd-words.swift <pdf>\n".data(using: .utf8)!)
  exit(1)
}
for p in 0..<doc.pageCount {
  guard let page = doc.page(at: p), let plain = page.string else { continue }
  let height = page.bounds(for: .mediaBox).height
  // Positions index the page's plain string; the attributed one, for fonts,
  // has to agree with it character for character to be used.
  let string = plain as NSString
  let text = page.attributedString
  let fonts = text?.string == plain
  var i = 0
  while i < string.length {
    // A word: a run of characters that aren't whitespace.
    let c = string.character(at: i)
    if let s = Unicode.Scalar(c), CharacterSet.whitespacesAndNewlines.contains(s) { i += 1; continue }
    var j = i
    while j < string.length, let s = Unicode.Scalar(string.character(at: j)), !CharacterSet.whitespacesAndNewlines.contains(s) { j += 1 }
    // The word's own selection bounds: a single character's by index proved
    // unreliable here (the "5" of a table's "Level 5" came back at the other
    // edge of the page).
    let first = page.selection(for: NSRange(location: i, length: j - i))?.bounds(for: page) ?? page.characterBounds(at: i)
    let font = fonts ? text?.attribute(.font, at: i, effectiveRange: nil) as? NSFont : nil
    let word = string.substring(with: NSRange(location: i, length: j - i))
    print("\(p + 1)\t\(String(format: "%.1f", first.minX))\t\(String(format: "%.1f", height - first.maxY))\t\(String(format: "%.1f", first.width))\t\(String(format: "%.1f", font?.pointSize ?? 0))\t\(font?.fontName ?? "")\t\(word)")
    i = j
  }
}

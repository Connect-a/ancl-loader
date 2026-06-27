// 正規化: ひらがな→カタカナ、小書き→通常カナ、全角英数→半角、小文字化、濁点・半濁点除去、記号除去。
export function normalizeForSearch(str: string): string {
  return str
    .replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60))
    .replace(/[ァィゥェォッャュョヮ]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 1))
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u3099\u309A]/g, '')
    .replace(/[・･＝＊ー\-\s]/g, '');
}

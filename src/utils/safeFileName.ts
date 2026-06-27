// Windows/ZIPで使用不可なファイル名文字を全角（+0xFEE0）に置換する。
export const toSafeFileName = (name: string): string => name.replace(/[/\\:*?"<>|]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));

export const range = (from: number, to: number): Array<number> => Array.from({ length: to - from + 1 }, (_, i) => from + i);

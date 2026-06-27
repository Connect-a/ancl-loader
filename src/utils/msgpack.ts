import { decode, encode } from '@msgpack/msgpack';

export const encodeMsgpack = (value: unknown) => encode(value);

export const decodeMsgpack = <T>(data: BufferSource): T => decode(data) as T;

export const encodeBase64Msgpack = (value: unknown): string => encodeMsgpack(value).toBase64();

export const decodeBase64Msgpack = <T>(raw: string | null | undefined): T | undefined => {
  if (!raw) return undefined;
  try {
    return decodeMsgpack<T>(Uint8Array.fromBase64(raw));
  } catch {
    return undefined;
  }
};

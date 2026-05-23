declare module "upng-js" {
  const UPNG: {
    encode(
      bufs: ArrayBuffer[],
      width: number,
      height: number,
      cnum: number,
      dels?: number[],
      forbidPlte?: boolean,
    ): ArrayBuffer;
    decode(buf: ArrayBuffer): {
      width: number;
      height: number;
      depth: number;
      ctype: number;
      frames: unknown[];
      tabs: Record<string, unknown>;
      data: Uint8Array;
    };
    toRGBA8(img: ReturnType<typeof UPNG.decode>): ArrayBuffer[];
  };
  export default UPNG;
}

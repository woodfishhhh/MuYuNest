declare module "liquid-gl" {
  interface LiquidGLInstance {}

  interface LiquidGLOptions {
    aberration?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    frost?: number;
    magnify?: number;
    on?: {
      init?: (instance: LiquidGLInstance) => void;
    };
    refraction?: number;
    resolution?: number;
    reveal?: "fade" | "none";
    shadow?: boolean;
    snapshot?: string;
    specular?: boolean;
    target: string;
    tilt?: boolean;
    tiltEase?: number;
    tiltFactor?: number;
  }

  interface LiquidGL {
    (options: LiquidGLOptions): LiquidGLInstance | LiquidGLInstance[] | undefined;
    registerDynamic(elements: string | Element[]): void;
  }

  const liquidGL: LiquidGL;
  export default liquidGL;
}

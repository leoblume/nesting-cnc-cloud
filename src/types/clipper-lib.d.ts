// Tipos mínimos ambientes para clipper-lib (o pacote não publica @types).
// Cobre apenas a API usada pelo motor de LEDs (offset de polígono).
declare module "clipper-lib" {
  export interface IntPoint {
    X: number;
    Y: number;
  }

  export type Path = IntPoint[];
  export type Paths = Path[];

  export const JoinType: {
    jtSquare: number;
    jtRound: number;
    jtMiter: number;
  };

  export const EndType: {
    etOpenSquare: number;
    etOpenRound: number;
    etOpenButt: number;
    etClosedLine: number;
    etClosedPolygon: number;
  };

  export class ClipperOffset {
    constructor(miterLimit?: number, arcTolerance?: number);
    AddPath(path: Path, joinType: number, endType: number): void;
    AddPaths(paths: Paths, joinType: number, endType: number): void;
    Execute(solution: Paths, delta: number): void;
  }

  const ClipperLib: {
    ClipperOffset: typeof ClipperOffset;
    JoinType: typeof JoinType;
    EndType: typeof EndType;
    Paths: new () => Paths;
  };

  export default ClipperLib;
}

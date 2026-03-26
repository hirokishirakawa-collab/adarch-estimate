export interface VideoMeta {
  duration: number;  // seconds
  fps: number;
  width: number;
  height: number;
}

export type ChangeCategory =
  | "TELOP"
  | "CUT_REPLACE"
  | "COLOR"
  | "DURATION"
  | "ANIMATION"
  | "OTHER";

export interface DetectedChange {
  type: ChangeCategory;
  timecodeIn: number;   // seconds (in after-video timeline)
  timecodeOut?: number;
  description: string;
  confidence: number;   // 0-1
  beforeFramePath?: string;
  afterFramePath?: string;
  diffFramePath?: string;
  regionX?: number;
  regionY?: number;
  regionWidth?: number;
  regionHeight?: number;
}

export interface SceneSegment {
  index: number;
  startTime: number;
  endTime: number;
  keyFramePath: string;
  avgColor: [number, number, number];
  edgeScore: number;
}

export interface SceneMatch {
  beforeScene: SceneSegment;
  afterScene: SceneSegment;
  similarity: number;
}

export interface AnalysisResult {
  changes: DetectedChange[];
  beforeMeta: VideoMeta;
  afterMeta: VideoMeta;
  sceneMatches: SceneMatch[];
}

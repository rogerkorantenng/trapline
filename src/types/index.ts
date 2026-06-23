export type WebViewMessage =
  | { type: 'INIT'; data?: { anonId?: string } }
  | { type: 'SUBMIT_RUN'; data: { courseId: string; timeMs: number; deathCount: number; replayData: ReplayFrame[]; anonId?: string } }
  | { type: 'GET_LEADERBOARD'; data: { courseId: string } }
  | { type: 'GET_GHOST'; data: { courseId: string } }
  | { type: 'SAVE_COURSE'; data: { course: CourseData } }
  | { type: 'GET_COURSE'; data: { courseId: string } }
  | { type: 'LIST_COURSES' }
  | { type: 'GET_GAUNTLET' }
  | { type: 'PROPOSE_GAUNTLET'; data: { segment: SegmentData; proposerName: string } }
  | { type: 'GET_PROPOSALS' }
  | { type: 'UPVOTE_PROPOSAL'; data: { proposalId: string } }
  | { type: 'SHARE_RUN'; data: { courseTitle: string; timeMs: number; deathCount: number; medal: string } }
  | { type: 'RECORD_DEATH'; data: { courseId: string; x: number; y: number; taunt?: string } }
  | { type: 'GET_DEATH_GRAVEYARD'; data: { courseId: string } }
  | { type: 'GET_DAILY_COURSE' }
  | { type: 'DELETE_COURSE'; data: { courseId: string } };

export interface ReplayFrame {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: string;
  facing: number;
}

export interface TileData {
  x: number;
  y: number;
  type: string;
  variant?: number;
}

export interface CourseData {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  tiles: TileData[];
  medals: { bronze: number; silver: number; gold: number; author: number };
  difficulty?: number;
  createdAt: number;
}

export interface SegmentData {
  tiles: TileData[];
  width: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  timeMs: number;
  deathCount: number;
  rank: number;
  medal: 'bronze' | 'silver' | 'gold' | 'author' | null;
}

export interface GraveMarker {
  x: number;
  y: number;
  taunt?: string;
  userId: string;
}

export interface GauntletState {
  seasonId: number;
  sections: GauntletSection[];
  updatedAt: number;
}

export interface GauntletSection {
  tiles: TileData[];
  width: number;
  proposerId: string;
  proposerName: string;
  addedAt: number;
}

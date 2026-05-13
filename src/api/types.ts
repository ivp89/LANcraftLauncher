export interface EntityReference {
  id: string;
  name: string;
  updatedOn: string;
}

export interface Media {
  id: string;
  fileId: string;
  name: string;
  type: MediaType;
  sourceUrl: string;
  mimeType: string;
  crc32: string;
  sortOrder: number;
}

export enum MediaType {
  Icon = 0,
  Cover = 1,
  Background = 2,
  Avatar = 3,
  Logo = 4,
  Manual = 5,
  Thumbnail = 6,
  PageImage = 7,
  Grid = 8,
  Screenshot = 9,
  Video = 10,
}

export enum GameType {
  MainGame = 0,
  Expansion = 1,
  StandaloneExpansion = 2,
  Mod = 3,
  StandaloneMod = 4,
}

export interface Genre {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Collection {
  id: string;
  name: string;
}

export interface DepotGame {
  id: string;
  collections: Collection[] | null;
}

export interface DepotResult {
  games: DepotGame[] | null;
  collections: Collection[] | null;
}

export interface Company {
  id: string;
  name: string;
}

export interface Platform {
  id: string;
  name: string;
}

export interface Archive {
  id: string;
  version: string;
  changelog: string;
  objectKey: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface GameAction {
  id: string;
  name: string;
  path: string;
  arguments?: string;
  workingDirectory?: string;
  isPrimaryAction: boolean;
  sortOrder: number;
  variables?: Record<string, string>;
}

export interface MultiplayerMode {
  type: string;
  minPlayers: number;
  maxPlayers: number;
}

export enum SavePathType {
  File = 0,
  Registry = 1,
}

export interface SavePath {
  id: string;
  type: SavePathType;
  path: string;
  workingDirectory?: string;
  isRegex: boolean;
}

export interface Game {
  id: string;
  title: string;
  sortTitle?: string;
  directoryName?: string;
  description?: string;
  notes?: string;
  singleplayer: boolean;
  releasedOn: string;
  inLibrary: boolean;
  installDirectory?: string;
  type: GameType | number;
  baseGameId?: string;
  media: Media[] | null;
  genres: Genre[] | null;
  tags: Tag[] | null;
  collections: Collection[] | null;
  developers: Company[] | null;
  publishers: Company[] | null;
  platforms: Platform[] | null;
  archives: Archive[] | null;
  actions: GameAction[] | null;
  multiplayerModes: MultiplayerMode[] | null;
  savePaths: SavePath[] | null;
}

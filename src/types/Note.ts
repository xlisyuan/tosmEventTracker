export type NoteState = 'CD' | 'ON' | `STAGE_${number}`;

export interface Note {
    id: string;
    mapLevel: number;
    noteText:string;
    channel: number;
    respawnTime: number;
    state: NoteState;
    isStarred: boolean;
    hasSound: boolean;
    maxStages: number;
    onTime: number | null;
    hasAlerted: boolean;
    isWarning?: boolean;
    isHighlight?: boolean;
}

export interface Map {
    episode: number;
    level: number;
    name: string;
    maxStages: number;
}
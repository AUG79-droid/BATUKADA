export type Syllable = 'DUM' | 'TA' | 'TI';

export interface Stroke {
  syllable: Syllable;
  accent: boolean;
}

export interface Exercise {
  id: string;
  number: number;
  meter: '4/4' | '3/4' | '6/8';
  patternRaw: string;
  bars: Stroke[][];
}

export interface AudioOptions {
  bpm: number;
  repetitions: number;
  countIn: boolean;
  introduction: boolean;
  voiceName?: string;
}

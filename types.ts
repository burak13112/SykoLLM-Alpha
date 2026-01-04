
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
  images?: string[]; // Base64 strings
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  tag: string; // e.g., ALPHA, BETA
  description: string;
  supportsImages: boolean; // New flag
}

export enum Theme {
  DARK = 'dark',
  LIGHT = 'light',
}

export interface UserWallet {
  balance: number;
  proCredits: number; // Purchased extra messages for Pro model
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  proCount: number;
  imageCount: number;
}

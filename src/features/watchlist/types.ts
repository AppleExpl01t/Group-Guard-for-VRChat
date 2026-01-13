export interface WatchedEntity {
  id: string; 
  type: 'user' | 'group' | 'avatar' | 'world';
  displayName: string;
  tags: string[];
  notes: string;
  priority: number;
  critical: boolean;
  silent: boolean;
  updatedAt?: number;
}

export interface ModerationTag {
  id: string;
  label: string;
  color?: string;
  description?: string;
}

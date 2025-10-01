/**
 * Player information types
 */

/**
 * Player information
 */
export interface Player {
  /** Player unique ID (XUID or generated) */
  id: string;
  
  /** Player display name */
  name: string;
  
  /** Xbox User ID */
  xuid: string;
  
  /** Player IP address (if available) */
  ipAddress?: string;
  
  /** Player port */
  port?: number;
  
  /** Player icon (base64) */
  icon?: string;
  
  /** Player join timestamp */
  joinTime: Date;
  
  /** Player leave timestamp (if disconnected) */
  leaveTime?: Date;
}

/**
 * Player action type
 */
export type PlayerAction = 'join' | 'leave';

/**
 * Player packet information
 */
export interface PlayerPacket {
  /** Player name */
  name: string;
  
  /** Xbox User ID */
  xuid: string;
  
  /** Player action */
  action: PlayerAction;
  
  /** IP address */
  ipAddress?: string;
  
  /** Port */
  port?: number;
  
  /** Player icon */
  icon?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Player statistics
 */
export interface PlayerStats {
  /** Total play time in milliseconds */
  totalPlayTime: number;
  
  /** Number of times joined */
  joinCount: number;
  
  /** Last seen timestamp */
  lastSeen: Date;
  
  /** First seen timestamp */
  firstSeen: Date;
}

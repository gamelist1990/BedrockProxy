/**
 * Event system types
 */

import type { Player, PlayerPacket } from './player';
import type { ServerInfo } from './server';

/**
 * Event types
 */
export type EventType =
  | 'playerJoin'
  | 'playerLeave'
  | 'serverStart'
  | 'serverStop'
  | 'serverStatusChange'
  | 'consoleOutput'
  | 'consoleCommand'
  | 'error';

/**
 * Event handler function
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Player join event data
 */
export interface PlayerJoinEvent {
  /** Player information */
  player: Player;
  
  /** Server ID */
  serverId: string;
  
  /** Current player count after join */
  currentPlayerCount: number;
}

/**
 * Player leave event data
 */
export interface PlayerLeaveEvent {
  /** Player information */
  player: Player;
  
  /** Server ID */
  serverId: string;
  
  /** Current player count after leave */
  currentPlayerCount: number;
  
  /** Reason for leaving (if available) */
  reason?: string;
}

/**
 * Server start event data
 */
export interface ServerStartEvent {
  /** Server information */
  server: ServerInfo;
  
  /** Start timestamp */
  timestamp: Date;
}

/**
 * Server stop event data
 */
export interface ServerStopEvent {
  /** Server information */
  server: ServerInfo;
  
  /** Stop timestamp */
  timestamp: Date;
  
  /** Reason for stopping */
  reason?: string;
}

/**
 * Server status change event data
 */
export interface ServerStatusChangeEvent {
  /** Server information */
  server: ServerInfo;
  
  /** Old status */
  oldStatus: ServerInfo['status'];
  
  /** New status */
  newStatus: ServerInfo['status'];
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Console output event data
 */
export interface ConsoleOutputEvent {
  /** Output line */
  line: string;
  
  /** Server ID */
  serverId: string;
  
  /** Output type */
  type: 'stdout' | 'stderr';
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Console command event data
 */
export interface ConsoleCommandEvent {
  /** Command string */
  command: string;
  
  /** Server ID */
  serverId: string;
  
  /** User who sent command (if applicable) */
  user?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Error event data
 */
export interface ErrorEvent {
  /** Error message */
  message: string;
  
  /** Error stack trace */
  stack?: string;
  
  /** Error code */
  code?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Event data mapping
 */
export interface EventDataMap {
  playerJoin: PlayerJoinEvent;
  playerLeave: PlayerLeaveEvent;
  serverStart: ServerStartEvent;
  serverStop: ServerStopEvent;
  serverStatusChange: ServerStatusChangeEvent;
  consoleOutput: ConsoleOutputEvent;
  consoleCommand: ConsoleCommandEvent;
  error: ErrorEvent;
}

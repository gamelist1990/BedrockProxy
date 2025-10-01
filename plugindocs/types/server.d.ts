/**
 * Server information types
 */

/**
 * Server status
 */
export type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'error';

/**
 * Server mode
 */
export type ServerMode = 'normal' | 'proxyOnly';

/**
 * Server information
 */
export interface ServerInfo {
  /** Server unique ID */
  id: string;
  
  /** Server name */
  name: string;
  
  /** Server status */
  status: ServerStatus;
  
  /** Server mode */
  mode: ServerMode;
  
  /** Listening address (proxy address) */
  address: string;
  
  /** Destination address (target server) */
  destinationAddress: string;
  
  /** Current player count */
  playersOnline: number;
  
  /** Maximum players allowed */
  maxPlayers: number;
  
  /** Server tags */
  tags?: string[];
  
  /** Server description */
  description?: string;
  
  /** Server creation timestamp */
  createdAt: Date;
  
  /** Server last update timestamp */
  updatedAt: Date;
}

/**
 * Server statistics
 */
export interface ServerStats {
  /** Total uptime in milliseconds */
  uptime: number;
  
  /** Total players joined (all time) */
  totalJoins: number;
  
  /** Peak player count */
  peakPlayers: number;
  
  /** Average player count */
  averagePlayers: number;
  
  /** Server start time */
  startTime?: Date;
}

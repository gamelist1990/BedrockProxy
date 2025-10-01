import { logger } from "./logger.js";

/**
 * Proxy Protocol v2 パーサー
 * HAProxy PROXY Protocol v2 の仕様に基づいてヘッダーを解析
 * 参照: https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt
 */

export interface ProxyProtocolV2Header {
  version: number;
  command: 'LOCAL' | 'PROXY';
  family: 'UNSPEC' | 'INET' | 'INET6' | 'UNIX';
  protocol: 'UNSPEC' | 'STREAM' | 'DGRAM';
  sourceAddress: string;
  destAddress: string;
  sourcePort: number;
  destPort: number;
  headerLength: number; // ヘッダー全体の長さ（シグネチャ含む）
  tlvData?: Buffer; // TLV（Type-Length-Value）拡張データ
  rawHeader?: Buffer; // デバッグ用：生のヘッダーデータ
}

export interface ProxyProtocolChain {
  headers: ProxyProtocolV2Header[]; // 多段プロキシのヘッダーチェーン
  originalClientIP: string; // 最も元のクライアントIP
  originalClientPort: number; // 最も元のクライアントポート
  proxyChain: string[]; // プロキシチェーン（IP:Port形式）
  payload: Buffer; // すべてのヘッダーを除去した最終ペイロード
}

// Proxy Protocol v2 シグネチャ
const PROXY_V2_SIGNATURE = Buffer.from([
  0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51,
  0x55, 0x49, 0x54, 0x0A
]);

const PROXY_V2_MIN_LENGTH = 16; // 最小ヘッダー長

/**
 * バッファが Proxy Protocol v2 のシグネチャで始まるかチェック
 */
export function isProxyProtocolV2(data: Buffer): boolean {
  if (data.length < PROXY_V2_SIGNATURE.length) {
    return false;
  }
  
  return data.subarray(0, PROXY_V2_SIGNATURE.length).equals(PROXY_V2_SIGNATURE);
}

/**
 * Proxy Protocol v2 ヘッダーを解析
 * @param data 受信したデータバッファ
 * @returns パース結果。パース失敗時は null
 */
export function parseProxyProtocolV2(data: Buffer): ProxyProtocolV2Header | null {
  try {
    // 最小長チェック
    if (data.length < PROXY_V2_MIN_LENGTH) {
      logger.debug('proxy-protocol', 'Data too short for Proxy Protocol v2', {
        length: data.length
      });
      return null;
    }

    // シグネチャチェック
    if (!isProxyProtocolV2(data)) {
      return null;
    }

    // バージョンとコマンド (13バイト目)
    const versionAndCommand = data[12];
    const version = (versionAndCommand & 0xF0) >> 4;
    const commandBit = versionAndCommand & 0x0F;

    if (version !== 2) {
      logger.debug('proxy-protocol', 'Invalid version', { version });
      return null;
    }

    const command = commandBit === 0x01 ? 'PROXY' : 'LOCAL';

    // ファミリーとプロトコル (14バイト目)
    const familyAndProtocol = data[13];
    const familyBit = (familyAndProtocol & 0xF0) >> 4;
    const protocolBit = familyAndProtocol & 0x0F;

    let family: ProxyProtocolV2Header['family'];
    switch (familyBit) {
      case 0x00: family = 'UNSPEC'; break;
      case 0x01: family = 'INET'; break;
      case 0x02: family = 'INET6'; break;
      case 0x03: family = 'UNIX'; break;
      default:
        logger.debug('proxy-protocol', 'Unknown family', { familyBit });
        return null;
    }

    let protocol: ProxyProtocolV2Header['protocol'];
    switch (protocolBit) {
      case 0x00: protocol = 'UNSPEC'; break;
      case 0x01: protocol = 'STREAM'; break;
      case 0x02: protocol = 'DGRAM'; break;
      default:
        logger.debug('proxy-protocol', 'Unknown protocol', { protocolBit });
        return null;
    }

    // アドレス長 (15-16バイト目、ビッグエンディアン)
    const addressLength = data.readUInt16BE(14);
    const totalHeaderLength = PROXY_V2_SIGNATURE.length + 4 + addressLength;

    if (data.length < totalHeaderLength) {
      logger.debug('proxy-protocol', 'Incomplete header', {
        dataLength: data.length,
        expectedLength: totalHeaderLength
      });
      return null;
    }

    // LOCALコマンドの場合、アドレス情報は無視
    if (command === 'LOCAL') {
      return {
        version: 2,
        command: 'LOCAL',
        family: 'UNSPEC',
        protocol: 'UNSPEC',
        sourceAddress: '',
        destAddress: '',
        sourcePort: 0,
        destPort: 0,
        headerLength: totalHeaderLength
      };
    }

    // アドレス情報の解析（PROXYコマンドの場合）
    let sourceAddress = '';
    let destAddress = '';
    let sourcePort = 0;
    let destPort = 0;

    if (family === 'INET' && protocol === 'DGRAM') {
      // IPv4 over UDP
      if (addressLength < 12) {
        logger.debug('proxy-protocol', 'Invalid INET address length', { addressLength });
        return null;
      }

      sourceAddress = [
        data[16],
        data[17],
        data[18],
        data[19]
      ].join('.');

      destAddress = [
        data[20],
        data[21],
        data[22],
        data[23]
      ].join('.');

      sourcePort = data.readUInt16BE(24);
      destPort = data.readUInt16BE(26);

    } else if (family === 'INET6' && protocol === 'DGRAM') {
      // IPv6 over UDP
      if (addressLength < 36) {
        logger.debug('proxy-protocol', 'Invalid INET6 address length', { addressLength });
        return null;
      }

      const srcAddr = data.subarray(16, 32);
      const dstAddr = data.subarray(32, 48);

      sourceAddress = formatIPv6(srcAddr);
      destAddress = formatIPv6(dstAddr);

      sourcePort = data.readUInt16BE(48);
      destPort = data.readUInt16BE(50);

    } else if (family === 'INET' && protocol === 'STREAM') {
      // IPv4 over TCP
      if (addressLength < 12) {
        logger.debug('proxy-protocol', 'Invalid INET address length for TCP', { addressLength });
        return null;
      }

      sourceAddress = [
        data[16],
        data[17],
        data[18],
        data[19]
      ].join('.');

      destAddress = [
        data[20],
        data[21],
        data[22],
        data[23]
      ].join('.');

      sourcePort = data.readUInt16BE(24);
      destPort = data.readUInt16BE(26);

    } else if (family === 'INET6' && protocol === 'STREAM') {
      // IPv6 over TCP
      if (addressLength < 36) {
        logger.debug('proxy-protocol', 'Invalid INET6 address length for TCP', { addressLength });
        return null;
      }

      const srcAddr = data.subarray(16, 32);
      const dstAddr = data.subarray(32, 48);

      sourceAddress = formatIPv6(srcAddr);
      destAddress = formatIPv6(dstAddr);

      sourcePort = data.readUInt16BE(48);
      destPort = data.readUInt16BE(50);

    } else {
      logger.debug('proxy-protocol', 'Unsupported family/protocol combination', {
        family,
        protocol
      });
    }

    // TLVデータの抽出（アドレス情報の後）
    let tlvData: Buffer | undefined;
    const addressInfoLength = getAddressInfoLength(family, protocol);
    if (addressInfoLength > 0 && addressLength > addressInfoLength) {
      const tlvStart = 16 + addressInfoLength;
      const tlvLength = addressLength - addressInfoLength;
      tlvData = data.subarray(tlvStart, tlvStart + tlvLength);
    }

    const result: ProxyProtocolV2Header = {
      version: 2,
      command,
      family,
      protocol,
      sourceAddress,
      destAddress,
      sourcePort,
      destPort,
      headerLength: totalHeaderLength,
      tlvData,
      rawHeader: data.subarray(0, totalHeaderLength) // デバッグ用
    };

    logger.debug('proxy-protocol', 'Parsed Proxy Protocol v2 header', {
      ...result,
      rawHeader: undefined, // ログには含めない
      tlvData: tlvData ? `${tlvData.length} bytes` : 'none'
    });

    return result;

  } catch (error) {
    logger.error('proxy-protocol', 'Failed to parse Proxy Protocol v2', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * アドレス情報のバイト長を取得
 */
function getAddressInfoLength(family: string, protocol: string): number {
  if (family === 'INET' && (protocol === 'STREAM' || protocol === 'DGRAM')) {
    return 12; // IPv4: 4 + 4 + 2 + 2
  } else if (family === 'INET6' && (protocol === 'STREAM' || protocol === 'DGRAM')) {
    return 36; // IPv6: 16 + 16 + 2 + 2
  }
  return 0;
}

/**
 * 多段Proxy Protocolヘッダーを再帰的に解析
 * @param data 受信したデータバッファ
 * @returns プロキシチェーン情報
 */
export function parseProxyProtocolChain(data: Buffer): ProxyProtocolChain | null {
  try {
    const headers: ProxyProtocolV2Header[] = [];
    let remainingData = data;
    let iteration = 0;
    const maxIterations = 10; // 無限ループ防止

    // ヘッダーを再帰的に解析
    while (isProxyProtocolV2(remainingData) && iteration < maxIterations) {
      const beforeParseLength = remainingData.length;
      const header = parseProxyProtocolV2(remainingData);
      
      if (!header) {
        logger.warn('proxy-protocol', `Failed to parse header at iteration ${iteration + 1}`);
        break;
      }

      if (header.command !== 'PROXY') {
        logger.debug('proxy-protocol', `Non-PROXY command at iteration ${iteration + 1}`, {
          command: header.command
        });
        break;
      }

      headers.push(header);
      remainingData = stripProxyProtocolV2Header(remainingData, header);
      iteration++;

      logger.info('proxy-protocol', `Parsed Proxy Protocol v2 header #${iteration}`, {
        proxyServer: `${header.sourceAddress}:${header.sourcePort}`,
        realClient: `${header.destAddress}:${header.destPort}`,
        protocol: header.protocol
      });
    }

    if (headers.length === 0) {
      logger.debug('proxy-protocol', 'No PROXY headers found');
      return null;
    }

    // プロキシチェーンを構築（sourceAddress = プロキシサーバー）
    const proxyChain = headers.map(h => `${h.sourceAddress}:${h.sourcePort}`);
    
    // destAddressが真のクライアント（プレイヤー）
    const firstHeader = headers[0];

    const chain: ProxyProtocolChain = {
      headers,
      originalClientIP: firstHeader.destAddress,
      originalClientPort: firstHeader.destPort,
      proxyChain,
      payload: remainingData
    };

    logger.info('proxy-protocol', 'Proxy Protocol chain parsed', {
      layers: headers.length,
      realClient: `${chain.originalClientIP}:${chain.originalClientPort}`,
      proxyServers: chain.proxyChain
    });

    return chain;

  } catch (error) {
    logger.error('proxy-protocol', 'Failed to parse Proxy Protocol chain', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

/**
 * Proxy Protocol v2 ヘッダーをデータから削除して、元のペイロードを返す
 * @param data 元のデータ
 * @param header パース済みヘッダー
 * @returns ヘッダーを除いたペイロード
 */
export function stripProxyProtocolV2Header(data: Buffer, header: ProxyProtocolV2Header): Buffer {
  return data.subarray(header.headerLength);
}

/**
 * IPv6アドレスをフォーマット
 */
function formatIPv6(buffer: Buffer): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    const value = buffer.readUInt16BE(i);
    parts.push(value.toString(16));
  }
  return parts.join(':');
}

/**
 * Proxy Protocol v2ヘッダーを生成
 * @param sourceIP 送信元IP(真のクライアントIP)
 * @param sourcePort 送信元ポート
 * @param destIP 宛先IP(サーバーIP)
 * @param destPort 宛先ポート
 * @returns 生成されたProxy Protocol v2ヘッダー
 */
export function generateProxyProtocolV2Header(
  sourceIP: string,
  sourcePort: number,
  destIP: string,
  destPort: number
): Buffer {
  // IPv4かIPv6かを判定
  const isIPv6 = sourceIP.includes(':');
  
  // シグネチャ(12バイト)
  const signature = Buffer.from(PROXY_V2_SIGNATURE);
  
  // バージョン&コマンド(1バイト): version 2, command PROXY
  const versionAndCommand = 0x21; // 0010 0001
  
  // ファミリー&プロトコル(1バイト)
  let familyAndProtocol: number;
  if (isIPv6) {
    familyAndProtocol = 0x22; // INET6 (0010) + DGRAM (0010)
  } else {
    familyAndProtocol = 0x12; // INET (0001) + DGRAM (0010)
  }
  
  // アドレス情報を書き込む
  let addressBuffer: Buffer;
  
  if (isIPv6) {
    // IPv6: 16 + 16 + 2 + 2 = 36バイト
    addressBuffer = Buffer.alloc(36);
    
    // 送信元IPv6アドレス
    const sourceParts = sourceIP.split(':').map(p => parseInt(p || '0', 16));
    for (let i = 0; i < 8; i++) {
      addressBuffer.writeUInt16BE(sourceParts[i] || 0, i * 2);
    }
    
    // 宛先IPv6アドレス
    const destParts = destIP.split(':').map(p => parseInt(p || '0', 16));
    for (let i = 0; i < 8; i++) {
      addressBuffer.writeUInt16BE(destParts[i] || 0, 16 + i * 2);
    }
    
    // ポート番号
    addressBuffer.writeUInt16BE(sourcePort, 32);
    addressBuffer.writeUInt16BE(destPort, 34);
  } else {
    // IPv4: 4 + 4 + 2 + 2 = 12バイト
    addressBuffer = Buffer.alloc(12);
    
    // 送信元IPv4アドレス
    const sourceParts = sourceIP.split('.').map(Number);
    addressBuffer[0] = sourceParts[0];
    addressBuffer[1] = sourceParts[1];
    addressBuffer[2] = sourceParts[2];
    addressBuffer[3] = sourceParts[3];
    
    // 宛先IPv4アドレス
    const destParts = destIP.split('.').map(Number);
    addressBuffer[4] = destParts[0];
    addressBuffer[5] = destParts[1];
    addressBuffer[6] = destParts[2];
    addressBuffer[7] = destParts[3];
    
    // ポート番号
    addressBuffer.writeUInt16BE(sourcePort, 8);
    addressBuffer.writeUInt16BE(destPort, 10);
  }
  
  // アドレス長(2バイト、ビッグエンディアン)
  const addressLength = addressBuffer.length;
  
  // ヘッダーを構築
  const header = Buffer.alloc(16 + addressLength);
  signature.copy(header, 0);
  header[12] = versionAndCommand;
  header[13] = familyAndProtocol;
  header.writeUInt16BE(addressLength, 14);
  addressBuffer.copy(header, 16);
  
  return header;
}

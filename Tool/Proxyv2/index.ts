#!/usr/bin/env node
import * as dgram from 'dgram';

type AddrPort = { host: string; port: number };

function parseHostPort(spec: string): AddrPort {
  const idx = spec.lastIndexOf(':');
  if (idx === -1) throw new Error(`invalid address:port: ${spec}`);
  const host = spec.slice(0, idx) || '0.0.0.0';
  const port = Number(spec.slice(idx + 1));
  if (!Number.isFinite(port) || port <= 0 || port > 65535) throw new Error(`invalid port in: ${spec}`);
  return { host, port };
}

// Build Proxy Protocol v2 header for IPv4/UDP
function buildProxyProtocolV2IPv4UDP(srcHost: string, srcPort: number, dstHost: string, dstPort: number): Buffer {
  // signature
  const sig = Buffer.from([0x0d, 0x0a, 0x0d, 0x0a, 0x00, 0x0d, 0x0a, 0x51, 0x55, 0x49, 0x54, 0x0a]);
  const verCmd = 0x20 | 0x01; // version 2 (0x2 << 4) | command PROXY(0x1) => 0x21 but 0x20|0x01 = 0x21
  const famProto = (0x1 << 4) | 0x2; // AF_INET(0x1) <<4 | DGRAM(0x2) => 0x12

  const addrPart = Buffer.allocUnsafe(12);
  // src addr
  const srcParts = srcHost.split('.').map((p) => Number(p) & 0xff);
  if (srcParts.length !== 4) throw new Error(`unsupported src address: ${srcHost}`);
  addrPart[0] = srcParts[0];
  addrPart[1] = srcParts[1];
  addrPart[2] = srcParts[2];
  addrPart[3] = srcParts[3];
  // dst addr
  const dstParts = dstHost.split('.').map((p) => Number(p) & 0xff);
  if (dstParts.length !== 4) throw new Error(`unsupported dst address: ${dstHost}`);
  addrPart[4] = dstParts[0];
  addrPart[5] = dstParts[1];
  addrPart[6] = dstParts[2];
  addrPart[7] = dstParts[3];
  // src port
  addrPart.writeUInt16BE(srcPort & 0xffff, 8);
  // dst port
  addrPart.writeUInt16BE(dstPort & 0xffff, 10);

  const len = Buffer.allocUnsafe(2);
  len.writeUInt16BE(addrPart.length, 0);

  return Buffer.concat([sig, Buffer.from([verCmd, famProto]), len, addrPart]);
}

function usage() {
  console.log('Usage: index.ts --origin host:port --target host:port [--idle-seconds N]');
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  let originSpec = '';
  let targetSpec = '';
  let idleSeconds = 60;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--origin') originSpec = argv[++i] || '';
    else if (a === '--target') targetSpec = argv[++i] || '';
    else if (a === '--idle-seconds') idleSeconds = Number(argv[++i]) || idleSeconds;
    else if (a === '--help' || a === '-h') usage();
    else {
      console.warn(`Unknown arg: ${a}`);
      usage();
    }
  }

  if (!originSpec || !targetSpec) usage();

  const origin = parseHostPort(originSpec);
  const target = parseHostPort(targetSpec);

  const server = dgram.createSocket('udp4');

  type ClientEntry = {
    sock: dgram.Socket;
    lastActivity: number;
    timer?: NodeJS.Timeout;
  };

  const clients = new Map<string, ClientEntry>();

  server.on('error', (err) => {
    console.error('server error', err);
    server.close();
    process.exit(1);
  });

  server.on('message', (msg, rinfo) => {
    const clientKey = `${rinfo.address}:${rinfo.port}`;
    let entry = clients.get(clientKey);
    if (!entry) {
      const sock = dgram.createSocket('udp4');
      sock.bind(0, undefined, () => {
        // bound
      });

      sock.on('message', (resp) => {
        // forward response back to origin client
        server.send(resp, rinfo.port, rinfo.address, (err) => {
          if (err) console.error('error sending back to client', err);
        });
        entry && (entry.lastActivity = Date.now());
        resetTimer(clientKey);
      });

      sock.on('error', (e) => {
        console.error('client socket error', e);
      });

      entry = { sock, lastActivity: Date.now() };
      clients.set(clientKey, entry);
      resetTimer(clientKey);
    } else {
      entry.lastActivity = Date.now();
      resetTimer(clientKey);
    }

    // Build Proxy Protocol v2 header. The src is the original client, dst is the origin listener
    try {
      const header = buildProxyProtocolV2IPv4UDP(rinfo.address, rinfo.port, origin.host, origin.port);
      const payload = Buffer.concat([header, msg]);
      entry!.sock.send(payload, target.port, target.host, (err) => {
        if (err) console.error('error sending to target', err);
      });
    } catch (e: any) {
      console.error('Failed to build/send PPv2 packet:', e && e.message ? e.message : e);
    }
  });

  function resetTimer(clientKey: string) {
    const e = clients.get(clientKey);
    if (!e) return;
    if (e.timer) clearTimeout(e.timer);
    e.timer = setTimeout(() => {
      try {
        e.sock.close();
      } catch {}
      clients.delete(clientKey);
    }, idleSeconds * 1000);
  }

  server.on('listening', () => {
    const addr = server.address();
    console.log(`Origin listening on ${origin.host}:${origin.port} (server.addr=${JSON.stringify(addr)})`);
    console.log(`Forwarding to target ${target.host}:${target.port} with Proxy Protocol v2 (IPv4/UDP)`);
  });

  server.bind(origin.port, origin.host);
}

main().catch((e) => {
  console.error('fatal error', e);
  process.exit(1);
});

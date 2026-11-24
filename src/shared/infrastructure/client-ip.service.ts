import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

export type ClientIpRequest = Request & {
  auditClientIp?: string;
  auditClientAgent?: string;
  auditIpSource?: string;
};

export function requestClientIp(req: Request): string | undefined {
  return (req as ClientIpRequest).auditClientIp ?? req.ip;
}

export function requestClientAgent(req: Request): string | undefined {
  return (req as ClientIpRequest).auditClientAgent ?? req.get('user-agent');
}

@Injectable()
export class ClientIpService {
  constructor(private readonly config: ConfigService) {}

  resolve(req: ClientIpRequest) {
    req.auditClientIp = req.ip;
    req.auditIpSource =
      req.ip !== req.socket.remoteAddress ? 'proxy_confiable' : 'conexion';
    const secret = this.config.get<string>('CLIENT_IP_FORWARD_SECRET');
    if (!secret || secret.length < 32) return;
    const ip = req.get('x-crm-client-ip');
    const timestamp = req.get('x-crm-client-ts');
    const signature = req.get('x-crm-client-signature');
    const agent = req.get('x-crm-client-agent') ?? '';
    if (
      !ip ||
      !isIP(ip) ||
      !timestamp ||
      !/^\d{10}$/.test(timestamp) ||
      !signature ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      agent.length > 512 ||
      /[\r\n]/.test(agent)
    )
      return;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60) return;
    const path = (req.originalUrl || req.url).split('?')[0];
    const payload = [timestamp, req.method.toUpperCase(), path, ip, agent].join(
      '\n',
    );
    const expected = createHmac('sha256', secret).update(payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return;
    req.auditClientIp = ip;
    req.auditClientAgent = agent;
    req.auditIpSource = 'frontend_firmado';
  }
}

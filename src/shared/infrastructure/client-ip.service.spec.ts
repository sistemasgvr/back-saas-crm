import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import {
  ClientIpService,
  requestClientIp,
  type ClientIpRequest,
} from './client-ip.service';

const secret = 'synthetic-private-key-with-at-least-32-characters';
function fixture(ip = '38.56.219.133') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'x-crm-client-ip': ip,
    'x-crm-client-agent': 'Browser/test',
    'x-crm-client-ts': timestamp,
    'x-crm-client-signature': createHmac('sha256', secret)
      .update(
        [timestamp, 'POST', '/api/auth/login', ip, 'Browser/test'].join('\n'),
      )
      .digest('hex'),
  };
  const req = {
    ip: '10.11.0.23',
    socket: { remoteAddress: '10.11.0.23' },
    method: 'POST',
    originalUrl: '/api/auth/login',
    get: (name: string) => headers[name],
  } as unknown as ClientIpRequest;
  return { req, headers };
}

describe('IP original firmada por el frontend', () => {
  const service = new ClientIpService(
    new ConfigService({ CLIENT_IP_FORWARD_SECRET: secret }),
  );
  it.each(['38.56.219.133', '2001:db8::1'])(
    'resuelve %s y conserva el peer interno',
    (ip) => {
      const { req } = fixture(ip);
      service.resolve(req);
      expect(requestClientIp(req)).toBe(ip);
      expect(req.auditIpSource).toBe('frontend_firmado');
      expect(req.auditClientAgent).toBe('Browser/test');
      expect(req.socket.remoteAddress).toBe('10.11.0.23');
    },
  );
  it.each([
    'ip',
    'method',
    'path',
    'agent',
    'signature',
    'timestamp',
    'missing',
  ])('ignora contexto adulterado: %s', (field) => {
    const { req, headers } = fixture();
    if (field === 'ip') headers['x-crm-client-ip'] = '1.2.3.4';
    if (field === 'method') req.method = 'DELETE';
    if (field === 'path') req.originalUrl = '/api/other';
    if (field === 'agent') headers['x-crm-client-agent'] = 'forged';
    if (field === 'signature') headers['x-crm-client-signature'] = 'abc';
    if (field === 'timestamp') headers['x-crm-client-ts'] = '1000000000';
    if (field === 'missing') delete headers['x-crm-client-signature'];
    service.resolve(req);
    expect(requestClientIp(req)).toBe('10.11.0.23');
    expect(req.auditIpSource).toBe('conexion');
  });
  it('rechaza firmas antiguas aun cuando son auténticas', () => {
    const { req } = fixture();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
    try {
      service.resolve(req);
      expect(requestClientIp(req)).toBe('10.11.0.23');
    } finally {
      clock.mockRestore();
    }
  });
  it('sin secreto no confía en el contexto enviado', () => {
    const { req } = fixture();
    new ClientIpService(new ConfigService()).resolve(req);
    expect(requestClientIp(req)).toBe('10.11.0.23');
  });
});

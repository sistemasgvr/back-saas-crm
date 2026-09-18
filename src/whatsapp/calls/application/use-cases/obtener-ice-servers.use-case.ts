import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class ObtenerIceServersUseCase {
  constructor(private readonly config: ConfigService) {}

  execute(): { iceServers: IceServerConfig[]; ready: boolean } {
    const stunRaw = this.config.get<string>('WEBRTC_STUN_URLS') ?? '';
    const stunUrls = stunRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const turnUrl = this.config.get<string>('WEBRTC_TURN_URL')?.trim();
    const turnUsername = this.config
      .get<string>('WEBRTC_TURN_USERNAME')
      ?.trim();
    const turnCredential = this.config
      .get<string>('WEBRTC_TURN_CREDENTIAL')
      ?.trim();

    const iceServers: IceServerConfig[] = [];

    if (stunUrls.length === 1) {
      iceServers.push({ urls: stunUrls[0] });
    } else if (stunUrls.length > 1) {
      iceServers.push({ urls: stunUrls });
    }

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        ...(turnUsername ? { username: turnUsername } : {}),
        ...(turnCredential ? { credential: turnCredential } : {}),
      });
    }

    // Fallback público STUN si no hay config
    if (iceServers.length === 0) {
      iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    }

    const ready = stunUrls.length > 0 || !!turnUrl;

    return { iceServers, ready };
  }
}

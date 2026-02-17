import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OauthLoginRequestDto } from '../dtos/oauth-login-request.dto';
import { OauthProvider } from '../dtos/oauth-provider.enum';

type ProviderTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
};

export type ProviderUserProfile = {
  providerUserId: string;
  email: string | null;
  name: string;
  profileImage: string | null;
};

@Injectable()
export class OauthProviderService {
  // OAuth 제공자 토큰 교환 및 프로필 조회
  constructor(private readonly configService: ConfigService) {}

  // 인가 코드 -> 액세스 토큰 교환
  async exchangeCodeForToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    switch (dto.provider) {
      case OauthProvider.KAKAO:
        return this.exchangeKakaoToken(dto);
      case OauthProvider.GOOGLE:
        return this.exchangeGoogleToken(dto);
      default:
        throw new BadRequestException('지원하지 않는 공급자입니다.');
    }
  }

  // 액세스 토큰으로 사용자 프로필 조회
  async fetchUserProfile(provider: OauthProvider, accessToken: string): Promise<ProviderUserProfile> {
    switch (provider) {
      case OauthProvider.KAKAO:
        return this.fetchKakaoProfile(accessToken);
      case OauthProvider.GOOGLE:
        return this.fetchGoogleProfile(accessToken);
      default:
        throw new BadRequestException('지원하지 않는 공급자입니다.');
    }
  }

  // 카카오 토큰 교환
  private async exchangeKakaoToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('KAKAO_CLIENT_SECRET');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: dto.code,
      redirect_uri: dto.redirectUri,
    });

    const data = await this.postForm('https://kauth.kakao.com/oauth/token', body);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  // 구글 토큰 교환
  private async exchangeGoogleToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const body = new URLSearchParams({
      code: dto.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: dto.redirectUri,
      grant_type: 'authorization_code',
    });

    if (dto.codeVerifier) {
      body.append('code_verifier', dto.codeVerifier);
    }

    const data = await this.postForm('https://oauth2.googleapis.com/token', body);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  // 카카오 프로필 조회
  private async fetchKakaoProfile(accessToken: string): Promise<ProviderUserProfile> {
    const data = await this.getJson('https://kapi.kakao.com/v2/user/me', accessToken);
    const kakaoAccount = data.kakao_account ?? {};
    const profile = kakaoAccount.profile ?? data.properties ?? {};
    const name =
      profile.nickname ??
      (kakaoAccount.email ? kakaoAccount.email.split('@')[0] : 'kakao_user');

    return {
      providerUserId: String(data.id),
      email: kakaoAccount.email ?? null,
      name,
      profileImage: profile.profile_image_url ?? profile.profile_image ?? null,
    };
  }

  // 구글 프로필 조회
  private async fetchGoogleProfile(accessToken: string): Promise<ProviderUserProfile> {
    const data = await this.getJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken);
    const name = data.name ?? (data.email ? data.email.split('@')[0] : 'google_user');
    return {
      providerUserId: String(data.sub),
      email: data.email ?? null,
      name,
      profileImage: data.picture ?? null,
    };
  }

  // x-www-form-urlencoded POST 공통
  private async postForm(url: string, body: URLSearchParams): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await this.safeJson(response);
    if (!response.ok) {
      throw new BadRequestException({
        message: 'OAuth 토큰 교환에 실패했습니다.',
        details: data,
      });
    }
    return data;
  }

  // Bearer 인증 GET 공통
  private async getJson(url: string, accessToken: string): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await this.safeJson(response);
    if (!response.ok) {
      throw new BadRequestException({
        message: 'OAuth 사용자 프로필 조회에 실패했습니다.',
        details: data,
      });
    }
    return data;
  }

  // OAuth HTTP 호출 타임아웃(ms)
  private getOauthTimeoutMs(): number {
    return this.configService.getOrThrow<number>('OAUTH_HTTP_TIMEOUT_MS');
  }

  // 타임아웃 포함 fetch
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.getOauthTimeoutMs();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('OAuth 공급자 요청이 시간 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // JSON 파싱 실패 대비
  private async safeJson(response: Response): Promise<Record<string, any>> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return {};
    }
  }
}

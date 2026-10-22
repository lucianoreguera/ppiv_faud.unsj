import { httpClient } from './http-client';
import type {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
  UserProfileResponseDto,
} from '../types/openapi.types';

/**
 * Servicio de autenticación y sesión JWT (RF05)
 * Endpoints: POST /api/v1/auth/login · POST /api/v1/auth/register · GET /api/v1/auth/profile
 */
export const authApi = {
  login: (dto: LoginDto): Promise<LoginResponseDto> => {
    return httpClient.post<LoginResponseDto>('/auth/login', dto, { skipAuth: true });
  },

  register: (dto: RegisterDto): Promise<RegisterResponseDto> => {
    return httpClient.post<RegisterResponseDto>('/auth/register', dto, { skipAuth: true });
  },

  getProfile: (): Promise<UserProfileResponseDto> => {
    return httpClient.get<UserProfileResponseDto>('/auth/profile');
  },
};

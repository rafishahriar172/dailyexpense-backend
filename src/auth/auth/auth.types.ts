/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
}

export class AuthResponse {
  @ApiProperty({ type: Object })
  user: {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    isEmailVerified: boolean;
    status: string;
    createdAt: Date;
  };

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}
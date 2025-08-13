/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private config: ConfigService) {
    const clientID = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    
    if (!clientID || !clientSecret) {
      throw new Error(`
        Missing Google OAuth configuration:
        - GOOGLE_CLIENT_ID: ${clientID ? 'configured' : 'missing'}
        - GOOGLE_CLIENT_SECRET: ${clientSecret ? 'configured' : 'missing'}
      `);
    }

    super({
      clientID,
      clientSecret,
      callbackURL: config.get<string>('google.callbackURL', '/auth/google/callback'),
      scope: ['email', 'profile'],
    });
  }

   async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    
    const user = {
      googleId: id,
      email: emails[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      profileImage: photos[0]?.value,
    };
    
    done(null, user);
  }
}
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/require-await */
// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const smtpHost = configService.get<string>('SMTP_HOST');
        const smtpPort = configService.get<string>('SMTP_PORT', '587');
        const smtpSecure = configService.get<string>('SMTP_SECURE', 'false') === 'true';
        const smtpUser = configService.get<string>('SMTP_USER');
        const smtpPassword = configService.get<string>('SMTP_PASSWORD');
        const smtpFromEmail = configService.get<string>('SMTP_FROM_EMAIL');

        // Validate required environment variables
        if (!smtpHost || !smtpUser || !smtpPassword || !smtpFromEmail) {
          throw new Error('Missing required SMTP configuration. Please check your environment variables.');
        }

        return {
          transport: {
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpSecure,
            auth: {
              user: smtpUser,
              pass: smtpPassword,
            },
            // Add these for better debugging
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
          },
          defaults: {
            from: `"No Reply" <${smtpFromEmail}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailerModule, MailService],
})
export class MailModule {}
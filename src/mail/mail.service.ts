/* eslint-disable prettier/prettier */
// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendUserConfirmation(email: string, name: string, confirmationLink: string) {
    try {
      this.logger.log(`Attempting to send confirmation email to: ${email}`);
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to Our App! Confirm Your Email',
        template: 'confirmation', // refers to templates/confirmation.hbs
        context: {
          name,
          confirmationLink,
        },
      });

      this.logger.log(`Confirmation email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordReset(email: string, resetLink: string) {
    try {
      this.logger.log(`Attempting to send password reset email to: ${email}`);
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: {
          resetLink,
        },
      });

      this.logger.log(`Password reset email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  // Test method to verify SMTP configuration
  async testConnection(): Promise<boolean> {
    try {
      // Send a test email to verify the connection
      await this.mailerService.sendMail({
        to: process.env.SMTP_USER, // Send to yourself for testing
        subject: 'SMTP Configuration Test',
        text: 'If you receive this email, your SMTP configuration is working correctly.',
      });
      
      this.logger.log('SMTP connection test successful');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection test failed:', error);
      return false;
    }
  }
}
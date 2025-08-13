/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// prisma.service.ts

// prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in the environment variables');
    }
    super({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: config.get<string>('NODE_ENV') === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
    // Change from 'database.url' to 'DATABASE_URL'
    const databaseUrl = config.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      this.logger.error('DATABASE_URL is not configured in environment variables');
      throw new Error('Database configuration missing');
    }

    // For Neon.tech, add connection pooling parameters    
    
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to Neon PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
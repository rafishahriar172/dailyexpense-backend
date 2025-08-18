/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private config: ConfigService) {
    const databaseUrl = config.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined in the environment variables');
    }

    // For Neon.tech, add proper connection pooling parameters
    const url = databaseUrl.includes('?')
      ? `${databaseUrl}&pool_timeout=20&connect_timeout=60&connection_limit=10&sslmode=require`
      : `${databaseUrl}?pool_timeout=20&connect_timeout=60&connection_limit=10&sslmode=require`;

    super({
      datasources: {
        db: { url },
      },
      log: config.get<string>('NODE_ENV') === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error', 'warn'],
      errorFormat: 'pretty',
    });

    this.logger.log('Prisma client initialized with Neon PostgreSQL configuration');
  }

  async onModuleInit() {
    try {
      // Connect to database
      await this.$connect();
      
      // Test the connection
      await this.$queryRaw`SELECT 1 as test`;
      this.logger.log('Successfully connected to Neon PostgreSQL database');
    } catch (error) {
      this.logger.error(`Failed to connect to database: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from database');
    } catch (error) {
      this.logger.error(`Error disconnecting from database: ${error.message}`);
    }
  }

  // Helper method for graceful shutdown
  enableShutdownHooks(app: any) {
    // For Prisma 5.0+, use process events instead of Prisma events
    process.on('SIGINT', async () => {
      this.logger.log('Received SIGINT, shutting down gracefully...');
      await this.$disconnect();
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.log('Received SIGTERM, shutting down gracefully...');
      await this.$disconnect();
      await app.close();
      process.exit(0);
    });

    process.on('beforeExit', async () => {
      this.logger.log('Process beforeExit, disconnecting from database...');
      await this.$disconnect();
    });
  }
}
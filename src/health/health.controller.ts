/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    const timestamp = new Date().toISOString();
    
    try {
      // Test database connection with timeout
      const result = await Promise.race([
        this.prisma.$queryRaw`SELECT 1 as health_check`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
      ]);
      
      return {
        status: 'healthy',
        timestamp,
        services: {
          database: 'connected',
          api: 'running'
        },
        version: process.env.npm_package_version || '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp,
        services: {
          database: 'disconnected',
          api: 'running'
        },
        error: error.message,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      };
    }
  }

  @Get('db')
  @ApiOperation({ summary: 'Database-specific health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT NOW() as current_time`;
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Req,
  Res,
  Delete,
  Ip,
  Query,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import express from 'express';
import { AuthService } from './auth.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  GoogleAuthDto,
} from './dto';
import { AuthResponse } from './auth/auth.types';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponse,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: express.Request,
  ): Promise<AuthResponse> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.register(dto, ipAddress);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: express.Request,
  ): Promise<AuthResponse> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.authService.login(dto, ipAddress, userAgent);
  }

  // @Get('google')
  // @UseGuards(AuthGuard('google'))
  // @ApiOperation({ summary: 'Google OAuth login' })
  // @ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
  // async googleAuth(@Req() req: express.Request) {
  //   // Initiates Google OAuth flow
  // }

  // @Get('google/callback')
  // @UseGuards(AuthGuard('google'))
  // @ApiOperation({ summary: 'Google OAuth callback' })
  // async googleAuthCallback(
  //   @Req() req: express.Request,
  //   @Res() res: express.Response,
  // ) {
  //   const ipAddress = req.ip || req.connection.remoteAddress;
  //   const result = await this.authService.googleAuth(req.user as any, ipAddress);

  //   // Redirect to frontend with tokens
  //   const redirectUrl = `${process.env.CORS_ORIGIN}/auth/callback?token=${result.accessToken}&refresh=${result.refreshToken}`;
  //   res.redirect(redirectUrl);
  // }

  @Post('google')
  @ApiOperation({ summary: 'Handle Google OAuth data from frontend' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  async googleAuthApi(
    @Body() googleAuthDto: GoogleAuthDto,
    @Ip() ipAddress: string,
  ) {
    return this.authService.googleAuth(googleAuthDto, ipAddress);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token successfully refreshed',
    type: AuthResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Req() req: express.Request,
  ): Promise<AuthResponse> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.refreshTokens(dto, ipAddress);
  }

  @Delete('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'User successfully logged out' })
  async logout(
    @GetUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
    @Req() req: express.Request,
  ): Promise<void> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.logout(userId, dto.refreshToken, ipAddress);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 204, description: 'Password successfully changed' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @GetUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: express.Request,
  ): Promise<void> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.changePassword(userId, dto, ipAddress);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@GetUser() user: any) {
    return user;
  }

  @Get('confirm-email')
  @ApiOperation({ summary: 'ConfirmEmail' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async confirmEmail(@Query('token') token: string) {
    return this.authService.confirmEmail(token);
  }
}

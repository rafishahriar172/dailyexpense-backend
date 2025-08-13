/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
  ConflictException,
  ForbiddenException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { 
  LoginDto, 
  RegisterDto, 
  RefreshTokenDto,
  GoogleAuthDto,
  ChangePasswordDto 
} from './dto';
import { JwtPayload, AuthResponse } from './auth/auth.types';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 30 * 60 * 1000; // 30 minutes

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
      },
    });

    // Log registration
    await this.auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);
    
    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    return {
      user: this.excludePassword(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked due to too many failed login attempts');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful login
    await this.resetLoginAttempts(user.id);

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);
    
    // Save refresh token and create session
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

    // Log successful login
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      user: this.excludePassword(user),
      ...tokens,
    };
  }

  async googleAuth(dto: GoogleAuthDto, ipAddress?: string): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: dto.googleId },
    });

    if (!user) {
      // Check if user exists with same email
      user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (user) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: dto.googleId,
            profileImage: dto.profileImage,
            isEmailVerified: true,
          },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email: dto.email,
            googleId: dto.googleId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            profileImage: dto.profileImage,
            isEmailVerified: true,
          },
        });

        // Log registration
        await this.auditService.log({
          userId: user.id,
          action: 'USER_GOOGLE_REGISTERED',
          entity: 'User',
          entityId: user.id,
          ipAddress,
        });
      }
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);
    
    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    // Log Google login
    await this.auditService.log({
      userId: user.id,
      action: 'USER_GOOGLE_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      user: this.excludePassword(user),
      ...tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto, ipAddress?: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== dto.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.email);
      
      // Update refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

      return {
        user: this.excludePassword(user),
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string, ipAddress?: string): Promise<void> {
    // Invalidate refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    // Deactivate user sessions
    await this.prisma.userSession.updateMany({
      where: { 
        userId,
        isActive: true 
      },
      data: { isActive: false },
    });

    // Log logout
    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestException('User not found or password not set');
    }

    // Verify current password
    const isCurrentPasswordValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        passwordHash: newPasswordHash,
        refreshToken: null, // Invalidate all sessions
      },
    });

    // Deactivate all sessions
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Log password change
    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.excludePassword(user);
  }

  private async generateTokens(userId: string, email: string) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      iat: Math.floor(Date.now() / 1000),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string, 
    refreshToken: string, 
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Update user with refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    // Create or update session
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    await this.prisma.userSession.create({
      data: {
        userId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Clean up old sessions (keep only last 5)
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });

    if (sessions.length > 0) {
      await this.prisma.userSession.deleteMany({
        where: {
          id: {
            in: sessions.map(s => s.id),
          },
        },
      });
    }
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const attempts = user.loginAttempts + 1;
    const updateData: any = { loginAttempts: attempts };

    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + this.LOCK_TIME);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  private async resetLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  private excludePassword(user: any) {
    const { passwordHash, refreshToken, ...result } = user;
    return result;
  }
}
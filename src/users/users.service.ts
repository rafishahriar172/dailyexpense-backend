/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateUserProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        isEmailVerified: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
    ipAddress?: string,
  ) {
    const existingUser = await this.findById(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.profileImage !== undefined && { profileImage: dto.profileImage }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        isEmailVerified: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log profile update
    await this.auditService.log({
      userId,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: userId,
      oldValues: existingUser,
      newValues: updatedUser,
      ipAddress,
    });

    return updatedUser;
  }

  async getUserSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async revokeSession(userId: string, sessionId: string, ipAddress?: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    // Log session revocation
    await this.auditService.log({
      userId,
      action: 'SESSION_REVOKED',
      entity: 'UserSession',
      entityId: sessionId,
      ipAddress,
    });

    return { message: 'Session revoked successfully' };
  }

  async deleteAccount(userId: string, ipAddress?: string) {
    const user = await this.findById(userId);

    // Soft delete by updating status
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        status: 'INACTIVE',
        refreshToken: null,
      },
    });

    // Deactivate all sessions
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Log account deletion
    await this.auditService.log({
      userId,
      action: 'ACCOUNT_DELETED',
      entity: 'User',
      entityId: userId,
      oldValues: user,
      ipAddress,
    });

    return { message: 'Account deleted successfully' };
  }
}
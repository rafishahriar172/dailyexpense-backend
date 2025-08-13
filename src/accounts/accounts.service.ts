/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateAccountDto, ipAddress?: string) {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        balance: dto.initialBalance || 0,
        currency: dto.currency || 'USD',
        description: dto.description,
      },
    });

    // Log account creation
    await this.auditService.log({
      userId,
      action: 'ACCOUNT_CREATED',
      entity: 'Account',
      entityId: account.id,
      newValues: account,
      ipAddress,
    });

    return account;
  }

  async findAll(userId: string, includeInactive = false) {
    return this.prisma.account.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAccountDto,
    ipAddress?: string,
  ) {
    const existingAccount = await this.findOne(userId, id);

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Log account update
    await this.auditService.log({
      userId,
      action: 'ACCOUNT_UPDATED',
      entity: 'Account',
      entityId: id,
      oldValues: existingAccount,
      newValues: updatedAccount,
      ipAddress,
    });

    return updatedAccount;
  }

  async remove(userId: string, id: string, ipAddress?: string) {
    const account = await this.findOne(userId, id);

    // Check if account has transactions
    const transactionCount = await this.prisma.transaction.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      // Soft delete by deactivating instead of hard delete
      const deactivatedAccount = await this.prisma.account.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.log({
        userId,
        action: 'ACCOUNT_DEACTIVATED',
        entity: 'Account',
        entityId: id,
        oldValues: account,
        newValues: deactivatedAccount,
        ipAddress,
      });

      return { message: 'Account deactivated due to existing transactions' };
    }

    // Hard delete if no transactions
    await this.prisma.account.delete({
      where: { id },
    });

    await this.auditService.log({
      userId,
      action: 'ACCOUNT_DELETED',
      entity: 'Account',
      entityId: id,
      oldValues: account,
      ipAddress,
    });

    return { message: 'Account deleted successfully' };
  }

  async getAccountSummary(userId: string) {
    const accounts = await this.findAll(userId);
    
    const summary = accounts.reduce(
      (acc, account) => {
        acc.totalBalance = acc.totalBalance.add(account.balance);
        acc.accountsByType[account.type] = (acc.accountsByType[account.type] || 0) + 1;
        return acc;
      },
      {
        totalBalance: new (require('@prisma/client/runtime/library').Decimal)(0),
        totalAccounts: accounts.length,
        accountsByType: {} as Record<string, number>,
      },
    );

    return {
      ...summary,
      accounts,
    };
  }
}
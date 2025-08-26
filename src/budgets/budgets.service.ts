/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto';
import { BudgetAlert } from 'src/types/budget-alert.type';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateBudgetDto, ipAddress?: string) {
    // Check for overlapping active budgets
    const existingBudget = await this.prisma.budget.findFirst({
      where: {
        userId,
        category: dto.category,
        isActive: true,
        OR: [
          {
            startDate: { lte: new Date(dto.endDate) },
            endDate: { gte: new Date(dto.startDate) },
          },
        ],
      },
    });

    if (existingBudget) {
      throw new BadRequestException(
        'An active budget for this category already exists in the specified period',
      );
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        amount: dto.amount,
        period: dto.period,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });

    // Calculate initial spent amount from existing transactions
    const spentAmount = await this.calculateSpentAmount(
      userId,
      dto.category,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );

    const updatedBudget = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { spent: spentAmount },
    });

    // Log budget creation
    await this.auditService.log({
      userId,
      action: 'BUDGET_CREATED',
      entity: 'Budget',
      entityId: budget.id,
      newValues: updatedBudget,
      ipAddress,
    });

    return updatedBudget;
  }

  async findAll(userId: string, isActive?: boolean) {
    const where: any = { userId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const budgets = await this.prisma.budget.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate progress for each budget
    return budgets.map((budget) => ({
      ...budget,
      progress:
        budget.amount.toNumber() > 0
          ? (budget.spent.toNumber() / budget.amount.toNumber()) * 100
          : 0,
      remaining: budget.amount.sub(budget.spent),
      isOverBudget: budget.spent.gt(budget.amount),
    }));
  }

  async findOne(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return {
      ...budget,
      progress:
        budget.amount.toNumber() > 0
          ? (budget.spent.toNumber() / budget.amount.toNumber()) * 100
          : 0,
      remaining: budget.amount.sub(budget.spent),
      isOverBudget: budget.spent.gt(budget.amount),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBudgetDto,
    ipAddress?: string,
  ) {
    const existingBudget = await this.findOne(userId, id);

    // If dates or category change, recalculate spent amount
    let spent = existingBudget.spent;
    if (dto.startDate || dto.endDate || dto.category) {
      spent = await this.calculateSpentAmount(
        userId,
        dto.category || existingBudget.category,
        dto.startDate || existingBudget.startDate,
        dto.endDate || existingBudget.endDate,
      );
    }

    const updatedBudget = await this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.category && { category: dto.category }),
        ...(dto.amount && { amount: dto.amount }),
        ...(dto.period && { period: dto.period }),
        ...(dto.startDate && { startDate: dto.startDate }),
        ...(dto.endDate && { endDate: dto.endDate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        spent,
      },
    });

    // Log budget update
    await this.auditService.log({
      userId,
      action: 'BUDGET_UPDATED',
      entity: 'Budget',
      entityId: id,
      oldValues: existingBudget,
      newValues: updatedBudget,
      ipAddress,
    });

    return {
      ...updatedBudget,
      progress:
        updatedBudget.amount.toNumber() > 0
          ? (updatedBudget.spent.toNumber() / updatedBudget.amount.toNumber()) *
            100
          : 0,
      remaining: updatedBudget.amount.sub(updatedBudget.spent),
      isOverBudget: updatedBudget.spent.gt(updatedBudget.amount),
    };
  }

  async remove(userId: string, id: string, ipAddress?: string) {
    const budget = await this.findOne(userId, id);

    await this.prisma.budget.delete({
      where: { id },
    });

    // Log budget deletion
    await this.auditService.log({
      userId,
      action: 'BUDGET_DELETED',
      entity: 'Budget',
      entityId: id,
      oldValues: budget,
      ipAddress,
    });

    return { message: 'Budget deleted successfully' };
  }

  async getBudgetSummary(userId: string) {
    const currentDate = new Date();

    const [activeBudgets, overBudgets, totalBudgeted, totalSpent] =
      await Promise.all([
        this.prisma.budget.count({
          where: {
            userId,
            isActive: true,
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
          },
        }),
        this.prisma.budget.count({
          where: {
            userId,
            isActive: true,
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
            spent: {
              gt: this.prisma.budget.fields.amount,
            },
          },
        }),
        this.prisma.budget.aggregate({
          where: {
            userId,
            isActive: true,
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
          },
          _sum: { amount: true },
        }),
        this.prisma.budget.aggregate({
          where: {
            userId,
            isActive: true,
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
          },
          _sum: { spent: true },
        }),
      ]);

    return {
      activeBudgets,
      overBudgets,
      totalBudgeted: totalBudgeted._sum.amount || 0,
      totalSpent: totalSpent._sum.spent || 0,
      remainingBudget:
        (totalBudgeted._sum.amount?.toNumber() || 0) - (totalSpent._sum.spent?.toNumber() || 0),
    };
  }

  async getBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    const currentDate = new Date();

    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: currentDate },
        endDate: { gte: currentDate },
      },
    });

    const alerts: BudgetAlert[] = [];

    for (const budget of budgets) {
      const spentPercentage =
        budget.amount.toNumber() > 0
          ? (budget.spent.toNumber() / budget.amount.toNumber()) * 100
          : 0;

      if (spentPercentage >= 100) {
        alerts.push({
          type: 'OVER_BUDGET',
          budgetId: budget.id,
          budgetName: budget.name,
          category: budget.category,
          percentage: spentPercentage,
          amount: budget.spent.sub(budget.amount),
          severity: 'high',
        });
      } else if (spentPercentage >= 90) {
        alerts.push({
          type: 'NEAR_BUDGET_LIMIT',
          budgetId: budget.id,
          budgetName: budget.name,
          category: budget.category,
          percentage: spentPercentage,
          remaining: budget.amount.sub(budget.spent),
          severity: 'medium',
        });
      }
    }

    return alerts;
  }

  private async calculateSpentAmount(
    userId: string,
    category: any,
    startDate: Date,
    endDate: Date,
  ) {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        category,
        type: 'EXPENSE',
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    return result._sum.amount || new Decimal(0);
  }
}

/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TransactionCategory, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateTransferDto,
  GetTransactionsQueryDto,
} from './dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto, ipAddress?: string) {
    // Verify account ownership
    const account = await this.accountsService.findOne(userId, dto.accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    console.log('Creating transaction:', dto);
    return this.prisma.$transaction(async (tx) => {
      // Create transaction
      let account;

      if (!dto.accountId || dto.accountId.trim() === '') {
        const existingAccounts = await this.accountsService.findAll(userId);
        if (existingAccounts.length === 0) {
          account = await this.accountsService.createDefault(userId, ipAddress);
        } else {
          account = existingAccounts[0]; // use first/default account
        }
      } else {
        account = await this.accountsService.findOne(userId, dto.accountId);
      }
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: dto.type,
          category: dto.category,
          amount: dto.amount,
          description: dto.description,
          notes: dto.notes,
          tags: dto.tags || [],
          transactionDate: dto.transactionDate
            ? new Date(dto.transactionDate)
            : new Date(),
        },
        include: {
          account: true,
        },
      });

      // Update account balance
      const balanceChange =
        dto.type === TransactionType.EXPENSE ? dto.amount.mul(-1) : dto.amount;

      await tx.account.update({
        where: { id: dto.accountId },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });

      // Update budget if applicable
      if (dto.type === TransactionType.EXPENSE) {
        await this.updateBudgetSpent(tx, userId, dto.category, dto.amount);
      }

      // Log transaction
      await this.auditService.log({
        userId,
        action: 'TRANSACTION_CREATED',
        entity: 'Transaction',
        entityId: transaction.id,
        newValues: transaction,
        ipAddress,
      });

      return transaction;
    });
  }

  async createTransfer(
    userId: string,
    dto: CreateTransferDto,
    ipAddress?: string,
  ) {
    // Verify account ownership
    const [fromAccount, toAccount] = await Promise.all([
      this.accountsService.findOne(userId, dto.fromAccountId),
      this.accountsService.findOne(userId, dto.toAccountId),
    ]);

    if (!fromAccount || !toAccount) {
      throw new NotFoundException('One or both accounts not found');
    }

    if (fromAccount.balance.lt(dto.amount)) {
      throw new BadRequestException('Insufficient balance in source account');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create main transaction (outgoing)
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: dto.fromAccountId,
          type: TransactionType.TRANSFER,
          category: dto.category || TransactionCategory.ACCOUNT_TRANSFER,
          amount: dto.amount,
          description: dto.description || `Transfer to ${toAccount.name}`,
          notes: dto.notes,
          transactionDate: dto.transactionDate || new Date(),
        },
      });

      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          transactionId: transaction.id,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          exchangeRate: dto.exchangeRate,
          fees: dto.fees || new Prisma.Decimal(0),
        },
      });

      // Calculate actual transfer amounts
      const fromAmount = dto.amount.add(dto.fees || 0);
      const toAmount = dto.exchangeRate
        ? dto.amount.mul(dto.exchangeRate)
        : dto.amount;

      // Update account balances
      await Promise.all([
        tx.account.update({
          where: { id: dto.fromAccountId },
          data: {
            balance: {
              decrement: fromAmount,
            },
          },
        }),
        tx.account.update({
          where: { id: dto.toAccountId },
          data: {
            balance: {
              increment: toAmount,
            },
          },
        }),
      ]);

      // Log transfer
      await this.auditService.log({
        userId,
        action: 'TRANSFER_CREATED',
        entity: 'Transfer',
        entityId: transfer.id,
        newValues: { transaction, transfer },
        ipAddress,
      });

      return { transaction, transfer };
    });
  }

  async findAll(userId: string, query: GetTransactionsQueryDto) {
    const {
      page = 1,
      limit = 20,
      accountId,
      type,
      category,
      dateFrom,
      dateTo,
      search,
      sortBy = 'transactionDate',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(accountId && { accountId }),
      ...(type && { type }),
      ...(category && { category }),
      ...((dateFrom || dateTo) && {
        transactionDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ],
      }),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: { name: true, type: true },
          },
          transfer: {
            include: {
              fromAccount: { select: { name: true } },
              toAccount: { select: { name: true } },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        transfer: {
          include: {
            fromAccount: true,
            toAccount: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
    ipAddress?: string,
  ) {
    const existingTransaction = await this.findOne(userId, id);

    // Don't allow updating transfer transactions directly
    if (
      existingTransaction.type === TransactionType.TRANSFER &&
      existingTransaction.transfer
    ) {
      throw new BadRequestException(
        'Cannot update transfer transactions directly',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Calculate balance adjustment
      const oldAmount =
        existingTransaction.type === TransactionType.EXPENSE
          ? existingTransaction.amount.mul(-1)
          : existingTransaction.amount;

      const newAmount =
        (dto.type || existingTransaction.type) === TransactionType.EXPENSE
          ? (dto.amount || existingTransaction.amount).mul(-1)
          : dto.amount || existingTransaction.amount;

      const balanceAdjustment = newAmount.sub(oldAmount);

      // Update transaction
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.category && { category: dto.category }),
          ...(dto.amount && { amount: dto.amount }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.tags && { tags: dto.tags }),
          ...(dto.transactionDate && { transactionDate: dto.transactionDate }),
        },
        include: {
          account: true,
        },
      });

      // Update account balance if amount or type changed
      if (dto.amount || dto.type) {
        await tx.account.update({
          where: { id: existingTransaction.accountId },
          data: {
            balance: {
              increment: balanceAdjustment,
            },
          },
        });
      }

      // Update budget if needed
      if (
        existingTransaction.type === TransactionType.EXPENSE ||
        dto.type === TransactionType.EXPENSE
      ) {
        // Revert old expense from budget
        if (existingTransaction.type === TransactionType.EXPENSE) {
          await this.updateBudgetSpent(
            tx,
            userId,
            existingTransaction.category,
            existingTransaction.amount.mul(-1),
          );
        }

        // Add new expense to budget
        if (
          (dto.type || existingTransaction.type) === TransactionType.EXPENSE
        ) {
          await this.updateBudgetSpent(
            tx,
            userId,
            dto.category || existingTransaction.category,
            dto.amount || existingTransaction.amount,
          );
        }
      }

      // Log update
      await this.auditService.log({
        userId,
        action: 'TRANSACTION_UPDATED',
        entity: 'Transaction',
        entityId: id,
        oldValues: existingTransaction,
        newValues: updatedTransaction,
        ipAddress,
      });

      return updatedTransaction;
    });
  }

  async remove(userId: string, id: string, ipAddress?: string) {
    const transaction = await this.findOne(userId, id);

    return this.prisma.$transaction(async (tx) => {
      // Handle transfer deletion
      if (
        transaction.type === TransactionType.TRANSFER &&
        transaction.transfer
      ) {
        const { transfer } = transaction;

        // Revert account balances
        const fromAmount = transaction.amount.add(transfer.fees || 0);
        const toAmount = transfer.exchangeRate
          ? transaction.amount.mul(transfer.exchangeRate)
          : transaction.amount;

        await Promise.all([
          tx.account.update({
            where: { id: transfer.fromAccountId },
            data: {
              balance: { increment: fromAmount },
            },
          }),
          tx.account.update({
            where: { id: transfer.toAccountId },
            data: {
              balance: { decrement: toAmount },
            },
          }),
        ]);

        // Delete transfer record
        await tx.transfer.delete({
          where: { id: transfer.id },
        });
      } else {
        // Revert account balance for regular transactions
        const balanceChange =
          transaction.type === TransactionType.EXPENSE
            ? transaction.amount
            : transaction.amount.mul(-1);

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: { increment: balanceChange },
          },
        });

        // Revert budget if expense
        if (transaction.type === TransactionType.EXPENSE) {
          await this.updateBudgetSpent(
            tx,
            userId,
            transaction.category,
            transaction.amount.mul(-1),
          );
        }
      }

      // Delete transaction
      await tx.transaction.delete({
        where: { id },
      });

      // Log deletion
      await this.auditService.log({
        userId,
        action: 'TRANSACTION_DELETED',
        entity: 'Transaction',
        entityId: id,
        oldValues: transaction,
        ipAddress,
      });
    });
  }

  async getStatistics(userId: string, dateFrom?: string, dateTo?: string) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...((dateFrom || dateTo) && {
        transactionDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [
      totalIncome,
      totalExpense,
      transactionCount,
      categoryStats,
      monthlyTrend,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: TransactionType.INCOME },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: TransactionType.EXPENSE },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.groupBy({
        by: ['category', 'type'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // Use the helper method
      this.getMonthlyTrend(userId, dateFrom, dateTo),
    ]);

    // Process monthly trend data to ensure proper formatting
    const processedMonthlyTrend = monthlyTrend.map((item) => ({
      month: item.month,
      income: Number(item.income) || 0,
      expenses: Number(item.expenses) || 0,
    }));

    return {
      totalIncome: totalIncome._sum.amount || 0,
      totalExpense: totalExpense._sum.amount || 0,
      netAmount:
        (totalIncome._sum.amount?.toNumber() || 0) -
        (totalExpense._sum.amount?.toNumber() || 0),
      transactionCount,
      categoryBreakdown: categoryStats,
      monthlyTrend: processedMonthlyTrend,
    };
  }

  private async updateBudgetSpent(
    tx: Prisma.TransactionClient,
    userId: string,
    category: any,
    amount: Prisma.Decimal,
  ) {
    const currentDate = new Date();

    const budget = await tx.budget.findFirst({
      where: {
        userId,
        category,
        isActive: true,
        startDate: { lte: currentDate },
        endDate: { gte: currentDate },
      },
    });

    if (budget) {
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          spent: {
            increment: amount,
          },
        },
      });
    }
  }

  private async getMonthlyTrend(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    // Use Prisma groupBy instead of raw SQL - this automatically handles table names
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...((dateFrom || dateTo) && {
        transactionDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    // Get all transactions and group them manually
    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        transactionDate: true,
        type: true,
        amount: true,
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    // Group by month
    const monthlyData = transactions.reduce(
      (acc, transaction) => {
        const month = transaction.transactionDate.toISOString().substring(0, 7); // YYYY-MM

        if (!acc[month]) {
          acc[month] = { month, income: 0, expenses: 0 };
        }

        const amount = Number(transaction.amount) || 0;
        if (transaction.type === 'INCOME') {
          acc[month].income += amount;
        } else if (transaction.type === 'EXPENSE') {
          acc[month].expenses += amount;
        }

        return acc;
      },
      {} as Record<string, { month: string; income: number; expenses: number }>,
    );

    // Convert to array and sort by month (most recent first)
    return Object.values(monthlyData)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
  }
}

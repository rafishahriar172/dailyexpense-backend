/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  IsEnum,
  IsDecimal,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
  IsNumberString,
  isString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateTransactionDto {
  @ApiProperty({ example: 'account-uuid' })
  @IsString()
  accountId: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    enum: TransactionCategory,
    default: TransactionCategory.ACCOUNT_TRANSFER,
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({ example: 100.5 })
  @IsNotEmpty()
  @Transform(
    ({ value }) => {
      if (value == null) return null;
      if (typeof value === 'string' || typeof value === 'number') {
        return new Decimal(value);
      }
      throw new Error('Amount must be a number or numeric string');
    },
    { toClassOnly: true },
  )
  amount: Decimal;

  @ApiProperty({ example: 'Grocery shopping', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Weekly groceries', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: ['groceries', 'food'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, example: '2025-08-21T23:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

export class UpdateTransactionDto {
  @ApiProperty({ enum: TransactionType, required: false })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ enum: TransactionCategory, required: false })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ default: 'transactionDate', required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ default: 'desc', required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
  amount: any;
  description: undefined;
  notes: undefined;
  tags: { tags: any };
  transactionDate: { transactionDate: any };
}

export class CreateTransferDto {
  @ApiProperty({ example: 'account-uuid-from' })
  @IsUUID()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty({ example: 'account-uuid-to' })
  @IsUUID()
  @IsNotEmpty()
  toAccountId: string;

  @ApiProperty({ example: '100.50' })
  @Transform(({ value }) => new Decimal(value))
  amount: Decimal;

  @ApiProperty({ example: 'Monthly savings transfer', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1.0, required: false })
  @IsOptional()
  @Transform(({ value }) => new Decimal(value))
  exchangeRate?: Decimal;

  @ApiProperty({ example: '5.00', required: false })
  @IsOptional()
  @Transform(({ value }) => new Decimal(value))
  fees?: Decimal;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  transactionDate?: Date;
  category: TransactionCategory = TransactionCategory.ACCOUNT_TRANSFER;
  notes: any;
}

export class GetTransactionsQueryDto {
  @ApiProperty({ enum: TransactionType, required: false })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ enum: TransactionCategory, required: false })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ default: 'transactionDate', required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ enum: ['asc', 'desc'], default: 'desc', required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}

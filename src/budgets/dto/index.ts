/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateBudgetDto {
  @ApiProperty({ example: 'Monthly Groceries Budget' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: TransactionCategory })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({ example: '500.00' })
  @IsNotEmpty()
  @Transform(({ value }) =>
    value !== undefined ? new Decimal(value.toString()) : undefined,
  )
  
  amount: Decimal;
  @ApiProperty({ example: 'monthly', description: 'Budget period type' })
  @IsString()
  period: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  @IsDateString()
  startDate: string; // ✅ use string

  @ApiProperty({ example: '2024-01-31T23:59:59Z' })
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  @IsDateString()
  endDate: string; // ✅ use string
}

export class UpdateBudgetDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ enum: TransactionCategory, required: false })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiProperty({ example: '500.00', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? new Decimal(value) : undefined))
  amount?: Decimal;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  @IsDateString()
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

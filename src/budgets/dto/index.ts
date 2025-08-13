/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { 
  IsString, 
  IsEnum, 
  IsDateString, 
  IsOptional, 
  IsBoolean,
  MaxLength 
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
  @Transform(({ value }) => new Decimal(value))
  amount: Decimal;

  @ApiProperty({ example: 'monthly', description: 'Budget period type' })
  @IsString()
  period: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59Z' })
  @IsDateString()
  endDate: Date;
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
  @Transform(({ value }) => value ? new Decimal(value) : undefined)
  amount?: Decimal;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
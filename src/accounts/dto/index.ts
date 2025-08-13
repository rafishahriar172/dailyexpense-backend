/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsDecimal, 
  IsBoolean,
  MaxLength 
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateAccountDto {
  @ApiProperty({ example: 'Main Checking Account' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ example: '1000.00', required: false })
  @IsOptional()
  @Transform(({ value }) => value ? new Decimal(value) : undefined)
  initialBalance?: Decimal;

  @ApiProperty({ example: 'USD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Primary checking account', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ enum: AccountType, required: false })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
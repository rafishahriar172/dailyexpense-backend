/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { TransactionsService } from './transaction.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateTransferDto,
  GetTransactionsQueryDto,
} from './dto';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  create(
    @GetUser('id') userId: string,
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.transactionsService.create(userId, createTransactionDto, ipAddress);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiResponse({ status: 201, description: 'Transfer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Insufficient balance' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  createTransfer(
    @GetUser('id') userId: string,
    @Body() createTransferDto: CreateTransferDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.transactionsService.createTransfer(userId, createTransferDto, ipAddress);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions for user' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  findAll(
    @GetUser('id') userId: string,
    @Query() query: GetTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(userId, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getStatistics(
    @GetUser('id') userId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.transactionsService.getStatistics(userId, dateFrom, dateTo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific transaction' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot update transfer transactions' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.transactionsService.update(userId, id, updateTransactionDto, ipAddress);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  remove(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.transactionsService.remove(userId, id, ipAddress);
  }
}
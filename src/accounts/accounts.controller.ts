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
import { AccountsService } from './accounts.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateAccountDto, UpdateAccountDto } from './dto';


@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  create(
    @GetUser('id') userId: string,
    @Body() createAccountDto: CreateAccountDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.accountsService.create(userId, createAccountDto, ipAddress);
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts for user' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  findAll(
    @GetUser('id') userId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    return this.accountsService.findAll(userId, includeInactive);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get account summary' })
  @ApiResponse({ status: 200, description: 'Account summary retrieved successfully' })
  getAccountSummary(@GetUser('id') userId: string) {
    return this.accountsService.getAccountSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific account' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  findOne(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.accountsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.accountsService.update(userId, id, updateAccountDto, ipAddress);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiResponse({ status: 200, description: 'Account deleted/deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  remove(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.accountsService.remove(userId, id, ipAddress);
  }
}
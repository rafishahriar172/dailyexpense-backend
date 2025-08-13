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
import { BudgetsService } from './budgets.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateBudgetDto, UpdateBudgetDto } from './dto';

@ApiTags('Budgets')
@Controller('budgets')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({ status: 201, description: 'Budget created successfully' })
  @ApiResponse({ status: 400, description: 'Overlapping budget exists' })
  create(
    @GetUser('id') userId: string,
    @Body() createBudgetDto: CreateBudgetDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.budgetsService.create(userId, createBudgetDto, ipAddress);
  }

  @Get()
  @ApiOperation({ summary: 'Get all budgets for user' })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  findAll(
    @GetUser('id') userId: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.budgetsService.findAll(userId, isActive);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get budget summary' })
  @ApiResponse({ status: 200, description: 'Budget summary retrieved successfully' })
  getBudgetSummary(@GetUser('id') userId: string) {
    return this.budgetsService.getBudgetSummary(userId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get budget alerts' })
  @ApiResponse({ status: 200, description: 'Budget alerts retrieved successfully' })
  getBudgetAlerts(@GetUser('id') userId: string) {
    return this.budgetsService.getBudgetAlerts(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific budget' })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  findOne(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.budgetsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a budget' })
  @ApiResponse({ status: 200, description: 'Budget updated successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.budgetsService.update(userId, id, updateBudgetDto, ipAddress);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiResponse({ status: 200, description: 'Budget deleted successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  remove(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.budgetsService.remove(userId, id, ipAddress);
  }
}
/* eslint-disable prettier/prettier */
import { Decimal } from "@prisma/client/runtime/library";
import { TransactionCategory } from "@prisma/client";

// types/budget-alert.type.ts
export type BudgetAlert = {
  type: 'OVER_BUDGET' | 'NEAR_BUDGET_LIMIT';
  budgetId: string;
  budgetName: string;
  category: TransactionCategory;
  percentage: number;
  severity: 'high' | 'medium';
  amount?: Decimal; // Only for OVER_BUDGET
  remaining?: Decimal; // Only for NEAR_BUDGET_LIMIT
};
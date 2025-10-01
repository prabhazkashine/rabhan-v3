export enum ClientType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL'
}

export enum CalculationMode {
  MONTHLY_CONSUMPTION = 'MONTHLY_CONSUMPTION',
  MONTHLY_BILL = 'MONTHLY_BILL'
}

export interface SolarCalculationInput {
  mode: CalculationMode;
  clientType: ClientType;
  monthlyConsumption?: number;
  monthlyBill?: number;
  numberOfInstallments: number;
  customerId?: string;
}

export interface SolarCalculationResult {
  calculationId: string;
  clientType: ClientType;
  monthlyConsumption: number;
  solarPowerKWP: number;
  monthlyProduction: number;
  systemPrice: number;
  numberOfInstallments: number;
  installmentValue: number;
  extraElectricityPayment: number;
  totalMonthlyPayment: number;
  currentMonthlyBill: number;
  savingsPercentage: number;
  roiEstimate: number;
  monthlyCostIncrease: number;
  calculatedAt: Date;
}

export interface SolarPowerMapping {
  minConsumption: number;
  maxConsumption: number;
  requiredKWP: number;
}

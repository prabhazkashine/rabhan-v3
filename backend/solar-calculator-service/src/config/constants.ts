import { SolarPowerMapping } from '../types/solar.types';

export const SOLAR_CONSTANTS = {
  MIN_CONSUMPTION_KWH: 6000,
  MAX_CONSUMPTION_KWH: 24000,
  ANNUAL_PRODUCTION_PER_KWP: 1900,
  MONTHS_PER_YEAR: 12
};

export const ADMIN_CONFIG = {
  residentialMinBill: 1080,
  commercialMinBill: 1200,
  electricityRate: 0.30,
  systemPricePerKWP: 2200
};

export const SOLAR_POWER_MAPPINGS: SolarPowerMapping[] = [
  { minConsumption: 6000, maxConsumption: 9999, requiredKWP: 10 },
  { minConsumption: 10000, maxConsumption: 14999, requiredKWP: 15 },
  { minConsumption: 15000, maxConsumption: 18999, requiredKWP: 20 },
  { minConsumption: 19000, maxConsumption: 24000, requiredKWP: 25 }
];

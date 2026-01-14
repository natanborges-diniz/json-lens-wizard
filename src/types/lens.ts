// Core types for the lens system

export type Tier = 'essential' | 'comfort' | 'advanced' | 'top';

export interface Macro {
  id: string;
  name: string;
  description: string;
}

export interface Family {
  id: string;
  macroId: string;
  name: string;
  supplier: string;
  tier: Tier;
  basePrice: number;
  benefits: string[];
  commercialName: string;
  active: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  price: number;
  benefits: string[];
  commercialName: string;
  compatibleMacros: string[];
  active: boolean;
}

export interface StandaloneProduct {
  id: string;
  macroId: string;
  name: string;
  supplier: string;
  tier: Tier;
  price: number;
  benefits: string[];
  commercialName: string;
  active: boolean;
}

export interface SupplierPriority {
  macroId: string;
  suppliers: string[];
}

export interface PriceTable {
  familyId: string;
  sphereRange: [number, number];
  cylinderRange: [number, number];
  price: number;
}

export interface Prescription {
  rightSphere: number;
  rightCylinder: number;
  rightAxis: number;
  rightAddition?: number;
  leftSphere: number;
  leftCylinder: number;
  leftAxis: number;
  leftAddition?: number;
}

export interface FrameMeasurements {
  horizontalSize: number;
  verticalSize: number;
  bridge: number;
  dp: number;
}

export interface CustomerProfile {
  name: string;
  age: number;
  occupation: string;
  primaryUse: 'reading' | 'computer' | 'driving' | 'general';
  digitalDeviceHours: number;
  outdoorActivities: boolean;
  sensitiveToLight: boolean;
  wearGlassesCurrently: boolean;
  previousLensType?: string;
}

export interface LensRecommendation {
  family: Family;
  modules: Module[];
  totalPrice: number;
  tier: Tier;
  benefits: string[];
}

export interface ImportData {
  macros?: Macro[];
  families?: Family[];
  modules?: Module[];
  prices?: PriceTable[];
  standaloneProducts?: StandaloneProduct[];
  supplierPriorities?: SupplierPriority[];
}

export type ImportMode = 'increment' | 'replace';

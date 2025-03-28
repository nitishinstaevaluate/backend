import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

//Industry Schema
@Schema()
export class Industry {
  @Prop({ required: true })
  industry: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type IndustryDocument = Industry & Document;
export const IndustrySchema = SchemaFactory.createForClass(Industry);

//SubIndustry Schema
@Schema()
export class SubIndustry {
  @Prop({ required: true })
  industryId: string;

  @Prop({ required: true })
  subIndustry: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type SubIndustryDocument = SubIndustry & Document;
export const SubIndustrySchema = SchemaFactory.createForClass(SubIndustry);

//Company Schema
@Schema()
export class Company {
  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  industryId: string;
  
  @Prop({ required: true })
  peRatio: number;

  @Prop({ required: true })
  pbRatio: number;

  @Prop({ required: true })
  ebitda: number;

  @Prop({ required: true })
  sales: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type CompanyDocument = Company & Document;
export const CompanySchema = SchemaFactory.createForClass(Company);

//ValuationMethod Schema
@Schema()
export class ValuationMethod {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type ValuationMethodDocument = ValuationMethod & Document;
export const ValuationMethodSchema =
  SchemaFactory.createForClass(ValuationMethod);

//Tax Rate Schema
@Schema()
export class TaxRate {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type TaxRateDocument = TaxRate & Document;
export const TaxRateSchema = SchemaFactory.createForClass(TaxRate);

//Discount Rate Schema
@Schema()
export class DiscountRate {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type DiscountRateDocument = DiscountRate & Document;
export const DiscountRateSchema = SchemaFactory.createForClass(DiscountRate);

//Terminal Growth Rate Schema
@Schema()
export class TerminalGrowthRate {
  @Prop({ required: true })
  rate: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type TerminalGrowthRateDocument = TerminalGrowthRate & Document;
export const TerminalGrowthRateSchema =
  SchemaFactory.createForClass(TerminalGrowthRate);

//Cost of Equity Method Schema
@Schema()
export class COEMethod {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type COEMethodDocument = COEMethod & Document;
export const COEMethodSchema = SchemaFactory.createForClass(COEMethod);

//Risk Free Rate Schema
@Schema()
export class RiskFreeRate {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  beta1: number;
  
  @Prop({ required: true })
  beta0: number;

  @Prop({ required: true })
  beta2: number;

  @Prop({ required: true })
  beta3: number;

  @Prop({ required: true })
  tau1: number;

  @Prop({ required: true })
  tau2: number;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type RiskFreeRateDocument = RiskFreeRate & Document;
export const RiskFreeRateSchema = SchemaFactory.createForClass(RiskFreeRate);

//Expected Market Return Schema
@Schema()
export class ExpMarketReturn {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type ExpMarketReturnDocument = ExpMarketReturn & Document;
export const ExpMarketReturnSchema =
  SchemaFactory.createForClass(ExpMarketReturn);

//Beta Schema
@Schema()
export class Beta {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type BetaDocument = Beta & Document;
export const BetaSchema = SchemaFactory.createForClass(Beta);

//Risk Premium Schema
@Schema()
export class RiskPremium {
  @Prop({ required: true })
  riskPremium: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type RiskPremiumDocument = RiskPremium & Document;
export const RiskPremiumSchema = SchemaFactory.createForClass(RiskPremium);

//Cost of Preference Share Capital Schema
@Schema()
export class COPShareCapital {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type COPShareCapitalDocument = COPShareCapital & Document;
export const COPShareCapitalSchema =
  SchemaFactory.createForClass(COPShareCapital);

//Cost of Debt Schema
@Schema()
export class COD {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type CODDocument = COD & Document;
export const CODSchema = SchemaFactory.createForClass(COD);

//Capital Structure Schema
@Schema()
export class CapitalStructure {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type CapitalStructureDocument = CapitalStructure & Document;
export const CapitalStructureSchema =
  SchemaFactory.createForClass(CapitalStructure);

  //Proportion of Preference Share Capital Schema
@Schema()
export class POPShareCapital {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  modifiedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export type POPShareCapitalDocument = POPShareCapital & Document;
export const POPShareCapitalSchema =
  SchemaFactory.createForClass(POPShareCapital);
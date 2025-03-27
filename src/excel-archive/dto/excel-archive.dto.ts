import { IsNotEmpty, IsNumber, IsString, IsOptional, IsArray, ValidateNested } from "class-validator";

export class ExcelArchiveDto {
    @IsNotEmpty({ message: 'processStateId cannot be empty' })
    @IsString({ message: 'processStateId is required' })
    processStateId: string;
    
    @IsNotEmpty({ message: 'fileName cannot be empty' })
    @IsString({ message: 'filename is required' })
    fileName: string;
    
    @IsString({ message: 'sheetUploaded is required' })
    sheetUploaded: string;
    
    @IsOptional()
    @IsNumber({}, { message: 'profitLossRowCount should be a number' })
    profitLossSheetRowCount: number;

    @IsOptional()
    @IsNumber({}, { message: 'cashFlowSheetRowCount should be a number' })
    cashFlowSheetRowCount: number;

    @IsOptional()
    @IsNumber({}, { message: 'balanceSheetRowCount should be a number' })
    balanceSheetRowCount: number;

    @IsOptional()
    @IsNumber({}, { message: 'rule11UaSheetRowCount should be a number' })
    rule11UaSheetRowCount: number;

    @IsOptional()
    @IsNumber({}, { message: 'assessmentSheetRowCount should be a number' })
    assessmentSheetRowCount: number;
    
    @IsNotEmpty({ message: 'fileSize cannot be empty' })
    @IsString({ message: 'fileSize should be string' })
    fileSize: string;
    
    @IsNotEmpty({ message: 'fileType cannot be empty' })
    @IsString({ message: 'fileType should be string' })
    fileType: string;
    
    @IsNotEmpty({ message: 'importedBy cannot be empty' })
    @IsString({ message: 'importedBy should be string' })
    importedBy: string;

    @IsNotEmpty({ message: 'status cannot be empty' })
    @IsString({ message: 'status should be string' })
    status: string;
    
    @IsOptional()
    @IsArray({ message: 'balanceSheetdata must be an array' })
    @ValidateNested({ each: true })
    balanceSheetdata: [];

    @IsOptional()
    @IsArray({ message: 'profitLossSheetdata must be an array' })
    @ValidateNested({ each: true })
    profitLossSheetdata: [];

    @IsOptional()
    @IsArray({ message: 'cashFlowSheetdata must be an array' })
    @ValidateNested({ each: true })
    cashFlowSheetdata: [];

    @IsOptional()
    @IsArray({ message: 'assessmentSheetData must be an array' })
    @ValidateNested({ each: true })
    assessmentSheetData: [];

    @IsOptional()
    @IsArray({ message: 'rule11UaSheetdata must be an array' })
    @ValidateNested({ each: true })
    rule11UaSheetdata: [];
  }
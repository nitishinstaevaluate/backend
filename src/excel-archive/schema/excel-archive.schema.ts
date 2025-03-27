import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey:false })
export class ExcelArchive {
    @Prop({ type: String })
    processStateId: string;

    @Prop({ type: String })
    fileName: string;

    @Prop({  required:false })
    sheetUploaded: Array<string>;

    @Prop({ type: Number })
    balanceSheetRowCount: number;

    @Prop({ type: Number })
    profitLossSheetRowCount: number;

    @Prop({ type: Number })
    rule11UaSheetRowCount: number;

    @Prop({ type: Number })
    cashFlowSheetRowCount: number;

    @Prop({ type: Number })
    assessmentSheetRowCount: number;

    @Prop({ type: String })
    fileSize: string;

    @Prop({ type: String })
    fileType: string;

    @Prop({ type: String })
    importedBy: string;

    @Prop({ type: String })
    status: string;

    @Prop({ type: Array<Object>, required:false })
    balanceSheetdata: Array<object>;
    
    @Prop({ type: Array<Object>, required:false })
    profitLossSheetdata: Array<object>;

    @Prop({ type: Array<Object>, required:false })
    cashFlowSheetdata: Array<object>;
    
    @Prop({ type: Array<Object>, required:false })
    rule11UaSheetdata: Array<object>;

    @Prop({ type: Array<Object>, required:false })
    assessmentSheetData: Array<object>;

    @Prop({ default: () => new Date(), required: false })
    createdOn: Date;

    @Prop({ default: () => new Date(), required: false })
    modifiedOn: Date;
}

export type ExcelArchiveDocument = ExcelArchive & Document;
export const ExcelArchiveSchema = SchemaFactory.createForClass(ExcelArchive);
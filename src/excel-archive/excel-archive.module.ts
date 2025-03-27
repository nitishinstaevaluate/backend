import { Module } from '@nestjs/common';
import { ExcelArchiveService } from './service/excel-archive.service';
import { ExcelArchiveController } from './controller/excel-archive.controller';
import { ExcelArchiveSchema } from './schema/excel-archive.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports:[MongooseModule.forFeature([{ name: 'excelArchive', schema: ExcelArchiveSchema }])],
  providers: [ExcelArchiveService],
  controllers: [ExcelArchiveController],
  exports:[ExcelArchiveService]
})
export class ExcelArchiveModule {}

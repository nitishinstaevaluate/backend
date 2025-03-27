import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Param,
  NotFoundException,
  Body,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { CustomLogger } from 'src/loggerService/logger.service';
import { Observable, catchError, from, throwError } from 'rxjs';
import { ExcelSheetService } from './uploadExcel.service';
import { AuthGuard } from '@nestjs/passport';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}-${file.originalname}`;
    cb(null, fileName);
  },
});

@Controller('upload')
export class UploadController {
  constructor(
    private readonly customLogger:CustomLogger,
    private excelSheetService: ExcelSheetService,
  ) {
    this.createUploadsDirectoryIfNotExist();
  }
  private createUploadsDirectoryIfNotExist() {
    const directory = './uploads';
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
  }

  // @UseGuards(KeyCloakAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage }))
  async uploadFile(
    @UploadedFile() formData,  
    @Body('processId') processId: string,
    @Body('modelName') modelName: string, 
    @Req() request) {
      return  await this.excelSheetService.uploadExcelProcess(formData, processId, modelName, request);
  }

  // @UseGuards(KeyCloakAuthGuard)
  @Get('dates')
  getUploadDates() {
    const uploadDir = path.join(__dirname, '../../uploads');
    const excelFiles = fs
      .readdirSync(uploadDir)
      .filter((file) => file.endsWith('.xlsx') || file.endsWith('.xls'));
    const fileDates = excelFiles.map((file) => ({
      fileName: file,
      uploadDate: fs.statSync(path.join(uploadDir, file)).mtime,
    }));
    return fileDates;
  }

  @UseGuards(KeyCloakAuthGuard)
  @Get('sheet/:fileName/:sheetName/:processStateId')
  getSheetData(
    @Param('fileName') fileName: string,
    @Param('sheetName') sheetName: string,
    @Param('processStateId') processStateId: string,
    @Req() request
  ) :Observable<any> {
     return from(this.excelSheetService.getSheetData(fileName, sheetName, request, processStateId))
    .pipe(
      catchError((error) => {
        return throwError (error);
      })
    );
  }

  // @UseGuards(KeyCloakAuthGuard)
  @Post('export-valuation')
  async generatePdf(
    @Body() payload:any,
    @Res() res,
    @Req() request,
  ) {
    return await this.excelSheetService.generateValuation(payload, res, request);
  }

  // @UseGuards(KeyCloakAuthGuard)
  @Get('export-eleven-ua/:elevenUaId/:type')
  async generateElevenUApdf(
    @Param('elevenUaId') id : string,
    @Res() res,
    @Param('type') formatType : string,
    @Req() request
  ) {
    return await this.excelSheetService.exportElevenUa(id,res, formatType, request);
  }


  @UseGuards(KeyCloakAuthGuard)
  @Post('modifyExcel')
  async modifyExcel(@Body() excelData, @Req() request){
    return await this.excelSheetService.modifyExcelSheet(excelData, request);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('download-excel-template')
  async fetchExcelTemplate(
    @Body() templateData:any,
    @Res() response
  ){
    return await this.excelSheetService.downloadTemplate(templateData, response)
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('convert-excel-to-json')
  async insertExcelJSON(
    @Body() templateData:any,
    @Req() request
  ){
    const { modelName, uploadedFileData, processStateId} = templateData;
    return await this.excelSheetService.loadExcelJSONintoDB(modelName, uploadedFileData, request, processStateId);
  }
}

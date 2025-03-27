import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as stream from 'stream';
import * as ExcelJS from 'exceljs';
import { columnsList } from './excelSheetConfig';
import { AuthGuard } from '@nestjs/passport';
import { CASHFLOW_VALUE_UPDATION_LIST, EXCEL_CONVENTION, MODEL, XL_SHEET_ENUM } from 'src/constants/constants';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { templateYearSet } from './common.methods';

@Controller('download')
export class ExportTemplateController {

  // @UseGuards(KeyCloakAuthGuard)
  @Get('/template')
  async download(
    @Query('projectionYears') projectionYears: number,
    @Query('modelName') modelType: string | undefined,
    @Query('valuationDate') valuationDate: string | undefined,
    @Res() res: Response,
  ) {
   try{
    if(modelType === XL_SHEET_ENUM[1]){
      const filePath = `template/ruleElevenUaTemplate.xlsx`;
      const buffer = fs.readFileSync(filePath);

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename= Template-${new Date().getTime()}.xlsx`,
      );
    
      res.send(buffer);
    return;
    }
    if(modelType === XL_SHEET_ENUM[4]){
      const filePath = `template/slumpSaleTemplate.xlsx`;
      const buffer = fs.readFileSync(filePath);

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename= Template-${new Date().getTime()}.xlsx`,
      );
    
      res.send(buffer);
    return;
    }

    let PLheaderRow = ['A1']; // Starting of PL header row
    let BSheaderRow = ['A1']; // Starting of BS header row
    let CFHeaderRow = ['A1']; // Starting of Cash Flow header row
    const filePath = `template/template-v2.xlsx`;

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    const rawValuationDate = valuationDate || new Date().getTime();
    const getFinancialYearDate = await templateYearSet(+rawValuationDate);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const currentYear = new Date(getFinancialYearDate).getFullYear();


    //#region Cash Flow Starts    
    if(modelType === XL_SHEET_ENUM[0]){
      const cashFlowWorksheet:any = workbook.getWorksheet(6);
      CFHeaderRow.push('B1')// Intentially pushing 'B' since we want to start adding years from C column and not from B
      cashFlowWorksheet.getColumn(
        'C',
      ).header = `'{{Add provisional financial date in DD-MM-YYYY}} format`;
      CFHeaderRow.push('C1');
      // cashFlowWorksheet.getCell('C1').value = { formula: `'BS'!B1` };
  
        let cfcount = 0;
        // Start for loop from C column incase of P&L, i = 2 
        for (let i = 1; i <= projectionYears; i++) {
          const columnLetter = columnsList[i+1];
          CFHeaderRow.push(`${columnLetter}1`);
          const headerText = `${currentYear + cfcount}-${currentYear + i}`;
          cashFlowWorksheet.getColumn(columnLetter).header = headerText;
          cashFlowWorksheet.getColumn(columnLetter).width = 15;
          cfcount++;
        }
  
      await this.setHeaderStyles(cashFlowWorksheet, CFHeaderRow, '195478', 'FFFFFF'); 
      // await this.addCellAutoFilters(cashFlowWorksheet, CFHeaderRow.length);
  
      const getCashFlowFirstRow = await this.getFirstRowIndexName(cashFlowWorksheet);
      await this.updateExcelFormulas(cashFlowWorksheet,getCashFlowFirstRow, EXCEL_CONVENTION['Cash Flow'].key, modelType);
      // cashFlowWorksheet.protect('nitish@ifin', {
      //     selectLockedCells: true,
      //     selectUnlockedCells: true,
      //     formatCells: false,
      //     formatColumns: false,
      //     formatRows: false,
      //     insertColumns: false,
      //     insertRows: false,
      //     deleteColumns: false,
      //     deleteRows: false
      // });
    }
    else{
      workbook.removeWorksheet(6);
    }
    //#endregion Cash Flow Ends
    


    //#region Profit Loss excel
    /**
     * Profit Loss excel Sheet Index starts from 2
     */
    if(modelType === XL_SHEET_ENUM[0]){
      const plWorksheet:any = workbook.getWorksheet(2);
      /**
       * Intentially pushing 'B' & 'C' since we want to start adding years from D column
       */
      PLheaderRow.push('B1');
      PLheaderRow.push('C1');

      plWorksheet.getColumn(
        'D',
      ).header = `'{{Add provisional financial date in DD-MM-YYYY}} format`;
      PLheaderRow.push('D1');

      if(modelType !== 'marketApproach'){
        let count = 0;
        for (let i = 1; i <= projectionYears; i++) {
          const columnLetter = columnsList[i+2];
          PLheaderRow.push(`${columnLetter}1`);
          const headerText = `${currentYear + count}-${currentYear + i}`;
          plWorksheet.getColumn(columnLetter).header = headerText;
          plWorksheet.getColumn(columnLetter).width = 15;
          count++;
        }
      }

      await this.setHeaderStyles(plWorksheet, PLheaderRow, '195478', 'FFFFFF'); 
      // await this.addCellAutoFilters(plWorksheet, PLheaderRow.length);
      
      const getProfitLossFirstRow = await this.getFirstRowIndexName(plWorksheet);
      await this.updateExcelFormulas(plWorksheet,getProfitLossFirstRow, EXCEL_CONVENTION['P&L'].key, modelType);
    }

    if(modelType === XL_SHEET_ENUM[2]){
      const plWorkSheet:any = workbook.getWorksheet(2);
      PLheaderRow.push('B1');
      plWorkSheet.getColumn(
        'C',
      ).header = `'{{Add provisional financial date in DD-MM-YYYY}} format`;
      PLheaderRow.push('C1');

      // for (let rowIndex = 1; rowIndex <= plWorkSheet.rowCount; rowIndex++) {
      //   let row = plWorkSheet.getRow(rowIndex);
    
      //   const cell = row.getCell(5);
      //   cell.border = {
      //     top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      //     left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      //     bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      //     right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      //   };
    
      //   row.commit();
      // }

      plWorkSheet.spliceColumns(4, 1);  
      await this.setHeaderStyles(plWorkSheet, PLheaderRow, '195478', 'FFFFFF'); 
    }
    
    if(modelType === XL_SHEET_ENUM[3]){
      workbook.removeWorksheet(2);
    }
    //#endregion Profit Loss excel  
    

    //#region Balance Sheet Excel
    /**
     * Balance Sheet Sheet Index starts from 5
     */
    if(modelType !== XL_SHEET_ENUM[3] && modelType !== XL_SHEET_ENUM[2]){
      const bsWorkSheet:any = workbook.getWorksheet(5);
      BSheaderRow.push('B1');

      bsWorkSheet.getColumn(
        'C',
      ).header = `'{{Add provisional financial date in DD-MM-YYYY}} format`;
      BSheaderRow.push('C1');
      
      if(modelType !== 'marketApproach'){
      let count2 = 0;
      
      for (let i = 1; i <= projectionYears; i++) {
        const columnLetter = columnsList[i+1];
        BSheaderRow.push(`${columnLetter}1`);
        const headerText = `${currentYear + count2}-${currentYear + i}`;
        bsWorkSheet.getColumn(columnLetter).header = headerText;
        bsWorkSheet.getColumn(columnLetter).width = 15;
        count2++;
      }
      }

      await this.setHeaderStyles(bsWorkSheet, BSheaderRow, '195478', 'FFFFFF'); 
      // await this.addCellAutoFilters(bsWorkSheet, BSheaderRow.length);
    
      const getBalanceSheetFirstRow = await this.getFirstRowIndexName(bsWorkSheet)
      await this.updateExcelFormulas(bsWorkSheet,getBalanceSheetFirstRow, EXCEL_CONVENTION.BS.key, modelType);
    }
    else{
      const bsWorkSheet:any = workbook.getWorksheet(5);
      bsWorkSheet.getColumn(
        'B',
      ).header = `'{{Add provisional financial date in DD-MM-YYYY}} format`;
      BSheaderRow.push('B1');

      // for (let rowIndex = 1; rowIndex <= bsWorkSheet.rowCount; rowIndex++) {
      //   let row = bsWorkSheet.getRow(rowIndex);
    
      //   const cell = row.getCell(3);
    
      //   cell.border = {
      //     top: { style: 'thin', color: { argb: 'D9EAF7' } },
      //     left: { style: 'thin', color: { argb: 'D9EAF7' } },
      //     bottom: { style: 'thin', color: { argb: 'D9EAF7' } },
      //     right: { style: 'thin', color: { argb: 'D9EAF7' } },
      //   };
    
      //   row.commit();
      // }
      bsWorkSheet.spliceColumns(3, 1);  
      await this.setHeaderStyles(bsWorkSheet, BSheaderRow, '195478', 'FFFFFF'); 
    }
    //#endregion Balance Sheet Excel

    const buffer = await workbook.xlsx.writeBuffer();
    const fileStream = new stream.PassThrough();
    fileStream.end(buffer);

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename= Template-${new Date().getTime()}.xlsx`,
    );

    fileStream.pipe(res);
   }
   catch(error){
    console.log(error);
    throw error;
   }
  }

  async getFirstRowIndexName(worksheet){
   try{
    let firstRowName = [];
    let currentColumn = '';
    let letterIndex = 0;

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (rowNumber === 1 && cell.text) {
                if (letterIndex === 0) {
                    currentColumn = String.fromCharCode(65 + letterIndex); // 'A'
                } else {
                    currentColumn = this.getColumnLabel(letterIndex);
                }
                firstRowName.push(currentColumn);
                letterIndex++;
            }
        });
    });
    return firstRowName;
   }
   catch(error){
    throw error;
   }
  }
 
  /**
   * Create Excel using Shared formulae
   * @param worksheet 
   * @param firsRowName 
   * @param sheetName 
   */
  async updateExcelFormulas(worksheet,firsRowName, sheetName, approach){
   try{
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      let updationColumnFormulaReqd = false;
    
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const columnLetter = String.fromCharCode(65 + colNumber - 1);
    
        /**
         * Cash and Retained Earnings logic 
         * */ 
        if (cell.value && typeof cell.value === 'string' && approach === XL_SHEET_ENUM[0]) {
          const lowerCaseValue = cell.value.toLowerCase();
    
          if (lowerCaseValue.includes("cash and cash equivalent") || lowerCaseValue.includes("retained earnings")) {
            /**
             * For Balance Sheet (BS)
             *  */ 
            if (sheetName === 'BS') {
              for (let i = 0; i < firsRowName.length; i++) {
                if (!['A', 'B', 'C'].includes(firsRowName[i])) {
                  const newCellAddress = firsRowName[i] + rowNumber;
                  
                  worksheet.getCell(newCellAddress).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFBBBBBB' },
                    bgColor: { argb: 'FFBBBBBB' }
                  };
    
                  /**
                   * Row 33 Special Handling (Cash Flow)
                   * */ 
                  if (rowNumber === 33) {
                    const prevFormula = this.getPreviousAddress(firsRowName[i], worksheet, rowNumber) || `'Cash Flow'!C46`;
                    const formula = this.replaceColumnReferences(prevFormula);
                    worksheet.getCell(newCellAddress).value = { formula, result: 0 };
                  }
    
                  /**
                   * Row 53 Special Handling (Retained Earnings)
                   *  */ 
                  if (rowNumber === 53) {
                    const prevFormula = (i === 4)
                      ? `C53 + 'P&L'!E53`
                      : this.getPreviousAddress(firsRowName[i], worksheet, rowNumber) || `A53 + 'P&L'!D53`;
                    const formula = this.replaceColumnReferences(prevFormula);
                    worksheet.getCell(newCellAddress).value = { formula, result: 0 };
                  }
                }
              }
            }
    
          }
          /**
           * Check cross Columns Adjusting required for Cash Flow
           */
          if (sheetName === EXCEL_CONVENTION['Cash Flow'].key) {
            updationColumnFormulaReqd = this.cashFlowColumnUpdationNeeded(cell.value);
          }
        }
    
        //#region Section: Balance Sheet (BS)
        if (sheetName === 'BS' && cell.formula) {
          for (let i = 0; i < firsRowName.length; i++) {
            if (approach === XL_SHEET_ENUM[3] ? !['A', 'B'].includes(firsRowName[i]) : !['A', 'B', 'C'].includes(firsRowName[i])) {
              const newCellAddress = firsRowName[i] + rowNumber;
              const formula = this.replaceColumnReferences(this.getPreviousAddress(firsRowName[i], worksheet, rowNumber));
              this.updateFormulasInWrksht(worksheet, newCellAddress, formula, cell, row, columnLetter);
            }
          }
        }
        //#endregion
    
        //#region  Section: Profit & Loss (P&L)
        if (sheetName === 'P&L' && cell.formula && approach !== XL_SHEET_ENUM[3]) {
          for (let i = 0; i < firsRowName.length; i++) {
            if (!['A', 'B', 'C', 'D'].includes(firsRowName[i])) {
              const newCellAddress = firsRowName[i] + rowNumber;
              const formula = this.replaceColumnReferences(this.getPreviousAddress(firsRowName[i], worksheet, rowNumber));
              this.updateFormulasInWrksht(worksheet, newCellAddress, formula, cell, row, columnLetter);
            }
          }
        }
        //#endregion
    
        //#region  Section: Cash Flow
        if (sheetName === EXCEL_CONVENTION['Cash Flow'].key && cell.formula && approach === XL_SHEET_ENUM[0] ) {
          for (let i = 0; i < firsRowName.length; i++) {
            if (!['A', 'B', 'C', 'D'].includes(firsRowName[i])) {
              const newCellAddress = firsRowName[i] + rowNumber;
              const prevFormula = this.getPreviousAddress(firsRowName[i], worksheet, rowNumber);
              const updatedFormula = (updationColumnFormulaReqd && firsRowName[i] === 'E')
                ? prevFormula.replace(/B([0-9])/g, 'C$1')
                : prevFormula;
    
              if (columnLetter === 'D') {
                const cashFlowFormula = this.replaceColumnReferences(updatedFormula);
                this.updateFormulasInWrksht(worksheet, newCellAddress, cashFlowFormula, cell, row, columnLetter);
              }
            }
          }
        }
        //#endregion
      });
    });
    
  }
  catch(error){
    throw error;
  }
}


getPreviousAddress(elementAtChar, worksheet, rowNumber){
  const columnCode = elementAtChar.charCodeAt(0);
  const letter =  String.fromCharCode(columnCode - 1)
  const prevCellAddress = letter + rowNumber;

  return worksheet.getCell(prevCellAddress).formula;
}

/**
 * Used to Replace the old column Cell Alphabet with the new one
 * @param formula 
 * @param oldColumn 
 * @param newColumn 
 * @returns 
 */
replaceColumnReferences(prevFormula) {
  return prevFormula.replace(/([A-Z])([0-9])/g, (match, columnLetter, rest) => {
    const nextColumnLetter = this.getNextColumnLetter(columnLetter);
    return nextColumnLetter + rest;
  });
}

/**
 * 
 * @param column 
 * @returns 
 */
 getNextColumnLetter(column) {
  const columnCode = column.charCodeAt(0);
  return String.fromCharCode(columnCode + 1);
}

/**
 * @param worksheet 
 * @param headers 
 * @param bgColor 
 * @param textColor 
 */
async setHeaderStyles(worksheet, headers, bgColor, textColor) {
  headers.forEach((header) => {
      const cell = worksheet.getCell(header);
      if(cell.value){
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor } // Background color
        };
        cell.font = {
          size: 11,
          bold: true,
          color: { argb: textColor },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          // wrapText: true,
         };
      }
  });
}

async addCellAutoFilters(worksheet, projectionYears){
  const startColumn = String.fromCharCode(65); // Start column ('A' is the first column)
  const endColumn = String.fromCharCode(65 + projectionYears - 1); // Last column based on projectionYears
  
  worksheet.autoFilter = {
      from: { row: 1, column: worksheet.getColumn(startColumn).number },
      to: { row: 1, column: worksheet.getColumn(endColumn).number }
  };

  worksheet.views = [
      { state: 'frozen', ySplit: 1 } 
  ];
}

getColumnLabel(index) {
  let label = '';
  while (index >= 0) {
      label = String.fromCharCode(65 + (index % 26)) + label;
      index = Math.floor(index / 26) - 1;
  }
  return label;
}

cashFlowColumnUpdationNeeded(value){
  return CASHFLOW_VALUE_UPDATION_LIST.some(_el => _el.toLowerCase() === value.toLowerCase());
}

updateFormulasInWrksht(worksheet, newCellAddress, formula, cell, row, columnLetter){
  worksheet.getCell(newCellAddress).value = {
    formula: formula,
    result: 0
  };
  if (cell.fill) {
    worksheet.getCell(newCellAddress).fill = {
        type: 'pattern',
        pattern: cell.fill.pattern,
        fgColor: cell.fill.fgColor,
        bgColor: cell.fill.bgColor
    };
  }
  const prevCell = row.getCell(columnLetter); // Get previous cell in the same row
  if (prevCell.border) {
      worksheet.getCell(newCellAddress).border = {
          top: prevCell.border.top,
          left: prevCell.border.left,
          bottom: prevCell.border.bottom,
          right: prevCell.border.right
      };
  }
  if (prevCell.font && prevCell.font.bold) {
    worksheet.getCell(newCellAddress).font = {
        bold: true,
    };
  }
}
}

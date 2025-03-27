import { Injectable } from '@nestjs/common';

import {
  getYearsList,
  getCellValue,
  parseDate,
  getFormattedProvisionalDate,
  convertToNumberOrZero,
  getDateKey
} from '../excelFileServices/common.methods';
import { columnsList, sheet2_BSObj, sheet1_PLObj, V2_BS_RAW_LINE_ITEMS } from '../excelFileServices/excelSheetConfig';
import { CustomLogger } from 'src/loggerService/logger.service';
import { GET_MULTIPLIER_UNITS, NAV_FIELD_MAPPER } from 'src/constants/constants';
import { computeOtherNonCurrentAssets } from './net-asset-value.method';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';
import { convertToRomanNumeral } from 'src/report/report-common-functions';
const date = require('date-and-time');
@Injectable()
export class NetAssetValueService {
  constructor(private readonly customLogger: CustomLogger,
    private excelArchiveService: ExcelArchiveService
  ) { }

  async navValuation(input: any){
    try{
      const processId = input?.processStateId;
      const { balanceSheetData } = await this.getSheetData(processId);

      const provisionalDate  = getDateKey(balanceSheetData[0]);
      
      const balanceSheetComputed = await this.serializeArrayObject(balanceSheetData);

      const {valuePerShare, navStructure} = await this.computeNavValuation(input.navInputs, balanceSheetComputed, provisionalDate, input);
      return {
        result: navStructure,
        valuation: valuePerShare,
        provisionalDate:parseDate(provisionalDate),
        msg: 'Net Asset Value Calculated Successfully',
        status: true
      };
    }
    catch(error){
      throw error;
    }
  }

  async getSheetData(processId){
    try{
      const loadExcelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processId);
      if(loadExcelArchive?.balanceSheetRowCount){
        const balanceSheetData = loadExcelArchive.balanceSheetdata;
        /**
         * For NAV Valuation
         * Do not need Profit-Loss & Assessment Sheet
         */
        return { balanceSheetData };
      }
      return null;
    }
    catch(error){
      throw error;
    }
  }

  async computeNavValuation(navInputs, balanceSheetData, provisionalDate, input){
    let navStructure = {}, valuePerShare, node = '', root = ''; 
    if(!navInputs?.length) throw new Error('Nav input array found to be empty');

    let childProcessTrck = 0, rootProcessTrck = 0;
    for (const key in NAV_FIELD_MAPPER) {
      const fieldInfo = NAV_FIELD_MAPPER[key];
    
      const matchingInput = navInputs.find(indEle => indEle.fieldName === key);
      const boolEmptyValidator = (fieldInfo.fieldName === NAV_FIELD_MAPPER.ncaImmoveable.fieldName && (balanceSheetData[NAV_FIELD_MAPPER.ncaPlntAndMachnry.xlField]?.[provisionalDate] || balanceSheetData[NAV_FIELD_MAPPER.ncaLndAndBlding.xlField]?.[provisionalDate])) || (matchingInput?.value || balanceSheetData[fieldInfo.xlField]?.[provisionalDate]);

      if(fieldInfo?.node && node !== fieldInfo?.node) {
        childProcessTrck = 0;
        node = fieldInfo.node;
      }

      if(fieldInfo?.root && root !== fieldInfo?.root){
        rootProcessTrck = 0;
        root = fieldInfo.root;
      }

      const headerAdjuster = this.validateRoot(fieldInfo, boolEmptyValidator, root) ? `(${String.fromCharCode(97 + rootProcessTrck++)}) ${fieldInfo.marker}` :  false;
      if (matchingInput) {
        if(!boolEmptyValidator) continue;

        const fieldIdentifier = (node === fieldInfo?.leaf)  ? `(${convertToRomanNumeral(childProcessTrck++)}) ${fieldInfo.marker}` : fieldInfo?.xlField;         

        if (!fieldInfo.alias) {
          navStructure[key] = { 
            fieldName: headerAdjuster || fieldIdentifier,
            bookValue: balanceSheetData[fieldInfo.xlField]?.[provisionalDate] || 0,
            fairValue: matchingInput?.value || (balanceSheetData[fieldInfo.xlField]?.[provisionalDate] || 0),
            containsValue: true,
            header:fieldInfo?.header || false,
            subHeader:fieldInfo?.subHeader || false,
            reqLBrk:fieldInfo?.reqLBrk || false,
            reqUBrk:fieldInfo?.reqUBrk || false,
            mainHead:fieldInfo.mainHead || false,
            mainSubHead:fieldInfo.mainSubHead || false,
            nestedSubHeader:fieldInfo.nestedSubHeader || false,
          };
        }
      } else {
          navStructure[fieldInfo.alias] = {
            fieldName: headerAdjuster || fieldInfo.marker,
            fairValue:await this.innerCalculation(fieldInfo.alias,navStructure, 'market_value', input),
            bookValue:await this.innerCalculation(fieldInfo.alias,navStructure, 'book_value', input),
            containsValue: false,
            header:fieldInfo?.header || false,
            subHeader:fieldInfo?.subHeader || false,
            reqLBrk:fieldInfo?.reqLBrk || false,
            reqUBrk:fieldInfo?.reqUBrk || false,
            mainHead:fieldInfo.mainHead || false,
            mainSubHead:fieldInfo.mainSubHead || false,
            nestedSubHeader:fieldInfo.nestedSubHeader || false
          };

          if (fieldInfo.alias === NAV_FIELD_MAPPER.valuePerShare.alias) valuePerShare = navStructure[fieldInfo.alias]
      }
    }
    return {navStructure, valuePerShare};
  }

  validateRoot(fieldInfo, boolEmptyValidator, root){
    if(
      (
        root === fieldInfo?.parent &&  boolEmptyValidator
      ) || 
      fieldInfo?.alias === NAV_FIELD_MAPPER.subHeadPrptyPlntAndEqpmnt.alias ||
      fieldInfo?.alias === NAV_FIELD_MAPPER.subHeadFincialLb.alias ||
      fieldInfo?.alias === NAV_FIELD_MAPPER.subHeadFincialNLb.alias ||
      fieldInfo?.alias === NAV_FIELD_MAPPER.subHeadFincialCAsst.alias ||
      fieldInfo?.alias === NAV_FIELD_MAPPER.subHeadFincialNCrntAsst.alias
      
    ) return true;
    return false;
  }
  async serializeArrayObject(array){
    let excelArchive = {};
    for await (const indArchive of array){
      const {lineEntry, 'Sr no.': srNo, ...rest} = indArchive; 
      excelArchive[indArchive.lineEntry.particulars] = rest;
    }
    return excelArchive;
  }

  async innerCalculation(label, structure, type, input){
    const keyStruc = Object.keys(structure);
    switch(label){
      case NAV_FIELD_MAPPER.headTotalNCrntAsst.alias:
        let totalOtherNoa = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.ncaMoveable.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaImmoveable.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaPlntAndMachnry.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaLndAndBlding.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaCptlWrkInPrgrss.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaInvstmntPrprty.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaGoodwill.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaOthrIntngbleAsst.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaInTngbleAsstUndrDevlpmnt.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaBiolgclAsstOthrThnBrPlnt.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaRghtOfUseOfAsst.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaInvstmntInSbsidryJvAssciate.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaOthrNCrntInvstmnt.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaLngTrmLoansAndAdvncmnt.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaDffrdTxAsst.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaOthrNCrntAsst.fieldName ||
            ind === NAV_FIELD_MAPPER.ncaDpst.fieldName
          ){
            if(type === 'book_value') totalOtherNoa += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') totalOtherNoa += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return totalOtherNoa;

      case NAV_FIELD_MAPPER.headTotalCrntAsst.alias:
        let TtlCrntAsst = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.caInvntries.fieldName || 
            ind === NAV_FIELD_MAPPER.caCrntInvstmnt.fieldName || 
            ind === NAV_FIELD_MAPPER.caTrdeRecvbles.fieldName || 
            ind === NAV_FIELD_MAPPER.caCshNCshEqvlnt.fieldName || 
            ind === NAV_FIELD_MAPPER.caBnkBlnceOthrThn.fieldName || 
            ind === NAV_FIELD_MAPPER.caShrtTrmLoansAndAdvnces.fieldName || 
            ind === NAV_FIELD_MAPPER.caCrntTxAsst.fieldName || 
            ind === NAV_FIELD_MAPPER.caOthrCrntAsst.fieldName
          ){
            if(type === 'book_value') TtlCrntAsst += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') TtlCrntAsst += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return TtlCrntAsst;

      case NAV_FIELD_MAPPER.headTotalAsst.alias:
        let ttlAsst = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.headTotalCrntAsst.alias || 
            ind === NAV_FIELD_MAPPER.headTotalNCrntAsst.alias
          ){
            if(type === 'book_value') ttlAsst += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') ttlAsst += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return ttlAsst;

      case NAV_FIELD_MAPPER.headNCrntLb.alias:
        let ttlNCrntLb = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.nclBrrwng.fieldName || 
            ind === NAV_FIELD_MAPPER.nclOthrFncialLb.fieldName || 
            ind === NAV_FIELD_MAPPER.nclLeaseLb.fieldName || 
            ind === NAV_FIELD_MAPPER.nclPrvisn.fieldName || 
            ind === NAV_FIELD_MAPPER.nclDeferredTaxLb.fieldName || 
            ind === NAV_FIELD_MAPPER.nclOthrNCrntLb.fieldName || 
            ind === NAV_FIELD_MAPPER.nclOthrNonOprtngLB.fieldName ||
            ind === NAV_FIELD_MAPPER.cntngntLbility.fieldName
          ){
            if(type === 'book_value') ttlNCrntLb += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') ttlNCrntLb += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return ttlNCrntLb;

      case NAV_FIELD_MAPPER.headTotalCrntLb.alias:
        let ttlCrntLb = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.clBrrwng.fieldName || 
            ind === NAV_FIELD_MAPPER.clTrdePyble.fieldName || 
            ind === NAV_FIELD_MAPPER.clOthrFncialLb.fieldName || 
            ind === NAV_FIELD_MAPPER.clOthrCrntLb.fieldName || 
            ind === NAV_FIELD_MAPPER.clPrvsion.fieldName || 
            ind === NAV_FIELD_MAPPER.clCrntTxLb.fieldName
          ){
            if(type === 'book_value') ttlCrntLb += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') ttlCrntLb += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return ttlCrntLb;

      case NAV_FIELD_MAPPER.headTotalLb.alias:
        let ttlLb = 0;
        for await(const ind of keyStruc){
          if(
            ind === NAV_FIELD_MAPPER.headNCrntLb.alias ||
            ind === NAV_FIELD_MAPPER.headTotalCrntLb.alias 
          ){
            if(type === 'book_value') ttlLb += convertToNumberOrZero(structure[ind].bookValue);
            if(type === 'market_value') ttlLb += convertToNumberOrZero(structure[ind].fairValue);
          }
        }
        return ttlLb;

      case NAV_FIELD_MAPPER.headNtAsstVal.alias:
        return type === 'book_value' ? 
        (convertToNumberOrZero(structure.headTotalAsst.bookValue) - convertToNumberOrZero(structure.headTotalLb.bookValue)) :
        (convertToNumberOrZero(structure.headTotalAsst.fairValue) - convertToNumberOrZero(structure.headTotalLb.fairValue));

      case NAV_FIELD_MAPPER.valuePerShare.alias:
        const multiplier = GET_MULTIPLIER_UNITS[`${input.reportingUnit}`];
        return type === 'book_value' ? 
        convertToNumberOrZero(structure.headNtAsstVal.bookValue) * multiplier/convertToNumberOrZero(structure.noOfShrs.bookValue) : 
        convertToNumberOrZero(structure.headNtAsstVal.fairValue) * multiplier/convertToNumberOrZero(structure.noOfShrs.fairValue);

      case NAV_FIELD_MAPPER.noOfShrs.alias:
        return input.outstandingShares;

      default: 
        return null
    }

  }
  catch(error){
    console.log("Net Asset Error:",error);
    throw error;
  }
}
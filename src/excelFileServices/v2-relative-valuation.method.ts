import { convertToNumberOrOne, convertToNumberOrZero, getCellValue } from "./common.methods";
import { columnsList, sheet1_PLObj, sheet2_BSObj, V2_BS_RAW_LINE_ITEMS, V2_PL_RAW_LINE_ITEMS } from "./excelSheetConfig";

// export async function versionTwoNetWorthOfCompany(column:number, worksheet2: any) {
//     const shareHoldersFund = await getCellValue(
//       worksheet2,
//       `${columnsList[column] + sheet2_BSObj.shareholderFundsRow}`,
//     );

//     const preferenceShareCapital = await getCellValue(
//       worksheet2,
//       `${columnsList[column] + sheet2_BSObj.preferenceShareCapitalRow}`,
//     );
    
//     return convertToNumberOrZero(shareHoldersFund) - convertToNumberOrZero(preferenceShareCapital);
//   }

export async function versionTwoNetWorthOfCompany(balanceSheetData, provisionalDate) {
    const totalEquity = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.totalEquityRow.particulars][provisionalDate];
    const prfrnceShreCptl = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.prfnceShareCapitalRow.particulars][provisionalDate];
    const revltionRsrve = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.revaluationResrveRow.particulars][provisionalDate];
    const shreApplctnMnyPndngAlltmnt = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.shareApplicationMoneyPendingAlltmntRow.particulars][provisionalDate];
    
    return convertToNumberOrZero(totalEquity) - 
    (
      convertToNumberOrZero(prfrnceShreCptl) + convertToNumberOrZero(revltionRsrve) + convertToNumberOrZero(shreApplctnMnyPndngAlltmnt)
    );
  }

// export async function versionTwoProfitLossValues(column:number, worksheet2: any) {
//     const profitLossValues = await getCellValue(
//       worksheet2,
//       `${columnsList[column] + sheet1_PLObj.profitLossOfYear}`,
//     );

//     return convertToNumberOrZero(profitLossValues);
//   }
export async function versionTwoProfitLossValues(profitLossData, provisionalDate) {
    const profitLossPrd = profitLossData[V2_PL_RAW_LINE_ITEMS.prftLossForPrdRow.particulars][provisionalDate];
    return convertToNumberOrZero(profitLossPrd);
  }
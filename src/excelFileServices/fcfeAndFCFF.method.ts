import { ASSESSMENT_OF_WC_RAW_LINE_ITEMS, sheet1_PLObj, sheet2_BSObj,sheet3_assWCObj, V2_BS_RAW_LINE_ITEMS, V2_PL_RAW_LINE_ITEMS } from './excelSheetConfig';
import { columnsList } from './excelSheetConfig';
import * as XLSX from 'xlsx';
import { convertToNumberOrZero, getCellValue } from './common.methods';

//worksheet1 is P&L sheet and worksheet2 is BS sheet.
// Old Pat function 
export async function GetPAT(i: number, worksheet1: any) {
  //formula: =+'P&L'!B42
  // console.log(worksheet1);
  const pat = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.patRow}`,
  );

  // console.log(`${columnsList[i] + sheet1_PLObj.changeInInventoryRow}`);
  // console.log(`${columnsList[i+1] + sheet1_PLObj.changeInInventoryRow}`);
  return pat;
}
export async function v2PatComputation(subkey, profitLossData: any) {
  return convertToNumberOrZero(profitLossData[V2_PL_RAW_LINE_ITEMS.prftLossForPerdFromContnuingOprtionsRow.particulars][subkey]);
}
// Old function
// export async function DepAndAmortisation(i: number, worksheet1: any) {
//   //formula: =+'P&L'!B26
//   const depAndAmortisation = await getCellValue(
//     worksheet1,
//     `${columnsList[i] + sheet1_PLObj.depAndAmortisationRow}`,
//   );
//   return depAndAmortisation;
// }
export async function DepAndAmortisation(subKey, profitLossData: any) {
  return convertToNumberOrZero(profitLossData[V2_PL_RAW_LINE_ITEMS.earningsBfrEBITDArow.innerEarningsBefreEBITDArow.lessDepcrtionAndAmorstionExpnseRow.particulars][subKey]);
}
export async function OtherNonCashItemsMethod(i: number, worksheet1: any) {
  //formula:  =+(-'P&L'!B29+'P&L'!B31+'P&L'!B33)
  const otherIncome = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.otherIncomeRow}`,
  );
  const exceptionalItems = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.exceptionalItemsRow}`,
  );
  const extraordinaryItems = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.extraordinaryItemsRow}`,
  );
  return exceptionalItems + extraordinaryItems - otherIncome;
}
export async function OtherNonCashItemsMethodNext(i: number, worksheet1: any) {
  //formula:  =+(-'P&L'!B29+'P&L'!B31+'P&L'!B33)
  const otherIncome = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.otherIncomeRow}`,
  );
  const exceptionalItems = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.exceptionalItemsRow}`,
  );
  const extraordinaryItems = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.extraordinaryItemsRow}`,
  );
  return exceptionalItems + extraordinaryItems - otherIncome;
}

export async function v2otherNonOperatingAssetsComputation(subkey, profitLossData) {
  /**
   * Sheet PL
   * 1 'Other Non-Operating Income'
   * 2 'Other Non-Operating expenses:'
   * 
   * return 1 + 2
   */

  const otherNonOperatingIncome = profitLossData[V2_PL_RAW_LINE_ITEMS.othrNonOperatingIncomeRow.particulars][subkey];
  const otherNonOperatingExpense = profitLossData[V2_PL_RAW_LINE_ITEMS.expensesRow.innerExpnseRow.othrNonOpertingExpnseRow.particulars][subkey];

  return (-convertToNumberOrZero(otherNonOperatingIncome) + convertToNumberOrZero(otherNonOperatingExpense));
}

export async function ChangeInNCA(i: number, worksheet2: any,worksheet3:any) {
  //formula: =+(SUM(@BS!B64:B69-BS!B68)-SUM(BS!B34:B40))-(SUM(@BS!C64:C69-BS!C68)-SUM(BS!C34:C40))

  // Current Column
  const tradeReceivables = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.tradeReceivablesRow}`,
  );
  const unbilledRevenues = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.unbilledRevenuesRow}`,
  );
  const inventories = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.inventoriesRow}`,
  );
  const advances = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.advancesRow}`,
  );
  const otherCurrentAssets = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.otherCurrentAssetsRow}`,
  );

  const otherNonCurrentAssets = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.otherNonCurrentAssetsRow}`,
  );

  const otherOperatingAssets = await getCellValue(
    worksheet3,
    `${columnsList[i] + sheet3_assWCObj.otherOperatingAssetsRow}`,
  );
  
  
  // b variables
  const tradePayables = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.tradePayablesRow}`,
  );
  const employeePayables = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.employeePayablesRow}`,
  );
  // const shortTermBorrowings = await getCellValue(
  //   worksheet2,
  //   `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
  // );
  const lcPayablesRow = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.lcPayablesRow}`,
  );
  const otherCurrentLiabilities = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.otherCurrentLiabilitiesRow}`,
  );
  const shortTermProvisions = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shortTermProvisionsRow}`,
  );

  const longTermProvisions = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.longTermProvisionRow}`,
  );

  // const interCo = await getCellValue(
  //   worksheet2,
  //   `${columnsList[i] + sheet2_BSObj.interCoRow}`,
  // );

  const otherOperatingLiabilities = await getCellValue(
    worksheet3,
    `${columnsList[i] + sheet3_assWCObj.otherOperatingLiabilitiesRow}`,
  );

  const sum1 =
    tradeReceivables +
    unbilledRevenues +
    inventories +
    advances +
    otherCurrentAssets +
    otherNonCurrentAssets +
    otherOperatingAssets;
  const sum2 =
    tradePayables +
    employeePayables +
    // shortTermBorrowings +
    lcPayablesRow +
    otherCurrentLiabilities +
    shortTermProvisions +
    otherOperatingLiabilities +
    longTermProvisions;
    // interCo;

  const currentSum = sum1 - sum2;

  // For next year
  // Current Column
  const nextTradeReceivables = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.tradeReceivablesRow}`,
  );
  const nextUnbilledRevenues = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.unbilledRevenuesRow}`,
  );
  const nextInventories = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.inventoriesRow}`,
  );
  const nextAdvances = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.advancesRow}`,
  );
  const nextOtherCurrentAssets = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.otherCurrentAssetsRow}`,
  );

  const nextOtherNonCurrentAssets = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.otherNonCurrentAssetsRow}`,
  );

  const nextOtherOperatingAssets = await getCellValue(
    worksheet3,
    `${columnsList[i + 1] + sheet3_assWCObj.otherOperatingAssetsRow}`,
  );

  // b variables
  const nextTradePayables = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.tradePayablesRow}`,
  );
  const nextEmployeePayables = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.employeePayablesRow}`,
  );
  // const nextShortTermBorrowings = await getCellValue(
  //   worksheet2,
  //   `${columnsList[i + 1] + sheet2_BSObj.shortTermBorrowingsRow}`,
  // );
  const nextLcPayablesRow = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.lcPayablesRow}`,
  );
  const nextOtherCurrentLiabilities = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.otherCurrentLiabilitiesRow}`,
  );
  const nextShortTermProvisions = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.shortTermProvisionsRow}`,
  );
  const nextLongTermProvisions = await getCellValue(
    worksheet2,
    `${columnsList[i + 1] + sheet2_BSObj.longTermProvisionRow}`,
  );
  // const nextInterCo = await getCellValue(
  //   worksheet2,
  //   `${columnsList[i + 1] + sheet2_BSObj.interCoRow}`,
  // );

  const nextOtherOperatingLiabilities = await getCellValue(
    worksheet3,
    `${columnsList[i + 1] + sheet3_assWCObj.otherOperatingLiabilitiesRow}`,
  );

  const nextSum1 = nextTradeReceivables + nextUnbilledRevenues + nextInventories + nextAdvances + nextOtherCurrentAssets + nextOtherNonCurrentAssets + nextOtherOperatingAssets
  console.log(nextTradeReceivables," ",nextUnbilledRevenues," ",nextInventories," ",nextAdvances," ",nextOtherCurrentAssets," ",nextOtherNonCurrentAssets, " ",nextOtherOperatingAssets)
  const nextSum2 = nextTradePayables + nextEmployeePayables  + nextLcPayablesRow + nextOtherCurrentLiabilities + nextShortTermProvisions + nextOtherOperatingLiabilities + nextLongTermProvisions
  console.log(nextTradePayables," ",nextEmployeePayables," ",nextLcPayablesRow," ",nextOtherCurrentLiabilities," ",nextShortTermProvisions," ",nextOtherOperatingLiabilities)
  const nextSum = nextSum1 - nextSum2
    console.log('Change in NCA ', currentSum - nextSum);
  return currentSum - nextSum;
}

// Old change in NCA formula
// export async function changeInNcaFromAssessment(counter, worksheet3){
//   return convertToNumberOrZero(worksheet3[`${columnsList[counter + 1]}${sheet3_assWCObj.changeInNca}`].v);
// }

// Old function
// export async function changeInNcaFromAssessment(subkey, assessmentSheetData){
//   return convertToNumberOrZero(assessmentSheetData[ASSESSMENT_OF_WC_RAW_LINE_ITEMS.changeInNcaRow.particulars][subkey]);
// }
export async function v2changeInNcaFromAssessment(subkey, assessmentSheetData){
  return convertToNumberOrZero(assessmentSheetData[ASSESSMENT_OF_WC_RAW_LINE_ITEMS.changeInNcaRow.particulars][subkey]);
}

// Old function
// export async function netOperatingAssetsFromAssessment(counter, worksheet3){
//   console.log(`${columnsList[counter]}${sheet3_assWCObj.netOperatingAssets}`,"net operating assets")
//   return convertToNumberOrZero(worksheet3[`${columnsList[counter]}${sheet3_assWCObj.netOperatingAssets}`].v);
// }

export async function v2NetOperatingAssetsFromAssessment(subkey, assessmentSheetData){
  return convertToNumberOrZero(assessmentSheetData[ASSESSMENT_OF_WC_RAW_LINE_ITEMS.nonCashWorkingCapitalRow.particulars][subkey]);
}

// Old function
// export default async function DeferredTaxAssets(i: number, worksheet2: any) {
//   //formula: =+(BS!B59-BS!B25)-(BS!C59-BS!C25)
//   // console.log(worksheet2);
//   // Get Current year first
//   const currentDeferredTaxAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.deferredTaxAssetsRow}`,
//   );
//   const currentDeferredTaxLiability = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.deferredTaxLiabilityRow}`,
//   );
//   // Get Next year data
//   const nextDeferredTaxAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.deferredTaxAssetsRow}`,
//   );
//   const nextDeferredTaxLiability = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.deferredTaxLiabilityRow}`,
//   );
//   // console.log('Deferred ' ,' ' , currentDeferredTaxAssets, ' ', currentDeferredTaxLiability ,' ' , nextDeferredTaxAssets, ' ', nextDeferredTaxLiability);
//   return (currentDeferredTaxAssets - currentDeferredTaxLiability) - (nextDeferredTaxAssets - nextDeferredTaxLiability);
// }

export async function v2DeferredTaxAssets(subkey, balanceSheetData, keysToProcess) {
  //formula: =+(BS!B59-BS!B25)-(BS!C59-BS!C25)
  // console.log(worksheet2);
  // Get Current year first

  /**
   * Balance Sheet
   * 1 (c)  deferred tax liabilities(net)
   * 2 (v) deferred tax assets(net)
   */

  /**
   * As per discussion with Sonal, deferred tax formula should be difference of 
   * Deferred tax asset - deferred tax liability
   * Finally subtract currentDeferredTax - nextDeferredTax
   */
  const nextKey = keysToProcess[keysToProcess.indexOf(subkey) + 1];
  const crntDeferredTaxAsset  = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.deferredTaxAssetRow.particulars][subkey];
  const crntDeferredTaxLiability = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.deffrdTaxLiabilitiesNetRow.particulars][subkey];
  
  const crntTotalDeffTA =  convertToNumberOrZero(crntDeferredTaxAsset) - convertToNumberOrZero(crntDeferredTaxLiability);

  const nextDeferredTaxAsset = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.deferredTaxAssetRow.particulars][nextKey];
  const nextDeferredTaxLiability = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.deffrdTaxLiabilitiesNetRow.particulars][nextKey];
  
  const nextTotalDeffTA = convertToNumberOrZero(nextDeferredTaxAsset) - convertToNumberOrZero(nextDeferredTaxLiability);
  return crntTotalDeffTA - nextTotalDeffTA;
}

// Old change in fixed asset
// export async function ChangeInFixedAssets(i: number, worksheet2: any) {
//   const tangibleAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.tangibleAssetsRow}`,
//   );
//   const intangibleAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.intangibleAssetsRow}`,
//   );
//   const capitalWorkInProgress = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.capitalWorkInProgressRow}`,
//   );
//   const preOperativeExpenses = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.preOperativeExpensesRow}`,
//   );
//   const capitalAdvances = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.capitalAdvancesRow}`,
//   );
//   const capitalLiabilities = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.capitalLiabilitiesRow}`,
//   );

//   const netFixedAsset = tangibleAssets + intangibleAssets + capitalWorkInProgress + preOperativeExpenses + capitalAdvances + capitalLiabilities
//   // console.log('Net Fixed Asset - ', netFixedAsset );
//   const nextTangibleAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.tangibleAssetsRow}`,
//   );
//   const nextIntangibleAssets = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.intangibleAssetsRow}`,
//   );
//   const nextCapitalWorkInProgress = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.capitalWorkInProgressRow}`,
//   );
//   const nextPreOperativeExpenses = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.preOperativeExpensesRow}`,
//   );
//   const nextCapitalAdvances = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.capitalAdvancesRow}`,
//   );
//   const nextCapitalLiabilities = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.capitalLiabilitiesRow}`,
//   );

//   // const nextCapitalLiabilities = await getCellValue(
//   //   worksheet2,
//   //   `${columnsList[i] + sheet2_BSObj.capitalLiabilitiesRow}`,
//   // );

//   const nextNetFixedAsset = nextTangibleAssets + nextIntangibleAssets + nextCapitalWorkInProgress +
//     nextPreOperativeExpenses + nextCapitalAdvances + nextCapitalLiabilities
//   // console.log('Net Next Fixed Asset - ', nextNetFixedAsset );
//   return nextNetFixedAsset - netFixedAsset; //it should be (closing - opening) and not (opening - closing) - As per discussion with Sonal 02-03-2024 
// }

export async function v2changeInFixedAsset(subkey, balanceSheetData, profitLossData, keysToProcess){
  let nextKey = keysToProcess[keysToProcess.indexOf(subkey) + 1]
  /**
   * Current column extraction
   */
  const crntMovableProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.movableRow.particulars][subkey];
  const crntImmovableProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.immovableRow.particulars][subkey];
  const crntLndAndBuildingProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.lndAndBuildingRow.particulars][subkey];
  const crntPlntAndMachnryProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.plntAndMachnryRow.particulars][subkey];
  const crntCapitalWorkInPrgrs = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.capitalWorkInPrgrsRow.particulars][subkey];
  const crntOthrTangibleAsset = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.otherIntangibleAssetRow.particulars][subkey];
  const crntIntangibleAssetDevelopment = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.intangibleAssetsIUnderDevelopmentRow.particulars][subkey];
  const crntBiologicalAsset = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.biologicalAssetBearerPlantRow.particulars][subkey];
  
  const crntTotal = convertToNumberOrZero(crntMovableProp) + convertToNumberOrZero(crntImmovableProp) + convertToNumberOrZero(crntLndAndBuildingProp) + 
  convertToNumberOrZero(crntPlntAndMachnryProp) + convertToNumberOrZero(crntCapitalWorkInPrgrs) + convertToNumberOrZero(crntOthrTangibleAsset) + 
  convertToNumberOrZero(crntIntangibleAssetDevelopment) + convertToNumberOrZero(crntBiologicalAsset);

  /**
   * Next column extraction
   */
  const nextMovableProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.movableRow.particulars][nextKey];
  const nextImmovableProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.immovableRow.particulars][nextKey];
  const nextLndAndBuildingProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.lndAndBuildingRow.particulars][nextKey];
  const nextPlntAndMachnryProp = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.plntAndMachnryRow.particulars][nextKey];
  const nextCapitalWorkInPrgrs = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.capitalWorkInPrgrsRow.particulars][nextKey];
  const nextOthrTangibleAsset = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.otherIntangibleAssetRow.particulars][nextKey];
  const nextIntangibleAssetDevelopment = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.intangibleAssetsIUnderDevelopmentRow.particulars][nextKey];
  const nextBiologicalAsset = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.biologicalAssetBearerPlantRow.particulars][nextKey];

  const nextTotal = convertToNumberOrZero(nextMovableProp) + convertToNumberOrZero(nextImmovableProp) + convertToNumberOrZero(nextLndAndBuildingProp) + 
  convertToNumberOrZero(nextPlntAndMachnryProp) + convertToNumberOrZero(nextCapitalWorkInPrgrs) + convertToNumberOrZero(nextOthrTangibleAsset) + 
  convertToNumberOrZero(nextIntangibleAssetDevelopment) + convertToNumberOrZero(nextBiologicalAsset);
  
  return nextTotal - crntTotal;
}

// Old function
// export async function GetDebtAsOnDate(i: number, worksheet2: any) {

//   // =+BS!B26+BS!B27+BS!B36

//   /**
//    * Balance Sheet
//    * 1. Borrowing from current liabilities - short term borrowings
//    * 2. Borrowing from non-current liabilities - long term borrowings
//    * return 1 + 2
//    */
//   const otherUnsecuredLoans = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.otherUnsecuredLoansRow}`,
//   );

//   const longTermBorrowings = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
//   );

//   const shortTermBorrowings = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
//   );
//   // console.log ('deb as on date ', longTermBorrowings, ' ', shortTermBorrowings ,' ', otherUnsecuredLoans)
//   return longTermBorrowings + shortTermBorrowings + otherUnsecuredLoans;
// }

export async function v2GetDebtAsOnDate(subKey, balanceSheetData) {

  // =+BS!B26+BS!B27+BS!B36

  /**
   * Balance Sheet
   * 1. Borrowing from current liabilities - short term borrowings
   * 2. Borrowing from non-current liabilities - long term borrowings
   * return 1 + 2
   */

  const shortTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.currentLiabilitiesRow.innerCurrentLiabilitiesRow.borrowingsRow.particulars][subKey];
  const longTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.longTermBorrowingsRow.particulars][subKey];
  
  return convertToNumberOrZero(longTermBorrowings) + convertToNumberOrZero(shortTermBorrowings);
}

export async function fcfeTerminalValue(fcfe: number, terminalRate: number, adjCOE: number) {
  // =F13*(1+Sheet2!C9)/(Sheet2!D22-Sheet2!C9)
  const fcfeAtTerminalRate = fcfe * (1 + terminalRate / 100) / (adjCOE / 100 - terminalRate / 100)

  return fcfeAtTerminalRate;
}

export async function fcffTerminalValue(fcff: number, terminalRate: number, wacc: number) {
  // =F13*(1+Sheet2!C9)/(Sheet2!C34-Sheet2!C9)
  const fcffAtTerminalRate = fcff * (1 + terminalRate / 100) / ((wacc - terminalRate) / 100)
  // console.log('calc term ', fcff, ' ', terminalRate, ' ', wacc);
  // console.log('FCFF TER ', fcffAtTerminalRate);
  return fcffAtTerminalRate;
}

// Old function
// export async function CashEquivalents(i: number, worksheet2: any) {
//   //formula: =+BS!B62+BS!B63
//   // Formula is correct
//   const cashEquivalents = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.cashEquivalentsRow}`,
//   );
//   const bankBalances = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.bankBalancesRow}`,
//   );

//   return cashEquivalents + bankBalances;
// }

export async function v2CashEquivalents(subKey, balanceSheetData) {
  //formula: =+BS!B62+BS!B63
  const cashEquivalent = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.cashNcashEqvlentRow.particulars][subKey];
  const bankBalances = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.bankBlnceOthr3AboveRow.particulars][subKey];

  return convertToNumberOrZero(cashEquivalent) + convertToNumberOrZero(bankBalances);
}

// export async function interestAdjustedTaxes(i: number, worksheet1: any, taxRate: string) {
//   // =+'P&L'!C28*(1-Sheet2!$D$7)
//   /**
//    * 1. 'Finance costs'
//    * return financeCost * (1 - parseFloat(taxRate) / 100);
//    */
//   const financeCost = await getCellValue(
//     worksheet1,
//     `${columnsList[i + 1] + sheet1_PLObj.financeCostsRow}`,
//   );
//   const addInterestAdjustedTaxes = financeCost * (1 - parseFloat(taxRate) / 100);
//   return addInterestAdjustedTaxes;

// }

// export async function interestAdjustedTaxesWithStubPeriod(i: number, worksheet1: any, taxRate: string) {
//   // =+'P&L'!C28*(1-Sheet2!$D$7)
//   let financeCost = await getCellValue(
//     worksheet1,
//     `${columnsList[i + 1] + sheet1_PLObj.financeCostsRow}`,
//   );

//   let financeCostOld = await getCellValue(
//     worksheet1,
//     `${columnsList[i] + sheet1_PLObj.financeCostsRow}`,
//   );

//   financeCost = financeCost - financeCostOld;

//   const addInterestAdjustedTaxes = financeCost * (1 - parseFloat(taxRate) / 100);
//   return addInterestAdjustedTaxes;

// }

export async function v2interestAdjustedTaxes(subkey, profitLossData) {
  // =+'P&L'!C28*(1-Sheet2!$D$7)
  /**
   * 1. 'Finance costs'
   * return financeCost * (1 - parseFloat(taxRate) / 100);
   */
  return convertToNumberOrZero(profitLossData[V2_PL_RAW_LINE_ITEMS.earningsBefreEBITrow.innerEarningsBefreEBITrow.financeCostRow.particulars][subkey]);
}

// export async function changeInBorrowings(i: number, worksheet2: any) {
//   // =+BS!C26+BS!C36+BS!C27-BS!B26-BS!B27-BS!B36
//   const nextOtherUnsecuredLoans = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.otherUnsecuredLoansRow}`,
//   );

//   const nextShortTermBorrowingsRow = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.shortTermBorrowingsRow}`,
//   );

//   const nextNetLongTermBorrowings = await getCellValue(
//     worksheet2,
//     `${columnsList[i + 1] + sheet2_BSObj.longTermBorrowingsRow}`,
//   );


//   const otherUnsecuredLoans = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.otherUnsecuredLoansRow}`,
//   );

//   const shortTermBorrowingsRow = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
//   );

//   const netLongTermBorrowings = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
//   );

//   return nextOtherUnsecuredLoans + nextShortTermBorrowingsRow + nextNetLongTermBorrowings - otherUnsecuredLoans - shortTermBorrowingsRow - netLongTermBorrowings
// }

export async function v2ChangeInBorrowings(subKey, balanceSheetData, keysToProcess){
  const nextKey = keysToProcess[keysToProcess.indexOf(subKey) + 1];

  const crntLongTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.longTermBorrowingsRow.particulars][subKey];
  const crntShortTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.currentLiabilitiesRow.innerCurrentLiabilitiesRow.borrowingsRow.particulars][subKey];

  const crntTotal = convertToNumberOrZero(crntLongTermBorrowings) + convertToNumberOrZero(crntShortTermBorrowings);

  const nextLongTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.longTermBorrowingsRow.particulars][nextKey];
  const nextShortTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.currentLiabilitiesRow.innerCurrentLiabilitiesRow.borrowingsRow.particulars][nextKey];

  const nextTotal = convertToNumberOrZero(nextLongTermBorrowings) + convertToNumberOrZero(nextShortTermBorrowings);

  return nextTotal - crntTotal;
}

// Old function
// export async function SurplusAssets(i: number, worksheet2: any) {
//   //formula: =+BS!B56+BS!B68
//   const nonCurrentInvestment = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.nonCurrentInvestmentRow}`,
//   );
//   const shortTermInvestments = await getCellValue(
//     worksheet2,
//     `${columnsList[i] + sheet2_BSObj.shortTermInvestmentsRow}`,
//   );

//   return nonCurrentInvestment + shortTermInvestments;
// }

export async function v2SurplusAssets(subKey, balanceSheet: any) {

  const invstmntInSubsdry = balanceSheet[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.invstmntSubsdryAssciateRow.particulars][subKey];
  const otherInvstment = balanceSheet[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.othrNonCrrntInvstmntRow.particulars][subKey];
  const otherNonOperatingAsset = balanceSheet[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.othrNonOprtingAssetRow.particulars][subKey];
  const deposits = balanceSheet[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.nonCurrentAssetsRow.innerNonCurrentAssetRow.depositRow.particulars][subKey];
  const crntInvstment = balanceSheet[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.crrntInvstmentRow.particulars][subKey];
  
  const totalNonOperatingAsset = convertToNumberOrZero(invstmntInSubsdry) + convertToNumberOrZero(otherInvstment) + convertToNumberOrZero(otherNonOperatingAsset) + convertToNumberOrZero(deposits) + convertToNumberOrZero(crntInvstment);
  
  const otherNonOperatingLiability = balanceSheet[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.othrNonOperatingLiabilitiesRow.particulars][subKey];
  const shareApplicationMoney = balanceSheet[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.shareApplicationMoneyPendingAlltmntRow.particulars][subKey];
  const prfrnceShareCapital = balanceSheet[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.prfnceShareCapitalRow.particulars][subKey];

  const totalNonOperatingLiabilities = convertToNumberOrZero(otherNonOperatingLiability) + convertToNumberOrZero(shareApplicationMoney) + convertToNumberOrZero(prfrnceShareCapital);

  return totalNonOperatingAsset - totalNonOperatingLiabilities;

}

//Industry Calculations Related Methods, all are under development
export async function CostOfDebt(i: number, worksheet1: any, worksheet2: any) {
  //formula:  User formula Finance costs /(Long term borrowing + short term borrowing)
  // as: P&L!C28/(BS!D27 + BS!D36)

  const financeCosts = await getCellValue(
    worksheet1,
    `${columnsList[i] + sheet1_PLObj.financeCostsRow}`,
  );

  const longTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
  );
  const shortTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
  );
  const result = financeCosts / (longTermBorrowings + shortTermBorrowings);

  return isNaN(result) ? null : result;
}

export async function CapitalStructure(i: number, worksheet2: any) {
  //formula: if company based use: long term borrowing + short term / net worth (Other equity + eq + pref).
  // As: (BS!D27 + BS!D36)/(BS!D6 note this formula is already a sum in sheet but
  // user may chose to enter values hence calculate as BS!D7:D22 sum)
  const longTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
  );
  const shortTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
  );

  //Calculate total sum for BS!D7:D22
  const startCell = `${columnsList[i]}7`;
  const endCell = `${columnsList[i]}22`;

  const startCellRef = XLSX.utils.decode_cell(startCell);
  const endCellRef = XLSX.utils.decode_cell(endCell);

  let shareholderFunds = 0;
  for (let row = startCellRef.r; row <= endCellRef.r; row++) {
    for (let col = startCellRef.c; col <= endCellRef.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet2[cellRef];
      if (cell && cell.t === 'n') {
        shareholderFunds += cell.v;
      }
    }
  }
  return (longTermBorrowings + shortTermBorrowings) / shareholderFunds;
}

// Old function
export async function CapitalStruc(i: number, worksheet2: any, shareHolderFunds: number, inputs: any) {
  //formula: if company based use: long term borrowing + short term / net worth (Other equity + eq + pref).
  // As: (BS!D27 + BS!D36)/(BS!D6 note this formula is already a sum in sheet but
  // user may chose to enter values hence calculate as BS!D7:D22 sum)

  // Total Equity = Shareholders' Funds - Preference Share Capital
  // Total Debt = Other Unsecured Loans + Long Term Borrowings + Liability component of CCD's + Short Term Borrowings
  // Total Preference Share Capital = Preference Share Capital

  // =+(BS!B27+BS!B26+BS!B36)/(BS!B6-BS!B8)
  // (longTermBorrowingsRow + otherUnsecuredLoans + shortTermBorrowingsRow ) / (shareholderFunds - preferenceShareCapital)

  // const shareholderFunds = await this.getShareholderFunds(i,worksheet2);
  let capitalStructure;


    if (!inputs.capitalStructureType || inputs.capitalStructureType === 'Company_Based') {
  
      const preferenceShareCapital = await getCellValue(
        worksheet2,
        `${columnsList[i] + sheet2_BSObj.preferenceShareCapitalRow}`,
      );

      const otherUnsecuredLoans = await getCellValue(
        worksheet2,
        `${columnsList[i] + sheet2_BSObj.otherUnsecuredLoansRow}`,
      );

      const liabilityComponentofCCD = await getCellValue(
        worksheet2,
        `${columnsList[i] + sheet2_BSObj.liabilityComponentofCCDRow}`,
      );
      const longTermBorrowings = await getCellValue(
        worksheet2,
        `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
      );
      const shortTermBorrowings = await getCellValue(
        worksheet2,
        `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
      );

      const totalCapital = (longTermBorrowings + otherUnsecuredLoans + shortTermBorrowings) / (shareHolderFunds - preferenceShareCapital);
      // const totalDebt = otherUnsecuredLoans + longTermBorrowings +liabilityComponentofCCD +shortTermBorrowings;

      // const totalCapital = totalEquity + preferenceShareCapital + totalDebt;
      const debtProp = totalCapital / (1 + totalCapital);
      const equityProp = 1 - debtProp;
      const prefProp = 1 - debtProp - equityProp;

      capitalStructure = {
        capitalStructureType: 'Company_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }
    } else if (inputs.capitalStructureType === 'Industry_Based') {
      const debtRatio = parseFloat(inputs.capitalStructure.deRatio) / 100;
      const totalCapital = 1 + debtRatio;
      const debtProp = debtRatio / totalCapital;
      const equityProp = 1 - debtProp;
      const prefProp = 0 // By default this is 0 for Industry

      capitalStructure = {
        capitalStructureType: 'Industry_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }

    } else if (inputs.capitalStructureType === 'Target_Based') {
      const totalCapital = 1;                 // total is always 1
      const debtProp = parseFloat(inputs.capitalStructure.debtProp) / 100;
      const equityProp = parseFloat(inputs.capitalStructure.equityProp) / 100;
      const prefProp = parseFloat(inputs.capitalStructure.prefProp) / 100;

      capitalStructure = {
        capitalStructureType: 'Target_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }

    }
    return capitalStructure;
  }

export async function capitalStructureComputation(provisionalDate, balanceSheetData: any, inputs: any) {
  //formula: if company based use: long term borrowing + short term / net worth (Other equity + eq + pref).
  // As: (BS!D27 + BS!D36)/(BS!D6 note this formula is already a sum in sheet but
  // user may chose to enter values hence calculate as BS!D7:D22 sum)

  // Total Equity = Shareholders' Funds - Preference Share Capital
  // Total Debt = Other Unsecured Loans + Long Term Borrowings + Liability component of CCD's + Short Term Borrowings
  // Total Preference Share Capital = Preference Share Capital

  // =+(BS!B27+BS!B26+BS!B36)/(BS!B6-BS!B8)
  // (longTermBorrowingsRow + otherUnsecuredLoans + shortTermBorrowingsRow ) / (shareholderFunds - preferenceShareCapital)

  let capitalStructure;


    if (!inputs.capitalStructureType || inputs.capitalStructureType === 'Company_Based') {
    
      // 1 .Get borowings from current liabilities as short term borrowings
      // 2 .Get borowings from non-current liabilities as long term borrowings
      //  ignore unsecureloanrow
      // 3. preference share capital from BS

      // (1+2)/(sharholdersfund - preferenceSharecapital)

      const shortTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.currentLiabilitiesRow.innerCurrentLiabilitiesRow.borrowingsRow.particulars][provisionalDate];
      const longTermBorrowings = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.longTermBorrowingsRow.particulars][provisionalDate];
      // const preferenceShareCapital = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.prfnceShareCapitalRow.particulars][provisionalDate];
     
      const equityShareCapital = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.equityShareCapitalRow.particulars][provisionalDate];
      const securitiesPremium = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.secrtiesPrmiumRow.particulars][provisionalDate];
      const revaluationReserve = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.revaluationResrveRow.particulars][provisionalDate];
      const generalReserve = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.gnrlRsrveRow.particulars][provisionalDate];
      const retainedEarning = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.equityRow.innerEquityRow.retainedEarningRow.particulars][provisionalDate];

      const totalCapital = (convertToNumberOrZero(longTermBorrowings) + convertToNumberOrZero(shortTermBorrowings)) / 
      (convertToNumberOrZero(equityShareCapital) + convertToNumberOrZero(securitiesPremium) + 
      convertToNumberOrZero(revaluationReserve) + convertToNumberOrZero(generalReserve) + 
      convertToNumberOrZero(retainedEarning)); 

      const debtProp = totalCapital / (1 + totalCapital);
      const equityProp = 1 - debtProp;
      const prefProp = 1 - debtProp - equityProp;

      capitalStructure = {
        capitalStructureType: 'Company_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }
    } else if (inputs.capitalStructureType === 'Industry_Based') {
      const debtRatio = parseFloat(inputs.capitalStructure.deRatio) / 100;
      const totalCapital = 1 + debtRatio;
      const debtProp = debtRatio / totalCapital;
      const equityProp = 1 - debtProp;
      const prefProp = 0 // By default this is 0 for Industry

      capitalStructure = {
        capitalStructureType: 'Industry_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }

    } else if (inputs.capitalStructureType === 'Target_Based') {
      const totalCapital = 1;                 // total is always 1
      const debtProp = parseFloat(inputs.capitalStructure.debtProp) / 100;
      const equityProp = parseFloat(inputs.capitalStructure.equityProp) / 100;
      const prefProp = parseFloat(inputs.capitalStructure.prefProp) / 100;

      capitalStructure = {
        capitalStructureType: 'Target_Based',
        debtProp: debtProp,
        equityProp: equityProp,
        prefProp: prefProp,
        totalCapital: totalCapital           // this is actual value and not a proporation.
      }

    }
    return capitalStructure;
  }

export async function ProportionOfDebt(i: number, worksheet2: any) {
  //formula: sum(BS!SUM(D25:D31) + SUM(D32:D40))/BS!D41

  //Calculate total sum for BS!SUM(D25:D31)
  const startCell = `${columnsList[i]}25`;
  const endCell = `${columnsList[i]}31`;

  const startCellRef = XLSX.utils.decode_cell(startCell);
  const endCellRef = XLSX.utils.decode_cell(endCell);

  let sum1 = 0;
  for (let row = startCellRef.r; row <= endCellRef.r; row++) {
    for (let col = startCellRef.c; col <= endCellRef.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet2[cellRef];
      if (cell && cell.t === 'n') {
        sum1 += cell.v;
      }
    }
  }

  //Calculate total sum for BS!SUM(D32:D40)
  const startCell2 = `${columnsList[i]}32`;
  const endCell2 = `${columnsList[i]}40`;

  const startCellRef2 = XLSX.utils.decode_cell(startCell2);
  const endCellRef2 = XLSX.utils.decode_cell(endCell2);

  let sum2 = 0;
  for (let row = startCellRef2.r; row <= endCellRef2.r; row++) {
    for (let col = startCellRef2.c; col <= endCellRef2.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet2[cellRef];
      if (cell && cell.t === 'n') {
        sum2 += cell.v;
      }
    }
  }
  const total = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.totalRow}`,
  );
  return (sum1 + sum2) / total;
}

export async function ProportionOfEquity(i: number, worksheet2: any) {
  //formula: sum(BS!D7:D22)/BS!D41
  //Calculate total sum for sum(BS!D7:D22)
  const startCell = `${columnsList[i]}7`;
  const endCell = `${columnsList[i]}22`;

  const startCellRef = XLSX.utils.decode_cell(startCell);
  const endCellRef = XLSX.utils.decode_cell(endCell);

  let sum = 0;
  for (let row = startCellRef.r; row <= endCellRef.r; row++) {
    for (let col = startCellRef.c; col <= endCellRef.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet2[cellRef];
      if (cell && cell.t === 'n') {
        sum += cell.v;
      }
    }
  }
  const total = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.totalRow}`,
  );
  return sum / total;
}

export async function POPShareCapital(i: number, worksheet2: any) {
  //formula: BS!D8/Sum(BS!D7:BS!D22)
  const preferenceShareCapital = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.preferenceShareCapitalRow}`,
  );
  //Calculate total sum for sum(BS!D7:BS!D22)
  const startCell = `${columnsList[i]}7`;
  const endCell = `${columnsList[i]}22`;

  const startCellRef = XLSX.utils.decode_cell(startCell);
  const endCellRef = XLSX.utils.decode_cell(endCell);

  let sum = 0;
  for (let row = startCellRef.r; row <= endCellRef.r; row++) {
    for (let col = startCellRef.c; col <= endCellRef.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet2[cellRef];
      if (cell && cell.t === 'n') {
        sum += cell.v;
      }
    }
  }

  return preferenceShareCapital / sum;
}

export async function POPShareCapitalLabelPer(i: number, worksheet2: any) {
  //formula: Ability to pick from BS!A8
  const Cell = worksheet2['A8'];
  let preferenceShareCapitalPer = null;
  if (Cell && Cell.t === 's') preferenceShareCapitalPer = parseInt(Cell.v);

  return isNaN(preferenceShareCapitalPer) ? null : preferenceShareCapitalPer;
}

export async function getWACCInputValues(i: number, worksheet2: any) {

  const reserverAndSurplus = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.reserveAndSurplusRow}`,
  );

  const preferenceShareCapital = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.preferenceShareCapitalRow}`,
  );

  const equityCap = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.equityShareCapitalRow}`,
  );


  const longTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.longTermBorrowingsRow}`,
  );

  const shortTermBorrowings = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shortTermBorrowingsRow}`,
  );

  let waccCalInputs = {
    equityCapital: equityCap,
    preferenceShareCapital: preferenceShareCapital,
    longTermBorrowings: longTermBorrowings,
    shortTermBorrowings: shortTermBorrowings
  }

  return waccCalInputs;
}


export async function getShareholderFunds(i: number, worksheet2: any) {
  const equityShareCapital = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.equityShareCapitalRow}`,
  );

  const preferenceShareCapital = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.preferenceShareCapitalRow}`,
  );

  // const otherEquity = await getCellValue(
  //   worksheet2,
  //   `${columnsList[i] + sheet2_BSObj.otherEquityRow}`,
  // );

  const sharePremium = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.sharePremiumRow}`,
  );

  const reserveAndSurplus = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.reserveAndSurplusRow}`,
  );

  const revaluationReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.revaluationReserveRow}`,
  );

  const capitalReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.capitalReserveRow}`,
  );

  const capitalRedemptionReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.capitalRedemptionReserveRow}`,
  );

  const debentureRedemptionReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.debentureRedemptionReserveRow}`,
  );

  const shareBasedPaymentReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shareBasedPaymentReserveRow}`,
  );

  const definedBenefitObligationReserve = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.definedBenefitObligationReserveRow}`,
  );

  const otherComprehensiveIncome = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.otherComprehensiveIncomeRow}`,
  );

  const nonControllingInterest = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.nonControllingInterestRow}`,
  );

  const shareWarrants = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shareWarrantsRow}`,
  );

  const shareApplication = await getCellValue(
    worksheet2,
    `${columnsList[i] + sheet2_BSObj.shareApplicationRow}`,
  );

  const shareHolderFunds = equityShareCapital + preferenceShareCapital +  sharePremium + reserveAndSurplus +
    revaluationReserve + capitalReserve + capitalRedemptionReserve + debentureRedemptionReserve + shareBasedPaymentReserve +
    definedBenefitObligationReserve +
    otherComprehensiveIncome + shareWarrants + nonControllingInterest +
    shareApplication;
    
  return shareHolderFunds;
}

export async function differenceAssetsLiabilities(i: number, worksheet3: any) {
  const operatingAssets = await getCellValue(
    worksheet3,
    `${columnsList[i] + sheet3_assWCObj.totalOperatingAssetsRow}`,
  );
  const operatingLiabilities = await getCellValue(
    worksheet3,
    `${columnsList[i] + sheet3_assWCObj.totalOperatingLiabilitiesRow}`,
  );

  return operatingAssets - operatingLiabilities;
}

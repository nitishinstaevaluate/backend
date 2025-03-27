import { sheet1_PLObj, sheet2_BSObj,columnsList, V2_PL_RAW_LINE_ITEMS, V2_BS_RAW_LINE_ITEMS } from './excelSheetConfig';
import * as XLSX from 'xlsx';
import { convertToNumberOrZero, getCellValue } from './common.methods';


//worksheet1 is P&L sheet and worksheet2 is BS sheet.

export async function netWorthOfCompany(column:number, worksheet2: any) {
  //formula: =+BS!D7+SUM(BS!D9:D19)
  
  // const equityShareCapital = await getCellValue(
  //   worksheet2,
  //   // `${column + sheet2_BSObj.equityShareCapitalRow}`,
  //   `${columnsList[column] + sheet2_BSObj.equityShareCapitalRow}`,
  // );
  // console.log('equity sharecapital',equityShareCapital);
  // //Calculate total sum for SUM(BS!D9:D19)
  // const startCell = `${columnsList[column]}7`;
  // const endCell = `${columnsList[column]}22`;
  
  // // console.log('Column '+ `${columnsList[column]}9`);
  
  // const startCellRef = XLSX.utils.decode_cell(startCell);
  // const endCellRef = XLSX.utils.decode_cell(endCell);

  // let sum = 0;
  // for (let row = startCellRef.r; row <= endCellRef.r; row++) {
  //   for (let col = startCellRef.c; col <= endCellRef.c; col++) {
  //     const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
  //     const cell = worksheet2[cellRef];
  //     if (cell && cell.t === 'n') {
  //       sum += cell.v;
  //     }
  //   }
  // }


  
  const preferenceShareCapital = await getCellValue(
    worksheet2,
    // `${column + sheet2_BSObj.equityShareCapitalRow}`,
    `${columnsList[column] + sheet2_BSObj.preferenceShareCapitalRow}`,
  );
  // sum = sum - preferenceShareCapital;
  return preferenceShareCapital;
}

export async function netWorthOfComp(column:string, worksheet2: any) {
  const equityShareCapital = await getCellValue(
    worksheet2,
    `${column + sheet2_BSObj.equityShareCapitalRow}`,
  );

  return equityShareCapital
}

export async function profitLossValues(column:number, worksheet1: any) {
  //formula: P&L'!C58

  const employeeBenefitExpenses = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.employeeBenefitExpenses}`,
  );

  const powerAndFuel = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.powerAndFuel}`,
  );

  const labourCharges = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.labourCharges}`,
  );

  const sellingAndAdministration = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.sellingAndAdministration}`,
  );

  const sellingOver2 = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.sellingOver2}`,
  );

  const sellingOver3 = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.sellingOver3}`,
  );

  const sellingOver4 = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.sellingOver4}`,
  );
  
  const totalExpenses = employeeBenefitExpenses + powerAndFuel + labourCharges +sellingAndAdministration 
                        + sellingOver2 + sellingOver3 + sellingOver4


  const incomeFromOperation = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.incomeFromOperationRow}`,
  );

  const otherOperatingIncome = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.otherOperatingIncome}`,
  );
  
  const revenuefromOperations = incomeFromOperation + otherOperatingIncome;
  
  const costofMaterialConsumed = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.costofMaterialConsumedRow}`,
  );

  const purchaseOfStockInTrade = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.purchaseOfStockInTrade}`,
  );

  const changeInInventory = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.changeInInventoryRow}`,
  );

  const ebitda = revenuefromOperations - costofMaterialConsumed -  purchaseOfStockInTrade - changeInInventory - totalExpenses;

  const depAndAmortisation = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.depAndAmortisationRow}`,
  );

  const ebit = ebitda - depAndAmortisation;

  const financeCosts = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.financeCostsRow}`,
  );

  const otherIncome = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.otherIncomeRow}`,
  );

  const profitLossBeforeExceptionExtraItemsTax = ebit - financeCosts + otherIncome;

  const exceptionalItems = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.exceptionalItemsRow}`,
  );

  const profitLossBeforeExtraItemTax = profitLossBeforeExceptionExtraItemsTax + exceptionalItems;
  
  const extraordinaryItems = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.extraordinaryItemsRow}`,
  );
  const profitLossBeforeTax = profitLossBeforeExtraItemTax + extraordinaryItems;

  
  const currentTaxExpense = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.currentTaxExpense}`,
  );

  const matCredit = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.matCredit}`,
  );

  const currentTaxExpensePrior = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.currentTaxExpensePrior}`,
  );

  const netCurrentTaxExpense = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.netCurrentTaxExpense}`,
  );

  const deferredTax = await getCellValue(
    worksheet1,
    `${columnsList[column] + sheet1_PLObj.deferredTax}`,
  );

    const totalCurrExpense = currentTaxExpense + matCredit + currentTaxExpensePrior + netCurrentTaxExpense +deferredTax;
    const profitLofffromOps  =  profitLossBeforeTax - totalCurrExpense;

    const profitLossDiscontinuingOpsNetTax = await getCellValue(
      worksheet1,
      `${columnsList[column] + sheet1_PLObj.profitLossDiscontinuingOpsNetTax}`,
    );
    const profitLossForYear =  profitLofffromOps + profitLossDiscontinuingOpsNetTax;

  return {
    
    totalExpenses : totalExpenses,
    ebitda: ebitda,
    ebit:ebit,
    profitLossBeforeExtraItemTax: profitLossBeforeExtraItemTax,
    profitLossBeforeTax: profitLossBeforeTax,
    totalCurrExpense:totalCurrExpense,
    profitLofffromOps: profitLofffromOps,
    profitLossDiscontinuingOpsNetTax: profitLossDiscontinuingOpsNetTax,
    profitLossForYear:profitLossForYear,
  };
}

// export async function ebitdaMethod(column:number, worksheet1: any) {
//   //formula: =+'P&L'!C25
//   const ebitda = await getCellValue(
//     worksheet1,
//     `${columnsList[column] + sheet1_PLObj.ebitdaRow}`,
//   );
//   return ebitda;
// }
export async function ebitdaMethod(profitlossData, provisionalDate) {
  const ebitda = profitlossData[V2_PL_RAW_LINE_ITEMS.earningsBfrEBITDArow.particulars][provisionalDate];
  return convertToNumberOrZero(ebitda);
}

export async function debtMethod(balanceSheetData, provisionalDate) {
  //formula: ==+BS!B26+BS!B27+BS!B36
  const srtTrmBrrwngs = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.currentLiabilitiesRow.innerCurrentLiabilitiesRow.borrowingsRow.particulars][provisionalDate];
  const lngTrmBrrwngs = balanceSheetData[V2_BS_RAW_LINE_ITEMS.equityAndLiabilitiesRow.innerEquityAndLiabilities.liabilitiesRow.innerLiabilities.nonCrrntLiabilitiesRow.innerNonCurrentLiabilitiesRow.longTermBorrowingsRow.particulars][provisionalDate];
 
  return convertToNumberOrZero(srtTrmBrrwngs) + convertToNumberOrZero(lngTrmBrrwngs);
}

// export async function  cashAndCashEquivalent(column:number, worksheet2){
//   const cashEquivalent =  await getCellValue(
//     worksheet2,
//     `${columnsList[column] + sheet2_BSObj.cashEquivalentsRow}`,
//   );

//   const bankBalance =  await getCellValue(
//     worksheet2,
//     `${columnsList[column] + sheet2_BSObj.bankBalancesRow}`,
//   );

//   const shortTermInvestment =  await getCellValue(
//     worksheet2,
//     `${columnsList[column] + sheet2_BSObj.shortTermInvestmentsRow}`,
//   );

//   return convertToNumberOrZero(cashEquivalent) + convertToNumberOrZero(bankBalance) + convertToNumberOrZero(shortTermInvestment);
// }
export async function  cashAndCashEquivalent(balanceSheetData, provisionalDate){
  const cashNCashEquivalent = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.cashNcashEqvlentRow.particulars][provisionalDate];
  const bankBalance = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.bankBlnceOthr3AboveRow.particulars][provisionalDate];
  const crrntInvstmnt = balanceSheetData[V2_BS_RAW_LINE_ITEMS.assetsRow.innerAsset.currentAssetsRow.innerCurrentAssetRow.crrntInvstmentRow.particulars][provisionalDate];
 
  return convertToNumberOrZero(cashNCashEquivalent) + convertToNumberOrZero(bankBalance) + convertToNumberOrZero(crrntInvstmnt);
}

// export async function incomeFromOperation(column:number, worksheet1: any) {
//   //formula: =+'P&L'!C7
//   const incomeFromOperation = await getCellValue(
//     worksheet1,
//     `${columnsList[column] + sheet1_PLObj.incomeFromOperationRow}`,
//   );
//   return incomeFromOperation;
// }

export async function incomeFromOperation(profitLossSheetData, provisionalDate) {
  const rvnueFrmOprtnsSle = profitLossSheetData[V2_PL_RAW_LINE_ITEMS.income.innerIncomeRow.revnueFrmOprtionsSalesRow.particulars][provisionalDate];
  const othrOprtngIncme =  profitLossSheetData[V2_PL_RAW_LINE_ITEMS.income.innerIncomeRow.othrOprtingIncmeRow.particulars][provisionalDate];
  return convertToNumberOrZero(rvnueFrmOprtnsSle) + convertToNumberOrZero(othrOprtngIncme);
}

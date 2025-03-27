//Years Columns List.
export const columnsList=[
    'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 
    'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 
    'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 
    'AW', 'AX'];

export const sheet1_PLObj={

    incomeFromOperationRow:"7",
    otherOperatingIncome:"8",
    costofMaterialConsumedRow:"13",
    purchaseOfStockInTrade:"14",
    changeInInventoryRow:"15",
    employeeBenefitExpenses:"16",
    powerAndFuel:"17",
    labourCharges:"18",
    sellingAndAdministration:"19",
    sellingOver2:"20",
    sellingOver3:"21",
    sellingOver4:"22",
    ebitdaRow:"25",
    depAndAmortisationRow:"26",
    financeCostsRow:"28",
    otherIncomeRow:"29",
    exceptionalItemsRow:"31",
    extraordinaryItemsRow:"33",
    currentTaxExpense:"36",
    matCredit:"37",
    currentTaxExpensePrior:"38",
    netCurrentTaxExpense:"39",
    deferredTax:"40",
    patRow:"42",
    profitLossDiscontinuingOpsNetTax:"52",
    profitLossOfYear:"54",
    earningPerShareRow:"58",

    // =+B36+B37+B38+B39+B40
}

export const sheet2_BSObj={
    shareholderFundsRow:"6",
    equityShareCapitalRow:"7",
    preferenceShareCapitalRow:"8",
    otherEquityRow:"9",
    sharePremiumRow:"10",
    reserveAndSurplusRow:"11",
    revaluationReserveRow:"12",
    capitalReserveRow:"13",
    capitalRedemptionReserveRow:"14",
    debentureRedemptionReserveRow:"15",
    shareBasedPaymentReserveRow:"16",
    definedBenefitObligationReserveRow:"17",
    otherComprehensiveIncomeRow:"18",
    nonControllingInterestRow:"19",
    shareWarrantsRow:"21",
    shareApplicationRow:"22",
    deferredTaxLiabilityRow:"25",
    otherUnsecuredLoansRow:"26",
    longTermBorrowingsRow:"27",
    liabilityComponentofCCDRow:"28",
    longTermProvisionRow:"29",
    deferredGovtGrantRow:"31",
    tradePayablesRow:"34",
    employeePayablesRow:"35",
    shortTermBorrowingsRow:"36",
    lcPayablesRow:"37",
    otherCurrentLiabilitiesRow:"38",
    shortTermProvisionsRow:"39",
    interCoRow:"40",
    totalRow:"41",
    fixedAssetsRow:"46",
    netFixedAssetsRow:"47",

    tangibleAssetsRow:"48",
    intangibleAssetsRow:"49",
    capitalWorkInProgressRow:"50",
    preOperativeExpensesRow:"51",
    capitalAdvancesRow:"52",
    capitalLiabilitiesRow:"53",

    goodwillRow:"55",
    nonCurrentInvestmentRow:"56",
    interCoInvRow:"57",
    otherNonCurrentAssetsRow:"58",
    deferredTaxAssetsRow:"59",
    cashEquivalentsRow:"62",
    bankBalancesRow:"63",
    tradeReceivablesRow:"64",
    unbilledRevenuesRow:"65",
    inventoriesRow:"66",
    advancesRow:"67",
    shortTermInvestmentsRow:"68",
    otherCurrentAssetsRow:"69"    

}

export const sheet3_assWCObj={
    otherOperatingAssetsRow : "10",
    totalOperatingAssetsRow : "11",
    otherOperatingLiabilitiesRow : "20",
    totalOperatingLiabilitiesRow : "21",
    netOperatingAssets : "23",
    changeInNca : "24",
}

export const sheet4_ruleElevenUaObj={
    immovablePropertyRow : "5",
    jewelleryRow : "6", 
    artisticWorkRow : "7",
    sharesAndSecuritiesRow : "8",
    otherTangibleAssets : "9",
    nonCurrentInvestmenInSharesAndSecuritesRow : "13",
    nonCurrentOtherInvestments : "14",
    advanceTaxRow : "18",
    incomeTaxRefundRow : "19",
    defferedTaxRow : "20",
    currentInvestmentSharesAndSecuritesRow : "26",
    currentOtherInvestments : "27",
    tdsRecievablesRow : "35",
    advanceTaxPaidRow : "36",
    preliminaryExpenseRow : "37",
    preOperativeTaxRow : "38",
    otherMiscllneousExpenseRow : "39",
    totalAssetsRow : "41",
    shareCapitalRow : "45",
    reserveAndSurplusRow : "46",
    paymentDividendsRow : "47",
    provisionForTaxationRow : "54",
    totalLiabilitiesRow: "69"
}

export const V2_BS_RAW_LINE_ITEMS = {
    assetsRow: {
            particulars : "Assets",
            sysCode:8001,
            rowNumber:2,
            innerAsset:{
                nonCurrentAssetsRow: {
                    particulars : "Non-current assets",
                    sysCode:8002,
                    rowNumber:4,
                    innerNonCurrentAssetRow: {
                        propertyPlantEqpmntRow: {
                            particulars : "(a) property, plant and equipment",
                            sysCode:8003,
                            rowNumber:5,
                        },
                        movableRow: {
                                particulars : "(i) moveable",
                                sysCode:8004,
                                rowNumber:6,
                        },
                        immovableRow: {
                                particulars : "(ii) immoveable",
                                sysCode:8005,
                                rowNumber:7,
                        },
                        lndAndBuildingRow: {
                                particulars : " - Land & Building",
                                sysCode:8006,
                                rowNumber:8,
                        },
                        plntAndMachnryRow: {
                                particulars : " - Plant & Machinery",
                                sysCode:8007,
                                rowNumber:9,
                        },
                        capitalWorkInPrgrsRow: {
                                particulars : "(b) capital work in progress",
                                sysCode:8008,
                                rowNumber:10,
                        },
                        invstmntPrptyRow: {
                                particulars : "(c) investment property",
                                sysCode:8009,
                                rowNumber:11,
                        },
                        goodwillRow: {
                                particulars : "(d) goodwill",
                                sysCode:8010,
                                rowNumber:12,
                        },
                        otherIntangibleAssetRow: {
                                particulars : "(e) other intangible assets",
                                sysCode:8011,
                                rowNumber:13,
                        },
                        intangibleAssetsIUnderDevelopmentRow: {
                                particulars : "(f) intangible assets under development",
                                sysCode:8012,
                                rowNumber:14,
                        },
                        biologicalAssetBearerPlantRow: {
                                particulars : "(g) biological assets other than bearer plants",
                                sysCode:8013,
                                rowNumber:15,
                        },
                        rightUseOfAssetRow: {
                                particulars : "(h) right of use of assets",
                                sysCode:8014,
                                rowNumber:16,
                        },
                        financialAssetRow: {
                                particulars : "(i) financial assets",
                                sysCode:8015,
                                rowNumber:17,
                        },
                        invstmntSubsdryAssciateRow: {
                                particulars : "(i)Investments in Subsidiary/JV/Associate",
                                sysCode:8016,
                                rowNumber:18,
                        },
                        othrNonCrrntInvstmntRow: {
                                particulars : "(ii)Other Non-Current Investments",
                                sysCode:8017,
                                rowNumber:19,
                        },
                        longTermLoanAdvncesRow: {
                                particulars : "(iii)long term loans and advances",
                                sysCode:8018,
                                rowNumber:20,
                        },
                        deferredTaxAssetRow: {
                                particulars : "(iv) deferred tax assets(net)",
                                sysCode:8019,
                                rowNumber:21,
                        },
                        othrNonCrrntAssetRow: {
                                particulars : "(j) other non-current assets",
                                sysCode:8020,
                                rowNumber:22,
                        },
                        othrNonOprtingAssetRow: {
                                particulars : "Other Non-Operating Assets",
                                sysCode:8021,
                                rowNumber:23,
                        },
                        depositRow: {
                                particulars : "Deposits",
                                sysCode:8022,
                                rowNumber:24,
                        },
                        totalNonCrrntAssetRow: {
                                particulars : "Total non current assets",
                                sysCode:8023,
                                rowNumber:26,
                                dependent:[8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012, 8015, 8016, 8017, 8018, 8020, 8021, 8022],
                                formula:"currentOne6+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14+currentOne15+currentOne16+currentOne18+currentOne19+currentOne20+currentOne21+currentOne22+currentOne23+currentOne24"
                        },
                    }
                },
                currentAssetsRow: {
                    particulars : "Current assets",
                    sysCode:8024,
                    rowNumber:28,
                    innerCurrentAssetRow:{
                        invntoriesRow: {
                            particulars : "(a) inventories",
                            sysCode:8025,
                            rowNumber:29
                        },
                        financialAssetRow: {
                                particulars : "(b) financial assets",
                                sysCode:8026,
                                rowNumber:30
                        },
                        crrntInvstmentRow: {
                                particulars : "(i)Current investment",
                                sysCode:8027,
                                rowNumber:31
                        },
                        tradeReceivablesRow: {
                                particulars : "(ii) trade receivables",
                                sysCode:8028,
                                rowNumber:32
                        },
                        cashNcashEqvlentRow: {
                                particulars : "(iii) cash and cash equivalents",
                                sysCode:8029,
                                rowNumber:33
                        },
                        bankBlnceOthr3AboveRow: {
                                particulars : "(iv) bank balance other than (iii)above",
                                sysCode:8030,
                                rowNumber:34
                        },
                        shortTermLoanAdvncesRow: {
                                particulars : "(v) short term loans & advances",
                                sysCode:8031,
                                rowNumber:35
                        },
                        crrntTaxAssetNetRow: {
                                particulars : "(vii) current tax assets (net)",
                                sysCode:8032,
                                rowNumber:36
                        },
                        othrCrrntAssetRow: {
                                particulars : "(c) other current assets",
                                sysCode:8033,
                                rowNumber:37
                        },
                        totalCrrntAssetRow: {
                                particulars : "Total current assets",
                                sysCode:8034,
                                rowNumber:38,
                                dependent:[8025, 8027, 8028, 8029, 8030, 8031, 8032, 8033,],
                                formula:"currentOne29+currentOne31+currentOne32+currentOne33+currentOne34+currentOne35+currentOne36+currentOne37"
                        },
                    }
                },
                totalAssetRow: {
                    particulars : "Total Assets",
                    sysCode:8035,
                    rowNumber:40,
                    dependent:[8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012, 8015, 8016, 8017, 8018, 8020, 8021, 8022, 8025, 8027, 8028, 8029, 8030, 8031, 8032, 8033],
                    formula:"currentOne6+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14+currentOne15+currentOne16+currentOne18+currentOne19+currentOne20+currentOne21+currentOne22+currentOne23+currentOne24+currentOne29+currentOne31+currentOne32+currentOne33+currentOne34+currentOne35+currentOne36+currentOne37"
                }
            },
    },
    equityAndLiabilitiesRow: {
        particulars : "EQUITY AND LIABILITIES",
        sysCode:8036,
        rowNumber:42,
        innerEquityAndLiabilities:{
            equityRow:{
                particulars : "Equity",
                sysCode:8037,
                rowNumber:44,
                innerEquityRow:{
                    equityShareCapitalRow: {
                        particulars : "(a) Equity share capital",
                        sysCode:8038,
                        rowNumber:45,
                    },
                    prfnceShareCapitalRow: {
                            particulars : "(b) Preference share capital",
                            sysCode:8039,
                            rowNumber:46,
                    },
                    equityInfusionRow: {
                            particulars : "(c) Equity Infusion",
                            sysCode:8040,
                            rowNumber:47
                    },
                    shareApplicationMoneyPendingAlltmntRow: {
                            particulars : "(d) Share Application Money Pending Allotment",
                            sysCode:8041,
                            rowNumber:48
                    },
                    othrEquityRow: {
                            particulars : "(e) other equity",
                            sysCode:8042,
                            rowNumber:49
                    }, 
                    secrtiesPrmiumRow: {
                            particulars : "(i) Securities Premium",
                            sysCode:8043,
                            rowNumber:50
                    }, 
                    revaluationResrveRow: {
                            particulars : "(ii) revaluation Reserve",
                            sysCode:8044,
                            rowNumber:51
                    }, 
                    gnrlRsrveRow: {
                            particulars : "(iii) General Reserves",
                            sysCode:8045,
                            rowNumber:52
                    }, 
                    retainedEarningRow: {
                            particulars : "(iv) Retained Earnings",
                            sysCode:8046,
                            rowNumber:53
                    }, 
                    totalEquityRow: {
                            particulars : "Total Equity",
                            sysCode:8047,
                            rowNumber:54,
                            dependent:[8038, 8039, 8040, 8041, 8042, 8043, 8044, 8045, 8046],
                            formula:"currentOne45+currentOne46+currentOne47+currentOne48+currentOne49+currentOne50+currentOne51+currentOne52+currentOne53"
                    }, 
                }
            },
            liabilitiesRow:{
                particulars : "Liabilities",
                sysCode:8048,
                rowNumber:56,
                innerLiabilities:{
                    nonCrrntLiabilitiesRow: {
                        particulars : "Non-current liabilities",
                        sysCode:8049,
                        rowNumber:57,
                        innerNonCurrentLiabilitiesRow:{
                            financialLiabilitiesRow: {
                                particulars : "(a)financial liabilities",
                                sysCode:8050,
                                rowNumber:58
                            }, 
                            longTermBorrowingsRow: {
                                    particulars : "(i)borrowings",
                                    sysCode:8051,
                                    rowNumber:59
                            }, 
                            othrFinancialLiabilitiesRow: {
                                    particulars : "(ii) other financial liabilities",
                                    sysCode:8052,
                                    rowNumber:60
                            }, 
                            leaseLiabilitesRow: {
                                    particulars : "(iii) lease liabilities",
                                    sysCode:8053,
                                    rowNumber:61
                            }, 
                            provisionRow: {
                                    particulars : "(b) provision",
                                    sysCode:8054,
                                    rowNumber:62
                            }, 
                            deffrdTaxLiabilitiesNetRow: {
                                    particulars : "(c)  deferred tax liabilities(net)",
                                    sysCode:8055,
                                    rowNumber:63
                            }, 
                            othrNonCrrntLiabilitiesRow: {
                                    particulars : "(d) other non current liabilities",
                                    sysCode:8056,
                                    rowNumber:64
                            }, 
                            othrNonOperatingLiabilitiesRow: {
                                    particulars : "(e) other non operating liabilities",
                                    sysCode:8057,
                                    rowNumber:65
                            }, 
                            totalNonCurrentLiabilitiesRow: {
                                    particulars : "Total Non - current Liabilities",
                                    sysCode:8058,
                                    rowNumber:66,
                                    dependent:[8051, 8052, 8053, 8054, 8055, 8056, 8057],
                                    formula:"currentOne59+currentOne60+currentOne61+currentOne62+currentOne63+currentOne64+currentOne65"
                            },
                        }
                    },
                    currentLiabilitiesRow:{
                        particulars : "Current liabilities",
                        sysCode:8059,
                        rowNumber:68,
                        innerCurrentLiabilitiesRow:{
                            financialLiabilitiesRow: {
                                particulars : "(a) financial liabilities",
                                sysCode:8060,
                                rowNumber:69
                            }, 
                            borrowingsRow: {
                                particulars : "(i) borrowings",
                                sysCode:8061,
                                rowNumber:70
                            }, 
                            tradePayableRow: {
                                particulars : "(ii) trade payables",
                                sysCode:8062,
                                rowNumber:71
                            }, 
                            otherFinancialLiabilitiesOthrSpcfdItmCRow:{
                                particulars : "(iii) other financial liabilities(other than these specified in item (c))",
                                sysCode:8063,
                                rowNumber:72
                            }, 
                            othrCrrntLiabilitiesRow: {
                                particulars : "(b) other current liabilities",
                                sysCode:8064,
                                rowNumber:73
                            }, 
                            prvsionRow: {
                                particulars : "(c) provisions",
                                sysCode:8065,
                                rowNumber:74
                            }, 
                            crntTaxLaibilitiesRow: {
                                particulars : "(d) current tax liabilities(net)",
                                sysCode:8066,
                                rowNumber:75
                            }, 
                            totalCrrntLiabilitiesRow: {
                                particulars : "Total Current Liabilities",
                                sysCode:8067,
                                rowNumber:76,
                                dependent:[8061, 8062, 8063, 8064, 8065, 8066],
                                formula:"currentOne70+currentOne71+currentOne72+currentOne73+currentOne74+currentOne75"
                            }
                        }
                    }
                }
            },
            totalEquityAndLiabilitiesRow: {
                particulars : "Total Equity and Liabilities",
                sysCode:8068,
                rowNumber:78,
                dependent:[8038, 8039, 8040, 8041, 8042, 8043, 8044, 8045, 8046, 8051, 8052, 8053, 8054, 8055, 8056, 8057, 8061, 8062, 8063, 8064, 8065, 8066],
                formula:"currentOne45+currentOne46+currentOne47+currentOne48+currentOne49+currentOne50+currentOne51+currentOne52+currentOne53+currentOne59+currentOne60+currentOne61+currentOne62+currentOne63+currentOne64+currentOne65+currentOne70+currentOne71+currentOne72+currentOne73+currentOne74+currentOne75"
            },
        }
    },
    check: {
        particulars : "Check",
        sysCode:8069,
        rowNumber:80,
        dependent:[8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012, 8015, 8016, 8017, 8018, 8020, 8021, 8022, 8025, 8027, 8028, 8029, 8030, 8031, 8032, 8033, 8038, 8039, 8040, 8041, 8042, 8043, 8044, 8045, 8046, 8051, 8052, 8053, 8054, 8055, 8056, 8057, 8061, 8062, 8063, 8064, 8065, 8066],
        formula:"currentOne6+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14+currentOne15+currentOne16+currentOne18+currentOne19+currentOne20+currentOne21+currentOne22+currentOne23+currentOne24+currentOne29+currentOne31+currentOne32+currentOne33+currentOne34+currentOne35+currentOne36+currentOne37-currentOne45-currentOne46-currentOne47-currentOne48-currentOne49-currentOne50-currentOne51-currentOne52-currentOne53-currentOne59-currentOne60-currentOne61-currentOne62-currentOne63-currentOne64-currentOne65-currentOne70-currentOne71-currentOne72-currentOne73-currentOne74-currentOne75"
    }
}

export const V2_PL_RAW_LINE_ITEMS = {
    income:{
            particulars : "Income",
            sysCode:6001,
            rowNumber:2,
            innerIncomeRow: {
                revnueFrmOprtionsSalesRow: {
                        particulars : "Revenue From Operations/Sales",
                        sysCode:6002,
                        rowNumber:3,
                        romanIndex:'I'
                    },
                    othrOprtingIncmeRow: {
                        particulars : "Other Operating Income:",
                        sysCode:6003,
                        rowNumber:4,
                        romanIndex:'II'
                    }
            }
    }, 
    othrNonOperatingIncomeRow: {
        particulars : "Other Non-Operating Income",
        sysCode:6004,
        rowNumber:6,
        romanIndex:'III',
        dependent:[6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012],
        formula:"currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14",
        innerOthrOperatingIncmeRow: {
            commissionEarnedRow: {
                particulars : "Commission earned",
                sysCode:6005,
                rowNumber:7
            },
            invstmentIncmeRow: {
                particulars : "Investment Income",
                sysCode:6006,
                rowNumber:8
            },
            inrstIncmeRow: {
                particulars : "Interest Income",
                sysCode:6007,
                rowNumber:9
            },
            prftOnPrptyPlntEqpmntRow: {
                particulars : "Profit on sale of property, plant & equipment",
                sysCode:6008,
                rowNumber:10
            },
            prftOnIntangibleAsstRow: {
                particulars : "Profit on sale of Intangible asset",
                sysCode:6009,
                rowNumber:11
            },
            franchiseFeesRow: {
                particulars : "Frachise fees",
                sysCode:6010,
                rowNumber:12
            },
            prftOnSaleOfEquipmentRow: {
                particulars : "Profit on sale of equipment",
                sysCode:6011,
                rowNumber:13
            },
            othrIncomeRow: {
                particulars : "Other Income",
                sysCode:6012,
                rowNumber:14
            }
        }
    },
    totalIncome: {
    particulars : "Total Income",
    sysCode:6013,
    rowNumber:15,
    romanIndex:'III',
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14"
    },
    expensesRow: {
    particulars : "Expenses",
    sysCode:6014,
    rowNumber:17,
    romanIndex:'IV',
    innerExpnseRow:{
        costOfMatrialConsmeRow: {
            particulars : "Cost of materials consumed",
            sysCode:6015,
            rowNumber:18
        },
        prchaseOfStockInTradeRow: {
            particulars : "Purchases of Stock-in-Trade",
            sysCode:6016,
            rowNumber:19
        },
        changeInInvntoryRow: {
            particulars : "Changes in Inventory",
            sysCode:6017,
            rowNumber:20
        },
        emplyBnftExpnseRow: {
            particulars : "Employee benefits expense",
            sysCode:6018,
            rowNumber:21
        },
        othrOprtingExpnseRow: {
            particulars : "Other Operating Expenses",
            sysCode:6019,
            rowNumber:22
        },
        othrNonOpertingExpnseRow: {
            particulars : "Other Non-Operating expenses:",
            sysCode:6020,
            rowNumber:24,
            dependent:[6021, 6022, 6023],
            formula:"currentOne25+currentOne26+currentOne27",
            innerOthrNonOprtingExpnseRow:{
                lossOnPrptyPlntEqpmntRow: {
                        particulars : "Loss on sale of property, plant & equipment",
                        sysCode:6021,
                        rowNumber:25
                    },
                    lossOnIntngibleAssetRow: {
                        particulars : "Loss on sale of Intangible asset",
                        sysCode:6022,
                        rowNumber:26
                    },
                    othrNonOperatingExpnseRow: {
                        particulars : "Other Non Operating Expenses",
                        sysCode:6023,
                        rowNumber:27
                    }
            }
        },
        totalExpnseRow: {
            particulars : "Total Expense",
            sysCode:6024,
            rowNumber:29,
            dependent:[6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023],
            formula:"currentOne18+currentOne19+currentOne20+currentOne21+currentOne22+currentOne25+currentOne26+currentOne27"
            }
    }
    },
    earningsBfrEBITDArow:{
    particulars : "Earnings Before Interest Taxation, Depreciation and Amortisation (EBITDA)",
    sysCode:6025,
    rowNumber:31,
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27",
    innerEarningsBefreEBITDArow: {
        lessDepcrtionAndAmorstionExpnseRow: {
        particulars : "Less: Depreciation and amortization expense",
        sysCode:6026,
        rowNumber:32  
        }
    }
    }, 
    earningsBefreEBITrow:{
    particulars : "Earnings Before Interest Taxation (EBIT)",
    sysCode:6027,
    rowNumber:34,
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32",
    innerEarningsBefreEBITrow:{
        financeCostRow: {
            particulars : "Finance costs",
            sysCode:6028,
            rowNumber:35
            }
    }
    },
    prftLossBefreExptionalItemRow: {
        particulars : "Profit/(loss) before exceptional items and tax (I - IV)",
        sysCode:6029,
        rowNumber:37,
        romanIndex:'V',
        dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026, 6028],
        formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32-currentOne35",
        innerPrftLossBefreExptionalItemRow:{
            exptionalItemRow:{
                particulars : "Exceptional Items",
                sysCode:6030,
                rowNumber:38,
                romanIndex:'V1'
            }
        } 
    },
    prftLossBeforeTaxRow: {
    particulars : "Profit/(loss) before tax (V-VI)",
    sysCode:6031,
    rowNumber:40,
    romanIndex:'VII',
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026, 6028, 6030],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32-currentOne35-currentOne38"
    },
    taxExpnseRow:{
    particulars : "Tax expense:",
    sysCode:6032,
    rowNumber:42,
    romanIndex:'VIII'          
    },
    crrntTaxRow:{
    particulars : "(1) Current tax",
    sysCode:6033,
    rowNumber:43
    },
    deffrdTaxRow: {
    particulars : "(2) Deferred tax",
    sysCode:6034,
    rowNumber:44
    },
    totalTaxExpnseRow: {
    particulars : "Total Tax Expense",
    sysCode:6035,
    rowNumber:45,
    dependent:[6033, 6034],
    formula:"currentOne43+currentOne44"          
    },
    prftLossForPerdFromContnuingOprtionsRow: {
    particulars : "Profit (Loss) for the period from continuing operations (VII-VIII)",
    sysCode:6036,
    rowNumber:47,
    romanIndex:'IX',
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026, 6028, 6030, 6033, 6034],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32-currentOne35-currentOne38-currentOne43-currentOne44"
    },
    prftLossFromDscontnuedOprtionsRow: {
    particulars : "Profit/(loss) from discontinued operations",
    sysCode:6037,
    rowNumber:49,
    romanIndex:'X'
    },
    taxExpnseOfDscontnuedOprtionsRow: {
    particulars : "Tax expense of discontinued operations",
    sysCode:6038,
    rowNumber:50,
    romanIndex:'XI'
    },
    prftLossFromDscontinuedOperationsAftrTaxRow: {
    particulars : "Profit/(loss) from Discontinued operations (after tax) (X-XI)",
    sysCode:6039,
    rowNumber:51,
    romanIndex:'XII',
    dependent:[6037, 6038],
    formula:"currentOne49+currentOne50"
    },
    prftLossForPrdRow: {
    particulars : "Profit/(loss) for the period (IX+XII)",
    sysCode:6040,
    rowNumber:53,
    romanIndex:'XIII',
    dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026, 6028, 6030, 6033, 6034, 6037, 6038],
    formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32-currentOne35-currentOne38-currentOne43-currentOne44+currentOne49+currentOne50"
    },
    othrComprhnsiveIncome:{
        particulars : "Other Comprehensive Income",
        sysCode:6041,
        rowNumber:55,
        romanIndex:'XIV',
        innerOthrComprhnsveIncome:{
            forignCrrncsyTransltionGainRow: {
                particulars : "Foreign currency translation gains",
                sysCode:6042,
                rowNumber:56
            },
            A: {
                particulars : "A",
                sysCode:6043,
                rowNumber:58
            },
            itemsReclassifedToPrftLossRow: {
                particulars : "(i) Items that will not be reclassified to profit or loss",
                sysCode:6044,
                rowNumber:59
            },
            incmeTaxRltedItemsNonClassfiedToPrftLossRow: {
                particulars : "(ii) Income tax relating to items that will not be reclassified to profit or loss",
                sysCode:6045,
                rowNumber:60
            },
            B: {
                particulars : "B",
                sysCode:6046,
                rowNumber:61
            },
            itemsReclassifiedToPrftLossRow: {
                particulars : "(i) Items that will be reclassified to profit or loss",
                sysCode:6047,
                rowNumber:62
            },
            incmeTaxReltingToItemsReclssifiedToPrftLossRow: {
                particulars : "(ii) Income tax relating to items that will be reclassified to profit or loss",
                sysCode:6048,
                rowNumber:63
            },
            totalCoprhnsiveIncmeForPeriodRow: {
                particulars : "Total Comprehensive Income for the period (XIII+XIV) (Comprising Profit (Loss) and Other Comprehensive Income for the period)",
                sysCode:6049,
                rowNumber:65,
                romanIndex:'XV',
                dependent:[6003, 6002, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012, 6015, 6016, 6017, 6018, 6019, 6021, 6022, 6023, 6026, 6028, 6030, 6033, 6034, 6037, 6038, 6044, 6045, 6047, 6048],
                formula:"currentOne3+currentOne4+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14-currentOne18-currentOne19-currentOne20-currentOne21-currentOne22-currentOne25-currentOne26-currentOne27-currentOne32-currentOne35-currentOne38-currentOne43-currentOne44+currentOne49+currentOne50+currentOne59+currentOne60+currentOne62+currentOne63"
            }
        },
        
    }
}

export const ASSESSMENT_OF_WC_RAW_LINE_ITEMS = {
    nonCashWorkingCapitalRow: {
        particulars : "Non-Cash Working Capital (A-B)",
        sysCode:9023,
        rowNumber:24
      },
    changeInNcaRow: {
        particulars : "Change in NCA",
        sysCode:9024,
        rowNumber:25
      }
}

export const RULE_ELEVEN_UA_RAW_LINE_ITEMS = {
    assets:{
        particulars : "Assets",
        sysCode:4001,
        rowNumber:2,
        innerAsset:{
            nonCurrentAssetRow:{
                particulars : "Non-current Assets",
                sysCode:4002,
                rowNumber:3,
                innerNonCurrentAssetRow:{
                    tanibleAssets: {
                        particulars : "Tangible Assets",
                        sysCode:4003,
                        rowNumber:4
                    },
                    immovableProperty:{
                        particulars : "- Immovable Property",
                        sysCode:4004,
                        editable:true,
                        subHeader:true,
                        rowNumber:5
                    },
                    jewellery:{
                        particulars : "- Jewellery",
                        sysCode:4005,
                        rowNumber:6
                    },
                    artisticWork:{
                        particulars : "- Artistic Work",
                        sysCode:4006,
                        rowNumber:7
                    },
                    sharesAndSecurities:{
                        particulars : "-Shares & Securities",
                        sysCode:4007,
                        rowNumber:8
                    },
                    otherTangibleAssets:{
                        particulars : "- Other Tangible Assets",
                        sysCode:4008,
                        rowNumber:9
                    },
                    intangibleAssets:{
                        particulars : "Intangible Assets",
                        sysCode:4009,
                        rowNumber:10
                    },
                    rightOfUseAssets:{
                        particulars : "Right of use assets",
                        sysCode:4010,
                        rowNumber:11
                    },
                    invstment:{
                        particulars : "Investments",
                        sysCode:4011,
                        rowNumber:12
                    },
                    invstmntInShareAndSecurities:{
                        particulars : "- Investments in Share & Securities",
                        sysCode:4012,
                        rowNumber:13                        
                    },
                    othrInvstmnt:{
                        particulars : "- Other Investments",
                        sysCode:4013,
                        rowNumber:14                        
                    },
                    financialAssets:{
                        particulars : "Financial Assets",
                        sysCode:4014,
                        rowNumber:16
                    },
                    incmetxAsstNet:{
                        particulars : "Income Tax Assets (Net)",
                        sysCode:4015,
                        rowNumber:17
                    },
                    advnceTx:{
                        particulars : "- Advance Tax",
                        sysCode:4016,
                        rowNumber:18
                    },
                    incmeTaxRefnd:{
                        particulars : "- Income Tax Refund",
                        sysCode:4017,
                        rowNumber:19
                    },
                    deffrdTxAsstNet:{
                        particulars : "Deferred Tax Assets (Net)",
                        sysCode:4018,
                        rowNumber:20
                    },
                    othrNonCrrntAsst:{
                        particulars : "Other non-current assets",
                        sysCode:4019,
                        rowNumber:21
                    }
                }
            },
            currentAssetRow:{
                particulars : "Current Assets",
                sysCode:4020,
                rowNumber:23,
                innerCrrntAsset:{
                    financialAsst:{
                        particulars : "Financial Assets ",
                        sysCode:4021,
                        rowNumber:24
                    },
                    crntInvstmnt:{
                        particulars : "Current Investments",
                        sysCode:4022,
                        rowNumber:25                        
                    },
                    invsmntInShrsAndSecrities:{
                        particulars : "- Investments in Share & Securities ",
                        sysCode:4023,
                        rowNumber:26
                    },
                    othrInvstmnt:{
                        particulars : "- Other Investments ",
                        sysCode:4024,
                        rowNumber:27
                    },
                    trdeRcvbles:{
                        particulars : "Trade Receivables",
                        sysCode:4025,
                        rowNumber:28
                    },
                    cashNcashEqvlnt:{
                        particulars : "Cash & Cash Equivalents",
                        sysCode:4026,
                        rowNumber:29
                    },
                    bnkBlncesOthrThnAbve:{
                        particulars : "Bank balances other than above",
                        sysCode:4027,
                        rowNumber:30
                    },
                    loans:{
                        particulars : "Loans",
                        sysCode:4028,
                        rowNumber:31              
                    },
                    othrFncialAsst:{
                        particulars : "Other Financial assets",
                        sysCode:4029,
                        rowNumber:32
                    },
                    unblledWrkInPrgss:{
                        particulars : "Unbilled work in progress (contract assets)",
                        sysCode:4030,
                        rowNumber:33              
                    },
                    othrCrrntAsset:{
                        particulars : "Other Current Assets",
                        sysCode:4031,
                        rowNumber:34
                    },
                    tdsRecvbles:{
                        particulars : "- TDS Receivable",
                        sysCode:4032,
                        rowNumber:35              
                    },
                    advnceTxPaid:{
                        particulars : "- Advance Tax Paid",
                        sysCode:4033,
                        rowNumber:36              
                    },
                    prlmnryExpnse:{
                        particulars : "- Preliminary Expenses",
                        sysCode:4034,
                        rowNumber:37               
                    },
                    prOprtveExpnse:{
                        particulars : "- Pre-operative Expenses",
                        sysCode:4035,
                        rowNumber:38              
                    },
                    othrMisclneousExpnse:{
                        particulars : "- Other Miscellaneous Expenses",
                        sysCode:4036,
                        rowNumber:39              
                    },
                }             
            },
            totalAsset:{
                particulars : "Total Assets",
                sysCode:4037,
                rowNumber:41,
                dependent:[4004,4005,4006,4007,4008,4009,4010,4011,4012,4013,4014,4015,4016,4017,4018,4019,4021,4022,4023,4024,4025,4026,4027,4028,4029,4030,4031,4032,4033,4034,4035,4036],
                formula:'currentOne5+currentOne6+currentOne7+currentOne8+currentOne9+currentOne10+currentOne11+currentOne12+currentOne13+currentOne14+currentOne16+currentOne17+currentOne18+currentOne19+currentOne20+currentOne21+currentOne24+currentOne25+currentOne26+currentOne27+currentOne28+currentOne29+currentOne30+currentOne31+currentOne32+currentOne33+currentOne34+currentOne35+currentOne36+currentOne37+currentOne38+currentOne39',
            }
        }
    },
    equityAndLiabilities:{
        particulars : "Equity & Liabilities",
        sysCode:4038,
        rowNumber:43,
        innerEquityAndLiability:{
            equityRow:{
                particulars : "Equity",
                sysCode:4039,
                rowNumber:44,
                innerEquityRow:{
                    shareCapital: {
                          particulars : "Share Capital",
                          sysCode:4040,
                          rowNumber:45
                    },
                    rsrveAndSrplus: {
                        particulars : "Reserve & Surplus",
                        sysCode:4041,
                        rowNumber:46
                    },
                    amntSetAprtForPymntOfDvdnds:{
                        particulars : "Amount Set Apart for payment of Dividends",
                        sysCode:4042,
                        rowNumber:47
                    }
                }
            },
            liabilitiesRow:{
                nonCurrentLiabilitiesRow:{
                    particulars : "Non-Current Liabilities",
                    sysCode:4043,
                    rowNumber:49,
                    innerNonCrrntLiabilitiesRow:{
                        financialLiability:{
                              particulars : "Financial Liabilities",
                              sysCode:4044,
                              rowNumber:50
                        },
                        brrwing: {
                            particulars : "- Borrowings",
                            sysCode:4045,
                            rowNumber:51
                        },
                        leaseLiability:{
                            particulars : "- Lease Liabilities",
                            sysCode:4046,
                            rowNumber:52
                        },
                        prvsion:{
                            particulars : "Provisions",
                            sysCode:4047,
                            rowNumber:53
                        },
                        prvsionForTxation:{
                            particulars : "- Provision for Taxation",
                            sysCode:4048,
                            rowNumber:54
                        },
                        othrPrvsion:{
                            particulars : "- Other Provisions",
                            sysCode:4049,
                            rowNumber:55
                        },
                        dfredTxLiabilityNet:{
                            particulars : "Deferred Tax Liabilites (net)",
                            sysCode:4050,
                            rowNumber:56
                        },
                        othrNonCrrntLiability:{
                            particulars : "Other non-current liabilities",
                            sysCode:4051,
                            rowNumber:57
                        },
                    }       
                },
                currentLiabilitiesRow:{
                    particulars : "Current Liabilities",
                    sysCode:4052,
                    rowNumber:59,
                    innerCrrntLiabilitiesRow:{
                        financialLiability:{
                              particulars : "Financial Liabilities ",
                              sysCode:4053,
                              rowNumber:60
                        },
                        brrwing:{
                            particulars : "- Borrowings ",
                            sysCode:4054,
                            rowNumber:61
                        },
                        leaseLiability:{
                            particulars : "- Lease Liabilities ",
                            sysCode:4055,
                            rowNumber:62
                        },
                        tradePyble:{
                            particulars : "- Trade Payables",
                            sysCode:4056,
                            rowNumber:63
                        },
                        othrFncialLiability:{
                            particulars : "- Other financial liabilities",
                            sysCode:4057,
                            rowNumber:64
                        },
                        provsions:{
                            particulars : "Provisions ",
                            sysCode:4058,
                            rowNumber:65
                        },
                        crntTxLiability:{
                            particulars : "Current Tax liabilities",
                            sysCode:4059,
                            rowNumber:66
                        },
                        othrCrntLiability:{
                            particulars : "Other Current liabilities",
                            sysCode:4060,
                            rowNumber:67
                        }
                    }
                }
            },
            totalEquityAndLiabilityRow:{
                particulars : "Total Equity & Liabilities",
                sysCode:4061,
                rowNumber:69,
                dependent:[4040,4041,4042,4044,4045,4046,4047,4048,4049,4050,4051,4053,4054,4055,4056,4057,4058,4059,4060],
                formula:'currentOne45+currentOne46+currentOne47+currentOne50+currentOne51+currentOne52+currentOne53+currentOne54+currentOne55+currentOne56+currentOne57+currentOne60+currentOne61+currentOne62+currentOne63+currentOne64+currentOne65+currentOne66+currentOne67'
            }
        }
    }
}

export const CASH_FLOW_RAW_LINE_ITEMS = {
    operatingCashFlow:{
        particulars : "Operating Cash Flow:",
        sysCode:7001,
        rowNumber:2,
        romanIndex:'I'
    },
    proftBefreIntrsTxAndExptionalItm: {
        particulars : "Profit before Interest tax and exceptional items",
        sysCode:7002,
        rowNumber:3,
    },
    adjFor:{
        particulars : "Adjustments for:",
        sysCode:7003,
        rowNumber:4,
    },
    depAndAmortstn:{
        particulars : "Depreciation & Amortization",
        sysCode:7004,
        rowNumber:5,
    },
    invstmntIncme: {
        particulars : "Investment income",
        sysCode:7005,
        rowNumber:6,
    },
    financeCst:{
        particulars : "Finance cost",
        sysCode:7006,
        rowNumber:7,
    },
    prftLssOnSleOfPrptyPlntEqpmnt:{
        particulars : "Profit / (Loss) on the sale of property, plant & equipment",
        sysCode:7007,
        rowNumber:8,
    },
    prftLssOnSleOfIntngbleAsset:{
        particulars : "Profit / (Loss) on the sale of intangible assets",
        sysCode:7008,
        rowNumber:9,
    },
    wrkingCptalChnges:{
        particulars : "Working capital changes:",
        sysCode:7009,
        header:true,
        rowNumber:10,
    },
    incrseDecrseInTrdeAndOthrRecvbles:{
        particulars : "(Increase) / Decrease in trade and other receivables",
        sysCode:7010,
        rowNumber:11,
    },
    incrseDecrseInInvntories:{
        particulars : "(Increase) / Decrease in inventories",
        sysCode:7011,
        rowNumber:12,
    },
    incrseDecrseInOthrCrntAsst:{
        particulars : "(Increase) / Decrease in Other Current Assets",
        sysCode:7012,
        rowNumber:13,
    },
    incrseDecrseInLoansAndAdvnces:{
        particulars : "(Increase) / Decrease in Loans & Advances",
        sysCode:7013,
        rowNumber:14,
    },
    incrseDecrseInTxAsst:{
        particulars : "(Increase) / Decrease in Tax Assets",
        sysCode:7014,
        rowNumber:15,
    },
    incrseDecrseInTrdePyble:{
        particulars : "Increase / (Decrease) in trade payables",
        sysCode:7015,
        rowNumber:16,
    },
    incrseDecrseInOthrPyble:{
        particulars : "Increase / (Decrease) in  other payables",
        sysCode:7016,
        rowNumber:17,
    },
    incrseDecrseInPrvsionAndOthrCrrntLiabilities:{
        particulars : "Increase / (Decrease) in provisions and other current Liabilities",
        sysCode:7017,
        rowNumber:18,
    },
    incrseDecrseInNonCrrntLiabilities:{
        particulars : "Increase / (Decrease) in Non-Current Liabilities",
        sysCode:7018,
        rowNumber:19,
    },
    incrseDecrseInTxLiabilities:{
        particulars : "Increase / (Decrease) in Tax Liabilities",
        sysCode:7019,
        rowNumber:20,
    },
    effctOfForegnExchnge:{
        particulars : "Effect of foreign exchange",
        sysCode:7020,
        rowNumber:21,
    },
    incmeTxPd:{
        particulars : "Income taxes paid",
        sysCode:7021,
        rowNumber:22,
    },
    ntCshFrmOprtingActvties:{
        particulars : "Net cash from operating activities",
        sysCode:7022,
        rowNumber:23,
    },
    cshFlowFrmInvstingActvties:{
        particulars : "Cash flows from investing activities",
        sysCode:7023,
        rowNumber:25,
        romanIndex:'II'
    },
    prchseSleOfPrptyPlntEqpmnt:{
        particulars : "Purchase/Sale  of property, plant and equipment",
        sysCode:7024,
        rowNumber:26,
    },
    prcdFrmSleOfEqpmnt:{
        particulars : "Proceeds from sale of equipment",
        sysCode:7025,
        rowNumber:27,
    },
    prcdFrmSleOfIntngble:{
        particulars : "Proceeds from sale of intangibles",
        sysCode:7026,
        rowNumber:28,
    },
    acqstionOfInvstmnt:{
        particulars : "Acquisition of investments",
        sysCode:7027,
        rowNumber:29,
    },
    ntCshUsdInInvstingActvties:{
        particulars : "Net cash used in investing activities",
        sysCode:7028,
        rowNumber:30,
    },
    cshFlwFrmFinancingActvties:{
        particulars : "Cash flows from financing activities",
        sysCode:7029,
        rowNumber:32,
        romanIndex:'III'
    },
    prcdFrmIssueOfShreOfCptal:{
        particulars : "Proceed from issue of share capital",
        sysCode:7030,
        rowNumber:33,
    },
    prcdFrmIssueOfPrfrnceShreCptl:{
        particulars : "Proceed from issue of preference share capital",
        sysCode:7031,
        rowNumber:34,
    },
    prcdRepymntFrmLngTrmBrrwing:{
        particulars : "Proceeds/Repayment from long-term borrowings",
        sysCode:7032,
        rowNumber:35,
    },
    prcRepymntFrmShrtTrmBrrwing:{
        particulars : "Proceeds/Repayment Short-term borrowings",
        sysCode:7033,
        rowNumber:36,
    },
    prcdRepymntOfLseLiabilityNt:{
        particulars : "Proceeds / (repayment) of lease liability, net",
        sysCode:7034,
        rowNumber:37,
    },
    financeCostv2:{
        particulars : "Finance cost ",
        sysCode:7035,
        rowNumber:38,
    },
    ntCshUsdInFncingActvties:{
        particulars : "Net cash used in financing activities",
        sysCode:7036,
        rowNumber:39,
    },
    ntIncrseInCshAndCshEqvlnt:{
        particulars : "Net increase in cash and cash equivalents (I+II+III)",
        sysCode:7037,
        rowNumber:41,
        romanIndex:'IV'
    },
    cshAndCshEqvlntAtBggningOfPrd:{
        particulars : "Cash and cash equivalents at beginning of period",
        sysCode:7038,
        rowNumber:43,
        romanIndex:'V'
    },
    cshAndCshEqvlntAtBggningOfPrdIVV:{
        particulars : "Cash and cash equivalents at end of period (IV+V)",
        sysCode:7039,
        rowNumber:45,
        romanIndex:'VI'
    },
}
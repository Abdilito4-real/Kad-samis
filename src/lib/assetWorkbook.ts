import ExcelJS from 'exceljs';
import { ASSET_CONDITIONS, ASSET_CSV_HEADERS, ASSET_STATUSES } from '@/lib/assetImport';

export async function buildAssetImportWorkbook(categoryNames: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Assets');
  const optionsSheet = workbook.addWorksheet('Options');

  optionsSheet.getCell('A1').value = 'Categories';
  categoryNames.forEach((name, index) => {
    optionsSheet.getCell(`A${index + 2}`).value = name;
  });
  optionsSheet.getCell('B1').value = 'Conditions';
  ASSET_CONDITIONS.forEach((condition, index) => {
    optionsSheet.getCell(`B${index + 2}`).value = condition.charAt(0).toUpperCase() + condition.slice(1);
  });
  optionsSheet.getCell('C1').value = 'Statuses';
  ASSET_STATUSES.forEach((status, index) => {
    optionsSheet.getCell(`C${index + 2}`).value = status.charAt(0).toUpperCase() + status.slice(1);
  });
  optionsSheet.state = 'hidden';

  workbook.definedNames.add(
    `Options!$B$2:$B$${ASSET_CONDITIONS.length + 1}`,
    'AssetConditions'
  );
  workbook.definedNames.add(
    `Options!$C$2:$C$${ASSET_STATUSES.length + 1}`,
    'AssetStatuses'
  );
  workbook.definedNames.add(
    `Options!$A$2:$A$${categoryNames.length + 1}`,
    'AssetCategories'
  );

  sheet.columns = ASSET_CSV_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 4),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF0F172A' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });

  for (let rowNumber = 2; rowNumber <= 1000; rowNumber += 1) {
    sheet.getCell(`F${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['AssetConditions'],
      showErrorMessage: true,
      errorTitle: 'Invalid condition',
      error: 'Select a condition from the dropdown list.',
    };
    sheet.getCell(`I${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['AssetStatuses'],
      showErrorMessage: true,
      errorTitle: 'Invalid status',
      error: 'Select a status from the dropdown list.',
    };
    sheet.getCell(`J${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['AssetCategories'],
      showErrorMessage: true,
      errorTitle: 'Invalid category',
      error: 'Select a category from the dropdown list.',
    };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

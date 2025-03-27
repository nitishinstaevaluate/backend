import { ExcelArchive } from "./excel-archive.schema";

describe('ExcelArchiveSchema', () => {
  it('should be defined', () => {
    expect(new ExcelArchive()).toBeDefined();
  });
});

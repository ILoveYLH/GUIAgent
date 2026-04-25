declare module "dcmjs" {
  const dcmjs: {
    data: {
      DicomMetaDictionary: {
        uid(): string;
        date(): string;
        time(): string;
        dictionary: unknown;
        nameMap: Record<string, unknown>;
        sopClassUIDsByName: Record<string, string>;
        denaturalizeDataset(dataset: unknown): unknown;
      };
      datasetToDict(dataset: unknown): { write(): ArrayBuffer | Uint8Array };
    };
  };
  export default dcmjs;
}

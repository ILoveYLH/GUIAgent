/** POST /api/hd-share 与 GET meta 共用的清单结构 */
export type HdShareManifest = {
  v: 1;
  created: number;
  series: Array<{
    label: string;
    modality?: string;
    start: number;
    len: number;
  }>;
  total: number;
};

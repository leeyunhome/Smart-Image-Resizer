export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | 'custom';

export type ProcessMode = 'padding' | 'crop';

export interface ImageItemData {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  resultDataUrl?: string;
  errorMsg?: string;
}

export interface AppSettings {
  aspectRatio: AspectRatio;
  customRatio: { width: number; height: number };
  mode: ProcessMode;
  paddingColor: string;
}

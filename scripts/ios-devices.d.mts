export interface IosDevice {
  w: number;
  h: number;
  dpr: number;
  models: string;
}
export declare const IOS_DEVICES: IosDevice[];
export declare function splashName(d: IosDevice, theme: 'light' | 'dark'): string;
export declare function splashMedia(d: IosDevice, theme: 'light' | 'dark'): string;
export declare const BRAND: {
  light: { bg: string; ink: string };
  dark: { bg: string; ink: string };
  accent: string;
};

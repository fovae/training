declare const __APP_VERSION__: string;

declare module 'virtual:legal-meta' {
  const meta: Record<'privacy' | 'terms', { version: string; updated: string }>;
  export default meta;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module 'virtual:themes.css';

declare module 'virtual:themes-meta' {
  /** Превью темы: фон, поверхность, текст, градиент главной карточки, два акцента */
  const meta: Record<
    string,
    { bg: string; card: string; ink: string; head: [string, string]; acc: [string, string] }
  >;
  export default meta;
}

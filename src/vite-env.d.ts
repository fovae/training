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

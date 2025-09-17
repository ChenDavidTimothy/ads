'use client';

import { useEffect } from 'react';

export function ThemeProvider({
  children,
  theme = 'dark',
}: {
  children: React.ReactNode;
  theme?: 'dark';
}) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return children as React.ReactElement;
}

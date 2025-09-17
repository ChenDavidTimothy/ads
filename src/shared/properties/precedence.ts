// src/shared/properties/precedence.ts

export type PropertySource = 'base' | 'canvas' | 'animation' | 'assignment';

export const DefaultPrecedence: PropertySource[] = ['base', 'canvas', 'animation', 'assignment'];

export interface PropertySourceMap {
  position?: PropertySource;
  rotation?: PropertySource;
  scale?: PropertySource;
  opacity?: PropertySource;
  colors?: {
    fill?: PropertySource;
    stroke?: PropertySource;
  };
  strokeWidth?: PropertySource;
}

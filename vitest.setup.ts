import * as React from 'react';
// Some test environments or transformed files may expect React in scope
// Ensure global React is available for JSX runtime assumptions in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React;
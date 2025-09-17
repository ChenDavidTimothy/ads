import * as React from 'react';

const SVGComponent = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width={200}
    height={50}
    viewBox="0 0 200 50"
    preserveAspectRatio="xMidYMid"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    {...props}
  >
    <defs>
      <linearGradient
        id="a"
        x1={18.105}
        y1={38.263}
        x2={162.166}
        y2={182.324}
        gradientTransform="matrix(.29073 0 0 .25648 -4.185 -3.468)"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0%"
          style={{
            stopColor: '#a78bfa',
            stopOpacity: 1,
          }}
        />
        <stop
          offset="50%"
          style={{
            stopColor: '#8b5cf6',
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: '#6366f1',
            stopOpacity: 1,
          }}
        />
      </linearGradient>
      <linearGradient
        id="b"
        x1={15.569}
        y1={86.665}
        x2={112.751}
        y2={183.846}
        gradientTransform="matrix(.48273 0 0 .15446 -4.185 -3.468)"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0%"
          style={{
            stopColor: '#7c3aed',
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: '#6d28d9',
            stopOpacity: 1,
          }}
        />
      </linearGradient>
    </defs>
    <text
      x={54.552}
      y={40.687}
      style={{
        fontFamily: 'Montserrat',
        fontWeight: 600,
        fontSize: '39.7773px',
        fill: '#e2e8f0',
        fillOpacity: 1,
        strokeWidth: 1.37129,
      }}
    >
      Variota
    </text>
    <circle
      cx={127.698}
      cy={12.373}
      r={5.191}
      style={{
        fill: '#7c3aed',
        fillOpacity: 1,
        strokeWidth: 1.482,
      }}
    />
    <path
      style={{
        fontVariationSettings: '"wght" 600',
        fill: 'url(#a)',
        stroke: 'none',
        strokeWidth: 0.469398,
        strokeDasharray: 'none',
        strokeOpacity: 1,
      }}
      d="m7.687 18.236 4.499-.026c.991-.003 2.49.623 3.159 2.139l8.757 17.881c.879 1.264 2.159 2.016 3.982 2.076l4.665.043c-1.973-.605-3.746-2.86-4.47-4.904-3.776-7.626-6.465-13.077-9.698-19.615-.745-1.249-1.547-2.458-3.02-2.635l-4.04-.052 1.637 2.711-3.234-.088-3.098-5.46-1.472-.01V7.29l2.918.009.834 1.386.95 1.568 5.667.03c2.895.291 4.093 1.953 5.228 3.665l10.406 21.447c1.96 2.884 3.654 3.25 5.154 1.783l2.394-4.91 4.055-2.564-4.983 10.626c-1.786 2.665-3.59 3.022-5.399 2.955l-5.72-.008c-2.058-.04-4.38-1.9-5.394-3.705L12.566 21.46c-.72-1.327-1.876-1.394-3.005-1.537-1.644-.239-1.52-1.038-1.874-1.686M1.078 6.346h3.023v3.022H1.078Z"
    />
    <path
      style={{
        fontVariationSettings: '"wght" 600',
        fill: 'url(#b)',
        stroke: 'none',
        strokeWidth: 0.469398,
        strokeDasharray: 'none',
        strokeOpacity: 1,
      }}
      d="M3.33 11.61h3.023v3.023H3.33Zm24.143 10.583 1.404 2.736 5.332-10.714c.586-1.216.975-1.177 2.107-1.18l8.91-.02c.936.066 2.488-.226 1.912 1.88l-2.168 4.992 2.177 1.797 2.763-5.977c1.327-3.839-1.536-5.838-4.58-5.777l-10.456-.012c-1.36.09-2.387 1.127-3.145 3.023z"
    />
    <path
      style={{
        fontVariationSettings: '"wght" 600',
        fill: '#e2e8f0',
        stroke: 'none',
        strokeWidth: 0.469398,
        strokeDasharray: 'none',
        strokeOpacity: 1,
      }}
      d="M37.241 19.8c-1.532-1.67-.179-2.854 1.365-2.14l6.39 4.628c1.807 1.215 1.862 2.43-.016 3.645l-6.53 4.508c-1.87 1-2.489-1.676-1.347-2.21l5.942-4.146z"
    />
  </svg>
);

export default SVGComponent;

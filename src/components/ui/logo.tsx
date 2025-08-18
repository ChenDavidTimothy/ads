import * as React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {}

const SVGComponent = (props: LogoProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    width={200}
    height={50}
    viewBox="0 0 200 50"
    preserveAspectRatio="xMidYMid"
    {...props}
  >
    <defs>
      <linearGradient
        id="bgGradient"
        x1={0}
        y1={0}
        x2={360}
        y2={360}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0.55555556,0,0,0.13888889,0,0)"
      >
        <stop
          offset="0%"
          style={{
            stopColor: "#000000",
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: "#0a0a0a",
            stopOpacity: 1,
          }}
        />
      </linearGradient>
      <linearGradient
        id="blueGradient"
        x1={12.187647}
        y1={49.803329}
        x2={27.154278}
        y2={49.803329}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022297,0,0,0.33407654,31.275997,-73.528645)"
      >
        <stop
          offset="0%"
          style={{
            stopColor: "#1e3a8a",
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: "#2563eb",
            stopOpacity: 1,
          }}
        />
      </linearGradient>
      <linearGradient
        id="purpleGradient"
        x1={12.187647}
        y1={87.219902}
        x2={27.154278}
        y2={87.219902}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022296,0,0,0.33407654,31.275997,-73.419267)"
      >
        <stop
          offset="0%"
          style={{
            stopColor: "#581c87",
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: "#7c3aed",
            stopOpacity: 1,
          }}
        />
      </linearGradient>
      <linearGradient
        id="greyGradient"
        x1={17.553185}
        y1={68.511612}
        x2={32.519814}
        y2={68.511612}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022296,0,0,0.33407654,32.227144,-73.473956)"
      >
        <stop
          offset="0%"
          style={{
            stopColor: "#4b5563",
            stopOpacity: 1,
          }}
        />
        <stop
          offset="100%"
          style={{
            stopColor: "#6b7280",
            stopOpacity: 1,
          }}
        />
      </linearGradient>
      <linearGradient
        id="blueBar"
        xlinkHref="#blueGradient"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022297,0,0,0.33407654,25.771083,-74.239009)"
        x1={12.187647}
        y1={49.803329}
        x2={27.154278}
        y2={49.803329}
      />
      <linearGradient
        id="purpleBar"
        xlinkHref="#purpleGradient"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022296,0,0,0.33407654,25.771083,-75.071516)"
        x1={12.187647}
        y1={87.219902}
        x2={27.154278}
        y2={87.219902}
      />
      <linearGradient
        id="greyBar"
        xlinkHref="#greyGradient"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1.0022296,0,0,0.33407654,24.559913,-74.655257)"
        x1={17.553185}
        y1={68.511612}
        x2={32.519814}
        y2={68.511612}
      />
    </defs>
    <g transform="matrix(1.1670838,0,0,1.1670838,-33.470205,-4.5661047)">
      <g transform="matrix(1.455019,0,0,1.4526924,-26.591717,96.903311)">
        <g transform="matrix(-0.42031259,0,0,0.31523443,70.985239,-95.589706)">
          <rect
            x={36.87656}
            y={152.49754}
            width={1.9826514}
            height={13.217676}
            rx={0.06245352}
            style={{
              fill: "#f8fafc",
              fillOpacity: 1,
              strokeWidth: 0.31995,
            }}
          />
        </g>
        <g transform="matrix(0,0.42031259,0.63046887,0,-48.992716,-59.349738)">
          <rect
            x={36.87656}
            y={152.49754}
            width={1.9826514}
            height={13.217676}
            rx={0.06245352}
            style={{
              fill: "#f8fafc",
              fillOpacity: 1,
              strokeWidth: 0.31995,
            }}
          />
        </g>
        <g transform="matrix(0.42031259,0,0,0.31523443,24.152889,-101.54527)">
          <rect
            x={36.87656}
            y={152.49754}
            width={1.9826514}
            height={13.217676}
            rx={0.06245352}
            style={{
              fill: "#f8fafc",
              fillOpacity: 1,
              strokeWidth: 0.31995,
            }}
          />
        </g>
        <g transform="matrix(0,0.42031259,-0.63046887,0,144.13086,-65.183486)">
          <rect
            x={36.87656}
            y={152.49754}
            width={1.9826514}
            height={13.217676}
            rx={0.06245352}
            style={{
              fill: "#f8fafc",
              fillOpacity: 1,
              strokeWidth: 0.31995,
            }}
          />
        </g>
        <rect
          x={37.985905}
          y={-57.600887}
          width={15}
          height={5}
          rx={0.053571429}
          fill="url(#blueBar)"
          style={{
            strokeWidth: 0.541263,
          }}
        />
        <rect
          x={37.985905}
          y={-45.933388}
          width={15}
          height={5}
          rx={0.053571425}
          fill="url(#purpleBar)"
          style={{
            strokeWidth: 0.541263,
          }}
        />
        <rect
          x={42.152225}
          y={-51.767136}
          width={15}
          height={5}
          rx={0.053571425}
          fill="url(#greyBar)"
          style={{
            strokeWidth: 0.541267,
          }}
        />
      </g>
      <g transform="matrix(2.5150884,0,0,2.5150884,-30.353914,-100.71914)">
        <text
          x={35.564266}
          y={54.848934}
          style={{
            fontFamily: "Montserrat",
            fontWeight: 600,
            fontSize: "12.24px",
            fill: "#f8fafc",
            fillOpacity: 1,
            strokeWidth: 0.421966,
          }}
        >
          Batchion
        </text>
        <circle
          cx={74.482109}
          cy={46.313694}
          r={1.0113109}
          style={{
            fill: "#7c3aed",
            fillOpacity: 1,
            strokeWidth: 0.288738,
          }}
        />
      </g>
    </g>
  </svg>
);

export default SVGComponent;

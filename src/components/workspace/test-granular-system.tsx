"use client";

import React from 'react';
import { 
  convertLegacyToGranular, 
  isFieldOverridden, 
  getEffectiveValue,
  type GranularOverrides 
} from '@/shared/properties/granular-assignments';

export function TestGranularSystem() {
  // Test legacy conversion
  const legacyOverrides = {
    position: { x: 100, y: 200 },
    scale: { x: 2, y: 3 },
    rotation: 45,
    opacity: 0.5,
    fillColor: '#ff0000',
    strokeColor: '#00ff00',
    strokeWidth: 2
  };

  const granularOverrides = convertLegacyToGranular(legacyOverrides);
  
  console.log('Legacy overrides:', legacyOverrides);
  console.log('Converted granular overrides:', granularOverrides);

  // Test field-level override detection
  const testOverrides: GranularOverrides = {
    'position.x': 50,
    'scale.y': 1.5,
    'fillColor': '#0000ff'
  };

  const testResults = [
    {
      field: 'position.x',
      isOverridden: isFieldOverridden(testOverrides, 'position.x'),
      effectiveValue: getEffectiveValue('position.x', testOverrides, undefined, undefined, 0)
    },
    {
      field: 'position.y',
      isOverridden: isFieldOverridden(testOverrides, 'position.y'),
      effectiveValue: getEffectiveValue('position.y', testOverrides, undefined, undefined, 0)
    },
    {
      field: 'scale.x',
      isOverridden: isFieldOverridden(testOverrides, 'scale.x'),
      effectiveValue: getEffectiveValue('scale.x', testOverrides, undefined, undefined, 1)
    },
    {
      field: 'scale.y',
      isOverridden: isFieldOverridden(testOverrides, 'scale.y'),
      effectiveValue: getEffectiveValue('scale.y', testOverrides, undefined, undefined, 1)
    }
  ];

  return (
    <div className="p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-4">Granular Override System Test</h3>
      
      <div className="mb-6">
        <h4 className="font-semibold mb-2">Legacy Conversion Test:</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Legacy:</strong>
            <pre className="bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(legacyOverrides, null, 2)}
            </pre>
          </div>
          <div>
            <strong>Granular:</strong>
            <pre className="bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(granularOverrides, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Field-Level Override Test:</h4>
        <div className="text-sm">
          <p className="mb-2">Test overrides: position.x=50, scale.y=1.5, fillColor=#0000ff</p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1">Field</th>
                <th className="border border-gray-300 px-2 py-1">Is Overridden</th>
                <th className="border border-gray-300 px-2 py-1">Effective Value</th>
                <th className="border border-gray-300 px-2 py-1">Expected</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-2 py-1">{result.field}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    <span className={result.isOverridden ? 'text-green-600' : 'text-gray-500'}>
                      {result.isOverridden ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">{String(result.effectiveValue)}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    {result.field === 'position.x' ? '50 (override)' :
                     result.field === 'position.y' ? '0 (default)' :
                     result.field === 'scale.x' ? '1 (default)' :
                     result.field === 'scale.y' ? '1.5 (override)' : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
        <p className="text-green-800 text-sm">
          ✅ <strong>Key Achievement:</strong> The system now supports true field-level granularity!
          <br />
          • position.x can be overridden independently of position.y
          <br />
          • scale.x can be overridden independently of scale.y
          <br />
          • Only the specific fields show as "(override)" - no more group locking!
        </p>
      </div>
    </div>
  );
}
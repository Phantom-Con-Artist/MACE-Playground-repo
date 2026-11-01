import React, { useState, useMemo, useCallback } from 'react';
import AppShell from './components/AppShell';
import GraphCanvas from './components/GraphCanvas';
import ErrorBoundary from './components/ErrorBoundary';
import { parseExpression, extractVariables } from './math/index';

const PALETTE = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#db2777', // Pink
];

const INITIAL_ROWS = [
  { id: '1', expression: 'y = sin(x)', color: PALETTE[0], visible: true },
  { id: '2', expression: 'x^2 + y^2 = 25', color: PALETTE[1], visible: true },
  { id: '3', expression: 'y = a*x + b', color: PALETTE[2], visible: true },
];

const DEFAULT_VIEW = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

export default function App() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [activeId, setActiveId] = useState('1');
  const [errors, setErrors] = useState({});
  const [variables, setVariables] = useState({ a: 1, b: 0 });
  const [view, setView] = useState(DEFAULT_VIEW);

  // Validate an individual expression row
  const validateExpression = useCallback((id, exprStr) => {
    if (!exprStr.trim()) {
      setErrors((prev) => ({ ...prev, [id]: 'Expression cannot be empty' }));
      return false;
    }
    try {
      parseExpression(exprStr);
      setErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return true;
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: err.message || 'Invalid expression syntax',
      }));
      return false;
    }
  }, []);

  // Update expression text and run validation
  const handleChangeExpression = useCallback(
    (id, value) => {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, expression: value } : row))
      );
      validateExpression(id, value);
    },
    [validateExpression]
  );

  // Add a new blank expression row
  const handleAdd = useCallback(() => {
    const nextId = String(Date.now());
    const nextColor = PALETTE[rows.length % PALETTE.length];
    const newRow = {
      id: nextId,
      expression: '',
      color: nextColor,
      visible: true,
    };
    setRows((prev) => [...prev, newRow]);
    setActiveId(nextId);
  }, [rows.length]);

  // Remove an expression row
  const handleRemove = useCallback((id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Toggle row visibility
  const handleToggleVisible = useCallback((id) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r))
    );
  }, []);

  // Set runtime row error safely from canvas
  const handleRowError = useCallback((id, errorMsg) => {
    setErrors((prev) => {
      if (prev[id] === errorMsg) return prev;
      return { ...prev, [id]: errorMsg };
    });
  }, []);

  // Auto-detect free variables across valid expressions
  const detectedVariables = useMemo(() => {
    const varSet = new Set();
    rows.forEach((row) => {
      if (!row.expression.trim()) return;
      const params = extractVariables(row.expression);
      params.forEach((p) => varSet.add(p));
    });
    return Array.from(varSet).sort();
  }, [rows]);

  // Update slider variable value
  const handleVariableChange = useCallback((name, value) => {
    const num = parseFloat(value);
    setVariables((prev) => ({ ...prev, [name]: Number.isFinite(num) ? num : 0 }));
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setView((v) => {
      const cx = (v.xMin + v.xMax) / 2;
      const cy = (v.yMin + v.yMax) / 2;
      const spanX = (v.xMax - v.xMin) * 0.8;
      const spanY = (v.yMax - v.yMin) * 0.8;
      return {
        xMin: cx - spanX / 2,
        xMax: cx + spanX / 2,
        yMin: cy - spanY / 2,
        yMax: cy + spanY / 2,
      };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setView((v) => {
      const cx = (v.xMin + v.xMax) / 2;
      const cy = (v.yMin + v.yMax) / 2;
      const spanX = (v.xMax - v.xMin) * 1.25;
      const spanY = (v.yMax - v.yMin) * 1.25;
      return {
        xMin: cx - spanX / 2,
        xMax: cx + spanX / 2,
        yMin: cy - spanY / 2,
        yMax: cy + spanY / 2,
      };
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setView(DEFAULT_VIEW);
  }, []);

  // Render parameter sliders
  const renderParams = useCallback(() => {
    if (detectedVariables.length === 0) return null;

    return (
      <div className="calc-params" aria-label="Variable Sliders">
        {detectedVariables.map((param) => {
          const val = variables[param] !== undefined ? variables[param] : 1;
          return (
            <div key={param} className="param-row">
              <label htmlFor={`slider-${param}`}>{param} =</label>
              <input
                id={`slider-${param}`}
                type="range"
                className="param-slider"
                min="-10"
                max="10"
                step="0.1"
                value={val}
                aria-label={`Parameter ${param}`}
                onChange={(e) => handleVariableChange(param, e.target.value)}
              />
              <output htmlFor={`slider-${param}`}>{Number(val.toFixed(2))}</output>
            </div>
          );
        })}
      </div>
    );
  }, [detectedVariables, variables, handleVariableChange]);

  // Render graph canvas inside safe error boundary
  const renderCanvas = useCallback(
    () => (
      <ErrorBoundary
        fallback={
          <div role="alert" className="calc-canvas-error" style={{ padding: '2rem', color: '#b91c1c' }}>
            Graph canvas rendering encountered an issue. Try resetting view.
          </div>
        }
      >
        <GraphCanvas
          rows={rows}
          variables={variables}
          view={view}
          onViewChange={setView}
          onRowError={handleRowError}
        />
      </ErrorBoundary>
    ),
    [rows, variables, view, handleRowError]
  );

  return (
    <ErrorBoundary>
      <AppShell
        rows={rows}
        activeId={activeId}
        errors={errors}
        onAdd={handleAdd}
        onSelect={setActiveId}
        onToggleVisible={handleToggleVisible}
        onChangeExpression={handleChangeExpression}
        onRemove={handleRemove}
        renderCanvas={renderCanvas}
        renderParams={renderParams}
        zoomIn={handleZoomIn}
        zoomOut={handleZoomOut}
        zoomReset={handleZoomReset}
      />
    </ErrorBoundary>
  );
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AppShell from './components/AppShell';
import GraphCanvas from './graph/GraphCanvas';
import ErrorBoundary from './components/ErrorBoundary';
import { tryParseExpression, evaluate } from './math/index';
import { syncSliders, slidersToScope, updateSliderValue } from './state/sliders';

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

export default function App() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [activeId, setActiveId] = useState('1');
  const [errors, setErrors] = useState({});
  const [sliders, setSliders] = useState({});
  const canvasRef = useRef(null);

  // Sync sliders whenever rows change
  useEffect(() => {
    setSliders((prev) => syncSliders(prev, rows, { pruneUnused: true, includeHidden: true }));
  }, [rows]);

  // Validate expression on change
  const validateExpression = useCallback((id, exprStr) => {
    if (!exprStr.trim()) {
      setErrors((prev) => ({ ...prev, [id]: 'Expression cannot be empty' }));
      return false;
    }
    const result = tryParseExpression(exprStr);
    if (!result.success) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return false;
    }
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
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

  // Map sliders to evaluation scope
  const variableScope = useMemo(() => slidersToScope(sliders), [sliders]);

  // Zoom handlers triggering GraphCanvas imperative methods
  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn?.();
  }, []);

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut?.();
  }, []);

  const handleZoomReset = useCallback(() => {
    canvasRef.current?.resetView?.();
  }, []);

  // Render parameter sliders
  const renderParams = useCallback(() => {
    const sliderList = Object.values(sliders);
    if (sliderList.length === 0) return null;

    return (
      <div className="calc-params" aria-label="Variable Sliders">
        {sliderList.map((slider) => (
          <div key={slider.id} className="param-row">
            <label htmlFor={`slider-${slider.name}`}>{slider.name} =</label>
            <input
              id={`slider-${slider.name}`}
              type="range"
              className="param-slider"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              aria-label={`Parameter ${slider.name}`}
              onChange={(e) => {
                const nextVal = parseFloat(e.target.value);
                const updated = updateSliderValue(slider, Number.isFinite(nextVal) ? nextVal : 0);
                setSliders((prev) => ({ ...prev, [slider.name]: updated }));
              }}
            />
            <output htmlFor={`slider-${slider.name}`}>{Number(slider.value.toFixed(2))}</output>
          </div>
        ))}
      </div>
    );
  }, [sliders]);

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
          ref={canvasRef}
          expressions={rows}
          variables={variableScope}
          customEvaluator={(expr, scope) => evaluate(expr, scope)}
          showControls={false}
          showCoordinates={true}
        />
      </ErrorBoundary>
    ),
    [rows, variableScope]
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

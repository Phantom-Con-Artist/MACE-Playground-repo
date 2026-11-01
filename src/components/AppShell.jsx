import "./../styles/tokens.css";
import "./../styles/layout.css";

/**
 * Presentational application shell (visual design owned).
 *
 * No math, no canvas logic, no slider state here: this component only
 * arranges slots owned by others around the shared row contract:
 *   row = { id, expression, color, visible }
 *
 * Props:
 * - rows: row[]
 * - activeId: string | null
 * - errors: Record<id, string> (set by @agy-4 error handling)
 * - onAdd, onSelect(id), onToggleVisible(id), onChangeExpression(id, value), onRemove(id)
 * - renderCanvas: () => node (owned by @agy)
 * - renderParams: () => node (owned by @agy-3)
 * - zoomIn, zoomOut, zoomReset (wired by @agy, buttons styled here)
 */
export default function AppShell({
  rows = [],
  activeId = null,
  errors = {},
  onAdd = () => {},
  onSelect = () => {},
  onToggleVisible = () => {},
  onChangeExpression = () => {},
  onRemove = () => {},
  renderCanvas = null,
  renderParams = null,
  zoomIn = () => {},
  zoomOut = () => {},
  zoomReset = () => {},
}) {
  return (
    <div className="calc-app">
      <header className="calc-header">
        <h1>Graphing Calculator</h1>
        <span className="calc-hint">y = sin(x) · x^2 + y^2 = 25 · y = a*x + b</span>
      </header>

      <div className="calc-main">
        <aside className="calc-side" aria-label="Expressions">
          <div className="calc-side-scroll">
            <ol className="expr-list">
              {rows.map((row) => {
                const message = errors[row.id];
                return (
                  <li
                    key={row.id}
                    className="expr-row"
                    data-active={row.id === activeId ? "true" : "false"}
                    data-error={message ? "true" : "false"}
                  >
                    <span
                      className="expr-dot"
                      style={{ "--expr-color": row.color }}
                      aria-hidden="true"
                    />
                    <input
                      className="expr-input"
                      value={row.expression}
                      aria-label={`Expression ${row.id}`}
                      onFocus={() => onSelect(row.id)}
                      onChange={(event) =>
                        onChangeExpression(row.id, event.target.value)
                      }
                    />
                    <span>
                      <button
                        className="calc-btn"
                        type="button"
                        aria-pressed={row.visible ? "true" : "false"}
                        aria-label={row.visible ? "Hide" : "Show"}
                        onClick={() => onToggleVisible(row.id)}
                      >
                        {row.visible ? "Hide" : "Show"}
                      </button>{" "}
                      <button
                        className="calc-btn"
                        type="button"
                        aria-label="Remove"
                        onClick={() => onRemove(row.id)}
                      >
                        ×
                      </button>
                    </span>
                    {message ? (
                      <p className="calc-error" role="alert">
                        {message}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>

          {renderParams ? (
            <div className="calc-params">{renderParams()}</div>
          ) : null}

          <div className="calc-side-footer">
            <button
              className="calc-btn calc-btn-primary"
              type="button"
              onClick={onAdd}
            >
              Add expression
            </button>
          </div>
        </aside>

        <main className="calc-stage" aria-label="Graph">
          {renderCanvas ? renderCanvas() : <canvas className="calc-canvas" />}
          <div className="calc-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom in" onClick={zoomIn}>
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={zoomOut}>
              −
            </button>
            <button type="button" aria-label="Reset view" onClick={zoomReset}>
              ⌂
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

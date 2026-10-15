// Pure validation for the plot_on_graph tool's arguments — the model's args
// are untrusted input. Pulled out of server.js (which can't be require()'d
// standalone) so it's unit-testable with no network or database involved.

const DESMOS_COLOR_NAMES = ['RED', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'BLACK'];
const GRAPH_BOUND_LIMIT = 1000;

// Returns null (meaning "don't plot anything") if nothing usable survives
// validation, otherwise a clean { expressions, bounds, replace } object
// safe to hand straight to the frontend.
function validatePlotOnGraphArgs(args) {
  if (!args || !Array.isArray(args.expressions)) return null;

  const expressions = [];
  for (const item of args.expressions.slice(0, 6)) {
    if (!item || typeof item.latex !== 'string') continue;
    // eslint-disable-next-line no-control-regex
    const latex = item.latex.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200);
    if (!latex) continue;
    const entry = { latex };
    if (typeof item.color === 'string' && DESMOS_COLOR_NAMES.includes(item.color.toUpperCase())) {
      entry.color = item.color.toUpperCase();
    }
    expressions.push(entry);
  }
  if (!expressions.length) return null;

  let bounds;
  if (args.bounds && typeof args.bounds === 'object') {
    const clamp = v => Math.max(-GRAPH_BOUND_LIMIT, Math.min(GRAPH_BOUND_LIMIT, v));
    const { xmin, xmax, ymin, ymax } = args.bounds;
    if ([xmin, xmax, ymin, ymax].every(v => typeof v === 'number' && Number.isFinite(v))) {
      if (xmin < xmax && ymin < ymax) {
        bounds = { xmin: clamp(xmin), xmax: clamp(xmax), ymin: clamp(ymin), ymax: clamp(ymax) };
      }
    }
  }

  return { expressions, bounds, replace: args.replace === true };
}

module.exports = { validatePlotOnGraphArgs, DESMOS_COLOR_NAMES, GRAPH_BOUND_LIMIT };

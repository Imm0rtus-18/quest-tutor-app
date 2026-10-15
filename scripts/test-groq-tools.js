// Standalone test for groq-tools.js — no network, no database. Run with:
//   node scripts/test-groq-tools.js
// Verifies the generic Gemini-tool <-> Groq-tool conversion handles the
// plot_on_graph tool with a fake tool call, the same way it already
// handles search_youtube_video/adjust_lesson_progress, without any
// tool-specific code.
const assert = require('assert');
const { toOpenAiTools, parseGroqMessageToParts } = require('../groq-tools');
const { validatePlotOnGraphArgs } = require('../graph-tools');

const PLOT_ON_GRAPH_TOOL = {
  functionDeclarations: [{
    name: 'plot_on_graph',
    description: 'Plot one or more expressions on the student\'s graphing calculator.',
    parameters: {
      type: 'object',
      properties: {
        expressions: { type: 'array' },
        bounds: { type: 'object' },
        replace: { type: 'boolean' }
      },
      required: ['expressions']
    }
  }]
};

// 1. Tool declaration converts to OpenAI shape with no tool-specific code.
const openAiTools = toOpenAiTools([PLOT_ON_GRAPH_TOOL]);
assert.strictEqual(openAiTools.length, 1);
assert.strictEqual(openAiTools[0].type, 'function');
assert.strictEqual(openAiTools[0].function.name, 'plot_on_graph');
console.log('PASS: toOpenAiTools converts plot_on_graph generically');

// 2. A fake Groq tool_call response parses back into the internal
// {functionCall:{name,args}} shape, args correctly JSON-parsed.
const fakeGroqMessage = {
  content: null,
  tool_calls: [{
    id: 'call_abc123',
    type: 'function',
    function: {
      name: 'plot_on_graph',
      arguments: JSON.stringify({
        expressions: [{ latex: 'y=x^2', color: 'BLUE' }],
        bounds: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
        replace: true
      })
    }
  }]
};

const parts = parseGroqMessageToParts(fakeGroqMessage);
assert.strictEqual(parts.length, 1);
assert.ok(parts[0].functionCall, 'expected a functionCall part');
assert.strictEqual(parts[0].functionCall.name, 'plot_on_graph');
assert.strictEqual(parts[0].functionCall.id, 'call_abc123');
assert.deepStrictEqual(parts[0].functionCall.args, {
  expressions: [{ latex: 'y=x^2', color: 'BLUE' }],
  bounds: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
  replace: true
});
console.log('PASS: parseGroqMessageToParts reshapes a fake plot_on_graph tool_call correctly');

// 3. Malformed arguments JSON doesn't throw — falls back to {} and still
// produces a well-formed functionCall part (server-side validation then
// rejects it the same way it would reject any other bad args).
const malformed = {
  content: null,
  tool_calls: [{ id: 'call_bad', type: 'function', function: { name: 'plot_on_graph', arguments: '{not json' } }]
};
const malformedParts = parseGroqMessageToParts(malformed);
assert.strictEqual(malformedParts.length, 1);
assert.deepStrictEqual(malformedParts[0].functionCall.args, {});
console.log('PASS: malformed tool_call arguments degrade to {} instead of throwing');

// 4. A plain text message (no tool call) still passes through unchanged —
// confirms the generic path didn't regress the no-tool-call case.
const textOnly = parseGroqMessageToParts({ content: 'just chatting, no tools' });
assert.deepStrictEqual(textOnly, [{ text: 'just chatting, no tools' }]);
console.log('PASS: plain-text (no tool_calls) message still passes through');

// 5. End-to-end: the args parsed out of the fake Groq call in test #2 above
// survive server-side validation exactly like a real Gemini tool call would.
const validated = validatePlotOnGraphArgs(parts[0].functionCall.args);
assert.deepStrictEqual(validated, {
  expressions: [{ latex: 'y=x^2', color: 'BLUE' }],
  bounds: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
  replace: true
});
console.log('PASS: a fake Groq plot_on_graph call survives server-side validation end-to-end');

console.log('\nAll groq-tools.js tests passed.');

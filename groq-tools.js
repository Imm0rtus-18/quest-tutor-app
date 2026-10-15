// Pure helpers for translating between Gemini's functionDeclarations tool
// shape and Groq's OpenAI-compatible tools/tool_calls shape. Pulled out of
// server.js (which can't be require()'d standalone — it connects to Postgres
// and calls app.listen() at import time) so this conversion can be unit
// tested with a fake call, with no network or database involved.
//
// Both directions are fully generic over the tool list — adding a new
// Gemini functionDeclaration elsewhere in the app (e.g. plot_on_graph)
// requires no changes here; it's picked up automatically.

// Our Gemini-shaped functionDeclarations tools -> OpenAI's tools/function
// schema ({type:"function", function:{name, description, parameters}}).
function toOpenAiTools(tools) {
  if (!tools) return undefined;
  const declarations = tools.flatMap(t => t.functionDeclarations || []);
  return declarations.map(d => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.parameters }
  }));
}

// Groq's OpenAI-style choices[0].message -> Gemini-shaped content parts
// (candidate.content.parts), so nothing downstream (function-call handling,
// text extraction) needs to know or care which provider actually answered.
function parseGroqMessageToParts(message) {
  const parts = [];
  if (message && Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch (err) {
        console.error('Groq fallback: could not parse tool call arguments:', call.function.arguments, err);
      }
      parts.push({ functionCall: { name: call.function.name, args, id: call.id } });
    }
  }
  if (message && message.content) {
    parts.push({ text: message.content });
  }
  return parts;
}

module.exports = { toOpenAiTools, parseGroqMessageToParts };

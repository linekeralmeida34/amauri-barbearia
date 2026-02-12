// N8N Code node (JavaScript) - Run Once for All Items

const item = $input.first().json;

// 1) pega o texto do modelo
const text =
  item?.content?.parts?.[0]?.text ||
  item?.text ||
  "";

// 2) extrai JSON do texto (remove ```json ... ```)
let str = String(text).trim();
const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
if (codeBlock) str = codeBlock[1].trim();

// 3) parse
let raw;
try {
  raw = JSON.parse(str);
} catch (e) {
  throw new Error("Nao consegui extrair JSON valido do texto.");
}

// 4) retorna tudo
const result = raw;

// precisa retornar array de items
return [{ json: result }];

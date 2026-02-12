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

// 4) padroniza a estrutura (normaliza chaves)
const base = Array.isArray(raw) ? raw[0] : raw;

const diagnostico = base?.diagnostico_estrategico || base?.diagnostico_faturamento || {};
const maiorPerda =
  diagnostico?.maior_perda_financeira || diagnostico?.maior_risco_churn_financeiro || {};

const whatsapp = base?.estrategia_whatsapp_retencao || base?.estrategia_whatsapp || {};
const fiel = whatsapp?.script_fiel_sumido || whatsapp?.roteiro_cliente_fiel_sumido || {};
const exp = whatsapp?.script_experimentador || whatsapp?.roteiro_experimentador || {};

const trafego = base?.inteligencia_para_trafego_pago || base?.acao_trafego_pago || {};
const estrutura = trafego?.estrutura_meta_ads || trafego?.estrutura_publicos_meta || {};

const upsell = base?.oportunidade_upsell_balcao || base?.sugestao_upsell_balcao || {};
const estrategia = upsell?.estrategia_baixa_frequencia || upsell?.tecnica_venda_presencial || {};

const result = {
  diagnostico_estrategico: {
    ticket_medio_geral: diagnostico?.ticket_medio_geral,
    maior_perda_financeira: {
      cluster: maiorPerda?.cluster,
      motivo: maiorPerda?.motivo || maiorPerda?.causa_raiz,
    },
  },
  estrategia_whatsapp_retencao: {
    script_fiel_sumido: {
      abordagem: fiel?.abordagem || fiel?.mensagem || fiel?.texto,
      gatilho: fiel?.gatilho,
    },
    script_experimentador: {
      abordagem: exp?.abordagem || exp?.mensagem || exp?.texto,
      gatilho: exp?.gatilho,
    },
  },
  inteligencia_para_trafego_pago: {
    estrutura_meta_ads: {
      publico_lookalike: estrutura?.publico_lookalike || estrutura?.lookalike,
      exclusao: estrutura?.exclusao,
      gancho_autoridade: estrutura?.gancho_autoridade,
    },
  },
  oportunidade_upsell_balcao: {
    estrategia_baixa_frequencia: {
      combo_sugerido: estrategia?.combo_sugerido || estrategia?.sugestao_combo,
      tecnica_venda: estrategia?.tecnica_venda || estrategia?.script_barbeiro,
    },
  },
};

// precisa retornar array de items
return [{ json: result }];

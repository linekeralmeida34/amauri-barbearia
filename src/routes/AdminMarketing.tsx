// src/routes/AdminMarketing.tsx
// Exibe o resultado do fluxo N8N (relatório de marketing em JSON).

import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Megaphone,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Target,
  MessageCircle,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  List,
} from "lucide-react";

// Tipos do relatório de marketing
type DiagnosticoFaturamento = {
  ticket_medio_geral?: number;
  segmento_maior_potencial_represado?: {
    cluster?: string;
    dinheiro_historico_represado?: number;
    justificativa?: string;
    origem?: "potencial" | "churn";
  };
};

type AcaoTrafegoPago = {
  nome_campanha?: string;
  publico_alvo?: {
    tipo?: string;
    lista_de_clientes_target?: string[];
    exclusoes_necessarias?: string[] | Record<string, string[]>;
    detalhamento?: string;
    sugestoes_adicionais_segmentacao?: string;
  };
  criativos?: Array<{ titulo?: string; texto?: string; ideia_imagem?: string }>;
};

type EstrategiaWhatsapp = {
  script_resgate_vip?: { tom?: string; mensagem?: string; horario_disparo?: string; para?: string };
  script_segunda_chance?: { tom?: string; mensagem?: string; horario_disparo?: string; para?: string };
  script_fiel_sumido?: { tom?: string; mensagem?: string; horario_disparo?: string; para?: string };
  script_experimentador?: { tom?: string; mensagem?: string; horario_disparo?: string; para?: string };
};

type SugestaoUpsellBalcao = {
  publico_alvo?: { cluster?: string; condicao?: string };
  acao_interna?: { nome?: string; detalhes?: string[] };
};

export type RelatorioMktJson = {
  diagnostico_faturamento?: DiagnosticoFaturamento;
  acao_trafego_pago?: AcaoTrafegoPago;
  estrategia_whatsapp?: EstrategiaWhatsapp;
  sugestao_upsell_balcao?: SugestaoUpsellBalcao;
};

const WEBHOOK_URL = import.meta.env.PROD
  ? "/api/n8n-marketing"
  : (import.meta.env.VITE_N8N_MKT_WEBHOOK_URL as string | undefined);
const WEBHOOK_CONFIG_HINT = import.meta.env.PROD
  ? "Configure N8N_MKT_WEBHOOK_URL nas variáveis da Vercel."
  : "Configure VITE_N8N_MKT_WEBHOOK_URL no .env.";
const STORAGE_RELATORIO_KEY = "mkt_relatorio";
const STORAGE_RELATORIO_AT_KEY = "mkt_relatorio_at";
const STORAGE_LAST_FETCH_KEY = "mkt_last_fetch_at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Extrai objeto JSON de texto (bloco ```json ou JSON puro) */
function extrairJson(texto: string): RelatorioMktJson {
  let str = texto.trim();
  const textMatch = str.match(/\btext\s*:\s*([\s\S]*)/i);
  if (textMatch) str = textMatch[1].trim();
  if ((str.startsWith("\"") && str.endsWith("\"")) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }
  if (str.includes("\\n")) str = str.replace(/\\n/g, "\n");
  if (/^json\s*\n/i.test(str)) str = str.replace(/^json\s*\n/i, "");
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) str = codeBlock[1].trim();
  const raw = JSON.parse(str) as unknown;
  return normalizarRelatorio(raw);
}

/** Botão para baixar lista de telefones (não exibe números na tela) */
function DownloadListaTelefones({ telefones, label }: { telefones: string[]; label: string }) {
  const [downloaded, setDownloaded] = useState(false);
  const baixar = () => {
    const conteudo = telefones.join("\n");
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "telefones-segmento.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-white/20 text-white hover:bg-white/10"
      onClick={baixar}
    >
      {downloaded ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
      {downloaded ? "Download feito" : label}
    </Button>
  );
}

function extrairTextoRespostaN8N(body: unknown): string {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) {
    for (const item of body) {
      const text = extrairTextoRespostaN8N(item);
      if (text) return text;
    }
    return "";
  }
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const parts = (obj.parts as Array<{ text?: string }> | undefined)?.[0]?.text;
    if (typeof parts === "string") return parts;
    const content = obj.content ?? (body as { data?: { content?: { parts?: { text?: string }[] } } }).data?.[0]?.content;
    if (content && typeof content === "object") {
      const p = (content as { parts?: { text?: string }[] }).parts?.[0]?.text;
      if (typeof p === "string") return p;
    }
    if (typeof (obj as { text?: string }).text === "string") return (obj as { text: string }).text;
  }
  return "";
}

function normalizarRelatorio(raw: unknown): RelatorioMktJson {
  const parseMaybeJson = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    let str = value.trim();
    if ((str.startsWith("\"") && str.endsWith("\"")) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1);
    }
    if (str.includes("\\n")) str = str.replace(/\\n/g, "\n");
    if (/^json\s*\n/i.test(str)) str = str.replace(/^json\s*\n/i, "");
    const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) str = codeBlock[1].trim();
    if (!(str.startsWith("{") || str.startsWith("["))) return value;
    try {
      return JSON.parse(str) as unknown;
    } catch {
      return value;
    }
  };

  const normalizarScript = (
    value: unknown
  ): { tom?: string; mensagem?: string; horario_disparo?: string; para?: string } | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") return { mensagem: value };
    if (typeof value !== "object") return undefined;
    const obj = value as Record<string, unknown>;
    return {
      tom: (obj.tom as string | undefined) ?? (obj.gatilho as string | undefined),
      mensagem:
        (obj.mensagem as string | undefined) ??
        (obj.texto as string | undefined) ??
        (obj.abordagem as string | undefined),
      horario_disparo:
        (obj.horario_disparo as string | undefined) ??
        (obj.horario as string | undefined) ??
        (obj.horario_disparo_sugestao as string | undefined),
      para: obj.para as string | undefined,
    };
  };

  const first = Array.isArray(raw) ? raw[0] : raw;
  const obj = (first && typeof first === "object" ? (first as Record<string, unknown>) : {}) as Record<string, unknown>;
  const base =
    (obj.relatorio_tatico_amauri_barbearia as Record<string, unknown> | undefined) ??
    (obj.relatorio_tatico as Record<string, unknown> | undefined) ??
    obj;

  // --- DIAGNÓSTICO ---
  const diagRaw = parseMaybeJson(
    (base.diagnostico_faturamento as Record<string, unknown> | string | undefined) ??
      (base["1_diagnostico_faturamento"] as Record<string, unknown> | string | undefined) ??
      (base.diagnostico_estrategico as Record<string, unknown> | string | undefined)
  ) as Record<string, unknown> | string | undefined;

  const segmentoPotencialRaw =
    typeof diagRaw === "object" && diagRaw
      ? ((diagRaw as Record<string, unknown>).segmento_maior_potencial_represado as Record<string, unknown> | undefined)
      : undefined;

  const segmentoChurnRaw =
    typeof diagRaw === "object" && diagRaw
      ? ((diagRaw as Record<string, unknown>).maior_risco_churn_financeiro as Record<string, unknown> | undefined)
      : undefined;

  const perdaFinanceiraRaw =
    typeof diagRaw === "object" && diagRaw
      ? ((diagRaw as Record<string, unknown>).maior_perda_financeira as Record<string, unknown> | undefined)
      : undefined;

  const segmentoRaw = segmentoPotencialRaw ?? segmentoChurnRaw ?? perdaFinanceiraRaw;
  const segmentoOrigem: "potencial" | "churn" | undefined = segmentoChurnRaw ? "churn" : segmentoRaw ? "potencial" : undefined;

  const detalhes = (segmentoRaw?.detalhes_potencial_calculado as Array<Record<string, unknown>> | undefined) ?? [];
  const somaPotencial = detalhes.reduce((acc, item) => {
    const val = Number(item.potencial_represado_estimado);
    return Number.isFinite(val) ? acc + val : acc;
  }, 0);

  // --- TRÁFEGO PAGO ---
  const acaoRaw = parseMaybeJson(
    (base.acao_trafego_pago_meta_ads as Record<string, unknown> | string | undefined) ??
      (base.acao_trafego_pago as Record<string, unknown> | string | undefined) ??
      (base["2_acao_trafego_pago"] as Record<string, unknown> | string | undefined) ??
      (base.inteligencia_para_trafego_pago as Record<string, unknown> | string | undefined)
  ) as Record<string, unknown> | string | undefined;

  const campanhaContainer =
    typeof acaoRaw === "object" && acaoRaw
      ? (acaoRaw as Record<string, unknown>)
      : undefined;

  const estruturaMeta =
    (campanhaContainer?.estrutura_meta_ads as Record<string, unknown> | undefined) ??
    (campanhaContainer?.estrutura_publicos_meta_ads as Record<string, unknown> | undefined);

  const campanhaRaw =
    (campanhaContainer?.campanha as Record<string, unknown> | undefined) ??
    (campanhaContainer as Record<string, unknown> | undefined);

  const publicoRaw =
    typeof campanhaRaw === "object" && campanhaRaw
      ? ((campanhaRaw as Record<string, unknown>).publico_alvo as Record<string, unknown> | undefined)
      : undefined;

  const criativosRaw =
    typeof campanhaRaw === "object" && campanhaRaw
      ? ((campanhaRaw as Record<string, unknown>).criativos_sugestoes as Array<Record<string, unknown>> | undefined) ??
        ((campanhaRaw as Record<string, unknown>).criativos as Array<Record<string, unknown>> | undefined)
      : undefined;

  const perfilLookalike =
    (estruturaMeta?.publico_lookalike as string | undefined) ??
    (estruturaMeta?.lookalike as string | undefined) ??
    (campanhaRaw as Record<string, unknown> | undefined)?.perfil_lookalike_ideal as string | undefined;

  const estrategiaExclusao =
    (estruturaMeta?.exclusao as string | undefined) ??
    (campanhaRaw as Record<string, unknown> | undefined)?.estrategia_exclusao as string | undefined;

  const headlineAutoridade =
    (estruturaMeta?.gancho_autoridade as string | undefined) ??
    (campanhaRaw as Record<string, unknown> | undefined)?.gancho_autoridade_headline as string | undefined;

  // --- WHATSAPP ---
  const whatsappRaw = parseMaybeJson(
    (base.estrategia_whatsapp as Record<string, unknown> | string | undefined) ??
      (base["3_estrategia_whatsapp"] as Record<string, unknown> | string | undefined) ??
      (base.estrategia_whatsapp_retencao as Record<string, unknown> | string | undefined)
  );

  // --- UPSELL ---
  const upsellRaw = parseMaybeJson(
    (base.sugestao_upsell_balcao as Record<string, unknown> | string | undefined) ??
      (base["4_sugestao_upsell_balcao"] as Record<string, unknown> | string | undefined) ??
      (base.oportunidade_upsell_balcao as Record<string, unknown> | string | undefined)
  );

  return {
    diagnostico_faturamento: diagRaw && typeof diagRaw === "object"
      ? {
          ticket_medio_geral:
            ((diagRaw as Record<string, unknown>).ticket_medio_geral as number | undefined) ??
            ((diagRaw as Record<string, unknown>).ticket_medio_geral_barbearia as number | undefined),
          segmento_maior_potencial_represado: segmentoRaw
            ? {
                cluster: segmentoRaw.cluster as string | undefined,
                dinheiro_historico_represado:
                  (segmentoRaw.dinheiro_historico_represado as number | undefined) ??
                  (segmentoRaw.potencial_represado_total as number | undefined) ??
                  (somaPotencial > 0 ? somaPotencial : undefined),
                justificativa:
                  (segmentoRaw.justificativa as string | undefined) ??
                  (segmentoRaw.motivo as string | undefined),
                origem: segmentoOrigem,
              }
            : typeof (diagRaw as Record<string, unknown>).segmento_maior_potencial_represado === "string"
              ? {
                  cluster: (diagRaw as Record<string, unknown>).segmento_maior_potencial_represado as string,
                  origem: "potencial",
                }
              : undefined,
        }
      : undefined,
    acao_trafego_pago: campanhaRaw && typeof campanhaRaw === "object"
      ? {
          nome_campanha:
            ((campanhaRaw as Record<string, unknown>).nome_campanha as string | undefined) ??
            ((campanhaRaw as Record<string, unknown>).nome as string | undefined),
          publico_alvo:
            publicoRaw || perfilLookalike || estrategiaExclusao
              ? {
                  tipo:
                    (publicoRaw?.tipo as string | undefined) ??
                    (perfilLookalike || estrategiaExclusao ? "Meta Ads" : undefined),
                  lista_de_clientes_target:
                    (publicoRaw?.lista_de_clientes_target as string[] | undefined) ??
                    (publicoRaw?.lista_telefones_segmento as string[] | undefined) ??
                    (publicoRaw?.lista_crm as string[] | undefined),
                  exclusoes_necessarias:
                    (publicoRaw?.exclusoes_necessarias as string[] | undefined) ??
                    (publicoRaw?.exclusoes as string[] | undefined),
                  detalhamento: (publicoRaw?.detalhamento as string | undefined) ?? perfilLookalike,
                  sugestoes_adicionais_segmentacao:
                    (publicoRaw?.sugestoes_adicionais_segmentacao as string | undefined) ??
                    (publicoRaw?.segmentacao_adicional_sugestao as string | undefined) ??
                    estrategiaExclusao,
                }
              : undefined,
          criativos: (() => {
            const criativos =
              (criativosRaw ??
                ((campanhaRaw as Record<string, unknown>).criativos_sugestao as Array<Record<string, unknown>> | undefined))?.map(
                (c, i) => ({
                  titulo:
                    (c.titulo as string | undefined) ??
                    (c.nome as string | undefined) ??
                    (c.criativo_numero != null ? `Criativo ${c.criativo_numero}` : `Criativo ${i + 1}`),
                  texto: c.texto as string | undefined,
                  ideia_imagem: c.ideia_imagem as string | undefined,
                })
              ) ?? [];
            if (headlineAutoridade) {
              criativos.unshift({ titulo: "Headline de autoridade", texto: headlineAutoridade, ideia_imagem: undefined });
            }
            return criativos.length ? criativos : undefined;
          })(),
        }
      : undefined,
    estrategia_whatsapp: (() => {
      if (!whatsappRaw) return undefined;
      if (typeof whatsappRaw === "string") {
        return { script_resgate_vip: { mensagem: whatsappRaw } };
      }
      if (typeof whatsappRaw !== "object") return undefined;
      const w = whatsappRaw as Record<string, unknown>;
      const resgate = normalizarScript(w.script_resgate_vip ?? w["1_script_resgate_vip"]);
      const segunda = normalizarScript(w.script_segunda_chance ?? w["2_script_segunda_chance"]);
      const fielSumido = normalizarScript(w.script_fiel_sumido ?? w["1_script_fiel_sumido"]);
      const experimentador = normalizarScript(w.script_experimentador ?? w["2_script_experimentador"]);
      return {
        script_resgate_vip: resgate,
        script_segunda_chance: segunda,
        script_fiel_sumido: fielSumido,
        script_experimentador: experimentador,
      };
    })(),
    sugestao_upsell_balcao: (() => {
      if (!upsellRaw) return undefined;
      if (typeof upsellRaw === "string") {
        return { acao_interna: { detalhes: [upsellRaw] } };
      }
      if (typeof upsellRaw !== "object") return undefined;
      const u = upsellRaw as Record<string, unknown>;

      const tecnicaPresencial = u.tecnica_venda_presencial as Record<string, unknown> | undefined;
      const estrategiaBaixa = u.estrategia_baixa_frequencia as Record<string, unknown> | undefined;

      const publicoRaw =
        (u.publico_alvo as Record<string, unknown> | string | undefined) ??
        (u["1_publico_alvo"] as Record<string, unknown> | string | undefined) ??
        (u.para as string | undefined) ??
        (u.segmento_alvo as string | undefined) ??
        (tecnicaPresencial?.alvo as string | undefined);

      const acaoRaw =
        (u.acao_interna as Record<string, unknown> | string | undefined) ??
        (u["2_acao_interna"] as Record<string, unknown> | string | undefined) ??
        (u.estrategia as string | undefined) ??
        (tecnicaPresencial?.sugestao as string | undefined);

      const publico =
        typeof publicoRaw === "string"
          ? { cluster: publicoRaw }
          : (publicoRaw as { cluster?: string; condicao?: string } | undefined);

      const detalhesEstrategia = [
        estrategiaBaixa?.combo_sugerido ? `Combo sugerido: ${estrategiaBaixa.combo_sugerido}` : null,
        estrategiaBaixa?.tecnica_venda ? `Técnica de venda: ${estrategiaBaixa.tecnica_venda}` : null,
      ].filter((d): d is string => Boolean(d));

      const acao =
        typeof acaoRaw === "string"
          ? { nome: "Estratégia", detalhes: [acaoRaw] }
          : (acaoRaw as { nome?: string; detalhes?: string[] } | undefined);

      const acaoNormalizada =
        acao ??
        (detalhesEstrategia.length
          ? { nome: "Estratégia de upsell", detalhes: detalhesEstrategia }
          : undefined);

      return { publico_alvo: publico, acao_interna: acaoNormalizada };
    })(),
  };
}

export default function AdminMarketing() {
  const [jsonInput, setJsonInput] = useState("");
  const [relatorio, setRelatorio] = useState<RelatorioMktJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);

  useEffect(() => {
    setInitialLoad(false);
    const cached = localStorage.getItem(STORAGE_RELATORIO_KEY);
    if (cached) {
      try {
        setRelatorio(JSON.parse(cached));
      } catch {
        localStorage.removeItem(STORAGE_RELATORIO_KEY);
      }
    }
    const lastFetchRaw = localStorage.getItem(STORAGE_LAST_FETCH_KEY);
    if (lastFetchRaw) {
      const parsed = Number(lastFetchRaw);
      if (Number.isFinite(parsed)) {
        setLastFetchAt(parsed);
      }
    }
  }, []);

  const persistRelatorio = (value: RelatorioMktJson) => {
    localStorage.setItem(STORAGE_RELATORIO_KEY, JSON.stringify(value));
    localStorage.setItem(STORAGE_RELATORIO_AT_KEY, String(Date.now()));
  };

  const aplicarJson = useCallback(() => {
    setError(null);
    if (!jsonInput.trim()) {
      setRelatorio(null);
      return;
    }
    try {
      const parsed = extrairJson(jsonInput);
      setRelatorio(parsed);
      persistRelatorio(parsed);
    } catch (e: unknown) {
      setError(
        (e instanceof Error ? e.message : "JSON inválido.") +
          " Cole o retorno do nó Message a model (incluindo bloco ```json se houver)."
      );
      setRelatorio(null);
    }
  }, [jsonInput]);

  const buscarN8N = useCallback(async () => {
    if (!WEBHOOK_URL) {
      setError(`${WEBHOOK_CONFIG_HINT} Depois atualize a página para buscar do N8N.`);
      return;
    }
    if (lastFetchAt && Date.now() - lastFetchAt < ONE_DAY_MS) {
      const next = new Date(lastFetchAt + ONE_DAY_MS).toLocaleString("pt-BR");
      setError(`Atualização bloqueada por 24h. Próxima liberação: ${next}.`);
      return;
    }
    setLoading(true);
    setError(null);
    setRelatorio(null);
    localStorage.removeItem(STORAGE_RELATORIO_KEY);
    localStorage.removeItem(STORAGE_RELATORIO_AT_KEY);
    try {
      const res = await fetch(WEBHOOK_URL, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      const text = extrairTextoRespostaN8N(data);
      if (!text) {
        const str = typeof data === "string" ? data : JSON.stringify(data);
        if (str.startsWith("{") || str.startsWith("[")) {
          const parsed = normalizarRelatorio(JSON.parse(str));
          setRelatorio(parsed);
          persistRelatorio(parsed);
          const now = Date.now();
          setLastFetchAt(now);
          localStorage.setItem(STORAGE_LAST_FETCH_KEY, String(now));
        } else {
          setError("Resposta do N8N sem texto esperado. Cole o JSON manualmente.");
        }
        return;
      }
      setJsonInput(text);
      const parsed = extrairJson(text);
      setRelatorio(parsed);
      persistRelatorio(parsed);
      const now = Date.now();
      setLastFetchAt(now);
      localStorage.setItem(STORAGE_LAST_FETCH_KEY, String(now));
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : "Falha ao buscar.") + " Cole o JSON abaixo.");
    } finally {
      setLoading(false);
    }
  }, [lastFetchAt]);

  const copiarJson = () => {
    if (!relatorio) return;
    navigator.clipboard.writeText(JSON.stringify(relatorio, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const diag = relatorio?.diagnostico_faturamento;
  const trafego = relatorio?.acao_trafego_pago;
  const whatsapp = relatorio?.estrategia_whatsapp;
  const upsell = relatorio?.sugestao_upsell_balcao;

  return (
    <div className="min-h-screen bg-[#212133] text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-white/80 hover:text-barbershop-gold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o painel
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Megaphone className="w-8 h-8 text-barbershop-gold" />
              Relatório de Marketing (N8N)
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Diagnóstico, tráfego pago, WhatsApp e upsell.
            </p>
          </div>
          {relatorio && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#3d3d5c] bg-[#28283D] text-white/90 hover:bg-white/10 hover:text-white hover:border-white/20"
              onClick={copiarJson}
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copiado" : "Copiar JSON"}
            </Button>
          )}
        </div>

        <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-barbershop-gold" />
              {WEBHOOK_URL ? "Atualizar relatório" : "Carregar relatório"}
            </CardTitle>
            <p className="text-sm text-white/60">
              {WEBHOOK_URL
                ? "Clique em Atualizar do N8N para buscar o relatório ou cole o JSON manualmente abaixo."
                : `${WEBHOOK_CONFIG_HINT} Ou cole o retorno do nó Message a model.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_URL && (
                <Button
                  type="button"
                  onClick={buscarN8N}
                  disabled={loading}
                  className="bg-barbershop-gold hover:bg-barbershop-gold/90 text-barbershop-dark w-full sm:w-auto"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Atualizar do N8N
                </Button>
              )}
              <Button
                onClick={aplicarJson}
                variant="outline"
                className="border-[#3d3d5c] bg-[#28283D] text-white/90 hover:bg-white/10 hover:text-white hover:border-white/20"
              >
                Aplicar JSON colado
              </Button>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-2 text-sm text-white/60 hover:text-white/80">
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                Colar JSON manualmente
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Textarea
                  placeholder='Cole aqui (ex.: ```json\n{ "diagnostico_faturamento": ... }\n```)'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="mt-2 min-h-[100px] bg-black/40 border-white/20 text-white placeholder:text-white/40 font-mono text-sm"
                  rows={4}
                />
              </CollapsibleContent>
            </Collapsible>
            {error && (
              <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {!relatorio && !error && !initialLoad && (
          <p className="text-white/50 text-center py-8">
            {WEBHOOK_URL
              ? "Clique em Atualizar do N8N ou cole o JSON acima."
              : "Cole o JSON e clique em Aplicar JSON colado, ou configure o webhook no .env."}
          </p>
        )}

        {relatorio && (diag?.segmento_maior_potencial_represado || trafego?.publico_alvo?.lista_de_clientes_target?.length || upsell?.publico_alvo) && (
          <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <List className="w-5 h-5 text-barbershop-gold" />
                Segmentos em pauta
              </CardTitle>
              <p className="text-sm text-white/60">Resumo dos segmentos do relatório e listas para campanhas.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {diag?.segmento_maior_potencial_represado && (
                <div className="rounded-lg bg-black/30 p-4">
                  <h4 className="text-barbershop-gold font-medium text-sm mb-1">Diagnóstico — maior potencial</h4>
                  <p className="text-white/90">{diag.segmento_maior_potencial_represado.cluster}</p>
                  {diag.segmento_maior_potencial_represado.dinheiro_historico_represado != null && (
                    <p className="text-white/70 text-sm mt-1">
                      Potencial represado:{" "}
                      {Number(diag.segmento_maior_potencial_represado.dinheiro_historico_represado).toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL", minimumFractionDigits: 0 }
                      )}
                    </p>
                  )}
                </div>
              )}
              {trafego?.publico_alvo?.lista_de_clientes_target && trafego.publico_alvo.lista_de_clientes_target.length > 0 && (
                <div className="rounded-lg bg-black/30 p-4">
                  <h4 className="text-barbershop-gold font-medium text-sm mb-2">Campanha — lista de telefones</h4>
                  <p className="text-white/70 text-sm mb-2">{trafego.publico_alvo.lista_de_clientes_target.length} contatos</p>
                  <DownloadListaTelefones
                    telefones={trafego.publico_alvo.lista_de_clientes_target}
                    label="Baixar lista de telefones"
                  />
                </div>
              )}
              {upsell?.publico_alvo && (
                <div className="rounded-lg bg-black/30 p-4">
                  <h4 className="text-barbershop-gold font-medium text-sm mb-1">Upsell no balcão</h4>
                  <p className="text-white/90">{upsell.publico_alvo.cluster}</p>
                  {upsell.publico_alvo.condicao && (
                    <p className="text-white/70 text-sm mt-1">{upsell.publico_alvo.condicao}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {diag && (
          <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-barbershop-gold" />
                Diagnóstico de Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {diag.ticket_medio_geral != null && (
                <p className="text-lg">
                  <span className="text-white/60">Ticket médio geral:</span>{" "}
                  <strong className="text-barbershop-gold">
                    {Number(diag.ticket_medio_geral).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </p>
              )}
              {diag.segmento_maior_potencial_represado && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <p className="font-medium text-barbershop-gold">
                    {diag.segmento_maior_potencial_represado.cluster}
                  </p>
                  {diag.segmento_maior_potencial_represado.dinheiro_historico_represado != null && (
                    <p className="text-white/90">
                      Dinheiro histórico represado:{" "}
                      {Number(diag.segmento_maior_potencial_represado.dinheiro_historico_represado).toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL", minimumFractionDigits: 0 }
                      )}
                    </p>
                  )}
                  <p className="text-white/80 text-sm">{diag.segmento_maior_potencial_represado.justificativa}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {trafego && (
          <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-barbershop-gold" />
                Ação de Tráfego Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trafego.nome_campanha && (
                <div>
                  <h4 className="text-barbershop-gold font-medium mb-1">Campanha</h4>
                  <p className="text-white/90">{trafego.nome_campanha}</p>
                </div>
              )}
              {trafego.publico_alvo && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <h4 className="text-barbershop-gold font-medium">{trafego.publico_alvo.tipo ?? "Público-alvo"}</h4>
                  {trafego.publico_alvo.lista_de_clientes_target && trafego.publico_alvo.lista_de_clientes_target.length > 0 ? (
                    <DownloadListaTelefones
                      telefones={trafego.publico_alvo.lista_de_clientes_target}
                      label={`Baixar lista (${trafego.publico_alvo.lista_de_clientes_target.length} telefones)`}
                    />
                  ) : null}
                  {trafego.publico_alvo.detalhamento && (
                    <p className="text-white/70 text-sm mt-2">{trafego.publico_alvo.detalhamento}</p>
                  )}
                  {trafego.publico_alvo.sugestoes_adicionais_segmentacao && (
                    <p className="text-white/70 text-sm mt-2">{trafego.publico_alvo.sugestoes_adicionais_segmentacao}</p>
                  )}
                </div>
              )}
              {trafego.criativos?.length ? (
                <div className="space-y-3">
                  <h4 className="text-barbershop-gold font-medium">Criativos</h4>
                  {trafego.criativos.map((c, i) => (
                    <div key={i} className="rounded-lg bg-black/30 p-4 space-y-2">
                      <p className="font-medium text-white/90">{c.titulo}</p>
                      <p className="text-sm text-white/80">{c.texto}</p>
                      {c.ideia_imagem ? (
                        <p className="text-xs text-white/60 italic">{c.ideia_imagem}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {whatsapp && (
          <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-barbershop-gold" />
                Estratégia WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {whatsapp.script_resgate_vip && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <h4 className="text-barbershop-gold font-medium">Script Resgate VIP</h4>
                  {whatsapp.script_resgate_vip.para && (
                    <p className="text-white/60 text-sm">Para: {whatsapp.script_resgate_vip.para}</p>
                  )}
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{whatsapp.script_resgate_vip.mensagem}</p>
                  {whatsapp.script_resgate_vip.tom && (
                    <p className="text-white/60 text-xs">Gatilho: {whatsapp.script_resgate_vip.tom}</p>
                  )}
                  {whatsapp.script_resgate_vip.horario_disparo && (
                    <p className="text-white/60 text-xs">Horário: {whatsapp.script_resgate_vip.horario_disparo}</p>
                  )}
                </div>
              )}
              {whatsapp.script_segunda_chance && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <h4 className="text-barbershop-gold font-medium">Script Segunda Chance</h4>
                  {whatsapp.script_segunda_chance.para && (
                    <p className="text-white/60 text-sm">Para: {whatsapp.script_segunda_chance.para}</p>
                  )}
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{whatsapp.script_segunda_chance.mensagem}</p>
                  {whatsapp.script_segunda_chance.tom && (
                    <p className="text-white/60 text-xs">Gatilho: {whatsapp.script_segunda_chance.tom}</p>
                  )}
                  {whatsapp.script_segunda_chance.horario_disparo && (
                    <p className="text-white/60 text-xs">Horário: {whatsapp.script_segunda_chance.horario_disparo}</p>
                  )}
                </div>
              )}
              {whatsapp.script_fiel_sumido && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <h4 className="text-barbershop-gold font-medium">Script Fiel Sumido</h4>
                  {whatsapp.script_fiel_sumido.para && (
                    <p className="text-white/60 text-sm">Para: {whatsapp.script_fiel_sumido.para}</p>
                  )}
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{whatsapp.script_fiel_sumido.mensagem}</p>
                  {whatsapp.script_fiel_sumido.tom && (
                    <p className="text-white/60 text-xs">Gatilho: {whatsapp.script_fiel_sumido.tom}</p>
                  )}
                  {whatsapp.script_fiel_sumido.horario_disparo && (
                    <p className="text-white/60 text-xs">Horário: {whatsapp.script_fiel_sumido.horario_disparo}</p>
                  )}
                </div>
              )}
              {whatsapp.script_experimentador && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  <h4 className="text-barbershop-gold font-medium">Script Experimentador</h4>
                  {whatsapp.script_experimentador.para && (
                    <p className="text-white/60 text-sm">Para: {whatsapp.script_experimentador.para}</p>
                  )}
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{whatsapp.script_experimentador.mensagem}</p>
                  {whatsapp.script_experimentador.tom && (
                    <p className="text-white/60 text-xs">Gatilho: {whatsapp.script_experimentador.tom}</p>
                  )}
                  {whatsapp.script_experimentador.horario_disparo && (
                    <p className="text-white/60 text-xs">Horário: {whatsapp.script_experimentador.horario_disparo}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {upsell && (
          <Card className="mb-6 bg-[#28283D] border-[#3d3d5c]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-barbershop-gold" />
                Sugestão de Upsell (Balcão)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upsell.publico_alvo && (
                <p className="text-white/80 text-sm">
                  <span className="text-barbershop-gold font-medium">{upsell.publico_alvo.cluster}</span>
                  {upsell.publico_alvo.condicao && ` — ${upsell.publico_alvo.condicao}`}
                </p>
              )}
              {upsell.acao_interna && (
                <div className="rounded-lg bg-black/30 p-4 space-y-2">
                  {upsell.acao_interna.nome && (
                    <h4 className="text-barbershop-gold font-medium">{upsell.acao_interna.nome}</h4>
                  )}
                  {upsell.acao_interna.detalhes?.length ? (
                    <ul className="list-disc list-inside text-sm text-white/80 space-y-1">
                      {upsell.acao_interna.detalhes.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

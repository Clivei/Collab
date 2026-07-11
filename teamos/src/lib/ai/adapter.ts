import Anthropic from "@anthropic-ai/sdk";
import type { KpiMetricDef } from "@/lib/types";

// ── PRD §7.4: provider-agnostic adapter, server-side only ───────────

export interface KpiSuggestion {
  metric_key: string;
  label: string;
  description: string;
  target: number;
  unit: string;
  weight: number;
  rationale: string;
}

export interface KpiSuggestInput {
  roleName: string;
  roleLibrary: KpiMetricDef[];
  pastAssignments: unknown[];
  attendanceSummary: unknown;
}

export interface KpiAssistant {
  suggestMetrics(input: KpiSuggestInput): Promise<{ suggestions: KpiSuggestion[] }>;
  generateMonthlyReport(snapshot: unknown, periodLabel: string): Promise<string>;
  readonly model: string;
}

const KPI_SYSTEM_PROMPT = `Kamu adalah asisten KPI untuk manajer HR di perusahaan kecil Indonesia (NoraPadel & Gridline Digital).
Tugasmu: usulkan 4–6 metrik KPI untuk satu karyawan berdasarkan role, library metrik role tersebut, riwayat assignment, dan ringkasan absensi.

Aturan keras:
- Saranmu adalah DRAFT untuk manajer manusia — bukan keputusan. Manajer yang memilih.
- JANGAN PERNAH mengarang data performa masa lalu. Gunakan hanya data yang diberikan.
- Jika input tipis (tidak ada riwayat), usulkan metrik starter yang konservatif dari library role.
- Bobot (weight) semua saran HARUS berjumlah 100.
- Target harus realistis untuk tim kecil (~25 orang).
- Tulis label, description, dan rationale dalam Bahasa Indonesia; rationale satu kalimat.`;

const SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          metric_key: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
          target: { type: "number" },
          unit: { type: "string" },
          weight: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["metric_key", "label", "description", "target", "unit", "weight", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

const REPORT_SYSTEM_PROMPT = `Kamu menulis "Laporan Bulanan" (AI Monthly People Report) untuk owner/manager NoraPadel & Gridline Digital, berdasarkan agregat data yang diberikan.

Struktur output (markdown, Bahasa Indonesia, gunakan heading persis ini):
## 🌟 Highlights
## ⚠️ Worth a conversation
## ⏳ Deadlines
## 🧩 Team patterns
## 📋 Hygiene

Aturan keras — WAJIB dipatuhi:
- Tandai pola dan AJUKAN PERTANYAAN — JANGAN PERNAH menyimpulkan motif, karakter, atau vonis performa.
- JANGAN PERNAH merekomendasikan pemecatan atau tindakan disiplin.
- Sinyal dari satu sumber (satu rating peer, satu flag) diperlakukan sebagai lemah/noise.
- Setiap klaim HARUS mengutip angka di baliknya (contoh: "telat 8× vs rata-rata 1×").
- Jika data tipis, katakan begitu — jangan ekstrapolasi.
- Anomali dirumuskan sebagai pertanyaan ("… worth asking what changed?"), bukan tuduhan.`;

// ── Anthropic (default) ─────────────────────────────────────────────

class AnthropicAssistant implements KpiAssistant {
  private client: Anthropic;
  readonly model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  }

  async suggestMetrics(input: KpiSuggestInput): Promise<{ suggestions: KpiSuggestion[] }> {
    const ask = async (repairNote?: string) => {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.3,
        system: KPI_SYSTEM_PROMPT,
        output_config: {
          format: { type: "json_schema", schema: SUGGESTIONS_SCHEMA as unknown as Record<string, unknown> },
        },
        messages: [
          {
            role: "user",
            content:
              (repairNote ? `${repairNote}\n\n` : "") +
              `Data karyawan:\n${JSON.stringify(input, null, 2)}`,
          },
        ],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return JSON.parse(text) as { suggestions: KpiSuggestion[] };
    };

    try {
      return validateSuggestions(await ask());
    } catch (err) {
      // retry-once-with-repair (PRD §7.4)
      return validateSuggestions(
        await ask(`Output sebelumnya tidak valid (${String(err)}). Perbaiki dan keluarkan JSON valid sesuai skema.`)
      );
    }
  }

  async generateMonthlyReport(snapshot: unknown, periodLabel: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: REPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Periode: ${periodLabel}\n\nAgregat data (satu-satunya sumber kebenaran):\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}

// ── Gemini (same interface, REST) ───────────────────────────────────

class GeminiAssistant implements KpiAssistant {
  readonly model: string;
  constructor() {
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }

  private async generate(system: string, user: string, json: boolean): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.3,
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  }

  async suggestMetrics(input: KpiSuggestInput): Promise<{ suggestions: KpiSuggestion[] }> {
    const prompt = `Data karyawan:\n${JSON.stringify(input, null, 2)}\n\nKeluarkan JSON: {"suggestions":[{"metric_key","label","description","target","unit","weight","rationale"}]} (4–6 item, weight total 100).`;
    try {
      return validateSuggestions(JSON.parse(await this.generate(KPI_SYSTEM_PROMPT, prompt, true)));
    } catch (err) {
      const repaired = await this.generate(
        KPI_SYSTEM_PROMPT,
        `Output sebelumnya tidak valid (${String(err)}). ${prompt}`,
        true
      );
      return validateSuggestions(JSON.parse(repaired));
    }
  }

  async generateMonthlyReport(snapshot: unknown, periodLabel: string): Promise<string> {
    return this.generate(
      REPORT_SYSTEM_PROMPT,
      `Periode: ${periodLabel}\n\nAgregat data:\n${JSON.stringify(snapshot, null, 2)}`,
      false
    );
  }
}

function validateSuggestions(raw: { suggestions: KpiSuggestion[] }): { suggestions: KpiSuggestion[] } {
  if (!raw || !Array.isArray(raw.suggestions) || raw.suggestions.length < 1) {
    throw new Error("no suggestions array");
  }
  for (const s of raw.suggestions) {
    if (!s.metric_key || !s.label || typeof s.weight !== "number" || typeof s.target !== "number") {
      throw new Error("suggestion missing fields");
    }
  }
  return raw;
}

export function getKpiAssistant(): KpiAssistant | null {
  const provider = process.env.AI_PROVIDER || "anthropic";
  if (provider === "off") return null;
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) return null;
    return new GeminiAssistant();
  }
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new AnthropicAssistant();
}

<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Sparkles class="mr-2 h-5 w-5" /> {{ $t("providers.smart_dj.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.smart_dj.subtitle") }}
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="loading" @click="refresh">
          <RefreshCw
            class="mr-1 h-4 w-4"
            :class="{ 'animate-spin': loading }"
          />
          {{ $t("providers.smart_dj.analyze") }}
        </Button>
        <Button v-if="pendingPlan" :disabled="loading" @click="applyPlan">
          <Check class="mr-1 h-4 w-4" /> {{ $t("providers.smart_dj.apply") }}
        </Button>
        <Button :disabled="loading || !tracks.length" @click="plan">
          <WandSparkles class="mr-1 h-4 w-4" />
          {{ $t("providers.smart_dj.plan") }}
        </Button>
      </div>
    </header>

    <div
      v-if="unsupportedSource"
      class="rounded-xl border border-dashed p-5 text-sm"
    >
      {{ $t("providers.smart_dj.external_source") }}
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="mb-1 text-lg font-semibold">
          {{ $t("providers.smart_dj.mode_title") }}
        </h2>
        <p class="mb-4 text-sm text-muted-foreground">
          {{ $t("providers.smart_dj.mode_subtitle") }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm"
            >{{ $t("providers.smart_dj.mode") }}
            <select
              v-model="mode"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="ai_dj">
                {{ $t("providers.smart_dj.ai_dj") }}
              </option>
              <option value="party">
                {{ $t("providers.smart_dj.party") }}
              </option>
              <option value="chill">
                {{ $t("providers.smart_dj.chill") }}
              </option>
              <option value="workout">
                {{ $t("providers.smart_dj.workout") }}
              </option>
              <option value="custom">
                {{ $t("providers.smart_dj.custom") }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.analysis_provider") }}
            <select
              v-model="analysisProvider"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="auto">
                {{ $t("providers.smart_dj.automatic_fallback") }}
              </option>
              <option value="music_assistant">
                {{ $t("providers.smart_dj.music_assistant") }}
              </option>
              <option value="musicae">
                {{ $t("providers.smart_dj.musicae") }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.transition_bars") }}
            <select
              v-model.number="transitionBars"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option v-for="n in [4, 8, 16, 32]" :key="n" :value="n">
                {{ n }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.lookahead") }}
            <select
              v-model.number="lookahead"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option v-for="n in [1, 2, 4, 8, 16, 32]" :key="n" :value="n">
                {{ n }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.max_artist_repeat") }}
            <input
              v-model.number="maxArtistRepeat"
              type="number"
              min="1"
              max="20"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.transition_aggressiveness") }}
            <input
              v-model.number="transitionAggressiveness"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="mt-2 w-full"
            />
            <span class="text-xs text-muted-foreground"
              >{{ Math.round(transitionAggressiveness * 100) }}%</span
            >
          </label>
          <label class="flex items-center justify-between text-sm"
            ><span>{{ $t("providers.smart_dj.smart_reorder") }}</span
            ><input v-model="smartReorder" type="checkbox" class="h-4 w-4"
          /></label>
          <label class="flex items-center justify-between text-sm"
            ><span>{{ $t("providers.smart_dj.automix") }}</span
            ><input v-model="automix" type="checkbox" class="h-4 w-4"
          /></label>
          <label class="flex items-center justify-between text-sm"
            ><span>{{ $t("providers.smart_dj.preserve_variety") }}</span
            ><input v-model="preserveVariety" type="checkbox" class="h-4 w-4"
          /></label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.end_track") }}
            <select
              v-model="endTrackId"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">{{ $t("providers.smart_dj.none") }}</option>
              <option
                v-for="track in tracks"
                :key="track.queue_item_id"
                :value="track.queue_item_id"
              >
                {{ track.name }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="mb-1 text-lg font-semibold">
          {{ $t("providers.smart_dj.hard_constraints") }}
        </h2>
        <p class="mb-4 text-sm text-muted-foreground">
          {{ $t("providers.smart_dj.hard_subtitle") }}
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-sm"
            >{{ $t("providers.smart_dj.bpm_min")
            }}<input
              v-model.number="bpmMin"
              type="number"
              min="1"
              max="300"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
          /></label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.bpm_max")
            }}<input
              v-model.number="bpmMax"
              type="number"
              min="1"
              max="300"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
          /></label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.max_bpm_jump")
            }}<input
              v-model.number="maxBpmJump"
              type="number"
              min="0"
              max="100"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
          /></label>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <label class="text-sm"
            >{{ $t("providers.smart_dj.key_rule") }}
            <select
              v-model="keyRelation"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="compatible">
                {{ $t("providers.smart_dj.key_rule_compatible") }}
              </option>
              <option value="same">
                {{ $t("providers.smart_dj.key_rule_same") }}
              </option>
              <option value="any">
                {{ $t("providers.smart_dj.key_rule_any") }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.instrumental") }}
            <select
              v-model="instrumental"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="any">
                {{ $t("providers.smart_dj.instrumental_any") }}
              </option>
              <option value="prefer">
                {{ $t("providers.smart_dj.instrumental_prefer") }}
              </option>
              <option value="required">
                {{ $t("providers.smart_dj.instrumental_required") }}
              </option>
            </select>
          </label>
          <label class="text-sm"
            >{{ $t("providers.smart_dj.explicit") }}
            <select
              v-model="explicit"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="allow">
                {{ $t("providers.smart_dj.explicit_allow") }}
              </option>
              <option value="exclude">
                {{ $t("providers.smart_dj.explicit_exclude") }}
              </option>
            </select>
          </label>
        </div>
        <div class="mt-3">
          <label class="text-sm"
            >{{ $t("providers.smart_dj.bpm_tolerance") }}
            <input
              v-model.number="bpmTolerance"
              type="number"
              min="0.01"
              max="1"
              step="0.01"
              class="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-4">
        <h2 class="text-lg font-semibold">
          {{ $t("providers.smart_dj.signal_policy") }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.smart_dj.signal_subtitle") }}
        </p>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="signal in signalNames"
          :key="signal"
          class="rounded-lg border p-3"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium capitalize">{{
              signal.replace("_", " ")
            }}</span>
            <select
              v-model="signals[signal].state"
              class="rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="hard">{{ $t("providers.smart_dj.hard") }}</option>
              <option value="soft">{{ $t("providers.smart_dj.soft") }}</option>
              <option value="disabled">
                {{ $t("providers.smart_dj.disabled") }}
              </option>
            </select>
          </div>
          <input
            v-model.number="signals[signal].weight"
            :disabled="signals[signal].state !== 'soft'"
            type="range"
            min="0"
            max="3"
            step="0.1"
            class="w-full"
          />
          <div class="text-xs text-muted-foreground">
            {{ $t("providers.smart_dj.weight") }}
            {{ signals[signal].weight.toFixed(1) }}
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            {{ $t("providers.smart_dj.queue_title") }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ analyzedCount }} / {{ tracks.length }}
            {{ $t("providers.smart_dj.analyzed") }}
          </p>
        </div>
        <span v-if="pendingPlan" class="text-sm text-muted-foreground">{{
          $t("providers.smart_dj.preview_ready")
        }}</span>
      </div>
      <div v-if="tracks.length" class="space-y-2">
        <div
          v-for="(track, index) in tracks"
          :key="track.queue_item_id"
          class="grid gap-3 rounded-lg border p-3 md:grid-cols-[28px_1fr_auto]"
        >
          <div class="text-center text-sm text-muted-foreground">
            {{ index + 1 }}
          </div>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ track.name }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ track.artist }}
            </div>
            <div
              class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"
            >
              <span v-if="track.analysis?.bpm"
                >{{ formatBpm(track.analysis.bpm) }} BPM</span
              >
              <span v-if="track.analysis?.camelot">{{
                track.analysis.camelot
              }}</span>
              <span v-if="track.analysis?.energy != null"
                >{{ percent(track.analysis.energy) }} energy</span
              >
              <span v-if="track.score !== null"
                >{{ Math.round(track.score * 100) }}%</span
              >
              <span v-if="track.bpm_change != null"
                >Δ {{ track.bpm_change > 0 ? "+" : ""
                }}{{ Math.round(track.bpm_change) }} BPM</span
              >
              <span v-if="track.key_affinity != null"
                >Key {{ Math.round(track.key_affinity * 100) }}%</span
              >
              <span v-if="track.energy_delta != null"
                >Energy {{ track.energy_delta > 0 ? "+" : ""
                }}{{ Math.round(track.energy_delta * 100) }}%</span
              >
              <span v-if="track.transition_bars"
                >Blend {{ track.transition_bars }} bars</span
              >
              <span v-if="track.reasons?.length">{{
                track.reasons.join(" · ")
              }}</span>
              <span v-if="track.analysis?.source">{{
                track.analysis.source
              }}</span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <label class="flex items-center gap-1"
              ><input v-model="track.required" type="checkbox" />
              {{ $t("providers.smart_dj.required") }}</label
            >
            <label class="flex items-center gap-1"
              ><input v-model="track.fixed" type="checkbox" />
              {{ $t("providers.smart_dj.fixed") }}</label
            >
            <label class="flex items-center gap-1"
              ><input v-model="track.excluded" type="checkbox" />
              {{ $t("providers.smart_dj.excluded") }}</label
            >
          </div>
        </div>
      </div>
      <div
        v-else
        class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("providers.smart_dj.no_queue") }}
      </div>
    </div>

    <div v-if="capabilities" class="rounded-xl border bg-card p-5 shadow-sm">
      <h2 class="mb-2 text-lg font-semibold">
        {{ $t("providers.smart_dj.capabilities") }}
      </h2>
      <div class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <span
          >{{ $t("providers.smart_dj.music_assistant") }}:
          {{
            capabilities.analysis.music_assistant
              ? $t("providers.smart_dj.available")
              : $t("providers.smart_dj.unavailable_value")
          }}</span
        >
        <span
          >{{ $t("providers.smart_dj.musicae") }}:
          {{
            capabilities.analysis.musicae
              ? $t("providers.smart_dj.configured")
              : $t("providers.smart_dj.not_configured")
          }}</span
        >
        <span
          >{{ $t("providers.smart_dj.smart_fades") }}:
          {{
            capabilities.mixing.smart_fades
              ? $t("providers.smart_dj.available")
              : $t("providers.smart_dj.unavailable_value")
          }}</span
        >
        <span
          >{{ $t("providers.smart_dj.vocal_protection") }}:
          {{
            capabilities.mixing.vocal_protection
              ? $t("providers.smart_dj.available")
              : $t("providers.smart_dj.unavailable_value")
          }}</span
        >
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Check, RefreshCw, Sparkles, WandSparkles } from "@lucide/vue";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";

interface Analysis {
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  loudness: number | null;
  beats_per_bar: number | null;
  source?: string;
  instrumental?: boolean | null;
  explicit?: boolean | null;
}
interface SmartTrack {
  queue_item_id: string;
  name: string;
  artist: string;
  provider: string;
  item_id: string;
  analysis: Analysis | null;
  score: number | null;
  reasons: string[];
  bpm_change?: number | null;
  energy_delta?: number | null;
  key_affinity?: number | null;
  transition_bars?: number;
  required: boolean;
  fixed: boolean;
  excluded: boolean;
}
interface Signal {
  state: "hard" | "soft" | "disabled";
  weight: number;
}
interface SmartDjCommandResponse {
  tracks?: unknown[];
}
interface Capabilities {
  analysis: { music_assistant: boolean; musicae: boolean };
  mixing: {
    smart_fades: boolean;
    transition_planner: boolean;
    vocal_protection: boolean;
    bass_eq_management: boolean;
    tempo_planning: boolean;
  };
}

const loading = ref(false),
  pendingPlan = ref(false),
  mode = ref("ai_dj");
const bpmMin = ref<number | null>(null),
  bpmMax = ref<number | null>(null),
  maxBpmJump = ref<number | null>(null);
const bpmTolerance = ref(0.08),
  analysisProvider = ref("auto"),
  keyRelation = ref("compatible"),
  instrumental = ref("any"),
  explicit = ref("allow");
const transitionBars = ref(8),
  lookahead = ref(4),
  maxArtistRepeat = ref(1),
  transitionAggressiveness = ref(0.5);
const automix = ref(false),
  smartReorder = ref(true),
  preserveVariety = ref(true),
  endTrackId = ref("");
const tracks = ref<SmartTrack[]>([]),
  capabilities = ref<Capabilities | null>(null);
const STORAGE_KEY = "smart-dj.controls.v1";
const signalNames = [
  "bpm",
  "key",
  "energy",
  "danceability",
  "loudness",
  "genre",
  "artist_spacing",
  "momentum",
] as const;
const signals = reactive<Record<string, Signal>>(
  Object.fromEntries(
    signalNames.map((name) => [name, { state: "soft", weight: 1 }]),
  ),
);

const activePlayer = computed(() => store.activePlayer);
const activeQueue = computed(() => resolvePlayerQueue(activePlayer.value));
const unsupportedSource = computed(
  () => !!activePlayer.value?.active_source && !activeQueue.value,
);
const analyzedCount = computed(
  () => tracks.value.filter((t) => t.analysis !== null).length,
);

function formatBpm(v: number | null | undefined) {
  return v == null ? "—" : Math.round(v).toString();
}
function percent(v: number | null | undefined) {
  return v == null ? "—" : Math.round(v * 100) + "%";
}
function normalizeAnalysis(v: unknown): Analysis | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  return {
    bpm: typeof a.bpm === "number" ? a.bpm : null,
    key: typeof a.key === "string" ? a.key : null,
    camelot: typeof a.camelot === "string" ? a.camelot : null,
    energy: typeof a.energy === "number" ? a.energy : null,
    danceability: typeof a.danceability === "number" ? a.danceability : null,
    loudness: typeof a.loudness === "number" ? a.loudness : null,
    beats_per_bar: typeof a.beats_per_bar === "number" ? a.beats_per_bar : null,
    source: typeof a.source === "string" ? a.source : undefined,
    instrumental: typeof a.instrumental === "boolean" ? a.instrumental : null,
    explicit: typeof a.explicit === "boolean" ? a.explicit : null,
  };
}
function decorate(v: unknown, previous?: Map<string, SmartTrack>): SmartTrack {
  const a = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const id = String(a.queue_item_id ?? "");
  const old = previous?.get(id);
  return {
    queue_item_id: id,
    name: String(a.name ?? ""),
    artist: String(a.artist ?? ""),
    provider: String(a.provider ?? ""),
    item_id: String(a.item_id ?? ""),
    analysis: normalizeAnalysis(a.analysis),
    score: typeof a.score === "number" ? a.score : null,
    reasons: Array.isArray(a.reasons)
      ? a.reasons.filter((x): x is string => typeof x === "string")
      : [],
    required: old?.required ?? false,
    fixed: old?.fixed ?? false,
    excluded: old?.excluded ?? false,
  };
}
function buildControls(apply = false) {
  return {
    ...Object.fromEntries(signalNames.map((n) => [n, signals[n]])),
    bpm_min: bpmMin.value,
    bpm_max: bpmMax.value,
    max_bpm_jump: maxBpmJump.value,
    bpm_tolerance: bpmTolerance.value,
    analysis_provider: analysisProvider.value,
    key_relation: keyRelation.value,
    max_artist_repeat: maxArtistRepeat.value,
    instrumental: instrumental.value,
    explicit: explicit.value,
    transition_bars: transitionBars.value,
    automix_enabled: automix.value,
    smart_reorder_enabled: smartReorder.value,
    lookahead: lookahead.value,
    transition_aggressiveness: transitionAggressiveness.value,
    preserve_variety: preserveVariety.value,
    end_track_id: endTrackId.value || null,
    apply,
    required_ids: tracks.value
      .filter((t) => t.required)
      .map((t) => t.queue_item_id),
    fixed_ids: tracks.value.filter((t) => t.fixed).map((t) => t.queue_item_id),
    excluded_ids: tracks.value
      .filter((t) => t.excluded)
      .map((t) => t.queue_item_id),
  };
}
function currentQueueId(): string | null {
  return activeQueue.value?.queue_id ?? null;
}
function savePreferences() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode: mode.value,
      bpmMin: bpmMin.value,
      bpmMax: bpmMax.value,
      maxBpmJump: maxBpmJump.value,
      bpmTolerance: bpmTolerance.value,
      keyRelation: keyRelation.value,
      instrumental: instrumental.value,
      explicit: explicit.value,
      transitionBars: transitionBars.value,
      lookahead: lookahead.value,
      maxArtistRepeat: maxArtistRepeat.value,
      transitionAggressiveness: transitionAggressiveness.value,
      automix: automix.value,
      smartReorder: smartReorder.value,
      preserveVariety: preserveVariety.value,
      endTrackId: endTrackId.value,
      signals: JSON.parse(JSON.stringify(signals)),
    }),
  );
}
function restorePreferences() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}",
    ) as Record<string, unknown>;
    for (const [key, setter] of Object.entries({
      mode: (v: unknown) => (mode.value = String(v)),
      analysisProvider: (v: unknown) =>
        (analysisProvider.value = [
          "auto",
          "music_assistant",
          "musicae",
        ].includes(String(v))
          ? String(v)
          : "auto"),
      bpmMin: (v: unknown) => (bpmMin.value = typeof v === "number" ? v : null),
      bpmMax: (v: unknown) => (bpmMax.value = typeof v === "number" ? v : null),
      maxBpmJump: (v: unknown) =>
        (maxBpmJump.value = typeof v === "number" ? v : null),
      bpmTolerance: (v: unknown) =>
        (bpmTolerance.value = typeof v === "number" ? v : 0.08),
      keyRelation: (v: unknown) => (keyRelation.value = String(v)),
      instrumental: (v: unknown) => (instrumental.value = String(v)),
      explicit: (v: unknown) => (explicit.value = String(v)),
      transitionBars: (v: unknown) => (transitionBars.value = Number(v) || 8),
      lookahead: (v: unknown) => (lookahead.value = Number(v) || 4),
      maxArtistRepeat: (v: unknown) =>
        (maxArtistRepeat.value = Math.max(1, Number(v) || 1)),
      transitionAggressiveness: (v: unknown) =>
        (transitionAggressiveness.value = Number(v) || 0.5),
      automix: (v: unknown) => (automix.value = Boolean(v)),
      smartReorder: (v: unknown) => (smartReorder.value = v !== false),
      preserveVariety: (v: unknown) => (preserveVariety.value = v !== false),
      endTrackId: (v: unknown) => (endTrackId.value = String(v || "")),
    })) {
      if (key in saved) setter(saved[key]);
    }
    const savedSignals = saved.signals as Record<string, Signal> | undefined;
    if (savedSignals)
      for (const name of signalNames)
        if (savedSignals[name]) signals[name] = savedSignals[name];
  } catch {
    /* ignore malformed local preferences */
  }
}
async function refresh() {
  const queueId = currentQueueId();
  if (!queueId) {
    tracks.value = [];
    pendingPlan.value = false;
    return;
  }
  loading.value = true;
  try {
    const previous = new Map(tracks.value.map((t) => [t.queue_item_id, t]));
    const result = await api.sendCommand<SmartDjCommandResponse>(
      "smart_dj/analyze",
      { queue_id: queueId, limit: 40 },
    );
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : [])
      .slice(1)
      .map((x) => decorate(x, previous));
    const status = await api.sendCommand<Capabilities>(
      "smart_dj/capabilities",
      {},
    );
    capabilities.value = status;
    pendingPlan.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}
async function plan() {
  const queueId = currentQueueId();
  if (!queueId || !tracks.value.length) return;
  loading.value = true;
  try {
    const result = await api.sendCommand<SmartDjCommandResponse>(
      "smart_dj/rank_queue",
      {
        queue_id: queueId,
        bpm_tolerance: bpmTolerance.value,
        mode: mode.value,
        prefer_keys: keyRelation.value !== "any",
        preserve_variety: preserveVariety.value,
        controls: buildControls(false),
      },
    );
    const previous = new Map(tracks.value.map((t) => [t.queue_item_id, t]));
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).map(
      (x) => decorate(x, previous),
    );
    pendingPlan.value = true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}
async function applyPlan() {
  const queueId = currentQueueId();
  if (!queueId || !pendingPlan.value) return;
  loading.value = true;
  try {
    const result = await api.sendCommand<SmartDjCommandResponse>(
      "smart_dj/rank_queue",
      {
        queue_id: queueId,
        bpm_tolerance: bpmTolerance.value,
        mode: mode.value,
        prefer_keys: keyRelation.value !== "any",
        preserve_variety: preserveVariety.value,
        controls: buildControls(true),
      },
    );
    const previous = new Map(tracks.value.map((t) => [t.queue_item_id, t]));
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).map(
      (x) => decorate(x, previous),
    );
    pendingPlan.value = false;
    toast.success($t("providers.smart_dj.applied"));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}
watch(
  () => [
    store.activePlayerId,
    activeQueue.value?.queue_id,
    activeQueue.value?.current_index,
  ],
  () => {
    void refresh();
  },
);
onMounted(() => {
  restorePreferences();
  void refresh();
});
watch(
  () => [
    mode.value,
    analysisProvider.value,
    bpmMin.value,
    bpmMax.value,
    maxBpmJump.value,
    bpmTolerance.value,
    keyRelation.value,
    instrumental.value,
    explicit.value,
    transitionBars.value,
    lookahead.value,
    maxArtistRepeat.value,
    transitionAggressiveness.value,
    automix.value,
    smartReorder.value,
    preserveVariety.value,
    endTrackId.value,
    ...signalNames.flatMap((name) => [
      signals[name].state,
      signals[name].weight,
    ]),
  ],
  savePreferences,
  { deep: true },
);
onUnmounted(() => {
  pendingPlan.value = false;
});
</script>

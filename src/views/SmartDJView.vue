<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="inline-flex items-center text-2xl font-semibold tracking-tight">
          <Sparkles class="mr-2 h-5 w-5" /> Smart DJ
        </h1>
        <p class="text-sm text-muted-foreground">
          Fully user-controlled queue intelligence and transition planning.
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="loading" @click="refresh">
          <RefreshCw class="mr-1 h-4 w-4" :class="{ 'animate-spin': loading }" /> Analyze
        </Button>
        <Button :disabled="loading || !tracks.length || !smartReorder" @click="optimize">
          <WandSparkles class="mr-1 h-4 w-4" /> Smart Queue
        </Button>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="mb-1 text-lg font-semibold">Operating mode</h2>
        <p class="mb-4 text-sm text-muted-foreground">Modes are presets; your explicit controls remain authoritative.</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm">DJ mode
            <select v-model="mode" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option value="ai_dj">AI DJ</option><option value="party">Party</option>
              <option value="chill">Chill</option><option value="workout">Workout</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label class="text-sm">Transition bars
            <select v-model.number="transitionBars" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option :value="4">4</option><option :value="8">8</option><option :value="16">16</option><option :value="32">32</option>
            </select>
          </label>
          <label class="text-sm">Look-ahead
            <select v-model.number="lookahead" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option v-for="n in [1,2,4,8,16,32]" :key="n" :value="n">{{ n }} tracks</option>
            </select>
          </label>
          <label class="text-sm">Max artist repeat
            <input v-model.number="maxArtistRepeat" type="number" min="0" max="20" class="mt-1 w-full rounded-md border bg-background px-3 py-2" />
          </label>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="flex items-center justify-between text-sm"><span>Smart Reorder</span><input v-model="smartReorder" type="checkbox" class="h-4 w-4" /></label>
          <label class="flex items-center justify-between text-sm"><span>AutoMix independently</span><input v-model="automix" type="checkbox" class="h-4 w-4" /></label>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="mb-1 text-lg font-semibold">Hard constraints</h2>
        <p class="mb-4 text-sm text-muted-foreground">Hard rules are never violated. Impossible requirements are reported.</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-sm">BPM minimum<input v-model.number="bpmMin" type="number" min="1" max="300" class="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
          <label class="text-sm">BPM maximum<input v-model.number="bpmMax" type="number" min="1" max="300" class="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
          <label class="text-sm">Max BPM jump<input v-model.number="maxBpmJump" type="number" min="0" max="100" class="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <label class="text-sm">Key rule
            <select v-model="keyRelation" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option value="compatible">Compatible</option><option value="same">Same key</option><option value="any">Any key</option>
            </select>
          </label>
          <label class="text-sm">Instrumental
            <select v-model="instrumental" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option value="any">Any</option><option value="prefer">Prefer</option><option value="required">Required</option>
            </select>
          </label>
          <label class="text-sm">Explicit content
            <select v-model="explicit" class="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option value="allow">Allow</option><option value="exclude">Exclude</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-4">
        <h2 class="text-lg font-semibold">Signal policy</h2>
        <p class="text-sm text-muted-foreground">Every signal is explicitly Hard, Soft, or Disabled.</p>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div v-for="signal in signalNames" :key="signal" class="rounded-lg border p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium capitalize">{{ signal.replace("_", " ") }}</span>
            <select v-model="signals[signal].state" class="rounded border bg-background px-2 py-1 text-xs">
              <option value="hard">Hard</option><option value="soft">Soft</option><option value="disabled">Disabled</option>
            </select>
          </div>
          <input v-model.number="signals[signal].weight" :disabled="signals[signal].state !== 'soft'" type="range" min="0" max="3" step="0.1" class="w-full" />
          <div class="text-xs text-muted-foreground">Soft weight: {{ signals[signal].weight.toFixed(1) }}</div>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Smart Queue</h2>
          <p class="text-sm text-muted-foreground">{{ analyzedCount }} of {{ tracks.length }} tracks analyzed</p>
        </div>
        <span v-if="optimized" class="text-sm text-muted-foreground">Queue optimized</span>
      </div>
      <div v-if="tracks.length" class="space-y-2">
        <div v-for="(track, index) in tracks" :key="track.queue_item_id" class="grid gap-3 rounded-lg border p-3 md:grid-cols-[28px_1fr_auto]">
          <div class="text-center text-sm text-muted-foreground">{{ index + 1 }}</div>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ track.name }}</div>
            <div class="truncate text-xs text-muted-foreground">{{ track.artist }}</div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span v-if="track.analysis?.bpm">{{ formatBpm(track.analysis.bpm) }} BPM</span>
              <span v-if="track.analysis?.camelot">{{ track.analysis.camelot }}</span>
              <span v-if="track.analysis?.energy != null">{{ percent(track.analysis.energy) }} energy</span>
              <span v-if="track.score !== null">{{ Math.round(track.score * 100) }}%</span>
              <span v-if="track.reasons?.length">{{ track.reasons.join(" · ") }}</span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <label class="flex items-center gap-1"><input v-model="track.required" type="checkbox" /> Required</label>
            <label class="flex items-center gap-1"><input v-model="track.fixed" type="checkbox" /> Fixed</label>
            <label class="flex items-center gap-1"><input v-model="track.excluded" type="checkbox" /> Excluded</label>
          </div>
        </div>
      </div>
      <div v-else class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No upcoming queue items found.</div>
    </div>

    <div v-if="capabilities" class="rounded-xl border bg-card p-5 shadow-sm">
      <h2 class="mb-2 text-lg font-semibold">Installed plugin capabilities</h2>
      <div class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <span>MA analysis: {{ capabilities.analysis.music_assistant ? "available" : "unavailable" }}</span>
        <span>Musicae: {{ capabilities.analysis.musicae ? "configured" : "not configured" }}</span>
        <span>Smart Fades: {{ capabilities.mixing.smart_fades ? "available" : "unavailable" }}</span>
        <span>Vocal protection: {{ capabilities.mixing.vocal_protection ? "available" : "unavailable" }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import { Sparkles, RefreshCw, WandSparkles } from "@lucide/vue";
import { computed, onMounted, reactive, ref } from "vue";
import { toast } from "vue-sonner";

interface Analysis {
  bpm: number | null; key: string | null; camelot: string | null; energy: number | null;
  danceability: number | null; loudness: number | null; beats_per_bar: number | null;
}
interface SmartTrack {
  queue_item_id: string; name: string; artist: string; provider: string; item_id: string;
  analysis: Analysis | null; score: number | null; reasons?: string[];
  required: boolean; fixed: boolean; excluded: boolean;
}
interface Signal { state: "hard" | "soft" | "disabled"; weight: number; }
interface Capabilities {
  analysis: { music_assistant: boolean; musicae: boolean };
  mixing: { smart_fades: boolean; transition_planner: boolean; vocal_protection: boolean; bass_eq_management: boolean; tempo_planning: boolean };
}

const loading = ref(false), optimized = ref(false), mode = ref("ai_dj");
const bpmMin = ref<number | null>(null), bpmMax = ref<number | null>(null), maxBpmJump = ref<number | null>(null);
const keyRelation = ref("compatible"), instrumental = ref("any"), explicit = ref("allow");
const transitionBars = ref(8), lookahead = ref(4), maxArtistRepeat = ref(1);
const automix = ref(false), smartReorder = ref(true), tracks = ref<SmartTrack[]>([]);
const currentAnalysis = ref<Analysis | null>(null), capabilities = ref<Capabilities | null>(null);
const signalNames = ["bpm","key","energy","danceability","loudness","genre","artist_spacing","momentum"] as const;
const signals = reactive<Record<string, Signal>>(Object.fromEntries(signalNames.map((name) => [name, { state: "soft", weight: 1 }])));
const activePlayer = computed(() => Object.values(api.players).find((p) => p.playback_state === "playing" && p.active_source));
const analyzedCount = computed(() => tracks.value.filter((t) => t.analysis !== null).length);

function formatBpm(v: number | null | undefined) { return v == null ? "—" : Math.round(v).toString(); }
function percent(v: number | null | undefined) { return v == null ? "—" : Math.round(v * 100) + "%"; }
function normalizeAnalysis(v: any): Analysis | null {
  if (!v) return null;
  return { bpm: v.bpm ?? null, key: v.key ?? null, camelot: v.camelot ?? null, energy: v.energy ?? null,
    danceability: v.danceability ?? null, loudness: v.loudness ?? v.loudness_integrated ?? null,
    beats_per_bar: v.beats_per_bar ?? v.time_signature ?? null };
}
function decorate(v: any): SmartTrack {
  return { queue_item_id: v.queue_item_id, name: v.name, artist: v.artist || "", provider: v.provider,
    item_id: v.item_id, analysis: normalizeAnalysis(v.analysis), score: typeof v.score === "number" ? v.score : null,
    reasons: Array.isArray(v.reasons) ? v.reasons : [], required: false, fixed: false, excluded: false };
}
function controls() {
  return {
    ...Object.fromEntries(signalNames.map((n) => [n, signals[n]])),
    bpm_min: bpmMin.value, bpm_max: bpmMax.value, max_bpm_jump: maxBpmJump.value, key_relation: keyRelation.value,
    max_artist_repeat: maxArtistRepeat.value, instrumental: instrumental.value, explicit: explicit.value,
    transition_bars: transitionBars.value, automix_enabled: automix.value, smart_reorder_enabled: smartReorder.value,
    lookahead: lookahead.value,
    required_ids: tracks.value.filter((t) => t.required).map((t) => t.queue_item_id),
    fixed_ids: tracks.value.filter((t) => t.fixed).map((t) => t.queue_item_id),
    excluded_ids: tracks.value.filter((t) => t.excluded).map((t) => t.queue_item_id),
  };
}
async function refresh() {
  const player = activePlayer.value;
  if (!player?.active_source) { tracks.value = []; currentAnalysis.value = null; return; }
  loading.value = true;
  try {
    const result = await api.sendCommand("smart_dj/analyze", { queue_id: player.active_source, limit: 40 });
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).slice(1).map(decorate);
    currentAnalysis.value = normalizeAnalysis(result?.current);
    const status = await api.sendCommand("smart_dj/capabilities", {});
    capabilities.value = status;
  } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  finally { loading.value = false; }
}
async function optimize() {
  const player = activePlayer.value;
  if (!player?.active_source || !tracks.value.length) return;
  loading.value = true;
  try {
    const result = await api.sendCommand("smart_dj/rank_queue", {
      queue_id: player.active_source, bpm_tolerance: 0.08, mode: mode.value,
      prefer_keys: keyRelation.value !== "any", preserve_variety: true, controls: controls(),
    });
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).map(decorate);
    optimized.value = true;
  } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  finally { loading.value = false; }
}
onMounted(refresh);
</script>

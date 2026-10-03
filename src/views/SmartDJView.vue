<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="inline-flex items-center text-2xl font-semibold tracking-tight">
          <Sparkles class="mr-2 h-5 w-5" />
          Smart DJ
        </h1>
        <p class="text-sm text-muted-foreground">
          BPM- and key-aware queue intelligence for your Music Assistant system.
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="loading" @click="refresh">
          <RefreshCw class="mr-1 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Analyze
        </Button>
        <Button :disabled="loading || !tracks.length" @click="optimize">
          <WandSparkles class="mr-1 h-4 w-4" />
          Smart Queue
        </Button>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Now Playing</h2>
            <p class="text-sm text-muted-foreground">{{ playerName }}</p>
          </div>
          <div v-if="currentAnalysis" class="text-right">
            <div class="text-2xl font-semibold">{{ formatBpm(currentAnalysis.bpm) }}</div>
            <div class="text-xs text-muted-foreground">BPM</div>
          </div>
        </div>

        <div v-if="currentTrack" class="space-y-4">
          <div>
            <div class="text-xl font-semibold">{{ currentTrack.name }}</div>
            <div class="text-muted-foreground">{{ currentTrack.artist }}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-lg border p-3"><div class="text-xs text-muted-foreground">BPM</div><div class="mt-1 font-semibold">{{ formatBpm(currentAnalysis?.bpm) }}</div></div>
            <div class="rounded-lg border p-3"><div class="text-xs text-muted-foreground">Key</div><div class="mt-1 font-semibold">{{ currentAnalysis?.key || "—" }}</div></div>
            <div class="rounded-lg border p-3"><div class="text-xs text-muted-foreground">Camelot</div><div class="mt-1 font-semibold">{{ currentAnalysis?.camelot || "—" }}</div></div>
            <div class="rounded-lg border p-3"><div class="text-xs text-muted-foreground">Energy</div><div class="mt-1 font-semibold">{{ percent(currentAnalysis?.energy) }}</div></div>
          </div>
        </div>
        <div v-else class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Start playback in Music Assistant to give Smart DJ a queue to work with.
        </div>
      </div>

      <div class="rounded-xl border bg-card p-5 shadow-sm">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">Mix Controls</h2>
          <p class="text-sm text-muted-foreground">Tune how aggressively the queue follows the current track.</p>
        </div>
        <div class="space-y-5">
          <label class="block">
            <div class="mb-2 flex justify-between text-sm">
              <span>BPM tolerance</span><span class="font-medium">±{{ bpmTolerance }}%</span>
            </div>
            <input v-model.number="bpmTolerance" type="range" min="2" max="20" step="1" class="w-full" />
          </label>
          <label class="block text-sm"><div class="mb-2">DJ mode</div><select v-model="mode" class="w-full rounded-md border bg-background px-3 py-2"><option value="ai_dj">AI DJ</option><option value="party">Party</option><option value="chill">Chill</option><option value="workout">Workout</option><option value="custom">Custom</option></select></label>
          <label class="flex items-center justify-between gap-4 text-sm">
            <span>Prefer compatible keys</span>
            <input v-model="preferKeys" type="checkbox" class="h-4 w-4" />
          </label>
          <label class="flex items-center justify-between gap-4 text-sm">
            <span>Preserve upcoming variety</span>
            <input v-model="preserveVariety" type="checkbox" class="h-4 w-4" />
          </label>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Smart Queue</h2>
          <p class="text-sm text-muted-foreground">
            {{ analyzedCount }} of {{ tracks.length }} upcoming tracks analyzed
          </p>
        </div>
        <span v-if="optimized" class="text-sm text-muted-foreground">Queue optimized</span>
      </div>

      <div v-if="tracks.length" class="space-y-2">
        <div
          v-for="(track, index) in tracks"
          :key="track.queue_item_id"
          class="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg border p-3"
        >
          <div class="text-center text-sm text-muted-foreground">{{ index + 1 }}</div>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ track.name }}</div>
            <div class="truncate text-xs text-muted-foreground">{{ track.artist }}</div>
          </div>
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span v-if="track.analysis?.bpm">{{ formatBpm(track.analysis.bpm) }} BPM</span>
            <span v-if="track.analysis?.camelot">{{ track.analysis.camelot }}</span>
            <span v-if="track.analysis?.energy != null">{{ percent(track.analysis.energy) }} energy</span>
            <span v-if="track.score !== null">{{ track.reasons?.join(" · ") }}</span>
            <span
              v-if="track.score !== null"
              class="rounded-full border px-2 py-1 font-medium text-foreground"
            >
              {{ Math.round(track.score * 100) }}%
            </span>
          </div>
        </div>
      </div>
      <div v-else class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No upcoming queue items found.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import { Sparkles, RefreshCw, WandSparkles } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

interface Analysis {
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  loudness: number | null;
  beats_per_bar: number | null;
}
interface SmartTrack {
  queue_item_id: string;
  name: string;
  artist: string;
  provider: string;
  item_id: string;
  analysis: Analysis | null;
  score: number | null;
  reasons?: string[];
}

const loading = ref(false);
const tracks = ref<SmartTrack[]>([]);
const currentAnalysis = ref<Analysis | null>(null);
const bpmTolerance = ref(8);
const preferKeys = ref(true);
const preserveVariety = ref(true);
const mode = ref("ai_dj");
const optimized = ref(false);

const activePlayer = computed(() =>
  Object.values(api.players).find(
    (player) => player.playback_state === "playing" && player.active_source,
  ),
);
const playerName = computed(() => activePlayer.value?.name || "No active player");
const currentTrack = computed(() => {
  const media = activePlayer.value?.current_media;
  return media
    ? { name: media.title || "Unknown track", artist: media.artist || media.album_artist || "Unknown artist" }
    : null;
});
const analyzedCount = computed(() => tracks.value.filter((track) => track.analysis !== null).length);

function formatBpm(bpm: number | null | undefined) {
  return bpm == null ? "—" : Math.round(bpm).toString();
}
function percent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}
function normalizeAnalysis(value: any): Analysis | null {
  if (!value) return null;
  return {
    bpm: value.bpm ?? null,
    key: value.key ? (value.mode ? `${value.key} ${value.mode}` : value.key) : null,
    camelot: value.camelot ?? null,
    energy: value.energy ?? null,
    danceability: value.danceability ?? null,
    loudness: value.loudness ?? value.loudness_integrated ?? null,
    beats_per_bar: value.beats_per_bar ?? value.time_signature ?? null,
  };
}

async function refresh() {
  const player = activePlayer.value;
  if (!player?.active_source) {
    tracks.value = [];
    currentAnalysis.value = null;
    return;
  }
  loading.value = true;
  optimized.value = false;
  try {
    const result = await api.sendCommand("smart_dj/analyze", {
      queue_id: player.active_source,
      limit: 40,
    });
    const analyzed = Array.isArray(result?.tracks) ? result.tracks : [];
    tracks.value = analyzed.slice(1).map((track: any) => ({
      queue_item_id: track.queue_item_id,
      name: track.name,
      artist: track.artist || "",
      provider: track.provider,
      item_id: track.item_id,
      analysis: normalizeAnalysis(track.analysis),
      score: null,
      reasons: [],
    }));
    currentAnalysis.value = normalizeAnalysis(result?.current);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}

async function optimize() {
  const player = activePlayer.value;
  if (!player?.active_source || tracks.value.length < 1) return;
  loading.value = true;
  try {
    const result = await api.sendCommand("smart_dj/rank_queue", {
      queue_id: player.active_source,
      bpm_tolerance: bpmTolerance.value / 100,
      mode: mode.value,
      prefer_keys: preferKeys.value,
      preserve_variety: preserveVariety.value,
    });
    const ranked = Array.isArray(result?.tracks) ? result.tracks : [];
    tracks.value = ranked.map((track: any) => ({
      queue_item_id: track.queue_item_id,
      name: track.name,
      artist: track.artist || "",
      provider: track.provider,
      item_id: track.item_id,
      analysis: normalizeAnalysis(track.analysis),
      score: typeof track.score === "number" ? track.score : null,
      reasons: Array.isArray(track.reasons) ? track.reasons : [],
    }));
    optimized.value = true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>

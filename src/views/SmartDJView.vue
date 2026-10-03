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
            <Metric label="BPM" :value="formatBpm(currentAnalysis?.bpm)" />
            <Metric label="Key" :value="currentAnalysis?.key || '—'" />
            <Metric label="Camelot" :value="currentAnalysis?.camelot || '—'" />
            <Metric label="Match" :value="currentAnalysis ? 'Analyzed' : 'Pending'" />
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
import type { QueueItem, Track } from "@/plugins/api/interfaces";
import { Sparkles, RefreshCw, WandSparkles } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

interface Analysis {
  bpm: number | null;
  key: string | null;
  camelot: string | null;
}

interface SmartTrack {
  queue_item_id: string;
  name: string;
  artist: string;
  provider: string;
  item_id: string;
  album_uri?: string | null;
  analysis: Analysis | null;
  score: number | null;
}

const Metric = (props: { label: string; value: string }) => ({
  props,
  template:
    '<div class="rounded-lg border p-3"><div class="text-xs text-muted-foreground">{{ label }}</div><div class="mt-1 font-semibold">{{ value }}</div></div>',
});

const loading = ref(false);
const tracks = ref<SmartTrack[]>([]);
const currentAnalysis = ref<Analysis | null>(null);
const bpmTolerance = ref(8);
const preferKeys = ref(true);
const preserveVariety = ref(true);
const optimized = ref(false);

const activePlayer = computed(() =>
  Object.values(api.players).find(
    (player) => player.playback_state === "playing" && player.active_source,
  ),
);

const playerName = computed(() => activePlayer.value?.name || "No active player");

const currentTrack = computed(() => {
  const media = activePlayer.value?.current_media;
  if (!media) return null;
  return {
    name: media.title || "Unknown track",
    artist: media.artist || media.album_artist || "Unknown artist",
  };
});

const analyzedCount = computed(
  () => tracks.value.filter((track) => track.analysis !== null).length,
);

function formatBpm(bpm: number | null | undefined) {
  return bpm == null ? "—" : Math.round(bpm).toString();
}

function camelotForKey(key: string | null, mode: string | null = null): string | null {
  if (!key) return null;
  const normalized = key.replace("♯", "#").replace("♭", "b").trim();
  const minor =
    mode === "minor" ||
    normalized.toLowerCase().endsWith("m") ||
    normalized.toLowerCase().includes("minor");
  const clean = normalized.replace(/m$/i, "").replace(/\s*(major|minor)$/i, "");
  const major: Record<string, number> = {
    B: 1, "F#": 2, "Gb": 2, "C#": 3, Db: 3, "G#": 4, Ab: 4,
    "D#": 5, Eb: 5, A: 6, E: 7, B: 8, "F#": 9, Gb: 9, C: 12, F: 11,
    G: 9, D: 10, "A#": 6, Bb: 6,
  };
  const minorMap: Record<string, number> = {
    "G#": 1, Ab: 1, "D#": 2, Eb: 2, A: 3, E: 4, B: 5, "F#": 6, Gb: 6,
    "C#": 7, Db: 7, "G#": 8, Ab: 8, "D#": 9, Eb: 9, Bb: 10, F: 11, C: 12,
    G: 1, D: 2,
  };
  const number = (minor ? minorMap : major)[clean];
  return number ? `${number}${minor ? "A" : "B"}` : null;
}

function keyCompatible(a: string | null, b: string | null) {
  if (!a || !b) return false;
  if (a === b) return true;
  const an = Number(a.slice(0, -1));
  const bn = Number(b.slice(0, -1));
  const am = a.endsWith("A");
  const bm = b.endsWith("A");
  return an === bn || (an === bn && am !== bm) || ((an - bn + 12) % 12 === 1 && am === bm) || ((bn - an + 12) % 12 === 1 && am === bm);
}

function scoreTrack(analysis: Analysis | null) {
  if (!analysis || !currentAnalysis.value) return null;
  const current = currentAnalysis.value;
  let score = 0.5;
  if (analysis.bpm != null && current.bpm != null) {
    const delta = Math.abs(analysis.bpm - current.bpm) / Math.max(current.bpm, 1);
    score += Math.max(0, 0.35 * (1 - delta / (bpmTolerance.value / 100)));
  }
  if (preferKeys.value && keyCompatible(analysis.camelot, current.camelot)) score += 0.15;
  return Math.min(1, score);
}

async function loadAnalysis(item: QueueItem): Promise<Analysis | null> {
  const media = item.media_item as Record<string, unknown> | null;
  const itemId = String(media?.item_id || "");
  const provider = String(media?.provider || "");
  if (!itemId || !provider) return null;
  try {
    const track = (await api.getTrack(itemId, provider)) as Track;
    const metadata = track.audio_metadata;
    if (!metadata) return null;
    return {
      bpm: metadata.bpm ?? null,
      key: metadata.musical_key ?? null,
      camelot: camelotForKey(metadata.musical_key),
    };
  } catch {
    return null;
  }
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
    const queueItems = await api.getPlayerQueueItems(player.active_source, 40, 0);
    const currentItemId = api.queues[player.active_source]?.current_item;
    const upcoming = queueItems.filter((item) => item.queue_item_id !== currentItemId).slice(0, 20);
    const loaded = await Promise.all(
      upcoming.map(async (item) => {
        const analysis = await loadAnalysis(item);
        return {
          queue_item_id: item.queue_item_id,
          name: item.name,
          artist: item.media_item?.artists?.[0]?.name || "",
          provider: String((item.media_item as Record<string, unknown> | null)?.provider || ""),
          item_id: String((item.media_item as Record<string, unknown> | null)?.item_id || ""),
          album_uri: null,
          analysis,
          score: scoreTrack(analysis),
        };
      }),
    );
    tracks.value = loaded;
    const current = queueItems.find((item) => item.queue_item_id === currentItemId);
    currentAnalysis.value = current ? await loadAnalysis(current) : null;
    tracks.value = tracks.value.map((track) => ({ ...track, score: scoreTrack(track.analysis) }));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}

async function optimize() {
  const player = activePlayer.value;
  if (!player?.active_source || tracks.value.length < 2) return;
  loading.value = true;
  try {
    const ordered = [...tracks.value].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    // Move in ranked order so each selected item is placed after the remaining
    // unprocessed items, preserving the player-owned head of the queue.
    for (const track of ordered) {
      await api.sendCommand("player_queues/move_item_end", {
        queue_id: player.active_source,
        queue_item_id: track.queue_item_id,
      });
    }
    optimized.value = true;
    await refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>

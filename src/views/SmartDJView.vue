<template>
  <section class="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <Sparkles class="h-6 w-6" aria-hidden="true" />
          <h1 class="text-2xl font-semibold tracking-tight">Smart DJ</h1>
          <span
            class="rounded-full border px-2 py-0.5 text-xs"
            :class="status?.configured ? 'border-emerald-500/50 text-emerald-600' : 'border-amber-500/50 text-amber-600'"
          >
            {{ status?.configured ? "Analysis ready" : "Local analysis only" }}
          </span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          Plan a mix, inspect every decision, then apply it to the upcoming queue.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="refresh">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Analyze queue
        </Button>
        <Button variant="outline" :disabled="loading || !tracks.length || !smartReorder" @click="plan">
          <WandSparkles class="mr-2 h-4 w-4" />
          Build plan
        </Button>
        <Button :disabled="loading || !pendingPlan || !smartReorder" @click="applyPlan">
          <Check class="mr-2 h-4 w-4" />
          Apply plan
        </Button>
      </div>
    </header>

    <div
      v-if="unsupportedSource"
      class="rounded-xl border border-dashed p-4 text-sm"
      role="status"
    >
      The active source is not a Music Assistant queue. Select a local MA queue to analyze and reorder it.
    </div>

    <div
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-xl border border-destructive/50 p-4 text-sm"
      role="alert"
    >
      <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-1">{{ errorMessage }}</div>
      <Button size="sm" variant="outline" @click="errorMessage = ''">Dismiss</Button>
    </div>

    <!-- Phase 1: a quick-glance workstation. -->
    <div class="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">Live queue</h2>
            <p class="text-sm text-muted-foreground">
              {{ tracks.length }} upcoming track(s) · {{ analyzedCount }} analyzed
              <template v-if="optimizedWindow > 0 && queueItemCount > 0 && optimizedWindow < queueItemCount">
                · window {{ optimizedWindow }} of {{ queueItemCount }}
              </template>
            </p>
          </div>
          <span v-if="pendingPlan" class="rounded-full border px-2 py-1 text-xs">
            Plan ready — not applied
          </span>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="min-w-0 rounded-lg border p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Now playing
            </p>
            <template v-if="currentTrack">
              <p class="truncate font-medium">{{ currentTrack.name || "Unknown track" }}</p>
              <p class="truncate text-sm text-muted-foreground">{{ currentTrack.artist || "Unknown artist" }}</p>
              <div class="mt-3 flex flex-wrap gap-2 text-xs">
                <span class="rounded border px-2 py-1">{{ bpmLabel(currentTrack.analysis?.bpm) }} BPM</span>
                <span v-if="currentTrack.analysis?.camelot" class="rounded border px-2 py-1">
                  {{ currentTrack.analysis.camelot }}
                </span>
                <span v-if="currentTrack.analysis?.energy != null" class="rounded border px-2 py-1">
                  Energy {{ pct(currentTrack.analysis.energy) }}
                </span>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground">
              Analyze a queue to load the current track.
            </p>
          </div>

          <div class="min-w-0 rounded-lg border p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Up next
            </p>
            <template v-if="tracks[0]">
              <p class="truncate font-medium">{{ tracks[0].name || "Unknown track" }}</p>
              <p class="truncate text-sm text-muted-foreground">{{ tracks[0].artist || "Unknown artist" }}</p>
              <div class="mt-3 flex flex-wrap gap-2 text-xs">
                <span class="rounded border px-2 py-1">{{ bpmLabel(tracks[0].analysis?.bpm) }} BPM</span>
                <span v-if="tracks[0].analysis?.camelot" class="rounded border px-2 py-1">
                  {{ tracks[0].analysis.camelot }}
                </span>
                <span v-if="tracks[0].score != null" class="rounded border px-2 py-1">
                  {{ Math.round(tracks[0].score * 100) }}% match
                </span>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground">
              No upcoming track loaded.
            </p>
          </div>
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block font-medium">DJ mode</span>
            <select v-model="mode" class="w-full rounded-md border bg-background px-3 py-2">
              <option value="ai_dj">AI DJ — balanced compatibility</option>
              <option value="party">Party — energy and danceability</option>
              <option value="chill">Chill — gentler progression</option>
              <option value="workout">Workout — tempo consistency</option>
              <option value="custom">Custom — use my signal weights</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium">Analysis source</span>
            <select v-model="analysisProvider" class="w-full rounded-md border bg-background px-3 py-2">
              <option value="auto">Automatic — Music Assistant first</option>
              <option value="music_assistant">Music Assistant only</option>
              <option value="musicae">Musicae</option>
            </select>
          </label>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span class="block font-medium">Smart Reorder</span>
              <span class="text-xs text-muted-foreground">Choose the best upcoming order</span>
            </span>
            <input v-model="smartReorder" type="checkbox" class="h-4 w-4" />
          </label>
          <div class="rounded-lg border p-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">AutoMix execution</span>
              <span class="rounded-full border px-2 py-0.5 text-xs">
                {{ autoMixAvailable ? "Available" : "Backend unavailable" }}
              </span>
            </div>
            <label class="mt-2 flex items-center justify-between gap-3">
              <span class="text-xs text-muted-foreground">Enable actual transitions</span>
              <input
                v-model="automix"
                type="checkbox"
                class="h-4 w-4"
                :disabled="!autoMixAvailable"
                :title="autoMixAvailable ? 'Enable supported AutoMix' : 'The current server does not execute Smart DJ transitions'"
              />
            </label>
            <p v-if="!autoMixAvailable" class="mt-2 text-xs text-muted-foreground">
              Current server can plan queue order, but does not execute Smart DJ transitions. Native player crossfade is separate.
            </p>
            <button
              type="button"
              class="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              :disabled="loading || completingMix"
              title="Ask Musicae for compatible tracks and append them to complete the mix"
              @click="completeMix()"
            >
              {{ completingMix ? "Completing…" : "Complete mix (add 5 tracks)" }}
            </button>
          </div>
        </div>
      </section>

      <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
        <div class="mb-4 flex items-center gap-2">
          <SlidersHorizontal class="h-5 w-5" />
          <h2 class="text-lg font-semibold">Mix behavior</h2>
        </div>

        <div class="space-y-4">
          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Transition length</span>
              <span class="text-muted-foreground">{{ transitionBars }} bars</span>
            </span>
            <select v-model.number="transitionBars" class="mt-2 w-full rounded-md border bg-background px-3 py-2">
              <option :value="4">4 bars — quick blend</option>
              <option :value="8">8 bars — standard</option>
              <option :value="16">16 bars — extended</option>
              <option :value="32">32 bars — long blend</option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">Blend style</span>
            <select v-model="transitionStyle" class="mt-2 w-full rounded-md border bg-background px-3 py-2">
              <option value="auto">Auto — engine decides</option>
              <option value="full_blend">Full blend — long beat-matched mix</option>
              <option value="energy">Energy — medium blend</option>
              <option value="quick_cut">Quick cut — short downbeat fade</option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">Beat matching</span>
            <select v-model="beatStrictness" class="mt-2 w-full rounded-md border bg-background px-3 py-2">
              <option value="strict">Strict — only near-identical tempo (±6%)</option>
              <option value="normal">Normal — engine default (±8%)</option>
              <option value="aggressive">Aggressive — stretch further (±12%)</option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Lookahead</span>
              <span class="text-muted-foreground">{{ lookahead }} ahead · beam {{ Math.min(96, Math.max(4, lookahead * 3)) }}</span>
            </span>
            <input v-model.number="lookahead" type="range" min="1" max="96" step="1" class="mt-2 w-full" />
            <span class="mt-1 block text-xs text-muted-foreground">Search width is lookahead × 3, capped at 96 tracks — a value of 32 already searches the full 96.</span>
          </label>

          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Transition aggressiveness</span>
              <span class="text-muted-foreground">{{ Math.round(transitionAggressiveness * 100) }}%</span>
            </span>
            <input v-model.number="transitionAggressiveness" type="range" min="0" max="1" step="0.05" class="mt-2 w-full" />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">Maximum consecutive tracks per artist</span>
            <input v-model.number="maxArtistRepeat" type="number" min="1" max="20" class="w-full rounded-md border bg-background px-3 py-2" />
          </label>

          <label class="flex items-center justify-between gap-3 text-sm">
            <span>
              <span class="block font-medium">Preserve variety</span>
              <span class="text-xs text-muted-foreground">Avoid repetitive artist/genre runs</span>
            </span>
            <input v-model="preserveVariety" type="checkbox" class="h-4 w-4" />
          </label>
        </div>
      </section>
    </div>

    <!-- Phase 3: planned trajectory, using only known analysis values. -->
    <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Energy journey</h2>
          <p class="text-sm text-muted-foreground">
            Actual analyzed energy for the current queue order or proposed plan.
          </p>
        </div>
        <span class="text-xs text-muted-foreground">
          {{ energyPoints.length }} / {{ tracks.length }} tracks have energy data
        </span>
      </div>
      <div v-if="energyPoints.length" class="grid grid-cols-8 items-end gap-2 rounded-lg border p-3 sm:grid-cols-12 lg:grid-cols-12">
        <div
          v-for="point in energyPoints"
          :key="point.id"
          class="group flex min-w-0 flex-col items-center gap-1"
          :title="`${point.name}: ${pct(point.energy)}`"
        >
          <div class="flex h-28 w-full items-end rounded bg-muted/50 p-0.5">
            <div
              class="w-full rounded-sm bg-primary/80 transition-[height] duration-300"
              :style="{ height: `${Math.max(4, point.energy * 100)}%` }"
            ></div>
          </div>
          <span class="w-full truncate text-center text-[10px] text-muted-foreground">
            {{ point.index + 1 }}
          </span>
        </div>
      </div>
      <p v-else class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        Energy analysis is not available for the current queue. Run Analyze queue or configure a supported analysis provider.
      </p>
      <div class="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
        <Activity class="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The current engine scores energy compatibility but does not return a generated energy target curve. This chart shows measured track energy, not a prediction.
        </p>
      </div>
    </section>

    <!-- Phase 2: explainable queue and user-enforced constraints. -->
    <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Intelligent queue</h2>
          <p class="text-sm text-muted-foreground">
            Pin tracks, exclude tracks, and inspect the engine's reasons before applying.
          </p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded border px-2 py-1">Required: {{ requiredCount }}</span>
          <span class="rounded border px-2 py-1">Fixed: {{ fixedCount }}</span>
          <span class="rounded border px-2 py-1">Excluded: {{ excludedCount }}</span>
        </div>
      </div>

      <div v-if="tracks.length" class="space-y-3">
        <article
          v-for="(track, index) in tracks"
          :key="track.queue_item_id"
          class="rounded-lg border p-3"
          :class="{ 'border-primary/60 bg-primary/5': track.fixed, 'opacity-60': track.excluded }"
        >
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div class="flex min-w-0 flex-1 gap-3">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">
                {{ index + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate font-medium">{{ track.name || "Unknown track" }}</h3>
                  <span v-if="track.fixed" class="rounded border px-2 py-0.5 text-[10px]">Fixed position</span>
                  <span v-if="track.required" class="rounded border px-2 py-0.5 text-[10px]">Required</span>
                  <span v-if="track.excluded" class="rounded border border-destructive/50 px-2 py-0.5 text-[10px] text-destructive">Excluded</span>
                </div>
                <p class="truncate text-sm text-muted-foreground">{{ track.artist || "Unknown artist" }}</p>

                <div class="mt-2 flex flex-wrap gap-2 text-xs">
                  <span v-if="track.analysis?.bpm != null" class="rounded bg-muted px-2 py-1">{{ bpmLabel(track.analysis.bpm) }} BPM</span>
                  <span v-if="track.analysis?.camelot" class="rounded bg-muted px-2 py-1">{{ track.analysis.camelot }}</span>
                  <span v-if="track.analysis?.energy != null" class="rounded bg-muted px-2 py-1">Energy {{ pct(track.analysis.energy) }}</span>
                  <span v-if="track.analysis?.danceability != null" class="rounded bg-muted px-2 py-1">Dance {{ pct(track.analysis.danceability) }}</span>
                  <span v-if="track.analysis?.loudness != null" class="rounded bg-muted px-2 py-1">Loudness {{ track.analysis.loudness.toFixed(1) }} dB</span>
                  <span v-if="track.clap_similarity != null" class="rounded bg-muted px-2 py-1">Sonic {{ pct(track.clap_similarity) }}</span>
                  <span v-if="track.bpm_change != null" class="rounded bg-muted px-2 py-1">Δ {{ signed(track.bpm_change) }} BPM</span>
                  <span v-if="track.key_affinity != null" class="rounded bg-muted px-2 py-1">Key {{ pct(track.key_affinity) }}</span>
                  <span v-if="track.energy_delta != null" class="rounded bg-muted px-2 py-1">Energy Δ {{ signed(track.energy_delta * 100) }}%</span>
                  <span v-if="track.score != null" class="rounded border border-primary/40 px-2 py-1 font-semibold">{{ Math.round(track.score * 100) }} / 100 match</span>
                  <span v-if="track.analysis?.source" class="rounded border px-2 py-1">Source: {{ track.analysis.source }}</span>
                </div>

                <div v-if="track.reasons.length" class="mt-2 text-sm text-muted-foreground">
                  <span class="font-medium text-foreground">Why selected:</span>
                  {{ track.reasons.join(" · ") }}
                </div>
                <p v-else class="mt-2 text-xs text-muted-foreground">
                  No ranking explanation returned yet. Build a plan to request scores and reasons.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-[390px] lg:grid-cols-2">
              <label class="flex items-center gap-2 rounded-md border p-2">
                <input v-model="track.required" type="checkbox" class="h-4 w-4" @change="onConstraintChange" />
                Required
              </label>
              <label class="flex items-center gap-2 rounded-md border p-2">
                <input v-model="track.fixed" type="checkbox" class="h-4 w-4" @change="onConstraintChange" />
                Fixed position
              </label>
              <label class="flex items-center gap-2 rounded-md border p-2">
                <input v-model="track.excluded" type="checkbox" class="h-4 w-4" @change="onConstraintChange" />
                Exclude
              </label>
              <label class="flex flex-col gap-1 rounded-md border p-2">
                <span>Transition into track</span>
                <select
                  :value="track.transition_override ?? ''"
                  class="w-full rounded border bg-background px-2 py-1"
                  @change="setTransitionOverride(track, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Auto ({{ transitionBars }} bars)</option>
                  <option value="0">Hard cut</option>
                  <option value="4">4 bars</option>
                  <option value="8">8 bars</option>
                  <option value="16">16 bars</option>
                  <option value="32">32 bars</option>
                </select>
              </label>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="rounded-lg border border-dashed p-8 text-center">
        <Music2 class="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p class="font-medium">No upcoming tracks loaded</p>
        <p class="mt-1 text-sm text-muted-foreground">Select a Music Assistant queue and run Analyze queue.</p>
      </div>
    </section>

    <!-- Phase 4: advanced tuning and actual API diagnostics. -->
    <details class="rounded-xl border bg-card shadow-sm">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5">
        <div class="flex items-center gap-2">
          <Settings2 class="h-5 w-5" />
          <div>
            <h2 class="font-semibold">Advanced controls & diagnostics</h2>
            <p class="text-sm text-muted-foreground">Scoring rules, hard constraints, provider health</p>
          </div>
        </div>
        <ChevronDown class="h-4 w-4 shrink-0" />
      </summary>

      <div class="space-y-5 border-t p-4 md:p-5">
        <div>
          <h3 class="mb-3 font-medium">Hard constraints</h3>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label class="text-sm">
              <span class="mb-1 block">Minimum BPM</span>
              <input v-model.number="bpmMin" type="number" min="1" max="300" placeholder="No minimum" class="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Maximum BPM</span>
              <input v-model.number="bpmMax" type="number" min="1" max="300" placeholder="No maximum" class="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Maximum BPM jump</span>
              <input v-model.number="maxBpmJump" type="number" min="0" max="100" placeholder="No limit" class="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">BPM tolerance (0.01–1)</span>
              <input v-model.number="bpmTolerance" type="number" min="0.01" max="1" step="0.01" class="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Key relationship</span>
              <select v-model="keyRelation" class="w-full rounded-md border bg-background px-3 py-2">
                <option value="compatible">Harmonically compatible</option>
                <option value="same">Same key only</option>
                <option value="soft">Prefer key (soft)</option>
                <option value="any">Ignore key</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Instrumental preference</span>
              <select v-model="instrumental" class="w-full rounded-md border bg-background px-3 py-2">
                <option value="any">Any</option>
                <option value="prefer">Prefer instrumental</option>
                <option value="required">Require instrumental</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Explicit content</span>
              <select v-model="explicit" class="w-full rounded-md border bg-background px-3 py-2">
                <option value="allow">Allow</option>
                <option value="exclude">Exclude explicit / unknown</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">End track</span>
              <select v-model="endTrackId" class="w-full rounded-md border bg-background px-3 py-2">
                <option value="">No fixed ending</option>
                <option v-for="track in tracks" :key="track.queue_item_id" :value="track.queue_item_id">
                  {{ track.name }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <h3 class="mb-1 font-medium">Signal policy</h3>
          <p class="mb-3 text-sm text-muted-foreground">
            Hard rejects candidates, Soft influences ranking, Disabled removes the signal from scoring.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="signalName in signalNames" :key="signalName" class="rounded-lg border p-3">
              <div class="flex items-center justify-between gap-2">
                <label class="font-medium capitalize" :for="`signal-${signalName}`">{{ signalLabel(signalName) }}</label>
                <select
                  :id="`signal-${signalName}`"
                  v-model="signals[signalName].state"
                  class="rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option value="hard">Hard</option>
                  <option value="soft">Soft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <label class="mt-3 block text-xs text-muted-foreground">
                Weight: {{ signals[signalName].weight.toFixed(1) }}
                <input
                  v-model.number="signals[signalName].weight"
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  class="mt-2 w-full"
                  :disabled="signals[signalName].state !== 'soft'"
                />
              </label>
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border p-3">
            <h3 class="mb-3 font-medium">Server capabilities</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Music Assistant analysis</dt>
                <dd>{{ capabilities?.analysis.music_assistant ? "Available" : "Unavailable" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Musicae configured</dt>
                <dd>{{ capabilities?.analysis.musicae ? "Yes" : "No" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Smart Fades reported</dt>
                <dd>{{ capabilities?.mixing.smart_fades ? "Reported" : "Unavailable" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Transition planner</dt>
                <dd>{{ capabilities?.mixing.transition_planner ? "Available" : "Not implemented on server" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Vocal protection</dt>
                <dd>{{ capabilities?.mixing.vocal_protection ? "Reported" : "Unavailable" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Bass EQ management</dt>
                <dd>{{ capabilities?.mixing.bass_eq_management ? "Reported" : "Unavailable" }}</dd>
              </div>
            </dl>
          </div>
          <div class="rounded-lg border p-3">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="font-medium">Provider status</h3>
              <Button size="sm" variant="outline" :disabled="diagnosticsLoading" @click="loadDiagnostics">
                <RefreshCw class="mr-1 h-3.5 w-3.5" :class="{ 'animate-spin': diagnosticsLoading }" />
                Refresh
              </Button>
            </div>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Musicae configured</dt>
                <dd>{{ status?.configured ? "Yes" : "No" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Cached tracks</dt>
                <dd>{{ status?.cached_tracks ?? "Unknown" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Analysis host</dt>
                <dd class="max-w-[60%] break-all text-right">{{ status?.musicae_host ?? "Unknown" }}</dd>
              </div>
            </dl>
            <p class="mt-3 text-xs text-muted-foreground">
              Credentials are never displayed here. Configure the Musicae key in the Smart DJ provider settings.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="loading" @click="resetPreferences">
            <RotateCcw class="mr-2 h-4 w-4" />
            Reset local controls
          </Button>
          <Button variant="outline" :disabled="loading" @click="saveNow">
            <Save class="mr-2 h-4 w-4" />
            Save controls on this browser
          </Button>
        </div>
      </div>
    </details>

    <div class="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>Queue changes are not made until Apply plan is pressed. Applying calls rank_queue again with the saved controls, so a changing queue may produce a different order than the preview. Enable Smart Reorder to build or apply a ranked plan.</span>
      <span>{{ pendingPlan ? "A plan is waiting for approval." : "No unapplied plan." }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  Activity,
  Check,
  ChevronDown,
  CircleAlert,
  Music2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "@lucide/vue";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";

type SignalState = "hard" | "soft" | "disabled";
type SignalName =
  | "bpm"
  | "key"
  | "energy"
  | "danceability"
  | "loudness"
  | "genre"
  | "artist_spacing"
  | "momentum"
  | "clap";

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
  bpm_change: number | null;
  energy_delta: number | null;
  key_affinity: number | null;
  transition_bars: number | null;
  clap_similarity: number | null;
  transition_override: number | null;
  required: boolean;
  fixed: boolean;
  excluded: boolean;
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
interface ProviderStatus {
  configured: boolean;
  musicae_host: string;
  cached_tracks: number;
}
interface ApiResponse {
  queue_id?: string;
  current_item_id?: string;
  current?: Analysis | null;
  tracks?: unknown[];
  applied?: boolean;
  queue_changed?: boolean;
  automix_applied?: boolean;
  reason?: string;
  optimized_window?: number;
  queue_item_count?: number;
  playlist_total?: number;
  truncated?: boolean;
  analysis_failed?: number;
  analysis_rate_limited?: number;
  degraded?: boolean;
}
interface SignalControl {
  state: SignalState;
  weight: number;
}
type RawObject = Record<string, unknown>;

// Keep v1 aligned with the injected server menu (ui.js loadSavedControls).
// Moving this view to v2 would orphan saved preferences, including transition bars.
// The existing v1 signals shape is compatible; newer fields restore with safe defaults.
const STORAGE_KEY = "smart-dj.controls.v1";
const loading = ref(false);
const diagnosticsLoading = ref(false);
const pendingPlan = ref(false);
const errorMessage = ref("");
const mode = ref("ai_dj");
const analysisProvider = ref("auto");
const bpmMin = ref<number | null>(null);
const bpmMax = ref<number | null>(null);
const maxBpmJump = ref<number | null>(null);
const bpmTolerance = ref(0.08);
const keyRelation = ref("compatible");
const instrumental = ref("any");
const explicit = ref("allow");
const transitionBars = ref(8);
const lookahead = ref(8);
// Blend style + beat-match strictness feed the smart-fades planner through the
// AutoMix pins (a blend INTO a track reads that track's pinned preferences).
const transitionStyle = ref("auto");
const completingMix = ref(false);
const beatStrictness = ref("normal");
const maxArtistRepeat = ref(1);
const transitionAggressiveness = ref(0.5);
const automix = ref(false);
const smartReorder = ref(true);
const preserveVariety = ref(true);
const endTrackId = ref("");
const currentTrack = ref<SmartTrack | null>(null);
const tracks = ref<SmartTrack[]>([]);
const capabilities = ref<Capabilities | null>(null);
const status = ref<ProviderStatus | null>(null);
const optimizedWindow = ref(0);
const queueItemCount = ref(0);
const transitionOverrides = ref<Record<string, number>>({});
const trackFlags = ref<Record<string, { required: boolean; fixed: boolean; excluded: boolean }>>({});
let refreshGeneration = 0;
let plannedControls: RawObject | null = null;

const signalNames: SignalName[] = [
  "bpm",
  "key",
  "energy",
  "danceability",
  "loudness",
  "genre",
  "artist_spacing",
  "momentum",
  "clap",
];
const signals = reactive<Record<SignalName, SignalControl>>({
  bpm: { state: "soft", weight: 1 },
  key: { state: "soft", weight: 1 },
  energy: { state: "soft", weight: 1 },
  danceability: { state: "soft", weight: 1 },
  loudness: { state: "soft", weight: 1 },
  genre: { state: "soft", weight: 1 },
  artist_spacing: { state: "soft", weight: 1 },
  momentum: { state: "soft", weight: 1 },
  clap: { state: "soft", weight: 1 },
});

const activePlayer = computed(() => store.activePlayer);
const activeQueue = computed(() => resolvePlayerQueue(activePlayer.value));
const unsupportedSource = computed(
  () => !!activePlayer.value?.active_source && !activeQueue.value,
);
const analyzedCount = computed(
  () => [currentTrack.value, ...tracks.value].filter((t) => t?.analysis !== null && t?.analysis != null).length,
);
const requiredCount = computed(() => tracks.value.filter((t) => t.required).length);
const fixedCount = computed(() => tracks.value.filter((t) => t.fixed).length);
const excludedCount = computed(() => tracks.value.filter((t) => t.excluded).length);
const autoMixAvailable = computed(
  () => capabilities.value?.mixing.transition_planner === true,
);
const energyPoints = computed(() =>
  tracks.value
    .map((track, index) => ({
      id: track.queue_item_id,
      name: track.name,
      energy: track.analysis?.energy,
      index,
    }))
    .filter((point): point is { id: string; name: string; energy: number; index: number } =>
      typeof point.energy === "number" && Number.isFinite(point.energy),
  ),
);

function bpmLabel(value: number | null | undefined): string {
  return value == null ? "—" : String(Math.round(value));
}
function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${Math.round(value * 100)}%`;
}
function signed(value: number): string {
  const n = Math.round(value * 10) / 10;
  return `${n > 0 ? "+" : ""}${n}`;
}
function signalLabel(name: SignalName): string {
  return name.replaceAll("_", " ");
}
function normalizeAnalysis(value: unknown): Analysis | null {
  if (!value || typeof value !== "object") return null;
  const a = value as RawObject;
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
function decorate(value: unknown, previous?: Map<string, SmartTrack>): SmartTrack {
  const a = (value && typeof value === "object" ? value : {}) as RawObject;
  const id = String(a.queue_item_id ?? "");
  const old = previous?.get(id);
  const nested = normalizeAnalysis(a.analysis);
  // rank_queue may return flattened analysis fields; normalize both response shapes.
  const flattened = normalizeAnalysis(a);
  const analysis = nested ?? (
    flattened && [
      flattened.bpm, flattened.key, flattened.camelot, flattened.energy,
      flattened.danceability, flattened.loudness,
    ].some((v) => v !== null)
      ? flattened
      : null
  );
  return {
    queue_item_id: id,
    name: String(a.name ?? ""),
    artist: String(a.artist ?? ""),
    provider: String(a.provider ?? ""),
    item_id: String(a.item_id ?? ""),
    analysis,
    score: typeof a.score === "number" ? a.score : null,
    reasons: Array.isArray(a.reasons)
      ? a.reasons.filter((reason): reason is string => typeof reason === "string")
      : [],
    bpm_change: typeof a.bpm_change === "number" ? a.bpm_change : null,
    energy_delta: typeof a.energy_delta === "number" ? a.energy_delta : null,
    key_affinity: typeof a.key_affinity === "number" ? a.key_affinity : null,
    transition_bars: typeof a.transition_bars === "number" ? a.transition_bars : null,
    clap_similarity: typeof a.clap_similarity === "number" ? a.clap_similarity : null,
    transition_override: old?.transition_override ?? transitionOverrides.value[id] ?? null,
    required: old?.required ?? trackFlags.value[id]?.required ?? Boolean(a.required),
    fixed: old?.fixed ?? trackFlags.value[id]?.fixed ?? Boolean(a.fixed),
    excluded: old?.excluded ?? trackFlags.value[id]?.excluded ?? Boolean(a.excluded),
  };
}
function currentQueueId(): string | null {
  return activeQueue.value?.queue_id ?? null;
}
function buildControls(apply = false): RawObject {
  const controls: RawObject = {
    ...Object.fromEntries(signalNames.map((name) => [name, { ...signals[name] }])),
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
    transition_bars_overrides: { ...transitionOverrides.value },
    // Never send "enabled" when the server explicitly says execution is unavailable.
    automix_enabled: autoMixAvailable.value && automix.value,
    smart_reorder_enabled: smartReorder.value,
    lookahead: lookahead.value,
    transition_style: transitionStyle.value,
    beat_strictness: beatStrictness.value,
    transition_aggressiveness: transitionAggressiveness.value,
    preserve_variety: preserveVariety.value,
    end_track_id: endTrackId.value || null,
    apply,
    required_ids: tracks.value.filter((track) => track.required).map((track) => track.queue_item_id),
    fixed_ids: tracks.value.filter((track) => track.fixed).map((track) => track.queue_item_id),
    excluded_ids: tracks.value.filter((track) => track.excluded).map((track) => track.queue_item_id),
  };
  return controls;
}
function savePreferences(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: mode.value,
      analysisProvider: analysisProvider.value,
      bpmMin: bpmMin.value,
      bpmMax: bpmMax.value,
      maxBpmJump: maxBpmJump.value,
      bpmTolerance: bpmTolerance.value,
      keyRelation: keyRelation.value,
      instrumental: instrumental.value,
      explicit: explicit.value,
      transitionBars: transitionBars.value,
      lookahead: lookahead.value,
      transitionStyle: transitionStyle.value,
      beatStrictness: beatStrictness.value,
      maxArtistRepeat: maxArtistRepeat.value,
      transitionAggressiveness: transitionAggressiveness.value,
      automix: automix.value,
      smartReorder: smartReorder.value,
      preserveVariety: preserveVariety.value,
      endTrackId: endTrackId.value,
      transitionOverrides: transitionOverrides.value,
      trackFlags: Object.fromEntries(tracks.value.map((track) => [track.queue_item_id, { required: track.required, fixed: track.fixed, excluded: track.excluded }])),
      signals: JSON.parse(JSON.stringify(signals)),
    }));
  } catch (error) {
    toast.error(`Could not save Smart DJ controls: ${String(error)}`);
  }
}
function restorePreferences(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as RawObject;
    if (typeof saved.mode === "string" && ["ai_dj", "party", "chill", "workout", "custom"].includes(saved.mode)) mode.value = saved.mode;
    if (typeof saved.analysisProvider === "string" && ["auto", "music_assistant", "musicae"].includes(saved.analysisProvider)) analysisProvider.value = saved.analysisProvider;
    if (typeof saved.bpmMin === "number" || saved.bpmMin === null) bpmMin.value = saved.bpmMin as number | null;
    if (typeof saved.bpmMax === "number" || saved.bpmMax === null) bpmMax.value = saved.bpmMax as number | null;
    if (typeof saved.maxBpmJump === "number" || saved.maxBpmJump === null) maxBpmJump.value = saved.maxBpmJump as number | null;
    if (typeof saved.bpmTolerance === "number") bpmTolerance.value = clamp(saved.bpmTolerance, 0.01, 1);
    if (typeof saved.keyRelation === "string" && ["compatible", "same", "soft", "any"].includes(saved.keyRelation)) keyRelation.value = saved.keyRelation;
    if (typeof saved.instrumental === "string" && ["any", "prefer", "required"].includes(saved.instrumental)) instrumental.value = saved.instrumental;
    if (typeof saved.explicit === "string" && ["allow", "exclude"].includes(saved.explicit)) explicit.value = saved.explicit;
    if (typeof saved.transitionBars === "number" && [4, 8, 16, 32].includes(saved.transitionBars)) transitionBars.value = saved.transitionBars;
    if (typeof saved.lookahead === "number") lookahead.value = Math.round(clamp(saved.lookahead, 1, 96));
    if (typeof saved.transitionStyle === "string" && ["auto", "full_blend", "energy", "quick_cut"].includes(saved.transitionStyle)) transitionStyle.value = saved.transitionStyle;
    if (typeof saved.beatStrictness === "string" && ["strict", "normal", "aggressive"].includes(saved.beatStrictness)) beatStrictness.value = saved.beatStrictness;
    if (typeof saved.maxArtistRepeat === "number") maxArtistRepeat.value = Math.round(clamp(saved.maxArtistRepeat, 1, 20));
    if (typeof saved.transitionAggressiveness === "number") transitionAggressiveness.value = clamp(saved.transitionAggressiveness, 0, 1);
    if (typeof saved.automix === "boolean") automix.value = saved.automix;
    if (typeof saved.smartReorder === "boolean") smartReorder.value = saved.smartReorder;
    if (typeof saved.preserveVariety === "boolean") preserveVariety.value = saved.preserveVariety;
    if (typeof saved.endTrackId === "string") endTrackId.value = saved.endTrackId;
    if (saved.trackFlags && typeof saved.trackFlags === "object" && !Array.isArray(saved.trackFlags)) {
      for (const [id, raw] of Object.entries(saved.trackFlags as RawObject)) {
        if (!raw || typeof raw !== "object") continue;
        const flag = raw as RawObject;
        trackFlags.value[id] = { required: Boolean(flag.required), fixed: Boolean(flag.fixed), excluded: Boolean(flag.excluded) };
      }
    }
    if (saved.transitionOverrides && typeof saved.transitionOverrides === "object" && !Array.isArray(saved.transitionOverrides)) {
      for (const [id, raw] of Object.entries(saved.transitionOverrides as RawObject)) {
        const n = Number(raw);
        if ([0, 4, 8, 16, 32].includes(n)) transitionOverrides.value[id] = n;
      }
    }
    if (saved.signals && typeof saved.signals === "object") {
      const stored = saved.signals as RawObject;
      for (const name of signalNames) {
        const raw = stored[name];
        if (!raw || typeof raw !== "object") continue;
        const signal = raw as RawObject;
        const state = signal.state;
        const weight = signal.weight;
        if (state === "hard" || state === "soft" || state === "disabled") signals[name].state = state;
        if (typeof weight === "number" && Number.isFinite(weight)) signals[name].weight = clamp(weight, 0, 3);
      }
    }
  } catch {
    // Ignore a malformed browser preference and continue with safe defaults.
  }
}
async function completeMix(): Promise<void> {
  const queueId = currentQueueId();
  if (!queueId) return;
  completingMix.value = true;
  errorMessage.value = "";
  try {
    await api.sendCommand<ApiResponse>("smart_dj/complete_mix", {
      queue_id: queueId,
      count: 5,
    });
    await refresh();
    toast.success("Complete mix: 5 compatible tracks appended from Musicae.");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    toast.error(`Complete mix failed: ${errorMessage.value}`);
  } finally {
    completingMix.value = false;
  }
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function onConstraintChange(): void {
  trackFlags.value = Object.fromEntries(tracks.value.map((track) => [track.queue_item_id, { required: track.required, fixed: track.fixed, excluded: track.excluded }]));
  pendingPlan.value = false;
  plannedControls = null;
  savePreferences();
}
function setTransitionOverride(track: SmartTrack, raw: string): void {
  if (raw === "") {
    track.transition_override = null;
    delete transitionOverrides.value[track.queue_item_id];
  } else {
    const value = Number(raw);
    if (![0, 4, 8, 16, 32].includes(value)) return;
    track.transition_override = value;
    transitionOverrides.value[track.queue_item_id] = value;
  }
  pendingPlan.value = false;
  plannedControls = null;
  savePreferences();
}
function saveNow(): void {
  savePreferences();
  toast.success("Smart DJ controls saved in this browser.");
}
function resetPreferences(): void {
  localStorage.removeItem(STORAGE_KEY);
  mode.value = "ai_dj";
  analysisProvider.value = "auto";
  bpmMin.value = null;
  bpmMax.value = null;
  maxBpmJump.value = null;
  bpmTolerance.value = 0.08;
  keyRelation.value = "compatible";
  instrumental.value = "any";
  explicit.value = "allow";
  transitionBars.value = 8;
  lookahead.value = 8;
  transitionStyle.value = "auto";
  beatStrictness.value = "normal";
  maxArtistRepeat.value = 1;
  transitionAggressiveness.value = 0.5;
  automix.value = false;
  smartReorder.value = true;
  preserveVariety.value = true;
  endTrackId.value = "";
  transitionOverrides.value = {};
  trackFlags.value = {};
  for (const track of tracks.value) {
    track.required = false;
    track.fixed = false;
    track.excluded = false;
    track.transition_override = null;
  }
  for (const name of signalNames) signals[name] = { state: "soft", weight: 1 };
  pendingPlan.value = false;
  plannedControls = null;
  toast.success("Smart DJ controls reset.");
}
async function loadDiagnostics(): Promise<void> {
  diagnosticsLoading.value = true;
  try {
    const [caps, providerStatus] = await Promise.all([
      api.sendCommand<Capabilities>("smart_dj/capabilities", {}),
      api.sendCommand<ProviderStatus>("smart_dj/status", {}),
    ]);
    capabilities.value = caps;
    status.value = providerStatus;
    if (!autoMixAvailable.value) automix.value = false;
  } catch (error) {
    errorMessage.value = `Could not load Smart DJ diagnostics: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    diagnosticsLoading.value = false;
  }
}
async function refresh(): Promise<void> {
  const generation = ++refreshGeneration;
  const queueId = currentQueueId();
  errorMessage.value = "";
  if (!queueId) {
    currentTrack.value = null;
    tracks.value = [];
    pendingPlan.value = false;
    plannedControls = null;
    return;
  }
  loading.value = true;
  try {
    const result = await api.sendCommand<ApiResponse>("smart_dj/analyze", {
      queue_id: queueId,
      limit: 40,
      analysis_provider: analysisProvider.value,
    });
    if (generation !== refreshGeneration) return;
    const oldById = new Map([...tracks.value, ...(currentTrack.value ? [currentTrack.value] : [])].map((track) => [track.queue_item_id, track]));
    const all = (Array.isArray(result?.tracks) ? result.tracks : []).map((item) => decorate(item, oldById));
    currentTrack.value = all[0] ?? null;
    tracks.value = all.slice(1);
    pendingPlan.value = false;
    plannedControls = null;
    if (typeof result?.optimized_window === 'number') optimizedWindow.value = result.optimized_window;
    if (typeof result?.queue_item_count === 'number') queueItemCount.value = result.queue_item_count;
    await loadDiagnostics();
  } catch (error) {
    if (generation === refreshGeneration) errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (generation === refreshGeneration) loading.value = false;
  }
}
async function plan(): Promise<void> {
  const queueId = currentQueueId();
  if (!queueId || !tracks.value.length) return;
  if (bpmMin.value != null && bpmMax.value != null && bpmMin.value > bpmMax.value) {
    errorMessage.value = "Minimum BPM cannot be greater than maximum BPM.";
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    const controls = buildControls(false);
    const result = await api.sendCommand<ApiResponse>("smart_dj/rank_queue", {
      queue_id: queueId,
      bpm_tolerance: bpmTolerance.value,
      mode: mode.value,
      prefer_keys: keyRelation.value !== "any",
      preserve_variety: preserveVariety.value,
      controls,
    });
    const previousTracks = [...tracks.value];
    const oldById = new Map(previousTracks.map((track) => [track.queue_item_id, track]));
    const ranked = (Array.isArray(result?.tracks) ? result.tracks : []).map((item) => decorate(item, oldById));
    const rankedIds = new Set(ranked.map((track) => track.queue_item_id));
    // The optimizer omits excluded tracks by design. Keep those rows visible at
    // the end of the preview so users can reverse an exclusion before applying.
    const excludedNotReturned = previousTracks.filter(
      (track) => track.excluded && !rankedIds.has(track.queue_item_id),
    );
    tracks.value = [...ranked, ...excludedNotReturned];
    plannedControls = controls;
    pendingPlan.value = true;
    savePreferences();
    toast.success("Plan ready. Review it before applying.");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}
async function applyPlan(): Promise<void> {
  const queueId = currentQueueId();
  if (!queueId || !pendingPlan.value || !plannedControls) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const controls = { ...plannedControls, apply: true };
    const result = await api.sendCommand<ApiResponse>("smart_dj/rank_queue", {
      queue_id: queueId,
      bpm_tolerance: bpmTolerance.value,
      mode: mode.value,
      prefer_keys: keyRelation.value !== "any",
      preserve_variety: preserveVariety.value,
      controls,
    });
    const oldById = new Map(tracks.value.map((track) => [track.queue_item_id, track]));
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).map((item) => decorate(item, oldById));
    pendingPlan.value = false;
    plannedControls = null;
    if (result?.applied === false) {
      const why = result?.reason ? result.reason.replaceAll("_", " ") : "reorder was not applied";
      toast.info(`Queue unchanged — ${why}.`);
    } else if (result?.queue_changed === true) {
      toast.success("Smart DJ queue order applied.");
    } else if (result?.automix_applied === true) {
      toast.success("AutoMix crossfades applied; queue order unchanged.");
    } else {
      // applied missing (pre-0.0.20 server) or true without confirmation — report what we know
      toast.info("Request sent — verify the queue order.");
    }
    await refresh();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}
watch(
  () => [
    mode.value, analysisProvider.value, bpmMin.value, bpmMax.value, maxBpmJump.value,
    bpmTolerance.value, keyRelation.value, instrumental.value, explicit.value,
    transitionBars.value, lookahead.value, maxArtistRepeat.value,
    transitionAggressiveness.value, automix.value, smartReorder.value,
    preserveVariety.value, endTrackId.value,
    ...signalNames.flatMap((name) => [signals[name].state, signals[name].weight]),
  ],
  () => {
    if (pendingPlan.value) {
      pendingPlan.value = false;
      plannedControls = null;
    }
    savePreferences();
  },
);
watch(
  () => [store.activePlayerId, activeQueue.value?.queue_id, activeQueue.value?.current_index],
  () => void refresh(),
);
onMounted(() => {
  restorePreferences();
  void refresh();
});
onUnmounted(() => {
  refreshGeneration++;
  pendingPlan.value = false;
  plannedControls = null;
});
</script>

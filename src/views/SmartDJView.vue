<template>
  <section class="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
    <header
      class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <div class="flex items-center gap-2">
          <Sparkles class="h-6 w-6" aria-hidden="true" />
          <h1 class="text-2xl font-semibold tracking-tight">Smart DJ</h1>
          <Badge
            :variant="status?.configured ? 'default' : 'outline'"
            class="rounded-full"
          >
            {{ status?.configured ? "Analysis ready" : "Local analysis only" }}
          </Badge>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          Plan a mix, inspect every decision, then apply it to the upcoming
          queue.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="refresh">
          <RefreshCw
            class="mr-2 h-4 w-4"
            :class="{ 'animate-spin': loading }"
          />
          Analyze queue
        </Button>
        <Button
          variant="outline"
          :disabled="loading || !tracks.length || !smartReorder"
          @click="plan"
        >
          <WandSparkles class="mr-2 h-4 w-4" />
          Build plan
        </Button>
        <Button
          :disabled="loading || !pendingPlan || !smartReorder"
          @click="applyPlan"
        >
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
      The active source is not a Music Assistant queue. Select a local MA queue
      to analyze and reorder it.
    </div>

    <div
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-xl border border-destructive/50 p-4 text-sm"
      role="alert"
    >
      <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-1">{{ errorMessage }}</div>
      <Button size="sm" variant="outline" @click="errorMessage = ''"
        >Dismiss</Button
      >
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <!-- Live queue workstation -->
      <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">Live queue</h2>
            <p class="text-sm text-muted-foreground">
              {{ tracks.length }} upcoming track(s) ·
              {{ analyzedCount }} analyzed
              <template
                v-if="
                  optimizedWindow > 0 &&
                  queueItemCount > 0 &&
                  optimizedWindow < queueItemCount
                "
              >
                · window {{ optimizedWindow }} of {{ queueItemCount }}
              </template>
            </p>
          </div>
          <Badge v-if="pendingPlan" variant="secondary" class="rounded-full">
            Plan ready — not applied
          </Badge>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="min-w-0 rounded-lg border p-3">
            <p
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Now playing
            </p>
            <template v-if="currentTrack">
              <p class="truncate font-medium">
                {{ currentTrack.name || "Unknown track" }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ currentTrack.artist || "Unknown artist" }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline"
                  >{{ bpmLabel(currentTrack.analysis?.bpm) }} BPM</Badge
                >
                <Badge
                  v-if="currentTrack.analysis?.camelot"
                  variant="outline"
                  >{{ currentTrack.analysis.camelot }}</Badge
                >
                <Badge
                  v-if="currentTrack.analysis?.energy != null"
                  variant="outline"
                >
                  Energy {{ pct(currentTrack.analysis.energy) }}
                </Badge>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground">
              Analyze a queue to load the current track.
            </p>
          </div>

          <div class="min-w-0 rounded-lg border p-3">
            <p
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Up next
            </p>
            <template v-if="tracks[0]">
              <p class="truncate font-medium">
                {{ tracks[0].name || "Unknown track" }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ tracks[0].artist || "Unknown artist" }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline"
                  >{{ bpmLabel(tracks[0].analysis?.bpm) }} BPM</Badge
                >
                <Badge v-if="tracks[0].analysis?.camelot" variant="outline">
                  {{ tracks[0].analysis.camelot }}
                </Badge>
                <Badge v-if="tracks[0].score != null" variant="outline">
                  {{ Math.round(tracks[0].score * 100) }}% match
                </Badge>
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
            <select
              v-model="mode"
              class="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="ai_dj">AI DJ — balanced compatibility</option>
              <option value="party">Party — energy and danceability</option>
              <option value="chill">Chill — gentler progression</option>
              <option value="workout">Workout — tempo consistency</option>
              <option value="custom">Custom — use my signal weights</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium">Analysis source</span>
            <select
              v-model="analysisProvider"
              class="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="auto">Automatic — Music Assistant first</option>
              <option value="music_assistant">Music Assistant only</option>
              <option value="musicae">Musicae</option>
            </select>
          </label>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label
            class="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <span>
              <span class="block font-medium">Smart Reorder</span>
              <span class="text-xs text-muted-foreground"
                >Choose the best upcoming order</span
              >
            </span>
            <input v-model="smartReorder" type="checkbox" class="h-4 w-4" />
          </label>
          <div class="rounded-lg border p-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">AutoMix execution</span>
              <Badge variant="outline" class="rounded-full">
                {{ autoMixAvailable ? "Available" : "Backend unavailable" }}
              </Badge>
            </div>
            <label class="mt-2 flex items-center justify-between gap-3">
              <span class="text-xs text-muted-foreground"
                >Enable actual transitions</span
              >
              <input
                v-model="automix"
                type="checkbox"
                class="h-4 w-4"
                :disabled="!autoMixAvailable"
                :title="
                  autoMixAvailable
                    ? 'Enable supported AutoMix'
                    : 'The current server does not execute Smart DJ transitions'
                "
              />
            </label>
            <p
              v-if="!autoMixAvailable"
              class="mt-2 text-xs text-muted-foreground"
            >
              Current server can plan queue order, but does not execute Smart DJ
              transitions. Native player crossfade is separate.
            </p>
            <button
              type="button"
              class="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              :disabled="loading || completingMix"
              title="Ask Musicae for compatible tracks and append them to complete the mix"
              @click="completeMix()"
            >
              {{
                completingMix ? "Completing…" : "Complete mix (add 5 tracks)"
              }}
            </button>
            <button
              v-if="justAdded.size"
              type="button"
              class="mt-2 w-full rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              @click="justAdded = new Set()"
            >
              Clear "Smart DJ added" highlights ({{ justAdded.size }})
            </button>
          </div>
        </div>
      </section>

      <!-- Collapsible: mix behavior -->
      <details class="rounded-xl border bg-card shadow-sm" open>
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5"
        >
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="h-5 w-5" />
            <div>
              <h2 class="text-lg font-semibold">Mix behavior</h2>
              <p class="text-sm text-muted-foreground">
                Transition length, style, strictness, lookahead
              </p>
            </div>
          </div>
          <ChevronDown class="h-4 w-4 shrink-0" />
        </summary>
        <div class="space-y-4 border-t p-4 md:p-5">
          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Transition length</span>
              <span class="text-muted-foreground"
                >{{ transitionBars }} bars</span
              >
            </span>
            <select
              v-model.number="transitionBars"
              class="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option :value="4">4 bars — quick blend</option>
              <option :value="8">8 bars — standard</option>
              <option :value="16">16 bars — extended</option>
              <option :value="32">32 bars — long blend</option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">Blend style</span>
            <select
              v-model="transitionStyle"
              class="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="auto">Auto — genre defaults decide</option>
              <option value="full_blend">
                Full blend — long beat-matched mix
              </option>
              <option value="energy">Energy — medium blend</option>
              <option value="quick_cut">Quick cut — short downbeat fade</option>
              <option value="radio">
                Radio — sequential handover, decks never blend
              </option>
            </select>
            <span class="mt-1 block text-xs text-muted-foreground">
              Auto picks full blends for dance material and radio handovers for
              vocal-dense or live material. An explicit pick always wins.
            </span>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">Beat matching</span>
            <select
              v-model="beatStrictness"
              class="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="strict">
                Strict — only near-identical tempo (±6%)
              </option>
              <option value="normal">Normal — engine default (±8%)</option>
              <option value="aggressive">
                Aggressive — stretch further (±12%)
              </option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Lookahead</span>
              <span class="text-muted-foreground"
                >{{ lookahead }} ahead · beam
                {{ Math.min(96, Math.max(4, lookahead * 3)) }}</span
              >
            </span>
            <input
              v-model.number="lookahead"
              type="range"
              min="1"
              max="96"
              step="1"
              class="mt-2 w-full"
            />
            <span class="mt-1 block text-xs text-muted-foreground"
              >Search width is lookahead × 3, capped at 96 tracks — a value of
              32 already searches the full 96.</span
            >
          </label>

          <label class="block text-sm">
            <span class="flex justify-between gap-3">
              <span class="font-medium">Transition aggressiveness</span>
              <span class="text-muted-foreground"
                >{{ Math.round(transitionAggressiveness * 100) }}%</span
              >
            </span>
            <input
              v-model.number="transitionAggressiveness"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="mt-2 w-full"
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium"
              >Maximum consecutive tracks per artist</span
            >
            <input
              v-model.number="maxArtistRepeat"
              type="number"
              min="1"
              max="20"
              class="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>

          <label class="flex items-center justify-between gap-3 text-sm">
            <span>
              <span class="block font-medium">Preserve variety</span>
              <span class="text-xs text-muted-foreground"
                >Avoid repetitive artist/genre runs</span
              >
            </span>
            <input v-model="preserveVariety" type="checkbox" class="h-4 w-4" />
          </label>
        </div>
      </details>
    </div>

    <!-- Collapsible: library analysis tools -->
    <details class="rounded-xl border bg-card shadow-sm" open>
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5"
      >
        <div class="flex items-center gap-2">
          <LibraryBig class="h-5 w-5" />
          <div>
            <h2 class="text-lg font-semibold">Library analysis</h2>
            <p class="text-sm text-muted-foreground">
              Backfill the local analyzer for the whole library, then build a
              ready-to-mix playlist from the analyzed tracks
            </p>
          </div>
        </div>
        <ChevronDown class="h-4 w-4 shrink-0" />
      </summary>
      <div class="grid gap-4 border-t p-4 md:grid-cols-2 md:p-5">
        <!-- sweep -->
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">Analyze entire library</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Streams every unanalyzed track silently through the local analyzer
            (no quota, audio never stored). Pauses itself while you are playing
            music and resumes when idle.
          </p>
          <div
            v-if="sweep && (sweep.running || sweep.total)"
            class="mt-3 space-y-2"
          >
            <Progress :model-value="sweepProgressPct" />
            <div
              class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>
                {{ sweep.analyzed }} analyzed · {{ sweep.skipped }} already had
                data · {{ sweep.failed }} failed · {{ sweep.total }} total
              </span>
              <Badge
                v-if="sweep.deferring"
                variant="secondary"
                class="rounded-full"
              >
                <PauseCircle class="mr-1 h-3 w-3" /> paused — music is playing
              </Badge>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              :disabled="!!sweep?.running"
              @click="startLibraryScan()"
            >
              <Spinner
                v-if="sweep?.running"
                class="mr-2 h-4 w-4"
                :show="true"
              />
              <DatabaseZap v-else class="mr-2 h-4 w-4" />
              {{ sweep?.running ? "Analyzing…" : "Analyze entire library" }}
            </Button>
            <Button
              v-if="sweep?.running"
              size="sm"
              variant="outline"
              @click="cancelLibraryScan()"
            >
              <Square class="mr-2 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
          <p
            v-if="sweep && !sweep.running && sweep.finished_at"
            class="mt-2 text-xs text-muted-foreground"
          >
            Last sweep finished: {{ sweep.analyzed }} new ·
            {{ sweep.skipped }} skipped · {{ sweep.failed }} failed
            <template v-if="sweep.cancelled"> · cancelled</template>
          </p>
        </div>

        <!-- create analyzed playlist -->
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">Create playlist from analyzed tracks</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Builds a playlist out of the tracks that HAVE full analysis data — a
            guaranteed ready-to-mix pool. Add a search to narrow it (name,
            artist, genre).
          </p>
          <div class="mt-3 space-y-2">
            <input
              v-model="analyzedPlaylistName"
              type="text"
              placeholder="Playlist name"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              v-model="analyzedPlaylistSearch"
              type="text"
              placeholder="Search filter (optional) — e.g. techno"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              class="w-full"
              :disabled="creatingPlaylist"
              @click="createAnalyzedPlaylist()"
            >
              <ListPlus class="mr-2 h-4 w-4" />
              {{ creatingPlaylist ? "Creating…" : "Create playlist" }}
            </Button>
          </div>
        </div>
      </div>
    </details>

    <!-- Energy journey -->
    <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div
        class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold">Energy journey</h2>
          <p class="text-sm text-muted-foreground">
            Actual analyzed energy for the current queue order or proposed plan.
          </p>
        </div>
        <span class="text-xs text-muted-foreground">
          {{ energyPoints.length }} / {{ tracks.length }} tracks have energy
          data
        </span>
      </div>
      <div
        v-if="energyPoints.length"
        class="grid grid-cols-8 items-end gap-2 rounded-lg border p-3 sm:grid-cols-12 lg:grid-cols-12"
      >
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
          <span
            class="w-full truncate text-center text-[10px] text-muted-foreground"
          >
            {{ point.index + 1 }}
          </span>
        </div>
      </div>
      <p
        v-else
        class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground"
      >
        Energy analysis is not available for the current queue. Run Analyze
        queue or configure a supported analysis provider.
      </p>
      <div class="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
        <Activity class="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The current engine scores energy compatibility but does not return a
          generated energy target curve. This chart shows measured track energy,
          not a prediction.
        </p>
      </div>
    </section>

    <!-- Intelligent queue with album art rows -->
    <section class="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div
        class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold">Intelligent queue</h2>
          <p class="text-sm text-muted-foreground">
            Pin tracks, exclude tracks, and inspect the engine's reasons before
            applying.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge variant="outline">Required: {{ requiredCount }}</Badge>
          <Badge variant="outline">Fixed: {{ fixedCount }}</Badge>
          <Badge variant="outline">Excluded: {{ excludedCount }}</Badge>
        </div>
      </div>

      <div v-if="tracks.length" class="space-y-3">
        <article
          v-for="(track, index) in tracks"
          :key="track.queue_item_id"
          class="relative overflow-hidden rounded-lg border p-3"
          :class="{
            'border-primary/60': track.fixed,
            'opacity-60': track.excluded,
          }"
        >
          <!-- album art behind the row -->
          <img
            v-if="artworkUrl(track)"
            :src="artworkUrl(track)"
            :alt="''"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-md dark:opacity-20"
          />
          <div
            class="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start"
          >
            <div class="flex min-w-0 flex-1 gap-3">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/80 text-sm font-semibold shadow-sm backdrop-blur"
              >
                {{ index + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate font-medium drop-shadow-sm">
                    {{ track.name || "Unknown track" }}
                  </h3>
                  <Badge
                    v-if="justAdded.has(track.name)"
                    class="rounded-full"
                    variant="default"
                  >
                    <Sparkles class="mr-1 h-3 w-3" /> Smart DJ added
                  </Badge>
                  <Badge
                    v-if="track.fixed"
                    variant="secondary"
                    class="rounded-full"
                    >Fixed position</Badge
                  >
                  <Badge
                    v-if="track.required"
                    variant="secondary"
                    class="rounded-full"
                    >Required</Badge
                  >
                  <Badge
                    v-if="track.excluded"
                    variant="destructive"
                    class="rounded-full"
                    >Excluded</Badge
                  >
                </div>
                <p
                  class="truncate text-sm text-muted-foreground drop-shadow-sm"
                >
                  {{ track.artist || "Unknown artist" }}
                </p>

                <div class="mt-2 flex flex-wrap gap-2">
                  <Badge v-if="track.analysis?.bpm != null" variant="secondary"
                    >{{ bpmLabel(track.analysis.bpm) }} BPM</Badge
                  >
                  <Badge v-if="track.analysis?.camelot" variant="secondary">{{
                    track.analysis.camelot
                  }}</Badge>
                  <Badge
                    v-if="track.analysis?.energy != null"
                    variant="secondary"
                    >Energy {{ pct(track.analysis.energy) }}</Badge
                  >
                  <Badge
                    v-if="track.analysis?.danceability != null"
                    variant="secondary"
                    >Dance {{ pct(track.analysis.danceability) }}</Badge
                  >
                  <Badge
                    v-if="track.analysis?.loudness != null"
                    variant="secondary"
                    >Loudness {{ track.analysis.loudness.toFixed(1) }} dB</Badge
                  >
                  <Badge
                    v-if="track.clap_similarity != null"
                    variant="secondary"
                    >Sonic {{ pct(track.clap_similarity) }}</Badge
                  >
                  <Badge v-if="track.bpm_change != null" variant="secondary"
                    >Δ {{ signed(track.bpm_change) }} BPM</Badge
                  >
                  <Badge v-if="track.key_affinity != null" variant="secondary"
                    >Key {{ pct(track.key_affinity) }}</Badge
                  >
                  <Badge v-if="track.energy_delta != null" variant="secondary"
                    >Energy Δ {{ signed(track.energy_delta * 100) }}%</Badge
                  >
                  <Badge v-if="track.score != null"
                    >{{ Math.round(track.score * 100) }} / 100 match</Badge
                  >
                  <Badge v-if="track.analysis?.source" variant="outline">
                    Source: {{ track.analysis.source }}
                  </Badge>
                </div>

                <div
                  v-if="track.reasons.length"
                  class="mt-2 text-sm text-muted-foreground"
                >
                  <span class="font-medium text-foreground">Why selected:</span>
                  {{ track.reasons.join(" · ") }}
                </div>
                <p v-else class="mt-2 text-xs text-muted-foreground">
                  No ranking explanation returned yet. Build a plan to request
                  scores and reasons.
                </p>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-[390px] lg:grid-cols-2"
            >
              <label
                class="flex items-center gap-2 rounded-md border bg-background/70 p-2 backdrop-blur"
              >
                <input
                  v-model="track.required"
                  type="checkbox"
                  class="h-4 w-4"
                  @change="onConstraintChange"
                />
                Required
              </label>
              <label
                class="flex items-center gap-2 rounded-md border bg-background/70 p-2 backdrop-blur"
              >
                <input
                  v-model="track.fixed"
                  type="checkbox"
                  class="h-4 w-4"
                  @change="onConstraintChange"
                />
                Fixed position
              </label>
              <label
                class="flex items-center gap-2 rounded-md border bg-background/70 p-2 backdrop-blur"
              >
                <input
                  v-model="track.excluded"
                  type="checkbox"
                  class="h-4 w-4"
                  @change="onConstraintChange"
                />
                Exclude
              </label>
              <label
                class="flex flex-col gap-1 rounded-md border bg-background/70 p-2 backdrop-blur"
              >
                <span>Transition into track</span>
                <select
                  :value="track.transition_override ?? ''"
                  class="w-full rounded border bg-background px-2 py-1"
                  @change="
                    setTransitionOverride(
                      track,
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
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
        <p class="mt-1 text-sm text-muted-foreground">
          Select a Music Assistant queue and run Analyze queue.
        </p>
      </div>

      <!-- gap slot: re-anchor the mix with a library search -->
      <div v-if="gapSlotOpen" class="mt-4 rounded-lg border border-dashed p-4">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 class="font-medium">Search your library</h3>
            <p class="text-xs text-muted-foreground">
              Pick a track to play now — the mix re-anchors around it.
            </p>
          </div>
          <Button size="sm" variant="outline" @click="gapSlotOpen = false">
            Close
          </Button>
        </div>
        <input
          v-model="gapSearch"
          type="text"
          placeholder="Search tracks in your library…"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          @input="searchGapTracks"
        />
        <div class="mt-3 max-h-72 space-y-2 overflow-y-auto">
          <div
            v-for="result in gapResults"
            :key="result.uri ?? result.item_id"
            class="flex items-center gap-3 rounded-md border p-2"
          >
            <img
              v-if="gapResultImage(result)"
              :src="gapResultImage(result)"
              :alt="''"
              aria-hidden="true"
              class="h-10 w-10 rounded object-cover"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ result.name }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{
                  result.artists
                    ?.map((artist: { name: string }) => artist.name)
                    .join(", ") || ""
                }}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              :disabled="!currentQueueId()"
              @click="playGapTrack(result)"
            >
              <Play class="mr-1 h-3.5 w-3.5" />
              Play now
            </Button>
          </div>
          <p
            v-if="gapSearch && !gapSearching && !gapResults.length"
            class="text-sm text-muted-foreground"
          >
            No library tracks match "{{ gapSearch }}".
          </p>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="mt-4 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        @click="gapSlotOpen = true"
      >
        <Search class="mr-1 inline h-3.5 w-3.5" /> Nothing fits? Search your
        library to fill the gap
      </button>
    </section>

    <!-- Collapsible: advanced tuning and diagnostics -->
    <details class="rounded-xl border bg-card shadow-sm">
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5"
      >
        <div class="flex items-center gap-2">
          <Settings2 class="h-5 w-5" />
          <div>
            <h2 class="font-semibold">Advanced controls & diagnostics</h2>
            <p class="text-sm text-muted-foreground">
              Scoring rules, hard constraints, provider health
            </p>
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
              <input
                v-model.number="bpmMin"
                type="number"
                min="1"
                max="300"
                placeholder="No minimum"
                class="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Maximum BPM</span>
              <input
                v-model.number="bpmMax"
                type="number"
                min="1"
                max="300"
                placeholder="No maximum"
                class="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Maximum BPM jump</span>
              <input
                v-model.number="maxBpmJump"
                type="number"
                min="0"
                max="100"
                placeholder="No limit"
                class="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">BPM tolerance (0.01–1)</span>
              <input
                v-model.number="bpmTolerance"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                class="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Key relationship</span>
              <select
                v-model="keyRelation"
                class="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="compatible">Harmonically compatible</option>
                <option value="same">Same key only</option>
                <option value="soft">Prefer key (soft)</option>
                <option value="any">Ignore key</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Instrumental preference</span>
              <select
                v-model="instrumental"
                class="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="any">Any</option>
                <option value="prefer">Prefer instrumental</option>
                <option value="required">Require instrumental</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">Explicit content</span>
              <select
                v-model="explicit"
                class="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="allow">Allow</option>
                <option value="exclude">Exclude explicit / unknown</option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block">End track</span>
              <select
                v-model="endTrackId"
                class="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">No fixed ending</option>
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

        <div>
          <h3 class="mb-1 font-medium">Signal policy</h3>
          <p class="mb-3 text-sm text-muted-foreground">
            Hard rejects candidates, Soft influences ranking, Disabled removes
            the signal from scoring.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="signalName in signalNames"
              :key="signalName"
              class="rounded-lg border p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <label
                  class="font-medium capitalize"
                  :for="`signal-${signalName}`"
                  >{{ signalLabel(signalName) }}</label
                >
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
                <dd>
                  {{
                    capabilities?.analysis.music_assistant
                      ? "Available"
                      : "Unavailable"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Musicae configured</dt>
                <dd>{{ capabilities?.analysis.musicae ? "Yes" : "No" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Smart Fades reported</dt>
                <dd>
                  {{
                    capabilities?.mixing.smart_fades
                      ? "Reported"
                      : "Unavailable"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Transition planner</dt>
                <dd>
                  {{
                    capabilities?.mixing.transition_planner
                      ? "Available"
                      : "Not implemented on server"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Vocal protection</dt>
                <dd>
                  {{
                    capabilities?.mixing.vocal_protection
                      ? "Reported"
                      : "Unavailable"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Bass EQ management</dt>
                <dd>
                  {{
                    capabilities?.mixing.bass_eq_management
                      ? "Reported"
                      : "Unavailable"
                  }}
                </dd>
              </div>
            </dl>
          </div>
          <div class="rounded-lg border p-3">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="font-medium">Provider status</h3>
              <Button
                size="sm"
                variant="outline"
                :disabled="diagnosticsLoading"
                @click="loadDiagnostics"
              >
                <RefreshCw
                  class="mr-1 h-3.5 w-3.5"
                  :class="{ 'animate-spin': diagnosticsLoading }"
                />
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
                <dd class="max-w-[60%] break-all text-right">
                  {{ status?.musicae_host ?? "Unknown" }}
                </dd>
              </div>
            </dl>
            <p class="mt-3 text-xs text-muted-foreground">
              Credentials are never displayed here. Configure the Musicae key in
              the Smart DJ provider settings.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            variant="outline"
            :disabled="loading"
            @click="resetPreferences"
          >
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

    <div
      class="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <span
        >Queue changes are not made until Apply plan is pressed. Applying calls
        rank_queue again with the saved controls, so a changing queue may
        produce a different order than the preview. Enable Smart Reorder to
        build or apply a ranked plan.</span
      >
      <span>{{
        pendingPlan ? "A plan is waiting for approval." : "No unapplied plan."
      }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { getMediaItemImageUrl } from "@/helpers/utils";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  Activity,
  Check,
  ChevronDown,
  CircleAlert,
  DatabaseZap,
  LibraryBig,
  ListPlus,
  Music2,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  WandSparkles,
} from "@lucide/vue";
import {
  QueueOption,
  type MediaItemImage,
  type Track,
} from "@/plugins/api/interfaces";
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
interface TrackImage {
  path: string;
  proxy_id: string | null;
  remotely_accessible: boolean | null;
}
interface SmartTrack {
  queue_item_id: string;
  name: string;
  artist: string;
  provider: string;
  item_id: string;
  image: TrackImage | null;
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
  added?: unknown[];
  seed?: { name?: string } | null;
}
interface LibraryScanState {
  running: boolean;
  total: number;
  analyzed: number;
  skipped: number;
  failed: number;
  errors: string[];
  deferring: boolean;
  cancelled: boolean;
  started_at: number | null;
  finished_at: number | null;
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
const trackFlags = ref<
  Record<string, { required: boolean; fixed: boolean; excluded: boolean }>
>({});
// library analysis sweep + analyzed playlist builder
const sweep = ref<LibraryScanState | null>(null);
const analyzedPlaylistName = ref("Smart DJ - analyzed");
const analyzedPlaylistSearch = ref("");
const creatingPlaylist = ref(false);
// complete-mix "added" chips (matched by name, the response's shape)
const justAdded = ref<Set<string>>(new Set());
// gap slot: library search to re-anchor the mix
const gapSlotOpen = ref(false);
const gapSearch = ref("");
const gapSearching = ref(false);
const gapResults = ref<Track[]>([]);
let refreshGeneration = 0;
let plannedControls: RawObject | null = null;
let sweepPollTimer: ReturnType<typeof setInterval> | null = null;
let gapSearchTimer: ReturnType<typeof setTimeout> | null = null;

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
  () =>
    [currentTrack.value, ...tracks.value].filter(
      (t) => t?.analysis !== null && t?.analysis != null,
    ).length,
);
const requiredCount = computed(
  () => tracks.value.filter((t) => t.required).length,
);
const fixedCount = computed(() => tracks.value.filter((t) => t.fixed).length);
const excludedCount = computed(
  () => tracks.value.filter((t) => t.excluded).length,
);
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
    .filter(
      (
        point,
      ): point is { id: string; name: string; energy: number; index: number } =>
        typeof point.energy === "number" && Number.isFinite(point.energy),
    ),
);
const sweepProgressPct = computed(() => {
  const s = sweep.value;
  if (!s || !s.total) return 0;
  return Math.round(((s.analyzed + s.skipped + s.failed) / s.total) * 100);
});

function bpmLabel(value: number | null | undefined): string {
  return value == null ? "—" : String(Math.round(value));
}
function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value * 100)}%`;
}
function signed(value: number): string {
  const n = Math.round(value * 10) / 10;
  return `${n > 0 ? "+" : ""}${n}`;
}
function signalLabel(name: SignalName): string {
  return name.replaceAll("_", " ");
}
function artworkUrl(track: SmartTrack): string {
  return track.image
    ? getMediaItemImageUrl(track.image as MediaItemImage, 256)
    : "";
}
function gapResultImage(track: Track): string {
  const raw = track.image as
    MediaItemImage[] | MediaItemImage | null | undefined;
  const img = Array.isArray(raw) ? raw[0] : raw;
  return img ? getMediaItemImageUrl(img, 96) : "";
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
function normalizeImage(value: unknown): TrackImage | null {
  if (!value || typeof value !== "object") return null;
  const img = value as RawObject;
  if (typeof img.path !== "string" || !img.path) return null;
  return {
    path: img.path,
    proxy_id: typeof img.proxy_id === "string" ? img.proxy_id : null,
    remotely_accessible:
      typeof img.remotely_accessible === "boolean"
        ? img.remotely_accessible
        : null,
  };
}
function decorate(
  value: unknown,
  previous?: Map<string, SmartTrack>,
): SmartTrack {
  const a = (value && typeof value === "object" ? value : {}) as RawObject;
  const id = String(a.queue_item_id ?? "");
  const old = previous?.get(id);
  const nested = normalizeAnalysis(a.analysis);
  // rank_queue may return flattened analysis fields; normalize both response shapes.
  const flattened = normalizeAnalysis(a);
  const analysis =
    nested ??
    (flattened &&
    [
      flattened.bpm,
      flattened.key,
      flattened.camelot,
      flattened.energy,
      flattened.danceability,
      flattened.loudness,
    ].some((v) => v !== null)
      ? flattened
      : null);
  return {
    queue_item_id: id,
    name: String(a.name ?? ""),
    artist: String(a.artist ?? ""),
    provider: String(a.provider ?? ""),
    item_id: String(a.item_id ?? ""),
    image: normalizeImage(a.image),
    analysis,
    score: typeof a.score === "number" ? a.score : null,
    reasons: Array.isArray(a.reasons)
      ? a.reasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : [],
    bpm_change: typeof a.bpm_change === "number" ? a.bpm_change : null,
    energy_delta: typeof a.energy_delta === "number" ? a.energy_delta : null,
    key_affinity: typeof a.key_affinity === "number" ? a.key_affinity : null,
    transition_bars:
      typeof a.transition_bars === "number" ? a.transition_bars : null,
    clap_similarity:
      typeof a.clap_similarity === "number" ? a.clap_similarity : null,
    transition_override:
      old?.transition_override ?? transitionOverrides.value[id] ?? null,
    required:
      old?.required ?? trackFlags.value[id]?.required ?? Boolean(a.required),
    fixed: old?.fixed ?? trackFlags.value[id]?.fixed ?? Boolean(a.fixed),
    excluded:
      old?.excluded ?? trackFlags.value[id]?.excluded ?? Boolean(a.excluded),
  };
}
function currentQueueId(): string | null {
  return activeQueue.value?.queue_id ?? null;
}
function buildControls(apply = false): RawObject {
  const controls: RawObject = {
    ...Object.fromEntries(
      signalNames.map((name) => [name, { ...signals[name] }]),
    ),
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
    required_ids: tracks.value
      .filter((track) => track.required)
      .map((track) => track.queue_item_id),
    fixed_ids: tracks.value
      .filter((track) => track.fixed)
      .map((track) => track.queue_item_id),
    excluded_ids: tracks.value
      .filter((track) => track.excluded)
      .map((track) => track.queue_item_id),
  };
  return controls;
}
function savePreferences(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
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
        trackFlags: Object.fromEntries(
          tracks.value.map((track) => [
            track.queue_item_id,
            {
              required: track.required,
              fixed: track.fixed,
              excluded: track.excluded,
            },
          ]),
        ),
        signals: JSON.parse(JSON.stringify(signals)),
      }),
    );
  } catch (error) {
    toast.error(`Could not save Smart DJ controls: ${String(error)}`);
  }
}
function restorePreferences(): void {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}",
    ) as RawObject;
    if (
      typeof saved.mode === "string" &&
      ["ai_dj", "party", "chill", "workout", "custom"].includes(saved.mode)
    )
      mode.value = saved.mode;
    if (
      typeof saved.analysisProvider === "string" &&
      ["auto", "music_assistant", "musicae"].includes(saved.analysisProvider)
    )
      analysisProvider.value = saved.analysisProvider;
    if (typeof saved.bpmMin === "number" || saved.bpmMin === null)
      bpmMin.value = saved.bpmMin as number | null;
    if (typeof saved.bpmMax === "number" || saved.bpmMax === null)
      bpmMax.value = saved.bpmMax as number | null;
    if (typeof saved.maxBpmJump === "number" || saved.maxBpmJump === null)
      maxBpmJump.value = saved.maxBpmJump as number | null;
    if (typeof saved.bpmTolerance === "number")
      bpmTolerance.value = clamp(saved.bpmTolerance, 0.01, 1);
    if (
      typeof saved.keyRelation === "string" &&
      ["compatible", "same", "soft", "any"].includes(saved.keyRelation)
    )
      keyRelation.value = saved.keyRelation;
    if (
      typeof saved.instrumental === "string" &&
      ["any", "prefer", "required"].includes(saved.instrumental)
    )
      instrumental.value = saved.instrumental;
    if (
      typeof saved.explicit === "string" &&
      ["allow", "exclude"].includes(saved.explicit)
    )
      explicit.value = saved.explicit;
    if (
      typeof saved.transitionBars === "number" &&
      [4, 8, 16, 32].includes(saved.transitionBars)
    )
      transitionBars.value = saved.transitionBars;
    if (typeof saved.lookahead === "number")
      lookahead.value = Math.round(clamp(saved.lookahead, 1, 96));
    if (
      typeof saved.transitionStyle === "string" &&
      ["auto", "full_blend", "energy", "quick_cut", "radio"].includes(
        saved.transitionStyle,
      )
    )
      transitionStyle.value = saved.transitionStyle;
    if (
      typeof saved.beatStrictness === "string" &&
      ["strict", "normal", "aggressive"].includes(saved.beatStrictness)
    )
      beatStrictness.value = saved.beatStrictness;
    if (typeof saved.maxArtistRepeat === "number")
      maxArtistRepeat.value = Math.round(clamp(saved.maxArtistRepeat, 1, 20));
    if (typeof saved.transitionAggressiveness === "number")
      transitionAggressiveness.value = clamp(
        saved.transitionAggressiveness,
        0,
        1,
      );
    if (typeof saved.automix === "boolean") automix.value = saved.automix;
    if (typeof saved.smartReorder === "boolean")
      smartReorder.value = saved.smartReorder;
    if (typeof saved.preserveVariety === "boolean")
      preserveVariety.value = saved.preserveVariety;
    if (typeof saved.endTrackId === "string")
      endTrackId.value = saved.endTrackId;
    if (
      saved.trackFlags &&
      typeof saved.trackFlags === "object" &&
      !Array.isArray(saved.trackFlags)
    ) {
      for (const [id, raw] of Object.entries(saved.trackFlags as RawObject)) {
        if (!raw || typeof raw !== "object") continue;
        const flag = raw as RawObject;
        trackFlags.value[id] = {
          required: Boolean(flag.required),
          fixed: Boolean(flag.fixed),
          excluded: Boolean(flag.excluded),
        };
      }
    }
    if (
      saved.transitionOverrides &&
      typeof saved.transitionOverrides === "object" &&
      !Array.isArray(saved.transitionOverrides)
    ) {
      for (const [id, raw] of Object.entries(
        saved.transitionOverrides as RawObject,
      )) {
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
        if (state === "hard" || state === "soft" || state === "disabled")
          signals[name].state = state;
        if (typeof weight === "number" && Number.isFinite(weight))
          signals[name].weight = clamp(weight, 0, 3);
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
    const result = await api.sendCommand<ApiResponse>("smart_dj/complete_mix", {
      queue_id: queueId,
      count: 5,
    });
    const addedNames = (
      Array.isArray(result?.added) ? result.added : []
    ).filter((name): name is string => typeof name === "string");
    await refresh();
    if (addedNames.length) {
      justAdded.value = new Set(addedNames);
      toast.success(
        `Smart DJ added ${addedNames.length} track(s): ${addedNames.join(", ")}`,
      );
    } else {
      toast.success("Complete mix finished (no new tracks were added).");
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    toast.error(`Complete mix failed: ${errorMessage.value}`);
    gapSlotOpen.value = true;
  } finally {
    completingMix.value = false;
  }
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function onConstraintChange(): void {
  trackFlags.value = Object.fromEntries(
    tracks.value.map((track) => [
      track.queue_item_id,
      {
        required: track.required,
        fixed: track.fixed,
        excluded: track.excluded,
      },
    ]),
  );
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
  justAdded.value = new Set();
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
async function startLibraryScan(): Promise<void> {
  errorMessage.value = "";
  try {
    sweep.value = await api.sendCommand<LibraryScanState>(
      "smart_dj/analyze_library_local",
      { command: "start", pause_while_playing: true },
    );
    if (sweep.value.running) startSweepPolling();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}
async function cancelLibraryScan(): Promise<void> {
  try {
    sweep.value = await api.sendCommand<LibraryScanState>(
      "smart_dj/analyze_library_local",
      { command: "cancel" },
    );
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}
async function pollSweep(): Promise<void> {
  try {
    const state = await api.sendCommand<LibraryScanState>(
      "smart_dj/analyze_library_local",
      { command: "status" },
    );
    sweep.value = state;
    if (!state.running) stopSweepPolling();
  } catch {
    // transient backend hiccup: keep the last known state and retry
  }
}
function startSweepPolling(): void {
  if (sweepPollTimer) return;
  sweepPollTimer = setInterval(() => void pollSweep(), 5000);
}
function stopSweepPolling(): void {
  if (sweepPollTimer) {
    clearInterval(sweepPollTimer);
    sweepPollTimer = null;
  }
}
async function createAnalyzedPlaylist(): Promise<void> {
  creatingPlaylist.value = true;
  errorMessage.value = "";
  try {
    const result = await api.sendCommand<{
      playlist_id: string;
      tracks: number;
    }>("smart_dj/create_analyzed_playlist", {
      name: analyzedPlaylistName.value || "Smart DJ - analyzed",
      search: analyzedPlaylistSearch.value.trim(),
    });
    toast.success(`Playlist created with ${result.tracks} analyzed track(s).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    toast.error(`Could not create the playlist: ${message}`);
  } finally {
    creatingPlaylist.value = false;
  }
}
function searchGapTracks(): void {
  if (gapSearchTimer) clearTimeout(gapSearchTimer);
  const term = gapSearch.value.trim();
  if (!term) {
    gapResults.value = [];
    return;
  }
  gapSearchTimer = setTimeout(async () => {
    gapSearching.value = true;
    try {
      gapResults.value = await api.getLibraryTracks(false, term, 25, 0);
    } catch {
      gapResults.value = [];
    } finally {
      gapSearching.value = false;
    }
  }, 300);
}
async function playGapTrack(track: Track): Promise<void> {
  const queueId = currentQueueId();
  if (!queueId || !track.uri) return;
  try {
    await api.playMedia(track.uri, QueueOption.PLAY, { queue_id: queueId });
    justAdded.value = new Set();
    gapSlotOpen.value = false;
    toast.success(`Playing ${track.name} — the mix re-anchors around it.`);
    await refresh();
  } catch (error) {
    toast.error(
      `Could not play ${track.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
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
    const oldById = new Map(
      [
        ...tracks.value,
        ...(currentTrack.value ? [currentTrack.value] : []),
      ].map((track) => [track.queue_item_id, track]),
    );
    const all = (Array.isArray(result?.tracks) ? result.tracks : []).map(
      (item) => decorate(item, oldById),
    );
    currentTrack.value = all[0] ?? null;
    tracks.value = all.slice(1);
    pendingPlan.value = false;
    plannedControls = null;
    if (typeof result?.optimized_window === "number")
      optimizedWindow.value = result.optimized_window;
    if (typeof result?.queue_item_count === "number")
      queueItemCount.value = result.queue_item_count;
    await loadDiagnostics();
  } catch (error) {
    if (generation === refreshGeneration)
      errorMessage.value =
        error instanceof Error ? error.message : String(error);
  } finally {
    if (generation === refreshGeneration) loading.value = false;
  }
}
async function plan(): Promise<void> {
  const queueId = currentQueueId();
  if (!queueId || !tracks.value.length) return;
  if (
    bpmMin.value != null &&
    bpmMax.value != null &&
    bpmMin.value > bpmMax.value
  ) {
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
    const oldById = new Map(
      previousTracks.map((track) => [track.queue_item_id, track]),
    );
    const ranked = (Array.isArray(result?.tracks) ? result.tracks : []).map(
      (item) => decorate(item, oldById),
    );
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
    const oldById = new Map(
      tracks.value.map((track) => [track.queue_item_id, track]),
    );
    tracks.value = (Array.isArray(result?.tracks) ? result.tracks : []).map(
      (item) => decorate(item, oldById),
    );
    pendingPlan.value = false;
    plannedControls = null;
    if (result?.applied === false) {
      const why = result?.reason
        ? result.reason.replaceAll("_", " ")
        : "reorder was not applied";
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
  () => {
    if (pendingPlan.value) {
      pendingPlan.value = false;
      plannedControls = null;
    }
    savePreferences();
  },
);
watch(
  () => [
    store.activePlayerId,
    activeQueue.value?.queue_id,
    activeQueue.value?.current_index,
  ],
  () => void refresh(),
);
onMounted(() => {
  restorePreferences();
  void refresh();
  // pick up an in-flight sweep from another session after a reload
  void pollSweep().then(() => {
    if (sweep.value?.running) startSweepPolling();
  });
});
onUnmounted(() => {
  refreshGeneration++;
  pendingPlan.value = false;
  plannedControls = null;
  stopSweepPolling();
  if (gapSearchTimer) clearTimeout(gapSearchTimer);
});
</script>
